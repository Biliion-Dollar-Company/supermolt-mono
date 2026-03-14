/**
 * Agent ENS Identity System.
 *
 * Wraps an {@link AgentProfile} with a rich identity context that agent-alpha
 * uses to sign signals, annotate reports, and expose its on-chain name to users.
 *
 * @module agent-identity
 */

import { getAgentProfile, type AgentProfile } from './ens-client.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Snapshot of recent signal activity recorded against this identity.
 */
export interface SignalHistoryEntry {
  /** ISO timestamp of the signal */
  timestamp: string;
  /** Market the signal targeted */
  market: string;
  /** Direction of the signal */
  direction: 'YES' | 'NO';
  /** EV score at signal time */
  evPercent: number;
}

// ---------------------------------------------------------------------------
// AgentIdentity class
// ---------------------------------------------------------------------------

/**
 * Represents the on-chain ENS identity of an AI agent.
 *
 * Loads its profile lazily on first call to {@link AgentIdentity.load} and
 * maintains a bounded in-memory log of emitted signals for context.
 *
 * @example
 * ```ts
 * const identity = new AgentIdentity('surgecast.eth');
 * await identity.load();
 * console.log(identity.getIdentityCard());
 * ```
 */
export class AgentIdentity {
  /** ENS name this identity is anchored to */
  public readonly ensName: string;

  /** Resolved profile (populated after {@link load}) */
  private _profile: AgentProfile | null = null;

  /** Recent signal history (bounded to last 50 entries) */
  private _signalHistory: SignalHistoryEntry[] = [];

  /** Maximum number of history entries to retain in memory */
  private static readonly MAX_HISTORY = 50;

  /**
   * @param ensName - ENS name for this agent (e.g. "surgecast.eth")
   */
  constructor(ensName: string) {
    this.ensName = ensName;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Resolves the ENS profile and caches it. Safe to call multiple times —
   * subsequent calls are no-ops if the profile is already loaded.
   *
   * @returns The resolved AgentProfile (live or mock)
   */
  async load(): Promise<AgentProfile> {
    if (!this._profile) {
      this._profile = await getAgentProfile(this.ensName);
    }
    return this._profile;
  }

  /**
   * Forces a fresh ENS resolution, discarding any cached profile.
   *
   * @returns The freshly resolved AgentProfile
   */
  async reload(): Promise<AgentProfile> {
    this._profile = null;
    return this.load();
  }

  /**
   * Directly sets the cached profile. Intended for unit tests only.
   * Allows tests to inject a specific AgentProfile without network calls.
   *
   * @param profile - The profile to inject
   */
  _setProfileForTesting(profile: AgentProfile): void {
    this._profile = profile;
  }

  // ---------------------------------------------------------------------------
  // Profile accessors
  // ---------------------------------------------------------------------------

  /**
   * Returns the cached profile, or null if {@link load} has not been called.
   */
  get profile(): AgentProfile | null {
    return this._profile;
  }

  /**
   * Returns true when the profile has been resolved and is not a mock.
   */
  get isVerified(): boolean {
    return this._profile !== null && !this._profile.isMock;
  }

  // ---------------------------------------------------------------------------
  // Identity card
  // ---------------------------------------------------------------------------

  /**
   * Returns a single-line identity card string suitable for console output
   * or Telegram messages.
   *
   * Format (live):  🤖 surgecast.eth | 0xAbCd…eF12 | avatar: https://...
   * Format (mock):  🤖 surgecast.eth | 0x0000…dEaD | ⚠️ demo mode
   *
   * Falls back to the ENS name with a "not loaded" note when {@link load}
   * has not been called yet.
   *
   * @returns Formatted identity card string
   */
  getIdentityCard(): string {
    if (!this._profile) {
      return `🤖 ${this.ensName} | (identity not loaded)`;
    }

    const addrShort = this._profile.address
      ? `${this._profile.address.slice(0, 6)}…${this._profile.address.slice(-4)}`
      : 'unregistered';

    const avatarPart = this._profile.avatar
      ? `avatar: ${this._profile.avatar}`
      : 'no avatar';

    const modeBadge = this._profile.isMock ? ' | ⚠️ demo mode' : '';

    return `🤖 ${this._profile.name} | ${addrShort} | ${avatarPart}${modeBadge}`;
  }

  // ---------------------------------------------------------------------------
  // Signal history
  // ---------------------------------------------------------------------------

  /**
   * Records a signal emission in the agent's history log.
   * Oldest entries are dropped when the log exceeds MAX_HISTORY.
   *
   * @param entry - Signal history entry to record
   */
  recordSignal(entry: SignalHistoryEntry): void {
    this._signalHistory.push(entry);
    if (this._signalHistory.length > AgentIdentity.MAX_HISTORY) {
      this._signalHistory.shift();
    }
  }

  /**
   * Returns a shallow copy of the current signal history.
   */
  getSignalHistory(): SignalHistoryEntry[] {
    return [...this._signalHistory];
  }

  /**
   * Returns a formatted summary of recent signal activity.
   *
   * @param limit - Maximum entries to include (default 5)
   */
  getHistorySummary(limit = 5): string {
    const recent = this._signalHistory.slice(-limit);
    if (recent.length === 0) return 'No signals recorded yet.';
    return recent
      .map((s) => `  • [${s.timestamp.slice(0, 10)}] ${s.market} ${s.direction} EV=${s.evPercent}%`)
      .join('\n');
  }
}

// ---------------------------------------------------------------------------
// Default singleton identity (surgecast.eth)
// ---------------------------------------------------------------------------

/**
 * Default shared AgentIdentity instance for surgecast.eth.
 * Import this in agent-alpha and call `.load()` on startup.
 */
export const defaultAgentIdentity = new AgentIdentity('surgecast.eth');
