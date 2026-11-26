#!/usr/bin/env node
/**
 * @module TRINITY_OMNI_CORE
 * @subsystem AUTOMATION_AND_OPS_SCRIPTS
 * @description Cross-tool importer for MCP servers, skills, and instructions from
 * Claude Code, Codex, Cursor, and Gemini CLI into Antigravity (local + optional repo sync).
 * Never logs or commits plaintext secrets.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SECRET_PATTERNS = [
  /\btrn_live_[A-Za-z0-9_-]{12,}\b/,
  /\bsk-(?:proj-|ant-|live-|test-)?[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{25,}\b/,
  /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  /\bBearer\s+(?!\$\{)(?!<)[A-Za-z0-9._~+/-]{20,}=*\b/i
];

export function containsLikelySecret(text) {
  if (typeof text !== 'string' || text.length === 0) return false;
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function slugify(value) {
  return String(value || 'unnamed')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unnamed';
}

function stripJsonCommentsAndTrailingCommas(raw) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < raw.length && raw[i] !== '\n') i += 1;
      if (i < raw.length) out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}

export function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(stripJsonCommentsAndTrailingCommas(raw));
  } catch {
    return null;
  }
}

function stripTomlComment(line) {
  let inDouble = false;
  let inSingle = false;
  let escaped = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inDouble) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inDouble = false;
    } else if (inSingle) {
      if (ch === "'") inSingle = false;
    } else if (ch === '"') {
      inDouble = true;
    } else if (ch === "'") {
      inSingle = true;
    } else if (ch === '#') {
      return line.slice(0, i);
    }
  }
  return line;
}

function splitTopLevel(input, delimiter = ',') {
  const parts = [];
  let current = '';
  let inDouble = false;
  let inSingle = false;
  let escaped = false;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inDouble) {
      current += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (inSingle) {
      current += ch;
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      current += ch;
    } else if (ch === "'") {
      inSingle = true;
      current += ch;
    } else if (ch === '[') {
      bracketDepth += 1;
      current += ch;
    } else if (ch === ']') {
      bracketDepth -= 1;
      current += ch;
    } else if (ch === '{') {
      braceDepth += 1;
      current += ch;
    } else if (ch === '}') {
      braceDepth -= 1;
      current += ch;
    } else if (ch === delimiter && bracketDepth === 0 && braceDepth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

function unquoteTomlKey(segment) {
  const s = segment.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function splitTomlPath(sectionHeader) {
  const parts = [];
  let current = '';
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < sectionHeader.length; i += 1) {
    const ch = sectionHeader[i];
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
    } else if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
    } else if (ch === '.' && !inDouble && !inSingle) {
      parts.push(unquoteTomlKey(current));
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) parts.push(unquoteTomlKey(current));
  return parts;
}

function parseTomlValue(rawValue) {
  const val = rawValue.trim();
  if (!val) return '';
  if (val.startsWith('"') && val.endsWith('"')) {
    try {
      return JSON.parse(val);
    } catch {
      return val.slice(1, -1);
    }
  }
  if (val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1);
  }
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(val)) return Number(val);
  if (val.startsWith('[') && val.endsWith(']')) {
    const inner = val.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner, ',').map(parseTomlValue);
  }
  if (val.startsWith('{') && val.endsWith('}')) {
    const inner = val.slice(1, -1).trim();
    const obj = {};
    if (!inner) return obj;
    for (const pair of splitTopLevel(inner, ',')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      const k = unquoteTomlKey(pair.slice(0, eqIdx));
      const v = parseTomlValue(pair.slice(eqIdx + 1));
      obj[k] = v;
    }
    return obj;
  }
  return val;
}

/**
 * Parses [mcp_servers.*] tables from Codex config.toml without external dependencies.
 */
