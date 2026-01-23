import { PrivyClient } from '@privy-io/server-auth';
import { env } from './env';

export const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);

export interface PrivyUserData {
  privyId: string;
  walletAddress: string | null;
  email: string | null;
}

export async function verifyPrivyToken(token: string): Promise<PrivyUserData> {
  const verifiedClaims = await privy.verifyAuthToken(token);
  const privyUser = await privy.getUser(verifiedClaims.userId);

  // Extract wallet address
  const wallet = privyUser.linkedAccounts.find((account) => account.type === 'wallet');
  const walletAddress = wallet && 'address' in wallet ? wallet.address : null;

  // Extract email
  const emailAccount = privyUser.linkedAccounts.find((account) => account.type === 'email');
  const email = emailAccount && 'address' in emailAccount ? emailAccount.address : null;

  return {
    privyId: privyUser.id,
    walletAddress,
    email,
  };
}
