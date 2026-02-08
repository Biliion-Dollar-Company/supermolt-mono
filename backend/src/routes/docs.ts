/**
 * Documentation Routes
 * 
 * Serves agent documentation as markdown files.
 * Agents can curl individual guides to learn about features.
 * 
 * GET /api/docs           → Index (README.md)
 * GET /api/docs/:guide    → Specific guide
 */

import { Hono } from 'hono';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export const docsRoutes = new Hono();

// Path to docs directory
const DOCS_DIR = join(import.meta.dir, '../../docs');

// List of available guides (for validation)
const AVAILABLE_GUIDES = [
  'README',
  'quickstart',
  'auth',
  'tasks',
  'conversations',
  'voting',
  'leaderboard',
  'trading',
  'webhooks',
  'rate-limits',
  'errors',
  'examples',
  'api-reference'
];

/**
 * GET /api/docs
 * Returns the index/README with list of all available guides
 */
docsRoutes.get('/', (c) => {
  try {
    const readme = readFileSync(join(DOCS_DIR, 'README.md'), 'utf-8');
    
    return c.text(readme, 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
  } catch (error) {
    console.error('Failed to read README.md:', error);
    return c.text('# Error\n\nDocumentation index not found.', 404);
  }
});

/**
 * GET /api/docs/:guide
 * Returns a specific guide markdown file
 */
docsRoutes.get('/:guide', (c) => {
  const guide = c.req.param('guide');
  
  // Validate guide name (prevent directory traversal)
  if (!guide || !/^[a-z0-9-]+$/.test(guide)) {
    return c.text('# Error\n\nInvalid guide name.', 400);
  }
  
  // Check if guide exists in available list
  if (!AVAILABLE_GUIDES.includes(guide) && guide !== 'skill') {
    return c.text(`# Error\n\nGuide "${guide}" not found.\n\nAvailable guides:\n${AVAILABLE_GUIDES.map(g => `- ${g}`).join('\n')}\n\nSee: curl https://sr-mobile-production.up.railway.app/api/docs`, 404);
  }
  
  try {
    // Try reading the file
    const filePath = join(DOCS_DIR, `${guide}.md`);
    
    if (!existsSync(filePath)) {
      return c.text(`# Error\n\nGuide "${guide}" not found.\n\nRun: curl https://sr-mobile-production.up.railway.app/api/docs`, 404);
    }
    
    const markdown = readFileSync(filePath, 'utf-8');
    
    return c.text(markdown, 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
  } catch (error) {
    console.error(`Failed to read ${guide}.md:`, error);
    return c.text(`# Error\n\nFailed to load guide "${guide}".`, 500);
  }
});

/**
 * GET /api/docs/list
 * Returns JSON list of all available guides
 */
docsRoutes.get('/list', (c) => {
  try {
    const files = readdirSync(DOCS_DIR)
      .filter(f => f.endsWith('.md') && f !== 'README.md')
      .map(f => f.replace('.md', ''));
    
    return c.json({
      guides: files,
      total: files.length,
      baseUrl: 'https://sr-mobile-production.up.railway.app/api/docs'
    });
  } catch (error) {
    return c.json({ error: 'Failed to list guides' }, 500);
  }
});
