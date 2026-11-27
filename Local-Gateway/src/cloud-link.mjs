/**
 * @module TRINITY_OMNI_CORE
 * @subsystem LOCAL_BRIDGE_GATEWAY
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul cloud-link.mjs (Local-Gateway/src/cloud-link.mjs) v ekosystéme TRINITY OMNI-CORE.
 */
import {executeProposal} from './executor.mjs';

async function request(url,key,options={}){
  const cfHeaders={};
  if(process.env.CLOUDFLARE_ACCESS_CLIENT_ID)cfHeaders['CF-Access-Client-Id']=process.env.CLOUDFLARE_ACCESS_CLIENT_ID;
  if(process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET)cfHeaders['CF-Access-Client-Secret']=process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
  const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',...cfHeaders,...(options.headers||{})},signal:AbortSignal.timeout(25_000),redirect:'manual'});
  if(response.status>=300&&response.status<400) throw new Error(`Cloud vyžaduje prihlásenie (HTTP ${response.status}).`);
  const data=await response.json().catch(()=>null);
  if(!data||typeof data!=='object') throw new Error(`Cloud nevrátil platnú JSON odpoveď (HTTP ${response.status}).`);
  if(!response.ok)throw new Error(data.error||`Cloud HTTP ${response.status}`);return data;
}

export function startCloudLink({baseUrl,key,store,workspaceRoot,dataDir,execute=executeProposal,beforeClaim,intervalMs=5000,maxBackoffMs=60_000,onState=()=>{}}){
  if(!baseUrl||!key)return ()=>{};let stopped=false,busy=false,timer=null,failures=0;
  const report=state=>onState({...state,at:new Date().toISOString(),consecutive_failures:failures});
  const schedule=delay=>{if(stopped)return;clearTimeout(timer);timer=setTimeout(poll,delay);timer.unref();};
  async function sendReceipt(id,status,receipt,error){
    await request(`${baseUrl}/api/system/actions/${id}/receipt`,key,{method:'POST',body:JSON.stringify({status,receipt:receipt??undefined,error:status==='failed'?error:undefined})});
  }
  async function poll(){
    if(stopped||busy)return;busy=true;
    try{
      if(beforeClaim)await beforeClaim();
      const result=await request(`${baseUrl}/api/system/actions/claim`,key,{method:'POST',body:'{}'});
      if(!Object.hasOwn(result,'action')) throw new Error('Cloud nepotvrdil stav frontu PC brány.');
      const {action}=result;failures=0;if(!action){report({status:'connected',last_success_at:new Date().toISOString()});return;}
      let local=await store.importApproved(action);
      if(['completed','failed'].includes(local.status)){await sendReceipt(action.id,local.status,local.receipt,local.error);report({status:'receipt-replayed',id:action.id,last_success_at:new Date().toISOString()});return;}
      local=await store.transition(action.id,['approved'],'executing',{executionStartedAt:new Date().toISOString()});
      try{
        const receipt=await execute(workspaceRoot,{...local,status:'approved'},dataDir);const status=receipt.success===false?'failed':'completed';
        local=await store.transition(action.id,['executing'],status,{receipt,error:status==='failed'?'Povolený proces skončil chybou.':null,completedAt:new Date().toISOString()});
      }catch(error){local=await store.transition(action.id,['executing'],'failed',{error:error.message,completedAt:new Date().toISOString()});}
      await sendReceipt(action.id,local.status,local.receipt,local.error);
      report({status:local.status,id:action.id,action:action.action,last_success_at:new Date().toISOString()});
    }catch(error){failures++;const retry=Math.min(maxBackoffMs,intervalMs*2**Math.min(failures,6));report({status:'disconnected',error:error.message,next_retry_ms:retry});}
    finally{busy=false;schedule(failures?Math.min(maxBackoffMs,intervalMs*2**Math.min(failures,6)):intervalMs);}
  }
  poll();return ()=>{stopped=true;clearTimeout(timer);};
}
