import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {diagnoseSecretsStoreConfig} from '../scripts/secrets-store-doctor.mjs';

const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const copy=()=>structuredClone(config);

test('build-only staging preflight succeeds without exposing Store credentials',()=>{
  const result=diagnoseSecretsStoreConfig(copy());
  assert.equal(result.ok,true,JSON.stringify(result.errors));
  assert.equal(result.secret_values_accessed,false);
  assert.equal(result.remote_scope_verified,false);
  assert.deepEqual(result.staging_bindings,[]);
  assert.deepEqual(result.production_bindings,['OLLAMA_SECRET']);
  assert.match(result.warnings[0],/NOT verified/);
  assert.doesNotMatch(JSON.stringify(result),/[a-f0-9]{32}/i);
});

test('build-only staging rejects all Store bindings, including privileged credentials',()=>{
  const c=copy();
  c.env.staging.secrets_store_secrets=[
    {binding:'TRINITY_MASTER_GITHUB',store_id:c.secrets_store_secrets[0].store_id,secret_name:'GITHUBE_FINE_TOKEN'}
  ];
  const diagnosis=diagnoseSecretsStoreConfig(c);
  assert.equal(diagnosis.ok,false);
  assert.match(diagnosis.errors.join(' '),/privileged/);
  assert.match(diagnosis.errors.join(' '),/build-only environment must not bind/);
});

test('malformed Store metadata fails closed even when staging is build-only',()=>{
  const c=copy();
  c.env.staging.secrets_store_secrets=[
    {binding:'PROVIDER',store_id:'not-a-store',secret_name:'provider'}
  ];
  const result=diagnoseSecretsStoreConfig(c);
  assert.equal(result.ok,false);
  assert.match(result.errors.join(' '),/invalid store ID/);
  assert.match(result.errors.join(' '),/build-only environment must not bind/);
});

test('leaked credential in plaintext vars is detected but not echoed',()=>{
  const c=copy();
  const synthetic='cfat_'+('z'.repeat(45));
  c.env.staging.vars.DEMO_SETTING=synthetic;
  const result=diagnoseSecretsStoreConfig(c);
  assert.equal(result.ok,false);
  assert.match(result.errors.join(' '),/credential-shaped/);
  assert.doesNotMatch(JSON.stringify(result),new RegExp(synthetic));
});

test('wrong Wrangler environment and production privilege expansion are rejected',()=>{
  const c=copy();
  c.env.staging.vars.TRINITY_ENV='development';
  c.secrets_store_secrets.push({
    ...c.secrets_store_secrets[0],binding:'TRINITY_MASTER_GOOGLE',secret_name:'apigoogle'
  });
  const result=diagnoseSecretsStoreConfig(c);
  assert.equal(result.ok,false);
  assert.match(result.errors.join(' '),/must equal staging/);
  assert.match(result.errors.join(' '),/staging-only/);
});
