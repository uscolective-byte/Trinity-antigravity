/**
 * @module TRINITY_OMNI_CORE
 * @subsystem AUTONOMOUS_LONG_TERM_MEMORY
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Automatic extraction of durable preferences, communication style, and project context into ops_memory without storing secret keys.
 */

const SECRET_PATTERNS = /(?:\b(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|trn_live_[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}|xoxb-[A-Za-z0-9-]+|re_[A-Za-z0-9_]{16,})\b|\bBearer\s+[A-Za-z0-9._~-]{16,}|(?:password|heslo|secret|token|api[_-]?key)\s*[:=])/i;

function fold(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function safeExcerpt(text = '', limit = 320) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

/**
 * Deterministically extracts safe durable facts and preferences from a user message.
 * Preserves Slovak user-input triggers (plus English equivalents) and canonical ops_memory keys.
 * @param {string} task
 * @param {string} reply
 * @returns {Array<{key:string, value:string}>}
 */
export function extractDurableMemoryInsights(task = '', reply = '') {
  const cleanTask = String(task || '').trim();
  if (!cleanTask || cleanTask.length < 8 || SECRET_PATTERNS.test(cleanTask)) {
    return [];
  }

  const folded = fold(cleanTask);
  const insights = [];

  if (/\b(ludsk|prirodzen|tykaj|vykaj|komunikac|ton|humor|kratk|strucn|podrobn|slovensky|anglicky|vibe|styl|vzor|hip\s*hop|garage|human|natural|tone|brief|concise|detailed|style)\b/.test(folded)) {
    insights.push({
      key: 'profil/auto:komunikacny_styl',
      value: `User communication and style preference: ${safeExcerpt(cleanTask, 280)}`
    });
  }

  if (/\b(mam\s+rad|paci\s+sa\s+mi|nepaci\s+sa\s+mi|preferujem|nikdy\s+ne|vzdy\s+chcem|chcem\s+aby|neznasam|i\s+prefer|i\s+like|i\s+dislike|always\s+want)\b/.test(folded)) {
    insights.push({
      key: 'profil/auto:preferencia',
      value: safeExcerpt(cleanTask, 280)
    });
  }

  if (/\b(pracujem\s+na|moj\s+projekt|moja\s+domena|budujem|chcem\s+spustit|nasad\s+na|moje\s+pc|moj\s+ucet|working\s+on|my\s+project|my\s+domain|building)\b/.test(folded)) {
    insights.push({
      key: 'kontext/auto:aktivny_zamer',
      value: safeExcerpt(cleanTask, 280)
    });
  }

  if (cleanTask.length >= 20 && String(reply || '').trim().length >= 20) {
    insights.push({
      key: 'kontext/auto:posledna_tema',
      value: `Task: ${safeExcerpt(cleanTask, 180)} | Conclusion: ${safeExcerpt(reply, 180)}`
    });
  }

  return insights.slice(0, 3);
}

/**
 * Persists extracted safe facts into the D1 ops_memory table (non-fatal).
 */
export async function persistAutoMemory(env, { task, resultText } = {}) {
  if (!env?.DB?.prepare) return { saved: 0 };
  const insights = extractDurableMemoryInsights(task, resultText);
  if (!insights.length) return { saved: 0 };

  let saved = 0;
  for (const item of insights) {
    try {
      await env.DB.prepare(
        "INSERT INTO ops_memory(key,value,source) VALUES(?,?,'auto-memory') ON CONFLICT(key) DO UPDATE SET value=excluded.value,source='auto-memory',updated_at=datetime('now')"
      ).bind(item.key, item.value).run();
      saved++;
    } catch {
      // Non-fatal memory write failure must never fail a completed workflow response
    }
  }
  return { saved, keys: insights.map((i) => i.key) };
}
