/**
 * Trinity Service Dispatcher
 * Client for calling Service Bindings
 * @version 1.0.0
 */

import { D1 } from '../lib/d1.js';
import { toolResultState } from '../lib/tool-result-state.js';
import { ToolExecutor } from '../lib/trinity-tool-executor.js';

const SERVICE_MAP = {
  'CHAT_INFERENCE_SERVICE': 'trinity-chat-inference',
  'AI_INFERENCE_SERVICE': 'trinity-chat-inference',
  'CORE': 'trinity-core',
  'CORE_SERVICE': 'trinity-core',
  'AURA_MEMORY': 'trinity-memory',
  'AURA_MEMORY_SERVICE': 'trinity-memory',
  'MEMORY': 'trinity-memory',
  'PC_BRIDGE_SERVICE': 'trinity-pc-bridge-v2',
  'PC_BRIDGE_V2': 'trinity-pc-bridge-v2',
  'DISPATCHER': 'trinity-dispatcher',
  'DISPATCHER_SERVICE': 'trinity-dispatcher',
  'AUDIT_SERVICE': 'trinity-audit',
  'GUARDIAN': 'trinity-guardian',
  'CONNECTORS': 'trinity-connectors',
  'JERICHO': 'trinity-jericho',
  'COPILOT_BRIDGE': 'trinity-copilot-bridge',
};

export class Dispatcher {
  constructor(env, d1, traceId = null) {
    this.env = env;
    this.d1 = d1;
    this.traceId = traceId || crypto.randomUUID();
    this.lifecycle = new ToolExecutor({...env, DB: env.DB || env.TRINITY_D1 || d1.db}, null, {traceId: this.traceId});
  }

