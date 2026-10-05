# GT63 AYA Interaction Identity — Accepted Checkpoint

Date: 2026-10-05 Europe/Sofia

## 1. Status

GT63 AYA INTERACTION IDENTITY DECISIONS: ACCEPTED

This checkpoint preserves explicit human governance decisions concerning the GT63 AYA interaction semantic, the V0 issuer model, the interaction reference format, the interaction identifier grammar, and the first exact interaction identity values.

This checkpoint is documentation-only. It does not authorize implementation, source changes, testing, runtime wiring, persistence, deployment, Account→Interaction association, Principal→Interaction association, eligibility execution, Gate action, workflow execution, continuation authority, effect authorization, offer mutation, or MACHINE authority.

## 2. Human Governance Decision

Human governance accepts the exact Interaction Identity decisions stated in this checkpoint.

The accepted decisions establish:

- the semantic meaning of an AYA GT63 interaction;
- the V0 issuance-authority model;
- the closed outer `interactionRef` format;
- the closed `interactionId` grammar;
- the first exact `interactionId`;
- the first exact concrete `interactionRef`;
- the first exact `interactionRevision` value;
- the first exact `interactionEvidenceRef`;
- the exact evidence-object binding that a future durable evidence object must preserve.

No additional association, execution, effect, or authority decision is accepted by this checkpoint.

## 3. Accepted Interaction Semantic

GT63 AYA INTERACTION SEMANTIC: ACCEPTED

The accepted semantic is:

> An AYA GT63 interaction is a durable governed work context for AYA travel work.

The accepted scope permits an interaction to:

- span multiple authentication or application sessions;
- span multiple requests and observations;
- contain multiple travel-related intents when they remain within the same governed work context;
- later contain or reference multiple offers as semantic capability only.

An interaction is not:

- an authentication session;
- an HTTP request;
- a route invocation;
- a runtime process;
- a runtime object;
- a database row alone;
- an observation;
- an intent;
- a Gate;
- an eligibility assessment or result;
- an offer;
- an effect;
- a UI conversation;
- a caller-provided identifier.

Permitting future multiple-offer semantic capability does not establish offer membership, offer authority, or offer mutation authority.

## 4. Accepted V0 Issuer Model

GT63 AYA INTERACTION V0 ISSUER MODEL: ACCEPTED

The accepted V0 issuer model is:

```text
EXPLICIT HUMAN GOVERNANCE ISSUANCE ONLY
```

No delegated issuer is accepted in V0.

No runtime issuer is accepted in V0.

The following do not issue an interaction identity:

- database presence or mutation;
- session creation or use;
- caller input;
- route parameters;
- Gate discovery;
- eligibility input or output;
- offer creation or selection;
- runtime observation;
- identifier generation;
- model inference;
- materialization mechanism.

A later materialization mechanism may preserve an already accepted human governance decision. It does not create governance authority.

## 5. Accepted interactionRef Format

GT63 AYA interactionRef FORMAT: ACCEPTED

The accepted format is:

```text
gt63-interaction:aya:<agencyId>:<interactionId>
```

The accepted agency scope for this first identity is:

```text
agencyId: AGY-AYA
```

The literal namespace is:

```text
gt63-interaction:aya:
```

The format does not contain `accountRef`, `accountRevision`, `principalRef`, `principalRevision`, `principalEvidenceRef`, `principalAuthEpoch`, `interactionRevision`, or `interactionEvidenceRef`.

Shared agency scope does not establish Account→Interaction or Principal→Interaction association.

## 6. Accepted interactionId Grammar

GT63 AYA interactionId GRAMMAR: ACCEPTED

The accepted grammar is:

```regex
^(?!.*--)[A-Z0-9][A-Z0-9-]{1,62}[A-Z0-9]$
```

The accepted grammar requires:

- uppercase ASCII letters, ASCII digits, and hyphen only;
- minimum length of 3 characters;
- maximum length of 64 characters;
- first character must be an uppercase ASCII letter or digit;
- final character must be an uppercase ASCII letter or digit;
- consecutive hyphens are forbidden;
- comparison is exact and case-sensitive;
- normalization and repair are forbidden.

The grammar excludes:

