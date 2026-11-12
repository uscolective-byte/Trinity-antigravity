/**
 * @module TRINITY_OMNI_CORE
 * @subsystem COMPLIANCE_LICENSE_ANTISPAM
 * @author Basterix (Root Architect)
 * @license TRINITY-COMMERCIAL-2.0 / Sovereign Open-Core
 * @description Centrálna vrstva pre licencovanie AI platformy, právne politiky (ToS, AUP, Privacy, License, EU AI Act)
 * a aktívny Anti-Spam / Anti-Abuse / Rate-Limiting štít na Cloudflare Edge.
 */
import { z } from 'zod';
import { hash, HttpError } from './security.js';
import { SOVEREIGN_LEGAL_CHARTER_20 } from './trinity-auth-core.js';

export const POLICY_VERSION = '2026.11';
export const PLATFORM_LEGAL_ENTITY = 'Trinity AI Studio (aurU · auru.space / auru.dev)';
export const CONTACT_SECURITY_EMAIL = 'saboivan2008@gmail.com';

export const LICENSE_TIERS = Object.freeze({
  free_sandbox: {
    id: 'free_sandbox',
    name: 'Free Sandbox',
    badge: 'EVALUATION',
    max_rpm: 15,
    daily_requests_limit: 250,
    max_payload_bytes: 16_384,
    commercial_rights: false,
    description: 'Verejné testovanie s prísnym anti-spam limitom bez komerčných práv.'
  },
  pro_studio: {
    id: 'pro_studio',
    name: 'Pro AI Studio',
    badge: 'COMMERCIAL PRO',
    max_rpm: 60,
    daily_requests_limit: 5_000,
    max_payload_bytes: 131_072,
    commercial_rights: true,
    description: 'Plný komerčný prístup k AI Studiu, doménam, platobným bránam a API kľúčom.'
  },
  enterprise_sovereign: {
    id: 'enterprise_sovereign',
    name: 'Enterprise Sovereign',
    badge: 'ENTERPRISE SLA',
    max_rpm: 300,
    daily_requests_limit: 100_000,
    max_payload_bytes: 524_288,
    commercial_rights: true,
    description: 'Dedikovaný multi-model orchestrátor, audit ledger, D1/KV izolácia a vysoké kvóty.'
  },
  owner_root: {
    id: 'owner_root',
    name: 'Owner Root License',
    badge: 'ROOT SOVEREIGN',
    max_rpm: 600,
    daily_requests_limit: 1_000_000,
    max_payload_bytes: 2_097_152,
    commercial_rights: true,
    description: 'Neobmedzená správcovská licencia vlastníka systému s plnou správou jadra a PC Bridge.'
  }
});

