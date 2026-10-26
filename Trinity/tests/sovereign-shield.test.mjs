import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AUTHORIZED_PRODUCTION_CRONS,
  assertAuthorizedCronTrigger,
  claimScheduledCron,
  enforceSovereignEdge,
  scheduledOperationsForCron,
  verifyAuthorizedCronTrigger
} from '../src/sovereign-shield.js';

test('production config has exactly the three code-authorized cron expressions',()=>{
  const config=JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.deepEqual(config.triggers.crons,AUTHORIZED_PRODUCTION_CRONS);
  assert.deepEqual(config.env.staging.triggers,{crons:[]});
});

test('scheduled gate allows only the exact three production crons',()=>{
  for(const cron of AUTHORIZED_PRODUCTION_CRONS){
    assert.equal(verifyAuthorizedCronTrigger(cron).valid,true);
    assert.doesNotThrow(()=>assertAuthorizedCronTrigger(cron));
  }
  assert.equal(verifyAuthorizedCronTrigger('* * * * *').valid,false);
  assert.throws(()=>assertAuthorizedCronTrigger('* * * * *'),/UNAUTHORIZED_CRON_EXPRESSION/);
  assert.equal(verifyAuthorizedCronTrigger(AUTHORIZED_PRODUCTION_CRONS[0],AUTHORIZED_PRODUCTION_CRONS.slice(0,2)).valid,false);
});

test('each cron has a distinct bounded operation plan',()=>{
  assert.deepEqual(scheduledOperationsForCron('*/30 * * * *'),['health','brain']);
  assert.deepEqual(scheduledOperationsForCron('0 0 * * *'),['evolution']);
  assert.deepEqual(scheduledOperationsForCron('0 11 * * *'),['improvement-scan']);
  assert.throws(()=>scheduledOperationsForCron('* * * * *'),/UNAUTHORIZED_CRON_EXPRESSION/);
});

test('D1 cron lease executes a cron slot exactly once',async()=>{
  const rows=new Map();
  const env={DB:{prepare:()=>({
    bind(key,window){this.key=key;this.window=window;return this;},
    async first(){
      const previous=rows.get(this.key);
      const count=previous?.window===this.window?previous.count+1:1;
      rows.set(this.key,{window:this.window,count});
      return {count};
    }
  })}};
  assert.equal(await claimScheduledCron(env,'0 0 * * *',1234),true);
  assert.equal(await claimScheduledCron(env,'0 0 * * *',1234),false);
  assert.equal(await claimScheduledCron(env,'0 0 * * *',1235),true);
  assert.equal(await claimScheduledCron(env,'0 11 * * *',1234),true);
});

test('MCP maintenance triggers require explicit owner automation access',()=>{
  const source=fs.readFileSync(new URL('../src/mcp.js',import.meta.url),'utf8');
  assert.match(source,/requireAutomationAccess/);
  assert.match(source,/trigger_brain_cycle[\s\S]*requireAutomationAccess\(\)/);
  assert.match(source,/trigger_evolution_cycle[\s\S]*requireAutomationAccess\(\)/);
  const index=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
  assert.match(index,/automationControl:user\.role==='owner'/);
  assert.match(index,/projectControl:true,automationControl:false/);
});

test('public cron-like routes and scanner honeypots are blocked',async()=>{
  for(const pathname of ['/cron','/api/cron/run','/scheduled','/.env','/.git/config','/wp-admin']){
    const response=await enforceSovereignEdge(new Request(`https://auru.dev${pathname}`));
    assert.equal(response.status,403,pathname);
  }
});

test('machine mutations require credential evidence before routing',async()=>{
  for(const pathname of ['/mcp','/api/mcp/invoke','/api/os/ledger','/api/ops/memory']){
    const response=await enforceSovereignEdge(new Request(`https://auru.dev${pathname}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
    }));
    assert.equal(response.status,401,pathname);
    assert.equal((await response.json()).error,'EVIDENCEABLE_IDENTITY_REQUIRED');
  }
  const forwarded=await enforceSovereignEdge(new Request('https://auru.dev/mcp',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer invalid-but-present'},body:'{}'
  }));
  assert.equal(forwarded,null,'credential validity remains the authenticated route responsibility');
});

test('oversized and null-byte JSON payloads fail before application handlers',async()=>{
  const oversized=await enforceSovereignEdge(new Request('https://auru.dev/api/ops/memory',{
    method:'POST',headers:{'Content-Type':'application/json','X-Trinity-Token':'present'},body:JSON.stringify({value:'x'.repeat(262145)})
  }));
  assert.equal(oversized.status,413);
  const nullByte=await enforceSovereignEdge(new Request('https://auru.dev/api/ops/memory',{
    method:'POST',headers:{'Content-Type':'application/json','X-Trinity-Token':'present'},body:'{"value":"\\u0000"}'.replace('\\u0000','\u0000')
  }));
  assert.equal(nullByte.status,422);
});

test('ordinary public health read passes the edge shield',async()=>{
  assert.equal(await enforceSovereignEdge(new Request('https://auru.dev/health')),null);
});
