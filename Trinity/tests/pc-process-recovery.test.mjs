import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runAgent,toolCallKey} from '../src/engine.js';
import {waitForSystemAction} from '../src/tools.js';
import {agentById} from '../src/registry.js';
import {workflowResultComplete} from '../src/truth.js';

test('failed PC actions expose bounded diagnostic receipts while remaining failed',async()=>{
 const receipt={exitCode:1,success:false,stdout:'x'.repeat(9000),stderr:'AssertionError: expected 42',privateField:'never-forward'};
 const env={DB:{prepare(){return {bind(){return this;},async first(){return {id:'failed-run',status:'failed',payload_json:'{}',receipt_json:JSON.stringify(receipt),error:'Process failed'};}};}}};
 await assert.rejects(waitForSystemAction(env,{id:'failed-run',status:'approved'},{attempts:1,intervalMs:0}),error=>{
   assert.equal(error.toolResult.status,'failed');assert.equal(error.toolResult.receipt.exitCode,1);
   assert.equal(error.toolResult.receipt.stdout.length,6000);assert.match(error.toolResult.receipt.stderr,/AssertionError/);
   assert.equal(error.toolResult.receipt.privateField,undefined);return true;
 });
});

test('coding roles have script tools but ordinary sessions cannot discover them',async()=>{
 for(const id of ['architect','backend','frontend','qa','security','release','cloudflare']){
  for(const tool of ['pc_run_script','pc_file_read','pc_file_edit'])assert.ok(agentById(id).tools.includes(tool),id+':'+tool);
 }
 let calls=0;
 const env={AI:{run:async()=>({response:++calls===1?JSON.stringify({tool:'describe_tools',arguments:{name:'pc_run_script'}}):'Nie je dostupné.'})}};
 const result=await runAgent(env,'backend','Preskúmaj možnosti.','','fast',1000,'sk',false);
 assert.equal(result.tool_log[0].status,'failed');
});

test('agent sees process failure diagnostics and can verify a successful retry without erasing history',async()=>{
 let actionNo=0,readNo=0,modelCalls=0;
 const args={runtime:'node',path:'Trinity/workspace/scripts/test.mjs',expected_sha256:'a'.repeat(64)};
 const env={DB:{prepare(sql){return {
  bind(){if(sql.startsWith('INSERT INTO ops_system_actions')){actionNo++;readNo=0;}return this;},
  async run(){return {};},
  async all(){return {results:sql.includes('FROM ops_plugins')?[{id:'developer-operator',installed:1,enabled:1}]:[]};},
  async first(){
   if(sql.includes('FROM ops_plugins'))return {installed:1,enabled:1};
   if(!sql.includes('ops_system_actions'))return null;
   const status=actionNo===1?(readNo++===0?'approved':'failed'):'completed';
   const receipt=status==='failed'?{exitCode:1,success:false,stderr:'AssertionError: expected 42'}:status==='completed'?{exitCode:0,success:true,stdout:'42',script_sha256:args.expected_sha256}:null;
   return {id:'action-'+actionNo,action:'run',status,payload_json:'{}',receipt_json:receipt?JSON.stringify(receipt):null,error:status==='failed'?'Process failed':null};
  }
 };}},AI:{run:async(_model,{messages})=>{
  modelCalls++;
  if(modelCalls===2){const diagnostic=messages.at(-1).content;assert.match(diagnostic,/AssertionError: expected 42/);assert.match(diagnostic,/"exitCode":1/);}
  const retryArgs={path:args.path,expected_sha256:args.expected_sha256,runtime:args.runtime,args:[],timeout_ms:30000};
  return {response:modelCalls<=2?JSON.stringify({tool:'pc_run_script',arguments:modelCalls===1?args:retryArgs}):'Test teraz prešiel.'};
 }}};
 const result=await runAgent(env,'backend','Spusti uložený overovací test.','','workers-ai',2000,'sk',true);
 assert.deepEqual(result.tool_log.map(entry=>entry.status),['failed','completed']);
 assert.equal(result.tool_log[0].receipt_id,'action-1');
 assert.notEqual(result.execution_status,'failed',JSON.stringify(result));
 assert.equal(workflowResultComplete(result),true,JSON.stringify(result));
});


test('retry identity includes validated defaults and ignores object field order without merging different operations',async()=>{
 const first={runtime:'node',path:'Trinity/workspace/scripts/test.mjs',expected_sha256:'a'.repeat(64)};
 assert.equal(await toolCallKey('pc_run_script',first),await toolCallKey('pc_run_script',{path:first.path,args:[],runtime:'node',timeout_ms:30000,expected_sha256:first.expected_sha256}));
 assert.notEqual(await toolCallKey('pc_run_script',first),await toolCallKey('pc_run_script',{...first,path:'Trinity/workspace/scripts/other.mjs'}));
 assert.notEqual(await toolCallKey('pc_run_script',{...first,args:['first','second']}),await toolCallKey('pc_run_script',{...first,args:['second','first']}));
 assert.notEqual(await toolCallKey('pc_file_write',{path:'Trinity/a.txt',content:'one'}),await toolCallKey('pc_file_write',{path:'Trinity/a.txt',content:'two'}));
});


test('edit schemas expose both unambiguous spellings and normalize the same operation identity',async()=>{
 const canonical={path:'Trinity/test.txt',find:'old',replace:'new'};
 const alternate={path:'Trinity/test.txt',target:'old',replacement:'new'};
 assert.equal(await toolCallKey('pc_file_edit',canonical),await toolCallKey('pc_file_edit',alternate));
 const {TOOL_SCHEMAS}=await import('../src/tools.js');
 assert.deepEqual(TOOL_SCHEMAS.pc_file_edit.parse(alternate),canonical);
 assert.throws(()=>TOOL_SCHEMAS.pc_file_edit.parse({...canonical,...alternate}));
 assert.throws(()=>TOOL_SCHEMAS.pc_file_edit.parse({path:canonical.path,target:'old'}));
});
