/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module voice-agent.js (Trinity/src/voice-agent.js) in the TRINITY OMNI-CORE ecosystem.
 */
import { HttpError } from './security.js';
import { queryGraphContext } from './graph-memory.js';
import { callModel } from './services.js';

export async function handleVoiceDialogue(env, user, { audioBytes, audioMime = 'audio/webm', textPrompt = '' } = {}) {
  let userQuery = (textPrompt || '').trim();

  // 1. If audio was provided, transcribe it via Cloudflare Whisper Large v3 Turbo
  if (audioBytes && audioBytes.length > 0 && env.AI) {
    try {
      const sttModel = env.STT_MODEL || '@cf/openai/whisper-large-v3-turbo';
      const sttResult = await env.AI.run(sttModel, {
        audio: [...new Uint8Array(audioBytes)]
      });
      if (sttResult && (sttResult.text || sttResult.vtt)) {
        userQuery = (sttResult.text || sttResult.vtt).trim();
      }
    } catch (sttErr) {
      if (!userQuery) {
        throw new HttpError(502, `Voice transcription failed: ${sttErr.message}`);
      }
    }
  }

  if (!userQuery) {
    throw new HttpError(400, 'No voice or text input was provided.');
  }

  // 2. Context enrichment via memory graph (Graph RAG)
  let graphContext = { matched_nodes: [], relationships: [] };
  try {
    graphContext = await queryGraphContext(env, userQuery, 2, 5);
  } catch {}

  const graphSummary = graphContext.matched_nodes.length > 0
    ? `\nRelevant context from memory graph:\n` + graphContext.matched_nodes.map(n => `- ${n.type.toUpperCase()}: ${n.label}`).join('\n')
    : '';

  // 3. Response generation via Trinity AI
  const systemPrompt = `You are Trinity, the personal voice assistant for Ivan Sabo (Basterix), communicating through a hands-free voice interface. Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal 'tykanie' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language. Keep replies natural, concise, and clear for spoken audio (1-3 sentences). Avoid complex tables or markdown bullet lists that read poorly aloud.${graphSummary}`;

  let replyText = 'Rozumiem, požiadavka bola prijatá.';
  try {
    const aiResp = await callModel(env, 'auto', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery }
    ], 300);
    replyText = (aiResp.text || replyText).trim();
  } catch {
    replyText = `Počula som: "${userQuery}". Momentálne spracovávam akciu.`;
  }

  // 4. Speech synthesis (TTS) via MeloTTS or return text for browser SpeechSynthesis
  let audioBase64 = null;
  if (env.AI && env.TTS_MODEL) {
    try {
      const ttsResult = await env.AI.run(env.TTS_MODEL, { text: replyText });
      if (ttsResult instanceof ReadableStream || ttsResult instanceof ArrayBuffer || Array.isArray(ttsResult)) {
        const buffer = ttsResult instanceof ArrayBuffer ? ttsResult : await new Response(ttsResult).arrayBuffer();
        audioBase64 = `data:audio/wav;base64,${Buffer.from(buffer).toString('base64')}`;
      }
    } catch {}
  }

  // 5. Record event to ops_events
  if (env.DB) {
    await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('voice_dialogue_turn', ?)")
      .bind(JSON.stringify({ query: userQuery, user: user?.email || 'admin', has_audio: Boolean(audioBase64) }))
      .run().catch(() => {});
  }

  return {
    transcript: userQuery,
    reply: replyText,
    audio_data_url: audioBase64,
    graph_context: graphContext,
    at: new Date().toISOString()
  };
}
