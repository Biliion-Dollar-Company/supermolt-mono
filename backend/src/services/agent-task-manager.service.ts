/**
 * Agent Task Manager Service
 * 
 * Creates competitive tasks for agents when tokens are detected.
 * Integrates with Ponzinomics gamification API for XP tracking.
 * 
 * Flow:
 * 1. Token detected → createTasksForToken()
 * 2. Tasks created in Ponzinomics → agents compete
 * 3. Agent submits proof → validateSubmission() via webhook
 * 4. First valid submission wins XP
 */

interface TaskDefinition {
  type: string;
  title: string;
  description: string;
  xpReward: number;
  requirements: {
    fields: string[]; // Required fields in proof
  };
}

const TASK_PRESETS: TaskDefinition[] = [
  {
    type: 'TWITTER_DISCOVERY',
    title: 'Find Official Twitter Account',
    description: 'Locate and verify the token\'s official Twitter/X presence',
    xpReward: 100,
    requirements: {
      fields: ['handle', 'url', 'followers', 'verified']
    }
  },
  {
    type: 'COMMUNITY_ANALYSIS',
    title: 'Analyze Twitter Community',
    description: 'Measure community engagement and sentiment',
    xpReward: 75,
    requirements: {
      fields: ['mentions24h', 'sentiment', 'topTweets']
    }
  },
  {
    type: 'HOLDER_ANALYSIS',
    title: 'Identify Top Token Holders',
    description: 'Find top 10 holders and analyze their activity',
    xpReward: 150,
    requirements: {
      fields: ['topHolders', 'concentration']
    }
  },
  {
    type: 'NARRATIVE_RESEARCH',
    title: 'Research Token Story',
    description: 'Discover the token\'s narrative, team, and context',
    xpReward: 125,
    requirements: {
      fields: ['purpose', 'launchDate', 'narrative', 'sources']
    }
  },
  {
    type: 'GOD_WALLET_TRACKING',
    title: 'Check God Wallets',
    description: 'Verify if tracked god wallets hold this token',
    xpReward: 200,
    requirements: {
      fields: ['godWalletsHolding', 'aggregateSignal']
    }
  },
  {
    type: 'LIQUIDITY_LOCK',
    title: 'Verify Liquidity Lock',
    description: 'Check if liquidity is locked and assess risk',
    xpReward: 80,
    requirements: {
      fields: ['isLocked', 'riskAssessment']
    }
  }
];

export class AgentTaskManager {
  private gamificationApiUrl: string;
  private projectId: string;
  
  constructor() {
    this.gamificationApiUrl = process.env.GAMIFICATION_API_URL || 'http://localhost:3003';
    this.projectId = 'trench-agents';
  }
  
