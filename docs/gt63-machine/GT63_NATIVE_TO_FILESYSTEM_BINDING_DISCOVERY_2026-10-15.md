# GT63 Native-to-Filesystem Binding Discovery — 2026-10-15

## Scope
READ-ONLY source inspection of repository tree at candidate commit 59071affcff86746bd974705fe747009d043eab7 and selected modules. No live runtime, no file effect, no authorization.

## Finding
Existing `scripts/gt63-machine/repeatable-filesystem-execution-preparation-machine-start-binding-v0.js` already provides a strict binding between `GT63_REPEATABLE_FILESYSTEM_EFFECT_EXECUTION_PREPARATION` and `GT63_BOUNDED_CONTINUATION_EXECUTION_START`, requiring `executionTargetRef === executionPreparationId`. Its binding ledger exposes `findByExecutionPreparationId` and `commit`.

However this is **not** the same start model as `experiments/human-intent-interaction-runtime-v0/execution-attempt-start.js`, whose `EXECUTION_ATTEMPT_START` references `preparationEvidenceRef` and `attemptClaimId`, and sets `executionActivityStarted: true`. The filesystem binding model instead requires `executionStarted: false` on the bounded-continuation start.

A repository tree name search found no dedicated native-to-filesystem cross-domain binding implementation. This does **not** prove none exists under another name or in external runtime storage.

The Run #2 preparation wrapper `repeatable-filesystem-run2-real-execution-preparation-v0.js` uses a local in-memory ledger; it does not establish durable atomic cross-domain binding.

## Decision
- Existing bounded-continuation binding: FOUND — reuse within its own domain.
- Native execution-attempt claim/start to filesystem preparation mapping: NOT VERIFIED.
- Physical writer connection: NOT AUTHORIZED.
- Next step: derive an explicit identity contract and test it against native snapshots and filesystem preparation, with no authority escalation.
- Existing compatibility regression: authored, NOT EXECUTED in this checkpoint.

Classification: PARTIAL / CROSS_DOMAIN_BINDING_UNKNOWN.
MACHINE AUTHORITY: NONE.
