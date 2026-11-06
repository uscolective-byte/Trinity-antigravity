# Trinity coordination

Read ../TEAM-HANDOFF.md (repository-root TEAM-HANDOFF.md) before every task.
Check for updated claims before each command. Before modifying a file, record
a CLAIM with exact paths and base commit; do not overwrite another owner's work.
Record UPDATE after changes and HANDOFF with actual validation results at the end.
Only the recipient can record ACK. Stop affected changes on conflicting ownership.
Follow root AGENTS.md. Communicate with the owner in Slovak. Never expose secrets.
If the client cannot read the shared document, provide a proposal only until a
coordinator supplies current instructions and an agreed scope.

## Canonical repository and access

Use only `uscolective-byte/Trinity-antigravity@main` as the canonical source.
Review `Trinity/docs/AGENT_ACCESS_AND_AUTONOMY.md` for authenticated
GitHub Copilot, Copilot Studio, ChatGPT, Codex, Gemini, Antigravity and Ollama access.
Develop automatically on isolated branches, run tests and create PRs;
do not bypass checks or claim that model provider credentials confer GitHub
permissions. Staging is `trinity-staging` (`--aging`), production
is `trinity` (`--`).

## GitHub Copilot participant and handoff

GitHub Copilot is a separate participant from Microsoft Copilot Studio and the
internal TrinityCopilotAgent. Read root GITHUB-COPILOT-HANDOFF.md after the
current TEAM-HANDOFF.md. Use actor `github-copilot` and identify the actual host
(VS Code, CLI or GitHub cloud agent); the model name is not an identity.

The handoff record identifies task_id, a fresh run_id per attempt, base SHA,
owned paths, status, evidence and next owner. A document is coordination metadata,
not a TAP execution receipt or permission grant. Only Copilot may author its ACK
for GITHUB-COPILOT-HANDOFF-20261102-01 after inspecting the exact review target.
Do not translate another client's ACK or successful probe into a Copilot ACK.

Existing `.vscode/mcp.json` is host-specific configuration, not proof of a live
Copilot connection. Verify initialize, tools/list and a read-only status tool in
the actual Copilot host before claiming connected. Do not reuse the Codex/Gemini
DPAPI launcher identity, copy keys between clients, auto-enable all tools, or
change Cloudflare Access to make a probe succeed. Keep failure and pending
states explicit. The alias `trinity-development` points to auru.dev, which is a
production route in the current Wrangler configuration; it is not isolated staging.
