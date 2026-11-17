# Trinity Antigravity

Trinity je AI asistentka s webovým chatom, panelom Omni-Dev, nástrojmi cez MCP a prepojením na autorizovaný počítač. Basterix (Ivan Sabo) je zakladateľ a vlastník projektu.

<!-- trinity-release:start -->
Verzia zdroja: **11.1.0**. Repozitár: [uscolective-byte/Trinity-antigravity](https://github.com/uscolective-byte/Trinity-antigravity), vetva **`main`**.

| Doména | Prostredie | Worker |
|---|---|---|
| auru.space | production | `trinity` |
| auru.dev | production | `trinity` |

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
