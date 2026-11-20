import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {hash} from '../src/security.js';

let mf;
const key='test-only-mcp-oauth-owner-key-1234567890',session='b'.repeat(64),origin='https://auru.dev';
before(async()=>{
  const modules=(await readdir('dist')).filter(x=>!x.endsWith('.map')&&!x.endsWith('.md')).map(name=>({type:name==='index.js'?'ESModule':'Text',path:resolve('dist',name)}));
  modules.sort((a,b)=>(a.type==='ESModule'?-1:b.type==='ESModule'?1:0));
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'trinity',modules,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],bindings:{TRINITY_OPS_KEY:key,TRINITY_OWNER_EMAIL:'owner@example.com',TRINITY_ENV:'production'},kvNamespaces:{Mastermind:'test-mcp-oauth-kv'},d1Databases:{DB:'test-mcp-oauth-routes'}}]}));
  const db=await mf.getD1Database('DB','trinity');
  await db.prepare('CREATE TABLE ops_control(id INTEGER PRIMARY KEY,emergency_stop INTEGER,reason TEXT,updated_by TEXT,updated_at TEXT)').run();
  for(const sql of ['CREATE TABLE ops_users(email TEXT PRIMARY KEY,role TEXT,status TEXT)','CREATE TABLE ops_sessions(token_hash TEXT PRIMARY KEY,email TEXT,expires_at INTEGER)','CREATE TABLE ops_limits(key TEXT PRIMARY KEY,window INTEGER,count INTEGER)',"INSERT INTO ops_users VALUES('ordinary@example.com','user','active')"])await db.prepare(sql).run();
  await db.prepare('INSERT INTO ops_sessions VALUES(?,?,?)').bind(await hash(session),'ordinary@example.com',Date.now()+600000).run();
});
after(async()=>{await mf?.dispose();});
const paths=['/api/assistant/mcp/oauth/walletbot/start','/api/assistant/mcp/oauth/walletbot/callback'];
test('real Worker rejects unauthenticated OAuth start and callback',async()=>{
  for(const path of paths){const response=await mf.dispatchFetch(origin+path);assert.equal(response.status,401);}
});
test('real Worker denies ordinary users before authorization discovery or token exchange',async()=>{
  for(const path of paths){const response=await mf.dispatchFetch(origin+path,{headers:{Cookie:'trinity_session='+session}});assert.equal(response.status,403,await response.text());}
});
test('owner callback without matching OAuth state fails honestly and clears only OAuth cookie',async()=>{
  const response=await mf.dispatchFetch(origin+paths[1]+'?code=must-not-be-reflected',{headers:{Authorization:'Bearer '+key}});
  assert.equal(response.status,401);assert.match(response.headers.get('content-type'),/text\/html/);
  assert.match(response.headers.get('set-cookie'),/__Host-trinity_mcp_oauth=;/);assert.doesNotMatch(response.headers.get('set-cookie'),/trinity_session/);
  const body=await response.text();assert.match(body,/nebolo potvrdené/);assert.doesNotMatch(body,/must-not-be-reflected/);
});