  /**
   * Calls a service binding with trace propagation
   */
  async call(bindingName, path, options = {}) {
    const binding = this.env[bindingName];
    if (!binding) {
      await this.d1.log(this.traceId, "dispatcher", "service.not_found", "error",
        `Binding ${bindingName} not available`, { binding: bindingName }, "error");
      return { ok: false, status: 502, error: `Binding ${bindingName} not available` };
    }

    const start = Date.now();
    const headers = new Headers(options.headers || {});
    headers.set("X-Trinity-Trace-Id", this.traceId);

    try {
      const response = await binding.fetch(new URL(path, 'https://trinity.internal').href, {
        ...options,
        headers,
        method: options.method || "POST"
      });

      const ms = Date.now() - start;
      await this.d1.log(this.traceId, "dispatcher", "service.response", "info",
        `${bindingName} responded ${response.status} in ${ms}ms`,
        { binding: bindingName, path, status: response.status, ms }, "ok", ms);

      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, body, latencyMs: ms };
    } catch (err) {
      const ms = Date.now() - start;
      await this.d1.log(this.traceId, "dispatcher", "service.error", "error",
        `${bindingName} failed: ${err.message}`,
        { binding: bindingName, path, error: err.message, ms }, "error", ms);
      return { ok: false, status: 500, error: err.message, latencyMs: ms };
    }
  }

  /**
   * Executes a tool from the tool registry
   */
  async executeTool(toolId, input = {}, runId = null, step = 0) {
    let ownedRun = null;
    try {
      if (!runId) ownedRun = await this.lifecycle._createRun(`Tool: ${toolId}`, input, 1);
      const activeRun = runId || ownedRun;
      const run = await this.lifecycle.db.prepare('SELECT status FROM core_agent_runs WHERE id = ?').bind(activeRun).first();
      if (!run || run.status !== 'running') return {status: 'unverified', error: 'ACTIVE_RUN_REQUIRED'};
      const result = await this._executeTool(toolId, input, activeRun, step);
      if (ownedRun) await this.lifecycle._finishRun(ownedRun, result.status);
      return {...result, run_id: activeRun};
    } catch (error) {
      return {status: 'unverified', error: error.message, ...(ownedRun ? {run_id: ownedRun} : {})};
    }
  }

  async _executeTool(toolId, input = {}, runId = null, step = 0) {
    const rid = runId || crypto.randomUUID();
    const receiptId = crypto.randomUUID();

    const tool = await this.d1.getTool(toolId);
    if (!tool) {
      await this.d1.log(this.traceId, "dispatcher", "tool.not_found", "warn",
        `Tool not found: ${toolId}`, { tool: toolId }, "error");
      return { status: "not_found", error: `Tool ${toolId} not registered` };
    }

    const binding = this.env[tool.handler_target];
    if (!binding) {
      await this.d1.log(this.traceId, "dispatcher", "tool.no_handler", "error",
        `No binding for ${toolId}: ${tool.handler_target}`,
        { tool: toolId, target: tool.handler_target }, "error");

      const recorded = await this.d1.recordToolError(toolId, input, 'No service binding', {runId: rid, step, receiptId});
      return { status: "no_handler", error: `No binding for ${tool.handler_target}`, ...(recorded ? {receipt_id: receiptId} : {audit_error: 'RECEIPT_NOT_STORED'}) };
    }

    const start = Date.now();
    try {
      const response = await binding.fetch(`https://trinity.internal/tool/${encodeURIComponent(toolId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Trinity-Trace-Id": this.traceId
        },
        body: JSON.stringify({ tool: toolId, input, run_id: rid, step })
      });

      const ms = Date.now() - start;
      const output = await response.json();

      const resultState = toolResultState(response, output);
      if (resultState !== 'success' && resultState !== 'error') {
        return { status: resultState, output, latencyMs: ms };
      }
      if (resultState === 'success') {
        // Treat D1 receipt persistence as a required part of an asserted success.
        await this.d1.recordToolSuccess(toolId, ms, {
          runId: rid, step, receiptId, input, output
        });
        await this.d1.log(this.traceId, "dispatcher", "tool.success", "info",
          `${toolId} completed in ${ms}ms`, { tool: toolId, ms }, "ok", ms);
        return { status: "success", output, receipt_id: receiptId, latencyMs: ms };
      } else {
        const recorded = await this.d1.recordToolError(toolId, input, output?.error || "Tool returned unsuccessful result", {runId: rid, step, receiptId});
        await this.d1.log(this.traceId, "dispatcher", "tool.error", "error",
          `${toolId} failed`, { tool: toolId, ms, error: output?.error || 'Tool returned unsuccessful result' }, "error", ms);
        return { status: "error", error: output?.error || 'Tool returned unsuccessful result', ...(recorded ? {receipt_id: receiptId} : {audit_error: 'RECEIPT_NOT_STORED'}), latencyMs: ms };
      }
    } catch (err) {
      const ms = Date.now() - start;
      const recorded = await this.d1.recordToolError(toolId, input, err.message, {runId: rid, step, receiptId});
      await this.d1.log(this.traceId, "dispatcher", "tool.exception", "error",
        `${toolId} threw: ${err.message}`, { tool: toolId, ms, error: err.message }, "error", ms);
      return { status: "exception", error: err.message, ...(recorded ? {receipt_id: receiptId} : {audit_error: 'RECEIPT_NOT_STORED'}), latencyMs: ms };
    }
  }

  /**
   * Executes a tool pipeline
   */
  async executePipeline(steps, initialInput = {}) {
    const runId = await this.lifecycle._createRun('Tool pipeline', initialInput, steps.length);
    let currentInput = initialInput;
    const results = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await this.d1.log(this.traceId, "dispatcher", "pipeline.step", "info",
        `Pipeline step ${i}/${steps.length}: ${step.tool}`,
        { run_id: runId, step: i, tool: step.tool });

      const result = await this.executeTool(step.tool, currentInput, runId, i);
      results.push({ step: i, tool: step.tool, ...result });

      if (result.status !== "success") {
        await this.d1.log(this.traceId, "dispatcher", "pipeline.failed", "error",
          `Pipeline failed at step ${i}: ${step.tool}`,
          { run_id: runId, step: i, error: result.error }, "error");
        break;
      }
      currentInput = result.output || {};
    }

    await this.d1.log(this.traceId, "dispatcher", "pipeline.complete", "info",
      `Pipeline done: ${results.length}/${steps.length} steps`,
      { run_id: runId, completed: results.length === steps.length });

    const completed = results.length === steps.length && results.every(result => result.status === 'success');
    await this.lifecycle._finishRun(runId, completed ? 'success' : results.at(-1)?.status);
    return { run_id: runId, results, completed };
  }
}
