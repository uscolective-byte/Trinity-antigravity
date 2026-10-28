// Trinity Tools Marketplace: discovery only. Installation and execution remain behind existing auth/permission gates.
// No third-party API tokens are stored, accepted or returned by this module.
const external = Object.freeze([
  {id:'instagram',name:'Instagram / Meta Graph API',category:'social',icon:'📸',description:'Profesionálne profily, štatistiky a publikovanie po Meta OAuth schválení.',documentation:'https://developers.facebook.com/docs/instagram-platform/',requires:'Meta App, schválené scopes a OAuth token',envKeys:['INSTAGRAM_ACCESS_TOKEN','META_ACCESS_TOKEN'],sensitivity:'write-approval'},
  {id:'openai',name:'OpenAI API / ChatGPT modely',category:'ai',icon:'◉',description:'OpenAI modely cez oficiálne API. Osobné predplatné ChatGPT nie je API kľúč.',documentation:'https://platform.openai.com/docs/overview',requires:'OPENAI_API_KEY alebo autorizované nastavenie v Trinity Vault',envKeys:['OPENAI_API_KEY'],sensitivity:'paid-api'},
  {id:'cloudflare',name:'Cloudflare Workers, D1, KV, R2',category:'cloud',icon:'☁️',description:'Cloudflare väzby a diagnostika; DNS, deploy a zmeny vyžadujú vlastné oprávnenia.',documentation:'https://developers.cloudflare.com/workers/',requires:'Worker bindings a pre správu autorizovaný Cloudflare token',envKeys:[],sensitivity:'admin'},
  {id:'vercel',name:'Vercel Deployments',category:'cloud',icon:'▲',description:'Vercel projekty, buildy a nasadenia až po bezpečnom pripojení API.',documentation:'https://vercel.com/docs/rest-api',requires:'Vercel token a oprávnenie k tímu/projektu',envKeys:['VERCEL_TOKEN','VERCEL_API_TOKEN'],sensitivity:'deploy'},
  {id:'openapi',name:'OpenAPI / HTTP API laboratórium',category:'developer',icon:'⌘',description:'Čítanie dokumentácie a bezpečné HTTP testy; žiadne neobmedzené volania súkromných URL.',documentation:'https://spec.openapis.org/oas/latest.html',requires:'Konkrétna OpenAPI špecifikácia a povolený endpoint',envKeys:[],sensitivity:'network'},
  {id:'github',name:'GitHub vývojárske nástroje',category:'developer',icon:'⌘',description:'Repozitáre, issues, PR a testy; zápis vyžaduje autorizáciu a receipt.',documentation:'https://docs.github.com/en/rest',requires:'Autorizovaný GitHub token alebo connector',envKeys:['GITHUB_TOKEN','GH_TOKEN'],sensitivity:'write-approval'},
  {id:'gemini',name:'Google Gemini API',category:'ai',icon:'✦',description:'Gemini modely cez API; samostatný Gemini chat ani Antigravity nie sú automatický API prístup.',documentation:'https://ai.google.dev/gemini-api/docs',requires:'GEMINI_API_KEY a povolený model',envKeys:['GEMINI_API_KEY'],sensitivity:'paid-api'},
  {id:'copilot',name:'Microsoft Copilot Studio',category:'ai',icon:'◈',description:'Integrácia s Copilot Studio podľa autorizácie; osobný Microsoft Copilot nie je automaticky spojený.',documentation:'https://learn.microsoft.com/en-us/microsoft-copilot-studio/',requires:'Copilot Studio agent a autorizácia kanála',envKeys:['COPILOT_STUDIO_TOKEN','COPILOT_DIRECT_LINE_SECRET'],sensitivity:'external'},
  {id:'wordpress',name:'WordPress REST API',category:'social',icon:'✎',description:'Návrhy článkov a bezpečná publikácia po pripojení vlastnej stránky.',documentation:'https://developer.wordpress.org/rest-api/',requires:'URL stránky a autorizácia WordPress',envKeys:['WORDPRESS_APPLICATION_PASSWORD'],sensitivity:'write-approval'},
  {id:'telegram',name:'Telegram Bot API',category:'social',icon:'✉',description:'Telegram príkazy cez existujúci Trinity bridge; živé doručenie sa overuje osobitne.',documentation:'https://core.telegram.org/bots/api',requires:'Telegram token, webhook secret a allowlist',envKeys:['TELEGRAM_BOT_TOKEN'],sensitivity:'external'}
]);
const localFun=Object.freeze([
  {id:'dice',name:'Kocky',description:'Bezpečný náhodný hod kockou v prehliadači.',icon:'🎲'},
  {id:'coin',name:'Minca',description:'Náhodný hod mincou v prehliadači.',icon:'🪙'},
  {id:'creative',name:'Generátor nápadov',description:'Tvorivé zadania bez externej AI služby.',icon:'🎨'},
  {id:'challenge',name:'Vývojárska výzva',description:'Malý programátorský nápad na skúšku.',icon:'🕹️'}
]);

