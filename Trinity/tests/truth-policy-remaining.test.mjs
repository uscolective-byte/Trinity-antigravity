import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { TRINITY_VERSION } from '../src/version.js';
import { AGENTS } from '../src/registry.js';
import { calculateSupportResistance, checkPriceAlerts, createPriceAlert } from '../src/banking-commodity-advanced.js';
import { domainProvisionSchema, provisionAgentDomain } from '../src/agent-sandbox.js';
import { dataverseSkills, integrationSkills, coreCatalogSkills } from '../src/skillRegistry.js';
import { universalEcosystem } from '../src/universal-ecosystem.js';
import { SkillForge } from '../src/v4/SkillForge.js';
import { EvoEngineV3 } from '../src/v4/EvoEngineV3.js';

function loadDistModules() {
  const modules = readdirSync('dist')
    .filter(x => !x.endsWith('.map') && !x.endsWith('.md'))
    .map(name => ({
      type: name === 'index.js' ? 'ESModule' : 'Text',
      path: resolve('dist', name)
    }));
  modules.sort((a, b) => (a.type === 'ESModule' ? -1 : b.type === 'ESModule' ? 1 : 0));
  return modules;
}

test('Truth Policy — Commodity Price Alerts never use static base_price as spot price', async () => {
  const staticOnly = calculateSupportResistance({ symbol: 'XAU-EUR', base_price: 2645 });
  assert.equal(staticOnly.support, null);
  assert.equal(staticOnly.resistance, null);
  assert.equal(staticOnly.live_price_unavailable, true);

  let updated = false;
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            async run() {
              if (sql.includes('UPDATE commodity_price_alerts')) updated = true;
              return { success: true };
            }
          };
        },
        async all() {
          if (sql.includes("FROM commodity_price_alerts WHERE status = 'active'")) {
            return {
              results: [{ id: 'alt-static', symbol: 'XAU-EUR', condition: 'below', target_price: 9999, status: 'active' }]
            };
          }
          return { results: [] };
        }
      };
    }
  };

  const offlineFetch = async () => { throw new Error('network offline'); };
  const skipped = await checkPriceAlerts({ DB: db }, { notify: false, fetchImpl: offlineFetch });
  assert.equal(skipped.triggered_count, 0);
  assert.equal(skipped.skipped_count, 1);
  assert.equal(skipped.status, 'live_price_unavailable');
  assert.equal(skipped.skipped[0].status, 'live_price_unavailable');
  assert.equal(updated, false);

  const created = await createPriceAlert({ DB: db }, 'admin', {
    symbol: 'XAU-EUR',
    condition: 'below',
    target_price: 2500
  }, { fetchLive: false });
  assert.equal(created.current_price, null);
  assert.equal(created.live_price_status, 'live_price_unavailable');

  const liveRes = await checkPriceAlerts({ DB: db }, { notify: false, liveQuotes: { 'XAU-EUR': 2500 } });
  assert.equal(liveRes.triggered_count, 1);
  assert.equal(liveRes.triggered[0].price, 2500);
  assert.equal(updated, true);
});

