import * as jose from 'jose';
import { env } from './env';
import type { JwtPayload, AuthTokens } from '../types';

const secret = new TextEncoder().encode(env.JWT_SECRET);

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // Default 15m

  const [, value, unit] = match;
  const num = parseInt(value, 10);

  switch (unit) {
    case 's':
      return num;
    case 'm':
      return num * 60;
    case 'h':
      return num * 60 * 60;
    case 'd':
      return num * 60 * 60 * 24;
    default:
      return 900;
  }
}

export async function generateTokens(
  userId: string,
  privyId: string,
  wallet?: string
): Promise<AuthTokens> {
  const now = Math.floor(Date.now() / 1000);
  const accessExpiresIn = parseExpiry(env.JWT_EXPIRES_IN);
  const refreshExpiresIn = parseExpiry(env.JWT_REFRESH_EXPIRES_IN);

  const accessToken = await new jose.SignJWT({
    sub: userId,
    privyId,
    wallet,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + accessExpiresIn)
    .sign(secret);

  const refreshToken = await new jose.SignJWT({
    sub: userId,
    privyId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + refreshExpiresIn)
    .sign(secret);

  return {
    accessToken,
    refreshToken,
    expiresIn: accessExpiresIn,
  };
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, secret);
  return payload as unknown as JwtPayload;
}

export async function verifyRefreshToken(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, secret);

  if ((payload as Record<string, unknown>).type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }

  return payload as unknown as JwtPayload;
}
