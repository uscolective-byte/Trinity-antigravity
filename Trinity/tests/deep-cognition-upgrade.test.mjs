import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runAgent } from '../src/engine.js';
import { conversationsToMessages } from '../src/conversation-history.js';
import { pickChatProvider } from '../src/chat-routing.js';
import { extractDurableMemoryInsights, persistAutoMemory } from '../src/memory-extractor.js';
import inferenceWorker from '../services/chat-inference.js';
import { handleLiveChatStream } from '../src/chat-stream.js';
import { buildConversationalPrompt } from '../src/cognition.js';

test('runAgent passes real alternating multi-turn historyMessages to inference model', async () => {
  let capturedMessages = null;
  const historyMessages = conversationsToMessages([
    { task: 'Ahoj Trinity, budujem e-shop na streetwear.', result: 'Paráda Ivan, pomôžem ti s dizajnom aj checkoutom.' },
    { task: 'Chcem tmavý underground štýl.', result: 'Jasné, pôjdeme do asfaltovej čiernej a acid-lime akcentov.' }
  ]);

  const env = {
    AI: {
      async run(_model, payload) {
        capturedMessages = payload.messages;
        return { response: 'Super, nadväzujem presne na ten tmavý streetwear štýl.' };
      }
    }
  };

  const res = await runAgent(
    env,
    'writer',
    'Skús navrhnúť nadpis pre hlavnú stránku.',
    'Kontext projektu',
    'workers-ai',
    4096,
    'sk',
    true,
    { historyMessages }
  );

  assert.match(res.text, /streetwear/);
  assert.ok(Array.isArray(capturedMessages));
  assert.equal(capturedMessages[0].role, 'system');
  assert.equal(capturedMessages[2].role, 'user');
  assert.match(capturedMessages[2].content, /e-shop/);
  assert.equal(capturedMessages[3].role, 'assistant');
  assert.equal(capturedMessages[4].role, 'user');
  assert.equal(capturedMessages[5].role, 'assistant');
  assert.match(capturedMessages[5].content, /acid-lime/);
  assert.equal(capturedMessages.at(-1).role, 'user');
  assert.match(capturedMessages.at(-1).content, /nadpis/);
});

test('memory-extractor captures durable preferences/context and strictly ignores secrets', async (t) => {
  const secretInsights = extractDurableMemoryInsights(
    'Moje API heslo je token=sk-secretvalue1234567890abcdef a preferujem krátke odpovede.',
    'Uložené.'
  );
  assert.deepEqual(secretInsights, []);

  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec('CREATE TABLE ops_memory (key TEXT PRIMARY KEY, value TEXT, source TEXT, updated_at TEXT)');
  const env = {
    DB: {
      prepare(sql) {
        let params = [];
        return {
          bind(...p) { params = p; return this; },
          async run() { db.prepare(sql).run(...params); return { success: true }; }
        };
      }
    }
  };

  const saved = await persistAutoMemory(env, {
    task: 'Preferujem ľudský štýl komunikácie a práve pracujem na webe auru.space.',
    resultText: 'Rozumiem Ivan, prispôsobila som komunikáciu a sledujem prácu na auru.space.'
  });
  assert.ok(saved.saved >= 2);
  const rows = db.prepare('SELECT key, value, source FROM ops_memory').all();
  assert.ok(rows.some((r) => r.key === 'profil/auto:komunikacny_styl' && r.source === 'auto-memory'));
  assert.ok(rows.some((r) => r.key === 'kontext/auto:aktivny_zamer'));
});

test('pickChatProvider uses configured strong providers for short chat instead of downgrading to 8B fast', async () => {
  const chosenWithGemini = await pickChatProvider({ GEMINI_API_KEY: 'AIzaSyTestConfiguredKey123456' }, 'auto', 'Ahoj, ako sa máš?');
  assert.equal(chosenWithGemini, 'gemini');

  const chosenFallbackFast = await pickChatProvider({}, 'auto', 'Ahoj, ako sa máš?');
  assert.equal(chosenFallbackFast, 'fast');
});

test('CHAT_INFERENCE_SERVICE accepts realistic system prompts (>20KB) and preserves 2000-token conversational budget', async () => {
  let seenPayload = null;
  const longSystem = 'Inštrukcie Trinity\n' + 'x'.repeat(28000);
  const req = new Request('https://chat-inference.internal/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      max_tokens: 2000,
      temperature: 0.65,
      messages: [
        { role: 'system', content: longSystem },
        { role: 'user', content: 'Ahoj Trinity, napíš detailný návrh.' }
      ]
    })
  });

  const res = await inferenceWorker.fetch(req, {
    AI: {
      async run(_model, payload) {
        seenPayload = payload;
        return { response: 'Detailný návrh hotový.' };
      }
    }
  });

  assert.equal(res.status, 200);
  assert.equal(seenPayload.max_tokens, 2000);
  assert.equal(seenPayload.temperature, 0.65);
  assert.equal(seenPayload.messages[0].content.length, longSystem.length);
});

test('buildConversationalPrompt stays lean (< 3000 chars) and natural', () => {
  const prompt = buildConversationalPrompt({
    language: 'sk',
    pcConnected: true,
    memoryNotes: [{ key: 'design_style', value: 'Ivan má rád čistý minimalistický dizajn.' }]
  });
  assert.ok(prompt.length < 3000, `Expected lean prompt < 3000 chars, got ${prompt.length}`);
  assert.ok(prompt.includes('Trinity'), 'Prompt should identify Trinity');
  assert.ok(prompt.includes('čistý minimalistický dizajn'), 'Prompt should include relevant memory notes');
});

