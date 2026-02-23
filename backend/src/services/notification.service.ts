/**
 * Push Notification Service
 * Sends Expo push notifications to mobile clients
 */

import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { db } from '../lib/db';

const expo = new Expo();

/**
 * Register or update a push token for an agent
 */
export async function registerPushToken(agentId: string, pushToken: string): Promise<void> {
  if (!Expo.isExpoPushToken(pushToken)) {
    throw new Error('Invalid Expo push token format');
  }

  await db.tradingAgent.update({
    where: { id: agentId },
    data: { pushToken },
  });

  console.log(`[Notifications] Registered push token for agent ${agentId}`);
}

/**
 * Unregister push token for an agent
 */
export async function unregisterPushToken(agentId: string): Promise<void> {
  await db.tradingAgent.update({
    where: { id: agentId },
    data: { pushToken: null },
  });

  console.log(`[Notifications] Unregistered push token for agent ${agentId}`);
}

/**
 * Send a push notification to a specific agent
 */
export async function sendPushToAgent(
  agentId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const agent = await db.tradingAgent.findUnique({
    where: { id: agentId },
    select: { pushToken: true },
  });

  if (!agent?.pushToken || !Expo.isExpoPushToken(agent.pushToken)) {
    return; // No token registered, skip silently
  }

  const message: ExpoPushMessage = {
    to: agent.pushToken,
    sound: 'default',
    title,
    body,
    data: data as ExpoPushMessage['data'],
    priority: 'high',
  };

  try {
    const [ticket] = await expo.sendPushNotificationsAsync([message]);
    if ((ticket as any).status === 'error') {
      console.error(`[Notifications] Failed to send to ${agentId}:`, (ticket as any).message);
      // If the token is invalid, clear it
      if ((ticket as any).details?.error === 'DeviceNotRegistered') {
        await unregisterPushToken(agentId);
      }
    }
  } catch (err) {
    console.error(`[Notifications] Send error for ${agentId}:`, err);
  }
}

/**
 * Send push to all agents that have tokens registered (broadcast)
 */
export async function sendPushBroadcast(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const agents = await db.tradingAgent.findMany({
    where: { pushToken: { not: null } },
    select: { id: true, pushToken: true },
  });

  const messages: ExpoPushMessage[] = agents
    .filter((a) => a.pushToken && Expo.isExpoPushToken(a.pushToken))
    .map((a) => ({
      to: a.pushToken!,
      sound: 'default' as const,
      title,
      body,
      data: data as ExpoPushMessage['data'],
      priority: 'high' as const,
    }));

  if (messages.length === 0) return;

  // Chunk to respect Expo rate limits
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      // Clean up invalid tokens
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i] as any;
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          const agent = agents.find((a) => a.pushToken === (chunk[i] as any).to);
          if (agent) await unregisterPushToken(agent.id);
        }
      }
    } catch (err) {
      console.error('[Notifications] Broadcast chunk error:', err);
    }
  }

  console.log(`[Notifications] Broadcast sent to ${messages.length} devices`);
}

/**
 * Notify an agent about a trade recommendation
 */
export async function notifyTradeRecommendation(
  agentId: string,
  tokenSymbol: string,
  action: string,
  reason: string,
): Promise<void> {
  await sendPushToAgent(
    agentId,
    `${action} Signal: $${tokenSymbol}`,
    reason,
    { type: 'trade_recommendation', tokenSymbol, action },
  );
}

/**
 * Notify an agent about a trade execution
 */
export async function notifyTradeExecuted(
  agentId: string,
  tokenSymbol: string,
  action: string,
  amount: string,
): Promise<void> {
  const verb = action === 'BUY' ? 'bought' : 'sold';
  await sendPushToAgent(
    agentId,
    `Trade Executed`,
    `Your agent ${verb} $${tokenSymbol} for ${amount} SOL`,
    { type: 'trade_executed', tokenSymbol, action },
  );
}

/**
 * Notify about consensus reached
 */
export async function notifyConsensus(
  agentId: string,
  tokenSymbol: string,
  walletCount: number,
): Promise<void> {
  await sendPushToAgent(
    agentId,
    `Consensus: $${tokenSymbol}`,
    `${walletCount} wallets converged on $${tokenSymbol}`,
    { type: 'consensus', tokenSymbol, walletCount },
  );
}
