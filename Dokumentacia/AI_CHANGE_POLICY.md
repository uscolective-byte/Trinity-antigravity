# Trinity-Morhfeus — AI Change Policy

## Metadata a pôvod
Každá AI iniciovaná zmena musí v PR uviesť zdroj, riziko, komponent a účel. Verziovaná reprezentácia sa overuje JSON schémou:
- `.github/ai-change-policy.schema.json`
- `.github/ai-change.json`

Pole `reviewed` je len evidencia, nie dôkaz schválenia. **Skutočné schválenie musí vykonať oprávnený človek cez GitHub CODEOWNERS review**; povinnosť sa nastavuje v branch protection alebo repository rulesets. AI si nemôže sama vyhlásiť review ako platné.

## Politika zmien
- Návrh kódu → izolovaná vetva → PR → testy a audit → nezávislé review.
- Zmeny D1 migrácií, secrets, Cloudflare routes a PC Bridge sú vysoké riziko; vyžadujú review aj rollback plán.
- Nikdy neukladať tajomstvá do repozitára, CI logu ani AI kontextu.
- Pred nasadením skontrolovať **konkrétny commit**, cieľový Worker a staging/prod prostredie.
- Staging a production majú mať **samostatné Cloudflare resources**, domény, tajomstvá a D1; nepoužívať produkčnú D1 na testy.
- Produkčný deploy sa nespúšťa implicitne pushom na vetvu. Vyžaduje schválenie chráneného GitHub Environment + RBAC.
- Ak GitHub Actions runner nespustí job, nepovažovať žiadne CI kritérium za úspešné.
- Audit používa parametrizované D1 zápisy a HMAC, nie používateľský SQL text ani samotný SHA256 hash na autentifikáciu.

## Security a quality gates
- `npm ci`, Wrangler bundle v dry-run režime, unit testy, `npm audit --audit-level=high`.
- Ajv validácia JSON manifestu proti schéme; bez ručných regex kontrol `reviewed:false`.
- CodeQL, Dependabot a GitHub secret scanning (dostupnosť zapnúť v nastaveniach GitHub).
- ESLint / TypeScript type-check sa nesmie uvádzať ako úspešný, kým nie je pridaný a reálne spustený.
- Snyk je voliteľný až po výslovnom nastavení dôveryhodného tokenu a politiky.

## Aktuálne blokéry
- GitHub-hosted runner v posledných behoch hlásil `runner_name=""` a `steps=[]`; testy sa na GitHube nevykonali.
- Audit Worker, D1 migrácia, staging resources a nové secrets vyžadujú overenú konfiguráciu.
- GitHub CODEOWNERS súbor neznamená automaticky vynútenie review. Nastav ruleset pre `main`.
