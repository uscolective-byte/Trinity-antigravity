import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const trinityDir = fileURLToPath(new URL('..', import.meta.url));
const assistantDir = resolve(trinityDir, 'public/assistant');

const html = readFileSync(resolve(assistantDir, 'chat.html'), 'utf8');
const chatJs = readFileSync(resolve(assistantDir, 'chat.js.txt'), 'utf8');
const garageCss = readFileSync(resolve(assistantDir, 'garage.css'), 'utf8');
const swJs = readFileSync(resolve(assistantDir, 'sw.js.txt'), 'utf8');

function extractSectionById(source, id, nextMarker) {
  const start = source.indexOf(`id="${id}"`);
  assert.ok(start >= 0, `Expected section id="${id}" in chat.html`);
  const end = nextMarker ? source.indexOf(nextMarker, start + 1) : source.length;
  assert.ok(end > start, `Expected end marker "${nextMarker}" after id="${id}"`);
  return source.slice(start, end);
}

const cryptoViewHtml = extractSectionById(html, 'crypto-view', 'id="wallet-view"');
const walletViewHtml = extractSectionById(html, 'wallet-view', 'id="modules-view"');
const docPaneOverviewHtml = extractSectionById(html, 'doc-pane-guide', 'id="doc-pane-architecture"');
const docPaneCryptoHtml = extractSectionById(html, 'doc-pane-crypto', 'id="doc-pane-connectors"');
const studioViewHtml = extractSectionById(html, 'studio-view', 'id="projects-view"');
const secretPanelHtml = extractSectionById(html, 'settings-secret-panel', 'id="settings-self-improvement-panel"');

test('zero TON branding leaks across garage.css, chat.html, and chat.js.txt', () => {
  const forbiddenPattern = /ton-style|ton space|tonkeeper|the tetrakis open network|\.ton-|--ton-|data-ton-action|ton-send-card|ton-contract-card/i;
  assert.equal(forbiddenPattern.test(garageCss), false, 'garage.css must not contain TON branding or .ton-/--ton- selectors');
  assert.equal(forbiddenPattern.test(html), false, 'chat.html must not contain TON branding or TON Space identifiers');
  assert.equal(forbiddenPattern.test(chatJs), false, 'chat.js.txt must not contain TON Space selectors or identifiers');

  // Zero standalone "TON" word leaks in Tetrakis Space, @wallet, crypto docs, overview docs, garage.css, and chat.js.txt
  const standaloneTon = /\bton\b/i;
  assert.equal(standaloneTon.test(garageCss), false, 'garage.css must not mention TON');
  assert.equal(standaloneTon.test(chatJs), false, 'chat.js.txt must not mention TON');
  assert.equal(standaloneTon.test(cryptoViewHtml), false, '#crypto-view must not mention TON');
  assert.equal(standaloneTon.test(walletViewHtml), false, '#wallet-view must not mention TON');
  assert.equal(standaloneTon.test(docPaneCryptoHtml), false, '#doc-pane-crypto must not mention TON');
  assert.equal(standaloneTon.test(docPaneOverviewHtml), false, '#doc-pane-overview must not mention TON');

  // Zero TON inverted-triangle SVG path anywhere in chat.html
  assert.equal(html.includes('M12 21L3.8 7.6'), false, 'chat.html must not contain TON inverted-triangle SVG path');
});

