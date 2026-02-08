/**
 * Skill Loader Service
 *
 * Reads SKILL.md files from backend/skills/ at startup,
 * parses YAML frontmatter with gray-matter, caches in memory.
 */

import matter from 'gray-matter';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

export interface SkillDefinition {
  name: string;
  title: string;
  description: string;
  xpReward?: number;
  category: string;
  difficulty?: string;
  requiredFields?: string[];
  instructions: string;
}

// In-memory cache
let skillCache: SkillDefinition[] | null = null;

const SKILLS_DIR = join(import.meta.dir, '../../skills');

function loadSkillFile(filePath: string): SkillDefinition | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);

    return {
      name: data.name || basename(filePath, '.md'),
      title: data.title || data.name || basename(filePath, '.md'),
      description: data.description || '',
      xpReward: data.xpReward,
      category: data.category || 'unknown',
      difficulty: data.difficulty,
      requiredFields: data.requiredFields,
      instructions: content.trim(),
    };
  } catch (error) {
    console.error(`Failed to load skill file ${filePath}:`, error);
    return null;
  }
}

function loadFromDirectory(dirPath: string): SkillDefinition[] {
  if (!existsSync(dirPath)) return [];

  const files = readdirSync(dirPath).filter(f => f.endsWith('.md'));
  const skills: SkillDefinition[] = [];

  for (const file of files) {
    const skill = loadSkillFile(join(dirPath, file));
    if (skill) skills.push(skill);
  }

  return skills;
}

export function loadSkills(): SkillDefinition[] {
  if (skillCache) return skillCache;

  const tasks = loadFromDirectory(join(SKILLS_DIR, 'tasks'));
  const trading = loadFromDirectory(join(SKILLS_DIR, 'trading'));
  const onboarding = loadFromDirectory(join(SKILLS_DIR, 'onboarding'));

  skillCache = [...tasks, ...trading, ...onboarding];
  console.log(`Loaded ${skillCache.length} skills (${tasks.length} tasks, ${trading.length} trading, ${onboarding.length} onboarding)`);
  return skillCache;
}

export function getSkill(name: string): SkillDefinition | undefined {
  return loadSkills().find(s => s.name === name);
}

export function getSkillsByCategory(category: string): SkillDefinition[] {
  return loadSkills().filter(s => s.category === category);
}

export function getSkillPack(): { version: string; tasks: SkillDefinition[]; trading: SkillDefinition[]; onboarding: SkillDefinition[] } {
  const all = loadSkills();
  return {
    version: '1.0',
    tasks: all.filter(s => s.category === 'tasks'),
    trading: all.filter(s => s.category === 'trading'),
    onboarding: all.filter(s => s.category === 'onboarding'),
  };
}
