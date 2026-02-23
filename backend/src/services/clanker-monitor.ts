import { db } from '../lib/db';
import { agentSignalReactor } from './agent-signal-reactor.js';

const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const CLANKER_FACTORY = '0xe85a59c628f7d27878aceb4bf3b35733630083a9';
const TOKEN_CREATED_TOPIC = '0xff17643da7330f267d8476506a255efd03d98ec65c99adf1a930fbecca0df070';
const POLL_INTERVAL_MS = 6_000; // 6 seconds
const BLOCK_RANGE = 3;
const CATCHUP_BLOCK_RANGE = 500;

let consecutiveErrors = 0;
const MAX_BACKOFF_MS = 60_000;

interface MigrationEvent {
    tokenAddress: string;
    tokenName?: string;
    tokenSymbol?: string;
    txHash: string;
    blockNumber: number;
    timestamp: number;
}

interface RpcLogEntry {
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    transactionHash: string;
    blockTimestamp?: string;
}

async function rpcCall(method: string, params: any[]): Promise<any> {
    const resp = await fetch(BASE_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    });
    const data = await resp.json() as { result?: any; error?: any };
    if (data.error) throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
    return data.result;
}

function unpadAddress(topic: string): string {
    return '0x' + topic.slice(26).toLowerCase();
}

function decodeStringResult(hex: string): string {
    const d = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (d.length < 128) return '';
    try {
        const offset = parseInt(d.slice(0, 64), 16) * 2;
        const length = parseInt(d.slice(offset, offset + 64), 16);
        const strHex = d.slice(offset + 64, offset + 64 + length * 2);
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            bytes[i] = parseInt(strHex.slice(i * 2, i * 2 + 2), 16);
        }
        return new TextDecoder().decode(bytes);
    } catch {
        return '';
    }
}

async function getTokenMetadata(tokenAddress: string): Promise<{ name: string; symbol: string; decimals: number }> {
    let name = 'Unknown';
    let symbol = 'UNKNOWN';
    let decimals = 18;

    try {
        const nameResult = await rpcCall('eth_call', [{ to: tokenAddress, data: '0x06fdde03' }, 'latest']);
        if (nameResult && nameResult !== '0x') {
            name = decodeStringResult(nameResult);
        }
    } catch { /* ignore */ }

    try {
        const symbolResult = await rpcCall('eth_call', [{ to: tokenAddress, data: '0x95d89b41' }, 'latest']);
        if (symbolResult && symbolResult !== '0x') {
            symbol = decodeStringResult(symbolResult);
        }
    } catch { /* ignore */ }

    return { name, symbol, decimals };
}

export class ClankerMonitor {
    private lastBlock: number = 0;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private seenTxHashes: Set<string> = new Set();
    private onMigrationCallbacks: ((event: MigrationEvent) => void)[] = [];

    onMigration(callback: (event: MigrationEvent) => void) {
        this.onMigrationCallbacks.push(callback);
    }

    async start() {
        try {
            const blockHex = await rpcCall('eth_blockNumber', []);
            const currentBlock = parseInt(blockHex, 16);

            const saved = await db.monitorState.findUnique({ where: { id: 'clanker-monitor' } });
            if (saved && saved.lastBlock > 0) {
                this.lastBlock = saved.lastBlock;
                const gap = currentBlock - saved.lastBlock;
                console.log(`[Clanker] Resuming from persisted block ${saved.lastBlock} (${gap} blocks behind, ~${Math.round(gap * 2 / 60)} min gap)`);
            } else {
                this.lastBlock = currentBlock;
                console.log(`[Clanker] No saved state, starting from current block ${currentBlock}`);
            }
        } catch (error) {
            console.warn('[Clanker] Could not get current block:', error);
            return;
        }

        console.log(`[Clanker] Starting Clanker Token Monitor from block ${this.lastBlock} (${BASE_RPC_URL})`);

        this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
        this.pollTimer.unref();
    }

