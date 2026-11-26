import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNativeToolDefinitions, formatToolCatalogWithArgs } from '../src/tool-discovery.js';
import { extractModelText } from '../src/services.js';
import { parseAgentTurnAction } from '../src/engine.js';
import { TOOL_SCHEMAS, TOOL_HELP } from '../src/tools.js';
import { findUnsupportedActionClaims } from '../src/truth.js';

test('buildNativeToolDefinitions produces clean OpenAI/WorkersAI JSON schemas without $schema', () => {
  const defs = buildNativeToolDefinitions(['web_fetch', 'pc_file_read', 'calculate'], TOOL_SCHEMAS, TOOL_HELP, 10);
  assert.equal(defs.length, 3);
  for (const def of defs) {
    assert.equal(def.type, 'function');
    assert.equal(typeof def.function.name, 'string');
    assert.equal(typeof def.function.description, 'string');
    assert.equal(def.function.parameters.type, 'object');
    assert.equal(JSON.stringify(def.function.parameters).includes('"$schema"'), false);
  }
  const webFetch = defs.find((d) => d.function.name === 'web_fetch');
  assert.ok(webFetch.function.parameters.properties.url);
});

test('formatToolCatalogWithArgs surfaces required (*) and optional parameter names', () => {
  const text = formatToolCatalogWithArgs(['web_fetch', 'pc_file_read'], TOOL_SCHEMAS, TOOL_HELP);
  assert.match(text, /web_fetch:[\s\S]*\[args:\s*url\*\]/);
  assert.match(text, /pc_file_read:[\s\S]*\[args:\s*path\*/);
});

test('extractModelText extracts native tool_calls from Workers AI, OpenAI, and Anthropic formats', () => {
  const workersAiResult = {
    response: '',
    tool_calls: [{ name: 'web_fetch', arguments: { url: 'https://auru.space' } }]
  };
  assert.deepEqual(
    JSON.parse(extractModelText(workersAiResult)),
    { tool: 'web_fetch', arguments: { url: 'https://auru.space' } }
  );

  const anthropicResult = {
    content: [{ type: 'tool_use', id: 'tu_1', name: 'calculate', input: { operation: 'add', values: [2, 3] } }]
  };
  assert.deepEqual(
    JSON.parse(extractModelText(anthropicResult)),
    { tool: 'calculate', arguments: { operation: 'add', values: [2, 3] } }
  );
});

test('parseAgentTurnAction recovers tool calls from markdown prose blocks, <tool_call> tags, and {name, arguments}', () => {
  const allowed = ['web_fetch', 'calculate', 'fleet_status'];

  const markdownMixed = 'Pozriem sa na tú stránku hneď:\n```json\n{"tool":"web_fetch","arguments":{"url":"https://auru.space"}}\n```';
  assert.deepEqual(parseAgentTurnAction(markdownMixed, allowed), {
    tool: 'web_fetch',
    arguments: { url: 'https://auru.space' }
  });

  const xmlTag = '<tool_call name="calculate" args=\'{"operation":"add","values":[1,2]}\' />';
  assert.deepEqual(parseAgentTurnAction(xmlTag, allowed), {
    tool: 'calculate',
    arguments: { operation: 'add', values: [1, 2] }
  });

  const nameShape = '{"name":"fleet_status","arguments":{}}';
  assert.deepEqual(parseAgentTurnAction(nameShape, allowed), {
    tool: 'fleet_status',
    arguments: {}
  });
});

test('findUnsupportedActionClaims blocks Slovak simulated verification, configuration, and backup claims without receipts', () => {
  assert.ok(findUnsupportedActionClaims('Preveril som stav servera a všetko beží.', []).includes('verify'));
  assert.ok(findUnsupportedActionClaims('Nakónfiguroval som integráciu a zálohoval som dáta.', []).includes('change'));
  assert.ok(findUnsupportedActionClaims('Nakonfiguroval som webhook.', []).includes('change'));
});
