
// Trinity Autonómny dispatcher akcií pre prehliadaè a PC
async function dispatchLocalAction(action, target, args = '') {
  try {
    const res = await fetch('http://127.0.0.1:7777/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, target, args })
    });
    return await res.json();
  } catch(e) {
    console.warn('Antigravity Bridge nedostupný:', e);
    return null;
  }
}
