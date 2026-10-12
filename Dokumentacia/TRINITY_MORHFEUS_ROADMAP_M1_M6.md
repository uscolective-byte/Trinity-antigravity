# Trinity-Morhfeus — architektonická roadmap M1–M6

| Etapa | Cieľ | Akceptačné kritériá |
| --- | --- | --- |
| M1 Core Foundation | Trinity REST API, D1, R2, RBAC, audit | Schéma a secrets overené na stagingu; chránené API; audit receipt |
| M2 Microsoft Copilot | Entra OAuth, OpenAPI, Azure Function adapter | Overený JWT, read-only akcie, explicitný action allowlist |
| M3 Autonomous Agent | GitHub PR agent, sandbox testy, review engine | AI nikdy neschvaľuje vlastný kód; auditované návrhy |
| M4 Deployment Engine | GitHub Actions, staging, produkcia | Izolované environments, review, immutable SHA, rollback |
| M5 PC Bridge | Povolené lokálne príkazy a súbory | Najmenšie oprávnenia, workspace allowlist, audit receipts |
| M6 Self-Healing Platform | Diagnostika, build failure analysis, rollback, recovery | Návrhy opráv s dôkazmi, limitované retries a manuálne schválenie produkčných zásahov |

## Poradie práce
1. Staging D1 s verifikovanou migráciou `0032_ci_audit.sql`, audit Worker a audit client.
2. Opraviť GitHub Actions runner a úspešne vykonať CI, security scan a CodeQL.
3. Zapnúť branch/ruleset protection a GitHub Environment approvals.
4. Pridať Copilot connector s iba čítacími akciami.
5. Pridávať execution, PC Bridge a self-healing len po samostatnom testovaní a revízii.

**Prostredia:** produkčné `auru.space`, vývojové/staging `auru.dev` len po overení skutočného routingu. Rozdielne domény nestačia; nesmú zdieľať produkčné secrets a databázové zápisy.
