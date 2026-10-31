import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Antigravity workspace and Codex project use separate DPAPI-backed MCP clients',()=>{
  const antigravity=JSON.parse(read('../../.agents/mcp_config.json'));
  const codex=read('../../.codex/config.toml');
  assert.equal(antigravity.mcpServers['cloudflare-api'].serverUrl,'https://mcp.cloudflare.com/mcp');
  assert.ok(antigravity.mcpServers.trinity.args.includes('antigravity-mcp'));
  assert.match(codex,/\[mcp_servers\.trinity\]/);
  assert.match(codex,/codex-mcp/);
  assert.match(codex,/https:\/\/mcp\.cloudflare\.com\/mcp/);
  assert.doesNotMatch(JSON.stringify(antigravity)+codex,/trn_live_[a-zA-Z0-9_-]{25,}/);
});

test('VS Code uses independent prompts for staging and production plus official Copilot Studio MCP',()=>{
  const vscode=JSON.parse(read('../../.vscode/mcp.json'));
  assert.equal(vscode.servers.trinity.url,'https://auru.space/mcp');
  assert.equal(vscode.servers['trinity-development'].url,'https://auru.dev/mcp');
  assert.equal(vscode.servers['cloudflare-api'].url,'https://mcp.cloudflare.com/mcp');
  assert.equal(vscode.servers['copilot-studio'].type,'stdio');
  assert.ok(vscode.servers['copilot-studio'].args.includes('@microsoft/copilot-studio-mcp@latest'));
  const prod=vscode.servers.trinity.headers.Authorization;
  const staging=vscode.servers['trinity-development'].headers.Authorization;
  assert.notEqual(prod,staging);
  assert.match(prod,/input:trinity-prod-mcp-token/);
  assert.match(staging,/input:trinity-staging-mcp-token/);
});

test('Gemini workspace and key provisioning cannot reuse Copilot credentials by default',()=>{
  const gemini=JSON.parse(read('../.mcp.json'));
  assert.ok(gemini.mcpServers.trinity.args.includes('gemini-mcp'));
  assert.ok(!gemini.mcpServers.trinity.args.includes('copilot-mcp'));
  const provision=read('../scripts/provision-mcp-client.ps1');
  assert.match(provision,/ValidateSet\('copilot','gemini','ollama','codex','antigravity'\)/);
  assert.match(provision,/\$Access = 'read'/);
  assert.match(provision,/json_array\('mcp:read'\)/);
});
