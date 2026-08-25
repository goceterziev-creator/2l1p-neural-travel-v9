# Human Intent Interaction Runtime V0

Status: isolated Interaction Runtime Bootstrap experiment; no production integration.

## Purpose

This experiment provides the smallest provider-free runtime owner for the Human
Gate governance interaction lifecycle:

```text
interaction state
  -> current Human Gate event projection
  -> unchanged evaluateIntentRegression()
  -> terminal governance state
  -> presentation port or bounded continuation authority
```

It owns interaction and gate identity, revisioned state, immutable evidence,
evaluator invocation, presentation invocation, and single-consumption
continuation authority. The in-memory store implements a technology-neutral
persistence port for deterministic tests.

## Preserved boundaries

- `evaluateIntentRegression()` is injected and unchanged.
- Runtime integrity metadata remains outside the evaluator event projection.
- The evaluator receives exactly one current `REQUESTED` or `SATISFIED` event
  per active gate.
- Receiving approval-like language records evidence only; it grants no authority.
- The Approval Resolver is an injected port only. No approval semantics or
  keyword matching are implemented by the Bootstrap itself. Capability A adds
  a separate provider-neutral, context-bound resolver behind that port.
- The Presentation layer is an injected port only. No human-facing copy or UI
  integration is implemented by the Bootstrap. Capability B adds the isolated
  provider-neutral consumer in `gate-presenter.js`.
- Continuation authority is bound to one interaction, gate revision, scope and
  target, and is single-consumption.

## Non-claims

This is not a chat system, conversation-history system, agent framework,
workflow engine, scheduler, authentication system, persistence product, HII
version, or production runtime integration. It does not implement Approval
Resolution inside the Bootstrap or Gate Presentation capabilities. Capability
A is isolated in `approval-resolver.js`; it composes linguistic speech-act
guards with exact pending-gate context rather than treating approval vocabulary
as authority. Capability B consumes only `HUMAN_GATE_REQUIRED` plus pending-gate
context and emits `HUMAN GATE — APPROVAL REQUIRED`. It emits nothing for other
governance states, fails closed when pending-gate context is missing, and never
creates or consumes authority. No production UI/output integration is claimed.

## Validation

No dependencies or provider calls are required:

```bash
node experiments/human-intent-interaction-runtime-v0/interaction-runtime.test.js
node experiments/human-intent-interaction-runtime-v0/approval-resolver.test.js
node experiments/human-intent-interaction-runtime-v0/gate-presenter.test.js
node experiments/human-intent-layer-v0/intent-layer.test.js
```

The runtime suite executes itself twice and requires byte-equivalent canonical
results. External two-run output comparison may additionally be performed with
`cmp`.