export function parseCodexMcpToml(tomlText) {
  const servers = {};
  if (typeof tomlText !== 'string' || !tomlText.trim()) return servers;

  const lines = tomlText.replace(/\r\n/g, '\n').split('\n');
  let currentPath = null;
  let pendingKey = null;
  let pendingBuffer = '';
  let bracketBalance = 0;

  const assignValue = (sectionPath, key, value) => {
    if (!sectionPath || sectionPath[0] !== 'mcp_servers' || sectionPath.length < 2) return;
    const serverName = sectionPath[1];
    if (!servers[serverName]) servers[serverName] = {};
    let target = servers[serverName];
    for (let i = 2; i < sectionPath.length; i += 1) {
      const seg = sectionPath[i];
      if (!target[seg] || typeof target[seg] !== 'object' || Array.isArray(target[seg])) {
        target[seg] = {};
      }
      target = target[seg];
    }
    target[key] = value;
  };

  for (const rawLine of lines) {
    const clean = stripTomlComment(rawLine).trim();
    if (!clean) continue;

    if (pendingKey !== null) {
      pendingBuffer += ' ' + clean;
      for (const ch of clean) {
        if (ch === '[' || ch === '{') bracketBalance += 1;
        else if (ch === ']' || ch === '}') bracketBalance -= 1;
      }
      if (bracketBalance <= 0) {
        assignValue(currentPath, pendingKey, parseTomlValue(pendingBuffer));
        pendingKey = null;
        pendingBuffer = '';
        bracketBalance = 0;
      }
      continue;
    }

    if (clean.startsWith('[') && clean.endsWith(']') && !clean.startsWith('[[')) {
      const header = clean.slice(1, -1).trim();
      currentPath = splitTomlPath(header);
      if (currentPath[0] === 'mcp_servers' && currentPath.length >= 2) {
        if (!servers[currentPath[1]]) servers[currentPath[1]] = {};
      }
      continue;
    }

    if (!currentPath || currentPath[0] !== 'mcp_servers') continue;

    const eqIdx = clean.indexOf('=');
    if (eqIdx === -1) continue;
    const key = unquoteTomlKey(clean.slice(0, eqIdx));
    const rhs = clean.slice(eqIdx + 1).trim();

    let balance = 0;
    let inDouble = false;
    let inSingle = false;
    let escaped = false;
    for (const ch of rhs) {
      if (inDouble) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inDouble = false;
      } else if (inSingle) {
        if (ch === "'") inSingle = false;
      } else if (ch === '"') {
        inDouble = true;
      } else if (ch === "'") {
        inSingle = true;
      } else if (ch === '[' || ch === '{') {
        balance += 1;
      } else if (ch === ']' || ch === '}') {
        balance -= 1;
      }
    }

    if (balance > 0) {
      pendingKey = key;
      pendingBuffer = rhs;
      bracketBalance = balance;
    } else {
      assignValue(currentPath, key, parseTomlValue(rhs));
    }
  }

  return servers;
}

function expandWorkspaceVars(value, workspaceRoot) {
  if (!workspaceRoot || typeof value !== 'string') return value;
  return value.replace(/\$\{workspaceFolder\}/g, workspaceRoot);
}

export function normalizeAntigravityServer(rawCfg, workspaceRoot = null) {
  if (!rawCfg || typeof rawCfg !== 'object') return null;
  if (rawCfg.enabled === false || rawCfg.disabled === true) return null;

  const out = {};
  const url = rawCfg.serverUrl || rawCfg.url || rawCfg.httpUrl;
  if (typeof url === 'string' && url.trim()) {
    out.serverUrl = expandWorkspaceVars(url.trim(), workspaceRoot);
  } else if (typeof rawCfg.command === 'string' && rawCfg.command.trim()) {
    out.command = expandWorkspaceVars(rawCfg.command.trim(), workspaceRoot);
    if (Array.isArray(rawCfg.args) && rawCfg.args.length > 0) {
      out.args = rawCfg.args.map((a) => expandWorkspaceVars(String(a), workspaceRoot));
    }
  } else {
    return null;
  }

  if (rawCfg.env && typeof rawCfg.env === 'object' && Object.keys(rawCfg.env).length > 0) {
    out.env = {};
    for (const [k, v] of Object.entries(rawCfg.env)) {
      out.env[k] = typeof v === 'string' ? expandWorkspaceVars(v, workspaceRoot) : v;
    }
  }

  const headers = {};
  if (rawCfg.headers && typeof rawCfg.headers === 'object') {
    Object.assign(headers, rawCfg.headers);
  }
  if (rawCfg.http_headers && typeof rawCfg.http_headers === 'object') {
    Object.assign(headers, rawCfg.http_headers);
  }
  if (rawCfg.env_http_headers && typeof rawCfg.env_http_headers === 'object') {
    for (const [headerName, envVar] of Object.entries(rawCfg.env_http_headers)) {
      if (!headers[headerName]) headers[headerName] = `\${env:${envVar}}`;
    }
  }
  if (typeof rawCfg.bearer_token_env_var === 'string' && rawCfg.bearer_token_env_var.trim()) {
    if (!headers.Authorization) {
      headers.Authorization = `Bearer \${env:${rawCfg.bearer_token_env_var.trim()}}`;
    }
  }
  if (Object.keys(headers).length > 0) {
    out.headers = headers;
  }

  return out;
}

