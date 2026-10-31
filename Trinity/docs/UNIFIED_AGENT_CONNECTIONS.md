# Trinity — jednotný Cloudflare / PC / Codex / ChatGPT / Antigravity / Gemini / Copilot most

**Stav:** implementácia v pracovnom PR, **nie automaticky autorizované externé účty**.
**Kanonický zdroj:** `uscolective-byte/Trinity-antigravity`.
**Cloudflare:** `auru.space` produkcia, `auru.dev` staging (Wrangler `--env staging`).

## Architektúra

```text
ChatGPT (MCP / scoped REST) ----\
Codex (project MCP) ------------\
Google Antigravity (local MCP) --\
Gemini (API + Gemini MCP) -------+--> HTTPS /mcp --> Trinity Cloudflare Worker
Copilot Studio (MCP / REST) ----/         |              |
VS Code (MCP) -----------------/          |              +--> Workers AI / D1 / KV / R2
Cloudflare API OAuth MCP -------/          |
                                            +--> PC Bridge service
                                                     |
                                                Windows PC Basterix
                                                  (local agent)
```

Cloudflare API MCP `https://mcp.cloudflare.com/mcp` spravuje samotný Cloudflare
účet cez **samostatný OAuth súhlas** a môže byť pripojený priamo k
Antigravity/Codex/VS Code. Nezamieňať s Trinity MCP `https://auru.space/mcp`.

## Nové end-pointy a MCP nástroje

- `GET /api/assistant/master/connections`: administrátorské prihlásenie.
  Výsledok je metadátový inventár ôsmich klientov bez čítania kľúčov,
  bez tvrdení o OAuth a bez vymyslených dokončených akcií.
- `agent_connections`: rovnaký read-only inventár ako MCP nástroj, dostupný
  cez **autentifikovaný MCP** klient s `mcp:read`.
- `pc_status`: čítanie stavu heartbeat bez vytvorenia projektovej akcie.
- `GET /api/assistant/master/status`: historický admin-inventár
  Clouds a poskytovateľov.
- `/api/assistant-bridge/status`, `/api/assistant-bridge/notes`:
  oddelené poznámky ChatGPT/Copilot Studio s `assistant:read/write`.
  Sú momentálne **vypnuté**, kým je `TRINITY_ASSISTANT_BRIDGE_ENABLED=false`
  a nie je potvrdená D1 migrácia `0054_assistant_bridge.sql`.

Rozsah `mcp:read` nesmie udeľovať `projectControl`. Aj globálne zapnutie
Gemini project_control je iba nastavenie Gemini, **nie dôkaz oprávnenia
iného MCP klienta**. Operácie so zmenami vyžadujú `mcp:write`
a vlastný audit/approval, nie samotnú odpoveď modelu.

## Konfigurácia klientov v Git (bez hodnoty tokenov)

| Klient | Konfiguračný súbor / postup | Overenie |
| --- | --- | --- |
| Antigravity IDE/CLI | `.agents/mcp_config.json` | samostatná lokálna `antigravity-mcp` DPAPI; MCP initialize / tools/list |
| Codex CLI / IDE | `.codex/config.toml` | samostatná `codex-mcp` DPAPI; `/mcp` tools |
| Gemini | `Trinity/.mcp.json`, credential `gemini-mcp` | vlastnícky prístup klienta a MCP handshake |
| VS Code / GitHub Copilot | `.vscode/mcp.json` | samostatné vstupné polia pre prod/staging MCP |
| Cloudflare account | `cloudflare-api` v Antigravity/Codex/VS Code | Cloudflare OAuth; oprávnenia len podľa role |
| Microsoft Copilot Studio | oficiálny `@microsoft/copilot-studio-mcp` vo VS Code; REST bridge alternatíva | Microsoft prihlasovanie a výber prostredia |
| ChatGPT | Plugins → Add custom MCP server → `https://auru.space/mcp` **ak dostupné v účte** | samostatné prihlásenie a `agent_connections` |
| Windows PC | `Trinity/trinity-pc-bridge` + Local Gateway | heartbeat a potom konkrétne dokončený receipt |

