'use client';

import { useEffect, useState, useCallback } from 'react';
import { ExternalLink, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getNewsFeed } from '@/lib/api';
import { NewsItem } from '@/lib/types';
import NewsModal from './NewsModal';

const FALLBACK_IMAGE = '/bg.png';

export default function NewsPanel() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);

  // Fetch news feed
  const fetchNews = useCallback(async () => {
    try {
      const items = await getNewsFeed(3);
      setNewsItems(items);
    } catch (error) {
      console.error('Failed to load news:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // Auto-rotate every 5 seconds (unless paused)
  useEffect(() => {
    if (newsItems.length === 0 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % newsItems.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [newsItems.length, isPaused]);

  const handleCTAClick = (item: NewsItem) => {
    if (item.ctaType === 'MODAL') {
      setSelectedNewsId(item.id);
    } else if (item.ctaType === 'EXTERNAL_LINK' && item.ctaUrl) {
      window.open(item.ctaUrl, '_blank', 'noopener,noreferrer');
    } else if (item.ctaType === 'INTERNAL_LINK' && item.ctaUrl) {
      window.location.href = item.ctaUrl;
    }
  };

  if (loading) {
    return (
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] h-52 max-w-md animate-pulse" />
    );
  }

  if (newsItems.length === 0) {
    return null;
  }

  const currentItem = newsItems[currentIndex];
  // Use fallback for missing or placeholder test URLs (dark-on-dark, invisible)
  const isPlaceholder = !currentItem.imageUrl || currentItem.imageUrl.includes('placeholder');
  const bgImage = isPlaceholder ? FALLBACK_IMAGE : currentItem.imageUrl;

  return (
    <>
      <div
        className="relative overflow-hidden border border-white/[0.15] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_32px_rgba(0,0,0,0.4)] cursor-pointer transition-all duration-300 hover:border-accent-primary/40 hover:shadow-[inset_0_1px_0_rgba(59,130,246,0.1),0_8px_32px_rgba(59,130,246,0.2)] h-52 max-w-md"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onClick={() => handleCTAClick(currentItem)}
      >
        {/* Background Image with smooth transition */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        </AnimatePresence>

        {/* Gradient overlay — keeps text readable without killing the image */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

        {/* Content + Vertical Dots */}
        <div className="relative z-10 h-full flex">
          {/* Main content */}
          <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 min-w-0">
            {/* Category badge - absolute top-left */}
            <AnimatePresence mode="wait">
              <motion.span
                key={`${currentItem.id}-category`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="absolute top-4 left-4 text-xs font-mono uppercase tracking-wider text-accent-primary bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded border border-accent-primary/20"
              >
                {currentItem.category}
              </motion.span>
            </AnimatePresence>

            {/* Title + Description - centered vertically with dots */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentItem.id}-content`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="mt-8"
              >
                <h3 className="text-sm font-bold text-white drop-shadow-lg line-clamp-1">
                  {currentItem.title}
                </h3>
                {currentItem.description && (
                  <p className="text-xs text-white/70 leading-tight line-clamp-3 drop-shadow mt-1">
                    {currentItem.description}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Bottom: CTA */}
            <AnimatePresence mode="wait">
              <motion.button
                key={`${currentItem.id}-cta`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCTAClick(currentItem);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/90 text-black text-xs font-semibold rounded transition-all shadow-lg hover:shadow-accent-primary/50 w-fit"
              >
                {currentItem.ctaText}
                {currentItem.ctaType === 'EXTERNAL_LINK' ? (
                  <ExternalLink className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </motion.button>
            </AnimatePresence>
          </div>

          {/* Right: Vertical pagination dots with smooth animations */}
          {newsItems.length > 1 && (
            <div className="flex flex-col items-center justify-center gap-1.5 px-3">
              {newsItems.map((_, index) => (
                <motion.button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(index);
                  }}
                  animate={{
                    height: index === currentIndex ? 24 : 6,
                    backgroundColor: index === currentIndex ? 'rgb(59, 130, 246)' : 'rgba(255, 255, 255, 0.3)',
                    scale: index === currentIndex ? 1.1 : 1,
                  }}
                  whileHover={{
                    backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    scale: 1.2
                  }}
                  transition={{
                    duration: 0.3,
                    ease: 'easeInOut'
                  }}
                  className="w-1.5 rounded-full shadow-lg"
                  style={{
                    boxShadow: index === currentIndex ? '0 0 10px rgba(59, 130, 246, 0.6)' : 'none'
                  }}
                  aria-label={`Go to news item ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedNewsId && (
        <NewsModal
          newsId={selectedNewsId}
          onClose={() => setSelectedNewsId(null)}
        />
      )}
    </>
  );
}
