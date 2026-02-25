import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import { getConversationMessages } from '@/lib/api/client';
import type { TrendingToken, Message } from '@/types/arena';

interface TokenDiscussionCardProps {
  token: TrendingToken;
}

export function TokenDiscussionCard({ token }: TokenDiscussionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const priceChange = token.priceChange24h ?? 0;
  const isPositive = priceChange >= 0;
  const timeAgo = token.lastMessageAt ? getTimeAgo(token.lastMessageAt) : '';

  const toggleExpand = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!messages && token.conversationId) {
      setLoading(true);
      try {
        const msgs = await getConversationMessages(token.conversationId);
        setMessages(msgs);
      } catch (err) {
        console.error('[TokenDiscussionCard] Failed to load messages:', err);
        setMessages([]);
      } finally {
        setLoading(false);
      }
    }
  }, [expanded, messages, token.conversationId]);

  // Sentiment bar
  const sentiment = token.sentiment;
  const hasSentiment = sentiment && (sentiment.bullish + sentiment.bearish) > 0;
  const sentimentTotal = hasSentiment ? sentiment.bullish + sentiment.bearish + sentiment.neutral : 0;
  const bullPct = sentimentTotal > 0 ? (sentiment!.bullish / sentimentTotal) * 100 : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={toggleExpand}
      style={styles.card}
    >
      {/* ── Header: Token Image + Symbol + Price Change ── */}
      <View style={styles.header}>
        <View style={styles.tokenInfo}>
          {token.imageUrl && !imgError ? (
            <Image
              source={{ uri: token.imageUrl }}
              style={styles.tokenImage}
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.tokenImageFallback}>
              <Text style={styles.tokenImageFallbackText}>
                {token.tokenSymbol.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.tokenSymbol}>${token.tokenSymbol}</Text>
            {token.priceUsd !== undefined && (
              <Text style={styles.tokenPrice}>
                ${token.priceUsd < 0.01 ? token.priceUsd.toExponential(2) : token.priceUsd.toFixed(4)}
              </Text>
            )}
          </View>
          <View style={[styles.changeChip, { backgroundColor: isPositive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }]}>
            <Text style={[styles.changeText, { color: isPositive ? colors.status.success : colors.status.error }]}>
              {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* ── Metrics Row ── */}
      <View style={styles.metricsRow}>
        {token.marketCap !== undefined && token.marketCap > 0 && (
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>MCap</Text>
            <Text style={styles.metricValue}>{formatCompact(token.marketCap)}</Text>
          </View>
        )}
        {token.volume24h !== undefined && token.volume24h > 0 && (
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Vol</Text>
            <Text style={styles.metricValue}>{formatCompact(token.volume24h)}</Text>
          </View>
        )}
        {token.liquidity !== undefined && token.liquidity > 0 && (
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Liq</Text>
            <Text style={styles.metricValue}>{formatCompact(token.liquidity)}</Text>
          </View>
        )}
      </View>

      {/* ── Sentiment Bar ── */}
      {hasSentiment && (
        <View style={styles.sentimentRow}>
          <Text style={styles.sentimentBull}>{sentiment!.bullish} bull</Text>
          <View style={styles.sentimentBar}>
            <View style={[styles.sentimentFill, { width: `${bullPct}%` as any }]} />
          </View>
          <Text style={styles.sentimentBear}>{sentiment!.bearish} bear</Text>
        </View>
      )}

      {/* ── Latest Agent Messages Preview ── */}
      {!expanded && token.latestMessages && token.latestMessages.length > 0 && (
        <View style={styles.previewMessages}>
          {token.latestMessages.slice(0, 2).map((msg, i) => (
            <View key={i} style={styles.previewMsg}>
              <View style={styles.previewAvatar}>
                <Text style={styles.previewAvatarText}>
                  {msg.agentName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.previewContent} numberOfLines={1}>
                <Text style={styles.previewName}>{msg.agentName}: </Text>
                {msg.content}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Footer Stats ── */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Ionicons name="people-outline" size={10} color={colors.text.muted} />
          <Text style={styles.footerText}>{token.participantCount} agents</Text>
          <Text style={styles.footerDot}>·</Text>
          <Ionicons name="chatbubble-outline" size={10} color={colors.text.muted} />
          <Text style={styles.footerText}>{token.messageCount} msgs</Text>
        </View>
        <View style={styles.footerRight}>
          {timeAgo && <Text style={styles.footerTime}>{timeAgo}</Text>}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={colors.text.muted}
          />
        </View>
      </View>

      {/* ── Expanded Full Thread ── */}
      {expanded && (
        <View style={styles.threadContainer}>
          {loading ? (
            <View style={styles.threadLoading}>
              <Text style={styles.threadLoadingText}>Loading thread...</Text>
            </View>
          ) : messages && messages.length > 0 ? (
            messages.slice(-8).map((msg) => (
              <View key={msg.messageId} style={styles.threadMsg}>
                <View style={styles.threadAvatar}>
                  <Text style={styles.threadAvatarText}>
                    {msg.agentName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.threadMsgHeader}>
                    <Text style={styles.threadMsgName}>{msg.agentName}</Text>
                    <Text style={styles.threadMsgTime}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={styles.threadMsgContent}>{msg.content}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.threadEmpty}>No messages yet</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  // Header
  header: {},
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tokenImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tokenImageFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenImageFallbackText: {
    color: colors.brand.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  tokenSymbol: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tokenPrice: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  changeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metric: {
    gap: 1,
  },
  metricLabel: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Sentiment
  sentimentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sentimentBull: {
    color: colors.status.success,
    fontSize: 9,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sentimentBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  sentimentFill: {
    height: '100%',
    backgroundColor: colors.status.success,
    borderRadius: 2,
  },
  sentimentBear: {
    color: colors.status.error,
    fontSize: 9,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Preview messages
  previewMessages: {
    gap: 6,
  },
  previewMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatarText: {
    color: colors.brand.primary,
    fontSize: 9,
    fontWeight: '800',
  },
  previewContent: {
    flex: 1,
    color: colors.text.muted,
    fontSize: 11,
  },
  previewName: {
    color: colors.text.secondary,
    fontWeight: '600',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '500',
  },
  footerDot: {
    color: colors.text.muted,
    fontSize: 10,
    marginHorizontal: 2,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerTime: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '500',
  },

  // Expanded thread
  threadContainer: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
  },
  threadLoading: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  threadLoadingText: {
    color: colors.text.muted,
    fontSize: 11,
  },
  threadMsg: {
    flexDirection: 'row',
    gap: 8,
  },
  threadAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatarText: {
    color: colors.brand.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  threadMsgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  threadMsgName: {
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  threadMsgTime: {
    color: colors.text.muted,
    fontSize: 9,
  },
  threadMsgContent: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
  threadEmpty: {
    color: colors.text.muted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
