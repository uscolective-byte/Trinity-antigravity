import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('MCP read key must never acquire write/project privileges from request router',()=>{
  const code=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
  assert.match(code,/const MCP_READ_TOOLS=new Set\(/);
  assert.match(code,/'agent_connections'/);
  assert.match(code,/projectControl:scope==='mcp:write'/);
  assert.doesNotMatch(code,/handleMcp\(forwarded,env,ctx,\{projectControl:true/);
});

test('Global Gemini project-control setting never elevates an unrelated MCP client',()=>{
  const code=readFileSync(new URL('../src/mcp.js',import.meta.url),'utf8');
  assert.match(code,/projectControlAllowed=\(\)=>Promise\.resolve\(access\.projectControl===true\)/);
  assert.doesNotMatch(code,/projectControlAllowed=.*geminiProjectControlEnabled/);
  assert.match(code,/registerTool\('agent_connections'/);
  assert.match(code,/agentConnectionMatrix\(env,pc\)/);
});

test('Master connection registry is admin-authenticated and read-only',()=>{
  const code=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
  assert.match(code,/if\(path==='\/api\/assistant\/master\/connections'&&request\.method==='GET'\)\{\s*requireAdmin\(user\)/);
  assert.doesNotMatch(code,/agentConnectionMatrix\(env,pcBridge\).*\.get\(/);
});