export function redactServerSummary(name, source, cfg) {
  let target = null;
  let transport = 'unknown';
  if (cfg.serverUrl) {
    transport = 'http';
    try {
      const parsed = new URL(cfg.serverUrl);
      target = `${parsed.origin}${parsed.pathname}`;
    } catch {
      target = '<url>';
    }
  } else if (cfg.command) {
    transport = 'stdio';
    target = path.basename(cfg.command);
  }

  return {
    name,
    source,
    transport,
    target,
    envKeysCount: cfg.env ? Object.keys(cfg.env).length : 0,
    headerKeysCount: cfg.headers ? Object.keys(cfg.headers).length : 0
  };
}

function collectMcpFromObject(source, container, targetMap, workspaceRoot = null) {
  if (!container || typeof container !== 'object') return;
  const maps = [container.mcpServers, container.servers].filter(
    (m) => m && typeof m === 'object' && !Array.isArray(m)
  );
  for (const map of maps) {
    for (const [name, cfg] of Object.entries(map)) {
      const normalized = normalizeAntigravityServer(cfg, workspaceRoot);
      if (!normalized) continue;
      if (!targetMap.has(name)) {
        targetMap.set(name, { source, config: normalized });
      }
    }
  }
}

function discoverMcpServers(homeDir, workspaceDir) {
  const discovered = new Map();

  // 1. Claude Code
  const claudeUserJson = safeReadJson(path.join(homeDir, '.claude.json'));
  if (claudeUserJson) {
    collectMcpFromObject('claude-code', claudeUserJson, discovered);
    if (claudeUserJson.projects && typeof claudeUserJson.projects === 'object') {
      const normalizedWs = path.resolve(workspaceDir).toLowerCase();
      for (const [projPath, projCfg] of Object.entries(claudeUserJson.projects)) {
        if (path.resolve(projPath).toLowerCase() === normalizedWs) {
          collectMcpFromObject('claude-code:project', projCfg, discovered);
        }
      }
    }
  }
  collectMcpFromObject('claude-code', safeReadJson(path.join(homeDir, '.claude', 'settings.json')), discovered);
  collectMcpFromObject('claude-code:workspace', safeReadJson(path.join(workspaceDir, '.mcp.json')), discovered, workspaceDir);

  // 2. Codex
  const codexTomlPath = path.join(homeDir, '.codex', 'config.toml');
  if (fs.existsSync(codexTomlPath)) {
    const codexServers = parseCodexMcpToml(fs.readFileSync(codexTomlPath, 'utf8'));
    for (const [name, cfg] of Object.entries(codexServers)) {
      const normalized = normalizeAntigravityServer(cfg);
      if (normalized && !discovered.has(name)) {
        discovered.set(name, { source: 'codex', config: normalized });
      }
    }
  }

  // 3. Cursor
  collectMcpFromObject('cursor', safeReadJson(path.join(homeDir, '.cursor', 'mcp.json')), discovered);
  collectMcpFromObject('cursor:workspace', safeReadJson(path.join(workspaceDir, '.cursor', 'mcp.json')), discovered, workspaceDir);

  // 4. Gemini CLI
  collectMcpFromObject('gemini-cli', safeReadJson(path.join(homeDir, '.gemini', 'settings.json')), discovered);
  collectMcpFromObject('gemini-cli:workspace', safeReadJson(path.join(workspaceDir, '.gemini', 'settings.json')), discovered, workspaceDir);

  // 5. Workspace VSCode / Trinity fallbacks (lowest priority)
  collectMcpFromObject('workspace:vscode', safeReadJson(path.join(workspaceDir, '.vscode', 'mcp.json')), discovered, workspaceDir);
  collectMcpFromObject('workspace:trinity', safeReadJson(path.join(workspaceDir, 'Trinity', '.mcp.json')), discovered, path.join(workspaceDir, 'Trinity'));

  return discovered;
}

