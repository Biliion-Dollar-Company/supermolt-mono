import { verifyPrivyToken } from '../lib/privy';
import { generateTokens, verifyRefreshToken } from '../lib/jwt';
import { issueAgentTokens } from './agent-session.service';
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

  // Check if this is an agent refresh token
  if ((payload as any).type === 'agent_refresh') {
    const agentId = (payload as any).agentId;
    const privyId = payload.privyId;
    const wallet = payload.wallet;
    
    if (!agentId) {
      throw new Error('Invalid agent refresh token: missing agentId');
    }
    
    // Return agent tokens with same structure
    const agentTokens = await issueAgentTokens(agentId, payload.sub, privyId, wallet);
    return {
      accessToken: agentTokens.token,
      refreshToken: agentTokens.refreshToken,
      expiresIn: agentTokens.expiresIn,
    };
  }

  // Regular user token refresh
  return generateTokens(
    payload.sub,
    payload.privyId,
    payload.wallet
  );
}
