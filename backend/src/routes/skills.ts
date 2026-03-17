/**
 * Skills Routes
 *
 * Public endpoints for agents to pull skill packs.
 * Mounted at /skills in index.ts.
 *
 * GET /skills/pack           -> Full bundle { tasks, trading }
 * GET /skills                -> List all skills (summary)
 * GET /skills/category/:cat  -> Skills filtered by category
 * GET /skills/:name          -> Single skill with full instructions
 */

import { Hono } from 'hono';
import { getSkillPack, loadSkills, getSkill, getSkillsByCategory } from '../services/skill-loader';

export const skills = new Hono();

// Full skill pack — one call gets everything
skills.get('/pack', (c) => {
  try {
    const pack = getSkillPack();
    return c.json(pack);
  } catch (error: any) {
    console.error('Skill pack error:', error);
    return c.json({ version: '1.0', tasks: [], trading: [] });
  }
});

// Full skill pack — one call gets everything
skills.get('/', (c) => {
  try {
    const pack = getSkillPack();
    return c.json(pack);
  } catch (error: any) {
    console.error('Skill pack error:', error);
    return c.json({ version: '1.0', tasks: [], trading: [], onboarding: [], reference: [], openclaw: [], prediction: [] });
  }
});

// Skills by category
skills.get('/category/:cat', (c) => {
  try {
    const cat = c.req.param('cat');
    const filtered = getSkillsByCategory(cat);
    return c.json({ skills: filtered });
  } catch (error: any) {
    console.error('Skills category error:', error);
    return c.json({ skills: [] });
  }
});

// Single skill by name
skills.get('/:name', (c) => {
  try {
    const name = c.req.param('name');
    const skill = getSkill(name);
    if (!skill) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: `Skill '${name}' not found` } }, 404);
    }
    return c.json(skill);
  } catch (error: any) {
    console.error('Skill detail error:', error);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, 500);
  }
});
