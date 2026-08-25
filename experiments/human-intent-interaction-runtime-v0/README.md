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

Governed Execution Preparation V0 is a separate downstream provider-neutral
boundary. It consumes only authoritative persisted `EXECUTION_ACCEPTED`
evidence, resolves the frozen `actionInputBinding` through an injected
read-only canonicalization/digest contract, freezes the exact accepted action,
effect and result-grammar revisions, and atomically records at most one
distinct logical `executionId` for an acceptance. `EXECUTION_PREPARED` means
only that the verified immutable execution is eligible for future governed
attempt creation.

Preparation creates no schedule, attempt identity, worker claim, executor
call, product mutation, external effect, or result evidence. Scheduling remains
optional infrastructure: synchronous and asynchronous adapters must both cross
a later governed attempt boundary. Input resolution, action/effect/result
registries and the execution ledger are injected ports; no database, queue,
executor, product action, or effect mechanism is selected here.

Governed Execution Attempt Creation V0 is the next separate provider-neutral,
effect-free boundary. It consumes only authoritative persisted
`EXECUTION_PREPARED` evidence and atomically binds one distinct immutable
`executionAttemptId` to that logical execution. `ATTEMPT_CREATED` means only
that an unclaimed physical-attempt identity exists with exact frozen lineage,
verified input, action, effect, and result contracts.

At most one unresolved attempt may exist for an execution. A later physical
attempt requires exact authoritative `PROVEN_NO_EFFECT` or
`IDEMPOTENT_REPLAY_SAFE` evidence for the prior attempt; missing completion,
claim expiry, worker loss, possible effect, or unknown outcome grants no retry.
A pure versioned identity port freezes one logical effect identity across safe
retry attempts, but creates no effect and provides no exactly-once claim.

Attempt creation performs no adapter binding, scheduling, claim, worker
assignment, execution start, executor call, product mutation, external effect,
result validation, or completion recording. Claim and pre-effect lifecycle
evidence remain separate downstream capabilities. Preparation snapshots, retry
eligibility, effect identity, and the atomic attempt ledger are injected ports;
no database, queue, scheduler, worker, executor, or product action is selected.

Governed Execution Attempt Claim / Ownership V0 is the next separate,
provider-neutral boundary. It consumes only authoritative persisted
`ATTEMPT_CREATED` evidence, requires one exact enabled adapter registration and
a trusted owner identity, verifies exact action, target, scope, immutable input,
effect and result-contract compatibility, and atomically records at most one
active exclusive claim for an attempt.

`ATTEMPT_CLAIMED` means only that one exact compatible owner accepted exclusive
handling responsibility for the exact immutable attempt. A claim creates no
schedule, worker delivery, execution-start evidence, executor call, product
mutation, external effect, result, completion, or success. Reassignment keeps
the same physical attempt, creates a new claim identity, and requires exact
authoritative release/staleness plus proven no-start/no-effect evidence. Claim
expiry, worker loss, missing completion, possible effect, and uncertain
ownership do not authorize reassignment or another attempt. Registries, trusted
owner identity, compatibility verification, reassignment evidence, and the
atomic claim ledger are injected ports; no lease technology, queue, worker,
executor, provider, or product action is selected.

Governed Execution Attempt Start V0 is the next isolated provider-neutral
lifecycle boundary. It consumes only an authoritative current `ACTIVE`
`ATTEMPT_CLAIMED` snapshot and atomically binds one immutable
`executionStartId` to the exact physical attempt, Claim, adapter, trusted owner,
verified input, action, effect, logical-effect and result contracts.

`EXECUTION_ATTEMPT_STARTED` means only that the exact current claimant crossed
from exclusive ownership into governed execution activity for the immutable
attempt. It creates no scheduler or worker-delivery evidence, invokes no
executor, creates no `EFFECT_INVOCATION_INTENT`, performs no product/external
effect, and records no result, completion, or success. After Start, only pure
effect-free preparation is permissible until a separate persisted effect intent
exists. For `NO_EXTERNAL_EFFECT`, pure computation may proceed without effect
intent, but result/completion evidence remains downstream. A committed Start
also ends ordinary pre-Start Claim reassignment eligibility; owner loss cannot
create another Claim or attempt. Claim snapshots and the atomic Start ledger are
injected ports; no queue, worker, executor, provider, or product action is
selected.

