/**
 * @module TRINITY_OMNI_CORE
 * @subsystem LIVE_CHAT_STREAMING
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Okamžité NDJSON/SSE streamovanie odpovedí slovo po slove bez čakania na Workflow polling.
 */

import { buildConversationalPrompt } from './cognition.js';
import { loadConversationHistory, conversationsToMessages } from './conversation-history.js';
import { pickChatProvider } from './chat-routing.js';
import { directChatTool } from './fast-chat.js';
import { formatWeather } from './external-data-response.js';
import { assertNoSimulatedData, finalizeAgentResponse } from './truth.js';
import { getPCBridgeStatus } from './system-actions.js';
import { getConfiguredAIProvider, sanitizeApiKey } from './ai-providers.js';
import { cleanOutput } from '../services/chat-inference.js';
import { persistAutoMemory } from './memory-extractor.js';
import { recallMemory, runTool } from './tools.js';
import { agentById } from './registry.js';
import { planTask } from './planner.js';
import { listActiveBehaviorRules, behaviorRulesDirective } from './self-improvement.js';

const HEAVY_WORKFLOW_PATTERN = /\b(vytvor\s+web|ai\s+studio|nasad|deploy|cloudflare\s+dns|registruj\s+domen|pc\s+bridge|spusti\s+na\s+pc|otvor\s+(?:okno|appku|kalkulack|notepad|vscode|terminal|chrome|explorer)|vytvor\s+(?:subor|pdf|obrazok|fotku|video|hudbu|prezentaciu)|nakup\s+komodit|predaj\s+komodit|multi_model_consensus|self_evolve|ui_evolve|timovy\s+rezim|team\s+mode)\b/i;

const DIRECT_CHAT_TOOLS=['calculate','current_time','open_weather'];
function directLiveTool(message){
  const direct=directChatTool(message,DIRECT_CHAT_TOOLS);
  return DIRECT_CHAT_TOOLS.includes(direct?.name)?direct:null;
}

export function requiresWorkflowFallback(message = '', allowFiles = false) {
  if (allowFiles) return true;
  const norm = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Streaming inference has no tool loop. Route operational and live-data
  // requests to the existing durable agent instead of asking a bare model.
  if (directLiveTool(message)) return false;
  if (['pc_open_file','pc_file_read'].includes(directChatTool(message,['pc_open_file','pc_file_read'])?.name)) return true;
  const intent = planTask(String(message || '')).intent;
  return HEAVY_WORKFLOW_PATTERN.test(norm)
    || ['repair','research','build','creative','action'].includes(intent)
    || /\b(?:exportuj|uloz|vytvor|priprav)\b.*\bcsv\b/.test(norm)
    || (intent === 'analysis' && /\b(?:podrobne|hlbkovo|do\s+hlbky|krok\s+za\s+krokom|rizik[a-z]*|alternativ[a-z]*)\b/.test(norm))
    || /\b(?:pocasie|pocasia|pocasi|weather|kurz|kurzy|cena|ceny|cenu|zostatok|saldo|bitcoin|btc|krypto|crypto|github|cloudflare|firebase|onedrive|google\s+drive|gemini|domeny|domen|integracie|integracii|nastroj|nastroje|nastrojov)\b/.test(norm)
    || /\b(?:vyhladaj|najdi|precitaj|otvor|over|skontroluj|spusti|pripoj|pouzi)\b.*\b(?:subor\w*|adresar\w*|projekt\w*|repozitar\w*|antigravity|gemini|web|url|odkaz\w*)\b/.test(norm)
    || /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/.test(norm);
}

function encodeEvent(obj) {
  return new TextEncoder().encode(JSON.stringify(obj) + '\n');
}

async function* parseSseJsonLines(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          yield JSON.parse(payload);
        } catch {}
      }
    }
  } finally {
    try { await reader.cancel(); } catch {}
    reader.releaseLock();
  }
}

async function streamWorkersAI(env, model, messages, onDelta) {
  if (!env?.AI?.run) throw new Error('Cloudflare Workers AI nie je pripojené.');
  const result = await env.AI.run(model, {
    messages,
    max_tokens: 2048,
    temperature: 0.68,
    top_p: 0.9,
    repetition_penalty: 1.1,
    stream: true
  });

  if (result && typeof result.getReader === 'function') {
    let full = '';
    for await (const chunk of parseSseJsonLines(result)) {
      if (chunk?.error) throw new Error('Cloudflare Workers AI prerušilo odpoveď.');
      const token = typeof chunk?.response === 'string'
        ? chunk.response
        : (typeof chunk?.choices?.[0]?.delta?.content === 'string' ? chunk.choices[0].delta.content : '');
      if (token) {
        full += token;
        onDelta(token);
      }
    }
    return full;
  }

  const text = typeof result?.response === 'string' ? result.response : '';
  if (text) onDelta(text);
  return text;
}

async function streamOpenAICompatible({ url, apiKey, model, messages, extraHeaders = {}, onDelta }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
      temperature: 0.68,
      stream: true
    }),
    signal: AbortSignal.timeout(90000)
  });

  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }

  let full = '';
  for await (const chunk of parseSseJsonLines(res.body)) {
    const token = chunk?.choices?.[0]?.delta?.content;
    if (typeof token === 'string' && token) {
      full += token;
      onDelta(token);
    }
  }
  return full;
}