test('real /tetrakis-logo.png and authentic 4-vertex tetrahedron SVGs are used across Tetrakis Space & @wallet', () => {
  // Hero emblem in #crypto-view
  assert.match(
    cryptoViewHtml,
    /<div class="ttk-space-emblem">\s*<img src="\/tetrakis-logo\.png"[^>]*>\s*<\/div>/,
    '#crypto-view hero must render /tetrakis-logo.png inside .ttk-space-emblem'
  );
  assert.ok(garageCss.includes('.ttk-space-emblem'), 'garage.css must define .ttk-space-emblem');
  assert.ok(garageCss.includes('.ttk-space-emblem img'), 'garage.css must style .ttk-space-emblem img');

  // Tetrakis row in #wallet-view
  assert.match(
    walletViewHtml,
    /<span class="tg-asset-avatar ttk"><img src="\/tetrakis-logo\.png"[^>]*><\/span>/,
    '#wallet-view Tetrakis row must render /tetrakis-logo.png inside .tg-asset-avatar.ttk'
  );
  assert.equal(walletViewHtml.includes('tg-asset-avatar ttk">💎'), false, '#wallet-view must not use generic diamond emoji for Tetrakis');
  assert.equal(cryptoViewHtml.includes('💎 Pripojiť peňaženku'), false, '#web3-connect-btn must not use generic diamond emoji');
  assert.equal(chatJs.includes('💎 Pripojiť peňaženku'), false, 'chat.js.txt must not set generic diamond emoji on #web3-connect-btn');

  // Authentic 4-vertex tetrahedron SVG in sidebar nav & badge
  const tetrahedronSvg = '<polygon points="12 3 3 19 21 19"/><line x1="12" y1="3" x2="12" y2="19"/><line x1="12" y1="13" x2="3" y2="19"/><line x1="12" y1="13" x2="21" y2="19"/>';
  const navLine = html.match(/<button data-view="crypto" id="crypto-nav-btn">[\s\S]*?<\/button>/)?.[0] || '';
  assert.ok(navLine.includes(tetrahedronSvg), '#crypto-nav-btn must use authentic 4-vertex tetrahedron SVG');
  const badgeBlock = cryptoViewHtml.match(/<span class="ttk-space-badge">[\s\S]*?<\/span>/)?.[0] || '';
  assert.ok(badgeBlock.includes(tetrahedronSvg), '.ttk-space-badge must use authentic 4-vertex tetrahedron SVG');
});

test('all 4 redefined Tetrakis ($TTK) native ecosystem utility pillars appear in #crypto-view and #doc-pane-crypto', () => {
  const pillarPatterns = [
    /Natívne platby v chate/i,
    /P2P prevody/i,
    /Mini-aplikácie,\s*AI Studio/i,
    /ekonomika botov/i,
    /Domény,\s*mená\s*\(@handle\)/i,
    /digitálne aktíva/i,
    /Ekonomika tvorcov,\s*výpočtov/i,
    /neväzobný Tetrakis Space/i
  ];
  for (const pattern of pillarPatterns) {
    assert.match(cryptoViewHtml, pattern, `#crypto-view missing utility pillar match: ${pattern}`);
    assert.match(docPaneCryptoHtml, pattern, `#doc-pane-crypto missing utility pillar match: ${pattern}`);
  }
});

test('#doc-pane-crypto and #doc-pane-overview honor Truth Policy 2.1 and document Bridge + Dual-Language architecture', () => {
  // Forbidden false claims removed
  assert.equal(docPaneCryptoHtml.includes('EIP-2612'), false, '#doc-pane-crypto must not falsely claim EIP-2612 Permit');
  assert.equal(docPaneCryptoHtml.includes('Bol nasadený'), false, '#doc-pane-crypto must not falsely claim unverified deployment');
  assert.equal(docPaneCryptoHtml.includes('automaticky odomkne doménu'), false, '#doc-pane-crypto must not claim automatic unlock on transfer');

  // Accurate technical truth present
  assert.match(docPaneCryptoHtml, /TetrakisToken\.sol/);
  assert.match(docPaneCryptoHtml, /OpenZeppelin ERC-20 v5\.1\.0/);
  assert.match(docPaneCryptoHtml, /0\.8\.24/);
  assert.match(docPaneCryptoHtml, /1 000 000 000 TTK/);
  assert.match(docPaneCryptoHtml, /\/api\/assistant\/crypto\/tetrakis/);
  assert.match(docPaneCryptoHtml, /scripts\/verify-tetrakis\.mjs/);
  assert.match(docPaneCryptoHtml, /keccak256/);
  assert.match(docPaneCryptoHtml, /data-view="crypto"/);
  assert.match(docPaneCryptoHtml, /data-view="wallet"/);

  // Overview docs include Google AI Studio Bridge and Dual-Language Architecture notes
  assert.match(docPaneOverviewHtml, /Google AI Studio/i);
  assert.match(docPaneOverviewHtml, /\/api\/assistant\/ai-studio\/co-create/);
  assert.match(docPaneOverviewHtml, /DVOJJAZYČNÁ ARCHITEKTÚRA/i);
});

