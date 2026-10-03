# GT63 AYA Trusted Eligibility Query Owner V0 — Design-Only Acceptance Checkpoint

Date: 2026-10-04 Europe/Sofia

## Status

GT63 AYA Trusted Eligibility Query Owner V0 is accepted as a DESIGN-ONLY contract candidate by explicit human governance decision.

All required-now checklist decisions are ACCEPTED.

This checkpoint is documentation-only. It does not perform or authorize implementation, runtime wiring, eligibility execution, repository mutation, deployment, database mutation, role creation, assignment creation, delegation creation, Gate creation, Gate satisfaction, continuation execution, or offer mutation.

## Baseline

origin/main:

`173633cd2a2e802d5d2a8e145c30c98091e7d5ae`

Tree:

`c7f5072e651f2f46b0612a4644b624eb51c60a4d`

## Accepted Design Boundary

Trusted Eligibility Query Owner V0 has exactly one design responsibility:

During one enclosing synchronous evaluation, derive one authoritative eligibility query for exactly one current AYA Gate and invoke the existing principalEligibilityPort at most once.

The accepted design uses:

- atomic candidate-set callback model;
- public argument-free owner operation;
- authenticated account to interaction association contract;
- owner-enforced Gate cardinality;
- PENDING as the only accepted Gate state for V0 query derivation;
- exact owner result schema;
- separation between query derivation and eligibility result;
- opaque RETURNED_NULL;
- domain-separated authorityScopeDigest material;
- restricted JSON value domain;
- duplicate-key-safe decoding;
- exact canonical string escaping and literal UTF-8 non-ASCII behavior;
- rejection of negative zero and unpaired surrogates;
- no Unicode normalization inside authorityScope;
- already-NFC requirements for interactionId, gateId and continuationTargetRef;
- synchronous protected snapshot requirement;
- no cache, reuse, persistence or exposure of the private query.

## Preserved Non-Claims

Acceptance does not establish:

- working implementation;
- runtime wiring;
- current authoritative Gate;
- concrete eligibility query;
- authenticated-principal evidence;
- principal eligibility;
- role, assignment or delegation;
- human authorization or Gate satisfaction;
- continuation or execution authority;
- offer mutation;
- persistence or deployment;
- MACHINE authority.

Preserved separations:

- AUTHORITATIVE SOURCE SELECTION != MACHINE AUTHORITY
- ACCOUNT-INTERACTION ASSOCIATION != PRINCIPAL ELIGIBILITY
- READY QUERY != ELIGIBLE PRINCIPAL
- ELIGIBILITY INVOCATION != ELIGIBLE RESULT
- RETURNED EVIDENCE != EFFECT AUTHORIZATION

## Deferred Implementation Decisions

The following remain deferred and must not silently revise the accepted semantics:

- authoritative producer of the account-interaction association;
- authoritative production Gate snapshot source;
- whether the experimental interaction runtime is adapted or remains excluded;
- authoritative continuation-target currentness source;
- concrete snapshot-isolation or read-lease mechanism;
- verification that the mechanism protects association, interaction, Gate and target through the synchronous eligibility call;
- runtime component permitted to construct the owner;
- verification that all eligibility-bound scope producers satisfy the already-NFC restriction;
- verification that duplicate-key-safe authority-scope decoding is technically available;
- reconciliation of any implementation conflict with existing port or consumer semantics.

## STOP Conditions

Future implementation planning or implementation must stop if:

- any required-now decision is treated as unaccepted or ambiguous;
- the authoritative association or Gate source cannot be identified;
- Gate selection requires client-supplied identity or scope material;
- more than one current candidate Gate exists;
- the source cannot guarantee the protected synchronous snapshot;
- continuation-target currentness cannot be established;
- duplicate-key-safe decoding cannot be guaranteed;
- existing scope producers cannot satisfy the NFC restriction;
- existing consumer semantics conflict with the accepted design;
- implementation requires changing eligibility semantics;
- implementation would widen authority or create a second flow;
- authority or authorityEffect would differ from NONE.

## Final State

DESIGN PROPOSAL: ACCEPTED AS DESIGN-ONLY CONTRACT CANDIDATE

IMPLEMENTATION AUTHORIZED: NO

RUNTIME WIRING AUTHORIZED: NO

ELIGIBILITY EXECUTION AUTHORIZED: NO

ROLE / ASSIGNMENT / DELEGATION AUTHORITY: NO

GATE CREATION / SATISFACTION AUTHORITY: NO

CONTINUATION / EXECUTION AUTHORITY: NO

OFFER MUTATION AUTHORITY: NO

PRINCIPAL ELIGIBILITY: NOT REACHED / NOT ASSESSED

TRUSTED QUERY OWNER IMPLEMENTATION: ABSENT

CONCRETE AUTHORITATIVE GATE QUERY: ABSENT

BINDING #1: PROVEN / CLOSED / UNCHANGED

MACHINE AUTHORITY: NONE

authorityEffect: NONE

