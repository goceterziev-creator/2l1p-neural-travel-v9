# GT63 MACHINE — Authenticated Governance Authorization Binding V0

## Status

**DESIGN / CONTRACT ONLY**

Machine authority: **NONE**.

No implementation, runtime wiring, repository integration, canonical-state mutation, governance mutation, merge, deploy, or execution authority is created by this document.

## Authoritative baseline

Repository: `goceterziev-creator/2l1p-neural-travel-v9`

Design branch: `design/authenticated-governance-authorization-binding-v0`

Baseline main: `b2399f511d21c0537972c570dedfeda60db3e7ef`

The design exists to bridge already-separate evidence domains. It MUST NOT duplicate principal authentication, principal eligibility, role policy, role assignment/delegation, trust registration, human approval capture, or downstream execution primitives.

## Problem statement

The repository already contains separately governed evidence for:

- authenticated human principal/source-event binding;
- principal eligibility assessment;
- accepted role policy requirements;
- accepted direct role assignment;
- accepted direct delegation;
- authenticated GitHub principal evidence;
- exact human approval/trust-decision capture;
- downstream governance acts such as `GATE_AUTHORIZATION`.

Those facts are individually insufficient to establish that one exact authenticated principal is authorized to perform one exact governance act in one exact context.

The missing semantic relation is therefore a bounded authorization binding.

## Core invariant

> `AUTHENTICATED PRINCIPAL + ELIGIBLE PRINCIPAL + ACCEPTED ROLE EVIDENCE + HUMAN APPROVAL ≠ GOVERNANCE AUTHORIZATION`
>
> unless all required evidence is bound to the same exact principal, governance act, subject, scope, revision, temporal frame, and authorization event.

Additional invariants:

- `AUTHENTICATED PRINCIPAL ≠ ELIGIBLE PRINCIPAL`
- `ELIGIBLE PRINCIPAL ≠ ROLE HOLDER`
- `ROLE REQUIREMENT ≠ ROLE ASSIGNMENT`
- `DIRECT ASSIGNMENT ≠ DELEGATION`
- `ROLE HOLDER ≠ AUTHORIZED ACTOR FOR EVERY ACT`
- `HUMAN APPROVAL ≠ GOVERNANCE AUTHORIZATION`
- `GOVERNANCE AUTHORIZATION ≠ EXECUTION`
- `TRUST_REGISTRATION_RESOLVED ≠ GOVERNANCE AUTHORIZATION`
- `CURRENT ROLE EVIDENCE ≠ PRINCIPAL ELIGIBILITY`
- `STRUCTURAL VALIDITY ≠ SEMANTIC TRUTH`
- `ACCEPTED EVIDENCE ≠ CURRENT EVIDENCE`

## Purpose

Produce or refuse one bounded evidence object answering only this question:

> Is this exact authenticated principal authorized, by currently accepted governance evidence, to perform this exact governance act in this exact context and scope?

The component MUST NOT execute the act.

## Proposed capability boundary

Name:

`Authenticated Governance Authorization Binding V0`

Ruleset candidate:

`authenticated-governance-authorization-binding-v0.1.0`

Authority:

`NONE`

The component is an evidence-binding primitive, not an executor and not an authority source.

## Required request

The request MUST be exact and caller-minimal. Proposed fields:

```json
{
  "rulesetVersion": "authenticated-governance-authorization-binding-v0.1.0",
  "authorizationSubjectRef": "...",
  "authorizationSubjectRevision": "...",
  "governanceAct": "...",
  "contextScope": { },
  "principalRef": "...",
  "principalRevision": "...",
  "humanAuthorizationEvidenceRef": "..."
}
```

The caller MUST NOT be allowed to assert any of:

- eligibility state;
- role satisfaction;
- assignment validity;
- delegation validity;
- authorization state;
- authority level;
- freshness/currentness;
- trust state;
- contradiction state;
- outcome.

Those states must be resolved only from accepted evidence ports.

## Required evidence ports

### 1. Authenticated Principal Port

Purpose: resolve the exact current authenticated principal evidence.

Input identity:

- `principalRef`
- `principalRevision`
- exact authorization/session context as required by the existing authenticated-principal contract.

Minimum acceptable semantics:

- principal is exact;
- lifecycle `CURRENT`;
- freshness `CURRENT`;
- contradiction `NONE`;
- evidence is accepted/current under its own ruleset;
- provider/source trust requirements are already satisfied by the producing subsystem.

This port MUST NOT imply eligibility or role.

### 2. Principal Eligibility Port

Purpose: resolve current eligibility for the exact principal and exact authorization subject/context.

Minimum acceptable semantics:

- exact principal match;
- exact eligibility policy/revision match;
- lifecycle `CURRENT`;
- freshness `CURRENT`;
- contradiction `NONE`;
- state positively permits the principal for the target context.

`UNKNOWN` MUST remain `UNKNOWN` and MUST NOT be promoted to eligible.

### 3. Governance Role Requirement Port

Purpose: resolve the accepted requirement for the exact `governanceAct` and exact `contextScope`.