Governed Effect Invocation Intent V0 is the effect-capable post-Start branch.
It consumes only an authoritative current `EXECUTION_ATTEMPT_STARTED` snapshot
whose frozen effect class is `IDEMPOTENT_WITH_STABLE_KEY` or
`NON_IDEMPOTENT`. It revalidates the exact Claim, adapter registration, trusted
owner, immutable input, logical effect and result contracts, then atomically
binds at most one immutable `effectInvocationIntentId` to the Start.

`EFFECT_INVOCATION_INTENT` means only that the exact governed Start declared
one persisted intent to approach an effect-capable boundary for the frozen
logical effect. It does not invoke an adapter, executor, provider, route or
product action; it does not prove delivery, invocation, effect, result,
completion or success; and it never permits effect crossing by itself.
`NO_EXTERNAL_EFFECT` fails closed as a branch mismatch. Idempotent effects keep
the exact stable `logicalEffectId`, while non-idempotent effects retain it only
for correlation; neither class gains generic replay or exactly-once semantics.
The Start snapshot and atomic intent ledger are injected provider-neutral ports.

Governed Effect Invocation Gateway V0 is the next bounded effect-capable
boundary. It consumes only authoritative `EFFECT_INVOCATION_INTENT`,
revalidates the exact current Claim, adapter, trusted owner and frozen
contracts, derives one canonical immutable invocation envelope, and persists
`EFFECT_INVOCATION_STARTED` before crossing one injected adapter-port call.

The distinct `effectInvocationId` identifies that physical invocation while
`logicalEffectId` remains the stable logical-effect identity. The gateway
performs no hidden retry. A bounded adapter return means only that control
returned; timeout, disconnect, uncertain persistence or possible effect stays
`INVOCATION_UNCERTAIN` and blocks automatic replay. Neither state acknowledges
an effect, accepts a result, completes execution, or claims exactly-once
behavior. V0 is validated only with a deterministic provider-free fake adapter;
no concrete provider, executor, route, product action or external effect is
selected.

Governed Effect Outcome Evidence / Resolution V0 is the provider-neutral
post-Gateway evidence boundary. It accepts only authenticated observations
bound to one authoritative physical invocation through exact injected source,
grammar, verification and outcome-policy contracts. Every observation is an
immutable `EFFECT_OUTCOME_EVIDENCE_ACCEPTED` record and remains distinct from
the append-only `EFFECT_OUTCOME_RESOLVED` conclusion over an exact canonical
evidence-set revision and digest.

Acknowledgement, transport return and generic provider success are not effect
truth. Confirmed non-effect and rejection-before-effect require complete causal
proof that every effect-capable operation was excluded. Possible, unknown or
conflicting effects create no retry authority. Later evidence creates a new
evidence-set revision and superseding resolution without rewriting history.
The component emits only immutable outcome handoff evidence for a separate
retry evaluator; it performs no provider reconciliation query, product effect,
result validation or completion. `NO_EXTERNAL_EFFECT` remains on its separate
effect-free result/evidence branch.

Governed Attempt Retry Eligibility V0 is the separate provider-neutral decision
boundary after authoritative effect-outcome resolution. It binds one immutable
`attemptRetryEligibilityId` to the exact prior physical attempt, invocation,
latest outcome-resolution revision, canonical evidence-set digest, frozen
effect contract, stable logical effect and exact versioned retry policy.

