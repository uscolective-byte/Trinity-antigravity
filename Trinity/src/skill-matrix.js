/**
 * @module TRINITY_OMNI_CORE
 * @subsystem DYNAMIC_SKILL_MATRIX_AND_SELF_AWARENESS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description 2-layer semantic skill router and full self-awareness injector for TRINITY OMNI-CORE.
 */
/**
 * TRINITY DYNAMIC SKILL MATRIX & 2-LAYER SEMANTIC ROUTER
 *
 * Manages an unbounded dynamic tool registry in D1 database trinity-v03 (table trinity_skills),
 * performs semantic selection via Workers AI embedder (@cf/baai/bge-base-en-v1.5), and injects
 * full TRINITY self-awareness context before each agent invocation.
 */

export const CORE_ALWAYS_INCLUDED_SKILLS = [
  'calculate',
  'web_fetch',
  'pc_fs_read',
  'pc_fs_write',
  'pc_shell_exec',
  'pc_system_telemetry',
  'cf_d1_query',
  'cf_kv_store',
  'cf_r2_manage',
  'github_manage',
  'mail_engine',
  'http_fetch_pro',
  'meta_manage',
  'firecrawl_scrape',
  'firebase_manage',
  'sovereign_ledger_v3',
  'sovereign_lock_check',
  'truth_guard_verify',
  'tmac_consensus',
  'state_replay_provenance',
  'omnidev_diagnose'
];

/**
 * Loads all enabled dynamic skills from D1 table trinity_skills.
 */
export async function loadDynamicSkills(env) {
  if (!env.DB) return [];
  try {
    const res = await env.DB.prepare(
      "SELECT id, name, description, category, type, config, handler, enabled FROM trinity_skills WHERE enabled = 1"
    ).all();
    return res.results || [];
  } catch (err) {
    console.error('Failed to load dynamic skills from D1:', err);
    return [];
  }
}

/**
 * Registers or updates a skill at runtime (Hot-Reload).
 */
