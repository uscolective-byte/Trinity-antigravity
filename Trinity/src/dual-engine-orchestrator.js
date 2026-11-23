/**
 * @module TRINITY_OMNI_CORE
 * @subsystem DUAL_ENGINE_ORCHESTRATOR
 * @author Basterix (Root Architect) & Antigravity (Sovereign Pair)
 * @license Sovereign Irrevocable Covenant
 * @description Sovereign orchestrator for dual cognitive deliberation between Claude (Anthropic) and Google (Gemini/GCP).
 * Provides staged cross-deliberation (Gemini analysis/plan + Claude deep synthesis/code),
 * parallel consensus, and reciprocal fallback under Truth Policy 2.1.
 */

import { executeClaudeAgent } from './claude-agent.js';
import { executeGeminiGemAgent } from './gemini-gem-agent.js';
import { buildReceipt, hashPayload } from './receipt.js';

export const DUAL_ENGINE_ROLES = Object.freeze({
  ANALYST: 'google_gemini',
  SYNTHESIZER: 'anthropic_claude'
});

/**
 * Cross-deliberation between Google Gemini and Anthropic Claude.
 * Stage 1: Google Gemini produces initial analysis, structure, and key hypotheses.
 * Stage 2: Claude reviews Gemini's output, verifies edge cases and logic, and creates the final synthesis.
 * Reciprocal fallback: if one engine is unavailable, the other completes the task independently.
 *
 * @param {object} env - Cloudflare Worker environment (Secrets Store, D1, KV, etc.)
 * @param {string} task - Task or question for the dual cognitive tandem
 * @param {object} [options]
 * @param {string} [options.mode='deliberate'] - 'deliberate' | 'parallel' | 'claude_only' | 'gemini_only'
 * @param {string} [options.geminiModel]
 * @param {string} [options.claudeModel]
 * @param {string} [options.systemPrompt]
 * @param {number} [options.maxTokens]
 * @returns {Promise<object>} Deliberation result with unified receipt from both models
 */
