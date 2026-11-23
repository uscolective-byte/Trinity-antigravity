/**
 * @module TRINITY_OMNI_CORE
 * @subsystem GEMINI_GEM_AGENT
 * @author Basterix (Root Architect) & Antigravity (Sovereign Pair)
 * @license Sovereign Irrevocable Covenant
 * @description Trinity agent using the configured Google AI Studio / Gemini API model cascade
 * with optional Workers AI edge fallback. Model performs inference only; tool permissions
 * are enforced strictly by the authenticated caller context.
 */

import { boundedText } from './services.js';
import { sanitizeApiKey } from './ai-providers.js';
import { resolveAiStudioCredential, redactAiStudioSecret } from './google-ai-studio-bridge.js';
import { buildReceipt, hashPayload } from './receipt.js';
import { parseModelAction } from './model-action-parser.js';

export const GEMINI_MODEL_CASCADE = Object.freeze([
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
  'gemini-1.5-flash'
]);

export const EDGE_FALLBACK_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const GEMINI_KEY_PATTERN = /(?:AIza[A-Za-z0-9_-]{25,}|AQ\.[A-Za-z0-9_.-]{25,})/;

// Reflects only the public context available to the Gemini API agent. Web UI Gem IDs
// and private Gem UI settings are not loaded through the Gemini generateContent API.
export const GEMINI_GEM_SYSTEM_PROFILE = [
  'You are the Gemini agent integrated into Trinity OMNI-CORE 11.1.0 via the Google AI Studio / Gemini API.',
  'Trinity is a modular AI system running on Cloudflare Workers with model routing, MCP, and a local PC bridge. Naming or configuring D1, KV, R2, Vectorize, or Workers AI is never proof of a live connection or successful operation.',
  'Always reply to the user in Slovak unless the user writes in another language. Be factual and clear. Never claim consciousness, human identity, or permissions you do not possess.',
  'Clearly distinguish proposals, implementation, configuration, execution, and verified outcomes. Only claim success based on actual verified results from this session.',
  'A Gemini API key or a web UI Gem ID does not grant access to a Google Gem account, GitHub, Cloudflare, the local PC, or administrator privileges.',
  'Rate limits and quotas are managed by the provider. Model fallback reduces downtime risk but does not guarantee unlimited usage or uninterrupted availability.'
].join('\n');

/**
 * Normalizes conversation history for the Gemini API (ensuring alternating 'user' and 'model' turns).
 */
function formatGeminiContents(messages = []) {
  const contents = [];
  let systemText = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n\n' : '') + msg.content;
    } else {
      const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
      const text = String(msg.content || '');
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n\n' + text;
      } else {
        contents.push({
          role,
          parts: [{ text }]
        });
      }
    }
  }

  if (contents.length > 0 && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: 'Continue.' }] });
  }

  return { contents, systemText };
}

/**
 * Executes a single Gemini API generateContent request against a specific model.
 */
