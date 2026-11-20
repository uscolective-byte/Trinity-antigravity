/**
 * Trinity Tool Execution Loop
 * 
 * Prepojuje 57 registrovaných nástrojov s dispatch engine.
 * Zapisuje návratové hodnoty do core_tool_receipts.
 * 
 * @version 1.0.0
 * @author Trinity Team
 */

import { TrinityLogger, generateTraceId } from './trinity-logger.js';
import { toolResultState } from './tool-result-state.js';

// === TOOL EXECUTOR ===

export class ToolExecutor {
  constructor(env, logger, trace) {
    this.env = env;
    this.logger = logger;
    this.trace = trace;
    this.db = env.DB || env.TRINITY_D1;
    
    // Mapovanie nástrojov na service bindingy
    this.serviceMap = {
      'CHAT_INFERENCE_SERVICE': env.CHAT_INFERENCE_SERVICE || env.AI_INFERENCE_SERVICE,
      'CORE': env.CORE || env.CORE_SERVICE || env.TRINITY_CORE,
      'AURA_MEMORY': env.AURA_MEMORY || env.AURA_MEMORY_SERVICE,
      'PC_BRIDGE_SERVICE': env.PC_BRIDGE_SERVICE || env.PC_BRIDGE_V2,
      'DISPATCHER': env.DISPATCHER || env.DISPATCHER_SERVICE || env.TRINITY_DISPATCHER,
      'AUDIT_SERVICE': env.AUDIT_SERVICE || env.TRINITY_AUDIT,
      'GUARDIAN': env.GUARDIAN || env.TRINITY_GUARDIAN,
      'CONNECTORS': env.CONNECTORS || env.TRINITY_CONNECTORS,
    };
  }

  /**
   * Načíta definíciu nástroja z D1 databázy
   */
  async getToolDefinition(toolId) {
    const result = await this.db.prepare(
      'SELECT * FROM trinity_tool_registry WHERE tool_id = ? AND enabled = 1'
    ).bind(toolId).first();
    return result;
  }

  /**
   * Hlavná metóda — vykoná nástroj a zapíše receipt
   */
  async execute(toolId, input = {}, runId = null, step = 0) {
    let ownedRun = null;
    try {
      if (!runId) ownedRun = await this._createRun(`Tool: ${toolId}`, input, 1);
      const activeRun = runId || ownedRun;
      const run = await this.db.prepare('SELECT status FROM core_agent_runs WHERE id = ?').bind(activeRun).first();
      if (!run || run.status !== 'running') return {status: 'unverified', error: 'ACTIVE_RUN_REQUIRED'};
      const result = await this._execute(toolId, input, activeRun, step);
      if (ownedRun) await this._finishRun(ownedRun, result.status);
      return {...result, run_id: activeRun};
    } catch (error) {
      return {status: 'unverified', error: error.message, ...(ownedRun ? {run_id: ownedRun} : {})};
    }
  }

  async _createRun(prompt, input, maxSteps) {
    const id = generateTraceId();
    const bytes = new TextEncoder().encode(JSON.stringify(input));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
    await this.db.prepare(`INSERT INTO core_agent_runs(id,idempotency_key,input_hash,trace_id,prompt,max_steps,status) VALUES(?,?,?,?,?,?,'running')`)
      .bind(id, id, hash, this.trace?.traceId || id, prompt, Math.min(5, Math.max(1, maxSteps))).run();
    return id;
  }

  async _finishRun(id, status) {
    // Accepted asynchronous operations remain running until their result is known.
    if (!['success','error','exception','not_found','no_handler'].includes(status)) return;
    await this.db.prepare("UPDATE core_agent_runs SET status=?,updated_at=datetime('now') WHERE id=? AND status='running'")
      .bind(status === 'success' ? 'completed' : 'failed', id).run();
  }

