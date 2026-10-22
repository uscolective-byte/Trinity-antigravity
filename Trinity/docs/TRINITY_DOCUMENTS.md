# 📚 Trinity Documents — Kontinuálna dokumentácia každého kroku (Trinity 10.3)

Tento dokument slúži ako referenčná príručka a živý záznam systému **Trinity Documents**, živého samorozvoja UI (**Trinity Live UI Evolution**) a produkcie doménových prostredí (**Cloudflare Domain Environments**).

---

## 1. Prehľad vylepšení (Trinity 10.3)

| Oblasť | Schopnosť | Nástroje pre Trinity | HTTP API Endpointy |
|---|---|---|---|
| **1. Živá úprava UI & Samorozvoj** | Trinity si dokáže sama upravovať vlastné používateľské rozhranie (témy, farby, mierku písma, nadpisy, vlastné widgety na Prehľade, bezpečné CSS) a ukladať trvalé pravidlá správania. | `ui_evolve`, `self_evolve`, `propose_improvement` | `GET/POST /api/assistant/ui-evolution`, `GET /theme.css`, `GET /api/assistant/changes`, `POST /api/assistant/changes/:id/(approve\|rollback)` |
| **2. Domény, prostredia & živá produkcia** | Tvorba novej domény, správa DNS a automatické vytvorenie Cloudflare-štýlových prostredí (`production`, `staging`, `development`) s okamžitým nasadením živého webu. | `domain_env_provision`, `domain_env_deploy`, `domain_env_list` | `GET /api/assistant/domains/environments`, `POST /api/assistant/domains/environments/provision`, `POST /api/assistant/domains/environments/deploy`, `GET /sites/:domain/:env` |
| **3. Trinity Documents (pri každom kroku)** | Súčasne s každým dokončeným krokom v chate (`workflow.js`), každou úpravou UI, každým samorozvojom a každou operáciou s doménami sa automaticky vytvorí **Trinity Dokument** s exportom do `.md` a `.pdf`. | `trinity_doc_create`, `trinity_doc_list` | `GET/POST /api/assistant/documents`, `GET /api/assistant/documents/:id`, `GET /api/assistant/documents/:id/export?format=md\|pdf`, `POST /api/assistant/documents/:id/delete` |
| **4. Obchod, Revolut Pro & PayPal** | Prepojenie Revolut Pro (`revolut.me`, `pay.revolut.com`) a PayPal (`paypal.me`, `paypal.com`), verejný katalóg a trhovisko domén. | `commerce_status`, `commerce_configure`, `monetization_blueprint`, `revolut_pro_payment_link`, `paypal_payment_link` | `GET /api/assistant/commerce/status`, `POST /api/assistant/commerce/accounts`, `POST /api/assistant/commerce/products`, `GET /pay/revolut-pro/:id`, `GET /pay/paypal/:id` |

---

## 2. Ako funguje automatické vytváranie Trinity Documents

1. **Pri každej úlohe v chate (`Trinity/src/workflow.js`)**:
   - Po dokončení kroku `save-result` sa automaticky zavolá `recordStepDocument(env, {...})`.
   - Dokument obsahuje zadanie používateľa, vykonané pod-kroky agentov, použité nástroje a výsledný výstup.
2. **Pri každej úprave vzhľadu UI (`Trinity/src/ui-evolution.js`)**:
   - Keď Trinity alebo používateľ zmení tému, farby, texty alebo pridá widget, automaticky sa zapíše dokument kategórie `ui_evolution` s presným popisom zmeny a možnosťou `Rollback`.
3. **Pri každom vytvorení domény a nasadení prostredia (`Trinity/src/domain-environments.js`)**:
   - Pri vytvorení domény (`provisionDomainWithEnvironments`) alebo publikovaní webu do `production` / `staging` / `development` (`deployDomainEnvironment`) sa automaticky vytvorí dokument kategórie `domain_production` s verejnými URL odkazmi `/sites/:domain/:env`.
4. **Pri samorozvoji (`self_evolve`)**:
   - Keď si Trinity uloží nové trvalé pravidlo správania (`behavior_rule`) alebo návrh na vylepšenie kódu (`code_improvement`), okamžite vznikne dokument kategórie `self_improvement`.

---

## 3. Export a uloženie

- Každý **Trinity Dokument** je uložený v:
  1. **Cloudflare KV (`Mastermind`)** pod kľúčom `trinity_documents:v1` pre okamžitý prístup.
  2. **Cloudflare D1 (`ops_memory` + `ops_artifacts`)** pre indexované vyhľadávanie.
  3. **Cloudflare R2 (`ARTIFACTS`)** pod kľúčom `trinity-docs/:id/:slug.md`.
- V sekcii **📚 Dokumenty** v rozhraní Trinity možno každý dokument jedným klikom stiahnuť ako:
  - **Markdown (`.md`)**: `/api/assistant/documents/:id/export?format=md`
  - **PDF (`.pdf`)**: `/api/assistant/documents/:id/export?format=pdf`
