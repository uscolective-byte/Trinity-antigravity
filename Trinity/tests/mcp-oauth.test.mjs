import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {beginWalletbotOAuth,finishWalletbotOAuth,refreshMcpOAuthCredential} from '../src/mcp-oauth.js';
import {getSecretMaterial,storeSecret,readRemoteMcpCatalog,secretInputSchema,verifySecret} from '../src/secret-vault.js';

const issuer='https://walletbot.me/bot-relay/public-api',resource=issuer+'/mcp';
const originalFetch=globalThis.fetch;
let mf,env,mode='normal',requests=[],ownerSequence=0,activeToken='fixture-access';
const metadata={issuer,authorization_endpoint:issuer+'/oauth/v1/authorize',token_endpoint:issuer+'/oauth/v1/token',registration_endpoint:issuer+'/oauth/v1/register',code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none']};
async function mockFetch(url,input={}){
  requests.push({url,input});assert.equal(input.redirect,'manual');
  if(url===issuer+'/oauth/v1/protected-resource')return Response.json({resource,authorization_servers:[issuer],scopes_supported:['perps.readonly','perps.trade']});
  if(url==='https://walletbot.me/.well-known/oauth-authorization-server/bot-relay/public-api')return Response.json(mode==='bad-metadata'?{...metadata,token_endpoint:'https://attacker.invalid/token'}:metadata);
  if(url===metadata.registration_endpoint){const payload=JSON.parse(input.body);assert.equal(payload.token_endpoint_auth_method,'none');assert.equal(payload.redirect_uris.length,1);return Response.json({client_id:'fixture-client'});}
  if(url===metadata.token_endpoint){
    const body=new URLSearchParams(input.body);assert.equal(body.get('resource'),resource);assert.equal(body.get('client_id'),'fixture-client');
    if(mode==='disconnect')throw new Error('fixture disconnect');
    if(mode==='token-error')return Response.json({error:'invalid_grant'},{status:400});
    const refreshing=body.get('grant_type')==='refresh_token';
    if(!refreshing)assert.match(body.get('code_verifier'),/^[A-Za-z0-9_-]{43}$/);
    activeToken=refreshing?'fixture-refreshed-access':'fixture-access';
    return Response.json({access_token:activeToken,token_type:'Bearer',refresh_token:refreshing?'fixture-rotated-refresh':'fixture-refresh',expires_in:mode==='bad-ttl'?0:3600,scope:mode==='trade'?'perps.readonly perps.trade':'perps.readonly'});
  }
  if(url===resource){
    assert.equal(input.headers.Authorization,'Bearer '+activeToken);
    const rpc=JSON.parse(input.body);
    if(rpc.method==='notifications/initialized')return new Response(null,{status:202});
    return Response.json({jsonrpc:'2.0',id:rpc.id,result:rpc.method==='initialize'?{protocolVersion:'2025-03-26',serverInfo:{name:'fixture'},capabilities:{tools:{}}}:{tools:[{name:'read_positions',inputSchema:{type:'object'}}]}});
  }
  throw new Error('Unexpected network destination');
}
before(async()=>{
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'fixture',modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'mcp-oauth'}}]}));
  const DB=await mf.getD1Database('DB','fixture');
  const vault=(await readFile(new URL('../migrations/0021_secret_vault.sql',import.meta.url),'utf8')).replace(" CHECK(provider IN ('github','cloudflare','custom'))",'');
  for(const sql of [vault,await readFile(new URL('../migrations/0068_mcp_oauth.sql',import.meta.url),'utf8'),'CREATE TABLE ops_events(action TEXT,details TEXT)'])for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await DB.prepare(statement).run();
  env={DB,TRINITY_VAULT_KEY:Buffer.alloc(32,11).toString('base64url')};globalThis.fetch=mockFetch;
});
after(async()=>{globalThis.fetch=originalFetch;await mf?.dispose();});
async function flow(origin='https://auru.dev'){
  mode='normal';requests=[];const owner=`owner${++ownerSequence}@example.com`;
  const response=await beginWalletbotOAuth(env,new Request(origin+'/api/assistant/mcp/oauth/walletbot/start'),owner);
  const location=new URL(response.headers.get('Location')),state=location.searchParams.get('state');
  const callback=new URL(location.searchParams.get('redirect_uri'));callback.searchParams.set('state',state);callback.searchParams.set('code','fixture-code');
  const cookie=response.headers.get('set-cookie').split(';')[0];
  return {owner,response,location,state,callback,cookie,request:new Request(callback,{headers:{Cookie:cookie}})};
}
test('read-only authorization uses PKCE, exact resource and encrypted caller-bound one-time state',async()=>{
  const f=await flow();assert.equal(f.response.status,303);assert.equal(f.location.searchParams.get('scope'),'perps.readonly');assert.equal(f.location.searchParams.get('resource'),resource);assert.equal(f.location.searchParams.get('code_challenge_method'),'S256');
  assert.match(f.response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
  const row=await env.DB.prepare('SELECT * FROM ops_mcp_oauth_states WHERE owner_id=?').bind(f.owner).first();
  assert.notEqual(row.state_hash,f.state);assert.equal(row.owner_id,f.owner);assert.ok(row.secret_ciphertext);assert.equal(JSON.stringify(row).includes('verifier'),false);
  const completed=await finishWalletbotOAuth(env,f.request,f.owner);assert.equal(completed.connector.status,'verified');assert.equal(completed.scope,'perps.readonly');
  const exchanged=new URLSearchParams(requests.find(r=>r.url===metadata.token_endpoint).input.body);
  const challenge=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(exchanged.get('code_verifier')))).toString('base64url');
  assert.equal(challenge,f.location.searchParams.get('code_challenge'));
  const saved=await getSecretMaterial(env,{ownerId:f.owner,id:completed.connector.id,provider:'mcp_server'});
  const credential=JSON.parse(saved.secret);assert.equal(credential.oauth.refresh_token,'fixture-refresh');assert.equal(saved.secret_ciphertext.includes('fixture-refresh'),false);
  const finished=await env.DB.prepare('SELECT status,secret_ciphertext FROM ops_mcp_oauth_states WHERE owner_id=?').bind(f.owner).first();assert.deepEqual(finished,{status:'completed',secret_ciphertext:''});
  const count=requests.filter(r=>r.url===metadata.token_endpoint).length;
  await assert.rejects(finishWalletbotOAuth(env,f.request,f.owner),error=>error.status===401);assert.equal(requests.filter(r=>r.url===metadata.token_endpoint).length,count);
});
test('OAuth client survives repeated connects and remains bound to the exact domain callback',async()=>{
  await flow();assert.equal(requests.filter(r=>r.url===metadata.registration_endpoint).length,0);
  const f=await flow('https://auru.space');assert.equal(requests.filter(r=>r.url===metadata.registration_endpoint).length,1);assert.equal(f.location.searchParams.get('redirect_uri'),'https://auru.space/api/assistant/mcp/oauth/walletbot/callback');
});
test('wrong user, cookie, issuer and callback origin are rejected before token exchange',async()=>{
  const f=await flow();
  await assert.rejects(finishWalletbotOAuth(env,f.request,'other@example.com'),error=>error.status===401);
  await assert.rejects(finishWalletbotOAuth(env,new Request(f.callback),f.owner),error=>error.status===401);
  const wrongIssuer=new URL(f.callback);wrongIssuer.searchParams.set('iss','https://attacker.invalid');await assert.rejects(finishWalletbotOAuth(env,new Request(wrongIssuer,{headers:{Cookie:f.cookie}}),f.owner),error=>error.status===401);
  const wrongOrigin=new URL(f.callback);wrongOrigin.hostname='auru.space';await assert.rejects(finishWalletbotOAuth(env,new Request(wrongOrigin,{headers:{Cookie:f.cookie}}),f.owner),error=>error.status===401);
  assert.equal(requests.filter(r=>r.url===metadata.token_endpoint).length,0);
});
test('expired state and unexpected metadata cannot start token exchange',async()=>{
  const f=await flow();await env.DB.prepare('UPDATE ops_mcp_oauth_states SET expires_at=0 WHERE owner_id=?').bind(f.owner).run();
  await assert.rejects(finishWalletbotOAuth(env,f.request,f.owner),error=>error.status===401);
  mode='bad-metadata';await assert.rejects(beginWalletbotOAuth(env,new Request('https://auru.dev/api/assistant/mcp/oauth/walletbot/start'),f.owner),/neočakávané/);
  assert.equal(requests.filter(r=>r.url===metadata.token_endpoint).length,0);
});
test('a concurrent callback can exchange a one-time code only once',async()=>{
  const f=await flow();
  const results=await Promise.allSettled([1,2].map(()=>finishWalletbotOAuth(env,f.request,f.owner)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(requests.filter(r=>r.url===metadata.token_endpoint).length,1);
});
for(const scenario of ['trade','bad-ttl','token-error'])test(`${scenario} never produces a stored connected credential`,async()=>{
  const f=await flow();mode=scenario;await assert.rejects(finishWalletbotOAuth(env,f.request,f.owner));
  const row=await env.DB.prepare('SELECT count(*) AS count FROM ops_secret_vault WHERE owner_id=?').bind(f.owner).first();assert.equal(row.count,0);
  const state=await env.DB.prepare('SELECT status,secret_ciphertext FROM ops_mcp_oauth_states WHERE owner_id=?').bind(f.owner).first();assert.deepEqual(state,{status:'failed',secret_ciphertext:''});
});
async function expiredCredential(){
  const f=await flow(),completed=await finishWalletbotOAuth(env,f.request,f.owner);
  let material=await getSecretMaterial(env,{ownerId:f.owner,id:completed.connector.id,provider:'mcp_server'});
  const value=JSON.parse(material.secret);value.oauth.expires_at=0;
  await storeSecret(env,f.owner,{provider:'mcp_server',name:material.name,secret:JSON.stringify(value)});
  material=await getSecretMaterial(env,{ownerId:f.owner,id:completed.connector.id,provider:'mcp_server'});
  return {...f,material};
}
test('expired MCP access renews before catalog lookup and persists rotated refresh token',async()=>{
  const f=await expiredCredential();requests=[];
  const catalog=await readRemoteMcpCatalog(env,f.owner,f.material.id);assert.equal(catalog.connected,true);
  const renewals=requests.filter(r=>r.url===metadata.token_endpoint);assert.equal(renewals.length,1);assert.equal(new URLSearchParams(renewals[0].input.body).get('grant_type'),'refresh_token');
  const latest=await getSecretMaterial(env,{ownerId:f.owner,id:f.material.id,provider:'mcp_server'});assert.equal(JSON.parse(latest.secret).oauth.refresh_token,'fixture-rotated-refresh');
});
test('concurrent refresh attempts cannot reuse the same rotating refresh token',async()=>{
  const f=await expiredCredential();requests=[];
  await Promise.allSettled([1,2].map(()=>refreshMcpOAuthCredential(env,f.material)));
  assert.equal(requests.filter(r=>r.url===metadata.token_endpoint).length,1);
});
test('read-only MCP verification renews once after an early 401 without a known expiry',async()=>{
  const f=await expiredCredential();const credential=JSON.parse(f.material.secret);credential.oauth.expires_at=null;
  await storeSecret(env,f.owner,{provider:'mcp_server',name:f.material.name,secret:JSON.stringify(credential)});
  requests=[];let denied=false;
  globalThis.fetch=async(url,input)=>{if(url===resource&&!denied){denied=true;return new Response(null,{status:401});}return mockFetch(url,input);};
  try{const result=await readRemoteMcpCatalog(env,f.owner,f.material.id);assert.equal(result.connected,true);assert.equal(requests.filter(r=>r.url===metadata.token_endpoint).length,1);}
  finally{globalThis.fetch=mockFetch;}
});
test('uncertain refresh is not retried and only this connector is marked failed',async()=>{
  const f=await expiredCredential();requests=[];mode='disconnect';
  await assert.rejects(refreshMcpOAuthCredential(env,f.material),/Znovu prihlás iba Walletbot/);
  await assert.rejects(refreshMcpOAuthCredential(env,f.material),/Neopakuje/);
  assert.equal(requests.filter(r=>r.url===metadata.token_endpoint).length,1);
  const stored=await env.DB.prepare('SELECT status FROM ops_secret_vault WHERE id=?').bind(f.material.id).first();assert.equal(stored.status,'failed');
});
test('refresh cannot undo a concurrent owner revocation',async()=>{
  const f=await expiredCredential();const fetcher=async(url,input)=>{await env.DB.prepare("UPDATE ops_secret_vault SET status='revoked' WHERE id=?").bind(f.material.id).run();return mockFetch(url,input);};
  await assert.rejects(refreshMcpOAuthCredential(env,f.material,{fetcher}));
  assert.equal((await env.DB.prepare('SELECT status FROM ops_secret_vault WHERE id=?').bind(f.material.id).first()).status,'revoked');
});
test('successful remote verification cannot undo a revocation during the request',async()=>{
  const f=await flow(),completed=await finishWalletbotOAuth(env,f.request,f.owner);let revoked=false;
  globalThis.fetch=async(url,input)=>{if(url===resource&&!revoked){revoked=true;await env.DB.prepare("UPDATE ops_secret_vault SET status='revoked',secret_ciphertext='',secret_iv='' WHERE id=?").bind(completed.connector.id).run();}return mockFetch(url,input);};
  try{await assert.rejects(verifySecret(env,f.owner,completed.connector.id),/odvolané/);}
  finally{globalThis.fetch=mockFetch;}
  assert.equal((await env.DB.prepare('SELECT status FROM ops_secret_vault WHERE id=?').bind(completed.connector.id).first()).status,'revoked');
});
test('long OAuth envelopes are accepted only for MCP; legacy secret size limit remains',()=>{
  assert.equal(secretInputSchema.safeParse({provider:'mcp_server',name:'fixture',secret:'x'.repeat(5000)}).success,true);
  assert.equal(secretInputSchema.safeParse({provider:'github',name:'fixture',secret:'x'.repeat(5000)}).success,false);
});
