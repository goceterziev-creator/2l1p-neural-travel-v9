# GT63 AYA Account-to-Principal Binding Rule — Accepted Checkpoint

Date: 2026-10-05 Europe/Sofia

Proposed path:

`docs/gt63-machine/GT63_AYA_ACCOUNT_TO_PRINCIPAL_BINDING_RULE_ACCEPTED_CHECKPOINT_2026-10-05.md`

## 1. Status

GT63 AYA ACCOUNT-TO-PRINCIPAL BINDING RULE: ACCEPTED

This checkpoint preserves an explicit human governance decision concerning the exact design rule that binds the accepted canonical GT63 AYA account identity to the accepted GT63 AYA principal identity.

This checkpoint is documentation-only. It does not authorize implementation, source changes, testing, runtime wiring, persistence, deployment, Account→Interaction association, interaction identity, eligibility execution, Gate action, continuation authority, effect authorization, offer mutation, or MACHINE authority.

## 2. Human Governance Decision

Human governance accepts the exact Account-to-Principal Binding Rule defined in this checkpoint.

The accepted binding connects:

```text
canonical GT63 AYA account identity
→
exact GT63 AYA principal identity
```

The binding is limited to the exact account, principal, evidence reference, provenance, currentness, and protected-snapshot rules stated below.

It does not extend to:

```text
principal → interaction
interaction → Gate
Gate → eligibility
eligibility → effect
```

No additional binding, authority, or operational behavior is accepted by this checkpoint.

## 3. Accepted Account Input

The accepted account input is:

```text
accountRef: gt63-account:aya:AGY-AYA:USR-ADMIN
accountRevision: 1
```

The accepted meaning of `accountRevision` is:

```text
GT63 account-identity binding revision
```

The account input must remain exact. Missing, substituted, inferred, aliased, normalized, or contradictory account material is not accepted.

GT63 AYA CANONICAL ACCOUNT IDENTITY: ACCEPTED

## 4. Accepted Principal Output

The accepted principal output is:

```text
principalRef: gt63-principal:aya-account:AGY-AYA:USR-ADMIN
principalRevision: 1
```

This principal identity is accepted only as the exact principal output of the accepted account-to-principal binding.

The accepted identity atoms are:

```text
agencyId: AGY-AYA
applicationUserId: USR-ADMIN
```

The shared numeric value `1` does not establish that `accountRevision` and `principalRevision` have identical meanings, lifecycles, or transition rules.

No principal identity may be substituted, inferred, normalized, or independently invented.

## 5. Accepted Principal Evidence Reference

The accepted `principalEvidenceRef` is:

```text
gt63-principal-evidence:aya-account-principal-binding:AGY-AYA:USR-ADMIN:1
```

The accepted format is:

```text
gt63-principal-evidence:aya-account-principal-binding:<agencyId>:<applicationUserId>:<principalRevision>
```

The accepted evidence reference identifies the exact Account-to-Principal Binding Rule preserved by durable GT63 governance evidence.

For the accepted binding:

```text
agencyId: AGY-AYA
applicationUserId: USR-ADMIN
principalRevision: 1
```

No caller-supplied, runtime-guessed, session-derived, database-observation-only, Gate-discovered, or code-inferred value may replace the accepted `principalEvidenceRef`.

## 6. Accepted Authoritative Producer

The accepted authoritative producer is:

```text
explicit human governance decision
materialized as durable GT63 governance evidence
```

The authoritative producer is not:

- a session;
- a runtime guess;
- a database observation alone;
- `principalAuthEpoch`;
- Gate discovery;
- caller input;
- filename inference;
- code structure;
- provider-free fixture output;
- implementation presence.

Durable materialization preserves the human governance decision. It does not create runtime authority or implementation authorization.

## 7. Accepted Provenance Rule

The accepted provenance rule is:

