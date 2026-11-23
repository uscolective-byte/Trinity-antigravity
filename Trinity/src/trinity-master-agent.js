/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Restricted Cloudflare Workers AI diagnostics advisor for TRINITY OMNI-CORE.
 */
import {trinityMasterStatus} from './trinity-master-status.js';

// A restricted Cloudflare Workers AI diagnostics assistant. No tools, deployment,
// shell access, secrets access or privileged actions are granted to the model.
export async function adviseTrinityMaster(env,input,pcBridge=null){
  const task=typeof input?.task==='string'?input.task.trim():'';
  if(!task||task.length>2000)
    return {success:false,status:'invalid_request',error:'Task must be between 1 and 2000 characters.',execution_performed:false};
  // Reject credentials even when supplied by an authenticated admin.
  // These requests must never be forwarded to model inference.
  if(/(?:cfat_[A-Za-z0-9]{12,}|gh[pousr]_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,}|sk-(?:proj-)?[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}|ya29\.[A-Za-z0-9_.-]{10,}|-----BEGIN PRIVATE KEY-----|(?:api[_-]?key|token)\s*[:=]\s*[A-Za-z0-9_-]{12,})/i.test(task))
    return {success:false,status:'sensitive_input_rejected',error:'Do not include API keys or other credentials in AI diagnostics input.',execution_performed:false};
  if(typeof env?.AI?.run!=='function')
    return {success:false,status:'not_configured',error:'Cloudflare Workers AI binding is not available.',execution_performed:false};
  const diagnostics=trinityMasterStatus(env,pcBridge);
  const model=env.AI_MODEL||'@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const safeSnapshot={
    cloudflare:diagnostics.cloudflare,
    providers:Object.fromEntries(Object.entries(diagnostics.credentials).map(([name,item])=>
      [name,{configured:item.configured===true,verified:item.provider_verified===true,oauth_linked:item.oauth_linked===true}])),
    pc:diagnostics.pc,
    deployment_environment:diagnostics.deployment_environment
  };
  const prompt=[
    'You are TRINITY_MASTER, a read-only diagnostics advisor for the Cloudflare Trinity AI orchestrator.',
    'Provide only recommendations and verification steps strictly grounded in the supplied metadata.',
    'Never claim any real deployment, file edit, account creation, OAuth connection, or remediation as executed.',
    'Configured and verified are distinct states. Never fill in missing data by guessing.',
    'Be concise and technically accurate. Never print, invent, or request secrets.',
    'You have no Shell, PC, network, or GitHub tools available.',
    "COMMUNICATION LANGUAGE RULE: Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal 'tykanie' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language.",
    'Diagnostics (metadata only): '+JSON.stringify(safeSnapshot)
  ].join('\n');
  try{
    const result=await env.AI.run(model,{
      messages:[{role:'system',content:prompt},{role:'user',content:task}],
      max_tokens:600,temperature:0.15
    });
    const answer=typeof result==='string'?result
      :typeof result?.response==='string'?result.response
      :typeof result?.output_text==='string'?result.output_text
      :typeof result?.choices?.[0]?.message?.content==='string'?result.choices[0].message.content:'';
    if(!answer.trim())return {success:false,status:'provider_empty',model,execution_performed:false};
    return {success:true,status:'advice_only',model,answer:answer.slice(0,5000),
      execution_performed:false,verified_action_receipt:null};
  }catch{
    return {success:false,status:'provider_error',model,
      error:'Cloudflare Workers AI did not return a verifiable response.',execution_performed:false};
  }
}
