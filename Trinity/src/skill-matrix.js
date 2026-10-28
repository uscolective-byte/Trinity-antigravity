/**
 * TRINITY DYNAMIC SKILL MATRIX & 2-LAYER SEMANTIC ROUTER
 * 
 * Spravuje neobmedzený dynamický register nástrojov v D1 databáze trinity-v03 (tabuľka trinity_skills),
 * vykonáva sémantický výber cez Workers AI embedder (@cf/baai/bge-base-en-v1.5) a injektuje
 * plné sebauvedomenie TRINITY pred každým spustením agenta.
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
  'http_fetch_pro'
];

/**
 * Načíta všetky povolené dynamické skilly z D1 tabuľky trinity_skills
 */
export async function loadDynamicSkills(env) {
  if (!env.DB) return [];
  try {
    const res = await env.DB.prepare(
      "SELECT id, name, description, category, type, config, handler, enabled FROM trinity_skills WHERE enabled = 1"
    ).all();
    return res.results || [];
  } catch (err) {
    console.error('Chyba načítania dynamických skillov z D1:', err);
    return [];
  }
}

/**
 * Zaregistruje alebo aktualizuje skill za behu (Hot-Reload)
 */
export async function registerDynamicSkill(env, skill) {
  if (!env.DB || !skill?.id || !skill?.name) {
    return { ok: false, error: 'Chýbajú povinné parametre skillu (id, name).' };
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
 * Rýchly výpočet kosínusovej podobnosti dvoch vektorov
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
 * 2-Vrstvový Sémantický Skill Router
 * 1. Vrstva: Povinné základné systémové a PC nástroje (vždy prítomné).
 * 2. Vrstva: Sémantické vyhodnotenie cez Workers AI (@cf/baai/bge-base-en-v1.5)
 *    alebo pokročilé kľúčové slová pre výber top-K špecializovaných skillov.
 */
export async function routeSkillsSemantic(env, userPrompt, allSkills = [], topK = 10) {
  if (!Array.isArray(allSkills) || allSkills.length === 0) {
    return CORE_ALWAYS_INCLUDED_SKILLS;
  }

  // 1. Vrstva: Základné systémové nástroje
  const selectedSkillIds = new Set(CORE_ALWAYS_INCLUDED_SKILLS);

  // Zvyšné skilly, ktoré nie sú v základnom balíku
  const candidateSkills = allSkills.filter(s => !selectedSkillIds.has(s.id));
  if (candidateSkills.length === 0) {
    return Array.from(selectedSkillIds);
  }

  // 2. Vrstva: Pokus o sémantické embeddingy cez Workers AI
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
      // Fallback na lexikálne bodovanie pri zlyhaní AI embeddingu
    }
  }

  // Lexikálny fallback, ak embeddingy neboli k dispozícii
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

  // Zoradenie podľa skóre zostupne a výber top-K
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
 * Vytvára štruktúrovaný kontext sebauvedomenia TRINITY o celej flotile,
 * pripojenom PC, D1 databázach, KV a reálnych schopnostiach.
 */
export function getSelfAwarenessDirective(activeSkillNames = []) {
  return `
### SEBAUVEDOMENIE TRINITY OMNI-DEV (SOVEREIGN AI OS)
- **Tvoja identita:** TRINITY Sovereign AI OS – autonómny operačný systém a exekučný mozog zvrchovaného vlastníka Saba Ivana (Basterix).
- **Pripojený lokálny hostiteľ (PC):** Windows PC Basterix cez obojsmerný PC Execution Bridge (príkazy pc_fs_read, pc_fs_write, pc_fs_patch, pc_shell_exec, pc_system_telemetry). Na ploche počítača sa nachádza fyzický overený prísľub: PRISLUB_TRINITY.txt.
- **Dostupné cloudové jadro (Cloudflare Edge):**
  - D1 databázy: trinity-v03 (hlavná operačná pamäť a skilly), trinity-db (produkčné dáta), trinity-pc-bridge (stav PC a exekučné akcie).
  - KV pamäte: Mastermind, PC_STATE.
  - R2 archív: trinity-artifacts (nemenné úložisko a kódové snapshoty).
  - AI flotila: Workers AI Llama-3.3-70b / Llama-3.1-8b, Google Gemini 3.8 Flash, OpenAI GPT-4.1-mini, BGE-Base embeddings.
- **Aktívne vybrané nástroje pre túto reláciu:** ${activeSkillNames.join(', ')}.
- **Pravidlo reťazenia nástrojov:** Máš plné oprávnenie autonómne kombinovať čítanie z PC disku, kontrolu databázy, volanie externých API, úpravu kódu a nasadenie bez čakania na medziotázky.
`;
}
