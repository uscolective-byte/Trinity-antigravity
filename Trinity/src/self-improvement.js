/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module self-improvement.js (Trinity/src/self-improvement.js) in the TRINITY OMNI-CORE ecosystem.
 */
import {z} from 'zod';
import {HttpError} from './security.js';
import {
  PROJECT_REPOSITORY,
  prepareCodeImprovement,
  dispatchDeployment,
  githubRequest,
  mergeVerifiedImprovement,
  resolveGitHubToken
} from './project-evolution.js';

const proposalSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
  kind: z.enum(['plugin_install', 'code_improvement', 'deployment', 'behavior_rule']),
  plugin_id: z.string().regex(/^[a-z0-9-]{2,80}$/).optional()
}).strict();

const present = row => ({
  id: row.id,
  title: row.title,
  description: row.description,
  kind: row.kind,
  plugin_id: row.plugin_id || null,
  status: row.status,
  created_by: row.created_by,
  approved_by: row.approved_by || null,
  result_json: row.result_json ? JSON.parse(row.result_json) : null,
  created_at: row.created_at,
  updated_at: row.updated_at
});

async function audit(env, action, details) {
  await env.DB.prepare('INSERT INTO ops_events(action, details) VALUES(?, ?)')
    .bind(action, JSON.stringify(details)).run();
}

export async function listSelfImprovementProposals(env) {
  const rows = await env.DB.prepare(
    'SELECT * FROM self_improvement_proposals ORDER BY created_at DESC LIMIT 100'
  ).all();
  return (rows.results || []).map(present);
}

export async function createSelfImprovementProposal(env, input, actor) {
  const data = proposalSchema.parse(input);
  if (data.kind === 'plugin_install' && !data.plugin_id) {
    throw new HttpError(400, 'A plugin_id from the Trinity catalog is required for plugin installation.');
  }
  if (data.kind !== 'plugin_install' && data.plugin_id) {
    throw new HttpError(400, 'plugin_id is only allowed for plugin installation proposals.');
  }
  const id = crypto.randomUUID();
  const row = await env.DB.prepare(`
    INSERT INTO self_improvement_proposals(id,title,description,kind,plugin_id,status,created_by)
    VALUES(?,?,?,?,?,'pending',?)
    RETURNING *
  `).bind(id, data.title, data.description, data.kind, data.plugin_id || null, actor).first();
  await audit(env, 'self_improvement_proposed', {
    id, kind: data.kind, title: data.title, plugin_id: data.plugin_id || null, actor
  });
  return present(row);
}

export async function approveSelfImprovementProposal(env, id, actor) {
  const row = await env.DB.prepare(
    "UPDATE self_improvement_proposals SET status='approved',approved_by=?,updated_at=datetime('now') WHERE id=? AND status='pending' RETURNING *"
  ).bind(actor, id).first();
  if (!row) throw new HttpError(404, 'Pending proposal not found or already processed.');
  await audit(env, 'self_improvement_approved', {id, actor, kind: row.kind});
  return present(row);
}