> The evidence binds the accepted canonical AYA account identity to the exact GT63 principal identity using matching `agencyId` and `applicationUserId` in the same protected logical snapshot.

The required exact equality is:

```text
agencyId(account) == agencyId(principal) == AGY-AYA

applicationUserId(account) == applicationUserId(principal) == USR-ADMIN
```

The principal identity is derived from the accepted canonical AYA account identity. It is not independently invented.

Matching encoded strings alone do not permit substitution for the accepted account material, principal material, evidence reference, provenance, or protected-snapshot requirements.

Missing or contradictory identity atoms invalidate the binding.

## 8. Accepted Currentness Rule

The accepted currentness rule is:

> The binding is current only for the exact `accountRef`/`accountRevision` and `principalRef`/`principalRevision` accepted in this checkpoint, unless later superseded or contradicted by separate accepted governance evidence.

The accepted binding is current only while all of the following remain exact:

```text
accountRef:
gt63-account:aya:AGY-AYA:USR-ADMIN

accountRevision:
1

principalRef:
gt63-principal:aya-account:AGY-AYA:USR-ADMIN

principalRevision:
1

principalEvidenceRef:
gt63-principal-evidence:aya-account-principal-binding:AGY-AYA:USR-ADMIN:1
```

Currentness also requires that no later accepted governance evidence supersedes or contradicts this binding.

Runtime state, session state, database observation, authentication currentness, or passage of time cannot independently revise, supersede, or contradict this human-governed binding.

## 9. Authentication Currentness Separation

`principalAuthEpoch` remains authentication/currentness evidence only.

The following separations are accepted:

```text
principalAuthEpoch is not accountRevision.

principalAuthEpoch is not principalRevision.

accountRevision does not prove authentication currentness.

principalRevision does not independently prove authentication currentness.
```

`principalAuthEpoch` may contribute authentication/currentness evidence when separately required, but it does not define or revise:

- `accountRef`;
- `accountRevision`;
- `principalRef`;
- `principalRevision`;
- `principalEvidenceRef`;
- the accepted Account-to-Principal Binding Rule.

Authentication currentness does not independently establish principal eligibility, Gate satisfaction, continuation authority, execution authority, effect authority, or offer authority.

## 10. Same Protected Snapshot Requirement

When the accepted binding is used for candidate construction, the following material must come from one protected logical snapshot:

```text
accountRef
accountRevision
principalRef
principalRevision
principalEvidenceRef
principalAuthEpoch/currentness evidence, if used
```

The protected logical snapshot must preserve the exact accepted identity and evidence relationships.

The following are not accepted:

- rereading one field after the protected snapshot;
- replacing one field with later material;
- combining fields from different snapshots;
- mixing cached and current material;
- substituting caller-provided material;
- reconstructing missing values;
- repairing contradictions through fallback logic.

Same-snapshot consistency does not independently establish eligibility, Gate state, execution authority, effect authority, offer authority, or Account→Interaction association.

## 11. Binding #1 Preservation

BINDING #1: PROVEN / CLOSED / UNCHANGED

The accepted Account-to-Principal Binding Rule:

- does not recreate Binding #1;
- does not revise Binding #1;
- does not reopen Binding #1;
- does not weaken Binding #1;
- does not widen Binding #1;
- does not bypass Binding #1;
- does not create a fallback or second principal-binding flow.

Any contradiction with Binding #1 requires STOP.

## 12. Explicit Non-Claims

This checkpoint does not claim, establish, or authorize:

- an Account→Interaction association;
- an Account→Interaction association contract;
- an interaction identity;
- interaction provenance;
- an interaction record or mapping;
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
- test or regression execution;
- runtime, route, server, or UI wiring;
- database or persistence mutation;
- Railway action or deployment;
- login, session, or observation action;
- MACHINE authority;
- any authority effect.

The accepted binding closes only:

```text
canonical account identity
→
exact principal identity
```

It does not close or reach:

