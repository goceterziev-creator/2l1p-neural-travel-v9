# GT63 AYA Durable Principal Evidence Object V0 — Materialization Contract Accepted Checkpoint

## 1. Status

```text
GT63 AYA DURABLE PRINCIPAL EVIDENCE OBJECT V0 MATERIALIZATION CONTRACT: ACCEPTED
DURABLE PRINCIPAL EVIDENCE OBJECT: NOT YET MATERIALIZED
MATERIALIZATION AUTHORIZED: NO
REPOSITORY FILE CREATION OR MODIFICATION AUTHORIZED: NO
IMPLEMENTATION AUTHORIZED: NO
MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

This checkpoint records human acceptance of the Durable Principal Evidence Object V0 materialization contract and its minimal closed schema.

This checkpoint:

- accepts the contract;
- accepts the minimal closed schema;
- accepts the exact already-governed binding tuple;
- accepts the boundary between the immutable human governance decision object and future read/use assessments;
- does not materialize a principal evidence object;
- does not create or modify any repository file;
- does not authorize mechanical materialization;
- does not authorize implementation, testing, runtime wiring, deployment, database action or external action;
- does not accept successor revision semantics;
- does not accept Account→Interaction association;
- creates no MACHINE authority;
- has `authorityEffect: NONE`.

## 2. Pinned Git Evidence

Repository:

```text
goceterziev-creator/2l1p-neural-travel-v9
```

Pinned state:

```text
commit:
ed9c3ebd3a4493afeac41bff784a2b849e21eeb9

parent:
854833760a605ea98df6260032b43ab0ba2796ac

tree:
e0d9ac19d30ef8ef651a3e3c44799a7c7f1286b8
```

Accepted Account-to-Principal Binding Rule checkpoint:

```text
path:
docs/gt63-machine/GT63_AYA_ACCOUNT_TO_PRINCIPAL_BINDING_RULE_ACCEPTED_CHECKPOINT_2026-10-05.md

introducing commit:
854833760a605ea98df6260032b43ab0ba2796ac

Git blob:
7083b0a4a769a9f24181a556b7dc4ad96337232a

SHA-256:
768717866aa7165d31f8624f580c16e88fd6e592f24b601594230fe6dc43209d

size:
12,247 bytes
```

Related legacy source objects inspected at the pinned commit:

```text
path:
scripts/gt63-machine/aya-account-principal-binding-v0.js

Git blob:
2b6289155625bb368f6b80d6bb3f8fb5644ef14b

size:
17,431 bytes
```

```text
path:
scripts/gt63-machine/aya-account-principal-binding-v0-regression.js

Git blob:
ccf1fa1fdde9c73eda2ae3b2596f840a7dd9eec1

size:
17,447 bytes
```

The regression file was inspected only as immutable Git content. No regression was executed for this decision.

## 3. Human Governance Decision

Human governance accepts:

```text
GT63 AYA DURABLE PRINCIPAL EVIDENCE OBJECT V0 MATERIALIZATION CONTRACT: ACCEPTED
```

The accepted V0 object role is:

```text
immutable materialization of the accepted human governance decision
```

The object is not:

- a runtime snapshot;
- a currentness assessment;
- a supersession assessment;
- a contradiction assessment;
- an authentication-currentness record;
- a candidate-construction envelope;
- a runtime authority object;
- an Account→Interaction association object;
- an implementation authorization.

## 4. Accepted Binding Tuple

The V0 contract preserves exactly:

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

The accepted identity atoms are:

```text
agencyId:
AGY-AYA

applicationUserId:
USR-ADMIN
```

The following exact equality requirements apply:

```text
agencyId(account) == agencyId(principal) == AGY-AYA

