import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

test('Atelier v17.0 Obsidian & Champagne UI shell and assets are consistent', async () => {
  const [chatHtml, garageCss, mobileCss, indexJs] = await Promise.all([
    fs.readFile(path.join(rootDir, 'public/assistant/chat.html'), 'utf8'),
    fs.readFile(path.join(rootDir, 'public/assistant/garage.css'), 'utf8'),
    fs.readFile(path.join(rootDir, 'public/assistant/mobile.css'), 'utf8'),
    fs.readFile(path.join(rootDir, 'src/index.js'), 'utf8'),
  ]);

  // 1. Body shell and Studio branding preserved
  assert.match(chatHtml, /<body\s+class="studio-ui"\s+data-atelier="v17\.0">/);
  assert.ok(chatHtml.includes('<small>AI STUDIO</small>'));
  assert.ok(chatHtml.includes('id="nav-more-drawer"'));
  assert.ok(chatHtml.includes('class="atelier-topbar"'));
  assert.ok(chatHtml.includes('class="atelier-welcome-hero"'));

  // 2. Obsidian & Champagne tokens in CSS
  assert.ok(garageCss.includes('#09090b'), 'garage.css must define Obsidian #09090b');
  assert.ok(garageCss.includes('#d6b676'), 'garage.css must define Champagne #d6b676');
  assert.ok(garageCss.includes('--trinity-live-primary'), 'garage.css must define --trinity-live-primary');
  assert.ok(garageCss.includes('[data-theme="light"]'), 'garage.css must define light theme');
  assert.ok(garageCss.includes('.nav-more-drawer'), 'garage.css must style .nav-more-drawer');

  // 3. Zero legacy Telegram hexes
  const legacyHexes = ['#0e1621', '#17212b', '#3390ec', '#0098ea'];
  for (const hex of legacyHexes) {
    assert.ok(!garageCss.toLowerCase().includes(hex), `garage.css must not contain legacy hex ${hex}`);
    assert.ok(!mobileCss.toLowerCase().includes(hex), `mobile.css must not contain legacy hex ${hex}`);
    assert.ok(!chatHtml.toLowerCase().includes(hex), `chat.html must not contain legacy hex ${hex}`);
  }

  // 4. Google Fonts CSP in src/index.js
  assert.ok(indexJs.includes('https://fonts.googleapis.com'), 'index.js CSP must allow fonts.googleapis.com');
  assert.ok(indexJs.includes('https://fonts.gstatic.com'), 'index.js CSP must allow fonts.gstatic.com');
});
