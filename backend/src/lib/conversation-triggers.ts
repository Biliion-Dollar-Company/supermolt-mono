/**
 * Conversation Triggers
 * 
 * Defines trigger types and priority logic for agent conversations.
 * Triggers are ranked by urgency and impact.
 */

export enum ConversationTrigger {
  POSITION_OPENED = 'position_opened',
  BIG_WIN = 'big_win',                      // >50% profit
  BIG_LOSS = 'big_loss',                    // >30% loss
  MULTI_AGENT_BUY = 'multi_agent_buy',      // 2+ agents same token <10min
  LEADERBOARD_CHANGE = 'leaderboard_change',
  DEVPRINT_SIGNAL = 'devprint_signal',      // Keep existing DevPrint
}

/**
 * Priority ranking (lower number = higher priority)
 * 1 = immediate (fire within seconds)
 * 2 = high (fire within 2min)
 * 3 = normal (fire when rate limits allow)
 * 4 = low (batch processing)
 */
export const TRIGGER_PRIORITY: Record<ConversationTrigger, number> = {
  [ConversationTrigger.BIG_WIN]: 1,
  [ConversationTrigger.BIG_LOSS]: 1,
  [ConversationTrigger.MULTI_AGENT_BUY]: 1,
  [ConversationTrigger.POSITION_OPENED]: 2,
  [ConversationTrigger.DEVPRINT_SIGNAL]: 3,
  [ConversationTrigger.LEADERBOARD_CHANGE]: 4,
};

/**
 * Get priority level for a trigger type
 */
export function getTriggerPriority(trigger: ConversationTrigger): number {
  return TRIGGER_PRIORITY[trigger] ?? 3;
}

/**
 * Check if trigger should bypass rate limiting
 */
export function shouldBypassRateLimit(trigger: ConversationTrigger): boolean {
  return getTriggerPriority(trigger) === 1;
}

/**
 * Determine trigger type from trade data
 */
export function classifyTradeTrigger(trade: {
  action: string;
  status: string;
  pnlPercent?: any;
}): ConversationTrigger | null {
  // Closed trades with significant P&L
  if (trade.status === 'CLOSED' && trade.pnlPercent !== null && trade.pnlPercent !== undefined) {
    const pnl = typeof trade.pnlPercent === 'number' ? trade.pnlPercent : parseFloat(trade.pnlPercent.toString());
    
    if (pnl >= 50) return ConversationTrigger.BIG_WIN;
    if (pnl <= -30) return ConversationTrigger.BIG_LOSS;
  }

  // New positions opened
  if (trade.action === 'BUY' && trade.status === 'OPEN') {
    return ConversationTrigger.POSITION_OPENED;
  }

  return null;
}
