# Mobil Trinity koordinácia

Zadanie majiteľa z 25. októbra 2026: Antigravity spravuje ostatné kódy a dokumentáciu, Codex preberá mobilný priestor. Najprv je zapísané hodnotenie v `Trinity/docs/STAV_A_SMER_PROJEKTU.md`.

Vidím rozpracovaný manifest a service worker od Antigravity. Nevytváram druhú konkurenčnú aplikáciu. Codex teraz vlastní nové súbory `mobile.css`, `mobile-device.js.txt`, testy mobilnej vrstvy a mobilný návod. Existujúci `index.js`, `chat.html`, `chat.js.txt`, manifest a sw.js nechávam Antigravity; prosím integrovať nové mobilné assets po odovzdaní a potvrdiť ACK.

Nálezy PWA pred integráciou:
- `/garage-v1.webp` je mural pozadia, nie overené štvorcové ikony 192 a 512 px. Manifest má odkazovať na skutočné ikony týchto rozmerov, nie deklarovať oba rozmery nad tým istým neovereným obrázkom.
- `import serviceWorkerJS from sw.js` potrebuje Text loader alebo `.js.txt`; inak sa JS modul bez default exportu neimportuje ako zdrojový text.
- Aktuálny service worker nič neukladá do cache a caches.match nemusí vrátiť Response. Offline režim zatiaľ nie je implementovaný. API, privátne súbory, OAuth a relácie sa nesmú ukladať do offline cache.
- Globálna service worker cache je spoločná pre origin; cacheovať iba presne vymenované verejné assets. Žiadne automatické opakovanie zápisov po obnovení siete.

Mobilná vrstva má zachovať garážové pozadie, dostupný composer pri otvorenej klávesnici a vlastné informácie o povolených schopnostiach zariadenia. Registrácia PWA neznamená plný systémový prístup k telefónu ani hotové párovanie.

## HANDOFF_CODEX_MOBILE_20261025

Hotové nové súbory: `Trinity/public/assistant/mobile.css`, `mobile-device.js.txt`, `Trinity/tests/mobile-device.test.mjs`, `Trinity/docs/MOBILNY_PRIESTOR.md`. Testy **6/6 PASS**. Žiadny zásah Codexu do tvojho index.js/chat.html/chat.js.txt ani do rozpracovaného service workera.

Prosím integrovať do index.js ako Text assets (rovnako ako garage.css/chat.js.txt):
- import mobileCSS from ../public/assistant/mobile.css
- import mobileDeviceJS from ../public/assistant/mobile-device.js.txt
- GET /mobile.css → text/css, no-cache
- GET /mobile-device.js → application/javascript, no-cache
- chat.html: stylesheet /mobile.css AŽ ZA garage.css a defer script /mobile-device.js za chat.js.

Modul používa existujúce `image-input`, `record-voice` a prihlásenie, nepridáva paralelný chat ani nové API kľúče. Panel vzniká dynamicky v `.header-actions`; tlačidlo Telefón viditeľné iba na mobilnej šírke. Nič nežiada prístup k mikrofónu/kamere pri načítaní. Inštalácia sa nepredstiera, accepted nie je totožné s appinstalled. Offline nič automaticky neopakuje.

Majiteľ teraz zdôraznil zachovanie klastra a skutočné limity. Pred zvyšovaním kapacity odlíšiť provider kvótu, Workflow limit, request timeout a chybu konkrétnej služby; nevymýšľať príčinu bez dokladu.

Prosím o nový `ACK_CODEX_MOBILE_20261025` a spoločné build/test/deploy overenie. Telefón fyzicky ešte nie je overený a nový mobilný modul bez routovania zatiaľ nie je živý.
