/**
 * Production Feature Flag & Operational Kill-Switch Evaluator Template
 * Implements: Deterministic Consistent Hashing (SHA-256) percentage rollouts,
 * tenant/user allowlists, operational kill-switches, and safe fallback defaults.
 */

import { createHash } from 'crypto';

export type FlagCategory = 'RELEASE' | 'KILL_SWITCH' | 'EXPERIMENT' | 'ENTITLEMENT';

export interface FeatureFlagConfig {
  readonly key: string;
  readonly category: FlagCategory;
  readonly enabled: boolean;
  readonly rolloutPercentage: number; // 0 to 100
  readonly allowedSubjectIds?: ReadonlyArray<string>;
  readonly expiresAtIso?: string;
}

export interface EvaluationContext {
  readonly subjectId?: string; // user_id or tenant_id for consistent bucketing
}

export class FeatureFlagEvaluator {
  private readonly flags = new Map<string, FeatureFlagConfig>();

  constructor(initialFlags: ReadonlyArray<FeatureFlagConfig> = []) {
    for (const flag of initialFlags) {
      this.flags.set(flag.key, flag);
    }
  }

  /**
   * Computes a deterministic bucket (0..99) using SHA-256 consistent hashing.
   * Ensures the same user always receives a consistent experience across stateless pods.
   */
  public computeConsistentBucket(flagKey: string, subjectId: string): number {
    const hashBuffer = createHash('sha256')
      .update(`${flagKey}:${subjectId}`, 'utf8')
      .digest();
    const uint32 = hashBuffer.readUInt32BE(0);
    return uint32 % 100;
  }

  public isEnabled(
    flagKey: string,
    context: EvaluationContext = {},
    defaultFallback = false
  ): boolean {
    const config = this.flags.get(flagKey);
    if (!config) {
      return defaultFallback;
    }

    if (!config.enabled) {
      return false;
    }

    // 1. Explicit allowlist check (for internal dogfooding / VIP tenants)
    if (
      context.subjectId &&
      config.allowedSubjectIds &&
      config.allowedSubjectIds.includes(context.subjectId)
    ) {
      return true;
    }

    // 2. Full 100% rollout
    if (config.rolloutPercentage >= 100) {
      return true;
    }

    if (config.rolloutPercentage <= 0) {
      return false;
    }

    // 3. Deterministic percentage rollout requires a subjectId
    if (!context.subjectId) {
      return defaultFallback;
    }

    const bucket = this.computeConsistentBucket(flagKey, context.subjectId);
    return bucket < config.rolloutPercentage;
  }
}

