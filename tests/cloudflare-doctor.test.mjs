import test from 'node:test';
import assert from 'node:assert/strict';
import {configStatus,parseWranglerWhoamiAuth} from '../scripts/cloudflare-doctor.mjs';

test('Cloudflare doctor distinguishes production, staging and shared resources',()=>{
 const config={
  name:'trinity',routes:[{pattern:'auru.space'}],
  d1_databases:[{binding:'DB',database_id:'prod-id'}],
  kv_namespaces:[{id:'shared-kv'}],r2_buckets:[{bucket_name:'shared-r2'}],
  env:{staging:{
   name:'trinity-staging',routes:[{pattern:'auru.dev'}],
   d1_databases:[{binding:'DB',database_id:'stage-id'}],
   kv_namespaces:[{id:'shared-kv'}],r2_buckets:[{bucket_name:'shared-r2'}]
  }}
 };
 const report=configStatus(config);
 assert.equal(report.production_worker,'trinity');
 assert.equal(report.staging_worker,'trinity-staging');
 assert.equal(report.production_route,true);
 assert.equal(report.staging_route,true);
 assert.equal(report.d1_environment_isolation,true);
 assert.equal(report.kv_shared_namespaces,1);
 assert.equal(report.r2_shared_buckets,1);
 assert.doesNotMatch(JSON.stringify(report),/prod-id|stage-id|shared-r2|shared-kv/);
});

test('Cloudflare doctor refuses to claim isolated D1 without two distinct IDs',()=>{
 const report=configStatus({d1_databases:[{binding:'DB',database_id:'x'}],env:{staging:{d1_databases:[{binding:'DB',database_id:'x'}]}}});
 assert.equal(report.d1_environment_isolation,false);
 assert.equal(report.production_route,false);
 assert.equal(report.staging_route,false);
});

test('Cloudflare doctor reports isolated D1 in single-production mode without staging env',()=>{
 const report=configStatus({
  name:'trinity',
  routes:[{pattern:'auru.space'},{pattern:'auru.dev'}],
  d1_databases:[{binding:'DB',database_id:'trinity-v03-id'}],
  kv_namespaces:[{id:'kv-prod'}],
  r2_buckets:[{bucket_name:'r2-prod'}]
 });
 assert.equal(report.production_worker,'trinity');
 assert.equal(report.staging_worker,null);
 assert.equal(report.production_route,true);
 assert.equal(report.staging_route,false);
 assert.equal(report.d1_environment_isolation,true);
 assert.equal(report.kv_shared_namespaces,0);
 assert.equal(report.r2_shared_buckets,0);
});

test('Cloudflare doctor marks Wrangler v4 exit-0 unauthenticated whoami as authenticated: false',()=>{
 assert.equal(parseWranglerWhoamiAuth({
  status:0,
  stdout:' ⛅️ wrangler 4.157.0\n───────────────────\nYou are not authenticated. Please run `wrangler login`.\n',
  stderr:''
 }),false);
 assert.equal(parseWranglerWhoamiAuth({
  status:0,
  stdout:'',
  stderr:'You are not logged in.'
 }),false);
 assert.equal(parseWranglerWhoamiAuth({
  status:0,
  stdout:'',
  stderr:''
 }),false);
 assert.equal(parseWranglerWhoamiAuth({
  status:1,
  stdout:'You are logged in with an API Token.',
  stderr:''
 }),false);
});

test('Cloudflare doctor marks authenticated Wrangler whoami output as authenticated: true',()=>{
 assert.equal(parseWranglerWhoamiAuth({
  status:0,
  stdout:'Getting User settings...\n👋 You are logged in with an OAuth Token, associated with the email owner@example.com.\n',
  stderr:''
 }),true);
 assert.equal(parseWranglerWhoamiAuth({
  status:0,
  stdout:'Getting User settings...\n👋 You are logged in with an API Token.\n',
  stderr:''
 }),true);
});
