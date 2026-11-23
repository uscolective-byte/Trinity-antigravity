/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CLOUD_AND_AI_INTEGRATIONS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Integrations for Cloudflare Edge, GitHub API, Firecrawl (Markdown RAG scraper), Firebase (Firestore + Hosting + D1 mirror), OneDrive, Google Cloud, Local Bridge, and Vercel.
 */
import {verifyCloudflareToken} from './cloudflare-token.js';
import {resolveProviderSecret} from './secret-vault.js';
import {createTrinityDocument} from './trinity-documents.js';

export async function manageCloudflare(env, actor = 'trinity', action = 'status', params = {}) {
  const token = await resolveProviderSecret(env, 'cloudflare');
  const accountId = params.accountId || env.CF_ACCOUNT_ID || 'b60342e5e52f5646fbd4e913bb409334';
  
  const internalState = {
    connected: false,
    accountId,
    edge_runtime: 'Cloudflare Workers (workerd)',
    configured_bindings: {
      d1: Boolean(env.DB?.prepare),
      kv: Boolean(env.Mastermind?.get),
      r2: Boolean(env.ARTIFACTS?.get),
      ai: Boolean(env.AI?.run)
    },
    workers_ai_model: env.AI_MODEL || '@cf/openai/gpt-oss-120b',
    has_live_token: Boolean(token)
  };

  if (action === 'status') {
    if (!token) {
      return {
        success: true,
        source: 'edge_bindings',
        verified: false,
        message: 'Cloudflare runtime only detected local bindings. Without an API token, cloud account access is not verified.',
        data: internalState
      };
    }
    const verification = await verifyCloudflareToken(token, accountId);
    return {
      success: verification.verified,
      verified: verification.verified,
      source: 'cloudflare_api',
      token_status: verification.status,
      token_scope: verification.scope,
      data: {...internalState, connected: verification.verified,
        ...(verification.verified ? {verified_at: new Date().toISOString()} : {})}
    };
  }

  if (action === 'list_dns_zones') {
    if (!token) {
      return {
        success: false, zones: [], verified: false,
        error: 'Listing Cloudflare DNS zones requires a verified API token.',
        source: 'not_verified'
      };
    }
    const resp = await fetch(`https://api.cloudflare.com/client/v4/zones?account.id=${encodeURIComponent(accountId)}&per_page=50`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await resp.json().catch(() => ({}));
    return { success: resp.ok && d.success === true, zones: resp.ok && d.success === true ? d.result || [] : [], total: resp.ok && d.success === true ? d.result?.length || 0 : 0 };
  }

  if (action === 'purge_cache') {
    const zoneId = params.zoneId;
    if (typeof zoneId !== 'string' || !/^[a-f0-9]{32}$/i.test(zoneId)) {
      return {success:false,error:'Purging Cloudflare cache requires a valid 32-character zone ID.'};
    }
    if (!token) {
      return {success:false,error:'Purging Cloudflare cache requires an API token. No cache was purged.'};
    }
    const resp = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ purge_everything: true })
    });
    const result = await resp.json().catch(() => ({}));
    return { success: resp.ok && result.success === true, result };
  }

  if (action === 'list_workers') {
    if (!token) {
      return {
        success:false,workers:[],verified:false,
        error:'Listing Workers requires a verified Cloudflare API token.',
        source:'not_verified'
      };
    }
    const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/scripts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await resp.json().catch(() => ({}));
    return { success: resp.ok && d.success === true, workers: resp.ok && d.success === true ? d.result || [] : [] };
  }

  if (action === 'create_dns_record') {
    const zoneId = params.zoneId;
    if (typeof zoneId !== 'string' || !/^[a-f0-9]{32}$/i.test(zoneId)) {
      return { success: false, error: 'Creating a DNS record requires a valid 32-character zone ID.' };
    }
    if (!token) return { success: false, error: 'Creating a DNS record requires a Cloudflare API token.' };
    const { type, name, content, ttl = 1, proxied = true, priority } = params;
    if (!type || !name || !content) return { success: false, error: 'Missing required DNS record parameters (type, name, content).' };
    const resp = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/dns_records`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name, content, ttl: Number(ttl) || 1, proxied: Boolean(proxied), ...(priority != null ? { priority: Number(priority) } : {}) })
    });
    const d = await resp.json().catch(() => ({}));
    return { success: resp.ok && d.success === true, record: d.result, errors: d.errors };
  }

  if (action === 'update_dns_record') {
    const { zoneId, recordId, type, name, content, ttl = 1, proxied = true, priority } = params;
    if (typeof zoneId !== 'string' || !/^[a-f0-9]{32}$/i.test(zoneId)) {
      return { success: false, error: 'Updating a DNS record requires a valid 32-character zone ID.' };
    }
    if (!recordId) return { success: false, error: 'Missing recordId for DNS record update.' };
    if (!token) return { success: false, error: 'Updating a DNS record requires a Cloudflare API token.' };
    const resp = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(type ? { type } : {}),
        ...(name ? { name } : {}),
        ...(content ? { content } : {}),
        ttl: Number(ttl) || 1,
        proxied: Boolean(proxied),
        ...(priority != null ? { priority: Number(priority) } : {})
      })
    });
    const d = await resp.json().catch(() => ({}));
    return { success: resp.ok && d.success === true, record: d.result, errors: d.errors };
  }

  if (action === 'delete_dns_record') {
    const { zoneId, recordId } = params;
    if (typeof zoneId !== 'string' || !/^[a-f0-9]{32}$/i.test(zoneId)) {
      return { success: false, error: 'Deleting a DNS record requires a valid 32-character zone ID.' };
    }
    if (!recordId) return { success: false, error: 'Missing recordId for DNS record deletion.' };
    if (!token) return { success: false, error: 'Deleting a DNS record requires a Cloudflare API token.' };
    const resp = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await resp.json().catch(() => ({}));
    return { success: resp.ok && d.success === true, deleted_id: recordId, result: d.result };
  }

  return { success: false, error: `Unknown Cloudflare action: ${action}` };
}

export async function manageGitHub(env, actor = 'trinity', action = 'status', params = {}) {
  const token = await resolveProviderSecret(env, 'github');
  const repo = params.repo || env.TRINITY_GITHUB_REPO || 'uscolective-byte/Trinity-antigravity';
  const isMutation=['create_issue','update_issue','dispatch_workflow','create_or_update_file','write_file','create_pull_request'].includes(action);
  if(typeof repo!=='string'||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)||repo.includes('..'))
    return {success:false,error:'Invalid GitHub repository.'};
  if(isMutation&&repo!=='uscolective-byte/Trinity-antigravity')
    return {success:false,error:'Writes and workflow dispatches are allowed only in the canonical Trinity repository.'};
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Trinity-AI-Agent-Hub/11.0',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  if (action === 'status' || action === 'repo_info') {
    try {
      const resp = await fetch(`https://api.github.com/repos/${repo}`, { headers });
      const data = await resp.json().catch(() => ({}));
      // Public repository read succeeds even if a supplied token is invalid.
      let authenticated=false;
      if(token&&resp.ok){
        try{
          const identity=await fetch('https://api.github.com/user',{headers,redirect:'manual',signal:AbortSignal.timeout(12000)});
          authenticated=identity.ok;
        }catch{authenticated=false;}
      }
      return {
        success: resp.ok,
        repo: repo,
        authenticated,
        details: {
          name: resp.ok ? data.name || null : null,
          stars: data.stargazers_count || 0,
          open_issues: data.open_issues_count || 0,
          default_branch: data.default_branch || 'main',
          visibility: data.visibility || 'public',
          html_url: data.html_url || `https://github.com/${repo}`
        }
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  if (action === 'list_commits') {
    try {
      const resp = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=${params.limit || 10}`, { headers });
      const data = await resp.json().catch(() => []);
      const commits = Array.isArray(data) ? data.map(c => ({
        sha: c.sha?.slice(0, 7),
        message: c.commit?.message?.split('\n')[0] || '',
        author: c.commit?.author?.name || c.author?.login || 'unknown',
        date: c.commit?.author?.date || ''
      })) : [];
      return { success: resp.ok, repo, commits };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  if (action === 'list_issues') {
    try {
      const resp = await fetch(`https://api.github.com/repos/${repo}/issues?state=${params.state || 'open'}&per_page=${params.limit || 10}`, { headers });
      const data = await resp.json().catch(() => []);
      const issues = Array.isArray(data) ? data.map(i => ({
        number: i.number,
        title: i.title,
        state: i.state,
        author: i.user?.login,
        created_at: i.created_at,
        url: i.html_url
      })) : [];
      return { success: resp.ok, repo, issues };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  if (action === 'create_issue') {
    if (!token) return { success: false, error: 'Creating a GitHub issue requires a token in the Secret Vault.' };
    const title = params.title || 'Trinity Automated Report';
    const body = params.body || '';
    if (!body || body.trim() === title.trim() || body.trim().length < 30) {
      return { success: false, error: 'Truth Policy: Issue body must not be empty or a trivial hollow stub.' };
    }
    const resp = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        body,
        labels: params.labels || ['trinity-bot']
      })
    });
    const d = await resp.json().catch(() => ({}));
    return {success:resp.status===201&&Number.isInteger(d.number),issue:resp.status===201&&Number.isInteger(d.number)?d:null,
      ...(!resp.ok?{error:`GitHub rejected issue creation (HTTP ${resp.status}).`}:{})};
  }

  if (action === 'update_issue') {
    if (!token) return { success: false, error: 'Updating a GitHub issue requires a token in the Secret Vault.' };
    const issueNumber = params.issue_number || params.number;
    if (!Number.isInteger(issueNumber)||issueNumber<1) return { success: false, error: 'Invalid issue number (issue_number).' };
    const payload = {};
    if (params.title) payload.title = params.title;
    if (params.body) {
      if (params.body.trim().length < 30) {
        return { success: false, error: 'Truth Policy: Issue body must not be an empty placeholder stub.' };
      }
      payload.body = params.body;
    }
    if (params.state) payload.state = params.state;
    if (params.labels) payload.labels = params.labels;
    const resp = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload)
    });
    const d = await resp.json().catch(() => ({}));
    return {success:resp.ok&&d.number===issueNumber,issue:resp.ok&&d.number===issueNumber?d:null,
      ...(!resp.ok?{error:`GitHub rejected issue update (HTTP ${resp.status}).`}:{})};
  }

  if (action === 'dispatch_workflow') {
    if (!token) return { success: false, error: 'Triggering GitHub Actions requires a token in the Secret Vault.' };
    const workflowId = params.workflowId || 'webpack.yml';
    const approvedWorkflows=new Set(['webpack.yml','integrations-check.yml','dependency-security.yml','codeql.yml','runner-smoke.yml']);
    if(!approvedWorkflows.has(workflowId))return {success:false,error:'Workflow is not on the approved check allowlist (deployments require a release gate).'};
    const ref=params.ref||'main';
    if(typeof ref!=='string'||!/^[-A-Za-z0-9_./]{1,160}$/.test(ref)||ref.includes('..')||ref.startsWith('/'))
      return {success:false,error:'Invalid Git ref.'};
    const resp = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/dispatches`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref, inputs: params.inputs || {} })
    });
    return { success: resp.status===204, status: resp.status===204?'queued':'failed',
      http_status:resp.status, message: resp.status===204?'GitHub accepted the workflow dispatch; test completion must be verified separately.':'GitHub rejected the workflow dispatch.' };
  }

    if (action === 'get_file' || action === 'read_file') {
    const filePath = params.path || 'README.md';
    const ref = params.ref || env.TRINITY_GITHUB_BRANCH || 'main';
    try {
      const resp = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`, { headers });
      if (!resp.ok) {
        return { success: false, error: `GitHub HTTP ${resp.status} while reading file ${filePath} in ${repo}` };
      }
      const data = await resp.json();
      let content = '';
      if (data.encoding === 'base64' && data.content) {
        content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
      } else if (typeof data.content === 'string') {
        content = data.content;
      }
      return {
        success: true,
        repo,
        path: filePath,
        ref,
        sha: data.sha,
        size: data.size,
        content: content.slice(0, 32000)
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  if (action === 'list_files' || action === 'list_tree') {
    const ref = params.ref || env.TRINITY_GITHUB_BRANCH || 'main';
    try {
      const resp = await fetch(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, { headers });
      if (!resp.ok) {
        return { success: false, error: `GitHub HTTP ${resp.status} while loading repository tree for ${repo}` };
      }
      const data = await resp.json();
      const files = Array.isArray(data.tree) ? data.tree.map(t => ({
        path: t.path,
        type: t.type,
        size: t.size
      })).slice(0, params.limit || 250) : [];
      return {
        success: true,
        repo,
        ref,
        total: data.tree ? data.tree.length : 0,
        truncated: Boolean(data.truncated),
        files
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  if (action === 'create_or_update_file' || action === 'write_file') {
    if (!token) return { success: false, error: 'Writing to the GitHub repository requires a token in the Secret Vault.' };
    const filePath = params.path;
    if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Missing file path (path).' };
    const branch = params.branch || env.TRINITY_GITHUB_BRANCH || 'main';
    const message = params.message || `chore: automated update of ${filePath} from Trinity Sovereign AI`;
    const contentRaw = params.content ?? '';
    const contentBase64 = params.is_base64 ? contentRaw : Buffer.from(typeof contentRaw === 'string' ? contentRaw : JSON.stringify(contentRaw, null, 2)).toString('base64');
    let sha = params.sha;
    if (!sha) {
      try {
        const checkResp = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`, { headers });
        if (checkResp.ok) {
          const checkData = await checkResp.json();
          sha = checkData.sha;
        }
      } catch (_) {}
    }
    const resp = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message,
        content: contentBase64,
        branch,
        ...(sha ? { sha } : {})
      })
    });
    const d = await resp.json().catch(() => ({}));
    return { success: resp.ok, repo, path: filePath, commit: d.commit, content: d.content, ...(resp.ok ? {} : { error: `GitHub HTTP ${resp.status}: ${d.message || 'File write failed'}` }) };
  }

  if (action === 'create_pull_request') {
    if (!token) return { success: false, error: 'Creating a GitHub Pull Request requires a token in the Secret Vault.' };
    const { title, head, base = env.TRINITY_GITHUB_BRANCH || 'main', body = '' } = params;
    if (!title || !head) return { success: false, error: 'Missing title or head branch for Pull Request.' };
    const resp = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, head, base, body })
    });
    const d = await resp.json().catch(() => ({}));
    return { success: resp.ok && Boolean(d.number), pull_request: d, ...(resp.ok ? {} : { error: `GitHub HTTP ${resp.status}: ${d.message || 'Pull Request creation failed'}` }) };
  }

  return { success: false, error: `Unknown GitHub action: ${action}` };
}

export async function scrapeWithFirecrawl(env, actor = 'trinity', options = {}) {
  const targetUrl = options.url;
  if (!targetUrl) throw new Error('Parameter url is required.');
  
  const token = await resolveProviderSecret(env, 'firecrawl');
  const mode = options.mode || 'scrape'; // 'scrape' | 'crawl' | 'map'

  if (token) {
    try {
      const endpoint = mode === 'map' ? 'https://api.firecrawl.dev/v1/map'
        : mode === 'crawl' ? 'https://api.firecrawl.dev/v1/crawl'
        : 'https://api.firecrawl.dev/v1/scrape';
        
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: targetUrl,
          formats: ['markdown', 'links', 'html'],
          onlyMainContent: options.onlyMainContent !== false
        }),
        signal: AbortSignal.timeout(30000)
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.data) {
        return {
          success: true,
          engine: 'firecrawl-cloud',
          url: targetUrl,
          markdown: data.data.markdown || '',
          title: data.data.metadata?.title || '',
          description: data.data.metadata?.description || '',
          links: data.data.links || [],
          scraped_at: new Date().toISOString()
        };
      }
    } catch (_) {}
  }

  // Edge-native intelligent crawler & HTML-to-Markdown parser fallback
  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Trinity-Edge-Scraper/11.0 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow'
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} while fetching page`);
    const html = await resp.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : targetUrl;
    
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    let clean = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    clean = clean
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const links = [];
    const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
    let lm;
    while ((lm = linkRegex.exec(html)) !== null && links.length < 50) {
      if (!links.includes(lm[1])) links.push(lm[1]);
    }

    return {
      success: true,
      engine: 'trinity-edge-native',
      url: targetUrl,
      title,
      description,
      markdown: clean.slice(0, 25000),
      links,
      scraped_at: new Date().toISOString()
    };
  } catch (err) {
    return { success: false, error: err.message, url: targetUrl };
  }
}

export async function manageFirebase(env, actor = 'trinity', action = 'status', params = {}) {
  const token = await resolveProviderSecret(env, 'firebase');
  const projectId = params.projectId || env.FIREBASE_PROJECT_ID || 'trinity-morhfeus-20261001';

  if (action === 'status') {
    const hostingUrl = `https://${projectId}.web.app`;
    let hostingOk = false;
    try {
      const r = await fetch(hostingUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
      hostingOk = r.ok;
    } catch (_) {}

    return {
      success: true,
      projectId,
      hosting: {
        domain: `${projectId}.web.app`,
        reachable: hostingOk,
        fallback_domain: `${projectId}.firebaseapp.com`
      },
      has_token: Boolean(token),
      firestore_status: 'not_verified'
    };
  }

  if (action === 'set_document') {
    const collection = params.collection || 'trinity_state';
    const documentId = params.documentId || `doc_${Date.now()}`;
    const payload = params.data || {};
    if (![collection,documentId].every(part => typeof part === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(part))) {
      return {success:false,error:'Invalid collection or document name.'};
    }
    let mirroredInD1 = false;
    if (env.DB?.prepare) {
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS ops_firebase_mirror (
            project_id TEXT,
            collection TEXT,
            doc_id TEXT,
            data_json TEXT,
            updated_at TEXT,
            PRIMARY KEY(project_id, collection, doc_id)
          )
        `).run();
        const result = await env.DB.prepare(`
          INSERT INTO ops_firebase_mirror(project_id, collection, doc_id, data_json, updated_at)
          VALUES(?,?,?,?,datetime('now'))
          ON CONFLICT(project_id, collection, doc_id) DO UPDATE SET
            data_json=excluded.data_json,
            updated_at=excluded.updated_at
        `).bind(projectId, collection, documentId, JSON.stringify(payload)).run();
        mirroredInD1 = result?.success === true;
      } catch {
        mirroredInD1 = false;
      }
    }
    // An API key is NOT Firestore write authorization. Never put secrets
    // into query parameters or claim external writes from uninspected replies.
    let firestoreWritten = false;
    let firestoreHttpStatus = null;
    if (typeof token === 'string' && /^ya29\.[A-Za-z0-9_.-]+$/.test(token)) {
      try {
        const firestoreFields = {};
        for (const [k,v] of Object.entries(payload)) {
          if (typeof v === 'string') firestoreFields[k] = {stringValue:v};
          else if (typeof v === 'number' && Number.isFinite(v)) firestoreFields[k] = {doubleValue:v};
          else if (typeof v === 'boolean') firestoreFields[k] = {booleanValue:v};
          else firestoreFields[k] = {stringValue:JSON.stringify(v)};
        }
        const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(documentId)}`;
        const response = await fetch(url, {
          method:'PATCH',
          headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
          body:JSON.stringify({fields:firestoreFields}),
          signal:AbortSignal.timeout(15000),
          redirect:'manual'
        });
        firestoreHttpStatus = response.status;
        firestoreWritten = response.ok;
      } catch {
        firestoreWritten = false;
      }
    }
    const success = mirroredInD1 || firestoreWritten;
    return {
      success,projectId,collection,documentId,
      mirrored_in_d1:mirroredInD1,
      firestore_written:firestoreWritten,
      ...(firestoreHttpStatus === null ? {} : {firestore_http_status:firestoreHttpStatus}),
      status: !success?'failed':!firestoreWritten?'partial':'verified',
      ...(success ? {written_at:new Date().toISOString()} :
        {error:'Unconfirmed write: D1 mirror failed and Firestore did not confirm success.'})
    };
  }

  if (action === 'get_document') {
    const collection = params.collection || 'trinity_state';
    const documentId = params.documentId;
    if (!documentId) return { success: false, error: 'Missing documentId.' };

    if (env.DB?.prepare) {
      try {
        const row = await env.DB.prepare(`
          SELECT data_json, updated_at FROM ops_firebase_mirror
          WHERE project_id=? AND collection=? AND doc_id=?
        `).bind(projectId, collection, documentId).first();
        if (row) {
          return { success: true, doc_id: documentId, data: JSON.parse(row.data_json), updated_at: row.updated_at, source: 'd1_mirror' };
        }
      } catch (_) {}
    }

    return { success: false, error: 'Document not found.' };
  }

  if (action === 'delete_document') {
    const collection = params.collection || 'trinity_state';
    const documentId = params.documentId;
    if (!documentId) return { success: false, error: 'Missing documentId.' };
    let d1Deleted = false;
    if (env.DB?.prepare) {
      try {
        const r = await env.DB.prepare('DELETE FROM ops_firebase_mirror WHERE project_id=? AND collection=? AND doc_id=?')
          .bind(projectId, collection, documentId).run();
        d1Deleted = r?.success === true;
      } catch (_) {}
    }
    let firestoreDeleted = false;
    if (typeof token === 'string' && /^ya29\.[A-Za-z0-9_.-]+$/.test(token)) {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(documentId)}`;
        const response = await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000),
          redirect: 'manual'
        });
        firestoreDeleted = response.ok;
      } catch (_) {}
    }
    return { success: d1Deleted || firestoreDeleted, deleted: true, d1_deleted: d1Deleted, firestore_deleted: firestoreDeleted, projectId, collection, documentId };
  }

  return { success: false, error: `Unknown Firebase action: ${action}` };
}

function encodeOneDrivePath(rawPath = '') {
  return String(rawPath || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

export async function manageOneDrive(env, actor = 'trinity', action = 'status', params = {}) {
  const token = await resolveProviderSecret(env, 'onedrive') || await resolveProviderSecret(env, 'microsoft');
  const profile = params.profile || 'personal_msa';

  if (action === 'status') {
    if (!token) {
      return {
        success: false,
        source: 'local_or_pending',
        connected: false,
        verified: false,
        profile,
        message: 'Microsoft OneDrive credential is not configured yet. Store a token in the Secret Vault (provider onedrive or microsoft).'
      };
    }
    try {
      const resp = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return {
          success: true,
          connected: true,
          verified: true,
          source: 'microsoft_graph',
          drive_id: data.id,
          drive_type: data.driveType,
          owner: data.owner?.user?.displayName || data.owner?.user?.email || null,
          quota: data.quota
        };
      }
      return {
        success: false,
        connected: false,
        verified: false,
        error: `OneDrive Graph API returned HTTP ${resp.status}: ${data.error?.message || 'access denied'}`
      };
    } catch (err) {
      return { success: false, connected: false, verified: false, error: err.message };
    }
  }

  if (action === 'drive_info') {
    if (!token) return { success: false, error: 'Missing OneDrive token.' };
    const resp = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      drive: data,
      ...(resp.ok ? {} : { error: `OneDrive HTTP ${resp.status}: ${data.error?.message || 'Failed to read drive info'}` })
    };
  }

  if (action === 'list_files') {
    if (!token) return { success: false, error: 'Missing OneDrive token.' };
    const cleanPath = encodeOneDrivePath(params.path);
    const folderPath = cleanPath ? `root:/${cleanPath}:/children` : 'root/children';
    const resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/${folderPath}?$top=50`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      files: (data.value || []).map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        is_folder: Boolean(f.folder),
        web_url: f.webUrl,
        last_modified: f.lastModifiedDateTime
      })),
      total: data.value?.length || 0,
      ...(resp.ok ? {} : { error: `OneDrive HTTP ${resp.status}: ${data.error?.message || 'Failed to list folder'}` })
    };
  }

  if (action === 'search_files') {
    if (!token) return { success: false, error: 'Missing OneDrive token.' };
    const query = String(params.query || params.name || '').trim();
    if (!query) return { success: false, error: 'Missing search query for OneDrive.' };
    const escaped = encodeURIComponent(query.replace(/'/g, "''"));
    const resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/search(q='${escaped}')?$top=50`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      query,
      files: (data.value || []).map(f => ({
        id: f.id,
        name: f.name,
        path: f.parentReference?.path ? `${f.parentReference.path.replace(/^\/drive\/root:?/, '')}/${f.name}`.replace(/^\/+/, '') : f.name,
        size: f.size,
        is_folder: Boolean(f.folder),
        web_url: f.webUrl,
        last_modified: f.lastModifiedDateTime
      })),
      total: data.value?.length || 0,
      ...(resp.ok ? {} : { error: `OneDrive HTTP ${resp.status}: ${data.error?.message || 'Search failed'}` })
    };
  }

  if (action === 'get_file') {
    if (!token) return { success: false, error: 'Missing OneDrive token.' };
    const cleanPath = encodeOneDrivePath(params.path);
    const endpoint = params.itemId
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(params.itemId)}`
      : cleanPath
        ? `https://graph.microsoft.com/v1.0/me/drive/root:/${cleanPath}`
        : null;
    if (!endpoint) return { success: false, error: 'Missing itemId or path for OneDrive file lookup.' };
    const resp = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      item: data,
      ...(resp.ok ? {} : { error: `OneDrive HTTP ${resp.status}: ${data.error?.message || 'Failed to retrieve file metadata'}` })
    };
  }

  if (action === 'read_file') {
    if (!token) return { success: false, error: 'Missing OneDrive token.' };
    const cleanPath = encodeOneDrivePath(params.path);
    const endpoint = params.itemId
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(params.itemId)}/content`
      : cleanPath
        ? `https://graph.microsoft.com/v1.0/me/drive/root:/${cleanPath}:/content`
        : null;
    if (!endpoint) return { success: false, error: 'Missing itemId or path for OneDrive file read.' };
    const resp = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000)
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      return { success: false, error: `OneDrive HTTP ${resp.status}: ${errData.error?.message || 'Failed to read file'}` };
    }
    const rawText = await resp.text();
    const maxChars = 200_000;
    const truncated = rawText.length > maxChars;
    return {
      success: true,
      content: truncated ? rawText.slice(0, maxChars) : rawText,
      truncated,
      bytes: rawText.length,
      content_type: resp.headers.get('content-type') || 'text/plain'
    };
  }

  if (action === 'upload_file') {
    if (!token) return { success: false, error: 'Missing OneDrive token.' };
    const cleanPath = encodeOneDrivePath(params.path);
    if (!cleanPath) return { success: false, error: 'Missing destination path in OneDrive.' };
    const content = typeof params.content === 'string' ? params.content : JSON.stringify(params.content || {});
    const resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${cleanPath}:/content`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': params.contentType || 'text/plain; charset=utf-8' },
      body: content,
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      file: data,
      ...(resp.ok ? {} : { error: `OneDrive HTTP ${resp.status}: ${data.error?.message || 'File upload failed'}` })
    };
  }

  if (action === 'create_folder') {
    if (!token) return { success: false, error: 'Missing OneDrive token.' };
    const name = params.name;
    if (!name || typeof name !== 'string') return { success: false, error: 'Missing new folder name (name).' };
    const cleanPath = encodeOneDrivePath(params.path);
    const endpoint = cleanPath
      ? `https://graph.microsoft.com/v1.0/me/drive/root:/${cleanPath}:/children`
      : 'https://graph.microsoft.com/v1.0/me/drive/root/children';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return { success: resp.ok, folder: data, ...(resp.ok ? {} : { error: `OneDrive HTTP ${resp.status}: ${data.error?.message || 'Folder creation failed'}` }) };
  }

  if (action === 'delete_file' || action === 'delete_item') {
    if (!token) return { success: false, error: 'Missing OneDrive token.' };
    const cleanPath = encodeOneDrivePath(params.path);
    const endpoint = params.itemId
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(params.itemId)}`
      : cleanPath
        ? `https://graph.microsoft.com/v1.0/me/drive/root:/${cleanPath}`
        : null;
    if (!endpoint) return { success: false, error: 'Missing itemId or path to delete item in OneDrive.' };
    const resp = await fetch(endpoint, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000)
    });
    const ok = resp.ok || resp.status === 204;
    if (!ok) {
      const errData = await resp.json().catch(() => ({}));
      return { success: false, deleted: false, status: resp.status, error: `OneDrive HTTP ${resp.status}: ${errData.error?.message || 'Item deletion failed'}` };
    }
    return { success: true, deleted: true, status: resp.status };
  }

  return { success: false, error: `Unknown OneDrive action: ${action}` };
}

