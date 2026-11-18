import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {describeAvailableTools,discoveryInstructions} from '../src/tool-discovery.js';
import {runAgent} from '../src/engine.js';
import {runTool} from '../src/tools.js';
import {requiresWorkflowFallback,handleLiveChatStream} from '../src/chat-stream.js';

test('discovery exposes exact required arguments without exposing unauthorized tools', () => {
  const schemas={read:z.object({path:z.string(),limit:z.number().int().max(10).optional()}).strict(),delete:z.object({id:z.string()})};
  const result=describeAvailableTools(['read'],schemas,{read:'Čítanie súborov',delete:'Delete everything'},{name:'read'});
  assert.deepEqual(result.tools[0].input_schema.required,['path']);
  assert.equal(result.tools[0].input_schema.properties.limit.maximum,10);
  assert.equal(result.tools[0].input_schema.additionalProperties,false);
  assert.throws(()=>describeAvailableTools(['read'],schemas,{}, {name:'delete'}),/not available/);
});
test('discovery finds Slovak descriptions, deduplicates and bounds results', () => {
  assert.equal(describeAvailableTools(['read','read'],{}, {read:'Čítanie súborov'}, {query:'citanie'}).total,1);
  const result=describeAvailableTools(Array.from({length:30},(_,i)=>'tool_'+i),{},{});
  assert.equal(result.total,30);
  assert.equal(result.tools.length,12);
  assert.equal(result.truncated,true);
  assert.equal(describeAvailableTools(['read'],{}, {}, {query:'missing'}).total,0);
});

test('catalog searches operational labels while returning the original callable IDs', () => {
  const result=describeAvailableTools(['commodity_trade','terminal_payout'],{}, {}, {query:'simulovany obchod'});
  assert.equal(result.total,1);
  assert.equal(result.tools[0].name,'commodity_trade');
  assert.equal(result.tools[0].display_name,'Zapísať simulovaný obchod s komoditou');
});
test('discovery rejects malformed input and instructions retain request boundaries', () => {
  for(const input of [null,[],{name:1},{query:'x'.repeat(201)},{enable:true}]) assert.throws(()=>describeAvailableTools([],{}, {},input));
  const text=discoveryInstructions(['read','read']);
  assert.match(text,/describe_tools/);
  assert.match(text,/schvaľovanie/);
  assert.equal(text.endsWith('read.'),true);
});

test('runtime discovers argument schema then executes a real calculator without a named user instruction', async () => {
  let calls=0;
  const env={AI:{run:async()=>({response:++calls===1
    ?JSON.stringify({tool:'describe_tools',arguments:{name:'calculate'}})
    :calls===2?JSON.stringify({tool:'calculate',arguments:{operation:'multiply',values:[6,7]}}):'42'})}};
  const result=await runAgent(env,'orchestrator','Zisti súčin šiestich a siedmich.','','fast');
  assert.equal(result.text,'42');
  assert.deepEqual(result.tool_log.map(r=>[r.tool,r.status]),[['describe_tools','completed'],['calculate','completed']]);
});

test('fast runtime cannot discover privileged PC tools', async () => {
  let calls=0;
  const env={AI:{run:async()=>({response:++calls===1?JSON.stringify({tool:'describe_tools',arguments:{name:'pc_run'}}):'Nemám overený výsledok.'})}};
  const result=await runAgent(env,'orchestrator','Preskúmaj dostupné možnosti.','','fast');
  assert.equal(result.execution_status,'failed');
  assert.equal(result.tool_log[0].status,'failed');
});

test('owner can discover internal tools without a plugin record, ordinary users cannot', async () => {
  for (const ownerMode of [true,false]) {
    let calls=0;
    const statement={bind(){return this;},async all(){return {results:[]};},async first(){return null;},async run(){return {success:true};}};
    const env={DB:{prepare(){return statement;}},AI:{run:async()=>({response:++calls===1?JSON.stringify({tool:'describe_tools',arguments:{name:'cf_d1_query'}}):'Katalóg bol skontrolovaný.'})}};
    const result=await runAgent(env,'orchestrator','Preskúmaj databázové možnosti.','','workers-ai',1000,'sk',ownerMode);
    assert.equal(result.tool_log[0].status,ownerMode?'completed':'failed');
  }
});