test('Truth Policy — agent-sandbox.js fails closed without CF_API_TOKEN/zone, defaults target_worker to trinity, and never fabricates cf_mock_zone_*', async () => {
  const parsed = domainProvisionSchema.parse({ domain_name: 'agent.example.com', agent_id: 'my-agent' });
  assert.equal(parsed.target_worker, 'trinity');

  await assert.rejects(
    provisionAgentDomain({}, 'owner-1', { domain_name: 'agent.example.com', agent_id: 'my-agent' }),
    (err) => err.status === 503 && /CF_API_TOKEN/i.test(err.message)
  );

  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: true, result: [] });
  try {
    await assert.rejects(
      provisionAgentDomain({ CF_API_TOKEN: 'cf-test-tok' }, 'owner-1', { domain_name: 'missing.example.com', agent_id: 'my-agent' }),
      (err) => err.status === 404 && /zone not found/i.test(err.message)
    );
  } finally {
    globalThis.fetch = realFetch;
  }

  globalThis.fetch = async () => Response.json({
    success: true,
    result: [{ id: 'real-cf-zone-id-1234', name: 'verified.example.com' }]
  });
  try {
    const res = await provisionAgentDomain({ CF_API_TOKEN: 'cf-test-tok' }, 'owner-1', { domain_name: 'verified.example.com', agent_id: 'my-agent' });
    assert.equal(res.ok, true);
    assert.equal(res.zone_id, 'real-cf-zone-id-1234');
    assert.equal(res.target_worker, 'trinity');
    assert.equal(res.status, 'zone_verified_pending_dns');
    assert.equal(res.dns_configured, false);
    assert.equal(res.ssl_configured, false);
    assert.equal(res.waf_configured, false);
    assert.doesNotMatch(res.zone_id, /^cf_mock_zone_/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Truth Policy — skillRegistry removes mock bypasses, checks PC_BRIDGE_SERVICE/PC_BRIDGE_V2, and marks coreCatalogSkills guidance-only', async () => {
  await assert.rejects(dataverseSkills.dataverseWhoAmI({}, { mock: true }), /DATAVERSE_URL/i);
  await assert.rejects(dataverseSkills.dataverseQuery('accounts', {}, { DATAVERSE_URL: 'https://org.crm.dynamics.com' }, { mock: true }), /credentials are not configured/i);
  await assert.rejects(dataverseSkills.dataverseCreateRecord('accounts', {}, { DATAVERSE_URL: 'https://org.crm.dynamics.com' }, { mock: true }), /credentials are not configured/i);
  await assert.rejects(dataverseSkills.dataverseUpdateRecord('accounts', '1', {}, { DATAVERSE_URL: 'https://org.crm.dynamics.com' }, { mock: true }), /credentials are not configured/i);
  await assert.rejects(dataverseSkills.dataverseDeleteRecord('accounts', '1', { DATAVERSE_URL: 'https://org.crm.dynamics.com' }, { mock: true }), /credentials are not configured/i);

  await assert.rejects(integrationSkills.callPowerPlatform('q', {}, { mock: true }), /POWER_PLATFORM_URL/);
  await assert.rejects(integrationSkills.generateImage('prompt', {}, { mock: true }), /Workers AI/);
  const wsRes = await integrationSkills.webSearch('trinity', {}, { mock: true });
  assert.deepEqual(wsRes.results, []);

  await assert.rejects(integrationSkills.pcRunScript('echo hi', {}, { mock: true }), /PC_BRIDGE_SERVICE/);
  const v2Res = await integrationSkills.pcRunScript('echo v2', {
    PC_BRIDGE_V2: {
      fetch: async () => Response.json({ success: true, stdout: 'v2', exit_code: 0 })
    }
  });
  assert.equal(v2Res.stdout, 'v2');

  const qr = await coreCatalogSkills['quality-review']();
  assert.equal(qr.verified, false);
  assert.equal(qr.mode, 'guidance-only');
  assert.equal(qr.quality_checklist.unit_tests_passed, false);

  const er = await coreCatalogSkills['evidence-research']({ topic: 'audit' });
  assert.equal(er.verified, false);
  assert.equal(er.mode, 'guidance-only');
  assert.notEqual(er.evidence_structure.status, 'verified');

  const mh = await coreCatalogSkills['memory-hygiene']();
  assert.equal(mh.verified, false);
  assert.equal(mh.mode, 'guidance-only');
  assert.equal(mh.hygiene_report.duplicates_pruned, false);

  const sd = await coreCatalogSkills['secure-development']();
  assert.equal(sd.verified, false);
  assert.equal(sd.mode, 'guidance-only');
});