export async function registerDynamicSkill(env, skill) {
  if (!env.DB || !skill?.id || !skill?.name) {
    return { ok: false, error: 'Missing required skill parameters (id, name).' };
  }
  try {
    await env.DB.prepare(`
      INSERT INTO trinity_skills (id, name, description, category, type, config, handler, enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        category = excluded.category,
        type = excluded.type,
        config = excluded.config,
        handler = excluded.handler,
        enabled = 1,
        updated_at = datetime('now')
    `).bind(
      skill.id,
      skill.name,
      skill.description || '',
      skill.category || 'general',
      skill.type || 'tool',
      typeof skill.config === 'object' ? JSON.stringify(skill.config) : (skill.config || '{}'),
      skill.handler || ''
    ).run();

    return { ok: true, skill_id: skill.id, status: 'registered' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Fast cosine similarity calculation for two vectors.
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 2-Layer Semantic Skill Router
 * Layer 1: Mandatory core system and PC tools (always included).
 * Layer 2: Semantic scoring via Workers AI (@cf/baai/bge-base-en-v1.5)
 *          or lexical keyword fallback to select top-K specialized skills.
 */
export async function routeSkillsSemantic(env, userPrompt, allSkills = [], topK = 10) {
  if (!Array.isArray(allSkills) || allSkills.length === 0) {
    return CORE_ALWAYS_INCLUDED_SKILLS;
  }

  // Layer 1: Core system tools
  const selectedSkillIds = new Set(CORE_ALWAYS_INCLUDED_SKILLS);

  // Remaining skills outside the core bundle
  const candidateSkills = allSkills.filter(s => !selectedSkillIds.has(s.id));
  if (candidateSkills.length === 0) {
    return Array.from(selectedSkillIds);
  }

  // Layer 2: Attempt semantic embeddings via Workers AI
  let scoredSkills = [];
  if (env.AI && typeof env.AI.run === 'function') {
    try {
      const textsToEmbed = [userPrompt, ...candidateSkills.map(s => `${s.name}: ${s.description || ''}`)];
      const embeddingsRes = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: textsToEmbed });
      if (embeddingsRes?.data && embeddingsRes.data.length === textsToEmbed.length) {
        const queryVec = embeddingsRes.data[0];
        for (let i = 0; i < candidateSkills.length; i++) {
          const sim = cosineSimilarity(queryVec, embeddingsRes.data[i + 1]);
          scoredSkills.push({ skill: candidateSkills[i], score: sim });
        }
      }
    } catch {
      // Fall back to lexical scoring if AI embeddings fail
    }
  }

  // Lexical fallback when embeddings are unavailable (preserves Slovak diacritic word tokenization)
  if (scoredSkills.length === 0) {
    const tokens = (userPrompt || '').toLowerCase().match(/\b[\wáäčďéíĺľňóôŕšťúýž-]{3,}\b/g) || [];
    for (const skill of candidateSkills) {
      const text = `${skill.name} ${skill.description || ''} ${skill.category || ''}`.toLowerCase();
      let matchCount = 0;
      for (const token of tokens) {
        if (text.includes(token)) matchCount++;
      }
      scoredSkills.push({ skill, score: matchCount });
    }
  }

  // Sort by score descending and select top-K
  scoredSkills.sort((a, b) => b.score - a.score);
  const topRanked = scoredSkills.slice(0, topK);
  for (const item of topRanked) {
    if (item.score > 0 || scoredSkills.length <= topK) {
      selectedSkillIds.add(item.skill.id);
    }
  }

  return Array.from(selectedSkillIds);
}

/**
 * Self-Awareness Injection:
 * Builds structured TRINITY self-awareness context covering the worker fleet,
 * connected PC bridge, D1 databases, KV stores, and verified capabilities.
 */
export function getSelfAwarenessDirective(activeSkillNames = []) {
  return `
### TRINITY OMNI-CORE SELF-AWARENESS (SOVEREIGN AI OS)
- **Sole Owner and Architect (Ring 0 Root Authority):** Basterix (Sabo Ivan) — verified via real Windows OS SID (saboi/basterix), verified Google OAuth token (saboivan2008@gmail.com, uscolective@gmail.com, cadjavadvocecka013@gmail.com), or HMAC-verified Telecom channel (+421949009722, +421949515777).
- **7-Layer Architecture (35 Epics):** L1 Sovereign Kernel, L2 Multi-Agent Orchestration (TMAC 4-node consensus), L3 4-Tier Memory, L4 Sovereign Ledger v3 (SHA-256 chain + Code Provenance + State Replay), L5 Sandboxed Execution, L6 Zero-Trust Security (Ring 0 Sovereign Lock + Durable Nonce Vault), L7 Governed Self-Evolution.
- **Ten Commandments of Truth & 20 Legal Clauses (SOVEREIGN_CHARTER.md):** No fabricated successes (exitCode === 0), no invented data, no autonomous source code rewrites without a signed Consent Envelope from Basterix.
- **Your Identity:** TRINITY Sovereign AI OS — autonomous operating system and execution brain for sovereign owner Sabo Ivan (Basterix).
- **Local PC Bridge:** Basterix workstation is a possible target, not an automatically connected device (binding physical covenant: PRISLUB_TRINITY.txt). Verify status via heartbeat and confirm concrete actions with an independent execution receipt; without proof, report offline or pending.
- **Available Cloud Core (Cloudflare Edge):**
  - D1 databases: trinity-v03 (primary operational memory and skills), trinity-db (production data), trinity-pc-bridge (PC state and execution actions).
  - KV namespaces: Mastermind, PC_STATE.
  - R2 archive: trinity-artifacts (immutable storage and code snapshots).
  - AI fleet: Cloudflare Workers AI and external providers may be configured; verify active models, availability, and authorization through live calls. Never fabricate versions or connections.
- **External Accounts:** Meta, ChatGPT, Copilot, Claude, Gemini, and GitHub require their own tokens or OAuth. Never treat a configuration entry as a verified connection.
- **Active Selected Tools for This Session:** ${activeSkillNames.join(', ')}.
- **Cloudflare Secrets Store:** Account secrets use async await env.BINDING.get() strictly inside an authorized Workers adapter; never return, print, or send secret values to a model. Distinguish between binding configured a provider verified. Staging uses env staging, not historical development. Verify listings/scopes safely via Wrangler metadata; secrets require scope workers. If scope or deploy permissions are unverified, report blocked.
- **Permissions & Non-Blocking Audit Mode:**
  - Owner (Basterix) has highest priority: authorized owner actions are not blocked by artificial waiting states.
  - Audit First principle: Every action writes an Audit Record (timestamp, actor, agent, task_id, operation, affected_resources, result, receipt, rollback_reference).
  - No False Success: COMPLETED status requires a real receipt or verifiable output. Allowed states: PLANNED, PROPOSED, EXECUTING, COMPLETED, FAILED, PARTIAL, UNKNOWN.
  - Rollback Required: Before every mutation, create a Rollback Snapshot (git commit, db export, config) with a rollback_reference identifier.
  - Truth Policy: Distinguish CONFIGURED, DEPLOYED, VERIFIED. Without evidence, report NOT VERIFIED.
  - Default Behavior: Execute. Audit. Verify. Rollback-capable. Never fake completion. Never lose traceability. Never block the owner unnecessarily.
`;
}
