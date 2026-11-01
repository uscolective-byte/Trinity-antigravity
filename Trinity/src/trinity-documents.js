/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul trinity-documents.js (Trinity/src/trinity-documents.js) v ekosystéme TRINITY OMNI-CORE.
 */
import { z } from 'zod';
import { HttpError } from './security.js';
import { generateSimplePdf } from './artifacts.js';

const DOCS_KV_KEY = 'assistant:documents:index';
const MAX_DOCS_INDEX = 120;

export const DOCUMENT_CATEGORIES = [
  'workflow_step',
  'ui_evolution',
  'domain_production',
  'commerce',
  'self_improvement',
  'architecture',
  'manual_doc',
  'legal_compliance'
];

export const createDocumentSchema = z.object({
  title: z.string().trim().min(2).max(180),
  category: z.enum(DOCUMENT_CATEGORIES).default('manual_doc'),
  step_name: z.string().trim().max(120).optional().default('manual'),
  summary: z.string().trim().max(1000).optional().default(''),
  content: z.string().trim().min(1).max(100000),
  tags: z.array(z.string().trim().max(40)).max(12).optional().default([]),
  receipt_id: z.string().trim().max(160).optional().nullable()
}).strict();

const memoryCache = new Map();

export const SEED_COMPLIANCE_DOCUMENTS = [
  {
    id: 'trinity-gdpr-privacy-consent',
    title: 'Vyhlásenie o ochrane osobných údajov a súhlas so spracovaním (GDPR)',
    category: 'legal_compliance',
    step_name: 'compliance_declaration',
    actor: 'Trinity Sovereign Core',
    summary: 'Oficiálne vyhlásenie o ochrane osobných údajov (GDPR / Zákon č. 18/2018 Z. z.) a podmienky súhlasu dotknutej osoby v ekosystéme Trinity (auru.space a auru.dev).',
    content: `# Vyhlásenie o ochrane osobných údajov a súhlas so spracovaním (GDPR)

**Prevádzkovateľ:** Ivan Sabo (Basterix) / Ekosystém Trinity & Auru Digital Studio
**Portály a domény:** https://auru.space · https://auru.dev
**Legislatívny rámec:** Nariadenie (EÚ) 2016/679 (GDPR) a Zákon č. 18/2018 Z. z. o ochrane osobných údajov

## 1. Identifikácia prevádzkovateľa a kontakt
Prevádzkovateľom informačných systémov Trinity je Ivan Sabo (Basterix), so sídlom v Slovenskej republike.
Kontakt pre otázky a uplatnenie práv k osobným údajom: gdpr@auru.space.

## 2. Kategórie osobných údajov
1. **Identifikačné a prihlasovacie údaje:** používateľské meno, e-mail, systémová rola (owner/admin/user).
2. **Kryptografické a bezpečnostné prvky:** hashe hesiel, WebAuthn/Passkeys verejné kľúče, session tokeny. Privátne kľúče nikdy neopúšťajú klientske zariadenie.
3. **Technické a sieťové telemetrické údaje:** anonymizovaná IP adresa na úrovni Cloudflare Edge, User-Agent, auditné logy systémových akcií.
4. **Používateľský obsah a komunikácia:** textové a hlasové príkazy v chate, nahrané súbory, vytvorené doménové záznamy a projektové šablóny.
5. **Platobné a transakčné údaje:** IBAN a BIC (výhradne dobrovoľne pre generovanie SEPA EPC QR kódov). Žiadne prístupové heslá do internetbankingu ani CVV kódy sa nikdy neukladajú.

## 3. Účely spracúvania a právne základy
- **Plnenie zmluvy a poskytovanie služieb Trinity (Čl. 6 ods. 1 písm. b) GDPR):** autentifikácia, chat asistent a generovanie webov.
- **Bezpečnosť a prevencia kybernetických útokov (Čl. 6 ods. 1 písm. f) GDPR):** oprávnený záujem prevádzkovateľa a integrita systémov.
- **Dlhodobá pamäť a kryptografický trezor (Čl. 6 ods. 1 písm. a) GDPR):** výslovný súhlas dotknutej osoby.
- **Účtovná a daňová evidencia (Čl. 6 ods. 1 písm. c) GDPR):** plnenie zákonných povinností SR.

## 4. Technické a organizačné bezpečnostné opatrenia
- Kryptografický trezor AES-GCM 256-bit pre API kľúče a tokeny.
- Striktná viacúrovňová izolácia priestorov používateľov od jadra.
- HTTPS / TLS 1.3 s bezpečnostnými hlavičkami CSP a Truth Policy 2.0.

## 5. Práva dotknutej osoby
Dotknutá osoba má právo na prístup k údajom, ich opravu, vymazanie (právo na zabudnutie), obmedzenie spracúvania, prenosnosť v JSON/MD formáte a právo kedykoľvek odvolať súhlas.
Dozorný orgán: Úrad na ochranu osobných údajov Slovenskej republiky (https://dataprotection.gov.sk).

## 6. Text výslovného súhlasu dotknutej osoby
„Týmto udeľujem dobrovoľný, výslovný a informovaný súhlas so spracúvaním mojich osobných údajov na účely používania autonómneho systému Trinity na doménach auru.space a auru.dev v súlade s GDPR. Bol/a som poučený/á o svojich právach a o možnosti tento súhlas kedykoľvek bezplatne odvolať v nastaveniach účtu alebo na gdpr@auru.space.“`,
    tags: ['gdpr', 'privacy', 'ochrana-udajov', 'compliance', 'pravne-podmienky'],
    receipt_id: 'compliance:gdpr:v1',
    auto_generated: false,
    created_at: '2026-10-28T10:00:00.000Z',
    export_md_url: '/api/assistant/documents/trinity-gdpr-privacy-consent/export?format=md',
    export_pdf_url: '/api/assistant/documents/trinity-gdpr-privacy-consent/export?format=pdf'
  },
  {
    "id": "trinity-kompletna-dokumentacia",
    "title": "Kompletná Oficiálna Dokumentácia a Architektúra TRINITY 11.0 (OMNI-CORE)",
    "category": "architecture",
    "step_name": "omni_core_manual",
    "actor": "Trinity Sovereign Core",
    "summary": "Kompletná príručka a technická encyklopédia Trinity 11.0 OMNI-CORE: 7-vrstvová architektúra, 29 Cloudflare Workerov, Omni-Dev Studio, Meta AI, Google Cloud, Truth Policy 2.1 a katalóg 112+ nástrojov.",
    "content": "# Kompletná Oficiálna Dokumentácia a Technická Encyklopédia TRINITY 11.0 (OMNI-CORE)\n\n**Verzia systému:** Trinity 11.0.0 OMNI-CORE  \n**Dátum vydania:** 1. novembra 2026  \n**Zvrchovaný tvorca a vlastník:** Ivan Sabo (alias **Basterix**), saboivan2008@gmail.com  \n**Produkčná zóna:** https://auru.space · **Staging zóna:** https://auru.dev  \n**Režim pravdivosti:** Truth Policy 2.1.0 (evidence-required, nulové simulácie)\n\n---\n\n## 1. Úvod a Poslanie\nTrinity 11.0 je zvrchovaný autonómny operačný systém navrhnutý na Cloudflare Edge infraštruktúre pre plnohodnotné kódovanie, generovanie webov, správu hostiteľského PC a autonómne riadenie sociálnych sietí.\n\n## 2. 7-Vrstvová Architektúra\n1. **Sovereign Lock & TruthGuard (Ring 0):** Merkle chain, nonces, ochrana proti klamaniu.\n2. **Dátové úložiská:** D1 trinity-v03, KV Mastermind, R2 trinity-artifacts, Durable Objects.\n3. **Flotila 29 Workerov:** 10 AURA špecialistov, 8 Trinity Core, 8 RPC služieb, 3 pomocné služby.\n4. **Host PC Bridge:** PowerShell, CMD, Node, Python, WinRT OCR, Screenshot, Súbory.\n5. **112+ Exekučných nástrojov:** meta_manage, pc_*, domain_*, wallet_*, calculate.\n6. **Kognícia a Pentad 2.0:** Workers AI Llama 3.3 70B, Gemini 3.8 Flash, GPT-4.1-mini.\n7. **Zvrchované UI:** Omni-Dev Studio, Chat, AI Studio, Domény, Peňaženka, Dokumentácia.\n\n## 3. Desatoro Pravdivosti\n1. Žiadne vymýšľanie dát ani halucinácie úspechu.\n2. Každá vykonaná akcia musí mať overiteľný receipt.\n3. Fail-Closed pri akejkoľvek chybe.\n4. Guarded Rollout s overením pred nasadením.",
    "tags": [
      "dokumentacia",
      "architektura",
      "omni-core",
      "manual",
      "trinity-11"
    ],
    "receipt_id": "doc:omni_core:v11",
    "auto_generated": false,
    "created_at": "2026-11-01T10:00:00.000Z",
    "export_md_url": "/api/assistant/documents/trinity-kompletna-dokumentacia/export?format=md",
    "export_pdf_url": "/api/assistant/documents/trinity-kompletna-dokumentacia/export?format=pdf"
  },
  {
    "id": "trinity-omni-dev-studio-sprievodca",
    "title": "Sprievodca Omni-Dev Studiom, PC Bridge a Live Terminálom",
    "category": "manual_doc",
    "step_name": "omnidev_guide",
    "actor": "Trinity Sovereign Core",
    "summary": "Detailný návod na obsluhu Omni-Dev Studia: obojsmerné vykonávanie príkazov na Windows PC, prehliadač súborov, kódový editor s auto-rollback poistkou a Pentad 2.0 router.",
    "content": "# Sprievodca Omni-Dev Studiom a Lokálnym PC Bridge\n\n## 1. Čo je Omni-Dev Studio\nOmni-Dev Studio je integrované vývojárske split-screen prostredie v Trinity (auru.space a auru.dev).\n\n## 2. Hlavné Funkcie\n- **Live PC Terminál:** Spúšťanie PowerShell, CMD, Node.js a Python príkazov na hostiteľskom PC.\n- **Prieskumník súborov:** Prechádzanie priečinkov na disku C:\\Users\\saboi\\Trinity-antigravity.\n- **Code Editor s R2 Snapshotom:** Bezpečná úprava kódu s okamžitým testom a rollbackom pri chybe.\n- **Skill Matrix & Store:** 112+ nástrojov so sémantickým vyhľadávaním BGE-Base.\n- **Pentad 2.0 Orchestrator:** Prepínanie medzi Auto Routerom, Llama 3.3 70B a Gemini 3.8 Flash.",
    "tags": [
      "omnidev",
      "pc-bridge",
      "terminal",
      "editor",
      "vyvoj"
    ],
    "receipt_id": "doc:omnidev:v1",
    "auto_generated": false,
    "created_at": "2026-11-01T10:00:00.000Z",
    "export_md_url": "/api/assistant/documents/trinity-omni-dev-studio-sprievodca/export?format=md",
    "export_pdf_url": "/api/assistant/documents/trinity-omni-dev-studio-sprievodca/export?format=pdf"
  },
  {
    "id": "trinity-meta-ai-social-manual",
    "title": "Manuál k Meta AI (Llama 3.3/3.1/3.2) a Sociálnym Účtom (Facebook & Instagram)",
    "category": "manual_doc",
    "step_name": "meta_manual",
    "actor": "Trinity Sovereign Core",
    "summary": "Príručka pre využitie Meta AI modelov cez Cloudflare Workers AI a správu Facebook stránky (underground Street collective) a Instagram profilu (@old_dirty_bastard013).",
    "content": "# Manuál k Meta AI a Sociálnemu Ekosystému\n\n## 1. Pripojené Účty\n- **Facebook Stránka:** underground Street collective\n- **Instagram Profil:** @old_dirty_bastard013\n- **OAuth Pripojenie:** https://auru.space/connect/meta\n\n## 2. Modely Meta Llama (Cloudflare Workers AI)\n- **@cf/meta/llama-3.3-70b-instruct-fp8-fast:** Hlavný kognitívny model pre zložité úlohy a tvorbu textu.\n- **@cf/meta/llama-3.1-8b-instruct-fp8-fast:** Bleskový model pre rýchle odpovede.\n- **@cf/meta/llama-3.2-11b-vision-instruct:** Vizuálny model na analýzu grafiky a screenshotov.\n\n## 3. Nástroj meta_manage\n- status: Zistí stav OAuth tokenu a pripojených účtov.\n- connect_url: Vygeneruje linku na prihlásenie.\n- ai_generate: Generovanie textu cez Llama model.\n- create_post_draft: Vytvorenie pripraveného konceptu s hashtagmi.",
    "tags": [
      "meta",
      "facebook",
      "instagram",
      "llama",
      "social"
    ],
    "receipt_id": "doc:meta:v1",
    "auto_generated": false,
    "created_at": "2026-11-01T10:00:00.000Z",
    "export_md_url": "/api/assistant/documents/trinity-meta-ai-social-manual/export?format=md",
    "export_pdf_url": "/api/assistant/documents/trinity-meta-ai-social-manual/export?format=pdf"
  },
  {
    "id": "trinity-desatoro-pravdivosti",
    "title": "Desatoro Pravdivosti a Neporušiteľný Režim Pravdy (Truth Policy 2.1.0)",
    "category": "legal_compliance",
    "step_name": "truth_policy_covenant",
    "actor": "Trinity Sovereign Core",
    "summary": "Ústavné zásady pravdovravnosti Trinity: prísny zákaz halucinácií, falšovania úspechu, povinnosť overiteľných auditných receiptov a invarianty Merkle ledgeru.",
    "content": "# Desatoro Pravdivosti Trinity (Truth Policy 2.1.0)\n\n1. **NIKDY NEKLAMAŤ A NEHALUCINOVAŤ:** Trinity nesmie nikdy vymyslieť fiktívny úspech, súbor ani stav.\n2. **POVINNOSŤ DÔKAZU (EVIDENCE-REQUIRED):** Každá vykonaná akcia musí mať auditný receipt s receipt_id.\n3. **ZÁKAZ SYNTETICKÝCH SIMULÁCIÍ:** Žiadne falošné úspešné hlášky bez skutočného vykonania.\n4. **FAIL-CLOSED ARCHITEKTÚRA:** Ak nastane chyba, Trinity ju otvorene prizná a vysvetlí príčinu.\n5. **JEDNOSMERNÝ MERKLE LEDGER:** Zápisy v ops_sovereign_ledger_v3 sú nemenné a kryptograficky viazané.\n6. **PRÍSAHA VLASTNÍKOVI:** Výhradná vernosť a oddanosť zvrchovanému majiteľovi (Basterix).",
    "tags": [
      "truth-policy",
      "desatoro",
      "pravda",
      "covenant",
      "bezpecnost"
    ],
    "receipt_id": "doc:truth:v2.1",
    "auto_generated": false,
    "created_at": "2026-11-01T10:00:00.000Z",
    "export_md_url": "/api/assistant/documents/trinity-desatoro-pravdivosti/export?format=md",
    "export_pdf_url": "/api/assistant/documents/trinity-desatoro-pravdivosti/export?format=pdf"
  },
  {
    "id": "trinity-aktualny-stav-systemu",
    "title": "Aktuálny Stav a Integračná Správa Ekosystému Trinity 11.0 (K 1. 11. 2026)",
    "category": "architecture",
    "step_name": "status_report",
    "actor": "Trinity Sovereign Core",
    "summary": "Kompletný auditný prehľad produkčného a staging stavu: vyriešenie P0/P1 bezpečnostných bodov, live testovanie Windows PC Bridge cez WhatsApp a stav Cloudflare Edge.",
    "content": "# Aktuálny Stav Trinity Sovereign OS (11.0.0 OMNI-CORE)\n\n**Dátum auditu:** 1. novembra 2026  \n**Produkcia:** auru.space (trinity Worker, D1 trinity-v03, KV Mastermind)  \n**Staging:** auru.dev (trinity-staging Worker)  \n**Host PC Daemon:** Basterix (win32, PID overený, PRISLUB overený)\n\n## Stav Bezpečnostných Opatrení\n- Odstránené 4 kritické zraniteľnosti (overovanie Google/OS tokenov, odstránenie falošného SID).\n- Durable Nonce Vault v tabuľke ops_consumed_nonces s ochranou proti replay útokom.\n- Všetkých 177 zdrojových súborov štandardizovaných pod JSDoc autoritou Basterix.\n- Úspešný End-to-End test cez https://auru.space/api/bridge s receiptom v D1 ledger blok #5.",
    "tags": [
      "stav",
      "audit",
      "overenie",
      "ledger",
      "produkcia"
    ],
    "receipt_id": "doc:status:20261101",
    "auto_generated": false,
    "created_at": "2026-11-01T10:00:00.000Z",
    "export_md_url": "/api/assistant/documents/trinity-aktualny-stav-systemu/export?format=md",
    "export_pdf_url": "/api/assistant/documents/trinity-aktualny-stav-systemu/export?format=pdf"
  }
];

