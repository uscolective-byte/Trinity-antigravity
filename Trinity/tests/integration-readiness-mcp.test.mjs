import test from 'node:test';
import assert from 'node:assert/strict';
import {integrationReadiness} from '../src/integration-readiness.js';

test('Secrets Store Gemini/Copilot bindings count as configured but never live-verified',()=>{
  let calls=0;
  const env={
    DB:{prepare:()=>{}},
    TRINITY_MASTER_GOOGLE:{get:async()=>{calls++;return 'synthetic-gemini-key';}},
    TRINITY_MASTER_COPILOT:{get:async()=>{calls++;return 'synthetic-copilot-key';}}
  };
  const report=integrationReadiness({},env);
  const item=id=>report.items.find(x=>x.id===id);
  assert.equal(item('gemini').configured,true);
  assert.equal(item('copilot-credential').configured,true);
  assert.equal(item('trinity-mcp-server').configured,true);
  assert.equal(item('copilot-studio').configured,false);
  assert.equal(item('gemini').status,'configured_unverified');
  assert.equal(report.live_verified,false);
  assert.equal(calls,0);
  assert.doesNotMatch(JSON.stringify(report),/synthetic-/);
});

test('no external account can be authenticated from a missing environment',()=>{
  const report=integrationReadiness({},{});
  assert.equal(report.live_verified,false);
  assert.ok(report.items.every(x=>x.status==='needs_configuration'));
});