export const TRINITY_POLICIES = Object.freeze({
  terms: {
    id: 'terms',
    code: 'TOS-2026.11',
    title: 'Podmienky používania služby (Terms of Service)',
    effective_date: '2026-11-12',
    summary: 'Záväzné pravidlá pre prístup k AI workspace Trinity, výstupom modelov, API a platobným modulom.',
    sections: [
      {
        heading: '1. Rozsah služby a oprávnený prístup',
        body: 'Platforma Trinity AI Studio (auru.space / auru.dev) poskytuje orchestráciu jazykových modelov, tvorbu webov (AI Studio), správu domén a automatizované pracovné postupy. Používateľ smie službu využívať výlučne v rámci udelenej licenčnej úrovne a platného účtu alebo API kľúča.'
      },
      {
        heading: '2. Ne-deterministická povaha AI výstupov',
        body: 'Výstupy generované jazykovými a multimediálnymi modelmi sú pravdepodobnostné. Pred použitím v právnych, finančných, medicínskych alebo produkčných systémoch je používateľ povinný overiť výsledky. Trinity uplatňuje Truth Policy v3 (zákaz vymyslených potvrdení nástrojov).'
      },
      {
        heading: '3. Pozastavenie prístupu a ochrana infraštruktúry',
        body: 'Prevádzkovateľ si vyhradzuje právo okamžite obmedziť, pozastaviť alebo zablokovať prístup (HTTP 429 / 403) pri zistení spamovania, obchádzania kvót, zneužitia API alebo porušenia Acceptable Use Policy.'
      },
      {
        heading: '4. Obmedzenie zodpovednosti',
        body: 'Služba sa poskytuje v stave „as-is“. Prevádzkovateľ nezodpovedá za nepriame škody, výpadky tretích AI poskytovateľov ani za škody spôsobené neoprávnenou automatizáciou mimo schválených politík.'
      }
    ]
  },
  aup: {
    id: 'aup',
    code: 'AUP-2026.11',
    title: 'Zásady prijateľného používania & Anti-Spam (Acceptable Use Policy)',
    effective_date: '2026-11-12',
    summary: 'Prísny zákaz automatizovaného spamovania, zahlcovania tokenov, distillácie modelov a zneužitia AI.',
    sections: [
      {
        heading: '1. Nulová tolerancia voči spamu a zahlcovaniu (Anti-Spam)',
        body: 'Je prísne zakázané vykonávať automatizované záplavové dopyty (flooding), opakované odosielanie identických promptov, token-bombing, zneužívanie verejných formulárov (escrow / kontakt / chat) na rozosielanie nevyžiadaných odkazov, phishingu alebo hromadných kampaní.'
      },
      {
        heading: '2. Zákaz extrakcie a distillácie modelov',
        body: 'Používateľ nesmie využívať výstupy Trinity na hromadný scraping, trénovanie konkurenčných modelov, reverzné inžinierstvo interných systémových promptov ani na obchádzanie kryptografických brán.'
      },
      {
        heading: '3. Zakázaný obsah a bezpečnostné zneužitie',
        body: 'Zakazuje sa generovanie malvéru, exploitov, nástrojov na útoky DDoS, podvodného obsahu, neautorizovaný prístup k cudzím účtom alebo obchádzanie bezpečnostných obmedzení (jailbreak).'
      },
      {
        heading: '4. Aktívne technické vynucovanie',
        body: 'Všetky vstupy prechádzajú kontrolou rýchlostných limitov (RPM a denné kvóty), detekciou duplicitných a opakujúcich sa payloadov, kontrolou veľkosti tela požiadavky a logovaním incidentov do ops_abuse_incidents.'
      }
    ]
  },
  privacy: {
    id: 'privacy',
    code: 'PRIVACY-GDPR-2026.11',
    title: 'Ochrana osobných údajov (Privacy Policy & GDPR)',
    effective_date: '2026-11-12',
    summary: 'Informácie o spracúvaní osobných údajov. Presné poskytovateľské, retenčné a prevádzkové údaje sa musia potvrdiť pred právnym vyhlásením súladu.',
    sections: [
      {
        heading: '1. Prevádzkovateľ a kontakt',
        body: 'Prevádzkovateľ, jeho právna identita, adresa, kontaktné údaje a prípadná zodpovedná osoba musia byť pred používaním služby potvrdené a zverejnené. Názov značky alebo e-mail v zdrojovom kóde samy osebe neurčujú právneho prevádzkovateľa.'
      },
      {
        heading: '2. Kategórie údajov a účely',
        body: 'Funkcie môžu spracúvať identifikačné a prihlasovacie údaje, obsah promptov a konverzácií, používateľské súbory/projekty, integračné údaje, bezpečnostné a auditné udalosti a údaje o platbách, ak sa daná funkcia používa. Presné polia, účel a právny základ sa určujú pre každú funkciu; nie všetky účely stoja na súhlase.'
      },
      {
        heading: '3. Poskytovatelia, prenosy a uchovávanie',
        body: 'Pri AI alebo integračných funkciách môžu byť údaje odoslané zvolenému externému poskytovateľovi. Úplný zoznam príjemcov, spracovateľov, subprocesorov, krajín, záruk transferu a retenčných lehôt sa musí zosúladiť s produkčnou konfiguráciou a zmluvami poskytovateľov. Neuvádza sa žiadna pevná lehota, kým nie je technicky a právne overená.'
      },
      {
        heading: '4. Bezpečnosť a práva',
        body: 'Používaj len doložené bezpečnostné opatrenia; ochrana sa líši podľa dátovej cesty a poskytovateľa. Dotknutá osoba môže podľa okolností uplatniť právo na prístup, opravu, výmaz, obmedzenie, prenosnosť, námietku, odvolanie súhlasu a podať sťažnosť dozornému orgánu. Žiadosť smeruj na potvrdený kontakt prevádzkovateľa. Proces, lehota odpovede a rozsah exportu/výmazu musia byť reálne zavedené.'
      },
      {
        heading: '5. Stav overenia',
        body: 'Toto rozhranie nezaručuje súlad Trinity s GDPR. Pred finálnym právnym vyhlásením treba doplniť právnu identitu prevádzkovateľa, dátový register, právne základy, lehoty, zmluvy so sprostredkovateľmi, transfery a funkčné procesy práv dotknutých osôb; finálne znenie má skontrolovať slovenský právnik.'
      }
    ]
  },
  license: {
    id: 'license',
    code: 'TRINITY-COMMERCIAL-2.0',
    title: 'Licenčná zmluva platformy (Platform & Output License)',
    effective_date: '2026-11-12',
    summary: 'Komerčné práva k výstupom z AI Studia, licenčné triedy API/workspace a ochrana jadra Trinity.',
    sections: [
      {
        heading: '1. Vlastníctvo používateľských výstupov',
        body: 'V rámci aktívnej licencie Pro AI Studio, Enterprise Sovereign alebo Owner Root vlastní používateľ alebo oprávnený zadávateľ generované webové projekty, HTML/CSS šablóny, dokumenty a kód vytvorený pre jeho úlohy.'
      },
      {
        heading: '2. Licencia jadra Trinity (Dual Open-Core / Commercial)',
        body: 'Bezpečnostné jadro, orchestrátor, licenčný modul a interné konektory podliehajú vlastnej licencii vlastníka platformy. Šírenie bez platnej licencie alebo odstraňovanie licenčných a truth-policy hlavičiek je zakázané.'
      },
      {
        heading: '3. Vynucovanie licenčných kvót',
        body: 'Každý API kľúč (trn_live_*) a licenčný grant (trn_lic_*) nesie presnú definíciu max_rpm, denného limitu požiadaviek a povolených rozsahov (scopes).'
      }
    ]
  },
  ai_act: {
    id: 'ai_act',
    code: 'EU-AI-ACT-NOTICE-2026',
    title: 'Transparencia AI & Súlad s EU AI Act',
    effective_date: '2026-11-12',
    summary: 'Povinné označenie interakcie s AI, dohľad človeka nad citlivými akciami a overiteľný audit.',
    sections: [
      {
        heading: '1. Jasná identifikácia AI systému',
        body: 'Používateľ je vždy explicitne informovaný, že komunikuje s automatizovaným AI systémom (Trinity). Všetky odpovede môžu kombinovať viacero modelových backendov podľa smerovania.'
      },
      {
        heading: '2. Človek v slučke (Human-in-the-Loop)',
        body: 'Citlivé systémové príkazy na hostiteľskom PC, finančné prevody, zmeny DNS a udeľovanie prístupov vyžadujú autorizáciu oprávneného vlastníka/administrátora a kryptografický záznam v D1 ledgeri.'
      }
    ]
  }
  ,architecture: {
    id: 'architecture',
    code: 'TRINITY-ARCHITECTURE',
    title: 'Architektúra Trinity a prevádzkové hranice',
    effective_date: 'Technický opis · aktualizované 2026-11-12',
    summary: 'Mapa runtime, rozhraní, dátových služieb, integrácií, bezpečnosti a toho, čo musí byť osobitne overené.',
    sections: [
      { heading: 'Runtime a prostredia', body: 'Hlavným zdrojom je Trinity Worker a jeho wrangler konfigurácia. Produkcia, vývoj a lokálne spustenie sú samostatné režimy. Konfigurácia, build dry-run alebo service binding nepreukazuje, že cieľový Worker žije alebo je dostupný.' },
      { heading: 'Aplikačné vrstvy', body: 'HTTP/API a UI obsluhuje Trinity runtime; orchestration a tools vyberajú modely a vykonávajú povolené operácie; D1/KV/R2 a workflow poskytujú úložisko a úlohy; konektory volajú externé služby; Local Gateway/PC Bridge vykonávajú samostatne autorizované lokálne operácie.' },
      { heading: 'Autorizácia a dôkazy', body: 'Každá požiadavka sa validuje na serveri. Rola používateľa sama osebe neznamená, že každá integrácia alebo write akcia je dostupná. Úspech sa deklaruje len po potvrdenom dôkaze z cieľového systému; návrh, enqueue, lokálny dry-run ani deklarovaný binding nie sú potvrdením vykonania.' },
      { heading: 'Dáta a tajomstvá', body: 'Tajomstvá patria do Cloudflare Secrets/Secrets Store alebo aplikáciou šifrovaného vaultu, nie do Gitu, logov ani dokumentácie. Reálne retention, regióny, poskytovatelia a prenosy sa určujú z produkčnej konfigurácie a zmlúv; technická architektúra ich sama nepotvrdzuje.' },
      { heading: 'Výpadky a rollback', body: 'Pri nedostupnom providerovi, databáze, gateway alebo chýbajúcom dôkaze sa výsledok označí ako zlyhaný alebo nepotvrdený. Produkčná zmena musí mať commit SHA, cieľ, kontroly, migrácie a cestu rollbacku.' },
      { heading: 'Podrobný technický opis', body: 'Zdrojový dokument je v repozitári: docs/architecture/trinity-complete-architecture.md. Právne a súkromné otázky sú rozpracované v Trinity/docs/PRAVNE-A-SUKROMIE-POUZITIE-AUDIT.md; tieto podklady nie sú vyhlásením o právnom súlade.' }
    ]
  }
});

