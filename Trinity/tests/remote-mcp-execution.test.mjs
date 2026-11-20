import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {storeSecret,prepareRemoteMcpCall,executeApprovedRemoteMcpCall,verifyRemoteMcp} from '../src/secret-vault.js';
import {createHitlApproval,decideAndExecuteHitlApproval,getHitlApproval} from '../src/hitl-approvals.js';
import {runTool} from '../src/tools.js';
import {toolReceiptForOutcome} from '../src/engine.js';

let mf,env,connector;
const owner='owner@example.com',endpoint='https://mcp.example.com/mcp';
const originalFetch=globalThis.fetch;
let behavior='success',calls=[];
function mockFetch(url,options){
  assert.equal(url,endpoint);
  const message=JSON.parse(options.body);calls.push(message);
  assert.equal(options.headers.Authorization,'Bearer fixture-token');
  if(message.method==='notifications/initialized')return new Response(null,{status:202});
  let result=message.method==='initialize'?{protocolVersion:'2025-03-26',serverInfo:{name:'fixture'},capabilities:{tools:{}}}:{tools:[{name:'fixture_tool',inputSchema:{type:'object'}}]};
  if(message.method==='tools/call'){
    if(behavior==='disconnect')throw new Error('connection lost after send');
    result=behavior==='error'?{isError:true,content:[{type:'text',text:'fixture failure'}]}:behavior==='malformed'?{}:{content:[{type:'text',text:JSON.stringify(message.params.arguments)}]};
  }
  return Response.json({jsonrpc:'2.0',id:message.id,result},{headers:{'mcp-session-id':'fixture-session'}});
}
before(async()=>{
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'fixture',modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'remote-mcp-execution'}}]}));
  const DB=await mf.getD1Database('DB','fixture');
  const vault=(await readFile(new URL('../migrations/0021_secret_vault.sql',import.meta.url),'utf8')).replace(" CHECK(provider IN ('github','cloudflare','custom'))",'');
  const approvals=await readFile(new URL('../migrations/0064_hitl_approvals.sql',import.meta.url),'utf8');
  for(const sql of [vault,approvals,'CREATE TABLE ops_events(action TEXT,details TEXT)','CREATE TABLE ops_plugins(id TEXT PRIMARY KEY,installed INTEGER,enabled INTEGER)',"INSERT INTO ops_plugins VALUES('connectors',1,1)"]){
    for(const statement of sql.split(';').map(x=>x.trim()).filter(Boolean))await DB.prepare(statement).run();
  }
  env={DB,TRINITY_VAULT_KEY:Buffer.alloc(32,7).toString('base64url'),TRINITY_OWNER_EMAIL:owner};
  connector=await storeSecret(env,owner,{provider:'mcp_server',name:'MCP fixture',secret:JSON.stringify({url:endpoint,token:'fixture-token'})});
  globalThis.fetch=mockFetch;
});
after(async()=>{globalThis.fetch=originalFetch;await mf?.dispose();});
async function proposal(args={value:42}){
  behavior='success';calls=[];
  const payload=await prepareRemoteMcpCall(env,owner,{connector_id:connector.id,tool_name:'fixture_tool',arguments:args});
  const created=await createHitlApproval(env,{requestUrl:'https://auru.dev',requestedBy:owner,input:{action_type:'remote_mcp_call',title:'MCP fixture call',rationale:'Verify exact invocation with explicit approval.',payload}});
  return created.approval;
}
test('proposal never executes; approval executes exact arguments once and persists proof',async()=>{
  const approval=await proposal({value:42});
  assert.equal(calls.filter(c=>c.method==='tools/call').length,0);
  const result=await decideAndExecuteHitlApproval(env,{id:approval.id,decision:'approve',actor:owner});
  assert.equal(result.status,'executed');assert.equal(result.result.tool_execution_verified,true);
  const invoked=calls.filter(c=>c.method==='tools/call');assert.equal(invoked.length,1);assert.deepEqual(invoked[0].params,{name:'fixture_tool',arguments:{value:42}});
  await assert.rejects(decideAndExecuteHitlApproval(env,{id:approval.id,decision:'approve',actor:owner}),/spracovaná/);
  assert.equal(calls.filter(c=>c.method==='tools/call').length,1);
});
test('remote tool error cannot create an executed approval',async()=>{
  const approval=await proposal();behavior='error';
  const result=await decideAndExecuteHitlApproval(env,{id:approval.id,decision:'approve',actor:owner});
  assert.equal(result.status,'failed');assert.match(result.error_message,/chybu vykonania/);
});
for(const condition of ['disconnect','malformed'])test(`${condition} after dispatch is UNKNOWN_OUTCOME and cannot replay`,async()=>{
  const approval=await proposal();behavior=condition;
  const result=await decideAndExecuteHitlApproval(env,{id:approval.id,decision:'approve',actor:owner});
  assert.equal(result.status,'failed');assert.equal(result.result.status,'UNKNOWN_OUTCOME');assert.equal(result.result.automatic_retry_allowed,false);
  await assert.rejects(decideAndExecuteHitlApproval(env,{id:approval.id,decision:'approve',actor:owner}),/spracovaná/);
  assert.equal(calls.filter(c=>c.method==='tools/call').length,1);
});
test('rejection and expired approvals make no tool call',async()=>{
  const rejected=await proposal();await decideAndExecuteHitlApproval(env,{id:rejected.id,decision:'reject',actor:owner});
  const expired=await proposal();await env.DB.prepare('UPDATE ops_hitl_approvals SET expires_at=0 WHERE id=?').bind(expired.id).run();
  await assert.rejects(decideAndExecuteHitlApproval(env,{id:expired.id,decision:'approve',actor:owner}),/vypršala/);
  assert.equal(calls.filter(c=>c.method==='tools/call').length,0);
});
test('Telegram cannot approve an external call without web review of complete arguments',async()=>{
  const approval=await proposal();await assert.rejects(decideAndExecuteHitlApproval(env,{id:approval.id,decision:'approve',actor:owner,channel:'telegram'}),/cez web/);
  assert.equal((await getHitlApproval(env,approval.id)).status,'pending');assert.equal(calls.filter(c=>c.method==='tools/call').length,0);
});
test('agent proposal and caller-scoped status use the real D1 approval workflow',async()=>{
  behavior='success';calls=[];
  const agent={id:'orchestrator',tools:['remote_mcp_call','remote_mcp_call_status']},context={adminAuthorized:true,userEmail:owner};
  const proposed=await runTool(env,agent,'remote_mcp_call',{connector_id:connector.id,tool_name:'fixture_tool',arguments:{value:'agent'}},context);
  assert.equal(proposed.status,'pending');assert.equal(proposed.executed,false);assert.equal(calls.filter(c=>c.method==='tools/call').length,0);
  await assert.rejects(runTool(env,agent,'remote_mcp_call_status',{approval_id:proposed.id},{...context,userEmail:'other@example.com'}),/neexistuje/);
  await decideAndExecuteHitlApproval(env,{id:proposed.id,decision:'approve',actor:owner});
  const result=await runTool(env,agent,'remote_mcp_call_status',{approval_id:proposed.id},context);
  assert.equal(result.status,'completed');assert.equal(result.approval_status,'executed');assert.equal(result.result.external_effect_verified,false);assert.ok(result._evidence.receipt_id);
});
test('running calls and executed rows without proof cannot become successful agent receipts',async()=>{
  const approval=await proposal();
  const agent={id:'orchestrator',tools:['remote_mcp_call_status']},context={adminAuthorized:true,userEmail:owner};
  await env.DB.prepare("UPDATE ops_hitl_approvals SET status='executing' WHERE id=?").bind(approval.id).run();
  const running=await runTool(env,agent,'remote_mcp_call_status',{approval_id:approval.id},context);
  assert.equal(toolReceiptForOutcome('remote_mcp_call_status',running).status,'running');
  await env.DB.prepare("UPDATE ops_hitl_approvals SET status='executed',result_json='{}' WHERE id=?").bind(approval.id).run();
  const unverified=await runTool(env,agent,'remote_mcp_call_status',{approval_id:approval.id},context);
  assert.equal(toolReceiptForOutcome('remote_mcp_call_status',unverified).status,'failed');
});
test('concurrent approval decisions cannot invoke the tool twice',async()=>{
  const approval=await proposal();
  const results=await Promise.allSettled([1,2].map(()=>decideAndExecuteHitlApproval(env,{id:approval.id,decision:'approve',actor:owner})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(calls.filter(c=>c.method==='tools/call').length,1);
});
test('failure to persist a completed remote response becomes UNKNOWN_OUTCOME',async()=>{
  const approval=await proposal();let rejected=false;
  const wrapped={...env,DB:{prepare(sql){if(sql.includes("SET status='executed'")&&!rejected){rejected=true;return {bind(){return {run:async()=>{throw new Error('fixture database write failure');}};}};}return env.DB.prepare(sql);}}};
  const result=await decideAndExecuteHitlApproval(wrapped,{id:approval.id,decision:'approve',actor:owner});
  assert.equal(result.result.status,'UNKNOWN_OUTCOME');assert.equal(result.result.automatic_retry_allowed,false);
  await assert.rejects(decideAndExecuteHitlApproval(env,{id:approval.id,decision:'approve',actor:owner}),/spracovaná/);
  assert.equal(calls.filter(c=>c.method==='tools/call').length,1);
});
test('oversized manually assembled approval payload is rejected before credential lookup',async()=>{
  await assert.rejects(executeApprovedRemoteMcpCall({}, {owner_id:owner,connector_fingerprint:'fixture',endpoint,connector_id:connector.id,tool_name:'fixture_tool',arguments:{value:'x'.repeat(16001)}}),/prekročili limit/);
});
test('nonboolean isError cannot impersonate a valid successful tool response',async()=>{
  const fetcher=async(url,options)=>{
    const request=JSON.parse(options.body);
    if(request.method==='tools/call')return Response.json({jsonrpc:'2.0',id:3,result:{isError:'true',content:[]}});
    return mockFetch(url,options);
  };
  behavior='success';
  await assert.rejects(verifyRemoteMcp(JSON.stringify({url:endpoint,token:'fixture-token'}),{fetcher,call:{name:'fixture_tool',arguments:{}}}),error=>error.outcomeUnknown===true);
});
test('rotated connector invalidates proposal and prevents credential substitution',async()=>{
  const approval=await proposal();const payload=approval.payload;
  await storeSecret(env,owner,{provider:'mcp_server',name:'MCP fixture',secret:JSON.stringify({url:endpoint,token:'fixture-token'})});
  await assert.rejects(executeApprovedRemoteMcpCall(env,payload),/zmenilo/);
  assert.equal(calls.filter(c=>c.method==='tools/call').length,0);
});
