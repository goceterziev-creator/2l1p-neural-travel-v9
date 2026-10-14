# GT63 Repeatable Filesystem Operator — Real Lifecycle Compatibility Checkpoint V0
Date: 2026-10-15
Scope: READ-ONLY source comparison; NO execution authority; NO physical effect.

## Verified source shapes
- `experiments/human-intent-interaction-runtime-v0/execution-attempt-claim.js` exports `createGovernedExecutionAttemptClaim`; its `claim()` creates `EXECUTION_ATTEMPT_CLAIM` records with `attemptClaimId`, `executionAttemptId`, `ownershipState`, `exclusiveOwnership`, `claimRevision`, `preparationEvidenceRef`, `authorityEvidenceRef`, `effectContractRef`, `adapterIdentity` and other governance bindings. Claim persistence uses `claimLedger.commitClaim(record, guards)` and can return uncertain/conflict outcomes.
- `experiments/human-intent-interaction-runtime-v0/execution-attempt-start.js` exports `createGovernedExecutionAttemptStart`; its `start()` creates `EXECUTION_ATTEMPT_START` records with `status: EXECUTION_ATTEMPT_STARTED`, `executionStartId`, `attemptClaimId`, `executionAttemptId`, `claimEvidenceRef`, `claimRevision`, `preparationEvidenceRef`, `effectContractRef`, `singleAuthoritativeStart: true`, `executionActivityStarted: true`.
- `scripts/gt63-machine/repeatable-filesystem-execution-preparation-machine-start-binding-v0.js` binds a *different* MACHINE start contract: `executionTargetRef === executionPreparationId` and `executionStarted:false`.

## Critical incompatibilities — do not paper over
1. The provider-free ZIP integration `repeatable-filesystem-operator-integration-v0.js` assumes a flattened claim object with `authorizationId`, `executionPreparationId`, `executionStartId`. These are **not** the native claim record's identity fields. It must not be connected directly.
2. Native `EXECUTION_ATTEMPT_START` reports `executionActivityStarted:true`; the candidate writer's current `currentMachineStartPort` requires `executionStarted:false`. These are distinct lifecycle contracts; no equivalence has been demonstrated.
3. `claimLedger.commitClaim` is a port contract; no evidence from these source files proves a durable atomic provider wired to the filesystem Run #2.
4. The Run #2 human decision is materialized from a fixed `APPROVE` fixture, not a fresh authenticated human approval for a new physical write.
5. The writer currently returns `NOT_CONNECTED` without invoking `fs`; the name is aspirational, not evidence of a working writer.

## Decision
Classification: PARTIAL — REAL-LIFECYCLE SHAPE CHECKED; INTEGRATION NOT PROVEN.
No implicit mapping from claim/start to Run #2 authorization. No claim of atomicity, runtime currentness, durable evidence, real execution, or regression PASS for the GitHub candidate.

## Next bounded implementation
Build an explicit, read-only `native lifecycle -> filesystem operator` compatibility assessment with separate evidence ports. Reject missing or conflicting cross-system identity bindings. Only then exercise provider-free tests. A physical writer remains out of scope without a separately authorized, exact one-shot effect and durable claim provider.

MACHINE AUTHORITY: NONE.
