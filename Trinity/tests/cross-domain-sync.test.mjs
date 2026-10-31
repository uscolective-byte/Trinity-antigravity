import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRINITY_SOURCE} from '../src/version.js';
import {reportEnvironmentIsolation} from '../scripts/cloudflare-env-audit.mjs';

const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));

test('production and staging use one source and different primary D1 databases',()=>{
  assert.equal(TRINITY_SOURCE.repository,'uscolective-byte/Trinity-antigravity');
  assert.deepEqual(config.routes.map(x=>x.pattern),['auru.space']);
  assert.deepEqual(config.env.staging.routes.map(x=>x.pattern),['auru.dev']);
  assert.equal(config.vars.TRINITY_GITHUB_REPO,TRINITY_SOURCE.repository);
  assert.equal(config.env.staging.vars.TRINITY_GITHUB_REPO,TRINITY_SOURCE.repository);
  const primary=bindings=>bindings.find(x=>x.binding==='DB')?.database_id;
  assert.ok(primary(config.d1_databases));
  assert.ok(primary(config.env.staging.d1_databases));
  assert.notEqual(primary(config.d1_databases),primary(config.env.staging.d1_databases));
});
test('shared mutable resources are reported as unsafe rather than called domain sync',()=>{
  const isolation=reportEnvironmentIsolation(config);
  assert.equal(isolation.checked,'configuration-only');
  if(!isolation.isolated){
    assert.ok(isolation.shared_mutable_resources.length>0);
    for(const resource of isolation.shared_mutable_resources){
      assert.equal(resource.isolation_verified,false);
      assert.equal(resource.shared_resource,true);
      assert.ok(['D1','KV','R2'].includes(resource.type));
    }
  }
});
test('staging has no cron triggers; no invented cross-domain session receipt',()=>{
  assert.deepEqual(config.env.staging.triggers,{crons:[]});
});
