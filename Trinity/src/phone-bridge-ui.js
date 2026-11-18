/**
 * Trinity Phone Bridge browser companion (Android / iOS).
 * Browser APIs are used only after an explicit tap. No background control,
 * remote device pairing or execution is claimed.
 */
const page = `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#101827">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>Trinity Phone Bridge</title>
<style>
:root{font-family:system-ui,-apple-system,sans-serif;color-scheme:dark;background:#101827;color:#e8efff}
body{max-width:760px;margin:0 auto;padding:20px}
h1{font-size:1.65rem}h2{font-size:1.08rem}
p,small{color:#b8c4d8;line-height:1.5}
section{border:1px solid #34445c;border-radius:15px;padding:16px;margin:12px 0;background:#172238}
button,input,textarea{font:inherit;border-radius:9px;padding:11px;max-width:100%;box-sizing:border-box}
button{background:#245e78;border:1px solid #5c91aa;color:white;cursor:pointer;margin:4px 0}
input,textarea{background:#111b2d;border:1px solid #4b5d74;color:white;width:100%}
textarea{min-height:88px}label{display:block;margin:8px 0}
#output{white-space:pre-wrap;overflow-wrap:anywhere;padding:10px;background:#0a1527;border-radius:9px}
img{max-width:100%;max-height:240px;object-fit:contain}
</style>
<script src="/phone/bridge.js" defer></script>
</head>
<body>
<h1>Trinity Phone Bridge</h1>
<p><strong>Lokálne možnosti telefónu – nezapárované.</strong> Táto stránka nie je pripojeným vzdialeným agentom. Žiadne údaje z kamery, polohy alebo schránky automaticky neodosiela do cloudu.</p>
<section><h2>Stav zariadenia</h2><button id="device">Načítať dostupné informácie</button><p id="device-status">Zatiaľ neoverené.</p></section>
<section><h2>Súbor</h2><label>Názov súboru <input id="filename" value="trinity.txt" maxlength="80"></label>
<label>Obsah <textarea id="filecontent"></textarea></label>
<button id="download">Vyžiadať stiahnutie súboru</button>
<small>Prehliadač rozhoduje, kam sa súbor uloží. Úspech sťahovania neznamená potvrdenie zápisu na disk.</small></section>
<section><h2>Kamera (iba s tvojím výberom)</h2><label>Odfotiť alebo vybrať obrázok<input id="photo" type="file" accept="image/*" capture="environment"></label><img id="preview" alt="Vybraná fotografia" hidden></section>
<section><h2>Poloha</h2><button id="location">Vyžiadať GPS polohu</button><p>Polohu zobrazuje iba tento prehliadač; nie je synchronizovaná s Trinity.</p></section>
<section><h2>Schránka, vibrácia, oznámenia</h2><label>Text do schránky<input id="clipboard-text"></label><button id="clipboard">Skopírovať</button>
<button id="vibrate">Zavibrovať</button><button id="notify">Lokálne oznámenie</button></section>
<section><h2>Výsledok</h2><div id="output" role="status" aria-live="polite">Pripravené na manuálne akcie.</div></section>
</body></html>`;

const script = `(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const say = message => { el('output').textContent = String(message); };
  el('device').addEventListener('click', async () => {
    const connection = navigator.onLine ? 'online (podľa prehliadača)' : 'offline (podľa prehliadača)';
    let battery = 'Batéria: API nie je podporované';
    try {
      if (typeof navigator.getBattery === 'function') {
        const b = await navigator.getBattery();
        battery = 'Batéria: ' + Math.round(b.level * 100) + '%; nabíjanie: ' + (b.charging ? 'áno' : 'nie');
      }
    } catch { battery = 'Batéria: údaj sa nepodarilo získať'; }
    const result = connection + '; ' + battery;
    el('device-status').textContent = result;
    say(result);
  });
  el('download').addEventListener('click', () => {
    const name = el('filename').value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,79}$/.test(name) || name.endsWith('.')) {
      say('Neplatný názov súboru.'); return;
    }
    const blob = new Blob([el('filecontent').value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    say('Požiadavka na stiahnutie odoslaná. Uloženie súboru ešte nie je overené.');
  });
  let previousImageUrl;
  el('photo').addEventListener('change', () => {
    const file = el('photo').files && el('photo').files[0];
    if (!file || !file.type.startsWith('image/')) { say('Žiadny platný obrázok.'); return; }
    if (previousImageUrl) URL.revokeObjectURL(previousImageUrl);
    previousImageUrl = URL.createObjectURL(file);
    el('preview').src = previousImageUrl;
    el('preview').hidden = false;
    say('Obrázok vybraný lokálne (' + file.name + '). Nebol odoslaný na server.');
  });
  el('location').addEventListener('click', () => {
    if (!navigator.geolocation) { say('Geolokácia nie je podporovaná.'); return; }
    say('Čaká sa na súhlas s polohou.');
    navigator.geolocation.getCurrentPosition(
      p => say('Lokálne zistená poloha: ' + p.coords.latitude.toFixed(5) + ', ' +
        p.coords.longitude.toFixed(5) + '; presnosť ~' + Math.round(p.coords.accuracy) + ' m.'),
      e => say('Zistenie polohy zlyhalo alebo nebolo povolené: ' + e.message),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 }
    );
  });
  el('clipboard').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(el('clipboard-text').value);
      say('Prehliadač potvrdil zápis textu do schránky.');
    } catch (e) { say('Schránka: ' + e.message); }
  });
  el('vibrate').addEventListener('click', () => {
    if (!navigator.vibrate || navigator.vibrate(150) !== true) say('Vibrácia nie je podporovaná alebo nebola potvrdená.');
    else say('Prehliadač prijal požiadavku na vibráciu (fyzická odozva nie je overená).');
  });
  el('notify').addEventListener('click', async () => {
    try {
      if (!('Notification' in window)) throw new Error('Notifications API unavailable');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notifications permission not granted');
      const n = new Notification('Trinity Phone Bridge', { body: 'Manuálne lokálne oznámenie' });
      say('Prehliadač prijal vytvorenie lokálnej notifikácie.');
      setTimeout(() => n.close(), 10000);
    } catch (e) { say('Notifikácia: ' + e.message); }
  });
})();`;

export function handlePhoneBridgePage(request) {
  if (request.method !== 'GET') return null;
  const path = new URL(request.url).pathname;
  if (path === '/phone') {
    return new Response(page, { headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    } });
  }
  if (path === '/phone/bridge.js') {
    return new Response(script, { headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    } });
  }
  return null;
}
