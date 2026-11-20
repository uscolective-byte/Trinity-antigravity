// Explicit, isolated live verification against Cloudflare's public documentation MCP.
// Uses only a temporary local D1 database; no production credentials or financial tools.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {storeSecret,prepareRemoteMcpCall} from '../src/secret-vault.js';
import {createHitlApproval,decideAndExecuteHitlApproval} from '../src/hitl-approvals.js';

if(process.argv[2]!=='--live')throw new Error('Run explicitly with --live. This contacts the public Cloudflare documentation MCP.');
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'verification',modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'isolated-remote-mcp-verification'}}]}));
try{
  const DB=await mf.getD1Database('DB','verification');
  const vault=(await readFile(new URL('../migrations/0021_secret_vault.sql',import.meta.url),'utf8')).replace(" CHECK(provider IN ('github','cloudflare','custom'))",'');
  const approvals=await readFile(new URL('../migrations/0064_hitl_approvals.sql',import.meta.url),'utf8');
  for(const sql of [vault,approvals,'CREATE TABLE ops_events(action TEXT,details TEXT)'])for(const statement of sql.split(';').map(x=>x.trim()).filter(Boolean))await DB.prepare(statement).run();
  const owner='verification@trinity.invalid',env={DB,TRINITY_VAULT_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),TRINITY_OWNER_EMAIL:owner};
  const endpoint='https://docs.mcp.cloudflare.com/mcp';
  const connector=await storeSecret(env,owner,{provider:'mcp_server',name:'Public Cloudflare documentation',secret:endpoint});
  const payload=await prepareRemoteMcpCall(env,owner,{connector_id:connector.id,tool_name:'search_cloudflare_documentation',arguments:{query:'Cloudflare D1 prepared statements bind parameters'}});
  const created=await createHitlApproval(env,{requestUrl:'https://verification.invalid',requestedBy:'local-verification',input:{action_type:'remote_mcp_call',title:'Isolated documentation read',rationale:'Explicit development verification against a public read-only documentation server.',payload}});
  const completed=await decideAndExecuteHitlApproval(env,{id:created.approval.id,decision:'approve',actor:'local-verification'});
  assert.equal(completed.status,'executed');assert.equal(completed.result.tool_execution_verified,true);
  await assert.rejects(decideAndExecuteHitlApproval(env,{id:created.approval.id,decision:'approve',actor:'local-verification'}),error=>error.status===409);
  const text=completed.result.result.content.filter(item=>item.type==='text').map(item=>item.text).join('\n');
  assert.ok(text.length>0);
  console.log(JSON.stringify({verified:true,scope:'isolated local D1 approval plus real public remote MCP call',endpoint,tool_name:payload.tool_name,approval_id:completed.id,receipt_id:completed.result._evidence.receipt_id,approval_status:completed.status,tool_execution_verified:true,external_effect_verified:false,replay_rejected:true,result_characters:text.length,result_sha256:Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex'),verified_at:new Date().toISOString()}));
}finally{await mf.dispose();}
