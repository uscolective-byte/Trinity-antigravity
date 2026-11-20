import {HttpError,hash,equal} from './security.js';
import {storeSecret,verifySecret,getSecretMaterial,sealMcpOAuthState,openMcpOAuthState,replaceMcpCredential} from './secret-vault.js';

const provider='walletbot';
const issuer='https://walletbot.me/bot-relay/public-api';
const resource=issuer+'/mcp';
const scope='perps.readonly';
const credentialName='Walletbot OAuth · čítanie';
const cookieName='__Host-trinity_mcp_oauth';
const base64url=value=>Buffer.from(value).toString('base64url');
const random=()=>base64url(crypto.getRandomValues(new Uint8Array(32)));
const includes=(values,value)=>Array.isArray(values)&&values.includes(value);
export const clearMcpOAuthCookie=`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function redirectUri(request){
  const url=new URL(request.url);
  if(url.protocol!=='https:'||!['auru.dev','auru.space'].includes(url.hostname)||url.port)throw new HttpError(400,'MCP prihlásenie vyžaduje produkčnú doménu Trinity.');
  return url.origin+'/api/assistant/mcp/oauth/walletbot/callback';
}
async function readJson(response){
  if(!response.ok)throw new HttpError(502,`MCP autorizácia bola odmietnutá (HTTP ${response.status}).`);
  const reader=response.body?.getReader();if(!reader)throw new HttpError(502,'MCP autorizácia vrátila prázdnu odpoveď.');
  let size=0,text='';const decoder=new TextDecoder();
  try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>65536)throw new HttpError(502,'MCP autorizačná odpoveď prekročila limit.');text+=decoder.decode(chunk.value,{stream:true});}}
  finally{await reader.cancel().catch(()=>{});}
  try{const result=JSON.parse(text+decoder.decode());if(!result||typeof result!=='object'||Array.isArray(result))throw new Error();return result;}
  catch{throw new HttpError(502,'MCP autorizácia nevrátila platný JSON objekt.');}
}
const options=()=>({redirect:'manual',signal:AbortSignal.timeout(12000)});
async function metadata(fetcher){
  const protectedResource=await readJson(await fetcher(issuer+'/oauth/v1/protected-resource',options()));
  if(protectedResource.resource!==resource||!includes(protectedResource.authorization_servers,issuer)||!includes(protectedResource.scopes_supported,scope))throw new HttpError(502,'Walletbot nepotvrdil očakávaný zdroj a oprávnenie na čítanie.');
  const data=await readJson(await fetcher('https://walletbot.me/.well-known/oauth-authorization-server/bot-relay/public-api',options()));
  if(data.issuer!==issuer||data.authorization_endpoint!==issuer+'/oauth/v1/authorize'||data.token_endpoint!==issuer+'/oauth/v1/token'||data.registration_endpoint!==issuer+'/oauth/v1/register'||!includes(data.code_challenge_methods_supported,'S256')||!includes(data.token_endpoint_auth_methods_supported,'none'))throw new HttpError(502,'Walletbot vrátil neočakávané autorizačné nastavenie.');
  return data;
}
function tokenCredential(tokens,clientId,previousRefresh){
  if(typeof tokens.access_token!=='string'||!tokens.access_token||tokens.access_token.length>16000||!/^[\x21-\x7e]+$/.test(tokens.access_token)||String(tokens.token_type).toLowerCase()!=='bearer')throw new HttpError(502,'Walletbot nevrátil platný prístupový token.');
  const scopes=String(tokens.scope??scope).split(/\s+/).filter(Boolean);
  if(!scopes.includes(scope)||scopes.some(value=>value!==scope))throw new HttpError(502,'Walletbot nevrátil výhradne požadované oprávnenie na čítanie.');
  const ttl=tokens.expires_in===undefined?null:Number(tokens.expires_in);
  if(ttl!==null&&(!['number','string'].includes(typeof tokens.expires_in)||!Number.isSafeInteger(ttl)||ttl<=0||ttl>366*86400))throw new HttpError(502,'Walletbot vrátil neplatnú platnosť tokenu.');
  const refresh=tokens.refresh_token??previousRefresh??null;
  if(refresh!==null&&(typeof refresh!=='string'||!refresh||refresh.length>16000))throw new HttpError(502,'Walletbot vrátil neplatný obnovovací token.');
  return {url:resource,token:tokens.access_token,oauth:{provider,client_id:clientId,refresh_token:refresh,expires_at:ttl===null?null:Date.now()+ttl*1000,scope}};
}

export async function beginWalletbotOAuth(env,request,ownerId,{fetcher=fetch}={}){
  const owner=String(ownerId||'').trim().toLowerCase();if(!owner)throw new HttpError(403,'MCP prihlásenie vyžaduje overený účet Trinity.');
  const callback=redirectUri(request),data=await metadata(fetcher);
  let client=await env.DB.prepare('SELECT client_id FROM ops_mcp_oauth_clients WHERE provider=? AND redirect_uri=?').bind(provider,callback).first();
  if(!client){
    const registered=await readJson(await fetcher(data.registration_endpoint,{...options(),method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'Trinity · '+new URL(callback).hostname,redirect_uris:[callback],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'})}));
    if(typeof registered.client_id!=='string'||!registered.client_id||registered.client_id.length>1024||registered.client_secret)throw new HttpError(502,'Walletbot nepotvrdil verejného OAuth klienta.');
    await env.DB.prepare('INSERT INTO ops_mcp_oauth_clients(provider,redirect_uri,client_id) VALUES(?,?,?) ON CONFLICT(provider,redirect_uri) DO NOTHING').bind(provider,callback,registered.client_id).run();
    client=await env.DB.prepare('SELECT client_id FROM ops_mcp_oauth_clients WHERE provider=? AND redirect_uri=?').bind(provider,callback).first();
    if(!client)throw new HttpError(503,'OAuth klient nebol uložený.');
  }
  const state=random(),stateHash=await hash(state),verifier=random(),challenge=base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  const encrypted=await sealMcpOAuthState(env,owner,stateHash,{verifier,client_id:client.client_id});
  await env.DB.prepare('DELETE FROM ops_mcp_oauth_states WHERE expires_at<=?').bind(Date.now()).run();
  await env.DB.prepare('INSERT INTO ops_mcp_oauth_states(state_hash,owner_id,provider,redirect_uri,secret_ciphertext,secret_iv,expires_at) VALUES(?,?,?,?,?,?,?)').bind(stateHash,owner,provider,callback,encrypted.ciphertext,encrypted.iv,Date.now()+600000).run();
  const target=new URL(data.authorization_endpoint);
  for(const [name,value] of Object.entries({response_type:'code',client_id:client.client_id,redirect_uri:callback,scope,resource,state,code_challenge:challenge,code_challenge_method:'S256'}))target.searchParams.set(name,value);
  return new Response(null,{status:303,headers:{Location:target.toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':`${cookieName}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`}});
}

export async function finishWalletbotOAuth(env,request,ownerId,{fetcher=fetch}={}){
  const owner=String(ownerId||'').trim().toLowerCase(),url=new URL(request.url),callback=redirectUri(request);
  const state=url.searchParams.get('state'),code=url.searchParams.get('code'),cookie=request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-trinity_mcp_oauth=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
  if(!owner||!state||state.length!==43||!cookie||!await equal(state,cookie))throw new HttpError(401,'MCP prihlasovacia relácia sa nezhoduje.');
  if(url.searchParams.has('iss')&&url.searchParams.get('iss')!==issuer)throw new HttpError(401,'MCP prihlásenie má iného vydavateľa.');
  const row=await env.DB.prepare("UPDATE ops_mcp_oauth_states SET status='exchanging' WHERE state_hash=? AND owner_id=? AND provider=? AND redirect_uri=? AND status='pending' AND expires_at>? RETURNING *").bind(await hash(state),owner,provider,callback,Date.now()).first();
  if(!row)throw new HttpError(401,'MCP prihlasovacia relácia vypršala alebo už bola použitá.');
  try{
    if(url.searchParams.has('error')||!code||code.length>8192)throw new HttpError(401,'Walletbot prihlásenie nebolo potvrdené.');
    const saved=await openMcpOAuthState(env,row);
    const tokens=await readJson(await fetcher(issuer+'/oauth/v1/token',{...options(),method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:saved.client_id,redirect_uri:callback,code_verifier:saved.verifier,resource})}));
    const credential=tokenCredential(tokens,saved.client_id);
    const stored=await storeSecret(env,owner,{provider:'mcp_server',name:credentialName,secret:JSON.stringify(credential)});
    // A token response alone is not proof that MCP tools are reachable.
    const verified=await verifySecret(env,owner,stored.id);
    await env.DB.prepare("UPDATE ops_mcp_oauth_states SET status='completed',secret_ciphertext='',secret_iv='' WHERE state_hash=?").bind(row.state_hash).run();
    return {connector:verified,scope};
  }catch(error){
    await env.DB.prepare("UPDATE ops_mcp_oauth_states SET status='failed',secret_ciphertext='',secret_iv='' WHERE state_hash=?").bind(row.state_hash).run();
    throw error instanceof HttpError?error:new HttpError(502,'MCP autorizácia sa nedokončila. Prístup nebol potvrdený.');
  }
}

export async function refreshMcpOAuthCredential(env,material,{fetcher=fetch}={}){
  const current=JSON.parse(material.secret),oauth=current.oauth;
  if(current.url!==resource||oauth?.provider!==provider||oauth.scope!==scope||typeof oauth.client_id!=='string'||!oauth.refresh_token)throw new HttpError(401,'Toto MCP pripojenie vyžaduje nové prihlásenie.');
  const revision=await hash(material.secret_ciphertext+':'+material.secret_iv);
  const claim=await env.DB.prepare("INSERT INTO ops_mcp_oauth_refresh(connector_id,revision,status,started_at) VALUES(?,?,'refreshing',?) ON CONFLICT(connector_id) DO UPDATE SET revision=excluded.revision,status='refreshing',started_at=excluded.started_at WHERE ops_mcp_oauth_refresh.revision<>excluded.revision RETURNING connector_id").bind(material.id,revision,Date.now()).first();
  if(!claim){
    const latest=await getSecretMaterial(env,{ownerId:material.owner_id,id:material.id,provider:'mcp_server'});
    if(latest.secret_ciphertext!==material.secret_ciphertext)return latest;
    throw new HttpError(409,'Obnovenie tohto MCP pripojenia už prebieha alebo nemá potvrdený výsledok. Neopakuje sa automaticky.');
  }
  try{
    const tokens=await readJson(await fetcher(issuer+'/oauth/v1/token',{...options(),method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:oauth.refresh_token,client_id:oauth.client_id,resource})}));
    const credential=tokenCredential(tokens,oauth.client_id,oauth.refresh_token);
    const refreshed=await replaceMcpCredential(env,material,JSON.stringify(credential));
    await env.DB.prepare("UPDATE ops_mcp_oauth_refresh SET status='completed' WHERE connector_id=? AND revision=?").bind(material.id,revision).run();
    return refreshed;
  }catch{
    await env.DB.prepare("UPDATE ops_mcp_oauth_refresh SET status='failed' WHERE connector_id=? AND revision=?").bind(material.id,revision).run();
    await env.DB.prepare("UPDATE ops_secret_vault SET status='failed',verification_json=NULL WHERE id=? AND owner_id=? AND status!='revoked' AND secret_ciphertext=? AND secret_iv=?").bind(material.id,material.owner_id,material.secret_ciphertext,material.secret_iv).run();
    throw new HttpError(401,'Obnovenie tohto MCP pripojenia sa nepotvrdilo. Znovu prihlás iba Walletbot.');
  }
}
