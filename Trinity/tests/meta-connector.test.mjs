import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {beginMetaConnection,completeMetaConnection,metaStatus,refreshMetaConnection,handleMetaConnection,META_READ_SCOPES} from '../src/meta-connector.js';
import {getSecretMaterial} from '../src/secret-vault.js';
import {hash} from '../src/security.js';
function fixture(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 sqlite.exec(readFileSync(new URL('../migrations/0053_meta_connections.sql',import.meta.url),'utf8'));
 sqlite.exec(readFileSync(new URL('../migrations/0021_secret_vault.sql',import.meta.url),'utf8'));
 sqlite.exec('CREATE TABLE ops_events(action TEXT,details TEXT)');
 sqlite.exec('CREATE TABLE ops_sessions(token_hash TEXT,expires_at INTEGER,email TEXT)');
 const DB={prepare(sql){
  const stmt=sqlite.prepare(sql);
  return {bind(...args){
   return {
    async first(){return stmt.get(...args)||null;},
    async run(){const changed=stmt.run(...args);return {success:true,meta:{changes:Number(changed.changes)}};},
    async all(){return {results:stmt.all(...args)};}
   };
  }};
 }};
 const env={DB,TRINITY_OWNER_EMAIL:'owner@example.test',META_APP_ID:'123456',META_APP_SECRET:'test-only-meta-app-secret',META_GRAPH_VERSION:'v22.0',TRINITY_VAULT_KEY:Buffer.alloc(32,7).toString('base64url')};
 const context={ownerId:'owner@example.test',session:'a'.repeat(64),origin:'https://trinity.test'};
 return {sqlite,env,context};
}
const token='test-only-meta-access-token';
function provider({permissions=META_READ_SCOPES,profile={id:'123',name:'Test Owner'},revoked=false}={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});assert.equal(new URL(url).hostname,'graph.facebook.com');assert.equal(options.redirect,'error');
  const endpoint=new URL(url).pathname;
  if(endpoint.endsWith('/oauth/access_token')){
   assert.equal(options.method,'POST');assert.equal(new URLSearchParams(options.body).get('client_secret'),'test-only-meta-app-secret');
   return Response.json({access_token:token,expires_in:3600});
  }
  assert.equal(options.headers.Authorization,'Bearer '+token);
  if(revoked)return Response.json({error:{code:190,message:'Never expose '+token}},{status:400});
  if(endpoint.endsWith('/me/permissions'))return Response.json({data:permissions.map(permission=>({permission,status:'granted'}))});
  if(endpoint.endsWith('/me/accounts'))return Response.json({data:[{id:'456',name:'Page',access_token:'must-not-escape',instagram_business_account:{id:'789',username:'creator'}}]});
  if(endpoint.endsWith('/me'))return Response.json(profile);
  throw Error('unexpected endpoint');
 };return {calls,fetcher};
}
async function authorize(env,context){
 const pending=await beginMetaConnection(env,context),target=new URL(pending.authorization_url);
 assert.equal(target.hostname,'www.facebook.com');
 assert.equal(target.searchParams.get('scope'),META_READ_SCOPES.join(','));
 assert.equal(target.searchParams.has('client_secret'),false);
 return {...context,state:target.searchParams.get('state'),code:'test-only-code'};
}
test('missing setup is explicit and no fake account is connected',async t=>{
 const {env,context,sqlite}=fixture(t);delete env.META_APP_ID;
 const status=await metaStatus(env,context.ownerId,context.origin);assert.equal(status.status,'needs_setup');
 await assert.rejects(()=>beginMetaConnection(env,context),/nie je nastavená/);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM meta_connections').get().n,0);
});
test('real SQL transaction is session/owner bound, one-use and persists encrypted identity evidence',async t=>{
 const {env,context,sqlite}=fixture(t),{calls,fetcher}=provider();
 const input=await authorize(env,context);
 await assert.rejects(()=>completeMetaConnection(env,{...input,ownerId:'other'},fetcher),/inej relácii/);
 await assert.rejects(()=>completeMetaConnection(env,{...input,session:'b'.repeat(64)},fetcher),/inej relácii/);
 assert.equal(calls.length,0);
 const connected=await completeMetaConnection(env,input,fetcher);
 assert.equal(connected.status,'connected_read_only');assert.equal(connected.publishing_enabled,false);
 assert.equal(connected.pages[0].instagram.username,'creator');assert.equal(connected.account.id,'123');
 assert.equal(JSON.stringify(connected).includes(token),false);assert.equal(JSON.stringify(connected).includes('must-not-escape'),false);
 const stored=sqlite.prepare('SELECT * FROM ops_secret_vault').get();assert.notEqual(stored.secret_ciphertext,token);
 await assert.rejects(()=>getSecretMaterial(env,{ownerId:'other',id:stored.id,provider:'custom'}),/neexistuje/);
 await assert.rejects(()=>completeMetaConnection(env,input,fetcher),/inej relácii/);assert.equal(calls.length,4);
 assert.equal((await metaStatus(env,'other',context.origin)).status,'not_connected');
});
test('expired state, changed app configuration and denied scopes fail closed',async t=>{
 const {env,context,sqlite}=fixture(t),p=provider();
 const expired=await authorize(env,context);sqlite.exec('UPDATE meta_oauth_transactions SET expires_at=0');
 await assert.rejects(()=>completeMetaConnection(env,expired,p.fetcher),/vypršalo/);assert.equal(p.calls.length,0);
 const changed=await authorize(env,context);env.META_APP_ID='999';
 await assert.rejects(()=>completeMetaConnection(env,changed,p.fetcher),/inej relácii/);assert.equal(p.calls.length,0);
 const denied=await authorize(env,context);
 await assert.rejects(()=>completeMetaConnection(env,denied,provider({permissions:['public_profile']}).fetcher),/oprávnenia/);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM meta_connections').get().n,0);
});
test('identity errors and token revocation never become a fabricated connected account',async t=>{
 const {env,context}=fixture(t);
 await assert.rejects(async()=>completeMetaConnection(env,await authorize(env,context),provider({profile:{}}).fetcher),/identitu/);
 await completeMetaConnection(env,await authorize(env,context),provider().fetcher);
 await assert.rejects(()=>refreshMetaConnection(env,context,provider({revoked:true}).fetcher),error=>error.status===401&&!error.message.includes(token));
 assert.equal((await metaStatus(env,context.ownerId,context.origin)).status,'reauthorization_required');
 await completeMetaConnection(env,await authorize(env,context),provider().fetcher);
 await assert.rejects(()=>refreshMetaConnection(env,context,provider({profile:{id:'999',name:'Different Account'}}).fetcher),error=>error.status===409);
 assert.equal((await metaStatus(env,context.ownerId,context.origin)).status,'reauthorization_required');
});
test('HTTP entry point requires browser session and real admin, never scoped projectControl',async t=>{
 const {env}=fixture(t);
 const request=new Request('https://trinity.test/api/assistant/connectors/meta',{headers:{Cookie:'trinity_session='+ 'a'.repeat(64)}});
 await assert.rejects(()=>handleMetaConnection(request,env,{role:'user',projectControl:true,id:'not-owner'}),error=>error.status===403);
 await assert.rejects(()=>handleMetaConnection(new Request(request.url),env,{role:'owner',id:'owner'}),error=>error.status===401);
 await assert.rejects(()=>handleMetaConnection(request,env,{role:'owner',id:'fabricated'}),error=>error.status===401);
 const cross=new Request(request.url+'/start',{method:'POST',headers:{Cookie:'trinity_session='+ 'a'.repeat(64),Origin:'https://evil.test'}});
 await assert.rejects(()=>handleMetaConnection(cross,env,{role:'owner',id:'owner'}),error=>error.status===403);
});
test('a valid browser session can inspect setup but body cannot replace owner/session binding',async t=>{
 const {env,context,sqlite}=fixture(t);
 sqlite.prepare('INSERT INTO ops_sessions VALUES(?,?,?)').run(await hash(context.session),Date.now()+60000,context.ownerId);
 const headers={Cookie:'trinity_session='+context.session};
 const response=await handleMetaConnection(new Request(context.origin+'/api/assistant/connectors/meta',{headers}),env,{role:'owner',email:context.ownerId});
 assert.equal((await response.json()).status,'not_connected');
 const pending=await authorize(env,context);
 const complete=new Request(context.origin+'/api/assistant/connectors/meta/complete',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({...pending,ownerId:'other-owner',session:'other-session'})});
 assert.equal((await(await handleMetaConnection(complete,env,{role:'owner',email:context.ownerId},provider().fetcher)).json()).account.id,'123');
});
test('revoked/deleted local tokens and changed app settings do not report connected',async t=>{
 const {env,context,sqlite}=fixture(t);
 await completeMetaConnection(env,await authorize(env,context),provider().fetcher);
 env.META_APP_ID='999';
 assert.equal((await metaStatus(env,context.ownerId,context.origin)).status,'reauthorization_required');
 env.META_APP_ID='123456';
 sqlite.exec("UPDATE ops_secret_vault SET status='revoked'");
 assert.equal((await metaStatus(env,context.ownerId,context.origin)).status,'reauthorization_required');
 await assert.rejects(()=>refreshMetaConnection(env,context,provider().fetcher),/neexistuje/);
 sqlite.exec('DELETE FROM ops_secret_vault');
 assert.equal((await metaStatus(env,context.ownerId,context.origin)).status,'reauthorization_required');
});
test('simultaneous OAuth redemption executes exactly one token exchange',async t=>{
 const {env,context}=fixture(t),p=provider(),input=await authorize(env,context);
 const outcomes=await Promise.allSettled([completeMetaConnection(env,input,p.fetcher),completeMetaConnection(env,input,p.fetcher)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(p.calls.filter(x=>x.url.endsWith('/oauth/access_token')).length,1);
});
test('old refresh success or failure cannot overwrite a concurrently reconnected account',async t=>{
 const {env,context}=fixture(t);
 for(const revoked of [false,true]){
  await completeMetaConnection(env,await authorize(env,context),provider().fetcher);
  let release,started;
  const paused=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve),old=provider({revoked});
  const refresh=refreshMetaConnection(env,context,async(url,options)=>{if(new URL(url).pathname.endsWith('/me')){started();await paused;}return old.fetcher(url,options);});
  const outcome=refresh.catch(error=>error);
  await entered;
  await completeMetaConnection(env,await authorize(env,context),provider({profile:{id:'999',name:'New Owner Account'}}).fetcher);
  release();assert.equal((await outcome).status,409);
  const status=await metaStatus(env,context.ownerId,context.origin);
  assert.equal(status.account.id,'999');assert.equal(status.account.name,'New Owner Account');assert.equal(status.status,'connected_read_only');
 }
});
