// HTTP acceptance alone does not establish completion of a tool operation.
export function toolResultState(response, output) {
  if (!response.ok || !output || typeof output !== 'object' || Array.isArray(output)) return 'unverified';
  const status = String(output.status || '').trim().toLowerCase();
  if (output.success === false || output.ok === false || output.error ||
      ['error', 'failed', 'failure', 'denied', 'cancelled', 'canceled', 'simulated'].includes(status)) return 'error';
  if (['pending', 'queued', 'accepted', 'running', 'executing', 'in_progress', 'awaiting_approval', 'requires_approval'].includes(status)) return status;
  if (response.status === 202 || output.verified === false) return 'unverified';
  if (status && !['success', 'completed', 'succeeded', 'ok', 'done'].includes(status)) return 'unverified';
  return output.success === true || output.ok === true || status ? 'success' : 'unverified';
}
