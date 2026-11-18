import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ProposalStore} from '../src/store.mjs';
import {startCloudLink} from '../src/cloud-link.mjs';

test('custom Desktop executor shares claim receipts and replays completion without another write',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'trinity-cloud-link-'));
 const store=new ProposalStore(dir);await store.init();
 const id=crypto.randomUUID();let executions=0,receipts=0,stop=()=>{};
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
  assert.equal(init.headers.Authorization,'Bearer private-gateway-key');
  if(String(url).endsWith('/claim'))return Response.json({action:{id,action:'write',payload:{path:'file.txt',content:'data'},expires_at:Date.now()+60000}});
  const body=JSON.parse(init.body);assert.equal(body.status,'completed');assert.equal(body.receipt.saved,true);receipts++;return Response.json({ok:true});
 };
 try{
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new Error('cloud link timeout')),2000);
   stop=startCloudLink({baseUrl:'https://auru.space',key:'private-gateway-key',store,workspaceRoot:dir,dataDir:dir,intervalMs:1,
    execute:async()=>{executions++;return {saved:true};},onState:state=>{if(state.status==='receipt-replayed'){clearTimeout(timeout);stop();resolve();}}});
  });
  assert.equal(executions,1);assert.equal(receipts,2);assert.equal((await store.get(id)).status,'completed');
 }finally{stop();globalThis.fetch=previous;await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});


test('failed processes preserve stderr stdout and exit code in cloud receipt and replay',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'trinity-cloud-failure-'));
 const store=new ProposalStore(dir);await store.init();
 const id=crypto.randomUUID();let executions=0,receipts=0,stop=()=>{};
 const failure={success:false,exitCode:1,stdout:'test started',stderr:'AssertionError: expected 42',script_sha256:'a'.repeat(64)};
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
  if(String(url).endsWith('/claim'))return Response.json({action:{id,action:'run',payload:{task:'script'},expires_at:Date.now()+60000}});
  const body=JSON.parse(init.body);
  assert.equal(body.status,'failed');assert.deepEqual(body.receipt,failure);assert.match(body.error,/chybou/);
  receipts++;return Response.json({ok:true});
 };
 try{
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new Error('failed receipt timeout')),2000);
   stop=startCloudLink({baseUrl:'https://auru.space',key:'test-key',store,workspaceRoot:dir,dataDir:dir,intervalMs:1,
    execute:async()=>{executions++;return failure;},onState:state=>{if(state.status==='receipt-replayed'){clearTimeout(timeout);stop();resolve();}}});
  });
  assert.equal(executions,1);assert.equal(receipts,2);assert.equal((await store.get(id)).status,'failed');
 }finally{stop();globalThis.fetch=previous;await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
