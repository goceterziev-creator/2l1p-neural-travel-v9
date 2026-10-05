# GT63 AYA Canonical Account Identity — Accepted Checkpoint

Date: 2026-10-04 Europe/Sofia

## 1. Status

GT63 AYA CANONICAL ACCOUNT IDENTITY: ACCEPTED

This checkpoint preserves an explicit human governance decision concerning canonical GT63 AYA account identity only.

This checkpoint is documentation-only. It does not authorize implementation, source changes, test execution, runtime wiring, persistence, deployment, account-to-interaction association, eligibility execution, Gate action, offer mutation, or MACHINE authority.

## 2. Human Governance Decision

Human governance accepts one canonical account identity form for GT63 AYA:

- the canonical `accountRef` format is `gt63-account:aya:<agencyId>:<applicationUserId>`;
- the accepted initial `accountRef` is `gt63-account:aya:AGY-AYA:USR-ADMIN`;
- the accepted initial `accountRevision` is `1`;
- `accountRevision` means the GT63 account-identity binding revision;
- `principalAuthEpoch` remains authentication/currentness evidence only and is not the GT63 account-identity binding revision.

No other decision is accepted by this checkpoint.

## 3. Accepted Account Identity Source

The accepted canonical GT63 AYA account identity is composed from the exact pair:

- `agencyId`;
- `applicationUserId`.

Those values occupy the corresponding segments of the accepted `accountRef` format. This documentation checkpoint does not identify, approve, or implement a runtime producer, database lookup, route, session mapping, or other operational source for either value.

## 4. Accepted accountRef Format

The accepted format is:

```text
gt63-account:aya:<agencyId>:<applicationUserId>
```

The literal prefix and namespace are `gt63-account:aya:`. The remaining two segments represent the accepted `agencyId` and `applicationUserId` identity components in that order.

This acceptance does not define fallback formats, aliases, alternative namespaces, implicit normalization, or a second identity flow.

## 5. Accepted Initial accountRef

The accepted initial canonical account reference is:

```text
gt63-account:aya:AGY-AYA:USR-ADMIN
```

This exact value is preserved as the accepted initial identity. It is not evidence of a current login, live session, authenticated request, principal eligibility, interaction association, Gate state, execution authority, or effect authority.

## 6. Accepted accountRevision and Meaning

The accepted initial value is:

```text
accountRevision: 1
```

The accepted meaning is:

```text
GT63 account-identity binding revision
```

This checkpoint does not define an increment trigger, transition mechanism, persistence model, currentness resolver, or runtime revision authority. Those matters remain deferred.

## 7. Authentication Currentness Separation

`principalAuthEpoch` remains authentication/currentness evidence only.

It is separate from `accountRevision` and must not be used as, converted into, substituted for, or inferred to be the GT63 account-identity binding revision.

Consequently:

- `accountRevision` does not prove authentication currentness;
- `principalAuthEpoch` does not revise canonical account identity;
- equality, ordering, or correlation between the two values is not established;
- neither value independently proves eligibility, Gate satisfaction, execution authority, effect authority, or offer authority.

## 8. Account-to-Principal Boundary

Acceptance of the canonical `accountRef` identifies the accepted GT63 AYA account identity shape only.

It does not by itself create, select, authenticate, or prove a principal. It does not derive or accept a `principalRef`, `principalRevision`, `principalEvidenceRef`, principal-to-account binding, or production provenance path.

Any account-to-principal binding, evidence contract, currentness rule, or production composition requires a separate explicit human governance decision. No such decision is created by this checkpoint.

The account-to-principal boundary must also remain separate from any future account-to-interaction association.

## 9. Explicit Non-Claims

This checkpoint does not claim, establish, or authorize:

- an accepted account-to-interaction association contract;
- an account-to-interaction record, lookup, mapping, or producer;
- implementation or source changes;
- test or regression execution;
- runtime, route, server, or UI wiring;
- database or persistence mutation;
- Railway, deployment, login, session, or observation action;
- authenticated-principal proof or current authentication;
- principal eligibility or eligibility execution;
- Gate creation, selection, satisfaction, or action;
- workflow execution;
- continuation or execution authority;
- effect authorization or offer mutation;
- MACHINE authority;
- any authority effect.

## 10. Deferred Decisions

The following remain deferred until separately presented and explicitly accepted:

- the account-to-interaction association contract;
- the authoritative producer and provenance of account-to-interaction association evidence;
- any account-to-principal binding or evidence contract;
- the runtime source and trust boundary for `agencyId` and `applicationUserId`;
- `accountRevision` increment, transition, storage, and currentness rules;
- parsing, validation, normalization, and rejection behavior for future implementation;
- database, persistence, migration, route, server, UI, deployment, and runtime composition;
- implementation authorization;
- test and regression execution authorization;
- eligibility, Gate, workflow, effect, and offer authority.

Deferred decisions must not be inferred from the accepted identity string or supplied by fallback behavior.

## 11. STOP Conditions

STOP if:

- the accepted `accountRef` format or initial value would be changed;
- `accountRevision` would mean anything other than GT63 account-identity binding revision;
- `principalAuthEpoch` would be treated as account identity or account revision;
- the accepted account identity would be treated as proof of authentication, principal identity, eligibility, interaction association, Gate state, execution authority, or effect authority;
- an account-to-principal or account-to-interaction mapping would be inferred or implemented without separate acceptance;
- a fallback, alias, alternative namespace, normalization rule, or second identity flow would be introduced;
- implementation, testing, staging, commit, push, deployment, browser, runtime, database, Railway, login, observation, eligibility, Gate, workflow, effect, or offer action would be required;
- MACHINE authority or `authorityEffect` would be widened;
- this checkpoint cannot remain documentation-only.

## 12. Preserved Final States

GT63 AYA CANONICAL ACCOUNT IDENTITY: ACCEPTED

ACCEPTED ACCOUNTREF FORMAT: `gt63-account:aya:<agencyId>:<applicationUserId>`

ACCEPTED INITIAL ACCOUNTREF: `gt63-account:aya:AGY-AYA:USR-ADMIN`

ACCEPTED ACCOUNTREVISION: `1`

ACCOUNTREVISION MEANING: GT63 account-identity binding revision

PRINCIPALAUTHEPOCH: AUTHENTICATION/CURRENTNESS EVIDENCE ONLY

ACCOUNT→INTERACTION ASSOCIATION CONTRACT: NOT ACCEPTED

IMPLEMENTATION AUTHORIZED: NO

MACHINE AUTHORITY: NONE

authorityEffect: NONE