- empty input;
- lowercase letters;
- colon;
- whitespace;
- slash or backslash;
- dot;
- underscore;
- Unicode;
- control characters;
- percent-encoded or escaped substitutions;
- aliases and fallback formats.

Syntactic validity alone does not establish issuance, existence, currentness, provenance, association, or authority.

## 7. Accepted First interactionId

GT63 AYA FIRST interactionId: ACCEPTED

The accepted first `interactionId` is:

```text
INT-0001
```

The value is accepted by explicit human governance decision under the accepted V0 issuer model.

The `INT-` text does not independently prove type, issuance, currentness, or authority.

The `0001` text does not independently establish revision, time, sequence authority, database order, or currentness.

## 8. Accepted First Concrete interactionRef

GT63 AYA FIRST concrete interactionRef: ACCEPTED

The accepted first concrete `interactionRef` is:

```text
gt63-interaction:aya:AGY-AYA:INT-0001
```

The concrete reference identifies the accepted interaction identity value only. Its existence does not establish any Account→Interaction association, Principal→Interaction association, session membership, request membership, observation membership, intent membership, offer membership, Gate state, eligibility state, execution authority, effect authority, or offer authority.

## 9. Accepted First interactionRevision

GT63 AYA FIRST interactionRevision: ACCEPTED

The accepted first `interactionRevision` is:

```text
1
```

This checkpoint accepts the exact value `1` for the first interaction identity.

It does not infer or accept a general increment rule, transition rule, lifecycle, supersession mechanism, compatibility rule, or relationship to any account, principal, association, authentication, Gate, eligibility, offer, or effect revision.

## 10. Accepted First interactionEvidenceRef

GT63 AYA FIRST interactionEvidenceRef: ACCEPTED

The accepted first `interactionEvidenceRef` is:

```text
gt63-interaction-evidence:aya:AGY-AYA:INT-0001:1
```

The reference identifies the required durable governance evidence identity for the exact first interaction binding stated below.

The reference itself does not prove that the durable evidence object has been materialized.

It is not derived from runtime state, database presence, session state, caller input, route parameters, Gate discovery, eligibility output, offer identity, or model inference.

## 11. Accepted Evidence-Object Binding

The accepted evidence-object binding is exactly:

```text
interactionRef: gt63-interaction:aya:AGY-AYA:INT-0001
interactionRevision: 1
interactionEvidenceRef: gt63-interaction-evidence:aya:AGY-AYA:INT-0001:1
```

Any future durable interaction evidence object must preserve all three values exactly and must preserve their relationship as one human-governed interaction identity binding.

Missing, substituted, inferred, normalized, or contradictory values do not satisfy the accepted binding.

DURABLE INTERACTION EVIDENCE OBJECT: NOT MATERIALIZED

## 12. Durable Evidence Boundary

This documentation checkpoint preserves the accepted human governance decision. It does not claim that the separately referenced durable interaction evidence object already exists.

Until separately materialized and verified:

- no runtime component may claim the referenced evidence object exists;
- no database row may substitute for it;
- no session or request context may substitute for it;
- no Gate or eligibility result may substitute for it;
- no offer record may substitute for it;
- no implementation artifact may substitute for it;
- no caller input may substitute for it.

Materialization of the durable interaction evidence object requires separate explicit authorization.

## 13. Explicit Non-Claims

This checkpoint does not claim, establish, or authorize:

- Account→Interaction association;
- Principal→Interaction association;
- account ownership of the interaction;
- principal ownership of the interaction;
- session, request, observation, intent, or offer membership;
- interaction lifecycle state beyond the exact accepted identity values;
- operational interaction currentness;
- eligibility execution;
- an eligibility result;
- principal eligibility;
- Gate creation, discovery, selection, satisfaction, or action;
- workflow execution;
- continuation authority;
- execution authority;
- effect authorization;
- offer mutation;
- implementation;
- source changes;
- tests or regression execution;
- runtime, route, server, or UI wiring;
- database or persistence mutation;
- Railway action or deployment;
- login, session, or observation action;
- MACHINE authority;
- any authority effect.

ACCOUNT→INTERACTION ASSOCIATION CONTRACT: NOT ACCEPTED

