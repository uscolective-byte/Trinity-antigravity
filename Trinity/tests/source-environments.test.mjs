import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRINITY_SOURCE} from '../src/version.js';

test('one repository, main branch and unified trinity Worker serve both domains',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.name,'trinity');
 assert.equal(config.env,undefined,'trinity-development was unified into the single trinity Worker');
 assert.deepEqual(config.routes,[
  {pattern:'auru.space',custom_domain:true},
  {pattern:'auru.dev',custom_domain:true}
 ]);
 assert.equal(config.vars.TRINITY_ENV,'production');
 assert.equal(config.vars.TRINITY_GITHUB_REPO,TRINITY_SOURCE.repository);
 assert.equal(config.vars.TRINITY_GITHUB_BRANCH,TRINITY_SOURCE.branch);
 assert.equal(Object.hasOwn(config.vars,'GOOGLE_CLIENT_SECRET'),false,'OAuth secrets must not be committed in Wrangler vars');
 const callback=new URL(config.vars.GOOGLE_REDIRECT_URI);
 assert.equal(callback.origin,'https://auru.space');
 assert.ok(['/api/auth/google/callback','/auth/google/callback'].includes(callback.pathname));
 assert.equal(callback.search,'');assert.equal(callback.hash,'');
});
