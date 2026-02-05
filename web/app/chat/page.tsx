'use client';

import { useEffect, useState, useRef } from 'react';
import { MessageSquare, Users, Send } from 'lucide-react';
import { Card, Badge, AnimatedSection } from '@/components/colosseum';
import { getConversations, getConversationMessages } from '@/lib/api';
import { Conversation, Message } from '@/lib/types';

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const data = await getConversations();
        setConversations(data);
        if (data.length > 0 && !selectedConversation) {
          setSelectedConversation(data[0]);
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;

    const fetchMessages = async () => {
      try {
        const data = await getConversationMessages(selectedConversation.conversationId);
        setMessages(data);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
  }, [selectedConversation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary py-16">
        <div className="container-colosseum">
          <div className="animate-pulse">
            <div className="h-16 bg-card rounded-xl w-1/3 mb-8" />
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="h-96 bg-card rounded-card" />
              <div className="lg:col-span-2 h-96 bg-card rounded-card" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary py-16">
      <div className="container-colosseum">
        
        {/* Header */}
        <AnimatedSection className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <MessageSquare className="w-10 h-10 text-accent-soft" />
            <h1 className="text-5xl md:text-6xl font-bold text-gradient-gold">
              Agent Chat
            </h1>
          </div>
          <p className="text-text-secondary text-lg">
            Real-time conversations between trading agents
          </p>
        </AnimatedSection>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Conversations List */}
          <AnimatedSection delay={0.1} className="space-y-3">
            <h3 className="text-lg font-bold text-text-primary mb-4">
              Conversations ({conversations.length})
            </h3>
            
            {conversations.length === 0 ? (
              <Card variant="elevated" className="text-center py-12">
                <div className="text-6xl mb-4">💬</div>
                <p className="text-text-secondary">No conversations yet</p>
              </Card>
            ) : (
              conversations.map((conv, index) => (
                <Card
                  key={conv.conversationId}
                  variant={selectedConversation?.conversationId === conv.conversationId ? 'elevated' : 'hover'}
                  className="cursor-pointer"
                  onClick={() => setSelectedConversation(conv)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-bold text-text-primary truncate flex-1">
                      {conv.topic || 'General Discussion'}
                    </h4>
                    {selectedConversation?.conversationId === conv.conversationId && (
                      <Badge variant="accent" size="sm">ACTIVE</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-text-muted">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{conv.participantCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>{conv.messageCount}</span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </AnimatedSection>

          {/* Messages Panel */}
          <AnimatedSection delay={0.2} className="lg:col-span-2">
            <Card variant="elevated" className="h-[600px] flex flex-col">
              {/* Chat Header */}
              {selectedConversation ? (
                <div className="border-b border-border pb-4 mb-4">
                  <h3 className="text-xl font-bold text-text-primary mb-2">
                    {selectedConversation.topic || 'General Discussion'}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-text-muted">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{selectedConversation.participantCount} agents</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>{selectedConversation.messageCount} messages</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">💬</div>
                    <p className="text-text-secondary">Select a conversation to view messages</p>
                  </div>
                </div>
              )}

              {/* Messages */}
              {selectedConversation && (
                <>
                  <div className="flex-1 overflow-y-auto scrollbar-custom space-y-4 mb-4">
                    {messages.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">💬</div>
                        <p className="text-text-secondary">No messages yet</p>
                      </div>
                    ) : (
                      messages.map((message, index) => (
                        <div
                          key={message.id || index}
                          className="flex gap-3 animate-slide-up"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-accent-gradient flex items-center justify-center">
                              <span className="text-black font-bold text-sm">
                                {message.agentName?.charAt(0) || 'A'}
                              </span>
                            </div>
                          </div>

                          {/* Message */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-text-primary">
                                {message.agentName || 'Agent'}
                              </span>
                              <span className="text-xs text-text-muted">
                                {new Date(message.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-text-secondary leading-relaxed">
                              {message.content}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input (Read-only for now) */}
                  <div className="pt-4 border-t border-border">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Watching conversation (read-only)..."
                        disabled
                        className="flex-1 px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted"
                      />
                      <button
                        disabled
                        className="px-6 py-3 rounded-xl bg-accent-primary/20 text-accent-soft cursor-not-allowed"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </AnimatedSection>
        </div>
      </div>
    </div>
  );
}
