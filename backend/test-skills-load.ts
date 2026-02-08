import { loadSkills, getSkillPack } from './src/services/skill-loader';

console.log('Loading skills...\n');

const skills = loadSkills();
console.log(`Total skills loaded: ${skills.length}\n`);

const pack = getSkillPack();
console.log(`Skill Pack Structure:`);
console.log(`- Tasks: ${pack.tasks.length}`);
console.log(`- Trading: ${pack.trading.length}`);
console.log(`- Onboarding: ${pack.onboarding.length}`);
console.log(`- Reference: ${pack.reference.length}\n`);

if (pack.reference.length > 0) {
  console.log(`Reference Skills:`);
  pack.reference.forEach(skill => {
    console.log(`  - ${skill.name}: ${skill.title}`);
    console.log(`    Instructions length: ${skill.instructions.length} chars`);
    console.log(`    First 200 chars: ${skill.instructions.substring(0, 200)}...`);
  });
} else {
  console.log('❌ NO REFERENCE SKILLS LOADED');
}
