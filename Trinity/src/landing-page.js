/**
 * @module TRINITY_OMNI_CORE
 * @subsystem PUBLIC_LANDING_PAGE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Verejná prezentačná a launch stránka pre auru.space a auru.dev v Minimalist Dark AI Studio dizajne.
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
  version = '13.0.0'
} = {}) {
  const safeHost = escapeHtml(host);
  const safeVer = escapeHtml(String(version).split('.').slice(0, 2).join('.') || '13.0');
  const isStaging = environment === 'staging' || host === 'auru.dev';
  const envBadge = isStaging ? 'STAGING · AURU.DEV' : 'PRODUCTION · AURU.SPACE';

  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#0b0d12">
  <title>TRINITY ${safeVer} · AI Studio</title>
  <style>
    :root {
      --bg: #0b0d12;
      --surface: #151922;
      --accent: #6366f1;
      --accent-soft: rgba(99, 102, 241, 0.14);
      --sky: #38bdf8;
      --line: rgba(255, 255, 255, 0.08);
      --line-bright: rgba(255, 255, 255, 0.16);
      --ink: #f1f5f9;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99, 102, 241, 0.16), transparent),
        var(--bg);
      line-height: 1.65;
      padding: 28px 20px 64px;
      -webkit-font-smoothing: antialiased;
    }
    .wrap { max-width: 1040px; margin: 0 auto; }
    .topbar {
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;
      padding: 12px 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
    }
    .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--ink); }
    .mark {
      width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px;
      background: var(--accent); color: #fff; font: 700 16px/1 inherit;
    }
    .brand b { display: block; font: 600 15px/1.2 inherit; letter-spacing: -0.01em; }
    .brand small { display: block; font: 500 10px/1.3 ui-monospace, Consolas, monospace; color: var(--muted); letter-spacing: .1em; }
    .badge {
      padding: 5px 11px; font: 600 11px/1 ui-monospace, Consolas, monospace; border-radius: 999px;
      background: var(--accent-soft); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.28);
    }
    .hero {
      margin-top: 28px; padding: 48px 36px 40px; border-radius: 18px;
      background: var(--surface); border: 1px solid var(--line);
    }
    .tag {
      display: inline-block; background: var(--accent-soft); color: #a5b4fc; padding: 5px 11px; border-radius: 999px;
      font: 600 11px/1 ui-monospace, Consolas, monospace; letter-spacing: .08em; border: 1px solid rgba(99, 102, 241, 0.25);
    }
    h1 {
      margin: 18px 0 14px; font: 700 clamp(30px, 4.5vw, 48px)/1.1 inherit; letter-spacing: -0.03em;
    }
    h1 span { color: #818cf8; }
    .hero p { max-width: 680px; font-size: 16px; color: var(--muted); margin-bottom: 28px; }
    .cta-row { display: flex; flex-wrap: wrap; gap: 10px; }
    .btn {
      display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; text-decoration: none;
      font: 600 13.5px/1 inherit; border-radius: 10px; border: 1px solid var(--line-bright);
      transition: background .15s ease, border-color .15s ease;
    }
    .btn-primary { background: var(--accent); color: #fff; border-color: transparent; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-secondary { background: rgba(255, 255, 255, 0.03); color: var(--ink); }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.07); }
    .grid {
      margin-top: 22px; display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px;
    }
    .card {
      background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 20px;
    }
    .card h2 { font: 600 15px/1.3 inherit; color: var(--ink); margin-bottom: 8px; }
    .card p { font-size: 13.5px; color: var(--muted); line-height: 1.55; }
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
          <small>AI STUDIO · LIVE EDGE WORKSPACE</small>
        </span>
      </a>
      <div class="badge">${envBadge} · ${safeHost}</div>
    </header>

    <section class="hero">
      <span class="tag">LIVE STREAMING AI + MULTI-MODEL + PC BRIDGE</span>
      <h1>Jeden priestor. <span>Živá inteligencia.</span></h1>
      <p>
        Trinity spája okamžitý live streaming rozhovor, paralelný Multi-Model Konsenzus (Cloudflare Workers AI, Gemini, OpenAI, Claude, Groq, DeepSeek),
        AI Studio na weby, šifrované konektory a bezpečné prepojenie s tvojím Windows PC.
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
      TRINITY ${safeVer} · Host: ${safeHost} · Pravdivosť podložená dôkazmi (Truth Policy 2.0) · <a href="/health" style="color:#818cf8">/health</a>
    </footer>
  </div>
</body>
</html>`;
}
