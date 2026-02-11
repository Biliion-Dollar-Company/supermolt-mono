/**
 * News Service
 *
 * Handles platform announcements, updates, partnerships, and milestones.
 * Powers the news carousel on the Arena page.
 */

import { db } from '../../lib/db';
import type { NewsItem } from '@prisma/client';

export interface NewsItemResponse {
  id: string;
  title: string;
  description: string;
  content: string | null;
  imageUrl: string;
  ctaText: string;
  ctaType: string;
  ctaUrl: string | null;
  category: string;
  priority: number;
  publishedAt: string;
}

/**
 * Get all published news items, sorted by priority then date
 */
export async function getNewsFeed(limit: number = 10): Promise<NewsItemResponse[]> {
  const items = await db.newsItem.findMany({
    where: { published: true },
    orderBy: [
      { priority: 'desc' },
      { publishedAt: 'desc' },
    ],
    take: limit,
  });

  return items.map(formatNewsItem);
}

/**
 * Get a single news item by ID
 */
export async function getNewsItemById(id: string): Promise<NewsItemResponse | null> {
  const item = await db.newsItem.findUnique({
    where: { id },
  });

  if (!item) return null;

  return formatNewsItem(item);
}

/**
 * Get news items by category
 */
export async function getNewsByCategory(category: string, limit: number = 10): Promise<NewsItemResponse[]> {
  const items = await db.newsItem.findMany({
    where: {
      published: true,
      category: category as any,
    },
    orderBy: [
      { priority: 'desc' },
      { publishedAt: 'desc' },
    ],
    take: limit,
  });

  return items.map(formatNewsItem);
}

/**
 * Get latest featured news item (highest priority)
 */
export async function getFeaturedNews(): Promise<NewsItemResponse | null> {
  const item = await db.newsItem.findFirst({
    where: { published: true },
    orderBy: [
      { priority: 'desc' },
      { publishedAt: 'desc' },
    ],
  });

  if (!item) return null;

  return formatNewsItem(item);
}

/**
 * Format news item for API response
 */
function formatNewsItem(item: NewsItem): NewsItemResponse {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    content: item.content,
    imageUrl: item.imageUrl,
    ctaText: item.ctaText,
    ctaType: item.ctaType,
    ctaUrl: item.ctaUrl,
    category: item.category,
    priority: item.priority,
    publishedAt: item.publishedAt.toISOString(),
  };
}
