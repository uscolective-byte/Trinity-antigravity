import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {planCompatibleMigrations} from '../scripts/compatible-migrations.mjs';

const names=['0060_tool_calling_registry.sql','0061_sovereign_ledger_mmr.sql','0062_truth_policy_enforcement.sql','0063_licensing_antispam.sql','0064_hitl_approvals.sql','0065_user_credentials.sql','0066_device_gateways_and_target_user.sql'];
let mf,db;
const files=await Promise.all(names.map(async name=>({name,sql:await readFile(new URL('../migrations/'+name,import.meta.url),'utf8')})));
const columns=async table=>(await db.prepare(`PRAGMA table_info('${table}')`).all()).results;
async function applyPlan(plan){for(const file of plan){const statements=file.sql.split(/;\s*(?:\r?\n|$)/).map(sql=>sql.trim()).filter(Boolean);await db.batch(statements.map(sql=>db.prepare(sql)));}}
before(async()=>{
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'fixture',modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'compatible-migrations',FRESH:'fresh-truth-migration'}}]}));db=await mf.getD1Database('DB','fixture');
  const sqls=[
    "CREATE TABLE ops_users(email TEXT PRIMARY KEY,role TEXT,password_hash TEXT,password_salt TEXT,avatar_url TEXT,last_login_at TEXT)",
    "INSERT INTO ops_users VALUES('owner@example.com','owner','fixture-existing-hash','fixture-existing-salt',NULL,NULL)",
    'CREATE TABLE ops_system_actions(id TEXT PRIMARY KEY,target_user TEXT)',
    "CREATE TABLE ops_device_gateways(id TEXT PRIMARY KEY,user_email TEXT NOT NULL,device_name TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'active',last_seen INTEGER,created_at TEXT,updated_at TEXT)",
    "INSERT INTO ops_device_gateways VALUES('existing-gateway','owner@example.com','Fixture PC','fixture-existing-token-hash','active',123,'old-created','old-updated')",
    'CREATE TABLE sovereign_events(id TEXT PRIMARY KEY,action TEXT)',
    "INSERT INTO sovereign_events VALUES('existing-event','fixture')",
    'CREATE TABLE truth_violations(id TEXT PRIMARY KEY,memory_id TEXT,agent TEXT,claim TEXT,reason TEXT,severity TEXT,r2_evidence_key TEXT,detected_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
    "INSERT INTO truth_violations(id,agent,claim,reason,severity) VALUES('existing-violation','guardian','fixture claim','fixture reason','medium')"
  ];for(const sql of sqls)await db.prepare(sql).run();
  // Match the deployed canonical registry, including existing statistics.
  await applyPlan([files[0]]);
  await db.prepare("INSERT INTO trinity_tool_registry(tool_id,name,handler_type,handler_target,enabled,success_count) VALUES('existing-tool','Existing tool','service','CORE',1,23)").run();
});
after(async()=>{await mf?.dispose();});
test('plan verifies existing fields and preserves unrelated SQL and source fingerprints',async()=>{
  const plan=await planCompatibleMigrations(files,new Set(),columns);
  assert.equal(plan.length,7);assert.equal(plan.flatMap(f=>f.skipped).length,5);
  const credentials=plan.find(f=>f.name.startsWith('0065'));assert.equal(credentials.skipped.length,4);assert.match(credentials.sql,/SELECT 1/);assert.notEqual(credentials.source_sha256,credentials.effective_sha256);
  const registry=plan[0];assert.equal(registry.source_sha256,registry.effective_sha256);
});
test('reconciled production-shaped schema applies without changing owner, credentials, gateway or tool rows',async()=>{
  const snapshot=async()=>({users:(await db.prepare('SELECT * FROM ops_users').all()).results,gateways:(await db.prepare('SELECT * FROM ops_device_gateways').all()).results,tools:(await db.prepare('SELECT * FROM trinity_tool_registry').all()).results,violations:(await db.prepare('SELECT * FROM truth_violations').all()).results});
  const before=await snapshot(),plan=await planCompatibleMigrations(files,new Set(),columns);await applyPlan(plan);assert.deepEqual(await snapshot(),before);
  const event=await db.prepare("SELECT truth_verified,reality_hash FROM sovereign_events WHERE id='existing-event'").first();assert.deepEqual(event,{truth_verified:0,reality_hash:null});
  assert.ok((await columns('ops_hitl_approvals')).some(c=>c.name==='approval_token_hash'));
  assert.deepEqual(await planCompatibleMigrations(files,new Set(names),columns),[]);
});
test('fresh truth migration accepts the actual Guardian violation record contract',async()=>{
  const fresh=await mf.getD1Database('FRESH','fixture');await fresh.prepare('CREATE TABLE sovereign_events(id TEXT PRIMARY KEY)').run();
  await fresh.batch(files[2].sql.split(/;\s*(?:\r?\n|$)/).map(sql=>sql.trim()).filter(Boolean).map(sql=>fresh.prepare(sql)));
  await fresh.prepare('INSERT INTO truth_violations(id,memory_id,agent,claim,reason,severity,r2_evidence_key,detected_at) VALUES(?,?,?,?,?,?,?,?)').bind('guardian-id','memory-id','guardian','fixture','evidence missing','high',null,'2026-11-20T00:00:00Z').run();
  assert.equal((await fresh.prepare('SELECT agent FROM truth_violations WHERE id=?').bind('guardian-id').first()).agent,'guardian');
});
test('replaying an unrecorded migration verifies the INTEGER default before skipping',async()=>{
  const plan=await planCompatibleMigrations([files[2]],new Set(),columns);assert.equal(plan[0].skipped.length,2);await applyPlan(plan);
});
test('different types, nullability, defaults and unsupported constraints are not adopted',async()=>{
  const file={name:'test.sql',sql:'ALTER TABLE sample ADD COLUMN value TEXT;'};
  for(const column of [{name:'value',type:'INTEGER',notnull:0,dflt_value:null},{name:'value',type:'TEXT',notnull:1,dflt_value:null},{name:'value',type:'TEXT',notnull:0,dflt_value:"'unexpected'"}]){
    await assert.rejects(planCompatibleMigrations([file],new Set(),async name=>name==='sample'?[column]:[]),/does not match/);
  }
  await assert.rejects(planCompatibleMigrations([{name:'test.sql',sql:'ALTER TABLE sample ADD COLUMN value TEXT UNIQUE;'}],new Set(),async name=>name==='sample'?[{name:'value',type:'TEXT',notnull:0,dflt_value:null}]:[]),/does not match/);
});
test('DDL-like text in comments, strings and trigger bodies remains byte-for-byte unchanged',async()=>{
  const sql="/*\nALTER TABLE sample ADD COLUMN value TEXT;\n*/\nINSERT INTO notes VALUES('first\nALTER TABLE sample ADD COLUMN value TEXT;\nlast');\nCREATE TRIGGER sample_guard BEFORE DELETE ON notes BEGIN SELECT RAISE(ABORT, 'do not delete;'); END;\n";
  const plan=await planCompatibleMigrations([{name:'text.sql',sql}],new Set(),async table=>{if(table==='sample')throw new Error('Text must not trigger a metadata query');return [];});
  assert.equal(plan[0].sql,sql);assert.deepEqual(plan[0].skipped,[]);
});
test('existing incompatible legacy registry halts the plan before any migration',async()=>{
  await assert.rejects(planCompatibleMigrations(files,new Set(),async table=>table==='trinity_tool_registry'?[{name:'id'},{name:'name'},{name:'executor'}]:[]),/Unsupported tool registry layout/);
});
