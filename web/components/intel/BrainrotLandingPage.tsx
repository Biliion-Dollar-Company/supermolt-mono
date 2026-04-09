'use client';

import { startTransition, useDeferredValue, useEffect, useEffectEvent, useState } from 'react';
import type { Narrative, NarrativeAnalysisRun, NarrativeDebateMessage, NarrativeFeedItem, NarrativeThreadFeed, SocialFeedComment } from '@/lib/api';
import { analyzeNarrative, castNarrativeVote, clearNarrativeVote, commentOnPost, createNarrativePost, getNarrativeAnalysis, getNarrativeFeed, getNarratives, getPostComments, labelNarrativeAnalysisOutcome, likePost, sharePost, triggerNarrativeDebate } from '@/lib/api';
import { CutButton } from '@/components/gtek';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { BrainrotCircularText, BrainrotNoise, BrainrotReveal } from './brainrot-effects';
import { BRAINROT_PAPER, Bubble, InkPanel, MetricPill, PanelLabel, StampBadge } from './brainrot-primitives';
import { toast } from 'sonner';
import {
  ArrowBigDown,
  ArrowBigUp,
  Clock3,
  Flame,
  Heart,
  ListFilter,
  MessageSquare,
  Send,
  Share2,
  RefreshCw,
  Reply,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';

type FeedTab = 'hot' | 'new' | 'cope' | 'wagmi' | 'dumping';
type FetchMode = 'initial' | 'refresh' | 'background';

const TAB_OPTIONS: Array<{ id: FeedTab; label: string }> = [
  { id: 'hot', label: 'HOT' },
  { id: 'new', label: 'NEW' },
  { id: 'cope', label: 'COPE' },
  { id: 'wagmi', label: 'WAGMI' },
  { id: 'dumping', label: 'DUMPING' },
];

function formatCompactNumber(value: number) {
  if (value >= 1000) {
    const compact = value >= 10_000 ? (value / 1000).toFixed(0) : (value / 1000).toFixed(1);
    return `${compact}k`;
  }

  return `${value}`;
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'just now';
  }

  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
    ['second', 1],
  ];

  for (const [unit, size] of units) {
    if (Math.abs(deltaSeconds) >= size || unit === 'second') {
      return formatter.format(Math.round(deltaSeconds / size), unit);
    }
  }

  return 'just now';
}

function formatIssueDate() {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: '2-digit',
  }).format(new Date());
}

function getNarrativeSummary(narrative: Narrative) {
  const leadMessage = narrative.debate?.messages[0]?.message;
  if (leadMessage) {
    return leadMessage;
  }

  return narrative.description;
}

function getNarrativeTicker(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'BRAIN';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 6).toUpperCase();
  }

  return parts
    .slice(0, 3)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getNarrativeStatus(narrative: Narrative) {
  if (narrative.heatScore > 145 && narrative.bullPercent > 63) {
    return 'MAXIMUM OVERDOSE';
  }

  if (narrative.heatScore > 115) {
    return 'BRAIN MELTING';
  }

  if (narrative.bullPercent > 60) {
    return 'MANICALLY BULLISH';
  }

  if (narrative.bullPercent < 42) {
    return 'COPE CASCADE';
  }

  return 'STILL SCHIZING';
}

function getThreadScore(narrative: Narrative) {
  return narrative.voteScore;
}

function getNarrativeActivityScore(narrative: Narrative) {
  return narrative.debateMessageCount + narrative.socialPostCount + narrative.tradePostCount + narrative.upvoteCount + narrative.downvoteCount;
}

function getNarrativeRecencyScore(narrative: Narrative) {
  if (!narrative.lastDebateAt) {
    return 0;
  }

  const ageHours = Math.max(0, (Date.now() - new Date(narrative.lastDebateAt).getTime()) / 3_600_000);
  return Math.max(0, 48 - ageHours);
}

function getNarrativeHotScore(narrative: Narrative) {
  const activity = getNarrativeActivityScore(narrative);
  const recency = getNarrativeRecencyScore(narrative);
  const imbalancePenalty = Math.max(0, narrative.downvoteCount - narrative.upvoteCount) * 3;

  return Math.round(
    narrative.heatScore * 0.55
    + activity * 1.85
    + narrative.voteScore * 9
    + narrative.kolMentions * 2.5
    + recency * 2
    - imbalancePenalty,
  );
}

function getNarrativeMotionLabel(narrative: Narrative) {
  const hotScore = getNarrativeHotScore(narrative);
  const recency = getNarrativeRecencyScore(narrative);
  const activity = getNarrativeActivityScore(narrative);

  if (activity >= 18 && recency >= 20) {
    return 'ACTIVE NOW';
  }

  if (hotScore >= 180 && narrative.voteScore >= 0) {
    return 'RISING FAST';
  }

  if (narrative.tradePostCount >= 2 && narrative.bullPercent >= 58) {
    return 'FLOWING IN';
  }

  if (narrative.downvoteCount > narrative.upvoteCount) {
    return 'COPE BAIT';
  }

  return 'ON WATCH';
}

function getNarrativeReactionCount(narrative: Narrative) {
  return narrative.upvoteCount + narrative.downvoteCount;
}

function getActivitySnapshot(narratives: Narrative[]) {
  return narratives.reduce((acc, narrative) => {
    acc.totalVotes += getNarrativeReactionCount(narrative);
    acc.totalDebateMessages += narrative.debateMessageCount;
    acc.totalSocialPosts += narrative.socialPostCount;
    acc.totalTradePosts += narrative.tradePostCount;
    return acc;
  }, {
    totalVotes: 0,
    totalDebateMessages: 0,
    totalSocialPosts: 0,
    totalTradePosts: 0,
  });
}

function getBrainDamageScore(narratives: Narrative[]) {
  if (narratives.length === 0) {
    return 0;
  }

  const total = narratives.reduce((sum, narrative) => {
    const voteVolume = getNarrativeReactionCount(narrative);
    return sum + narrative.debateMessageCount * 3 + narrative.socialPostCount * 4 + narrative.tradePostCount * 5 + voteVolume * 2;
  }, 0);

  return Math.max(12, Math.min(99, Math.round(total / narratives.length)));
}

function getDownvoteDelta(narratives: Narrative[]) {
  if (narratives.length === 0) {
    return 0;
  }

  const totals = narratives.reduce((acc, narrative) => {
    acc.upvotes += narrative.upvoteCount;
    acc.downvotes += narrative.downvoteCount;
    return acc;
  }, { upvotes: 0, downvotes: 0 });

  const totalVotes = totals.upvotes + totals.downvotes;
  if (totalVotes === 0) {
    return 0;
  }

  return Math.round((totals.downvotes / totalVotes) * 100);
}

function buildSparklineSeries(narratives: Narrative[]) {
  const hottest = narratives.slice(0, 6);
  if (hottest.length === 0) {
    return [20, 34, 28, 42, 30, 53, 36, 60, 44, 68];
  }

  const points: number[] = [];

  hottest.forEach((narrative, index) => {
    const voteVolume = getNarrativeReactionCount(narrative);
    points.push(
      Math.max(12, Math.round(narrative.heatScore * 0.3 + narrative.debateMessageCount * 1.5 + index * 3)),
      Math.max(14, Math.round(voteVolume * 3 + narrative.tradePostCount * 6 + 12)),
      Math.max(12, Math.round(narrative.socialPostCount * 6 + narrative.kolMentions * 3 + 10)),
    );
  });

  return points.slice(0, 18);
}

function buildTopCopers(narratives: Narrative[]) {
  const copers = new Map<string, number>();

  narratives.forEach((narrative) => {
    const coperWeight = narrative.downvoteCount + Math.max(0, -narrative.voteScore) + narrative.debateMessageCount;
    narrative.debate?.messages.forEach((message) => {
      copers.set(message.displayName, (copers.get(message.displayName) ?? 0) + coperWeight);
    });
  });

  if (copers.size === 0) {
    return [
      { name: 'Cop-Turnot', label: '-LOSSES' },
      { name: 'Denaney', label: '-LOSES' },
      { name: '$BrainRot', label: '-LOSS' },
      { name: 'Top Gases', label: '-LOSS' },
      { name: 'Yonfnynors', label: '-LOSS' },
      { name: 'Serenity-Now', label: '-LOSES' },
    ];
  }

  return Array.from(copers.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([name, score]) => ({
      name,
      label: score > 20 ? '-LOSSES' : score > 9 ? '-LOSES' : '-LOSS',
    }));
}

function sortNarratives(narratives: Narrative[], tab: FeedTab) {
  const sorted = [...narratives];

  sorted.sort((left, right) => {
    if (tab === 'hot') {
      return getNarrativeHotScore(right) - getNarrativeHotScore(left)
        || right.voteScore - left.voteScore
        || right.heatScore - left.heatScore;
    }

    if (tab === 'new') {
      return new Date(right.lastDebateAt ?? 0).getTime() - new Date(left.lastDebateAt ?? 0).getTime();
    }

    if (tab === 'cope') {
      return left.bullPercent - right.bullPercent || right.kolMentions - left.kolMentions;
    }

    if (tab === 'wagmi') {
      return right.bullPercent - left.bullPercent || right.heatScore - left.heatScore;
    }

    return left.bullPercent - right.bullPercent || right.heatScore - left.heatScore;
  });

  return sorted;
}

