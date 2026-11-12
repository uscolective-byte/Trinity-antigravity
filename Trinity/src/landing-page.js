/**
 * @module TRINITY_OMNI_CORE
 * @subsystem PUBLIC_LANDING_PAGE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Verejná prezentačná a launch stránka pre auru.space a auru.dev v Underground Garage · Hip-Hop dizajne.
 */

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
  version = '12.0.0'
} = {}) {
  const safeHost = escapeHtml(host);
  const safeVer = escapeHtml(String(version).split('.').slice(0, 2).join('.') || '12.0');
  const isStaging = environment === 'staging' || host === 'auru.dev';
  const envBadge = isStaging ? 'STAGING LAB · AURU.DEV' : 'PRODUCTION LIVE · AURU.SPACE';

  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#0e0e10">
  <title>TRINITY ${safeVer} · Underground Garage Sovereign AI OS</title>
  <style>
    :root {
      --bg: #0e0e10;
      --surface: rgba(20, 20, 22, 0.94);
      --lime: #d4ff2a;
      --amber: #ff9f1c;
      --crimson: #ff3b5c;
      --mint: #2ce68a;
      --ink: #f4efe4;
      --muted: #a69f91;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: var(--ink);
      background:
        linear-gradient(155deg, rgba(11, 11, 13, 0.9) 0%, rgba(18, 17, 15, 0.85) 55%, rgba(10, 10, 12, 0.95) 100%),
        url('/garage-v1.webp') center/cover fixed #0e0e10;
      line-height: 1.6;
      padding: 28px 20px 64px;
    }
    .wrap { max-width: 1120px; margin: 0 auto; }
    .topbar {
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;
      padding: 14px 18px; background: var(--surface); border: 2px solid #38342c; box-shadow: 5px 5px 0 #000;
    }
    .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--ink); }
    .mark {
      width: 40px; height: 40px; display: grid; place-items: center;
      background: var(--lime); color: #111; font: 900 22px/1 Impact, "Arial Black", sans-serif;
      border: 2px solid #111; box-shadow: 3px 3px 0 var(--amber); transform: rotate(-6deg);
    }
    .brand b { display: block; font: 900 18px/1.1 Impact, "Arial Black", sans-serif; letter-spacing: .04em; text-transform: uppercase; }
    .brand small { display: block; font: 700 10px/1.3 ui-monospace, Consolas, monospace; color: var(--lime); letter-spacing: .12em; }
    .badge {
      padding: 6px 11px; font: 800 11px/1 ui-monospace, Consolas, monospace;
      background: var(--lime); color: #111; border: 2px solid #111; box-shadow: 3px 3px 0 #000;
    }
    .hero {
      position: relative; margin-top: 28px; padding: 44px 36px 38px;
      background: var(--surface); border: 2px solid var(--lime); box-shadow: 9px 9px 0 #000; overflow: hidden;
    }
    .hero::before {
      content: ""; position: absolute; top: 0; left: 0; right: 0; height: 8px;
      background: repeating-linear-gradient(-45deg, var(--lime) 0 12px, #111 12px 24px);
    }
    .tag {
      display: inline-block; background: var(--amber); color: #111; padding: 4px 10px;
      font: 900 11px/1 ui-monospace, Consolas, monospace; letter-spacing: .12em; box-shadow: 3px 3px 0 #000;
    }
    h1 {
      margin: 18px 0 14px; font: 900 clamp(34px, 5vw, 60px)/1.02 Impact, "Arial Black", sans-serif;
      font-style: italic; text-transform: uppercase; text-shadow: 4px 4px 0 #000;
    }
    h1 span { color: var(--lime); }
    .hero p { max-width: 720px; font-size: 16px; color: #dbd5c8; margin-bottom: 26px; }
    .cta-row { display: flex; flex-wrap: wrap; gap: 12px; }
    .btn {
      display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; text-decoration: none;
      font: 800 13px/1 ui-monospace, Consolas, monospace; text-transform: uppercase; letter-spacing: .04em;
      border: 2px solid #111; transition: transform .1s ease;
    }
    .btn-primary { background: var(--lime); color: #111; box-shadow: 4px 4px 0 var(--amber); }
    .btn-secondary { background: #1e1d1a; color: var(--ink); border-color: #4d483d; box-shadow: 4px 4px 0 #000; }
    .btn:hover { transform: translate(-2px, -2px); }
    .grid {
      margin-top: 28px; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;
    }
    .card {
      background: var(--surface); border: 1.5px solid #38342c; padding: 20px;
      box-shadow: 5px 5px 0 #000; border-top: 4px solid var(--amber);
    }
    .card h2 { font: 800 16px/1.2 ui-monospace, Consolas, monospace; color: var(--lime); margin-bottom: 8px; text-transform: uppercase; }
    .card p { font-size: 13.5px; color: var(--muted); }
    .footer {
      margin-top: 34px; text-align: center; font: 12px ui-monospace, Consolas, monospace; color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="topbar">
      <a href="/" class="brand">
        <span class="mark">T</span>
        <span>
          <b>TRINITY ${safeVer}</b>
          <small>UNDERGROUND / GARAGE / HIP-HOP OS</small>
        </span>
      </a>
      <div class="badge">${envBadge} · ${safeHost}</div>
    </header>

    <section class="hero">
      <span class="tag">LIVE MULTI-MODEL AI + EDGE + PC BRIDGE</span>
      <h1>JEDEN MOZOG. <span>VŠETKY NÁSTROJE.</span></h1>
      <p>
        Trinity spája paralelný Multi-Model Konsenzus (Cloudflare Workers AI, Gemini, OpenAI, Claude, Groq, DeepSeek),
        živé AI Studio na weby, bežné konektory v šifrovanom trezore, správu domén a priame ovládanie Windows PC cez bezpečný most.
      </p>
      <div class="cta-row">
        <a href="/" class="btn btn-primary">⚡ Otvoriť Workspace (${safeHost})</a>
        <a href="https://auru.dev" class="btn btn-secondary">🛠️ Staging Lab (auru.dev)</a>
        <a href="https://auru.space" class="btn btn-secondary">🌐 Produkcia (auru.space)</a>
        <a href="/docs" class="btn btn-secondary">📚 Dokumentácia</a>
      </div>
    </section>

    <section class="grid">
      <article class="card">
        <h2>🧠 Multi-Model Bus</h2>
        <p>Paralelný dopyt naprieč reálne pripojenými AI modelmi s poctivým konsenzom a kryptografickým potvrdením bez halucinácií.</p>
      </article>
      <article class="card">
        <h2>✦ AI Studio &amp; Domény</h2>
        <p>Tvorba kompletných HTML/CSS webov na jeden prompt, kontrola kvality, verzie aj okamžité nasadenie na vlastné Cloudflare domény.</p>
      </article>
      <article class="card">
        <h2>🔌 Common Connectors</h2>
        <p>Šifrovaný trezor (AES-GCM) so živým testovaním pre Slack, Discord, Telegram, GitHub, Notion, Linear, Stripe, Supabase, Meta a MCP.</p>
      </article>
      <article class="card">
        <h2>💻 PC Bridge &amp; Tetrakis</h2>
        <p>Bezpečný tunel k Windows stanici (Local-Gateway &amp; Desktop) plus auditovaný smart-kontraktový ekosystém Tetrakis ($TTK) na Base L2.</p>
      </article>
    </section>

    <footer class="footer">
      TRINITY ${safeVer} · Host: ${safeHost} · Pravdivosť podložená dôkazmi (Truth Policy 2.0) · <a href="/health" style="color:var(--lime)">/health</a>
    </footer>
  </div>
</body>
</html>`;
}
