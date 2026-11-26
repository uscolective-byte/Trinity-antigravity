/**
 * Semantic HTML5 shell for Auru-Dev-Worker (auru.dev).
 * Clean, lightweight, zero-bloat Obsidian & Champagne Atelier workspace.
 */

export const INDEX_HTML = `<!doctype html>
<html lang="sk" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,interactive-widget=resizes-content">
  <meta name="theme-color" content="#09090b">
  <meta name="description" content="Auru Dev — samostatný Obsidian & Champagne Atelier priestor pre Trinity Chat, Tetrakis ($TTK) Space, @wallet, šifrovaný trezor a dokumentáciu.">
  <link rel="manifest" href="/manifest.json">
  <title>Auru Dev · Obsidian Atelier</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="/atelier.css">
  <script src="/app.js" defer></script>
</head>
<body>
  <aside class="rail" aria-label="Navigácia Auru Dev">
    <div class="rail-head">
      <a href="#chat" class="brand" data-nav="chat">
        <span class="brand-mark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 3 3 19 21 19"/><line x1="12" y1="3" x2="12" y2="19"/></svg>
        </span>
        <span class="brand-copy"><b>Auru Dev</b><small>OBSIDIAN ATELIER</small></span>
      </a>
      <button type="button" id="cmdk-btn" class="kbd-btn" title="Príkazová paleta (Ctrl+K)">⌘K</button>
    </div>

    <button type="button" id="new-chat-btn" class="new-task-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      <span>Nová úloha</span>
    </button>

    <div class="rail-label">PRIESTOR</div>
    <nav class="rail-nav" aria-label="Hlavné sekcie">
      <button type="button" class="nav-item active" data-nav="chat">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>Chat</span>
      </button>
      <button type="button" class="nav-item" data-nav="tetrakis" id="nav-tetrakis">
        <svg viewBox="0 0 24 24"><polygon points="12 3 3 19 21 19"/><line x1="12" y1="3" x2="12" y2="19"/><line x1="12" y1="13" x2="3" y2="19"/><line x1="12" y1="13" x2="21" y2="19"/></svg>
        <span>Tetrakis ($TTK)</span>
      </button>
      <button type="button" class="nav-item" data-nav="wallet">
        <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        <span>Peňaženka @wallet</span>
      </button>
      <button type="button" class="nav-item" data-nav="vault">
        <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>Trezor &amp; Konektory</span>
      </button>
      <button type="button" class="nav-item" data-nav="docs">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>Dokumentácia</span>
      </button>
    </nav>

    <div class="rail-label">HISTÓRIA</div>
    <div id="session-list" class="session-list" aria-label="Nedávne rozhovory"></div>

    <div class="rail-foot">
      <div class="rail-status">
        <span><span id="core-dot" class="dot"></span><span id="core-status-text">auru.dev · samostatný</span></span>
        <strong class="mono" style="font-size:10px;color:var(--gold)">v1.0</strong>
      </div>
      <div class="rail-links">
        <a href="https://auru.space" target="_blank" rel="noopener">auru.space ↗</a>
        <a href="/terms" target="_blank" rel="noopener">Podmienky</a>
        <a href="/privacy" target="_blank" rel="noopener">GDPR</a>
      </div>
    </div>
  </aside>

  <main class="stage">
    <header class="topbar">
      <div class="topbar-left">
        <span class="kicker">AURU.DEV</span>
        <strong id="view-title" class="topbar-title">Chat</strong>
        <span id="view-sub" class="topbar-sub">Samostatné rozhranie napojené na Trinity Core RPC</span>
      </div>
      <div class="topbar-actions">
        <span id="account-pill" class="pill-tag" hidden><span class="dot ok"></span><span id="account-email">—</span></span>
        <button type="button" id="theme-btn" class="pill-btn" title="Prepnúť tmavý / svetlý režim">Vzhľad</button>
        <button type="button" id="auth-btn" class="pill-btn">Prihlásiť</button>
      </div>
    </header>

    <div id="notice" class="notice-bar" role="status" hidden></div>

    <div class="views">
      <!-- 1. CHAT VIEW -->
      <section id="view-chat" class="view">
        <div id="chat-scroll" class="chat-scroll">
          <div id="welcome" class="welcome">
            <div class="welcome-mark" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polygon points="12 3 3 19 21 19"/><line x1="12" y1="3" x2="12" y2="19"/><line x1="12" y1="13" x2="3" y2="19"/><line x1="12" y1="13" x2="21" y2="19"/></svg>
            </div>
            <span class="kicker">AURU.DEV · OBSIDIAN ATELIER</span>
            <h1>Čo dnes <em>postavíme?</em></h1>
            <p>Nové samostatné rozhranie pre auru.dev oddelené od hlavnej Trinity (auru.space) — čistý Chat, Tetrakis ($TTK) Space, @wallet, AES-GCM Trezor a Google AI Studio Bridge.</p>

            <div class="starter-grid">
              <button type="button" class="starter-card" data-nav="tetrakis">
                <span class="starter-idx">01</span>
                <strong>Tetrakis Space ($TTK) →</strong>
                <small>4 ekosystémové piliere, Base L2 kontrakt a EIP-1193 peňaženka</small>
              </button>
              <button type="button" class="starter-card" data-nav="wallet">
                <span class="starter-idx">02</span>
                <strong>Peňaženka @wallet →</strong>
                <small>Sandbox zostatok, platobné terminály a prehľad kanálov</small>
              </button>
              <button type="button" class="starter-card" data-nav="vault">
                <span class="starter-idx">03</span>
                <strong>Trezor &amp; Google AI Studio →</strong>
                <small>Šifrovaný AES-GCM Vault, konektory a ko-kreácia s AI Studio</small>
              </button>
              <button type="button" class="starter-card" data-nav="docs">
                <span class="starter-idx">04</span>
                <strong>Trinity Dokumentácia →</strong>
                <small>Archív dokumentov, whitepaper a export do Markdownu</small>
              </button>
            </div>

            <div class="welcome-meta">
              <span>Truth Policy 2.1</span>
              <span>·</span>
              <span>Worker: auru-dev</span>
              <span>·</span>
              <span>⌘K Paleta</span>
            </div>
          </div>

          <div id="messages" class="messages" aria-live="polite"></div>
        </div>

        <div class="composer-dock">
          <div id="chat-activity" class="mono" style="font-size:11px;color:var(--gold);padding:0 6px 6px;" hidden></div>
          <form id="chat-form" class="composer-box">
            <label for="chat-input" class="sr-only">Správa pre Trinity</label>
            <textarea id="chat-input" class="composer-input" rows="2" maxlength="12000" required placeholder="Napíš príkaz alebo otázku (Enter odošle, Shift+Enter nový riadok)…"></textarea>
            <div class="composer-bar">
              <div class="composer-tools">
                <select id="chat-model" class="composer-select" aria-label="AI model">
                  <option value="auto" selected>Auto Pentad Router</option>
                  <option value="cloud">Cloudflare Workers AI</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI GPT</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="groq">Groq LPU</option>
                  <option value="deepseek">DeepSeek</option>
                </select>
                <label class="composer-check"><input type="checkbox" id="chat-remember"> Pamäť</label>
              </div>
              <div style="display:flex;gap:6px;">
                <button type="button" id="chat-stop" class="btn btn-danger" hidden style="height:32px;padding:0 12px;">Zastaviť</button>
                <button type="submit" id="chat-send" class="btn btn-primary" style="height:32px;padding:0 16px;">Odoslať</button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <!-- 2. TETRAKIS ($TTK) SPACE -->
      <section id="view-tetrakis" class="view" hidden>
        <div class="hero-card space-hero">
          <div class="space-top">
            <span class="badge badge-gold">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 3 3 19 21 19"/><line x1="12" y1="3" x2="12" y2="19"/><line x1="12" y1="13" x2="3" y2="19"/><line x1="12" y1="13" x2="21" y2="19"/></svg>
              Tetrakis Space · $TTK
            </span>
            <button type="button" id="ttk-connect-btn" class="btn btn-primary" style="height:32px;border-radius:999px;">Pripojiť peňaženku</button>
          </div>

          <div class="ttk-emblem">
            <img id="ttk-logo-img" src="/tetrakis-logo.png" alt="Tetrakis ($TTK) — Trinity Ecosystem" width="148" height="84">
          </div>

          <span class="kicker">TETRAKIS ($TTK) · NATÍVNY EKOSYSTÉMOVÝ PRIESTOR</span>
          <strong id="ttk-balance" class="hero-figure">Nedostupný</strong>
          <p id="ttk-sub" class="hero-desc">Pripoj vlastnú EIP-1193 peňaženku (MetaMask / Coinbase / Rabby). Auru Dev nikdy nežiada seed ani privátny kľúč a nevymýšľa trhovú cenu (Truth Policy 2.1).</p>

          <div class="circle-actions">
            <button type="button" class="circle-btn primary" id="ttk-act-connect">
              <span class="circle-ico"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h5"/></svg></span>
              <span>Pripojiť</span>
            </button>
            <button type="button" class="circle-btn" id="ttk-act-send">
              <span class="circle-ico"><svg viewBox="0 0 24 24"><path d="M12 19V5"/><polyline points="5 12 12 5 19 12"/></svg></span>
              <span>Odoslať</span>
            </button>
            <button type="button" class="circle-btn" data-nav="wallet">
              <span class="circle-ico"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></span>
              <span>@wallet</span>
            </button>
            <button type="button" class="circle-btn" id="ttk-act-refresh">
              <span class="circle-ico"><svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></span>
              <span>Overiť</span>
            </button>
          </div>
        </div>

        <div class="card">
          <div class="ledger-head"><span>AKTÍVUM &amp; SIEŤ</span><span>ERC-20 · BASE L2</span></div>
          <div class="ledger-row">
            <div class="ledger-left">
              <span class="ledger-ico"><img src="/tetrakis-emblem.svg" alt="TTK"></span>
              <div class="ledger-meta"><b>Tetrakis ($TTK)</b><small>Fixná ponuka · 18 decimals · 0 % daň · bez ďalšieho mintu</small></div>
            </div>
            <div class="ledger-right"><strong id="ttk-supply">1 000 000 000 TTK</strong><small>celková zásoba</small></div>
          </div>
          <div class="ledger-row">
            <div class="ledger-left">
              <span class="ledger-ico">L2</span>
              <div class="ledger-meta"><b>On-Chain Kontrakt</b><small id="ttk-network">Base L2 · fail-closed overenie</small></div>
            </div>
            <div class="ledger-right"><strong id="ttk-deployment">Neoverené</strong><small>stav kontraktu</small></div>
          </div>
          <div class="ledger-row">
            <div class="ledger-left">
              <span class="ledger-ico">≈</span>
              <div class="ledger-meta"><b>Trhová cena</b><small>Nikdy neuvádzame nepotvrdený kurz</small></div>
            </div>
            <div class="ledger-right"><strong id="ttk-price">Neznáma</strong><small>Truth Policy 2.1</small></div>
          </div>
        </div>

        <div id="ttk-send-box" class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div><span class="kicker">PRIAMA ON-CHAIN PLATBA</span><h3 style="margin:2px 0 0;">Odoslať $TTK</h3></div>
            <span id="ttk-pay-badge" class="badge">Platby vypnuté</span>
          </div>
          <form id="ttk-send-form" class="form-row">
            <label>
              <span style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:5px;">Suma v TTK</span>
              <input id="ttk-amount" class="input" type="text" inputmode="decimal" placeholder="napr. 25" maxlength="30" required>
            </label>
            <button id="ttk-send-btn" type="submit" class="btn btn-primary" disabled>Platby nie sú pripravené</button>
          </form>
          <p id="ttk-send-note" style="margin:10px 0 0;font-size:12.5px;color:var(--text-muted);">Platba sa povolí až po overení nasadeného kontraktu a príjemcu cez /api/assistant/crypto/tetrakis.</p>
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div><span class="kicker">SMART KONTRAKT &amp; TOKENOMIKA</span><h3 style="margin:2px 0 0;">TetrakisToken · ERC-20</h3></div>
            <button type="button" id="ttk-copy-btn" class="btn" style="height:32px;">Kopírovať adresu</button>
          </div>
          <div style="margin-top:12px;padding:10px 12px;border-radius:9px;background:var(--bg-input);border:1px solid var(--line);word-break:break-all;">
            <code id="ttk-contract-addr" style="color:var(--gold-bright);font-size:12.5px;">Zatiaľ nie je overená</code>
          </div>
          <div class="spec-grid">
            <div class="spec-box"><span>FIXNÁ ZÁSOBA</span><strong>1 000 000 000 TTK</strong></div>
            <div class="spec-box"><span>FOUNDER / TREASURY</span><strong>1M / 999M TTK</strong></div>
            <div class="spec-box"><span>ŠTANDARD</span><strong>ERC-20 · Base L2</strong></div>
          </div>
        </div>

        <div class="pillars-grid" aria-label="4 ekosystémové piliere Tetrakis">
          <article class="pillar-card">
            <b><span class="pillar-dot"></span>Natívne platby v chate &amp; P2P prevody</b>
            <p>Priame prevody medzi peňaženkami, sprepitné a platobné požiadavky v Trinity chate a <code>@wallet</code> bez opustenia konverzácie.</p>
          </article>
          <article class="pillar-card">
            <b><span class="pillar-dot"></span>Mini-aplikácie, AI Studio &amp; ekonomika botov</b>
            <p>Natívna úžitková mena pre webové aplikácie z AI Studia, AI agentov, pluginy a mikroslužby v ekosystéme.</p>
          </article>
          <article class="pillar-card">
            <b><span class="pillar-dot"></span>Domény, mená (@handle) &amp; digitálne aktíva</b>
            <p>Ekosystémové mená (<code>@handle</code>), doménové služby, hosting a overiteľné digitálne aktíva.</p>
          </article>
          <article class="pillar-card">
            <b><span class="pillar-dot"></span>Ekonomika tvorcov, výpočtov &amp; neväzobný Space</b>
            <p>Neväzobný Tetrakis Space popri <code>@wallet</code> pre tvorcov a výpočty — kľúče ostávajú u používateľa, fail-closed overenie.</p>
          </article>
        </div>
      </section>

      <!-- 3. @WALLET VIEW -->
      <section id="view-wallet" class="view" hidden>
        <div class="hero-card space-hero">
          <div class="space-top">
            <span class="badge badge-gold">Trinity @wallet</span>
            <button type="button" id="wallet-refresh-btn" class="btn" style="height:30px;border-radius:999px;">↻ Obnoviť</button>
          </div>
          <span class="kicker">SANDBOX ZOSTATOK</span>
          <strong id="wallet-balance" class="hero-figure">0,00 €</strong>
          <p id="wallet-sub" class="hero-desc">Trinity eviduje sandbox bilanciu a platobné terminály; externý prevod vždy potvrdzuješ priamo v banke alebo Web3 peňaženke.</p>
        </div>

        <div class="card">
          <div class="ledger-head"><span>AKTÍVA &amp; TERMINÁLY</span><span>TRINITY @WALLET</span></div>
          <div class="ledger-row">
            <div class="ledger-left"><span class="ledger-ico">€</span><div class="ledger-meta"><b>Disponibilné (Sandbox)</b><small>nie je bankový ani on-chain zostatok</small></div></div>
            <div class="ledger-right"><strong id="wallet-available">0,00 €</strong><small>EUR</small></div>
          </div>
          <div class="ledger-row">
            <div class="ledger-left"><span class="ledger-ico">↓</span><div class="ledger-meta"><b>Prijaté platby</b><small>POS terminály, Revolut &amp; SEPA</small></div></div>
            <div class="ledger-right"><strong id="wallet-received">0,00 €</strong><small>príjem</small></div>
          </div>
          <div class="ledger-row">
            <div class="ledger-left"><span class="ledger-ico">POS</span><div class="ledger-meta"><b>Aktívne platobné kanály</b><small>iba výslovne nakonfigurované terminály</small></div></div>
            <div class="ledger-right"><strong id="wallet-terminals">0</strong><small>kanálov</small></div>
          </div>
          <div class="ledger-row">
            <div class="ledger-left"><span class="ledger-ico"><img src="/tetrakis-emblem.svg" alt="TTK"></span><div class="ledger-meta"><b>Tetrakis Space ($TTK)</b><small>Natívny Web3 priestor · Base L2 ERC-20</small></div></div>
            <div class="ledger-right"><button type="button" class="btn" style="height:30px;" data-nav="tetrakis">Otvoriť Space →</button></div>
          </div>
        </div>
      </section>

      <!-- 4. VAULT, CONNECTORS & GOOGLE AI STUDIO BRIDGE -->
      <section id="view-vault" class="view" hidden>
        <div class="stats-strip">
          <div class="stat-tile"><span>ÚČET</span><strong id="st-account">Neprihlásený</strong><small id="st-role">Vyžaduje prihlásenie</small></div>
          <div class="stat-tile"><span>AI MODEL</span><strong id="st-model">—</strong><small>Trinity Core</small></div>
          <div class="stat-tile"><span>PC BRIDGE</span><strong id="st-bridge">—</strong><small>Lokálna brána</small></div>
          <div class="stat-tile"><span>TRUTH POLICY</span><strong id="st-truth">2.1</strong><small>Evidence-Required</small></div>
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;">
            <div><span class="kicker">ENCRYPTED VAULT · AES-GCM</span><h3 style="margin:2px 0 0;">Šifrovaný trezor API kľúčov</h3></div>
            <span class="badge">Kľúč sa nikdy nevracia</span>
          </div>
          <form id="vault-form" class="form-row">
            <select id="vault-provider" class="select">
              <option value="google_ai_studio">Google AI Studio (Gemini API)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI / ChatGPT</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="cloudflare">Cloudflare</option>
              <option value="github">GitHub</option>
              <option value="vercel">Vercel</option>
              <option value="onedrive">Microsoft OneDrive</option>
              <option value="telegram">Telegram Bot</option>
              <option value="revolut">Revolut API</option>
              <option value="custom">Vlastný konektor</option>
            </select>
            <input id="vault-name" class="input" required minlength="2" maxlength="80" placeholder="Názov pripojenia">
            <input id="vault-secret" class="input" type="password" required minlength="8" maxlength="4096" autocomplete="new-password" placeholder="API kľúč alebo token">
            <button type="submit" class="btn btn-primary">Uložiť do trezora</button>
          </form>
          <div id="vault-list" class="list-stack"></div>
        </div>

        <div class="card" style="border-color:var(--gold-border);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;">
            <div><span class="kicker">GOOGLE AI STUDIO BRIDGE</span><h3 style="margin:2px 0 0;">Ko-kreácia Trinity ↔ Google AI Studio</h3></div>
            <span id="ais-badge" class="badge">Kontrolujem…</span>
          </div>
          <form id="ais-form" style="display:flex;flex-direction:column;gap:10px;">
            <textarea id="ais-task" class="textarea" rows="2" required placeholder="Popíš zadanie pre spoločnú tvorbu Trinity + Google AI Studio…"></textarea>
            <div class="form-row">
              <select id="ais-mode" class="select">
                <option value="pair">Pair Co-Creation</option>
                <option value="review">Architecture Review</option>
                <option value="implement">Implementation Draft</option>
              </select>
              <button type="submit" id="ais-run-btn" class="btn btn-primary">Spustiť ko-kreáciu</button>
            </div>
          </form>
          <pre id="ais-output" class="doc-content" hidden></pre>
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div><span class="kicker">INTEGRATION HUB</span><h3 style="margin:2px 0 0;">Stav pripojených služieb</h3></div>
            <button type="button" id="vault-refresh-btn" class="btn" style="height:30px;">↻ Obnoviť</button>
          </div>
          <div id="connectors-list" class="list-stack"></div>
        </div>
      </section>

      <!-- 5. DOCUMENTATION VIEW -->
      <section id="view-docs" class="view" hidden>
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;">
            <div><span class="kicker">TRINITY KNOWLEDGE CENTER</span><h3 style="margin:2px 0 0;">Dokumentácia a D1 archív</h3></div>
            <button type="button" id="docs-refresh-btn" class="btn" style="height:30px;">↻ Načítať</button>
          </div>
          <input id="docs-search" class="input" type="search" placeholder="Hľadať v Trinity dokumentoch (Tetrakis, AI Studio, Truth Policy…)">
          <div id="docs-list" class="list-stack"></div>
          <div id="doc-reader" hidden style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <strong id="doc-reader-title">Dokument</strong>
              <a id="doc-export-link" href="#" class="btn" style="height:30px;">Export .md</a>
            </div>
            <pre id="doc-reader-body" class="doc-content"></pre>
          </div>
        </div>
      </section>
    </div>
  </main>

  <!-- AUTH DIALOG -->
  <dialog id="auth-dialog" aria-label="Prihlásenie do Auru Dev">
    <div class="dialog-head">
      <div><span class="kicker">AURU.DEV · SECURE ACCESS</span><h2>Prihlásenie do Trinity</h2></div>
      <button type="button" class="pill-btn" data-close="auth-dialog">✕</button>
    </div>
    <button type="button" id="google-auth-btn" class="btn" style="width:100%;margin-bottom:12px;">Pokračovať cez Google</button>
    <form id="cred-login-form" style="display:flex;flex-direction:column;gap:10px;">
      <input id="login-email" class="input" type="email" required autocomplete="email" placeholder="E-mailová adresa">
      <input id="login-pass" class="input" type="password" required autocomplete="current-password" placeholder="Heslo">
      <button type="submit" class="btn btn-primary" style="width:100%;">Prihlásiť sa</button>
    </form>
    <details style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);">
      <summary style="font-size:12px;color:var(--text-muted);cursor:pointer;">Prihlásiť sa prístupovým kľúčom</summary>
      <form id="key-login-form" class="form-row" style="margin-top:10px;">
        <input id="login-key" class="input" type="password" required placeholder="Prístupový kľúč">
        <button type="submit" class="btn btn-primary">Vstúpiť</button>
      </form>
    </details>
  </dialog>

  <!-- COMMAND PALETTE (⌘K) -->
  <dialog id="cmdk-dialog" aria-label="Príkazová paleta">
    <div class="dialog-head" style="margin-bottom:8px;">
      <input id="cmdk-input" class="input" type="search" placeholder="Prepnúť pohľad alebo akciu…">
      <button type="button" class="pill-btn" data-close="cmdk-dialog">Esc</button>
    </div>
    <div id="cmdk-list" class="cmdk-list"></div>
  </dialog>
</body>
</html>
`;