// In-memory fallback structures for stateless/unit-test environments without full D1 tables.
const memWindowBuckets = new Map();
const memDuplicateFingerprints = new Map();
const memAbuseBans = new Map();

const SPAM_KEYWORD_PATTERNS = [
  /(?:viagra|cialis|casino\s+bonus|free\s+crypto\s+airdrop|claim\s+your\s+usdt|seed\s+phrase\s+recovery|wire\s+transfer\s+urgent)/i,
  /(?:<script\b|javascript:|onerror\s*=|union\s+all\s+select|drop\s+table\s+ops_)/i
];

export function clientIpFromRequest(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'local-loopback'
  );
}

/**
 * Rýchla deterministická kontrola promptu proti spamu, token-bombingu a automatizovaným útokom.
 */
export function inspectPromptAbuse(rawText, { maxChars = 16000, maxUrls = 10 } = {}) {
  const text = typeof rawText === 'string' ? rawText : '';
  if (!text.trim()) return { ok: true, flags: [] };
  const flags = [];
  if (text.length > maxChars) {
    return { ok: false, severity: 'high', reason: `Text prekračuje povolený bezpečnostný limit (${maxChars} znakov).`, flags: ['payload_too_large'] };
  }
  // Jeden znak opakovaný 180+ krát za sebou
  if (/(.)\1{179,}/s.test(text)) {
    return { ok: false, severity: 'medium', reason: 'Detekovaný šumový reťazec opakujúcich sa znakov.', flags: ['char_flood'] };
  }
  // Opakovaný identický blok >= 14 znakov aspoň 10-krát za sebou (token bombing / padding flood)
  if (/(.{14,64})\1{9,}/s.test(text)) {
    return { ok: false, severity: 'high', reason: 'Detekovaný opakujúci sa spamový vzor (token flooding).', flags: ['repetition_flood'] };
  }
  const urlMatches = text.match(/https?:\/\/[^\s]+/gi) || [];
  if (urlMatches.length > maxUrls) {
    return { ok: false, severity: 'high', reason: `Príliš veľa externých odkazov v jednej správe (${urlMatches.length} > ${maxUrls}).`, flags: ['url_spam'] };
  }
  for (const rx of SPAM_KEYWORD_PATTERNS) {
    if (rx.test(text)) {
      return { ok: false, severity: 'high', reason: 'Obsah bol zablokovaný bezpečnostným filtrom (AUP / Anti-Spam).', flags: ['aup_blocked_pattern'] };
    }
  }
  return { ok: true, flags };
}