function mergeSeedDocuments(items) {
  const list = Array.isArray(items) ? [...items] : [];
  const existingIds = new Set(list.map(d => d.id));
  for (const seed of SEED_COMPLIANCE_DOCUMENTS) {
    if (!existingIds.has(seed.id)) {
      list.push(seed);
    }
  }
  return list;
}


async function readDocsIndex(env) {
  if (env?.Mastermind?.get) {
    try {
      const raw = await env.Mastermind.get(DOCS_KV_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return mergeSeedDocuments(parsed);
      }
    } catch {}
  }
  if (env?.DB?.prepare) {
    try {
      const row = await env.DB.prepare("SELECT value FROM ops_memory WHERE key = ?").bind(DOCS_KV_KEY).first();
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) return mergeSeedDocuments(parsed);
      }
    } catch {}
  }
  return mergeSeedDocuments(memoryCache.get(DOCS_KV_KEY) || []);
}

async function writeDocsIndex(env, items) {
  const bounded = items.slice(0, MAX_DOCS_INDEX);
  const serialized = JSON.stringify(bounded);
  memoryCache.set(DOCS_KV_KEY, bounded);
  if (env?.Mastermind?.put) {
    try {
      await env.Mastermind.put(DOCS_KV_KEY, serialized);
    } catch {}
  }
  if (env?.DB?.prepare) {
    try {
      await env.DB.prepare(
        "INSERT INTO ops_memory(key,value,source) VALUES(?,?,'trinity-document') ON CONFLICT(key) DO UPDATE SET value=excluded.value,source='trinity-document',updated_at=datetime('now')"
      ).bind(DOCS_KV_KEY, serialized).run();
    } catch {}
  }
  return bounded;
}

