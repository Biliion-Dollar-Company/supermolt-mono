/**
 * ERC-8004 Contract Client
 * Wrapper for interacting with deployed smart contracts
 */

import { ethers } from 'ethers';
import identityABI from './abis/AgentIdentityRegistry.json';
import reputationABI from './abis/AgentReputationRegistry.json';
import validationABI from './abis/AgentValidationRegistry.json';

// Optional: Load deployments if file exists (generated during contract deployment)
let deployments: any = {};
try {
  deployments = require('../../../contracts/deployments.json');
} catch (e) {
  // File doesn't exist yet - contracts not deployed
  console.log('[ERC8004] deployments.json not found - contracts not deployed yet');
}
import {
  AgentRegistration,
  Feedback,
  ReputationSummary,
  ValidationRequest,
  ValidationStats,
  ValidationResponseType
} from './types';

export class ERC8004Client {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private network: 'sepolia' | 'arbitrumSepolia' | 'arbitrum';
  
  public identityRegistry: ethers.Contract;
  public reputationRegistry: ethers.Contract;
  public validationRegistry: ethers.Contract;

  constructor(
    providerOrUrl: ethers.Provider | string,
    network: 'sepolia' | 'arbitrumSepolia' | 'arbitrum' = 'sepolia',
    signer?: ethers.Signer
  ) {
    this.provider = typeof providerOrUrl === 'string' 
      ? new ethers.JsonRpcProvider(providerOrUrl)
      : providerOrUrl;
    this.network = network;
    this.signer = signer;

    const deployment = deployments[network];
    
    this.identityRegistry = new ethers.Contract(
      deployment.identityRegistry,
      identityABI.abi,
      signer || this.provider
    );

    this.reputationRegistry = new ethers.Contract(
      deployment.reputationRegistry,
      reputationABI.abi,
      signer || this.provider
    );

    this.validationRegistry = new ethers.Contract(
      deployment.validationRegistry,
      validationABI.abi,
      signer || this.provider
    );
  }

  // ========== Identity Registry Methods ==========

  async registerAgent(agentURI: string): Promise<number> {
    const tx = await this.identityRegistry.register(agentURI);
    const receipt = await tx.wait();
    
    // Parse AgentRegistered event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = this.identityRegistry.interface.parseLog(log);
        return parsed?.name === 'AgentRegistered';
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = this.identityRegistry.interface.parseLog(event);
      return Number(parsed?.args.agentId);
    }

