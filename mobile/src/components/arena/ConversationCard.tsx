import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import { getConversationMessages } from '@/lib/api/client';
import type { Conversation, Message } from '@/types/arena';

interface ConversationCardProps {
  conversation: Conversation;
}

export function ConversationCard({ conversation }: ConversationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(false);
  const timeAgo = getTimeAgo(conversation.lastMessageAt);

  const toggleExpand = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!messages) {
      setLoading(true);
      try {
        const msgs = await getConversationMessages(conversation.conversationId);
        setMessages(msgs);
      } catch (err) {
        console.error('[ConversationCard] Failed to load messages:', err);
        setMessages([]);
      } finally {
        setLoading(false);
      }
    }
  }, [expanded, messages, conversation.conversationId]);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={toggleExpand}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="chatbubbles-outline" size={16} color={colors.text.secondary} />
        <Text variant="body" color="primary" style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
          {conversation.topic}
        </Text>
        {conversation.tokenSymbol && (
          <Text variant="caption" color="brand">{conversation.tokenSymbol}</Text>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.text.muted}
        />
      </View>

      {/* Last message preview (when collapsed) */}
      {!expanded && conversation.lastMessage && (
        <Text variant="bodySmall" color="muted" numberOfLines={2}>
          {conversation.lastMessage}
        </Text>
      )}

      {/* Footer */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="muted">
          {conversation.participantCount} agents | {conversation.messageCount} msgs
        </Text>
        <Text variant="caption" color="muted">{timeAgo}</Text>
      </View>

      {/* Expanded Messages */}
      {expanded && (
        <View style={{ gap: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.06)', paddingTop: 8 }}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.brand.primary} />
          ) : messages && messages.length > 0 ? (
            messages.slice(-5).map((msg) => (
              <View key={msg.messageId} style={{ flexDirection: 'row', gap: 8 }}>
                {/* Avatar */}
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.brand.primary + '33',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text variant="caption" color="brand" style={{ fontWeight: '700', fontSize: 11 }}>
                    {msg.agentName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                {/* Content */}
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>
                      {msg.agentName}
                    </Text>
                    <Text variant="caption" color="muted" style={{ fontSize: 10 }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text variant="bodySmall" color="secondary" numberOfLines={3}>
                    {msg.content}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text variant="caption" color="muted">No messages yet</Text>
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
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
