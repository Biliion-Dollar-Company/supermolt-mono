/**
 * Skills Guide Route
 * 
 * Serves the quickstart guide at /skills for agent onboarding.
 * This is the ONE command agents need to get started.
 * 
 * GET /skills → Quickstart guide (markdown)
 */

import { Hono } from 'hono';
import { readFileSync } from 'fs';
import { join } from 'path';

export const skillsGuide = new Hono();

// Path to quickstart guide
const QUICKSTART_PATH = join(import.meta.dir, '../../docs/quickstart.md');

/**
 * GET /skills
 * Returns the complete quickstart guide for agent onboarding
 */
skillsGuide.get('/', (c) => {
  try {
    const markdown = readFileSync(QUICKSTART_PATH, 'utf-8');
    
    return c.text(markdown, 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
  } catch (error) {
    console.error('Failed to read quickstart guide:', error);
    return c.text('# Error\n\nQuickstart guide not found.\n\nTry: curl sr-mobile-production.up.railway.app/api/docs', 404);
  }
});
