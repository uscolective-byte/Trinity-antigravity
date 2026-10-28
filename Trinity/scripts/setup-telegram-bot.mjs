import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const WEBHOOK_URL = 'https://auru.space/api/telegram/webhook';
const TOKEN_FORMAT = /^\d{5,20}:[A-Za-z0-9_-]{30,100}$/;
const CHAT_ID_FORMAT = /^\d{1,20}$/;

// Never embed a webhook secret, owner ID or bot token in tracked source.
function localCredential(file) {
  const filename = path.resolve(process.cwd(), '.credentials', file);
  return fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8').trim() : '';
}
function cloudflareSecretPut(name, value) {
  // Fixed arguments only; the secret is sent through stdin, never CLI arguments.
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const proc = spawnSync(command, ['--no-install', 'wrangler', 'secret', 'put', name], {
    input: value + '\n',
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  if (proc.error || proc.status !== 0) {
    // Wrangler output may contain sensitive details. Do not echo stdout/stderr.
    throw new Error('Cloudflare rejected secret configuration for ' + name + ' (exit ' + String(proc.status) + ').');
  }
}
async function telegramApi(token, method, body) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: body ? 'POST' : 'GET',
    ...(body ? {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('Telegram ' + method + ' HTTP ' + response.status);
  const json = await response.json();
  if (json.ok !== true) throw new Error('Telegram ' + method + ' rejected the request.');
  return json.result;
}

async function main() {
  console.log('Trinity 11.0 — Telegram setup (credential-safe)');
  if (process.argv.length > 2) {
    throw new Error('Token in command-line arguments is forbidden. Use .credentials/telegram_token.txt or TELEGRAM_BOT_TOKEN.');
  }
  const token = (process.env.TELEGRAM_BOT_TOKEN || localCredential('telegram_token.txt')).trim();
  const ownerChatId = (process.env.TELEGRAM_ALLOWED_USER_IDS || localCredential('telegram_allowed_user_ids.txt')).trim();
  if (!TOKEN_FORMAT.test(token)) {
    throw new Error('A new valid Telegram bot token must be supplied through a private credential file or environment variable.');
  }
  if (!CHAT_ID_FORMAT.test(ownerChatId)) {
    throw new Error('Provide one private owner chat ID through TELEGRAM_ALLOWED_USER_IDS or .credentials/telegram_allowed_user_ids.txt.');
  }
  const secret = randomBytes(32).toString('hex');

  // Validate the bot and refuse to replace another service's active webhook.
  const me = await telegramApi(token, 'getMe');
  const existing = await telegramApi(token, 'getWebhookInfo');
  if (existing?.url && existing.url !== WEBHOOK_URL) {
    throw new Error('Another webhook is active. Refusing to overwrite it automatically.');
  }
  console.log('Bot identity verified: @' + String(me?.username || 'unknown'));
  console.log('Updating three Cloudflare Worker secrets without printing their values.');
  cloudflareSecretPut('TELEGRAM_BOT_TOKEN', token);
  cloudflareSecretPut('TELEGRAM_WEBHOOK_SECRET', secret);
  cloudflareSecretPut('TELEGRAM_ALLOWED_USER_IDS', ownerChatId);

  // Only claim registered after the provider confirms the exact URL.
  await telegramApi(token, 'setWebhook', {
    url: WEBHOOK_URL,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: false
  });
  const registered = await telegramApi(token, 'getWebhookInfo');
  if (registered?.url !== WEBHOOK_URL) throw new Error('Telegram did not confirm the expected webhook URL.');
  console.log('Webhook URL verified by Telegram. Cloudflare endpoint must still be tested with /help and an AI question.');

  let delivered = false;
  try {
    const sent = await telegramApi(token, 'sendMessage', {
      chat_id: ownerChatId,
      text: 'Trinity Telegram webhook is registered. Send /help and /gemini Ahoj to verify chat and AI.'
    });
    delivered = Number.isSafeInteger(sent?.message_id);
  } catch {
    console.warn('Test message was not delivered; open a private chat with the bot and verify it manually.');
  }
  console.log(JSON.stringify({webhook_registered: true, owner_message_delivered: delivered, ai_inference_verified: false, pc_actions_verified: false}));
  console.log('Previously exposed bot tokens and webhook secrets must be rotated. Old Git history is not erased by this change.');
}

main().catch(() => {
  // Exception objects from fetch or child processes may include credential-bearing URLs.
  console.error('Telegram setup failed. Check private credentials and access to Cloudflare/Telegram; no tokens are printed.');
  process.exitCode = 1;
});
