'use strict';
(function(){
 const get=id=>document.getElementById(id);
 const profile=()=>get('ms-profile').value;
 const token=()=>sessionStorage.getItem('trinity-token')||'';
 const h={};
 const el=(tag,text)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=String(text);return item};
 async function request(path,body){
   const response=await fetch('/api/microsoft/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token(),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin'});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Microsoft operácia zlyhala.');
   return data;
 }
 const info=(message)=>{get('ms-read-result').textContent=typeof message==='string'?message:JSON.stringify(message,null,2)};
 async function reload(){
   const state=await request('status');
   const box=get('microsoft-profiles');
   box.replaceChildren();
   for(const p of state.profiles){
     const item=el('div');
     item.className='integration';
     item.append(el('span',p.name+' · '+p.account),el('b',p.verified?'✓ Overené Microsoft Graph':p.configured?'○ Konfigurácia uložená; živé spojenie neoverené':'○ Nepripojené'));
     box.append(item);
   }
   const c=el('div');
   c.className='integration';
   c.append(el('span','Trinitys · Microsoft Copilot Studio'),el('b',state.copilot.verified?'✓ Direct Line odpovedal':state.copilot.configured?'○ Secret uložený; Direct Line neoverené':'○ Direct Line nenastavené'));
   box.append(c);
 }
 async function reloadProposals(){
   const x=await request('proposals');
   const box=get('ms-approval-cards');
   box.replaceChildren();
   if(!x.items.length){box.append(el('p','Žiadne čakajúce Microsoft akcie.'));return;}
   for(const p of x.items){
     const card=el('article');card.className='note-card';
     card.append(el('p',p.action+' · '+p.profile+' · stav: '+p.status));
     const approve=el('button','⚡ Schváliť a vykonať');
     approve.type='button';
     approve.addEventListener('click',async()=>{
       approve.disabled=true;
       try{
         // This call is the explicit owner action after the proposal was created.
         const receipt=await request('actions/approve',{id:p.id,ownerConfirmed:true});
         info(receipt);await Promise.all([reload(),reloadProposals()]);
       }catch(e){info(e.message);approve.disabled=false}
     });
     const reject=el('button','Odmietnuť');
     reject.type='button';
     reject.addEventListener('click',async()=>{
       reject.disabled=true;
       try{info(await request('actions/reject',{id:p.id}));await reloadProposals()}catch(e){info(e.message);reject.disabled=false}
     });
     card.append(approve,reject);box.append(card);
   }
 }
 function safe(fn){return async event=>{try{await fn(event)}catch(e){info(e.message)}}}
 document.addEventListener('DOMContentLoaded',()=>{
   if(!get('microsoft-trinitys-panel'))return;
   get('ms-login-form').addEventListener('submit',safe(async e=>{
     e.preventDefault();
     const x=await request('login/start',{profile:profile(),clientId:get('ms-client-id').value.trim(),allowWrites:get('ms-write-scope').checked});
     // Code is short-lived, never persisted or logged. Open URL manually.
     get('ms-login-instructions').textContent='Otvoriť '+x.verification_uri+' a zadať kód '+x.user_code+'. Po potvrdení v Microsoft účte klikni na „Dokončiť prihlásenie“.';
   }));
   get('ms-login-finish').addEventListener('click',safe(async()=>{
     const x=await request('login/finish',{profile:profile()});info(x);await reload();
   }));
   get('ms-verify').addEventListener('click',safe(async()=>{
     const x=await request('verify',{profile:profile()});info(x);await reload();
   }));
   get('ms-copilot-check').addEventListener('click',safe(async()=>{
     const x=await request('copilot/check',{explicitTest:true});info(x);await reload();
   }));
   for(const button of document.querySelectorAll('[data-ms-read]')){
     button.addEventListener('click',safe(async()=>{info(await request('read',{profile:profile(),area:button.dataset.msRead}))}));
   }
   get('ms-action-form').addEventListener('submit',safe(async e=>{
     e.preventDefault();
     const action=get('ms-action').value,payload={};
     if(action==='sendMail'){payload.to=get('ms-to').value.trim();payload.subject=get('ms-subject').value;payload.body=get('ms-body').value}
     if(action==='createEvent'){payload.subject=get('ms-subject').value;payload.start=get('ms-start').value;payload.end=get('ms-end').value}
     if(action==='uploadFile'){payload.name=get('ms-filename').value;payload.content=get('ms-body').value}
     const proposal=await request('actions/propose',{profile:profile(),action,payload});
     info({status:proposal.status,preview:proposal.preview,approval_required:proposal.approval_required});
     await reloadProposals();
   }));
   reload().catch(e=>info(e.message));
   reloadProposals().catch(e=>info(e.message));
 });
})();
