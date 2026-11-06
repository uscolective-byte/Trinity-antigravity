import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const stagingBindings=config.env?.staging?.secrets_store_secrets??[];

test('build-only staging exposes no secrets while production Ollama metadata remains exact',()=>{
  assert.deepEqual(config.secrets_store_secrets.map(x=>x.binding),['OLLAMA_SECRET']);
  assert.equal(config.env.staging.vars.TRINITY_ENV,'staging');
  assert.equal(config.env.staging.vars.TRINITY_PREVIEW_MODE,'build-only');
  assert.deepEqual(stagingBindings,[]);
  const storeId=config.secrets_store_secrets[0].store_id;
  assert.match(storeId,/^[a-f\d]{32}$/);
  assert.equal(config.secrets_store_secrets[0].secret_name,'ollama');
});

test('high privilege and unverified secrets are not bound to public Worker',()=>{
  for(const name of ['GITHUBE_FINE_TOKEN','BASTERIX','Secret','R2',
    'default_grok_default','ollama-Duplicate']){
    assert.ok(![...config.secrets_store_secrets,...stagingBindings]
      .some(binding=>binding.secret_name===name),name);
  }
});
