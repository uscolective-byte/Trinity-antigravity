/**
 * @module TRINITY_OMNI_CORE
 * @subsystem OMNIDEV_STUDIO_ENGINE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description OmniDev Studio web project generator with integrated AST diagnostics (diagnoseOmniDevStackTrace) and R2/D1 versioning.
 */
import {diagnoseOmniDevStackTrace} from './omnidev-diagnostics.js';
import {upsertCommerceProduct, commerceAccounts} from './revolut.js';
import {z} from 'zod';
import {callModel} from './services.js';
import {HttpError} from './security.js';
import {auditHtmlQuality, recordStudioReview} from './studio-review.js';
import {resolveProviderSecret} from './secret-vault.js';

const STUDIO_PROVIDERS=['ollama','gemini','openai','anthropic','groq','deepseek'];
export async function studioCapabilities(env){
  const providers=await Promise.all(STUDIO_PROVIDERS.map(async id=>({id,configured:!!(await resolveProviderSecret(env,id)),verified:false})));
  providers.unshift({id:'workers-ai',configured:!!(env.AI||env.CHAT_INFERENCE_SERVICE),verified:false});
  return {providers,storage:{projects:!!env.DB,artifacts:!!env.ARTIFACTS},tools:['web','html-export','quality-audit','version-history','photo','music','video','presentation','creative-pack'],note:'Configuration does not confirm a successful model call. Multimedia tools may use local synthesis.'};
}

export async function configuredStudioProviders(env,options={}){
  const capabilities=await studioCapabilities(env);
  const configured=capabilities.providers.filter(item=>item.configured).map(item=>item.id);
  const plan=studioGenerationPlan(options.provider,options.quality,env);
  const candidates=options.provider&&options.provider!=='auto'?[options.provider,...plan.providers,...configured]:[...plan.providers,...configured];
  return [...new Set(candidates)].filter(id=>configured.includes(id));
}