The requirement evidence must provide at least:

- requirement ref/revision;
- governance act;
- required role ref/revision;
- exact/bounded context scope;
- accepted/current evidence identity.

The binding MUST reject cross-act and cross-scope substitution.

### 4. Role Assignment / Delegation Resolution Port

Purpose: establish whether the exact principal legitimately holds the exact required role for the exact context.

The resolver may satisfy the requirement through either:

- accepted direct assignment; or
- accepted delegation chain.

The two evidence characters MUST remain distinguishable in the bound result.

For delegation, the resolver MUST preserve and verify:

- delegator principal;
- delegate principal;
- role ref/revision;
- delegation depth;
- redelegation rules;
- issuer constraints;
- exact context scope containment;
- temporal/lifecycle/freshness/contradiction state;
- accepted evidence references for every material link.

No implicit owner/admin/root role may be invented.

### 5. Human Authorization Event Port

Purpose: resolve the exact human authorization event for the exact act and subject.

The evidence must be bound to:

- the same exact authenticated principal;
- the same exact authorization subject/ref/revision;
- the same governance act;
- the same exact or contained context scope;
- one immutable payload or equivalent exact semantic digest;
- lifecycle `CURRENT`;
- freshness `CURRENT`;
- contradiction `NONE`.

A generic approval, login, trust registration approval, or approval for another subject MUST NOT satisfy this port.

### 6. Temporal / Currentness Port

If currentness is not fully provided by the evidence objects themselves, a dedicated temporal evidence port is required.

It MUST fail closed on:

- stale revisions;
- revoked/superseded assignment or delegation;
- expired authorization event;
- conflicting temporal evidence;
- unknown currentness where currentness is required.

### 7. Authorization Binding Ledger

Purpose: immutable/idempotent storage of accepted authorization bindings.

Required operations:

- lookup by deterministic binding identity;
- lookup by subject/principal/act as required for contradiction detection;
- immutable commit;
- exact replay returns the same accepted binding;
- materially different evidence under the same binding identity MUST conflict.

The ledger MUST NOT manufacture missing evidence.

## Exact semantic joins

A positive binding requires all of the following joins to hold simultaneously:

1. Request principal = authenticated principal.
2. Request principal = eligible principal.
3. Requested act = accepted role requirement act.
4. Requested scope is exactly or validly contained by the accepted requirement scope according to existing scope semantics.
5. Required role = resolved assigned/delegated role.
6. Resolved role principal = authenticated principal.
7. Human authorization event principal = authenticated principal.
8. Human authorization event subject/ref/revision = request subject/ref/revision.
9. Human authorization event act = requested act.
10. Human authorization event scope = exact/valid contained scope for the same act.
11. Every material evidence object is current, fresh, non-contradictory, and accepted according to its own evidence contract.
12. No required source/issuer/trust boundary is unknown where positive proof is required.

If any join is unproven, the component MUST NOT return authorized.

## Proposed outcomes

### Positive

`GOVERNANCE_AUTHORIZATION_BINDING_ACCEPTED`

Only when every required join is positively established.

### Idempotent replay

`GOVERNANCE_AUTHORIZATION_BINDING_ALREADY_ACCEPTED`

Only for byte-/semantic-equivalent replay of the exact accepted evidence set and exact binding identity.

### Rejected

`GOVERNANCE_AUTHORIZATION_BINDING_REJECTED`

For structurally invalid requests, forbidden caller assertions, impossible subject/act combinations, or positive mismatch that safely proves invalidity.

### Uncertain

`GOVERNANCE_AUTHORIZATION_BINDING_UNCERTAIN`

For missing, unavailable, ambiguous, unknown, or insufficient evidence where a positive authorization cannot be proven.

### Stale

`GOVERNANCE_AUTHORIZATION_BINDING_STALE`

When one or more required material evidence objects are proven stale/expired/superseded/revoked for the requested temporal frame.

### Conflict

`GOVERNANCE_AUTHORIZATION_BINDING_CONFLICT`

When accepted evidence materially contradicts other accepted/current evidence for the same binding question.

The component MUST prefer `UNCERTAIN` over a fabricated negative claim when evidence is absent, and MUST use `REJECTED`/`STALE`/`CONFLICT` only when positively supported by evidence.

## Proposed accepted evidence object

Candidate shape:

```json
{
  "type": "GT63_AUTHENTICATED_GOVERNANCE_AUTHORIZATION_BINDING",
  "schemaVersion": "1.0",
  "rulesetVersion": "authenticated-governance-authorization-binding-v0.1.0",
  "bindingId": "governance-authorization-binding:<deterministic digest>",
  "authorizationSubjectRef": "...",
  "authorizationSubjectRevision": "...",
  "governanceAct": "...",
  "contextScope": { },
  "principalRef": "...",
  "principalRevision": "...",
  "principalEvidenceRef": "...",
  "eligibilityEvidenceRef": "...",
  "roleRequirementEvidenceRef": "...",
  "roleResolutionType": "DIRECT_ASSIGNMENT | DELEGATION",
  "roleEvidenceRefs": ["..."],
  "humanAuthorizationEvidenceRef": "...",
  "temporalEvidenceRefs": ["..."],
  "lifecycleState": "CURRENT",
  "freshnessState": "CURRENT",
  "contradictionState": "NONE",
  "authorizationState": "BOUND",
  "authority": "NONE"
}
```

