import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {validateAudit,verifySignature,handleRequest} from '../src/index.mjs';

const key='private-audit-key-for-unit-tests-only-not-production';
const event=()=>({
 event_id:randomUUID(),repo:'uscolective-byte/trinity-morhfeus',
 sha:'f'.repeat(40),status:'success',trigger:'push',actor:'trusted-bot',
 branch:'main',environment:'staging',duration_ms:120
});
const base='https://audit.example.invalid/v1/audit';
const sign=(raw,timestamp=Math.floor(Date.now()/1000))=>{
 const signature=createHmac('sha256',key).update(timestamp+'.'+raw).digest('hex');
 return {'content-type':'application/json','X-Trinity-Audit-Timestamp':String(timestamp),'X-Trinity-Audit-Signature':'sha256='+signature};
};
test('valid audit request',()=>assert.equal(validateAudit(event(),['uscolective-byte/trinity-morhfeus']),null));
test('unknown repo rejected',()=>assert.match(validateAudit({...event(),repo:'other/other'},['uscolective-byte/trinity-morhfeus']),/not allowed/));
test('invalid SHA rejected',()=>assert.match(validateAudit({...event(),sha:'abc'},['uscolective-byte/trinity-morhfeus']),/SHA/));
test('unrecognized fields reject unsafe environment',()=>assert.match(validateAudit({...event(),environment:'root'},['uscolective-byte/trinity-morhfeus']),/environment/));
test('signature binds exact body',async()=>{
 const body=JSON.stringify(event()),headers=new Headers(sign(body));
 assert.equal(await verifySignature(headers,body,key),true);
 assert.equal(await verifySignature(headers,body+' ',key),false);
});
test('old signatures rejected',async()=>{
 const body=JSON.stringify(event()),t=Math.floor(Date.now()/1000)-3600;
 assert.equal(await verifySignature(new Headers(sign(body,t)),body,key),false);
});
test('reject missing DB and secrets',async()=>{
 const req=new Request(base,{method:'POST',headers:sign(JSON.stringify(event())),body:JSON.stringify(event())});
 assert.equal((await handleRequest(req,{})).status,503);
});
test('invalid signature rejected before SQL',async()=>{
 let calls=0;
 const env={AUDIT_HMAC_KEY:key,AUDIT_ALLOWED_REPOS:'uscolective-byte/trinity-morhfeus',DB:{prepare(){calls++;throw Error('not reached');}}};
 const raw=JSON.stringify(event());
 const headers=sign(raw);headers['X-Trinity-Audit-Signature']='sha256='+'0'.repeat(64);
 assert.equal((await handleRequest(new Request(base,{method:'POST',headers,body:raw}),env)).status,401);
 assert.equal(calls,0);
});
test('parameterized insert includes placeholders and bound fields',async()=>{
 const body=JSON.stringify(event());
 let query='', params=[];
 const env={AUDIT_HMAC_KEY:key,AUDIT_ALLOWED_REPOS:'uscolective-byte/trinity-morhfeus',
  DB:{prepare(sql){query=sql;return {bind(...items){params=items;return {async run(){return {meta:{changes:1}}}}}}}}};
 const response=await handleRequest(new Request(base,{method:'POST',headers:sign(body),body}),env);
 assert.equal(response.status,201); assert.match(query,/VALUES \(\?,\?,\?,/);
 assert.equal(params[1],'uscolective-byte/trinity-morhfeus');
 assert.equal(params[2],'f'.repeat(40));assert.equal(params[3],'success');
});
test('duplicate event id is idempotent',async()=>{
 const body=JSON.stringify(event());let digest='';
 const env={AUDIT_HMAC_KEY:key,AUDIT_ALLOWED_REPOS:'uscolective-byte/trinity-morhfeus',
 DB:{prepare(sql){return {bind(){return sql.startsWith('INSERT')?{async run(){return {meta:{changes:0}}}}:{async first(){const {createHash}=await import('node:crypto');digest=createHash('sha256').update(body).digest('hex');return {id:'stored-id',request_hash:digest}}}}}}}};
 const response=await handleRequest(new Request(base,{method:'POST',headers:sign(body),body}),env);
 assert.equal(response.status,200);assert.equal((await response.json()).duplicate,true);
});