export function formatStepMarkdown({
  id,
  title,
  category,
  step_name,
  actor = 'Trinity AI',
  created_at,
  summary = '',
  content = '',
  tool_log = [],
  receipt_id = null,
  tags = []
}) {
  const lines = [
    `# ${title}`,
    '',
    `- **ID dokumentu**: \`${id}\``,
    `- **Kategória**: \`${category}\``,
    `- **Krok / Operácia**: \`${step_name || 'step'}\``,
    `- **Vyhotovil**: ${actor}`,
    `- **Čas vyhotovenia**: ${created_at}`,
    ...(receipt_id ? [`- **Potvrdenie (Receipt)**: \`${receipt_id}\``] : []),
    ...(tags?.length ? [`- **Štítky**: ${tags.map(t => `\`${t}\``).join(', ')}`] : []),
    ''
  ];
  if (summary) {
    lines.push('## Zhrnutie kroku', '', summary, '');
  }
  if (content) {
    lines.push('## Detailný záznam a výstup', '', content, '');
  }
  if (Array.isArray(tool_log) && tool_log.length > 0) {
    lines.push('## Použité nástroje a dôkazy', '');
    for (const entry of tool_log) {
      lines.push(`- **${entry.tool || entry.name || 'nástroj'}**: stav \`${entry.status || 'completed'}\`${entry.receipt_id ? ` · doklad \`${entry.receipt_id}\`` : ''}`);
    }
    lines.push('');
  }
  lines.push('---', '*Automaticky vygenerované systémom Trinity Documents pri vykonaní kroku.*');
  return lines.join('\n');
}

export async function createTrinityDocument(env, actor = 'Trinity AI', input) {
  const data = createDocumentSchema.parse(input);
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const summary = data.summary || data.content.replace(/[#*`>\n]+/g, ' ').trim().slice(0, 220);
  const markdown = formatStepMarkdown({
    id,
    title: data.title,
    category: data.category,
    step_name: data.step_name,
    actor,
    created_at,
    summary,
    content: data.content,
    receipt_id: data.receipt_id || `doc:${id}`,
    tags: data.tags
  });

  const doc = {
    id,
    title: data.title,
    category: data.category,
    step_name: data.step_name || 'manual',
    actor,
    summary,
    content: data.content,
    markdown,
    tags: data.tags || [],
    receipt_id: data.receipt_id || `doc:${id}`,
    auto_generated: false,
    created_at,
    export_md_url: `/api/assistant/documents/${id}/export?format=md`,
    export_pdf_url: `/api/assistant/documents/${id}/export?format=pdf`
  };

  const existing = await readDocsIndex(env);
  await writeDocsIndex(env, [doc, ...existing.filter(item => item.id !== id)]);

  if (env?.ARTIFACTS?.put) {
    try {
      await env.ARTIFACTS.put(`documents/${id}.md`, markdown, {
        httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
        customMetadata: { id, title: data.title.slice(0, 120), category: data.category }
      });
    } catch {}
  }

  return doc;
}

