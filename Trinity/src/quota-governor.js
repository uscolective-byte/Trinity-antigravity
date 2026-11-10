/**
 * @module TRINITY_QUOTA_GOVERNOR
 * @subsystem ORCHESTRATION_AND_SAFETY
 * @author Basterix (Root Architect) & Antigravity
 * @license Sovereign Irrevocable Covenant
 * @description Modul quota-governor.js v ekosystéme TRINITY OMNI-CORE v11.3 / v12.0.
 * Zabezpečuje distribuovaný Token Bucket pre 47 Workerov, bráni zacykleniu sub-agentov
 * a sleduje rozpočet CPU milisekúnd a tokenov.
 */

export const DEFAULT_QUOTA_BUDGET = Object.freeze({
  maxCpuMs: 1500,
  maxTokens: 2500,
  maxHops: 6, // Maximálny počet preposlaní medzi sub-workermi v reťazci
  refillRateTokensPerSec: 500,
  bucketCapacity: 10000
});

export class QuotaTicket {
  constructor({ ticketId, caller, budget = {}, hops = 0, initialTokens = 2500, initialCpuMs = 1500 }) {
    this.ticketId = ticketId || `ticket_${crypto.randomUUID().slice(0, 12)}`;
    this.caller = caller || 'sovereign-root';
    this.hops = hops;
    this.maxHops = budget.maxHops ?? DEFAULT_QUOTA_BUDGET.maxHops;
    this.remainingTokens = initialTokens;
    this.remainingCpuMs = initialCpuMs;
    this.startedAt = Date.now();
    this.status = 'ACTIVE';
  }

  canForward() {
    if (this.hops >= this.maxHops) return false;
    if (this.remainingTokens <= 0 || this.remainingCpuMs <= 0) return false;
    return true;
  }

  consume({ tokens = 0, cpuMs = 0, worker = 'generic-sub-worker' }) {
    this.hops += 1;
    this.remainingTokens = Math.max(0, this.remainingTokens - tokens);
    this.remainingCpuMs = Math.max(0, this.remainingCpuMs - cpuMs);

    if (this.hops > this.maxHops) {
      this.status = 'HOPS_EXCEEDED';
      return { allowed: false, reason: `Reťazec agentov prekročil limit ${this.maxHops} preposlaní na workeri ${worker}.` };
    }

    if (this.remainingTokens === 0 || this.remainingCpuMs === 0) {
      this.status = 'QUOTA_DEPLETED';
      return { allowed: false, reason: `Vyčerpaný rozpočet tokenov/CPU pre požiadavku ${this.ticketId} na workeri ${worker}.` };
    }

    return { allowed: true, remainingTokens: this.remainingTokens, remainingCpuMs: this.remainingCpuMs, hops: this.hops };
  }

  toHeaders() {
    return {
      'X-Trinity-Ticket-Id': this.ticketId,
      'X-Trinity-Hops': String(this.hops),
      'X-Trinity-Tokens-Left': String(this.remainingTokens),
      'X-Trinity-Cpu-Left': String(this.remainingCpuMs)
    };
  }

  static fromHeaders(headers, budget = {}) {
    const ticketId = headers.get('X-Trinity-Ticket-Id') || undefined;
    const hops = Number(headers.get('X-Trinity-Hops') || 0);
    const initialTokens = Number(headers.get('X-Trinity-Tokens-Left') || DEFAULT_QUOTA_BUDGET.maxTokens);
    const initialCpuMs = Number(headers.get('X-Trinity-Cpu-Left') || DEFAULT_QUOTA_BUDGET.maxCpuMs);
    return new QuotaTicket({ ticketId, budget, hops, initialTokens, initialCpuMs });
  }
}

/**
 * Token Bucket pre riadenie globálneho trafficu na modeli alebo sub-workeri
 */
export class TokenBucket {
  constructor(capacity = 5000, refillPerSecond = 500) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    if (elapsedSeconds > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
      this.lastRefill = now;
    }
  }

  tryConsume(requestedTokens) {
    this.refill();
    if (this.tokens >= requestedTokens) {
      this.tokens -= requestedTokens;
      return true;
    }
    return false;
  }
}
