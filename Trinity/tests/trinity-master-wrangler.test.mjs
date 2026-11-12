import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));

test('production Worker secrets_store_secrets uses exact verified metadata',()=>{
  assert.deepEqual(config.secrets_store_secrets.map(x=>x.binding),['OLLAMA_SECRET']);
  assert.equal(config.vars.TRINITY_ENV,'production');
  assert.equal(config.env?.staging,undefined);
  const storeId=config.secrets_store_secrets[0].store_id;
  assert.match(storeId,/^[a-f\d]{32}$/);
  assert.equal(config.secrets_store_secrets[0].secret_name,'ollama');
});

test('high privilege and unverified secrets are not bound to public Worker',()=>{
  for(const name of ['GITHUBE_FINE_TOKEN','BASTERIX','Secret','R2',
    'default_grok_default','ollama-Duplicate']){
    assert.ok(!config.secrets_store_secrets
      .some(binding=>binding.secret_name===name),name);
  }
});
