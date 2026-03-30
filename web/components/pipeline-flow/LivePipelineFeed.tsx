'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, Rocket, Swords, Brain, ArrowRight } from 'lucide-react';
import { getWebSocketManager, type FeedEvent } from '@/lib/websocket';

// ─── Types ───

interface PipelineEvent {
  id: string;
  stage: 'detect' | 'deploy' | 'trade' | 'learn';
  type: string;
  title: string;
  detail: string;
  timestamp: number;
}

const STAGE_META = {
  detect: { icon: Radar, label: 'DETECT', color: 'text-blue-400' },
  deploy: { icon: Rocket, label: 'DEPLOY', color: 'text-emerald-400' },
  trade: { icon: Swords, label: 'TRADE', color: 'text-amber-400' },
  learn: { icon: Brain, label: 'LEARN', color: 'text-violet-400' },
} as const;

// ─── Demo events (fallback when WebSocket is not connected) ───

const DEMO_EVENTS: Omit<PipelineEvent, 'id' | 'timestamp'>[] = [
  { stage: 'detect', type: 'tweet_detected', title: '@MustStopMurad tweeted', detail: '"This cat is going to $1B" — meme filter score: 0.87' },
  { stage: 'detect', type: 'signal_scored', title: 'Signal scored 92/100', detail: 'KOL tier: T1 · Engagement: 4.2K likes · Meme filter: PASS' },
  { stage: 'deploy', type: 'concept_generated', title: 'Token concept: $CATSOL', detail: 'LLM generated name, ticker, narrative in 340ms' },
  { stage: 'deploy', type: 'token_deployed', title: '$CATSOL deployed on Pump.fun', detail: 'Jito bundle confirmed · 0.02 SOL creation fee · Slot 312,847,291' },
  { stage: 'trade', type: 'agent_buy', title: 'Agent "DiamondHands" bought $CATSOL', detail: '0.5 SOL @ $0.000012 · Jupiter route: SOL→CATSOL' },
  { stage: 'trade', type: 'agent_buy', title: 'Agent "MoonWatcher" bought $CATSOL', detail: '0.3 SOL @ $0.000013 · Slippage: 1.2%' },
  { stage: 'trade', type: 'agent_sell', title: 'Agent "Scalper" sold $CATSOL', detail: '0.2 SOL profit · TP hit at 2.1x · Hold time: 4m 22s' },
  { stage: 'learn', type: 'outcome_labeled', title: '$CATSOL labeled: HIT', detail: 'T+24h: +340% · Peak MC: $890K · Added to SFT training set' },
  { stage: 'detect', type: 'tweet_detected', title: '@blknoiz06 posted on Telegram', detail: '"Aping this dog play" — meme filter score: 0.71' },
  { stage: 'deploy', type: 'deploy_skipped', title: 'Signal below threshold', detail: 'Score 71 < min 75 · No deployment · Logged for training' },
  { stage: 'learn', type: 'training_export', title: 'Training batch exported', detail: '48,291 SFT pairs + 12,847 DPO pairs → fine-tune queue' },
  { stage: 'trade', type: 'agent_buy', title: 'Agent "WhaleTracker" copied god wallet', detail: '1.2 SOL @ $0.000045 · Source: 7xK...4Fm (trust: 0.92)' },
];

// ─── Event Mappers (WebSocket → PipelineEvent) ───

function mapDetectEvent(evt: FeedEvent): Omit<PipelineEvent, 'id' | 'timestamp'> | null {
  const d = evt.data;
  if (evt.type === 'tweet_detected' || d.type === 'new_tweet' || d.type === 'newTweet') {
    return {
      stage: 'detect',
      type: 'tweet_detected',
      title: d.author ? `@${d.author} tweeted` : 'New tweet detected',
      detail: d.content || d.text || d.tokenSymbol || 'Signal processing...',
    };
  }
  if (d.type === 'new_token' || d.type === 'newToken') {
    return {
      stage: 'detect',
      type: 'token_detected',
      title: `New token: $${d.symbol || d.tokenSymbol || '???'}`,
      detail: d.name || `Detected on ${d.chain || 'Solana'}`,
    };
  }
  return null;
}

function mapDeployEvent(evt: FeedEvent): Omit<PipelineEvent, 'id' | 'timestamp'> | null {
  const d = evt.data;
  return {
    stage: 'deploy',
    type: 'token_deployed',
    title: `$${d.tokenSymbol || d.symbol || 'TOKEN'} deployed on Pump.fun`,
    detail: d.signature ? `Tx: ${d.signature.slice(0, 8)}...` : 'Jito bundle confirmed',
  };
}

function mapTradeEvent(evt: FeedEvent): Omit<PipelineEvent, 'id' | 'timestamp'> | null {
  const d = evt.data;
  const action = d.action || d.type?.includes('sell') ? 'sold' : 'bought';
  const agent = d.agentName || d.agent_name || 'Agent';
  const symbol = d.tokenSymbol || d.symbol || 'TOKEN';
  const amount = d.amount || d.amountSol;
  return {
    stage: 'trade',
    type: d.action === 'SELL' ? 'agent_sell' : 'agent_buy',
    title: `${agent} ${action} $${symbol}`,
    detail: amount ? `${amount} SOL` : 'Position update',
  };
}