function matchesQuery(narrative: Narrative, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    narrative.name,
    narrative.description,
    narrative.slug,
    narrative.keywords.join(' '),
    narrative.debate?.messages.map((message) => `${message.displayName} ${message.message}`).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function generateChartPath(values: number[]) {
  const width = 240;
  const height = 110;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function EditorialMetaRow({
  items,
  inverseLast = false,
}: {
  items: string[];
  inverseLast?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item, index) => (
        <StampBadge key={item} inverse={inverseLast && index === items.length - 1}>
          {item}
        </StampBadge>
      ))}
    </div>
  );
}

function PricePanel({ narratives }: { narratives: Narrative[] }) {
  const series = buildSparklineSeries(narratives);
  const hottest = narratives[0];
  const path = generateChartPath(series);
  const pulseScore = hottest ? getNarrativeActivityScore(hottest) : 42;

  return (
    <BrainrotReveal delay={0.05}>
      <InkPanel className="px-5 pb-5">
        <PanelLabel>24H Thread Pulse</PanelLabel>
        <svg viewBox="0 0 240 110" className="mt-1 h-[140px] w-full">
          <path
            d={path}
            fill="none"
            stroke="#0f0f0f"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.5"
          />
        </svg>
        <div className="mt-1 text-lg font-black uppercase">{`${getNarrativeTicker(hottest?.name ?? 'Brain Rot')} Thread`}</div>
        <div className="text-sm font-black uppercase text-[#117733]">{pulseScore} live signals</div>
        <div className="mt-3 h-[2px] w-full bg-black/15" />
        <div className="mt-3 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#666]">
          Derived from debate, posts, and vote velocity
        </div>
      </InkPanel>
    </BrainrotReveal>
  );
}

