import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sharedMutableBindings,reportEnvironmentIsolation} from '../scripts/cloudflare-env-audit.mjs';

test('staging audit detects shared mutable D1, KV and R2 resources',()=>{
  const cfg=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  const report=reportEnvironmentIsolation(cfg);
  assert.equal(report.isolated,false);
  assert.equal(report.checked,'configuration-only');
  assert.ok(report.shared_mutable_resources.some(r=>r.type==='D1'));
  assert.ok(report.shared_mutable_resources.some(r=>r.type==='KV'));
  assert.ok(report.shared_mutable_resources.some(r=>r.type==='R2'));
  assert.ok(report.shared_mutable_resources.every(r=>r.isolation_verified===false));
});

test('a safely isolated staging config passes without external Cloudflare access',()=>{
  const cfg={
    name:'trinity',d1_databases:[{binding:'DB',database_id:'prod-db'}],
    kv_namespaces:[{binding:'CACHE',id:'prod-cache'}],
    r2_buckets:[{binding:'DATA',bucket_name:'prod-data'}],
    env:{staging:{name:'trinity-staging',
      d1_databases:[{binding:'DB',database_id:'stage-db'}],
      kv_namespaces:[{binding:'CACHE',id:'stage-cache'}],
      r2_buckets:[{binding:'DATA',bucket_name:'stage-data'}]}}
  };
  assert.equal(sharedMutableBindings(cfg).length,0);
  assert.equal(reportEnvironmentIsolation(cfg).isolated,true);
});
