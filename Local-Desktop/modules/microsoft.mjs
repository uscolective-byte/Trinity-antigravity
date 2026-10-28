import {randomUUID} from 'node:crypto';

const TENANT='tenant',PERSONAL='personal';
export const TRINITYS_META=Object.freeze({
 name:'Trinitys (Microsoft Copilot Studio)', environmentId:'b2ffa450-7427-e2dd-89dd-7df6a8c0a149',
 botId:'767f155a-5b45-15fc-17b1-e4d712682945',
 blueprintId:'25664c89-cea5-4ab6-b924-a54fd8a19ae0',
 servicePrincipalObjectId:'d77169b1-e300-42da-88c3-e8df11b82604'
});
export const MICROSOFT_PROFILES=Object.freeze({
 [TENANT]:{id:TENANT,name:'Organizácia / Entra ID',account:'usc31@saboivan2008gmail.onmicrosoft.com',authority:'organizations'},
 [PERSONAL]:{id:PERSONAL,name:'Osobný Microsoft účet',account:'saboivan2008@gmail.com',authority:'consumers'}
});
const permissions='offline_access openid profile User.Read Mail.Read Calendars.Read Files.Read';
const writePermissions='offline_access openid profile User.Read Mail.Read Mail.Send Calendars.ReadWrite Files.ReadWrite';
const GRAPH='https://graph.microsoft.com/v1.0';
const LOGIN='https://login.microsoftonline.com';
const KEY_ID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const getProfile=id=>{const p=MICROSOFT_PROFILES[id];if(!p)throw new Error('Neplatný Microsoft profil.');return p;};
const vaultKey=(profile,name)=>'ms-'+profile+'-'+name;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
async function parseResponse(response){
 const raw=await response.text();
 if(raw.length>400_000)throw fail('Odpoveď Microsoftu je príliš veľká.',502);
 let data;
 try{data=JSON.parse(raw);}catch{throw fail('Microsoft nevrátil platný JSON.',502);}
 if(!response.ok){
   // OAuth and Graph errors may include PII and tokens; never echo raw details.
   if(response.status===401||response.status===403)throw fail('Microsoft odmietol prístup; treba znovu autorizovať účet alebo rozsahy.',502);
   if(data.error==='authorization_pending'||data.error==='slow_down')return {pending:true};
   if(data.error==='authorization_declined'||data.error==='expired_token')throw fail('Microsoft prihlásenie bolo zamietnuté alebo vypršalo.',409);
   throw fail('Microsoft API požiadavka zlyhala (HTTP '+response.status+').',502);
 }
 return data;
}
function fields(data){
 return [data.mail,data.userPrincipalName,data.otherMails?.[0]].filter(Boolean).map(x=>String(x).toLowerCase());
}
function validatePayload(action,p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw fail('Neplatný obsah akcie.');
 if(action==='sendMail'){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.to||'')||typeof p.subject!=='string'||p.subject.length>250||typeof p.body!=='string'||p.body.length>12000)throw fail('Neplatná správa.');
  return {to:p.to.trim(),subject:p.subject,body:p.body};
 }
 if(action==='createEvent'){
  if(typeof p.subject!=='string'||!p.subject.trim()||p.subject.length>220||!Number.isFinite(Date.parse(p.start))||!Number.isFinite(Date.parse(p.end))||Date.parse(p.start)>=Date.parse(p.end))throw fail('Neplatná kalendárna udalosť.');
  return {subject:p.subject,start:new Date(p.start).toISOString(),end:new Date(p.end).toISOString()};
 }
 if(action==='uploadFile'){
  if(typeof p.name!=='string'||!/^[a-zA-Z0-9_. -]{1,120}$/.test(p.name)||p.name==='.'||p.name==='..'||typeof p.content!=='string'||p.content.length>250_000)throw fail('Neplatný súbor.');
  return {name:p.name,content:p.content};
 }
 throw fail('Nepodporovaná Microsoft akcia.');
}
export function createMicrosoftBridge({vault,fetcher=fetch,clock=()=>Date.now()}={}){
 if(!vault?.get||!vault?.set)throw new Error('Microsoft vyžaduje ochranný DPAPI vault.');
 const pendingLogin=new Map(),proposals=new Map(),receipts=new Map(),verified=new Map();
 const account=id=>getProfile(id);
 const api=async(url,init)=>parseResponse(await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000),...init}));
 async function tokenFor(profile){
   account(profile);
   let access=await vault.get(vaultKey(profile,'access'));
   const expiry=Number(await vault.get(vaultKey(profile,'expires')));
   if(access&&expiry>clock()+60000)return access;
   const refresh=await vault.get(vaultKey(profile,'refresh'));
   const clientId=await vault.get(vaultKey(profile,'client'));
   if(!refresh||!KEY_ID_RE.test(clientId))throw fail('Microsoft profil nie je autorizovaný.',409);
   const form=new URLSearchParams({grant_type:'refresh_token',client_id:clientId,refresh_token:refresh,scope:permissions});
   const data=await api(LOGIN+'/'+account(profile).authority+'/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});
   if(!data.access_token)throw fail('Microsoft nevrátil access token.',502);
   access=data.access_token;
   await vault.set(vaultKey(profile,'access'),access);
   if(data.refresh_token)await vault.set(vaultKey(profile,'refresh'),data.refresh_token);
   await vault.set(vaultKey(profile,'expires'),String(clock()+Math.min(Number(data.expires_in)||3600,3600)*1000));
   return access;
 }
 async function graph(profile,path,method='GET',body=null){
  if(!/^\/(?:me|me\/messages|me\/calendar\/events|me\/drive\/root|me\/sendMail|me\/events|me\/drive\/root:\/[^/?]+:\/content)(?:\?.*)?$/.test(path))throw fail('Graph cesta nie je povolená.');
  const token=await tokenFor(profile);
  const res=await fetcher(GRAPH+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body?{'Content-Type':typeof body==='string'?'text/plain; charset=utf-8':'application/json'}:{})},body:body?(typeof body==='string'?body:JSON.stringify(body)):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(res.status===204||res.status===202)return {accepted:true,status:res.status};
  return parseResponse(res);
 }
 return {
  async status(){
   const profiles=[];
   for(const p of Object.values(MICROSOFT_PROFILES)){
    const token=await vault.get(vaultKey(p.id,'refresh'));
    const appId=await vault.get(vaultKey(p.id,'client'));
    const confirmation=verified.get(p.id);
    profiles.push({id:p.id,name:p.name,account:p.account,configured:!!token&&KEY_ID_RE.test(appId),verified:!!confirmation?.ok,status:confirmation?.ok?'verified':token?'configured-unverified':'not-connected',checked_at:confirmation?.checked_at||null});
   }
   return {agent:TRINITYS_META,profiles,approvals_required:true,pending:proposals.size,verified_connection:profiles.some(p=>p.verified)};
  },
  async startLogin({profile,clientId,allowWrites=false}){
    const p=account(profile);
    if(!KEY_ID_RE.test(clientId||''))throw fail('Chýba skutočný Entra App Registration client ID (nie Bot ID ani Object ID).');
    if(typeof allowWrites!=='boolean')throw fail('Neplatná voľba rozsahov.');
    const scope=allowWrites?writePermissions:permissions;
    const data=await api(LOGIN+'/'+p.authority+'/oauth2/v2.0/devicecode',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,scope})});
    if(!data.device_code||!data.user_code||!data.verification_uri)throw fail('Microsoft device-code odpoveď je neúplná.',502);
    pendingLogin.set(profile,{device:data.device_code,clientId,scope,expires:clock()+Math.min(Number(data.expires_in)||900,900)*1000});
    return {profile,user_code:data.user_code,verification_uri:data.verification_uri,expires_in:data.expires_in||900,approval_required:true,scope,connected:false};
  },
  async finishLogin({profile}){
    const p=account(profile),pending=pendingLogin.get(profile);
    if(!pending||clock()>pending.expires)throw fail('Microsoft prihlasovacia relácia vypršala.',409);
    const result=await api(LOGIN+'/'+p.authority+'/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:device_code',client_id:pending.clientId,device_code:pending.device})});
    if(result.pending)return {status:'pending',connected:false};
    if(!result.access_token||!result.refresh_token)throw fail('Chýba Microsoft access/refresh token.',502);
    await vault.set(vaultKey(profile,'access'),result.access_token);
    await vault.set(vaultKey(profile,'refresh'),result.refresh_token);
    await vault.set(vaultKey(profile,'client'),pending.clientId);
    await vault.set(vaultKey(profile,'expires'),String(clock()+Math.min(Number(result.expires_in)||3600,3600)*1000));
    pendingLogin.delete(profile);
    const verification=await this.verify(profile);
    return {status:verification.verified?'verified':'identity-mismatch',connected:verification.verified,profile};
  },
  async verify(profile){
    const p=account(profile);
    try{
      const me=await graph(profile,'/me?$select=id,displayName,mail,userPrincipalName');
      const identityMatched=fields(me).includes(p.account.toLowerCase());
      const result={profile,verified:identityMatched,checked_at:new Date(clock()).toISOString(),identity_matched:identityMatched};
      verified.set(profile,{ok:identityMatched,checked_at:result.checked_at});
      return result;
    }catch{verified.delete(profile);return {profile,verified:false,identity_matched:false,error:'Microsoft Graph nie je dostupný alebo chýba autorizácia.'};}
  },
  async read(profile,area){
    account(profile);
    const routes={mail:'/me/messages?$top=10&$select=id,subject,from,receivedDateTime',calendar:'/me/calendar/events?$top=10&$select=id,subject,start,end',drive:'/me/drive/root?$select=id,name,webUrl'};
    if(!routes[area])throw fail('Nepodporovaná Graph read operácia.');
    if(!verified.get(profile)?.ok)throw fail('Najprv over identitu Microsoft účtu.',409);
    return {profile,area,data:await graph(profile,routes[area]),read_only:true};
  },
  propose({profile,action,payload}){
    account(profile);
    const data=validatePayload(action,payload);
    const id=randomUUID();
    const row={id,profile,action,status:'proposed',payload:data,created_at:clock(),expires_at:clock()+600_000};
    proposals.set(id,row);
    return {id,profile,action,status:'proposed',preview:action==='sendMail'?{to:data.to,subject:data.subject}:action==='createEvent'?{subject:data.subject,start:data.start,end:data.end}:{name:data.name,size:data.content.length},expires_at:row.expires_at,approval_required:true};
  },
  listProposals(){
    for(const [id,row] of proposals)if(row.expires_at<clock())proposals.delete(id);
    return [...proposals.values()].map(r=>({id:r.id,profile:r.profile,action:r.action,status:r.status,created_at:r.created_at,expires_at:r.expires_at}));
  },
  reject({id}){
    const row=proposals.get(id);
    if(!row||row.status!=='proposed')throw fail('Microsoft akcia už nie je návrh.',409);
    proposals.delete(id);receipts.set(id,{id,status:'rejected',completed_at:clock()});return {id,status:'rejected'};
  },
  async approve({id,ownerConfirmed}){
    if(ownerConfirmed!==true)throw fail('Vyžaduje sa výslovné potvrdenie majiteľa.',403);
    const row=proposals.get(id);
    if(!row||row.status!=='proposed'||row.expires_at<clock())throw fail('Microsoft akcia už nie je platný návrh.',409);
    if(!verified.get(row.profile)?.ok)throw fail('Najprv over identitu Microsoft účtu.',409);
    // Consume BEFORE remote call to prevent duplicate email/meeting/upload on retries.
    row.status='executing';proposals.delete(id);
    const p=row.payload;
    try{
      let result;
      if(row.action==='sendMail')result=await graph(row.profile,'/me/sendMail','POST',{message:{subject:p.subject,body:{contentType:'Text',content:p.body},toRecipients:[{emailAddress:{address:p.to}}]},saveToSentItems:true});
      else if(row.action==='createEvent')result=await graph(row.profile,'/me/events','POST',{subject:p.subject,start:{dateTime:p.start,timeZone:'UTC'},end:{dateTime:p.end,timeZone:'UTC'}});
      else result=await graph(row.profile,'/me/drive/root:/'+encodeURIComponent(p.name)+':/content','PUT',p.content);
      const receipt={id,profile:row.profile,action:row.action,status:'completed',approved_by:'local-owner-session',completed_at:clock(),remote_id:result?.id||null};
      receipts.set(id,receipt);return receipt;
    }catch{
      const receipt={id,profile:row.profile,action:row.action,status:'failed',approved_by:'local-owner-session',completed_at:clock(),error:'Microsoft Graph odmietol akciu alebo neudelil potrebné oprávnenie. Automatické opakovanie je zablokované.'};
      receipts.set(id,receipt);return receipt;
    }
  },
  receipt(id){return receipts.get(id)||null;}
 };
}
