import test from 'node:test';
import assert from 'node:assert/strict';
import { QuotaTicket, TokenBucket } from '../src/quota-governor.js';

test('Quota Governor: ticket initializes with default budget and converts to/from headers', () => {
  const ticket = new QuotaTicket({ ticketId: 'ticket-test-01', caller: 'sovereign-root' });
  assert.equal(ticket.ticketId, 'ticket-test-01');
  assert.equal(ticket.hops, 0);
  assert.equal(ticket.canForward(), true);

  const headersMap = new Map(Object.entries(ticket.toHeaders()));
  const headers = { get: (k) => headersMap.get(k) || null };

  const parsedTicket = QuotaTicket.fromHeaders(headers);
  assert.equal(parsedTicket.ticketId, 'ticket-test-01');
  assert.equal(parsedTicket.hops, 0);
});

test('Quota Governor: stops infinite agent loop when maxHops is reached', () => {
  const ticket = new QuotaTicket({ budget: { maxHops: 3 } });

  // 1. hop: Trinity -> Router
  const res1 = ticket.consume({ tokens: 100, cpuMs: 50, worker: 'trinity-core' });
  assert.equal(res1.allowed, true);
  assert.equal(ticket.hops, 1);

  // 2. hop: Router -> Jericho
  const res2 = ticket.consume({ tokens: 200, cpuMs: 80, worker: 'jericho123' });
  assert.equal(res2.allowed, true);
  assert.equal(ticket.hops, 2);

  // 3. hop: Jericho -> ProfileMaker
  const res3 = ticket.consume({ tokens: 150, cpuMs: 60, worker: 'trinity-profile' });
  assert.equal(res3.allowed, true);
  assert.equal(ticket.hops, 3);

  // 4. hop: Pokus o zacyklenie späť do Trinity -> musí byť ZABLOKOVANÝ
  const res4 = ticket.consume({ tokens: 50, cpuMs: 20, worker: 'trinity-core' });
  assert.equal(res4.allowed, false);
  assert.equal(ticket.status, 'HOPS_EXCEEDED');
  assert.match(res4.reason, /prekročil limit 3 preposlaní/);
  assert.equal(ticket.canForward(), false);
});

test('Quota Governor: stops request when token or CPU budget is depleted', () => {
  const ticket = new QuotaTicket({ initialTokens: 500, initialCpuMs: 200 });

  const res1 = ticket.consume({ tokens: 400, cpuMs: 150, worker: 'worker-1' });
  assert.equal(res1.allowed, true);
  assert.equal(ticket.remainingTokens, 100);
  assert.equal(ticket.remainingCpuMs, 50);

  const res2 = ticket.consume({ tokens: 150, cpuMs: 100, worker: 'worker-2' });
  assert.equal(res2.allowed, false);
  assert.equal(ticket.status, 'QUOTA_DEPLETED');
  assert.match(res2.reason, /Vyčerpaný rozpočet tokenov\/CPU/);
});

test('Quota Governor: TokenBucket limits consumption and refills over time', async () => {
  const bucket = new TokenBucket(100, 500); // 100 kapacita, rýchle dopĺňanie
  assert.equal(bucket.tryConsume(60), true);
  assert.equal(bucket.tryConsume(50), false, 'Nestačí kapacita pre 50');

  // Počkáme 100ms na doplnenie tokenov
  await new Promise(r => setTimeout(r, 100));
  bucket.refill();
  assert.ok(bucket.tokens >= 40, 'Tokeny sa mali doplniť');
  assert.equal(bucket.tryConsume(40), true);
});