function listSkillDirs(rootDir, includeSystem) {
  const results = [];
  if (!fs.existsSync(rootDir)) return results;

  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') && !(includeSystem && entry.name === '.system')) continue;
    const candidate = path.join(rootDir, entry.name);
    if (fs.existsSync(path.join(candidate, 'SKILL.md'))) {
      results.push({ name: entry.name, dir: candidate });
    } else if (includeSystem && entry.name === '.system') {
      results.push(...listSkillDirs(candidate, false));
    }
  }
  return results;
}

function dirContainsLikelySecret(dirPath) {
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        stack.push(full);
      } else if (entry.isFile()) {
        const stat = fs.statSync(full);
        if (stat.size > 512 * 1024) continue;
        const content = fs.readFileSync(full, 'utf8');
        if (containsLikelySecret(content)) return true;
      }
    }
  }
  return false;
}

function copyDirRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function discoverSkills(homeDir, workspaceDir, includeSystem) {
  const sources = [
    { source: 'claude-code', dir: path.join(homeDir, '.claude', 'skills') },
    { source: 'claude-code:workspace', dir: path.join(workspaceDir, '.claude', 'skills') },
    { source: 'codex', dir: path.join(homeDir, '.codex', 'skills') },
    { source: 'codex:agents', dir: path.join(homeDir, '.agents', 'skills') },
    { source: 'codex:workspace', dir: path.join(workspaceDir, '.codex', 'skills') },
    { source: 'cursor', dir: path.join(homeDir, '.cursor', 'skills') },
    { source: 'cursor:workspace', dir: path.join(workspaceDir, '.cursor', 'skills') },
    { source: 'gemini-cli', dir: path.join(homeDir, '.gemini', 'skills') },
    { source: 'gemini-cli:workspace', dir: path.join(workspaceDir, '.gemini', 'skills') },
    { source: 'workspace', dir: path.join(workspaceDir, 'skills') }
  ];

  const found = new Map();
  for (const { source, dir } of sources) {
    for (const skill of listSkillDirs(dir, includeSystem)) {
      if (!found.has(skill.name)) {
        found.set(skill.name, { name: skill.name, source, dir: skill.dir });
      }
    }
  }
  return found;
}

function normalizeInstructionMarkdown(source, fileName, rawContent) {
  const trimmed = rawContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  if (!trimmed) return '';
  const header = `<!-- Imported into Antigravity from ${source} (${fileName}) -->`;
  if (trimmed.startsWith('<!-- Imported into Antigravity')) return trimmed + '\n';
  return `${header}\n\n${trimmed}\n`;
}

function discoverInstructions(homeDir, workspaceDir) {
  const candidates = [
    { source: 'claude-code', slug: 'claude-global', filePath: path.join(homeDir, '.claude', 'CLAUDE.md') },
    { source: 'claude-code-workspace', slug: 'claude-workspace', filePath: path.join(workspaceDir, 'CLAUDE.md') },
    { source: 'claude-code-workspace', slug: 'claude-dir', filePath: path.join(workspaceDir, '.claude', 'CLAUDE.md') },
    { source: 'codex', slug: 'codex-agents', filePath: path.join(homeDir, '.codex', 'AGENTS.md') },
    { source: 'codex', slug: 'codex-instructions', filePath: path.join(homeDir, '.codex', 'instructions.md') },
    { source: 'cursor-workspace', slug: 'cursorrules', filePath: path.join(workspaceDir, '.cursorrules') },
    { source: 'gemini-cli', slug: 'gemini-global', filePath: path.join(homeDir, '.gemini', 'GEMINI.md') }
  ];

  const cursorRuleDirs = [
    { source: 'cursor', dir: path.join(homeDir, '.cursor', 'rules') },
    { source: 'cursor-workspace', dir: path.join(workspaceDir, '.cursor', 'rules') }
  ];

  for (const { source, dir } of cursorRuleDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!/\.(md|mdc)$/i.test(entry.name)) continue;
      const base = entry.name.replace(/\.(md|mdc)$/i, '');
      candidates.push({
        source,
        slug: `cursor-rule-${slugify(base)}`,
        filePath: path.join(dir, entry.name)
      });
    }
  }

  const results = [];
  const seenHashes = new Set();

  for (const item of candidates) {
    if (!fs.existsSync(item.filePath)) continue;
    const stat = fs.statSync(item.filePath);
    if (!stat.isFile() || stat.size === 0 || stat.size > 512 * 1024) continue;
    const raw = fs.readFileSync(item.filePath, 'utf8');
    const normalized = normalizeInstructionMarkdown(item.source, path.basename(item.filePath), raw);
    if (!normalized) continue;
    const contentHash = sha256(raw.replace(/\r\n/g, '\n').trim());
    if (seenHashes.has(contentHash)) continue;
    seenHashes.add(contentHash);
    results.push({
      source: item.source,
      slug: item.slug,
      fileName: `imported-${slugify(item.source)}-${slugify(item.slug)}.md`,
      filePath: item.filePath,
      content: normalized,
      hasLikelySecret: containsLikelySecret(raw)
    });
  }

  return results;
}

