#!/usr/bin/env node
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {accessHeaders, resolveEnvCredentials, validateOrigin} from './lib/cloudflare-access.mjs';

export const TARGET_ORIGINS = ['https://auru.space', 'https://auru.dev'];
export const EXPECTED_TOOL_COUNT = 48;

const MCP_INIT_PAYLOAD = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'codex-mcp-verification', version: '1.0.0' }
  }
};

export async function runProbe(url, init = {}, fetcher = fetch) {
  const response = await fetcher(url, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(20000)
  });
  const location = response.headers.get('location') || '';
  const isAccessRedirect = response.status === 302 && location.includes('.cloudflareaccess.com');
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  let json = null;
  try {
    const dataLines = text.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).filter(Boolean);
    json = dataLines.length ? JSON.parse(dataLines.at(-1)) : JSON.parse(text);
  } catch {
    // Non-JSON response
  }
  return { status: response.status, location, isAccessRedirect, contentType, text, json };
}

export async function verifyOriginPublic(origin, { fetcher = fetch } = {}) {
  origin = validateOrigin(origin);
  const result = {
    origin,
    health: { ok: false, status: null },
    ready: { ok: false, status: null },
    unauthenticatedMcpBlocked: { ok: false, status: null },
    errors: []
  };

  // 1. Public GET /health -> HTTP 200 JSON with ok: true
  try {
    const health = await runProbe(origin + '/health', { headers: { Accept: 'application/json' } }, fetcher);
    const healthOk = health.status === 200 && health.json?.ok === true;
    result.health = {
      ok: healthOk,
      status: health.status,
      service: typeof health.json?.service === 'string' ? health.json.service : null,
      version: typeof health.json?.version === 'string' ? health.json.version : null,
      environment: typeof health.json?.environment === 'string' ? health.json.environment : null,
      agents: typeof health.json?.agents === 'number' ? health.json.agents : null,
      deployment_id: typeof health.json?.deployment?.id === 'string' ? health.json.deployment.id : null,
      deployment_tag: health.json?.deployment?.tag ?? null
    };
    if (!healthOk) {
      result.errors.push(`Expected GET /health to return HTTP 200 JSON with ok:true, got HTTP ${health.status}`);
    }
  } catch (err) {
    result.errors.push(`Public /health probe failed: ${err.message}`);
  }

  // 2. Public GET /ready -> HTTP 200 JSON with ready: true
  try {
    const ready = await runProbe(origin + '/ready', { headers: { Accept: 'application/json' } }, fetcher);
    const readyOk = ready.status === 200 && ready.json?.ready === true;
    result.ready = {
      ok: readyOk,
      status: ready.status,
      ready: typeof ready.json?.ready === 'boolean' ? ready.json.ready : null,
      checks: ready.json?.checks && typeof ready.json.checks === 'object' ? ready.json.checks : null
    };
    if (!readyOk) {
      result.errors.push(`Expected GET /ready to return HTTP 200 JSON with ready:true, got HTTP ${ready.status}`);
    }
  } catch (err) {
    result.errors.push(`Public /ready probe failed: ${err.message}`);
  }

  // 3. Unauthenticated POST /mcp -> HTTP 401 JSON (never 200)
  try {
    const mcp = await runProbe(origin + '/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify(MCP_INIT_PAYLOAD)
    }, fetcher);
    const blocked = mcp.status === 401 && Boolean(mcp.json && typeof mcp.json === 'object' && typeof mcp.json.error === 'string');
    result.unauthenticatedMcpBlocked = {
      ok: blocked,
      status: mcp.status,
      json_error: typeof mcp.json?.error === 'string' ? mcp.json.error : null
    };
    if (!blocked) {
      result.errors.push(`Expected unauthenticated POST /mcp to return HTTP 401 JSON, got HTTP ${mcp.status}`);
    }
  } catch (err) {
    result.errors.push(`Unauthenticated POST /mcp probe failed: ${err.message}`);
  }

  result.ok = result.health.ok && result.ready.ok && result.unauthenticatedMcpBlocked.ok && result.errors.length === 0;
  return result;
}

