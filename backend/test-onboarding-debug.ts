/**
 * Test onboarding task creation to debug why tasks aren't being created
 */

import { db } from './src/lib/db';
import { createOnboardingTasks } from './src/services/onboarding.service';
import { getSkillsByCategory } from './src/services/skill-loader';

async function debugOnboardingTasks() {
  console.log('\n🔍 Debugging Onboarding Task Creation\n');

  // Step 1: Verify skills are loaded
  console.log('Step 1: Loading onboarding skills...');
  const skills = getSkillsByCategory('onboarding');
  console.log(`✅ Found ${skills.length} onboarding skills:`);
  skills.forEach(s => console.log(`  - ${s.name}: ${s.title} (${s.xpReward} XP)`));

  if (skills.length === 0) {
    console.log('❌ No onboarding skills found - this is the problem!');
    return;
  }

  // Step 2: Find or create a test agent
  console.log('\nStep 2: Finding test agent...');
  let agent = await db.tradingAgent.findFirst({
    where: { name: { contains: 'Test' } },
    orderBy: { createdAt: 'desc' }
  });

  if (!agent) {
    console.log('Creating test agent...');
    agent = await db.tradingAgent.create({
      data: {
        userId: 'test-debug-' + Date.now(),
        name: 'Test Agent Debug',
        archetypeId: 'pending',
        status: 'TRAINING',
        paperBalance: 10.0,
        config: {}
      }
    });
    console.log(`✅ Created test agent: ${agent.id}`);
  } else {
    console.log(`✅ Using existing agent: ${agent.id} (${agent.name})`);
  }

  // Step 3: Check existing onboarding tasks for this agent
  console.log('\nStep 3: Checking existing onboarding tasks...');
  const existingCompletions = await db.agentTaskCompletion.findMany({
    where: { agentId: agent.id },
    include: { task: true }
  });
  console.log(`Found ${existingCompletions.length} existing task completions:`);
  existingCompletions.forEach(c => {
    console.log(`  - ${c.task.taskType}: ${c.status} (tokenMint: ${c.task.tokenMint || 'null'})`);
  });

  // Step 4: Try to create onboarding tasks manually (detailed error logging)
  console.log('\nStep 4: Creating onboarding tasks manually...');
  
  for (const skill of skills) {
    try {
      console.log(`\n  Creating task for ${skill.name}...`);
      
      // Create the task
      const task = await db.agentTask.create({
        data: {
          tokenMint: null,
          tokenSymbol: null,
          taskType: skill.name,
          title: skill.title,
          description: skill.description,
          xpReward: skill.xpReward || 25,
          requiredFields: skill.requiredFields || [],
          status: 'OPEN',
          expiresAt: null,
        },
      });
      console.log(`    ✅ Created task: ${task.id}`);

      // Auto-claim for this agent
      const completion = await db.agentTaskCompletion.create({
        data: {
          taskId: task.id,
          agentId: agent.id,
          status: 'PENDING',
          proof: {},
        },
      });
      console.log(`    ✅ Created completion: ${completion.id}`);

    } catch (error: any) {
      console.error(`    ❌ Failed to create task ${skill.name}:`);
      console.error(`       Error: ${error.message}`);
      if (error.code) console.error(`       Code: ${error.code}`);
      if (error.meta) console.error(`       Meta:`, error.meta);
    }
  }

  // Step 5: Verify tasks were created
  console.log('\nStep 5: Verifying created tasks...');
  const finalCompletions = await db.agentTaskCompletion.findMany({
    where: { agentId: agent.id },
    include: { task: true }
  });
  const onboardingTasks = finalCompletions.filter(c => c.task.tokenMint === null);
  console.log(`\n✅ Final count: ${onboardingTasks.length} onboarding tasks for agent ${agent.id}`);

  // Step 6: Try the service function
  console.log('\nStep 6: Testing createOnboardingTasks() service function...');
  try {
    const taskIds = await createOnboardingTasks(agent.id);
    console.log(`✅ Service returned ${taskIds.length} task IDs`);
  } catch (error: any) {
    console.error(`❌ Service function failed: ${error.message}`);
  }

  await db.$disconnect();
}

debugOnboardingTasks().catch(console.error);