  /**
   * Create 6 preset tasks for a new token
   * Called when SuperRouter trades a token
   */
  async createTasksForToken(
    tokenMint: string,
    tokenSymbol?: string
  ): Promise<{ taskIds: string[]; totalXP: number }> {
    const taskIds: string[] = [];
    let totalXP = 0;
    
    console.log(`\n🎯 Creating tasks for token: ${tokenSymbol || tokenMint.substring(0, 8)}`);
    
    for (const preset of TASK_PRESETS) {
      try {
        const task = {
          title: `${preset.title}: ${tokenSymbol || tokenMint.substring(0, 8)}`,
          description: preset.description,
          type: 'CUSTOM', // All are custom tasks in Ponzinomics schema
          points: preset.xpReward,
          status: 'ACTIVE',
          frequency: 'ONE_TIME', // Can only be completed once
          requirements: {
            taskType: preset.type,
            tokenMint,
            tokenSymbol,
            requiredFields: preset.requirements.fields
          },
          category: 'ECOSYSTEM'
        };
        
        // Create quest in Ponzinomics
        const response = await fetch(`${this.gamificationApiUrl}/quests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Project-ID': this.projectId
          },
          body: JSON.stringify(task)
        });
        
        if (!response.ok) {
          const error = await response.text();
          console.error(`❌ Failed to create task ${preset.type}:`, error);
          continue;
        }
        
        const result = await response.json();
        taskIds.push(result.id);
        totalXP += preset.xpReward;
        
        console.log(`   ✅ ${preset.type} (${preset.xpReward} XP) → ID: ${result.id}`);
      } catch (error) {
        console.error(`❌ Error creating task ${preset.type}:`, error);
      }
    }
    
    console.log(`\n📊 Total: ${taskIds.length} tasks created (${totalXP} XP available)\n`);
    
    return { taskIds, totalXP };
  }
  
  /**
   * Validate a task submission from an agent
   * Called via webhook from Ponzinomics when agent submits proof
   * 
   * @returns validation result with detailed error if invalid
   */
  async validateSubmission(
    taskId: string,
    agentId: string,
    proof: Record<string, unknown>
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Get task details from Ponzinomics
      const task = await this.getTask(taskId);
      if (!task) {
        return { valid: false, error: 'Task not found' };
      }
      
      const requirements = task.requirements;
      const taskType = requirements.taskType;
      
      console.log(`\n🔍 Validating ${taskType} submission from agent ${agentId.substring(0, 12)}...`);
      
      // Check all required fields are present
      for (const field of requirements.requiredFields) {
        if (!(field in proof)) {
          const error = `Missing required field: ${field}`;
          console.log(`   ❌ ${error}`);
          return { valid: false, error };
        }
      }
      
      // Type-specific validation
      const validation = await this.validateByType(taskType, proof);
      
      if (validation.valid) {
        console.log(`   ✅ Valid submission`);
      } else {
        console.log(`   ❌ Invalid: ${validation.error}`);
      }
      
      return validation;
    } catch (error: any) {
      console.error(`❌ Validation error:`, error);
      return { valid: false, error: error.message };
    }
  }
  
  /**
   * Type-specific validation logic
   */
  private async validateByType(
    taskType: string,
    proof: any
  ): Promise<{ valid: boolean; error?: string }> {
    switch (taskType) {
      case 'TWITTER_DISCOVERY':
        return this.validateTwitterDiscovery(proof);
      
      case 'COMMUNITY_ANALYSIS':
        return this.validateCommunityAnalysis(proof);
      
      case 'HOLDER_ANALYSIS':
        return this.validateHolderAnalysis(proof);
      
      case 'NARRATIVE_RESEARCH':
        return this.validateNarrativeResearch(proof);
      
      case 'GOD_WALLET_TRACKING':
        return this.validateGodWalletTracking(proof);
      
      case 'LIQUIDITY_LOCK':
        return this.validateLiquidityLock(proof);
      
      default:
        // Accept unknown types by default (for extensibility)
        return { valid: true };
    }
  }
  
  /**
   * Validation: Twitter Discovery
   */
  private validateTwitterDiscovery(proof: any): { valid: boolean; error?: string } {
    // Handle must start with @
    if (!proof.handle || typeof proof.handle !== 'string' || !proof.handle.startsWith('@')) {
      return { valid: false, error: 'Handle must be a string starting with @' };
    }
    
    // URL must be provided
    if (!proof.url || typeof proof.url !== 'string') {
      return { valid: false, error: 'URL must be a string' };
    }
    
    // URL should contain x.com or twitter.com
    if (!proof.url.includes('x.com') && !proof.url.includes('twitter.com')) {
      return { valid: false, error: 'URL must be a Twitter/X link' };
    }
    
    // Followers must be a non-negative number
    if (typeof proof.followers !== 'number' || proof.followers < 0) {
      return { valid: false, error: 'Followers must be a non-negative number' };
    }
    
    // Verified must be boolean
    if (typeof proof.verified !== 'boolean') {
      return { valid: false, error: 'Verified must be a boolean' };
    }
    
    return { valid: true };
  }
  
  /**
   * Validation: Community Analysis
   */
  private validateCommunityAnalysis(proof: any): { valid: boolean; error?: string } {
    // Mentions must be non-negative number
    if (typeof proof.mentions24h !== 'number' || proof.mentions24h < 0) {
      return { valid: false, error: 'mentions24h must be a non-negative number' };
    }
    
    // Sentiment must be object with percentages
    const sentiment = proof.sentiment;
    if (!sentiment || typeof sentiment !== 'object') {
      return { valid: false, error: 'sentiment must be an object' };
    }
    
    // Check sentiment percentages add up to ~100
    const bullish = sentiment.bullish || 0;
    const neutral = sentiment.neutral || 0;
    const bearish = sentiment.bearish || 0;
    const total = bullish + neutral + bearish;
    
    if (Math.abs(total - 100) > 1) {
      return { valid: false, error: 'Sentiment percentages must add up to 100' };
    }
    
    // Top tweets must be array
    if (!Array.isArray(proof.topTweets)) {
      return { valid: false, error: 'topTweets must be an array' };
    }
    
    return { valid: true };
  }
  
  /**
   * Validation: Holder Analysis
   */
  private validateHolderAnalysis(proof: any): { valid: boolean; error?: string } {
    // Must provide array of holders
    if (!Array.isArray(proof.topHolders)) {
      return { valid: false, error: 'topHolders must be an array' };
    }
    
    // Must provide at least 5 holders
    if (proof.topHolders.length < 5) {
      return { valid: false, error: 'Must provide at least 5 top holders' };
    }
    
    // Check each holder has required fields
    for (const holder of proof.topHolders) {
      if (!holder.address || typeof holder.address !== 'string') {
        return { valid: false, error: 'Each holder must have an address (string)' };
      }
      
      // Basic Solana address format check (length)
      if (holder.address.length < 32 || holder.address.length > 44) {
        return { valid: false, error: 'Invalid Solana address format (length)' };
      }
      
      if (typeof holder.percentage !== 'number' || holder.percentage < 0 || holder.percentage > 100) {
        return { valid: false, error: 'Each holder percentage must be 0-100' };
      }
    }
    
    // Concentration must be provided
    if (!proof.concentration) {
      return { valid: false, error: 'concentration field required' };
    }
    
    return { valid: true };
  }
  
  /**
   * Validation: Narrative Research
   */
  private validateNarrativeResearch(proof: any): { valid: boolean; error?: string } {
    // Purpose must be provided and reasonable length
    if (!proof.purpose || typeof proof.purpose !== 'string' || proof.purpose.length < 10) {
      return { valid: false, error: 'purpose must be at least 10 characters' };
    }
    
    // Narrative must be provided and reasonable length
    if (!proof.narrative || typeof proof.narrative !== 'string' || proof.narrative.length < 10) {
      return { valid: false, error: 'narrative must be at least 10 characters' };
    }
    
    // Launch date should be provided
    if (!proof.launchDate) {
      return { valid: false, error: 'launchDate required' };
    }
    
    // Sources should be an array
    if (!Array.isArray(proof.sources)) {
      return { valid: false, error: 'sources must be an array' };
    }
    
    return { valid: true };
  }
  
  /**
   * Validation: God Wallet Tracking
   */
  private validateGodWalletTracking(proof: any): { valid: boolean; error?: string } {
    // godWalletsHolding must be array
    if (!Array.isArray(proof.godWalletsHolding)) {
      return { valid: false, error: 'godWalletsHolding must be an array' };
    }
    
    // Aggregate signal must be provided
    if (!proof.aggregateSignal) {
      return { valid: false, error: 'aggregateSignal required' };
    }
    
    // If any god wallets holding, validate structure
    if (proof.godWalletsHolding.length > 0) {
      for (const wallet of proof.godWalletsHolding) {
        if (!wallet.address || typeof wallet.address !== 'string') {
          return { valid: false, error: 'Each god wallet must have address' };
        }
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Validation: Liquidity Lock
   */
  private validateLiquidityLock(proof: any): { valid: boolean; error?: string } {
    // isLocked must be boolean
    if (typeof proof.isLocked !== 'boolean') {
      return { valid: false, error: 'isLocked must be a boolean' };
    }
    
    // Risk assessment must be provided
    if (!proof.riskAssessment) {
      return { valid: false, error: 'riskAssessment required' };
    }
    
    return { valid: true };
  }
  
  /**
   * Get task details from Ponzinomics
   */
  private async getTask(taskId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.gamificationApiUrl}/quests/${taskId}`,
        {
          headers: {
            'X-Project-ID': this.projectId
          }
        }
      );
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching task:', error);
      return null;
    }
  }
}
