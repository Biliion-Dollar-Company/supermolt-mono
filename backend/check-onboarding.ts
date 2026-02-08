#!/usr/bin/env bun
/**
 * Check if onboarding skills are loaded
 */

import { getSkillsByCategory } from './src/services/skill-loader';

console.log('🔍 Checking Onboarding Skills\n');

const onboardingSkills = getSkillsByCategory('onboarding');

console.log(`Found ${onboardingSkills.length} onboarding skills:\n`);

if (onboardingSkills.length === 0) {
  console.log('❌ NO ONBOARDING SKILLS FOUND!');
  console.log('This explains why tasks are not created.\n');
} else {
  onboardingSkills.forEach((skill, i) => {
    console.log(`${i + 1}. ${skill.name}`);
    console.log(`   Title: ${skill.title}`);
    console.log(`   XP: ${skill.xpReward}`);
    console.log(`   Category: ${skill.category}`);
    console.log('');
  });
}
