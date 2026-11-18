# Trinity PC Agent — local approval-gated installer

Source: `Local-Desktop/trinity_pc_agent.py` (Python 3 standard library).
It is a **local-only prototype**, not a deployed remote Windows control
service. All repository changes were made directly on `main`, without clone.

## Start

Run from the existing project directory on the Windows computer:

```powershell
python .\Local-Desktop\trinity_pc_agent.py serve
```

The agent binds only to `127.0.0.1:8788`. Its first run creates a local
random bearer token in the current user's home directory under
`.trinity-pc-agent/local-token` and a SQLite task queue.

Do **not** share the token or expose the port through a Cloudflare Tunnel.
Windows file permissions are inherited from the user profile; check ACLs
before use, especially on shared machines. Do not run as Administrator.

## Operations

- `GET /v1/status`: truthful local status; explicitly reports no cloud link.
- `POST /v1/proposals`: queue `{"tool":"Git"}` (or `NodeJS`,
  `Python`, `Ollama`); returns HTTP 202 and `executed:false`.
- `GET /v1/tasks/<task-id>`: read task state.
- All endpoints require `Authorization: Bearer <local-token>`, a loopback
  Host header and a non-browser request.
- There is **no** HTTP approve or arbitrary-command endpoint.

Inspect pending proposals and approve from a local, interactive terminal:

```powershell
python .\Local-Desktop\trinity_pc_agent.py list
python .\Local-Desktop\trinity_pc_agent.py approve YOUR_TASK_ID
python .\Local-Desktop\trinity_pc_agent.py deny YOUR_TASK_ID
```

Approval asks the human to type `APPROVE` and runs only the separate,
allowlisted `Trinity-Tool-Installer.ps1` script. Proposals expire after ten
minutes. Task states are stored in SQLite. Even when Winget returns zero, the
agent reports `installer_returned_zero_unverified` rather than falsely
claiming the program was installed. Run the installer `Inspect` action
locally to verify the executable after PATH refresh.

## Tests

```powershell
python -m unittest discover -s .\Local-Desktop -p test_trinity_pc_agent.py -v
```

These tests are source files; successful execution has **not** been verified
in CI or on the owner's PC.

## Security/release gaps

1. Local agent must be installed, tested and started on the Windows PC.
2. Token ACLs, process identity and local firewall behavior require review.
3. A secure cloud bridge requires device enrollment, mutually authenticated
   transport, scoped approval, replay protection and independent receipts.
4. Add executable version/publisher and post-install integrity verification
   before marking installs as fully verified.
5. Do not connect this HTTP service to the internet or to an LLM without
   a separate reviewed and authorized gateway.
6. No GUI, arbitrary filesystem writes, background remote installation,
   elevated privilege or unrestricted PowerShell is implemented.

**Truth policy:** A queued task is not an executed task. An installer exit
code is not proof that a tool works. A Worker heartbeat is not proof that a
local PC is online.

## No-clone Windows startup and real local connectivity check

The existing project directory must already contain the three files under
`Local-Desktop`. No `git clone` is needed.

From the existing Trinity project directory, first run the local test gate:

```powershell
powershell -NoProfile -File .\Local-Desktop\Start-TrinityPCAgent.ps1 -CheckOnly
```

Start the agent in a terminal that remains open:

```powershell
powershell -NoProfile -File .\Local-Desktop\Start-TrinityPCAgent.ps1
```

In a second local PowerShell terminal, verify the authenticated health endpoint:

```powershell
powershell -NoProfile -File .\Local-Desktop\Check-TrinityPCAgent.ps1
```

The check reads the local token file without printing it. It succeeds only
when the local HTTP service responds with its expected identity and explicit
`connectedToCloudflare:false` and `remoteExecutionEnabled:false` values.
This is a **local** check, not a Cloudflare tunnel or production check.

Do not run an unauthenticated `cloudflared tunnel --url` exposing port 8788.
Do not add public DNS to the loopback service. Production cloud connectivity
requires a separately designed and tested device identity, queue, approval
protocol and mutual authentication.

The local Windows commands have not been executed by ChatGPT; a successful
GitHub commit proves only that the source files were stored.
