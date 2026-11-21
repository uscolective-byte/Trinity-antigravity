import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { executeWallet, processTelegramUpdate } from '../src/telegram-bridge.js';
import { runTool } from '../src/tools.js';
import { listAllIntegrations } from '../src/external-integrations.js';
import { handleInboundWebhook } from '../src/inbound-webhooks.js';

test('Direct Connect Hub (connect.html) contains all social, crypto, and messaging channels', async () => {
  const htmlPath = join(process.cwd(), 'public', 'connect.html');
  const html = await readFile(htmlPath, 'utf8');

  assert.match(html, /Telegram Bot/);
  assert.match(html, /@Antigravity_trinity_bot/);
  assert.match(html, /Telegram @wallet/);
  assert.match(html, /TON · USDT · TTK/);
  assert.match(html, /WhatsApp Business & Direct/);
  assert.match(html, /wa\.me/);
  assert.match(html, /\/api\/v1\/webhooks\/whatsapp/);
  assert.match(html, /LinkedIn B2B & Content Hub/);
  assert.match(html, /linkedin\.com\/sharing\/share-offsite/);
  assert.match(html, /underground Street collective/);
  assert.match(html, /@old_dirty_bastard013/);
  assert.match(html, /Tetrakis \(\$TTK\)/);
  assert.match(html, /Viber Pay & Viber Bot/);
  assert.match(html, /Paysafe & Paysafecard Wallet/);
});

test('Telegram bridge responds with TON, USDT, and TTK info for /wallet command', async () => {
  const env = {
    TELEGRAM_BOT_TOKEN: 'mock-token',
    DB: {
      prepare: () => ({
        first: async () => ({ ton_address: 'EQB_DUMMY_TON_ADDRESS_123', crypto_address: '0x7e17...81e4', crypto_network: 'TON/Base' })
      })
    }
  };

  const text = await executeWallet(env);
  assert.ok(text);
  assert.match(text, /TRINITY & TELEGRAM WALLET/);
  assert.match(text, /EQB_DUMMY_TON_ADDRESS_123/);
  assert.match(text, /ton:\/\/transfer\/EQB_DUMMY_TON_ADDRESS_123/);
  assert.match(text, /USDT \(TON Jetton\), TON/);
  assert.match(text, /Tetrakis \(\$TTK\)/);
  assert.match(text, /1 000 000 000 TTK/);
});

test('meta_manage tool successfully creates drafts targeting linkedin and whatsapp', async () => {
  const mockEnv = {
    TRINITY_OWNER_EMAIL: 'basterix@auru.space',
    TRINITY_ENV: 'production'
  };
  const agent = { id: 'orchestrator', tools: ['meta_manage'] };

  const resLi = await runTool(mockEnv, agent, 'meta_manage', {
    action: 'create_post_draft',
    topic: 'Trinity Sovereign Core v11.1 a Tetrakis tokenomics',
    target_platform: 'linkedin'
  });

  assert.equal(resLi.action, 'create_post_draft');
  assert.equal(resLi.status, 'draft_ready');
  assert.equal(resLi.platform, 'linkedin');
  assert.equal(resLi.target_profiles.linkedin_feed, 'LinkedIn Professional Feed');

  const resWa = await runTool(mockEnv, agent, 'meta_manage', {
    action: 'create_post_draft',
    topic: 'Kritická systémová aktualizácia siete',
    target_platform: 'whatsapp'
  });

  assert.equal(resWa.action, 'create_post_draft');
  assert.equal(resWa.status, 'draft_ready');
  assert.equal(resWa.platform, 'whatsapp');
  assert.equal(resWa.target_profiles.whatsapp_channel, 'WhatsApp Direct Broadcast');
});

test('External integrations registry includes meta_social, linkedin, and telegram', async () => {
  const env = {
    META_ACCESS_TOKEN: 'mock_meta_token',
    LINKEDIN_TOKEN: 'mock_li_token',
    TELEGRAM_BOT_TOKEN: 'mock_tg_token'
  };
  const integrations = await listAllIntegrations(env);
  const byId = Object.fromEntries(integrations.map(i => [i.id, i]));

  assert.ok(byId.meta_social, 'meta_social must be present in registry');
  assert.equal(byId.meta_social.name, 'Meta Platforms (Facebook, Instagram & WhatsApp)');
  assert.equal(byId.meta_social.status, 'configured');

  assert.ok(byId.linkedin, 'linkedin must be present in registry');
  assert.equal(byId.linkedin.name, 'LinkedIn Professional Network');
  assert.equal(byId.linkedin.status, 'configured');

  assert.ok(byId.telegram, 'telegram must be present in registry');
  assert.equal(byId.telegram.name, 'Telegram Bot & @wallet Node');
  assert.equal(byId.telegram.status, 'configured');

  assert.ok(byId.viber, 'viber must be present in registry');
  assert.equal(byId.viber.name, 'Viber Messaging & Viber Pay');

  assert.ok(byId.paysafe, 'paysafe must be present in registry');
  assert.equal(byId.paysafe.name, 'Paysafe & Paysafecard Financial Gateway');
});

test('Inbound webhook hub processes whatsapp and meta verification requests', async () => {
  const reqWa = new Request('https://auru.space/api/v1/webhooks/whatsapp', { method: 'GET' });
  const resWa = await handleInboundWebhook(reqWa, {}, {}, 'whatsapp');
  assert.equal(resWa.status, 200);
  const dataWa = await resWa.json();
  assert.equal(dataWa.ok, true);
  assert.equal(dataWa.source, 'whatsapp');

  const reqMetaChallenge = new Request('https://auru.space/api/v1/webhooks/meta?hub.challenge=test_meta_token_123', { method: 'GET' });
  const resMetaChallenge = await handleInboundWebhook(reqMetaChallenge, {}, {}, 'meta');
  assert.equal(resMetaChallenge.status, 200);
  const textChallenge = await resMetaChallenge.text();
  assert.equal(textChallenge, 'test_meta_token_123');
});
