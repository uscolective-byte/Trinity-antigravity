import {HttpError} from './security.js';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MAX_FILE_BYTES = 1024 * 1024;
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,160}$/.test(value);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

async function serviceToken(secret, fetcher) {
  let account;
  try { account = JSON.parse(secret); } catch { throw new HttpError(503,'Neplatná konfigurácia Google Drive.'); }
  if (account.type !== 'service_account' || !account.client_email?.endsWith('.iam.gserviceaccount.com') || typeof account.private_key !== 'string') {
    throw new HttpError(503,'Google Drive vyžaduje vyhradený servisný účet.');
  }
  const pem = /^-----BEGIN PRIVATE KEY-----\s+([A-Za-z0-9+/=\s]+)-----END PRIVATE KEY-----\s*$/.exec(account.private_key);
  if (!pem) throw new HttpError(503,'Neplatný formát poverenia Google Drive.');
  const now = Math.floor(Date.now()/1000);
  const jwt = encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:DRIVE_SCOPE,aud:TOKEN_URL,iat:now,exp:now+300});
  let signature;
  try {
    const key = await crypto.subtle.importKey('pkcs8',Buffer.from(pem[1],'base64'),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(jwt));
  } catch { throw new HttpError(503,'Poverenie Google Drive sa nepodarilo načítať.'); }
  const response = await fetcher(TOKEN_URL,{
    method:'POST',redirect:'manual',signal:AbortSignal.timeout(12_000),
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt+'.'+Buffer.from(signature).toString('base64url')})
  });
  if (!response.ok) throw new HttpError(502,`Google odmietol autorizáciu Drive (HTTP ${response.status}).`);
  const token = (await response.json()).access_token;
  if (typeof token !== 'string' || !token) throw new HttpError(502,'Google nevydal platný prístupový token.');
  return token;
}

async function readBounded(body) {
  if (!body) throw new HttpError(502,'Google Drive nevrátil obsah súboru.');
  const reader = body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) return Buffer.concat(chunks,bytes);
      bytes += value.length;
      if (bytes > MAX_FILE_BYTES) {
        await reader.cancel();
        throw new HttpError(413,'Overenie podporuje súbory do 1 MiB.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
}

export async function verifyDriveFile(env, fileId, fetcher=fetch) {
  if (!validId(fileId)) throw new HttpError(400,'Zadaj platné ID súboru Google Drive.');
  if (!validId(env.TRINITY_DRIVE_FOLDER_ID) || !env.TRINITY_DRIVE_SERVICE_ACCOUNT) {
    throw new HttpError(503,'Čítanie Google Drive ešte nemá nastavený priečinok a servisný účet.');
  }
  const token = await serviceToken(env.TRINITY_DRIVE_SERVICE_ACCOUNT,fetcher);
  const fileUrl = 'https://www.googleapis.com/drive/v3/files/'+fileId;
  const options = {headers:{Authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(15_000)};
  const metadata = await fetcher(fileUrl+'?fields=id,name,parents,mimeType,size,trashed&supportsAllDrives=true',options);
  if (!metadata.ok) throw new HttpError(metadata.status===404?404:502,`Metadáta Google Drive nie sú dostupné (HTTP ${metadata.status}).`);
  const file = await metadata.json();
  if (file.id!==fileId || file.trashed || !file.parents?.includes(env.TRINITY_DRIVE_FOLDER_ID)) {
    throw new HttpError(404,'Súbor nepatrí do povoleného priečinka.');
  }
  if (typeof file.mimeType !== 'string' || file.mimeType.startsWith('application/vnd.google-apps.')) {
    throw new HttpError(415,'Overenie podporuje nahrané súbory, napríklad JSON alebo Markdown.');
  }
  if (Number(file.size)>MAX_FILE_BYTES) throw new HttpError(413,'Overenie podporuje súbory do 1 MiB.');
  const response = await fetcher(fileUrl+'?alt=media&supportsAllDrives=true',options);
  if (!response.ok) throw new HttpError(502,`Obsah Google Drive sa nepodarilo stiahnuť (HTTP ${response.status}).`);
  const content = await readBounded(response.body);
  const digest = await crypto.subtle.digest('SHA-256',content);
  return {id:file.id,name:file.name,bytes:content.byteLength,sha256:Buffer.from(digest).toString('hex'),verified_at:new Date().toISOString()};
}
