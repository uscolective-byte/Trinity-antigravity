# Trinity Antigravity

Trinity je AI asistentka s webovým chatom, panelom Omni-Dev, nástrojmi cez MCP a prepojením na autorizovaný počítač. Basterix (Ivan Sabo) je zakladateľ a vlastník projektu.

<!-- trinity-release:start -->
Verzia zdroja: **11.1.0**. Repozitár: [uscolective-byte/Trinity-antigravity](https://github.com/uscolective-byte/Trinity-antigravity), vetva **`main`**.

| Doména | Prostredie | Worker |
|---|---|---|
| auru.space | production | `trinity` |

Tieto údaje sa generujú zo zdrojov a konfigurácie. Aktuálne nasadenie over cez `/health`, `/ready` a commit tag; nejde o živý stav integrácií.
<!-- trinity-release:end -->

## Kde začať

- [Trinity](https://auru.space/) a [Omni-Dev](https://auru.dev/#omnidev) otvárajú produkčnú aplikáciu.
- [Mobilný chat](https://auru.dev/mobile) používa webové rozhranie Trinity.
- [Architektúra](ARCHITECTURE.md) opisuje návrh vrstiev. [API referencia](API_REFERENCE.md) dokumentuje rozhrania.
- [Príručka Workera](Trinity/README.md) pokrýva prihlásenie, lokálny vývoj a nasadenie. [Prevádzkový postup](docs/runbooks/deploy-and-migrate.md) opisuje nasadenie a migrácie.

## Čo je v repozitári

| Časť | Úloha |
| --- | --- |
| [Trinity/](Trinity/) | Produkčný Cloudflare Worker, webové rozhranie, chat, autorizácia, MCP a smerovanie nástrojov. |
| [PC-Bridge-Worker/](PC-Bridge-Worker/), [Local-Gateway/](Local-Gateway/), [Local-Desktop/](Local-Desktop/) | Cloudová časť PC Bridge, lokálna brána a desktopové rozhranie. |
| [Integrations-Worker/](Integrations-Worker/), [Knowledge-Worker/](Knowledge-Worker/), [Audit-Worker/](Audit-Worker/), [Capacity-Worker/](Capacity-Worker/) | Vyhradené služby pre integrácie, znalosti, audit a kapacitu. Ich konfiguráciu over v súboroch Wrangler. |
| [Jericho-Worker/](Jericho-Worker/), [contracts/tetrakis/](contracts/tetrakis/) | Finančné moduly a zdroj tokenového kontraktu. Pripojenie poskytovateľa a stav transakcie over samostatne. |
| [Firebase/](Firebase/) | Konfigurácia hostingu a prezentačná stránka Trinity. |

## Funkcie a stav pripojení

| Funkcia | Čo je implementované | Ako overiť prevádzku |
| --- | --- | --- |
| Omni-Dev a PC Bridge | Prehliadanie pracovného priečinka, terminál a export CSV. | V prihlásenej relácii otvor priečinok a skontroluj výsledok. Stav Online potvrdzuje prihlásenie zariadenia, úspech operácie potvrdzuje jej odpoveď. |
| Google Drive | Výber súboru a import podporovaného textu do konceptu. | Vyber súbor po prihlásení do Google a skontroluj, či jeho text pribudol v koncepte. |
| Spotify | Ovládanie hudby z rozhrania Trinity. | Spusť prehrávanie vo vlastnej relácii a over, že funguje v prehliadači. |
| Modely a externé služby | Pripojenia závisia od konfigurácie konkrétneho poskytovateľa. | Urob autorizovanú skúšobnú požiadavku cez Trinity a skontroluj výsledok. |
| Firebase Hosting | Samostatná prezentácia pripravená v repozitári. | Over vydanú verziu na adrese hostingu po nasadení. |
| Google AI Studio Bridge | Priamy most do `generativelanguage.googleapis.com/v1beta` (`/api/assistant/ai-studio/status`, `/models`, `/verify`, `/generate`, `/co-create`, `/sessions`), nástroj `google_ai_studio` a MCP nástroje `google_ai_studio_*`. | Ulož kľúč cez šifrovaný Trezor (`google_ai_studio` / `gemini`), Worker secret alebo Cloudflare Secrets Store a over cez `POST /api/assistant/ai-studio/verify`. |
| Tetrakis (`$TTK`) Native Space | Neväzobný Web3 priestor pre Base L2 ERC-20 (`1 000 000 000 TTK`, `/tetrakis-logo.png`, Truth Policy 2.1 fail-closed overenie) a 4 natívne ekosystémové roly popri `@wallet`. | Over stav kontraktu cez `GET /api/assistant/crypto/tetrakis` alebo `node scripts/verify-tetrakis.mjs`. |

## Tetrakis (`$TTK`) — 4 natívne ekosystémové roly

1. **Natívne platby v chate a okamžité P2P prevody** — priame prevody medzi peňaženkami, prepitné a platobné požiadavky v Trinity Messengeri a `@wallet`.
2. **Ekonomika Mini-Apps, AI Studia a botov** — natívne platidlo pre weby a aplikácie generované v AI Studiu, agentov, skilly, pluginy a mikroslužby.
3. **Domény, mená (`@handle`) a digitálne aktíva** — využitie pre ekosystémové používateľské mená/handly, doménové a hostingové služby a overiteľné digitálne aktíva/zberateľské položky.
4. **Ekonomika tvorcov, výpočtov a neväzobný Tetrakis Space** — vlastná peňaženka pod kontrolou používateľa (privátne kľúče nikdy neopúšťajú používateľa), odmeny tvorcov a zúčtovanie edge výpočtov/úložiska. *(Truth Policy 2.1: overený on-chain stav kontraktu sa vždy odlišuje od vízie ekosystému; Trinity nikdy nevymýšľa trhovú cenu ani neoverený deploy.)*

## Dvojjazyčná architektúra (Dual-Language Architecture)

- **Inžinierska a interná vrstva (100 % angličtina / English):** zdrojový kód, komentáre, JSDoc, identifikátory, interné logy, interné inštrukcie agentov, schémy nástrojov a technická dokumentácia.
- **Používateľská komunikácia (slovenčina / Slovak):** konverzačné odpovede Trinity, pozdravy, notifikácie a používateľské rozhranie komunikujú prirodzenou slovenčinou (pokiaľ používateľ nenapíše v inom jazyku).

## Vývoj a nasadenie

Na Windows spusti z koreňa repozitára:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-all.ps1
npm.cmd run check
npm.cmd test
npm.cmd run build:worker
```

Produkčné nasadenie vychádza z vetvy **main**. Po nasadení over stav a nasadený commit na oboch doménach. Pri integráciách over aj konkrétnu akciu v prihlásenej relácii. Hodnoty kľúčov a tokenov patria do úložiska tajomstiev príslušnej služby.

[Protokol PC Bridge](docs/bridge/protocol.md) · [Bezpečnostné hlásenia](SECURITY.md) · [Licencia](LICENSE) · [Charta](SOVEREIGN_CHARTER.md)
