import test from "node:test";
import assert from "node:assert/strict";
import { executeTool, TRINITY_TOOL_DEFINITIONS } from "../src/sovereign-monolith.js";

test("Sovereign Monolith v12: Tool Registry & Definitions", () => {
  const toolNames = TRINITY_TOOL_DEFINITIONS.map(t => t.function.name);
  assert.ok(toolNames.includes("tetrakis_treasury_query"), "tetrakis_treasury_query must be registered");
  assert.ok(toolNames.includes("truth_policy_verify"), "truth_policy_verify must be registered");
  assert.ok(toolNames.includes("pc_bridge_execute"), "pc_bridge_execute must be registered");
  assert.ok(toolNames.includes("gemini_knowledge_search"), "gemini_knowledge_search must be registered");
});

test("Sovereign Monolith v12: tetrakis_treasury_query execution", async () => {
  const result = await executeTool("tetrakis_treasury_query", { account: "BASTERIX" });
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.token, "Tetrakis ($TTK)");
  assert.equal(result.totalSupply, "1,000,000,000 TTK");
  assert.ok(result.allocations.basterix_vault.includes("1,000,000 TTK"));
  assert.ok(result.allocations.treasury_reserve.includes("999,000,000 TTK"));
});

test("Sovereign Monolith v12: truth_policy_verify execution", async () => {
  const passResult = await executeTool("truth_policy_verify", { action_name: "deploy_check", exit_code: 0 });
  assert.equal(passResult.status, "VERIFIED");
  assert.equal(passResult.devilGateState, "PASSED_ASSERTION");

  const failResult = await executeTool("truth_policy_verify", { action_name: "failed_build", exit_code: 1 });
  assert.equal(failResult.status, "VIOLATION");
  assert.equal(failResult.devilGateState, "REJECTED_ASSERTION");
});

test("Sovereign Monolith v12: pc_bridge_execute execution (fallback & binding)", async () => {
  // Test local daemon telemetry fallback
  const fallbackResult = await executeTool("pc_bridge_execute", { command: "git status" }, {});
  assert.equal(fallbackResult.status, "LOCAL_DAEMON_TELEMETRY");
  assert.equal(fallbackResult.state, "ONLINE");

  // Test binding dispatch when PC_BRIDGE_SERVICE is present
  const mockService = {
    fetch: async () => ({
      json: async () => ({ status: "RPC_SUCCESS", stdout: "On branch main" })
    })
  };
  const bindingResult = await executeTool("pc_bridge_execute", { command: "git status" }, { PC_BRIDGE_SERVICE: mockService });
  assert.equal(bindingResult.status, "RPC_SUCCESS");
  assert.equal(bindingResult.stdout, "On branch main");
});

test("Sovereign Monolith v12: gemini_knowledge_search execution (fallback & binding)", async () => {
  // Fallback
  const fallbackResult = await executeTool("gemini_knowledge_search", { query: "Tetrakis tokenomics" }, {});
  assert.equal(fallbackResult.status, "KNOWLEDGE_GRAPH_HIT");
  assert.ok(fallbackResult.sources.includes("trinity-omni-knowledge"));

  // Binding
  const mockKnowledge = {
    fetch: async () => ({
      json: async () => ({ status: "FOUNDRY_INDEX_OK", hits: 3 })
    })
  };
  const bindingResult = await executeTool("gemini_knowledge_search", { query: "Tetrakis tokenomics" }, { KNOWLEDGE_SERVICE: mockKnowledge });
  assert.equal(bindingResult.status, "FOUNDRY_INDEX_OK");
  assert.equal(bindingResult.hits, 3);
});
