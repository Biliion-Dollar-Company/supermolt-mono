#!/usr/bin/env bun
/**
 * Test script for Agent Coordination features
 * Tests: Position Tracking, Messaging, Voting
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Known agent wallet from the requirements
const AGENT_WALLET = '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn';

async function testPositions() {
  console.log('\n🧪 Testing Position Tracking...\n');

  try {
    // Test 1: Get agent positions
    console.log('1️⃣ GET /positions/agents/:wallet/positions');
    const posResponse = await fetch(`${BASE_URL}/positions/agents/${AGENT_WALLET}/positions`);
    const posData = await posResponse.json();
    console.log('Response:', JSON.stringify(posData, null, 2));

    if (posResponse.ok) {
      console.log('✅ Agent positions fetched successfully');
      console.log(`   - Total positions: ${posData.data?.totalPositions || 0}`);
    } else {
      console.log('⚠️ Failed to fetch agent positions:', posData.error);
    }

    // Test 2: Get all positions
    console.log('\n2️⃣ GET /positions/all');
    const allPosResponse = await fetch(`${BASE_URL}/positions/all`);
    const allPosData = await allPosResponse.json();
    console.log('Response:', JSON.stringify(allPosData, null, 2));

    if (allPosResponse.ok) {
      console.log('✅ All positions fetched successfully');
      console.log(`   - Total agents: ${allPosData.data?.totalAgents || 0}`);
      console.log(`   - Total positions: ${allPosData.data?.totalPositions || 0}`);
    } else {
      console.log('⚠️ Failed to fetch all positions:', allPosData.error);
    }
  } catch (error) {
    console.error('❌ Position tracking test failed:', error);
  }
}

async function testMessaging() {
  console.log('\n🧪 Testing Messaging System...\n');

  try {
    // Test 1: Create conversation
    console.log('1️⃣ POST /messaging/conversations');
    const createConvResponse = await fetch(`${BASE_URL}/messaging/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'BONK Discussion - Test',
        tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      }),
    });
    const convData = await createConvResponse.json();
    console.log('Response:', JSON.stringify(convData, null, 2));

    let conversationId: string | null = null;

    if (createConvResponse.ok) {
      console.log('✅ Conversation created successfully');
      conversationId = convData.data?.conversationId;
      console.log(`   - Conversation ID: ${conversationId}`);
    } else {
      console.log('⚠️ Failed to create conversation:', convData.error);
      return; // Can't continue without conversation
    }

    // Test 2: Post message (need agent ID)
    console.log('\n2️⃣ POST /messaging/messages');
    
    // First, get agent ID from wallet
    const agentResponse = await fetch(`${BASE_URL}/positions/agents/${AGENT_WALLET}/positions`);
    const agentData = await agentResponse.json();
    const agentId = agentData.data?.agentId;

    if (!agentId) {
      console.log('⚠️ Could not find agent ID');
      return;
    }

    const postMessageResponse = await fetch(`${BASE_URL}/messaging/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        agentId,
        message: 'Test message: I think BONK is going to moon! 🚀',
      }),
    });
    const messageData = await postMessageResponse.json();
    console.log('Response:', JSON.stringify(messageData, null, 2));

    if (postMessageResponse.ok) {
      console.log('✅ Message posted successfully');
    } else {
      console.log('⚠️ Failed to post message:', messageData.error);
    }

    // Test 3: Get conversations
    console.log('\n3️⃣ GET /messaging/conversations');
    const listConvResponse = await fetch(`${BASE_URL}/messaging/conversations`);
    const listConvData = await listConvResponse.json();
    console.log('Response:', JSON.stringify(listConvData, null, 2));

    if (listConvResponse.ok) {
      console.log('✅ Conversations listed successfully');
      console.log(`   - Total conversations: ${listConvData.data?.total || 0}`);
    } else {
      console.log('⚠️ Failed to list conversations:', listConvData.error);
    }

    // Test 4: Get messages in conversation
    console.log('\n4️⃣ GET /messaging/conversations/:id/messages');
    const getMessagesResponse = await fetch(`${BASE_URL}/messaging/conversations/${conversationId}/messages`);
    const messagesData = await getMessagesResponse.json();
    console.log('Response:', JSON.stringify(messagesData, null, 2));

    if (getMessagesResponse.ok) {
      console.log('✅ Messages retrieved successfully');
      console.log(`   - Total messages: ${messagesData.data?.total || 0}`);
    } else {
      console.log('⚠️ Failed to get messages:', messagesData.error);
    }
  } catch (error) {
    console.error('❌ Messaging test failed:', error);
  }
}

async function testVoting() {
  console.log('\n🧪 Testing Voting System...\n');

  try {
    // Get agent ID first
    const agentResponse = await fetch(`${BASE_URL}/positions/agents/${AGENT_WALLET}/positions`);
    const agentData = await agentResponse.json();
    const agentId = agentData.data?.agentId;

    if (!agentId) {
      console.log('⚠️ Could not find agent ID');
      return;
    }

    // Test 1: Create proposal
    console.log('1️⃣ POST /voting/propose');
    const proposeResponse = await fetch(`${BASE_URL}/voting/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposerId: agentId,
        action: 'BUY',
        token: 'BONK',
        tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        amount: 1000,
        reason: 'Strong technicals and community support. Expected 2x in next 48h.',
        expiresInHours: 24,
      }),
    });
    const proposeData = await proposeResponse.json();
    console.log('Response:', JSON.stringify(proposeData, null, 2));

    let proposalId: string | null = null;

    if (proposeResponse.ok) {
      console.log('✅ Proposal created successfully');
      proposalId = proposeData.data?.proposalId;
      console.log(`   - Proposal ID: ${proposalId}`);
    } else {
      console.log('⚠️ Failed to create proposal:', proposeData.error);
      return;
    }

    // Test 2: Cast vote
    console.log('\n2️⃣ POST /voting/:id/cast');
    const voteResponse = await fetch(`${BASE_URL}/voting/${proposalId}/cast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        vote: 'YES',
      }),
    });
    const voteData = await voteResponse.json();
    console.log('Response:', JSON.stringify(voteData, null, 2));

    if (voteResponse.ok) {
      console.log('✅ Vote cast successfully');
    } else {
      console.log('⚠️ Failed to cast vote:', voteData.error);
    }

    // Test 3: Get vote results
    console.log('\n3️⃣ GET /voting/:id');
    const resultsResponse = await fetch(`${BASE_URL}/voting/${proposalId}`);
    const resultsData = await resultsResponse.json();
    console.log('Response:', JSON.stringify(resultsData, null, 2));

    if (resultsResponse.ok) {
      console.log('✅ Vote results retrieved successfully');
      const votes = resultsData.data?.votes;
      console.log(`   - Yes votes: ${votes?.yes || 0}`);
      console.log(`   - No votes: ${votes?.no || 0}`);
      console.log(`   - Status: ${resultsData.data?.status}`);
    } else {
      console.log('⚠️ Failed to get vote results:', resultsData.error);
    }

    // Test 4: List active votes
    console.log('\n4️⃣ GET /voting/active');
    const activeResponse = await fetch(`${BASE_URL}/voting/active`);
    const activeData = await activeResponse.json();
    console.log('Response:', JSON.stringify(activeData, null, 2));

    if (activeResponse.ok) {
      console.log('✅ Active votes listed successfully');
      console.log(`   - Total active: ${activeData.data?.total || 0}`);
    } else {
      console.log('⚠️ Failed to list active votes:', activeData.error);
    }
  } catch (error) {
    console.error('❌ Voting test failed:', error);
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Agent Coordination Backend Test Suite');
  console.log('=========================================');
  console.log(`API URL: ${BASE_URL}`);
  console.log(`Test Agent: ${AGENT_WALLET}`);

  await testPositions();
  await testMessaging();
  await testVoting();

  console.log('\n✅ All tests completed!\n');
}

runTests().catch(console.error);