PRINCIPAL→INTERACTION ASSOCIATION: NOT ACCEPTED

ELIGIBILITY EXECUTION AUTHORIZED: NO

GATE ACTION AUTHORIZED: NO

OFFER MUTATION AUTHORIZED: NO

IMPLEMENTATION AUTHORIZED: NO

MACHINE AUTHORITY: NONE

authorityEffect: NONE

## 14. Deferred Decisions

The following remain deferred until separately presented and explicitly accepted:

- durable interaction evidence object materialization;
- interaction evidence-object schema beyond the exact accepted binding;
- interaction lifecycle states;
- operational interaction currentness rules;
- future interaction revision rules;
- supersession, revocation, closure, reopening, and contradiction rules;
- protected-snapshot producer;
- uniqueness registry and collision-evidence representation;
- Account→Interaction association contract;
- Principal→Interaction association evidence;
- request, observation, intent, and offer membership contracts;
- implementation and persistence;
- testing and runtime wiring;
- eligibility execution;
- Gate action;
- workflow execution;
- continuation or execution authority;
- effect authorization;
- offer mutation.

Deferred decisions must not be inferred from the accepted identity values or supplied through fallback behavior.

## 15. STOP Conditions

STOP if:

- the accepted interaction semantic would be changed;
- the accepted V0 issuer model would be changed or delegated;
- the accepted `interactionRef` format would be changed;
- the accepted `interactionId` grammar would be changed;
- `INT-0001` would be normalized, repaired, substituted, or reinterpreted;
- the accepted concrete `interactionRef` would be changed;
- `interactionRevision: 1` would be assigned an unaccepted lifecycle or sequence meaning;
- the accepted `interactionEvidenceRef` would be changed or inferred;
- the durable interaction evidence object would be claimed as materialized without separate evidence;
- caller input, runtime state, database presence, session state, route parameters, Gate discovery, eligibility output, offer identity, or model inference would be treated as issuance evidence;
- Account→Interaction or Principal→Interaction association would be inferred or introduced;
- interaction identity would be treated as eligibility, Gate, execution, effect, or offer authority;
- implementation, testing, runtime, database, Railway, deployment, login, observation, eligibility, Gate, workflow, continuation, effect, or offer action would be required;
- MACHINE authority or `authorityEffect` would be widened;
- this checkpoint could not remain documentation-only.

## 16. Preserved Final States

```text
GT63 AYA INTERACTION SEMANTIC: ACCEPTED

GT63 AYA INTERACTION V0 ISSUER MODEL: ACCEPTED

V0 ISSUER:
EXPLICIT HUMAN GOVERNANCE ISSUANCE ONLY

GT63 AYA interactionRef FORMAT: ACCEPTED

INTERACTIONREF FORMAT:
gt63-interaction:aya:<agencyId>:<interactionId>

GT63 AYA interactionId GRAMMAR: ACCEPTED

INTERACTIONID GRAMMAR:
^(?!.*--)[A-Z0-9][A-Z0-9-]{1,62}[A-Z0-9]$

GT63 AYA FIRST interactionId: ACCEPTED

interactionId:
INT-0001

GT63 AYA FIRST concrete interactionRef: ACCEPTED

interactionRef:
gt63-interaction:aya:AGY-AYA:INT-0001

GT63 AYA FIRST interactionRevision: ACCEPTED

interactionRevision:
1

GT63 AYA FIRST interactionEvidenceRef: ACCEPTED

interactionEvidenceRef:
gt63-interaction-evidence:aya:AGY-AYA:INT-0001:1

DURABLE INTERACTION EVIDENCE OBJECT: NOT MATERIALIZED

ACCOUNT→INTERACTION ASSOCIATION CONTRACT: NOT ACCEPTED

PRINCIPAL→INTERACTION ASSOCIATION: NOT ACCEPTED

ELIGIBILITY EXECUTION AUTHORIZED: NO

GATE ACTION AUTHORIZED: NO

OFFER MUTATION AUTHORIZED: NO

IMPLEMENTATION AUTHORIZED: NO

MACHINE AUTHORITY: NONE

authorityEffect: NONE
```
