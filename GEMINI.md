# Trinity

## Priorita: najnovší zdroj z GitHubu bez zničenia lokálnej práce

Ak pracuješ v Google Antigravity, najprv prečítaj
`ANTIGRAVITY-HANDOFF-2026-10-31.md` z vetvy
`feat/unified-agent-connection-bridge-20261031` a over najnovšie SHA cez
`git ls-remote origin main refs/heads/feat/unified-agent-connection-bridge-20261031`.
`main` je publikovaný zdroj; PR #26 je najnovšia **nezlúčená pracovná
vetva**, nie automaticky nasadená produkcia.

Pôvodný lokálny repozitár obsahuje stovky rozpracovaných a staged zmien
a `.git/index.lock` môže blokovať `git switch`. **Neprerábaj ho
nasilu.** Najnovšiu vetvu otvor v samostatnej čistej clone
(`C:\\Users\\saboi\\Trinity-bridge-test`), nikdy nepouži
`git reset --hard`, `git clean -fd` ani nepovolené mazanie locku.
Chýbajúce npm skripty v pôvodnom checkout-e nie sú dôkaz, že skripty
chýbajú na GitHube.

Before every task, read TEAM-HANDOFF.md in the repository root. Before every
command check for updated coordination state. Claim exact files before editing,
preserve other agents' changes, record UPDATE after changes and HANDOFF on
completion. Only the receiving agent may write its ACK. Stop conflicting writes.

Use Slovak when communicating with the owner. The canonical branch is `main`.
The current Worker source is `Trinity/`; historical copies and prototypes are not deployment targets.

- Production: Worker `trinity`, domain `https://auru.space`.
- Staging: Worker `trinity-staging`, domain `https://auru.dev` (`--env staging`).
- Staging resource bindings are defined in `Trinity/wrangler.jsonc`; some auxiliary bindings can be shared. Never substitute production secrets or databases to make staging pass.
- Start with the `trinity_status` MCP tool and inspect the real source and deployment version before editing.
- Prefer the connected `trinity` MCP server for remote status, tasks and bounded project actions. A queued task is not a completed action; poll `get_task` and check its receipt.
- Read existing changes before editing. Preserve dirty worktrees, local backups and stashes. Do not merge old prototypes wholesale into the product.
- Keep authentication, approvals, origin checks and secret protection enabled. Never print or commit credentials or `.credentials`, `.env`, `.dev.vars`, or local configuration containing tokens.
- Run `npm test` in `Trinity/`. Build staging with `npm run build:staging`. Deploy the staging environment first and verify the exact commit before production.
- Tag deployments with the exact Git commit using Wrangler `--tag`. `/health` reports that tag and the Cloudflare version ID.
- Browser availability, readiness, external provider inference, and PC connectivity are separate claims and need separate evidence.

For a personal Google AI Pro subscription use the official Antigravity CLI (`agy`) with Google account sign-in. Google ended personal-account access through the older Gemini CLI on 18 June 2026. This subscription is separate from the Gemini API credential used by the deployed Worker. The same scoped Trinity MCP bridge is configured in the supported client.

For model-independent credentials and execution policy see `Trinity/docs/AGENT_ACCESS_AND_AUTONOMY.md`. Gemini cannot become a GitHub or Cloudflare administrator merely from a prompt; only an authenticated client may execute permitted tools.