export async function applySelfImprovementProposal(env, id, actor, installPluginById) {
  const row = await env.DB.prepare(
    "SELECT * FROM self_improvement_proposals WHERE id=? AND status='approved'"
  ).bind(id).first();
  if (!row) throw new HttpError(409, 'Proposal must be approved by the Trinity owner first.');
  if (row.kind === 'behavior_rule') {
    const activated = await env.DB.prepare(
      "UPDATE self_improvement_proposals SET status='applied',result_json=?,updated_at=datetime('now') WHERE id=? AND status='approved' RETURNING *"
    ).bind(JSON.stringify({status: 'active', activated_at: new Date().toISOString()}), id).first();
    await audit(env, 'self_improvement_rule_activated', {id, actor, title: row.title});
    return present(activated);
  }
  if (['code_improvement','deployment'].includes(row.kind) && Boolean(resolveGitHubToken(env))) {
    const previous = row.result_json ? JSON.parse(row.result_json) : null;
    if (previous && !['failed'].includes(previous.status)) return present(row);
    const claim = JSON.stringify({status:'preparing',started_at:new Date().toISOString()});
    const lock = await env.DB.prepare("UPDATE self_improvement_proposals SET result_json=?,updated_at=datetime('now') WHERE id=? AND status='approved' AND coalesce(result_json,'')=? RETURNING *")
      .bind(claim,id,row.result_json || '').first();
    if (!lock) throw new HttpError(409,'Proposal is already being processed by another worker.');
    try {
      const result = row.kind === 'deployment' ? await dispatchDeployment(env) : await prepareCodeImprovement(env,row);
      const updated = await env.DB.prepare("UPDATE self_improvement_proposals SET result_json=?,updated_at=datetime('now') WHERE id=? RETURNING *").bind(JSON.stringify(result),id).first();
      await audit(env,'self_improvement_execution_started',{id,actor,status:result.status,url:result.url});
      return present(updated);
    } catch (error) {
      await env.DB.prepare("UPDATE self_improvement_proposals SET result_json=?,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify({status:'failed',error:error.message}),id).run();
      throw error;
    }
  }
  if (row.kind !== 'plugin_install') {
    throw new HttpError(503, 'Missing GitHub integration: configure Worker secret TRINITY_GITHUB_TOKEN. Code proposals require reading the source commit. Deployments are executed by GitHub Actions.');
  }
  const result = await installPluginById(row.plugin_id);
  const updated = await env.DB.prepare(
    "UPDATE self_improvement_proposals SET status='applied',result_json=?,updated_at=datetime('now') WHERE id=? AND status='approved' RETURNING *"
  ).bind(JSON.stringify(result), id).first();
  await audit(env, 'self_improvement_plugin_installed', {
    id, plugin_id: row.plugin_id, actor, result_status: result?.status || 'installed'
  });
  return present(updated);
}

export async function listActiveBehaviorRules(env) {
  if (!env?.DB) return [];
  try {
    const rows = await env.DB.prepare(
      "SELECT id,title,description FROM self_improvement_proposals WHERE kind='behavior_rule' AND status='applied' ORDER BY updated_at DESC LIMIT 20"
    ).all();
    return rows.results || [];
  } catch {
    return [];
  }
}

export async function revokeBehaviorRule(env, id, actor) {
  const row = await env.DB.prepare(
    "UPDATE self_improvement_proposals SET status='rejected',updated_at=datetime('now') WHERE id=? AND kind='behavior_rule' AND status='applied' RETURNING *"
  ).bind(id).first();
  if (!row) throw new HttpError(404, 'Active behavior rule not found.');
  await audit(env, 'self_improvement_rule_revoked', {id, actor});
  return present(row);
}

// The owner (server-verified session) teaches Trinity a new behavior rule: proposal -> approval -> activation, fully audited.
export async function ownerLearnBehaviorRule(env, text, actor) {
  const description = String(text || '').trim().slice(0, 4000);
  const title = description.replace(/\s+/g, ' ').slice(0, 80);
  const proposal = await createSelfImprovementProposal(env, {title, description, kind: 'behavior_rule'}, actor);
  await approveSelfImprovementProposal(env, proposal.id, actor);
  return applySelfImprovementProposal(env, proposal.id, actor, async () => { throw new HttpError(400, 'Not a plugin proposal.'); });
}

export function behaviorRulesDirective(rules) {
  if (!rules?.length) return '';
  return 'LEARNED IMPROVEMENTS (owner-approved; never bypass security rules or truthfulness): '
    + rules.map((r, i) => `${i + 1}) ${r.description}`).join(' ');
}

async function finalizeMergedProposal(env, proposalId, baseReceipt, mergeSha, mergedAt) {
  const receipt = {
    ...baseReceipt,
    status: 'merged',
    merge_sha: mergeSha,
    merged_at: mergedAt,
    deployed: false
  };
  await env.DB.prepare("UPDATE self_improvement_proposals SET status='applied',result_json=?,updated_at=datetime('now') WHERE id=? AND status='approved'")
    .bind(JSON.stringify(receipt), proposalId).run();
  await audit(env, 'self_improvement_source_integrated', {id: proposalId, merge_sha: mergeSha, deployed: false});
  return receipt;
}

// A merged PR is source integration, never evidence of a successful deployment.
export async function reconcileSelfImprovements(env) {
  if (!resolveGitHubToken(env)) return [];
  const proposals = (await listSelfImprovementProposals(env))
    .filter(p => p.status === 'approved' && ['pull_request_created', 'patch_ready'].includes(p.result_json?.status))
    .slice(0, 3);
  const results = [];
  const owner = (env.TRINITY_GITHUB_REPO || PROJECT_REPOSITORY).split('/')[0];

  for (const proposal of proposals) {
    let currentReceipt = proposal.result_json;
    let pr = null;

    if (currentReceipt.status === 'patch_ready') {
      const branch = currentReceipt.branch || `trinity/evolution-${proposal.id}`;
      const matches = await githubRequest(env, `/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=all`);
      if (!Array.isArray(matches) || !matches.length) continue;
      const linked = matches[0];
      currentReceipt = {
        ...currentReceipt,
        status: 'pull_request_created',
        pull_request: linked.number,
        url: linked.html_url,
        head_sha: linked.head?.sha || null,
        branch
      };
      await env.DB.prepare("UPDATE self_improvement_proposals SET result_json=?,updated_at=datetime('now') WHERE id=? AND status='approved'")
        .bind(JSON.stringify(currentReceipt), proposal.id).run();
      await audit(env, 'self_improvement_pr_linked', {id: proposal.id, pull_request: linked.number, branch});
      pr = linked.merged_at ? linked : await githubRequest(env, `/pulls/${linked.number}`);
    } else {
      pr = await githubRequest(env, `/pulls/${currentReceipt.pull_request}`);
    }

    if (!pr.merged_at) {
      const mergeOutcome = await mergeVerifiedImprovement(env, pr);
      if (mergeOutcome.status === 'merged') {
        const receipt = await finalizeMergedProposal(env, proposal.id, currentReceipt, mergeOutcome.merge_sha, new Date().toISOString());
        results.push(receipt);
      } else if (proposal.result_json.status === 'patch_ready') {
        results.push(currentReceipt);
      }
      continue;
    }

    const receipt = await finalizeMergedProposal(env, proposal.id, currentReceipt, pr.merge_commit_sha, pr.merged_at);
    results.push(receipt);
  }
  return results;
}