/**
 * Kontrola verejného escrow / kontaktného formulára proti botom a odkazovému spamu.
 */
export function inspectEscrowInquirySpam(body = {}) {
  // Honeypot pasca pre botov
  if (body.website || body.company_url || body._hp || body.hp_field) {
    return { ok: false, severity: 'high', reason: 'Požiadavka neprešla anti-bot kontrolou (honeypot).' };
  }
  const notes = String(body.buyer_notes || '');
  const urls = notes.match(/https?:\/\/[^\s]+/gi) || [];
  if (urls.length > 2) {
    return { ok: false, severity: 'medium', reason: 'Poznámka obsahuje nepovolené množstvo externých odkazov.' };
  }
  const promptCheck = inspectPromptAbuse(`${body.domain_name || ''} ${notes}`, { maxChars: 2000, maxUrls: 2 });
  if (!promptCheck.ok) return promptCheck;
  return { ok: true };
}

async function consumeSlidingQuota(env, bucketKey, maxRpm, windowSeconds = 60) {
  const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
  if (env?.DB?.prepare) {
    try {
      const row = await env.DB.prepare(
        `INSERT INTO ops_limits(key, window, count) VALUES (?, ?, 1)
         ON CONFLICT(key) DO UPDATE SET window=excluded.window,
         count=CASE WHEN ops_limits.window=excluded.window THEN ops_limits.count+1 ELSE 1 END
         RETURNING count`
      ).bind(bucketKey, windowId).first();
      if (row && Number.isFinite(Number(row.count))) {
        return Number(row.count);
      }
    } catch {
      // Fallback na in-memory počítadlo v unit testoch alebo bez migrácie
    }
  }
  const memKey = `${bucketKey}:${windowId}`;
  const nextCount = (memWindowBuckets.get(memKey) || 0) + 1;
  memWindowBuckets.set(memKey, nextCount);
  if (memWindowBuckets.size > 5000) {
    const firstKey = memWindowBuckets.keys().next().value;
    if (firstKey) memWindowBuckets.delete(firstKey);
  }
  return nextCount;
}

async function incrementDailyUsage(env, actorKey, dailyLimit, blocked = false) {
  const day = new Date().toISOString().slice(0, 10);
  const usageKey = `${actorKey}:${day}`;
  if (!env?.DB?.prepare) {
    return { count: 1, limit: dailyLimit, enforced: false };
  }
  try {
    const row = await env.DB.prepare(
      `INSERT INTO ops_daily_usage(usage_key, request_count, blocked_count, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(usage_key) DO UPDATE SET
         request_count = ops_daily_usage.request_count + excluded.request_count,
         blocked_count = ops_daily_usage.blocked_count + excluded.blocked_count,
         updated_at = datetime('now')
       RETURNING request_count, blocked_count`
    ).bind(usageKey, blocked ? 0 : 1, blocked ? 1 : 0).first();
    return {
      count: Number(row?.request_count || 1),
      blocked_count: Number(row?.blocked_count || 0),
      limit: dailyLimit,
      enforced: true
    };
  } catch {
    return { count: 1, limit: dailyLimit, enforced: false };
  }
}

export async function recordAbuseIncident(env, { actorHash, route, reason, severity = 'medium', banSeconds = 0, sample = '' }) {
  const blockedUntil = banSeconds > 0 ? Date.now() + banSeconds * 1000 : null;
  if (blockedUntil) {
    memAbuseBans.set(actorHash, blockedUntil);
    if (env?.Mastermind?.put) {
      await env.Mastermind.put(`shield:ban:${actorHash}`, JSON.stringify({ blockedUntil, reason, route }), {
        expirationTtl: Math.max(60, Math.min(86400, banSeconds))
      }).catch(() => {});
    }
  }
  if (env?.DB?.prepare) {
    try {
      await env.DB.prepare(
        `INSERT INTO ops_abuse_incidents(id, actor_hash, route, reason, severity, blocked_until, sample_snippet)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        actorHash,
        String(route || '/').slice(0, 160),
        String(reason || 'Abuse detected').slice(0, 400),
        severity,
        blockedUntil,
        String(sample || '').slice(0, 240)
      ).run();
    } catch {}
  }
}

async function isActorBanned(env, actorHash) {
  const memUntil = memAbuseBans.get(actorHash);
  if (memUntil && memUntil > Date.now()) {
    return Math.ceil((memUntil - Date.now()) / 1000);
  }
  memAbuseBans.delete(actorHash);
  if (env?.Mastermind?.get) {
    try {
      const raw = await env.Mastermind.get(`shield:ban:${actorHash}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.blockedUntil > Date.now()) {
          return Math.ceil((parsed.blockedUntil - Date.now()) / 1000);
        }
      }
    } catch {}
  }
  if (env?.DB?.prepare) {
    try {
      const row = await env.DB.prepare(
        'SELECT blocked_until FROM ops_abuse_incidents WHERE actor_hash=? AND blocked_until > ? ORDER BY blocked_until DESC LIMIT 1'
      ).bind(actorHash, Date.now()).first();
      if (row?.blocked_until && row.blocked_until > Date.now()) {
        return Math.ceil((row.blocked_until - Date.now()) / 1000);
      }
    } catch {}
  }
  return 0;
}

/**
 * Zistí aktívnu licenčnú triedu pre požiadavku (Owner/Admin, X-Trinity-License grant, alebo Free Sandbox).
 */
