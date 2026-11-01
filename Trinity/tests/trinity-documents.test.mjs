import test from 'node:test';
import assert from 'node:assert/strict';
import { listTrinityDocuments, getTrinityDocument, SEED_COMPLIANCE_DOCUMENTS } from '../src/trinity-documents.js';

test('trinity-documents: SEED_COMPLIANCE_DOCUMENTS obsahuje kompletnú sadu kľúčových dokumentov', () => {
  const ids = SEED_COMPLIANCE_DOCUMENTS.map(d => d.id);
  assert.ok(ids.includes('trinity-gdpr-privacy-consent'), 'Obsahuje GDPR');
  assert.ok(ids.includes('trinity-kompletna-dokumentacia'), 'Obsahuje kompletnú dokumentáciu');
  assert.ok(ids.includes('trinity-omni-dev-studio-sprievodca'), 'Obsahuje Omni-Dev sprievodcu');
  assert.ok(ids.includes('trinity-meta-ai-social-manual'), 'Obsahuje Meta manuál');
  assert.ok(ids.includes('trinity-desatoro-pravdivosti'), 'Obsahuje Desatoro pravdivosti');
  assert.ok(ids.includes('trinity-aktualny-stav-systemu'), 'Obsahuje Aktuálny stav');
});

test('trinity-documents: listTrinityDocuments vracia seed dokumenty aj bez D1/KV', async () => {
  const mockEnv = {};
  const res = await listTrinityDocuments(mockEnv, { limit: 50 });
  assert.ok(Array.isArray(res.items));
  assert.ok(res.items.length >= 6);
  assert.ok(res.categories.includes('legal_compliance'));
  assert.ok(res.categories.includes('architecture'));
  assert.ok(res.categories.includes('manual_doc'));
});

test('trinity-documents: getTrinityDocument nájde seed dokument podľa ID', async () => {
  const mockEnv = {};
  const doc = await getTrinityDocument(mockEnv, 'trinity-kompletna-dokumentacia');
  assert.ok(doc);
  assert.equal(doc.id, 'trinity-kompletna-dokumentacia');
  assert.ok(doc.content.includes('OMNI-CORE'));
  assert.ok(doc.export_md_url);
  assert.ok(doc.export_pdf_url);
});
