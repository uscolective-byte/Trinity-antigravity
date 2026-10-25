import {planTask} from './planner.js';
import {getConfiguredAIProvider} from './ai-providers.js';
// Automatic PC requests stay in the cloud planner; only explicit local mode uses local inference.
export function selectChatProvider(engine,message){
  if(engine!=='auto')return engine==='cloud'?'workers-ai':engine;
  return planTask(message).intent==='conversation'?'fast':'workers-ai';
 }
// Strongest first. Only providers with a verified, enabled key (or a Worker secret) are considered.
export const BEST_PROVIDER_ORDER=['gemini','openai','anthropic','deepseek','groq','mistral','openrouter'];
const ENV_KEYS={openai:'OPENAI_API_KEY',groq:'GROQ_API_KEY',deepseek:'DEEPSEEK_API_KEY',gemini:'GEMINI_API_KEY'};
export async function pickChatProvider(env,engine,message){
  const base=selectChatProvider(engine,message);
  if(engine!=='auto')return base;
  const text=String(message||'').trim();
  if(base==='fast'&&text.length<=80)return 'fast';
  for(const provider of BEST_PROVIDER_ORDER){
    try{
      const configured=await getConfiguredAIProvider(env,provider);
      if(configured?.apiKey||configured?.secret_id)return provider;
    }catch{}
    const key=ENV_KEYS[provider];
    if(key&&typeof env[key]==='string'&&env[key].trim().length>=8)return provider;
  }
  return 'workers-ai';
 }