test('Truth Policy — universal-ecosystem.js, SkillForge.js, and EvoEngineV3.js emit honest non-fabricated contracts', async () => {
  const specMeta = universalEcosystem.synthesizeSkill('AuditNoOpSpec', 'cybersecurity');
  assert.equal(specMeta.status, 'spec_proposed');
  assert.equal(specMeta.persisted, false);
  assert.equal(specMeta.executable, false);
  assert.equal(specMeta.verified, false);

  const appSpec = universalEcosystem.synthesizeApp('AuditAppSpec', 'software-dev');
  assert.equal(appSpec.status, 'spec_proposed');
  assert.equal(appSpec.persisted, false);
  assert.equal(appSpec.executable, false);
  assert.equal(appSpec.verified, false);

  const stats = universalEcosystem.getStats();
  assert.equal(stats.infinite_scale_capacity, undefined);
  assert.equal(typeof stats.total_catalog_items, 'number');

  const storageMap = new Map();
  const storage = {
    async get(k) { return storageMap.get(k); },
    async put(k, v) { storageMap.set(k, v); }
  };
  const forge1 = new SkillForge(storage, {});
  await forge1.forgeSkillFromQCE(
    { name: 'reloaded_skill', task: 'test', handler: () => ({ ok: true }) },
    { cycleId: 'c1', genome: { generation: 1 } }
  );
  const forge2 = new SkillForge(storage, {});
  const reloadedExec = await forge2.execute('reloaded_skill', { x: 1 });
  assert.equal(reloadedExec.success, false);
  assert.equal(reloadedExec.executable, false);
  assert.equal(reloadedExec.result, undefined);

  const evo = new EvoEngineV3(null, {});
  await evo.init();
  const failure = await evo.recordFailure({ cycleId: 'c-fail', error: 'boom', genome: evo.genome });
  assert.equal(failure.autoRollbackEngaged, false);
  assert.equal(failure.rollback_supported, false);
});

test('Truth Policy — /api/social/status derives from env bindings and /api/manifest matches TRINITY_VERSION & AGENTS.length', async () => {
  const modules = loadDistModules();

  // 1. Empty env -> all social channels unconfigured (never hardcoded 'active') + honest manifest
  const mfEmpty = new Miniflare(convertV4MiniflareOptions({
    workers: [{ name: 'trinity-empty', modules, compatibilityDate: '2026-10-01', compatibilityFlags: ['nodejs_compat'] }]
  }));
  try {
    const socialEmptyRes = await mfEmpty.dispatchFetch('https://auru.dev/api/social/status');
    assert.equal(socialEmptyRes.status, 200);
    const socialEmpty = await socialEmptyRes.json();
    assert.equal(socialEmpty.live_verified, false);
    for (const [channelName, channel] of Object.entries(socialEmpty.channels)) {
      assert.equal(channel.status, 'unconfigured', `${channelName} must be unconfigured without env token`);
      assert.equal(channel.configured, false);
    }

    const manifestRes = await mfEmpty.dispatchFetch('https://auru.dev/api/manifest');
    assert.equal(manifestRes.status, 200);
    const manifest = await manifestRes.json();
    assert.equal(manifest.version, TRINITY_VERSION);
    assert.equal(manifest.active_fleet, AGENTS.length);
    assert.equal(manifest.active_fleet, 46);
    assert.notEqual(manifest.version, '11.2.0-SOVEREIGN');
  } finally {
    await mfEmpty.dispose();
  }

  // 2. Configured env -> only configured channels report 'configured' (still never unverified 'active')
  const mfCfg = new Miniflare(convertV4MiniflareOptions({
    workers: [{
      name: 'trinity-cfg',
      modules,
      compatibilityDate: '2026-10-01',
      compatibilityFlags: ['nodejs_compat'],
      bindings: {
        TELEGRAM_BOT_TOKEN: 'tg-tok',
        LINKEDIN_ACCESS_TOKEN: 'li-tok',
        VIBER_AUTH_TOKEN: 'vb-tok'
      }
    }]
  }));
  try {
    const socialCfgRes = await mfCfg.dispatchFetch('https://auru.dev/api/social/status');
    assert.equal(socialCfgRes.status, 200);
    const socialCfg = await socialCfgRes.json();
    assert.equal(socialCfg.channels.telegram.status, 'configured');
    assert.equal(socialCfg.channels.linkedin.status, 'configured');
    assert.equal(socialCfg.channels.viber.status, 'configured');
    assert.equal(socialCfg.channels.whatsapp.status, 'unconfigured');
    assert.equal(socialCfg.channels.paysafe.status, 'unconfigured');
  } finally {
    await mfCfg.dispose();
  }
});
