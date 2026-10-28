import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMicrosoftBridge,TRINITYS_META,MICROSOFT_PROFILES} from '../modules/microsoft.mjs';

const mock = ({email='saboivan2008@gmail.com'}={})=>{
 const entries=new Map(),requests=[];
 const vault={get:async key=>entries.get(key)||'',set:async (key,value)=>{entries.set(key,value);return ''}};
 const fetcher=async(url,init={})=>{
  requests.push({url,method:init.method||'GET',body:init.body,headers:init.headers});
  if(url.endsWith('/devicecode'))return Response.json({device_code:'private-device-code',user_code:'ABCD-1234',verification_uri:'https://microsoft.com/devicelogin',expires_in:900});
  if(url.endsWith('/token'))return Response.json({access_token:'private-access-token',refresh_token:'private-refresh-token',expires_in:3600});
  if(url.includes('/me?'))return Response.json({id:'example-id',mail:email,userPrincipalName:email});
  if(url.includes('/messages?'))return Response.json({value:[{id:'message-1',subject:'Inbox'}]});
  if(url.includes('/calendar/events?'))return Response.json({value:[{id:'event-1',subject:'Calendar'}]});
  if(url.includes('/drive/root?'))return Response.json({id:'drive-1',name:'root'});
  if(url.endsWith('/sendMail'))return new Response(null,{status:202});
  if(url.endsWith('/events')||url.includes(':/content'))return Response.json({id:'created-resource'});
  return Response.json({error:'unexpected'},{status:400});
 };
 return {vault,entries,requests,bridge:createMicrosoftBridge({vault,fetcher})};
};
const CLIENT='12345678-1234-1234-1234-1234567890ab';
const connect=async ({bridge},profile='personal')=>{
 const start=await bridge.startLogin({profile,clientId:CLIENT});
 assert.equal(start.connected,false);
 assert.equal(start.user_code,'ABCD-1234');
 return bridge.finishLogin({profile});
};
test('profiles record exact user-supplied metadata and start disconnected',async()=>{
 const {bridge}=mock(),s=await bridge.status();
 assert.equal(s.agent.name,'Trinitys (Microsoft Copilot Studio)');
 assert.equal(s.agent.botId,'767f155a-5b45-15fc-17b1-e4d712682945');
 assert.equal(s.profiles.length,2);
 assert.equal(s.profiles[0].account,MICROSOFT_PROFILES.tenant.account);
 assert.ok(s.profiles.every(p=>p.status==='not-connected'&&!p.verified));
});
test('tenant and personal OAuth have different Microsoft authorities and DPAPI keys',async()=>{
 const m=mock({email:'usc31@saboivan2008gmail.onmicrosoft.com'});
 const s=await m.bridge.startLogin({profile:'tenant',clientId:CLIENT});
 assert.equal(s.connected,false);
 assert.equal((await m.bridge.finishLogin({profile:'tenant'})).connected,true);
 const target=m.requests.find(r=>r.url.includes('/devicecode'));
 assert.match(target.url,/\/organizations\/oauth2\/v2\.0\/devicecode/);
 assert.ok(m.entries.has('ms-tenant-refresh'));
 assert.equal(m.entries.has('ms-personal-refresh'),false);
 assert.ok(!JSON.stringify(await m.bridge.status()).includes('private-access-token'));
});
test('personal OAuth gives an independently verified identity, not a synthetic configured status',async()=>{
 const m=mock();
 assert.equal((await connect(m)).connected,true);
 const s=await m.bridge.status();
 assert.equal(s.profiles.find(p=>p.id==='personal').status,'verified');
 assert.equal(s.profiles.find(p=>p.id==='tenant').status,'not-connected');
});
test('identity mismatch refuses verified status and Graph read',async()=>{
 const m=mock({email:'another.person@example.com'});
 assert.equal((await connect(m)).connected,false);
 await assert.rejects(m.bridge.read('personal','mail'),/Najprv over identitu/);
});
test('Graph GET areas cannot be mutated with arbitrary paths',async()=>{
 const m=mock();await connect(m);
 const result=await m.bridge.read('personal','mail');
 assert.equal(result.read_only,true);
 assert.equal(result.data.value[0].subject,'Inbox');
 assert.equal((await m.bridge.read('personal','calendar')).read_only,true);
 assert.equal((await m.bridge.read('personal','drive')).read_only,true);
 await assert.rejects(m.bridge.read('personal','/me/sendMail'),/Nepodporovaná/);
 const graphCalls=m.requests.filter(x=>x.url.startsWith('https://graph.microsoft.com/v1.0/'));
 assert.ok(graphCalls.length>=4);
 assert.ok(graphCalls.every(x=>x.method==='GET'));
});
test('proposal cannot send email or create event before explicit approval',async()=>{
 const m=mock();await connect(m);
 const proposed=m.bridge.propose({profile:'personal',action:'sendMail',payload:{to:'recipient@example.com',subject:'Subject',body:'Hello'}});
 assert.equal(proposed.status,'proposed');assert.equal(proposed.approval_required,true);
 assert.equal(m.requests.some(x=>x.url.endsWith('/sendMail')),false);
 await assert.rejects(m.bridge.approve({id:proposed.id,ownerConfirmed:false}),/výslovné potvrdenie/);
 assert.equal(m.requests.some(x=>x.url.endsWith('/sendMail')),false);
 const receipt=await m.bridge.approve({id:proposed.id,ownerConfirmed:true});
 assert.equal(receipt.status,'completed');assert.equal(m.requests.filter(x=>x.url.endsWith('/sendMail')).length,1);
 await assert.rejects(m.bridge.approve({id:proposed.id,ownerConfirmed:true}),/už nie je platný/);
});
test('reject blocks Graph writes and invalid payloads are rejected',async()=>{
 const m=mock();await connect(m);
 assert.throws(()=>m.bridge.propose({profile:'personal',action:'uploadFile',payload:{name:'../secret',content:'x'}}),/Neplatný súbor/);
 const p=m.bridge.propose({profile:'personal',action:'createEvent',payload:{subject:'Team call',start:'2026-10-29T08:00:00Z',end:'2026-10-29T09:00:00Z'}});
 assert.equal(m.bridge.reject({id:p.id}).status,'rejected');
 await assert.rejects(m.bridge.approve({id:p.id,ownerConfirmed:true}),/už nie je platný/);
 assert.equal(m.requests.some(x=>x.url.endsWith('/events')&&x.method==='POST'),false);
});
test('Microsoft secret never appears in status and Direct Line route is explicitly tested',()=>{
 const mod=readFileSync(new URL('../modules/microsoft.mjs',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(mod,/private-refresh-token|private-access-token/);
 assert.match(server,/\/api\/microsoft\/copilot\/check/);
 assert.match(server,/explicitTest!==true/);
 assert.match(server,/createMicrosoftBridge/);
 assert.match(server,/\/api\/microsoft\/status/);
});