export async function manageGoogleCloud(env, actor = 'trinity', action = 'status', params = {}) {
  if (action === 'status' || action === 'list_models') {
    const key = await resolveProviderSecret(env, 'gemini') || env.GEMINI_API_KEY;
    if (!key) return {success:false,connected:false,verified:false,error:'Missing Gemini API key.'};
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers:{'x-goog-api-key':key},redirect:'manual',signal:AbortSignal.timeout(10000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(data.models)) {
      const reasons={
        API_KEY_INVALID:'Google marked the Gemini API key as invalid.',
        API_KEY_EXPIRED:'Google marked the Gemini API key as expired.',
        API_KEY_SERVICE_BLOCKED:'API key restrictions block the Gemini API.',
        SERVICE_DISABLED:'Gemini API is disabled in the Google Cloud project.',
        BILLING_DISABLED:'Google reports billing is disabled for the project.',
        CONSUMER_SUSPENDED:'Google suspended project API access.'
      };
      const detail=Array.isArray(data.error?.details)?data.error.details.find(item=>
        item?.['@type']==='type.googleapis.com/google.rpc.ErrorInfo'&&Object.hasOwn(reasons,item.reason)):null;
      return {success:false,connected:false,verified:false,error:detail
        ? reasons[detail.reason]+' (HTTP '+response.status+').'
        : 'Gemini API did not return a model list (HTTP '+response.status+').'};
    }
    const models=data.models.map(model=>model.name).filter(name=>typeof name==='string');
    return {success:true,connected:true,verified:true,source:'gemini_api',...(action==='list_models'?{models,total:models.length}:{})};
  }

  return { success: false, error: `Unknown Google Cloud action: ${action}` };
}