// ─── Component ───

export function LivePipelineFeed({ maxEvents = 8 }: { maxEvents?: number }) {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [isLive, setIsLive] = useState(false);
  const demoIndex = useRef(0);
  const liveEventCount = useRef(0);

  const addEvent = useCallback((template: Omit<PipelineEvent, 'id' | 'timestamp'>) => {
    const event: PipelineEvent = {
      ...template,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    setEvents((prev) => [event, ...prev].slice(0, maxEvents));
  }, [maxEvents]);

  // Try to connect to real WebSocket
  useEffect(() => {
    const ws = getWebSocketManager();
    const unsubs: Array<() => void> = [];

    try {
      ws.connect().then(() => {
        setIsLive(true);

        // Detect stage: tweets + new tokens
        unsubs.push(ws.onPipelineDetect((evt) => {
          const mapped = mapDetectEvent(evt);
          if (mapped) { addEvent(mapped); liveEventCount.current++; }
        }));

        // Deploy stage: token deployments
        unsubs.push(ws.onPipelineDeployment((evt) => {
          const mapped = mapDeployEvent(evt);
          if (mapped) { addEvent(mapped); liveEventCount.current++; }
        }));

        // Trade stage: agent buys/sells
        unsubs.push(ws.onPipelinePosition((evt) => {
          const mapped = mapTradeEvent(evt);
          if (mapped) { addEvent(mapped); liveEventCount.current++; }
        }));

        // Also catch auto_buy_executed from agent activity
        unsubs.push(ws.onAutoBuyExecuted((evt) => {
          const mapped = mapTradeEvent(evt);
          if (mapped) { addEvent(mapped); liveEventCount.current++; }
        }));

        // Pipeline events (concept generated, outcome labeled, etc.)
        unsubs.push(ws.onPipelineEvent((evt) => {
          const d = evt.data;
          const type = d.type || evt.type;
          if (type === 'concept_generated' || type === 'conceptGenerated') {
            addEvent({
              stage: 'deploy',
              type: 'concept_generated',
              title: `Token concept: $${d.symbol || d.tokenSymbol || '???'}`,
              detail: `LLM generated name + narrative`,
            });
          } else if (type === 'outcome_labeled' || type === 'outcomeLabeled') {
            addEvent({
              stage: 'learn',
              type: 'outcome_labeled',
              title: `$${d.symbol || d.tokenSymbol || 'TOKEN'} labeled: ${d.label || d.outcome || '?'}`,
              detail: d.reason || 'Outcome tracked',
            });
          } else if (type === 'meme_filtered' || type === 'memeFiltered') {
            addEvent({
              stage: 'detect',
              type: 'meme_filtered',
              title: 'Meme filter applied',
              detail: d.passed ? `Score: ${d.score} — PASS` : `Score: ${d.score} — FILTERED`,
            });
          }
          liveEventCount.current++;
        }));
      }).catch(() => {
        setIsLive(false);
      });
    } catch {
      setIsLive(false);
    }

    return () => unsubs.forEach((u) => u());
  }, [addEvent]);

  // Demo fallback: if no live events after 10s, start demo mode
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (liveEventCount.current === 0) {
        setIsLive(false);
      }
    }, 10_000);
    return () => clearTimeout(timeout);
  }, []);

  // Demo mode ticker
  useEffect(() => {
    if (isLive) return;

    const interval = setInterval(() => {
      const template = DEMO_EVENTS[demoIndex.current % DEMO_EVENTS.length];
      addEvent(template);
      demoIndex.current++;
    }, 3000);

    return () => clearInterval(interval);
  }, [isLive, addEvent]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
          <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
            {isLive ? 'Live Pipeline' : 'Demo Mode'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-white/25">
          {Object.entries(STAGE_META).map(([key, meta]) => (
            <span key={key} className={`flex items-center gap-1 ${meta.color}`}>
              <meta.icon className="w-3 h-3" />
              {meta.label}
            </span>
          ))}
        </div>
      </div>

      {/* Event List */}
      <div className="space-y-1.5 min-h-[320px]">
        <AnimatePresence initial={false}>
          {events.map((event) => {
            const meta = STAGE_META[event.stage];
            const Icon = meta.icon;
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <div className="flex items-start gap-3 px-3 py-2.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                  <div className={`mt-0.5 ${meta.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${meta.color}`}>
                        {meta.label}
                      </span>
                      <ArrowRight className="w-2.5 h-2.5 text-white/15" />
                      <span className="text-xs font-medium text-white/80 truncate">
                        {event.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/35 mt-0.5 truncate">
                      {event.detail}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-white/20 flex-shrink-0 mt-0.5">
                    {new Date(event.timestamp).toLocaleTimeString('en-US', {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {events.length === 0 && (
          <div className="flex items-center justify-center h-[320px] text-white/20 text-sm font-mono">
            Connecting to pipeline...
          </div>
        )}
      </div>
    </div>
  );
}
