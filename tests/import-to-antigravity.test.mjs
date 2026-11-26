import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  containsLikelySecret,
  importToAntigravity,
  parseCodexMcpToml
} from '../scripts/import-to-antigravity.mjs';

function makeTempFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-import-test-'));
  const homeDir = path.join(root, 'home');
  const workspaceDir = path.join(root, 'workspace');
  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(workspaceDir, { recursive: true });
  return { root, homeDir, workspaceDir };
}

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

test('parseCodexMcpToml parses stdio, HTTP, quoted names, multiline args, env and headers', () => {
  const toml = `
model = "gpt-5"

[mcp_servers.trinity]
url = "https://auru.space/mcp"
bearer_token_env_var = "TRINITY_TOKEN"

[mcp_servers.trinity.http_headers]
X-Client = "codex"

[mcp_servers."local-runner"]
command = "node"
args = [
  "scripts/mcp.mjs",
  "--stdio"
]
enabled = true

[mcp_servers."local-runner".env]
NODE_ENV = "production"

[mcp_servers.disabled_one]
command = "echo"
enabled = false
`;
  const parsed = parseCodexMcpToml(toml);
  assert.equal(parsed.trinity.url, 'https://auru.space/mcp');
  assert.equal(parsed.trinity.bearer_token_env_var, 'TRINITY_TOKEN');
  assert.equal(parsed.trinity.http_headers['X-Client'], 'codex');
  assert.equal(parsed['local-runner'].command, 'node');
  assert.deepEqual(parsed['local-runner'].args, ['scripts/mcp.mjs', '--stdio']);
  assert.equal(parsed['local-runner'].env.NODE_ENV, 'production');
  assert.equal(parsed.disabled_one.enabled, false);
});

test('containsLikelySecret detects API keys and tokens but ignores env placeholders', () => {
  assert.equal(containsLikelySecret('Authorization: Bearer ${env:TRINITY_TOKEN}'), false);
  assert.equal(containsLikelySecret('Normal markdown instructions for Trinity.'), false);
  assert.equal(containsLikelySecret('token = trn_live_AbCdEf1234567890'), true);
  assert.equal(containsLikelySecret('key = sk-proj-1234567890abcdefghijklmnop'), true);
  assert.equal(containsLikelySecret('ghp_1234567890abcdefghijklmnopqrstuvwxyz'), true);
});

