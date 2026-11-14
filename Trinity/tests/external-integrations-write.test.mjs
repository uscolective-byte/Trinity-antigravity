import test from 'node:test';
import assert from 'node:assert/strict';
import {
  manageCloudflare,
  manageGitHub,
  manageOneDrive,
  manageFirebase
} from '../src/external-integrations.js';

test('manageCloudflare handles create_dns_record, update_dns_record, delete_dns_record', async () => {
  const originalFetch = globalThis.fetch;
  const recorded = [];

  globalThis.fetch = async (url, opts = {}) => {
    recorded.push({ url: String(url), method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
    if (String(url).includes('/dns_records')) {
      if (opts.method === 'POST') {
        return new Response(JSON.stringify({ success: true, result: { id: 'rec_cf_1', type: 'A', name: 'sub.auru.space', content: '1.2.3.4' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (opts.method === 'PATCH') {
        return new Response(JSON.stringify({ success: true, result: { id: 'rec_cf_1', type: 'A', name: 'sub.auru.space', content: '5.6.7.8' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (opts.method === 'DELETE') {
        return new Response(JSON.stringify({ success: true, result: { id: 'rec_cf_1' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }
    return new Response(JSON.stringify({ success: false }), { status: 400 });
  };

  try {
    const mockEnv = { CF_API_TOKEN: 'test-cf-token' };
    const zoneId = '0123456789abcdef0123456789abcdef';

    // 1. Create DNS Record
    const createRes = await manageCloudflare(mockEnv, 'agent:trinity', 'create_dns_record', {
      zoneId,
      type: 'A',
      name: 'sub.auru.space',
      content: '1.2.3.4',
      ttl: 1,
      proxied: true
    });
    assert.equal(createRes.success, true);
    assert.equal(createRes.record.id, 'rec_cf_1');

    // 2. Update DNS Record
    const updateRes = await manageCloudflare(mockEnv, 'agent:trinity', 'update_dns_record', {
      zoneId,
      recordId: 'rec_cf_1',
      content: '5.6.7.8'
    });
    assert.equal(updateRes.success, true);
    assert.equal(updateRes.record.content, '5.6.7.8');

    // 3. Delete DNS Record
    const delRes = await manageCloudflare(mockEnv, 'agent:trinity', 'delete_dns_record', {
      zoneId,
      recordId: 'rec_cf_1'
    });
    assert.equal(delRes.success, true);
    assert.equal(delRes.deleted_id, 'rec_cf_1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('manageGitHub handles create_or_update_file and create_pull_request', async () => {
  const originalFetch = globalThis.fetch;
  const recorded = [];

  globalThis.fetch = async (url, opts = {}) => {
    recorded.push({ url: String(url), method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
    if (String(url).includes('/contents/')) {
      return new Response(JSON.stringify({
        content: { name: 'test.md', path: 'test.md', sha: 'blob_sha_123' },
        commit: { sha: 'commit_sha_456', message: 'test commit' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).includes('/pulls')) {
      return new Response(JSON.stringify({
        id: 101,
        number: 42,
        title: 'New Feature PR',
        state: 'open',
        html_url: 'https://github.com/uscolective-byte/Trinity-antigravity/pull/42'
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  };

  try {
    const mockEnv = { GITHUB_TOKEN: 'test-gh-token', TRINITY_GITHUB_REPO: 'uscolective-byte/Trinity-antigravity' };

    // 1. Commit file
    const fileRes = await manageGitHub(mockEnv, 'agent:trinity', 'create_or_update_file', {
      path: 'docs/test.md',
      content: '# Test document content',
      message: 'test: automated file update'
    });
    assert.equal(fileRes.success, true);
    assert.equal(fileRes.commit.sha, 'commit_sha_456');

    // 2. Open PR
    const prRes = await manageGitHub(mockEnv, 'agent:trinity', 'create_pull_request', {
      title: 'New Feature PR',
      head: 'feature-branch',
      base: 'main',
      body: 'Automated PR description'
    });
    assert.equal(prRes.success, true);
    assert.equal(prRes.pull_request.number, 42);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('manageOneDrive handles create_folder and delete_file', async () => {
  const originalFetch = globalThis.fetch;
  const recorded = [];

  globalThis.fetch = async (url, opts = {}) => {
    recorded.push({ url: String(url), method: opts.method });
    if (String(url).includes('/children') && opts.method === 'POST') {
      return new Response(JSON.stringify({
        id: 'folder_item_99',
        name: 'Trinity-Backups',
        folder: { childCount: 0 }
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    if (opts.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify({ error: 'unmatched' }), { status: 400 });
  };

  try {
    const mockEnv = { ONEDRIVE_TOKEN: 'test-od-token' };

    // 1. Create Folder
    const folderRes = await manageOneDrive(mockEnv, 'agent:trinity', 'create_folder', {
      name: 'Trinity-Backups'
    });
    assert.equal(folderRes.success, true);
    assert.equal(folderRes.folder.name, 'Trinity-Backups');

    // 2. Delete File
    const delRes = await manageOneDrive(mockEnv, 'agent:trinity', 'delete_file', {
      itemId: 'file_item_77'
    });
    assert.equal(delRes.success, true);
    assert.equal(delRes.deleted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('manageFirebase handles delete_document from D1 mirror and Firestore', async () => {
  const deletedSql = [];
  const mockEnv = {
    FIREBASE_PROJECT_ID: 'trinity-morhfeus-20261001',
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async run() {
                deletedSql.push({ sql, args });
                return { success: true };
              }
            };
          }
        };
      }
    }
  };

  const delRes = await manageFirebase(mockEnv, 'agent:trinity', 'delete_document', {
    collection: 'trinity_state',
    documentId: 'doc_to_delete_1'
  });

  assert.equal(delRes.success, true);
  assert.equal(delRes.deleted, true);
  assert.equal(delRes.d1_deleted, true);
  assert.equal(delRes.documentId, 'doc_to_delete_1');
  assert.equal(deletedSql.length, 1);
  assert.match(deletedSql[0].sql, /DELETE FROM ops_firebase_mirror/);
});
