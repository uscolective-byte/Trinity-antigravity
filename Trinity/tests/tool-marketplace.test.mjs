import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marketplaceSnapshot} from '../src/tool-marketplace.js';

const native=[
  {id:'json-data',name:'JSON',tools:['json_tool'],description:'JSON helper',installed:true,enabled:true,version:'1.0.0'},
  {id:'developer-operator',name:'Dev',tools:['pc_run'],installed:false,enabled:false},
  {id:'images',name:'Image',tools:['generate_image'],installed:true,enabled:false}
];

test('marketplace lists all requested connector families without invented installs',()=>{
  const x=marketplaceSnapshot({},native);
  for(const id of ['instagram','openai','cloudflare','vercel','openapi','github','gemini','copilot','wordpress','telegram']){
    const item=x.items.find(p=>p.id==='connector-'+id);
    assert.ok(item,'Missing '+id);
    assert.equal(item.kind,'external');
    assert.equal(item.installed,false);
    assert.equal(item.verified,false);
    assert.equal(item.status,'needs-connection');
  }
  assert.equal(x.counts.total,x.items.length);
  assert.equal(x.counts.native,native.length);
});
test('provider secret signals indicate configuration, not a live connection',()=>{
  const x=marketplaceSnapshot({OPENAI_API_KEY:'sensitive-key-do-not-echo',VERCEL_TOKEN:'private-vercel-key',AI:{}},native);
  for(const id of ['openai','vercel','cloudflare']){
    const item=x.items.find(p=>p.id==='connector-'+id);
    assert.equal(item.status,'configured-unverified');
    assert.equal(item.configured,true);
    assert.equal(item.verified,false);
  }
  assert.doesNotMatch(JSON.stringify(x),/sensitive-key-do-not-echo|private-vercel-key/);
});
test('native installed and enabled flags reflect only D1 registration',()=>{
  const x=marketplaceSnapshot({},native);
  assert.equal(x.items.find(p=>p.id==='plugin-json-data').status,'registered-enabled');
  assert.equal(x.items.find(p=>p.id==='plugin-developer-operator').status,'catalog-only');
  assert.equal(x.items.find(p=>p.id==='plugin-images').status,'registered-disabled');
  assert.ok(x.items.filter(p=>p.kind==='native').every(p=>p.verified===false));
});
test('native categories and all plugin tool names are discoverable',()=>{
  const x=marketplaceSnapshot({},native);
  assert.equal(x.items.find(p=>p.id==='plugin-developer-operator').category,'developer');
  assert.equal(x.items.find(p=>p.id==='plugin-images').category,'fun');
  assert.deepEqual(x.items.find(p=>p.id==='plugin-json-data').tools,['json_tool']);
});
test('fun tools are usable locally without a network dependency',()=>{
  const x=marketplaceSnapshot({},[]);
  const games=x.items.filter(item=>item.kind==='browser');
  assert.equal(games.length,4);
  assert.ok(games.every(g=>g.requires_network===false&&g.status==='available-local'));
});
test('connector docs are official https URLs and no API credentials are embedded',()=>{
  const x=marketplaceSnapshot({},[]);
  for(const item of x.items.filter(p=>p.kind==='external')){
    assert.match(item.documentation,/^https:\/\//);
    const host=new URL(item.documentation).hostname;
    assert.ok(['developers.facebook.com','platform.openai.com','developers.cloudflare.com','vercel.com','spec.openapis.org','docs.github.com','ai.google.dev','learn.microsoft.com','developer.wordpress.org','core.telegram.org'].includes(host));
  }
});
test('marketplace routes run after auth for status, before auth only for static shell',()=>{
  const code=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
  const auth=code.indexOf('user=await authenticate(request,env)');
  const api=code.indexOf("if(path==='/api/assistant/tool-marketplace'");
  const shell=code.indexOf("if(path==='/marketplace'");
  assert.ok(shell>0&&shell<auth);
  assert.ok(api>auth);
  assert.match(code,/marketplaceSnapshot\(env,plugins\)/);
});
test('UI uses safe DOM APIs, never dynamically installs provider code',()=>{
  const code=readFileSync(new URL('../public/assistant/tool-marketplace.js.txt',import.meta.url),'utf8');
  const html=readFileSync(new URL('../public/assistant/tool-marketplace.html',import.meta.url),'utf8');
  assert.match(code,/textContent=/);
  assert.doesNotMatch(code,/innerHTML\s*=/);
  assert.doesNotMatch(code,/\/api\/ops\/plugins\/install|eval\(|new Function\(/);
  assert.match(html,/\/tool-marketplace\.js/);
  assert.match(html,/id="search"/);
});
