import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {diagnoseD1Bindings} from '../scripts/d1-binding-doctor.mjs';

const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const staging=config.env.staging.d1_databases;
const sample=staging.map(x=>({uuid:x.database_id,name:x.database_name}));

test('D1 preflight accepts existing account-visible IDs without touching cloud data',()=>{
  const result=diagnoseD1Bindings(config,sample,{environment:'staging'});
  assert.equal(result.safe_to_deploy_by_inventory,true);
  assert.equal(result.modified_resources,false);
  assert.equal(result.verified_against_account_inventory,true);
  assert.ok(result.resources.every(x=>x.status==='matched'));
});

test('D1 10181 case: missing trinity_basterix ID blocks staging before deployment',()=>{
  const visible=sample.filter(x=>x.name!=='trinity-pc-bridge');
  const report=diagnoseD1Bindings(config,visible,{environment:'staging'});
  const target=report.resources.find(r=>r.binding==='trinity_basterix');
  assert.equal(report.safe_to_deploy_by_inventory,false);
  assert.equal(target.status,'database_id_not_visible');
  assert.equal(target.visible_in_account,false);
});

test('same D1 name with changed ID is flagged, not automatically remapped',()=>{
  const inventory=sample.map(x=>x.name==='trinity-pc-bridge'?{...x,uuid:'00000000-0000-4000-8000-000000000001'}:x);
  const report=diagnoseD1Bindings(config,inventory,{environment:'staging'});
  const target=report.resources.find(r=>r.binding==='trinity_basterix');
  assert.equal(target.status,'name_exists_with_different_id');
  assert.equal(target.current_id_for_name,'00000000-0000-4000-8000-000000000001');
  assert.equal(report.modified_resources,false);
});

test('a mismatching name against an existing ID fails closed',()=>{
  const inventory=sample.map(x=>x.name==='trinity-pc-bridge'?{...x,name:'unrelated-db'}:x);
  const report=diagnoseD1Bindings(config,inventory,{environment:'staging'});
  assert.equal(report.safe_to_deploy_by_inventory,false);
  assert.equal(report.resources.find(r=>r.binding==='trinity_basterix').status,'name_mismatch');
});

test('preflight can inspect production separately without mutating it',()=>{
  const prod=config.d1_databases.map(x=>({uuid:x.database_id,name:x.database_name}));
  const report=diagnoseD1Bindings(config,{result:prod},{environment:'production'});
  assert.equal(report.environment,'production');
  assert.equal(report.safe_to_deploy_by_inventory,true);
});

test('bad inventory and unknown environment rejected',()=>{
  assert.throws(()=>diagnoseD1Bindings(config,{},{}),/inventory/);
  assert.throws(()=>diagnoseD1Bindings(config,[],{environment:'unknown'}),/Unknown Wrangler environment/);
});
