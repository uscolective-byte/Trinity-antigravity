/** GitHub Actions audit client. No wrangler d1 execute, no shell interpolation. */
import {createHmac,randomUUID} from 'node:crypto';

const env=process.env;
const url=env.TRINITY_AUDIT_URL;
const key=env.TRINITY_AUDIT_HMAC_KEY;
if(!url||!/^https:\/\//.test(url)||!key||key.length<32){
 console.error('Audit not configured: HTTPS TRINITY_AUDIT_URL and scoped TRINITY_AUDIT_HMAC_KEY are required.');
 process.exit(1);
}
const raw=JSON.stringify({
 event_id:randomUUID(),
 repo:env.GITHUB_REPOSITORY,
 sha:env.GITHUB_SHA,
 status:env.TRINITY_JOB_STATUS||'pending',
 trigger:env.GITHUB_EVENT_NAME||'manual',
 actor:env.GITHUB_ACTOR||null,
 branch:env.GITHUB_REF_NAME||null,
 environment:env.TRINITY_DEPLOY_ENV||'development'
});
const timestamp=String(Math.floor(Date.now()/1000));
const signature='sha256='+createHmac('sha256',key).update(timestamp+'.'+raw).digest('hex');
try{
 const reply=await fetch(url,{
  method:'POST',
  headers:{'content-type':'application/json',
   'X-Trinity-Audit-Timestamp':timestamp,
   'X-Trinity-Audit-Signature':signature},
  body:raw,signal:AbortSignal.timeout(12000),redirect:'error'
 });
 const result=await reply.json().catch(()=>({}));
 if(!reply.ok||!result.ok)throw new Error('Audit service did not accept event (HTTP '+reply.status+')');
 console.log('Audit receipt:',result.id,'duplicate:',Boolean(result.duplicate));
}catch(err){console.error('CI audit write failed:',err.message);process.exit(1);}