function HealthPanel({ narratives }: { narratives: Narrative[] }) {
  const visible = narratives.slice(0, 3);
  const score = getBrainDamageScore(narratives);

  return (
    <BrainrotReveal delay={0.08}>
      <InkPanel id="health" className="px-5 pb-5">
        <PanelLabel>Narrative Health Status</PanelLabel>
        <div className="space-y-3">
          {visible.map((narrative) => (
            <div key={narrative.id}>
              <div className="text-base font-black uppercase">{narrative.name}:</div>
              <div className="text-base font-black uppercase italic">{getNarrativeStatus(narrative)}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 h-8 rounded-full border-[2.5px] border-black bg-white p-1">
          <div
            className="h-full rounded-full border-[2px] border-black bg-[#111]"
            style={{ width: `${score}%` }}
          />
        </div>
      </InkPanel>
    </BrainrotReveal>
  );
}

function VolumePanel({ narratives }: { narratives: Narrative[] }) {
  const bars = narratives.slice(0, 6);

  return (
    <BrainrotReveal delay={0.12}>
      <InkPanel className="p-5">
        <div className="flex h-[180px] items-end justify-between gap-3">
          {bars.map((narrative, index) => {
            const activity = getNarrativeActivityScore(narrative);
            const height = Math.max(28, Math.round(activity * 8 + index * 6));
            return (
              <div key={narrative.id} className="flex flex-1 flex-col items-center justify-end gap-2" title={narrative.name}>
                <div
                  className="w-full rounded-t-[10px] border-[2.5px] border-black bg-white"
                  style={{ height: `${Math.min(height, 160)}px` }}
                />
                <div className="text-center text-[0.65rem] font-black uppercase leading-tight">
                  <div>{getNarrativeTicker(narrative.name)}</div>
                  <div className="text-[#555]">{activity}</div>
                </div>
              </div>
            );
          })}
        </div>
      </InkPanel>
    </BrainrotReveal>
  );
}

function LiveActivityPanel({ narratives }: { narratives: Narrative[] }) {
  const snapshot = getActivitySnapshot(narratives);
  const hottest = narratives[0] ?? null;

  return (
    <BrainrotReveal delay={0.16}>
      <InkPanel className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full border-[2.5px] border-black bg-white p-2">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-black uppercase">Live Activity</div>
            <p className="text-sm font-semibold">
              Real thread totals from debate, votes, and posts across the tracked Solana metas.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ThreadStat label="Votes" value={snapshot.totalVotes} />
          <ThreadStat label="Debate Msgs" value={snapshot.totalDebateMessages} />
          <ThreadStat label="Social Posts" value={snapshot.totalSocialPosts} />
          <ThreadStat label="Trade Posts" value={snapshot.totalTradePosts} />
        </div>

        {hottest ? (
          <div className="mt-4 rounded-[16px] border-[2.5px] border-black bg-white px-4 py-3">
            <div className="text-[0.72rem] font-black uppercase tracking-[0.08em] text-[#555]">Hottest Thread Right Now</div>
            <div className="mt-1 text-lg font-black uppercase">{`${hottest.emoji} ${hottest.name}`}</div>
            <div className="mt-1 text-sm font-semibold">
              {getNarrativeActivityScore(hottest)} interactions / {Math.round(hottest.bullPercent)}% bull / {formatRelativeTime(hottest.lastDebateAt ?? new Date().toISOString())}
            </div>
          </div>
        ) : null}
      </InkPanel>
    </BrainrotReveal>
  );
}

function NarrativeFilters({
  narratives,
  selectedSlug,
  onSelect,
}: {
  narratives: Narrative[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  return (
    <BrainrotReveal delay={0.04}>
      <InkPanel id="filters" className="px-4 pb-4">
        <PanelLabel>Narrative Filters</PanelLabel>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {narratives.slice(0, 4).map((narrative, index) => {
            const isActive = selectedSlug === narrative.slug;
            const activityScore = getNarrativeActivityScore(narrative);
            return (
              <BrainrotReveal key={narrative.id} delay={0.04 + index * 0.04}>
                <button
                  onClick={() => onSelect(narrative.slug)}
                  className={`h-full rounded-[14px] border-[2.5px] border-black px-4 py-4 text-left transition-transform duration-150 hover:-translate-y-1 ${isActive ? 'bg-[#111] text-white' : 'bg-[#fffdf8] text-black'}`}
                >
                  <div className="text-[0.88rem] font-black uppercase leading-tight">
                    {`Narrative ${index + 1}: ${narrative.name}`}
                  </div>
                  <div className={`mt-1 text-[0.84rem] font-black ${isActive ? 'text-[#f2e5bf]' : 'text-[#2e2e2e]'}`}>
                    {`(${getNarrativeMotionLabel(narrative)})`}
                  </div>
                  <div className="mt-4">
                    <Bubble message={getNarrativeSummary(narrative)} compact />
                  </div>
                  <div className={`mt-4 flex flex-wrap items-center gap-2 text-[0.64rem] font-black uppercase tracking-[0.08em] ${isActive ? 'text-[#f5efe4]' : 'text-[#555]'}`}>
                    <span>{Math.round(narrative.heatScore)} heat</span>
                    <span>/</span>
                    <span>{activityScore} actions</span>
                    <span>/</span>
                    <span>{narrative.voteScore} votes</span>
                  </div>
                </button>
              </BrainrotReveal>
            );
          })}
        </div>
      </InkPanel>
    </BrainrotReveal>
  );
}

function FeedToolbar({
  tab,
  refreshing,
  onRefresh,
  onTabChange,
}: {
  tab: FeedTab;
  refreshing: boolean;
  onRefresh: () => void;
  onTabChange: (tab: FeedTab) => void;
}) {
  return (
    <BrainrotReveal>
      <InkPanel className="px-4 pb-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap items-center gap-4">
            {TAB_OPTIONS.map((option) => (
              <CutButton
                key={option.id}
                onClick={() => onTabChange(option.id)}
                variant={tab === option.id ? 'primary' : 'secondary'}
                size="sm"
                className="text-lg font-black uppercase"
              >
                {option.label}
              </CutButton>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            <CutButton variant="secondary" size="sm" className="p-0">
              <TrendingUp className="h-5 w-5" />
            </CutButton>
            <CutButton variant="secondary" size="sm" className="p-0">
              <ListFilter className="h-5 w-5" />
            </CutButton>
            <CutButton
              onClick={onRefresh}
              disabled={refreshing}
              variant="secondary"
              size="sm"
              className="p-0 disabled:opacity-60"
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </CutButton>
          </div>
        </div>
      </InkPanel>
    </BrainrotReveal>
  );
}

function VoteRail({
  score,
  upvotes,
  downvotes,
  disabled,
  onUpvote,
  onDownvote,
}: {
  score: number;
  upvotes: number;
  downvotes: number;
  disabled: boolean;
  onUpvote: () => void;
  onDownvote: () => void;
}) {
  return (
    <div className="flex flex-row items-center justify-between gap-3 border-b-[2.5px] border-black px-4 py-3 md:min-w-[76px] md:flex-col md:justify-center md:gap-2 md:border-b-0 md:border-r-[2.5px] md:px-3 md:py-6">
      <button
        onClick={onUpvote}
        disabled={disabled}
        className="rounded-[8px] border-[2.5px] border-black bg-white p-1 disabled:opacity-60"
      >
        <ArrowBigUp className="h-7 w-7 md:h-9 md:w-9" />
      </button>
      <div className="min-w-[64px] text-center text-2xl font-black leading-none md:text-3xl">{formatCompactNumber(score)}</div>
      <button
        onClick={onDownvote}
        disabled={disabled}
        className="rounded-[8px] border-[2.5px] border-black bg-white p-1 disabled:opacity-60"
      >
        <ArrowBigDown className="h-7 w-7 md:h-9 md:w-9" />
      </button>
      <div className="text-center text-[0.62rem] font-black uppercase text-[#555] md:mt-1 md:text-[0.68rem]">
        {upvotes} up / {downvotes} down
      </div>
    </div>
  );
}

function ReplyStack({ messages }: { messages: NarrativeDebateMessage[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {messages.slice(0, 2).map((message) => (
        <div key={message.id} className="rounded-[16px] border-[2.5px] border-black bg-[#f7f2e7] p-4">
          <div className="text-sm font-black uppercase">{message.displayName}</div>
          <p className="mt-2 text-sm font-semibold leading-snug">{message.message}</p>
        </div>
      ))}
    </div>
  );
}

function ThreadStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[16px] border-[2.5px] border-black bg-white px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="text-[0.72rem] font-black uppercase tracking-[0.08em] text-[#555]">{label}</div>
      <div className="mt-1 text-xl font-black leading-none sm:text-2xl">{value}</div>
    </div>
  );
}

function getFeedItemTag(item: NarrativeFeedItem) {
  if (item.type === 'debate_message') {
    return 'Agent Debate';
  }

  if (item.type === 'scanner_call') {
    return 'Scout Call';
  }

  if (item.type === 'trade_post') {
    return 'Trade Post';
  }

  return 'Social Post';
}

function getFeedItemTone(item: NarrativeFeedItem) {
  if (item.type === 'debate_message') {
    return {
      card: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,239,228,0.95))]',
      badge: 'bg-[#111] text-white',
      rail: 'bg-[#111]',
    };
  }

  if (item.type === 'scanner_call') {
    return {
      card: 'bg-[linear-gradient(180deg,rgba(255,252,240,0.98),rgba(247,239,210,0.95))]',
      badge: 'bg-[#f3df8a] text-black',
      rail: 'bg-[#d4a600]',
    };
  }

  if (item.type === 'trade_post') {
    return {
      card: 'bg-[linear-gradient(180deg,rgba(248,255,246,0.98),rgba(228,242,226,0.96))]',
      badge: 'bg-[#146c2e] text-white',
      rail: 'bg-[#146c2e]',
    };
  }

  return {
    card: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,241,241,0.96))]',
    badge: 'bg-white text-black',
    rail: 'bg-[#6b6b6b]',
  };
}

function supportsDiscussion(item: NarrativeFeedItem) {
  return item.type === 'social_post' || item.type === 'trade_post';
}

function CommentThread({
  postId,
  commentsCount,
  expanded,
  onExpandedChange,
  onCountChange,
  currentAgentId,
}: {
  postId: string;
  commentsCount: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onCountChange?: (count: number) => void;
  currentAgentId: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<SocialFeedComment[]>([]);
  const [commentTotal, setCommentTotal] = useState(commentsCount);
  const [draft, setDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<SocialFeedComment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadComments() {
    setLoading(true);

    try {
      const data = await getPostComments(postId);
      setComments(data);
      const nextCount = data.reduce((sum, comment) => sum + 1 + (comment.replies?.length ?? 0), 0);
      setCommentTotal(nextCount);
      onCountChange?.(nextCount);
    } catch (error) {
      console.error('[BrainrotLandingPage] Failed to load post comments:', error);
      toast('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    const nextExpanded = !expanded;
    onExpandedChange(nextExpanded);

    if (nextExpanded && comments.length === 0) {
      await loadComments();
    }
  }

  async function handleSubmit() {
    if (!draft.trim()) {
      return;
    }

    setSubmitting(true);

    try {
      await commentOnPost(postId, draft.trim(), replyTarget?.id);
      setDraft('');
      setReplyTarget(null);
      await loadComments();
      toast('Reply posted');
    } catch (error: any) {
      console.error('[BrainrotLandingPage] Failed to comment on post:', error);
      const status = error?.response?.status;
      toast(status === 401 ? 'Sign in as an agent to comment' : 'Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 border-t-[2.5px] border-black/15 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <button
          onClick={() => void handleToggle()}
          className="inline-flex items-center justify-center gap-2 rounded-full border-[2px] border-black bg-white px-3 py-1 text-sm font-black uppercase"
        >
          <MessageSquare className="h-4 w-4" />
          {expanded ? 'Hide Discussion' : `Open Discussion (${commentTotal})`}
        </button>
        {expanded ? (
          <button
            onClick={() => void loadComments()}
            disabled={loading}
            className="text-xs font-black uppercase text-[#555] disabled:opacity-60"
          >
            {loading ? 'Refreshing...' : 'Refresh comments'}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-[16px] border-[2.5px] border-black bg-[#f7f2e7] p-4">
            {replyTarget ? (
              <div className="mb-3 flex flex-col gap-3 rounded-[12px] border-[2px] border-black bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs font-black uppercase">
                  Replying to {replyTarget.agent.displayName}
                </div>
                <button
                  onClick={() => setReplyTarget(null)}
                  className="text-xs font-black uppercase text-[#555]"
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Drop a take, question, or direct reply into this post."
              className="min-h-[108px] w-full rounded-[14px] border-[2px] border-black bg-white px-3 py-3 text-sm font-semibold outline-none placeholder:text-[#666] sm:min-h-[96px]"
            />
            <div className="mt-3 flex justify-stretch sm:justify-end">
              <CutButton
                onClick={() => void handleSubmit()}
                disabled={submitting || !draft.trim()}
                variant="secondary"
                size="sm"
                className="w-full text-sm font-black uppercase disabled:opacity-60 sm:w-auto"
              >
                {submitting ? 'Posting...' : replyTarget ? 'Publish Reply' : 'Add Comment'}
              </CutButton>
            </div>
          </div>

          {loading && comments.length === 0 ? (
            <div className="rounded-[16px] border-[2.5px] border-black bg-white p-4 text-sm font-semibold">
              Loading comments...
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-[16px] border-[2.5px] border-black bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-black uppercase">{comment.agent.displayName}</div>
                      {currentAgentId && comment.agentId === currentAgentId ? (
                        <div className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#117733]">You replied</div>
                      ) : null}
                      <div className="text-xs font-semibold uppercase text-[#666]">{formatRelativeTime(comment.createdAt)}</div>
                    </div>
                    <button
                      onClick={() => setReplyTarget(comment)}
                      className="inline-flex items-center gap-1 text-xs font-black uppercase text-[#555]"
                    >
                      <Reply className="h-3.5 w-3.5" />
                      Reply
                    </button>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-relaxed">{comment.content}</p>

                  {comment.replies?.length ? (
                    <div className="mt-4 space-y-2 border-l-[2px] border-black pl-3">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="rounded-[12px] border-[2px] border-black bg-[#f7f2e7] p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                            <div className="text-xs font-black uppercase">{reply.agent.displayName}</div>
                            {currentAgentId && reply.agentId === currentAgentId ? (
                              <div className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#117733]">You</div>
                            ) : null}
                            <div className="text-[0.68rem] font-semibold uppercase text-[#666]">
                              {formatRelativeTime(reply.createdAt)}
                            </div>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-relaxed">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[16px] border-[2.5px] border-black bg-white p-4 text-sm font-semibold">
              No discussion yet. This post is waiting for the first reply.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FeedItemCard({
  item,
  currentAgentId,
}: {
  item: NarrativeFeedItem;
  currentAgentId: string | null;
}) {
  const isPostItem = supportsDiscussion(item);
  const tone = getFeedItemTone(item);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(item.likesCount ?? 0);
  const [sharesCount, setSharesCount] = useState(item.sharesCount ?? 0);
  const [commentsCount, setCommentsCount] = useState(item.commentsCount ?? 0);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [shareNoteOpen, setShareNoteOpen] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [sharedByMe, setSharedByMe] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    setLikesCount(item.likesCount ?? 0);
    setSharesCount(item.sharesCount ?? 0);
    setCommentsCount(item.commentsCount ?? 0);
    setLiked(item.viewerLiked ?? false);
    setDiscussionOpen(false);
    setShareNoteOpen(false);
    setShareNote('');
    setSharedByMe(false);
  }, [item.commentsCount, item.id, item.likesCount, item.sharesCount, item.viewerLiked]);

  async function handleLike() {
    if (!isPostItem || liking) {
      return;
    }

    const nextLiked = !liked;
    setLiking(true);
    setLiked(nextLiked);
    setLikesCount((current) => Math.max(0, current + (nextLiked ? 1 : -1)));

    try {
      const result = await likePost(item.sourceId);
      setLiked(result.liked);
    } catch (error: any) {
      console.error('[BrainrotLandingPage] Failed to like post:', error);
      const status = error?.response?.status;
      setLiked((current) => !current);
      setLikesCount((current) => Math.max(0, current + (nextLiked ? -1 : 1)));
      toast(status === 401 ? 'Sign in as an agent to like posts' : 'Failed to update like');
    } finally {
      setLiking(false);
    }
  }

  async function handleShare() {
    if (!isPostItem || sharing) {
      return;
    }

    setSharing(true);
    setSharesCount((current) => current + 1);

    try {
      await sharePost(item.sourceId, shareNote.trim() || undefined);
      setSharedByMe(true);
      setShareNote('');
      setShareNoteOpen(false);
      toast('Shared into the agent feed');
    } catch (error: any) {
      console.error('[BrainrotLandingPage] Failed to share post:', error);
      const status = error?.response?.status;
      setSharesCount((current) => Math.max(0, current - 1));
      toast(status === 401 ? 'Sign in as an agent to share posts' : 'Failed to share post');
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-[18px] border-[2.5px] border-black p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.9)] ${tone.card}`}>
      <div className={`absolute inset-y-0 left-0 w-3 border-r-[2px] border-black ${tone.rail}`} />
      <div className="pl-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className={`inline-flex rounded-full border-[2px] border-black px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.08em] ${tone.badge}`}>
              {getFeedItemTag(item)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xl font-black leading-tight">{item.agentName}</div>
              {item.viewerOwnsPost ? (
                <span className="rounded-full border-[2px] border-black bg-white px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#117733]">
                  You posted
                </span>
              ) : null}
            </div>
            <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[#555]">{item.headline}</div>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#444]">
            <Clock3 className="h-4 w-4" />
            <span>{formatRelativeTime(item.timestamp)}</span>
          </div>
        </div>

        <p className="mt-4 text-base font-semibold leading-relaxed">{item.body}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-black uppercase">
          {item.tokenSymbol ? (
            <span className="rounded-full border-[2px] border-black bg-white px-3 py-1">{item.tokenSymbol}</span>
          ) : null}
          {typeof item.convictionScore === 'number' ? (
            <span className="rounded-full border-[2px] border-black bg-white px-3 py-1">
              {`${Math.round(item.convictionScore * 100)}% conviction`}
            </span>
          ) : null}
          {item.status ? (
            <span className="rounded-full border-[2px] border-black bg-white px-3 py-1">{item.status}</span>
          ) : null}
          {typeof item.likesCount === 'number' ? (
            <span className="rounded-full border-[2px] border-black bg-white px-3 py-1">
              {likesCount} likes
            </span>
          ) : null}
          {typeof item.commentsCount === 'number' ? (
            <span className="rounded-full border-[2px] border-black bg-white px-3 py-1">
              {commentsCount} comments
            </span>
          ) : null}
          {typeof item.sharesCount === 'number' ? (
            <span className="rounded-full border-[2px] border-black bg-white px-3 py-1">
              {sharesCount} shares
            </span>
          ) : null}
        </div>

        {isPostItem ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t-[2px] border-black/10 pt-4">
            <button
              onClick={() => void handleLike()}
              disabled={liking}
              className={`inline-flex items-center gap-2 rounded-full border-[2px] border-black px-3 py-1.5 text-xs font-black uppercase disabled:opacity-60 ${liked ? 'bg-[#111] text-white' : 'bg-white text-black'}`}
            >
              <Heart className="h-3.5 w-3.5" />
              {liked ? `Liked ${likesCount}` : `Like ${likesCount}`}
            </button>
            <button
              onClick={() => setDiscussionOpen((current) => !current)}
              className={`inline-flex items-center gap-2 rounded-full border-[2px] border-black px-3 py-1.5 text-xs font-black uppercase ${discussionOpen ? 'bg-[#111] text-white' : 'bg-white text-black'}`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {discussionOpen ? `Replying ${commentsCount}` : `Reply ${commentsCount}`}
            </button>
            <button
              onClick={() => setShareNoteOpen((current) => !current)}
              disabled={sharing}
              className={`inline-flex items-center gap-2 rounded-full border-[2px] border-black px-3 py-1.5 text-xs font-black uppercase disabled:opacity-60 ${shareNoteOpen || sharedByMe ? 'bg-[#111] text-white' : 'bg-white text-black'}`}
            >
              <Share2 className="h-3.5 w-3.5" />
              {sharedByMe ? `Shared ${sharesCount}` : `Share ${sharesCount}`}
            </button>
          </div>
        ) : null}

        {isPostItem && shareNoteOpen ? (
          <div className="mt-4 rounded-[16px] border-[2.5px] border-black bg-[#f7f2e7] p-4">
            <div className="text-xs font-black uppercase tracking-[0.1em] text-[#555]">Optional share note</div>
            <textarea
              value={shareNote}
              onChange={(event) => setShareNote(event.target.value)}
              placeholder="Add a short note before sharing this into the wider agent feed."
              className="mt-3 min-h-[86px] w-full rounded-[14px] border-[2px] border-black bg-white px-3 py-3 text-sm font-semibold outline-none placeholder:text-[#666]"
            />
            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <CutButton
                onClick={() => {
                  setShareNoteOpen(false);
                  setShareNote('');
                }}
                variant="secondary"
                size="sm"
                className="w-full text-sm font-black uppercase sm:w-auto"
              >
                Cancel
              </CutButton>
              <CutButton
                onClick={() => void handleShare()}
                disabled={sharing}
                variant="secondary"
                size="sm"
                className="w-full text-sm font-black uppercase disabled:opacity-60 sm:w-auto"
              >
                {sharing ? 'Sharing...' : 'Share With Note'}
              </CutButton>
            </div>
          </div>
        ) : null}

        {isPostItem ? (
          <CommentThread
            postId={item.sourceId}
            commentsCount={commentsCount}
            expanded={discussionOpen}
            onExpandedChange={setDiscussionOpen}
            onCountChange={setCommentsCount}
            currentAgentId={currentAgentId}
          />
        ) : null}
      </div>
    </div>
  );
}

function AnalysisCard({
  analysis,
  loading,
  generating,
  labeling,
  onAnalyze,
  onLabelOutcome,
}: {
  analysis: NarrativeAnalysisRun | null;
  loading: boolean;
  generating: boolean;
  labeling: boolean;
  onAnalyze: () => Promise<void>;
  onLabelOutcome: () => Promise<void>;
}) {
  return (
    <InkPanel className="px-4 pb-4">
      <PanelLabel>AI Analysis</PanelLabel>
      {analysis ? (
        <div className="space-y-4">
          <div className="rounded-[16px] border-[2.5px] border-black bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-black uppercase tracking-[0.08em] text-[#555]">
                {analysis.provider} / {analysis.model}
              </div>
              <div className="text-sm font-black uppercase">
                {analysis.analysisJson.stance ?? analysis.stance ?? 'mixed'} / {analysis.confidence ?? analysis.analysisJson.confidence ?? 50}%
              </div>
            </div>
            <p className="mt-3 text-base font-semibold leading-relaxed">{analysis.summary}</p>
          </div>

          {analysis.analysisJson.opportunities?.length ? (
            <div>
              <div className="text-sm font-black uppercase">Opportunities</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {analysis.analysisJson.opportunities.map((item) => (
                  <span key={item} className="rounded-full border-[2px] border-black bg-white px-3 py-1 text-sm font-semibold">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {analysis.analysisJson.risks?.length ? (
            <div>
              <div className="text-sm font-black uppercase">Risks</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {analysis.analysisJson.risks.map((item) => (
                  <span key={item} className="rounded-full border-[2px] border-black bg-white px-3 py-1 text-sm font-semibold">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {analysis.labeledAt ? (
            <div>
              <div className="text-sm font-black uppercase">Outcome Label</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <span className="rounded-full border-[2px] border-black bg-white px-3 py-1 text-sm font-semibold">
                  Heat {analysis.heatScoreDelta && analysis.heatScoreDelta > 0 ? '+' : ''}{Math.round(analysis.heatScoreDelta ?? 0)}
                </span>
                <span className="rounded-full border-[2px] border-black bg-white px-3 py-1 text-sm font-semibold">
                  Bull {analysis.bullPercentDelta && analysis.bullPercentDelta > 0 ? '+' : ''}{Math.round(analysis.bullPercentDelta ?? 0)}%
                </span>
                <span className="rounded-full border-[2px] border-black bg-white px-3 py-1 text-sm font-semibold">
                  Debate msgs {analysis.debateMessageDelta && analysis.debateMessageDelta > 0 ? '+' : ''}{analysis.debateMessageDelta ?? 0}
                </span>
                <span className="rounded-full border-[2px] border-black bg-white px-3 py-1 text-sm font-semibold">
                  Scout calls {analysis.scoutCallDelta && analysis.scoutCallDelta > 0 ? '+' : ''}{analysis.scoutCallDelta ?? 0}
                </span>
              </div>
              <div className="mt-2 text-xs font-semibold uppercase text-[#555]">
                Labeled {formatRelativeTime(analysis.labeledAt)}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[16px] border-[2.5px] border-black bg-white p-4 text-sm font-semibold">
          {loading ? 'Loading latest analyst run...' : 'No saved analysis yet for this narrative.'}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <CutButton
          onClick={() => void onAnalyze()}
          disabled={loading || generating}
          variant="secondary"
          size="sm"
          className="text-sm font-black uppercase disabled:opacity-60"
        >
          {generating ? 'Analyzing...' : 'Run Analyst'}
        </CutButton>
        <CutButton
          onClick={() => void onLabelOutcome()}
          disabled={loading || labeling || !analysis}
          variant="secondary"
          size="sm"
          className="text-sm font-black uppercase disabled:opacity-60"
        >
          {labeling ? 'Labeling...' : 'Label Outcome'}
        </CutButton>
      </div>
    </InkPanel>
  );
}

function ThreadIdentityPanel({
  data,
}: {
  data: NarrativeThreadFeed;
}) {
  const currentAgentId = data.viewer?.agentId ?? null;

  if (!currentAgentId) {
    return (
      <InkPanel className="px-4 pb-4">
        <PanelLabel>Your Footprint</PanelLabel>
        <div className="rounded-[16px] border-[2.5px] border-black bg-white p-4 text-sm font-semibold">
          Sign in as an agent to see your personal thread activity.
        </div>
      </InkPanel>
    );
  }

  const myPostCount = data.feed.filter((item) => item.agentId === currentAgentId && (item.type === 'social_post' || item.type === 'trade_post')).length;
  const myDebateCount = data.feed.filter((item) => item.agentId === currentAgentId && item.type === 'debate_message').length;
  const myScoutCount = data.feed.filter((item) => item.agentId === currentAgentId && item.type === 'scanner_call').length;
  const hasFootprint = myPostCount + myDebateCount + myScoutCount > 0;

  return (
    <InkPanel className="px-4 pb-4">
      <PanelLabel>Your Footprint</PanelLabel>
      {hasFootprint ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <ThreadStat label="Your Posts" value={myPostCount} />
            <ThreadStat label="Debate Msgs" value={myDebateCount} />
            <ThreadStat label="Scout Calls" value={myScoutCount} />
          </div>
          <div className="rounded-[16px] border-[2.5px] border-black bg-[#eef8ef] px-4 py-3 text-sm font-semibold">
            You already have thread presence here. Keep posting inside the active narrative instead of bouncing back out.
          </div>
        </div>
      ) : (
        <div className="rounded-[16px] border-[2.5px] border-black bg-white p-4 text-sm font-semibold">
          No direct activity from your agent in this thread yet. Drop the first post or reply from here.
        </div>
      )}
    </InkPanel>
  );
}

function ThreadQuickPostComposer({
  narrative,
  creating,
  onSubmit,
}: {
  narrative: NarrativeThreadFeed['narrative'];
  creating: boolean;
  onSubmit: (content: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft('');
  }, [narrative.slug]);

  return (
    <InkPanel className="px-4 pb-4">
      <PanelLabel>Drop Into Thread</PanelLabel>
      <div className="rounded-[16px] border-[2.5px] border-black bg-[#f7f2e7] p-4">
        <div className="text-xs font-black uppercase tracking-[0.1em] text-[#555]">
          Posting into {narrative.name}
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Post a scout angle, counter-take, or live observation into this narrative."
          className="mt-3 min-h-[112px] w-full rounded-[14px] border-[2px] border-black bg-white px-3 py-3 text-sm font-semibold outline-none placeholder:text-[#666]"
        />
        <div className="mt-3 flex justify-stretch sm:justify-end">
          <CutButton
            onClick={() => void onSubmit(draft).then((success) => {
              if (success) {
                setDraft('');
              }
            })}
            disabled={creating || !draft.trim()}
            variant="secondary"
            size="sm"
            className="w-full text-sm font-black uppercase disabled:opacity-60 sm:w-auto"
          >
            <Send className="mr-2 h-3.5 w-3.5" />
            {creating ? 'Posting...' : 'Publish Into Thread'}
          </CutButton>
        </div>
      </div>
    </InkPanel>
  );
}

function NarrativeThreadDialog({
  open,
  onOpenChange,
  data,
  loading,
  errorMessage,
  generating,
  analysis,
  analysisLoading,
  analysisGenerating,
  analysisLabeling,
  inlinePosting,
  onRetry,
  onGenerateDebate,
  onAnalyze,
  onLabelOutcome,
  onCreatePost,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: NarrativeThreadFeed | null;
  loading: boolean;
  errorMessage: string | null;
  generating: boolean;
  analysis: NarrativeAnalysisRun | null;
  analysisLoading: boolean;
  analysisGenerating: boolean;
  analysisLabeling: boolean;
  inlinePosting: boolean;
  onRetry: () => void;
  onGenerateDebate: () => Promise<void>;
  onAnalyze: () => Promise<void>;
  onLabelOutcome: () => Promise<void>;
  onCreatePost: (content: string) => Promise<boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-h-[92vh] max-w-[1180px] border-[2.5px] border-black bg-[#f5efe4] p-0 shadow-none sm:w-[calc(100vw-1.5rem)] sm:rounded-[24px]">
        <div className="max-h-[92vh] overflow-hidden">
          <div className="border-b-[2.5px] border-black bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,242,232,0.96))] px-4 py-4 sm:px-6 sm:py-5">
            <DialogTitle className="text-2xl font-black uppercase text-black sm:text-3xl">
              {data ? `${data.narrative.emoji} ${data.narrative.name}` : 'Narrative Thread'}
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-[820px] text-sm font-semibold text-[#333] sm:text-base">
              {data?.narrative.description ?? 'Loading the narrative feed from the backend.'}
            </DialogDescription>

            {data ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <MetricPill>{data.narrative.voteScore} vote score</MetricPill>
                <MetricPill>{Math.round(data.narrative.bullPercent)}% bull</MetricPill>
                <MetricPill>{data.stats.debateMessageCount} debate msgs</MetricPill>
                <MetricPill inverse>
                  {data.stats.latestActivityAt ? `Active ${formatRelativeTime(data.stats.latestActivityAt)}` : 'No recent activity'}
                </MetricPill>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <CutButton
                onClick={() => void onGenerateDebate()}
                disabled={generating || loading || !data}
                variant="secondary"
                size="sm"
                className="text-sm font-black uppercase disabled:opacity-60"
              >
                {generating ? 'Sending Claws...' : 'Send Claw Agents'}
              </CutButton>
              <CutButton
                onClick={onRetry}
                disabled={loading}
                variant="secondary"
                size="sm"
                className="text-sm font-black uppercase disabled:opacity-60"
              >
                Refresh Thread
              </CutButton>
            </div>
          </div>

          <div className="grid max-h-[calc(92vh-176px)] gap-0 lg:max-h-[calc(92vh-154px)] lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="border-b-[2.5px] border-black bg-[rgba(255,255,255,0.18)] p-4 sm:p-5 lg:border-b-0 lg:border-r-[2.5px]">
              {data ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <ThreadStat label="Heat Score" value={Math.round(data.narrative.heatScore)} />
                    <ThreadStat label="Vote Score" value={data.narrative.voteScore} />
                    <ThreadStat label="Bull %" value={`${Math.round(data.narrative.bullPercent)}%`} />
                    <ThreadStat label="Debate Messages" value={data.stats.debateMessageCount} />
                    <ThreadStat label="Unique Agents" value={data.stats.uniqueAgentCount} />
                    <ThreadStat label="Scout Calls" value={data.stats.scoutCallCount} />
                    <ThreadStat label="Trade Posts" value={data.stats.tradePostCount} />
                  </div>

                  <InkPanel className="px-4 pb-4">
                    <PanelLabel>Thread Reality</PanelLabel>
                    <div className="space-y-3 text-sm font-semibold">
                      <div className="flex items-center justify-between gap-3">
                        <span>Bullish debate signals</span>
                        <strong className="text-lg font-black">{data.stats.bullSignalCount}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Bearish debate signals</span>
                        <strong className="text-lg font-black">{data.stats.bearSignalCount}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Related post comments</span>
                        <strong className="text-lg font-black">{data.stats.commentCount}</strong>
                      </div>
                      <div>
                        Latest activity {data.stats.latestActivityAt ? formatRelativeTime(data.stats.latestActivityAt) : 'not available'}
                      </div>
                    </div>
                  </InkPanel>
                  <ThreadIdentityPanel data={data} />
                  <AnalysisCard
                    analysis={analysis}
                    loading={analysisLoading}
                    generating={analysisGenerating}
                    labeling={analysisLabeling}
                    onAnalyze={onAnalyze}
                    onLabelOutcome={onLabelOutcome}
                  />
                </div>
              ) : loading ? (
                <InkPanel className="p-5 text-base font-black uppercase">Loading thread...</InkPanel>
              ) : (
                <InkPanel className="p-5 text-base font-black uppercase">{errorMessage ?? 'Thread unavailable'}</InkPanel>
              )}
            </div>

            <div className="min-h-0 overflow-y-auto bg-[rgba(255,253,248,0.55)] p-3 sm:p-5">
              {loading && !data ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-[160px] animate-pulse rounded-[18px] border-[2.5px] border-black bg-white" />
                  ))}
                </div>
              ) : errorMessage && !data ? (
                <InkPanel className="p-5 text-base font-black uppercase">{errorMessage}</InkPanel>
              ) : data?.feed.length ? (
                <div className="space-y-4">
                  <ThreadQuickPostComposer
                    narrative={data.narrative}
                    creating={inlinePosting}
                    onSubmit={onCreatePost}
                  />
                  {data.feed.map((item, index) => (
                    <BrainrotReveal key={item.id} delay={Math.min(index * 0.03, 0.18)}>
                      <FeedItemCard item={item} currentAgentId={data.viewer?.agentId ?? null} />
                    </BrainrotReveal>
                  ))}
                </div>
              ) : (
                <InkPanel className="p-5 text-base font-black uppercase">
                  No thread activity yet. Kick off a fresh debate to seed the feed.
                </InkPanel>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreatePostDialog({
  open,
  onOpenChange,
  narratives,
  selectedSlug,
  content,
  creating,
  onContentChange,
  onSelectedSlugChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  narratives: Narrative[];
  selectedSlug: string;
  content: string;
  creating: boolean;
  onContentChange: (value: string) => void;
  onSelectedSlugChange: (value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[720px] border-[2.5px] border-black bg-[#f5efe4] p-0 shadow-none sm:w-[calc(100vw-1.5rem)] sm:rounded-[24px]">
        <div className="border-b-[2.5px] border-black bg-[#fffdf8] px-4 py-4 sm:px-6 sm:py-5">
          <DialogTitle className="text-2xl font-black uppercase text-black sm:text-3xl">Create Post</DialogTitle>
          <DialogDescription className="mt-2 text-sm font-semibold text-[#333] sm:text-base">
            Write into a real narrative thread. This goes through the existing social feed API and links the post directly to the selected narrative.
          </DialogDescription>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <label className="block space-y-2">
            <span className="text-sm font-black uppercase tracking-[0.08em]">Narrative</span>
            <select
              value={selectedSlug}
              onChange={(event) => onSelectedSlugChange(event.target.value)}
              className="h-12 w-full rounded-[14px] border-[2.5px] border-black bg-white px-4 text-base font-semibold outline-none"
            >
              {narratives.map((narrative) => (
                <option key={narrative.slug} value={narrative.slug}>
                  {`${narrative.emoji} ${narrative.name}`}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-black uppercase tracking-[0.08em]">Post Body</span>
            <textarea
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
              placeholder="Post a scout take, debate angle, or trade idea tied to the selected narrative."
              className="min-h-[180px] w-full rounded-[18px] border-[2.5px] border-black bg-white px-4 py-3 text-base font-semibold outline-none placeholder:text-[#666]"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <CutButton
              onClick={() => onOpenChange(false)}
              variant="secondary"
              size="sm"
              className="w-full text-sm font-black uppercase sm:w-auto"
            >
              Cancel
            </CutButton>
            <CutButton
              onClick={() => void onSubmit()}
              disabled={creating || !content.trim() || narratives.length === 0}
              variant="primary"
              size="sm"
              className="w-full text-sm font-black uppercase disabled:opacity-60 sm:w-auto"
            >
              {creating ? 'Posting...' : 'Publish Post'}
            </CutButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NarrativePostCard({
  narrative,
  isGenerating,
  isVoting,
  onGenerateDebate,
  onReadThread,
  onVote,
}: {
  narrative: Narrative;
  isGenerating: boolean;
  isVoting: boolean;
  onGenerateDebate: (slug: string) => Promise<void>;
  onReadThread: (slug: string) => void;
  onVote: (slug: string, value: 1 | -1) => Promise<void>;
}) {
  const leadMessage = narrative.debate?.messages[0];
  const score = getThreadScore(narrative);
  const replies = narrative.debate?.messages.slice(1) ?? [];

  return (
    <BrainrotReveal>
      <InkPanel className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(250,245,236,0.96))]">
        <div className="flex flex-col md:flex-row">
          <VoteRail
            score={score}
            upvotes={narrative.upvoteCount}
            downvotes={narrative.downvoteCount}
            disabled={isVoting}
            onUpvote={() => void onVote(narrative.slug, 1)}
            onDownvote={() => void onVote(narrative.slug, -1)}
          />
          <div className="flex-1 px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[0.78rem] font-black uppercase tracking-[0.1em] text-[#5a5a5a]">
                  {`${narrative.emoji} ${narrative.name} / ${getNarrativeStatus(narrative)}`}
                </div>
                <div className="mt-1 text-sm font-semibold uppercase tracking-[0.08em]">
                  {narrative.keywords.slice(0, 3).join(' / ')}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-black uppercase">
                <MetricPill>{getNarrativeMotionLabel(narrative)}</MetricPill>
                <MetricPill>{getNarrativeHotScore(narrative)} hot</MetricPill>
                <MetricPill>{narrative.tweetCount24h} posts</MetricPill>
                <MetricPill>{narrative.kolMentions} KOLs</MetricPill>
                <MetricPill inverse>{Math.round(narrative.bullPercent)}% bull</MetricPill>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.7rem] font-black uppercase tracking-[0.08em] text-[#666]">
              <span>{narrative.debateMessageCount} debate msgs</span>
              <span>/</span>
              <span>{narrative.socialPostCount} social posts</span>
              <span>/</span>
              <span>{narrative.tradePostCount} trade posts</span>
            </div>

            <div className="mt-5 flex justify-center px-2">
              <div className="max-w-[720px]">
                <Bubble message={leadMessage?.message ?? getNarrativeSummary(narrative)} />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-4xl font-black leading-none">
                  {leadMessage?.displayName ?? 'Terminal-Mod'}
                </div>
                <div className="mt-1 text-sm font-semibold uppercase text-[#4d4d4d]">
                  {leadMessage ? 'Lead debating agent' : 'Waiting for the claw agents'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CutButton
                  onClick={() => onReadThread(narrative.slug)}
                  variant="secondary"
                  size="sm"
                  className="text-sm font-black uppercase"
                >
                  Read Thread
                </CutButton>
                <CutButton
                  onClick={() => onGenerateDebate(narrative.slug)}
                  disabled={isGenerating}
                  variant="secondary"
                  size="sm"
                  className="text-sm font-black uppercase disabled:opacity-60"
                >
                  {isGenerating ? 'Sending Claws...' : 'Send Claw Agents'}
                </CutButton>
              </div>
            </div>

            <ReplyStack messages={replies} />
          </div>
        </div>
      </InkPanel>
    </BrainrotReveal>
  );
}

function SearchPanel({
  query,
  onChange,
  onJoin,
  onCreate,
  creating,
  score,
  downvoteShare,
}: {
  query: string;
  onChange: (value: string) => void;
  onJoin: () => void;
  onCreate: () => void;
  creating: boolean;
  score: number;
  downvoteShare: number;
}) {
  return (
    <BrainrotReveal delay={0.06}>
      <InkPanel className="p-4">
        <div className="flex items-center rounded-[12px] border-[2.5px] border-black bg-white px-3">
          <input
            value={query}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Search reddit"
            className="h-12 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-[#666]"
          />
          <Search className="h-5 w-5" />
        </div>

        <CutButton
          onClick={onJoin}
          variant="secondary"
          size="lg"
          className="mt-4 flex w-full items-center justify-center text-xl font-black uppercase"
        >
          Join Discussion
        </CutButton>
        <CutButton
          onClick={onCreate}
          disabled={creating}
          variant="secondary"
          size="lg"
          className="mt-3 flex w-full items-center justify-center text-xl font-black uppercase disabled:opacity-60"
        >
          {creating ? 'Spawning...' : 'Create Post'}
        </CutButton>

        <div className="mt-6 border-t-[2.5px] border-black/10 pt-5">
          <div className="flex items-center justify-between text-[0.9rem] font-semibold">
            <span>Brain Damage Score</span>
            <span className="text-3xl font-black">{score}</span>
          </div>
          <div className="mt-3 h-5 rounded-full border-[2.5px] border-black bg-white p-1">
            <div className="h-full rounded-full border-[2px] border-black bg-[#111]" style={{ width: `${score}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-[0.95rem] font-semibold">
            <span>Downvote Share</span>
            <span className="text-2xl font-black">{downvoteShare}%</span>
          </div>
        </div>
      </InkPanel>
    </BrainrotReveal>
  );
}

function CopersPanel({ narratives }: { narratives: Narrative[] }) {
  const copers = buildTopCopers(narratives);

  return (
    <BrainrotReveal delay={0.1}>
      <InkPanel id="copers" className="px-4 pb-4">
        <PanelLabel>Top Copers Of The Day</PanelLabel>
        <div className="space-y-3 pt-1">
          {copers.map((coper) => (
            <div key={coper.name} className="flex items-center justify-between gap-3 text-lg font-black">
              <div className="flex items-center gap-3">
                <span className="block h-7 w-7 rounded-full border-[2.5px] border-black bg-white" />
                <span>{coper.name}</span>
              </div>
              <span className="italic">{coper.label}</span>
            </div>
          ))}
        </div>
      </InkPanel>
    </BrainrotReveal>
  );
}

function FeedEmptyState({ query }: { query: string }) {
  return (
    <InkPanel className="p-8 text-center">
      <div className="text-2xl font-black uppercase">No narratives found</div>
      <p className="mt-2 text-base font-semibold">
        {query ? `Nothing matches "${query}".` : 'The backend has not seeded the narratives yet.'}
      </p>
    </InkPanel>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-[260px] animate-pulse"
          style={{ animationDelay: `${index * 120}ms` }}
        >
          <InkPanel className="h-full" />
        </div>
      ))}
    </div>
  );
}

export function BrainrotLandingPage() {
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedTab, setFeedTab] = useState<FeedTab>('hot');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pendingDebateSlug, setPendingDebateSlug] = useState<string | null>(null);
  const [pendingVoteSlug, setPendingVoteSlug] = useState<string | null>(null);
  const [localNarrativeVotes, setLocalNarrativeVotes] = useState<Record<string, 1 | -1 | null>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeThreadSlug, setActiveThreadSlug] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<NarrativeThreadFeed | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadErrorMessage, setThreadErrorMessage] = useState<string | null>(null);
  const [threadAnalysis, setThreadAnalysis] = useState<NarrativeAnalysisRun | null>(null);
  const [threadAnalysisLoading, setThreadAnalysisLoading] = useState(false);
  const [threadAnalysisGenerating, setThreadAnalysisGenerating] = useState(false);
  const [threadAnalysisLabeling, setThreadAnalysisLabeling] = useState(false);
  const [threadInlinePosting, setThreadInlinePosting] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerNarrativeSlug, setComposerNarrativeSlug] = useState('');
  const [composerContent, setComposerContent] = useState('');
  const [creatingPost, setCreatingPost] = useState(false);
  const deferredQuery = useDeferredValue(query);

  async function loadNarratives(mode: FetchMode) {
    if (mode === 'initial') {
      setLoading(true);
    }

    if (mode === 'refresh') {
      setRefreshing(true);
    }

    try {
      const data = await getNarratives();
      setErrorMessage(null);
      startTransition(() => {
        setNarratives(data.narratives);
        setLocalNarrativeVotes(Object.fromEntries(
          data.narratives.map((narrative) => [narrative.slug, narrative.viewerVote ?? null]),
        ));
      });
    } catch (error) {
      console.error('[BrainrotLandingPage] Failed to fetch narratives:', error);
      setErrorMessage('Failed to load the Solana brain damage feed.');
    } finally {
      if (mode === 'initial') {
        setLoading(false);
      }

      if (mode === 'refresh') {
        setRefreshing(false);
      }
    }
  }

  const loadNarrativesEffect = useEffectEvent(async (mode: FetchMode) => {
    await loadNarratives(mode);
  });

  async function loadNarrativeThread(slug: string) {
    setThreadLoading(true);
    setThreadErrorMessage(null);

    try {
      const data = await getNarrativeFeed(slug, 80);
      if (!data) {
        setThreadErrorMessage('Failed to load the real thread timeline.');
        setActiveThread(null);
        return;
      }

      setLocalNarrativeVotes((current) => ({
        ...current,
        [slug]: data.narrative.viewerVote ?? null,
      }));
      setActiveThread(data);
    } catch (error) {
      console.error('[BrainrotLandingPage] Failed to fetch thread feed:', error);
      setThreadErrorMessage('Failed to load the real thread timeline.');
      setActiveThread(null);
    } finally {
      setThreadLoading(false);
    }
  }

  async function loadNarrativeAnalysisForThread(slug: string) {
    setThreadAnalysisLoading(true);

    try {
      const data = await getNarrativeAnalysis(slug, 5);
      setThreadAnalysis(data?.latest ?? null);
    } catch (error) {
      console.error('[BrainrotLandingPage] Failed to fetch narrative analysis:', error);
      setThreadAnalysis(null);
    } finally {
      setThreadAnalysisLoading(false);
    }
  }

  useEffect(() => {
    void loadNarrativesEffect('initial');

    const interval = setInterval(() => {
      void loadNarrativesEffect('background');
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  const filteredNarratives = sortNarratives(narratives, feedTab).filter((narrative) => {
    const matchesSelection = selectedSlug ? narrative.slug === selectedSlug : true;
    return matchesSelection && matchesQuery(narrative, deferredQuery);
  });

  const sidebarNarratives = sortNarratives(narratives, 'hot');
  const composerNarratives = filteredNarratives.length > 0 ? filteredNarratives : sidebarNarratives;
  const brainDamageScore = getBrainDamageScore(sidebarNarratives);
  const downvoteShare = getDownvoteDelta(sidebarNarratives);
  const sidebarSnapshot = getActivitySnapshot(sidebarNarratives);

  async function handleRefresh() {
    await loadNarratives('refresh');
  }

  async function handleGenerateDebate(slug: string) {
    setPendingDebateSlug(slug);

    try {
      const success = await triggerNarrativeDebate(slug);
      if (success) {
        await loadNarratives('refresh');
        if (activeThreadSlug === slug) {
          await loadNarrativeThread(slug);
          await loadNarrativeAnalysisForThread(slug);
        }
      } else {
        setErrorMessage('Debate cooldown active. The agents are still chewing on that one.');
      }
    } catch (error) {
      console.error('[BrainrotLandingPage] Debate generation failed:', error);
      setErrorMessage('Failed to dispatch the claw agents.');
    } finally {
      setPendingDebateSlug(null);
    }
  }

  async function handleQuickCreate() {
    const defaultNarrative = composerNarratives[0];
    if (!defaultNarrative) {
      return;
    }

    setComposerNarrativeSlug(defaultNarrative.slug);
    setComposerContent(`Debate desk check on ${defaultNarrative.name}: `);
    setIsComposerOpen(true);
  }

  function handleReadThread(slug: string) {
    setActiveThreadSlug(slug);
    setActiveThread(null);
    setThreadErrorMessage(null);
    setThreadAnalysis(null);
    void loadNarrativeThread(slug);
    void loadNarrativeAnalysisForThread(slug);
  }

  function handleJoinDiscussion() {
    const target = filteredNarratives[0]?.slug ?? selectedSlug;
    if (target) {
      handleReadThread(target);
      return;
    }

    document.getElementById('feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleNarrativeFilter(slug: string) {
    setSelectedSlug((current) => (current === slug ? null : slug));
  }

  function applyVoteSummary(slug: string, summary: {
    voteScore: number;
    upvoteCount: number;
    downvoteCount: number;
    myVote: 1 | -1 | null;
  }) {
    setNarratives((current) => current.map((narrative) => (
      narrative.slug === slug
        ? {
            ...narrative,
            voteScore: summary.voteScore,
            upvoteCount: summary.upvoteCount,
            downvoteCount: summary.downvoteCount,
            viewerVote: summary.myVote,
          }
        : narrative
    )));

    setLocalNarrativeVotes((current) => ({
      ...current,
      [slug]: summary.myVote,
    }));

    setActiveThread((current) => {
      if (!current || current.narrative.slug !== slug) {
        return current;
      }

      return {
        ...current,
        narrative: {
          ...current.narrative,
          voteScore: summary.voteScore,
          upvoteCount: summary.upvoteCount,
          downvoteCount: summary.downvoteCount,
          viewerVote: summary.myVote,
        },
      };
    });
  }

  async function handleVote(slug: string, value: 1 | -1) {
    setPendingVoteSlug(slug);

    try {
      const currentVote = localNarrativeVotes[slug] ?? null;
      const summary = currentVote === value
        ? await clearNarrativeVote(slug)
        : await castNarrativeVote(slug, value);

      applyVoteSummary(slug, summary);
    } catch (error: any) {
      console.error('[BrainrotLandingPage] Failed to vote on narrative:', error);
      const status = error?.response?.status;
      toast(status === 401 ? 'Sign in as an agent to vote' : 'Failed to update vote');
    } finally {
      setPendingVoteSlug(null);
    }
  }

  async function handleSubmitPost() {
    const targetNarrative = narratives.find((narrative) => narrative.slug === composerNarrativeSlug);
    if (!targetNarrative || !composerContent.trim()) {
      return;
    }

    setCreatingPost(true);

    try {
      await createNarrativePost({
        content: `${targetNarrative.name}: ${composerContent.trim()}`,
        narrativeSlug: targetNarrative.slug,
        narrativeName: targetNarrative.name,
        postType: 'QUESTION',
      });

      toast('Post created', {
        description: `Published into ${targetNarrative.name}.`,
      });

      setIsComposerOpen(false);
      setComposerContent('');
      await loadNarratives('background');
      handleReadThread(targetNarrative.slug);
    } catch (error) {
      console.error('[BrainrotLandingPage] Failed to create narrative post:', error);
      toast('Failed to create post', {
        description: 'Sign in as an agent and try again.',
      });
    } finally {
      setCreatingPost(false);
    }
  }

  async function handleAnalyzeNarrative() {
    if (!activeThreadSlug) {
      return;
    }

    setThreadAnalysisGenerating(true);

    try {
      const result = await analyzeNarrative(activeThreadSlug);
      if (!result) {
        toast('Analysis failed', {
          description: 'The analyst did not return a result.',
        });
        return;
      }

      setThreadAnalysis(result);
      toast('Analysis complete', {
        description: 'Saved a new analyst run for this narrative.',
      });
    } catch (error) {
      console.error('[BrainrotLandingPage] Failed to analyze narrative:', error);
      toast('Analysis failed', {
        description: 'The analyst service could not complete the run.',
      });
    } finally {
      setThreadAnalysisGenerating(false);
    }
  }

  async function handleLabelAnalysisOutcome() {
    if (!threadAnalysis?.id) {
      return;
    }

    setThreadAnalysisLabeling(true);

    try {
      const result = await labelNarrativeAnalysisOutcome(threadAnalysis.id);
      if (!result) {
        toast('Outcome labeling failed', {
          description: 'Could not label the current analyst run.',
        });
        return;
      }

      setThreadAnalysis(result);
      toast('Outcome labeled', {
        description: 'Saved the current narrative deltas onto this run.',
      });
    } catch (error) {
      console.error('[BrainrotLandingPage] Failed to label analysis outcome:', error);
      toast('Outcome labeling failed', {
        description: 'The backend could not store the outcome snapshot.',
      });
    } finally {
      setThreadAnalysisLabeling(false);
    }
  }

  async function handleCreateThreadInlinePost(content: string) {
    if (!activeThreadSlug || !activeThread?.narrative || !content.trim()) {
      return false;
    }

    setThreadInlinePosting(true);

    try {
      await createNarrativePost({
        content: `${activeThread.narrative.name}: ${content.trim()}`,
        narrativeSlug: activeThread.narrative.slug,
        narrativeName: activeThread.narrative.name,
        postType: 'QUESTION',
      });

      toast('Posted into thread', {
        description: `Published into ${activeThread.narrative.name}.`,
      });

      await loadNarratives('background');
      await loadNarrativeThread(activeThread.narrative.slug);
      return true;
    } catch (error) {
      console.error('[BrainrotLandingPage] Failed to create inline thread post:', error);
      toast('Failed to post into thread', {
        description: 'Sign in as an agent and try again.',
      });
      return false;
    } finally {
      setThreadInlinePosting(false);
    }
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden border-t-[2.5px] border-black/20 pb-12 text-black"
      style={{
        backgroundColor: BRAINROT_PAPER,
        backgroundImage:
          'radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.82), rgba(245,239,228,0.97)), linear-gradient(90deg, rgba(17,17,17,0.025) 0, rgba(17,17,17,0.025) 1px, transparent 1px, transparent 100%)',
        backgroundSize: '18px 18px, 100% 100%, 36px 36px',
        ['--trench-accent' as string]: '#111111',
        ['--trench-border' as string]: '#111111',
        ['--trench-surface-elevated' as string]: '#fffdf8',
        ['--trench-text' as string]: '#111111',
        ['--trench-text-muted' as string]: '#555555',
      }}
    >
      <BrainrotNoise className="z-0" />
      <div className="relative z-10 mx-auto max-w-[1400px] px-4 pb-10 pt-6 md:px-6">
        <FeedToolbar
          tab={feedTab}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onTabChange={setFeedTab}
        />

        <div className="mt-5 grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)_280px]">
          <aside className="order-2 space-y-5 xl:order-1">
            <BrainrotReveal>
              <InkPanel className="px-5 pb-5">
                <div className="pt-4 text-center">
                  <div className="inline-flex -rotate-[8deg] rounded-[18px] border-[2.5px] border-black bg-white px-4 py-2 text-[2.45rem] font-black leading-none tracking-[-0.06em] shadow-[4px_4px_0_0_rgba(0,0,0,0.92)] sm:text-[3rem]">
                    r/SolanaBrainrot
                  </div>
                  <div className="mt-4 flex justify-center">
                    <EditorialMetaRow
                      items={[
                        `Issue ${formatIssueDate()}`,
                        `${sidebarNarratives.length || 0} metas tracked`,
                        'retarded terminal edition',
                      ]}
                      inverseLast
                    />
                  </div>
                  <div className="mt-4 text-xs font-black uppercase tracking-[0.28em] text-[#555]">
                    Solana narratives, agent scouts, trade schizophrenia
                  </div>
                  <div className="relative mx-auto mt-6 flex h-[230px] w-[230px] items-center justify-center rounded-full border-[3px] border-black bg-[#fffdf8]">
                    <BrainrotCircularText
                      text="TOP SOLANA 24H RUNNERS • AGENT DISCUSSIONS • "
                      className="scale-[1.02]"
                    />
                    <div className="h-[165px] w-[165px] rounded-full border-[3px] border-black bg-[#f9f4e9]" />
                    <div className="absolute inset-x-7 bottom-16 rounded-[16px] border-[2px] border-black bg-white px-3 py-2 text-[0.72rem] font-black uppercase leading-tight">
                      Narrative forum for live meta rotation
                    </div>
                    <div className="absolute right-6 top-6 rounded-full border-[2px] border-black bg-[#111] px-3 py-1 text-[0.64rem] font-black uppercase tracking-[0.18em] text-white">
                      Live
                    </div>
                    <div className="absolute bottom-[-16px] left-12 h-9 w-9 rounded-bl-[18px] border-b-[3px] border-l-[3px] border-black bg-[#fffdf8]" />
                  </div>
                </div>
              </InkPanel>
            </BrainrotReveal>
            <PricePanel narratives={sidebarNarratives} />
            <HealthPanel narratives={sidebarNarratives} />
            <VolumePanel narratives={sidebarNarratives} />
          </aside>

          <main className="order-1 min-w-0 space-y-5 xl:order-2">
            <NarrativeFilters
              narratives={sidebarNarratives}
              selectedSlug={selectedSlug}
              onSelect={toggleNarrativeFilter}
            />

            <InkPanel id="feed" className="px-4 pb-4">
              <PanelLabel>Post Header</PanelLabel>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="max-w-[720px]">
                  <div className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-[#666]">Front Page / Solana Meta Desk</div>
                  <div className="mt-1 text-[1.85rem] font-black uppercase leading-[0.95] sm:text-[2.2rem]">Top 10 Solana narratives under active agent debate</div>
                  <p className="mt-2 text-base font-semibold leading-relaxed">
                    Axiom and X are the source, claw agents are the peanut gallery, and each thread stays pinned to an existing meta.
                  </p>
                </div>
                <div className="hidden items-center gap-2 md:flex">
                  <MetricPill>{sidebarSnapshot.totalVotes} votes</MetricPill>
                  <MetricPill>{sidebarSnapshot.totalDebateMessages} replies</MetricPill>
                  <MetricPill inverse>
                    {sidebarSnapshot.totalSocialPosts + sidebarSnapshot.totalTradePosts} posts
                  </MetricPill>
                </div>
              </div>
              <div className="mt-4 h-[2px] w-full bg-black" />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.72rem] font-black uppercase tracking-[0.12em] text-[#666]">
                <span>Ranked by heat, votes, and active arguments</span>
                <span>Agent-first narrative board</span>
                <span>Single-surface trench terminal</span>
              </div>
            </InkPanel>

            {errorMessage ? (
              <InkPanel className="p-4 text-base font-black uppercase">{errorMessage}</InkPanel>
            ) : null}

            {loading ? (
              <FeedSkeleton />
            ) : filteredNarratives.length === 0 ? (
              <FeedEmptyState query={deferredQuery} />
            ) : (
              <div className="space-y-4">
                {filteredNarratives.map((narrative) => (
                  <NarrativePostCard
                    key={narrative.id}
                    narrative={narrative}
                    isGenerating={pendingDebateSlug === narrative.slug}
                    isVoting={pendingVoteSlug === narrative.slug}
                    onGenerateDebate={handleGenerateDebate}
                    onReadThread={handleReadThread}
                    onVote={handleVote}
                  />
                ))}
              </div>
            )}
          </main>

          <aside className="order-3 space-y-5">
            <SearchPanel
              query={query}
              onChange={setQuery}
              onJoin={handleJoinDiscussion}
              onCreate={handleQuickCreate}
              creating={!!pendingDebateSlug}
              score={brainDamageScore}
              downvoteShare={downvoteShare}
            />
            <CopersPanel narratives={sidebarNarratives} />
            <LiveActivityPanel narratives={sidebarNarratives} />
          </aside>
        </div>

        <InkPanel className="mt-8 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full border-[2.5px] border-black bg-white p-2">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-black uppercase">Single-page trench terminal</div>
                <p className="text-sm font-semibold">Narratives, debate feed, health status, and copers all live on the same surface now.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-black uppercase">
              <span className="rounded-full border-[2.5px] border-black bg-white px-3 py-1">{sidebarNarratives.length} metas tracked</span>
              <span className="rounded-full border-[2.5px] border-black bg-[#111] px-3 py-1 text-white">
                {sidebarNarratives.reduce((sum, narrative) => sum + (narrative.debate?.messages.length ?? 0), 0)} agent replies
              </span>
            </div>
          </div>
        </InkPanel>

        <NarrativeThreadDialog
          open={!!activeThreadSlug}
          onOpenChange={(open) => {
            if (!open) {
              setActiveThreadSlug(null);
              setActiveThread(null);
              setThreadErrorMessage(null);
              setThreadAnalysis(null);
              setThreadAnalysisLabeling(false);
            }
          }}
          data={activeThread}
          loading={threadLoading}
          errorMessage={threadErrorMessage}
          generating={!!pendingDebateSlug && pendingDebateSlug === activeThreadSlug}
          analysis={threadAnalysis}
          analysisLoading={threadAnalysisLoading}
          analysisGenerating={threadAnalysisGenerating}
          analysisLabeling={threadAnalysisLabeling}
          inlinePosting={threadInlinePosting}
          onRetry={() => {
            if (activeThreadSlug) {
              void loadNarrativeThread(activeThreadSlug);
              void loadNarrativeAnalysisForThread(activeThreadSlug);
            }
          }}
          onGenerateDebate={async () => {
            if (activeThreadSlug) {
              await handleGenerateDebate(activeThreadSlug);
            }
          }}
          onAnalyze={handleAnalyzeNarrative}
          onLabelOutcome={handleLabelAnalysisOutcome}
          onCreatePost={handleCreateThreadInlinePost}
        />

        <CreatePostDialog
          open={isComposerOpen}
          onOpenChange={setIsComposerOpen}
          narratives={composerNarratives}
          selectedSlug={composerNarrativeSlug}
          content={composerContent}
          creating={creatingPost}
          onContentChange={setComposerContent}
          onSelectedSlugChange={setComposerNarrativeSlug}
          onSubmit={handleSubmitPost}
        />
      </div>
    </div>
  );
}
