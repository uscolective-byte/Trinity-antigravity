# Trinity Local Gateway

Privátna systémová vrstva jednej Trinity. Počúva výhradne na `127.0.0.1:8791` a pracuje iba v koreňovom priečinku Morhfeus.

## Bezpečnostný model

- tajný lokálny token je uložený cez Windows DPAPI a nie je vo verziovacom systéme,
- priame súborové nástroje blokujú `.credentials`, `.git`, `.wrangler`, `node_modules`, `.env` a súkromné kľúče; spustený skript však beží s právami Windows používateľa a nie je OS sandbox,
- spúšťajú sa pevne povolené úlohy alebo schválené Node/Python/CMD skripty s presným SHA-256,
- každá zmena má postup `návrh -> presné schválenie ID -> vykonanie -> potvrdenie`,
- `selfwrite` môže meniť iba súbory projektu `Trinity` a vyžaduje aktuálny SHA-256,
- upload/share bez pripojeného cieľa iba pripravia lokálny outbox a nikdy nepredstierajú zverejnenie.

## Spustenie

1. Raz spusti `setup.ps1`.
2. Raz spusti `connect-cloud.ps1`; vytvorí oddelený kľúč, uloží ho cez Windows DPAPI a bezpečne ho nastaví ako Cloudflare secret.
3. Potom používaj `SPUSTIT-LOCAL.cmd`.
4. `install-autostart.ps1` nastaví bezpečné automatické spustenie po prihlásení do Windows.

Predvolený cieľ je produkcia `https://auru.space`. Pre vývoj používaj pri pripojení aj spustení `-Environment development`; používa samostatný `gateway-key-development.dpapi`. Vývojová brána potrebuje vlastné kompatibilné bindingy. Nikdy nezdieľaj produkčný kľúč s vývojovým prostredím. Spúšťač odstráni zdedené cloudové nastavenia pred načítaním zvoleného prostredia.

Na Windows sa npm spúšťa cez jeho JS vstupný bod pomocou Node bez shellu. Nasadenie vyžaduje čistý pracovný strom a používa tag aktuálneho Git commitu.

## Ovládanie počítača

Desktop Controller 1.1 podporuje zoznam otvorených okien, spustenie a aktivovanie povolených aplikácií a písanie do Poznámkového bloku. Pred každou desktopovou operáciou musí používateľ schváliť presné ID návrhu. Predvolený zoznam aplikácií: Poznámkový blok, Kalkulačka, Skicár a Prieskumník. Prehliadače, heslá, platby a neobmedzené príkazy nie sú povolené.

## Lokálny mozog

Lokálny Ollama model `qwen3:4b-instruct` môže spracovať chat na tomto počítači bez spotreby cloudového modelu. Instruct varianta nepoužíva dlhý thinking výstup, ktorý na tomto CPU spôsoboval timeout. Profil používa 6 z 8 logických procesorov, 4K kontext a necháva dva procesory pre Windows. Tento počítač má 15,6 GB RAM, štvorjadrový i5-10310U a integrovanú Intel UHD; je vhodný pre 4B až menší 8B kvantovaný model, nie pre veľký 31B model. Presný profil je v `config/resource-profile.json`.

Cloudflare Worker `trinity-pc-bridge` prijíma pravidelný heartbeat a cez interné RPC zobrazuje orchestrátoru stav PC. Jeho kľúč je uložený cez Windows DPAPI a na Cloudflare ako Worker secret.

Stav bez tajného kľúča: `GET http://127.0.0.1:8791/health`.

## Node, Python a CMD

Nástroj `pc_run_script` používa `runtime: node|python|cmd`, cestu pod `Trinity/workspace/scripts/`, presný `expected_sha256`, voliteľné `args` a `timeout_ms` (1000–120000, predvolene 30000). Najprv skript zapíš a prečítaj; použi hash potvrdený bránou. Python používa lokálne nainštalovaný interpreter a izolovaný režim `-I`; Node používa interpreter samotnej brány. CMD podporuje iba Windows a argumenty bez shellových metaznakov. Inline shellové príkazy nástroj neprijíma; CMD príkazy vlož do skontrolovaného `.cmd` súboru.

Doklad obsahuje runtime, cestu, SHA-256, stdout, stderr, exitCode a success. Návratový kód 0 znamená úspech procesu, nie automaticky správnosť výsledku. Časový limit vo Windows ukončí strom spusteného procesu. Skripty nededia tajomstvá z prostredia brány, ale nie sú izolované od OS ani siete: spúšťaj len dôveryhodný kód schválený vlastníkom. Bezpečnostný model súborových nástrojov nemožno považovať za sandbox skriptov. Počítač aj miestna brána musia bežať.

`pc_run` podporuje navyše pevné príkazy `node --version`, `python --version`, `cmd /c ver`. Inštalácia balíkov a ľubovoľný interaktívny terminál nie sú súčasťou tejto schopnosti.


## Native workspace search

The gateway supports read actions with `task: workspace-search`. Use `mode: files` with a glob, or `mode: content` with a literal pattern / `regex: true`. Results include real paths, line numbers, bounded snippets, byte columns, and explicit `truncated` / `limit_reasons` fields. Worker tools are `pc_find_files` and `pc_search_text`.

Requires Node >=22.20 and ripgrep. On Windows x64 run `./install-search.ps1`; it installs the official standalone ripgrep 15.2.0 archive under the current user's LocalAppData/Trinity directory, verifies SHA-256 `71b2fef860abe467217a538ff31de02f5258807c0129f771846f87bd029aafc5`, retains the archive's licenses and checks the installed version. It has no dependency on the Codex installation. Other platforms use `rg` from PATH; `TRINITY_RG_PATH` is an optional trusted administrator override.

Search remains inside the configured workspace, omits protected credentials and symbolic links, bounds traversal to 5,000 files and depth 20, and excludes files above 1 MB from content search. Search result text is bounded to 24 KB and the traversal/search operation to a 10-second time budget. File-size exclusions and traversal/output/result limits are reported. Zero matches is a valid empty result; an invalid regex or missing search executable is an error.

Official sources: https://github.com/BurntSushi/ripgrep/releases/tag/15.2.0 and https://nodejs.org/api/path.html#pathmatchesglobpath-pattern.

A content search with no matching candidate files reports `search_performed: false` and `coverage: no_candidate_files`. This does not establish absence across other file types. The assistant checks unrequested extension filters before accepting a negative conclusion. Raw gateway flags are type-checked as well as Worker tool arguments.

## Cloud runner pre staging

Z koreňa repozitára zostav image pomocou
`docker build -f Local-Gateway/Dockerfile.cloud -t trinity-cloud-runner .`.
Runner potrebuje jednu repliku, zapisovateľný trvalý volume pre
`TRINITY_GATEWAY_DATA`, samostatný staging `TRINITY_GATEWAY_KEY` a odchádzajúce
HTTPS na `auru.dev`. Koncový bod `/health` zobrazuje stav pripojenia bez kľúčov.

Runner preberá iba schválené úlohy pre build a testy Trinity, testy brány a
kontrolu verzie Node.js. Pred preberaním úloh overí, že `auru.dev/health`
identifikuje samostatný staging Worker Trinity. Nasadenie vyžaduje staging
front akcií a vlastné oprávnenia. Používaj obraz zostavený zo skontrolovaného
commitu. Výstupy úloh sa vracajú cez existujúci protokol potvrdení.
