/**
 * Skill.md Route
 * 
 * Serves a single markdown file with complete agent onboarding instructions.
 * This is what agents curl to get started.
 * 
 * GET /api/skill.md → Returns markdown text
 */

import { Hono } from 'hono';
import { readFileSync } from 'fs';
import { join } from 'path';

export const skillMdRoute = new Hono();

// Path to the skill.md file
const SKILL_MD_PATH = join(import.meta.dir, '../../SKILL.md');

skillMdRoute.get('/', (c) => {
  try {
    const markdown = readFileSync(SKILL_MD_PATH, 'utf-8');
    
    // Return as plain text markdown
    return c.text(markdown, 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    });
  } catch (error) {
    console.error('Failed to read SKILL.md:', error);
    return c.text('# Error\n\nSkill guide not found.', 404);
  }
});
