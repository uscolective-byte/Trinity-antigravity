/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Finance transfer proposal, spending-cap enforcement, and hash-chained audit ledger (Trinity/src/finance-gateway.js).
 */
import { z } from 'zod';
import { HttpError, hash } from './security.js';
import { resolveProviderSecret } from './secret-vault.js';

export const SPENDING_CAPS = Object.freeze({
  MAX_SINGLE_TRANSACTION_EUR: 50.00,
  MAX_DAILY_TOTAL_EUR: 200.00
});

export const transferProposalSchema = z.object({
  amount_eur: z.number().finite().positive().max(10000),
  recipient: z.string().trim().min(2).max(120),
  provider: z.enum(['revolut', 'paypal', 'sepa']).default('revolut'),
  note: z.string().trim().max(300).optional()
}).strict();

export const transferConfirmSchema = z.object({
  proposal_id: z.string().trim().min(8).max(80),
  confirmation_token: z.string().trim().min(4).max(128).optional()
}).strict();

const readyDatabases = new WeakSet();
async function ensureFinanceTables(env) {
  if (!env.DB || readyDatabases.has(env.DB)) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS ops_finance_proposals (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      recipient TEXT NOT NULL,
      provider TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      requires_push_confirmation INTEGER DEFAULT 0,
      confirmation_code TEXT NOT NULL,
      signature_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ops_finance_audit_ledger (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      recipient TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      provider_tx_id TEXT,
      prev_entry_hash TEXT NOT NULL,
      entry_hash TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      receipt_json TEXT NOT NULL
    )`
  ];
  for (const sql of statements) {
    try { await env.DB.prepare(sql).run(); } catch {}
  }
  readyDatabases.add(env.DB);
}

export async function proposeTransfer(env, ownerId, input) {
  const params = transferProposalSchema.parse(input);
  await ensureFinanceTables(env);

  const amountEur = Number(params.amount_eur.toFixed(2));
  const amountCents = Math.round(amountEur * 100);
  const requiresPush = amountEur > SPENDING_CAPS.MAX_SINGLE_TRANSACTION_EUR;

  // Check daily spending limit
  let dailyTotalCents = 0;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const sumRow = await env.DB.prepare(
      "SELECT SUM(amount_cents) as total FROM ops_finance_audit_ledger WHERE owner_id=? AND timestamp LIKE ? AND status='completed'"
    ).bind(ownerId, `${today}%`).first();
    dailyTotalCents = Number(sumRow?.total || 0);
  } catch {}

  const dailyTotalEur = dailyTotalCents / 100;
  if ((dailyTotalEur + amountEur) > SPENDING_CAPS.MAX_DAILY_TOTAL_EUR) {
    throw new HttpError(400, `Transfer would exceed the daily limit of ${SPENDING_CAPS.MAX_DAILY_TOTAL_EUR} EUR (used today: ${dailyTotalEur.toFixed(2)} EUR, requested: ${amountEur.toFixed(2)} EUR).`);
  }

  const proposalId = `fin_${crypto.randomUUID().slice(0, 18)}`;
  const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 300_000; // 5 minutes

  const signatureHash = await hash(`${proposalId}:${ownerId}:${amountCents}:${params.recipient}:${confirmationCode}:${expiresAt}`);

  try {
    await env.DB.prepare(
      `INSERT INTO ops_finance_proposals(id, owner_id, amount_cents, currency, recipient, provider, note, status, requires_push_confirmation, confirmation_code, signature_hash, expires_at)
       VALUES(?, ?, ?, 'EUR', ?, ?, ?, 'pending', ?, ?, ?, ?)`
    ).bind(
      proposalId, ownerId, amountCents, params.recipient, params.provider,
      params.note || '', requiresPush ? 1 : 0, confirmationCode, signatureHash, expiresAt
    ).run();
  } catch (err) {
    throw new HttpError(500, `Failed to store financial proposal: ${err.message}`);
  }

  return {
    proposal_id: proposalId,
    status: 'pending_confirmation',
    amount_eur: amountEur,
    currency: 'EUR',
    recipient: params.recipient,
    provider: params.provider,
    spending_cap_single_eur: SPENDING_CAPS.MAX_SINGLE_TRANSACTION_EUR,
    daily_cap_remaining_eur: Math.max(0, SPENDING_CAPS.MAX_DAILY_TOTAL_EUR - dailyTotalEur),
    requires_high_value_push_confirmation: requiresPush,
    expires_at: new Date(expiresAt).toISOString(),
    instruction_sk: `Pripravila som finančný príkaz na ${amountEur.toFixed(2)} EUR pre ${params.recipient} (${params.provider}).\nNa exekúciu potvrď príkaz kódom: !potvrdit_platbu ${proposalId} ${confirmationCode}`
  };
}

export async function confirmTransfer(env, ownerId, input) {
  const { proposal_id, confirmation_token } = transferConfirmSchema.parse(input);
  await ensureFinanceTables(env);

  let proposal;
  try {
    proposal = await env.DB.prepare(
      'SELECT * FROM ops_finance_proposals WHERE id=? AND owner_id=?'
    ).bind(proposal_id, ownerId).first();
  } catch (err) {
    throw new HttpError(500, `Error looking up financial proposal: ${err.message}`);
  }

  if (!proposal) {
    throw new HttpError(404, `Financial proposal ${proposal_id} not found.`);
  }

  if (proposal.status !== 'pending') {
    throw new HttpError(400, `Financial proposal has already been processed (status: ${proposal.status}).`);
  }

  if (Number(proposal.expires_at) < Date.now()) {
    try {
      await env.DB.prepare("UPDATE ops_finance_proposals SET status='expired' WHERE id=?").bind(proposal_id).run();
    } catch {}
    throw new HttpError(400, 'Financial proposal expired (5-minute validity window). Create a new transfer order.');
  }

  // Verify confirmation code / token
  if (confirmation_token && confirmation_token !== proposal.confirmation_code) {
    throw new HttpError(403, 'Invalid payment confirmation code.');
  }

  // Fetch the latest hash in the audit ledger for cryptographic chaining (SHA-256 chain)
  let lastEntryHash = 'GENESIS_FINANCE_BLOCK_0000000000000000000000000000000000000000';
  try {
    const lastRow = await env.DB.prepare('SELECT entry_hash FROM ops_finance_audit_ledger ORDER BY timestamp DESC LIMIT 1').first();
    if (lastRow?.entry_hash) lastEntryHash = lastRow.entry_hash;
  } catch {}

  // Verify provider credentials (Revolut API / PayPal API) in Secret Vault
  const providerSecret = await resolveProviderSecret(env, proposal.provider === 'paypal' ? 'paypal' : 'revolut');
  const providerConnected = Boolean(providerSecret);

  const amountEur = proposal.amount_cents / 100;
  const ledgerId = `ledger_${crypto.randomUUID().slice(0, 18)}`;
  const timestamp = new Date().toISOString();

  // Truth Policy 2.1: If no live provider API credentials are configured, never fabricate completion!
  if (!providerConnected) {
    const receipt = {
      proposal_id,
      ledger_id: ledgerId,
      amount_eur: amountEur,
      recipient: proposal.recipient,
      provider: proposal.provider,
      status: 'rejected_missing_provider_credentials',
      reason: `Financial transfer was authorized, but provider "${proposal.provider}" has no API key configured in Secret Vault. Truth Policy prevented a simulated completion.`
    };

    const entryHash = await hash(`${ledgerId}:${proposal_id}:${proposal.amount_cents}:${proposal.recipient}:rejected:${lastEntryHash}:${timestamp}`);

    try {
      await env.DB.prepare("UPDATE ops_finance_proposals SET status='aborted_missing_credentials' WHERE id=?").bind(proposal_id).run();
      await env.DB.prepare(
        `INSERT INTO ops_finance_audit_ledger(id, proposal_id, owner_id, amount_cents, currency, recipient, provider, status, provider_tx_id, prev_entry_hash, entry_hash, timestamp, receipt_json)
         VALUES(?, ?, ?, ?, 'EUR', ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(ledgerId, proposal_id, ownerId, proposal.amount_cents, proposal.recipient, proposal.provider, 'rejected_missing_credentials', null, lastEntryHash, entryHash, timestamp, JSON.stringify(receipt)).run();
    } catch {}

    return {
      success: false,
      status: 'requires_provider_credentials',
      proposal_id,
      ledger_id: ledgerId,
      entry_hash: entryHash,
      message_sk: `Finančný prevod bol autorizovaný, ale poskytovateľ "${proposal.provider}" nemá nakonfigurovaný API kľúč v Secret Vault. Režim pravdy zabránil falošnej simulácii úspechu.`
    };
  }

  return {
    success: false,
    status: 'provider_execution_unavailable',
    proposal_id,
    message_sk: 'Konfigurácia poskytovateľa je dostupná. Trinity nemá adaptér na odoslanie tohto prevodu.'
  };
}

export async function getFinanceAuditLedger(env, ownerId, limit = 50) {
  await ensureFinanceTables(env);
  try {
    const rows = await env.DB.prepare(
      'SELECT id, proposal_id, amount_cents, currency, recipient, provider, status, provider_tx_id, prev_entry_hash, entry_hash, timestamp FROM ops_finance_audit_ledger WHERE owner_id=? ORDER BY timestamp DESC LIMIT ?'
    ).bind(ownerId, Math.min(100, Math.max(1, limit))).all();
    return {
      total: rows.results?.length || 0,
      ledger: (rows.results || []).map(r => ({
        ...r,
        amount_eur: r.amount_cents / 100
      }))
    };
  } catch (err) {
    return { total: 0, ledger: [], error: err.message };
  }
}
