import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {auditTrackedSource} from '../scripts/code-audit.mjs';

function fixture(fn){
  const root=mkdtempSync(join(tmpdir(),'trinity-audit-'));
  try{
    assert.equal(spawnSync('git',['init','-q',root]).status,0);
    mkdirSync(join(root,'src'));
    return fn(root);
  }finally{rmSync(root,{recursive:true,force:true});}
}
test('inventory checks tracked JavaScript/JSON and only reports identical files',()=>fixture(root=>{
  writeFileSync(join(root,'src','a.mjs'),'export const answer=42;\n');
  writeFileSync(join(root,'src','b.mjs'),'export const answer=42;\n');
  writeFileSync(join(root,'src','c.json'),'{}\n');
  writeFileSync(join(root,'src','style.css'),'body {}\n');
  writeFileSync(join(root,'src','config.jsonc'),'// valid JSONC\n{"ok":true}');
  assert.equal(spawnSync('git',['-C',root,'add','.']).status,0);
  const report=auditTrackedSource(root);
  assert.equal(report.tracked_files,5);
  assert.equal(report.checked_js,2);
  assert.equal(report.checked_json,1);
  assert.equal(report.other_source_files,2);
  assert.deepEqual(report.duplicate_groups,[['src/a.mjs','src/b.mjs']]);
  assert.equal(report.deletion_performed,false);
  assert.equal(report.ok,true);
}));
test('syntax failures are reported but project code is not executed',()=>fixture(root=>{
  writeFileSync(join(root,'src','bad.mjs'),'if (\n');
  writeFileSync(join(root,'src','bad.json'),'{');
  assert.equal(spawnSync('git',['-C',root,'add','.']).status,0);
  const report=auditTrackedSource(root);
  assert.equal(report.ok,false);
  assert.deepEqual(report.errors.map(x=>x.kind),['json_parse_error','javascript_syntax_error_or_timeout']);
}));