export async function dualEngineDeliberate(env, task, options = {}) {
  const mode = options.mode || 'deliberate';
  const startedAt = Date.now();

  if (mode === 'claude_only') {
    return executeClaudeAgent(env, task, options);
  }
  if (mode === 'gemini_only') {
    return executeGeminiGemAgent(env, task, options);
  }

  // 1. Deliberation mode (Staged Collaborative Deliberation)
  if (mode === 'deliberate') {
    let geminiStage = null;
    let geminiError = null;

    try {
      geminiStage = await executeGeminiGemAgent(env, task, {
        model: options.geminiModel,
        systemPrompt: (options.systemPrompt ? options.systemPrompt + '\n\n' : '') +
          'You are the analytical stage of the TRINITY cognitive tandem (Google Gemini). Analyze the task, identify key requirements, solution structure, and technical specifics. Your output will then be synthesized and implemented by Claude. Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal \'tykanie\' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language.',
        maxTokens: options.maxTokens || 4096
      });
    } catch (err) {
      geminiError = err;
    }

    // If Gemini failed, Claude takes over the entire task
    if (!geminiStage || !geminiStage.success) {
      const claudeResult = await executeClaudeAgent(env, task, {
        model: options.claudeModel,
        systemPrompt: options.systemPrompt,
        maxTokens: options.maxTokens
      });
      return {
        ...claudeResult,
        mode: 'deliberate_fallback_to_claude',
        gemini_status: geminiError ? geminiError.message : 'unreachable',
        deliberation_summary: 'Gemini stage was unavailable; the task was completed entirely by Claude.'
      };
    }

    // Stage 2: Claude reviews and synthesizes Gemini's proposal
    const claudeTask = [
      `### ORIGINAL TASK:`,
      task,
      '',
      `### INITIAL ANALYSIS AND PROPOSAL FROM GOOGLE GEMINI:`,
      geminiStage.text,
      '',
      `### INSTRUCTIONS FOR CLAUDE:`,
      `Review the Google Gemini analysis above. Improve the architecture, fill in missing details, fix any inaccuracies, and deliver a definitive, high-quality, directly usable solution.`
    ].join('\n');

    let claudeStage = null;
    let claudeError = null;

    try {
      claudeStage = await executeClaudeAgent(env, claudeTask, {
        model: options.claudeModel,
        systemPrompt: (options.systemPrompt ? options.systemPrompt + '\n\n' : '') +
          'You are the synthesis and coding stage of the TRINITY cognitive tandem (Anthropic Claude). Your role is to take the analysis from Google Gemini and produce a definitive, first-class output. Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal \'tykanie\' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language.',
        maxTokens: options.maxTokens || 4096,
        allowFallback: false // Preserve real Claude failure state without silent fallback
      });
    } catch (err) {
      claudeError = err;
    }

    // If Claude failed, return the verified Gemini analysis
    if (!claudeStage || !claudeStage.success) {
      return {
        ...geminiStage,
        mode: 'deliberate_fallback_to_gemini',
        claude_status: claudeError ? claudeError.message : 'unreachable',
        deliberation_summary: 'Claude stage was unavailable; output contains the complete Google Gemini analysis.'
      };
    }

    // Both stages succeeded — create unified receipt and combined result
    const durationMs = Date.now() - startedAt;
    const deliberationPayload = {
      taskHash: hashPayload(task),
      geminiModel: geminiStage.model,
      geminiReceipt: geminiStage.receipt?.evidence_hash || null,
      claudeModel: claudeStage.model,
      claudeReceipt: claudeStage.receipt?.evidence_hash || null,
      durationMs
    };

    const geminiText = geminiStage.text || geminiStage.result || '';
    const claudeText = claudeStage.text || claudeStage.result || '';

    const deliberationReceipt = buildReceipt({
      tool: 'dual_engine_orchestrator',
      action: 'deliberate',
      status: 'success',
      actor: { type: 'agent', id: 'trinity_dual_engine' },
      target: { type: 'system', id: 'claude_and_gemini' },
      evidence: [
        {
          type: 'api',
          id: 'deliberate_task_payload',
          description: 'Original task payload for dual engine',
          afterHash: hashPayload(task)
        },
        {
          type: 'api',
          id: 'deliberate_gemini_analysis',
          description: 'Google Gemini initial analysis',
          afterHash: hashPayload(geminiText)
        },
        {
          type: 'api',
          id: 'deliberate_claude_synthesis',
          description: 'Anthropic Claude synthesis and code',
          afterHash: hashPayload(claudeText)
        }
      ],
      metrics: {
        durationMs
      }
    });

    return {
      success: true,
      mode: 'deliberate',
      engines: {
        analyst: {
          provider: 'google',
          model: geminiStage.model,
          tokens: geminiStage.usage || null,
          analysis_preview: geminiStage.text.slice(0, 300) + '...'
        },
        synthesizer: {
          provider: 'anthropic',
          model: claudeStage.model,
          tokens: claudeStage.usage || null
        }
      },
      text: claudeStage.text,
      gemini_raw_analysis: geminiStage.text,
      duration_ms: durationMs,
      receipt: deliberationReceipt
    };
  }

  // 2. Parallel consensus mode (Parallel Multi-Engine Evaluation)
  if (mode === 'parallel') {
    const [geminiSettled, claudeSettled] = await Promise.allSettled([
      executeGeminiGemAgent(env, task, {
        model: options.geminiModel,
        systemPrompt: options.systemPrompt,
        maxTokens: options.maxTokens
      }),
      executeClaudeAgent(env, task, {
        model: options.claudeModel,
        systemPrompt: options.systemPrompt,
        maxTokens: options.maxTokens,
        allowFallback: false
      })
    ]);

    const geminiResult = geminiSettled.status === 'fulfilled' ? geminiSettled.value : null;
    const claudeResult = claudeSettled.status === 'fulfilled' ? claudeSettled.value : null;

    if (!geminiResult && !claudeResult) {
      throw new Error(`Both cognitive engines (Gemini and Claude) failed: G=${geminiSettled.reason?.message}, C=${claudeSettled.reason?.message}`);
    }

    const durationMs = Date.now() - startedAt;

    const consensusReceipt = buildReceipt({
      tool: 'dual_engine_orchestrator',
      action: 'parallel_consensus',
      status: (geminiResult?.success && claudeResult?.success) ? 'success' : 'partial',
      actor: { type: 'agent', id: 'trinity_dual_engine' },
      target: { type: 'system', id: 'claude_and_gemini' },
      evidence: [
        {
          type: 'api',
          id: 'parallel_task_payload',
          description: 'Task payload for parallel consensus',
          afterHash: hashPayload(task)
        },
        {
          type: 'api',
          id: 'parallel_result_payload',
          description: 'Parallel inference result payload',
          afterHash: hashPayload(claudeResult?.text || geminiResult?.text || '')
        }
      ],
      metrics: {
        durationMs
      }
    });

    return {
      success: true,
      mode: 'parallel',
      gemini: geminiResult,
      claude: claudeResult,
      primary_text: claudeResult?.text || geminiResult?.text,
      duration_ms: durationMs,
      receipt: consensusReceipt
    };
  }

  throw new Error(`Unknown dual-engine mode: ${mode}`);
}