test('service worker sw.js.txt allowlists /tetrakis-logo.png in STATIC_ASSETS', () => {
  assert.match(swJs, /STATIC_ASSETS\s*=\s*new Set\([\s\S]*['"]\/tetrakis-logo\.png['"][\s\S]*\)/);
});

test('all required #crypto-view interactive IDs and data-ttk-action hooks exist and are wired in chat.js.txt', () => {
  const requiredIds = [
    'web3-connect-btn',
    'web3-user-ttk',
    'ttk-wallet-message',
    'web3-wallet-status',
    'web3-user-address',
    'web3-user-chain',
    'ttk-contract-explorer',
    'ttk-stat-supply',
    'ttk-stat-network',
    'ttk-stat-deployment',
    'ttk-stat-price',
    'ttk-stat-jericho',
    'ttk-payment-badge',
    'ttk-payment-form',
    'ttk-payment-amount',
    'ttk-pay-btn',
    'ttk-payment-status',
    'ttk-copy-contract-btn',
    'ttk-contract-address',
    'ttk-send-card',
    'ttk-contract-card'
  ];
  for (const id of requiredIds) {
    assert.ok(cryptoViewHtml.includes(`id="${id}"`), `Missing #${id} in #crypto-view`);
  }
  for (const wired of [
    'web3-connect-btn',
    'ttk-payment-form',
    'ttk-payment-amount',
    'ttk-pay-btn',
    'ttk-copy-contract-btn',
    'ttk-send-card',
    'ttk-contract-card',
    'data-ttk-action',
    'ttkAction'
  ]) {
    assert.ok(chatJs.includes(wired), `Expected "${wired}" wiring in chat.js.txt`);
  }
  assert.match(cryptoViewHtml, /data-ttk-action="connect"/);
  assert.match(cryptoViewHtml, /data-ttk-action="send"/);
  assert.match(cryptoViewHtml, /data-ttk-action="contract"/);
  assert.match(chatJs, /crypto:\['TETRAKIS \(\$TTK\) · BASE L2 SPACE','Tetrakis Space \(\$TTK\)'/);
});

test('Google AI Studio Bridge UI hooks exist in #studio-view & #settings-secret-panel and work behaviorally in VM', async () => {
  const studioIds = [
    'ai-studio-bridge-panel',
    'ai-studio-status-badge',
    'ai-studio-session-badge',
    'ai-studio-refresh-btn',
    'ai-studio-model-select',
    'ai-studio-mode-select',
    'ai-studio-task-input',
    'ai-studio-context-input',
    'ai-studio-cocreate-btn',
    'ai-studio-reset-session-btn',
    'ai-studio-status-note',
    'ai-studio-result-box',
    'ai-studio-trinity-plan',
    'ai-studio-contribution',
    'ai-studio-contribution-model',
    'ai-studio-final-reply'
  ];
  for (const id of studioIds) {
    assert.ok(studioViewHtml.includes(`id="${id}"`), `Missing #${id} in #studio-view`);
  }
  assert.match(secretPanelHtml, /<option value="gemini">Google Gemini<\/option>/);
  assert.match(secretPanelHtml, /<option value="google_ai_studio">Google AI Studio \(Gemini API\)<\/option>/);
  assert.ok(chatJs.includes('/api/assistant/ai-studio/status'));
  assert.ok(chatJs.includes('/api/assistant/ai-studio/models'));
  assert.ok(chatJs.includes('/api/assistant/ai-studio/co-create'));

  // Behavioral VM verification of Google AI Studio Bridge controller
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const elements = new Map();
  function makeNode(tag = 'div') {
    const listeners = new Map();
    return {
      tagName: tag.toUpperCase(),
      children: [],
      hidden: false,
      value: '',
      checked: false,
      disabled: false,
      textContent: '',
      innerHTML: '',
      dataset: {},
      style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      dispatch(type, evt = { preventDefault() {} }) {
        return Promise.all((listeners.get(type) || []).map(fn => fn(evt)));
      },
      querySelector() { return makeNode(); },
      querySelectorAll() { return []; },
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; },
      focus() {},
      setAttribute() {},
      getAttribute() { return null; },
      removeAttribute() {}
    };
  }
  for (const id of ids) elements.set(id, makeNode());
  elements.get('ai-studio-result-box').hidden = true;
  elements.get('ai-studio-session-badge').hidden = true;
  elements.get('ai-studio-mode-select').value = 'pair';

  const storage = new Map();
  const requests = [];
  let failNext = false;

  const context = {
    console, URL, URLSearchParams, TextDecoder, AbortController, AbortSignal, Response, DOMException, crypto, Intl, Date,
    setTimeout, clearTimeout,
    setInterval(...args) { return setInterval(...args).unref(); },
    clearInterval,
    MutationObserver: class { observe() {} disconnect() {} },
    document: {
      getElementById: id => elements.get(id) || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: tag => makeNode(tag),
      documentElement: makeNode('html'),
      body: makeNode('body'),
      addEventListener() {}
    },
    localStorage: {
      getItem: k => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: k => storage.delete(k)
    },
    location: { hostname: 'auru.space', host: 'auru.space', origin: 'https://auru.space', href: 'https://auru.space/', hash: '', search: '', pathname: '/' },
    history: { replaceState() {} },
    navigator: {},
    window: { addEventListener() {}, PublicKeyCredential: function () {} },
    fetch: async (url, init) => {
      requests.push({ url, method: init?.method || 'GET', body: init?.body ? JSON.parse(init.body) : null });
      if (failNext) {
        return Response.json({ ok: false, error: 'Google AI Studio nedostupné (503)' }, { status: 503 });
      }
      if (url === '/api/assistant/ai-studio/status') {
        return Response.json({
          bridge: 'google-ai-studio',
          configured: true,
          live_verified: false,
          secret_values_accessed: false,
          default_model: 'gemini-2.5-flash'
        });
      }
      if (url === '/api/assistant/ai-studio/models') {
        return Response.json({
          ok: true,
          recommended_model: 'gemini-2.5-flash',
          models: [
            { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
            { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' }
          ]
        });
      }
      if (url === '/api/assistant/ai-studio/co-create') {
        return Response.json({
          ok: true,
          session_id: 'sess-ai-studio-01',
          turn: 1,
          mode: 'pair',
          trinity_plan: 'Step 1: Architect clean API contract.',
          ai_studio_contribution: {
            model: 'gemini-2.5-flash',
            text: 'Proposed modular edge implementation.',
            latency_ms: 142
          },
          final_reply: 'Spoločný návrh Trinity + Google AI Studio je pripravený po slovensky.'
        });
      }
      return Response.json({ ok: true });
    },
    TrinityAuth: {
      start() {},
      config: async () => ({ google_enabled: false, google_required: false }),
      requestJSON: async () => ({ account: { role: 'owner' } })
    }
  };

  vm.createContext(context);
  vm.runInContext(chatJs, context, { timeout: 3000 });

  // 1. Load status & models
  await vm.runInContext('loadAiStudioBridge()', context);
  assert.match(elements.get('ai-studio-status-badge').textContent, /Nakonfigurovaný/);
  assert.equal(elements.get('ai-studio-model-select').children.length, 2);
  assert.equal(elements.get('ai-studio-model-select').value, 'gemini-2.5-flash');

  // 2. Submit co-creation task
  elements.get('ai-studio-task-input').value = 'Navrhni Tetrakis Space API modul';
  elements.get('ai-studio-context-input').value = 'Cloudflare Workers ESM';
  await elements.get('ai-studio-bridge-form').dispatch('submit');

  const coCreateReq = requests.find(r => r.url === '/api/assistant/ai-studio/co-create');
  assert.ok(coCreateReq, 'Expected POST /api/assistant/ai-studio/co-create request');
  assert.equal(coCreateReq.method, 'POST');
  assert.equal(coCreateReq.body.task, 'Navrhni Tetrakis Space API modul');
  assert.equal(coCreateReq.body.reply_language, 'sk');
  assert.equal(elements.get('ai-studio-result-box').hidden, false);
  assert.equal(elements.get('ai-studio-trinity-plan').textContent, 'Step 1: Architect clean API contract.');
  assert.equal(elements.get('ai-studio-contribution').textContent, 'Proposed modular edge implementation.');
  assert.equal(elements.get('ai-studio-contribution-model').textContent, 'gemini-2.5-flash');
  assert.match(elements.get('ai-studio-final-reply').textContent, /po slovensky/);
  assert.equal(elements.get('ai-studio-session-badge').hidden, false);
  assert.match(elements.get('ai-studio-session-badge').textContent, /kolo 1/);

  // 3. Reset session
  await elements.get('ai-studio-reset-session-btn').dispatch('click');
  assert.equal(elements.get('ai-studio-result-box').hidden, true);
  assert.equal(elements.get('ai-studio-session-badge').hidden, true);
  assert.equal(elements.get('ai-studio-trinity-plan').textContent, '');

  // 4. Graceful error handling (503) without uncaught throw
  failNext = true;
  await vm.runInContext('loadAiStudioBridge()', context);
  assert.match(elements.get('ai-studio-status-badge').textContent, /HTTP 503/);
  await elements.get('ai-studio-bridge-form').dispatch('submit');
  assert.match(elements.get('ai-studio-status-note').textContent, /nepodarila|503/i);
});

test('comments and developer console logs in Trinity/public/assistant/* contain zero Slovak diacritics', () => {
  const skDiacritics = /[áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/;

  // CSS comments
  for (const cssFile of ['garage.css', 'chat.css', 'builder.css', 'theme.css', 'mobile.css']) {
    const src = readFileSync(resolve(assistantDir, cssFile), 'utf8');
    for (const match of src.matchAll(/\/\*[\s\S]*?\*\//g)) {
      assert.equal(skDiacritics.test(match[0]), false, `Slovak diacritics in ${cssFile} comment: ${match[0].slice(0, 80)}`);
    }
  }

  // HTML comments
  for (const match of html.matchAll(/<!--[\s\S]*?-->/g)) {
    assert.equal(skDiacritics.test(match[0]), false, `Slovak diacritics in chat.html comment: ${match[0].slice(0, 80)}`);
  }

  // JS comments & console logs
  for (const jsFile of ['chat.js.txt', 'sw.js.txt', 'mobile-device.js.txt', 'spotify.js.txt']) {
    const src = readFileSync(resolve(assistantDir, jsFile), 'utf8');
    const lines = src.split('\n');
    let inBlock = false;
    lines.forEach((ln, idx) => {
      let comment = '';
      if (inBlock) {
        const end = ln.indexOf('*/');
        if (end >= 0) { comment += ln.slice(0, end + 2); inBlock = false; }
        else comment += ln;
      } else {
        const stripped = ln.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, 'S');
        const bStart = stripped.indexOf('/*');
        const sStart = stripped.indexOf('//');
        if (bStart >= 0 && (sStart < 0 || bStart < sStart)) {
          const end = stripped.indexOf('*/', bStart + 2);
          if (end >= 0) comment += stripped.slice(bStart, end + 2);
          else { comment += stripped.slice(bStart); inBlock = true; }
        } else if (sStart >= 0) {
          comment += stripped.slice(sStart);
        }
      }
      if (comment) {
        assert.equal(skDiacritics.test(comment), false, `Slovak diacritics in ${jsFile}:${idx + 1} comment: ${comment.trim()}`);
      }
      const consoleMatch = ln.match(/console\.(log|warn|error|info|debug)\(([^)]*)\)/);
      if (consoleMatch) {
        assert.equal(skDiacritics.test(consoleMatch[2]), false, `Slovak diacritics in ${jsFile}:${idx + 1} console log: ${consoleMatch[0]}`);
      }
    });
  }
});
