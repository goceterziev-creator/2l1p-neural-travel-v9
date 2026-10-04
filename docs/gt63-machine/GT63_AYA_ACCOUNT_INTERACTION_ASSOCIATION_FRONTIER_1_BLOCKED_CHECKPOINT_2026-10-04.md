# GT63 AYA Account→Interaction Association Frontier #1 — Blocked Frontier Checkpoint

## Status

```text
FRONTIER STATUS: BLOCKED
ACCOUNT→INTERACTION ASSOCIATION CONTRACT: NOT ACCEPTED
BLOCKED FRONTIER RECORD: ACCEPTED
12/13 REQUIRED-NOW VALUES: BLOCKED / HUMAN DECISION REQUIRED
LOGICAL ATOMICITY BOUNDARY: CANDIDATE VALUE ONLY
```

This checkpoint records an accepted blocked-frontier state. It does not accept the Account→Interaction Association contract and does not authorize material action.

## Authoritative Repository Baseline

```text
Current authoritative main:
d429d808f5a5c4e762f1d2e721caf8472f02e7c6

Tree:
dd652d04c404761acab72561b07e3a51ae65a2cd
```

The baseline contains the accepted and merged provider-free Trusted Eligibility Query Owner V0 implementation and its documentation checkpoints.

It does not contain an accepted trusted production snapshot provider or an authoritative Account→Interaction association source.

## Frontier Summary

Trusted production construction of:

```text
withEligibilityCandidateSetSnapshot
```

requires an authoritative way to bind the exact authenticated AYA account and account revision to exactly one current interaction and interaction revision.

Current source contains partial authenticated account and principal materials, but it does not establish:

- a canonical production `accountRef`;
- an authoritative `accountRevision`;
- an accepted account-to-principal mapping using those exact account fields;
- an authoritative Account→Interaction association producer;
- an authoritative production interaction identity source;
- accepted association provenance and transition authority.

Therefore, the Account→Interaction Association Frontier remains blocked before production snapshot-provider design can proceed.

## Filled Checklist Result

```text
Required-now values: 13
BLOCKED / HUMAN DECISION REQUIRED: 12
Candidate value available from accepted supplement semantics: 1
```

The only candidate value is the logical atomicity boundary:

```text
Account, principal, association and interaction records must belong to one
protected logical snapshot.

Their exact identities and revisions must remain consistent throughout the
synchronous snapshot callback.

No record may be substituted, refreshed or reread from another logical
snapshot during candidate construction.

The concrete transaction, lock or read-lease implementation remains deferred.
```

This candidate value does not prove that any current production source can satisfy the boundary.

## Blocked Required-Now Decisions

### 1. Canonical account identity source

**BLOCKED / HUMAN DECISION REQUIRED**

No single current accepted source authoritatively produces the complete owner-compatible authenticated-account record.

### 2. Canonical `accountRef` format and namespace

**BLOCKED / HUMAN DECISION REQUIRED**

No durable namespace, grammar, normalization rule, uniqueness scope or collision rule is accepted.

The existing session-derived account reference is not accepted as durable provenance.

### 3. `accountRevision` semantics

**BLOCKED / HUMAN DECISION REQUIRED**

No accepted rule defines what `accountRevision` represents, which source produces it or which events advance it.

### 4. Account-to-principal binding source and rule

**BLOCKED / HUMAN DECISION REQUIRED**

Current AYA material partially supplies:

```text
principalRef
principalRevision
principalEvidenceRef
```

No accepted rule binds those fields to exact production `accountRef` and `accountRevision` values in the same protected snapshot.

### 5. Association system of record

**BLOCKED / HUMAN DECISION REQUIRED**

No authoritative production collection, provider or system of record exists for Account→Interaction associations.

### 6. Association issuance provenance

**BLOCKED / HUMAN DECISION REQUIRED**

No accepted event, human-governed decision or evidence source is authorized to issue an association.

Authentication, observation and snapshot reading do not constitute issuance.

### 7. `associationRef` rule

**BLOCKED / HUMAN DECISION REQUIRED**

No accepted namespace, derivation, uniqueness scope, collision rule or issuance source exists.

### 8. `associationRevision` rule

**BLOCKED / HUMAN DECISION REQUIRED**

No accepted initial value, advancement rule, ordering model or historical-preservation rule exists.

### 9. Lifecycle, freshness and contradiction transition authority

