import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePhoneBridgePage } from '../src/phone-bridge-ui.js';

test('Android/iPhone phone page explicitly disclaims pairing and remote execution', async () => {
  const result = handlePhoneBridgePage(new Request('https://auru.space/phone'));
  assert.equal(result.status, 200);
  assert.match(result.headers.get('Content-Security-Policy'), /connect-src 'none'/);
  assert.match(result.headers.get('Content-Security-Policy'), /script-src 'self'/);
  const body = await result.text();
  assert.match(body, /nezapárované/);
  assert.match(body, /Nebolo odoslané|neodosiela/);
  assert.match(body, /bridge\.js/);
});

test('phone browser script uses user gesture, reports unknown states', async () => {
  const res = handlePhoneBridgePage(new Request('https://auru.space/phone/bridge.js'));
  assert.equal(res.status, 200);
  const js = await res.text();
  assert.match(js, /addEventListener\('click'/);
  assert.match(js, /getBattery/);
  assert.match(js, /Vyžiadať GPS|geolocation/);
  assert.match(js, /Uloženie súboru ešte nie je overené/);
  assert.doesNotMatch(js, /eval\(|new Function\(/);
});

test('non-phone routes and non-GET requests are not intercepted', () => {
  assert.equal(handlePhoneBridgePage(new Request('https://auru.space/api/phone')), null);
  assert.equal(handlePhoneBridgePage(new Request('https://auru.space/phone', { method: 'POST' })), null);
});