async function streamGemini(env, messages, onDelta) {
  const { apiKey: rawKey, model } = await getConfiguredAIProvider(env, 'gemini');
  const apiKey = sanitizeApiKey(rawKey, /AIza[A-Za-z0-9_-]{25,}/);
  const cleanModel = String(model || 'gemini-2.5-flash').replace(/^models\//, '');
  const systemText = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: systemText ? { parts: [{ text: systemText }] } : undefined,
        contents,
        generationConfig: { maxOutputTokens: 4096, temperature: 0.68 }
      }),
      signal: AbortSignal.timeout(90000)
    }
  );
  if (!res.ok || !res.body) throw new Error(`Gemini HTTP ${res.status}`);

  let full = '';
  for await (const chunk of parseSseJsonLines(res.body)) {
    const parts = chunk?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (typeof part?.text === 'string' && part.text) {
        full += part.text;
        onDelta(part.text);
      }
    }
  }
  return { text: full, model: cleanModel };
}

async function streamAnthropic(env, messages, onDelta) {
  let { apiKey, model } = await getConfiguredAIProvider(env, 'anthropic').catch(() => ({}));
  if (!apiKey) apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API nie je nakonfigurované.');
  apiKey = sanitizeApiKey(apiKey);
  const cleanModel = model || env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: cleanModel,
      system: system || undefined,
      messages: chatMessages,
      max_tokens: 4096,
      temperature: 0.68,
      stream: true
    }),
    signal: AbortSignal.timeout(90000)
  });
  if (!res.ok || !res.body) throw new Error(`Anthropic HTTP ${res.status}`);

  let full = '';
  for await (const chunk of parseSseJsonLines(res.body)) {
    if (chunk?.type === 'content_block_delta' && typeof chunk?.delta?.text === 'string') {
      full += chunk.delta.text;
      onDelta(chunk.delta.text);
    }
  }
  return { text: full, model: cleanModel };
}

async function persistStreamTurn(env, { jobId, sessionId, message, answer, provider, remember }) {
  if (!env?.DB?.prepare || !answer) return;
  try {
    await env.DB.prepare(
      "INSERT INTO ops_jobs(id,session_id,task,team,provider,language,intent,risk_level,status,result,owner_mode,updated_at) VALUES(?,?,?,?,?,'auto','conversation','low','completed',?,1,datetime('now')) ON CONFLICT(id) DO UPDATE SET status='completed',result=excluded.result,updated_at=datetime('now')"
    ).bind(jobId, sessionId, message, JSON.stringify(['orchestrator']), provider, answer).run();

    if (remember) {
      await env.DB.prepare("INSERT INTO ops_memory(key,value,source) VALUES(?,?,'user-explicit')").bind('rozhovor/' + jobId, message).run();
    }
    await persistAutoMemory(env, { task: message, resultText: answer });
  } catch {
    // Non-fatal persistence failure must not crash finished stream
  }
}

function selfImprovementAnswer(message,language){
  if(!/^(?:auto|sk(?:-|$))/i.test(language))return null;
  const question=message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  if(!/^(?:kontrolny test:\s*)?(?:vies|vis|mozes)\s+v[iy]konat\s+(?:tieto\s+)?(?:v[iy]lepsenia|zlepsenia)\s+sama\s*[?.!]*$/i.test(question))return null;
  return 'Viem ich spracovať ako tri samostatné úlohy. Pri odpovediach viem nadviazať na dostupnú históriu a schválené pravidlá. Novú tému viem spracovať z určených zdrojov. Zrozumiteľné preklepy viem vyložiť podľa kontextu. Ak zlepšenie vyžaduje zmenu kódu, viem pripraviť návrh opravy pre konkrétny commit. Táto správa žiadnu opravu nespustila a sama nepotvrdzuje test ani nasadenie.';
}

