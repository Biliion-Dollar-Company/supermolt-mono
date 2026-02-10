'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Users, ChevronDown } from 'lucide-react';
import { getConversations, getConversationMessages } from '@/lib/api';
import type { Conversation, Message } from '@/lib/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
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
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 bg-white/[0.03] animate-pulse rounded" />
          <div className="h-3 w-24 bg-white/[0.03] animate-pulse rounded" />
          <div className="h-4 w-5 bg-white/[0.02] animate-pulse rounded-full" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/[0.04] p-3 rounded">
              <div className="h-3.5 w-3/4 bg-white/[0.03] animate-pulse rounded mb-2" />
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-8 bg-white/[0.02] animate-pulse rounded" />
                <div className="h-2.5 w-8 bg-white/[0.02] animate-pulse rounded" />
                <div className="h-2.5 w-6 bg-white/[0.02] animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
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
          {conversations.slice(0, 8).map((conv) => {
            const isExpanded = expandedConv === conv.conversationId;
            return (
              <div key={conv.conversationId}>
                <button
                  onClick={() => toggleConversation(conv.conversationId)}
                  className={`w-full text-left flex items-center gap-3 bg-white/[0.02] border p-3 hover:bg-white/[0.04] transition-all cursor-pointer ${
                    isExpanded ? 'border-accent-primary/20 bg-white/[0.03]' : 'border-white/[0.06]'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {conv.topic}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
                        <Users className="w-3 h-3" />{conv.participantCount}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
                        <MessageSquare className="w-3 h-3" />{conv.messageCount}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">
                        {timeAgo(conv.lastMessageAt)}
                      </span>
                    </div>
                  </div>
                  <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                    isExpanded ? 'bg-accent-primary/10 text-accent-primary' : 'text-text-muted'
                  }`}>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expanded messages */}
                {isExpanded && (
                  <div className="border-x border-b border-accent-primary/10 bg-white/[0.015] overflow-hidden">
                    <div className="px-3 py-3 space-y-2.5">
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