test('CSV export writes a downloadable R2 artifact with safe, structured cells', async () => {
  let saved;
  const env={ARTIFACTS:{async put(key,content){saved={key,content};}}};
  const args={filename:'prehlad.csv',columns:['Meno','Cena'],rows:[['Žofia, a.s.',12],['=1+1',-5]]};
  const result=await runTool(env,'orchestrator','export_csv',args);
  assert.equal(result.rows,2);
  assert.match(result.download_url,/download=1$/);
  assert.equal(saved.content,'\uFEFF"Meno","Cena"\r\n"Žofia, a.s.","12"\r\n"\'=1+1","-5"\r\n');
  await assert.rejects(runTool(env,'orchestrator','export_csv',{...args,rows:[['short']]}),/rovnaký počet/);
  assert.equal(requiresWorkflowFallback('Exportuj tieto údaje do CSV.'),true);
});

test('streaming routes tool, live-data, and detailed analysis requests to the durable tool loop', async () => {
  for(const message of ['Otvor mi súbor README.md','Prečítaj mi README.md','Nájdi aktuálne správy.','Skontroluj GitHub repozitár.','Použi csv_to_json.','Oprav chybu v projekte.','Porovnaj podrobne možnosti a riziká.','Otvor adresár projektu.','Použi Antigravity na kontrolu projektu.']) {
    assert.equal(requiresWorkflowFallback(message),true,message);
    const response=await handleLiveChatStream({},null,{message});
    assert.equal(JSON.parse((await response.text()).trim()).type,'fallback_job');
  }
  for(const message of ['Ahoj, ako sa máš?','Vysvetli mi gravitáciu.','6 * 7','Aké je počasie v Bratislave?']) assert.equal(requiresWorkflowFallback(message),false,message);
});

test('fast mode exposes file tools only to the owner',async()=>{
  for(const ownerMode of [true,false]){
    let calls=0;
    const env={AI:{run:async()=>({response:++calls===1?JSON.stringify({tool:'describe_tools',arguments:{name:'pc_file_read'}}):'Rozumiem.'})}};
    const result=await runAgent(env,'orchestrator','Ukáž dostupné možnosti.','','fast',1000,'sk',ownerMode);
    assert.equal(result.tool_log[0].status,ownerMode?'completed':'failed');
  }
});

test('live chat does not emit unchecked reports of execution as deltas',async()=>{
  const response=await handleLiveChatStream({AI:{run:async()=>({response:'Otvorila som súbor README.md.'})}},null,{message:'Ahoj, ako sa máš?',engine:'fast',language:'sk'});
  const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  const text=events.filter(event=>event.type==='delta').map(event=>event.text).join('');
  assert.match(text,/Nemám overený/);
  assert.doesNotMatch(text,/Otvorila som/);
});

test('private cloud tools are callable for owners and check real provider configuration', async()=>{
 for(const [message,name] of [['Skontroluj OneDrive','onedrive_manage'],['Vypíš modely Gemini','google_cloud_manage'],['Over Google Drive file12345','google_drive_verify']]){
   assert.equal(requiresWorkflowFallback(message),true);
   await assert.rejects(runTool({},'orchestrator',name,{}),/overeného správcu/);
   if(name==='google_drive_verify'){
     await assert.rejects(runAgent({},'orchestrator',message,'','fast',1000,'sk',true),/servisný účet/);
   }else{
     const result=await runAgent({},'orchestrator',message,'','fast',1000,'sk',true);
     assert.equal(result.tool_log[0].tool,name);
     assert.equal(result.tool_log[0].status,'failed');
   }
 }
});

test('live owner status tests surface provider diagnostics and hide the account tools from other users',async()=>{
 const request={message:'Skontroluj OneDrive'};
 const owner=await handleLiveChatStream({},null,{...request,ownerMode:true});
 const events=(await owner.text()).trim().split('\n').map(JSON.parse);
 assert.ok(events.some(event=>event.type==='tool'&&event.name==='onedrive_manage'&&event.status==='failed'));
 assert.match(events.at(-1).error,/poverenie zatiaľ nie je nakonfigurované/);
 const visitor=await handleLiveChatStream({},null,request);
 assert.equal(JSON.parse((await visitor.text()).trim()).type,'fallback_job');
});
