import test from 'node:test';
import assert from 'node:assert/strict';
import {AGENT_CONNECTION_IDS,agentConnectionMatrix} from '../src/agent-connection-matrix.js';

test('Trinity exposes eight separate client capability states without pretending accounts are linked',()=>{
  const result=agentConnectionMatrix({},null);
  assert.deepEqual(result.clients.map(item=>item.id),AGENT_CONNECTION_IDS);
  assert.equal(result.actual_cross_account_sync_verified,false);
  assert.equal(result.tokens_or_secrets_read,false);
  assert.ok(result.clients.every(item=>item.client_authenticated===false));
  assert.ok(result.clients.every(item=>item.client_verified===false));
  assert.ok(result.clients.every(item=>item.execution_verified===false));
  const pc=result.clients.find(item=>item.id==='pc-local');
  assert.equal(pc.heartbeat_connected,false);
});

test('Secrets Store bindings and OAuth accounts are not the same',()=>{
  let reads=0;
  const secret='synthetic-never-return-key';
  const env={
    AI:{run:async()=>{}}, DB:{prepare:()=>{}},
    TRINITY_MASTER_GOOGLE:{get:async()=>{reads++;return secret;}},
    TRINITY_MASTER_COPILOT:{get:async()=>{reads++;return secret;}},
    TRINITY_ASSISTANT_BRIDGE_ENABLED:'false',
    TRINITY_ENV:'staging',GITHUB_TOKEN:secret,
    PC_BRIDGE_V2:{fetch:async()=>{}}
  };
  const report=agentConnectionMatrix(env,{connected:true});
  assert.equal(report.clients.find(c=>c.id==='cloudflare').server_configured,true);
  assert.equal(report.clients.find(c=>c.id==='gemini').gemini_credential_configured,true);
  assert.equal(report.clients.find(c=>c.id==='gemini').provider_request_verified,false);
  assert.equal(report.clients.find(c=>c.id==='copilot').studio_oauth_verified,false);
  assert.equal(report.clients.find(c=>c.id==='chatgpt').notes_bridge_enabled,false);
  const pc=report.clients.find(c=>c.id==='pc-local');
  assert.equal(pc.heartbeat_connected,true);
  assert.equal(pc.execution_verified,false);
  assert.equal(pc.client_authenticated,false);
  assert.equal(reads,0);
  assert.doesNotMatch(JSON.stringify(report),new RegExp(secret));
});

test('When bridge is enabled, report only server capability, not cross-account synchronization',()=>{
  const report=agentConnectionMatrix({DB:{prepare:()=>{}},TRINITY_ASSISTANT_BRIDGE_ENABLED:'true'},null);
  assert.equal(report.clients.find(c=>c.id==='chatgpt').notes_bridge_enabled,true);
  assert.equal(report.clients.find(c=>c.id==='copilot').notes_bridge_enabled,true);
  assert.equal(report.actual_cross_account_sync_verified,false);
  assert.equal(report.clients.find(c=>c.id==='chatgpt').client_verified,false);
});
