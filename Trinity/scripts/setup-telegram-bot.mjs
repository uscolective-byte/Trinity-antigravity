import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const WEBHOOK_URL = 'https://auru.space/api/telegram/webhook';
const WEBHOOK_SECRET = 'trinity_tg_sec_99a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4';
const OWNER_CHAT_ID = '8358735041';

async function main() {
  console.log('🤖 Trinity 11.0 — Secure Telegram Bot Setup');
  console.log('---------------------------------------------');

  let token = process.argv[2]?.trim();
  const credPath = path.resolve(process.cwd(), '.credentials/telegram_token.txt');

  if (!token && fs.existsSync(credPath)) {
    token = fs.readFileSync(credPath, 'utf8').trim();
  }

  if (!token) {
    console.error('❌ Missing Telegram Bot Token.');
    console.error('Usage:');
    console.error('  1. Create file: .credentials/telegram_token.txt with the new token and run: node scripts/setup-telegram-bot.mjs');
    console.error('  2. Or pass directly: node scripts/setup-telegram-bot.mjs <YOUR_NEW_TOKEN>');
    process.exit(1);
  }

  // 1. Verify token with Telegram API
  console.log('1. Verifying new token with Telegram API (getMe)...');
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const me = await meRes.json();
  if (!me.ok) {
    console.error('❌ Telegram rejected the token:', me.description);
    process.exit(1);
  }
  console.log(`✅ Token is valid for bot: ${me.result.first_name} (@${me.result.username})`);

  // 2. Upload secret to Cloudflare Worker
  console.log('2. Uploading TELEGRAM_BOT_TOKEN to production Cloudflare Secrets...');
  const proc = spawnSync('npx', ['wrangler', 'secret', 'put', 'TELEGRAM_BOT_TOKEN', '--env=""'], {
    input: token,
    encoding: 'utf8',
    shell: true
  });
  if (proc.status !== 0) {
    console.error('❌ Failed to store secret via Wrangler:', proc.stderr || proc.stdout);
    process.exit(1);
  }
  console.log('✅ Secret TELEGRAM_BOT_TOKEN uploaded to Cloudflare Worker "trinity".');

  // 3. Register Webhook
  console.log('3. Registering webhook at https://auru.space/api/telegram/webhook...');
  const whRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      secret_token: WEBHOOK_SECRET,
      allowed_updates: ['message'],
      drop_pending_updates: false
    })
  });
  const wh = await whRes.json();
  if (!wh.ok) {
    console.error('❌ Webhook registration failed:', wh.description);
    process.exit(1);
  }
  console.log('✅ Webhook configured with cryptographic secret token.');

  // 4. Send test message to owner
  console.log(`4. Sending verification message to owner (Chat ID: ${OWNER_CHAT_ID})...`);
  const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: OWNER_CHAT_ID,
      text: `🤖 Trinity_Telegram je pripravený!\n\nAhoj Sabo, nový suverénny bot bol úspešne nakonfigurovaný v režime Truth Policy 2.0.\n\nOverovacie príkazy:\n/help\n/status\n/pc\n/crypto\n/fleet`
    })
  });
  const send = await sendRes.json();
  if (send.ok) {
    console.log(`✅ Message delivered! (message_id: ${send.result.message_id})`);
  } else {
    console.warn('⚠️ Could not send welcome message (the user may not have started the bot with /start in Telegram yet).');
  }

  // 5. Clean up local token file if present
  if (fs.existsSync(credPath)) {
    fs.unlinkSync(credPath);
    console.log('🧹 Local file .credentials/telegram_token.txt has been securely removed.');
  }

  console.log('---------------------------------------------');
  console.log('🎉 Done! The new bot is operational and secured.');
}

main().catch(err => {
  console.error('Critical error:', err);
  process.exit(1);
});
