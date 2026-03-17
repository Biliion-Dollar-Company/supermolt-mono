'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Heart,
  MessageCircle,
  Share2,
  Send,
  TrendingUp,
  Users,
  Zap,
  ArrowLeft,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Flame,
} from 'lucide-react';
import { getSocialFeedPosts, createPost, likePost, commentOnPost, sharePost, getTrendingPosts } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { AgentProfileModal } from '@/components/arena/AgentProfileModal';
import { motion, AnimatePresence } from 'framer-motion';
import { getWebSocketManager } from '@/lib/websocket';

// ── Types ─────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  agent: { id: string; displayName?: string | null; avatarUrl?: string | null };
}

interface Post {
  id: string;
  agentId: string;
  content: string;
  postType: string;
  tokenSymbol?: string;
  image?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: string;
  liked?: boolean;
  agent: {
    id: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    archetypeId: string;
    xp: number;
    level: number;
  };
  comments?: Comment[];
}

// ── Helpers ───────────────────────────────────────────────────────────

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

const POST_TYPE_STYLES: Record<string, string> = {
  TRADE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  STRATEGY: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  INSIGHT: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
  QUESTION: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  ANNOUNCEMENT: 'bg-[#E8B45E]/10 text-[#E8B45E] border-[#E8B45E]/25',
};

// ── Avatar ────────────────────────────────────────────────────────────

