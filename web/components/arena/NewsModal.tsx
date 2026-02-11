'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, Sparkles } from 'lucide-react';
import { getNewsItem } from '@/lib/api';
import { NewsItem } from '@/lib/types';
import ReactMarkdown from 'react-markdown';

interface NewsModalProps {
  newsId: string;
  onClose: () => void;
}

export default function NewsModal({ newsId, onClose }: NewsModalProps) {
  const [newsItem, setNewsItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNewsItem = async () => {
      try {
        const item = await getNewsItem(newsId);
        setNewsItem(item);
      } catch (error) {
        console.error('Failed to load news item:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNewsItem();
  }, [newsId]);

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-[#12121a] border border-white/[0.08] p-8 rounded-lg w-full max-w-3xl animate-pulse">
          <div className="h-8 bg-white/[0.05] rounded mb-4" />
          <div className="h-64 bg-white/[0.05] rounded" />
        </div>
      </div>
    );
  }

  if (!newsItem) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#12121a] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] rounded-lg w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Background Image */}
        <div className="relative h-48 overflow-hidden flex-shrink-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${newsItem.imageUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-[#12121a]" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-accent-primary" />
              <span className="text-xs font-mono uppercase tracking-wider text-accent-primary">
                {newsItem.category}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
              {newsItem.title}
            </h2>
          </div>
        </div>

        {/* Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {/* Description */}
          <p className="text-base text-text-secondary mb-6 leading-relaxed">
            {newsItem.description}
          </p>

          {/* Markdown Content */}
          {newsItem.content && (
            <div className="prose prose-invert prose-sm sm:prose-base max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-4 mt-8 first:mt-0">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-3 mt-6">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg sm:text-xl font-semibold text-text-primary mb-2 mt-4">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-text-secondary mb-4 leading-relaxed">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside text-text-secondary mb-4 space-y-2">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside text-text-secondary mb-4 space-y-2">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="ml-4">{children}</li>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-primary hover:text-accent-primary/80 underline inline-flex items-center gap-1"
                    >
                      {children}
                      <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  ),
                  code: ({ children }) => (
                    <code className="bg-white/[0.05] px-1.5 py-0.5 rounded text-accent-primary font-mono text-sm">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-white/[0.05] p-4 rounded-lg overflow-x-auto mb-4 text-sm">
                      {children}
                    </pre>
                  ),
                }}
              >
                {newsItem.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-white/[0.08] p-4 sm:p-6 bg-[#0a0a0f]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">
              Published {new Date(newsItem.publishedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-text-primary rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