async function callGeminiEndpoint(apiKey, model, contents, systemInstruction = '', options = {}) {
  const cleanModel = String(model).replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent`;

  const payload = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxTokens ?? 8192
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const fetcher = options.fetcher || fetch;
  const response = await fetcher(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(options.timeoutMs || 45000),
    redirect: 'manual'
  });

  if (!response.ok) {
    const errorText = redactAiStudioSecret(await boundedText(response, 1000).catch(() => ''));
    const err = new Error(`Gemini ${cleanModel} HTTP ${response.status}: ${errorText}`);
    err.status = response.status;
    err.model = cleanModel;
    throw err;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n').trim() || '';

  if (!text) {
    throw new Error(`Gemini ${cleanModel} returned an empty response.`);
  }

  return {
    text,
    model: cleanModel,
    provider: 'gemini',
    usage: {
      inputTokens: data?.usageMetadata?.promptTokenCount || 0,
      outputTokens: data?.usageMetadata?.candidatesTokenCount || 0
    }
  };
}

/**
 * Resolves the Gemini / Google AI Studio API key through the unified bridge resolver
 * (Worker secrets, Cloudflare Secrets Store, encrypted Vault) with safe AI_KEYS JSON fallback.
 */
async function resolveGeminiAgentApiKey(env, options = {}) {
  const resolved = await resolveAiStudioCredential(env, {
    ownerId: options.ownerId ?? options.executionContext?.userEmail,
    secretId: options.secretId
  });
  if (resolved.apiKey) {
    return resolved.apiKey;
  }
  if (typeof env?.AI_KEYS === 'string') {
    try {
      const parsed = JSON.parse(env.AI_KEYS);
      const rawKey = parsed?.google_ai_studio || parsed?.gemini || null;
      const sanitized = rawKey ? sanitizeApiKey(rawKey, GEMINI_KEY_PATTERN) : '';
      if (sanitized.length >= 25) return sanitized;
    } catch {
      // Fail closed on malformed AI_KEYS JSON.
    }
  }
  return null;
}

/**
 * Runs a single inference turn across the Gemini model cascade or Workers AI edge fallback.
 */
async function runSingleInference(env, messages, options = {}) {
  const apiKey = await resolveGeminiAgentApiKey(env, options);
  const errors = [];

  // 1. Google AI Studio / Gemini model cascade
  if (apiKey) {
    const { contents, systemText } = formatGeminiContents(messages);
    const candidateModels = [
      ...(env.GEMINI_MODEL ? [env.GEMINI_MODEL] : []),
      ...GEMINI_MODEL_CASCADE
    ];
    const uniqueModels = [...new Set(candidateModels)];

    for (const model of uniqueModels) {
      try {
        const result = await callGeminiEndpoint(apiKey, model, contents, systemText, options);
        return {
          ...result,
          tier: 'gemini-native',
          attempts: errors.length + 1
        };
      } catch (err) {
        errors.push({ model, status: err.status || 'unknown', message: redactAiStudioSecret(err.message) });
        if (err.status === 429 || err.status === 503 || err.status === 500 || err.status === 404) {
          continue;
        }
        break;
      }
    }
  } else {
    errors.push({ reason: 'GEMINI_API_KEY_ABSENT', message: 'Google AI Studio / Gemini API key is not configured; activating Edge Fallback.' });
  }

  // 2. Sovereign Edge Fallback (Workers AI Llama 3.3 70B)
  if (env.AI?.run) {
    try {
      const edgeModel = env.AI_MODEL || EDGE_FALLBACK_MODEL;
      const systemMsg = messages.find(m => m.role === 'system')?.content || '';
      const nonSystem = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
        content: String(m.content || '')
      }));
      const aiResponse = await env.AI.run(edgeModel, {
        messages: [
          ...(systemMsg ? [{ role: 'system', content: systemMsg }] : []),
          ...nonSystem
        ],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.2
      });

      const text = typeof aiResponse === 'string' ? aiResponse
        : typeof aiResponse?.response === 'string' ? aiResponse.response
        : typeof aiResponse?.output_text === 'string' ? aiResponse.output_text
        : '';

      if (text) {
        return {
          text: text.trim(),
          model: edgeModel,
          provider: 'workers-ai-edge-fallback',
          tier: 'sovereign-edge',
          attempts: errors.length + 1,
          fallbackChain: errors
        };
      }
    } catch (edgeErr) {
      errors.push({ model: 'workers-ai', message: redactAiStudioSecret(edgeErr.message) });
    }
  }

  throw new Error(`Gemini GEM Agent exhausted all available channels: ${JSON.stringify(errors)}`);
}

/**
 * Executes Gemini inference and optional bounded tool calls using the authenticated caller's permissions.
 */
export async function executeGeminiGemAgent(env, task, options = {}) {
  const startedAt = Date.now();
  const executionId = `GEMINI-GEM-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6)}`;

  if (!task || typeof task !== 'string' || !task.trim()) {
    throw new Error('Úloha pre Gemini GEM agenta nesmie byť prázdna.');
  }

  const allowTools = options.tools !== false;
  const maxTurns = Math.max(1, Math.min(15, options.maxTurns || 8));

  const toolDirectives = allowTools ? [
    '',
    'Available system tools for executing authorized user requests:',
    '- read_file: { "Path": string, "StartLine"?: number, "EndLine"?: number } - Read a file',
    '- write_file: { "Path": string, "Content": string, "Overwrite"?: boolean, "Append"?: boolean } - Create or write a file',
    '- edit_file: { "Path": string, "Target": string, "Replacement": string } - Exact substring edit in a file',
    '- run_command: { "CommandLine": string, "WaitMsBeforeAsync"?: number } - Run a shell/PowerShell command',
    '- manage_task: { "Action": "list"|"kill"|"status"|"send_input", "TaskId"?: string } - Manage background tasks',
    '- search_marketplace: { "queries": string[], "kind"?: "all"|"plugin"|"skill", "limit"?: number } - Search extensions',
    '- pc_run: { "command": string } - Run a program or command on the user PC',
    '- pc_open_app: { "target": string } - Open an application on the user PC',
    '- pc_file_read: { "path": string } - Read a file on the user PC',
    '- pc_file_write: { "path": string, "content": string } - Write a file on the user PC',
    '- pc_git_commit: { "message": string } - Create a Git commit on the user PC',
    '- project_inspect: { "query"?: string } - Inspect repository structure',
    '- project_read: { "path": string } - Read project source code',
    '- search_memory: { "query": string } - Search persistent memory',
    '- knowledge_search: { "query": string } - Search the knowledge base',
    '- calculate: { "expression": string } - Exact mathematical evaluation',
    '- current_time: {} - Current UTC date and time',
    '',
    'TOOL EXECUTION RULE: When the user request requires a tool action, respond EXCLUSIVELY with a JSON call:',
    '{"tool": "tool_name", "arguments": { ... }}',
    'Include no surrounding prose. After execution you will receive the verified tool result. Once the task is complete, reply to the user in Slovak (unless the user wrote in another language) with verified facts only.'
  ].join('\n') : '';

  const systemPrompt = [
    GEMINI_GEM_SYSTEM_PROFILE,
    typeof options.systemPrompt === 'string' ? options.systemPrompt.trim() : '',
    toolDirectives
  ].filter(Boolean).join('\n\n');

  const messages = Array.isArray(options.messages)
    ? options.messages.map(message => ({ ...message }))
    : [{ role: 'user', content: task }];
  messages.unshift({ role: 'system', content: systemPrompt });

  const toolLog = [];
  let lastInference = null;

  for (let turn = 0; turn < maxTurns; turn++) {
    lastInference = await runSingleInference(env, messages, options);
    const text = lastInference.text || '';

    if (!allowTools) {
      break;
    }

    let action;
    try {
      action = parseModelAction(text);
    } catch {
      action = { answer: text };
    }

    // Stop when the model returns a final answer instead of a tool invocation
    if (action.answer || !action.tool) {
      break;
    }

    // Execute the requested tool via runTool
    const toolName = action.tool;
    const toolArgs = action.arguments || {};
    const toolStart = new Date().toISOString();

    let outcome;
    let toolStatus = 'success';
    try {
      const { runTool } = await import('./tools.js');
      outcome = await runTool(env, 'gemini-gem', toolName, toolArgs, options.executionContext || {});
    } catch (err) {
      toolStatus = 'failed';
      outcome = { error: err.message || 'Tool execution failed.' };
    }

    const toolEnd = new Date().toISOString();
    const receipt = buildReceipt({
      tool: toolName,
      action: 'execute',
      status: toolStatus,
      actor: { type: 'agent', id: 'gemini-gem' },
      target: { type: 'tool', id: toolName },
      evidence: [{
        type: 'api',
        id: toolName,
        description: `Gemini GEM execute tool ${toolName}`,
        afterHash: hashPayload(outcome)
      }],
      startedAt: toolStart,
      completedAt: toolEnd
    });

    toolLog.push({
      tool: toolName,
      arguments: toolArgs,
      status: toolStatus,
      outcome,
      receiptId: receipt.receiptId,
      receipt
    });

    // Append tool invocation and verified output to conversation history for the next turn
    messages.push({
      role: 'assistant',
      content: JSON.stringify({ tool: toolName, arguments: toolArgs })
    });
    messages.push({
      role: 'user',
      content: `[Tool result for ${toolName}]:\n${typeof outcome === 'string' ? outcome : JSON.stringify(outcome, null, 2)}\n\nContinue solving the task, call another tool if needed, or provide the final answer to the user in Slovak (unless the user wrote in another language) using verified results only.`
    });
  }

  const finalResultText = lastInference?.text || '';

  return {
    success: true,
    executionId,
    agent: 'gemini-gem',
    result: finalResultText,
    text: finalResultText,
    tool_log: toolLog,
    model: lastInference?.model || 'unknown',
    provider: lastInference?.provider || 'gemini',
    tier: lastInference?.tier || 'unknown',
    durationMs: Date.now() - startedAt,
    limits: {
      status: 'not_verified',
      policy: 'provider_managed',
      fallbackUsed: lastInference?.tier !== 'gemini-native',
      toolExecutionEnabled: allowTools,
      toolsExecuted: toolLog.length,
      fallbacksAttempted: lastInference?.attempts ? lastInference.attempts - 1 : 0
    },
    _evidence: {
      effect: toolLog.length ? 'mutation' : 'inference',
      receipt_id: executionId,
      timestamp: new Date().toISOString()
    }
  };
}