export async function manageLocalBridge(env, actor = 'trinity', action = 'status', params = {}) {
  const localEndpoints = [
    { name: 'Local-Desktop', url: 'http://127.0.0.1:8795/health', port: 8795 },
    { name: 'Local-Gateway', url: 'http://127.0.0.1:8791/health', fallbackUrl: 'http://127.0.0.1:7789/health', port: 8791 }
  ];

  if (action === 'status' || action === 'ping') {
    let desktopReachable = false;
    let gatewayReachable = false;
    let telemetry = null;
    let gatewayTelemetry = null;

    try {
      const resp = await fetch(localEndpoints[0].url, { signal: AbortSignal.timeout(1500) });
      if (resp.ok) {
        desktopReachable = true;
        telemetry = await resp.json().catch(() => null);
      }
    } catch {}

    try {
      let resp = await fetch(localEndpoints[1].url, { signal: AbortSignal.timeout(1500) });
      if (!resp.ok && localEndpoints[1].fallbackUrl) {
        resp = await fetch(localEndpoints[1].fallbackUrl, { signal: AbortSignal.timeout(1500) });
      }
      if (resp.ok) {
        gatewayReachable = true;
        gatewayTelemetry = await resp.json().catch(() => null);
      }
    } catch {}

    const connected = desktopReachable || gatewayReachable || Boolean(env.PC_BRIDGE);

    return {
      success: true,
      connected,
      bridge_mode: connected ? 'active' : 'standby',
      endpoints: {
        desktop: { port: 8795, active: desktopReachable },
        gateway: { port: 7789, active: gatewayReachable, local_port: 8791 }
      },
      workspaces: [
        '/home/antigravity/uscolective-byte/Trinity-antigravity',
        '/home/antigravity/uscolective-byte/trinity-morhfeus',
        'C:\\Users\\saboi\\Trinity-antigravity'
      ],
      telemetry: telemetry || gatewayTelemetry || { status: connected ? 'online' : 'standby', platform: 'win32' }
    };
  }

  return { success: false, error: `Unknown Local Bridge action: ${action}` };
}

