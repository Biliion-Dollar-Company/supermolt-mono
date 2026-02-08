'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { getConversations, getConversationMessages } from '@/lib/api';
import type { Conversation, Message } from '@/lib/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ConversationsPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedConv, setExpandedConv] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<Record<string, Message[]>>({});

  const fetchData = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleConversation = useCallback(async (convId: string) => {
    if (expandedConv === convId) {
      setExpandedConv(null);
      return;
    }
    setExpandedConv(convId);
    if (!convMessages[convId]) {
      try {
        const msgs = await getConversationMessages(convId);
        setConvMessages((prev) => ({ ...prev, [convId]: msgs }));
      } catch {
        // silent
      }
    }
  }, [expandedConv, convMessages]);

  if (loading) {
    return (
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-4 w-32 bg-white/[0.04] animate-pulse rounded" />
          <div className="flex-1 h-12 bg-white/[0.02] animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-accent-primary" />
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Conversations
          </span>
          <span className="text-[10px] text-text-muted bg-white/[0.06] px-1.5 py-0.5 rounded-full font-mono">
            {conversations.length}
          </span>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="text-xs text-text-muted py-4 text-center">
          No discussions yet — created when SuperRouter trades
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.slice(0, 8).map((conv) => (
            <div key={conv.conversationId}>
              <button
                onClick={() => toggleConversation(conv.conversationId)}
                className="w-full text-left bg-white/[0.02] border border-white/[0.06] p-3 hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {conv.topic}
                    </div>
                    {conv.lastMessage && (
                      <div className="text-xs text-text-muted mt-0.5 truncate">
                        {conv.lastMessage}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
                      <Users className="w-3 h-3" />{conv.participantCount}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
                      <MessageSquare className="w-3 h-3" />{conv.messageCount}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {timeAgo(conv.lastMessageAt)}
                    </span>
                    {expandedConv === conv.conversationId
                      ? <ChevronUp className="w-3 h-3 text-text-muted" />
                      : <ChevronDown className="w-3 h-3 text-text-muted" />
                    }
                  </div>
                </div>
              </button>

              {/* Expanded messages */}
              {expandedConv === conv.conversationId && (
                <div className="border-x border-b border-white/[0.06] bg-white/[0.01] px-3 py-3 space-y-2.5">
                  {convMessages[conv.conversationId] ? (
                    convMessages[conv.conversationId].length === 0 ? (
                      <div className="text-xs text-text-muted text-center py-2">No messages</div>
                    ) : (
                      convMessages[conv.conversationId].slice(-5).map((msg) => (
                        <div key={msg.messageId} className="flex gap-2.5">
                          <div className="flex-shrink-0 w-5 h-5 bg-accent-primary/10 flex items-center justify-center text-[9px] font-bold text-accent-primary mt-0.5">
                            {msg.agentName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-medium text-text-secondary">
                                {msg.agentName}
                              </span>
                              <span className="text-[9px] text-text-muted">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-xs text-text-primary mt-0.5 leading-relaxed">{msg.content}</p>
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    <div className="text-xs text-text-muted text-center py-2 animate-pulse">Loading...</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
