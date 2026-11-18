# Trinity — Local Tool Installer (Windows)

Source: `Local-Desktop/Trinity-Tool-Installer.ps1`. The file is committed to
the canonical repository's `main` branch. It is **not** automatically installed,
executed on any PC, or connected to the production Cloudflare Worker.

## Run locally in PowerShell

Inspect available tools (read-only):

```powershell
powershell -NoProfile -File .\Local-Desktop\Trinity-Tool-Installer.ps1 -Action List
powershell -NoProfile -File .\Local-Desktop\Trinity-Tool-Installer.ps1 -Action Inspect -Tool Git
```

Request installation of an allowlisted package (requires explicit `-Approve`):

```powershell
powershell -NoProfile -File .\Local-Desktop\Trinity-Tool-Installer.ps1 -Action Install -Tool Git -Approve
```

Allowlisted Winget IDs: `Git.Git`, `OpenJS.NodeJS.LTS`,
`Python.Python.3.13`, `Ollama.Ollama`. These are intended identifiers;
verify actual Winget availability and publisher on the target machine before
approval. No arbitrary user-supplied package ID, shell script, download URL,
PowerShell expression or install flag is accepted.

The installer checks the actual executable and version response before reporting
`verified_local` or `installed_and_verified`. It returns
`installer_returned_success_but_unverified` if Winget reports success but the
program cannot be independently probed in the current session. Open a new
terminal and inspect again after PATH changes.

**Trust boundaries:** This is a manually launched, local script; not a remotely
accessible HTTP service. An LLM response is not an operator approval. The
Cloudflare Worker must never run it automatically, especially with elevated
permissions. Real remote installations require a separate authenticated,
paired local executor with per-action consent, audit trail, scoped permissions,
package publisher verification and independent post-install verification.

**Not yet done:** Running this script on a Windows machine, verifying real
installation, signing installer artifacts, connecting it to PC Bridge, and
deploying a production tool installer. Do not claim those capabilities are live.
