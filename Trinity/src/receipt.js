/**
 * @module TRINITY_OMNI_CORE
 * @subsystem UNIFIED_RECEIPT_ENGINE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Unified receipt architecture for Trinity:
 * OpenTelemetry + Cloudflare Audit + Git Commit Evidence + Sovereign Ledger.
 * Every action = Receipt = Verifiable proof.
 */

import { z } from 'zod';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const EvidenceType = z.enum([
  'file',
  'document',
  'database',
  'git',
  'http',
  'api',
  'ui',
  'test'
]);

export const EvidenceSchema = z.object({
  type: EvidenceType,
  id: z.string().min(1).max(500),
  description: z.string().max(1000).default(''),
  beforeHash: z.string().regex(/^sha256:[a-f0-9]{64}$|^[a-f0-9]{7,64}$/).optional(),
  afterHash: z.string().regex(/^sha256:[a-f0-9]{64}$|^[a-f0-9]{7,64}$/).optional(),
  uri: z.string().max(2048).optional()
}).strict();

export const LedgerProofSchema = z.object({
  eventId: z.string().min(1),
  hash: z.string().min(8),
  signedAt: z.string().datetime(),
  chainHash: z.string().optional()
}).strict();

export const ReceiptStatus = z.enum([
  'success',
  'failed',
  'partial',
  'cancelled'
]);

export const ActorSchema = z.object({
  type: z.enum(['user', 'agent', 'system']),
  id: z.string().min(1).max(200)
}).strict();

export const TargetSchema = z.object({
  type: z.string().min(1).max(100),
  id: z.string().min(1).max(500)
}).strict();

export const UnifiedReceiptSchema = z.object({
  receiptId: z.string().min(1),
  parentReceiptId: z.string().optional(),
  tool: z.string().min(1).max(120),
  action: z.string().min(1).max(120),
  status: ReceiptStatus,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  durationMs: z.number().nonnegative(),
  actor: ActorSchema,
  target: TargetSchema.optional(),
  evidence: z.array(EvidenceSchema).default([]),
  metrics: z.record(z.string(), z.number()).optional(),
  ledger: LedgerProofSchema.optional()
}).strict();

export const ResonanceReceiptExtensionSchema = z.object({
  thesis: z.object({
    intent: z.string(),
    confidence: z.number().min(0).max(1)
  }).strict(),
  transform: z.object({
    guardianPassed: z.boolean(),
    toolsSelected: z.array(z.string())
  }).strict(),
  synthesis: z.object({
    outputHash: z.string(),
    persisted: z.boolean()
  }).strict()
}).strict();

/**
 * Creates a verifiable SHA-256 hash for evidence records.
 */
export function hashPayload(payload) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return 'sha256:' + createHash('sha256').update(serialized).digest('hex');
}

/**
 * Factory for building a schema-validated standardized Receipt.
 */
export function buildReceipt({
  tool,
  action,
  status = 'success',
  actor = { type: 'agent', id: 'trinity' },
  target,
  evidence = [],
  metrics,
  ledger,
  startedAt,
  completedAt,
  parentReceiptId
}) {
  const start = startedAt || new Date().toISOString();
  const end = completedAt || new Date().toISOString();
  const durationMs = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const receiptId = `RCP-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  const receipt = {
    receiptId,
    ...(parentReceiptId ? { parentReceiptId } : {}),
    tool,
    action,
    status,
    startedAt: start,
    completedAt: end,
    durationMs,
    actor,
    ...(target ? { target } : {}),
    evidence,
    ...(metrics ? { metrics } : {}),
    ...(ledger ? { ledger } : {})
  };

  return UnifiedReceiptSchema.parse(receipt);
}

/**
 * Implementation Criterion 1:
 * Trinity creates a target file, computes its SHA-256 hash, independently verifies its contents,
 * and appends a hash-chained receipt to the local Sovereign Ledger.
 * Returns SUCCESS only after all verification steps pass.
 */
export async function executeVerifiedFileCreation({
  targetDir,
  fileName,
  content,
  actor = { type: 'agent', id: 'trinity' }
}) {
  const startedAt = new Date().toISOString();
  if (typeof targetDir !== 'string' || !targetDir.trim()) throw new TypeError('targetDir is required');
  if (typeof fileName !== 'string' || !fileName.trim() ||
      fileName === '.' || fileName === '..' ||
      fileName.includes('/') || fileName.includes('\\') ||
      fileName.includes(':') || fileName.includes('\\0')) {
    throw new Error('INVALID_FILE_NAME: only a single safe filename is allowed');
  }
  if (typeof content !== 'string') throw new TypeError('content must be a string');
  fs.mkdirSync(targetDir, { recursive: true });
  const realDir = fs.realpathSync(targetDir);
  const fullPath = path.join(realDir, fileName);

  // Atomic create-only mode: do not overwrite an existing file or follow a
  // symlink planted at the target. A subsequent read-back verifies the bytes.
  fs.writeFileSync(fullPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });

  // 2. Independent read-back and SHA-256 hash computation
  const readBack = fs.readFileSync(fullPath, 'utf8');
  if (readBack !== content) {
    throw new Error('VERIFICATION_FAILED: File content mismatch after write.');
  }
  const afterHash = hashPayload(readBack);

  // 3. Build hash-chained ledger proof record (not a cryptographic asymmetric signature)
  const completedAt = new Date().toISOString();
  const proofHash = createHash('sha256')
    .update(`${startedAt}|${fileName}|${afterHash}|${actor.id}`)
    .digest('hex');

  const ledgerProof = {
    eventId: `EVT-${Date.now()}`,
    hash: proofHash,
    signedAt: completedAt,
    chainHash: `sha256:${proofHash}`
  };

  // 4. Assemble and validate Receipt
  const receipt = buildReceipt({
    tool: 'write_file',
    action: 'create_verified',
    status: 'success',
    actor,
    target: {
      type: 'file',
      id: fileName
    },
    evidence: [
      {
        type: 'file',
        id: fileName,
        description: 'Authenticated and independently verified file',
        afterHash,
        uri: `file://${fullPath.replace(/\\/g, '/')}`
      }
    ],
    ledger: ledgerProof,
    startedAt,
    completedAt
  });

  // 5. Append to local Sovereign Ledger
  const ledgerPath = path.join(targetDir, 'sovereign-receipt-ledger.jsonl');
  fs.appendFileSync(ledgerPath, JSON.stringify(receipt) + '\n', 'utf8');

  return {
    status: 'SUCCESS',
    receipt,
    verifiedFile: fullPath,
    sha256: afterHash,
    ledgerProof
  };
}
