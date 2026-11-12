import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRINITY_SOURCE} from '../src/version.js';

test('auru.space and auru.dev both serve unified production Worker without separate staging',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.name,'trinity');
 assert.deepEqual(config.routes,[{pattern:'auru.space',custom_domain:true},{pattern:'auru.dev',custom_domain:true}]);
 assert.equal(config.vars.TRINITY_ENV,'production');
 assert.equal(config.vars.TRINITY_GITHUB_REPO,TRINITY_SOURCE.repository);
 assert.equal(config.vars.TRINITY_GITHUB_BRANCH,TRINITY_SOURCE.branch);
 assert.equal(Object.hasOwn(config.vars,'GOOGLE_CLIENT_SECRET'),false,'OAuth secrets must not be committed in Wrangler vars');
 const callback=new URL(config.vars.GOOGLE_REDIRECT_URI);
 assert.equal(callback.origin,'https://auru.space');
 assert.ok(['/api/auth/google/callback','/auth/google/callback'].includes(callback.pathname));
 assert.equal(callback.search,'');assert.equal(callback.hash,'');
 assert.equal(config.env?.staging,undefined);
 assert.deepEqual(config.d1_databases.find(binding=>binding.binding==='DB'),{
  binding:'DB',database_name:'trinity-v03',database_id:'ca8ea24e-f7db-431e-b8bf-97f713ae4533',migrations_dir:'migrations'
 });
 assert.ok(config.kv_namespaces.some(binding=>binding.binding==='Mastermind'));
 assert.ok(config.r2_buckets.some(binding=>binding.binding==='ARTIFACTS'));
 assert.ok(config.durable_objects.bindings.some(binding=>binding.name==='Brain'));
 assert.ok(config.workflows.some(binding=>binding.binding==='OPS_WORKFLOW'));
 assert.ok(config.services.some(binding=>binding.binding==='KNOWLEDGE_SERVICE'));
});
