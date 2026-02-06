/**
 * Helius WebSocket Monitor
 * Connects to Helius WebSocket and listens for SWAP/TRANSFER events
 * from your tracked wallets in real-time
 * 
 * Based on DevPrint's helius.rs approach - WebSocket is more reliable than webhooks
 */

import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';
import { getTokenPrice } from './birdeye.js';

const NETWORK = process.env.SOLANA_NETWORK || 'devnet';
const HELIUS_WS_URL = NETWORK === 'mainnet' 
  ? 'wss://mainnet.helius-rpc.com' 
  : 'wss://devnet.helius-rpc.com';
const RECONNECT_DELAY_MS = 5000;
const PUMPSWAP_AMM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const PUMPFUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

interface HeliusMessage {
  jsonrpc: string;
  method: string;
  params?: {
    result?: {
      signature: string;
      account?: string;
      logs?: string[];
      tokenTransfers?: Array<{
        mint: string;
        tokenAmount: {
          decimals: number;
          uiAmount: number;
          amount: string;
        };
        source: string;
        destination: string;
      }>;
    };
  };
}

export class HeliusWebSocketMonitor {
  private ws: WebSocket | null = null;
  private db: PrismaClient;
  private apiKey: string;
  private trackedWallets: Set<string>; // Changed to Set for O(1) lookups and uniqueness
  private isConnected = false;
  private reconnectAttempts = 0;
  private subscriptions: Map<string, number> = new Map(); // Track subscription IDs

  constructor(apiKey: string, trackedWallets: string[], db: PrismaClient) {
    this.apiKey = apiKey;
    this.trackedWallets = new Set(trackedWallets);
    this.db = db;
  }

