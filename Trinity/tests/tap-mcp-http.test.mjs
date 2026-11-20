import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createApiKey } from '../src/api-keys.js';
import { hash } from '../src/security.js';
import { verifyReceipt } from '../../packages/contracts/src/tap.js';

let mf, db, tapDb, bucket, host, missingHost, writeKey, readKey, otherKey;
const origin = 'https://tap-http.test';
async function applySql(database, path) {
  const sql = readFileSync(new URL(path, import.meta.url), 'utf8');
  for (const statement of sql.replace(/--[^\n]*/g, '').split(';').filter(s => s.trim())) await database.prepare(statement).run();
}
const countRuns = async () => (await tapDb.prepare('SELECT COUNT(*) AS count FROM tap_runs').first()).count;
async function call(worker, secret, args, name='diagnostic_ping') {
  return worker.fetch(origin + '/mcp', {
    method: 'POST', headers: {
      Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {})
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
  });
}
async function rpc(response) {
  assert.equal(response.status, 200, await response.clone().text());
  const text = await response.text();
  const payload = text.trimStart().startsWith('{') ? JSON.parse(text)
    : text.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => JSON.parse(line.slice(5).trim())).find(item => item.id === 1);
  assert.ok(payload); assert.equal(payload.error, undefined);
  return payload.result;
}
const toolPayload = result => JSON.parse(result.content.find(item => item.type === 'text').text);

before(async () => {
  const modules = readdirSync('dist').filter(name => !name.endsWith('.map') && !name.endsWith('.md'))
    .map(name => ({ type: name === 'index.js' ? 'ESModule' : 'Text', path: resolve('dist', name) }));
  modules.sort((a, b) => a.type === 'ESModule' ? -1 : b.type === 'ESModule' ? 1 : 0);
  const bindings = { TRINITY_ENV: 'production', TRINITY_TAP_ENABLED: 'true', TRINITY_TAP_PRODUCTION: 'diagnostic-only' };
  mf = new Miniflare(convertV4MiniflareOptions({ workers: [
    { name: 'tap-http', modules, compatibilityDate: '2026-10-01', compatibilityFlags: ['nodejs_compat'], bindings,
      d1Databases: { DB: 'tap-http-host-db', TAP_DB: 'tap-http-proof-db' }, r2Buckets: { TAP_ARTIFACTS: 'tap-http-proof-r2' } },
    { name: 'tap-http-missing', modules, compatibilityDate: '2026-10-01', compatibilityFlags: ['nodejs_compat'], bindings,
      d1Databases: { DB: 'tap-http-host-db' } }
  ] }));
  db = await mf.getD1Database('DB', 'tap-http');
  tapDb = await mf.getD1Database('TAP_DB', 'tap-http');
  bucket = await mf.getR2Bucket('TAP_ARTIFACTS', 'tap-http');
  host = await mf.getWorker('tap-http'); missingHost = await mf.getWorker('tap-http-missing');
  await applySql(db, '../migrations/0020_api_access_keys.sql');
  await db.batch([
    db.prepare('CREATE TABLE ops_plugins(id TEXT PRIMARY KEY, installed INTEGER, enabled INTEGER)'),
    db.prepare("INSERT INTO ops_plugins(id,installed,enabled) VALUES('mcp',1,1)"),
    db.prepare('CREATE TABLE ops_events(action TEXT,details TEXT)')
  ]);
  await applySql(tapDb, '../docs/omni12/tap-foundation.sql');
  writeKey = (await createApiKey({ DB: db }, 'fixture-owner', { name: 'HTTP TAP writer', scopes: ['mcp:read', 'mcp:write'] })).secret;
  readKey = (await createApiKey({ DB: db }, 'fixture-owner', { name: 'HTTP TAP reader', scopes: ['mcp:read'] })).secret;
  otherKey = (await createApiKey({ DB: db }, 'fixture-owner', { name: 'HTTP TAP second writer', scopes: ['mcp:write'] })).secret;
});
after(async () => { await mf?.dispose(); });

test('existing production HTTP/MCP diagnostic verifies D1/R2 receipt and replays without another execution', async () => {
  const args = { message: 'HTTP MCP execution evidence', idempotency_key: crypto.randomUUID() };
  const firstRpc = await rpc(await call(host, writeKey, args)), first = toolPayload(firstRpc);
  assert.notEqual(firstRpc.isError, true); assert.equal(first.status, 'healthy'); assert.equal(first.echo, args.message);
  assert.equal(first.tap.status, 'VERIFIED'); assert.equal(first.tap.environment, 'production');
  assert.equal(await verifyReceipt(first.tap.evidence[0], first.tap_request, first.tap.result), true);
  const receipt = await tapDb.prepare('SELECT receipt_json,artifact_key FROM tap_evidence_receipts WHERE run_id=?').bind(first.tap.run_id).first();
  assert.deepEqual(JSON.parse(receipt.receipt_json), first.tap.evidence[0]);
  assert.deepEqual(JSON.parse(await (await bucket.get(receipt.artifact_key)).text()), first.tap.evidence[0]);
  const replay = toolPayload(await rpc(await call(host, writeKey, args)));
  assert.deepEqual(replay, first);
  const events = (await tapDb.prepare('SELECT status FROM tap_audit_events WHERE run_id=? ORDER BY id').bind(first.tap.run_id).all()).results;
  assert.deepEqual(events.map(row => row.status), ['QUEUED', 'RUNNING', 'COMPLETED', 'VERIFIED']);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM ops_events').first()).count, 0);
});