const classify = p => {
  const id = String(p.id || '').toLowerCase();
  const tools = Array.isArray(p.tools) ? p.tools.join(' ').toLowerCase() : '';
  if(/image|music|video|creative|game|color|design|media/.test(id+' '+tools))return 'fun';
  if(/developer|code|api|git|script|json|html|test|diff|workspace|semver|csv|data|markdown/.test(id+' '+tools))return 'developer';
  if(/cloud|domain|worker|connector|network|internet|deployment/.test(id+' '+tools))return 'cloud';
  if(/ai|model|skill|brain|agent|mcp|capabilit/.test(id+' '+tools))return 'ai';
  if(/social|content|publish|marketing/.test(id+' '+tools))return 'social';
  return 'utilities';
};
const present = v => typeof v==='string' ? v.trim().length>0 : Boolean(v);

export function marketplaceSnapshot(env={},plugins=[]){
  const native=plugins.map(p=>({
    id:'plugin-'+p.id,
    plugin_id:p.id,
    name:p.name,
    description:p.description||'Dostupná funkcia v katalógu Trinity.',
    category:classify(p),
    icon:p.icon||'◇',
    kind:'native',
    installed:p.installed===true,
    enabled:p.enabled===true,
    verified:false,
    status:p.installed===true?(p.enabled===true?'registered-enabled':'registered-disabled'):'catalog-only',
    tools:Array.isArray(p.tools)?p.tools:[],
    requirements:p.dependency||'Interný modul Trinity',
    // A DB registry flag is not a real execution receipt.
    note:'Katalóg alebo registrácia nie je dôkazom, že nástroj vykonal úlohu.'
  }));
  const providers=external.map(item=>{
    const configured=item.id==='cloudflare'
      ? Boolean(env.AI||env.DB||env.ARTIFACTS||env.Mastermind)
      :item.envKeys.some(key=>present(env[key]));
    return {
      id:'connector-'+item.id,name:item.name,description:item.description,category:item.category,
      icon:item.icon,kind:'external',installed:false,enabled:false,
      configured,verified:false,status:configured?'configured-unverified':'needs-connection',
      documentation:item.documentation,requirements:item.requires,sensitivity:item.sensitivity,
      note:configured?'Konfiguračný signál z prostredia; API/OAuth sa zatiaľ živým testom neoverili.':'Vyžaduje autorizované pripojenie. Katalóg nevytvára token ani účet.'
    };
  });
  const games=localFun.map(item=>({...item,id:'play-'+item.id,category:'fun',kind:'browser',status:'available-local',installed:true,enabled:true,verified:false,requires_network:false,note:'Funguje iba lokálne v prehliadači, bez volania cudzieho API.'}));
  const items=[...providers,...games,...native];
  return {version:'1.0.0',categories:['all','ai','social','cloud','developer','fun','utilities'],
    items,counts:{total:items.length,providers:providers.length,playground:games.length,native:native.length},
    disclaimer:'Žiadny stav marketplace nepotvrdzuje externý login, úspešný deploy, publikovanie príspevku alebo vykonanie nástroja.'};
}
