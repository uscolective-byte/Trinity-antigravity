import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {D1} from '../src/lib/d1.js';
import {ToolExecutor} from '../src/lib/trinity-tool-executor.js';

let mf,db;
const source=await readFile(new URL('../migrations/0060_tool_calling_registry.sql',import.meta.url),'utf8');
const statements=source.split(/;\s*(?:\r?\n|$)/).map(sql=>sql.trim()).filter(Boolean);
async function apply(){await db.batch(statements.map(sql=>db.prepare(sql)));}
before(async()=>{
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'fixture',modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'tool-registry-migration'}}]}));
  db=await mf.getD1Database('DB','fixture');
});
after(async()=>{await mf?.dispose();});
test('fresh migration supports actual runtime registry readers without fabricated active tools',async()=>{
  await apply();
  const storage=new D1(db),executor=new ToolExecutor({DB:db});
  assert.deepEqual(await storage.listTools(),[]);assert.equal(await executor.getToolDefinition('pc_execute'),null);
  await db.prepare('INSERT INTO trinity_tool_registry(tool_id,name,category,input_schema,handler_type,handler_target,enabled) VALUES(?,?,?,?,?,?,?)').bind('fixture-read','Fixture read','test','{"type":"object"}','service','CORE',1).run();
  assert.equal((await storage.getTool('fixture-read')).handler_target,'CORE');
  assert.equal((await executor.getToolDefinition('fixture-read')).tool_id,'fixture-read');
  assert.equal((await storage.listTools()).length,1);
});
test('reapplying migration preserves definitions, disabled state and execution statistics',async()=>{
  await db.prepare("UPDATE trinity_tool_registry SET enabled=0,success_count=17,error_count=3,avg_latency_ms=42,last_used='2026-11-20 12:00:00' WHERE tool_id='fixture-read'").run();
  const before=await db.prepare('SELECT * FROM trinity_tool_registry ORDER BY tool_id').all();
  await apply();await apply();
  assert.deepEqual((await db.prepare('SELECT * FROM trinity_tool_registry ORDER BY tool_id').all()).results,before.results);
  assert.deepEqual(await new D1(db).listTools(),[]);
});
test('incompatible legacy shape fails visibly and preserves its data for explicit repair',async()=>{
  await db.prepare('ALTER TABLE trinity_tool_registry RENAME TO canonical_registry_fixture').run();
  await db.prepare('DROP INDEX idx_trinity_tool_registry_category_name').run();
  await db.prepare('CREATE TABLE trinity_tool_registry(id INTEGER PRIMARY KEY,name TEXT,executor TEXT,action TEXT,enabled INTEGER)').run();
  await db.prepare("INSERT INTO trinity_tool_registry VALUES(1,'preserve-me','legacy','read',0)").run();
  await assert.rejects(apply(),/category|column/);
  assert.deepEqual((await db.prepare('SELECT * FROM trinity_tool_registry').all()).results,[{id:1,name:'preserve-me',executor:'legacy',action:'read',enabled:0}]);
});
