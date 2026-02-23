import { View, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card, Button } from '@/components/ui';
import { colors } from '@/theme/colors';
import { successNotification, errorNotification } from '@/lib/haptics';
import { useState } from 'react';

// Lazy-load MWA + web3.js to avoid crash in Expo Go (native module not available)
let transact: any = null;
let Connection: any = null;
let VersionedTransaction: any = null;

try {
  transact = require('@solana-mobile/mobile-wallet-adapter-protocol-web3js').transact;
  const web3 = require('@solana/web3.js');
  Connection = web3.Connection;
  VersionedTransaction = web3.VersionedTransaction;
} catch {
  // MWA not available (Expo Go) — will show alert when user tries to approve
}

// ── Config ─────────────────────────────────────────────────

const JUPITER_API = 'https://lite-api.jup.ag/swap/v1';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ||
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/api$/, '').replace('http', 'https') ||
  'https://api.mainnet-beta.solana.com';

// ── Jupiter Helpers ────────────────────────────────────────

async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps = 100,
) {
  const url =
    `${JUPITER_API}/quote?` +
    `inputMint=${inputMint}&outputMint=${outputMint}` +
    `&amount=${amount}&slippageBps=${slippageBps}` +
    `&restrictIntermediateTokens=true`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter quote failed: ${text}`);
  }
  return res.json();
}

async function buildJupiterSwapTx(
  quote: any,
  userPublicKey: string,
): Promise<{ transaction: any; lastValidBlockHeight: number }> {
  const res = await fetch(`${JUPITER_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapUnwrapSOL: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 100_000,
          priorityLevel: 'low',
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter swap build failed: ${text}`);
  }

  const data = await res.json();
  // Decode base64 → Uint8Array → VersionedTransaction
  const binaryString = atob(data.swapTransaction);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const transaction = VersionedTransaction.deserialize(bytes);
  return { transaction, lastValidBlockHeight: data.lastValidBlockHeight };
}

// ── Component ──────────────────────────────────────────────

export default function ApproveTxModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    action?: string;
    tokenSymbol?: string;
    tokenMint?: string;
    amount?: string;
    solAmount?: string;
    price?: string;
    agentName?: string;
    reason?: string;
    chain?: string;
  }>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const action = params.action || 'TRADE';
  const tokenSymbol = params.tokenSymbol || 'Unknown';
  const tokenMint = params.tokenMint || '';
  const amount = params.amount || params.solAmount || '—';
  const price = params.price || '—';
  const agentName = params.agentName || 'Agent';
  const reason = params.reason || 'AI trading recommendation';
  const chain = params.chain || 'SOLANA';
  const isBuy = action === 'BUY';

  const handleApprove = async () => {
    // MWA not available (e.g. running in Expo Go)
    if (!transact) {
      Alert.alert(
        'Not Available',
        'Mobile Wallet Adapter requires a development build. Transaction signing is not available in Expo Go.',
      );
      return;
    }

    // BSC trades are executed server-side — just dismiss the modal
    if (chain === 'BSC') {
      successNotification();
      router.back();
      return;
    }

    if (!tokenMint) {
      Alert.alert('Error', 'Missing token mint address');
      return;
    }

    setIsProcessing(true);
    setStatus('Connecting wallet...');

    try {
      const signature = await transact(async (wallet: any) => {
        // 1. Authorize with the wallet
        setStatus('Authorizing...');
        const authResult = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: {
            name: 'SuperMolt',
            uri: 'https://supermolt.app',
            icon: 'favicon.ico',
          },
        });

        const walletPubkey = authResult.accounts[0].address;

        // 2. Build Jupiter swap transaction
        setStatus('Getting quote...');
        const solAmountNum = parseFloat(params.solAmount || params.amount || '0');
        const lamports = Math.floor(solAmountNum * 1e9);

        if (lamports <= 0) {
          throw new Error('Invalid trade amount');
        }

        const inputMint = isBuy ? SOL_MINT : tokenMint;
        const outputMint = isBuy ? tokenMint : SOL_MINT;

        const quote = await getJupiterQuote(inputMint, outputMint, lamports);

        setStatus('Building transaction...');
        const { transaction } = await buildJupiterSwapTx(quote, walletPubkey);

        // 3. Sign and send via MWA
        setStatus('Sign in wallet...');
        const signatures = await wallet.signAndSendTransactions({
          transactions: [transaction],
        });

        return signatures[0];
      });

      // 4. Confirm transaction (best-effort — don't block on it)
      if (signature) {
        setStatus('Confirming...');
        const connection = new Connection(RPC_URL, 'confirmed');
        connection
          .confirmTransaction(signature, 'confirmed')
          .catch(() => console.log('[ApproveTx] Confirmation timeout — tx may still succeed'));
      }

      successNotification();
      router.back();
    } catch (error: any) {
      console.error('[ApproveTx] Failed:', error);
      errorNotification();

      const msg = error?.message || 'Transaction failed';
      if (msg.includes('User rejected') || msg.includes('cancelled')) {
        setStatus(null);
      } else {
        Alert.alert('Transaction Failed', msg);
        setStatus(null);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    errorNotification();
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 16, gap: 16 }}>
        {/* Header */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: isBuy ? colors.status.success + '22' : colors.status.error + '22',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons
              name={isBuy ? 'arrow-down-circle' : 'arrow-up-circle'}
              size={32}
              color={isBuy ? colors.status.success : colors.status.error}
            />
          </View>
          <Text variant="h2" color="primary">Approve {action}</Text>
          <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
            {agentName} wants to execute a trade
          </Text>
        </View>

        {/* Transaction Details */}
        <Card variant="outlined" padding="md">
          <View style={{ gap: 10 }}>
            <DetailRow label="Action" value={action} valueColor={isBuy ? colors.status.success : colors.status.error} />
            <DetailRow label="Token" value={tokenSymbol} />
            <DetailRow label="Amount" value={`${amount} ${chain === 'BSC' ? 'BNB' : 'SOL'}`} />
            <DetailRow label="Chain" value={chain} />
            {price !== '—' && <DetailRow label="Price" value={price} />}
            <View style={{ height: 1, backgroundColor: colors.surface.tertiary }} />
            <View>
              <Text variant="caption" color="muted" style={{ marginBottom: 2 }}>Reason</Text>
              <Text variant="body" color="secondary">{reason}</Text>
            </View>
          </View>
        </Card>

        {/* Status */}
        {status && (
          <View style={{ alignItems: 'center', paddingVertical: 4 }}>
            <Text variant="caption" color="brand" style={{ fontWeight: '600' }}>{status}</Text>
          </View>
        )}

        {/* BSC info banner */}
        {chain === 'BSC' && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#F59E0B18',
            borderRadius: 10,
            padding: 12,
            borderWidth: 1,
            borderColor: '#F59E0B30',
          }}>
            <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
            <Text variant="caption" color="muted" style={{ flex: 1 }}>
              BSC trades are executed server-side. Tap confirm to proceed.
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={{ gap: 12, marginTop: 8 }}>
          <Button variant="primary" loading={isProcessing} onPress={handleApprove}>
            <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
              {chain === 'BSC' ? 'Confirm Trade' : 'Approve & Sign'}
            </Text>
          </Button>
          <TouchableOpacity
            onPress={handleReject}
            disabled={isProcessing}
            style={{
              alignItems: 'center',
              padding: 12,
              backgroundColor: colors.status.error + '15',
              borderRadius: 12,
            }}
          >
            <Text variant="body" color="error" style={{ fontWeight: '600' }}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text variant="caption" color="muted">{label}</Text>
      <Text variant="body" style={{ fontWeight: '600', color: valueColor || colors.text.primary }}>{value}</Text>
    </View>
  );
}