test('HTTP/MCP read-only or unauthenticated requests cannot execute or create TAP runs', async () => {
  const before = await countRuns();
  assert.equal((await call(host, readKey, { idempotency_key: crypto.randomUUID() })).status, 403);
  assert.equal((await call(host, null, { idempotency_key: crypto.randomUUID() })).status, 401);
  assert.equal(await countRuns(), before);
});

test('HTTP/MCP authenticated principals cannot share runs; changed replay is an MCP error', async () => {
  const args = { message: 'principal-bound HTTP proof', idempotency_key: crypto.randomUUID() };
  const first = toolPayload(await rpc(await call(host, writeKey, args)));
  const other = toolPayload(await rpc(await call(host, otherKey, args)));
  assert.equal(first.tap.status, 'VERIFIED'); assert.equal(other.tap.status, 'VERIFIED');
  assert.notEqual(first.tap.run_id, other.tap.run_id);
  assert.notEqual(first.tap_request.sender.id, other.tap_request.sender.id);
  const before = await countRuns();
  const changed = await rpc(await call(host, writeKey, { ...args, message: 'changed after execution' }));
  assert.equal(changed.isError, true); assert.match(changed.content[0].text, /TAP_IDEMPOTENCY_CONFLICT/);
  assert.equal(await countRuns(), before);
});

test('HTTP/MCP activation with missing TAP storage fails without legacy healthy fallback', async () => {
  const before = await countRuns();
  const result = await rpc(await call(missingHost, writeKey, { idempotency_key: crypto.randomUUID() }));
  assert.equal(result.isError, true); assert.match(result.content[0].text, /TAP_ISOLATED_STORAGE_REQUIRED/);
  assert.doesNotMatch(result.content[0].text, /"status"\s*:\s*"healthy"/);
  assert.equal(await countRuns(), before);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM ops_events').first()).count, 0);
});

test('HTTP/MCP loss of durable proof becomes UNKNOWN_OUTCOME/isError without re-executing', async () => {
  const args = { message: 'lost-proof HTTP fixture', idempotency_key: crypto.randomUUID() };
  const first = toolPayload(await rpc(await call(host, writeKey, args)));
  assert.equal(first.tap.status, 'VERIFIED');
  const row = await tapDb.prepare('SELECT artifact_key FROM tap_evidence_receipts WHERE run_id=?').bind(first.tap.run_id).first();
  await bucket.delete(row.artifact_key);
  const replayRpc = await rpc(await call(host, writeKey, args)), replay = toolPayload(replayRpc);
  assert.equal(replayRpc.isError, true); assert.equal(replay.status, 'unknown_outcome');
  assert.equal(replay.tap.status, 'UNKNOWN_OUTCOME'); assert.equal(replay.error, 'TAP_RECONCILIATION_REQUIRED');
  const running = await tapDb.prepare("SELECT COUNT(*) AS count FROM tap_audit_events WHERE run_id=? AND status='RUNNING'").bind(first.tap.run_id).first();
  assert.equal(running.count, 1);
});


