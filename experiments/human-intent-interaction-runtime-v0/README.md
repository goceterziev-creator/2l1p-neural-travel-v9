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
  keyword matching are implemented.
- The Presentation layer is an injected port only. No human-facing copy or UI
  rendering is implemented.
- Continuation authority is bound to one interaction, gate revision, scope and
  target, and is single-consumption.

## Non-claims

This is not a chat system, conversation-history system, agent framework,
workflow engine, scheduler, authentication system, persistence product, HII
version, or production runtime integration. It does not implement Approval
Resolution or Gate Presentation capabilities.

## Validation

No dependencies or provider calls are required:

```bash
node experiments/human-intent-interaction-runtime-v0/interaction-runtime.test.js
node experiments/human-intent-layer-v0/intent-layer.test.js
```

The runtime suite executes itself twice and requires byte-equivalent canonical
results. External two-run output comparison may additionally be performed with
`cmp`.
