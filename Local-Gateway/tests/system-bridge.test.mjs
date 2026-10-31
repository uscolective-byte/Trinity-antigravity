import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createSystemBridgeServer } from '../src/system-bridge.mjs';

test('System Bridge (Port 7788): /api/status vracia ONLINE s overeným Windows SID Basterixa a /api/omnidev/diagnose opravuje OmniDev Studio', async () => {
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trinity-bridge-7788-'));
  const server = await createSystemBridgeServer({ port: 0, dataDir: tmpDataDir });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Test /api/status
    const statusRes = await fetch(`${baseUrl}/api/status`);
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.equal(statusData.status, 'ONLINE');
    assert.equal(statusData.omnidev_studio.status, 'READY');
    assert.equal(statusData.root_registry.architect_alias, 'Basterix');

    // 2. Test /api/omnidev/diagnose
    const diagRes = await fetch(`${baseUrl}/api/omnidev/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        errorText: 'SyntaxError: Expected corresponding JSX closing tag for <div> at Studio.jsx:14:5',
        filePath: 'Trinity/src/studio.js',
        sourceCode: 'export function App() { return <div><span>OmniDev</span>; }'
      })
    });
    assert.equal(diagRes.status, 200);
    const diagData = await diagRes.json();
    assert.equal(diagData.status, 'DIAGNOSED');
    assert.equal(diagData.omnidev_studio, 'RECOVERED');
    assert.equal(diagData.diagnosis.category, 'UNCLOSED_TAG_OR_JSX');
    assert.ok(diagData.recoveryPlan.gitDiff.includes('--- a/Trinity/src/studio.js'));

    // 3. Test zablokovania podvrhnutého emailu bez tokenu na /api/execute-privileged
    const blockedRes = await fetch(`${baseUrl}/api/execute-privileged`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'saboivan2008@gmail.com',
        action: 'READ_WORKSPACE'
      })
    });
    assert.equal(blockedRes.status, 403);
    const blockedData = await blockedRes.json();
    assert.match(blockedData.error, /ACCESS DENIED.*UNVERIFIED_GOOGLE_OAUTH_TOKEN/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
