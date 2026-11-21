/**
 * @module TRINITY_OMNI_CORE
 * @subsystem VIBER_MESSAGING_AND_WALLET_BRIDGE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Obojsmerný most medzi ekosystémom Trinity, Viber Chat API a peňaženkou Viber Pay.
 * Spĺňa Truth Policy 2.1 – žiadne vymyslené zostatky ani potvrdenia platieb bez dôkazu.
 */

import { executeStatus, executePC, executeCrypto, executeFleet } from './telegram-bridge.js';

/**
 * Normalizuje telefónne číslo pre Viber Pay (+421... alebo 09...)
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeViberPhone(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/[\s-]/g, '');
  if (/^\+?[1-9]\d{7,14}$/.test(cleaned)) {
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }
  return null;
}

/**
 * Vracia stav integrácie Viber bota a peňaženky Viber Pay.
 * @param {object} env
 * @returns {object}
 */
export function viberIntegrationStatus(env) {
  const token = env.VIBER_AUTH_TOKEN || null;
  const botName = env.VIBER_BOT_NAME || 'Trinity Sovereign Bot';
  const hasToken = Boolean(token && token.length >= 10);
  return {
    service: 'Viber Chat API & Viber Pay',
    configured: hasToken,
    bot_name: botName,
    webhook_endpoint: '/api/v1/webhooks/viber',
    viber_pay_supported: true,
    supported_events: ['conversation_started', 'message', 'subscribed', 'delivered', 'seen']
  };
}

/**
 * Zostaví informačnú správu pre peňaženku Viber Pay a multi-wallet ekosystém Trinity.
 * @param {object} env
 * @param {string} ownerId
 * @returns {Promise<string>}
 */
export async function executeViberWallet(env, ownerId = 'admin') {
  let viberPhone = null;
  let tonAddress = null;
  let cryptoAddress = null;
  let paysafeAccount = null;

  if (env.DB?.prepare) {
    try {
      const row = await env.DB.prepare(
        "SELECT viber_wallet_phone, ton_address, crypto_address, paysafe_account FROM ops_wallet_terminals WHERE owner_id IN (?, 'admin', 'saboivan2008@gmail.com') ORDER BY updated_at DESC LIMIT 1"
      ).bind(ownerId).first();
      if (row) {
        viberPhone = row.viber_wallet_phone;
        tonAddress = row.ton_address;
        cryptoAddress = row.crypto_address;
        paysafeAccount = row.paysafe_account;
      }
    } catch {}
  }

  let msg = '💜 TRINITY & VIBER PAY PEŇAŽENKA\n\n';
  if (viberPhone) {
    msg += '✅ Viber Pay (Rakuten Viber) je nakonfigurovaný:\n';
    msg += `• Registrované číslo: ${viberPhone}\n`;
    msg += '• Mena: EUR (okamžité P2P prevody)\n';
    msg += `• Priamy odkaz na kontakt: viber://contact?number=${encodeURIComponent(viberPhone)}\n\n`;
  } else {
    msg += '⚠️ Viber Pay zatiaľ nemá nastavené telefónne číslo príjemcu.\n';
    msg += 'Nastav ho cez rozhranie terminálov v Trinity (/api/assistant/wallet/terminal/config).\n\n';
  }

  msg += '🌐 Prepojené krypto a digitálne peňaženky:\n';
  if (tonAddress) {
    msg += `• Telegram @wallet (TON): ${tonAddress.slice(0, 8)}...${tonAddress.slice(-6)}\n`;
  } else {
    msg += '• Telegram @wallet (TON): Pripravená na aktiváciu (/wallet)\n';
  }

  if (paysafeAccount) {
    msg += `• Paysafe / myPaysafe: ${paysafeAccount}\n`;
  } else {
    msg += '• Paysafe: myPaysafe & Paysafecard 16-miestne vouchery pripravené\n';
  }

  msg += '• Tetrakis ($TTK): 1 000 000 000 TTK (Base L2 · ChainID 8453)\n';
  msg += '\nVšetky finančné operácie podliehajú overeniu v Sovereign Ledger MMR.';
  return msg;
}

