# Pentad circuit breaker

`src/pentad-circuit-breaker.js` is now connected to the **Workers AI primary and fallback models inside `src/chat-agent.js`**. This does not prove that other chat routers (`engine.js`, `services.js`, external provider adapters) are integrated or that production was deployed.

## Routing contract

- Trinity chooses an ordered list of allowed providers.
- Each provider call has a bounded timeout and receives an `AbortSignal`.
- Three consecutive failures open the circuit for 60 seconds by default; ChatAgent overrides cooldown to **10 minutes**.
- During cooldown the provider is skipped without spending provider tokens.
- The first call after cooldown is a half-open probe. Success closes the circuit; failure reopens it.
- State keys are versioned as `circuit:v1:<provider>`. ChatAgent uses the dedicated `TRINITY_CIRCUIT_KV` when provided; otherwise Durable Object storage supplies **per-session**, not global, persistence.
- Returned failures contain only normalized reasons (`timeout`, `provider-error`, `circuit-open`); provider bodies, credentials and URLs are never persisted.

## Integration requirements

Before expanding this module into `engine.js` or `services.js`, choose the exact dedicated KV binding, document ownership and TTL, and add provider-specific regression tests. Do not use the content cache as the circuit state store. Do not treat a closed circuit as proof that a provider account or personal chat is connected.

Recommended automatic order is `edge -> configured owner provider`; an explicit owner selection may put Gemini or Copilot first, but Workers AI remains the truthful fallback. Copilot must call the existing `copilotStudioAsk` adapter and return its real response or error, not a synthetic “accepted” sentence.

## Actual timeout behavior

The circuit wrapper bounds how long it waits for a model response. When a deadline
is reached it requests abort and returns a timeout failure. An underlying model
operation may continue and may still be billed if the adapter does not honor
`AbortSignal`. A timeout is **not** evidence of provider cancellation.

No CI or production deployment confirmation is implied by this source change.
