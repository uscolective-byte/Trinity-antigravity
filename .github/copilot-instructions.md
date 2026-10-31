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
Copilot Studio, ChatGPT, Codex, Gemini, Antigravity and Ollama access.
Develop automatically on isolated branches, run tests and create PRs;
do not bypass checks or claim that model provider credentials confer GitHub
permissions. Staging is `trinity-staging` (`--env staging`), production
is `trinity` (`--env=""`).
