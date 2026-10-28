# Trinity 11.0 — Tools Marketplace

Cesta: /marketplace. Autorizované API: GET /api/assistant/tool-marketplace.

Marketplace číta celý pôvodný register PLUGINS vrátane EXTENDED_PLUGINS.
Pridáva 10 externých konektorov a 4 lokálne zábavné nástroje, vyhľadávanie a
filtre: AI, sociálne siete, Cloud, vývoj/OpenAPI, zábava a pomôcky.

## Externé integrácie a pripojenie

| Služba | Skutočná podmienka |
|---|---|
| Instagram / Meta Graph | Meta App, profesionálny účet podľa Meta a schválené OAuth scopes/token |
| OpenAI API | OpenAI API projekt a API key alebo Vault; predplatné ChatGPT nie je API kredit |
| Cloudflare | Worker bindings; samostatné oprávnenie na DNS/deploy |
| Vercel | API token s oprávnením k tímu/projektu, test API |
| OpenAPI | Dôveryhodná špecifikácia + allowlist adresy + ochrana proti SSRF |
| GitHub | App/OAuth/token podľa rozsahu operácie; zápisy zvlášť |
| Gemini | Gemini API key; osobný Gemini webchat nie je API |
| Copilot Studio | Publikovaný agent a autorizovaný kanál/Direct Line |
| WordPress | Vlastná stránka a autorizovaná REST API relácia |
| Telegram | Bot token, webhook secret a allowlist; samostatný end-to-end test |

## Poctivé stavové indikátory

- V katalógu: plugin existuje v kóde, nie je doklad o jeho inštalácii.
- Zaregistrovaný povolený/vypnutý: databázová registrácia, nie doklad
  o vykonaní akcie.
- Konfigurácia nájdená: detegovaný názov Worker secret alebo binding;
  nejde o overené API spojenie, scopes ani úspešnú operáciu.
- Vyžaduje pripojenie: signál v prostredí chýba. Vault môže mať
  samostatné uložené poverenia, ktoré tento endpoint úmyselne nečíta.
- Lokálne dostupný: funkcia beží iba v prehliadači.

Žiadna externá položka nie je označená za VERIFIED bez skutočného receipt.
Katalóg neinštaluje externé programy, nespracúva API keys a nezapína
neoverené konektory. Karty otvárajú oficiálne HTTPS dokumentácie.
Nástroje na Cloudflare, PC a GitHub zostávajú pod existujúcim autorizovaním
Trinity. Žiadne publikovanie, finančná akcia, merge alebo deploy cez Marketplace.

Frontend používa textContent namiesto innerHTML, CSP bez inline skriptov,
connect-src iba same-origin a bezpečné oddelenie read-only statusu od
oprávnených vykonávacích nástrojov. Platí TEAM-HANDOFF.md.

## Kontrola pred nasadením

Z priečinka Trinity spusti:
- node --test tests/tool-marketplace.test.mjs
- npm.cmd test

Po teste over vývoj a commit tag skutočného deployu. GitHub Actions môže
zostať blokovaný fakturáciou GitHub účtu; taký blokér sa nesmie obísť mergeom.
Rozšírenie konkrétnych OAuth adapterov, API receipts a inštalácie patrí
do samostatných otestovaných PR.
