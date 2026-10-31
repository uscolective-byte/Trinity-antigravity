/**
 * @module TRINITY_OMNI_CORE
 * @subsystem LOCAL_BRIDGE_GATEWAY
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul bridge-heartbeat.mjs (Local-Gateway/src/bridge-heartbeat.mjs) v ekosystéme TRINITY OMNI-CORE.
 */
import os from 'node:os';

async function postHeartbeat(baseUrl,key,body){
  const response=await fetch(`${baseUrl.replace(/\/$/,'')}/v1/heartbeat`,{
    method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(15_000)
  });
  const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch{}
  if(!response.ok)throw new Error(data.error||`PC Bridge HTTP ${response.status}`);
  return data;
}

export function startBridgeHeartbeat({baseUrl,key,gatewayId='gateway:morhfeus-windows',version='1.3.0',capabilities=[],intervalMs=15_000,maxBackoffMs=120_000,onState=()=>{}}){
  if(!baseUrl||!key)return ()=>{};
  const state={stopped:false,busy:false,timer:null,failures:0};
  const schedule=delay=>{if(state.stopped)return;clearTimeout(state.timer);state.timer=setTimeout(beat,delay);state.timer.unref();};
  async function beat(){
    if(state.stopped||state.busy)return;state.busy=true;
    try{const result=await postHeartbeat(baseUrl,key,{agent:'trinity-pc-v2',hostname:os.hostname(),gateway_id:gatewayId,version,capabilities});state.failures=0;onState({status:'connected',last_seen:result.last_seen||result.receivedAt||Date.now(),last_success_at:new Date().toISOString(),consecutive_failures:0});}
    catch(error){state.failures++;const retry=Math.min(maxBackoffMs,intervalMs*2**Math.min(state.failures,5));onState({status:'disconnected',error:error.message,next_retry_ms:retry,consecutive_failures:state.failures});}
    finally{state.busy=false;schedule(state.failures?Math.min(maxBackoffMs,intervalMs*2**Math.min(state.failures,5)):intervalMs);}
  }
  beat();
  return ()=>{state.stopped=true;clearTimeout(state.timer);};
}