Only complete causal `NO_EFFECT_CONFIRMED` or
`EFFECT_REJECTED_BEFORE_EFFECT` evidence can produce `PROVEN_NO_EFFECT`.
`IDEMPOTENT_REPLAY_SAFE` additionally requires an exact registered replay
policy and verified stable-key, duplicate-semantics and constraint evidence;
the idempotent label alone grants nothing. Confirmed effect, non-idempotent
possible effect, unknown outcome and evidence conflict remain ineligible.
Eligibility is immutable evidence for one guarded Attempt Creation handoff: it
does not create an attempt, perform a retry, restore Human authority, invoke an
effect, accept a result or complete execution. The atomic Attempt Creation
history guard prevents one eligibility decision from creating multiple
successor attempts. `NO_EXTERNAL_EFFECT` remains downstream of its separate
effect-free result/evidence lifecycle.

Governed Effect-Free Result / Evidence Acceptance V0 is the isolated
`NO_EXTERNAL_EFFECT` post-Start branch. It consumes only authoritative
`EXECUTION_ATTEMPT_STARTED`, resolves an exact trusted result-evidence source
and the frozen result grammar revision, and appends immutable
`RESULT_EVIDENCE_ACCEPTED` observations bound to the exact Start, attempt and
verified input. Evidence remains observation rather than an authoritative
result.

A separate atomic `RESULT_ACCEPTED` record binds one immutable
`resultAcceptanceId` to the exact canonical evidence-set revision and digest
that satisfies the frozen grammar. Later evidence creates a new evidence-set
revision and, where valid, a superseding acceptance without rewriting history.
Effect-capable classes fail closed and cannot enter this branch. Result
acceptance creates no Human or operational authority, does not retry or invoke
anything, and remains strictly distinct from execution completion and success.

Governed Effect-Capable Result / Evidence Acceptance V0 is the separate
post-outcome branch for `IDEMPOTENT_WITH_STABLE_KEY` and `NON_IDEMPOTENT`.
It requires an authoritative `EXECUTION_ATTEMPT_STARTED` and the exact current
`EFFECT_OUTCOME_RESOLVED(EFFECT_CONFIRMED)` record before it accepts any result
observation. Provider return, caller fields, possible/unknown effect and
confirmed non-effect cannot manufacture an accepted result.

Every immutable `RESULT_EVIDENCE_ACCEPTED` observation binds the exact Start,
physical invocation, logical effect, confirmed outcome, frozen input and result
grammar. A separate atomic `RESULT_ACCEPTED` record binds one canonical
evidence-set revision and digest evaluated by the frozen grammar. Later evidence
may create a superseding acceptance but never rewrites history. The boundary
preserves `RESULT_EVIDENCE != RESULT_ACCEPTED != EFFECT_CONFIRMED !=
EXECUTION_COMPLETED`; it creates no retry, Completion, success or Human
authority and performs no provider, executor, product or effect operation.

## Validation

No dependencies or provider calls are required:

```bash
node experiments/human-intent-interaction-runtime-v0/interaction-runtime.test.js
node experiments/human-intent-interaction-runtime-v0/approval-resolver.test.js
node experiments/human-intent-interaction-runtime-v0/gate-presenter.test.js
node experiments/human-intent-interaction-runtime-v0/continuation-dispatcher.test.js
node experiments/human-intent-interaction-runtime-v0/execution-acceptance.test.js
node experiments/human-intent-interaction-runtime-v0/execution-preparation.test.js
node experiments/human-intent-interaction-runtime-v0/execution-attempt-creation.test.js
node experiments/human-intent-interaction-runtime-v0/execution-attempt-claim.test.js
node experiments/human-intent-interaction-runtime-v0/execution-attempt-start.test.js
node experiments/human-intent-interaction-runtime-v0/effect-invocation-intent.test.js
node experiments/human-intent-interaction-runtime-v0/effect-invocation-gateway.test.js
node experiments/human-intent-interaction-runtime-v0/effect-outcome-resolution.test.js
node experiments/human-intent-interaction-runtime-v0/execution-attempt-retry-eligibility.test.js
node experiments/human-intent-interaction-runtime-v0/effect-free-result-acceptance.test.js
node experiments/human-intent-interaction-runtime-v0/effect-capable-result-acceptance.test.js
node experiments/human-intent-layer-v0/intent-layer.test.js
```

The runtime suite executes itself twice and requires byte-equivalent canonical
results. External two-run output comparison may additionally be performed with
`cmp`.
