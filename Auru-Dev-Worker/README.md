# Auru-Dev-Worker (`auru.dev`)

Independent Cloudflare Edge Worker serving the **Auru Dev — Obsidian & Champagne Atelier** UI exclusively on `https://auru.dev`, cleanly separated from the main **Trinity** core Worker (`Trinity/`, serving `https://auru.space`).

## Architecture

- **Own Domain & Worker:** `auru.dev` is bound exclusively to Worker `auru-dev` (`Auru-Dev-Worker/wrangler.jsonc`). Main `Trinity/wrangler.jsonc` owns `auru.space` exclusively.
- **Zero Shared Mutable Resources:** `Auru-Dev-Worker` holds no direct D1, KV, R2, or Secrets Store bindings, preventing state drift or staging collisions.
- **Private Service Binding RPC:** Allowlisted `/api/*`, `/pay/*`, `/tetrakis-logo.png`, and legal routes proxy privately over Cloudflare's zero-hop `TRINITY_CORE` service binding (`service: "trinity"`). When unbound, API calls fail closed with HTTP `503` (Truth Policy 2.1).
- **Lean Built-From-Scratch UI:** Handcrafted Obsidian (`#09090b`) & Brushed Champagne (`#d6b676`) Atelier interface with Warm Alabaster (`#faf9f6`) daylight mode, 5 focused sections (Chat, Tetrakis `$TTK` Space, `@wallet`, Encrypted Vault & Connectors, Documentation), and `⌘K` Command Palette.

## Commands

```bash
npm --prefix Auru-Dev-Worker test
npm --prefix Auru-Dev-Worker run build
```

Production deployments to `https://auru.dev` run exclusively via manual owner-approved GitHub Actions workflow dispatch (`.github/workflows/auru-dev-deploy.yml`) with an exact 40-character `main` commit SHA.