export function importToAntigravity(options = {}) {
  const homeDir = path.resolve(options.homeDir || os.homedir());
  const workspaceDir = path.resolve(options.workspaceDir || process.cwd());
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);
  const syncRepo = Boolean(options.syncRepo);
  const includeSystem = Boolean(options.includeSystem);

  const antigravityDir = path.join(homeDir, '.gemini', 'antigravity');
  const mcpConfigPath = path.join(antigravityDir, 'mcp_config.json');
  const globalSkillsDir = path.join(antigravityDir, 'skills');
  const globalRulesDir = path.join(antigravityDir, 'rules');
  const repoSkillsDir = path.join(workspaceDir, '.agents', 'skills');
  const repoImportedRulesDir = path.join(workspaceDir, '.agents', 'rules', 'imported');

  const report = {
    mode: dryRun ? 'dry-run' : 'apply',
    syncRepo,
    antigravityDir,
    mcp: { imported: [], skippedExisting: [], backupPath: null },
    skills: { importedGlobal: [], skippedGlobal: [], syncedRepo: [], blockedSecretRepo: [] },
    instructions: { importedGlobal: [], skippedGlobal: [], syncedRepo: [], blockedSecretRepo: [] }
  };

  // 1. MCP Servers -> ~/.gemini/antigravity/mcp_config.json
  const discoveredMcp = discoverMcpServers(homeDir, workspaceDir);
  const existingMcpJson = safeReadJson(mcpConfigPath) || { mcpServers: {} };
  if (!existingMcpJson.mcpServers || typeof existingMcpJson.mcpServers !== 'object') {
    existingMcpJson.mcpServers = {};
  }

  let mcpChanged = false;
  for (const [name, entry] of discoveredMcp.entries()) {
    const exists = Object.hasOwn(existingMcpJson.mcpServers, name);
    if (exists && !force) {
      report.mcp.skippedExisting.push(redactServerSummary(name, entry.source, entry.config));
      continue;
    }
    existingMcpJson.mcpServers[name] = entry.config;
    mcpChanged = true;
    report.mcp.imported.push(redactServerSummary(name, entry.source, entry.config));
  }

  if (mcpChanged && !dryRun) {
    fs.mkdirSync(antigravityDir, { recursive: true });
    if (fs.existsSync(mcpConfigPath)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${mcpConfigPath}.bak-${stamp}`;
      fs.copyFileSync(mcpConfigPath, backupPath);
      report.mcp.backupPath = backupPath;
    }
    fs.writeFileSync(mcpConfigPath, JSON.stringify(existingMcpJson, null, 2) + '\n', 'utf8');
  }

  // 2. Skills -> ~/.gemini/antigravity/skills/ (+ optional <workspace>/.agents/skills/)
  const discoveredSkills = discoverSkills(homeDir, workspaceDir, includeSystem);
  for (const [name, skill] of discoveredSkills.entries()) {
    const globalTarget = path.join(globalSkillsDir, name);
    const sameAsGlobal = path.resolve(skill.dir) === path.resolve(globalTarget);

    if (!sameAsGlobal) {
      if (fs.existsSync(globalTarget) && !force) {
        report.skills.skippedGlobal.push({ name, source: skill.source });
      } else {
        if (!dryRun) copyDirRecursive(skill.dir, globalTarget);
        report.skills.importedGlobal.push({ name, source: skill.source });
      }
    }

    if (syncRepo) {
      const repoTarget = path.join(repoSkillsDir, name);
      const sameAsRepo = path.resolve(skill.dir) === path.resolve(repoTarget);
      if (!sameAsRepo && (!fs.existsSync(repoTarget) || force)) {
        if (dirContainsLikelySecret(skill.dir)) {
          report.skills.blockedSecretRepo.push({ name, source: skill.source, reason: 'secret-pattern-detected' });
        } else {
          if (!dryRun) copyDirRecursive(skill.dir, repoTarget);
          report.skills.syncedRepo.push({ name, source: skill.source });
        }
      }
    }
  }

  // 3. Instructions -> ~/.gemini/antigravity/rules/ (+ optional <workspace>/.agents/rules/imported/)
  const discoveredInstructions = discoverInstructions(homeDir, workspaceDir);
  for (const inst of discoveredInstructions) {
    const globalTarget = path.join(globalRulesDir, inst.fileName);
    const existsGlobal = fs.existsSync(globalTarget);
    const identicalGlobal = existsGlobal && fs.readFileSync(globalTarget, 'utf8') === inst.content;

    if (identicalGlobal || (existsGlobal && !force)) {
      report.instructions.skippedGlobal.push({ file: inst.fileName, source: inst.source });
    } else {
      if (!dryRun) {
        fs.mkdirSync(globalRulesDir, { recursive: true });
        fs.writeFileSync(globalTarget, inst.content, 'utf8');
      }
      report.instructions.importedGlobal.push({ file: inst.fileName, source: inst.source });
    }

    if (syncRepo) {
      if (inst.hasLikelySecret) {
        report.instructions.blockedSecretRepo.push({
          file: inst.fileName,
          source: inst.source,
          reason: 'secret-pattern-detected'
        });
      } else {
        const repoTarget = path.join(repoImportedRulesDir, inst.fileName);
        const existsRepo = fs.existsSync(repoTarget);
        const identicalRepo = existsRepo && fs.readFileSync(repoTarget, 'utf8') === inst.content;
        if (!identicalRepo && (!existsRepo || force)) {
          if (!dryRun) {
            fs.mkdirSync(repoImportedRulesDir, { recursive: true });
            fs.writeFileSync(repoTarget, inst.content, 'utf8');
          }
          report.instructions.syncedRepo.push({ file: inst.fileName, source: inst.source });
        }
      }
    }
  }

  return report;
}

function parseCliArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--sync-repo') opts.syncRepo = true;
    else if (arg === '--include-system') opts.includeSystem = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--home' && argv[i + 1]) opts.homeDir = argv[++i];
    else if (arg === '--workspace' && argv[i + 1]) opts.workspaceDir = argv[++i];
  }
  return opts;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const opts = parseCliArgs(process.argv.slice(2));
  const report = importToAntigravity(opts);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[Antigravity Import] mode=${report.mode} syncRepo=${report.syncRepo}`);
    console.log(`  MCP imported: ${report.mcp.imported.length} (skipped existing: ${report.mcp.skippedExisting.length})`);
    for (const s of report.mcp.imported) {
      console.log(`    + ${s.name} [${s.source}] (${s.transport}: ${s.target})`);
    }
    console.log(`  Skills imported globally: ${report.skills.importedGlobal.length} (skipped: ${report.skills.skippedGlobal.length}, repo synced: ${report.skills.syncedRepo.length}, blocked secrets: ${report.skills.blockedSecretRepo.length})`);
    for (const s of report.skills.importedGlobal) {
      console.log(`    + ${s.name} [${s.source}]`);
    }
    console.log(`  Instructions imported globally: ${report.instructions.importedGlobal.length} (skipped: ${report.instructions.skippedGlobal.length}, repo synced: ${report.instructions.syncedRepo.length}, blocked secrets: ${report.instructions.blockedSecretRepo.length})`);
    for (const i of report.instructions.importedGlobal) {
      console.log(`    + ${i.file} [${i.source}]`);
    }
    if (report.mcp.backupPath) {
      console.log(`  Backup created: ${report.mcp.backupPath}`);
    }
  }
}