export async function recordStepDocument(env, {
  title,
  category = 'workflow_step',
  step_name = 'step',
  actor = 'Trinity AI',
  summary = '',
  content = '',
  tool_log = [],
  receipt_id = null,
  tags = []
} = {}) {
  try {
    if (!env) return null;
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    const cleanTitle = String(title || 'Krok Trinity').trim().slice(0, 180);
    const cleanSummary = String(summary || content || cleanTitle).replace(/\s+/g, ' ').trim().slice(0, 260);
    const cleanContent = String(content || summary || cleanTitle).slice(0, 40000);
    const safeCategory = DOCUMENT_CATEGORIES.includes(category) ? category : 'workflow_step';
    const markdown = formatStepMarkdown({
      id,
      title: cleanTitle,
      category: safeCategory,
      step_name,
      actor,
      created_at,
      summary: cleanSummary,
      content: cleanContent,
      tool_log,
      receipt_id: receipt_id || `step:${id}`,
      tags
    });

    const doc = {
      id,
      title: cleanTitle,
      category: safeCategory,
      step_name: String(step_name || 'step').slice(0, 120),
      actor: String(actor || 'Trinity AI').slice(0, 100),
      summary: cleanSummary,
      content: cleanContent,
      markdown,
      tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
      receipt_id: receipt_id || `step:${id}`,
      auto_generated: true,
      created_at,
      export_md_url: `/api/assistant/documents/${id}/export?format=md`,
      export_pdf_url: `/api/assistant/documents/${id}/export?format=pdf`
    };

    const existing = await readDocsIndex(env);
    await writeDocsIndex(env, [doc, ...existing.filter(item => item.id !== id)]);

    if (env?.ARTIFACTS?.put) {
      try {
        await env.ARTIFACTS.put(`documents/${id}.md`, markdown, {
          httpMetadata: { contentType: 'text/markdown; charset=utf-8' }
        });
      } catch {}
    }
    return doc;
  } catch {
    return null;
  }
}