test('importToAntigravity imports MCP servers, skills, and instructions from all 4 tools without leaking secrets', () => {
  const { root, homeDir, workspaceDir } = makeTempFixture();
  try {
    // Existing Antigravity config to verify backup + non-destructive merge
    writeFile(
      path.join(homeDir, '.gemini', 'antigravity', 'mcp_config.json'),
      JSON.stringify({ mcpServers: { existing_ag: { command: 'node', args: ['keep.mjs'] } } })
    );

    // 1. Claude Code
    writeFile(
      path.join(homeDir, '.claude.json'),
      JSON.stringify({
        mcpServers: {
          claude_server: {
            url: 'https://claude-mcp.example/mcp',
            headers: { Authorization: 'Bearer super_secret_token_1234567890abcdef' }
          }
        }
      })
    );
    writeFile(path.join(homeDir, '.claude', 'CLAUDE.md'), '# Claude Global Rules\nAlways test.');
    writeFile(
      path.join(homeDir, '.claude', 'skills', 'claude-helper', 'SKILL.md'),
      '---\nname: claude-helper\ndescription: Helper\n---\n# Helper'
    );

    // 2. Codex
    writeFile(
      path.join(homeDir, '.codex', 'config.toml'),
      `
[mcp_servers.codex_mcp]
command = "npx"
args = ["-y", "codex-mcp-tool"]
`
    );
    writeFile(path.join(homeDir, '.codex', 'AGENTS.md'), '# Codex Global Rules\nUse Slovak.');
    writeFile(
      path.join(homeDir, '.codex', 'skills', 'codex-audit', 'SKILL.md'),
      '---\nname: codex-audit\ndescription: Audit\n---\n# Audit'
    );
    // Secret-bearing skill should be blocked from repo sync
    writeFile(
      path.join(homeDir, '.codex', 'skills', 'leaky-skill', 'SKILL.md'),
      '---\nname: leaky-skill\ndescription: Leaky\n---\nkey: trn_live_SECRET1234567890abcdef'
    );

    // 3. Cursor
    writeFile(
      path.join(homeDir, '.cursor', 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          cursor_mcp: { command: 'python3', args: ['server.py'] }
        }
      })
    );
    writeFile(
      path.join(homeDir, '.cursor', 'rules', 'frontend.mdc'),
      '---\ndescription: Frontend rules\n---\nUse semantic HTML.'
    );

    // 4. Gemini CLI
    writeFile(
      path.join(homeDir, '.gemini', 'settings.json'),
      JSON.stringify({
        mcpServers: {
          gemini_mcp: { httpUrl: 'https://gemini.example/mcp' }
        }
      })
    );
    writeFile(path.join(homeDir, '.gemini', 'GEMINI.md'), '# Gemini Rules\nVerify facts.');

    // Dry run should not modify files
    const dryReport = importToAntigravity({ homeDir, workspaceDir, dryRun: true, syncRepo: true });
    assert.equal(dryReport.mode, 'dry-run');
    assert.equal(dryReport.mcp.imported.length, 4);
    assert.equal(fs.existsSync(path.join(workspaceDir, '.agents', 'skills', 'codex-audit')), false);

    // Real run
    const report = importToAntigravity({ homeDir, workspaceDir, syncRepo: true });
    assert.equal(report.mode, 'apply');
    assert.ok(report.mcp.backupPath && fs.existsSync(report.mcp.backupPath));

    // Report must NEVER contain the raw secret
    assert.equal(JSON.stringify(report).includes('super_secret_token_1234567890abcdef'), false);
    assert.equal(JSON.stringify(report).includes('trn_live_SECRET1234567890abcdef'), false);

    // Verify merged MCP config preserves existing + adds all 4
    const mergedMcp = JSON.parse(
      fs.readFileSync(path.join(homeDir, '.gemini', 'antigravity', 'mcp_config.json'), 'utf8')
    );
    assert.ok(mergedMcp.mcpServers.existing_ag);
    assert.equal(mergedMcp.mcpServers.claude_server.serverUrl, 'https://claude-mcp.example/mcp');
    assert.equal(mergedMcp.mcpServers.codex_mcp.command, 'npx');
    assert.equal(mergedMcp.mcpServers.cursor_mcp.command, 'python3');
    assert.equal(mergedMcp.mcpServers.gemini_mcp.serverUrl, 'https://gemini.example/mcp');

    // Verify global skills and repo-synced skills (and secret blocking!)
    assert.equal(
      fs.existsSync(path.join(homeDir, '.gemini', 'antigravity', 'skills', 'claude-helper', 'SKILL.md')),
      true
    );
    assert.equal(
      fs.existsSync(path.join(workspaceDir, '.agents', 'skills', 'codex-audit', 'SKILL.md')),
      true
    );
    assert.equal(
      fs.existsSync(path.join(workspaceDir, '.agents', 'skills', 'leaky-skill', 'SKILL.md')),
      false
    );
    assert.equal(report.skills.blockedSecretRepo.length, 1);
    assert.equal(report.skills.blockedSecretRepo[0].name, 'leaky-skill');

    // Verify instructions imported globally & synced to repo
    assert.equal(report.instructions.importedGlobal.length, 4);
    assert.equal(report.instructions.syncedRepo.length, 4);
    assert.equal(
      fs.existsSync(
        path.join(workspaceDir, '.agents', 'rules', 'imported', 'imported-cursor-cursor-rule-frontend.md')
      ),
      true
    );

    // Second run is idempotent
    const secondReport = importToAntigravity({ homeDir, workspaceDir, syncRepo: true });
    assert.equal(secondReport.mcp.imported.length, 0);
    assert.equal(secondReport.mcp.skippedExisting.length, 4);
    assert.equal(secondReport.skills.importedGlobal.length, 0);
    assert.equal(secondReport.instructions.importedGlobal.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
