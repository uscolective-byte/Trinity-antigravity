export async function checkRequestedTrinityHealth(task, fetchHealth = fetch) {
  const command = String(task).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!/^(?:(?:prosim[, ]+)?(?:over|skontroluj|zisti|ukaz|pozri)\s+(?:mi\s+)?)?(?:stav|dostupnost|health)\s+(?:trinity|auru\.space)[.!? ]*$/i.test(command)) return null;

  const url = 'https://auru.space/health';
  try {
    const response = await fetchHealth(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const body = response.ok ? await response.json() : null;
    const serving = body?.status === 'serving';
    return {
      response: serving ? 'Produkčná Trinity odpovedá a hlási stav serving.' : 'Služba nepotvrdila stav serving.',
      tool_result: { tool: 'trinity_health', url, http_status: response.status, serving, checked_at: new Date().toISOString() }
    };
  } catch {
    return { response: 'Živý stav Trinity sa nepodarilo overiť.', tool_result: { tool: 'trinity_health', url, serving: null, checked_at: new Date().toISOString() } };
  }
}