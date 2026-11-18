import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runTool} from '../src/tools.js';
import {pcActionReceipt} from '../src/engine.js';

test('PC open-app receipt is completed only with verified execution evidence',()=>{
  const timestamp='2026-10-26T06:30:00.000Z';
  assert.deepEqual(pcActionReceipt({id:'proposal-1',status:'proposed'},timestamp),{
    tool:'pc_open_app',status:'pending',effect:'proposal',receipt_id:'proposal-1',verified_at:timestamp
  });
  assert.equal(pcActionReceipt({id:'claimed-1',status:'claimed'},timestamp).status,'running');
  assert.equal(pcActionReceipt({id:'failed-1',status:'failed'},timestamp).status,'failed');
  assert.deepEqual(pcActionReceipt({status:'completed',_evidence:{receipt_id:'verified-1'}},timestamp),{
    tool:'pc_open_app',status:'completed',effect:'mutation',actions:['execute'],receipt_id:'verified-1',verified_at:timestamp
  });
});

test('admin PC tools validate their own schema and dispatch bounded gateway payloads',async()=>{
  const payloads=[];
  const env={DB:{prepare(sql){return {
    bind(...values){if(sql.startsWith('INSERT INTO ops_system_actions'))payloads.push(JSON.parse(values[2]));return this;},
    async run(){return {};},async first(){return sql.includes('ops_plugins')?{installed:1,enabled:1}:{id:'test-action',action:'read',status:'completed',payload_json:'{}',receipt_json:JSON.stringify({content:'verified',sha256:'a'.repeat(64)})};}
  };}}};
  const agent={tools:['pc_run_script','pc_file_read','pc_file_write','pc_file_edit','pc_file_append','pc_run']};
  await assert.rejects(runTool(env,agent,'pc_file_read',{path:'Trinity/package.json'}),/admin/);
  const read=await runTool(env,agent,'pc_file_read',{path:'Trinity/package.json'},{adminAuthorized:true});
  assert.equal(read.content,'verified');
  await runTool(env,agent,'pc_file_write',{path:'Trinity/new.txt',content:'new'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).expected_sha256,'absent');
  await runTool(env,agent,'pc_file_append',{path:'Trinity/new.txt',content:' appended'},{adminAuthorized:true});
  assert.deepEqual(payloads.at(-1),{path:'Trinity/new.txt',content:'verified appended',expected_sha256:'a'.repeat(64)});
  await runTool(env,agent,'pc_file_edit',{path:'Trinity/new.txt',find:'verified',replace:'$& replaced'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).content,'$& replaced');
  await runTool(env,agent,'pc_file_edit',{path:'Trinity/new.txt',target:'verified',replacement:'alternate spelling'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).content,'alternate spelling');
  assert.equal(payloads.at(-1).expected_sha256,'a'.repeat(64));
  await assert.rejects(runTool(env,agent,'pc_file_edit',{path:'Trinity/new.txt',find:'missing',replace:'x'},{adminAuthorized:true}),/presne raz/);
  await runTool(env,agent,'pc_run',{command:'npm run build',cwd:'Trinity'},{adminAuthorized:true});
  assert.deepEqual(payloads.at(-1),{project:'Trinity',task:'build'});
  await assert.rejects(runTool(env,agent,'pc_run_script',{runtime:'node',path:'Trinity/workspace/scripts/test.mjs',expected_sha256:'a'.repeat(64)}),/admin/);
  await runTool(env,agent,'pc_run_script',{runtime:'python',path:'Trinity/workspace/scripts/test.py',expected_sha256:'a'.repeat(64),args:['literal value']},{adminAuthorized:true});
  assert.deepEqual(payloads.at(-1),{task:'script',runtime:'python',path:'Trinity/workspace/scripts/test.py',expected_sha256:'a'.repeat(64),args:['literal value'],timeout_ms:30000});
  await runTool(env,agent,'pc_run',{command:'python --version'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).task,'python-version');
  const before=payloads.length;
  await assert.rejects(runTool(env,agent,'pc_run',{command:'npm run build; arbitrary'},{adminAuthorized:true}),/povoľuje/);
  assert.equal(payloads.length,before);
  const openApp=await runTool(env,{tools:['pc_open_app']},'pc_open_app',{target:'calculator'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).target,'calculator');
  await runTool(env,{tools:['pc_open_app']},'pc_open_app',{target:'cmder'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).target,'cmder');
  await runTool(env,{tools:['pc_open_url']},'pc_open_url',{url:'https://auru.dev'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).url,'https://auru.dev');
});