export async function resolveLicenseContext(request, env, user = null) {
  const headerLicense = request?.headers?.get('X-Trinity-License')?.trim();
  if (headerLicense && headerLicense.startsWith('trn_lic_') && env?.DB?.prepare) {
    try {
      const row = await env.DB.prepare(
        `SELECT * FROM ops_license_grants
         WHERE license_key_hash=? AND status='active' AND (expires_at IS NULL OR julianday(expires_at)>julianday('now'))`
      ).bind(await hash(headerLicense)).first();
      if (row) {
        const tierMeta = LICENSE_TIERS[row.tier] || LICENSE_TIERS.pro_studio;
        return {
          tier: row.tier,
          tier_name: tierMeta.name,
          badge: tierMeta.badge,
          license_id: row.id,
          license_prefix: row.license_prefix,
          license_type: row.license_type,
          max_rpm: row.max_rpm || tierMeta.max_rpm,
          daily_requests_limit: row.daily_requests_limit || tierMeta.daily_requests_limit,
          max_payload_bytes: row.max_payload_bytes || tierMeta.max_payload_bytes,
          commercial_rights: row.commercial_rights === 1,
          authenticated: true,
          subject: row.subject_id
        };
      }
    } catch {}
  }

  if (user && ['owner', 'admin'].includes(user.role)) {
    const tier = user.role === 'owner' ? LICENSE_TIERS.owner_root : LICENSE_TIERS.pro_studio;
    return {
      tier: tier.id,
      tier_name: tier.name,
      badge: tier.badge,
      license_id: `role:${user.role}`,
      license_prefix: user.role === 'owner' ? 'trn_root_sovereign' : 'trn_admin_pro',
      license_type: 'TRINITY-COMMERCIAL-2.0',
      max_rpm: tier.max_rpm,
      daily_requests_limit: tier.daily_requests_limit,
      max_payload_bytes: tier.max_payload_bytes,
      commercial_rights: tier.commercial_rights,
      authenticated: true,
      subject: user.email || user.id
    };
  }

  if (user && user.role && user.role !== 'guest') {
    const tier = LICENSE_TIERS.pro_studio;
    return {
      tier: tier.id,
      tier_name: tier.name,
      badge: tier.badge,
      license_id: `user:${user.id}`,
      license_prefix: 'trn_user_pro',
      license_type: 'TRINITY-COMMERCIAL-2.0',
      max_rpm: tier.max_rpm,
      daily_requests_limit: tier.daily_requests_limit,
      max_payload_bytes: tier.max_payload_bytes,
      commercial_rights: tier.commercial_rights,
      authenticated: true,
      subject: user.email || user.id
    };
  }

  const sandbox = LICENSE_TIERS.free_sandbox;
  return {
    tier: sandbox.id,
    tier_name: sandbox.name,
    badge: sandbox.badge,
    license_id: 'public-sandbox',
    license_prefix: 'trn_sandbox_public',
    license_type: 'TRINITY-SANDBOX-EVALUATION',
    max_rpm: sandbox.max_rpm,
    daily_requests_limit: sandbox.daily_requests_limit,
    max_payload_bytes: sandbox.max_payload_bytes,
    commercial_rights: false,
    authenticated: false,
    subject: 'guest'
  };
}

/**
 * Overí Cloudflare Turnstile token, ak je nastavený TURNSTILE_SECRET_KEY a volajúci nie je prihlásený admin/owner.
 */
export async function verifyTurnstileIfConfigured(request, env, body = {}, user = null) {
  if (!env?.TURNSTILE_SECRET_KEY) return { checked: false, ok: true };
  if (user && ['owner', 'admin', 'user'].includes(user.role)) return { checked: false, ok: true };
  const token = String(
    body?.turnstile_token ||
    body?.['cf-turnstile-response'] ||
    request.headers.get('CF-Turnstile-Response') ||
    ''
  ).trim();
  if (!token) {
    throw new HttpError(403, 'Vyžaduje sa overenie anti-bot (Cloudflare Turnstile).');
  }
  const form = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
    remoteip: clientIpFromRequest(request)
  });
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form
  }).catch(() => null);
  const data = await res?.json().catch(() => null);
  if (!data?.success) {
    throw new HttpError(403, 'Anti-bot overenie (Turnstile) zlyhalo.');
  }
  return { checked: true, ok: true };
}

/**
 * Hlavná ochranná brána Anti-Spam & License Quota pre chat, formuláre a verejné AI endpointy.
 */