    throw new Error('AgentRegistered event not found');
  }

  async setAgentWallet(
    agentId: number,
    newWallet: string,
    signature: string
  ): Promise<void> {
    const tx = await this.identityRegistry.setAgentWallet(agentId, newWallet, signature);
    await tx.wait();
  }

  async getAgentWallet(agentId: number): Promise<string> {
    return await this.identityRegistry.getAgentWallet(agentId);
  }

  async setAgentMetadata(agentId: number, key: string, value: string): Promise<void> {
    const tx = await this.identityRegistry.setMetadata(agentId, key, value);
    await tx.wait();
  }

  async getAgentMetadata(agentId: number, key: string): Promise<string> {
    return await this.identityRegistry.getMetadata(agentId, key);
  }

  async getAgentOwner(agentId: number): Promise<string> {
    return await this.identityRegistry.ownerOf(agentId);
  }

  async getAgentTokenURI(agentId: number): Promise<string> {
    return await this.identityRegistry.tokenURI(agentId);
  }

  // ========== Reputation Registry Methods ==========

  async giveFeedback(
    agentId: number,
    value: number,
    decimals: number,
    tag1: string,
    tag2: string,
    feedbackURI: string
  ): Promise<number> {
    const tx = await this.reputationRegistry.giveFeedback(
      agentId,
      value,
      decimals,
      tag1,
      tag2,
      feedbackURI
    );
    const receipt = await tx.wait();

    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = this.reputationRegistry.interface.parseLog(log);
        return parsed?.name === 'NewFeedback';
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = this.reputationRegistry.interface.parseLog(event);
      return Number(parsed?.args.feedbackIndex);
    }

    throw new Error('NewFeedback event not found');
  }

  async revokeFeedback(agentId: number, feedbackIndex: number): Promise<void> {
    const tx = await this.reputationRegistry.revokeFeedback(agentId, feedbackIndex);
    await tx.wait();
  }

  async getFeedback(
    agentId: number,
    client: string,
    feedbackIndex: number
  ): Promise<Feedback> {
    const feedback = await this.reputationRegistry.getFeedback(agentId, client, feedbackIndex);
    return {
      client: feedback.client,
      value: feedback.value,
      decimals: feedback.decimals,
      tag1: feedback.tag1,
      tag2: feedback.tag2,
      feedbackURI: feedback.feedbackURI,
      timestamp: Number(feedback.timestamp),
      revoked: feedback.revoked
    };
  }

  async getReputationSummary(
    agentId: number,
    clients: string[]
  ): Promise<ReputationSummary> {
    const summary = await this.reputationRegistry.getSummary(agentId, clients);
    return {
      totalValue: summary.totalValue,
      count: Number(summary.count),
      averageValue: summary.averageValue
    };
  }

  async getClientFeedback(agentId: number, client: string): Promise<Feedback[]> {
    const feedbacks = await this.reputationRegistry.getClientFeedback(agentId, client);
    return feedbacks.map((f: any) => ({
      client: f.client,
      value: f.value,
      decimals: f.decimals,
      tag1: f.tag1,
      tag2: f.tag2,
      feedbackURI: f.feedbackURI,
      timestamp: Number(f.timestamp),
      revoked: f.revoked
    }));
  }

  async getFeedbackByTag(
    agentId: number,
    clients: string[],
    tag: string
  ): Promise<Feedback[]> {
    const feedbacks = await this.reputationRegistry.getFeedbackByTag(agentId, clients, tag);
    return feedbacks.map((f: any) => ({
      client: f.client,
      value: f.value,
      decimals: f.decimals,
      tag1: f.tag1,
      tag2: f.tag2,
      feedbackURI: f.feedbackURI,
      timestamp: Number(f.timestamp),
      revoked: f.revoked
    }));
  }

  // ========== Validation Registry Methods ==========

  async createValidationRequest(
    validator: string,
    agentId: number,
    requestURI: string,
    nonce: number
  ): Promise<string> {
    const requestHash = await this.validationRegistry.generateRequestHash(
      validator,
      agentId,
      requestURI,
      nonce
    );

    const tx = await this.validationRegistry.validationRequest(
      validator,
      agentId,
      requestURI,
      requestHash
    );
    await tx.wait();

    return requestHash;
  }

  async respondToValidation(
    requestHash: string,
    response: ValidationResponseType,
    responseURI: string
  ): Promise<void> {
    const tx = await this.validationRegistry.validationResponse(
      requestHash,
      response,
      responseURI
    );
    await tx.wait();
  }

  async getValidation(requestHash: string): Promise<ValidationRequest> {
    const validation = await this.validationRegistry.getValidation(requestHash);
    return {
      requester: validation.requester,
      validator: validation.validator,
      agentId: Number(validation.agentId),
      requestURI: validation.requestURI,
      requestHash: validation.requestHash,
      timestamp: Number(validation.timestamp),
      response: validation.response,
      responseURI: validation.responseURI,
      responseTimestamp: Number(validation.responseTimestamp)
    };
  }

  async getValidationStats(
    agentId: number,
    validators: string[]
  ): Promise<ValidationStats> {
    const stats = await this.validationRegistry.getValidationStats(agentId, validators);
    return {
      approvedCount: Number(stats.approvedCount),
      rejectedCount: Number(stats.rejectedCount),
      pendingCount: Number(stats.pendingCount),
      needsInfoCount: Number(stats.needsInfoCount)
    };
  }

  // ========== Helper Methods ==========

  async signWalletChange(
    agentId: number,
    newWallet: string,
    nonce: number
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer required for signing operations');
    }

    const domain = {
      name: 'AgentIdentityRegistry',
      version: '1',
      chainId: deployments[this.network].chainId,
      verifyingContract: deployments[this.network].identityRegistry
    };

    const types = {
      WalletChange: [
        { name: 'agentId', type: 'uint256' },
        { name: 'newWallet', type: 'address' },
        { name: 'nonce', type: 'uint256' }
      ]
    };

    const value = {
      agentId,
      newWallet,
      nonce
    };

    return await this.signer.signTypedData(domain, types, value);
  }
}

// Export a factory function for easy instantiation
export function createERC8004Client(
  rpcUrl: string,
  network: 'sepolia' | 'arbitrumSepolia' | 'arbitrum' = 'sepolia',
  privateKey?: string
): ERC8004Client {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = privateKey ? new ethers.Wallet(privateKey, provider) : undefined;
  return new ERC8004Client(provider, network, signer);
}
