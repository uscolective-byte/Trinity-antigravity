// Persist PC telemetry only into actually bound and working stores.
// Never pretend that a heartbeat or absent optional binding is a storage receipt.
export async function persistPCTelemetry(env,body){
  const backends=[];
  if(typeof env?.PC_STATE?.put==='function'){
    try{
      await env.PC_STATE.put('telemetry:latest',JSON.stringify(body),{expirationTtl:300});
      backends.push('PC_STATE');
    }catch{
      // Do not propagate provider error messages: they can include private details.
    }
  }
  if(typeof env?.trinity_basterix?.prepare==='function'){
    try{
      const receipt=await env.trinity_basterix.prepare(
        "INSERT INTO pc_telemetry (id, gateway_id, hostname, platform, uptime, cpu_percent, memory_used_mb, memory_total_mb, disks_json, prislub_verified, last_seen, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT (id) DO UPDATE SET gateway_id=excluded.gateway_id, hostname=excluded.hostname, platform=excluded.platform, uptime=excluded.uptime, cpu_percent=excluded.cpu_percent, memory_used_mb=excluded.memory_used_mb, memory_total_mb=excluded.memory_total_mb, disks_json=excluded.disks_json, prislub_verified=excluded.prislub_verified, last_seen=excluded.last_seen, updated_at=datetime('now')"
      ).bind(
        body.gateway_id||'gateway:pc',body.hostname||'PC',body.platform||'win32',
        body.uptime_seconds||0,body.cpu?.cores||0,
        body.memory?.used_mb||0,body.memory?.total_mb||0,
        JSON.stringify(body.disks||{}),body.prislub_verified?1:0,
        body.timestamp||Date.now()
      ).run();
      if(receipt?.success===true)backends.push('trinity_basterix');
    }catch{
      // Missing tables or unavailable D1 do not count as successful persistence.
    }
  }
  return {
    ok:backends.length>0,stored:backends.length>0,
    backends,
    status:backends.length>0?'persisted':'storage_unavailable'
  };
}
