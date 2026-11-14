import test from 'node:test';
import assert from 'node:assert/strict';
import {studioCapabilities,configuredStudioProviders} from '../src/studio.js';

test('studio reports configured separately from verified without exposing credentials',async()=>{
  const env={AI:{},DB:{},ARTIFACTS:{},OPENAI_KEY:'private-openai',groq:'private-groq'};
  const result=await studioCapabilities(env);
  assert.equal(result.providers.find(p=>p.id==='openai').configured,true);
  assert.equal(result.providers.find(p=>p.id==='groq').configured,true);
  assert.equal(result.providers.find(p=>p.id==='gemini').configured,false);
  assert.ok(result.providers.every(p=>p.verified===false));
  assert.ok(!JSON.stringify(result).includes('private-'));
});

test('studio resolves Secrets Store bindings and includes Groq and DeepSeek fallbacks',async()=>{
  const env={TRINITY_MASTER_OPENAI:{get:async()=>'private-openai'},DEEPSEEK_API_KEY:'private-deepseek',GROQ_API_KEY:'private-groq'};
  assert.deepEqual(await configuredStudioProviders(env,{provider:'deepseek'}),['deepseek','openai','groq']);
  assert.deepEqual(await configuredStudioProviders({}),[]);
});

test('an unreadable Secrets Store binding is not reported as configured',async()=>{
  const result=await studioCapabilities({OLLAMA_SECRET:{get:async()=>{throw new Error('unavailable');}}});
  assert.equal(result.providers.find(p=>p.id==='ollama').configured,false);
});
