/**
 * Frontend controller for Auru-Dev-Worker (auru.dev).
 * Connects directly to Trinity Core endpoints proxied via TRINITY_CORE RPC.
 * Strictly honors Truth Policy 2.1: never fabricates balances, prices, or status.
 */

export const APP_JS = `(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = {
    view: 'chat',
    sessionId: localStorage.getItem('auru-dev-session') || null,
    account: null,
    tetrakis: null,
    docs: [],
    abortCtrl: null
  };

  const VIEW_META = {
    chat: ['Chat', 'Samostatné rozhranie napojené na Trinity Core RPC'],
    tetrakis: ['Tetrakis ($TTK)', 'Natívny ekosystémový priestor a 4 piliere utility'],
    wallet: ['Peňaženka @wallet', 'Sandbox zostatok a platobné terminály'],
    vault: ['Trezor & Konektory', 'Šifrovaný AES-GCM trezor, konektory a Google AI Studio'],
    docs: ['Dokumentácia', 'Trinity Knowledge Center a archív dokumentov']
  };

  function showNotice(msg, isError = false) {
    const bar = $('notice');
    if (!bar) return;
    if (!msg) {
      bar.hidden = true;
      bar.textContent = '';
      bar.classList.remove('error');
      return;
    }
    bar.textContent = msg;
    bar.classList.toggle('error', Boolean(isError));
    bar.hidden = false;
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers,
      body: options.body !== undefined && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
    });
    const type = res.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await res.json().catch(() => null) : await res.text().catch(() => '');
    if (!res.ok) {
      const errMsg = (data && (data.error || data.message)) || ('HTTP ' + res.status);
      const err = new Error(errMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function setTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('auru-dev-theme', next);
  }

  function switchView(name, updateHash = true) {
    const target = VIEW_META[name] ? name : 'chat';
    state.view = target;
    document.querySelectorAll('.view').forEach((el) => {
      el.hidden = el.id !== 'view-' + target;
    });
    document.querySelectorAll('.nav-item[data-nav]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.nav === target);
    });
    const [title, sub] = VIEW_META[target];
    $('view-title').textContent = title;
    $('view-sub').textContent = sub;
    if (updateHash) history.replaceState(null, '', '#' + target);
    if (target === 'tetrakis') void loadTetrakis();
    if (target === 'wallet') void loadWallet();
    if (target === 'vault') void loadVaultAndStudio();
    if (target === 'docs') void loadDocs();
  }

  function appendMessage(role, text) {
    $('welcome').hidden = true;
    const wrap = document.createElement('article');
    wrap.className = 'msg ' + (role === 'user' ? 'user' : 'assistant');
    const roleEl = document.createElement('div');
    roleEl.className = 'msg-role';
    roleEl.textContent = role === 'user' ? 'Ty' : '✦ Trinity';
    const bodyEl = document.createElement('div');
    bodyEl.className = 'msg-body';
    bodyEl.textContent = text;
    wrap.append(roleEl, bodyEl);
    $('messages').appendChild(wrap);
    $('chat-scroll').scrollTop = $('chat-scroll').scrollHeight;
    return { wrap, bodyEl };
  }

  async function refreshSession() {
    try {
      const data = await api('/api/assistant/session');
      state.account = data.account || null;
      const email = state.account?.email || null;
      if (email) {
        $('account-email').textContent = email;
        $('account-pill').hidden = false;
        $('auth-btn').textContent = 'Odhlásiť';
      } else {
        $('account-pill').hidden = true;
        $('auth-btn').textContent = 'Prihlásiť';
      }
      $('core-dot').className = 'dot ok';
      $('core-status-text').textContent = 'Trinity Core: Online';
      if (Array.isArray(data.sessions)) renderSessions(data.sessions);
      if (!state.sessionId && data.session_id) {
        state.sessionId = data.session_id;
        localStorage.setItem('auru-dev-session', state.sessionId);
      }
      return data;
    } catch (err) {
      if (err.status === 401) {
        state.account = null;
        $('account-pill').hidden = true;
        $('auth-btn').textContent = 'Prihlásiť';
        $('core-dot').className = 'dot warn';
        $('core-status-text').textContent = 'Vyžaduje prihlásenie';
      } else {
        $('core-dot').className = 'dot';
        $('core-status-text').textContent = 'Core nedostupné';
      }
      return null;
    }
  }

  function renderSessions(items) {
    const list = $('session-list');
    list.replaceChildren();
    for (const s of items.slice(0, 20)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'session-btn' + (s.id === state.sessionId ? ' active' : '');
      btn.textContent = s.title || s.id;
      btn.onclick = () => void loadHistory(s.id);
      list.appendChild(btn);
    }
  }

  async function loadHistory(sessionId) {
    try {
      const data = await api('/api/assistant/history?session_id=' + encodeURIComponent(sessionId));
      state.sessionId = sessionId;
      localStorage.setItem('auru-dev-session', sessionId);
      $('messages').replaceChildren();
      const msgs = Array.isArray(data.messages) ? data.messages : [];
      if (!msgs.length) {
        $('welcome').hidden = false;
        return;
      }
      for (const m of msgs) {
        appendMessage(m.role === 'user' ? 'user' : 'assistant', m.content || '');
      }
    } catch (err) {
      showNotice('Nepodarilo sa načítať históriu: ' + err.message, true);
    }
  }

  async function sendChat(event) {
    event.preventDefault();
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text) return;
    showNotice('');
    appendMessage('user', text);
    input.value = '';
    const reply = appendMessage('assistant', '…');
    $('chat-send').hidden = true;
    $('chat-stop').hidden = false;
    $('chat-activity').textContent = 'Spracúvam požiadavku…';
    $('chat-activity').hidden = false;

    state.abortCtrl = new AbortController();
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        signal: state.abortCtrl.signal,
        body: JSON.stringify({
          message: text,
          session_id: state.sessionId,
          engine: $('chat-model').value,
          remember: $('chat-remember').checked
        })
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        if (res.status === 401) $('auth-dialog').showModal();
        throw new Error(errBody.error || ('HTTP ' + res.status));
      }
      const ctype = res.headers.get('content-type') || '';
      if (ctype.includes('application/x-ndjson') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let fullText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const ev = JSON.parse(line);
              if (ev.session_id) {
                state.sessionId = ev.session_id;
                localStorage.setItem('auru-dev-session', state.sessionId);
              }
              if (ev.type === 'delta' && ev.text) {
                fullText += ev.text;
                reply.bodyEl.textContent = fullText;
                $('chat-scroll').scrollTop = $('chat-scroll').scrollHeight;
              } else if (ev.type === 'done' && ev.reply) {
                fullText = ev.reply;
                reply.bodyEl.textContent = fullText;
              } else if (ev.type === 'error') {
                throw new Error(ev.error || 'Chyba modelu');
              }
            } catch {}
          }
        }
        if (!fullText) reply.bodyEl.textContent = 'Odpoveď nebola vrátená.';
      } else {
        const data = await res.json();
        if (data.session_id) {
          state.sessionId = data.session_id;
          localStorage.setItem('auru-dev-session', state.sessionId);
        }
        reply.bodyEl.textContent = data.reply || data.answer || JSON.stringify(data);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        reply.bodyEl.textContent = 'Generovanie bolo zastavené.';
      } else {
        reply.bodyEl.textContent = 'Chyba: ' + err.message;
      }
    } finally {
      state.abortCtrl = null;
      $('chat-send').hidden = false;
      $('chat-stop').hidden = true;
      $('chat-activity').hidden = true;
    }
  }

  async function loadTetrakis() {
    try {
      const data = await api('/api/assistant/crypto/tetrakis');
      state.tetrakis = data;
      $('ttk-supply').textContent = (data.total_supply || '1 000 000 000') + ' TTK';
      $('ttk-network').textContent = (data.network?.name || 'Base L2') + ' (Chain ' + (data.network?.chain_id || '8453') + ')';
      $('ttk-deployment').textContent = data.deployment_status === 'deployed_verified' ? 'Overený on-chain' : 'Neoverené';
      $('ttk-price').textContent = data.market_price ? String(data.market_price) : 'Neznáma';
      $('ttk-contract-addr').textContent = data.contract_address || 'Zatiaľ nie je overená';
      const enabled = Boolean(data.payments?.enabled);
      $('ttk-pay-badge').textContent = enabled ? 'Platby pripravené' : 'Platby vypnuté';
      $('ttk-send-btn').disabled = !enabled;
      $('ttk-send-btn').textContent = enabled ? 'Odoslať $TTK' : 'Platby nie sú pripravené';
    } catch (err) {
      $('ttk-deployment').textContent = 'Nedostupné (' + err.status + ')';
    }
  }

  async function connectEip1193() {
    if (!window.ethereum) {
      showNotice('V prehliadači nie je dostupná EIP-1193 peňaženka (MetaMask / Coinbase / Rabby).', true);
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const addr = accounts?.[0];
      if (!addr) return;
      $('ttk-balance').textContent = addr.slice(0, 6) + '…' + addr.slice(-4);
      $('ttk-sub').textContent = 'Pripojená EIP-1193 adresa: ' + addr;
      showNotice('Peňaženka pripojená: ' + addr);
    } catch (err) {
      showNotice('Pripojenie peňaženky zlyhalo: ' + err.message, true);
    }
  }

  async function loadWallet() {
    try {
      const data = await api('/api/assistant/wallet');
      const fmt = (n) => Number(n || 0).toFixed(2).replace('.', ',') + ' €';
      $('wallet-balance').textContent = fmt(data.balance_eur);
      $('wallet-available').textContent = fmt(data.available_eur ?? data.balance_eur);
      $('wallet-received').textContent = fmt(data.received_eur);
      $('wallet-terminals').textContent = String(data.terminals_count ?? (data.terminals?.length || 0));
    } catch (err) {
      if (err.status === 401) $('wallet-sub').textContent = 'Prihlás sa pre zobrazenie @wallet bilancie.';
    }
  }

  async function loadVaultAndStudio() {
    try {
      const settings = await api('/api/assistant/settings');
      $('st-account').textContent = settings.account?.email || state.account?.email || 'Prihlásený';
      $('st-role').textContent = settings.account?.role || 'user';
      $('st-model').textContent = settings.model || 'Workers AI';
      $('st-bridge').textContent = settings.pc_bridge?.connected ? 'Pripojený' : 'Offline';
      $('st-truth').textContent = settings.truth_policy_version || '2.1';

      const connList = $('connectors-list');
      connList.replaceChildren();
      for (const item of settings.integrations || []) {
        const row = document.createElement('div');
        row.className = 'list-row';
        const left = document.createElement('div');
        const b = document.createElement('b');
        b.textContent = item.name || item.id;
        const sm = document.createElement('small');
        sm.textContent = item.detail || item.status || '—';
        left.append(b, sm);
        const badge = document.createElement('span');
        badge.className = 'badge ' + (item.status === 'verified' ? 'badge-ok' : '');
        badge.textContent = item.status || 'unknown';
        row.append(left, badge);
        connList.appendChild(row);
      }
    } catch (err) {
      if (err.status === 401) showNotice('Pre správu trezora a konektorov sa prihlás.', true);
    }

    try {
      const sec = await api('/api/assistant/secrets');
      const list = $('vault-list');
      list.replaceChildren();
      for (const s of sec.items || []) {
        const row = document.createElement('div');
        row.className = 'list-row';
        const left = document.createElement('div');
        const b = document.createElement('b');
        b.textContent = s.name + ' (' + s.provider + ')';
        const sm = document.createElement('small');
        sm.textContent = (s.secret_hint || 'AES-GCM') + ' · ' + (s.status || 'stored');
        left.append(b, sm);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-danger';
        btn.style.height = '30px';
        btn.textContent = 'Odvolať';
        btn.onclick = async () => {
          await api('/api/assistant/secrets/' + encodeURIComponent(s.id), { method: 'DELETE' });
          void loadVaultAndStudio();
        };
        row.append(left, btn);
        list.appendChild(row);
      }
    } catch {}

    try {
      const ais = await api('/api/assistant/ai-studio/status');
      $('ais-badge').textContent = ais.configured ? ('Pripravené · ' + (ais.default_model || 'Gemini')) : 'Nepripojené';
      $('ais-badge').className = 'badge ' + (ais.configured ? 'badge-ok' : '');
    } catch {
      $('ais-badge').textContent = 'Vyžaduje prihlásenie';
    }
  }

  async function loadDocs() {
    try {
      const data = await api('/api/assistant/documents?limit=50');
      state.docs = data.items || [];
      renderDocs();
    } catch (err) {
      if (err.status === 401) showNotice('Pre čítanie D1 archívu dokumentov sa prihlás.', true);
    }
  }

  function renderDocs() {
    const q = ($('docs-search').value || '').trim().toLowerCase();
    const list = $('docs-list');
    list.replaceChildren();
    const filtered = state.docs.filter((d) =>
      !q || (d.title || '').toLowerCase().includes(q) || (d.summary || '').toLowerCase().includes(q) || (d.category || '').toLowerCase().includes(q)
    );
    for (const d of filtered) {
      const row = document.createElement('div');
      row.className = 'list-row';
      const left = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = d.title || d.id;
      const sm = document.createElement('small');
      sm.textContent = (d.category || 'doc') + ' · ' + (d.summary || '').slice(0, 120);
      left.append(b, sm);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.style.height = '30px';
      btn.textContent = 'Otvoriť';
      btn.onclick = async () => {
        const full = await api('/api/assistant/documents/' + encodeURIComponent(d.id));
        $('doc-reader-title').textContent = full.title || full.id;
        $('doc-reader-body').textContent = full.content || full.summary || '';
        $('doc-export-link').href = '/api/assistant/documents/' + encodeURIComponent(d.id) + '/export?format=md';
        $('doc-reader').hidden = false;
      };
      row.append(left, btn);
      list.appendChild(row);
    }
  }

  function renderCommandPalette() {
    const q = ($('cmdk-input').value || '').trim().toLowerCase();
    const actions = [
      ['Prejsť na Chat', () => switchView('chat')],
      ['Otvoriť Tetrakis Space ($TTK)', () => switchView('tetrakis')],
      ['Otvoriť Peňaženku @wallet', () => switchView('wallet')],
      ['Otvoriť Trezor & Google AI Studio', () => switchView('vault')],
      ['Otvoriť Dokumentáciu', () => switchView('docs')],
      ['Prepnúť Tmavo / Svetlo', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light')]
    ].filter(([label]) => !q || label.toLowerCase().includes(q));
    const list = $('cmdk-list');
    list.replaceChildren();
    for (const [label, fn] of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cmdk-item';
      btn.textContent = label;
      btn.onclick = () => {
        $('cmdk-dialog').close();
        fn();
      };
      list.appendChild(btn);
    }
  }

  function init() {
    setTheme(localStorage.getItem('auru-dev-theme') || 'dark');
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(el.dataset.nav);
      });
    });
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => $(btn.dataset.close)?.close());
    });
    $('theme-btn').addEventListener('click', () => {
      setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    });
    $('new-chat-btn').addEventListener('click', () => {
      state.sessionId = crypto.randomUUID();
      localStorage.setItem('auru-dev-session', state.sessionId);
      $('messages').replaceChildren();
      $('welcome').hidden = false;
      switchView('chat');
      $('chat-input').focus();
    });
    $('chat-form').addEventListener('submit', sendChat);
    $('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        $('chat-form').requestSubmit();
      }
    });
    $('chat-stop').addEventListener('click', () => state.abortCtrl?.abort());

    $('auth-btn').addEventListener('click', async () => {
      if (state.account) {
        await api('/api/ops/logout', { method: 'POST' }).catch(() => {});
        await refreshSession();
      } else {
        $('auth-dialog').showModal();
      }
    });
    $('google-auth-btn').addEventListener('click', () => {
      window.location.href = '/api/auth/google/start';
    });
    $('cred-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/auth/login', {
          method: 'POST',
          body: { email: $('login-email').value, password: $('login-pass').value }
        });
        $('auth-dialog').close();
        await refreshSession();
        showNotice('Prihlásený.');
      } catch (err) {
        showNotice('Prihlásenie zlyhalo: ' + err.message, true);
      }
    });
    $('key-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/ops/login', { method: 'POST', body: { key: $('login-key').value } });
        $('auth-dialog').close();
        await refreshSession();
        showNotice('Prihlásený kľúčom.');
      } catch (err) {
        showNotice('Neplatný kľúč: ' + err.message, true);
      }
    });

    $('ttk-connect-btn').addEventListener('click', connectEip1193);
    $('ttk-act-connect').addEventListener('click', connectEip1193);
    $('ttk-act-refresh').addEventListener('click', loadTetrakis);
    $('ttk-act-send').addEventListener('click', () => $('ttk-send-box').scrollIntoView({ behavior: 'smooth' }));
    $('ttk-copy-btn').addEventListener('click', async () => {
      const addr = $('ttk-contract-addr').textContent;
      if (addr && addr.startsWith('0x')) {
        await navigator.clipboard.writeText(addr);
        showNotice('Adresa skopírovaná: ' + addr);
      }
    });

    $('wallet-refresh-btn').addEventListener('click', loadWallet);
    $('vault-refresh-btn').addEventListener('click', loadVaultAndStudio);
    $('vault-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/assistant/secrets', {
          method: 'POST',
          body: { provider: $('vault-provider').value, name: $('vault-name').value, value: $('vault-secret').value }
        });
        $('vault-secret').value = '';
        showNotice('Kľúč bezpečne zašifrovaný v trezore.');
        void loadVaultAndStudio();
      } catch (err) {
        showNotice('Uloženie do trezora zlyhalo: ' + err.message, true);
      }
    });

    $('ais-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api('/api/assistant/ai-studio/co-create', {
          method: 'POST',
          body: { task: $('ais-task').value, mode: $('ais-mode').value }
        });
        $('ais-output').textContent = res.final_reply || res.trinity_plan || JSON.stringify(res, null, 2);
        $('ais-output').hidden = false;
      } catch (err) {
        showNotice('Google AI Studio Bridge chyba: ' + err.message, true);
      }
    });

    $('docs-refresh-btn').addEventListener('click', loadDocs);
    $('docs-search').addEventListener('input', renderDocs);

    $('cmdk-btn').addEventListener('click', () => {
      renderCommandPalette();
      $('cmdk-dialog').showModal();
      $('cmdk-input').focus();
    });
    $('cmdk-input').addEventListener('input', renderCommandPalette);
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        renderCommandPalette();
        $('cmdk-dialog').showModal();
        $('cmdk-input').focus();
      }
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const initial = (window.location.hash || '').replace(/^#/, '');
    if (VIEW_META[initial]) switchView(initial, false);
    void refreshSession();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
`;
