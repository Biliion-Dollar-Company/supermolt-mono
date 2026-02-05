import { verifyPrivyToken } from '../lib/privy';
import { generateTokens, verifyRefreshToken } from '../lib/jwt';
import type { LoginResponse, AuthTokens } from '../types';

export async function login(privyToken: string): Promise<LoginResponse> {
  // Verify Privy token — gives us the user's identity
  const privyData = await verifyPrivyToken(privyToken);

  // In v4 architecture: no local User model.
  // userId = privyId (the Ponzinomics/Privy identifier).
  // SR-Mobile backend only stores agent/trade data keyed by userId.
  const userId = privyData.privyId;

  const tokens = await generateTokens(
    userId,
    privyData.privyId,
    privyData.walletAddress ?? undefined
  );

  return { userId, tokens };
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const payload = await verifyRefreshToken(refreshToken);

  return generateTokens(
    payload.sub,
    payload.privyId,
    payload.wallet
  );
}
