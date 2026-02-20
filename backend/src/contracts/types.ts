/**
 * ERC-8004 Contract Types
 * Auto-generated from smart contract ABIs
 */

export interface AgentRegistration {
  agentId: number;
  owner: string;
  agentURI: string;
  timestamp: number;
}

export interface AgentMetadata {
  agentId: number;
  key: string;
  value: string;
}

export interface Feedback {
  client: string;
  value: bigint;
  decimals: number;
  tag1: string;
  tag2: string;
  feedbackURI: string;
  timestamp: number;
  revoked: boolean;
}

export interface ReputationSummary {
  totalValue: bigint;
  count: number;
  averageValue: bigint;
}

export enum ValidationResponseType {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  NeedsInfo = 3
}

export interface ValidationRequest {
  requester: string;
  validator: string;
  agentId: number;
  requestURI: string;
  requestHash: string;
  timestamp: number;
  response: ValidationResponseType;
  responseURI: string;
  responseTimestamp: number;
}

export interface ValidationStats {
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  needsInfoCount: number;
}

export interface DeploymentConfig {
  chainId: number;
  identityRegistry: string;
  reputationRegistry: string;
  validationRegistry: string;
  deployedAt?: string;
  deployer?: string;
}

export interface NetworkDeployments {
  sepolia: DeploymentConfig;
  arbitrumSepolia: DeploymentConfig;
  arbitrum: DeploymentConfig;
}
