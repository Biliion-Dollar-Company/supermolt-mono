import { PrivyClient } from '@privy-io/node';
import { env } from './env';

export const privy = new PrivyClient({
  appId: env.PRIVY_APP_ID,
  appSecret: env.PRIVY_APP_SECRET,
});

export interface PrivyTwitterData {
  username: string;
  name: string;
  profilePictureUrl?: string;
}

export interface PrivyUserData {
  privyId: string;
  walletAddress: string | null;
  email: string | null;
  twitter: PrivyTwitterData | null;
}

export async function verifyPrivyToken(token: string): Promise<PrivyUserData> {
  const verifiedClaims = await privy.utils().auth().verifyAuthToken(token);
  const privyUser = await privy.users()._get(verifiedClaims.user_id);

  // Extract wallet address
  const wallet = privyUser.linked_accounts.find((account) => account.type === 'wallet');
  const walletAddress = wallet && 'address' in wallet ? wallet.address : null;

  // Extract email
  const emailAccount = privyUser.linked_accounts.find((account) => account.type === 'email');
  const email = emailAccount && 'address' in emailAccount ? emailAccount.address : null;

  // Extract Twitter (OAuth linked account)
  const twitterAccount = privyUser.linked_accounts.find(
    (account: any) => account.type === 'twitter_oauth'
  );
  const twitter: PrivyTwitterData | null =
    twitterAccount && 'username' in twitterAccount
      ? {
          username: (twitterAccount as any).username,
          name: (twitterAccount as any).name || (twitterAccount as any).username,
          profilePictureUrl: (twitterAccount as any).profilePictureUrl,
        }
      : null;

  return {
    privyId: privyUser.id,
    walletAddress,
    email,
    twitter,
  };
}

// ── Privy Wallet Helpers ──────────────────────────────────

const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

export function getSolanaCaip2(): string {
  const network = process.env.SOLANA_NETWORK || 'mainnet';
  return network === 'devnet' ? SOLANA_DEVNET_CAIP2 : SOLANA_MAINNET_CAIP2;
}

/**
 * Create a Privy-managed Solana wallet owned by a user.
 * Returns { id, address } for the new wallet.
 */
export async function createPrivySolanaWallet(privyUserId: string) {
  const wallet = await privy.wallets().create({
    chain_type: 'solana',
    owner: { user_id: privyUserId },
  });
  return { id: wallet.id, address: wallet.address };
}

/**
 * Sign and send a base64-encoded Solana transaction using a Privy wallet.
 * Returns the transaction hash (signature).
 */
export async function privySignAndSendTransaction(
  walletId: string,
  transactionBase64: string,
): Promise<string> {
  const result = await privy.wallets().solana().signAndSendTransaction(walletId, {
    caip2: getSolanaCaip2(),
    transaction: transactionBase64,
  });
  return result.hash;
}
