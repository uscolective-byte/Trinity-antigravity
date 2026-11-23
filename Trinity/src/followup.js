/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module followup.js (Trinity/src/followup.js) in the TRINITY OMNI-CORE ecosystem.
 */
/**
 * Trinity Follow-Up Generator v1.0
 * Safe bounded generation of follow-up steps without loop risk.
 */
import {createJob} from './jobs.js';

export async function createFollowupJob(env, sourceJob, resultText) {
  if (!env || !sourceJob || !resultText) return null;

  // Guard against recursion and infinite loops
  const plan = typeof sourceJob.plan_json === 'string'
    ? JSON.parse(sourceJob.plan_json || '{}')
    : (sourceJob.plan_json || {});

  // Chaining is allowed only when allow_followup is enabled in the plan and depth < 1
  if (!plan.allow_followup || plan.is_followup || (plan.followup_depth || 0) >= 1) {
    return null;
  }

  const followTask = `Follow-up step for job [${sourceJob.id}]: "${sourceJob.task}". Summary of previous output: ${resultText.slice(0, 400)}. Verify and execute the next logical step. Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal 'tykanie' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language.`;

  try {
    return await createJob(env, {
      task: followTask,
      session_id: sourceJob.session_id,
      agent: 'auto',
      mode: 'team',
      provider: sourceJob.provider || 'workers-ai',
      language: sourceJob.language || 'sk',
      owner_mode: sourceJob.owner_mode === 1
    });
  } catch (err) {
    console.error('Follow-up generation skipped due to error:', err.message);
    return null;
  }
}
