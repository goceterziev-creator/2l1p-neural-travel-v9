# GT63 MACHINE — Accepted Lifecycle Issuer-Scope Policy V0 Result

Status: BOUNDED CANDIDATE / NON-INTEGRATED

Base: `main@997b3b71990f34b8a6a066fcc1df69efc11a8997`

Branch: `experiment/accepted-lifecycle-issuer-scope-policy-v0`

## Proven candidate behavior

The candidate accepts only a previously VERIFIED `REGISTERED_GOVERNANCE_SOURCE_VERIFICATION` bound to the expected source verification identity and expected root verification identity.

The frozen V0 accepted policy is intentionally fail-closed:

- source status: `UNCONFIGURED_FAIL_CLOSED`
- issuer set semantics: `CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY`
- permitted issuer refs: `[]`
- subject kinds: `POLICY`, `ASSIGNMENT`, `DELEGATION`
- authority: `NONE`

Acceptance materializes immutable evidence of this policy state. It does not create lifecycle issuer authority.

## Guardrails

`VERIFIED REGISTERED SOURCE ≠ ACCEPTED POLICY`

`ACCEPTED POLICY ≠ ISSUER AUTHORITY`

`ACCEPTED FAIL-CLOSED POLICY = NO CURRENTLY PERMITTED ISSUER`

`CALLER ASSERTION ≠ PERMITTED ISSUER`

`POLICY ACCEPTANCE ≠ LIFECYCLE EVENT ACCEPTANCE`

## Regression

Exact locally tested bytes: `10/10 PASS`.

Covered cases:

1. exact fail-closed verified policy accepted
2. exact acceptance is idempotent
3. stale source verification → STALE
4. stale root verification → STALE
5. unverified source → UNCERTAIN
6. caller cannot inject permitted issuer
7. source verification containing an issuer is outside frozen V0
8. conflicting prior acceptance → CONFLICT
9. conflicting ledger commit → CONFLICT
10. acceptance creates no lifecycle issuer authority

Implementation Git blob: `f2b2a5d539cfbc2b97e6b0867d785c38e556b89d`
Implementation SHA-256: `fff5a0e7113da85ec4eeedf7116f9a1bb96f227129425a99f021dcbf5801e1f8`

Regression Git blob: `c36cbb5ac2464cdda9bf1fb9b1e0fe855baf6445`
Regression SHA-256: `8ef3c2fbf98499a8473bd72e3a4d112d7f0c35700c7d34e0de86eba73c812e4d`

## Current boundary

This candidate does NOT yet authorize any lifecycle issuer. Therefore `Accepted Immutable Lifecycle Event Evidence` remains blocked until an accepted policy revision/process exists that can validly establish one or more permitted issuer identities.

No merge, deploy, canonical-state mutation, continuation authority, execution authority, or lifecycle issuer authority is created by this candidate.
