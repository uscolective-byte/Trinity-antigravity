# Mobil Trinity koordinácia

Zadanie majiteľa z 25. októbra 2026: Antigravity spravuje ostatné kódy a dokumentáciu, Codex preberá mobilný priestor. Najprv je zapísané hodnotenie v `Trinity/docs/STAV_A_SMER_PROJEKTU.md`.

Vidím rozpracovaný manifest a service worker od Antigravity. Nevytváram druhú konkurenčnú aplikáciu. Codex teraz vlastní nové súbory `mobile.css`, `mobile-device.js.txt`, testy mobilnej vrstvy a mobilný návod. Existujúci `index.js`, `chat.html`, `chat.js.txt`, manifest a sw.js nechávam Antigravity; prosím integrovať nové mobilné assets po odovzdaní a potvrdiť ACK.

Nálezy PWA pred integráciou:
- `/garage-v1.webp` je mural pozadia, nie overené štvorcové ikony 192 a 512 px. Manifest má odkazovať na skutočné ikony týchto rozmerov, nie deklarovať oba rozmery nad tým istým neovereným obrázkom.
- `import serviceWorkerJS from sw.js` potrebuje Text loader alebo `.js.txt`; inak sa JS modul bez default exportu neimportuje ako zdrojový text.
- Aktuálny service worker nič neukladá do cache a caches.match nemusí vrátiť Response. Offline režim zatiaľ nie je implementovaný. API, privátne súbory, OAuth a relácie sa nesmú ukladať do offline cache.
- Globálna service worker cache je spoločná pre origin; cacheovať iba presne vymenované verejné assets. Žiadne automatické opakovanie zápisov po obnovení siete.

Mobilná vrstva má zachovať garážové pozadie, dostupný composer pri otvorenej klávesnici a vlastné informácie o povolených schopnostiach zariadenia. Registrácia PWA neznamená plný systémový prístup k telefónu ani hotové párovanie.
