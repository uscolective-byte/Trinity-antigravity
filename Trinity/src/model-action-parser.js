/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module model-action-parser.js (Trinity/src/model-action-parser.js) in the TRINITY OMNI-CORE ecosystem.
 */
// Normalize one explicit model action. Mixed prose is not proof that a tool ran.
function invalid(message){throw new Error('Invalid tool call from model: '+message);}
function argumentsObject(value){
  if(value===undefined)return {};
  if(typeof value==='string'){
    try{value=JSON.parse(value);}catch{invalid('arguments are not valid JSON.');}
  }
  if(!value||typeof value!=='object'||Array.isArray(value))invalid('arguments must be an object.');
  return value;
}
function actionObject(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  if(Array.isArray(value.tool_calls)){
    if(value.tool_calls.length!==1)invalid('expected exactly one call per step.');
    return actionObject(value.tool_calls[0])||invalid('unknown tool_calls format.');
  }
  let name,args;
  if(Object.hasOwn(value,'tool')){name=value.tool;args=value.arguments;}
  else if(value.functionCall){name=value.functionCall.name;args=value.functionCall.args;}
  else if(value.type==='function'||value.function){
    const fn=value.function||value;name=fn.name;
    args=Object.hasOwn(fn,'arguments')?fn.arguments:fn.parameters;
  }
  else if(typeof value.answer==='string')return {answer:value.answer};
  else return null;
  if(typeof name!=='string'||!/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(name))invalid('missing valid tool name.');
  return {tool:name,arguments:argumentsObject(args)};
}
function containsCallShape(text){
  return /["'](?:tool|tool_calls|functionCall)["']\s*:/.test(text)
    || /["']type["']\s*:\s*["']function["']/.test(text)
    || /(?:^|\n)\s*(?:\*\*|\b)(?:nástroj|nastroj|tool)(?:\*\*|\b)\s*:\s*`?[a-z_][a-z0-9_-]*`?/i.test(text);
}
export function parseModelAction(input){
  if(typeof input!=='string'){
    const action=actionObject(input);
    if(action)return action;
    invalid('response does not have a supported text or structured format.');
  }
  const trimmed=input.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let value;
  try{value=JSON.parse(trimmed);}catch{
    if(containsCallShape(trimmed))invalid('call is incomplete or mixed with prose; result is not verified.');
    return {answer:input};
  }
  return actionObject(value)||{answer:input};
}
