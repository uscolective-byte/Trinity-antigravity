/**
 * Handcrafted Obsidian & Brushed Champagne Atelier stylesheet for Auru-Dev-Worker (auru.dev).
 * Built from scratch with zero legacy overrides, warm alabaster daylight mode,
 * hairline architecture, tactile catchlights, and full mobile responsiveness.
 */

export const ATELIER_CSS = `/* ==========================================================================
   AURU.DEV - OBSIDIAN & CHAMPAGNE ATELIER UI v1.0
   ========================================================================== */

:root {
  --font-display: "Instrument Serif", Georgia, "Times New Roman", serif;
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  --bg-deep: #09090b;
  --bg-rail: #0d0d10;
  --bg-surface: #121216;
  --bg-elevated: #17171d;
  --bg-hover: #1d1d24;
  --bg-input: #0e0e12;
  --bg-glass: rgba(9, 9, 11, 0.84);

  --text-main: #f4f3ef;
  --text-secondary: #b9b5ab;
  --text-muted: #807c73;
  --text-dim: #5c5952;

  --line: rgba(255, 255, 255, 0.07);
  --line-strong: rgba(255, 255, 255, 0.14);
  --edge: inset 0 1px 0 rgba(255, 255, 255, 0.045);

  --gold: #d6b676;
  --gold-bright: #ead099;
  --gold-soft: rgba(214, 182, 118, 0.11);
  --gold-border: rgba(214, 182, 118, 0.28);

  --cta-bg: #d6b676;
  --cta-hover: #e5c88c;
  --cta-ink: #0a0908;

  --ok: #4ade80;
  --ok-soft: rgba(74, 222, 128, 0.11);
  --warn: #eab308;
  --err: #f87171;
  --err-soft: rgba(248, 113, 113, 0.11);

  --msg-user-bg: #171613;
  --msg-user-border: rgba(214, 182, 118, 0.22);

  --radius-sm: 9px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);
  --shadow-md: 0 12px 32px rgba(0, 0, 0, 0.44);
  --shadow-lg: 0 24px 64px rgba(0, 0, 0, 0.62);

  --sidebar-w: 256px;
  --header-h: 52px;
  --chat-max: 760px;
}

[data-theme="light"] {
  --bg-deep: #faf9f6;
  --bg-rail: #f1efe9;
  --bg-surface: #ffffff;
  --bg-elevated: #f5f3ed;
  --bg-hover: #ece9e1;
  --bg-input: #ffffff;
  --bg-glass: rgba(250, 249, 246, 0.86);

  --text-main: #141311;
  --text-secondary: #48443e;
  --text-muted: #78726a;
  --text-dim: #9e978e;

  --line: rgba(20, 19, 17, 0.085);
  --line-strong: rgba(20, 19, 17, 0.16);
  --edge: inset 0 1px 0 rgba(255, 255, 255, 0.9);

  --gold: #9a7330;
  --gold-bright: #7d5b20;
  --gold-soft: rgba(154, 115, 48, 0.1);
  --gold-border: rgba(154, 115, 48, 0.28);

  --cta-bg: #141311;
  --cta-hover: #292622;
  --cta-ink: #faf9f6;

  --ok: #15803d;
  --ok-soft: rgba(21, 128, 61, 0.1);
  --err: #dc2626;
  --err-soft: rgba(220, 38, 38, 0.09);

  --msg-user-bg: #f3efe6;
  --msg-user-border: rgba(154, 115, 48, 0.24);

  --shadow-sm: 0 1px 2px rgba(20, 19, 17, 0.06);
  --shadow-md: 0 8px 24px rgba(20, 19, 17, 0.08);
  --shadow-lg: 0 20px 52px rgba(20, 19, 17, 0.13);
}

*, *::before, *::after {
  box-sizing: border-box;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--bg-deep);
  background-image: radial-gradient(960px 520px at 62% -10%, rgba(214, 182, 118, 0.045), transparent 65%);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  display: flex;
  height: 100dvh;
  overflow: hidden;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 999px; }
[data-theme="light"] ::-webkit-scrollbar-thumb { background: rgba(20, 19, 17, 0.15); }

::selection { background: rgba(214, 182, 118, 0.28); }
a { color: var(--gold-bright); text-decoration: none; }
a:hover { text-decoration: underline; }
code, pre, kbd, .mono { font-family: var(--font-mono); }

:focus-visible {
  outline: 2px solid var(--gold-border);
  outline-offset: 2px;
}

/* ==========================================================================
   SIDEBAR RAIL
   ========================================================================== */

.rail {
  width: var(--sidebar-w);
  flex-shrink: 0;
  background: var(--bg-rail);
  border-right: 1px solid var(--line);
  padding: 14px 12px 12px;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}

.rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 4px 12px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--text-main);
  text-decoration: none;
}
.brand:hover { text-decoration: none; }

.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--bg-elevated);
  border: 1px solid var(--gold-border);
  box-shadow: var(--edge);
  color: var(--gold);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.brand-copy b {
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.brand-copy small {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin-top: 2px;
}

.kbd-btn {
  height: 28px;
  padding: 0 8px;
  border-radius: 7px;
  background: var(--bg-surface);
  border: 1px solid var(--line);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.14s, color 0.14s, border-color 0.14s;
}
.kbd-btn:hover { background: var(--bg-hover); color: var(--text-main); border-color: var(--line-strong); }

.new-task-btn {
  height: 36px;
  width: 100%;
  margin-bottom: 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  border: 1px solid var(--line-strong);
  box-shadow: var(--edge);
  color: var(--text-main);
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  cursor: pointer;
  transition: background 0.14s, border-color 0.14s, color 0.14s;
}
.new-task-btn:hover { background: var(--bg-hover); border-color: var(--gold-border); color: var(--gold-bright); }

.rail-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-dim);
  padding: 6px 8px;
}

.rail-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
}

.nav-item {
  width: 100%;
  height: 35px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  cursor: pointer;
  transition: background 0.14s, color 0.14s, border-color 0.14s;
}
.nav-item svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: var(--text-muted);
  flex-shrink: 0;
}
.nav-item:hover { background: var(--bg-hover); color: var(--text-main); }
.nav-item:hover svg { color: var(--text-main); }
.nav-item.active {
  background: var(--gold-soft);
  border-color: var(--gold-border);
  color: var(--text-main);
  font-weight: 600;
}
.nav-item.active svg { color: var(--gold); }

.session-list {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 10px;
}

.session-btn {
  width: 100%;
  padding: 7px 10px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  font-size: 12.5px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.session-btn:hover { background: var(--bg-hover); color: var(--text-main); }
.session-btn.active { background: var(--bg-surface); border-color: var(--line); color: var(--text-main); font-weight: 500; }

.rail-foot {
  margin-top: auto;
  padding: 10px 6px 2px;
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rail-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
}
.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-dim);
  margin-right: 6px;
  vertical-align: middle;
}
.dot.ok { background: var(--ok); }
.dot.warn { background: var(--warn); }

.rail-links {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  font-size: 11px;
}
.rail-links a { color: var(--text-dim); }
.rail-links a:hover { color: var(--text-secondary); text-decoration: none; }

/* ==========================================================================
   MAIN STAGE & TOPBAR
   ========================================================================== */

.stage {
  flex: 1 1 0;
  min-width: 0;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topbar {
  height: var(--header-h);
  min-height: var(--header-h);
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--bg-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--line);
  z-index: 20;
}

.topbar-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--gold);
}

.topbar-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--text-main);
}

.topbar-sub {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.pill-btn, .pill-tag {
  height: 30px;
  padding: 0 11px;
  border-radius: 8px;
  background: var(--bg-surface);
  border: 1px solid var(--line);
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pill-btn { cursor: pointer; transition: background 0.14s, border-color 0.14s, color 0.14s; }
.pill-btn:hover { background: var(--bg-hover); border-color: var(--line-strong); color: var(--text-main); }

.notice-bar {
  margin: 10px 22px 0;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--gold-border);
  color: var(--text-main);
  font-size: 13px;
}
.notice-bar.error { border-color: rgba(248, 113, 113, 0.35); color: var(--err); background: var(--err-soft); }

.views {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
}

.view {
  max-width: 860px;
  margin: 0 auto;
  padding: 28px 24px 56px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.view[hidden] { display: none !important; }

/* ==========================================================================
   PRIMITIVES: CARDS, BUTTONS, INPUTS
   ========================================================================== */

.card {
  background: var(--bg-surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 22px 24px;
  box-shadow: var(--edge), var(--shadow-sm);
}

.hero-card {
  background: var(--bg-surface);
  border: 1px solid var(--gold-border);
  border-radius: var(--radius-xl);
  padding: 28px;
  box-shadow: var(--edge), var(--shadow-md);
  position: relative;
  overflow: hidden;
}
.hero-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
  opacity: 0.6;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 15px;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--line-strong);
  background: var(--bg-elevated);
  color: var(--text-main);
  transition: background 0.14s, border-color 0.14s, opacity 0.14s;
}
.btn:hover:not(:disabled) { background: var(--bg-hover); border-color: var(--gold-border); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-primary {
  background: var(--cta-bg);
  border-color: transparent;
  color: var(--cta-ink);
  font-weight: 600;
}
.btn-primary:hover:not(:disabled) { background: var(--cta-hover); border-color: transparent; color: var(--cta-ink); }

.btn-danger {
  background: var(--err-soft);
  border-color: rgba(248, 113, 113, 0.3);
  color: var(--err);
}

.input, .select, .textarea {
  width: 100%;
  font-family: var(--font-sans);
  font-size: 13.5px;
  color: var(--text-main);
  background: var(--bg-input);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input:focus, .select:focus, .textarea:focus {
  outline: none;
  border-color: var(--gold-border);
  box-shadow: 0 0 0 3px var(--gold-soft);
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--bg-elevated);
  border: 1px solid var(--line-strong);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}
.badge-gold { background: var(--gold-soft); border-color: var(--gold-border); color: var(--gold-bright); }
.badge-ok { background: var(--ok-soft); border-color: rgba(74, 222, 128, 0.28); color: var(--ok); }

/* ==========================================================================
   CHAT VIEW & FLOATING COMPOSER
   ========================================================================== */

#view-chat {
  max-width: none;
  padding: 0;
  height: 100%;
  gap: 0;
}

.chat-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding: 28px 24px 20px;
  display: flex;
  flex-direction: column;
}

.welcome {
  width: 100%;
  max-width: var(--chat-max);
  margin: auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.welcome[hidden] { display: none; }

.welcome-mark {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--bg-surface);
  border: 1px solid var(--gold-border);
  box-shadow: var(--edge), var(--shadow-md);
  color: var(--gold);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
}

.welcome h1 {
  margin: 6px 0 10px;
  font-size: clamp(32px, 4.2vw, 44px);
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.08;
}
.welcome h1 em {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 400;
  color: var(--gold-bright);
  letter-spacing: -0.01em;
}
.welcome p {
  margin: 0 0 28px;
  color: var(--text-muted);
  max-width: 54ch;
  font-size: 14.5px;
}

.starter-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  text-align: left;
  margin-bottom: 20px;
}

.starter-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 18px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--line);
  box-shadow: var(--edge);
  color: var(--text-main);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
}
.starter-card:hover { background: var(--bg-hover); border-color: var(--gold-border); transform: translateY(-1px); }
.starter-idx { font-family: var(--font-mono); font-size: 10px; font-weight: 600; color: var(--gold); }
.starter-card strong { font-size: 13.5px; font-weight: 600; }
.starter-card small { font-size: 12px; color: var(--text-muted); line-height: 1.45; }

.welcome-meta {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  display: inline-flex;
  gap: 10px;
}

.messages {
  width: 100%;
  max-width: var(--chat-max);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 20px;
}

.msg { display: flex; flex-direction: column; gap: 6px; animation: fadeUp 0.18s ease-out; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

.msg.user {
  align-self: flex-end;
  max-width: 82%;
  background: var(--msg-user-bg);
  border: 1px solid var(--msg-user-border);
  border-radius: 16px 16px 4px 16px;
  padding: 12px 16px;
  box-shadow: var(--edge), var(--shadow-sm);
}

.msg.assistant {
  align-self: stretch;
  padding: 4px 2px;
}

.msg-role {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--gold);
}

.msg-body {
  font-size: 14.5px;
  line-height: 1.68;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-body pre {
  background: var(--bg-surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  overflow-x: auto;
  font-size: 12.5px;
  white-space: pre;
}
.msg-body code {
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 1px 5px;
  font-size: 12.5px;
  color: var(--gold-bright);
}
.msg-body pre code { background: transparent; border: 0; padding: 0; color: var(--text-main); }

.msg-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.composer-dock {
  width: 100%;
  max-width: calc(var(--chat-max) + 48px);
  margin: 0 auto;
  padding: 8px 24px 18px;
  flex-shrink: 0;
}

.composer-box {
  background: var(--bg-surface);
  border: 1px solid var(--line-strong);
  border-radius: 18px;
  padding: 12px 14px 10px;
  box-shadow: var(--edge), var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.16s, box-shadow 0.16s;
}
.composer-box:focus-within {
  border-color: var(--gold-border);
  box-shadow: var(--edge), 0 0 0 3px var(--gold-soft), var(--shadow-md);
}

.composer-input {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 14.5px;
  line-height: 1.55;
  resize: none;
  outline: none;
  min-height: 44px;
  max-height: 180px;
}

.composer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
  flex-wrap: wrap;
}

.composer-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.composer-select {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  color: var(--text-secondary);
  font-size: 12px;
}

.composer-check {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
}
.composer-check input { accent-color: var(--gold); }

/* ==========================================================================
   TETRAKIS ($TTK) SPACE & @WALLET
   ========================================================================== */

.space-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.space-top {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 18px;
}

.ttk-emblem {
  width: 164px;
  height: 94px;
  border-radius: 16px;
  background: radial-gradient(circle at 50% 45%, rgba(214, 182, 118, 0.14), rgba(9, 9, 11, 0.94));
  border: 1px solid var(--gold-border);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  margin-bottom: 16px;
}
.ttk-emblem img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.hero-figure {
  font-size: clamp(30px, 4.2vw, 42px);
  font-weight: 600;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  margin: 6px 0 8px;
}

.hero-desc {
  max-width: 58ch;
  font-size: 13px;
  color: var(--text-muted);
  margin: 0 0 22px;
}

.circle-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(68px, 88px));
  gap: 14px;
  justify-content: center;
}

.circle-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 500;
}

.circle-ico {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--bg-elevated);
  border: 1px solid var(--line-strong);
  box-shadow: var(--edge);
  color: var(--text-main);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.14s, border-color 0.14s, background 0.14s;
}
.circle-ico svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.circle-btn.primary .circle-ico { background: var(--cta-bg); border-color: transparent; color: var(--cta-ink); }
.circle-btn:hover .circle-ico { transform: translateY(-2px); border-color: var(--gold-border); }

.ledger-head {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 4px;
}

.ledger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 2px;
  border-bottom: 1px solid var(--line);
}
.ledger-row:last-child { border-bottom: 0; padding-bottom: 2px; }
.ledger-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ledger-ico {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--line-strong);
  color: var(--gold);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.ledger-ico img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
.ledger-meta b { display: block; font-size: 13.5px; font-weight: 600; }
.ledger-meta small { display: block; font-size: 12px; color: var(--text-muted); }
.ledger-right { text-align: right; flex-shrink: 0; }
.ledger-right strong { display: block; font-size: 13.5px; font-variant-numeric: tabular-nums; }
.ledger-right small { display: block; font-size: 11px; color: var(--text-muted); }

.pillars-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.pillar-card {
  background: var(--bg-surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 18px 20px;
  box-shadow: var(--edge);
}
.pillar-card:hover { border-color: var(--gold-border); }
.pillar-card b { display: flex; align-items: center; gap: 8px; font-size: 13.5px; margin-bottom: 6px; }
.pillar-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--gold); flex-shrink: 0; }
.pillar-card p { margin: 0; font-size: 12.5px; color: var(--text-muted); line-height: 1.6; }

.spec-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.spec-box {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--line);
}
.spec-box span { display: block; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 4px; }
.spec-box strong { font-size: 12.5px; }

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
}
.form-row > * { flex: 1 1 160px; }
.form-row > button { flex: 0 0 auto; }

/* ==========================================================================
   VAULT, CONNECTORS, DOCS & AUTH MODAL
   ========================================================================== */

.stats-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
}
.stat-tile {
  background: var(--bg-surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}
.stat-tile span { display: block; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.09em; color: var(--text-muted); margin-bottom: 4px; }
.stat-tile strong { display: block; font-size: 14px; font-weight: 600; }
.stat-tile small { font-size: 11.5px; color: var(--text-muted); }

.list-stack { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--line);
}
.list-row b { display: block; font-size: 13px; }
.list-row small { display: block; font-size: 11.5px; color: var(--text-muted); }

.doc-content {
  margin-top: 12px;
  padding: 16px 18px;
  border-radius: var(--radius-md);
  background: var(--bg-input);
  border: 1px solid var(--line);
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-secondary);
  max-height: 460px;
  overflow-y: auto;
}

dialog {
  background: var(--bg-surface);
  color: var(--text-main);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--shadow-lg);
  width: min(500px, calc(100vw - 28px));
}
dialog::backdrop {
  background: rgba(5, 5, 7, 0.72);
  backdrop-filter: blur(8px);
}
.dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.dialog-head h2 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }

.cmdk-list { display: flex; flex-direction: column; gap: 2px; margin-top: 10px; }
.cmdk-item {
  width: 100%;
  padding: 9px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  cursor: pointer;
}
.cmdk-item:hover { background: var(--gold-soft); color: var(--text-main); }

@media (max-width: 900px) {
  body { flex-direction: column; height: auto; min-height: 100dvh; overflow-y: auto; }
  .rail { width: 100%; height: auto; border-right: 0; border-bottom: 1px solid var(--line); padding: 10px 14px; }
  .rail-label, .session-list, .rail-foot { display: none; }
  .rail-nav { flex-direction: row; overflow-x: auto; margin-bottom: 0; }
  .nav-item { width: auto; flex: 0 0 auto; white-space: nowrap; }
  .stage { height: auto; min-height: calc(100dvh - 120px); }
  .starter-grid, .pillars-grid, .spec-grid { grid-template-columns: 1fr; }
}
`;
