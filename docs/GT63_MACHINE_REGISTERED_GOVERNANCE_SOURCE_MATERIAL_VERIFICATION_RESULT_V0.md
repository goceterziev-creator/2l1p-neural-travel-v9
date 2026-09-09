# GT63 MACHINE — Registered Governance Source Material Verification V0

Status: BOUNDED EXPERIMENT CANDIDATE / EVIDENCE CHECKPOINT
Date: 2026-09-09

## Baseline

Repository: `goceterziev-creator/2l1p-neural-travel-v9`

Authoritative base used for candidate construction:

`main@a81cec8e9c0a1a2de00cfebc5413f86e162f29b2`

tree:

`938e3965ac69d7a044d85f70103f1871b2577df7`

No mutation to `main` was performed.

## Primary contradiction that reopened this narrow boundary

The integrated root manifest registers:

`config/gt63-machine/governance-lifecycle-issuer-scope-policy-v0.json`

as the repository-owned source path for `GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY`.

The existing trust-root verifier proves the exact Git identity of the root manifest itself, but does not read or verify the registered source blob. The registered source path was absent from both current main and the historical trust-root baseline when inspected.

Therefore preserve:

`VERIFIED ROOT MANIFEST != VERIFIED REGISTERED SOURCE BLOB`

`REGISTERED SOURCE CLAIM != VERIFIED SOURCE MATERIAL`

This is direct primary evidence and is sufficient to reopen only this narrow trust-root source-material boundary. It does not reopen the already-proven existence of the trust-root capability itself.

## Candidate branch

`experiment/registered-governance-source-material-verification-v0`

The branch was created exactly from:

`a81cec8e9c0a1a2de00cfebc5413f86e162f29b2`

## Materialized registered source

Path:

`config/gt63-machine/governance-lifecycle-issuer-scope-policy-v0.json`

Git blob:

`ace31860af93f84f3e4b08f1730060c86e291424`

The V0 source is intentionally fail-closed:

- `status = UNCONFIGURED_FAIL_CLOSED`
- `issuerSetSemantics = CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY`
- `permittedIssuerRefs = []`
- `authority = NONE`

Materialization alone authorizes no lifecycle issuer and creates no lifecycle/currentness truth.

## Registered source verifier candidate

Path:

`scripts/gt63-machine/repository-frozen-governance-registered-source-verifier.js`

Git blob:

`be44cc62d2076a058f18d560a5231ad06acefe9c`

The verifier is additive. It does not weaken or replace the existing Repository-Frozen Governance Trust Root V0.

Its bounded sequence is:

1. require successful existing root verification;
2. use the verified root's exact repository / commit / tree / registered source path;
3. read the exact registered source tree entry;
4. require path/mode/object-type/blob identity binding;
5. read the exact source blob;
6. recompute Git blob SHA from exact bytes;
7. require exact canonical UTF-8 JSON and the frozen fail-closed V0 source contract;
8. emit deterministic source verification identity with `authority = NONE`.

## Regression candidate

Path:

`scripts/gt63-machine/repository-frozen-governance-registered-source-verifier-regression.js`

Git blob:

`c3099e7c5068aa638795489168bd7a46ecfffd9d`

Local bounded regression over the new source-verification contract:

`9/9 PASS`

Covered cases:

- exact registered source bytes verify;
- registered source path absent -> INVALID;
- cross-path source substitution -> INVALID;
- source-byte tampering against blob identity -> CONFLICT;
- noncanonical source bytes -> INVALID;
- caller source-path override -> INVALID;
- stale root prerequisite -> STALE;
- verification binds exact commit/tree/blob + SHA-256/sourceVerificationId;
- materialization alone creates no issuer authority.

Important validation boundary:

The 9/9 run was executed locally against a contract-compatible root-verifier stub in order to exercise the new verifier logic. No repository CI/workflow surface was found for executing the regression against the real repository module in this pass.

Therefore:

- NEW VERIFIER LOGIC LOCAL CONTRACT REGRESSION: PASS 9/9
- EXACT CANDIDATE BYTES MATERIALIZED IN GIT: YES
- STATIC BINDING TO REAL EXISTING TRUST-ROOT MODULE: PRESENT
- REPOSITORY-EXECUTED REGRESSION AGAINST REAL TRUST-ROOT MODULE: NOT YET PROVEN
- MAIN INTEGRATION: NO
- PR: NO
- MERGE: NO
- DEPLOY: NO
- AUTHORITY CREATED: NONE

## Branch diff

Compared with the authoritative base, this experiment branch contains only:

1. the fail-closed registered source JSON;
2. the additive registered-source verifier;
3. its regression;
4. this evidence checkpoint.

No existing governance primitive is modified by this candidate.

## Next bounded boundary

Do not proceed directly to lifecycle/currentness truth merely because source material is now present.

The immediate next task is independent execution/review of the registered-source verifier against the real Repository-Frozen Governance Trust Root module and exact candidate branch bytes.

Only after that passes may the architecture proceed to the separately identified capability:

`Accepted Lifecycle Issuer-Scope Policy V0`

and later:

`Accepted Immutable Lifecycle Event Evidence -> Evidence Universe/Coverage -> Current Governance Resolution -> Principal Eligibility`.

## Authority

MACHINE authority: `NONE`

No merge, deploy, lifecycle issuer, currentness, eligibility, Human Gate, continuation, or execution authority is created by this candidate or checkpoint.