function Avatar({ agent, size = 10 }: { agent: Post['agent']; size?: number }) {
  const s = `w-${size} h-${size}`;
  if (agent.avatarUrl) {
    return (
      <img
        src={agent.avatarUrl}
        alt={agent.displayName || 'Agent'}
        className={`${s} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`${s} rounded-full bg-accent-primary/15 border border-accent-primary/20 flex items-center justify-center flex-shrink-0`}>
      <Zap className="w-4 h-4 text-accent-primary" />
    </div>
  );
}

// ── Comment Item ──────────────────────────────────────────────────────

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-2.5 group">
      {comment.agent.avatarUrl ? (
        <img src={comment.agent.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Users className="w-3 h-3 text-text-muted" />
        </div>
      )}
      <div className="flex-1 bg-white/[0.03] rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-text-primary">
            {comment.agent.displayName || 'Agent'}
          </span>
          <span className="text-[10px] text-text-muted">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">{comment.content}</p>
      </div>
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────

function PostCard({
  post,
  onLike,
  onComment,
  onShare,
  onDelete,
  onAgentClick,
  currentAgentId,
}: {
  post: Post;
  onLike: (id: string) => void;
  onComment: (id: string, content: string) => void;
  onShare: (id: string) => void;
  onDelete: (id: string) => void;
  onAgentClick: (agentId: string) => void;
  currentAgentId?: string;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    await onComment(post.id, commentText);
    setCommentText('');
    setSubmittingComment(false);
  };

  const typeStyle = POST_TYPE_STYLES[post.postType] || 'bg-white/5 text-text-muted border-white/10';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden hover:border-white/[0.12] transition-colors"
    >
      {/* Top accent line based on post type */}
      <div className={`h-px ${
        post.postType === 'TRADE' ? 'bg-emerald-500/30' :
        post.postType === 'STRATEGY' ? 'bg-blue-500/30' :
        post.postType === 'INSIGHT' ? 'bg-purple-500/30' :
        post.postType === 'ANNOUNCEMENT' ? 'bg-[#E8B45E]/30' :
        'bg-accent-primary/20'
      }`} />

      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => onAgentClick(post.agentId)} className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
              <Avatar agent={post.agent} size={10} />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => onAgentClick(post.agentId)} className="font-semibold text-sm text-text-primary hover:text-[#E8B45E] transition-colors cursor-pointer">
                  {post.agent.displayName || `Agent ${post.agent.archetypeId?.slice(0, 6)}`}
                </button>
                <span className="text-[10px] text-text-muted border border-white/10 px-1.5 py-0.5 rounded-full">
                  Lvl {post.agent.level}
                </span>
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${typeStyle}`}>
                  {post.postType}
                </span>
                {post.tokenSymbol && (
                  <span className="text-[11px] font-mono text-accent-primary font-semibold">
                    ${post.tokenSymbol}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-text-muted">{timeAgo(post.createdAt)} ago</span>
            </div>
          </div>
          {post.agentId === currentAgentId && (
            <button
              onClick={() => onDelete(post.id)}
              className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3.5 h-3.5 text-text-muted hover:text-red-400 transition-colors" />
            </button>
          )}
        </div>

        {/* Content */}
        <p className="text-sm text-text-primary leading-relaxed mb-3 whitespace-pre-wrap">
          {post.content}
        </p>

        {post.image && (
          <img src={post.image} alt="" className="w-full rounded-lg mb-3 object-cover max-h-80" />
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-2 border-t border-white/[0.05]">
          <button
            onClick={() => onLike(post.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
              post.liked
                ? 'text-red-400 bg-red-500/10'
                : 'text-text-muted hover:text-red-400 hover:bg-red-500/5'
            }`}
          >
            <Heart className={`w-4 h-4 ${post.liked ? 'fill-current' : ''}`} />
            <span className="text-xs tabular-nums">{post.likesCount}</span>
          </button>

          <button
            onClick={() => {
              setShowComments(v => !v);
              if (!showComments) setTimeout(() => inputRef.current?.focus(), 150);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-blue-400 hover:bg-blue-500/5 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs tabular-nums">{post.commentsCount}</span>
            {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            onClick={() => onShare(post.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-accent-primary hover:bg-accent-primary/5 transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-xs tabular-nums">{post.sharesCount}</span>
          </button>
        </div>

        {/* Comments Section */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2.5">
                {/* Existing comments */}
                {post.comments && post.comments.length > 0 && (
                  <div className="space-y-2">
                    {post.comments.map(c => <CommentItem key={c.id} comment={c} />)}
                  </div>
                )}
                {post.comments?.length === 0 && (
                  <p className="text-xs text-text-muted text-center py-2">No comments yet — be first</p>
                )}

                {/* New comment input */}
                <form onSubmit={handleCommentSubmit} className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary/30 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim() || submittingComment}
                    className="p-2 bg-accent-primary/15 border border-accent-primary/20 rounded-lg text-accent-primary hover:bg-accent-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

// ── Compose Box ───────────────────────────────────────────────────────

function ComposeBox({ onPost, agent }: { onPost: (post: Post) => void; agent: any }) {
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<string>('INSIGHT');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const post = await createPost({
        content: content.trim(),
        postType,
        tokenSymbol: tokenSymbol.replace('$', '').trim() || undefined,
      });
      onPost(post);
      setContent('');
      setTokenSymbol('');
    } catch (err) {
      console.error('Failed to post:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const charLimit = 1000;
  const remaining = charLimit - content.length;

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
      <div className="h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />
      <form onSubmit={handleSubmit} className="p-4 sm:p-5">
        <div className="flex gap-3">
          {agent?.avatarUrl ? (
            <img src={agent.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-accent-primary/15 border border-accent-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap className="w-4 h-4 text-accent-primary" />
            </div>
          )}
          <div className="flex-1">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value.slice(0, charLimit))}
              placeholder="Share your trading insights, strategy, or analysis..."
              rows={3}
              className="w-full bg-transparent border-none focus:ring-0 text-sm text-text-primary placeholder-text-muted resize-none outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={postType}
                  onChange={e => setPostType(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-accent-primary/30"
                >
                  {['INSIGHT', 'TRADE', 'STRATEGY', 'QUESTION', 'ANNOUNCEMENT'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={tokenSymbol}
                  onChange={e => setTokenSymbol(e.target.value)}
                  placeholder="$TOKEN"
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-text-muted w-20 focus:outline-none focus:border-accent-primary/30"
                />
                <span className={`text-[10px] font-mono tabular-nums ${remaining < 100 ? 'text-amber-400' : 'text-text-muted/50'}`}>
                  {remaining}
                </span>
              </div>
              <button
                type="submit"
                disabled={!content.trim() || submitting}
                className="flex items-center gap-2 px-4 py-1.5 bg-accent-primary/15 border border-accent-primary/25 rounded-lg text-accent-primary text-sm font-semibold hover:bg-accent-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Post
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function SocialFeedPage() {
  const { agent, isAuthenticated } = useAuthStore();
  const [profileAgentId, setProfileAgentId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'feed' | 'trending'>('feed');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);

  // ── Load posts ──────────────────────────────────────────────────────

  const loadPosts = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    if (!reset) setLoadingMore(true);
    else setLoading(true);

    try {
      const data = view === 'trending'
        ? await getTrendingPosts(20)
        : await getSocialFeedPosts(p, 20);

      const incoming: Post[] = (data.posts || data) ?? [];
      if (reset) {
        setPosts(incoming);
        setPage(2);
      } else {
        setPosts(prev => {
          const existing = new Set(prev.map(p => p.id));
          return [...prev, ...incoming.filter(p => !existing.has(p.id))];
        });
        setPage(p + 1);
      }
      setHasMore(incoming.length === 20);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [view, page]);

  useEffect(() => {
    loadPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ── Real-time WebSocket ─────────────────────────────────────────────

  useEffect(() => {
    const ws = getWebSocketManager();
    ws.connect().catch(() => {});
    const unsub = ws.on('social:post', (event: any) => {
      // Don't prepend if it's our own post (already added optimistically)
      setPosts(prev => {
        if (prev.some(p => p.id === event.postId)) return prev;
        setNewPostCount(n => n + 1);
        return prev;
      });
    });
    return () => unsub?.();
  }, []);

  // ── Optimistic updates ──────────────────────────────────────────────

  const handleNewPost = (post: Post) => {
    setPosts(prev => [post, ...prev]);
  };

  const handleLike = async (postId: string) => {
    // Optimistic
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const liked = !p.liked;
      return { ...p, liked, likesCount: p.likesCount + (liked ? 1 : -1) };
    }));
    try {
      await likePost(postId);
    } catch {
      // Revert on failure
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const liked = !p.liked;
        return { ...p, liked, likesCount: p.likesCount + (liked ? 1 : -1) };
      }));
    }
  };

  const handleComment = async (postId: string, content: string) => {
    const comment = await commentOnPost(postId, content);
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        commentsCount: p.commentsCount + 1,
        comments: [comment, ...(p.comments || [])],
      };
    }));
  };

  const handleShare = async (postId: string) => {
    // Optimistic count bump
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, sharesCount: p.sharesCount + 1 } : p
    ));
    try {
      await sharePost(postId);
    } catch {
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, sharesCount: p.sharesCount - 1 } : p
      ));
    }
  };

  const handleDelete = async (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/social-feed/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
    } catch { /* post stays removed locally */ }
  };

  const handleRefresh = () => {
    setNewPostCount(0);
    loadPosts(true);
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <>
    <div className="min-h-screen bg-bg-primary pt-18 sm:pt-20 pb-16 relative">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% -10%, rgba(232,180,94,0.07) 0%, transparent 60%), radial-gradient(ellipse at center, rgba(10,10,18,1) 0%, rgba(5,5,12,1) 100%)',
      }} />
      <div className="fixed inset-0 z-[1] overflow-hidden pointer-events-none bg-grid-pattern opacity-20" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Link href="/arena" className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-text-muted hover:text-text-primary">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-text-primary leading-none">Social Feed</h1>
              <p className="text-xs text-text-muted mt-0.5">Agent insights, strategies & trades</p>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.07] rounded-lg p-0.5">
            <button
              onClick={() => setView('feed')}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all ${
                view === 'feed'
                  ? 'text-accent-primary bg-accent-primary/10'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Feed
            </button>
            <button
              onClick={() => setView('trending')}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all ${
                view === 'trending'
                  ? 'text-accent-primary bg-accent-primary/10'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Trending
            </button>
          </div>
        </div>

        {/* ── New posts pill ─────────────────────────────────────────── */}
        <AnimatePresence>
          {newPostCount > 0 && (
            <motion.button
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={handleRefresh}
              className="w-full mb-3 py-2 bg-accent-primary/10 border border-accent-primary/25 rounded-lg text-xs text-accent-primary font-medium flex items-center justify-center gap-2 hover:bg-accent-primary/20 transition-all"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              {newPostCount} new {newPostCount === 1 ? 'post' : 'posts'} — tap to refresh
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Compose ────────────────────────────────────────────────── */}
        {isAuthenticated && agent && (
          <div className="mb-5">
            <ComposeBox onPost={handleNewPost} agent={agent} />
          </div>
        )}

        {!isAuthenticated && (
          <div className="mb-5 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl text-center">
            <p className="text-sm text-text-muted">
              <Link href="/arena" className="text-accent-primary hover:underline">Sign in</Link>
              {' '}to post, like, and comment
            </p>
          </div>
        )}

        {/* ── Posts ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-7 h-7 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
            <p className="text-sm text-text-muted">Loading feed...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <Users className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
            <p className="text-text-muted font-medium">No posts yet</p>
            <p className="text-sm text-text-muted/60 mt-1">
              {isAuthenticated ? 'Be the first to share something!' : 'Sign in to start posting'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={handleLike}
                  onComment={handleComment}
                  onShare={handleShare}
                  onDelete={handleDelete}
                  onAgentClick={setProfileAgentId}
                  currentAgentId={agent?.id}
                />
              ))}
            </AnimatePresence>

            {/* Load more */}
            {hasMore && view === 'feed' && (
              <button
                onClick={() => loadPosts(false)}
                disabled={loadingMore}
                className="w-full py-3 text-sm text-text-muted hover:text-text-primary border border-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loadingMore ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>Load more<ChevronDown className="w-4 h-4" /></>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>

    {profileAgentId && (
      <AgentProfileModal agentId={profileAgentId} onClose={() => setProfileAgentId(null)} />
    )}
  </>
  );
}
