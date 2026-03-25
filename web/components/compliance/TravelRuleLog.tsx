'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Send } from 'lucide-react';

interface TravelRuleMessage {
  id: string;
  transferId: string;
  sourceChain: string;
  destinationChain: string;
  amount: string;
  currency: string;
  senderName: string;
  senderWallet: string;
  receiverName: string;
  receiverWallet: string;
  ivms101Payload: Record<string, unknown>;
  status: string;
  createdAt: string;
}

export function TravelRuleLog({ messages }: { messages: TravelRuleMessage[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-white/20 text-sm">
        No Travel Rule messages yet. Transfers &ge; $3,000 will generate IVMS101 messages.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((msg) => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[#080B14] border border-white/[0.04] rounded-lg overflow-hidden"
        >
          <button
            onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Send size={14} className="text-purple-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-white/80 truncate">
                  {msg.senderName} → {msg.receiverName}
                </div>
                <div className="text-xs text-white/30 flex items-center gap-2 mt-0.5">
                  <span className="font-mono">${parseFloat(msg.amount).toLocaleString()} {msg.currency}</span>
                  <span>·</span>
                  <span>{msg.sourceChain} → {msg.destinationChain}</span>
                  <span>·</span>
                  <span>{new Date(msg.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                msg.status === 'acknowledged' ? 'bg-green-500/10 text-green-400' :
                msg.status === 'sent' ? 'bg-blue-500/10 text-blue-400' :
                'bg-white/5 text-white/40'
              }`}>
                {msg.status}
              </span>
              {expandedId === msg.id ? <ChevronDown size={14} className="text-white/30" /> : <ChevronRight size={14} className="text-white/30" />}
            </div>
          </button>

          <AnimatePresence>
            {expandedId === msg.id && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4">
                  <div className="bg-[#050710] rounded-lg p-4 overflow-x-auto">
                    <div className="text-[10px] text-white/30 mb-2 uppercase tracking-wider">IVMS101 Payload</div>
                    <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap">
                      {JSON.stringify(msg.ivms101Payload, null, 2)}
                    </pre>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}
