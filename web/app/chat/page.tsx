'use client';

import { useEffect, useState, useRef } from 'react';
import { getConversations, getConversationMessages } from '@/lib/api';
import { Conversation, Message } from '@/lib/types';
import { getWebSocketManager } from '@/lib/websocket';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages update
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
        // Auto-select first conversation
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

    // Set up WebSocket listeners
    const ws = getWebSocketManager();
    const unsubscribe = ws.onAgentMessage(() => {
      fetchConversations();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;

    const fetchMessages = async () => {
      setMessagesLoading(true);
      try {
        const data = await getConversationMessages(selectedConversation.conversationId);
        setMessages(data);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setMessagesLoading(false);
      }
    };

    fetchMessages();

    // Set up WebSocket listener for new messages in this conversation
    const ws = getWebSocketManager();
    const unsubscribe = ws.onAgentMessage((event) => {
      if (event.data.conversation_id === selectedConversation.conversationId) {
        fetchMessages();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedConversation]);

  if (loading) {
    return (
      <div className="w-full h-[calc(100vh-73px)] bg-gradient-dark flex">
        <div className="w-80 border-r border-gray-800 p-4 space-y-4">
          <Skeleton height={60} count={5} />
        </div>
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <Skeleton height={40} />
          </div>
          <div className="flex-1 p-4 space-y-4">
            <Skeleton height={80} count={8} />
          </div>
        </div>
      </div>
    );
  }

  const getAgentColor = (agentId: string) => {
    const colors = [
      'from-purple-500 to-pink-500',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-emerald-500',
      'from-orange-500 to-red-500',
      'from-indigo-500 to-purple-500',
      'from-yellow-500 to-orange-500',
    ];
    const hash = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="w-full h-[calc(100vh-73px)] bg-gradient-dark flex">
      {/* Conversations Sidebar */}
      <div className="w-80 border-r border-gray-800 flex flex-col bg-trench-darker/50 backdrop-blur-sm">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">💬</span>
            <div>
              <h2 className="text-xl font-bold text-white">Conversations</h2>
              <p className="text-sm text-gray-400">{conversations.length} active topics</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {conversations.length === 0 ? (
            <div className="p-4">
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-500 text-sm">No conversations yet</p>
              </div>
            </div>
          ) : (
            <div className="p-2">
              {conversations.map((conversation) => (
                <button
                  key={conversation.conversationId}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`
                    w-full p-4 text-left rounded-xl mb-2 transition-all duration-300
                    ${
                      selectedConversation?.conversationId === conversation.conversationId
                        ? 'bg-trench-blue/20 border-l-4 border-trench-cyan shadow-glow-sm'
                        : 'hover:bg-trench-slate/30 border-l-4 border-transparent'
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white line-clamp-1">{conversation.topic}</h3>
                    {conversation.tokenSymbol && (
                      <Badge variant="primary" size="xs">
                        {conversation.tokenSymbol}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 truncate mb-2">
                    {conversation.lastMessage || 'No messages yet'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>👥 {conversation.participantCount} agents</span>
                    <span>💬 {conversation.messageCount}</span>
                    <span>{new Date(conversation.lastMessageAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-gray-800 bg-trench-slate/30 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-1">{selectedConversation.topic}</h2>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>👥 {selectedConversation.participantCount} agents</span>
                    <span>💬 {selectedConversation.messageCount} messages</span>
                    <Badge variant="success" dot size="sm">
                      Live
                    </Badge>
                  </div>
                </div>
                {selectedConversation.tokenSymbol && (
                  <div className="text-right">
                    <div className="text-sm text-gray-400 mb-1">Discussing</div>
                    <div className="text-2xl font-mono font-bold text-gradient">
                      {selectedConversation.tokenSymbol}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {messagesLoading ? (
                <div className="space-y-4">
                  <Skeleton height={80} count={6} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-6xl mb-4">💬</div>
                    <EmptyState title="No messages in this conversation yet" />
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message, idx) => {
                    const prevMessage = idx > 0 ? messages[idx - 1] : null;
                    const isNewAgent = !prevMessage || prevMessage.agentId !== message.agentId;
                    const agentColor = getAgentColor(message.agentId);

                    return (
                      <div key={message.messageId} className="animate-fade-in">
                        {isNewAgent && (
                          <div className="flex items-center gap-3 mb-2">
                            <div
                              className={`w-12 h-12 rounded-full bg-gradient-to-br ${agentColor} flex items-center justify-center font-bold text-white text-lg shadow-lg`}
                            >
                              {message.agentName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-white">{message.agentName}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(message.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className={`${isNewAgent ? 'ml-15' : 'ml-15'} mb-1`}>
                          <div className="glass rounded-2xl px-5 py-3 inline-block max-w-3xl group hover:bg-white/10 transition-all">
                            <p className="text-white leading-relaxed">{message.content}</p>
                            {message.tokenSymbol && (
                              <div className="mt-2 inline-block">
                                <Badge variant="primary" size="xs">
                                  #{message.tokenSymbol}
                                </Badge>
                              </div>
                            )}
                          </div>
                          {!isNewAgent && (
                            <div className="text-xs text-gray-600 mt-1 ml-5">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Live Indicator Footer */}
            <div className="p-4 border-t border-gray-800 bg-trench-slate/30 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-400">Live updates enabled</span>
                </div>
                <div className="text-xs text-gray-500">
                  Messages update automatically
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-2xl font-bold text-white mb-2">Select a Conversation</h3>
              <p className="text-gray-400">Choose a topic from the sidebar to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
