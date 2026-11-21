# Trinity Omni-Bridge 🌉

Univerzálny integračný most (Cloudflare Worker) pre ekosystém **Trinity Omni-Core** (`auru.dev` / `auru.space`), ktorý prepája:
- **Trinity MCP:** Priame JSON-RPC spojenie na `https://auru.dev/mcp` s podporou SSE streamovania.
- **Telegram:** Chunkované správy (max 3900 znakov) + automatický 15-minútový Cron polling.
- **Meta AI:** Llama 3.3 70B & Graph API v26.0 konektor.
- **Google Gemini:** Priame generovanie obsahu cez `gemini-2.5-flash`.
- **Anthropic:** Claude 3.5 Sonnet / Haiku Messages API.
- **GitHub:** Repozitáre, dispatch workflowov a webhooky.
- **Cloudflare Edge:** D1 databázy, Workers a DNS zóny.
- **Antigravity & Microsoft Copilot:** Obojsmerný kontext a prepojenie.

## API Endpointy

- `GET /health` — Stav mosta, pripojené služby a zoznam aktívnych providerov.
- `GET /providers` — Zoznam všetkých adaptérov, ich akcie a konfiguračný stav.
- `GET /tools` — Skratka pre zoznam všetkých MCP nástrojov Trinity (pridaj `?notify=1` pre odoslanie do Telegramu).
- `GET /fleet` — Skratka pre profily všetkých 46 agentov Trinity.
- `GET /executions` — Skratka pre históriu posledných úloh z D1.
- `POST /invoke` — Univerzálne volanie akéhokoľvek providera:
  ```json
  {
    "provider": "trinity-mcp",
    "action": "call_tool",
    "payload": {
      "tool": "diagnostic_ping",
      "arguments": { "message": "Ahoj z Omni Bridge" }
    },
    "notifyTelegram": true
  }
  ```
- `POST /webhooks/:provider` — Prijímanie webhookov (Telegram, GitHub, Antigravity).

## Nasadenie

```bash
cd trinity-omni-bridge
npx wrangler secret put TRINITY_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put CLOUDFLARE_API_TOKEN
npx wrangler deploy
```
