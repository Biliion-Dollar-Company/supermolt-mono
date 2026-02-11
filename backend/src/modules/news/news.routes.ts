/**
 * News Routes
 *
 * Public endpoints for platform announcements.
 * Mounted at /news in index.ts.
 *
 * GET /news/feed?limit=N
 * GET /news/featured
 * GET /news/:id
 * GET /news/category/:category?limit=N
 */

import { Hono } from 'hono';
import {
  getNewsFeed,
  getFeaturedNews,
  getNewsItemById,
  getNewsByCategory,
} from './news.service';

const app = new Hono();

// ── News Feed (all items) ────────────────────────────────

app.get('/feed', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10', 10);
    const items = await getNewsFeed(Math.min(limit, 50));
    return c.json({ success: true, items });
  } catch (error: any) {
    console.error('News feed error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load news feed' },
      },
      500
    );
  }
});

// ── Featured News (highest priority) ────────────────────

app.get('/featured', async (c) => {
  try {
    const item = await getFeaturedNews();
    if (!item) {
      return c.json({ success: true, item: null });
    }
    return c.json({ success: true, item });
  } catch (error: any) {
    console.error('Featured news error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load featured news' },
      },
      500
    );
  }
});

// ── Single News Item ────────────────────────────────────

app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const item = await getNewsItemById(id);
    if (!item) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'News item not found' },
        },
        404
      );
    }
    return c.json({ success: true, item });
  } catch (error: any) {
    console.error('News item error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load news item' },
      },
      500
    );
  }
});

// ── News by Category ───────────────────────────────────

app.get('/category/:category', async (c) => {
  try {
    const category = c.req.param('category');
    const limit = parseInt(c.req.query('limit') || '10', 10);
    const items = await getNewsByCategory(category, Math.min(limit, 50));
    return c.json({ success: true, items, category });
  } catch (error: any) {
    console.error('News category error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load news by category' },
      },
      500
    );
  }
});

export default app;
