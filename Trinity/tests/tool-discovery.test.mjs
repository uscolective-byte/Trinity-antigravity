import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {describeAvailableTools,discoveryInstructions} from '../src/tool-discovery.js';
import {runAgent} from '../src/engine.js';
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

test('streaming routes tool and live-data requests to the durable tool loop', async () => {
  for(const message of ['Aké je počasie v Bratislave?','Nájdi aktuálne správy.','Skontroluj GitHub repozitár.','Použi csv_to_json.','Oprav chybu v projekte.']) {
    assert.equal(requiresWorkflowFallback(message),true,message);
    const response=await handleLiveChatStream({},null,{message});
    assert.equal(JSON.parse((await response.text()).trim()).type,'fallback_job');
  }
  for(const message of ['Ahoj, ako sa máš?','Vysvetli mi gravitáciu.','6 * 7']) assert.equal(requiresWorkflowFallback(message),false,message);
});