export async function manageVercel(env, actor = 'trinity', action = 'status', params = {}) {
  const token = await resolveProviderSecret(env, 'vercel');
  const teamId = params.teamId || env?.VERCEL_TEAM_ID || env?.VERCEL_ORG_ID || null;
  const withTeam = (baseUrl, extraParams = {}) => {
    const u = new URL(baseUrl);
    if (teamId) u.searchParams.set('teamId', String(teamId));
    for (const [k, v] of Object.entries(extraParams)) {
      if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
    }
    return u.toString();
  };
  const headers = token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : {};

  if (action === 'status') {
    if (!token) {
      return {
        success: false,
        connected: false,
        verified: false,
        source: 'unconfigured',
        message: 'Vercel token is not configured yet. Store a Vercel API token in the Secret Vault (provider vercel).'
      };
    }
    try {
      const resp = await fetch(withTeam('https://api.vercel.com/v2/user'), {
        headers,
        signal: AbortSignal.timeout(12000)
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.user) {
        return {
          success: true,
          connected: true,
          verified: true,
          source: 'vercel_api',
          user: {
            id: data.user.id || data.user.uid || null,
            username: data.user.username || null,
            email: data.user.email || null,
            name: data.user.name || null
          },
          team_id: teamId
        };
      }
      return {
        success: false,
        connected: false,
        verified: false,
        error: `Vercel API returned HTTP ${resp.status}: ${data.error?.message || 'access denied'}`
      };
    } catch (err) {
      return { success: false, connected: false, verified: false, error: err.message };
    }
  }

  if (!token) return { success: false, error: 'Missing Vercel token. Configure it in the Secret Vault under provider vercel.' };

  if (action === 'list_projects') {
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const resp = await fetch(withTeam('https://api.vercel.com/v9/projects', { limit }), {
      headers,
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      projects: (data.projects || []).map(p => ({
        id: p.id,
        name: p.name,
        framework: p.framework || null,
        repo: p.link?.repo ? `${p.link.org || ''}/${p.link.repo}`.replace(/^\/+/, '') : null,
        updated_at: p.updatedAt || null
      })),
      total: data.projects?.length || 0,
      ...(resp.ok ? {} : { error: `Vercel HTTP ${resp.status}: ${data.error?.message || 'Failed to list projects'}` })
    };
  }

  if (action === 'list_deployments') {
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const resp = await fetch(withTeam('https://api.vercel.com/v6/deployments', {
      projectId: params.projectId || env?.VERCEL_PROJECT_ID || '',
      target: params.target || '',
      limit
    }), {
      headers,
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      deployments: (data.deployments || []).map(d => ({
        uid: d.uid,
        name: d.name,
        url: d.url ? (d.url.startsWith('http') ? d.url : `https://${d.url}`) : null,
        state: d.state || d.readyState || null,
        target: d.target || 'preview',
        created_at: d.created || d.createdAt || null
      })),
      total: data.deployments?.length || 0,
      ...(resp.ok ? {} : { error: `Vercel HTTP ${resp.status}: ${data.error?.message || 'Failed to list deployments'}` })
    };
  }

  if (action === 'get_deployment') {
    const deploymentId = params.deploymentId || params.id;
    if (!deploymentId) return { success: false, error: 'Missing deploymentId to inspect deployment details.' };
    const resp = await fetch(withTeam(`https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentId)}`), {
      headers,
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      deployment: resp.ok ? {
        id: data.id || data.uid,
        name: data.name,
        url: data.url ? (data.url.startsWith('http') ? data.url : `https://${data.url}`) : null,
        ready_state: data.readyState || data.status || null,
        target: data.target || 'preview',
        created_at: data.createdAt || null
      } : null,
      ...(resp.ok ? {} : { error: `Vercel HTTP ${resp.status}: ${data.error?.message || 'Deployment not found'}` })
    };
  }

  if (action === 'list_domains') {
    const projectId = params.projectId || env?.VERCEL_PROJECT_ID || null;
    const url = projectId
      ? withTeam(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/domains`)
      : withTeam('https://api.vercel.com/v5/domains', { limit: 50 });
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    const data = await resp.json().catch(() => ({}));
    const rawDomains = data.domains || [];
    return {
      success: resp.ok,
      domains: rawDomains.map(d => ({
        name: d.name,
        verified: Boolean(d.verified),
        redirect: d.redirect || null,
        git_branch: d.gitBranch || null
      })),
      total: rawDomains.length,
      ...(resp.ok ? {} : { error: `Vercel HTTP ${resp.status}: ${data.error?.message || 'Failed to list domains'}` })
    };
  }

  if (action === 'add_domain') {
    const projectId = params.projectId || env?.VERCEL_PROJECT_ID;
    const domain = String(params.domain || params.name || '').trim().toLowerCase();
    if (!projectId || !domain) return { success: false, error: 'Provide both projectId and domain to add a domain.' };
    const resp = await fetch(withTeam(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains`), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: domain }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      domain: resp.ok ? { name: data.name, verified: Boolean(data.verified), verification: data.verification || [] } : null,
      ...(resp.ok ? {} : { error: `Vercel HTTP ${resp.status}: ${data.error?.message || 'Failed to add domain'}` })
    };
  }

  if (action === 'list_env') {
    const projectId = params.projectId || env?.VERCEL_PROJECT_ID;
    if (!projectId) return { success: false, error: 'Missing projectId to list environment variables.' };
    const resp = await fetch(withTeam(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env`), {
      headers,
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      envs: (data.envs || []).map(e => ({
        id: e.id,
        key: e.key,
        type: e.type,
        target: e.target || []
      })),
      total: data.envs?.length || 0,
      ...(resp.ok ? {} : { error: `Vercel HTTP ${resp.status}: ${data.error?.message || 'Failed to read environment variables'}` })
    };
  }

  if (action === 'redeploy') {
    const deploymentId = params.deploymentId || params.id;
    const name = params.name || params.projectName || 'trinity-sovereign-os';
    if (!deploymentId) return { success: false, error: 'Missing deploymentId for redeploy.' };
    const resp = await fetch(withTeam('https://api.vercel.com/v13/deployments'), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        deploymentId,
        target: params.target || 'production'
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      deployment: resp.ok ? {
        id: data.id || data.uid,
        name: data.name,
        url: data.url ? (data.url.startsWith('http') ? data.url : `https://${data.url}`) : null,
        ready_state: data.readyState || 'QUEUED',
        target: data.target || params.target || 'production'
      } : null,
      ...(resp.ok ? {} : { error: `Vercel HTTP ${resp.status}: ${data.error?.message || 'Redeploy failed'}` })
    };
  }

  if (action === 'cancel_deployment') {
    const deploymentId = params.deploymentId || params.id;
    if (!deploymentId) return { success: false, error: 'Missing deploymentId to cancel deployment.' };
    const resp = await fetch(withTeam(`https://api.vercel.com/v12/deployments/${encodeURIComponent(deploymentId)}/cancel`), {
      method: 'PATCH',
      headers,
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      cancelled: resp.ok,
      deployment_id: deploymentId,
      ready_state: data.readyState || null,
      ...(resp.ok ? {} : { error: `Vercel HTTP ${resp.status}: ${data.error?.message || 'Deployment cancellation failed'}` })
    };
  }

  return { success: false, error: `Unknown Vercel action: ${action}` };
}

export async function listAllIntegrations(env) {
  const [cfToken, ghToken, oneToken, gcToken, fcToken, fbToken, sbToken, vcToken] = await Promise.all([
    resolveProviderSecret(env, 'cloudflare'),
    resolveProviderSecret(env, 'github'),
    resolveProviderSecret(env, 'onedrive'),
    resolveProviderSecret(env, 'google_cloud').catch(() => null),
    resolveProviderSecret(env, 'firecrawl'),
    resolveProviderSecret(env, 'firebase'),
    resolveProviderSecret(env, 'supabase'),
    resolveProviderSecret(env, 'vercel')
  ]);

  return [
    {
      id: 'cloudflare',
      name: 'Cloudflare Edge Control',
      category: 'Cloud & Infrastructure',
      status: cfToken ? 'configured' : 'edge-native-active',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'control', 'dns_manage', 'cache_purge', 'workers_list'],
      description: 'Full bidirectional management (Read & Write): Workers, D1 databases, KV Mastermind, R2 storage, and DNS records.'
    },
    {
      id: 'vercel',
      name: 'Vercel Edge Deployments & Domains',
      category: 'Cloud & Infrastructure',
      status: vcToken ? 'configured' : 'ready',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'list_projects', 'list_deployments', 'list_domains', 'add_domain', 'redeploy', 'cancel_deployment'],
      description: 'Full bidirectional management (Read & Write): Vercel projects, production and preview deployments, domains, and environment variable metadata (without reading secret values).'
    },
    {
      id: 'github',
      name: 'GitHub Repository & Actions',
      category: 'Code & CI/CD',
      status: ghToken ? 'configured' : 'public-read-ready',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'commit', 'pull_request', 'issues', 'workflow_dispatch'],
      description: 'Full bidirectional management (Read & Write): canonical repository uscolective-byte/Trinity-antigravity, file commits, PRs, issues, and Actions.'
    },
    {
      id: 'onedrive',
      name: 'Microsoft OneDrive & Office 365',
      category: 'Cloud Storage & Documents',
      status: oneToken ? 'configured' : 'ready',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'upload', 'folder_create', 'delete'],
      description: 'Full bidirectional management (Read & Write): Microsoft Graph storage, folder creation, file uploads, and document deletion.'
    },
    {
      id: 'google_cloud',
      name: 'Google Cloud & Gemini Developer Platform',
      category: 'AI & Cloud Infrastructure',
      status: (gcToken || env.GOOGLE_PROJECT_ID) ? 'configured' : 'ready',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'models', 'storage', 'vertex_ai'],
      description: 'Full bidirectional management (Read & Write): project tangential-osprey-dl7cp, Gemini models, Vertex AI, Cloud Storage, and Workspace.'
    },
    {
      id: 'google_ai_studio',
      name: 'Google AI Studio Bridge (Gemini API)',
      category: 'AI & Co-Creation',
      status: (env?.GOOGLE_AI_STUDIO_API_KEY || env?.GEMINI_API_KEY || typeof env?.TRINITY_MASTER_GOOGLE?.get === 'function' || gcToken) ? 'configured' : 'ready',
      access_mode: 'read_write',
      capabilities: ['models', 'generate', 'stream', 'co_create', 'sessions', 'mcp'],
      description: 'Direct Google AI Studio (generativelanguage.googleapis.com/v1beta) bridge for model discovery, streaming generation, and multi-turn Trinity + AI Studio co-creation.'
    },
    {
      id: 'local_bridge',
      name: 'Local PC Bridge & Hardware Node',
      category: 'Local Infrastructure',
      status: 'platform-connected',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'shell_exec', 'fs_read_write', 'system_telemetry'],
      description: 'Local workstation node for Sabo Ivan (Local-Desktop on port 8795, Local-Gateway on port 7789, bidirectional PC Bridge 2.0).'
    },
    {
      id: 'firecrawl',
      name: 'Firecrawl Web Crawler',
      category: 'Web Intelligence',
      status: fcToken ? 'configured' : 'edge-crawler-ready',
      access_mode: 'read_write',
      capabilities: ['read', 'crawl', 'map', 'markdown_extract'],
      description: 'Deep web extraction, URL mapping, and clean Markdown conversion.'
    },
    {
      id: 'firebase',
      name: 'Firebase Firestore & Hosting',
      category: 'Database & Auth',
      status: fbToken ? 'configured' : 'ready',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'set_document', 'delete_document', 'mirror_d1'],
      description: 'Full bidirectional management (Read & Write): Firestore writes and deletes, Hosting on trinity-morhfeus-20261001.web.app, and D1 mirror.'
    },
    {
      id: 'supabase',
      name: 'Supabase / PostgreSQL',
      category: 'Database',
      status: sbToken ? 'configured' : 'ready',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'query', 'vectors'],
      description: 'Relational PostgreSQL database with PostgREST API and vector storage.'
    },
    {
      id: 'meta_social',
      name: 'Meta Platforms (Facebook, Instagram & WhatsApp)',
      category: 'Social & Messaging',
      status: (env.META_ACCESS_TOKEN || env.FACEBOOK_ACCESS_TOKEN || env.META_APP_ID) ? 'configured' : 'ready',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'facebook_pages', 'instagram_business', 'whatsapp_messaging', 'post_draft', 'metrics'],
      description: 'Official Meta Graph API connector: manage Facebook Pages, Instagram Business profiles, and WhatsApp messaging with Llama 3.3.'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn Professional Network',
      category: 'Social & B2B Growth',
      status: (env.LINKEDIN_TOKEN || env.LINKEDIN_CLIENT_ID) ? 'configured' : 'ready',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'profile_share', 'company_posts', 'prospect_queries', 'b2b_outreach'],
      description: 'B2B content distribution and acquisition: article publishing, business opportunity discovery via prospect_queries, and B2B outreach.'
    },
    {
      id: 'telegram',
      name: 'Telegram Bot & @wallet Node',
      category: 'Social & Messaging',
      status: env.TELEGRAM_BOT_TOKEN ? 'configured' : 'ready',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'bot_chat', 'telegram_wallet', 'ton_transfers', 'hitl_approvals'],
      description: 'Bidirectional private chat, HITL action approvals, and crypto payments via external Telegram @wallet (TON/USDT).'
    },
    {
      id: 'viber',
      name: 'Viber Messaging & Viber Pay',
      category: 'Social & Messaging',
      status: env.VIBER_AUTH_TOKEN ? 'configured' : 'ready',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'bot_chat', 'viber_pay', 'p2p_transfers', 'qr_checkout'],
      description: 'Official Viber Chat API bridge and Viber Pay digital wallet for peer-to-peer payments and automated notifications.'
    },
    {
      id: 'paysafe',
      name: 'Paysafe & Paysafecard Financial Gateway',
      category: 'Financial Services & Wallets',
      status: (env.PAYSAFE_API_KEY && env.PAYSAFE_ACCOUNT_NUMBER) ? 'configured' : 'ready',
      access_mode: 'read_write',
      capabilities: ['read', 'write', 'paysafecard_voucher', 'mypaysafe_wallet', 'skrill_transfer', 'payment_handles'],
      description: 'Connection to the Paysafe ecosystem: myPaysafe digital wallet, 16-digit Paysafecard PIN vouchers, and Skrill/Neteller payment sessions.'
    }
  ];
}
