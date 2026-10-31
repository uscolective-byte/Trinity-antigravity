import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRINITY_VERSION,TRINITY_SOURCE} from '../src/version.js';

const read = path => readFileSync(new URL(path,import.meta.url),'utf8');

test('Trinity 12 source, package, lockfile and release docs agree',()=>{
  const pkg=JSON.parse(read('../package.json'));
  const lock=JSON.parse(read('../package-lock.json'));
  assert.equal(TRINITY_VERSION,'12.0.0');
  assert.equal(pkg.version,TRINITY_VERSION);
  assert.equal(lock.version,TRINITY_VERSION);
  assert.equal(lock.packages[''].version,TRINITY_VERSION);
  assert.equal(TRINITY_SOURCE.repository,'uscolective-byte/Trinity-antigravity');
  assert.equal(TRINITY_SOURCE.branch,'main');
  for(const content of [read('../../README.md'),read('../README.md')]){
    assert.match(content,/Verzia zdroja: \*\*12\.0\.0\*\*/);
  }
});
