import { sql } from '../lib/db';
import type { UserSettings } from '../types';

const DEFAULT_SETTINGS = {
  notifications: true,
  autoSign: false,
  maxSlippage: 1.0,
};

export async function getSettings(userId: string): Promise<UserSettings> {
  const [settings] = await sql`
    SELECT * FROM user_settings WHERE user_id = ${userId}
  `;

  if (!settings) {
    return {
      userId,
      ...DEFAULT_SETTINGS,
    };
  }

  return {
    userId: settings.user_id,
    notifications: settings.notifications,
    autoSign: settings.auto_sign,
    maxSlippage: Number(settings.max_slippage),
  };
}

export async function updateSettings(
  userId: string,
  updates: Partial<Omit<UserSettings, 'userId'>>
): Promise<UserSettings> {
  const [existing] = await sql`
    SELECT id FROM user_settings WHERE user_id = ${userId}
  `;

  if (existing) {
    // Build dynamic update - only update provided fields
    const notifications = updates.notifications ?? null;
    const autoSign = updates.autoSign ?? null;
    const maxSlippage = updates.maxSlippage ?? null;

    const [updated] = await sql`
      UPDATE user_settings
      SET
        notifications = COALESCE(${notifications}, notifications),
        auto_sign = COALESCE(${autoSign}, auto_sign),
        max_slippage = COALESCE(${maxSlippage}, max_slippage),
        updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING *
    `;

    return {
      userId: updated.user_id,
      notifications: updated.notifications,
      autoSign: updated.auto_sign,
      maxSlippage: Number(updated.max_slippage),
    };
  } else {
    const [created] = await sql`
      INSERT INTO user_settings (user_id, notifications, auto_sign, max_slippage)
      VALUES (
        ${userId},
        ${updates.notifications ?? DEFAULT_SETTINGS.notifications},
        ${updates.autoSign ?? DEFAULT_SETTINGS.autoSign},
        ${updates.maxSlippage ?? DEFAULT_SETTINGS.maxSlippage}
      )
      RETURNING *
    `;

    return {
      userId: created.user_id,
      notifications: created.notifications,
      autoSign: created.auto_sign,
      maxSlippage: Number(created.max_slippage),
    };
  }
}
