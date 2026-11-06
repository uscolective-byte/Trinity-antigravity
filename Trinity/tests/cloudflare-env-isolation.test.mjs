import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sharedMutableBindings,reportEnvironmentIsolation} from '../scripts/cloudflare-env-audit.mjs';

test('tracked staging config has no shared resources, service targets, or Secrets Store credentials',()=>{
  const cfg=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  const report=reportEnvironmentIsolation(cfg);
  assert.equal(report.isolated,true);
  assert.equal(report.checked,'configuration-only');
  assert.deepEqual(report.shared_mutable_resources,[]);
  assert.equal(cfg.env.staging.vars.TRINITY_PREVIEW_MODE,'build-only');
});
test('staging audit still rejects shared mutable resources',()=>{
  const cfg={
    name:'trinity',d1_databases:[{binding:'DB',database_id:'same-db'}],
    kv_namespaces:[{binding:'CACHE',id:'same-cache'}],
    r2_buckets:[{binding:'DATA',bucket_name:'same-data'}],
    vectorize:[{binding:'VECTORIZE',index_name:'same-index'}],
    env:{staging:{name:'trinity-staging',
      d1_databases:[{binding:'DB',database_id:'same-db'}],
      kv_namespaces:[{binding:'CACHE',id:'same-cache'}],
      r2_buckets:[{binding:'DATA',bucket_name:'same-data'}],
      vectorize:[{binding:'VECTORIZE',index_name:'same-index'},{binding:'VECTOR_INDEX',index_name:'same-index'}]}}
  };
  const report=reportEnvironmentIsolation(cfg);
  assert.equal(report.isolated,false);
  assert.deepEqual(new Set(sharedMutableBindings(cfg).map(x=>x.type)),new Set(['D1','KV','R2','Vectorize']));
  assert.equal(report.shared_mutable_resources.filter(x=>x.type==='Vectorize').length,2);
  assert.ok(report.shared_mutable_resources.every(x=>x.isolation_verified===false));
});
test('staging audit rejects production service targets and Secrets Store credentials',()=>{
 const cfg={
  name:'trinity',
  services:[{binding:'CORE',service:'trinity-core'}],
  secrets_store_secrets:[{binding:'PROVIDER',store_id:'store-id',secret_name:'provider-key'}],
  env:{staging:{
   name:'trinity-staging',
   services:[{binding:'CORE',service:'trinity-core'}],
   secrets_store_secrets:[{binding:'PROVIDER',store_id:'store-id',secret_name:'provider-key'}]
  }}
 };
 const collisions=sharedMutableBindings(cfg);
 assert.deepEqual(collisions.map(c=>c.type),['Service','Secrets Store']);
 assert.ok(collisions.every(c=>c.isolation_verified===false));
});
test('staging audit compares resources against explicit production profile bindings',()=>{
 const cfg={
  name:'trinity',
  vectorize:[{binding:'VECTORIZE',index_name:'default-index'}],
  env:{
   production:{vectorize:[{binding:'VECTOR_INDEX',index_name:'shared-index'}]},
   staging:{name:'trinity-staging',vectorize:[{binding:'VECTORIZE',index_name:'shared-index'}]}
  }
 };
 const collisions=sharedMutableBindings(cfg);
 assert.equal(collisions.length,1);
 assert.deepEqual(collisions[0],{
  type:'Vectorize',
  production_binding:'VECTOR_INDEX',
  staging_binding:'VECTORIZE',
  shared_resource:true,
  isolation_verified:false
 });
});