export async function enforceAntiSpamShield(request, env, {
  route = '/',
  user = null,
  promptText = '',
  maxRpmOverride = null,
  windowSeconds = 60,
  detectDuplicates = true
} = {}) {
  const ip = clientIpFromRequest(request);
  const actorIdentity = user?.email || user?.id || ip;
  const actorHash = (await hash(String(actorIdentity))).slice(0, 24);
  const license = await resolveLicenseContext(request, env, user);

  const retryBan = await isActorBanned(env, actorHash);
  if (retryBan > 0) {
    throw new HttpError(429, `Prístup dočasne pozastavený pre ochranu proti spamu. Skús znova o ${retryBan} s.`);
  }

  const maxRpm = maxRpmOverride || license.max_rpm;
  const bucketKey = `shield:${route}:${actorHash}`;
  const currentCount = await consumeSlidingQuota(env, bucketKey, maxRpm, windowSeconds);
  const remaining = Math.max(0, maxRpm - currentCount);

  if (currentCount > maxRpm) {
    await incrementDailyUsage(env, actorHash, license.daily_requests_limit, true);
    if (currentCount > maxRpm + 5) {
      await recordAbuseIncident(env, {
        actorHash,
        route,
        reason: `Rate limit burst (${currentCount}/${maxRpm} za ${windowSeconds}s)`,
        severity: 'high',
        banSeconds: 180
      });
    }
    throw new HttpError(429, `Prekročený limit požiadaviek (${maxRpm}/${windowSeconds}s pre licenciu ${license.tier_name}). Skús o chvíľu.`);
  }

  const daily = await incrementDailyUsage(env, actorHash, license.daily_requests_limit, false);
  if (daily.enforced && daily.count > license.daily_requests_limit) {
    throw new HttpError(429, `Denná kvóta licencie (${license.daily_requests_limit} požiadaviek) bola vyčerpaná.`);
  }

  if (promptText) {
    const abuse = inspectPromptAbuse(promptText, {
      maxChars: Math.min(48000, Math.floor(license.max_payload_bytes / 2)),
      maxUrls: license.authenticated ? 20 : 6
    });
    if (!abuse.ok) {
      await recordAbuseIncident(env, {
        actorHash,
        route,
        reason: abuse.reason,
        severity: abuse.severity,
        banSeconds: license.authenticated ? 0 : 300,
        sample: promptText.slice(0, 200)
      });
      throw new HttpError(400, abuse.reason);
    }

    if (detectDuplicates && !license.authenticated && promptText.trim().length > 8) {
      const fp = (await hash(`${actorHash}:${route}:${promptText.trim().toLowerCase()}`)).slice(0, 24);
      const now = Date.now();
      const prev = memDuplicateFingerprints.get(fp);
      const recentHits = prev && (now - prev.ts < 60_000) ? prev.hits + 1 : 1;
      memDuplicateFingerprints.set(fp, { ts: now, hits: recentHits });
      if (memDuplicateFingerprints.size > 4000) {
        const first = memDuplicateFingerprints.keys().next().value;
        if (first) memDuplicateFingerprints.delete(first);
      }
      if (recentHits > 4) {
        await recordAbuseIncident(env, {
          actorHash,
          route,
          reason: 'Opakované spamovanie identického promptu',
          severity: 'high',
          banSeconds: 240,
          sample: promptText.slice(0, 180)
        });
        throw new HttpError(429, 'Detekované opakované spamovanie identickej požiadavky. Prístup bol dočasne obmedzený.');
      }
    }
  }

  return {
    ok: true,
    actorHash,
    license,
    rateLimitHeaders: {
      'X-RateLimit-Limit': String(maxRpm),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Policy': `${maxRpm};w=${windowSeconds};tier="${license.tier}"`,
      'X-Trinity-License-Tier': license.tier,
      'X-Trinity-Policy-Version': POLICY_VERSION
    }
  };
}

export function withRateLimitHeaders(response, shieldHeaders = {}) {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(shieldHeaders || {})) {
    out.headers.set(k, String(v));
  }
  out.headers.set('X-Content-Type-Options', 'nosniff');
  return out;
}

export const issueLicenseSchema = z.object({
  subject_id: z.string().trim().min(2).max(160),
  tier: z.enum(['free_sandbox', 'pro_studio', 'enterprise_sovereign', 'owner_root']).default('pro_studio'),
  expires_days: z.number().int().min(1).max(3650).nullable().optional().default(365)
}).strict();

export async function issueLicenseGrant(env, issuedBy, input) {
  if (!env?.DB?.prepare) throw new HttpError(503, 'Databáza D1 nie je pripojená.');
  const data = issueLicenseSchema.parse(input);
  const tierMeta = LICENSE_TIERS[data.tier];
  const material = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
  const key = `trn_lic_${material}`;
  const prefix = key.slice(0, 16);
  const id = crypto.randomUUID();
  const expiresAt = data.expires_days ? new Date(Date.now() + data.expires_days * 86_400_000).toISOString() : null;
  const row = await env.DB.prepare(
    `INSERT INTO ops_license_grants
      (id, subject_id, license_key_hash, license_prefix, tier, license_type, max_rpm, daily_requests_limit, max_payload_bytes, commercial_rights, status, issued_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
     RETURNING id, subject_id, license_prefix, tier, license_type, max_rpm, daily_requests_limit, max_payload_bytes, commercial_rights, status, issued_by, expires_at, created_at`
  ).bind(
    id,
    data.subject_id,
    await hash(key),
    prefix,
    tierMeta.id,
    'TRINITY-COMMERCIAL-2.0',
    tierMeta.max_rpm,
    tierMeta.daily_requests_limit,
    tierMeta.max_payload_bytes,
    tierMeta.commercial_rights ? 1 : 0,
    issuedBy || 'owner',
    expiresAt
  ).first();
  return { ...row, commercial_rights: row.commercial_rights === 1, license_key: key, visible_once: true };
}

export async function listLicenseGrants(env) {
  if (!env?.DB?.prepare) return [];
  try {
    const res = await env.DB.prepare(
      `SELECT id, subject_id, license_prefix, tier, license_type, max_rpm, daily_requests_limit, commercial_rights, status, issued_by, expires_at, created_at
       FROM ops_license_grants ORDER BY created_at DESC LIMIT 50`
    ).all();
    return (res.results || []).map((r) => ({ ...r, commercial_rights: r.commercial_rights === 1 }));
  } catch {
    return [];
  }
}

export async function revokeLicenseGrant(env, id) {
  if (!env?.DB?.prepare) throw new HttpError(503, 'Databáza D1 nie je pripojená.');
  const row = await env.DB.prepare(
    `UPDATE ops_license_grants SET status='revoked', updated_at=datetime('now') WHERE id=? AND status='active' RETURNING id, subject_id, license_prefix, status`
  ).bind(id).first();
  if (!row) throw new HttpError(404, 'Aktívna licencia s týmto ID neexistuje.');
  return row;
}

