/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description TrinityCopilotAgent main runtime with skill registry, plugin governance, caching, and circuit breaker for TRINITY OMNI-CORE.
 */
/**
 * TrinityCopilotAgent - Primary Copilot agent with skill-registry and plugin support.
 */

import {skills, skillRegistry} from './skillRegistry.js';
import {copilotPluginRegistry, copilotPlugins,assertCopilotSkillEnabled} from './copilot-plugins.js';
import {callModel} from './services.js';

export async function TrinityCopilotAgent(query, env = {}, options = {}) {
  const started = Date.now();
  const sessionId = options.sessionId || options.session_id || null;
  const requestId = options.requestId || crypto.randomUUID();
  const digestText=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  // Session IDs supplied by clients are not globally unique identities.
  const storageSessionId=sessionId&&options.userId?`copilot:v2:${await digestText(JSON.stringify([options.userId,sessionId]))}`:null;

  // 1. Input validation
  skills.validateInput(query, options);

  // Security sanitization (strip XSS vectors, redact sensitive credentials)
  const sanitizedQuery = skills.securitySanitise.sanitizeHtml(query);
  const cleanQuery = skills.securitySanitise.redactSensitive(sanitizedQuery);

  // Rate-limiting check
  const rateLimitKey = options.userId ? `copilot:user:${options.userId}` : 'copilot:global';
  try {
    await skills.rateLimiter(rateLimitKey, env, {
      limit: options.rateLimit || 60,
      windowSeconds: options.rateWindow || 60
    });
  } catch (rateErr) {
    await skills.logAudit(env, 'warn', `Rate limit exceeded for ${rateLimitKey}`, { query: cleanQuery });
    skills.recordMetrics(env, 'copilot.rate_limited', 1);
    throw rateErr;
  }

  // 2. Response cache (unless explicitly disabled)
  let cacheKey = null;
  if (!options.noCache && options.userId && !sessionId && !options.skill &&
      !options.usePowerPlatform && !(env.POWER_PLATFORM_URL && env.BOT_ID && !options.useTrinityAI)) {
    const hex=await digestText(JSON.stringify([options.userId,cleanQuery,options.aiProvider||null,options.maxTokens||2000,options.enableFallback!==false,env.AI_MODEL||null,env.GEMINI_MODEL||null,env.OPENAI_MODEL||null,env.CF_VERSION_METADATA?.id||null]));
    cacheKey = `copilot:cache:v2:${hex}`;
    
    const cached = await skills.cacheGet(cacheKey, env);
    if (cached) {
      await skills.logAudit(env, 'info', `Cache hit for query: "${cleanQuery.slice(0, 50)}"`, { cached: true });
      skills.recordMetrics(env, 'copilot.cache_hit', 1);
      return {
        ...cached,
        request_id:requestId,
        session_id:sessionId,
        cached: true,
        duration_ms: Date.now() - started
      };
    }
  }

  // Load dialogue context (when sessionId is provided)
  let history = [];
  if (storageSessionId) {
    history = await skills.dialogManagement.getContext(storageSessionId, env);
  }

  // 3. Upstream invocation with retry and circuit breaker
  let rawResult;
  let provider = 'trinity-core';

  try {
    rawResult = await skills.circuitBreaker.execute('copilot-upstream', async () => {
      return await skills.withRetry(async () => {
        // A) Explicitly requested or configured Power Platform / Copilot Studio call
        if (options.usePowerPlatform || (env.POWER_PLATFORM_URL && env.BOT_ID && !options.useTrinityAI)) {
          provider = 'power-platform';
          const platformResp = await skills.callPowerPlatform(cleanQuery, env, options);
          return platformResp;
        }

        // B) Explicit skill invocation via options (e.g., web_search, analyze_text, calculate, or synthesized skill)
        if (options.skill) {
          assertCopilotSkillEnabled(options.skill);
          const targetSkill = skillRegistry.get(options.skill) || skills[options.skill];
          if (typeof targetSkill === 'function') {
            provider = `skill:${options.skill}`;
            return await targetSkill(cleanQuery, env, options);
          }
          throw new Error(`Skill '${options.skill}' was not found in the registry.`);
        }

        // C) Available AI model provider (Cloudflare Workers AI, Gemini, OpenAI, or Ollama)
        if (options.aiProvider || env.AI || env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.OLLAMA_API_KEY || env.OLLAMA_SECRET) {
          provider = 'trinity-ai';
          const aiProvider = options.aiProvider || (env.AI ? 'workers-ai' : env.GEMINI_API_KEY ? 'gemini' : env.OPENAI_API_KEY ? 'openai' : 'ollama');
          const messages = [
            {
              role: 'system',
              content: 'You are Trinity Copilot — a highly capable, reliable, and auditable AI assistant. ' +
                       'Respond concisely, accurately, and clearly. ' +
                       "COMMUNICATION LANGUAGE RULE: Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal 'tykanie' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language."
            },
            ...history.map(item => ({ role: item.role, content: item.content })),
            { role: 'user', content: cleanQuery }
          ];

          const modelResponse = await callModel(env, aiProvider, messages, options.maxTokens || 2000);
          return modelResponse.text;
        }

        // D) Default deterministic unconfigured response
        provider = 'unconfigured';
        return 'AI provider is not configured. Check integration configuration; task execution has not been verified yet.';
      // Skills and connector calls may have side effects; never retry them automatically.
      }, [], options.skill || options.usePowerPlatform || (env.POWER_PLATFORM_URL && env.BOT_ID && !options.useTrinityAI) ? 0 : options.retries ?? 3, options.backoff ?? 400);
    }, env, { threshold: options.circuitThreshold || 5, cooldownMs: options.circuitCooldown || 30000 });
  } catch (error) {
    skills.recordMetrics(env, 'copilot.error', 1);
    await skills.logAudit(env, 'error', `TrinityCopilotAgent failed for query: "${cleanQuery.slice(0, 50)}": ${error.message}`, {
      error: error.message,
      requestId
    });

    if (options.enableFallback !== false) {
      provider = 'fallback';
      rawResult = skills.fallbackHandler(cleanQuery, error, options);
    } else {
      throw error;
    }
  }

  // 4. Rich-response formatting
  let formattedResult;
  if (rawResult && typeof rawResult === 'object' && rawResult.type && rawResult.content) {
    formattedResult = rawResult;
  } else if (typeof rawResult === 'string') {
    formattedResult = skills.formatRichResponse('markdown', rawResult, { provider });
  } else {
    formattedResult = skills.formatRichResponse('json', rawResult, { provider });
  }

  const durationMs = Date.now() - started;
  const finalResponse = {
    ...formattedResult,
    request_id: requestId,
    session_id: sessionId,
    provider,
    cached: false,
    duration_ms: durationMs
  };

  // 5. Store result in cache
  if (cacheKey && !options.noCache && provider==='trinity-ai' && finalResponse.type !== 'error') {
    await skills.cachePut(cacheKey, finalResponse, env, options.cacheTtl || 120);
  }

  // Persist turn into dialogue history
  if (storageSessionId) {
    const userText = cleanQuery;
    const assistantText = typeof finalResponse.content === 'string' ? finalResponse.content : JSON.stringify(finalResponse.content);
    await skills.dialogManagement.saveContext(storageSessionId, [
      { role: 'user', content: userText, timestamp: new Date().toISOString() },
      { role: 'assistant', content: assistantText, timestamp: new Date().toISOString() }
    ], env);
  }

  // 6. Audit & Metrics
  await skills.logAudit(
    env,
    'info',
    `Agent called – query="${cleanQuery.slice(0, 80)}"`,
    {
      requestId,
      provider,
      durationMs,
      cached: false
    }
  );

  skills.recordMetrics(env, 'copilot.success', 1);
  skills.recordMetrics(env, 'copilot.latency', durationMs, 'timing');

  return finalResponse;
}

export {skills, skillRegistry, copilotPluginRegistry, copilotPlugins};
