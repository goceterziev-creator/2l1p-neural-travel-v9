# GT63 MACHINE — GitHub Git Evidence Transport V0 Checkpoint

**Date:** 2026-09-28  
**Status:** INTEGRATED + LOCALLY VALIDATED  
**MACHINE AUTHORITY:** NONE  
**authorityEffect:** NONE

## Authoritative repository state

Repository: `goceterziev-creator/2l1p-neural-travel-v9`

Promoted authoritative `main`:

`a21dde4e1bdcf40cf00ec6ddae29e09264046ea9`

Promotion was fast-forward only (`force:false`).

Pre-promotion comparison:

- base main: `01976758740a6798c36b9095225352cea748a2b1`
- candidate: `a21dde4e1bdcf40cf00ec6ddae29e09264046ea9`
- ahead: 3
- behind: 0

Post-promotion comparison:

- main vs exact promoted SHA: IDENTICAL
- ahead: 0
- behind: 0

## Integrated chain

```text
GitHub REST GET-only
→ GitHub REST Git Object Transport V0
→ GitHub Git Object Evidence Adapter V0
→ Repository Frozen Governance Trust Root Verifier
→ Registered Governance Source Verifier
```

This chain provides read-only Git evidence observations to existing verification semantics.

## Git Object Evidence Adapter V0

Promoted earlier at:

`01976758740a6798c36b9095225352cea748a2b1`

Files:

- `scripts/gt63-machine/github-git-object-evidence-adapter-v0.js`
- `scripts/gt63-machine/github-git-object-evidence-adapter-v0-regression.js`

Observed local regression:

`14/14 PASS`

Preserved boundaries:

- exact repository binding
- exact `refs/heads/main` binding
- observation only
- adapter does not emit VERIFIED/TRUSTED
- adapter does not create issuer authority or policy acceptance
- authority = NONE

## GitHub REST Git Object Transport V0

Files:

- `scripts/gt63-machine/github-rest-git-object-transport-v0.js`
- `scripts/gt63-machine/github-rest-git-object-transport-v0-regression.js`

Candidate commits:

- `99371bb562c2a3051221035ccc18dd2640d6766b` — bounded transport implementation
- `e9dc702540b82594c39c61112d949e04ac716f90` — regression
- `a21dde4e1bdcf40cf00ec6ddae29e09264046ea9` — regression-fixture correction

The fixture correction did not change the production transport implementation.

Observed local regression at exact promoted HEAD:

`12/12 PASS`

Regression invariants:

- `PASS: NONE`
- `PASS: GET ONLY`
- `PASS: TRANSPORT -> ADAPTER -> VERIFIER`

Observed coverage includes:

- exact repository + main-ref binding
- cross-repository rejection
- non-main rejection
- exact commit → tree mapping
- exact tree → blob mapping
- truncated recursive tree fails closed
- exact blob bytes mapping
- optional token used only as HTTP authentication material
- history bounded to exact current commit and path
- full-chain verifier compatibility
- ref movement resolves to STALE through the full chain

## Regression correction record

The first transport regression run reached 11 passing tests and failed the ref-movement expectation because the synthetic fixture returned a moved ref SHA while its fake commit response still returned the old commit SHA.

That inconsistency was correctly rejected upstream and surfaced as UNCERTAIN.

The fixture alone was corrected so that fake `readCommit()` returns the SHA actually requested. The rerun produced `12/12 PASS`.

No production transport code was changed by that correction.

## What this checkpoint proves

The current authoritative main contains a bounded read-only GitHub REST transport and observation adapter compatible with the existing repository-frozen root and registered-source verification contracts.

## What this checkpoint does NOT prove

It does not prove:

- production/runtime wiring of this transport;
- a real GitHub network execution through the new transport;
- credential/token topology for production;
- human lifecycle-issuer policy acceptance;
- role assignment;
- principal eligibility;
- gate authorization;
- execution/effect authority;
- production deployment.

## Preserved boundary

> GITHUB REST OBSERVATION ≠ GOVERNANCE VERIFICATION ≠ GOVERNANCE AUTHORITY.

The transport observes.  
The adapter binds observation evidence.  
Existing verifiers determine verification outcomes under their frozen contracts.  
No component in this checkpoint widens MACHINE authority.

**MACHINE AUTHORITY: NONE**
