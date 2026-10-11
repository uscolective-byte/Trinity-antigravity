import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowDevConnection,localLoopbackRequest,sessionCookie} from '../src/security.js';

test('local development login is limited to the loopback transport',async()=>{
  const local={TRINITY_LOCAL_DEV_AUTH:'1'};
  assert.equal(await allowDevConnection(new Request('http://127.0.0.1:8787/api/ops/dev-login'),local),true);
  assert.equal(await allowDevConnection(new Request('http://localhost:8787/api/ops/dev-login'),local),true);
  const rewritten=new Request('http://auru.dev/api/ops/dev-login',{headers:{Origin:'http://auru.dev'}});
  assert.equal(localLoopbackRequest(rewritten,local),true);
  assert.equal(await allowDevConnection(rewritten,local),true);
  assert.equal(await allowDevConnection(rewritten,{}),false);
  assert.equal(await allowDevConnection(new Request('https://trinity.example/api/ops/dev-login',{headers:{'CF-Connecting-IP':'127.0.0.1'}}),{}),false);
  assert.equal(await allowDevConnection(new Request('https://auru.dev/api/ops/dev-login'),local),false);
  assert.equal(await allowDevConnection(new Request('https://example.com/api/ops/dev-login'),{}),false);
});

test('session cookies stay secure except on the explicit loopback transport',()=>{
  assert.match(sessionCookie('token',60,new Request('https://auru.space/')),/; Secure;/);
  assert.doesNotMatch(sessionCookie('token',60,new Request('http://auru.dev/'),{TRINITY_LOCAL_DEV_AUTH:'1'}),/; Secure;/);
  assert.match(sessionCookie('token',60,new Request('http://auru.dev/'),{TRINITY_LOCAL_DEV_AUTH:'1'}),/HttpOnly; SameSite=Strict/);
});
