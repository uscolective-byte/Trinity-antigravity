import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {telegramIntegrationStatus, executeCrypto, executeFleet, executePC} from '../src/telegram-bridge.js';

const setup = readFileSync(new URL('../scripts/setup-telegram-bot.mjs', import.meta.url), 'utf8');

test('Telegram setup does not contain fixed credential literals or CLI-token support', () => {
  assert.doesNotMatch(setup, /const\s+WEBHOOK_SECRET\s*=\s*['"]/);
  assert.doesNotMatch(setup, /const\s+OWNER_CHAT_ID\s*=\s*['"]/);
  assert.doesNotMatch(setup, /process\.argv\[2\]/);
  assert.match(setup, /randomBytes\(32\)/);
  assert.match(setup, /shell:\s*process\.platform\s*===\s*'win32'/);
  assert.match(setup, /'TELEGRAM_BOT_TOKEN'/);
  assert.match(setup, /'TELEGRAM_WEBHOOK_SECRET'/);
  assert.match(setup, /'TELEGRAM_ALLOWED_USER_IDS'/);
});

test('configured Telegram is not incorrectly reported live verified', () => {
  const status = telegramIntegrationStatus({
    TELEGRAM_BOT_TOKEN: '123456789:' + 'a'.repeat(35),
    TELEGRAM_WEBHOOK_SECRET: 'b'.repeat(64),
    TELEGRAM_ALLOWED_USER_IDS: '123456789'
  });
  assert.equal(status.bot_token, true);
  assert.equal(status.webhook_secret, true);
  assert.equal(status.allowed_users, true);
  assert.equal(status.live_verified, false);
});

test('Telegram fleet summary is explicitly catalog only', () => {
  const output = executeFleet();
  assert.match(output, /KATALÓG/);
  assert.match(output, /nie živá diagnostika/);
});

test('Telegram crypto summary never invents live Jericho prices', async () => {
  const output = await executeCrypto({});
  assert.match(output, /Trhové dáta: nedostupné/);
  assert.doesNotMatch(output, /prepojenie aktívne/);
});

test('PC Bridge state does not assert Local Gateway receipt', async () => {
  const output = await executePC({});
  assert.match(output, /Offline/);
  assert.doesNotMatch(output, /Online & Pripravené/);
});
