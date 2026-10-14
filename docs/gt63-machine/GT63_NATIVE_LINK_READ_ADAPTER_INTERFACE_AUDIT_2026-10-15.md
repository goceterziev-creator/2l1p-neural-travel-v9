# GT63 Native Link Read Adapter — Interface Audit (2026-10-15)

## Source inspection
- `experiments/human-intent-interaction-runtime-v0/execution-attempt-claim.js` requires a claimLedger with `findAttemptSnapshot`, `findClaimsByAttempt`, `findClaimById`, `commitClaim`. It does **not** require `findClaimEvidenceRef`.
- `scripts/gt63-machine/repeatable-filesystem-effect-preparation-v0.js` requires an executionLedger with `findByAuthorizationId` and `commit`. It does **not** expose `findByExecutionPreparationId`.
- `scripts/gt63-machine/repeatable-filesystem-native-link-read-adapter-v0.js` additionally requires `findClaimEvidenceRef`, `findByExecutionPreparationId`, and a `linkEvidenceStore.findByRef`. These are not established as deployed interfaces.
- The existing Run #2 preparation wrapper creates an in-memory ledger scoped to a single call; it does not expose a durable cross-domain link store.

## Verdict
**INTEGRATION NOT PROVEN / INTERFACE GAP FOUND.** A new adapter file alone does not connect to the existing ledgers. The current adapter fails closed if the optional claim evidence-ref read is absent, but its declared constructor interface does not require that read, so this mismatch should be corrected before integration tests.

## Minimal safe correction
Require `claimLedger.findClaimEvidenceRef` explicitly at construction; do not fabricate evidence references. Add regression cases covering missing interface and unavailable link store. A genuine integration still requires identifying or implementing an authoritative, durable link evidence producer and reader. Do not promote simulated fixture records to real evidence.

## Safety
READ-ONLY source review. No runtime execution, no filesystem effect, no authority. MACHINE AUTHORITY: NONE.
