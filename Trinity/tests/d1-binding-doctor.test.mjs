import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {diagnoseD1Bindings} from '../scripts/d1-binding-doctor.mjs';

const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));

// User-provided Cloudflare D1 inventory from Oct 31. Values are public
// resource UUID metadata only, never API credentials or database content.
const inventory=[
  {uuid:'309cb335-3dc9-4a3f-bd1b-fa0606d14d55',name:'admin-db'},
  {uuid:'1cce5249-e044-4c93-868c-0df534a778b5',name:'trinity-development'},
  {uuid:'ca8ea24e-f7db-431e-b8bf-97f713ae4533',name:'trinity-v03'},
  {uuid:'5b792055-97cf-4d8a-8145-d588c83c54df',name:'trinity-db'}
];

test('staging D1 references match the four known Cloudflare account databases',()=>{
  const report=diagnoseD1Bindings(config,inventory,{environment:'staging'});
  assert.equal(report.safe_to_deploy_by_inventory,true);
  assert.equal(report.modified_resources,false);
  assert.equal(report.verified_against_account_inventory,true);
  assert.deepEqual(report.resources.map(x=>x.binding),['DB','rea']);
  assert.ok(report.resources.every(x=>x.status==='matched'));
});

test('staging deliberately drops only the absent legacy PC telemetry D1 binding',()=>{
  assert.equal(config.env.staging.d1_databases.some(x=>x.binding==='trinity_basterix'),false);
  assert.ok(config.env.staging.services.some(x=>x.binding==='PC_BRIDGE_V2'));
  assert.ok(config.env.staging.services.some(x=>x.binding==='PC_BRIDGE_SERVICE'));
  assert.ok(config.env.staging.kv_namespaces.some(x=>x.binding==='PC_STATE'));
  assert.ok(config.d1_databases.some(x=>x.binding==='trinity_basterix'));
});

test('production still has missing database and requires a separate repair',()=>{
  const report=diagnoseD1Bindings(config,inventory,{environment:'production'});
  assert.equal(report.safe_to_deploy_by_inventory,false);
  assert.equal(report.resources.find(x=>x.binding==='trinity_basterix').status,'database_id_not_visible');
});

test('reintroducing missing D1 UUID triggers pre-deploy failure 10181 guard',()=>{
  const cloned=structuredClone(config);
  const old=config.d1_databases.find(x=>x.binding==='trinity_basterix');
  cloned.env.staging.d1_databases.push(old);
  const report=diagnoseD1Bindings(cloned,inventory,{environment:'staging'});
  assert.equal(report.safe_to_deploy_by_inventory,false);
  assert.equal(report.resources.find(x=>x.binding==='trinity_basterix').status,'database_id_not_visible');
});

test('same D1 name with changed UUID is flagged, never silently remapped',()=>{
  const changed=inventory.map(x=>x.name==='trinity-development'
    ?{...x,uuid:'00000000-0000-4000-8000-000000000001'}:x);
  const report=diagnoseD1Bindings(config,changed,{environment:'staging'});
  assert.equal(report.safe_to_deploy_by_inventory,false);
  assert.equal(report.resources.find(x=>x.binding==='DB').status,'name_exists_with_different_id');
  assert.equal(report.modified_resources,false);
});

test('mismatching name, invalid inventory, unknown environment rejected',()=>{
  const wrong=inventory.map(x=>x.name==='trinity-development'?{...x,name:'wrong-db'}:x);
  const report=diagnoseD1Bindings(config,wrong,{environment:'staging'});
  assert.equal(report.resources.find(x=>x.binding==='DB').status,'name_mismatch');
  assert.throws(()=>diagnoseD1Bindings(config,{},{}),/inventory/);
  assert.throws(()=>diagnoseD1Bindings(config,[],{environment:'unknown'}),/Unknown Wrangler environment/);
});
