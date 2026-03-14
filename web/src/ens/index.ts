/**
 * ENS integration layer — barrel export.
 *
 * Provides ENS name resolution utilities and an agent identity system
 * for the SurgeCast prediction platform.
 *
 * @module ens
 *
 * @example
 * ```ts
 * import { resolveAddress, AgentIdentity, defaultAgentIdentity } from '../ens';
 *
 * const addr = await resolveAddress('surgecast.eth');
 * await defaultAgentIdentity.load();
 * console.log(defaultAgentIdentity.getIdentityCard());
 * ```
 */

export type { AgentProfile } from './ens-client.ts';
export {
  MOCK_AGENT_PROFILE,
  setEnsClientOverride,
  getEnsClient,
  resolveAddress,
  resolveName,
  getEnsAvatar,
  getEnsText,
  getAgentProfile,
} from './ens-client.ts';

export type { SignalHistoryEntry } from './agent-identity.ts';
export { AgentIdentity, defaultAgentIdentity } from './agent-identity.ts';
