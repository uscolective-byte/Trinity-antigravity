/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module evolution.js (Trinity/src/evolution.js) in the TRINITY OMNI-CORE ecosystem.
 */
/**
 * Trinity Evolution Engine v1.0
 * Automatic failure analysis and continuous self-improvement for Trinity.
 */
import {readControl, assertRunning} from './control.js';
import {resolveGitHubToken} from './project-evolution.js';
import {createSelfImprovementProposal,approveSelfImprovementProposal,applySelfImprovementProposal,reconcileSelfImprovements} from './self-improvement.js';

export async function runEvolutionCycle(env) {
  if (!env || !env.DB) return {status: 'db_not_available'};

  const control = await readControl(env);
  assertRunning(control);

  try { await reconcileSelfImprovements(env); }
  catch(error){ await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('evolution_reconcile_failed',?)").bind(JSON.stringify({error:error.message})).run(); }

  // Find the most recent failed jobs
  const failedRows = await env.DB.prepare(
    "SELECT id, session_id, task, error, provider, language, updated_at FROM ops_jobs WHERE status='failed' AND error IS NOT NULL ORDER BY updated_at DESC LIMIT 3"
  ).all();

  const failedJobs = failedRows.results || [];
  if (!failedJobs.length) {
    return {status: 'no_failures', message: 'No failed jobs to analyze.'};
  }

  const analyzed = [];

  for (const job of failedJobs) {
    // Check whether this job has already been analyzed in evolution memory
    const existing = await env.DB.prepare(
      "SELECT key FROM ops_memory WHERE key=?"
    ).bind(`evolution/job-${job.id}`).first();

    if (existing) continue;

    // Failure diagnosis and learned lesson
    const errorText = (job.error || 'Unknown error').slice(0, 500);
    const diagnosis = {
      job_id: job.id,
      task: job.task,
      error: errorText,
      analyzed_at: new Date().toISOString(),
      lesson: `An error occurred while executing the job: ${errorText}. Recommendation: Verify tool parameters and availability of provider ${job.provider}.`
    };

    if (env.TRINITY_AUTO_IMPROVE === 'true' && Boolean(resolveGitHubToken(env))) {
      const proposal=await createSelfImprovementProposal(env,{title:`Fix failed job ${job.id}`.slice(0,120),description:`Identify the root cause and prepare the minimal fix with a test. Task: ${String(job.task).slice(0,2000)}. Error: ${errorText}`,kind:'code_improvement'},'evolution-engine');
      await approveSelfImprovementProposal(env,proposal.id,'owner-standing-policy:TRINITY_AUTO_IMPROVE');
      try { diagnosis.execution=await applySelfImprovementProposal(env,proposal.id,'evolution-engine'); }
      catch(error){ diagnosis.execution={status:'failed',error:error.message}; }
    }

    // Store the finding in Trinity memory so the same failure is not repeated
    await env.DB.prepare(
      "INSERT INTO ops_memory(key, value, source) VALUES(?, ?, 'evolution-engine') ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')"
    ).bind(`evolution/job-${job.id}`, JSON.stringify(diagnosis)).run();

    // Record the event in the audit trail
    await env.DB.prepare(
      "INSERT INTO ops_events(job_id, action, details) VALUES(?, 'evolution_learning_recorded', ?)"
    ).bind(job.id, JSON.stringify({job_id: job.id, lesson: diagnosis.lesson})).run();

    analyzed.push({job_id: job.id, diagnosis: diagnosis.lesson});
  }

  return {
    status: analyzed.length ? 'evolution_cycle_completed' : 'already_analyzed',
    analyzed_count: analyzed.length,
    analyzed
  };
}
