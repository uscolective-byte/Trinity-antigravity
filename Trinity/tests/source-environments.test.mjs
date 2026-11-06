import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRINITY_SOURCE} from '../src/version.js';
import {VERIFIED_ARCHITECTURE_CONTEXT} from '../src/architecture.js';
import {UNIFIED_TRINITY_DIRECTIVE} from '../src/cognition.js';

test('production domains stay on production and build-only staging has no custom routes',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.name,'trinity');
 const productionRoutes=[
  {pattern:'auru.space',custom_domain:true},
  {pattern:'auru.dev',custom_domain:true}
 ];
 assert.deepEqual(config.routes,productionRoutes);
 assert.deepEqual(config.env.production.routes,productionRoutes);
 assert.equal(config.vars.TRINITY_ENV,'production');
 assert.equal(config.vars.TRINITY_GITHUB_REPO,TRINITY_SOURCE.repository);
 assert.equal(config.vars.TRINITY_GITHUB_BRANCH,TRINITY_SOURCE.branch);
 assert.equal(Object.hasOwn(config.vars,'GOOGLE_CLIENT_SECRET'),false,'OAuth secrets must not be committed in Wrangler vars');
 const callback=new URL(config.vars.GOOGLE_REDIRECT_URI);
 assert.equal(callback.origin,'https://auru.space');
 assert.ok(['/api/auth/google/callback','/auth/google/callback'].includes(callback.pathname));
 assert.equal(callback.search,'');assert.equal(callback.hash,'');
 const staging=config.env?.staging;
 const production=config.env?.production;
 assert.ok(production.r2_buckets.some(binding=>binding.binding==='R2_STORAGE'&&binding.bucket_name==='trinity-artifacts'));
 assert.ok(production.vectorize.some(binding=>binding.binding==='VECTOR_INDEX'&&binding.index_name==='trinity-vector-index'));
 assert.equal(staging.name,'trinity-staging');
 assert.deepEqual(staging.routes,[],'staging must not take over a production custom domain');
 assert.equal(staging.vars.TRINITY_ENV,'staging');
 assert.equal(staging.vars.TRINITY_PREVIEW_MODE,'build-only');
 assert.equal(staging.vars.TRINITY_ASSISTANT_BRIDGE_ENABLED,'false');
 assert.equal(staging.vars.AI_MODEL,undefined);
 assert.equal(staging.vars.TRINITY_OWNER_EMAIL,undefined);
 assert.deepEqual(staging.triggers,{crons:[]},'staging must not inherit production schedules');
 assert.equal(staging.vars.TRINITY_GITHUB_REPO,TRINITY_SOURCE.repository);
 assert.equal(staging.vars.TRINITY_GITHUB_BRANCH,TRINITY_SOURCE.branch);
 assert.deepEqual(staging.d1_databases.find(binding=>binding.binding==='DB'),{
  binding:'DB',database_name:'trinity-development',database_id:'1cce5249-e044-4c93-868c-0df534a778b5',migrations_dir:'migrations'
 });
 test('architecture context distinguishes configured environments from live deployment state',()=>{
  assert.match(VERIFIED_ARCHITECTURE_CONTEXT,/Produkčný Worker.*auru\.space aj auru\.dev/);
  assert.match(VERIFIED_ARCHITECTURE_CONTEXT,/trinity-staging.*build-only.*bez custom domény/);
  assert.match(VERIFIED_ARCHITECTURE_CONTEXT,/Konfigurácia sama osebe nepotvrdzuje nasadenie ani živé routovanie/);
  assert.doesNotMatch(VERIFIED_ARCHITECTURE_CONTEXT,/Obe domény auru\.space a auru\.dev zdieľajú rovnaký Worker/);
  assert.match(UNIFIED_TRINITY_DIRECTIVE,/auru\.dev.*produkčn/);
  assert.match(UNIFIED_TRINITY_DIRECTIVE,/trinity-staging.*build-only na Cloudflare workers\.dev/);
 });
 assert.equal(staging.d1_databases.some(binding=>binding.binding==='DB'&&binding.database_name==='trinity-v03'),false);
 assert.ok(staging.kv_namespaces.some(binding=>binding.binding==='Mastermind'));
 assert.ok(staging.r2_buckets.some(binding=>binding.binding==='ARTIFACTS'));
 assert.ok(staging.durable_objects.bindings.some(binding=>binding.name==='Brain'));
 assert.ok(staging.workflows.some(binding=>binding.binding==='OPS_WORKFLOW'));
 assert.equal(staging.services,undefined,'build-only staging must not bind production services');
 assert.equal(staging.secrets_store_secrets,undefined,'build-only staging must not expose production credentials');
 assert.equal(staging.vars.TRINITY_AUTO_IMPROVE,'false');
 assert.equal(staging.vars.TRINITY_AUTO_MERGE,'false');
});