**BLOCKED / HUMAN DECISION REQUIRED**

The allowed states and selection behavior are fixed, but no production source is authorized to transition an association among those states or declare a contradiction.

### 10. Authoritative `interactionId` and `interactionRevision` source

**BLOCKED / HUMAN DECISION REQUIRED**

No accepted production interaction source exists.

Caller input, global Gate discovery and experimental runtime material cannot supply this identity.

### 11. Revision invalidation behavior

**BLOCKED / HUMAN DECISION REQUIRED**

No accepted rule determines how an association becomes non-current when its account, principal or interaction revision changes.

Silent rebinding remains forbidden.

### 12. Provenance representation outside the fixed association object

**BLOCKED / HUMAN DECISION REQUIRED**

The association record has a fixed exact-key schema. No separate accepted evidence representation currently binds source provenance to the complete association identity and revision.

## Why Production Snapshot-Provider Design Is Blocked

The provider-free owner selects an interaction only through this chain:

```text
authenticated account identity and revision
    →
one exact current Account→Interaction association
    →
one exact current interaction identity and revision
    →
current pending Gate candidate
    →
current continuation target
```

The chain breaks at its first transition.

Without accepted account identity, association source and interaction provenance, a production provider would have to invent at least one of the following:

- which account identity is authoritative;
- which account revision is current;
- which interaction belongs to the account;
- which association record is authoritative;
- how conflicts are resolved;
- how provenance is demonstrated.

Such invention would silently change the accepted contract and could enable caller-controlled, globally inferred or experimentally sourced interaction selection.

The accepted logical atomicity boundary cannot repair missing source authority.

## Forbidden Paths

This checkpoint does not permit:

- choosing a production account source;
- deriving `accountRef` from session identity alone;
- synthesizing or defaulting `accountRevision`;
- creating or persisting an association;
- accepting an association system of record;
- promoting experimental runtime material;
- accepting fixture identifiers as production identities;
- accepting caller-supplied `interactionId`;
- using global pending-Gate discovery to infer interaction identity;
- resolving multiple current associations by order or recency;
- silently rebinding after a revision change;
- designing or implementing a database schema;
- constructing or wiring a production snapshot provider;
- executing an eligibility query;
- selecting, creating or satisfying a Gate;
- creating any role, assignment, delegation, authorization, continuation or effect;
- mutating an offer;
- merging or deploying association functionality;
- widening authority.

## Explicit Non-Claims

This checkpoint does not claim that:

- the Account→Interaction Association contract is accepted;
- any blocked human decision has been made;
- an authoritative account source exists;
- a canonical account reference or revision exists;
- an authoritative association exists;
- an association has been issued, stored or observed;
- any production interaction is current;
- a production snapshot provider can be constructed;
- a protected production snapshot or read lease exists;
- any Gate candidate or continuation target is authoritative;
- principal eligibility has been reached or assessed;
- Binding #1 proves the missing account-association transition;
- provider-free conformance establishes production trust;
- MACHINE authority exists.

## Preserved Governance States

```text
IMPLEMENTATION AUTHORIZED: PROVIDER-FREE ONLY
PROVIDER-FREE IMPLEMENTATION CANDIDATE: ACCEPTED + MERGED
ACCOUNT→INTERACTION ASSOCIATION CONTRACT: NOT ACCEPTED
BLOCKED FRONTIER RECORD: ACCEPTED
PRINCIPAL ELIGIBILITY: NOT REACHED / NOT ASSESSED
CONCRETE AUTHORITATIVE GATE QUERY: ABSENT
BINDING #1: PROVEN / CLOSED / UNCHANGED
MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

## STOP Conditions

**HARD STOP** applies while any of the twelve required-now decisions remains unresolved.

It also applies if any proposed next step would:

- infer a blocked decision from existing code;
- treat partial identity material as complete provenance;
- treat a session reference as durable account authority;
- invent production formats or revision semantics;
- use caller or Gate input to select an interaction;
- promote experimental or fixture material;
- weaken exact-current association cardinality;
- bypass contradiction handling;
- claim atomicity without a later accepted implementation mechanism;
- modify the fixed association schema without a separate accepted contract revision;
- implement, wire or execute before separate human authorization;
- create eligibility, Gate or MACHINE authority.

No production `withEligibilityCandidateSetSnapshot` design may be accepted until the twelve blocked decisions are explicitly resolved through a separate human governance decision.

**STOP.**
