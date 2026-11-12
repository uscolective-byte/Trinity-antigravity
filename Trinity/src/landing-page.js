/**
 * @module TRINITY_OMNI_CORE
 * @subsystem PUBLIC_LANDING_PAGE
 * @author Basterix (Root Architect)
 * @license TRINITY-COMMERCIAL-2.0 / Sovereign Open-Core
 * @description Verejná prezentačná stránka Trinity AI Studio v modernom Linear / Claude Obsidian dizajne s prehľadom licencií, politík a anti-spam ochrany.
 */
import { LICENSE_TIERS, POLICY_VERSION } from './compliance-shield.js';

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderLandingHtml({
  host = 'auru.space',
  environment = 'production',
  version = '13.0.0'
} = {}) {
  const safeHost = escapeHtml(host);
  const safeVer = escapeHtml(String(version).split('.').slice(0, 2).join('.') || '13.0');
  const envLabel = String(environment || 'production').toUpperCase();
  const envBadge = `${escapeHtml(envLabel)} · ${safeHost.toUpperCase()}`;

  const tiers = [LICENSE_TIERS.free_sandbox, LICENSE_TIERS.pro_studio, LICENSE_TIERS.enterprise_sovereign];

  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#0b0d12">
  <title>Trinity ${safeVer} · AI Studio Platform</title>
  <style>
    :root {
      --bg: #0b0d12;
      --surface: #11131a;
      --card: #161923;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --accent-soft: rgba(99, 102, 241, 0.14);
      --emerald: #10b981;
      --line: rgba(255, 255, 255, 0.08);
      --line-bright: rgba(255, 255, 255, 0.16);
      --ink: #fafafa;
      --muted: #a1a1aa;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(ellipse 75% 45% at 50% -12%, rgba(99, 102, 241, 0.18), transparent),
        var(--bg);
      line-height: 1.6;
      padding: 20px 18px 64px;
      -webkit-font-smoothing: antialiased;
    }
    .wrap { max-width: 1120px; margin: 0 auto; }
    .topbar {
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;
      padding: 12px 18px; background: rgba(17, 19, 26, 0.86); backdrop-filter: blur(12px);
      border: 1px solid var(--line); border-radius: 14px;
    }
    .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--ink); }
    .mark {
      width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; font: 700 15px/1 inherit;
    }
    .brand b { display: block; font: 600 14.5px/1.2 inherit; letter-spacing: -0.01em; }
    .brand small { display: block; font: 500 10px/1.3 ui-monospace, Consolas, monospace; color: var(--muted); letter-spacing: .08em; }
    .topnav { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .topnav a {
      text-decoration: none; color: var(--muted); font-size: 13px; padding: 6px 10px; border-radius: 8px; transition: .15s ease;
    }
    .topnav a:hover { color: var(--ink); background: rgba(255, 255, 255, 0.05); }
    .badge {
      padding: 5px 10px; font: 600 11px/1 ui-monospace, Consolas, monospace; border-radius: 999px;
      background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.28);
    }
    .hero {
      margin-top: 24px; padding: 52px 40px 44px; border-radius: 18px;
      background: linear-gradient(180deg, rgba(22, 25, 35, 0.92), rgba(17, 19, 26, 0.96));
      border: 1px solid var(--line);
      display: grid; grid-template-columns: 1.25fr 0.85fr; gap: 36px; align-items: center;
    }
    .tag {
      display: inline-flex; align-items: center; gap: 7px; background: var(--accent-soft); color: #c7d2fe;
      padding: 5px 11px; border-radius: 999px; font: 600 11px/1 ui-monospace, Consolas, monospace;
      letter-spacing: .06em; border: 1px solid rgba(99, 102, 241, 0.28);
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--emerald); }
    h1 {
      margin: 18px 0 14px; font: 700 clamp(30px, 4.4vw, 48px)/1.08 inherit; letter-spacing: -0.035em;
    }
    h1 span { color: #a5b4fc; }
    .hero p { max-width: 600px; font-size: 15.5px; color: var(--muted); margin-bottom: 26px; }
    .cta-row { display: flex; flex-wrap: wrap; gap: 10px; }
    .btn {
      display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; text-decoration: none;
      font: 600 13.5px/1 inherit; border-radius: 9px; border: 1px solid var(--line-bright); transition: .15s ease;
    }
    .btn-primary { background: var(--accent); color: #fff; border-color: transparent; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-secondary { background: rgba(255, 255, 255, 0.04); color: var(--ink); }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.08); }
    .hero-spec {
      background: #0d0f15; border: 1px solid var(--line); border-radius: 14px; padding: 20px;
      font: 12px/1.6 ui-monospace, Consolas, monospace; color: #cbd5e1;
    }
    .hero-spec-head {
      display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px;
      margin-bottom: 12px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 11px;
    }
    .spec-row { display: flex; justify-content: space-between; gap: 10px; padding: 6px 0; border-bottom: 1px dashed rgba(255,255,255,0.06); }
    .spec-row:last-child { border-bottom: 0; }
    .spec-ok { color: #34d399; font-weight: 600; }
    .section-head { margin: 42px 0 16px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
    .section-head h2 { font-size: 20px; letter-spacing: -0.02em; }
    .section-head small { color: var(--muted); font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(245px, 1fr)); gap: 14px; }
    .card {
      background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 22px;
    }
    .card h3 { font: 600 15px/1.3 inherit; color: var(--ink); margin-bottom: 8px; }
    .card p { font-size: 13.5px; color: var(--muted); line-height: 1.55; }
    .tiers { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 14px; }
    .tier {
      background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 22px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .tier.featured { border-color: rgba(99, 102, 241, 0.55); background: linear-gradient(180deg, rgba(99, 102, 241, 0.08), var(--surface)); }
    .tier-badge {
      align-self: flex-start; font: 600 10.5px ui-monospace, Consolas, monospace; padding: 3px 8px;
      border-radius: 6px; background: rgba(255,255,255,0.06); color: #c7d2fe;
    }
    .tier ul { list-style: none; display: grid; gap: 6px; font-size: 13px; color: #d4d4d8; margin-top: 4px; }
    .footer {
      margin-top: 44px; padding-top: 22px; border-top: 1px solid var(--line);
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;
      font-size: 12.5px; color: var(--muted);
    }
    .footer-links { display: flex; flex-wrap: wrap; gap: 14px; }
    .footer-links a { color: var(--muted); text-decoration: none; }
    .footer-links a:hover { color: var(--ink); }
    @media (max-width: 860px) { .hero { grid-template-columns: 1fr; padding: 32px 22px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="topbar">
      <a href="/" class="brand">
        <span class="mark">T</span>
        <span>
          <b>TRINITY ${safeVer}</b>
          <small>AI STUDIO · ${safeHost.toUpperCase()}</small>
        </span>
      </a>
      <nav class="topnav">
        <a href="/">Workspace</a>
        <a href="/license">Licencie</a>
        <a href="/aup">Anti-Spam &amp; AUP</a>
        <a href="/privacy">Súkromie (GDPR)</a>
        <a href="/terms">Podmienky</a>
        <a href="/architecture">Architektúra</a>
        <span class="badge">${envBadge}</span>
      </nav>
    </header>

    <section class="hero">
      <div>
        <span class="tag"><span class="dot"></span> CLOUDFLARE EDGE · ZERO-SIMULATION AI</span>
        <h1>Produkčná AI pracovná stanica. <span>Postavená na dôkazoch.</span></h1>
        <p>
          Trinity spája streamovanú orchestráciu modelov (Llama 3.3, Gemini, Claude, OpenAI, Groq, DeepSeek),
          AI Studio na tvorbu webov, šifrované konektory, kryptografický D1 ledger a aktívnu anti-spam ochranu na edge.
        </p>
        <div class="cta-row">
          <a href="/" class="btn btn-primary">Otvoriť Workspace (${safeHost})</a>
          <a href="/legal" class="btn btn-secondary">Licencie &amp; Politiky (${escapeHtml(POLICY_VERSION)})</a>
          <a href="https://auru.dev" class="btn btn-secondary">Dev Mirror (auru.dev)</a>
        </div>
      </div>

      <aside class="hero-spec" aria-label="Systémová architektúra">
        <div class="hero-spec-head"><span>TRINITY TRUST &amp; SHIELD SPEC</span><span>v${safeVer}</span></div>
        <div class="spec-row"><span>Edge Runtime</span><span class="spec-ok">Cloudflare Workers</span></div>
        <div class="spec-row"><span>Rate Limit &amp; Flood Guard</span><span class="spec-ok">ACTIVE (RPM + Daily)</span></div>
        <div class="spec-row"><span>Abuse &amp; Bot Classifier</span><span class="spec-ok">ENABLED + Honeypot</span></div>
        <div class="spec-row"><span>Secrets Vault</span><span class="spec-ok">AES-256-GCM</span></div>
        <div class="spec-row"><span>Audit &amp; Truth Policy</span><span class="spec-ok">SHA-256 D1 Ledger</span></div>
        <div class="spec-row"><span>Compliance Framework</span><span class="spec-ok">GDPR · EU AI Act · AUP</span></div>
      </aside>
    </section>

    <div class="section-head">
      <h2>Architektúra bez halucinácií</h2>
      <small>Každá odpoveď a akcia prechádza autentifikáciou, kvótami a verifikáciou</small>
    </div>
    <section class="grid">
      <article class="card">
        <h3>Multi-Model Orchestrator</h3>
        <p>Paralelný dopyt naprieč nakonfigurovanými modelmi s konzistentným smerovaním a transparentnými odpoveďami bez vymyslených výsledkov.</p>
      </article>
      <article class="card">
        <h3>AI Studio &amp; Edge Hosting</h3>
        <p>Interaktívny web builder s živým náhľadom (desktop/tablet/mobile), verzovaním projektov, auditom kvality a exportom na domény.</p>
      </article>
      <article class="card">
        <h3>Anti-Spam &amp; Abuse Shield</h3>
        <p>Ochrana proti zahlcovaniu tokenov, opakovaným bot útokom, odkazovému spamu vo formulároch a automatizovanému zneužívaniu API.</p>
      </article>
      <article class="card">
        <h3>Sovereign D1 Audit Ledger</h3>
        <p>Kryptograficky zreťazený auditný záznam operácií, schválení politík a licenčných grantov (<code>trn_lic_*</code> / <code>trn_live_*</code>).</p>
      </article>
    </section>

    <div class="section-head">
      <h2>Licenčné triedy &amp; API kvóty</h2>
      <small>Prísne vynucované na každej požiadavke s jasnými právami na výstupy</small>
    </div>
    <section class="tiers">
      ${tiers.map((tier) => `<article class="tier ${tier.id === 'pro_studio' ? 'featured' : ''}">
        <span class="tier-badge">${escapeHtml(tier.badge)}</span>
        <h3>${escapeHtml(tier.name)}</h3>
        <p style="font-size:13px;color:var(--muted)">${escapeHtml(tier.description)}</p>
        <ul>
          <li>Rýchlosť: <strong>${tier.max_rpm} požiadaviek / min</strong></li>
          <li>Denný strop: <strong>${tier.daily_requests_limit.toLocaleString('en-US')} / deň</strong></li>
          <li>Max vstup: <strong>${Math.round(tier.max_payload_bytes / 1024)} KB</strong></li>
          <li>Komerčné práva k výstupom: <strong>${tier.commercial_rights ? 'Plné vlastníctvo' : 'Len testovanie'}</strong></li>
        </ul>
      </article>`).join('')}
    </section>

    <footer class="footer">
      <span>TRINITY ${safeVer} · Politiky ${escapeHtml(POLICY_VERSION)} · Anti-Spam &amp; Rate Limiting vynútené</span>
      <div class="footer-links">
        <a href="/terms">Podmienky používania</a>
        <a href="/aup">Anti-Spam &amp; AUP</a>
        <a href="/privacy">Ochrana súkromia</a>
        <a href="/license">Licencia</a>
        <a href="/security-policy">EU AI Act</a>
        <a href="/architecture">Architektúra Trinity</a>
      </div>
    </footer>
  </div>
</body>
</html>`;
}