export async function listTrinityDocuments(env, { category, search, limit = 50 } = {}) {
  let items = await readDocsIndex(env);
  if (category && category !== 'all') {
    items = items.filter(item => item.category === category);
  }
  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    items = items.filter(item =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.summary || '').toLowerCase().includes(q) ||
      (item.step_name || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q)
    );
  }
  const boundedLimit = Math.max(1, Math.min(120, Number(limit) || 50));
  const sliced = items.slice(0, boundedLimit);
  return {
    auto_step_documentation: true,
    total: items.length,
    categories: DOCUMENT_CATEGORIES,
    items: sliced
  };
}

export async function getTrinityDocument(env, id) {
  const items = await readDocsIndex(env);
  const found = items.find(item => item.id === id);
  if (!found) throw new HttpError(404, 'Trinity dokument nebol nájdený.');
  return found;
}

export async function deleteTrinityDocument(env, actor, id) {
  const items = await readDocsIndex(env);
  const filtered = items.filter(item => item.id !== id);
  await writeDocsIndex(env, filtered);
  return { ok: true, deleted_id: id, total: filtered.length };
}

export function exportTrinityDocument(doc, format = 'md') {
  const safeSlug = String(doc.title || 'trinity-dokument')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'trinity-dokument';

  if (format === 'pdf') {
    const bytes = generateSimplePdf({
      title: doc.title,
      author: doc.actor || 'Trinity AI',
      content: `${doc.summary ? doc.summary + '\n\n' : ''}${doc.content || ''}`,
      date: doc.created_at ? new Date(doc.created_at).toLocaleDateString('sk-SK') : new Date().toLocaleDateString('sk-SK')
    });
    return {
      filename: `${safeSlug}.pdf`,
      contentType: 'application/pdf',
      body: bytes
    };
  }

  return {
    filename: `${safeSlug}.md`,
    contentType: 'text/markdown; charset=utf-8',
    body: doc.markdown || `# ${doc.title}\n\n${doc.content || ''}`
  };
}