Názov konfiguračného súboru pre Antigravity je podľa oficiálnej dokumentácie
`.agents/mcp_config.json`; vzdialený MCP používa pole `serverUrl`.
Codex projektový klient používa `.codex/config.toml`. Stará Gemini CLI
konfigurácia sa môže líšiť podľa verzie aplikácie; nemodifikovať globálne
konfigurácie bez reálneho PC.

## Aktivácia na autorizovanom PC (keď bude online)

```powershell
Set-Location C:\Users\saboi\Trinity-antigravity\Trinity

# Voliteľné, samostatné, predvolene iba read-only MCP kľúče:
.\scripts\provision-mcp-client.ps1 -Client codex -Access read
.\scripts\provision-mcp-client.ps1 -Client antigravity -Access read

# Gemini má samostatný skript a vlastný credential:
# .\scripts\provision-gemini-mcp.ps1
# Pre každého klienta over initialize / tools/list / agent_connections.
```

Skripty **nevykonávaj pred overením** aktuálneho Git worktree, cloudového
prihlásenia a oprávnení k cieľovej D1. Vytvorenie kľúča je zápis do
databázy a musí sa zvlášť overiť. Existujúci credential neprepisovať bez
zrušenia starého tokenu.

Staging a produkcia majú rozdielne D1, preto sa ich MCP kľúče vydávajú
nezávisle. Aktuálna skriptová inštalácia vytvára kľúče pre produkčnú
D1, **nie automaticky pre staging**. Pri prístupe z ChatGPT alebo Copilot
Studio nepredpokladaj, že existuje možnosť vložiť manuálny API key;
použi príslušný OAuth/configuračný mechanizmus povolený účtom.

## Cloudflare Secrets Store

Trinity serverový kód číta len allowlist `TRINITY_MASTER_GOOGLE`
a `TRINITY_MASTER_COPILOT` cez `await env.BINDING.get()` pri reálnom
provider volaní. GitHub, PC a Cloudflare administrátorský token nemajú byť
pridané do verejného Worker chat bindingu. Na prácu s Cloudflare účtom
je odporúčaný oficiálny Cloudflare API MCP s nezávislým OAuth.
Pozri `.agents/skills/cloudflare-secrets-store/SKILL.md`.

## Kritické závislosti a reálne overenie

1. PC Basterix naposledy hlásil **offline**. Kým agent nie je online,
   neexistuje dôkaz lokálneho vykonania ani nainštalovanej konfigurácie.
2. GitHub Actions predtým nepridelil runner (`runner_id=0`,
   `steps=[]`). Zdroj v Gite nie je úspešný CI ani Cloudflare deploy.
3. Staging a produkcia zdieľajú D1 `rea`, D1 `trinity_basterix`,
   KV `Mastermind` a R2 `ARTIFACTS`. Staging mutačné testy
   nesmú meniť zdieľané dáta pred izoláciou.
4. Vlastník musí zvlášť schváliť prístup v ChatGPT, Codex,
   Google Antigravity a Microsoft Copilot Studio a potvrdiť OAuth
   alebo per-client API key.
5. Spusti `npm test`, `npm run secrets:doctor`,
   `npx wrangler deploy --env staging --dry-run`,
   over `/ready` a `agent_connections` na skutočnom staging nasadení.
   Až následne produkčný rollout s dôkazom verzia/commit.

**Nepoužívaj API token zverejnený v chate.** Musí zostať zrušený.
Cloudflare, Gemini, Microsoft a GitHub majú mať samostatné krátkodobé,
minimálne potrebné oprávnenia.

## Oficiálne zdroje

- https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/
- https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/
- https://antigravity.google/docs/mcp
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/copilot-studio-mcp
- https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