test('MCP development tools send executable gateway payloads and bind edits to verified source',async()=>{
  await db.prepare(`CREATE TABLE ops_system_actions (
    id TEXT PRIMARY KEY,action TEXT,payload_json TEXT,rationale TEXT,status TEXT,requested_by TEXT,
    approved_by TEXT,approved_at INTEGER,expires_at INTEGER,target_user TEXT,receipt_json TEXT,error TEXT,
    created_at TEXT,updated_at TEXT
  )`).run();
  const build=toolPayload(await rpc(await call(host,writeKey,{},'run_build')));
  assert.equal(build.status,'proposed');
  const buildRow=await db.prepare('SELECT payload_json FROM ops_system_actions WHERE id=?').bind(build.id).first();
  assert.deepEqual(JSON.parse(buildRow.payload_json),{project:'Trinity',task:'build'});
  assert.equal((await call(host,readKey,{},'run_build')).status,403);

  async function completeRead(name,args,receipt){
    const pending=call(host,writeKey,args,name);
    let row;
    for(let i=0;i<100;i++){
      row=await db.prepare("SELECT id,payload_json FROM ops_system_actions WHERE action='read' AND status='approved' LIMIT 1").first();
      if(row)break;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    assert.ok(row,'MCP tool must enqueue a real read request');
    await db.prepare("UPDATE ops_system_actions SET status='completed',receipt_json=? WHERE id=?").bind(JSON.stringify(receipt),row.id).run();
    return {payload:JSON.parse(row.payload_json),result:await rpc(await pending)};
  }
  const directory=await completeRead('list_project_files',{path:'Trinity'}, {path:'Trinity',is_directory:true,files:[{name:'package.json',isDirectory:false}]});
  assert.equal(directory.payload.mode,'browse');
  assert.equal(toolPayload(directory.result).files[0].name,'package.json');
  const content='original source',sha256=await hash(content);
  const source=await completeRead('get_source_file',{path:'Trinity/test.txt'}, {path:'Trinity/test.txt',content,sha256,bytes:content.length});
  assert.equal(toolPayload(source.result).sha256,sha256);
  const malformed=await completeRead('get_source_file',{path:'Trinity/test.txt'}, {content:'invented',sha256});
  assert.equal(malformed.result.isError,true);
  const edit=await completeRead('edit_source_file',{path:'Trinity/test.txt',content:'updated source',rationale:'Test guarded MCP source edit'}, {path:'Trinity/test.txt',content,sha256});
  const editResult=toolPayload(edit.result);
  assert.equal(editResult.status,'proposed');
  const row=await db.prepare('SELECT payload_json FROM ops_system_actions WHERE id=?').bind(editResult.id).first();
  assert.deepEqual(JSON.parse(row.payload_json),{path:'Trinity/test.txt',content:'updated source',expected_sha256:sha256});
  const created=toolPayload(await rpc(await call(host,writeKey,{path:'Trinity/new-fixture.txt',content:'new file',rationale:'Test guarded creation of a new source file',expected_sha256:'absent'},'edit_source_file')));
  assert.equal(created.status,'proposed');
  assert.equal(created.approval_required,true);
  const createdRow=await db.prepare('SELECT payload_json,status FROM ops_system_actions WHERE id=?').bind(created.id).first();
  assert.equal(createdRow.status,'proposed');
  assert.deepEqual(JSON.parse(createdRow.payload_json),{path:'Trinity/new-fixture.txt',content:'new file',expected_sha256:'absent'});
  const scriptArgs={runtime:'node',path:'Trinity/workspace/scripts/fixture.mjs',expected_sha256:sha256,args:['test'],timeout_ms:1000,rationale:'Test approved script execution proposal'};
  const script=toolPayload(await rpc(await call(host,writeKey,scriptArgs,'pc_run_script')));
  assert.equal(script.status,'proposed');
  assert.equal(script.approval_required,true);
  const scriptRow=await db.prepare('SELECT payload_json,status FROM ops_system_actions WHERE id=?').bind(script.id).first();
  assert.equal(scriptRow.status,'proposed');
  const {rationale,...expectedScript}=scriptArgs;
  assert.deepEqual(JSON.parse(scriptRow.payload_json),{task:'script',...expectedScript});
  const invalidScript=await rpc(await call(host,writeKey,{...scriptArgs,expected_sha256:'absent'},'pc_run_script'));
  assert.equal(invalidScript.isError,true);
  assert.equal((await call(host,readKey,scriptArgs,'pc_run_script')).status,403);
  const found=await completeRead('pc_find_files',{path:'Trinity',glob:'**/*.js'}, {action:'read',task:'workspace-search',mode:'files',path:'Trinity',glob:'**/*.js',files:['Trinity/src/index.js'],truncated:true,limit_reasons:['result_limit']});
  assert.equal(found.payload.task,'workspace-search');
  assert.equal(found.payload.mode,'files');
  assert.equal(toolPayload(found.result).truncated,true);
  assert.deepEqual(toolPayload(found.result).files,['Trinity/src/index.js']);
  const invalidSearch=await completeRead('pc_search_text',{path:'Trinity',pattern:'needle'}, {matches:[]});
  assert.equal(invalidSearch.result.isError,true);
  const emptyReceipt={action:'read',task:'workspace-search',mode:'content',path:'Trinity',glob:'**/*',pattern:'needle',regex:false,case_sensitive:false,matches:[],search_performed:false,coverage:'no_candidate_files',truncated:false,limit_reasons:[]};
  const emptySearch=await completeRead('pc_search_text',{path:'Trinity',pattern:'needle'},emptyReceipt);
  assert.equal(emptySearch.result.isError,undefined);
  assert.equal(toolPayload(emptySearch.result).search_performed,false);
  assert.equal(toolPayload(emptySearch.result).coverage,'no_candidate_files');
  const wrongPattern=await completeRead('pc_search_text',{path:'Trinity',pattern:'needle'},{...emptyReceipt,pattern:'different query'});
  assert.equal(wrongPattern.result.isError,true);
  assert.equal((await call(host,readKey,{path:'Trinity',pattern:'needle'},'pc_search_text')).status,403);
});
