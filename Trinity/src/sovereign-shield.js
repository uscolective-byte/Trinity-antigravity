const JSON_HEADERS = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};

export const AUTHORIZED_PRODUCTION_CRONS = Object.freeze([
  '*/30 * * * *',
  '0 0 * * *',
  '0 11 * * *'
]);

const TRAP_SEGMENTS = new Set([
  '.env', '.git', 'wp-admin', 'wp-login.php', 'phpmyadmin', 'actuator', 'config.json'
]);

const MACHINE_MUTATION_PATHS = [
  '/mcp',
  '/api/mcp/invoke',
  '/api/os/',
  '/api/ops/memory',
  '/api/assistant/memory'
];

function deny(status,error){
  return Response.json({error},{status,headers:JSON_HEADERS});
}

function normalizedPath(url){
  try{return decodeURIComponent(url.pathname).replace(/\\/g,'/').replace(/\/{2,}/g,'/').toLowerCase();}
  catch{return url.pathname.toLowerCase();}
}

function pathSegments(pathname){return pathname.split('/').filter(Boolean);}

export function isHoneypotPath(pathname){
  return pathSegments(pathname).some(segment=>TRAP_SEGMENTS.has(segment));
}

export function isPublicCronPath(pathname){
  return pathSegments(pathname).some(segment=>segment==='cron'||segment==='scheduled');
}

export function hasCredentialEvidence(request){
  const authorization=request.headers.get('Authorization')||'';
  const cookie=request.headers.get('Cookie')||'';
  return /^Bearer\s+\S+/i.test(authorization)
    || !!request.headers.get('X-Trinity-Token')
    || !!request.headers.get('X-Trinity-API-Key')
    || !!request.headers.get('X-Trinity-Gateway-Key')
    || !!request.headers.get('X-Trinity-Signature')
    || /(?:^|;\s*)trinity_session=[a-f0-9]{64}(?:;|$)/i.test(cookie);
}

function isMachineMutation(request,pathname){
  if(['GET','HEAD','OPTIONS'].includes(request.method.toUpperCase()))return false;
  return MACHINE_MUTATION_PATHS.some(prefix=>pathname===prefix||pathname.startsWith(prefix));
}

export async function enforceSovereignEdge(request,{maxBodyBytes=262144}={}){
  const url=new URL(request.url),pathname=normalizedPath(url);
  if(isHoneypotPath(pathname))return deny(403,'SOVEREIGN_SHIELD_TRAP_TRIGGERED');
  if(isPublicCronPath(pathname))return deny(403,'CRON_HTTP_TRIGGER_FORBIDDEN');

  const declared=Number(request.headers.get('Content-Length')||0);
  if(Number.isFinite(declared)&&declared>maxBodyBytes)return deny(413,'PAYLOAD_TOO_LARGE');

  if(isMachineMutation(request,pathname)&&!hasCredentialEvidence(request)){
    return deny(401,'EVIDENCEABLE_IDENTITY_REQUIRED');
  }

  if(!['GET','HEAD','OPTIONS'].includes(request.method.toUpperCase())&&request.body){
    const contentType=request.headers.get('Content-Type')||'';
    if(contentType.includes('application/json')){
      const bytes=new Uint8Array(await request.clone().arrayBuffer());
      if(bytes.byteLength>maxBodyBytes)return deny(413,'PAYLOAD_TOO_LARGE');
      if(bytes.includes(0))return deny(422,'BINARY_NULL_BYTE_REJECTED');
    }
  }
  return null;
}

export function verifyAuthorizedCronTrigger(eventCron,authorizedCrons=AUTHORIZED_PRODUCTION_CRONS){
  const unique=new Set(authorizedCrons);
  if(authorizedCrons.length!==3||unique.size!==3){
    return {valid:false,reason:'CRON_CONFIG_TAMPERED'};
  }
  if(typeof eventCron!=='string'||!unique.has(eventCron)){
    return {valid:false,reason:'UNAUTHORIZED_CRON_EXPRESSION'};
  }
  return {valid:true,reason:'AUTHORIZED_TRINITY_CRON'};
}

export function assertAuthorizedCronTrigger(eventCron,authorizedCrons=AUTHORIZED_PRODUCTION_CRONS){
  const result=verifyAuthorizedCronTrigger(eventCron,authorizedCrons);
  if(!result.valid)throw new Error(result.reason);
  return result;
}

export function scheduledOperationsForCron(eventCron){
  assertAuthorizedCronTrigger(eventCron);
  if(eventCron==='*/30 * * * *')return Object.freeze(['health','brain']);
  if(eventCron==='0 0 * * *')return Object.freeze(['evolution']);
  return Object.freeze(['improvement-scan']);
}

export async function claimScheduledCron(env,eventCron,scheduledTime=Date.now()){
  assertAuthorizedCronTrigger(eventCron);
  if(!env?.DB?.prepare)throw new Error('CRON_LEASE_STORE_UNAVAILABLE');
  const slot=Number.isFinite(Number(scheduledTime))?Math.floor(Number(scheduledTime)):Date.now();
  const row=await env.DB.prepare(`INSERT INTO ops_limits(key,window,count) VALUES(?,?,1)
    ON CONFLICT(key) DO UPDATE SET window=excluded.window,
    count=CASE WHEN ops_limits.window=excluded.window THEN ops_limits.count+1 ELSE 1 END
    RETURNING count`).bind(`cron:${eventCron}`,slot).first();
  return Number(row?.count)===1;
}
