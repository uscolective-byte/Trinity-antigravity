import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyRemoteMcp,readRemoteMcpCatalog} from '../src/secret-vault.js';
import {runTool,TOOL_SCHEMAS} from '../src/tools.js';
import {createJob} from '../src/jobs.js';

const endpoint='https://walletbot.me/bot-relay/public-api/mcp';
const initialization={protocolVersion:'2025-03-26',serverInfo:{name:'fixture',version:'1'},capabilities:{tools:{}}};
function mockServer({initialize=initialization,tools=[{name:'positions',inputSchema:{type:'object'}}],sse=false}={}){
  const calls=[];
  return {calls,fetcher:async(url,options)=>{
    const body=JSON.parse(options.body);calls.push({url,headers:{...options.headers},body});
    if(body.method==='notifications/initialized')return new Response(null,{status:202});
    const payload={jsonrpc:'2.0',id:body.id,result:body.method==='initialize'?initialize:{tools}};
    return new Response(sse?`event: message\ndata: ${JSON.stringify(payload)}\n\n`:JSON.stringify(payload),{headers:{'content-type':sse?'text/event-stream':'application/json','mcp-session-id':'fixture-session'}});
  }};
}
test('MCP verification requires handshake and catalog, preserves session and never calls trading tools',async()=>{
  const server=mockServer();const result=await verifyRemoteMcp(JSON.stringify({url:endpoint,token:'fixture-token'}),server);
  assert.equal(result.tools_count,1);assert.equal(result.tool_execution_verified,false);
  assert.deepEqual(server.calls.map(c=>c.body.method),['initialize','notifications/initialized','tools/list']);
  assert.equal(server.calls[2].headers['Mcp-Session-Id'],'fixture-session');
  assert.equal(server.calls[2].headers.Authorization,'Bearer fixture-token');
  assert.equal(JSON.stringify(result).includes('fixture-token'),false);
});
test('MCP supports SSE protocol replies',async()=>assert.equal((await verifyRemoteMcp(endpoint,mockServer({sse:true}))).connected,true));
test('HTTP 200 alone cannot establish an MCP connection',async()=>{
  await assert.rejects(verifyRemoteMcp(endpoint,{fetcher:async()=>new Response('<html>Login</html>')}),/protokolovú/);
  await assert.rejects(verifyRemoteMcp(endpoint,{fetcher:async()=>Response.json({jsonrpc:'2.0',id:1,error:{code:-32600,message:'token-secret'}})}),/neoveril/);
});
test('MCP authorization failures remain disconnected without leaking response bodies',async()=>{
  await assert.rejects(verifyRemoteMcp(endpoint,{fetcher:async()=>new Response('secret',{status:401})}),/vyžaduje autorizáciu/);
});
test('MCP rejects servers without tools capability and malformed catalogs',async()=>{
  await assert.rejects(verifyRemoteMcp(endpoint,mockServer({initialize:{...initialization,capabilities:{}}})),/podporu nástrojov/);
  await assert.rejects(verifyRemoteMcp(endpoint,mockServer({tools:[{name:'trade'}]})),/zoznam nástrojov/);
});
test('MCP refuses embedded credentials and query credentials before network use',async()=>{
  for(const url of ['https://user:secret@example.com/mcp','https://example.com/mcp?token=secret','http://localhost/mcp']){
    await assert.rejects(verifyRemoteMcp(url,{fetcher:()=>{throw new Error('must not fetch');}}),/MCP/);
  }
});
test('MCP verification bounds remote response size',async()=>{
  await assert.rejects(verifyRemoteMcp(endpoint,{fetcher:async()=>new Response('x'.repeat(262145))}),/limit/);
});
test('MCP catalog exposes real schemas only on explicit catalog requests',async()=>{
  assert.equal((await verifyRemoteMcp(endpoint,mockServer())).tools,undefined);
  const result=await verifyRemoteMcp(endpoint,{...mockServer(),includeTools:true});
  assert.deepEqual(result.tools[0].inputSchema,{type:'object'});
  assert.equal(result.tools[0].name,'positions');
});
test('agent catalog tool rejects ordinary users and missing authenticated identity before database access',async()=>{
  const env={DB:{prepare(){throw new Error('database must not be accessed');}}};
  const args={connector_id:'11111111-1111-4111-8111-111111111111'};
  await assert.rejects(runTool(env,{id:'test',tools:['remote_mcp_catalog']},'remote_mcp_catalog',args),/overeného správcu/);
  await assert.rejects(runTool(env,{id:'test',tools:['remote_mcp_catalog']},'remote_mcp_catalog',args,{adminAuthorized:true}),/overenú identitu/);
  assert.equal(TOOL_SCHEMAS.remote_mcp_catalog.safeParse({...args,owner_id:'other@example.com'}).success,false);
});
test('catalog credential lookup is scoped to caller, exact connector, MCP provider and nonrevoked rows',async()=>{
  let actual;
  const env={DB:{prepare(sql){assert.match(sql,/status!='revoked'/);return {bind(...args){actual=args;return {first:async()=>null};}};}}};
  await assert.rejects(readRemoteMcpCatalog(env,'OWNER@example.com','connector-id'),/neexistuje/);
  assert.deepEqual(actual,['connector-id','owner@example.com','mcp_server']);
});
test('agent reads encrypted connector and receives actual remote catalog with read receipt',async()=>{
  const owner='owner@example.com',id='11111111-1111-4111-8111-111111111111',name='fixture';
  const raw=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt']);
  const secret=JSON.stringify({url:endpoint,token:'fixture-token'});
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(`${owner}:mcp_server:${name}`)},key,new TextEncoder().encode(secret));
  const row={id,owner_id:owner,provider:'mcp_server',name,secret_ciphertext:Buffer.from(encrypted).toString('base64url'),secret_iv:Buffer.from(iv).toString('base64url')};
  const env={TRINITY_VAULT_KEY:Buffer.from(raw).toString('base64url'),DB:{prepare(sql){return {bind(...args){return {first:async()=>{
    if(sql.includes('ops_plugins'))return {installed:1,enabled:1};
    assert.deepEqual(args,[id,owner,'mcp_server']);return row;
  }};}};}}};
  const original=globalThis.fetch,server=mockServer();globalThis.fetch=server.fetcher;
  try{
    const result=await runTool(env,{id:'orchestrator',tools:['remote_mcp_catalog']},'remote_mcp_catalog',{connector_id:id},{adminAuthorized:true,userEmail:owner});
    assert.equal(result.tools[0].name,'positions');assert.equal(result._evidence.effect,'read');
    assert.equal(result.tool_execution_verified,false);assert.equal(JSON.stringify(result).includes('fixture-token'),false);
  }finally{globalThis.fetch=original;}
});
test('workflow receives caller identity without granting owner mode',async()=>{
  let jobId,workflow;
  const env={DB:{prepare(sql){return {bind(...args){if(sql.includes('INSERT INTO ops_jobs'))jobId=args[0];return {run:async()=>({success:true}),first:async()=>({id:jobId})};}};}},OPS_WORKFLOW:{create:async value=>{workflow=value;}}};
  const result=await createJob(env,{task:'Vypíš katalóg MCP',agent:'orchestrator',mode:'single',user_email:'owner@example.com',owner_mode:false});
  assert.equal(workflow.params.user_email,'owner@example.com');assert.equal(workflow.params.job_id,result.id);
});
test('catalog discovers only caller-owned connector metadata without decrypting credentials',async()=>{
  const row={id:'connector',name:'Walletbot',status:'failed',last_verified_at:null};
  const env={DB:{prepare(sql){assert.match(sql,/owner_id=\?/);assert.doesNotMatch(sql,/SELECT \*/);return {bind(owner){assert.equal(owner,'owner@example.com');return {all:async()=>({results:[row]})};}};}}};
  const result=await readRemoteMcpCatalog(env,'OWNER@example.com');
  assert.deepEqual(result.connectors,[row]);assert.equal(result.connection_verified,false);
});
