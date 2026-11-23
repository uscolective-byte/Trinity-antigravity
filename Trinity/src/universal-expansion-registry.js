import {z} from 'zod';
import {HttpError} from './security.js';
import {runTool,TOOL_SCHEMAS} from './tools.js';
import {assertNoSimulatedData} from './truth.js';
import {SovereignLedgerV3} from './sovereign-core-v3.js';

const expansionId=z.string().regex(/^[a-z][a-z0-9-]{1,63}$/);
const safeTool=z.enum(['calculate','analyze_text','convert_units','format_text','hash_text','json_tool']);
const manifest=z.object({
  id:expansionId,
  name:z.string().trim().min(1).max(120),
  steps:z.array(z.object({tool:safeTool,args:z.record(z.string(),z.unknown())}).strict()).min(1).max(5)
}).strict();
const invokeSchema=z.object({id:expansionId}).strict();

function validatedManifest(input){
  const value=manifest.parse(input);
  for(const step of value.steps)step.args=TOOL_SCHEMAS[step.tool].parse(step.args);
  return value;
}

export async function registerExpansion(env,owner,input){
  const definition=validatedManifest(input);
  const revision=crypto.randomUUID();
  const saved=await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('expansion_registered',?)")
    .bind(JSON.stringify({owner,revision,definition})).run();
  if(saved?.success!==true||(saved.meta?.changes!=null&&saved.meta.changes!==1))throw new HttpError(503,'D1 did not confirm extension registration.');
  return {id:definition.id,revision,status:'registered',steps:definition.steps.map(step=>step.tool)};
}

export async function invokeExpansion(env,owner,input){
  const {id}=invokeSchema.parse(input);
  const current=await env.DB.prepare("SELECT details FROM ops_events WHERE action='expansion_registered' AND json_extract(details,'$.owner')=? AND json_extract(details,'$.definition.id')=? ORDER BY id DESC LIMIT 1").bind(owner,id).first();
  if(!current)throw new HttpError(404,'Extension does not exist for this profile.');
  const {revision,definition:stored}=JSON.parse(current.details);
  const definition=validatedManifest(stored);
  const results=[];
  for(const {tool,args} of definition.steps){
    const result=assertNoSimulatedData(await runTool(env,'orchestrator',tool,args),tool);
    if(result==null||result.error||result.ok===false||result.success===false)throw new HttpError(502,'Extension did not receive a result from tool '+tool+'.');
    results.push({tool,result});
  }
  const ledger=new SovereignLedgerV3(env);
  const block=await ledger.appendBlock('extension-registry','EXTENSION_INVOKED',{
    extension_id:id, revision, tools:results.map(result=>result.tool)
  });
  return {id,revision,status:'completed',results,audit_receipt:block.receipt};
}
