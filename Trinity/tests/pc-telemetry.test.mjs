import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {persistPCTelemetry} from '../src/pc-telemetry.js';

const body={gateway_id:'pc',hostname:'Basterix',timestamp:123,disks:[]};

test('without staging PC_STATE KV and removed PC D1, telemetry must not claim stored',async()=>{
  const r=await persistPCTelemetry({DB:{}},body);
  assert.deepEqual(r.backends,[]);
  assert.equal(r.stored,false);
  assert.equal(r.ok,false);
  assert.equal(r.status,'storage_unavailable');
});

test('KV successful put is actual persistence evidence',async()=>{
  const calls=[];
  const r=await persistPCTelemetry({PC_STATE:{put:async(...args)=>calls.push(args)}},body);
  assert.deepEqual(r.backends,['PC_STATE']);
  assert.equal(r.stored,true);
  assert.equal(calls[0][0],'telemetry:latest');
  assert.equal(calls[0][2].expirationTtl,300);
});

test('D1 successful run is actual persistence evidence',async()=>{
  let saved=[];
  const r=await persistPCTelemetry({trinity_basterix:{
    prepare:sql=>({bind:(...params)=>({run:async()=>{saved=[sql,params];}})})
  }},body);
  assert.deepEqual(r.backends,['trinity_basterix']);
  assert.match(saved[0],/INSERT INTO pc_telemetry/);
  assert.equal(saved[1][0],'pc');
});

test('failed KV and D1 writes must never be described as stored',async()=>{
  const env={
    PC_STATE:{put:async()=>{throw Error('synthetic-sensitive-token');}},
    trinity_basterix:{prepare:()=>({bind:()=>({run:async()=>{throw Error('synthetic-sensitive-token');}})})}
  };
  const r=await persistPCTelemetry(env,body);
  assert.equal(r.stored,false);
  assert.doesNotMatch(JSON.stringify(r),/synthetic-sensitive-token/);
});

test('route returns HTTP 503 when nothing was really persisted',()=>{
  const src=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
  assert.match(src,/const stored=await persistPCTelemetry\(env,body\)/);
  assert.match(src,/if\(!stored\.ok\)return json\(\{\.\.\.stored/);
  assert.match(src,/at:Date\.now\(\)\},503/);
});