export async function verifyOrigin(origin, env, { fetcher = fetch } = {}) {
  origin = validateOrigin(origin);
  const publicChecks = await verifyOriginPublic(origin, { fetcher });
  const results = {
    origin,
    publicHealthPassed: publicChecks.health.ok,
    publicReadyPassed: publicChecks.ready.ok,
    anonymousBlocked: publicChecks.unauthenticatedMcpBlocked.ok,
    authenticatedPassed: false,
    mcpInitialized: false,
    mcpToolsListed: false,
    toolsCount: 0,
    diagnosticPingPassed: false,
    version: publicChecks.health.version,
    environment: publicChecks.health.environment,
    agents: publicChecks.health.agents,
    errors: [...publicChecks.errors]
  };

  let cfHeaders = {};
  try {
    cfHeaders = accessHeaders(env);
  } catch (err) {
    results.errors.push(`Cloudflare Access credential error: ${err.code || err.message}`);
  }
  const mcpToken = env.TRINITY_MCP_API_KEY || env.TRINITY_MCP_TOKEN;

  // Authenticated probe on /health & /ready (passes through Access when headers configured -> 200 OK)
  try {
    const auth = await runProbe(origin + '/health', { headers: { ...cfHeaders, Accept: 'application/json' } }, fetcher);
    const ready = await runProbe(origin + '/ready', { headers: { ...cfHeaders, Accept: 'application/json' } }, fetcher);
    if (auth.status === 200 && auth.json?.ok === true && (auth.json?.status === 'serving' || auth.json?.version) && ready.status === 200 && ready.json?.ready === true) {
      results.authenticatedPassed = true;
      results.version = auth.json.version;
      results.environment = auth.json.environment;
      results.agents = auth.json.agents;
    } else {
      results.errors.push(`Expected authenticated probe to return HTTP 200 OK with ok:true/ready:true (health: ${auth.status}, ready: ${ready.status})`);
    }
  } catch (err) {
    results.errors.push(`Authenticated probe failed: ${err.message}`);
  }

  if (!mcpToken) {
    results.errors.push('Missing TRINITY_MCP_TOKEN or TRINITY_MCP_API_KEY for authenticated MCP verification (use --public-only for read-only public probes).');
    results.success = false;
    return results;
  }

  // MCP JSON-RPC 2.0 initialize probe
  const mcpHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    ...cfHeaders,
    Authorization: `Bearer ${mcpToken}`
  };

  try {
    const initRes = await runProbe(origin + '/mcp', {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify(MCP_INIT_PAYLOAD)
    }, fetcher);

    if (initRes.status === 200 && initRes.json?.result?.serverInfo?.name === 'trinity') {
      results.mcpInitialized = true;
      results.serverInfo = initRes.json.result.serverInfo;
      results.protocolVersion = initRes.json.result.protocolVersion;
    } else {
      results.errors.push(`MCP initialize probe failed: HTTP ${initRes.status}`);
    }
  } catch (err) {
    results.errors.push(`MCP initialize request failed: ${err.message}`);
  }

  // MCP JSON-RPC 2.0 tools/list probe
  try {
    const toolsPayload = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };
    const toolsRes = await runProbe(origin + '/mcp', {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify(toolsPayload)
    }, fetcher);

    if (toolsRes.status === 200 && Array.isArray(toolsRes.json?.result?.tools)) {
      results.mcpToolsListed = true;
      results.toolsCount = toolsRes.json.result.tools.length;
      results.toolNames = toolsRes.json.result.tools.map(t => t.name);
      if (results.toolsCount !== EXPECTED_TOOL_COUNT) {
        results.errors.push(`Expected ${EXPECTED_TOOL_COUNT} tools, found ${results.toolsCount}`);
      }
    } else {
      results.errors.push(`MCP tools/list probe failed: HTTP ${toolsRes.status}`);
    }
  } catch (err) {
    results.errors.push(`MCP tools/list request failed: ${err.message}`);
  }

  // MCP diagnostic_ping execution
  try {
    const pingPayload = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'diagnostic_ping',
        arguments: { message: 'verification-ping' }
      }
    };
    const pingRes = await runProbe(origin + '/mcp', {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify(pingPayload)
    }, fetcher);

    if (pingRes.status === 200 && (pingRes.json?.result || !pingRes.json?.error)) {
      results.diagnosticPingPassed = true;
    } else {
      results.errors.push(`MCP diagnostic_ping call failed: HTTP ${pingRes.status}`);
    }
  } catch (err) {
    results.errors.push(`MCP diagnostic_ping request failed: ${err.message}`);
  }

  results.success = results.publicHealthPassed &&
                    results.publicReadyPassed &&
                    results.anonymousBlocked &&
                    results.authenticatedPassed &&
                    results.mcpInitialized &&
                    results.mcpToolsListed &&
                    results.toolsCount === EXPECTED_TOOL_COUNT &&
                    results.diagnosticPingPassed &&
                    results.errors.length === 0;

  return results;
}