`authorizationState: BOUND` means only that the evidence relation has been proven. It MUST NOT be interpreted as execution authority owned by the binding component.

## Deterministic binding identity

`bindingId` should be derived only from immutable semantic identity material, including at minimum:

- ruleset version;
- subject ref/revision;
- governance act;
- normalized context scope;
- principal ref/revision;
- authenticated principal evidence ref;
- eligibility evidence ref;
- role requirement evidence ref;
- ordered role-resolution evidence refs;
- human authorization evidence ref;
- required temporal evidence refs.

The digest algorithm and canonicalization must reuse an existing repository canonicalization rule where possible rather than invent a competing serialization contract.

## Fail-closed rules

The binding MUST fail closed when:

- authenticated principal is missing or mismatched;
- eligibility is `UNKNOWN`, stale, conflicting, or not positively satisfied;
- no accepted role requirement exists for the exact act/scope;
- required role is not positively resolved to the exact principal;
- delegation depth or redelegation constraints cannot be proven;
- assignment/delegation evidence is stale, revoked, superseded, conflicting, or unknown where positive proof is needed;
- human authorization event is missing, generic, cross-subject, cross-principal, cross-act, cross-scope, stale, or contradictory;
- any evidence source required for positive proof is unavailable;
- the caller attempts to inject derived acceptance/authorization fields;
- ledger history conflicts with the proposed binding.

## Non-goals

V0 MUST NOT:

- authenticate a human;
- determine civil identity;
- create principal eligibility policy;
- create role policy;
- assign roles;
- create delegations;
- capture a human approval UI;
- register trust;
- mutate governance policy;
- execute a tool or workflow;
- satisfy a bootstrap gate merely by existing;
- infer owner/admin/root privileges;
- auto-authorize future acts;
- persist process-local evidence into a durable evidence substrate unless separately accepted;
- turn Git metadata into human authorization evidence.

## Relationship to downstream execution

A downstream executor may consume an accepted authorization binding only through a separate governed execution contract.

Required separation:

> `GOVERNANCE_AUTHORIZATION_BINDING_ACCEPTED ≠ EXECUTION AUTHORIZED`

A later execution path must independently verify:

- accepted binding identity;
- currentness at execution time;
- exact continuation target/tool/action;
- any execution-specific policy or gate;
- no intervening revocation/conflict;
- its own authority boundary.

## Minimum regression contract for any future implementation

Any implementation candidate must prove at least:

1. constructor requires all mandatory evidence ports and immutable ledger;
2. caller cannot assert derived authorization state;
3. missing authenticated principal -> uncertain/fail closed;
4. cross-principal evidence -> no positive binding;
5. ineligible principal -> no positive binding;
6. eligibility `UNKNOWN` -> no positive binding;
7. wrong governance act -> no positive binding;
8. wrong/cross context scope -> no positive binding;
9. missing role requirement -> no positive binding;
10. direct assignment exact positive path;
11. delegation exact positive path with valid depth;
12. invalid/excess delegation depth -> no positive binding;
13. revoked/stale/superseded role evidence -> stale/no positive binding;
14. generic approval cannot satisfy exact human authorization event;
15. cross-subject approval -> no positive binding;
16. cross-principal approval -> no positive binding;
17. cross-act approval -> no positive binding;
18. stale/contradictory human authorization event -> no positive binding;
19. exact current evidence set -> accepted binding;
20. exact replay -> idempotent accepted result;
21. conflicting replay -> conflict;
22. accepted binding remains `authority: NONE`;
23. accepted binding contains no execution result and triggers no execution side effect.

## Readiness gate for implementation

Implementation MUST NOT begin until repository evidence confirms the exact existing contracts and field semantics for:

- current Principal Eligibility Assessment V0 output;
- accepted role requirement evidence output;
- direct assignment evidence output;
- delegation evidence output;
- authenticated principal/source-event evidence output to be consumed here;
- exact human authorization event producer appropriate for `GATE_AUTHORIZATION` or the target governance act;
- scope containment/canonicalization semantics;
- temporal/currentness semantics;
- immutable ledger semantics.

If any of those contracts materially disagree with this design, STOP AND REPORT CONTRACT DRIFT rather than adapting silently.

## Verdict

**DESIGN CONTRACT MATERIALIZED — IMPLEMENTATION NOT AUTHORIZED BY THIS DOCUMENT.**

The strongest supported design claim is:

> GT63 MACHINE requires a bounded evidence-binding primitive that joins an exact authenticated principal, current positive eligibility, accepted role requirement and assignment/delegation evidence, and an exact human authorization event for one exact governance act and scope. Only the proven conjunction may produce an accepted authorization-binding evidence object, and that object itself retains machine authority `NONE` and does not execute the governed act.