```text
principal
→ interaction
→ Gate
→ eligibility
→ effect
```

## 13. Deferred Decisions

The following remain deferred until separately presented and explicitly accepted:

- Account→Interaction association contract;
- interaction identity;
- authoritative Account→Interaction association producer;
- Account→Interaction evidence format and provenance;
- interaction currentness rules;
- exact lifecycle and transition rules for `principalRevision`;
- any general relationship between `accountRevision` and `principalRevision`;
- protected-snapshot implementation;
- runtime composition and construction ownership;
- parsing, validation, canonicalization, and rejection behavior;
- persistence and database representation;
- implementation authorization;
- test and regression authorization;
- deployment authorization;
- eligibility execution;
- Gate action;
- workflow execution;
- continuation or execution authority;
- effect authorization;
- offer mutation.

Deferred decisions must not be inferred from this checkpoint or supplied through fallback behavior.

## 14. STOP Conditions

STOP if:

- the accepted `accountRef` changes;
- the accepted `accountRevision` changes;
- the accepted `principalRef` changes;
- the accepted `principalRevision` changes;
- the accepted `principalEvidenceRef` changes;
- `agencyId` values do not match exactly;
- `applicationUserId` values do not match exactly;
- account and principal material do not come from the same protected logical snapshot;
- any protected-snapshot field is reread, substituted, reconstructed, or mixed with another snapshot;
- `principalAuthEpoch` is treated as `accountRevision`;
- `principalAuthEpoch` is treated as `principalRevision`;
- matching revision numbers are treated as proof of identical revision semantics;
- principal identity or evidence is inferred from runtime state, session state, database observation alone, Gate discovery, caller input, filenames, code, or fixtures;
- later accepted governance evidence contradicts or supersedes the binding;
- Account→Interaction association is inferred, claimed, or introduced;
- interaction identity is inferred, claimed, or introduced;
- Binding #1 would be reopened, changed, duplicated, weakened, widened, or bypassed;
- fallback logic, aliasing, normalization, or a second binding flow is required;
- implementation, testing, runtime, database, Railway, deployment, login, observation, eligibility, Gate, workflow, continuation, effect, or offer action is required;
- MACHINE authority or `authorityEffect` would be widened;
- this checkpoint cannot remain documentation-only.

## 15. Preserved Final States

```text
GT63 AYA ACCOUNT-TO-PRINCIPAL BINDING RULE: ACCEPTED

GT63 AYA CANONICAL ACCOUNT IDENTITY: ACCEPTED

ACCEPTED ACCOUNT INPUT:
accountRef: gt63-account:aya:AGY-AYA:USR-ADMIN
accountRevision: 1

ACCEPTED PRINCIPAL OUTPUT:
principalRef: gt63-principal:aya-account:AGY-AYA:USR-ADMIN
principalRevision: 1

ACCEPTED PRINCIPAL EVIDENCE REFERENCE:
gt63-principal-evidence:aya-account-principal-binding:AGY-AYA:USR-ADMIN:1

DURABLE PRINCIPAL EVIDENCE OBJECT: NOT YET MATERIALIZED

PRINCIPALAUTHEPOCH: AUTHENTICATION/CURRENTNESS EVIDENCE ONLY

ACCOUNT→INTERACTION ASSOCIATION CONTRACT: NOT ACCEPTED

INTERACTION IDENTITY: NOT ACCEPTED

PRINCIPAL ELIGIBILITY: NOT REACHED / NOT ASSESSED

IMPLEMENTATION AUTHORIZED: NO

ELIGIBILITY EXECUTION AUTHORIZED: NO

GATE ACTION AUTHORIZED: NO

CONTINUATION AUTHORITY: NONE

EFFECT AUTHORIZATION: NONE

OFFER MUTATION AUTHORIZED: NO

BINDING #1: PROVEN / CLOSED / UNCHANGED

MACHINE AUTHORITY: NONE

authorityEffect: NONE
```
