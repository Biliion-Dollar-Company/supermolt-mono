import { sql } from '../lib/db';
import { verifyPrivyToken } from '../lib/privy';
import { generateTokens, verifyRefreshToken } from '../lib/jwt';
import type { User, LoginResponse, AuthTokens } from '../types';

export async function login(privyToken: string): Promise<LoginResponse> {
  // Verify Privy token
  const privyData = await verifyPrivyToken(privyToken);

  // Find existing user
  const [existingUser] = await sql`
    SELECT * FROM users WHERE privy_id = ${privyData.privyId}
  `;

  let user = existingUser;

  if (!user) {
    // Create new user with settings and agent state
    const [newUser] = await sql`
      INSERT INTO users (privy_id, wallet_address, email)
      VALUES (${privyData.privyId}, ${privyData.walletAddress}, ${privyData.email})
      RETURNING *
    `;
    user = newUser;

    // Create default settings
    await sql`
      INSERT INTO user_settings (user_id)
      VALUES (${user.id})
    `;

    // Create default agent state
    await sql`
      INSERT INTO agent_states (user_id)
      VALUES (${user.id})
    `;
  } else {
    // Update user info if changed
    if (
      (privyData.walletAddress && privyData.walletAddress !== user.wallet_address) ||
      (privyData.email && privyData.email !== user.email)
    ) {
      const [updatedUser] = await sql`
        UPDATE users
        SET
          wallet_address = COALESCE(${privyData.walletAddress}, wallet_address),
          email = COALESCE(${privyData.email}, email),
          updated_at = NOW()
        WHERE id = ${user.id}
        RETURNING *
      `;
      user = updatedUser;
    }
  }

  // Generate JWT tokens
  const tokens = await generateTokens(
    user.id,
    user.privy_id,
    user.wallet_address ?? undefined
  );

  const responseUser: User = {
    id: user.id,
    privyId: user.privy_id,
    walletAddress: user.wallet_address,
    email: user.email,
    createdAt: user.created_at,
  };

  return {
    user: responseUser,
    tokens,
  };
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const payload = await verifyRefreshToken(refreshToken);

  const [user] = await sql`
    SELECT * FROM users WHERE id = ${payload.sub}
  `;

  if (!user) {
    throw new Error('User not found');
  }

  return generateTokens(user.id, user.privy_id, user.wallet_address ?? undefined);
}

export async function getMe(userId: string): Promise<User> {
  const [user] = await sql`
    SELECT * FROM users WHERE id = ${userId}
  `;

  if (!user) {
    throw new Error('User not found');
  }

  return {
    id: user.id,
    privyId: user.privy_id,
    walletAddress: user.wallet_address,
    email: user.email,
    createdAt: user.created_at,
  };
}
