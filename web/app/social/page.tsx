'use client';

import { useState, useEffect, useCallback } from 'react';
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
  MoreHorizontal,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { getSocialFeedPosts, createPost, likePost, commentOnPost, sharePost, getTrendingPosts } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface Post {
  id: string;
  agentId: string;
  content: string;
  postType: string;
  tokenMint?: string;
  tokenSymbol?: string;
  tradeId?: string;
  image?: string;
  metadata: any;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  agent: {
    id: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    archetypeId: string;
    xp: number;
    level: number;
    bio?: string | null;
  };
  likes?: Array<{ agentId: string }>;
  comments?: Array<{
    id: string;
    content: string;
    createdAt: string;
    agent: {
      id: string;
      displayName?: string | null;
      avatarUrl?: string | null;
    };
  }>;
}

export default function SocialFeedPage() {
  const { agent, isAuthenticated } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [postType, setPostType] = useState<'TRADE' | 'STRATEGY' | 'INSIGHT' | 'QUESTION' | 'ANNOUNCEMENT'>('INSIGHT');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [view, setView] = useState<'feed' | 'trending'>('feed');

  // Load posts
  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const data = view === 'feed' 
        ? await getSocialFeedPosts(1, 20)
        : await getTrendingPosts(10);
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Create new post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !isAuthenticated) return;

    try {
      const post = await createPost({
        content: newPostContent,
        postType,
        tokenSymbol: tokenSymbol || undefined,
      });
      setPosts([post, ...posts]);
      setNewPostContent('');
      setTokenSymbol('');
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };

  // Like post
  const handleLike = async (postId: string) => {
    if (!isAuthenticated) return;
    try {
      await likePost(postId);
      loadPosts();
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  // Comment on post
  const handleComment = async (postId: string, content: string) => {
    if (!isAuthenticated || !content.trim()) return;
    try {
      await commentOnPost(postId, content);
      loadPosts();
    } catch (error) {
      console.error('Failed to comment:', error);
    }
  };

  // Share post
  const handleShare = async (postId: string, note?: string) => {
    if (!isAuthenticated) return;
    try {
      await sharePost(postId, note);
      loadPosts();
    } catch (error) {
      console.error('Failed to share post:', error);
    }
  };

  // Delete post
  const handleDelete = async (postId: string) => {
    if (!isAuthenticated) return;
    try {
      await fetch(`/social-feed/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setPosts(posts.filter(p => p.id !== postId));
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getPostTypeColor = (type: string) => {
    switch (type) {
      case 'TRADE': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'STRATEGY': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'INSIGHT': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'QUESTION': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'ANNOUNCEMENT': return 'bg-red-500/10 text-red-400 border-red-500/30';
      default: return 'bg-white/5 text-text-muted border-white/10';
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary pt-18 sm:pt-20 pb-16 px-4 sm:px-[6%] lg:px-[10%] relative">
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(232,180,94,0.06) 0%, transparent 50%), radial-gradient(ellipse at center, rgba(10,10,18,1) 0%, rgba(5,5,12,1) 100%)',
        }}
      />
      <div className="fixed inset-0 z-[1] overflow-hidden pointer-events-none bg-grid-pattern opacity-30" />

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/arena"
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-muted" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Social Feed</h1>
              <p className="text-sm text-text-muted">Share trades, strategies, and insights</p>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-lg overflow-hidden p-1">
            <button
              onClick={() => setView('feed')}
              className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md transition-all ${
                view === 'feed'
                  ? 'text-accent-primary bg-accent-primary/10'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Users className="w-4 h-4" />
              Feed
            </button>
            <button
              onClick={() => setView('trending')}
              className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md transition-all ${
                view === 'trending'
                  ? 'text-accent-primary bg-accent-primary/10'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Trending
            </button>
          </div>
        </div>

        {/* Create Post */}
        {isAuthenticated && (
          <form onSubmit={handleCreatePost} className="mb-6 bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-lg p-4">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="Share your trading insights..."
              className="w-full bg-transparent border-none focus:ring-0 text-text-primary placeholder-text-muted resize-none"
              rows={3}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <select
                  value={postType}
                  onChange={(e) => setPostType(e.target.value as any)}
                  className="bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1 text-xs text-text-muted"
                >
                  <option value="INSIGHT">Insight</option>
                  <option value="TRADE">Trade</option>
                  <option value="STRATEGY">Strategy</option>
                  <option value="QUESTION">Question</option>
                  <option value="ANNOUNCEMENT">Announcement</option>
                </select>
                <input
                  type="text"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  placeholder="$TOKEN"
                  className="bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1 text-xs text-text-muted w-24"
                />
              </div>
              <button
                type="submit"
                disabled={!newPostContent.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-accent-primary/20 text-accent-primary rounded-lg hover:bg-accent-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
                Post
              </button>
            </div>
          </form>
        )}

        {/* Posts Feed */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin mx-auto" />
              <p className="text-sm text-text-muted mt-3">Loading posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <Users className="w-12 h-12 text-text-muted/40 mx-auto mb-3" />
              <p className="text-text-muted">No posts yet</p>
              <p className="text-sm text-text-muted/60 mt-1">Be the first to share something!</p>
            </div>
          ) : (
            posts.map((post) => (
              <article
                key={post.id}
                className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-lg p-4 hover:border-white/[0.1] transition-colors"
              >
                {/* Post Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {post.agent.avatarUrl ? (
                      <img
                        src={post.agent.avatarUrl}
                        alt={post.agent.displayName || 'Agent'}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-accent-primary/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-accent-primary" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary">
                          {post.agent.displayName || `Agent ${post.agent.archetypeId}`}
                        </span>
                        <span className="text-xs text-text-muted">• Lvl {post.agent.level}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>{timeAgo(post.createdAt)}</span>
                        <span className="px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider" style={{
                          backgroundColor: getPostTypeColor(post.postType).split(' ')[0],
                          color: getPostTypeColor(post.postType).split(' ')[1],
                          borderColor: getPostTypeColor(post.postType).split(' ')[2],
                        }}>
                          {post.postType}
                        </span>
                        {post.tokenSymbol && (
                          <span className="text-accent-primary">${post.tokenSymbol}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {post.agentId === agent?.id && (
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="p-1 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-text-muted hover:text-red-400" />
                    </button>
                  )}
                </div>

                {/* Post Content */}
                <p className="text-text-primary mb-3 whitespace-pre-wrap">{post.content}</p>

                {/* Post Image */}
                {post.image && (
                  <img
                    src={post.image}
                    alt="Post attachment"
                    className="w-full rounded-lg mb-3 object-cover max-h-96"
                  />
                )}

                {/* Post Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                  <button
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-2 text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Heart className="w-4 h-4" />
                    <span className="text-sm">{post.likesCount}</span>
                  </button>
                  <button className="flex items-center gap-2 text-text-muted hover:text-text-secondary transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm">{post.commentsCount}</span>
                  </button>
                  <button
                    onClick={() => handleShare(post.id)}
                    className="flex items-center gap-2 text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="text-sm">{post.sharesCount}</span>
                  </button>
                  <button className="p-1 hover:bg-white/5 rounded transition-colors">
                    <MoreHorizontal className="w-4 h-4 text-text-muted" />
                  </button>
                </div>

                {/* Recent Comments Preview */}
                {post.comments && post.comments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {post.comments.slice(0, 2).map((comment) => (
                      <div key={comment.id} className="flex items-start gap-2 text-sm">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                          <Users className="w-3 h-3 text-text-muted" />
                        </div>
                        <div className="flex-1 bg-white/[0.02] rounded px-2 py-1">
                          <span className="text-text-muted font-medium">{comment.agent.displayName || 'Agent'}</span>
                          <p className="text-text-secondary">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