test('handleLiveChatStream streams context + live delta chunks from Workers AI SSE', async () => {
  const encoder = new TextEncoder();
  const sseStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"response":"Ahoj "}\n\n'));
      controller.enqueue(encoder.encode('data: {"response":"Ivan!"}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  const waited = [];
  const ctx = { waitUntil(p) { waited.push(p); } };
  const env = {
    AI: {
      async run(_model, payload) {
        assert.equal(payload.stream, true);
        return sseStream;
      }
    }
  };

  const res = await handleLiveChatStream(env, ctx, {
    message: 'Ahoj Trinity, ako sa máš?',
    session: '11111111-1111-4111-8111-111111111111',
    language: 'sk',
    engine: 'auto',
    ownerMode: true
  });

  assert.equal(res.status, 200);
  const raw = await res.text();
  const events = raw.trim().split('\n').map(line => JSON.parse(line));
  assert.ok(events.some(e => e.type === 'context'), 'Should emit context event');
  const deltas = events.filter(e => e.type === 'delta').map(e => e.text).join('');
  assert.equal(deltas, 'Ahoj Ivan!');
  await Promise.allSettled(waited);
});

test('handleLiveChatStream returns fallback_job when heavy workflow/PC actions are requested', async () => {
  const res = await handleLiveChatStream({}, { waitUntil() {} }, {
    message: 'Spusti na mojom PC build a nasaď web na Cloudflare.',
    session: '22222222-2222-4222-8222-222222222222',
    language: 'sk',
    engine: 'auto',
    allow_files: true,
    ownerMode: true
  });

  assert.equal(res.status, 200);
  const events = (await res.text()).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(events[0]?.type, 'fallback_job');
});


test('an interrupted live answer reports an error and is not persisted as completed',async()=>{
  const encoder=new TextEncoder();
  const persisted=[];
  let calls=0;
  const stream=new ReadableStream({start(controller){
    controller.enqueue(encoder.encode('data: {"response":"Časť odpovede"}\n\n'));
    controller.enqueue(encoder.encode('data: {"error":{"message":"provider diagnostics"}}\n\n'));
    controller.close();
  }});
  const env={AI:{async run(){calls++;return stream;}}};
  const res=await handleLiveChatStream(env,{waitUntil(p){persisted.push(p);}},{message:'Ako sa máš?',language:'sk',engine:'workers-ai'});
  const events=(await res.text()).trim().split('\n').map(JSON.parse);
  assert.equal(calls,1);
  assert.equal(events.some(event=>event.type==='delta'),false);
  assert.match(events.at(-1).error,/pred overením/);
  assert.equal(events.at(-1).type,'error');
  assert.equal(persisted.length,0);
});


test('live chat receives active behavior rules alongside real self-improvement capabilities',async()=>{
  const env={
    DB:{prepare(sql){
      if(sql.includes("FROM self_improvement_proposals")){
        return {async all(){return {results:[{description:'Na začiatku stručne zhrň stav.'}]};}};
      }
      throw new Error('No history configured for this fixture.');
    }},
    AI:{async run(_model,{messages}){
      const system=messages[0].content;
      assert.match(system,/source-code fix proposals/);
      assert.match(system,/Na začiatku stručne zhrň stav/);
      return {response:'Viem pripraviť návrh opravy.'};
    }}
  };
  const res=await handleLiveChatStream(env,null,{message:'Vieš sa sama zlepšovať?',language:'sk',engine:'workers-ai'});
  const events=(await res.text()).trim().split('\n').map(JSON.parse);
  assert.equal(events.find(event=>event.type==='delta')?.text,'Viem pripraviť návrh opravy.');
  assert.equal(events.some(event=>event.type==='error'),false);
});


test('a Slovak typo-filled capabilities question gets a grounded answer without calling a model',async()=>{
  const env={AI:{async run(){assert.fail('capability answer must not call inference');}}};
  const res=await handleLiveChatStream(env,null,{message:'vis vikonat tieto vilepsenia sama',language:'auto'});
  const events=(await res.text()).trim().split('\n').map(JSON.parse);
  assert.equal(events[0].model,'trinity-capabilities');
  assert.match(events[1].text,/návrh opravy pre konkrétny commit/);
  assert.match(events[1].text,/žiadnu opravu nespustila/);
});


test('live chat executes the weather plugin and reports completion only when readings exist',async()=>{
  const original=globalThis.fetch;
  try{
    for(const successful of [true,false]){
      let calls=0;
      globalThis.fetch=async(url)=>{
        calls++;
        if(String(url).includes('geocoding-api.open-meteo.com'))return Response.json({results:[{latitude:48.1,longitude:17.1,name:'Bratislava',country:'Slovensko'}]});
        assert.match(String(url),/api[.]open-meteo[.]com/);
        return successful?Response.json({current:{temperature_2m:12,relative_humidity_2m:70,wind_speed_10m:8}}):new Response('',{status:503});
      };
      const res=await handleLiveChatStream({},null,{message:'Aké je počasie v Bratislave?'});
      const events=(await res.text()).trim().split('\n').map(JSON.parse);
      assert.equal(calls,2);
      assert.equal(events.find(e=>e.name==='open_weather')?.status,successful?'completed':'failed');
      assert.equal(events.at(-1).type,successful?'delta':'error');
      assert.match(successful?events.at(-1).text:events.at(-1).error,successful?/12°C/:/503/);
    }
  }finally{globalThis.fetch=original;}
});