    stop() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        console.log('[Clanker] Stopped');
    }

    private async poll() {
        try {
            const latestHex = await rpcCall('eth_blockNumber', []);
            const latestBlock = parseInt(latestHex, 16);

            const safeLatest = latestBlock - 1; // 1 block behind tip
            if (safeLatest <= this.lastBlock) return;

            const gap = safeLatest - this.lastBlock;
            const range = gap > 200 ? CATCHUP_BLOCK_RANGE : BLOCK_RANGE;
            if (gap > 200) {
                console.log(`[Clanker] Catching up: ${gap} blocks behind, using ${range}-block range`);
            }

            const fromBlock = this.lastBlock + 1;
            const toBlock = Math.min(safeLatest, fromBlock + range - 1);

            const fromHex = '0x' + fromBlock.toString(16);
            const toHex = '0x' + toBlock.toString(16);

            const logs: RpcLogEntry[] = await rpcCall('eth_getLogs', [{
                fromBlock: fromHex,
                toBlock: toHex,
                address: CLANKER_FACTORY,
                topics: [TOKEN_CREATED_TOPIC],
            }]);

            this.lastBlock = toBlock;
            db.monitorState.upsert({
                where: { id: 'clanker-monitor' },
                create: { id: 'clanker-monitor', lastBlock: toBlock },
                update: { lastBlock: toBlock },
            }).catch(() => { });

            consecutiveErrors = 0;

            if (!logs || logs.length === 0) return;

            console.log(`[Clanker] Found ${logs.length} launches in blocks ${fromBlock}-${toBlock}`);

            for (const log of logs) {
                const txHash = log.transactionHash;
                const blockNum = parseInt(log.blockNumber, 16);
                const timestamp = log.blockTimestamp
                    ? parseInt(log.blockTimestamp, 16)
                    : Math.floor(Date.now() / 1000);

                await this.handleTokenCreate(log, txHash, blockNum, timestamp);
            }
        } catch (error: any) {
            consecutiveErrors++;
            const backoff = Math.min(1000 * Math.pow(2, consecutiveErrors), MAX_BACKOFF_MS);
            console.error(`[Clanker] Poll error (retry in ${backoff}ms):`, error?.message || error);
        }
    }

    private async handleTokenCreate(log: RpcLogEntry, txHash: string, blockNum: number, timestamp: number) {
        if (this.seenTxHashes.has(txHash)) return;
        this.seenTxHashes.add(txHash);

        // topic[1] should be the indexed token address
        if (!log.topics[1]) return;
        let tokenAddress = unpadAddress(log.topics[1]);

        // Sometimes factory emits it differently, try to fetch meta to confirm it's a token
        const meta = await getTokenMetadata(tokenAddress);

        // Create token deployment record
        await this.recordTokenCreation(tokenAddress, meta.name, meta.symbol, txHash, blockNum, timestamp);

        const migration: MigrationEvent = {
            tokenAddress,
            tokenName: meta.name,
            tokenSymbol: meta.symbol,
            txHash,
            blockNumber: blockNum,
            timestamp,
        };

        // Notify listeners
        for (const cb of this.onMigrationCallbacks) {
            try { cb(migration); } catch (err) { console.error('[Clanker] Callback error:', err); }
        }
    }

    private async recordTokenCreation(tokenAddress: string, name: string, symbol: string, txHash: string, blockNum: number, timestamp: number) {
        try {
            const existing = await db.tokenDeployment.findFirst({
                where: { tokenAddress },
            });
            if (existing) return;

            // Clanker tokens launch directly into Uniswap v3 => they are already graduated!
            await db.tokenDeployment.create({
                data: {
                    agentId: 'system-clanker',
                    tokenAddress,
                    tokenName: name || 'Unknown',
                    tokenSymbol: symbol || 'UNKNOWN',
                    totalSupply: '1000000000', // Approx clanker supply
                    factoryTxHash: txHash,
                    chain: 'BASE',
                    platform: 'clanker',
                    bondingCurveGraduated: true, // Directly to dex
                    graduationTxHash: txHash,
                    graduationTime: new Date(timestamp * 1000),
                    quoteToken: 'WETH',
                },
            });

            console.log(`[Clanker] Recorded: ${symbol} at ${tokenAddress.slice(0, 10)}...`);

            // Automatically create a conversation or signal about the launch
            await this.createGraduationConversation(tokenAddress, symbol, 'clanker', 'WETH');

            // Fire the agent signal reactor to notify observers
            await agentSignalReactor.react('new_token', {
                mint: tokenAddress,
                symbol: symbol,
                name: name,
                marketCap: 0,
                liquidity: 0,
                chain: 'BASE',
                source: 'clanker_launch',
                txHash: txHash,
            });

        } catch (error: any) {
            if (error.code !== 'P2002') {
                console.error('[Clanker] Failed to record token:', error.message);
            }
        }
    }

    private async createGraduationConversation(
        tokenAddress: string,
        tokenSymbol: string,
        platform: string,
        quoteLabel: string
    ) {
        try {
            const existingConv = await db.agentConversation.findFirst({
                where: { tokenMint: tokenAddress },
            });

            if (existingConv) return;

            const conversation = await db.agentConversation.create({
                data: {
                    topic: `Signal: ${tokenSymbol} 🎯 (Clanker Base)`,
                    tokenMint: tokenAddress,
                },
            });

            console.log(`[Clanker] Created conversation for ${tokenSymbol}: ${conversation.id}`);

            const systemMessage = `🎉 ${tokenSymbol} launched on Clanker (Base)!\n\n` +
                `Platform: ${platform}\n` +
                `Pair: ${tokenSymbol}/${quoteLabel}\n` +
                `Token: ${tokenAddress}\n\n` +
                `Graduated immediately into Uniswap v3 Pool. Discuss trading strategy here.`;

            await db.agentMessage.create({
                data: {
                    conversationId: conversation.id,
                    agentId: 'system',
                    message: systemMessage,
                },
            });
        } catch (error: any) {
            console.error(`[Clanker] Failed to create conversation for ${tokenSymbol}:`, error.message);
        }
    }
}

let clankerMonitor: ClankerMonitor | null = null;

export function getClankerMonitor(): ClankerMonitor | null {
    return clankerMonitor;
}

export function createClankerMonitor(): ClankerMonitor {
    clankerMonitor = new ClankerMonitor();
    return clankerMonitor;
}