test('legacy PC tool names execute the verified gateway operations instead of incompatible payloads',async()=>{
  const payloads=[];
  const env={DB:{prepare(sql){return {
    bind(...values){if(sql.startsWith('INSERT INTO ops_system_actions'))payloads.push({action:values[1],payload:JSON.parse(values[2])});return this;},
    async run(){return {};},async first(){return sql.includes('ops_plugins')?{installed:1,enabled:1}:{id:'alias-test',action:'read',status:'completed',payload_json:'{}',receipt_json:JSON.stringify({content:'original',sha256:'a'.repeat(64)})};}
  };}}};
  const agent={tools:['pc_fs_read','pc_fs_write','pc_fs_patch','pc_shell_exec','pc_system_telemetry']};
  const auth={adminAuthorized:true};
  await assert.rejects(runTool(env,agent,'pc_fs_read',{path:'Trinity/test.txt'}),/admin/);
  assert.equal((await runTool(env,agent,'pc_fs_read',{path:'Trinity/test.txt'},auth)).content,'original');
  assert.deepEqual(payloads.at(-1),{action:'read',payload:{path:'Trinity/test.txt'}});
  await runTool(env,agent,'pc_fs_write',{path:'Trinity/test.txt',content:'new'},auth);
  assert.deepEqual(payloads.at(-1),{action:'write',payload:{path:'Trinity/test.txt',content:'new',expected_sha256:'absent'}});
  await runTool(env,agent,'pc_fs_write',{path:'Trinity/test.txt',content:'new',expected_sha256:'b'.repeat(64)},auth);
  assert.equal(payloads.at(-1).payload.expected_sha256,'b'.repeat(64));
  await runTool(env,agent,'pc_fs_write',{path:'Trinity/test.txt',content:' appended',append:true},auth);
  assert.equal(payloads.at(-1).payload.content,'original appended');
  assert.equal(payloads.at(-1).payload.expected_sha256,'a'.repeat(64));
  await runTool(env,agent,'pc_fs_patch',{path:'Trinity/test.txt',target:'original',replacement:'patched'},auth);
  assert.equal(payloads.at(-1).payload.content,'patched');
  assert.equal(payloads.at(-1).payload.expected_sha256,'a'.repeat(64));
  await runTool(env,agent,'pc_shell_exec',{command:'node --version'},auth);
  assert.deepEqual(payloads.at(-1),{action:'run',payload:{project:'Trinity',task:'node-version'}});
  await assert.rejects(runTool(env,agent,'pc_shell_exec',{command:'arbitrary command'},auth),/povoľuje/);
  await runTool(env,agent,'pc_system_telemetry',{},auth);
  assert.equal(payloads.at(-1).action,'system_info');
});


test('general file and command tools use the PC gateway for both PascalCase and lowercase arguments',async()=>{
 const payloads=[];
 const env={DB:{prepare(sql){return {
  bind(...values){if(sql.startsWith('INSERT INTO ops_system_actions'))payloads.push({action:values[1],payload:JSON.parse(values[2])});return this;},
  async run(){return {};},async first(){return sql.includes('ops_plugins')?{installed:1,enabled:1}:{id:'general-test',action:'read',status:'completed',payload_json:'{}',receipt_json:JSON.stringify({content:'alpha\nbeta\ngamma',bytes:16,sha256:'a'.repeat(64)})};}
 };}}};
 const agent={tools:['read_file','write_file','edit_file','run_command']},auth={adminAuthorized:true};
 await assert.rejects(runTool(env,agent,'read_file',{Path:'Trinity/a.txt'}),/admin/);
 const read=await runTool(env,agent,'read_file',{Path:'Trinity/a.txt',StartLine:2,EndLine:2},auth);
 assert.equal(read.content,'beta');assert.equal(read.sha256_scope,'full_file');assert.equal(read.full_bytes,16);
 assert.deepEqual(payloads.at(-1),{action:'read',payload:{path:'Trinity/a.txt'}});
 assert.equal((await runTool(env,agent,'read_file',{path:'Trinity/a.txt',start_line:1,end_line:1},auth)).content,'alpha');
 for(const input of [{Path:'Trinity/a.txt',Target:'alpha',Replacement:'changed'},{path:'Trinity/a.txt',target:'alpha',replacement:'changed'},{path:'Trinity/a.txt',find:'alpha',replace:'changed'}]){
  await runTool(env,agent,'edit_file',input,auth);
  assert.deepEqual(payloads.at(-1),{action:'edit',payload:{path:'Trinity/a.txt',content:'changed\nbeta\ngamma',expected_sha256:'a'.repeat(64)}});
 }
 await runTool(env,agent,'write_file',{Path:'Trinity/a.txt',Content:'updated',Overwrite:true},auth);
 assert.equal(payloads.at(-1).payload.expected_sha256,'a'.repeat(64));
 await runTool(env,agent,'write_file',{path:'Trinity/new.txt',content:'new'},auth);
 assert.equal(payloads.at(-1).payload.expected_sha256,'absent');
 await runTool(env,agent,'write_file',{Path:'Trinity/a.txt',Content:' extra',Append:true},auth);
 assert.equal(payloads.at(-1).payload.content,'alpha\nbeta\ngamma extra');
 await runTool(env,agent,'run_command',{CommandLine:'node -v'},auth);
 assert.deepEqual(payloads.at(-1),{action:'run',payload:{project:'Trinity',task:'node-version'}});
 await runTool(env,agent,'run_command',{command:'npm test',cwd:'Trinity'},auth);
 assert.equal(payloads.at(-1).payload.task,'tests');
 await assert.rejects(runTool(env,agent,'run_command',{CommandLine:'node -v',IsDaemon:true},auth),/Trvalé procesy/);
 await assert.rejects(runTool(env,agent,'run_command',{command:'arbitrary command'},auth),/povoľuje/);
});