const studioOptions={provider:z.enum(['auto','workers-ai','ollama','gemini','openai','anthropic','groq','deepseek']).default('auto'),quality:z.enum(['fast','balanced','high']).default('balanced')};
const createSchema=z.object({name:z.string().trim().min(1).max(80).optional(),prompt:z.string().trim().min(8).max(8000),...studioOptions}).strict();
const reviseSchema=z.object({prompt:z.string().trim().min(3).max(8000),...studioOptions}).strict();
const CSP='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: https:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; font-src data:; media-src data:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'">';
export function extractHtml(text){
  const raw=String(text||'').trim();
  const fenced=raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
  let html=(fenced?fenced[1]:raw).trim().replace(/^```(?:html)?\s*/i,'').replace(/\s*```$/,'');
  const start=html.search(/<!doctype html>|<html[\s>]/i);
  if(start<0)throw new Error('Generator did not return a complete HTML page.');
  html=html.slice(start);
  let end=html.toLowerCase().lastIndexOf('</html>');
  if(end>=0){
    html=html.slice(0,end+7);
  }else if(/<body[\s>]/i.test(html)&&html.length>200){
    if(!/<\/body>/i.test(html))html+='\n</body>';
    html+='\n</html>';
  }else{
    throw new Error('Generator did not return a complete HTML page.');
  }
  if(!/^\s*<!doctype html>/i.test(html))html='<!doctype html>\n'+html;
  if(Buffer.byteLength(html)>180000)throw new Error('Generated page is too large.');
  if(!/<head[\s>]/i.test(html))html=html.replace(/<html([^>]*)>/i,'<html$1><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>');
  if(!/content-security-policy/i.test(html))html=html.replace(/<head([^>]*)>/i,'<head$1>'+CSP);
  return html;
}
function nameFromPrompt(prompt){return prompt.replace(/^(vytvor|sprav|create|build)\s+(mi\s+)?/i,'').split(/[.!?\n]/)[0].trim().slice(0,60)||'New Web Project';}
export function studioGenerationPlan(provider='auto',quality='balanced',env={}){
  // Note: fast.directive matches existing unit.test.mjs contract.
  const qualityPlans={fast:{maxTokens:3600,directive:'Uprednostni čistú menšiu stránku a rýchle vytvorenie.'},balanced:{maxTokens:6000,directive:'Balance visual quality, functionality, and code size.'},high:{maxTokens:8000,directive:'Pay extra attention to detail, component states, accessibility, and responsiveness.'}};
  const selected=qualityPlans[quality]||qualityPlans.balanced,automatic=env.OLLAMA_SECRET?['ollama','workers-ai']:['workers-ai'];
  const providers=provider==='auto'?automatic:[provider,'workers-ai',...automatic];
  return {...selected,providers:[...new Set(providers)]};
}
async function generate(env,prompt,current='',options={}){
  const plan=studioGenerationPlan(options.provider,options.quality,env);
  const uniqueProviders=await configuredStudioProviders(env,options);
  const system=`You are Trinity Web Studio. Return only one complete <!doctype html>...</html> document, with no markdown fences and no explanation. Create a professional responsive website with accessible typography and a strong visual direction. CSS and optional JavaScript must be inline. Do not use external libraries, iframes, data-submitting forms, fetch, external scripts, or secrets. COMMUNICATION LANGUAGE RULE: Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal 'tykanie' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language. ${plan.directive}`;
  const user=current?('Update this existing website according to the instruction. Preserve working sections.\nINSTRUCTION: '+prompt+'\nCURRENT HTML:\n'+current.slice(0,90000)):prompt;
  const messages=[{role:'system',content:system},{role:'user',content:user}];
  let lastError;
  for(const provider of uniqueProviders){
    if(provider==='workers-ai'&&!env.AI&&!env.CHAT_INFERENCE_SERVICE)continue;
    try{const response=await callModel(env,provider,messages,plan.maxTokens,null,{directAI:true});return {html:extractHtml(response.text),model:response.model,provider:response.provider||provider,quality:options.quality||'balanced'};}
    catch(error){lastError=error;}
  }
  const diag=diagnoseOmniDevStackTrace(String(lastError?.message||lastError||'Studio generation failed'),{filePath:'Trinity/src/studio.js'});
  throw new HttpError(502,`Trinity could not generate a valid preview (${diag.category}). Please refine the prompt.`);
}
const rowOut=row=>({...row,version:Number(row.version)});
export async function listStudioProjects(env,owner){return (await env.DB.prepare('SELECT id,name,status,version,substr(prompt,1,300) AS prompt,created_at,updated_at FROM ops_studio_projects WHERE owner_id=? ORDER BY updated_at DESC LIMIT 40').bind(owner).all()).results.map(rowOut);}
export async function getStudioProject(env,owner,id){
  const row=await env.DB.prepare('SELECT * FROM ops_studio_projects WHERE id=? AND owner_id=?').bind(id,owner).first();if(!row)throw new HttpError(404,'Studio project not found.');
  const object=await env.ARTIFACTS.get(row.html_key);if(!object)throw new HttpError(404,'Project preview is missing.');
  const versions=(await env.DB.prepare('SELECT version,prompt,model,created_at FROM ops_studio_versions WHERE project_id=? ORDER BY version DESC LIMIT 20').bind(id).all()).results;
  const html=await object.text();
  const latest_review=auditHtmlQuality(html);
  return {...rowOut(row),html,versions,latest_review};
}
export async function createStudioProject(env,owner,input){
  const data=createSchema.parse(input),id=crypto.randomUUID(),built=await generate(env,data.prompt,'',data),name=data.name||nameFromPrompt(data.prompt),key='studio/'+id+'/v1.html';
  await env.ARTIFACTS.put(key,built.html,{httpMetadata:{contentType:'text/html; charset=utf-8'}});
  await env.DB.batch([
    env.DB.prepare("INSERT INTO ops_studio_projects(id,owner_id,name,prompt,status,version,html_key) VALUES(?,?,?,?, 'ready',1,?)").bind(id,owner,name,data.prompt,key),
    env.DB.prepare('INSERT INTO ops_studio_versions(project_id,version,prompt,html_key,model) VALUES(?,?,?,?,?)').bind(id,1,data.prompt,key,built.model),
    env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('studio_created',?)").bind(JSON.stringify({id,name,model:built.model,provider:built.provider,quality:built.quality}))
  ]);
  const review = auditHtmlQuality(built.html);
  await recordStudioReview(env, id, 1, review).catch(()=>{});
  return getStudioProject(env,owner,id);
}
export async function reviseStudioProject(env,owner,id,input){
  const data=reviseSchema.parse(input),current=await getStudioProject(env,owner,id),built=await generate(env,data.prompt,current.html,data),version=current.version+1,key='studio/'+id+'/v'+version+'.html';
  await env.ARTIFACTS.put(key,built.html,{httpMetadata:{contentType:'text/html; charset=utf-8'}});
  await env.DB.batch([
    env.DB.prepare("UPDATE ops_studio_projects SET prompt=?,version=?,html_key=?,status='ready',updated_at=datetime('now') WHERE id=? AND owner_id=?").bind(data.prompt,version,key,id,owner),
    env.DB.prepare('INSERT INTO ops_studio_versions(project_id,version,prompt,html_key,model) VALUES(?,?,?,?,?)').bind(id,version,data.prompt,key,built.model),
    env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('studio_revised',?)").bind(JSON.stringify({id,version,model:built.model,provider:built.provider,quality:built.quality}))
  ]);
  const review = auditHtmlQuality(built.html);
  await recordStudioReview(env, id, version, review).catch(()=>{});
  return getStudioProject(env,owner,id);
}


export async function createStudioCheckoutOffer(env, owner, projectId, options = {}) {
  const project = await getStudioProject(env, owner, projectId);
  const accounts = await commerceAccounts(env);
  const priceEur = Number(options.priceEur || 150);
  const cents = Math.round(priceEur * 100);
  const offerId = 'web-' + projectId.slice(0, 8);
  const offerTitle = options.title || ('Web Development: ' + project.name);
  const provider = options.provider === 'paypal' ? 'paypal' : 'revolut-pro';
  
  await upsertCommerceProduct(env, owner, {
    provider,
    product: {
      id: offerId,
      name: offerTitle,
      description: 'Delivery and deployment of web project "' + project.name + '" (version ' + project.version + ') by Trinity AI Studio.',
      amount_cents: cents,
      currency: 'EUR',
      payment_url: provider === 'paypal' ? accounts.paypal_url : accounts.revolut_url
    }
  });

  return {
    project_id: projectId,
    project_name: project.name,
    offer_id: offerId,
    price_eur: priceEur,
    provider,
    checkout_url: '/pay/' + (provider === 'paypal' ? 'paypal' : 'revolut-pro') + '/' + offerId,
    revolut_direct_url: accounts.revolut_url,
    status: 'offer_created'
  };
}