applicationUserId(account) ==
applicationUserId(principal) ==
USR-ADMIN
```

No normalization, aliasing, fallback, inference, reconstruction or runtime substitution is accepted.

## 5. Accepted Minimal Closed Schema

The accepted schema is:

```json
{
  "type": "GT63_AYA_DURABLE_PRINCIPAL_EVIDENCE_OBJECT",
  "schemaVersion": 1,

  "decision": "ACCEPTED",

  "principalEvidenceRef": "gt63-principal-evidence:aya-account-principal-binding:AGY-AYA:USR-ADMIN:1",

  "accountRef": "gt63-account:aya:AGY-AYA:USR-ADMIN",
  "accountRevision": 1,

  "principalRef": "gt63-principal:aya-account:AGY-AYA:USR-ADMIN",
  "principalRevision": 1,

  "identityAtoms": {
    "agencyId": "AGY-AYA",
    "applicationUserId": "USR-ADMIN"
  },

  "authoritativeProducer": "EXPLICIT_HUMAN_GOVERNANCE_DECISION",

  "checkpointProvenance": {
    "repository": "goceterziev-creator/2l1p-neural-travel-v9",
    "path": "docs/gt63-machine/GT63_AYA_ACCOUNT_TO_PRINCIPAL_BINDING_RULE_ACCEPTED_CHECKPOINT_2026-10-05.md",
    "commit": "854833760a605ea98df6260032b43ab0ba2796ac",
    "blob": "7083b0a4a769a9f24181a556b7dc4ad96337232a",
    "sha256": "768717866aa7165d31f8624f580c16e88fd6e592f24b601594230fe6dc43209d"
  },

  "nonClaims": {
    "protectedSnapshotProven": false,
    "currentnessAssessed": false,
    "durableInteractionEvidenceMaterialized": false,
    "accountInteractionAssociationAccepted": false,
    "principalInteractionAssociationAccepted": false,
    "eligibilityExecutionAuthorized": false,
    "gateActionAuthorized": false,
    "offerMutationAuthorized": false,
    "implementationAuthorized": false,
    "machineAuthorityCreated": false
  },

  "authority": "NONE",
  "authorityEffect": "NONE"
}
```

## 6. Accepted Closed-Schema Rules

The following schema rules are accepted:

1. Every field shown in the schema is mandatory.

2. No additional top-level or nested properties are permitted.

3. Every nested object is closed.

4. `schemaVersion`, `accountRevision` and `principalRevision` are integers.

5. `schemaVersion` must equal:

   ```text
   1
   ```

6. `accountRevision` must equal:

   ```text
   1
   ```

7. `principalRevision` must equal:

   ```text
   1
   ```

8. Every string-valued identity field must match its accepted value exactly.

9. Every `nonClaims` boolean must be present and must equal `false`.

10. `authority` must equal:

    ```text
    NONE
    ```

11. `authorityEffect` must equal:

    ```text
    NONE
    ```

12. Unknown, missing, substituted, normalized, inferred or reconstructed fields invalidate conformance to this contract.

## 7. Accepted Authoritative Producer

The accepted authoritative producer is:

```text
EXPLICIT_HUMAN_GOVERNANCE_DECISION
```

The authoritative producer is not:

- a runtime process;
- a database record;
- a session;
- caller input;
- `principalAuthEpoch`;
- Gate discovery;
- eligibility output;
- an offer;
- a model inference;
- filename inference;
- source-code presence;
- regression output;
- a mechanical materializer.

Mechanical materialization, if separately authorized later, may only preserve the already accepted human governance decision.

Mechanical materialization does not issue the decision and does not create governance authority.

## 8. Mechanical Materialization Boundary

This checkpoint does not authorize mechanical materialization.

The immutable human decision object does not include:

- `materializerRef`;
- `materializedAt`;
- repository output path;
- output Git blob;
- output SHA-256;
- output size;
- materialization commit.

Those values describe a future materialization event rather than the accepted governance decision.

If materialization is separately authorized, its report may record those values outside the immutable human decision object.

```text
MATERIALIZATION AUTHORIZED: NO
DURABLE PRINCIPAL EVIDENCE OBJECT: NOT YET MATERIALIZED
```

## 9. Content Identity

The accepted V0 schema does not require:

- RFC 8785 canonicalization;
- an embedded `contentDigest`;
- an embedded `valueSetIntegrity` object;
- a self-referential digest construction.

If the object is later materialized in Git under separate authorization:

- its Git blob will identify its exact repository bytes;
- a separately reported SHA-256 may provide repository-independent byte identity;
- its file size may be reported as additional materialization evidence.

Git blob identity and SHA-256 prove exact byte content.

They do not prove:

- human issuance beyond the checkpoint provenance;
- currentness;
- authoritative corpus completeness;
- protected-snapshot provenance;
- runtime use;
- implementation authorization;
- authority.

## 10. Currentness, Supersession and Contradiction

Currentness, supersession and contradiction are not stored as mutable or historical assessment fields in the immutable human decision object.

The accepted checkpoint states the governance rule:

> The binding is current only for the exact `accountRef`/`accountRevision` and `principalRef`/`principalRevision` accepted in the checkpoint, unless later superseded or contradicted by separate accepted governance evidence.

The immutable object preserves that accepted decision through its exact checkpoint provenance.

A concrete currentness result must be evaluated separately at read/use against an authoritative governance corpus.

Until the authoritative corpus, evaluation boundary and evaluator contract are separately accepted, the fail-closed read/use result is:

```text
UNKNOWN_CURRENTNESS
```

`UNKNOWN_CURRENTNESS` is not stored as a state in the immutable decision object.

If a future assessment is preserved, it must be a separate immutable assessment artifact. It must not mutate the durable human decision object.

This contract does not accept:

- an authoritative currentness corpus;
- a supersession corpus;
- a contradiction corpus;
- a currentness evaluator;
- a supersession evidence type;
- a contradiction evidence type;
- a successor revision rule.

## 11. Protected Logical Snapshot Boundary

The immutable human governance decision object is distinct from the protected logical snapshot required for future candidate construction.

The accepted checkpoint requires a protected logical snapshot only:

```text
when the accepted binding is used for candidate construction
```

At that future boundary, the following must come from one protected logical snapshot:

```text
accountRef
accountRevision
principalRef
principalRevision
principalEvidenceRef
principalAuthEpoch/currentness evidence, if used
```

This materialization contract does not claim that the immutable human decision object proves such a snapshot.

Accordingly, the schema preserves:

```json
"protectedSnapshotProven": false
```

A digest of serialized values could prove only that those exact serialized values produced that digest.

A digest cannot prove:

- a single atomic read;
- a common transaction;
- a common protected snapshot;
- absence of reread;
- absence of mixed-snapshot substitution;
- producer authority.

The following remain deferred:

- protected-snapshot producer;
- snapshot boundary;
- snapshot identifier;
- atomicity mechanism;
- snapshot evidence format;
- candidate-construction envelope;
- protected-snapshot validation procedure.

## 12. Successor Revision Boundary

This contract preserves only:

```text
accountRevision: 1
principalRevision: 1
```

This contract does not accept:

- the value of any successor `accountRevision`;
- the value of any successor `principalRevision`;
- sequential revision allocation;
- timestamp-derived revisions;
- database-sequence-derived revisions;
- Git-history-derived revisions;
- a general relationship between account and principal revision numbers.

```text
SUCCESSOR REVISION SEMANTICS: NOT ACCEPTED
```

## 13. Legacy Source Boundary

The existing legacy source is not accepted as the materialized V0 object contract.

Material incompatibilities include:

```text
legacy type:
GT63_AYA_ACCOUNT_PRINCIPAL_BINDING_EVIDENCE