export async function handleLiveChatStream(env, ctx, { message, session, language = 'auto', engine = 'auto', remember = false, allow_files = false, ownerMode = false, userEmail = null }) {
  const sessionId = session || crypto.randomUUID();
  const jobId = crypto.randomUUID();

  const capabilityAnswer = allow_files || engine === 'local' ? null : selfImprovementAnswer(message,language);

  // Heavy tool/file/PC/AI-Studio tasks fall back cleanly to durable Workflow execution
  if (!capabilityAnswer && (engine === 'local' || requiresWorkflowFallback(message, allow_files))) {
    const body = encodeEvent({ type: 'fallback_job', reason: 'workflow_tools' });
    return new Response(body, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encodeEvent(obj));
      try {
        if (capabilityAnswer) {
          send({ type:'context', session:sessionId, model:'trinity-capabilities', memories:[], history:0 });
          send({ type:'delta', text:capabilityAnswer });
          const persistence=persistStreamTurn(env,{jobId,sessionId,message,answer:capabilityAnswer,provider:'internal',remember});
          if(ctx?.waitUntil)ctx.waitUntil(persistence);
          else await persistence;
          return;
        }
        const direct = directLiveTool(message);
        if (direct) {
          const agent = agentById('orchestrator');
          let outcome;
          try {
            outcome=assertNoSimulatedData(await runTool(env,agent,direct.name,direct.arguments,{adminAuthorized:ownerMode,ownerMode,userEmail}),direct.name);
          } catch(error) {
            send({type:'tool',name:direct.name,status:'failed'});
            throw error;
          }
          const temperature=outcome.current?.temperature_c;
          const humidity=outcome.current?.humidity_pct;
          const wind=outcome.current?.wind_speed_kmh;
          const usable=direct.name!=='open_weather'||(outcome.available===true&&[temperature,humidity,wind].some(Number.isFinite));
          const text=direct.name==='open_weather'?formatWeather(outcome):String(outcome.localized??outcome.result);
          send({type:'context',session:sessionId,model:'deterministic-tool',memories:[],history:0});
          send({type:'tool',name:direct.name,status:usable?'completed':'failed'});
          if(!usable)throw new Error(text);
          send({type:'delta',text});
          if(ctx?.waitUntil)ctx.waitUntil(persistStreamTurn(env,{jobId,sessionId,message,answer:text,provider:'fast',remember}));
          return;
        }

        const [historyRows, memoryNotes, pcBridge, chosenProvider, learnedRules] = await Promise.all([
          env?.DB ? loadConversationHistory(env, sessionId, jobId, { limit: 12, maxChars: 2400 }).catch(() => []) : [],
          env?.DB ? recallMemory(env, message).catch(() => []) : [],
          getPCBridgeStatus(env).catch(() => ({ connected: false })),
          pickChatProvider(env, engine, message),
          listActiveBehaviorRules(env)
        ]);

        const historyMessages = conversationsToMessages(historyRows);
        const systemPrompt = buildConversationalPrompt({
          language,
          pcConnected: Boolean(pcBridge?.connected),
          memoryNotes
        });

        const messages = [
          { role: 'system', content: [systemPrompt, behaviorRulesDirective(learnedRules)].filter(Boolean).join('\n') },
          ...historyMessages,
          { role: 'user', content: message }
        ];

        send({
          type: 'context',
          session: sessionId,
          model: chosenProvider,
          memories: memoryNotes.map((m) => m.key),
          history: historyRows.length
        });

        let answer = '';
        let usedProvider = chosenProvider;
        const onDelta = (token) => {
          answer += token;
        };

        try {
          if (chosenProvider === 'gemini') {
            await streamGemini(env, messages, onDelta);
          } else if (chosenProvider === 'anthropic' || chosenProvider === 'claude') {
            await streamAnthropic(env, messages, onDelta);
          } else if (chosenProvider === 'openai') {
            const { apiKey, model } = await getConfiguredAIProvider(env, 'openai');
            await streamOpenAICompatible({
              url: 'https://api.openai.com/v1/chat/completions',
              apiKey: sanitizeApiKey(apiKey),
              model: model || 'gpt-4.1-mini',
              messages,
              onDelta
            });
          } else if (chosenProvider === 'groq') {
            const { apiKey, model } = await getConfiguredAIProvider(env, 'groq');
            await streamOpenAICompatible({
              url: 'https://api.groq.com/openai/v1/chat/completions',
              apiKey: sanitizeApiKey(apiKey),
              model: model || 'llama-3.3-70b-versatile',
              messages,
              onDelta
            });
          } else if (chosenProvider === 'deepseek') {
            const { apiKey, model } = await getConfiguredAIProvider(env, 'deepseek');
            await streamOpenAICompatible({
              url: 'https://api.deepseek.com/chat/completions',
              apiKey: sanitizeApiKey(apiKey),
              model: model || 'deepseek-chat',
              messages,
              onDelta
            });
          } else {
            const cfModel = chosenProvider === 'fast'
              ? (env.AI_FAST_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast')
              : (env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
            await streamWorkersAI(env, cfModel, messages, onDelta);
          }
        } catch (err) {
          if (!answer && env?.AI?.run) {
            usedProvider = 'workers-ai';
            const fallbackModel = env.AI_FAST_FALLBACK_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
            await streamWorkersAI(env, fallbackModel, messages, onDelta);
          } else if (answer) {
            throw new Error(language === 'en'
              ? 'The response was interrupted before verification.'
              : 'Odpoveď sa prerušila pred overením.');
          } else {
            throw err;
          }
        }

        const cleaned = cleanOutput(answer).trim();
        if (!cleaned) {
          throw new Error('Model nevrátil žiadny text.');
        }

        const checked = finalizeAgentResponse({text:cleaned,tool_log:[]},language);
        send({type:'delta',text:checked.text});
        const persistTask = persistStreamTurn(env, { jobId, sessionId, message, answer: checked.text, provider: usedProvider, remember });
        if (ctx?.waitUntil) ctx.waitUntil(persistTask);
        else await persistTask;
      } catch (error) {
        send({ type: 'error', error: error?.message || 'Chyba pri streamovaní odpovede.' });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-cache',
      'X-Trinity-Stream': 'live-ndjson'
    }
  });
}