  async _execute(toolId, input = {}, runId = null, step = 0) {
    const run_id = runId || generateTraceId();
    const receipt_id = generateTraceId();
    
    // Log start
    this.logger?.info('tool-executor', 'tool.start', `Executing: ${toolId}`, {
      tool: toolId,
      run_id,
      step
    }, this.trace);

    // Načítaj definíciu
    const tool = await this.getToolDefinition(toolId);
    if (!tool) {
      await this._writeReceipt(run_id, step, toolId, 'not_found', receipt_id, input, { error: 'Tool not registered' });
      this.logger?.error('tool-executor', 'tool.not_found', `Tool not found: ${toolId}`, { tool: toolId }, this.trace);
      return { status: 'not_found', error: `Tool ${toolId} not registered` };
    }

    // Dispatch na správny service binding
    const serviceBinding = this.serviceMap[tool.handler_target];
    if (!serviceBinding) {
      await this._writeReceipt(run_id, step, toolId, 'no_handler', receipt_id, input, { error: `No service binding for ${tool.handler_target}` });
      this.logger?.error('tool-executor', 'tool.no_handler', `No handler for: ${toolId}`, { tool: toolId, target: tool.handler_target }, this.trace);
      return { status: 'no_handler', error: `No service binding configured for ${tool.handler_target}` };
    }

    // Vykonaj
    const startTime = Date.now();
    try {
      const response = await serviceBinding.fetch(`https://trinity.internal/tool/${encodeURIComponent(toolId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Trinity-Trace-Id': this.trace?.traceId || '',
          'X-Trinity-Session-Id': this.trace?.sessionId || '',
        },
        body: JSON.stringify({ tool: toolId, input, run_id, step })
      });

      const durationMs = Date.now() - startTime;
      const output = await response.json();

      const resultState = toolResultState(response, output);
      if (resultState !== 'success' && resultState !== 'error') {
        return { status: resultState, output, durationMs };
      }
      if (resultState === 'success') {
        // Persisting a receipt is required before reporting confirmed success.
        const recorded = await this._writeReceipt(run_id, step, toolId, 'success', receipt_id, input, output);
        if (!recorded) {
          return { status: 'unverified', error: 'Execution response received but audit receipt could not be stored', receipt_id, durationMs };
        }
        await this._updateToolStats(toolId, true, durationMs);
        
        this.logger?.info('tool-executor', 'tool.success', `Tool ${toolId} completed`, {
          tool: toolId,
          durationMs,
          status: 'success'
        }, this.trace);
        
        return { status: 'success', output, receipt_id, durationMs };
      } else {
        // Chyba z service
        await this._writeReceipt(run_id, step, toolId, 'error', receipt_id, input, output);
        await this._updateToolStats(toolId, false, durationMs);
        
        this.logger?.error('tool-executor', 'tool.error', `Tool ${toolId} failed`, {
          tool: toolId,
          durationMs,
          status: 'error',
          error: output.error || response.statusText
        }, this.trace);
        
        return { status: 'error', error: output.error || response.statusText, receipt_id, durationMs };
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorOutput = { error: error.message, stack: error.stack };
      
      await this._writeReceipt(run_id, step, toolId, 'exception', receipt_id, input, errorOutput);
      await this._updateToolStats(toolId, false, durationMs);
      
      this.logger?.error('tool-executor', 'tool.exception', `Tool ${toolId} threw: ${error.message}`, {
        tool: toolId,
        durationMs,
        error: error.message
      }, this.trace);
      
      return { status: 'exception', error: error.message, receipt_id, durationMs };
    }
  }

  /**
   * Zapíše receipt do core_tool_receipts
   */
  async _writeReceipt(run_id, step, tool, status, receipt_id, input, output) {
    try {
      // The core receipt schema accepts only terminal completed/failed states.
      // Keep the actual provider response as valid JSON, including large results.
      const receiptStatus = status === 'success' ? 'completed' : 'failed';
      await this.db.prepare(
        `INSERT INTO core_tool_receipts (id, run_id, step, tool, status, receipt_id, input_json, output_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateTraceId(),
        run_id,
        step,
        tool,
        receiptStatus,
        receipt_id,
        JSON.stringify(input),
        JSON.stringify(output)
      ).run();
      return true;
    } catch (e) {
      console.error('Failed to write tool receipt:', e.message);
      return false;
    }
  }

  /**
   * Aktualizuje štatistiky nástroja v registry
   */
  async _updateToolStats(toolId, success, durationMs) {
    try {
      if (success) {
        await this.db.prepare(
          `UPDATE trinity_tool_registry 
           SET success_count = success_count + 1, 
               avg_latency_ms = (avg_latency_ms + ?) / 2,
               last_used = datetime('now')
           WHERE tool_id = ?`
        ).bind(durationMs, toolId).run();
      } else {
        await this.db.prepare(
          `UPDATE trinity_tool_registry 
           SET error_count = error_count + 1,
               last_used = datetime('now')
           WHERE tool_id = ?`
        ).bind(toolId).run();
      }
    } catch (e) {
      console.error('Failed to update tool stats:', e.message);
    }
  }

  /**
   * Spustí reťaz nástrojov (pipeline)
   */
  async executePipeline(steps, initialInput = {}) {
    const run_id = await this._createRun('Tool pipeline', initialInput, steps.length);
    let currentInput = initialInput;
    const results = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.logger?.info('tool-executor', 'pipeline.step', `Pipeline step ${i + 1}/${steps.length}: ${step.tool}`, {
        run_id, step: i, tool: step.tool
      }, this.trace);

      const result = await this.execute(step.tool, currentInput, run_id, i);
      results.push({ step: i, tool: step.tool, ...result });

      if (result.status !== 'success') {
        this.logger?.error('tool-executor', 'pipeline.failed', `Pipeline failed at step ${i}: ${step.tool}`, {
          run_id, step: i, error: result.error
        }, this.trace);
        break;
      }

      // Output z predchádzajúceho kroku je input pre ďalší
      currentInput = result.output || {};
    }

    const completed = results.length === steps.length && results.every(result => result.status === 'success');
    await this._finishRun(run_id, completed ? 'success' : results.at(-1)?.status);
    return { run_id, results, completed };
  }

  /**
   * Zoznam všetkých dostupných nástrojov pre AI
   */
  async listAvailableTools() {
    const result = await this.db.prepare(
      'SELECT tool_id, name, category, description, success_count, error_count FROM trinity_tool_registry WHERE enabled = 1 ORDER BY category, name'
    ).all();
    return result.results;
  }
}