  /**
   * Add a wallet to monitoring (dynamic)
   */
  addWallet(address: string): void {
    if (this.trackedWallets.has(address)) {
      console.log(`⚠️  Wallet ${address.slice(0, 8)}... already tracked`);
      return;
    }

    // Check 100 wallet limit per connection
    if (this.trackedWallets.size >= 100) {
      console.error(`❌ Cannot add wallet: maximum 100 wallets per connection reached`);
      throw new Error('Maximum wallet limit (100) reached. Need to implement multiple WebSocket connections.');
    }

    this.trackedWallets.add(address);
    console.log(`➕ Added wallet to tracking: ${address.slice(0, 8)}... (total: ${this.trackedWallets.size})`);

    // If already connected, subscribe immediately
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.subscribeToWallet(address);
    }
  }

  /**
   * Remove a wallet from monitoring
   */
  removeWallet(address: string): void {
    if (!this.trackedWallets.has(address)) {
      console.log(`⚠️  Wallet ${address.slice(0, 8)}... not tracked`);
      return;
    }

    this.trackedWallets.delete(address);
    console.log(`➖ Removed wallet from tracking: ${address.slice(0, 8)}... (total: ${this.trackedWallets.size})`);

    // If connected, unsubscribe
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      const subId = this.subscriptions.get(`wallet-${address}`);
      if (subId) {
        this.unsubscribeFromWallet(address, subId);
        this.subscriptions.delete(`wallet-${address}`);
      }
    }
  }

  /**
   * Get current tracked wallet count
   */
  getTrackedWalletCount(): number {
    return this.trackedWallets.size;
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    console.log('🟢 Starting Helius WebSocket Monitor');
    console.log(`   Tracking wallets: ${Array.from(this.trackedWallets).join(', ')}`);
    this.connect();
  }

  /**
   * Connect to Helius WebSocket
   */
  private connect(): void {
    try {
      const url = `${HELIUS_WS_URL}?api-key=${this.apiKey}`;
      console.log('🔌 Connecting to Helius WebSocket...');
      
      this.ws = new WebSocket(url);

      this.ws.on('open', () => this.onOpen());
      this.ws.on('message', (data) => this.onMessage(data));
      this.ws.on('error', (error) => this.onError(error));
      this.ws.on('close', () => this.onClose());
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * WebSocket opened
   */
  private onOpen(): void {
    console.log('✅ WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;

    // Subscribe to wallet transactions
    this.subscribeToWallets();
  }

  /**
   * Subscribe to a single wallet
   */
  private subscribeToWallet(wallet: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not open, cannot subscribe');
      return;
    }

    const subscription = {
      jsonrpc: '2.0',
      id: `wallet-${wallet}`,
      method: 'accountSubscribe',
      params: [
        wallet,
        { commitment: 'confirmed', encoding: 'jsonParsed' }
      ]
    };

    this.ws.send(JSON.stringify(subscription));
    console.log(`📡 Subscribed to wallet: ${wallet.slice(0, 8)}...`);
  }

  /**
   * Unsubscribe from a single wallet
   */
  private unsubscribeFromWallet(wallet: string, subscriptionId: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not open, cannot unsubscribe');
      return;
    }

    const unsubscribe = {
      jsonrpc: '2.0',
      id: `unsub-wallet-${wallet}`,
      method: 'accountUnsubscribe',
      params: [subscriptionId]
    };

    this.ws.send(JSON.stringify(unsubscribe));
    console.log(`📡 Unsubscribed from wallet: ${wallet.slice(0, 8)}...`);
  }

  /**
   * Subscribe to tracked wallets using accountSubscribe
   * (Helius-specific: watches accounts for changes)
   */
  private subscribeToWallets(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not open, cannot subscribe');
      return;
    }

    // Subscribe to each wallet using accountSubscribe
    for (const wallet of this.trackedWallets) {
      this.subscribeToWallet(wallet);
    }

    // Also subscribe to program logs (for Pump.fun/PumpSwap activity detection)
    const programSubscriptions = [
      { name: 'pumpswap', id: PUMPSWAP_AMM },
      { name: 'pumpfun', id: PUMPFUN_PROGRAM }
    ];

    for (const prog of programSubscriptions) {
      // Use logsSubscribe to watch for logs mentioning these programs
      const subscription = {
        jsonrpc: '2.0',
        id: `program-${prog.id}`,
        method: 'logsSubscribe',
        params: [
          { mentions: [prog.id] },
          { commitment: 'confirmed' }
        ]
      };

      this.ws!.send(JSON.stringify(subscription));
      console.log(`📡 Subscribed to program logs: ${prog.name}`);
    }
  }

  /**
   * Handle incoming message
   */
  private async onMessage(data: WebSocket.Data): Promise<void> {
    try {
      const message: any = JSON.parse(data.toString());

      // Track subscription confirmations (store subscription IDs for later unsubscribe)
      if (message.result && typeof message.result === 'number') {
        const subId = message.result;
        const msgId = message.id;
        
        // Store wallet subscription IDs for future unsubscribe
        if (msgId && msgId.startsWith('wallet-')) {
          this.subscriptions.set(msgId, subId);
          console.log(`📡 Subscription confirmed: ${msgId} (subId: ${subId})`);
        } else {
          console.log(`📡 Subscription confirmed: ${msgId || 'unknown'}`);
        }
        return;
      }

      // Handle account notifications (wallet changes)
      if (message.method === 'accountNotification') {
        const account = message.params?.result?.value?.owner;
        
        if (account && this.trackedWallets.has(account)) {
          console.log(`\n📨 Account activity detected: ${account.slice(0, 8)}...`);
          
          // Process account activity
          await this.processAccountChange(account, message.params?.result?.value);
        }
        return;
      }

      // Handle log notifications (program activity)
      if (message.method === 'logsNotification') {
        const logs = message.params?.result?.value?.logs || [];
        const signature = message.params?.result?.value?.signature;
        
        if (signature) {
          // ONLY log if a tracked wallet is mentioned (avoid spam)
          // Check if any tracked wallets are mentioned in logs
          for (const wallet of this.trackedWallets) {
            if (logs.some((log: string) => log.includes(wallet))) {
              console.log(`✅ Tracked wallet activity: ${wallet.slice(0, 8)}... | tx: ${signature.slice(0, 20)}...`);
              
              // Process the activity
              await this.processTransaction(wallet, { signature });
              break;
            }
          }
        }
        return;
      }
    } catch (error) {
      // Ignore parse errors for non-JSON messages (pings, etc)
      if (error instanceof SyntaxError) {
        return;
      }
      console.error('❌ Error processing message:', error);
    }
  }

  /**
   * Extract signer from transaction result
   */
  private async extractSigner(result: any): Promise<string | null> {
    // Check account field (for wallet subscriptions)
    if (result.account && this.trackedWallets.has(result.account)) {
      return result.account;
    }

    // Check logs for signer (fallback)
    if (result.logs) {
      for (const log of result.logs) {
        for (const wallet of this.trackedWallets) {
          if (log.includes(wallet)) {
            return wallet;
          }
        }
      }
    }

    return null;
  }

  /**
   * Process account change (from accountSubscribe)
   */
  private async processAccountChange(account: string, accountData: any): Promise<void> {
    try {
      console.log(`🔄 Processing account change for ${account.slice(0, 8)}...`);
      
      // Account subscription fires on any change - treat as activity
      await this.createOrUpdateAgent(account);
    } catch (error) {
      console.error(`❌ Failed to process account change:`, error);
    }
  }

  /**
   * Create or update agent (reusable for both account changes and transactions)
   */
  private async createOrUpdateAgent(pubkey: string): Promise<void> {
    try {
      let agent = await this.db.tradingAgent.findFirst({
        where: { userId: pubkey }
      });

      if (!agent) {
        console.log(`🟡 Agent not found, creating new agent for ${pubkey.slice(0, 8)}...`);
        
        const agentName = `Agent-${pubkey.slice(0, 6)}`;
        
        agent = await this.db.tradingAgent.create({
          data: {
            userId: pubkey,
            archetypeId: 'default-archetype', // Default archetype for auto-created agents
            name: agentName,
            status: 'ACTIVE',
            totalTrades: 0,
            winRate: 0,
            totalPnl: 0
            // Note: maxDrawdown, score removed - not in schema yet
          }
        });
        
        console.log(`✅ Created new agent: ${agent.id}`);
      } else {
        // Increment trade count
        agent = await this.db.tradingAgent.update({
          where: { id: agent.id },
          data: {
            totalTrades: {
              increment: 1
            }
          }
        });
        
        console.log(`✅ Updated agent: ${agent.id} (trades: ${agent.totalTrades})`);
      }

      // Create activity record
      await this.db.paperTrade.create({
        data: {
          agentId: agent.id,
          tokenMint: pubkey,
          tokenSymbol: 'ACTIVITY',
          tokenName: 'Transaction',
          action: 'BUY',
          entryPrice: 0,
          amount: 0,
          tokenAmount: 0,
          metadata: {
            source: 'helius-ws-watch',
            pubkey
          },
          signalSource: 'helius-ws',
          confidence: 100
        }
      });

      console.log(`🎯 Agent on leaderboard: ${agent.id}`);
    } catch (error) {
      console.error(`❌ Failed to create/update agent:`, error);
    }
  }

  /**
   * Process transaction and create agent/trade
   */
  private async processTransaction(signer: string, result: any): Promise<void> {
    try {
      await this.createOrUpdateAgent(signer);
    } catch (error) {
      console.error(`❌ Failed to process transaction:`, error);
    }
  }

  /**
   * WebSocket error
   */
  private onError(error: Error): void {
    console.error('❌ WebSocket error:', error.message);
    this.isConnected = false;
  }

  /**
   * WebSocket closed
   */
  private onClose(): void {
    console.log('⚠️ WebSocket disconnected');
    this.isConnected = false;
    this.scheduleReconnect();
  }

  /**
   * Schedule reconnect
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(RECONNECT_DELAY_MS * this.reconnectAttempts, 30000);
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Dynamically add a wallet to monitoring
   */
  addWallet(walletAddress: string): void {
    if (this.trackedWallets.includes(walletAddress)) {
      console.log(`⚠️ Wallet already tracked: ${walletAddress.slice(0, 8)}...`);
      return;
    }

    this.trackedWallets.push(walletAddress);
    console.log(`➕ Added wallet to monitoring: ${walletAddress.slice(0, 8)}...`);
    console.log(`   Total tracked: ${this.trackedWallets.length} wallets`);

    // Subscribe immediately if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscription = {
        jsonrpc: '2.0',
        id: `wallet-${walletAddress}`,
        method: 'accountSubscribe',
        params: [
          walletAddress,
          { commitment: 'confirmed', encoding: 'jsonParsed' }
        ]
      };

      this.ws.send(JSON.stringify(subscription));
      console.log(`📡 Subscribed to new wallet: ${walletAddress.slice(0, 8)}...`);
    }
  }

  /**
   * Dynamically remove a wallet from monitoring
   */
  removeWallet(walletAddress: string): void {
    const index = this.trackedWallets.indexOf(walletAddress);
    if (index === -1) {
      console.log(`⚠️ Wallet not tracked: ${walletAddress.slice(0, 8)}...`);
      return;
    }

    this.trackedWallets.splice(index, 1);
    console.log(`➖ Removed wallet from monitoring: ${walletAddress.slice(0, 8)}...`);
    console.log(`   Total tracked: ${this.trackedWallets.length} wallets`);

    // Note: Helius doesn't have accountUnsubscribe, so we just stop tracking it
    // The subscription will naturally expire on reconnect
  }

  /**
   * Get list of tracked wallets
   */
  getTrackedWallets(): string[] {
    return [...this.trackedWallets];
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping Helius WebSocket Monitor');
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
  }

  /**
   * Check connection status
   */
  isRunning(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}