export async function runPublicOnlyVerification(origins = TARGET_ORIGINS, { fetcher = fetch } = {}) {
  const checkedAt = new Date().toISOString();
  const originReceipts = [];
  for (const origin of origins) {
    originReceipts.push(await verifyOriginPublic(origin, { fetcher }));
  }
  const ok = originReceipts.length > 0 && originReceipts.every(r => r.ok);
  return {
    mode: 'public-only',
    read_only: true,
    secrets_printed: false,
    checked_at: checkedAt,
    expected_tool_count: EXPECTED_TOOL_COUNT,
    ok,
    origins: originReceipts
  };
}

async function main() {
  const args = process.argv.slice(2);
  let requestedOrigin = null;
  let publicOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--origin' && args[i + 1]) requestedOrigin = args[++i];
    else if (args[i] === '--public-only') publicOnly = true;
  }

  const origins = requestedOrigin ? [requestedOrigin] : TARGET_ORIGINS;

  if (publicOnly) {
    const receipt = await runPublicOnlyVerification(origins);
    console.log(JSON.stringify(receipt, null, 2));
    process.exit(receipt.ok ? 0 : 1);
  }

  const env = resolveEnvCredentials(process.env);

  console.log('='.repeat(70));
  console.log('TRINITY CODEX MCP & CLOUDFLARE ACCESS VERIFICATION');
  console.log('='.repeat(70));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Cloudflare Access Client ID: ${(env.CLOUDFLARE_ACCESS_CLIENT_ID || env.CF_ACCESS_CLIENT_ID) ? 'Configured [REDACTED]' : 'Not configured'}`);
  console.log(`Cloudflare Access Client Secret: ${(env.CLOUDFLARE_ACCESS_CLIENT_SECRET || env.CF_ACCESS_CLIENT_SECRET) ? 'Configured [REDACTED]' : 'Not configured'}`);
  console.log(`Trinity MCP API Key: ${(env.TRINITY_MCP_API_KEY || env.TRINITY_MCP_TOKEN) ? 'Configured [REDACTED]' : 'MISSING'}`);
  console.log('-'.repeat(70));

  let overallSuccess = true;

  for (const origin of origins) {
    console.log(`\nProbing Target: ${origin}`);
    const res = await verifyOrigin(origin, env);

    console.log(`  [1] Public Health & Ready (/health, /ready): ${(res.publicHealthPassed && res.publicReadyPassed) ? `PASS (HTTP 200 OK, v${res.version}, ${res.agents} agents)` : 'FAIL'}`);
    console.log(`  [2] Unauthenticated /mcp Gate: ${res.anonymousBlocked ? 'PASS (HTTP 401 JSON enforced)' : 'FAIL'}`);
    console.log(`  [3] Authenticated Health & Ready: ${res.authenticatedPassed ? 'PASS (HTTP 200 OK)' : 'FAIL'}`);
    console.log(`  [4] MCP Handshake (initialize): ${res.mcpInitialized ? `PASS (${res.serverInfo?.name} v${res.serverInfo?.version})` : 'FAIL'}`);
    console.log(`  [5] MCP Tool Catalog (tools/list): ${res.mcpToolsListed ? `PASS (${res.toolsCount}/${EXPECTED_TOOL_COUNT} tools registered)` : 'FAIL'}`);
    console.log(`  [6] Safe Tool Invocation (diagnostic_ping): ${res.diagnosticPingPassed ? 'PASS (Executed successfully)' : 'FAIL'}`);

    if (!res.success) {
      overallSuccess = false;
      console.log('  Errors:');
      for (const err of res.errors) {
        console.log(`    - ${err}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  if (overallSuccess) {
    console.log('RESULT: ALL MCP AND CLOUDFLARE ACCESS CHECKS PASSED (100%)');
    console.log('='.repeat(70));
    process.exit(0);
  } else {
    console.log('RESULT: VERIFICATION FAILED');
    console.log('='.repeat(70));
    process.exit(1);
  }
}

const isMainModule = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  main().catch(err => {
    console.error('Fatal verification runner error:', err.message);
    process.exit(1);
  });
}
