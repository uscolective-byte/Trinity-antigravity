// Trinity v7.0.0 — Client
const API = '/api';

async function api(path, opts = {}) {
  const token = window.TRINITY_TOKEN || localStorage.getItem('trinity_token') || '';
  const r = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-Trinity-Token': token, ...opts.headers }
  });
  return r.json();
}

// Health check
async function checkHealth() {
  try {
    const h = await api('/health');
    document.getElementById('status').textContent = h.status + ' v' + h.version;
    document.getElementById('status').style.background = h.status === 'online' ? 'var(--green)' : 'var(--red)';
  } catch { document.getElementById('status').textContent = 'offline'; }
}

// Chat
document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const task = document.getElementById('task').value.trim();
  if (!task) return;
  const mode = document.getElementById('mode').value;
  const agent = document.getElementById('agent').value;
  const provider = document.getElementById('provider').value;

  addMsg('user', task);
  document.getElementById('task').value = '';
  document.getElementById('send').disabled = true;

  try {
    const result = await api('/chat', {
      method: 'POST',
      body: JSON.stringify({ task, mode, agent, provider })
    });
    if (result.error) addMsg('assistant', '❌ ' + result.error);
    else addMsg('assistant', result.response, { model: result.model, fallback: result.fallbackUsed, ms: result.latencyMs, trace: result.trace_id });
  } catch (err) {
    addMsg('assistant', '❌ ' + err.message);
  }
  document.getElementById('send').disabled = false;
});

function addMsg(role, content, meta = {}) {
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  div.textContent = content;
  if (meta.model) {
    const m = document.createElement('div');
    m.style.fontSize = '11px';
    m.style.color = 'var(--text2)';
    m.textContent = `${meta.model} ${meta.fallback ? '(fallback)' : ''} ${meta.ms || 0}ms`;
    div.appendChild(m);
  }
  document.getElementById('conversation').appendChild(div);
}

checkHealth();
