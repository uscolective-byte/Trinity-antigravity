import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sharedMutableBindings,reportEnvironmentIsolation} from '../scripts/cloudflare-env-audit.mjs';

test('tracked config uses unified single-production architecture without staging drift',()=>{
  const cfg=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  const report=reportEnvironmentIsolation(cfg);
  assert.equal(report.isolated,true);
  assert.equal(report.mode,'single-production');
  assert.equal(report.checked,'configuration-only');
  assert.deepEqual(report.shared_mutable_resources,[]);
  assert.equal(cfg.env?.staging,undefined);
  assert.deepEqual(cfg.routes,[{pattern:'auru.space',custom_domain:true},{pattern:'auru.dev',custom_domain:true}]);
});
test('staging audit still rejects shared mutable resources',()=>{
  const cfg={
    name:'trinity',d1_databases:[{binding:'DB',database_id:'same-db'}],
    kv_namespaces:[{binding:'CACHE',id:'same-cache'}],
    r2_buckets:[{binding:'DATA',bucket_name:'same-data'}],
    env:{staging:{name:'trinity-staging',
      d1_databases:[{binding:'DB',database_id:'same-db'}],
      kv_namespaces:[{binding:'CACHE',id:'same-cache'}],
      r2_buckets:[{binding:'DATA',bucket_name:'same-data'}]}}
  };
  const report=reportEnvironmentIsolation(cfg);
  assert.equal(report.isolated,false);
  assert.deepEqual(new Set(sharedMutableBindings(cfg).map(x=>x.type)),new Set(['D1','KV','R2']));
  assert.ok(report.shared_mutable_resources.every(x=>x.isolation_verified===false));
});