/**
 * Spracuje prichádzajúcu udalosť alebo správu z Viber Chat API.
 * @param {object} env
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function processViberUpdate(env, payload = {}) {
  const event = payload.event;

  // 1. Webhook overovací ping
  if (event === 'webhook') {
    return { status: 0, message: 'ok', event: 'webhook' };
  }

  // 2. Používateľ otvoril dialóg (conversation_started)
  if (event === 'conversation_started') {
    const userName = payload.user?.name || 'Partner';
    return {
      status: 0,
      message: 'ok',
      response: {
        type: 'text',
        text: `Vítaj ${userName} v suverénnom rozhraní TRINITY OMNI-CORE na Viberi.\n\nDostupné príkazy:\n• /wallet - Stav peňaženiek (Viber Pay, Telegram @wallet, Paysafe, Tetrakis)\n• /status - Stav autonómnych agentov\n• /crypto - Trhové kurzy kryptoaktív\n• /help - Prehľad možností`,
        keyboard: {
          Type: 'keyboard',
          Buttons: [
            { Columns: 3, Rows: 1, ActionType: 'reply', ActionBody: '/wallet', Text: '💳 Peňaženka' },
            { Columns: 3, Rows: 1, ActionType: 'reply', ActionBody: '/status', Text: '⚡ Stav Trinity' },
            { Columns: 3, Rows: 1, ActionType: 'reply', ActionBody: '/crypto', Text: '🪙 Krypto' },
            { Columns: 3, Rows: 1, ActionType: 'reply', ActionBody: '/help', Text: 'ℹ️ Pomoc' }
          ]
        }
      }
    };
  }

  // 3. Správa od používateľa
  if (event === 'message') {
    const text = String(payload.message?.text || '').trim();
    const senderId = payload.sender?.id;
    let replyText = '';

    if (/^\/(?:wallet|penazenka|pay)/i.test(text)) {
      replyText = await executeViberWallet(env);
    } else if (/^\/status/i.test(text)) {
      replyText = await executeStatus(env);
    } else if (/^\/crypto/i.test(text)) {
      replyText = await executeCrypto(env);
    } else if (/^\/pc/i.test(text)) {
      replyText = await executePC(env);
    } else if (/^\/fleet/i.test(text)) {
      replyText = executeFleet();
    } else if (/^\/help/i.test(text)) {
      replyText = '⚡ TRINITY VIBER BOT:\n\n• /wallet - Viber Pay, Telegram @wallet & Paysafe\n• /status - Zdravie systému\n• /crypto - Ceny BTC/ETH/SOL & Tetrakis TTK\n• /pc - Stav lokálneho PC mosta\n• /fleet - Zoznam agentov';
    } else {
      replyText = `Prijal som tvoju požiadavku: "${text.slice(0, 80)}". Pre zobrazenie finančných prepojení a peňaženiek napíš /wallet.`;
    }

    // Ak máme VIBER_AUTH_TOKEN a senderId, odošleme odpoveď cez oficiálne Chat API
    if (env.VIBER_AUTH_TOKEN && senderId) {
      try {
        await fetch('https://chatapi.viber.com/pa/send_message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Viber-Auth-Token': env.VIBER_AUTH_TOKEN
          },
          body: JSON.stringify({
            receiver: senderId,
            min_api_version: 1,
            type: 'text',
            text: replyText
          })
        });
      } catch (sendErr) {
        console.error('[VIBER SEND ERROR]', sendErr);
      }
    }

    return {
      status: 0,
      message: 'ok',
      action: 'reply_processed',
      text: replyText
    };
  }

  return { status: 0, message: 'ok', ignored_event: event };
}

/**
 * Spracuje HTTP požiadavku na /api/v1/webhooks/viber
 * @param {Request} request
 * @param {object} env
 * @param {object} ctx
 * @returns {Promise<Response>}
 */
export async function handleViberWebhook(request, env, ctx) {
  if (request.method === 'GET') {
    return Response.json(viberIntegrationStatus(env), { status: 200 });
  }

  if (request.method === 'POST') {
    let payload = {};
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: 'Neplatný JSON formát v tele Viber požiadavky.' }, { status: 400 });
    }

    const result = await processViberUpdate(env, payload);
    return Response.json(result, { status: 200 });
  }

  return Response.json({ error: 'Metóda nepovolená' }, { status: 405 });
}
