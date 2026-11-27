import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  validateLinkedInUrl,
  saveLinkedInConfig,
  verifyLinkedInConnection,
  publishLinkedInPost,
  addHustleLead,
  updateHustleLeadStage,
  deleteHustleLead,
  getHustleOverview,
  runHustleTrinityTask
} from '../src/linkedin-hustle.js';
import { runTool } from '../src/tools.js';

const TEST_VAULT_KEY = Buffer.alloc(32, 9).toString('base64url');

function createHustleMockEnv(extraEnv = {}) {
  const liRows = new Map();
  const leads = new Map();
  const posts = [];
  const secrets = new Map();

  const DB = {
    prepare(sql) {
      return {
        _args: [],
        bind(...args) { this._args = args; return this; },
        async run() {
          if (sql.includes('INSERT INTO ops_hustle_linkedin')) {
            if (sql.includes('verified, last_verified_at')) {
              const [owner_id, author_urn, profile_name, profile_email, last_verified_at] = this._args;
              const prev = liRows.get(owner_id) || {};
              liRows.set(owner_id, {
                ...prev,
                owner_id,
                author_urn: author_urn || prev.author_urn || null,
                profile_name: profile_name || prev.profile_name || null,
                profile_email: profile_email || prev.profile_email || null,
                verified: 1,
                last_verified_at
              });
            } else {
              const [owner_id, profile_url, headline, author_urn, client_id] = this._args;
              const prev = liRows.get(owner_id) || {};
              liRows.set(owner_id, { ...prev, owner_id, profile_url, headline, author_urn, client_id });
            }
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('INSERT INTO ops_hustle_leads')) {
            const [id, owner_id, client_name, company, linkedin_url, service_id, value_cents, notes] = this._args;
            leads.set(id, { id, owner_id, client_name, company, linkedin_url, service_id, value_cents, stage: 'lead', payment_ref: null, notes, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('UPDATE ops_hustle_leads')) {
            const [stage, payment_ref, id, owner_id] = this._args;
            const row = leads.get(id);
            if (row && row.owner_id === owner_id) {
              row.stage = stage;
              if (payment_ref) row.payment_ref = payment_ref;
              row.updated_at = new Date().toISOString();
            }
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('DELETE FROM ops_hustle_leads')) {
            const [id, owner_id] = this._args;
            const row = leads.get(id);
            if (row && row.owner_id === owner_id) {
              leads.delete(id);
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          }
          if (sql.includes('INSERT INTO ops_hustle_posts')) {
            const [id, owner_id, text, share_url, visibility, status, remote_post_id, error_message, published_at] = this._args;
            posts.unshift({ id, owner_id, platform: 'linkedin', text, share_url, visibility, status, remote_post_id, error_message, published_at, created_at: new Date().toISOString() });
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 1 } };
        },
        async first() {
          if (sql.includes('FROM ops_hustle_linkedin WHERE owner_id=?')) {
            return liRows.get(this._args[0]) || null;
          }
          if (sql.includes('FROM ops_hustle_leads WHERE id=? AND owner_id=?')) {
            const [id, owner_id] = this._args;
            const row = leads.get(id);
            return row && row.owner_id === owner_id ? row : null;
          }
          if (sql.includes('INSERT INTO ops_secret_vault')) {
            const [id, owner_id, provider, name, secret_ciphertext, secret_iv, secret_hint] = this._args;
            const row = { id, owner_id, provider, name, secret_ciphertext, secret_iv, secret_hint, status: 'stored', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            secrets.set(`${owner_id}:${provider}`, row);
            return row;
          }
          if (sql.includes('FROM ops_secret_vault') && sql.includes('provider=?')) {
            const provider = this._args[0];
            for (const row of secrets.values()) {
              if (row.provider === provider && row.status !== 'revoked') return row;
            }
            return null;
          }
          if (sql.includes('ops_plugins')) {
            return { id: 'trading', installed: 1, enabled: 1 };
          }
          return null;
        },
        async all() {
          if (sql.includes('FROM ops_hustle_leads')) {
            return { results: [...leads.values()].filter((l) => l.owner_id === this._args[0]) };
          }
          if (sql.includes('FROM ops_hustle_posts')) {
            return { results: posts.filter((p) => p.owner_id === this._args[0]) };
          }
          if (sql.includes('ops_plugins')) {
            return { results: [{ id: 'trading', installed: 1, enabled: 1 }] };
          }
          return { results: [] };
        }
      };
    }
  };

  return { env: { DB, TRINITY_VAULT_KEY: TEST_VAULT_KEY, ...extraEnv }, liRows, leads, posts, secrets };
}

test('LinkedIn Hustle: validateLinkedInUrl accepts official HTTPS LinkedIn hosts only', () => {
  assert.equal(validateLinkedInUrl('https://www.linkedin.com/in/basterix'), 'https://www.linkedin.com/in/basterix');
  assert.equal(validateLinkedInUrl('https://linkedin.com/company/auru'), 'https://linkedin.com/company/auru');
  assert.equal(validateLinkedInUrl('http://www.linkedin.com/in/basterix'), null);
  assert.equal(validateLinkedInUrl('https://linkedin.com.evil.test/in/x'), null);
  assert.equal(validateLinkedInUrl('javascript:alert(1)'), null);
  assert.equal(validateLinkedInUrl('https://user:pw@linkedin.com/in/x'), null);
});

test('LinkedIn Hustle: saveLinkedInConfig encrypts token in Vault and verifyLinkedInConnection verifies live OAuth profile', async () => {
  const { env, secrets } = createHustleMockEnv();

  // Missing token fails honestly
  const noTok = await verifyLinkedInConnection(env, 'basterix');
  assert.equal(noTok.ok, false);
  assert.equal(noTok.status, 'missing_credentials');

  // Save config with encrypted token
  const saved = await saveLinkedInConfig(env, 'basterix', {
    profile_url: 'https://www.linkedin.com/in/ivan-sabo-basterix',
    headline: 'AI Architect & AppSec Engineer',
    access_token: 'AQV-synthetic-linkedin-oauth-token-1234567890'
  });
  assert.equal(saved.configured, true);
  assert.equal(saved.has_token, true);
  assert.equal(saved.token_stored_in_vault, true);
  assert.equal(JSON.stringify(saved).includes('AQV-synthetic-linkedin-oauth-token'), false);
  assert.ok(secrets.has('basterix:linkedin'));

  // Live verification via /v2/userinfo populates author_urn and profile_name
  const verified = await verifyLinkedInConnection(env, 'basterix', {
    fetchImpl: async (url, init) => {
      assert.equal(String(url), 'https://api.linkedin.com/v2/userinfo');
      assert.equal(init.headers.Authorization, 'Bearer AQV-synthetic-linkedin-oauth-token-1234567890');
      return Response.json({ sub: 'abc123XYZ', name: 'Ivan Sabo', email: 'saboivan2008@gmail.com' });
    }
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.verified, true);
  assert.equal(verified.linkedin.author_urn, 'urn:li:person:abc123XYZ');
  assert.equal(verified.linkedin.profile_name, 'Ivan Sabo');

  // Invalid author_urn rejected
  await assert.rejects(
    saveLinkedInConfig(env, 'basterix', { author_urn: 'bad-urn' }),
    (err) => err.status === 400
  );
});

test('LinkedIn Hustle: publishLinkedInPost saves drafts honestly and publishes live with ugcPosts receipt', async () => {
  const { env } = createHustleMockEnv();

  // 1. Draft mode makes zero network calls
  let calls = 0;
  const draft = await publishLinkedInPost(env, 'basterix', {
    text: 'Ponúkam Full-Stack kódovanie a etický AppSec audit pre moderné SaaS projekty.',
    publish_live: false
  }, { fetchImpl: async () => { calls++; return new Response(); } });
  assert.equal(draft.ok, true);
  assert.equal(draft.published, false);
  assert.equal(draft.status, 'draft');
  assert.equal(calls, 0);

  // 2. publish_live=true without token fails honestly
  const missing = await publishLinkedInPost(env, 'basterix', {
    text: 'Pokus o publikovanie bez LinkedIn tokenu.',
    publish_live: true
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.published, false);
  assert.equal(missing.status, 'missing_credentials');

  // 3. publish_live=true with token + author_urn posts to /v2/ugcPosts
  await saveLinkedInConfig(env, 'basterix', {
    author_urn: 'urn:li:person:abc123XYZ',
    access_token: 'AQV-synthetic-linkedin-live-token-987654321'
  });

  const live = await publishLinkedInPost(env, 'basterix', {
    text: 'Potrebujete bezpečný web, API alebo AI agenta? Ozvite sa mi správou na LinkedIn.',
    share_url: 'https://auru.space',
    publish_live: true
  }, {
    fetchImpl: async (url, init) => {
      assert.equal(String(url), 'https://api.linkedin.com/v2/ugcPosts');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['X-Restli-Protocol-Version'], '2.0.0');
      const body = JSON.parse(init.body);
      assert.equal(body.author, 'urn:li:person:abc123XYZ');
      return new Response(JSON.stringify({ id: 'urn:li:share:99887766' }), {
        status: 201,
        headers: { 'x-restli-id': 'urn:li:share:99887766' }
      });
    }
  });
  assert.equal(live.ok, true);
  assert.equal(live.published, true);
  assert.equal(live.remote_post_id, 'urn:li:share:99887766');
  assert.equal(live._evidence.receipt_id, 'linkedin:urn:li:share:99887766');
});

test('LinkedIn Hustle: Lead pipeline requires payment_ref for paid status and separates pipeline vs verified_earned_eur', async () => {
  const { env } = createHustleMockEnv();

  const l1 = await addHustleLead(env, 'basterix', {
    client_name: 'Peter Novák',
    company: 'NovaTech s.r.o.',
    linkedin_url: 'https://www.linkedin.com/in/peter-novak',
    service_id: 'hustle-appsec-audit',
    value_eur: 390,
    notes: 'Záujem o OWASP AppSec audit'
  });
  const l2 = await addHustleLead(env, 'basterix', {
    client_name: 'Jana Kováčová',
    service_id: 'hustle-web-fullstack',
    value_eur: 490
  });

  // Paid without payment_ref must fail (Truth Policy 2.1)
  await assert.rejects(
    updateHustleLeadStage(env, 'basterix', l1.lead.id, { stage: 'paid' }),
    (err) => err.status === 400
  );

  // Paid with valid payment_ref moves 390 EUR to verified_earned_eur
  await updateHustleLeadStage(env, 'basterix', l1.lead.id, { stage: 'paid', payment_ref: 'SEPA-2026-001' });

  const overview = await getHustleOverview(env, 'basterix');
  assert.equal(overview.metrics.verified_earned_eur, 390);
  assert.equal(overview.metrics.pipeline_eur, 490);
  assert.equal(overview.offers.length, 4);

  const del = await deleteHustleLead(env, 'basterix', l2.lead.id);
  assert.equal(del.deleted, true);
});

test('LinkedIn Hustle: runHustleTrinityTask, tools.js wiring, and Hustle tab UI presence', async () => {
  const { env } = createHustleMockEnv({
    AI: {
      async run() {
        return { response: '```js\nexport const auditOk = true;\n```' };
      }
    }
  });

  const aiOut = await runHustleTrinityTask(env, 'basterix', {
    mode: 'appsec_audit',
    prompt: 'Skontroluj XSS a autorizáciu v mojom Express API'
  });
  assert.equal(aiOut.ok, true);
  assert.equal(aiOut.ai_generated, true);
  assert.match(aiOut.output, /auditOk/);

  // Without AI binding, returns honest non-AI structured template
  const tplOut = await runHustleTrinityTask({}, 'basterix', {
    mode: 'linkedin_post',
    prompt: 'Ponuka vývoja moderných webov a AI automatizácií'
  });
  assert.equal(tplOut.ok, true);
  assert.equal(tplOut.ai_generated, false);
  assert.equal(tplOut.can_publish_to_linkedin, true);

  // tools.js hustle_status works via trading plugin
  const agent = { id: 'business', tools: ['hustle_status', 'linkedin_post'] };
  const toolRes = await runTool(env, agent, 'hustle_status', {}, { ownerMode: true, ownerId: 'basterix' });
  assert.equal(toolRes.ok, true);
  assert.ok(Array.isArray(toolRes.offers));

  // UI assertions in chat.html and chat.js.txt
  const chatHtml = await readFile(join(process.cwd(), 'public', 'assistant', 'chat.html'), 'utf8');
  const chatJs = await readFile(join(process.cwd(), 'public', 'assistant', 'chat.js.txt'), 'utf8');
  assert.match(chatHtml, /data-view="hustle"/);
  assert.match(chatHtml, /id="hustle-view"/);
  assert.match(chatHtml, /id="hustle-ai-form"/);
  assert.match(chatHtml, /id="hustle-li-config-form"/);
  assert.match(chatHtml, /id="hustle-li-post-form"/);
  assert.match(chatHtml, /id="hustle-lead-form"/);
  assert.match(chatJs, /loadHustleView/);
  assert.match(chatJs, /\/hustle\/linkedin\/post/);
  assert.match(chatJs, /\/hustle\/run/);
});
