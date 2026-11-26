import test from "node:test";
import assert from "node:assert/strict";
import { executeTool, runInferenceCascade, TRINITY_TOOL_DEFINITIONS } from "../src/sovereign-monolith.js";

test("Sovereign Monolith v12: Tool Registry & Definitions", () => {
  const toolNames = TRINITY_TOOL_DEFINITIONS.map(t => t.function.name);
  assert.ok(toolNames.includes("tetrakis_treasury_query"), "tetrakis_treasury_query must be registered");
  assert.ok(toolNames.includes("truth_policy_verify"), "truth_policy_verify must be registered");
  assert.ok(toolNames.includes("pc_bridge_execute"), "pc_bridge_execute must be registered");
  assert.ok(toolNames.includes("gemini_knowledge_search"), "gemini_knowledge_search must be registered");
});

test("Sovereign Monolith v12: tetrakis_treasury_query fails honestly when unbound and uses JERICHO_SERVICE when bound", async () => {
  const unbound = await executeTool("tetrakis_treasury_query", { account: "BASTERIX" }, {});
  assert.equal(unbound.ok, false);
  assert.equal(unbound.status, "NOT_VERIFIED");
  assert.equal(unbound.verified, false);

  const mockJericho = {
    fetch: async () => new Response(JSON.stringify({ ok: true, token: "Tetrakis ($TTK)", totalSupply: "1000000000" }), { status: 200 })
  };
  const bound = await executeTool("tetrakis_treasury_query", { account: "BASTERIX" }, { JERICHO_SERVICE: mockJericho });
  assert.equal(bound.ok, true);
  assert.equal(bound.status, "SUCCESS");
  assert.equal(bound.verified, true);
});

test("Sovereign Monolith v12: truth_policy_verify rejects unbacked exit_code and verifies only real executor receipts", async () => {
  const noReceipt = await executeTool("truth_policy_verify", { action_name: "deploy_check", exit_code: 0 });
  assert.equal(noReceipt.ok, false);
  assert.equal(noReceipt.status, "NOT_VERIFIED");
  assert.equal(noReceipt.devilGateState, "REJECTED_ASSERTION");

  const forgedReceipt = await executeTool("truth_policy_verify", {
    action_name: "deploy_check",
    exit_code: 0,
    receipt: { receipt_id: "fake_1", executorId: "llm", issuer: "llm_model", exitCode: 0 }
  });
  assert.equal(forgedReceipt.ok, false);
  assert.equal(forgedReceipt.status, "NOT_VERIFIED");

  const passResult = await executeTool("truth_policy_verify", {
    action_name: "deploy_check",
    exit_code: 0,
    receipt: { receipt_id: "rcpt_real_01", executorId: "local-gateway-win32", exitCode: 0 }
  });
  assert.equal(passResult.ok, true);
  assert.equal(passResult.status, "VERIFIED");
  assert.equal(passResult.devilGateState, "PASSED_ASSERTION");

  const failResult = await executeTool("truth_policy_verify", { action_name: "failed_build", exit_code: 1 });
  assert.equal(failResult.ok, false);
  assert.equal(failResult.status, "VIOLATION");
  assert.equal(failResult.devilGateState, "REJECTED_ASSERTION");
});

test("Sovereign Monolith v12: pc_bridge_execute never simulates when unbound and dispatches when bound", async () => {
  const unboundResult = await executeTool("pc_bridge_execute", { command: "git status" }, {});
  assert.equal(unboundResult.ok, false);
  assert.equal(unboundResult.status, "UNAVAILABLE");
  assert.equal(unboundResult.executed, false);

  const mockService = {
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: "RPC_SUCCESS", stdout: "On branch main" })
    })
  };
  const bindingResult = await executeTool("pc_bridge_execute", { command: "git status" }, { PC_BRIDGE_SERVICE: mockService });
  assert.equal(bindingResult.status, "RPC_SUCCESS");
  assert.equal(bindingResult.stdout, "On branch main");
});

test("Sovereign Monolith v12: gemini_knowledge_search never fabricates hits when unbound and dispatches when bound", async () => {
  const unboundResult = await executeTool("gemini_knowledge_search", { query: "Tetrakis tokenomics" }, {});
  assert.equal(unboundResult.ok, false);
  assert.equal(unboundResult.status, "UNAVAILABLE");
  assert.deepEqual(unboundResult.hits, []);

  const mockKnowledge = {
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: "FOUNDRY_INDEX_OK", hits: 3 })
    })
  };
  const bindingResult = await executeTool("gemini_knowledge_search", { query: "Tetrakis tokenomics" }, { KNOWLEDGE_SERVICE: mockKnowledge });
  assert.equal(bindingResult.status, "FOUNDRY_INDEX_OK");
  assert.equal(bindingResult.hits, 3);
});

test("Sovereign Monolith v12: runInferenceCascade executes tool_calls and blocks unsupported action claims", async () => {
  let calls = 0;
  const kvMap = new Map([["status_key", "REAL_VALUE"]]);
  const env = {
    TRINITY_KV: {
      async get(k) { return kvMap.get(k) ?? null; },
      async put(k, v) { kvMap.set(k, v); },
      async delete(k) { kvMap.delete(k); }
    },
    AI: {
      async run(_model, payload) {
        calls += 1;
        if (calls === 1) {
          return {
            tool_calls: [{ name: "kv_memory_store", arguments: { action: "get", key: "status_key" } }]
          };
        }
        assert.match(payload.messages.at(-1).content, /REAL_VALUE/);
        return { response: "Hodnota kľúča status_key z KV je REAL_VALUE." };
      }
    }
  };
  const stream = await runInferenceCascade([{ role: "user", content: "Prečítaj status_key" }], env);
  const body = await new Response(stream).text();
  assert.equal(calls, 2);
  assert.match(body, /REAL_VALUE/);

  // Hallucinated deployment claim without a verified deploy tool receipt must be blocked by Truth Policy
  const lyingEnv = {
    AI: {
      async run() {
        return { response: "Nasadila som zmeny na produkciu a spustila som príkaz na PC." };
      }
    }
  };
  const guardedStream = await runInferenceCascade([{ role: "user", content: "Nasaď to" }], lyingEnv);
  const guardedBody = await new Response(guardedStream).text();
  assert.match(guardedBody, /Nemám overený systémový dôkaz/);
});