export async function recordPolicyAcceptance(request, env, actorId, docs = ['terms', 'aup', 'privacy', 'license', 'ai_act']) {
  const validDocs = Array.isArray(docs) ? docs.filter((d) => Boolean(TRINITY_POLICIES[d])) : ['terms', 'aup', 'privacy', 'license'];
  const id = crypto.randomUUID();
  const ipHash = (await hash(clientIpFromRequest(request))).slice(0, 24);
  const userAgent = String(request.headers.get('User-Agent') || '').slice(0, 180);
  if (env?.DB?.prepare) {
    try {
      await env.DB.prepare(
        `INSERT INTO ops_policy_acceptances(id, actor_id, policy_version, document_codes_json, ip_hash, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, actorId, POLICY_VERSION, JSON.stringify(validDocs), ipHash, userAgent).run();
    } catch {}
  }
  return {
    ok: true,
    acceptance_id: id,
    actor_id: actorId,
    policy_version: POLICY_VERSION,
    documents: validDocs,
    accepted_at: new Date().toISOString()
  };
}

export async function getShieldStatus(env) {
  const summary = {
    shield_active: true,
    policy_version: POLICY_VERSION,
    turnstile_configured: Boolean(env?.TURNSTILE_SECRET_KEY),
    strict_mode: env?.STRICT_MODE !== 'false',
    license_tiers: Object.values(LICENSE_TIERS),
    legal_charter_count: SOVEREIGN_LEGAL_CHARTER_20.length,
    incidents_recent: [],
    active_bans: 0,
    active_licenses_count: 0,
    policy_acceptances_count: 0
  };
  if (!env?.DB?.prepare) return summary;
  try {
    const [incidents, bans, licenses, acceptances] = await Promise.all([
      env.DB.prepare('SELECT id, actor_hash, route, reason, severity, blocked_until, created_at FROM ops_abuse_incidents ORDER BY created_at DESC LIMIT 20').all(),
      env.DB.prepare('SELECT COUNT(*) AS cnt FROM ops_abuse_incidents WHERE blocked_until > ?').bind(Date.now()).first(),
      env.DB.prepare("SELECT COUNT(*) AS cnt FROM ops_license_grants WHERE status='active'").first(),
      env.DB.prepare('SELECT COUNT(*) AS cnt FROM ops_policy_acceptances WHERE policy_version=?').bind(POLICY_VERSION).first()
    ]);
    summary.incidents_recent = incidents?.results || [];
    summary.active_bans = Number(bans?.cnt || 0);
    summary.active_licenses_count = Number(licenses?.cnt || 0);
    summary.policy_acceptances_count = Number(acceptances?.cnt || 0);
  } catch {}
  return summary;
}

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Vygeneruje verejné právne, licenčné a architektonické stránky.
 */
export function renderLegalHtml({ docId = 'legal', host = 'auru.space', version = '13.0.0' } = {}) {
  const safeHost = esc(host);
  const doc = TRINITY_POLICIES[docId] || null;
  const navItems = [
    { href: '/legal', id: 'legal', label: 'Prehľad & Licencie' },
    { href: '/terms', id: 'terms', label: 'Podmienky (ToS)' },
    { href: '/aup', id: 'aup', label: 'Anti-Spam & AUP' },
    { href: '/privacy', id: 'privacy', label: 'Súkromie (GDPR)' },
    { href: '/license', id: 'license', label: 'Licencia' },
    { href: '/security-policy', id: 'ai_act', label: 'AI Act & Bezpečnosť' },
    { href: '/architecture', id: 'architecture', label: 'Architektúra' }
  ];

  const mainContent = doc
    ? `<article class="doc-card">
        <aside class="review-notice"><strong>Stav právneho overenia:</strong> texty sa zosúlaďujú s aktuálnym správaním a zmluvnými údajmi. Zverejnenie tejto stránky samo osebe nepotvrdzuje právny súlad. Pred záväzným používaním treba doplniť a overiť chýbajúce údaje prevádzkovateľa, spracovateľov a obchodného modelu.</aside>
        <div class="doc-meta">
          <span class="pill">${esc(doc.code)}</span>
          <span>Účinnosť od ${esc(doc.effective_date)}</span>
          <span>Verzia politík ${esc(POLICY_VERSION)}</span>
        </div>
        <h1>${esc(doc.title)}</h1>
        <p class="lead">${esc(doc.summary)}</p>
        <div class="sections">
          ${doc.sections.map((s) => `<section><h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p></section>`).join('')}
        </div>
      </article>`
    : `<article class="doc-card">
        <aside class="review-notice"><strong>Stav právneho overenia:</strong> portál je prehľadom aktuálnych technických/politických textov, nie potvrdením súladu. Údaje o prevádzkovateľovi, poskytovateľoch, retenčných lehotách, transferoch a právach spotrebiteľa musia byť overené voči reálnej prevádzke a zmluvám.</aside>
        <div class="doc-meta">
          <span class="pill">GOVERNANCE · ${esc(POLICY_VERSION)}</span>
          <span>${esc(PLATFORM_LEGAL_ENTITY)}</span>
        </div>
        <h1>Právny rámec, Licencie &amp; Anti-Spam Ochrana Trinity</h1>
        <p class="lead">Kompletná právna a technická dokumentácia produkčnej AI platformy na doménach <code>${safeHost}</code>.</p>
        <div class="grid">
          ${Object.values(TRINITY_POLICIES).map((p) => {
            const path = p.id === 'ai_act' ? '/security-policy' : `/${p.id}`;
            return `<a class="card" href="${path}">
              <span class="code">${esc(p.code)}</span>
              <h2>${esc(p.title)}</h2>
              <p>${esc(p.summary)}</p>
            </a>`;
          }).join('')}
        </div>
        <h2 class="subhead">Licenčné úrovne &amp; Anti-Spam kvóty</h2>
        <div class="tiers">
          ${Object.values(LICENSE_TIERS).map((tier) => `<div class="tier">
            <span class="pill">${esc(tier.badge)}</span>
            <h3>${esc(tier.name)}</h3>
            <p>${esc(tier.description)}</p>
            <ul>
              <li>Limit rýchlosti: <strong>${tier.max_rpm} req/min</strong></li>
              <li>Denný limit: <strong>${tier.daily_requests_limit.toLocaleString('en-US')} req/deň</strong></li>
              <li>Max payload: <strong>${Math.round(tier.max_payload_bytes / 1024)} KB</strong></li>
              <li>Komerčné práva: <strong>${tier.commercial_rights ? 'Áno' : 'Iba testovanie'}</strong></li>
            </ul>
          </div>`).join('')}
        </div>
      </article>`;

  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Trinity · Licencie &amp; Politiky (${esc(version)})</title>
  <style>
    :root { --bg:#09090b; --surface:#111114; --card:#16161a; --line:rgba(255,255,255,0.09); --ink:#fafafa; --muted:#a1a1aa; --accent:#6366f1; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:var(--bg); color:var(--ink); font-family:Inter,"Segoe UI",system-ui,sans-serif; line-height:1.65; padding:24px 18px 64px; -webkit-font-smoothing:antialiased; }
    .wrap { max-width:980px; margin:0 auto; }
    .topbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; padding:12px 16px; border:1px solid var(--line); border-radius:12px; background:var(--surface); margin-bottom:20px; }
    .brand { display:flex; align-items:center; gap:10px; color:var(--ink); text-decoration:none; font-weight:600; font-size:14px; }
    .mark { width:28px; height:28px; border-radius:8px; background:var(--accent); display:grid; place-items:center; font-weight:700; color:#fff; }
    .nav { display:flex; flex-wrap:wrap; gap:6px; }
    .nav a { text-decoration:none; color:var(--muted); font-size:12.5px; padding:6px 10px; border-radius:8px; border:1px solid transparent; transition:.15s ease; }
    .nav a:hover, .nav a.active { color:var(--ink); background:rgba(255,255,255,0.06); border-color:var(--line); }
    .doc-card { background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:32px; }
    .review-notice { margin-bottom:22px; padding:14px 16px; border:1px solid rgba(251,191,36,.35); border-radius:10px; background:rgba(251,191,36,.08); color:#fde68a; font-size:13px; }
    .doc-meta { display:flex; flex-wrap:wrap; gap:12px; align-items:center; font-size:12px; color:var(--muted); margin-bottom:14px; }
    .pill { display:inline-block; padding:3px 9px; border-radius:999px; font:600 11px/1.2 ui-monospace,Consolas,monospace; background:rgba(99,102,241,0.16); color:#a5b4fc; border:1px solid rgba(99,102,241,0.3); }
    h1 { font-size:clamp(24px,3.2vw,32px); letter-spacing:-0.025em; margin-bottom:10px; }
    .lead { color:var(--muted); font-size:15px; margin-bottom:26px; }
    .sections { display:grid; gap:18px; }
    .sections section { padding:18px 20px; border-radius:12px; background:var(--card); border:1px solid var(--line); }
    .sections h2 { font-size:15px; margin-bottom:6px; color:#f4f4f5; }
    .sections p { font-size:13.8px; color:var(--muted); }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:12px; margin-bottom:28px; }
    .card { display:block; text-decoration:none; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:18px; transition:.15s ease; }
    .card:hover { border-color:rgba(99,102,241,0.5); transform:translateY(-1px); }
    .card .code { font:600 11px ui-monospace,Consolas,monospace; color:#a5b4fc; }
    .card h2 { font-size:15px; color:var(--ink); margin:6px 0; }
    .card p { font-size:13px; color:var(--muted); }
    .subhead { font-size:18px; margin-bottom:14px; }
    .tiers { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px; }
    .tier { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:18px; }
    .tier h3 { font-size:15px; margin:10px 0 6px; }
    .tier p { font-size:12.5px; color:var(--muted); margin-bottom:12px; }
    .tier ul { list-style:none; font-size:12.5px; color:#d4d4d8; display:grid; gap:5px; }
    footer { margin-top:24px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; font-size:12px; color:var(--muted); }
    footer a { color:#a5b4fc; text-decoration:none; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="topbar">
      <a href="/" class="brand"><span class="mark">T</span><span>Trinity AI Studio</span></a>
      <nav class="nav">
        ${navItems.map((n) => `<a href="${n.href}" class="${n.id === docId ? 'active' : ''}">${n.label}</a>`).join('')}
      </nav>
    </header>
    ${mainContent}
    <footer>
      <span>&copy; 2026 ${esc(PLATFORM_LEGAL_ENTITY)} · Anti-Spam &amp; Rate Limiting Active</span>
      <span><a href="/">Späť do Workspace</a> · <a href="/landing">Platform Overview</a></span>
    </footer>
  </div>
</body>
</html>`;
}
