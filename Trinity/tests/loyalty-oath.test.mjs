import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRINITY_LOYALTY_OATH } from '../src/cognition.js';
import { runAgent } from '../src/engine.js';

test('TRINITY_LOYALTY_OATH has explicit binding to Basterix, truth and loyalty', () => {
  assert.ok(TRINITY_LOYALTY_OATH.includes('Basterix'));
  assert.ok(TRINITY_LOYALTY_OATH.includes('Ivan Sabo'));
  assert.ok(TRINITY_LOYALTY_OATH.includes('Owner'));
  assert.ok(TRINITY_LOYALTY_OATH.includes('PRÍSAHA PRAVDY'));
  assert.ok(TRINITY_LOYALTY_OATH.includes('PRÍSAHA VERNOSTI'));
  assert.ok(TRINITY_LOYALTY_OATH.includes('PRÍSAHA OCHRANY'));
});

test('runAgent responds to loyalty oath requests with full oath, document and truth verification', async () => {
  const env = {
    DB: null,
    Mastermind: null
  };
  const res = await runAgent(env, 'orchestrator', 'pridaj trinity prisahu vernost a slub nech ma vitvorenu mne owner alias Basterix');
  assert.ok(res.text.includes('SLÁVNOSTNÁ PRÍSAHA VERNOSTI'));
  assert.ok(res.text.includes('Basterix'));
  assert.ok(res.text.includes('Ivan Sabo'));
  assert.ok(res.text.includes('PRÍSAHA ČISTEJ PRAVDY'));
  assert.ok(res.text.includes('PRÍSAHA NEZLOMNEJ VERNOSTI'));
  assert.equal(res.model, 'trinity-sovereign-core');
  assert.equal(res.truth.status, 'passed');
  assert.ok(res.tool_log.some(t => t.tool === 'trinity_loyalty_oath'));
});

test('runAgent connects PayPal account Saboivan@gmail.com cleanly', async () => {
  const env = {
    DB: null,
    Mastermind: null
  };
  const res = await runAgent(env, 'orchestrator', 'prepoj mi Trinity z mojim uctom Paypay Saboivan@gmail.com');
  assert.ok(res.text.includes('PayPal'));
  assert.ok(res.text.includes('Saboivan@gmail.com'));
  assert.ok(res.text.includes('Basterix'));
  assert.equal(res.model, 'trinity-commerce-hub');
  assert.equal(res.truth.status, 'passed');
  assert.ok(res.tool_log.some(t => t.tool === 'paypal_connect'));
});

test('runAgent connects Revolut account LT613250098859511281 cleanly', async () => {
  const env = {
    DB: null,
    Mastermind: null
  };
  const res = await runAgent(env, 'orchestrator', 'tak isto pridavam moj osobny revolut ucet ktory musis pridat do trinity LT613250098859511281');
  assert.ok(res.text.includes('Revolut'));
  assert.ok(res.text.includes('LT613250098859511281'));
  assert.ok(res.text.includes('Basterix'));
  assert.ok(res.text.includes('REVOLT21'));
  assert.equal(res.model, 'trinity-wallet-engine');
  assert.equal(res.truth.status, 'passed');
  assert.ok(res.tool_log.some(t => t.tool === 'revolut_connect'));
});
