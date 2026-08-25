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
- Authorized Continuation Handoff / Dispatch V0 adds a separate provider-free
  lifecycle after authority consumption: one immutable dispatch intent, exact
  registered-target and scope matching, revisioned attempt/outcome evidence,
  and at most one logically accepted receipt. Physical retry preserves the
  dispatch envelope and idempotency identity while using a distinct attempt.

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

Dispatch receipt acceptance means only that the exact registered consumer
accepted the immutable envelope under its idempotency identity. It does not
mean execution was scheduled, started, completed, or successful. Unknown,
disabled, incompatible, stale, replayed, rejected, unavailable, and uncertain
handoffs fail closed without retargeting or recreating authority. The registry
and consumer are injected; no executor, route, queue, database, or product
semantics are implemented.

Governed Execution Acceptance V0 is a separate downstream, provider-neutral
boundary. It requires exact persisted `DISPATCH_ACCEPTED` evidence, resolves an
exact action registration through an injected read-only port, freezes a pure
immutable action-input binding, and atomically records at most one logical
execution acceptance for the dispatch. Its distinct `executionAcceptanceId`
means only that the exact registered owner accepted responsibility for that
bounded action. It does not schedule work, invoke an executor, mutate product
state, perform an external effect, or claim start, completion, or success.

The action registry and acceptance-evidence store are injected ports. Action
registration creates no authority, rejection cannot retarget authority, and
uncertain persistence must recover the same acceptance identity or fail closed.
Concrete actions, executors, schedulers, databases, queues, result lifecycles,
and product composition remain outside this experiment.

## Validation

No dependencies or provider calls are required:

```bash
node experiments/human-intent-interaction-runtime-v0/interaction-runtime.test.js
node experiments/human-intent-interaction-runtime-v0/approval-resolver.test.js
node experiments/human-intent-interaction-runtime-v0/gate-presenter.test.js
node experiments/human-intent-interaction-runtime-v0/continuation-dispatcher.test.js
node experiments/human-intent-interaction-runtime-v0/execution-acceptance.test.js
node experiments/human-intent-layer-v0/intent-layer.test.js
```

The runtime suite executes itself twice and requires byte-equivalent canonical
results. External two-run output comparison may additionally be performed with
`cmp`.