accepted V0 contract type:
GT63_AYA_DURABLE_PRINCIPAL_EVIDENCE_OBJECT
```

```text
legacy principalRevision:
aya-principal-binding-revision:1

accepted principalRevision:
1
```

```text
legacy reference:
gt63-principal-binding-evidence:aya-account:<digest>

accepted principalEvidenceRef:
gt63-principal-evidence:aya-account-principal-binding:AGY-AYA:USR-ADMIN:1
```

The legacy record also lacks the exact accepted `accountRef`, `accountRevision` and checkpoint provenance required by this contract.

The legacy source may not be treated as conforming, materialized, authoritative or implementation-ready without a separate human decision and separate implementation authorization.

## 14. Explicit Non-Claims

This checkpoint does not claim, establish or authorize:

- a materialized durable principal evidence object;
- a materialized durable interaction evidence object;
- protected-snapshot proof;
- currentness assessment;
- a current binding result at read/use;
- supersession assessment;
- contradiction assessment;
- successor revision semantics;
- Account→Interaction association;
- Principal→Interaction association;
- interaction currentness;
- eligibility execution;
- Gate action;
- workflow execution;
- continuation authority;
- effect authorization;
- offer creation or mutation;
- repository file creation or modification;
- source implementation;
- tests;
- runtime wiring;
- deployment;
- database action;
- Railway action;
- login or observation;
- MACHINE authority;
- any authority effect.

## 15. Deferred Decisions

The following remain deferred and require separate human decisions:

- durable object materialization authorization;
- output path and file format;
- mechanical materializer identity;
- materialization report;
- currentness corpus;
- supersession corpus;
- contradiction corpus;
- read/use evaluator contract;
- assessment artifact schema;
- protected-snapshot producer;
- protected-snapshot evidence contract;
- candidate-construction envelope;
- successor revision semantics;
- supersession evidence type and reference;
- contradiction evidence type and reference;
- implementation;
- testing;
- runtime integration.

## 16. STOP Conditions

STOP if:

- any accepted binding value is changed;
- any identity atom fails exact equality;
- an additional schema field is introduced without separate acceptance;
- a required schema field is omitted;
- runtime, database, session, caller, Gate, eligibility or offer material is used as authoritative producer;
- a digest is presented as proof of protected-snapshot provenance;
- currentness is stored or inferred without the separately accepted evaluator and authoritative corpus;
- successor revision semantics are inferred;
- the legacy source is treated as automatically conforming;
- Account→Interaction association is inferred or introduced;
- implementation or materialization is attempted without separate authorization;
- MACHINE authority or `authorityEffect` is widened.

## 17. Preserved Final States

```text
GT63 AYA DURABLE PRINCIPAL EVIDENCE OBJECT V0 MATERIALIZATION CONTRACT: ACCEPTED

DURABLE PRINCIPAL EVIDENCE OBJECT: NOT YET MATERIALIZED

DURABLE INTERACTION EVIDENCE OBJECT: NOT MATERIALIZED

SUCCESSOR REVISION SEMANTICS: NOT ACCEPTED

ACCOUNT→INTERACTION ASSOCIATION CONTRACT: NOT ACCEPTED

MATERIALIZATION AUTHORIZED: NO

REPOSITORY FILE CREATION OR MODIFICATION AUTHORIZED: NO

IMPLEMENTATION AUTHORIZED: NO

MACHINE AUTHORITY: NONE

authorityEffect: NONE
```

STOP
