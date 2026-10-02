# GT63 × AYA — Admission V0 accepted-design checkpoint — 2026-10-02

## Human decision and authority boundary

Goce explicitly confirmed acceptance in this conversation on 2026-10-02 (message time 14:36:43 Europe/Sofia).
Accepted target: **GT63 × AYA — AUTHENTICATED PRINCIPAL COMPOSITION / ADMISSION CONTRACT V0 — CONSOLIDATED PROPOSAL**, exact normative-field-mapping version provided at 14:33 Europe/Sofia; **32/32 human-acceptance decisions ACCEPTED**.
Source baseline reported by Goshko: `bd5bae5f7ba9117f6a62684dca5d4a029a8ba933`.

Acceptance covers the normative rules, mappings, types, revision domains, exact digest material, serialization, fail-closed classifications, lifetime and snapshot boundaries of the final attached proposal.
The original attached proposal retains its historical NOT ACCEPTED status verbatim below; the later explicit human decision supersedes that proposal status only. It does not rewrite the original bytes or authorize implementation.

DESIGN CONTRACT: ACCEPTED
IMPLEMENTATION AUTHORIZED: NO
PROVIDER-FREE VERIFICATION AUTHORIZED: NO
RUNTIME WIRING AUTHORIZED: NO
DEPLOYMENT AUTHORIZED: NO
RUNTIME AUTHENTICATED-PRINCIPAL EVIDENCE: NOT CREATED
PRINCIPAL ELIGIBILITY: NOT REACHED; NOT ASSESSED
BINDING #1: PROVEN AND CLOSED (based on supplied runtime witness; not freshly re-observed here)
MACHINE AUTHORITY: NONE
authorityEffect: NONE

Explicitly accepted limitation: freshness is enforced by the conforming producer and trusted wiring. The unchanged consumer cannot independently identify stale output returned by a non-conforming port.

## Preservation authorization

Goce subsequently instructed: “да запазим  и запишем висчко и навсякъде”. This authorizes documentation/archive preservation and continuity updates for this checkpoint. It does not authorize admission code, tests, runtime wiring, deployment, DB mutation, login, new principal binding, eligibility, role, delegation, human gate, governance package, effect authorization or offer mutation.

## Established design

- One authoritative DB snapshot per admission invocation, shared by account and binding.
- Private snapshot-bound read-only binding view; no write or commit capability.
- Principal identity and principalRevision from validated durable binding; authentication epoch remains a distinct domain.
- Fresh live assessment for each port invocation; no cache or reuse across evaluations.
- Derived ephemeral evidence, no persistence; validity limited to enclosing synchronous consumer evaluation.
- Distinct deterministic principalEvidenceRef; exact mapped material and upstream references; no Unicode normalization or admission-level coercion.
- Verbatim bindingRef → authEventSessionBindingRef; precise component-state mappings distinct from admission output state constants.
- Validated auth-event/session binding accepted as minimum A-class provenance; contextScope query-only.
- Complete evidence only on ACCEPTED; all other outcomes yield null with internal diagnostic distinctions preserved.

## Proposed next scope — NOT AUTHORIZED

Only for a future explicit decision:
1. `scripts/gt63-machine/aya-authenticated-principal-admission-v0.js`
2. `scripts/gt63-machine/aya-authenticated-principal-admission-v0-regression.js`

Provider-free verification would use in-memory snapshots, instrumented read count, a writer that throws, process-local binding fixtures and deterministic clock; no network, login, Railway, filesystem DB or listener.
Reviewer recommendation (not a new accepted requirement): the successful verification path should exercise existing real validation modules with in-memory fixtures; a premanufactured ACCEPTED result alone is insufficient proof of composition.
No server.js wiring, consumer modification, migration, persistence, binding change, deployment or eligibility assessment is included.
STOP: preserve accepted design; await separate bounded implementation/verification authorization.

## Evidence provenance and source manifest

All six supplied files are preserved in chronological order below. Their reports of remote source inspection are Goshko-supplied evidence, not independent Git/runtime verification by the preserving assistant. Historical proposals are not treated as accepted unless covered by the final human decision. Earlier provisional mappings are superseded by the final accepted mapping version.

- `Pasted text(20261002-064101).txt` — 10880 bytes — SHA-256 `70a4cca62105d0dde6d870200fa60d3eb56d25b966a135c10b3958f6ebdd9dbc`
- `Pasted text(20261002-070557).txt` — 12663 bytes — SHA-256 `97d21932c2c20330990c295d19e011374c6f161bbd5d856fa899a546934a4117`
- `Pasted text(20261002-075210).txt` — 20990 bytes — SHA-256 `63936a3f4e5d52a5856b5e25d40545f6e2fff97bfcdc1cb8770c31fec953d89e`
- `Pasted text(20261002-081749).txt` — 20148 bytes — SHA-256 `8f290923f759eea3af8d57093bc50612930bf2dabb499b7debf68e27a8d01eeb`
- `Pasted text(20261002-112520).txt` — 33831 bytes — SHA-256 `0d2ef64bf502cd60f1656e670b3417ac0cf2a875463f18e2518ad53425cc7735`
- `Pasted text(20261002-113318).txt` — 36705 bytes — SHA-256 `3d76f56846acc548d3b76b7577c1dd360045468092fca26867397cefeeaf2a2e`


---

## Source attachment: Pasted text(20261002-064101).txt

Гошко,

затваряме успешно:

GT63 × AYA — REAL APPLICATION ACCOUNT → GT63 PRINCIPAL BINDING #1

MODE:
READ-ONLY CAUSAL DISCOVERY

MACHINE AUTHORITY: NONE
authorityEffect: NONE

============================================================
NEW AUTHORITATIVE RUNTIME WITNESS
============================================================

Authoritative staging DB:

/data/gt63/database.json

Read-only inspection returned:

{
  "status": "READ_ONLY_BINDING_WITNESS",
  "dbFile": "/data/gt63/database.json",
  "exactEvidenceRefMatches": 1,
  "evidenceType": "GT63_AYA_ACCOUNT_PRINCIPAL_BINDING_EVIDENCE",
  "representationRevision": 1,
  "principalBindingEvidenceRef":
    "gt63-principal-binding-evidence:aya-account:73ccf85e7f4c1bd6e86ceea024dc338f62b66b3e64a85898d0a8cab915d423f1",
  "humanBindingDecisionEvidenceRef":
    "gt63-human-decision:aya-account-principal-binding:6e1951163efa7048bc33fccffbd70ebcfcf3abc3dfaa16ab2d49490870367ead",
  "agencyId": "AGY-AYA",
  "applicationUserId": "USR-ADMIN",
  "principalRef":
    "gt63-principal:aya-account:AGY-AYA:USR-ADMIN",
  "principalRevision":
    "aya-principal-binding-revision:1",
  "bindingLifecycleState": "CURRENT",
  "bindingFreshnessState": "CURRENT",
  "contradictionState": "NONE",
  "authority": "NONE",
  "authorityEffect": "NONE",
  "downstreamNonAuthority": {
    "principalEligibilityCreated": false,
    "roleCreated": false,
    "delegationCreated": false,
    "humanGateCreated": false,
    "governancePackageCreated": false,
    "effectAuthorizationCreated": false,
    "offerMutationPerformed": false
  }
}

Immediately before this, corrected materialization preflight returned:

status = ALREADY_ACCEPTED
mutationPerformed = false
targetAccountCount = 1
principalAuthEpoch = 1
targetBindingMatches = 1

Therefore classify:

REAL AYA APPLICATION ACCOUNT → GT63 PRINCIPAL BINDING #1
= PROVEN

Do NOT reopen materialization.

============================================================
ALREADY PROVEN UPSTREAM
============================================================

Real normal human password login previously proved:

fresh login
→ A-class authentication evidence
→ auth-event/session binding ACCEPTED
→ principalAuthEpoch observed = 1
→ current principalAuthEpoch = 1
→ principalAuthEpochCurrentness = CURRENT
→ AYA_LIVE_GT63_PRINCIPAL_SOURCE_ASSESSMENT
→ sourceMaterialProduced = true

Known live source material includes:

applicationUserId = USR-ADMIN
agencyId = AGY-AYA
sessionRef
sessionVersion
authenticationEventIdentity
aClassEvidenceIdentity
aClassEvidenceRevision
bindingRef
observedPrincipalAuthEpoch = 1
currentPrincipalAuthEpoch = 1
lifecycleState = CURRENT
freshnessState = CURRENT
contradictionState = NONE
authority = NONE
authorityEffect = NONE

And now independently proven durable binding adds:

principalRef =
  gt63-principal:aya-account:AGY-AYA:USR-ADMIN

principalRevision =
  aya-principal-binding-revision:1

principalBindingEvidenceRef =
  gt63-principal-binding-evidence:aya-account:
  73ccf85e7f4c1bd6e86ceea024dc338f62b66b3e64a85898d0a8cab915d423f1

binding lifecycle = CURRENT
binding freshness = CURRENT
contradiction = NONE

============================================================
CAUSAL QUESTION
============================================================

Do NOT assume PRINCIPAL ELIGIBILITY is immediately next.

Determine the exact first still-unproven prerequisite after the now
PROVEN durable principal binding.

Specifically inspect whether current authoritative GT63 contracts
already provide a legitimate composition/admission path:

LIVE AYA AUTHENTICATED PRINCIPAL SOURCE MATERIAL
+
CURRENT DURABLE AYA ACCOUNT → GT63 PRINCIPAL BINDING
        ↓
GT63 AUTHENTICATED PRINCIPAL EVIDENCE
        ↓
PRINCIPAL ELIGIBILITY

The key question is:

Can the two already-proven evidence surfaces legitimately compose into
the authenticated-principal evidence shape required by the existing
eligibility contracts?

Or is a separate authenticated-principal evidence
composition/admission boundary still missing?

============================================================
INSPECT AUTHORITATIVE SOURCE
============================================================

At current authoritative main, inspect at minimum:

- aya-live-principal-boundary-v0.js
- aya-account-principal-binding-v0.js
- governance-principal-eligibility-assessment.js
- governance-principal-eligibility-composition.js
- authenticated-governance-authorization-binding.js
- accepted-governance-role-evidence.js

and any directly relevant authenticated-principal
producer/admission/composition modules found by source archaeology.

Do not infer compatibility from naming.

Trace exact shapes and exact semantics.

============================================================
ANSWER
============================================================

A. EXACT ELIGIBILITY AUTHENTICATED-PRINCIPAL INPUT SHAPE

List every field required by the actual current consumer.

Especially determine exact semantics for:

principalRef
principalRevision
principalEvidenceRef
lifecycleState
freshnessState
contradictionState
authority

and any additional provenance/currentness fields.

------------------------------------------------------------

B. PROVEN SOURCE-SIDE MATERIAL

Identify exactly which required fields can now be sourced from the
already-proven LIVE AYA principal source material.

Do not upgrade source material into accepted evidence merely because
the values exist.

------------------------------------------------------------

C. PROVEN DURABLE-BINDING MATERIAL

Identify exactly which required fields can now be sourced from the
PROVEN durable binding record.

Keep distinct:

principalBindingEvidenceRef
vs
principalEvidenceRef

unless authoritative source explicitly proves they are semantically
interchangeable.

------------------------------------------------------------

D. COMPOSITION / ADMISSION CONTRACT

Determine whether an existing current-source contract explicitly
authorizes:

accepted live authentication source
+
accepted current durable principal binding
→
accepted/current GT63 authenticated-principal evidence

Classification:

PROVEN
PARTIAL
ABSENT
UNKNOWN

Give exact source evidence.

------------------------------------------------------------

E. principalEvidenceRef SEMANTICS

This is critical.

Determine exactly what principalEvidenceRef means in the current
authenticated-principal consumers.

Answer:

1. Can principalBindingEvidenceRef legitimately serve directly as
   principalEvidenceRef?

2. Must authenticated-principal evidence have a distinct evidence
   identity?

3. If distinct, does a canonical identity rule already exist?

4. Who/what is allowed to produce/admit it?

5. Does it need durable persistence, process-local evidence, or can it
   be a derived current evidence view?

Do not invent semantics.

------------------------------------------------------------

F. CURRENTNESS COMPOSITION

Determine how currentness must compose across:

principal binding currentness
principalAuthEpoch currentness
session currentness
A-class evidence currentness
account currentness

Answer whether all are independently required at authenticated
principal admission time.

Preserve:

PRINCIPAL BINDING CURRENTNESS
≠
AUTHENTICATION CURRENTNESS

unless source explicitly says otherwise.

------------------------------------------------------------

G. CONTRADICTION / FAIL-CLOSED BEHAVIOR

Determine what happens if:

- live source is accepted but durable binding is missing;
- binding exists but auth epoch mismatches;
- binding CURRENT but session stale;
- principalRef mismatches binding;
- principalRevision mismatches binding;
- account subject mismatches binding;
- principalEvidenceRef unavailable;
- either evidence surface is UNKNOWN.

UNKNOWN must not become REJECTED without positive mismatch evidence.

------------------------------------------------------------

H. CONTRACT COMPATIBILITY

Classify the now-proven pair:

LIVE AYA AUTHENTICATED PRINCIPAL SOURCE MATERIAL
+
CURRENT DURABLE AYA PRINCIPAL BINDING

against the existing authenticated-principal consumer contract:

PROVEN
PARTIAL
ABSENT
UNKNOWN

Explain exactly why.

------------------------------------------------------------

I. FIRST STILL-UNPROVEN PREREQUISITE

Name exactly ONE first causal blocker.

Do not list a roadmap.

We need the first boundary where evidence stops.

------------------------------------------------------------

J. MINIMUM NEXT CAUSAL INTERVENTION

Only if justified by source evidence, identify the smallest next step.

Examples:

- existing composition only needs live wiring;
- missing read-only composition adapter;
- missing authenticated-principal admission contract;
- missing evidence identity semantics;
- another prerequisite discovered by source.

Do NOT implement it.

------------------------------------------------------------

K. PRINCIPAL ELIGIBILITY STATUS

Classify:

REACHED
NOT REACHED
BLOCKED
UNKNOWN

Do not perform eligibility assessment.

Do not create role requirement/assignment/delegation evidence.

------------------------------------------------------------

L. EXACT STOP CONDITION

State precisely where the causal proof currently ends.

------------------------------------------------------------

M. AUTHORITY REPORT

MACHINE AUTHORITY: NONE
authorityEffect: NONE

Confirm no new:

eligibility
role
delegation
human gate
governance package
effect authorization
offer mutation

was created or inferred.

============================================================
STRICT BOUNDARIES
============================================================

READ ONLY.

NO:

- implementation;
- file modification;
- commit;
- push;
- deploy;
- Railway mutation;
- DB mutation;
- login;
- new human decision;
- new principal binding;
- eligibility creation;
- role creation;
- delegation creation;
- human gate authorization;
- governance package;
- effect authorization;
- offer mutation.

Do not reopen the already-proven binding materialization.

Do not fabricate principalEvidenceRef.

Do not equate:
  principalBindingEvidenceRef = principalEvidenceRef
unless authoritative current source explicitly proves that equivalence.

Do not collapse UNKNOWN into ABSENT or REJECTED.

The objective is only:

FIND THE FIRST STILL-UNPROVEN CAUSAL PREREQUISITE
AFTER REAL AYA PRINCIPAL BINDING #1.

STOP there.

MACHINE AUTHORITY: NONE
authorityEffect: NONE

---

## Source attachment: Pasted text(20261002-070557).txt

## Verdict

At authoritative `main` `bd5bae5f7ba9117f6a62684dca5d4a029a8ba933` (tree `b8e93be7…`, commit “Add AYA account principal binding contract”), the first still-unproven prerequisite is:

> **No authoritative AYA authenticated-principal composition/admission contract currently combines the accepted live authentication source material with the current durable principal binding and emits the authenticated-principal evidence shape required by eligibility.**

Binding materialization remains **PROVEN and closed**. It was not reopened.

### A. Exact eligibility authenticated-principal input shape

`authenticatedPrincipalPort` is queried with:

- `principalRef`
- `principalRevision`
- `contextScope`

Its returned object must contain:

- `principalRef` — exactly equal to the request
- `principalRevision` — exactly equal to the request
- `principalEvidenceRef` — non-empty string
- `lifecycleState = "CURRENT"`
- `freshnessState = "CURRENT"`
- `contradictionState = "NONE"`
- `authority = "NONE"`

No exact-field restriction is imposed on this returned object; additional fields are permitted. The consumer does **not** itself require session, account, A-class, epoch, binding, producer identity, persistence, or provenance fields. It trusts the injected port to have established those semantics. If the shape is absent, invalid, mismatched, or non-current, the result is `UNKNOWN`, not `NOT_ELIGIBLE`. [Eligibility assessment, lines 14–30](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/governance-principal-eligibility-assessment.js#L14-L30)

### B. Proven source-side material

The accepted live AYA source material proves:

- `bindingRef`
- `authenticationEventIdentity`
- `aClassEvidenceIdentity`
- `aClassEvidenceRevision`
- `applicationUserId`
- `agencyId`
- `sessionRef`
- `sessionVersion`
- `observedPrincipalAuthEpochState`
- `observedPrincipalAuthEpoch`
- `observedPrincipalRevision`
- `currentPrincipalAuthEpoch`
- `currentPrincipalRevision`
- `lifecycleState`
- `freshnessState`
- `contradictionState`
- `authority = "NONE"`
- `authorityEffect = "NONE"`

It does **not** produce:

- `principalRef`
- a field named `principalRevision`
- `principalEvidenceRef`
- accepted GT63 principal evidence

Its `currentPrincipalRevision` is epoch-derived, e.g. `principalAuthEpoch:1`; it cannot autonomously be renamed or promoted into the eligibility contract’s `principalRevision`. [Live boundary, lines 65–104](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-live-principal-boundary-v0.js#L65-L104)

### C. Proven durable-binding material

The durable binding proves:

- `agencyId`
- `applicationUserId`
- canonical `principalRef`
- `principalRevision = "aya-principal-binding-revision:1"`
- `principalBindingEvidenceRef`
- `bindingLifecycleState = "CURRENT"`
- `bindingFreshnessState = "CURRENT"`
- `contradictionState = "NONE"`
- `authority = "NONE"`
- `authorityEffect = "NONE"`
- provenance through `humanBindingDecisionEvidenceRef`

It does not produce a field named `principalEvidenceRef`, authentication/session currentness, or accepted authenticated-principal evidence. Its lifecycle fields also describe the **binding**, not the authenticated principal. [Binding record, lines 180–208](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-account-principal-binding-v0.js#L180-L208)

`principalBindingEvidenceRef` is a digest identity for the durable binding record and decision material. [Binding identity, lines 106–126](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-account-principal-binding-v0.js#L106-L126)

### D. Composition/admission contract

**Classification: ABSENT**

Exact evidence:

- `governance-principal-eligibility-composition.js` merely accepts an externally supplied `authenticatedPrincipalPort`; it does not construct one or combine AYA evidence. [Composition, lines 4–18](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/governance-principal-eligibility-composition.js#L4-L18)
- `server.js` invokes only the live principal boundary and places its result in `req.gt63PrincipalAssessment`. [Runtime wiring, lines 641–658](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/server.js#L641-L658)
- That assessment is exposed as observational response material; it is not admitted through an authenticated-principal port. [Runtime response, lines 8486–8514](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/server.js#L8486-L8514)
- Exact-tree inspection found `principalBindingEvidenceRef` only in the durable-binding contract and its regression, not in an authenticated-principal producer or runtime adapter.
- `server.js` does not import the durable binding contract.

Therefore:

```text
accepted live source
+ accepted durable binding
→ accepted/current authenticated principal evidence
```

is not an implemented or authorized transition.

### E. `principalEvidenceRef` semantics

1. **Can `principalBindingEvidenceRef` serve directly?**  
   **Not proven.** No current source maps or declares them interchangeable.

2. **Must authenticated-principal evidence have a distinct evidence identity?**  
   A non-empty field named `principalEvidenceRef` is mandatory. Whether its value must be lexically distinct from `principalBindingEvidenceRef` is **UNKNOWN**: the consumer neither enforces inequality nor authorizes equality.

3. **Canonical AYA identity rule?**  
   **ABSENT.** Canonical rules exist for the binding identity, not for composed AYA authenticated-principal evidence.

4. **Authorized producer/admitter?**  
   The eligibility code recognizes only the injected `authenticatedPrincipalPort`. No AYA implementation of that port exists at this SHA.

5. **Durable, process-local, or derived view?**  
   **UNKNOWN.** The consumer only validates the returned shape. Existing GitHub identity work demonstrates that some other principal evidence can be process-local, but that does not authorize the same semantics for AYA. No AYA persistence/view rule exists.

The downstream authorization binding repeats the same principal shape and copies `principalEvidenceRef`; it does not define its production semantics. [Authorization binding, lines 131–139](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/authenticated-governance-authorization-binding.js#L131-L139)

### F. Currentness composition

The layers remain distinct:

- **Authentication currentness:** current authenticated request, unexpired session, exact session material, current user/agency/session version, current matching `principalAuthEpoch`.
- **Binding currentness:** binding lifecycle and freshness are `CURRENT`, contradiction is `NONE`, and binding identity validates.
- **Account continuity:** checked while building binding evidence; it is not independently re-read by the eligibility consumer.
- **A-class evidence:** validated when the auth-event/session binding is created.
- **Eligibility principal currentness:** only the final principal view’s `CURRENT/CURRENT/NONE` fields are inspected.

The auth-event/session boundary explicitly checks session expiry and epoch match before emitting source material. [Auth/session assessment, lines 240–314](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-auth-event-session-binding-v0.js#L240-L314)

Whether **all five surfaces must be independently revalidated at authenticated-principal admission time is UNKNOWN**, because that admission contract does not exist.

```text
PRINCIPAL BINDING CURRENTNESS
≠
AUTHENTICATION CURRENTNESS
```

### G. Contradiction/fail-closed behavior

| Condition | Exact current behavior |
|---|---|
| Live source accepted; binding missing | No composition outcome exists. An unavailable authenticated-principal port would make eligibility return `UNKNOWN`. |
| Binding exists; epoch mismatches | Positive epoch mismatch is `REJECTED` at auth/session binding; live boundary reports epoch `MISMATCH` and produces no source material. |
| Binding current; session stale/expired | Positive expiry is `REJECTED` at the authentication boundary; binding currentness does not override it. |
| Binding record’s `principalRef` mismatches its account subject | `CONTRADICTED`. |
| Binding record’s `principalRevision` mismatches the canonical initial revision | `CONTRADICTED`. |
| Live-source principal revision and binding revision differ | No comparison/selection rule exists; therefore `UNKNOWN`, not contradiction. |
| Account subject mismatches binding during creation | `CONTRADICTED`. |
| Live request user/agency mismatches authenticated session/current DB user | `REJECTED` because this is positive mismatch evidence. |
| `principalEvidenceRef` unavailable | Eligibility returns `UNKNOWN`. |
| Either evidence surface is `UNKNOWN` | No valid authenticated-principal evidence can be admitted; the nearest existing consumer behavior is `UNKNOWN`. |

Binding validation’s positive mismatch and unknown-currentness distinctions are explicit. [Binding validation, lines 211–239](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-account-principal-binding-v0.js#L211-L239)

### H. Contract compatibility

**Classification: PARTIAL**

The pair supplies much of the raw material:

- durable canonical `principalRef`;
- two independently meaningful revision values;
- currentness/contradiction states for both layers;
- authentication, session, account, and binding provenance.

But it does not supply an admitted authenticated-principal object because:

- `principalEvidenceRef` is missing;
- no identity rule exists;
- no rule chooses or composes `principalAuthEpoch:1` versus `aya-principal-binding-revision:1`;
- binding and authentication currentness are not composed;
- no authorized AYA `authenticatedPrincipalPort` exists.

Thus the materials are partially compatible at the value level but not contract-compatible as accepted evidence.

### I. First still-unproven prerequisite

Exactly one blocker:

> **Missing authoritative AYA authenticated-principal composition/admission contract, including canonical `principalRevision` and `principalEvidenceRef` semantics.**

Evidence stops before authenticated-principal admission—not at principal eligibility.

### J. Minimum next causal intervention

The smallest justified next step is:

> **Define and accept one read-only AYA authenticated-principal admission contract that validates both proven surfaces and specifies the emitted principal identity, revision, evidence identity, provenance, and composed currentness.**

No implementation or wiring was performed. Selection of those semantics remains a human decision.

### K. Principal eligibility status

**BLOCKED**

Blocked on authenticated-principal admission. Eligibility was not assessed.

### L. Exact stop condition

```text
LIVE AYA AUTHENTICATED PRINCIPAL SOURCE MATERIAL       PROVEN
CURRENT DURABLE AYA ACCOUNT → PRINCIPAL BINDING       PROVEN
                                                        │
                                                        ▼
AYA AUTHENTICATED-PRINCIPAL COMPOSITION / ADMISSION    NOT PROVEN
                                                        │
                                                        ▼
PRINCIPAL ELIGIBILITY                                  NOT REACHED
```

### M. Authority report

```text
MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

This inspection created or inferred no new:

- eligibility
- role
- delegation
- human gate
- governance package
- effect authorization
- offer mutation

No files, repository state, database state, Railway state, sessions, bindings, commits, branches, or deployments were modified. No regression was represented as freshly executed; this was exact committed-source inspection of current remote `main`.

---

## Source attachment: Pasted text(20261002-075210).txt

# GT63 × AYA — AUTHENTICATED PRINCIPAL COMPOSITION / ADMISSION CONTRACT V0

```text
MODE: READ-ONLY SOURCE INSPECTION + DESIGN PROPOSAL
MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

## Current authoritative source

Verified `origin/main`:

```text
bd5bae5f7ba9117f6a62684dca5d4a029a8ba933
```

This is the same SHA as the previous report. No intervening relevant source change exists. The commit remains [“Add AYA account principal binding contract”](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/commit/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933).

The proposal below is not an accepted contract, runtime evidence, implementation, or authority.

---

## 1. Exact inputs and output

### ESTABLISHED BY CURRENT SOURCE

The current live boundary can freshly produce:

```text
AYA_LIVE_GT63_PRINCIPAL_SOURCE_ASSESSMENT
bindingAssessment = ACCEPTED
principalAuthEpochCurrentness = CURRENT
sourceMaterialProduced = true
authenticatedPrincipalSourceMaterial = {...}
authority = NONE
authorityEffect = NONE
```

The source material contains authenticated request, session, A-class and epoch provenance, but does not create an accepted GT63 principal. [Live boundary](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-live-principal-boundary-v0.js#L36-L54)

The durable binding ledger can return an accepted, validated envelope and record through `get(ref)` or locate the one current subject binding through `findCurrentBySubject(subject)`. [Durable ledger](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-account-principal-binding-v0.js#L277-L310)

Values existing in either object do not by themselves constitute admitted authenticated-principal evidence.

### PROPOSED SEMANTICS

Logical producer:

```text
AYA_AUTHENTICATED_PRINCIPAL_ADMISSION_V0
```

Proposed invocation inputs:

```text
authenticatedRequestContext:
  req
  now

currentAccountSnapshot:
  currentAccountRecord
  obtained once from the authoritative DB for this invocation

liveAuthenticationDependencies:
  authEventSessionBindingStore
  authEventSessionBinding contract
  livePrincipalBoundary contract

durableBindingDependencies:
  durablePrincipalBindingLedger
  ayaAccountPrincipalBinding contract

consumerQuery:
  principalRef
  principalRevision
  contextScope
```

The producer must invoke the live boundary itself. It must not accept a caller-supplied or cached `CURRENT` assessment as sufficient.

Input acceptance:

| Input | Acceptance rule |
|---|---|
| Live authentication surface | Fresh boundary result has `bindingAssessment=ACCEPTED`, `principalAuthEpochCurrentness=CURRENT`, complete source material, `CURRENT/CURRENT/NONE`, `authority=NONE`. |
| Durable binding | Exactly one subject binding; ledger readback, envelope validation and record validation all return `ACCEPTED`. |
| Current account | Fresh DB record passes `validateCurrentAccountSubject` against both the live subject and binding subject. |
| Consumer identity query | `principalRef` and `principalRevision` exactly equal the admitted binding identity. |
| `contextScope` | Structurally valid query correlation only; it creates no principal, role, eligibility or contextual authority. |

Proposed output:

```js
{
  type: "GT63_AYA_AUTHENTICATED_PRINCIPAL_EVIDENCE",
  schemaVersion: "1.0",
  rulesetVersion: "aya-authenticated-principal-admission-v0.1.0",

  principalRef,
  principalRevision,
  principalEvidenceRef,

  lifecycleState: "CURRENT",
  freshnessState: "CURRENT",
  contradictionState: "NONE",

  authority: "NONE",
  authorityEffect: "NONE",

  provenance: {
    agencyId,
    applicationUserId,
    principalBindingEvidenceRef,
    authEventSessionBindingRef,
    authenticationEventIdentity,
    aClassEvidenceIdentity,
    aClassEvidenceRevision,
    sessionRef,
    sessionVersion,
    observedPrincipalAuthEpoch,
    currentPrincipalAuthEpoch,
    observedPrincipalRevision,
    currentPrincipalRevision
  },

  nonClaims: {
    principalEligibilityCreated: false,
    roleCreated: false,
    delegationCreated: false,
    humanGateCreated: false,
    governancePackageCreated: false,
    effectAuthorizationCreated: false,
    offerMutationPerformed: false
  }
}
```

`ACCEPTED` describes only the composition/admission result. It does not retroactively change the acceptance status or non-claims of the underlying A-class evidence.

### UNRESOLVED HUMAN DECISION

Human acceptance is required for:

- this input topology;
- the output type and ruleset identifiers;
- the rule that all acceptance checks occur inside one admission invocation;
- the proposed output provenance fields.

---

## 2. Principal identity and revision

### ESTABLISHED BY CURRENT SOURCE

The durable binding defines:

```text
principalRef =
  gt63-principal:aya-account:{agencyId}:{applicationUserId}

principalRevision =
  aya-principal-binding-revision:1
```

[Canonical principal identity](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-account-principal-binding-v0.js#L94-L103)

The live authentication surface separately supplies:

```text
observedPrincipalAuthEpoch
currentPrincipalAuthEpoch
observedPrincipalRevision = principalAuthEpoch:{n}
currentPrincipalRevision  = principalAuthEpoch:{n}
```

These describe authentication currentness, not the durable principal-binding revision.

### PROPOSED SEMANTICS

```text
output.principalRef
  = durableBinding.record.principalRef

output.principalRevision
  = durableBinding.record.principalRevision
```

Admission requires exact equality between:

```text
live.agencyId                = binding.agencyId
live.applicationUserId       = binding.applicationUserId
binding.principalRef         = canonicalPrincipalRef(live subject)
consumerQuery.principalRef   = binding.principalRef
consumerQuery.principalRevision = binding.principalRevision
```

The epoch remains separate:

```text
principalRevision
≠ observedPrincipalRevision
≠ currentPrincipalRevision
≠ principalAuthEpoch
```

`principalAuthEpoch` affects whether the authenticated view is current. It does not revise the durable GT63 principal identity.

### UNRESOLVED HUMAN DECISION

Human acceptance is required for the choice that the durable binding revision—not `principalAuthEpoch:{n}`—is the canonical `principalRevision` consumed by eligibility.

---

## 3. Evidence identity

### ESTABLISHED BY CURRENT SOURCE

The eligibility consumer requires a non-empty `principalEvidenceRef`, but defines neither its AYA namespace nor its production rule. [Eligibility consumer](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/governance-principal-eligibility-assessment.js#L14-L23)

`principalBindingEvidenceRef` identifies only the durable binding material. It is not currently an authenticated-principal evidence identity.

### PROPOSED SEMANTICS

Proposed format:

```text
gt63-evidence:aya-authenticated-principal:{sha256-hex}
```

The SHA-256 input is canonical UTF-8 JSON of exactly:

```js
{
  type: "GT63_AYA_AUTHENTICATED_PRINCIPAL_EVIDENCE",
  schemaVersion: "1.0",
  rulesetVersion: "aya-authenticated-principal-admission-v0.1.0",

  principalRef,
  principalRevision,

  agencyId,
  applicationUserId,

  principalBindingEvidenceRef,

  authEventSessionBindingRef,
  authenticationEventIdentity,
  aClassEvidenceIdentity,
  aClassEvidenceRevision,

  sessionRef,
  sessionVersion,

  observedPrincipalAuthEpoch,
  currentPrincipalAuthEpoch,
  observedPrincipalRevision,
  currentPrincipalRevision,

  bindingLifecycleState,
  bindingFreshnessState,
  bindingContradictionState,

  authenticationLifecycleState,
  authenticationFreshnessState,
  authenticationContradictionState,

  authority: "NONE",
  authorityEffect: "NONE"
}
```

Canonicalization rule:

- strings normalized to NFC;
- object keys recursively sorted;
- arrays retain order;
- `undefined`, functions, symbols and non-finite numbers rejected;
- canonical JSON encoded as UTF-8;
- SHA-256 lower-case hexadecimal.

`principalBindingEvidenceRef` is bound into the new identity but is not reused as the new identity.

`contextScope` is intentionally excluded: authenticated principal identity does not imply eligibility or authorization for a gate scope.

### UNRESOLVED HUMAN DECISION

Human acceptance is required for:

- the evidence namespace;
- the exact digest material;
- exclusion of `contextScope`;
- the rule that the reference identifies a derived evidence view but is not independently reusable as proof of currentness.

---

## 4. Currentness and provenance

### ESTABLISHED BY CURRENT SOURCE

The current runtime already checks:

- signed session integrity and expiry;
- current DB user lookup;
- user, agency, role and session-version agreement;
- epoch agreement;
- process-local auth-event/session binding availability and integrity;
- exact session material digest;
- absence of beta-auth bypass.

[Session resolution](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/server.js#L591-L625) and [auth/session currentness](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-auth-event-session-binding-v0.js#L240-L314).

A-class evidence is created after successful password verification and before session issuance. The session binding is produced from that evidence and contains its identity, revision and digest. [Login sequence](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/server.js#L8651-L8702)

### PROPOSED SEMANTICS

Every admission call uses one fresh DB snapshot and performs checks in this order:

1. Resolve and verify the current session.
2. Resolve the current account from the same DB snapshot.
3. Invoke the live principal boundary for the current request.
4. Require current session, session version and auth epoch.
5. Locate exactly one durable binding by the live account subject.
6. Validate its envelope, evidence identity and record.
7. Re-run current account subject validation against the binding.
8. Compare live subject and durable binding subject.
9. Compare the consumer query with the durable principal identity.
10. Only then construct and return the authenticated-principal view.

Authoritative sources:

| Fact | Authoritative source |
|---|---|
| Current account subject and epoch | Fresh `readDb()` account record |
| Active session | Verified request cookie/session plus current DB user |
| Auth-event/session relationship | Process-local binding store and its integrity contract |
| A-class provenance for the session | A-class identity/revision/digest already bound into the validated auth-event/session binding |
| Durable principal identity | Validated durable binding envelope in `gt63GovernanceEvidence` |
| Admission currentness | The current admission invocation—not an earlier result |

A-class evidence is historical event evidence. Under the minimum V0 proposal, its connection to the active session is revalidated through the current auth-event/session binding; the A-class record is not assigned a new mutable “currentness” state.

A prior output, cached object, or bare `principalEvidenceRef` must never satisfy a later call. The producer re-evaluates all current inputs whenever `authenticatedPrincipalPort` is invoked.

### UNRESOLVED HUMAN DECISION

Human acceptance is required for the minimum rule that validated auth-event/session binding is sufficient A-class provenance at admission time.

A stricter alternative—fresh durable A-class lookup by identity and revision—is not included in minimum V0 and would require a separate human decision.

---

## 5. Producer/admission boundary

### ESTABLISHED BY CURRENT SOURCE

The existing composition accepts an injected `authenticatedPrincipalPort`; it does not prescribe its implementation. [Existing composition](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/governance-principal-eligibility-composition.js#L4-L18)

### PROPOSED SEMANTICS

Only `AYA_AUTHENTICATED_PRINCIPAL_ADMISSION_V0` may produce this evidence type.

It exposes:

```text
authenticatedPrincipalPort({
  principalRef,
  principalRevision,
  contextScope
}) → evidence | null
```

Internally it also retains a diagnostic assessment:

```text
ACCEPTED
UNKNOWN
REJECTED
CONTRADICTED
INVALID
```

The port returns evidence only for `ACCEPTED`. Every other assessment returns `null` to the existing consumer.

`contextScope` handling:

- must be structurally valid;
- is used only to bind the query invocation to the consumer request;
- is not included in principal identity or evidence identity;
- does not create contextual authority;
- does not alter the admitted principal.

### UNRESOLVED HUMAN DECISION

Human acceptance is required for:

- exclusive producer ownership;
- `null` as the port-level fail-closed representation;
- context-independent principal evidence.

---

## 6. Evidence lifetime

### ESTABLISHED BY CURRENT SOURCE

The live proof depends on:

- the present request;
- an unexpired session;
- a current DB account;
- a process-local auth-event/session binding;
- the current auth epoch.

Durable storage cannot preserve these currentness facts by itself.

### PROPOSED SEMANTICS

**Minimum model: derived current view, request-scoped.**

The evidence object:

- is constructed only after current admission succeeds;
- may be reused within the same synchronous request evaluation;
- is not written to the DB;
- is not added to the durable governance ledger;
- becomes non-current when the invocation ends;
- must be regenerated and revalidated for every later request.

The deterministic `principalEvidenceRef` identifies the exact underlying evidence composition. It does not extend its lifetime.

Process restart naturally invalidates the active source chain because the auth-event/session binding store is process-local. Durable authenticated-principal persistence would not solve that and could incorrectly preserve stale authentication currentness.

### UNRESOLVED HUMAN DECISION

Human acceptance is required for the derived request-scoped model and for explicitly prohibiting V0 persistence.

---

## 7. Fail-closed behavior

### ESTABLISHED BY CURRENT SOURCE

The current sources distinguish missing evidence from positive mismatch:

- unavailable binding/session material can produce `UNKNOWN`;
- expired session, subject mismatch or epoch mismatch are positive rejection evidence;
- contradictory durable binding identity produces `CONTRADICTED`.

### PROPOSED SEMANTICS

| Condition | Admission assessment | Port output |
|---|---|---|
| Required source/port unavailable | `UNKNOWN` | `null` |
| Live assessment absent or `UNKNOWN` | `UNKNOWN` | `null` |
| No durable binding found | `UNKNOWN` | `null` |
| Current account unavailable | `UNKNOWN` | `null` |
| Required evidence reference absent | `UNKNOWN` | `null` |
| Session expired/stale | `REJECTED` | `null` |
| Session signature invalid | `REJECTED` | `null` |
| Beta bypass present | `REJECTED` | `null` |
| Auth epoch positively mismatches | `REJECTED` | `null` |
| Live account subject positively mismatches binding | `CONTRADICTED` | `null` |
| Query principal differs from admitted binding principal | `REJECTED` | `null` |
| Binding record contradicts its canonical subject | `CONTRADICTED` | `null` |
| Multiple current bindings exist | `CONTRADICTED` | `null` |
| Binding is stale/unknown | `UNKNOWN` | `null` |
| Supplied evidence ref disagrees with its deterministic digest | `CONTRADICTED` | `null` |
| Complete checks succeed | `ACCEPTED` | Authenticated-principal evidence |

No incomplete or non-accepted path may construct `principalEvidenceRef` or return a principal object.

### UNRESOLVED HUMAN DECISION

Human acceptance is required for the exact outcome vocabulary and the classification of a consumer-query identity mismatch as `REJECTED` rather than `CONTRADICTED`.

---

## 8. Consumer compatibility

### ESTABLISHED BY CURRENT SOURCE

Eligibility accepts a principal when:

```text
returned.principalRef       === request.principalRef
returned.principalRevision  === request.principalRevision
principalEvidenceRef        is non-empty
lifecycleState              === CURRENT
freshnessState              === CURRENT
contradictionState          === NONE
authority                   === NONE
```

It permits additional provenance fields and does not require consumer modification.

### PROPOSED SEMANTICS

The proposed output satisfies the consumer exactly:

| Consumer requirement | Proposed source |
|---|---|
| `principalRef` | Durable binding canonical principal |
| `principalRevision` | Durable binding revision |
| `principalEvidenceRef` | New deterministic composition evidence identity |
| `lifecycleState=CURRENT` | Set only after all current admission checks |
| `freshnessState=CURRENT` | Set only for the current invocation |
| `contradictionState=NONE` | Set only when neither surface conflicts |
| `authority=NONE` | Fixed contract invariant |

No eligibility assessment is performed. Compatibility is purely structural and semantic at the authenticated-principal port boundary.

---

# Integrated minimum V0 proposal

```text
CURRENT REQUEST
  │
  ├─ fresh verified session
  ├─ fresh authoritative account snapshot
  └─ fresh live AYA principal source assessment
          │
          │ ACCEPTED + epoch CURRENT
          ▼
EXACTLY ONE VALIDATED CURRENT DURABLE AYA PRINCIPAL BINDING
          │
          ├─ same agencyId/applicationUserId
          ├─ canonical principalRef
          ├─ binding principalRevision
          └─ valid principalBindingEvidenceRef
          │
          ▼
AYA_AUTHENTICATED_PRINCIPAL_ADMISSION_V0
          │
          ├─ deterministic new principalEvidenceRef
          ├─ derived request-scoped evidence
          ├─ authority NONE
          └─ no downstream claims
          │
          ▼
authenticatedPrincipalPort(query) → evidence | null
```

## Future verification criteria

A future implementation may be considered verified only if tests demonstrate:

1. Exact acceptance of the already-proven live source and durable binding #1.
2. Fresh session/account/epoch evaluation on every port invocation.
3. No acceptance from cached `CURRENT` output or bare evidence reference.
4. Exact subject agreement across live source, DB account and binding.
5. Strict separation of binding revision and auth-epoch revision domains.
6. Deterministic evidence identity for identical material.
7. Evidence-identity change when any bound material changes.
8. `principalBindingEvidenceRef !== principalEvidenceRef`.
9. All fail-closed cases return no principal.
10. `UNKNOWN` inputs remain `UNKNOWN`.
11. Positive mismatches do not become `UNKNOWN`.
12. `contextScope` creates no authority and does not change principal identity.
13. Direct structural compatibility with the unchanged eligibility consumer.
14. No durable write, binding mutation, eligibility creation or authority effect.

## Human acceptance required

The exact decisions requiring human approval are:

1. `principalRevision` comes exclusively from the durable binding revision domain.
2. `principalAuthEpoch` remains separate authentication-currentness evidence.
3. The proposed `principalEvidenceRef` namespace, canonicalization and bound material are accepted.
4. `contextScope` is query-only and excluded from principal evidence identity.
5. Validated auth-event/session binding is sufficient A-class provenance for minimum V0.
6. Evidence lifetime is derived and request-scoped, with no persistence.
7. Only the proposed admission component may produce this AYA evidence type.
8. The proposed fail-closed outcome classifications are accepted.

```text
PROPOSAL STATUS: NOT ACCEPTED
RUNTIME EVIDENCE CREATED: NO
PRINCIPAL ELIGIBILITY CREATED OR ASSESSED: NO
ROLE / DELEGATION / HUMAN GATE CREATED: NO
GOVERNANCE PACKAGE CREATED: NO
EFFECT AUTHORIZATION CREATED: NO
OFFER MUTATION PERFORMED: NO

MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

---

## Source attachment: Pasted text(20261002-081749).txt

# GT63 × AYA — AUTHENTICATED PRINCIPAL COMPOSITION / ADMISSION CONTRACT V0

```text
MODE: READ-ONLY SOURCE INSPECTION + DESIGN REFINEMENT
STATUS: DESIGN PROPOSAL — NOT ACCEPTED

MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

## Authoritative baseline

Провереният authoritative `origin/main` остава:

```text
bd5bae5f7ba9117f6a62684dca5d4a029a8ba933
```

Няма промяна спрямо предишния анализ.

---

# 1. Една действителна authoritative DB snapshot

## ESTABLISHED BY CURRENT SOURCE

Съществуващият ledger получава две инжектирани функции:

```js
createDurablePrincipalBindingLedger({ readDb, writeDb })
```

Но всяко извикване на `get()` или `findCurrentBySubject()` минава през `collection()`, а `collection()` извиква `readDb()` наново. Следователно при стандартна live `readDb` зависимост:

```text
findCurrentBySubject()
→ readDb() #1

get()
→ readDb() #2
```

няма гаранция, че двете операции виждат едно и също състояние. [Ledger implementation, lines 277–310](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-account-principal-binding-v0.js#L277-L310)

Текущият API обаче използва dependency injection. Ако `readDb` е closure, която винаги връща един вече уловен обект, всички вътрешни ledger lookups използват същия обект.

API няма native read-only режим:

- изисква `writeDb`;
- връща и `commit`;
- сам не доказва, че инжектираният `readDb` е snapshot-bound;
- сам не предотвратява скрит втори физически DB read.

## PROPOSED SEMANTICS

Една admission invocation извършва точно един authoritative read:

```js
const snapshot = readDb(); // exactly once
```

След това от същия обект се извличат:

```js
const currentAccountRecord =
  snapshot.users.find(/* exact applicationUserId */);

const governanceEvidence =
  snapshot.gt63GovernanceEvidence;
```

Създава се invocation-scoped read-only view:

```text
SnapshotBoundPrincipalBindingView
```

Логическата му форма е:

```js
{
  findCurrentBySubject(subject),
  get(principalBindingEvidenceRef),
  validateEnvelope(envelope),
  validateBindingRecord(record)
}
```

Всички операции четат единствено от уловения `snapshot`. Те нямат достъп до global `readDb`.

Минимално използване на съществуващия API е възможно чрез:

```js
createDurablePrincipalBindingLedger({
  readDb: () => snapshot,
  writeDb: () => {
    throw new Error("snapshot-bound admission view is read-only");
  }
})
```

Но admission компонентът не трябва да излага получения `commit` метод. Той използва само `findCurrentBySubject` и `get`.

Точната последователност е:

```text
1. readDb() exactly once
2. validate snapshot structure
3. derive currentAccountRecord from snapshot.users
4. bind ledger readDb to () => snapshot
5. findCurrentBySubject(subject)
6. get(record.principalBindingEvidenceRef)
7. validate envelope and record
8. complete admission or fail closed
```

Уловеният snapshot:

- е invocation-owned;
- не се предоставя на външен код;
- не се мутира;
- логически се третира като immutable за целия invocation.

### Нужна бъдеща адаптация

Назована, но нереализирана:

```text
createSnapshotBoundReadOnlyPrincipalBindingView(snapshot)
```

Причината е не липса на validation логика, а липса на native API, което едновременно:

- гарантира един snapshot;
- не излага `commit`;
- не изисква фиктивен `writeDb`;
- прави невъзможен втори physical `readDb()`.

Тази адаптация може да използва съществуващите validation semantics без промяна на Binding #1.

## UNRESOLVED HUMAN DECISION

Необходимо е човешко приемане на:

1. exactly-one-`readDb()` като договорен invariant;
2. snapshot-bound read-only view като единствен разрешен ledger достъп при admission;
3. бъдещата адаптация да не излага `commit` и да няма write capability.

---

# 2. Еднозначна currentness/lifetime граница

## ESTABLISHED BY CURRENT SOURCE

Eligibility consumer извиква `authenticatedPrincipalPort` синхронно и веднага проверява върнатия обект:

```text
principalRef
principalRevision
principalEvidenceRef
CURRENT / CURRENT / NONE
authority = NONE
```

Той не получава:

- invocation token;
- evaluation ID;
- timestamp;
- доказателство, че портът е направил нов DB read;
- средство да различи свеж обект от стар обект със същите полета.

[Consumer call and validation](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/governance-principal-eligibility-assessment.js#L15-L30)

Следователно съществуващият consumer може да използва conforming fresh port без промяна, но не може сам да открие non-conforming port, който връща кеширан стар обект.

## PROPOSED SEMANTICS

### Admission invocation

Едно конкретно синхронно извикване:

```js
authenticatedPrincipalPort({
  principalRef,
  principalRevision,
  contextScope
})
```

То започва при влизане в порта и включва:

1. единствения DB snapshot read;
2. current account resolution;
3. live session/authentication assessment;
4. auth-epoch currentness;
5. durable binding lookup и validation;
6. cross-surface exact comparisons;
7. evidence construction.

### Consumer evaluation

Едно конкретно синхронно изпълнение на:

```js
governancePrincipalEligibilityAssessment.assess(request)
```

от началото на `assess()` до неговото връщане.

В това изпълнение consumer извиква `authenticatedPrincipalPort` веднъж и непосредствено валидира върнатия резултат.

### Валидност

Валидността започва:

```text
след успешното приключване на всички admission проверки
и непосредствено преди port return
```

Валидността завършва:

```text
при приключване на същото enclosing consumer evaluation
```

Това не означава, че полетата в JavaScript обекта автоматично се променят. Те могат физически да останат:

```text
CURRENT / CURRENT / NONE
```

Но след consumer evaluation обектът вече не е admissible input за друго evaluation.

### Reuse

Предложеното V0 правило е:

```text
NO REUSE ACROSS PORT CALLS.
NO REUSE ACROSS CONSUMER EVALUATIONS.
NO CACHE.
```

Четенето на няколко полета от consumer в рамките на единственото evaluation не е reuse.

Дори в същия HTTP request второ извикване на `authenticatedPrincipalPort` започва нов admission invocation и прави нов snapshot/currentness assessment.

### Предотвратяване на stale reuse

Conforming producer:

- не кешира evidence object;
- не приема стар evidence object като вход;
- не предоставя метод за lookup само по `principalEvidenceRef`;
- създава нов object след новите проверки;
- не излага evidence object извън текущия port return;
- прави нов admission при всяко port invocation.

`principalEvidenceRef` идентифицира обвързания материал. Той не доказва, че този материал е текущ при следващо evaluation.

### Ограничение на съществуващия consumer

Тази граница може да бъде спазена без consumer промяна само като trusted producer/wiring invariant.

Съществуващият consumer не може самостоятелно да предотврати следното non-conforming поведение:

```js
authenticatedPrincipalPort = () => oldCachedObject;
```

Ако старият обект още съдържа валидната форма, consumer ще го приеме структурно.

Следователно:

```text
FRESHNESS ENFORCEMENT BY CONFORMING PRODUCER: POSSIBLE
INDEPENDENT FRESHNESS ENFORCEMENT BY CURRENT CONSUMER: ABSENT
```

По-силно техническо enforcement би изисквало consumer-visible invocation binding или freshness receipt. Това не е част от V0, защото би променило consumer semantics.

## UNRESOLVED HUMAN DECISION

Необходимо е човешко решение дали за V0 е приемлива границата:

```text
exclusive trusted producer
+ fresh admission on every port call
+ no cache/reuse
```

при изричното ограничение, че eligibility consumer не може независимо да открива stale non-conforming port output.

---

# 3. Exact values срещу NFC normalization

## ESTABLISHED BY CURRENT SOURCE

Durable-binding canonicalization в момента нормализира всички низове до NFC преди digest:

```js
typeof value === "string"
  ? value.normalize("NFC")
  : value
```

[Current canonicalization](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-account-principal-binding-v0.js#L36-L63)

Но subject/ref/revision comparisons в binding lookup използват JavaScript exact equality:

```js
record.agencyId === subject.agencyId
record.applicationUserId === subject.applicationUserId
```

[Exact subject lookup](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-account-principal-binding-v0.js#L299-L309)

Следователно upstream contract вече има собствено identity правило:

- digest material: NFC-normalized;
- operational identity comparisons: exact JavaScript string equality.

Това upstream правило не се променя и Binding #1 не се отваря повторно.

## PROPOSED SEMANTICS

Новият authenticated-principal composition contract не прилага NFC normalization.

### Comparison rule

Всички identity-bearing стойности се сравняват чрез exact JavaScript string equality:

```js
left === right
```

Това включва:

- `agencyId`
- `applicationUserId`
- `principalRef`
- `principalRevision`
- `principalBindingEvidenceRef`
- `bindingRef`
- `authenticationEventIdentity`
- `aClassEvidenceIdentity`
- `aClassEvidenceRevision`
- `sessionRef`
- `sessionVersion`
- observed/current auth epoch и epoch revision стойности

Канонично еквивалентни, но различно представени низове не са взаимозаменяеми.

### Digest rule

Новият `principalEvidenceRef` обвързва точните валидни входни string values, без Unicode normalization.

Canonical serialization:

1. използва само фиксирани ASCII schema keys;
2. сортира object keys;
3. запазва масивния ред;
4. запазва точната последователност от Unicode scalar values във всяка string стойност;
5. не прилага NFC, NFD или друга normalization;
6. сериализира като deterministic JSON;
7. кодира JSON като UTF-8;
8. изчислява SHA-256.

### Upstream evidence references

Следните стойности се приемат като opaque upstream identities и се включват verbatim:

```text
principalBindingEvidenceRef
bindingRef
authenticationEventIdentity
aClassEvidenceIdentity
sessionRef
```

Admission contract:

- не ги нормализира;
- не ги пресмята повторно;
- не променя prefix или casing;
- не прилага собствени правила върху вътрешния им digest;
- проверява exact equality спрямо upstream validated records.

Това запазва upstream identity правилата, без да ги разширява до новия composition digest.

### Невалидни Unicode последователности

JavaScript string, съдържащ unpaired UTF-16 surrogate, се отхвърля преди serialization:

- high surrogate без следващ low surrogate → `INVALID`;
- low surrogate без предходен high surrogate → `INVALID`;
- surrogate pair → валиден Unicode scalar value и нормално UTF-8 encoding.

Не се допуска:

- replacement с `U+FFFD`;
- silently escaped lone surrogate;
- normalization;
- evidence production след encoding ambiguity.

### Конкретен пример

Низ A:

```text
"é"
U+00E9
```

Низ B:

```text
"é"
U+0065 U+0301
```

Те са канонично еквивалентни при NFC, но не са exact-equal:

```js
A === B // false
```

Ако се използват като `principalRef`:

```text
principalRef A ≠ principalRef B
```

Ако всички други evidence полета са еднакви:

```text
digest(material containing A)
≠
digest(material containing B)
```

Нито comparison, нито новият digest създават implicit equivalence.

### Най-малко съгласувано правило

```text
UPSTREAM IDENTITY:
  validate under its own existing contract;
  preserve returned reference verbatim.

CROSS-SURFACE IDENTITY:
  exact string equality only.

NEW COMPOSITION IDENTITY:
  deterministic digest over exact valid values;
  no Unicode normalization.
```

## UNRESOLVED HUMAN DECISION

Необходимо е човешко приемане на:

1. exact string equality за всички identity-bearing стойности;
2. липса на NFC normalization в новия composition digest;
3. rejection на unpaired surrogates;
4. verbatim preservation на upstream evidence references.

---

# Интегриран прецизиран V0 договор

```text
authenticatedPrincipalPort(query)
│
├─ begins one admission invocation
│
├─ readDb() exactly once
│    └─ authoritative snapshot
│         ├─ current account
│         └─ gt63GovernanceEvidence collection
│
├─ fresh live authentication assessment
│    ├─ session current
│    ├─ account/session subject exact
│    ├─ auth epoch current
│    └─ A-class/session provenance valid
│
├─ snapshot-bound read-only binding view
│    ├─ exactly one current subject binding
│    ├─ envelope valid
│    ├─ record valid
│    └─ no write/commit capability
│
├─ exact cross-surface comparisons
│    └─ no Unicode normalization
│
├─ deterministic principalEvidenceRef
│    ├─ exact valid input values
│    ├─ verbatim upstream references
│    └─ contextScope excluded
│
└─ returns one ephemeral evidence object
     ├─ consumable only by the enclosing evaluation
     ├─ never cached or reused
     ├─ CURRENT/CURRENT/NONE
     ├─ authority NONE
     └─ no downstream claims
```

Canonical principal semantics remain:

```text
principalRef
  = validated durable binding principalRef

principalRevision
  = validated durable binding principalRevision

principalAuthEpoch
  = separate authentication-currentness quantity
```

Output remains compatible with the unchanged consumer:

```js
{
  principalRef,
  principalRevision,
  principalEvidenceRef,
  lifecycleState: "CURRENT",
  freshnessState: "CURRENT",
  contradictionState: "NONE",
  authority: "NONE",

  // Additional provenance and non-authority fields permitted.
}
```

No eligibility assessment is performed.

---

# Updated future verification criteria

A future implementation must prove:

1. Exactly one physical `readDb()` per admission invocation.
2. Account and binding evidence originate from the same captured snapshot object.
3. `findCurrentBySubject()` and `get()` cannot trigger another physical DB read.
4. Snapshot-bound view exposes no usable `commit` or write path.
5. Mutation attempts against the snapshot/view fail closed.
6. Every `authenticatedPrincipalPort` call performs a new admission.
7. No evidence object or assessment is cached between port calls.
8. A second port call in the same HTTP request still performs a new admission.
9. A prior evidence object cannot enter the conforming producer as input.
10. A bare `principalEvidenceRef` cannot satisfy currentness.
11. The unchanged consumer accepts freshly produced evidence.
12. The documented limitation remains visible: the consumer cannot independently detect a stale non-conforming port.
13. Cross-surface subject/ref/revision comparisons use exact equality.
14. No identity-bearing input is NFC/NFD-normalized.
15. `U+00E9` and `U+0065 U+0301` produce unequal comparisons and unequal composition digests.
16. Every upstream evidence reference is preserved byte-for-byte at the JavaScript string/UTF-8 boundary.
17. Unpaired UTF-16 surrogates produce `INVALID` and no evidence.
18. Binding revision and auth-epoch revision remain separate domains.
19. Identical exact material produces the same `principalEvidenceRef`.
20. Any exact bound-material change produces a different `principalEvidenceRef`.
21. No DB write, binding mutation, eligibility creation or authority effect occurs.

# Remaining human decisions

1. Accept the exactly-one-snapshot invariant and snapshot-bound read-only adapter boundary.
2. Accept producer-enforced lifetime with the explicit limitation that the current consumer cannot independently reject stale non-conforming port output.
3. Accept exact, non-normalizing identity semantics for the new composition contract while preserving upstream references verbatim.

```text
PROPOSAL STATUS: NOT ACCEPTED
IMPLEMENTATION AUTHORIZED: NO
RUNTIME EVIDENCE CREATED: NO

BINDING #1: PROVEN AND CLOSED
ELIGIBILITY CREATED OR ASSESSED: NO
ROLE / DELEGATION / HUMAN GATE CREATED: NO
GOVERNANCE PACKAGE CREATED: NO
EFFECT AUTHORIZATION CREATED: NO
OFFER MUTATION PERFORMED: NO

MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

---

## Source attachment: Pasted text(20261002-112520).txt

# GT63 × AYA — AUTHENTICATED PRINCIPAL COMPOSITION / ADMISSION CONTRACT V0 — CONSOLIDATED PROPOSAL

```text
MODE: DESIGN CONSOLIDATION ONLY
STATUS: NOT ACCEPTED
IMPLEMENTATION AUTHORIZED: NO

MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

## 0. Status, baseline and scope

Source baseline for this proposal:

```text
authoritative main:
bd5bae5f7ba9117f6a62684dca5d4a029a8ba933
```

Established starting state:

```text
LIVE AYA AUTHENTICATION SOURCE MATERIAL              PROVEN
DURABLE AYA ACCOUNT → GT63 PRINCIPAL BINDING #1     PROVEN AND CLOSED
AUTHENTICATED-PRINCIPAL COMPOSITION/ADMISSION        ABSENT
PRINCIPAL ELIGIBILITY                                NOT REACHED
```

This document proposes the minimum contract that could compose the two proven evidence surfaces into authenticated-principal evidence compatible with the existing consumer.

It does not:

- accept the proposed contract;
- create runtime evidence;
- authorize implementation;
- reopen Binding #1;
- create or assess eligibility;
- create role, delegation, human gate or governance package;
- create effect authorization or offer mutation;
- create MACHINE authority.

---

# 1. Contract identity and outcomes

Proposed component:

```text
AYA_AUTHENTICATED_PRINCIPAL_ADMISSION_V0
```

Proposed evidence type:

```text
GT63_AYA_AUTHENTICATED_PRINCIPAL_EVIDENCE
```

Proposed identifiers:

```text
schemaVersion  = "1.0"
rulesetVersion = "aya-authenticated-principal-admission-v0.1.0"
```

Proposed internal outcomes:

```text
ACCEPTED
UNKNOWN
REJECTED
CONTRADICTED
INVALID
```

Only `ACCEPTED` may produce authenticated-principal evidence.

At the existing port boundary:

```text
ACCEPTED       → evidence object
UNKNOWN        → null
REJECTED       → null
CONTRADICTED   → null
INVALID        → null
```

The diagnostic outcome remains internal to the admission component. The unchanged eligibility consumer receives either complete evidence or `null`.

---

# 2. Inputs and authoritative input topology

## 2.1 Consumer query

```js
{
  principalRef,
  principalRevision,
  contextScope
}
```

Requirements:

- `principalRef` is a non-empty, valid Unicode string;
- `principalRevision` is a non-empty, valid Unicode string;
- `contextScope` satisfies the existing gate-scope structure;
- identity-bearing strings contain no unpaired UTF-16 surrogates.

## 2.2 Runtime inputs

Each port invocation requires:

```text
current authenticated request context
current time
authoritative readDb capability
process-local auth-event/session binding store
AYA auth-event/session binding contract
AYA live principal boundary contract
AYA durable principal-binding validation contract
```

A precomputed or caller-supplied live assessment is not sufficient. The producer performs a new assessment during every invocation.

## 2.3 Exactly one authoritative DB snapshot

Each admission invocation executes exactly:

```js
const snapshot = readDb();
```

once.

Both account and binding evidence are extracted from this same object:

```js
const currentAccountRecord =
  snapshot.users.find(/* exact subject match */);

const governanceEvidence =
  snapshot.gt63GovernanceEvidence;
```

No later operation in the same invocation may call the global `readDb` again.

## 2.4 Snapshot-bound read-only binding view

The captured snapshot is bound into an invocation-owned view:

```text
SnapshotBoundReadOnlyPrincipalBindingView
```

Its permitted logical interface is:

```js
{
  findCurrentBySubject(subject),
  get(principalBindingEvidenceRef),
  validateEnvelope(envelope),
  validateBindingRecord(record)
}
```

The view:

- always reads from the same captured snapshot;
- performs no physical DB read;
- exposes no `commit`;
- exposes no write method;
- cannot replace or mutate the captured collection;
- is discarded after the invocation.

The current ledger API can be made snapshot-bound because it accepts an injected `readDb`:

```js
readDb: () => snapshot
```

But the current API is not natively read-only: it requires `writeDb` and exposes `commit`. Therefore the proposed future boundary is:

```text
createSnapshotBoundReadOnlyPrincipalBindingView(snapshot)
```

This is a required contract adaptation, not an implementation authorization.

If the existing ledger is internally reused, its writer must fail closed and its `commit` member must not be exposed:

```js
writeDb: () => {
  throw new Error("snapshot-bound admission view is read-only");
}
```

---

# 3. Input acceptance checks

Admission proceeds in the following order.

## 3.1 Snapshot acceptance

Require:

- `readDb()` completes exactly once;
- the result is a plain DB object;
- `snapshot.users` is an array;
- `snapshot.gt63GovernanceEvidence` is an array;
- the captured object remains invocation-owned and unmodified.

Missing or unavailable authoritative state produces `UNKNOWN`. Malformed contract input produces `INVALID`.

## 3.2 Account acceptance

Resolve the current account from `snapshot.users`.

Require:

- exactly one account matches the authenticated `applicationUserId`;
- account ID and agency match the authenticated subject;
- account continuity is not uncertain;
- no deletion, recreation or agency reassignment marker conflicts with the binding subject;
- current session-version and auth-epoch values come from this exact account record.

The same account object is passed to both live authentication assessment and binding-subject validation.

## 3.3 Live authentication acceptance

The producer freshly invokes the AYA live principal boundary.

Require:

```text
type = AYA_LIVE_GT63_PRINCIPAL_SOURCE_ASSESSMENT
bindingAssessment = ACCEPTED
principalAuthEpochCurrentness = CURRENT
sourceMaterialProduced = true
authenticatedPrincipalSourceMaterial != null
authority = NONE
authorityEffect = NONE
```

The source material must contain:

```text
bindingRef
authenticationEventIdentity
aClassEvidenceIdentity
aClassEvidenceRevision
applicationUserId
agencyId
sessionRef
sessionVersion
observedPrincipalAuthEpochState
observedPrincipalAuthEpoch
observedPrincipalRevision
currentPrincipalAuthEpoch
currentPrincipalRevision
lifecycleState
freshnessState
contradictionState
authority
authorityEffect
```

And must satisfy:

```text
lifecycleState = CURRENT
freshnessState = CURRENT
contradictionState = NONE
authority = NONE
authorityEffect = NONE
```

Values existing without this accepted fresh assessment are not accepted authentication evidence.

## 3.4 Session acceptance

The current request must establish:

- valid session signature;
- non-expired session;
- no beta-auth bypass;
- request user equals current DB user;
- session user equals current DB user;
- session identity equals current DB user;
- agency equality;
- role/current-account agreement where required by the current session contract;
- session-version equality;
- exact session-reference and session-material binding;
- available and valid process-local auth-event/session binding.

A positively expired, invalid or mismatched session is rejected. An unavailable evidence dependency remains unknown.

## 3.5 Authentication epoch acceptance

Require:

```text
observedPrincipalAuthEpochState = OBSERVED
observedPrincipalAuthEpoch = currentPrincipalAuthEpoch
observedPrincipalRevision = principalAuthEpoch:{observed epoch}
currentPrincipalRevision = principalAuthEpoch:{current epoch}
```

`principalAuthEpoch` is an authentication-currentness quantity. It is not the GT63 principal revision.

Missing epoch evidence is `UNKNOWN`. A positive mismatch is `REJECTED`.

## 3.6 A-class provenance acceptance

The current source establishes A-class evidence after successful normal password verification and before session issuance. The auth-event/session binding incorporates:

- A-class evidence identity;
- A-class evidence revision;
- authentication-event identity;
- A-class evidence digest;
- exact session material.

Minimum V0 proposes that a freshly validated auth-event/session binding is sufficient A-class provenance for admission.

Admission does not:

- reinterpret A-class evidence;
- declare the A-class record globally accepted;
- change its existing non-claims;
- assign it a new mutable currentness state;
- perform a second durable A-class lookup.

This sufficiency rule requires explicit human acceptance.

## 3.7 Durable binding acceptance

Using only the snapshot-bound view:

1. Locate the current binding by exact account subject.
2. Require exactly one match.
3. Read it by `principalBindingEvidenceRef`.
4. Validate its envelope.
5. Validate its record.
6. Require consistent envelope and record evidence references.
7. Require:

```text
bindingLifecycleState = CURRENT
bindingFreshnessState = CURRENT
contradictionState = NONE
authority = NONE
authorityEffect = NONE
```

The binding subject, canonical principal identity and binding revision remain governed by the accepted Binding #1 contract.

## 3.8 Cross-surface acceptance

Require exact equality for:

```text
live.applicationUserId = account.id
live.agencyId = account.agencyId

binding.applicationUserId = account.id
binding.agencyId = account.agencyId

live.applicationUserId = binding.applicationUserId
live.agencyId = binding.agencyId

binding.principalRef =
  canonicalPrincipalRef(binding.agencyId, binding.applicationUserId)

query.principalRef = binding.principalRef
query.principalRevision = binding.principalRevision
```

No NFC, NFD, case folding, locale transformation or other normalization is applied.

---

# 4. Principal identity and revision semantics

## 4.1 `principalRef`

Proposed output:

```text
principalRef = validated durableBinding.record.principalRef
```

Canonical form remains:

```text
gt63-principal:aya-account:{agencyId}:{applicationUserId}
```

The admission component does not independently create or revise the principal identity.

## 4.2 `principalRevision`

Proposed output:

```text
principalRevision =
  validated durableBinding.record.principalRevision
```

For Binding #1:

```text
aya-principal-binding-revision:1
```

## 4.3 Separate revision domains

The following are not interchangeable:

```text
principalRevision
observedPrincipalRevision
currentPrincipalRevision
principalAuthEpoch
aClassEvidenceRevision
sessionVersion
binding representationRevision
```

In particular:

```text
principalRevision
≠ principalAuthEpoch:{n}
```

The durable binding revision identifies the GT63 principal binding state.

The auth epoch and its derived revision establish whether the current authentication remains valid for that principal. An epoch transition can invalidate authentication without autonomously changing the durable principal-binding revision.

---

# 5. Exact authenticated-principal output

Only an `ACCEPTED` admission produces:

```js
{
  type: "GT63_AYA_AUTHENTICATED_PRINCIPAL_EVIDENCE",
  schemaVersion: "1.0",
  rulesetVersion:
    "aya-authenticated-principal-admission-v0.1.0",

  principalRef,
  principalRevision,
  principalEvidenceRef,

  lifecycleState: "CURRENT",
  freshnessState: "CURRENT",
  contradictionState: "NONE",

  authority: "NONE",
  authorityEffect: "NONE",

  provenance: {
    agencyId,
    applicationUserId,

    principalBindingEvidenceRef,

    authEventSessionBindingRef,
    authenticationEventIdentity,
    aClassEvidenceIdentity,
    aClassEvidenceRevision,

    sessionRef,
    sessionVersion,

    observedPrincipalAuthEpoch,
    currentPrincipalAuthEpoch,
    observedPrincipalRevision,
    currentPrincipalRevision
  },

  nonClaims: {
    principalEligibilityCreated: false,
    roleCreated: false,
    delegationCreated: false,
    humanGateCreated: false,
    governancePackageCreated: false,
    effectAuthorizationCreated: false,
    offerMutationPerformed: false
  }
}
```

`CURRENT/CURRENT/NONE` is emitted only after all checks complete during the current invocation. The fields are claims of that evaluation, not self-updating runtime state.

---

# 6. `principalEvidenceRef`

## 6.1 Namespace

Proposed format:

```text
gt63-evidence:aya-authenticated-principal:{sha256-hex}
```

It is distinct from:

```text
principalBindingEvidenceRef
```

The binding reference is included as provenance and digest material but is never reused directly as `principalEvidenceRef`.

## 6.2 Exact digest material

`principalEvidenceRef` hashes exactly this object, excluding `principalEvidenceRef` itself:

```js
{
  type: "GT63_AYA_AUTHENTICATED_PRINCIPAL_EVIDENCE",
  schemaVersion: "1.0",
  rulesetVersion:
    "aya-authenticated-principal-admission-v0.1.0",

  principalRef,
  principalRevision,

  agencyId,
  applicationUserId,

  principalBindingEvidenceRef,

  authEventSessionBindingRef,
  authenticationEventIdentity,
  aClassEvidenceIdentity,
  aClassEvidenceRevision,

  sessionRef,
  sessionVersion,

  observedPrincipalAuthEpoch,
  currentPrincipalAuthEpoch,
  observedPrincipalRevision,
  currentPrincipalRevision,

  bindingLifecycleState,
  bindingFreshnessState,
  bindingContradictionState,

  authenticationLifecycleState,
  authenticationFreshnessState,
  authenticationContradictionState,

  authority: "NONE",
  authorityEffect: "NONE"
}
```

No additional runtime, human-readable or downstream authorization values are implicitly included.

`contextScope` is intentionally excluded.

## 6.3 Serialization rule

Before hashing:

1. Require a plain object composed only of supported JSON values.
2. Reject `undefined`, functions and symbols.
3. Reject non-finite numbers.
4. Reject any string containing an unpaired UTF-16 surrogate.
5. Preserve every valid string’s exact Unicode scalar sequence.
6. Apply no Unicode normalization.
7. Sort object keys recursively using deterministic code-unit order.
8. Preserve array order.
9. Serialize as deterministic JSON.
10. Encode the resulting JSON as UTF-8.
11. Calculate SHA-256.
12. Encode the digest as lower-case hexadecimal.

## 6.4 Exact Unicode identity semantics

All identity-bearing strings use exact equality:

```js
left === right
```

Example:

```text
A = "é"   = U+00E9
B = "é"  = U+0065 U+0301
```

Although canonically equivalent under NFC:

```js
A === B // false
```

Therefore:

```text
principalRef(A) ≠ principalRef(B)
digest(material containing A)
  ≠
digest(material containing B)
```

No implicit identity equivalence is introduced.

## 6.5 Upstream reference preservation

These upstream identities are treated as opaque exact strings:

```text
principalBindingEvidenceRef
authEventSessionBindingRef
authenticationEventIdentity
aClassEvidenceIdentity
sessionRef
```

They are:

- validated under their own upstream contracts;
- preserved verbatim;
- included verbatim in the new digest material;
- never normalized;
- never case-folded;
- never reconstructed;
- never reinterpreted using the new digest rule.

Existing upstream NFC-based identity rules remain upstream rules. They are not inherited by the new composition identity and Binding #1 is not reopened.

---

# 7. Producer ownership and port interface

## 7.1 Exclusive producer

Only:

```text
AYA_AUTHENTICATED_PRINCIPAL_ADMISSION_V0
```

may produce:

```text
GT63_AYA_AUTHENTICATED_PRINCIPAL_EVIDENCE
```

No raw caller, cached object, durable binding record or live source-material object may self-declare this evidence type.

## 7.2 Port interface

The producer exposes:

```js
authenticatedPrincipalPort({
  principalRef,
  principalRevision,
  contextScope
}) → evidence | null
```

Every invocation performs a new complete admission.

The port:

- never accepts a prior authenticated-principal evidence object as input;
- never resolves currentness solely from `principalEvidenceRef`;
- never returns partial evidence;
- never caches a previous result;
- returns `null` for every non-`ACCEPTED` outcome.

## 7.3 `contextScope`

`contextScope` is:

- required as part of the existing consumer query;
- structurally validated;
- used only for query correlation;
- excluded from `principalRef`;
- excluded from `principalRevision`;
- excluded from `principalEvidenceRef` digest material;
- absent as an authority claim in the output.

Authentication of a principal is not eligibility or authorization for a gate context.

Different valid `contextScope` values may receive the same freshly admitted principal evidence if every identity and currentness input is otherwise identical.

---

# 8. Currentness and provenance boundary

## 8.1 Admission invocation

An admission invocation is one synchronous call to:

```js
authenticatedPrincipalPort(query)
```

It begins when control enters the port.

It includes:

- exactly one DB snapshot read;
- account resolution;
- live authentication assessment;
- session and epoch validation;
- snapshot-bound durable-binding lookup;
- cross-surface comparisons;
- evidence construction.

## 8.2 Consumer evaluation

A consumer evaluation is one synchronous execution of:

```js
governancePrincipalEligibilityAssessment.assess(request)
```

from entry until its return.

The current consumer calls `authenticatedPrincipalPort` once and immediately validates the returned object.

## 8.3 Validity interval

The evidence becomes valid only:

```text
after all admission checks succeed
and immediately before port return
```

Its permitted use ends:

```text
when the enclosing consumer evaluation returns
```

This is a contract boundary, not an automatic object mutation. The object may physically continue to contain:

```text
CURRENT / CURRENT / NONE
```

afterward, but it is no longer admissible for another evaluation.

## 8.4 Reuse and caching

```text
NO CACHE.
NO REUSE ACROSS PORT INVOCATIONS.
NO REUSE ACROSS CONSUMER EVALUATIONS.
```

A second port call, even during the same HTTP request, performs a new:

- DB snapshot read;
- live assessment;
- currentness check;
- binding lookup;
- evidence construction.

Reading multiple fields from the single object inside its enclosing consumer evaluation is not reuse.

## 8.5 Freshness-enforcement limitation

A conforming producer can enforce freshness by always performing a new admission and never returning cached material.

The unchanged eligibility consumer cannot independently distinguish:

```text
fresh conforming output
```

from:

```text
stale object returned by a non-conforming port
that still contains CURRENT/CURRENT/NONE
```

Therefore:

```text
PRODUCER-ENFORCED FRESHNESS: POSSIBLE
CONSUMER-INDEPENDENT FRESHNESS VERIFICATION: ABSENT
```

Compatibility with the unchanged consumer depends on:

- exclusive producer ownership;
- trusted wiring;
- no cache;
- no reuse;
- new admission for every port call.

A stronger consumer-visible invocation receipt would require changing consumer semantics and is outside this V0 proposal.

## 8.6 Evidence-reference limitation

`principalEvidenceRef` identifies exact composition material.

It does not independently establish:

- current session validity;
- current account state;
- current auth epoch;
- current binding state;
- current admissibility.

A bare evidence reference can never replace a fresh admission invocation.

---

# 9. Complete fail-closed behavior

| Condition | Internal outcome | Port output |
|---|---:|---:|
| Malformed consumer query | `INVALID` | `null` |
| Unsupported `contextScope` structure | `INVALID` | `null` |
| Unpaired UTF-16 surrogate in any bound string | `INVALID` | `null` |
| Unsupported serialization value | `INVALID` | `null` |
| Non-finite number in digest material | `INVALID` | `null` |
| `readDb` unavailable or throws | `UNKNOWN` | `null` |
| DB snapshot absent | `UNKNOWN` | `null` |
| Required DB collection unavailable | `UNKNOWN` | `null` |
| Current account unavailable | `UNKNOWN` | `null` |
| Multiple matching current accounts | `CONTRADICTED` | `null` |
| Live assessment unavailable | `UNKNOWN` | `null` |
| Live assessment outcome `UNKNOWN` | `UNKNOWN` | `null` |
| Incomplete live source material | `UNKNOWN` | `null` |
| Required upstream evidence reference missing | `UNKNOWN` | `null` |
| Auth-event/session binding unavailable | `UNKNOWN` | `null` |
| A-class provenance unavailable from the validated session binding | `UNKNOWN` | `null` |
| Session signature positively invalid | `REJECTED` | `null` |
| Session positively expired/stale | `REJECTED` | `null` |
| Beta-auth bypass present | `REJECTED` | `null` |
| Session version positively mismatches current account | `REJECTED` | `null` |
| Session/request/current-account subject positively mismatches | `REJECTED` | `null` |
| Current auth epoch unavailable/uninitialized | `UNKNOWN` | `null` |
| Auth epoch positively mismatches observed epoch | `REJECTED` | `null` |
| Durable binding collection unavailable | `UNKNOWN` | `null` |
| Current durable binding not found | `UNKNOWN` | `null` |
| Multiple current bindings for the subject | `CONTRADICTED` | `null` |
| Binding currentness unknown | `UNKNOWN` | `null` |
| Binding stale or non-current without positive conflicting identity | `UNKNOWN` | `null` |
| Binding contradiction state is positive | `CONTRADICTED` | `null` |
| Binding envelope and record reference mismatch | `CONTRADICTED` | `null` |
| Binding evidence reference disagrees with its upstream identity rule | `CONTRADICTED` | `null` |
| Live subject positively mismatches binding subject | `CONTRADICTED` | `null` |
| Binding `principalRef` positively mismatches its canonical subject | `CONTRADICTED` | `null` |
| Binding `principalRevision` positively violates its accepted binding contract | `CONTRADICTED` | `null` |
| Query `principalRef` differs from admitted binding principal | `REJECTED` | `null` |
| Query `principalRevision` differs from admitted binding revision | `REJECTED` | `null` |
| Supplied/computed composition reference disagrees with exact digest | `CONTRADICTED` | `null` |
| Composition digest cannot be produced | `INVALID` | `null` |
| Any required assessment remains `UNKNOWN` | `UNKNOWN` | `null` |
| All checks succeed | `ACCEPTED` | Complete evidence |

Normative distinctions:

```text
MISSING OR UNAVAILABLE ≠ POSITIVE MISMATCH
UNKNOWN ≠ REJECTED
STALE AUTHENTICATION ≠ STALE BINDING
BINDING CURRENTNESS ≠ AUTHENTICATION CURRENTNESS
```

No non-`ACCEPTED` path may construct or return authenticated-principal evidence.

---

# 10. Compatibility with the unchanged consumer

The current consumer requires:

```text
returned.principalRef
  = request.principalRef

returned.principalRevision
  = request.principalRevision

principalEvidenceRef
  = non-empty string

lifecycleState
  = CURRENT

freshnessState
  = CURRENT

contradictionState
  = NONE

authority
  = NONE
```

The proposed evidence provides exactly these fields:

| Consumer requirement | Proposed evidence source |
|---|---|
| `principalRef` | Validated durable binding |
| `principalRevision` | Validated durable binding revision |
| `principalEvidenceRef` | New exact composition digest identity |
| `lifecycleState=CURRENT` | Emitted only after current admission succeeds |
| `freshnessState=CURRENT` | Limited to the enclosing consumer evaluation |
| `contradictionState=NONE` | Emitted only when no checked conflict exists |
| `authority=NONE` | Fixed contract invariant |

The consumer permits additional provenance and non-claim fields, so its schema and eligibility semantics do not need to change.

This establishes proposed interface compatibility only. No eligibility assessment or eligibility evidence is produced.

---

# 11. Consolidated verification criteria

A future implementation could be reviewed only if it demonstrates all of the following.

## Snapshot and read-only boundary

1. Exactly one physical `readDb()` occurs per port invocation.
2. Account and governance evidence come from the same captured snapshot object.
3. `findCurrentBySubject()` performs no independent DB read.
4. `get()` performs no independent DB read.
5. Envelope and record validation use the same captured snapshot.
6. The snapshot-bound view exposes no `commit`.
7. The snapshot-bound view exposes no usable writer.
8. Any attempted write fails closed.
9. Admission produces no DB mutation.

## Live authentication and provenance

10. Every port invocation performs a fresh live assessment.
11. Session signature, expiry and bypass exclusion are checked.
12. Request, session and current-account subjects agree exactly.
13. Current session version is checked.
14. Observed and current auth epochs agree exactly.
15. A-class identity and revision remain bound through the validated auth-event/session binding.
16. Missing A-class/session provenance produces no principal.
17. A-class provenance is not upgraded into an unrelated global acceptance claim.

## Durable binding

18. Exactly one current subject binding is required.
19. Binding envelope and record are revalidated.
20. Binding evidence reference remains the upstream reference.
21. Binding subject agrees exactly with the current account and live source.
22. Binding #1 is not recreated, modified or recommitted.
23. Binding currentness is not substituted for authentication currentness.

## Identity and revision domains

24. `principalRef` comes only from the validated durable binding.
25. `principalRevision` comes only from the durable binding revision domain.
26. `principalAuthEpoch` remains a separate authentication-currentness value.
27. Epoch revision values are never substituted for `principalRevision`.
28. Session version, A-class revision and binding representation revision remain distinct domains.

## Evidence identity

29. `principalBindingEvidenceRef` is not reused as `principalEvidenceRef`.
30. The proposed namespace is used exactly.
31. The digest binds exactly the specified material and nothing implicitly additional.
32. Identical exact material produces the same digest.
33. Any exact bound-material change produces a different digest.
34. Upstream evidence references are preserved verbatim.
35. `contextScope` is excluded from evidence identity.
36. A bare evidence reference cannot satisfy currentness.

## Unicode and serialization

37. Identity comparisons use exact string equality.
38. No NFC, NFD, case folding or locale normalization is applied.
39. `U+00E9` and `U+0065 U+0301` compare unequal.
40. Those two representations produce different composition digests.
41. Unpaired high surrogates produce `INVALID`.
42. Unpaired low surrogates produce `INVALID`.
43. No invalid Unicode input produces evidence.
44. Unsupported JSON values and non-finite numbers fail closed.
45. Object-key sorting and array ordering are deterministic.
46. UTF-8 encoding and lower-case SHA-256 output are deterministic.

## Invocation and lifetime

47. Every port call starts a new admission invocation.
48. A second port call in the same HTTP request performs a new admission.
49. No prior evidence object is accepted as producer input.
50. No evidence object is cached across port calls.
51. No evidence object is reused across consumer evaluations.
52. Evidence use is limited to the enclosing synchronous consumer evaluation.
53. The producer does not claim that `CURRENT` fields mutate after evaluation.
54. The documented consumer-enforcement limitation remains explicit.
55. A non-conforming stale port is not represented as detectable by the unchanged consumer.

## Port and fail-closed behavior

56. Only the exclusive producer can emit the proposed evidence type.
57. `ACCEPTED` returns complete evidence.
58. Every other outcome returns `null`.
59. Missing evidence remains `UNKNOWN`.
60. Positive mismatch does not collapse into `UNKNOWN`.
61. `UNKNOWN` does not become `REJECTED` without positive mismatch evidence.
62. Partial evidence is never returned.
63. No failure path constructs an accepted `principalEvidenceRef`.

## Consumer and authority boundaries

64. Fresh output satisfies the unchanged authenticated-principal consumer shape.
65. No eligibility assessment is required to test port compatibility.
66. `contextScope` creates no principal, eligibility or authorization authority.
67. Output authority remains `NONE`.
68. Output authority effect remains `NONE`.
69. All downstream non-claim flags remain false.
70. No eligibility, role, delegation, human gate, governance package, effect authorization or offer mutation is created.

---

# 12. Complete human-acceptance decision set

Every item below remains unresolved until explicitly accepted by a human.

1. **Input topology**  
   Accept the current request, one DB snapshot, live source boundary, process-local auth/session binding and durable binding view as the complete minimum input topology.

2. **Output schema**  
   Accept `GT63_AYA_AUTHENTICATED_PRINCIPAL_EVIDENCE`, `schemaVersion: "1.0"` and the exact proposed output fields.

3. **Ruleset identity**  
   Accept `aya-authenticated-principal-admission-v0.1.0`.

4. **Exactly-one-snapshot invariant**  
   Accept exactly one physical `readDb()` per admission invocation.

5. **Snapshot-bound adapter boundary**  
   Accept an invocation-owned read-only binding view with no exposed write or commit capability.

6. **Account/binding snapshot unity**  
   Accept that current account and durable binding must be derived from the same captured DB object.

7. **Principal identity source**  
   Accept the durable binding’s canonical `principalRef` as the authenticated principal identity.

8. **Principal revision source**  
   Accept the durable binding’s `principalRevision` as the consumer-facing principal revision.

9. **Separate auth epoch**  
   Accept `principalAuthEpoch` and its derived revision as separate authentication-currentness quantities, never interchangeable with `principalRevision`.

10. **Evidence namespace**  
    Accept `gt63-evidence:aya-authenticated-principal:{sha256-hex}`.

11. **Exact digest material**  
    Accept the complete enumerated digest material and the exclusion of unspecified fields.

12. **Serialization rule**  
    Accept deterministic sorted-key JSON, preserved array order, UTF-8 and lower-case SHA-256.

13. **Exact Unicode semantics**  
    Accept exact identity comparisons and no Unicode normalization for the new contract.

14. **Invalid Unicode handling**  
    Accept `INVALID` and no evidence for unpaired UTF-16 surrogates.

15. **Upstream identity preservation**  
    Accept upstream references as opaque, verbatim identities governed by their own existing contracts.

16. **Distinct evidence identities**  
    Accept that `principalBindingEvidenceRef` is provenance input and cannot directly serve as `principalEvidenceRef`.

17. **`contextScope` treatment**  
    Accept `contextScope` as query-only, excluded from principal identity and evidence identity.

18. **A-class provenance sufficiency**  
    Accept a freshly validated auth-event/session binding as sufficient minimum V0 provenance for its bound A-class evidence, without a second durable A-class lookup.

19. **Derived evidence model**  
    Accept authenticated-principal evidence as an ephemeral derived view rather than a durable record.

20. **No persistence**  
    Accept that V0 creates no DB or governance-ledger persistence for authenticated-principal evidence.

21. **Exclusive producer ownership**  
    Accept `AYA_AUTHENTICATED_PRINCIPAL_ADMISSION_V0` as the only permitted producer of this evidence type.

22. **New admission per port call**  
    Accept that every `authenticatedPrincipalPort` invocation performs a complete new admission.

23. **No cache or reuse**  
    Accept no reuse across port calls or consumer evaluations, including within the same HTTP request.

24. **Lifetime boundary**  
    Accept validity only within the enclosing synchronous consumer evaluation.

25. **Freshness-enforcement limitation**  
    Accept explicitly that producer compliance can enforce freshness, but the unchanged consumer cannot independently detect stale output supplied by a non-conforming port.

26. **Outcome classifications**  
    Accept the proposed `ACCEPTED`, `UNKNOWN`, `REJECTED`, `CONTRADICTED` and `INVALID` distinctions.

27. **Port failure representation**  
    Accept `null` for every non-`ACCEPTED` port result.

28. **Authority boundary**  
    Accept fixed `authority: "NONE"` and `authorityEffect: "NONE"`.

29. **Downstream non-claims**  
    Accept that admission creates no eligibility, role, delegation, human gate, governance package, effect authorization or offer mutation.

---

```text
CONSOLIDATED PROPOSAL STATUS: NOT ACCEPTED
IMPLEMENTATION AUTHORIZED: NO
RUNTIME EVIDENCE CREATED: NO

BINDING #1: PROVEN AND CLOSED
BINDING MATERIALIZATION REOPENED: NO

ELIGIBILITY ASSESSED OR CREATED: NO
ROLE CREATED: NO
DELEGATION CREATED: NO
HUMAN GATE CREATED: NO
GOVERNANCE PACKAGE CREATED: NO
EFFECT AUTHORIZATION CREATED: NO
OFFER MUTATION PERFORMED: NO

MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

---

## Source attachment: Pasted text(20261002-113318).txt

# GT63 × AYA — AUTHENTICATED PRINCIPAL COMPOSITION / ADMISSION CONTRACT V0 — CONSOLIDATED PROPOSAL

```text
MODE: READ-ONLY SOURCE INSPECTION + DESIGN PRECISION
STATUS: NOT ACCEPTED
IMPLEMENTATION AUTHORIZED: NO

MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

## 0. Authoritative baseline and status

Verified authoritative `origin/main`:

```text
bd5bae5f7ba9117f6a62684dca5d4a029a8ba933
```

No relevant change from the previously inspected baseline was found.

```text
LIVE AYA AUTHENTICATION SOURCE MATERIAL              PROVEN
DURABLE AYA ACCOUNT → GT63 PRINCIPAL BINDING #1     PROVEN AND CLOSED
AUTHENTICATED-PRINCIPAL COMPOSITION/ADMISSION        DESIGN PROPOSAL
PRINCIPAL ELIGIBILITY                                NOT REACHED
```

This document does not accept the contract, create runtime evidence, or authorize implementation.

---

## 1. Current-source reference index

Mappings marked `CURRENT SOURCE` are grounded in:

- **S1 — A-class validation:** [aya-auth-event-session-binding-v0.js, lines 113–127](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-auth-event-session-binding-v0.js#L113-L127)
- **S2 — Auth/session binding fields and conversions:** [aya-auth-event-session-binding-v0.js, lines 129–172](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-auth-event-session-binding-v0.js#L129-L172)
- **S3 — Auth/session binding identity:** [aya-auth-event-session-binding-v0.js, lines 175–207](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-auth-event-session-binding-v0.js#L175-L207)
- **S4 — Current-request assessment and source material:** [aya-auth-event-session-binding-v0.js, lines 240–314](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-auth-event-session-binding-v0.js#L240-L314)
- **S5 — Live principal source projection:** [aya-live-principal-boundary-v0.js, lines 65–104](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-live-principal-boundary-v0.js#L65-L104)
- **S6 — Live assessment acceptance:** [aya-live-principal-boundary-v0.js, lines 107–151](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-live-principal-boundary-v0.js#L107-L151)
- **S7 — Canonical durable principal and binding ref:** [aya-account-principal-binding-v0.js, lines 94–126](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-account-principal-binding-v0.js#L94-L126)
- **S8 — Durable binding record and validation:** [aya-account-principal-binding-v0.js, lines 180–239](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-account-principal-binding-v0.js#L180-L239)
- **S9 — Ledger access behavior:** [aya-account-principal-binding-v0.js, lines 268–350](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/aya-account-principal-binding-v0.js#L268-L350)
- **S10 — Existing consumer shape:** [governance-principal-eligibility-assessment.js, lines 14–23](https://github.com/goceterziev-creator/2l1p-neural-travel-v9/blob/bd5bae5f7ba9117f6a62684dca5d4a029a8ba933/scripts/gt63-machine/governance-principal-eligibility-assessment.js#L14-L23)

---

# 2. Contract identity, interface and outcomes

Proposed component:

```text
AYA_AUTHENTICATED_PRINCIPAL_ADMISSION_V0
```

Proposed output identity:

```text
type           = GT63_AYA_AUTHENTICATED_PRINCIPAL_EVIDENCE
schemaVersion  = 1.0
rulesetVersion = aya-authenticated-principal-admission-v0.1.0
```

Proposed internal outcomes:

```text
ACCEPTED
UNKNOWN
REJECTED
CONTRADICTED
INVALID
```

Port:

```js
authenticatedPrincipalPort({
  principalRef,
  principalRevision,
  contextScope
}) → evidence | null
```

Only `ACCEPTED` returns evidence. Every other outcome returns `null`.

---

# 3. Snapshot and admission topology

Each port invocation is one new admission invocation.

It performs exactly one authoritative read:

```js
const snapshot = readDb();
```

Both inputs are derived from that object:

```text
current account   ← snapshot.users
durable binding   ← snapshot.gt63GovernanceEvidence
```

The captured snapshot is exposed internally only through:

```text
SnapshotBoundReadOnlyPrincipalBindingView
```

Permitted operations:

```js
findCurrentBySubject(subject)
get(principalBindingEvidenceRef)
validateEnvelope(envelope)
validateBindingRecord(record)
```

Prohibited:

```text
second physical readDb()
commit
writeDb
collection replacement
snapshot mutation
```

The current ledger API invokes its injected `readDb` for each lookup [S9]. It can be bound to one snapshot through `readDb: () => snapshot`, but it is not natively read-only because it also exposes `commit`. A future read-only adapter is therefore part of the proposed contract boundary, not an implementation performed here.

---

# 4. Acceptance checks

Admission returns `ACCEPTED` only if all of the following succeed:

1. Consumer query has the exact required fields and valid types.
2. One authoritative DB snapshot is obtained.
3. Exactly one current account is resolved.
4. A fresh live principal assessment is executed.
5. Live assessment returns accepted, current, complete source material.
6. Current request/session/binding integrity is valid.
7. Session is not expired and is not a beta bypass.
8. Observed and current auth epochs match.
9. Exactly one current durable binding is found in the same snapshot.
10. Binding envelope, record and evidence identity validate.
11. Account, live source and binding subjects match exactly.
12. Consumer `principalRef` and `principalRevision` match the binding exactly.
13. Every required mapped field has the specified type.
14. Every identity-bearing string is valid Unicode without unpaired surrogates.
15. Exact digest construction succeeds.

No missing source value may be replaced by a default.

---

# 5. Exact output schema

```js
{
  type: "GT63_AYA_AUTHENTICATED_PRINCIPAL_EVIDENCE",
  schemaVersion: "1.0",
  rulesetVersion:
    "aya-authenticated-principal-admission-v0.1.0",

  principalRef,
  principalRevision,
  principalEvidenceRef,

  lifecycleState: "CURRENT",
  freshnessState: "CURRENT",
  contradictionState: "NONE",

  authority: "NONE",
  authorityEffect: "NONE",

  provenance: {
    agencyId,
    applicationUserId,

    principalBindingEvidenceRef,

    authEventSessionBindingRef,
    authenticationEventIdentity,
    aClassEvidenceIdentity,
    aClassEvidenceRevision,

    sessionRef,
    sessionVersion,

    observedPrincipalAuthEpoch,
    currentPrincipalAuthEpoch,
    observedPrincipalRevision,
    currentPrincipalRevision
  },

  nonClaims: {
    principalEligibilityCreated: false,
    roleCreated: false,
    delegationCreated: false,
    humanGateCreated: false,
    governancePackageCreated: false,
    effectAuthorizationCreated: false,
    offerMutationPerformed: false
  }
}
```

---

# 6. Normative field mapping

## 6.1 Top-level output fields

| Output field | Exact source | Type | Validation | Permitted transformation | Missing/invalid behavior |
|---|---|---|---|---|---|
| `type` | Contract constant — **PROPOSED SEMANTICS** | string | Exact value `GT63_AYA_AUTHENTICATED_PRINCIPAL_EVIDENCE` | None | Contract construction failure → `INVALID` |
| `schemaVersion` | Contract constant — **PROPOSED SEMANTICS** | string | Exact value `"1.0"` | None | `INVALID` |
| `rulesetVersion` | Contract constant — **PROPOSED SEMANTICS** | string | Exact value `aya-authenticated-principal-admission-v0.1.0` | None | `INVALID` |
| `principalRef` | `validatedBinding.record.principalRef` — **CURRENT SOURCE → PROPOSED OUTPUT** [S7][S8] | non-empty string | Binding record accepted; exact match with canonical subject and query | Verbatim copy | Missing/wrong type → `UNKNOWN`/`INVALID`; positive mismatch → `CONTRADICTED` or query `REJECTED` |
| `principalRevision` | `validatedBinding.record.principalRevision` — **CURRENT SOURCE → PROPOSED OUTPUT** [S8] | non-empty string | Binding validation accepts exact durable revision | Verbatim copy | Missing/wrong type → `UNKNOWN`/`INVALID`; mismatch with binding contract → `CONTRADICTED`; query mismatch → `REJECTED` |
| `principalEvidenceRef` | Deterministic composition digest — **PROPOSED SEMANTICS** | non-empty string | Exact prefix plus SHA-256 of exact digest material | Construct once after all checks | Construction failure → `INVALID`; digest mismatch → `CONTRADICTED` |
| `lifecycleState` | Admission result constant — **PROPOSED SEMANTICS** | string enum | Emitted only after binding and authentication lifecycle checks succeed | Set to `"CURRENT"`; not copied from one input | Any incomplete lifecycle check → no evidence |
| `freshnessState` | Admission result constant — **PROPOSED SEMANTICS** | string enum | Emitted only after fresh per-invocation checks | Set to `"CURRENT"`; not copied from one input | Any incomplete freshness check → no evidence |
| `contradictionState` | Admission result constant — **PROPOSED SEMANTICS** | string enum | Emitted only when no checked contradiction exists | Set to `"NONE"` | Positive contradiction → `CONTRADICTED`, no evidence |
| `authority` | Contract constant — **PROPOSED SEMANTICS**, consistent with both inputs [S5][S8] | string enum | Exact `"NONE"`; both validated inputs must also have `authority="NONE"` | None | Mismatch → `REJECTED` |
| `authorityEffect` | Contract constant — **PROPOSED SEMANTICS**, consistent with live/binding contracts [S5][S8] | string enum | Exact `"NONE"`; both inputs must have `authorityEffect="NONE"` where defined | None | Mismatch → `REJECTED` |
| `provenance` | Constructed exclusively from mappings in §6.2 | plain object | Every listed property present and valid | Structural assembly only | Any missing property → no evidence |
| `nonClaims` | Contract constants in §6.3 | exact object | Every property exactly `false` | None | Any non-false value → `REJECTED` |

Top-level `CURRENT/CURRENT/NONE` represents the admission assessment result. It is not a substitute for the underlying binding or authentication state fields included separately in digest material.

## 6.2 Provenance mappings

| Provenance field | Exact source object/property | Type and allowed value | Validation | Permitted transformation | Missing/invalid behavior |
|---|---|---|---|---|---|
| `agencyId` | `validatedBinding.record.agencyId`; must equal `liveMaterial.agencyId` and `currentAccountRecord.agencyId` | non-empty string | Exact equality across all three sources | Verbatim binding value | Missing → `UNKNOWN`; wrong type → `INVALID`; mismatch → `CONTRADICTED` |
| `applicationUserId` | `validatedBinding.record.applicationUserId`; must equal `liveMaterial.applicationUserId` and `currentAccountRecord.id` | non-empty string | Exact equality across all sources | Verbatim binding value | Missing → `UNKNOWN`; wrong type → `INVALID`; mismatch → `CONTRADICTED` |
| `principalBindingEvidenceRef` | `validatedBinding.record.principalBindingEvidenceRef` [S7][S8] | non-empty string | Upstream binding identity recomputes and envelope reference matches | Verbatim; no new normalization | Missing → `UNKNOWN`; identity mismatch → `CONTRADICTED` |
| `authEventSessionBindingRef` | `liveAssessment.authenticatedPrincipalSourceMaterial.bindingRef` [S5], originating from `binding.bindingRef` [S3][S4] | non-empty string | Fresh live assessment accepted; upstream binding integrity accepted | **Direct proposed rename only:** `bindingRef → authEventSessionBindingRef`; value preserved verbatim | Missing → `UNKNOWN`; wrong type → `INVALID`; upstream integrity mismatch → propagated non-`ACCEPTED` |
| `authenticationEventIdentity` | `liveMaterial.authenticationEventIdentity` [S4][S5] | non-empty string | Required by live material and bound A-class/session source | Verbatim | Missing → `UNKNOWN`; wrong type → `INVALID`; positive cross-source mismatch → `CONTRADICTED` |
| `aClassEvidenceIdentity` | `liveMaterial.aClassEvidenceIdentity` [S4][S5] | non-empty string | Originates from validated A-class `metadata.evidenceIdentity` [S1][S2] | Verbatim | Missing → `UNKNOWN`; wrong type → `INVALID` |
| `aClassEvidenceRevision` | `liveMaterial.aClassEvidenceRevision` [S4][S5] | string; current valid source produces `"1"` | Upstream validates numeric revision `1`, then explicitly converts with `String(...)` [S1][S2] | **No admission conversion**; copy the already-produced string verbatim | Missing → `UNKNOWN`; non-string or value other than `"1"` → `INVALID`/`REJECTED` |
| `sessionRef` | `liveMaterial.sessionRef` [S4][S5] | non-empty string | Current request ref equals validated stored binding ref | Verbatim | Missing → `UNKNOWN`; wrong type → `INVALID`; mismatch → `REJECTED` |
| `sessionVersion` | `liveMaterial.sessionVersion` [S4][S5] | non-empty string | Upstream explicitly converts session version to string and checks current account/session agreement [S2][S4] | **No admission conversion**; verbatim copy | Missing → `UNKNOWN`; non-string → `INVALID`; current-version mismatch → `REJECTED` |
| `observedPrincipalAuthEpoch` | `liveMaterial.observedPrincipalAuthEpoch` [S4][S5] | string matching `^[1-9][0-9]*$` | Upstream derives via explicit `String(payload.principalAuthEpoch)` and requires observed state [S2][S4] | No admission conversion | Missing → `UNKNOWN`; wrong type/format → `INVALID`; epoch mismatch → `REJECTED` |
| `currentPrincipalAuthEpoch` | `liveMaterial.currentPrincipalAuthEpoch` [S4][S5] | string matching `^[1-9][0-9]*$` | Upstream validates positive integer and explicitly produces `String(Number(currentPrincipalAuthEpoch))` [S4] | No admission conversion | Missing → `UNKNOWN`; wrong type/format → `INVALID`; mismatch → `REJECTED` |
| `observedPrincipalRevision` | `liveMaterial.observedPrincipalRevision` [S4][S5] | non-empty string | Must equal exact string `principalAuthEpoch:${observedPrincipalAuthEpoch}` [S2] | No conversion; exact relational validation | Missing → `UNKNOWN`; wrong type → `INVALID`; relational mismatch → `CONTRADICTED` |
| `currentPrincipalRevision` | `liveMaterial.currentPrincipalRevision` [S4][S5] | non-empty string | Must equal exact string `principalAuthEpoch:${currentPrincipalAuthEpoch}` [S4] | No conversion; exact relational validation | Missing → `UNKNOWN`; wrong type → `INVALID`; relational mismatch → `CONTRADICTED` |

### Normative `bindingRef` mapping

The chain established by current source is:

```text
authEventSessionBinding.bindingRef
→ assessCurrentRequestBinding().sourceMaterial.bindingRef
→ live authenticatedPrincipalSourceMaterial.bindingRef
```

The proposal maps that exact value to:

```text
provenance.authEventSessionBindingRef
digestMaterial.authEventSessionBindingRef
```

Therefore:

```text
authEventSessionBindingRef
  = liveMaterial.bindingRef
```

This is a direct field rename in the new output schema, not a new identity and not a name-based inference. The value is preserved verbatim.

## 6.3 Non-claim mappings

All are **PROPOSED SEMANTICS** constants:

| Field | Source | Type/value | Validation | Transformation | Failure |
|---|---|---|---|---|---|
| `principalEligibilityCreated` | Contract constant | boolean `false` | Exact false | None | Non-false → `REJECTED` |
| `roleCreated` | Contract constant | boolean `false` | Exact false | None | `REJECTED` |
| `delegationCreated` | Contract constant | boolean `false` | Exact false | None | `REJECTED` |
| `humanGateCreated` | Contract constant | boolean `false` | Exact false | None | `REJECTED` |
| `governancePackageCreated` | Contract constant | boolean `false` | Exact false | None | `REJECTED` |
| `effectAuthorizationCreated` | Contract constant | boolean `false` | Exact false | None | `REJECTED` |
| `offerMutationPerformed` | Contract constant | boolean `false` | Exact false | None | `REJECTED` |

---

# 7. Exact digest material mapping

Namespace:

```text
gt63-evidence:aya-authenticated-principal:{sha256-hex}
```

The digest excludes `principalEvidenceRef` itself.

| Digest field | Exact source | Type | Validation | Transformation | Missing/invalid behavior |
|---|---|---|---|---|---|
| `type` | Same contract constant as output | string | Exact proposed evidence type | None | `INVALID` |
| `schemaVersion` | Same contract constant as output | string | Exact `"1.0"` | None | `INVALID` |
| `rulesetVersion` | Same contract constant as output | string | Exact proposed ruleset | None | `INVALID` |
| `principalRef` | Same accepted value used by `output.principalRef` | string | Binding/query/canonical-subject checks completed | None | No digest/evidence |
| `principalRevision` | Same accepted value used by `output.principalRevision` | string | Exact durable revision | None | No digest/evidence |
| `agencyId` | Same accepted value used by `provenance.agencyId` | string | Three-source exact match | None | No digest/evidence |
| `applicationUserId` | Same accepted value used by `provenance.applicationUserId` | string | Three-source exact match | None | No digest/evidence |
| `principalBindingEvidenceRef` | Same verbatim provenance value | string | Upstream binding validation accepted | None | No digest/evidence |
| `authEventSessionBindingRef` | Same verbatim value mapped from `liveMaterial.bindingRef` | string | Fresh upstream auth/session binding accepted | Direct field rename only | No digest/evidence |
| `authenticationEventIdentity` | Same verbatim provenance value | string | Live source accepted | None | No digest/evidence |
| `aClassEvidenceIdentity` | Same verbatim provenance value | string | A-class/session provenance accepted | None | No digest/evidence |
| `aClassEvidenceRevision` | Same verbatim provenance value | string `"1"` | Exact type/value check | None | No digest/evidence |
| `sessionRef` | Same verbatim provenance value | string | Current binding/session match | None | No digest/evidence |
| `sessionVersion` | Same verbatim provenance value | string | Upstream current-version validation | None | No digest/evidence |
| `observedPrincipalAuthEpoch` | Same provenance value | positive-decimal string | Exact epoch/currentness validation | None | No digest/evidence |
| `currentPrincipalAuthEpoch` | Same provenance value | positive-decimal string | Exact epoch/currentness validation | None | No digest/evidence |
| `observedPrincipalRevision` | Same provenance value | string | Exact relation to observed epoch | None | No digest/evidence |
| `currentPrincipalRevision` | Same provenance value | string | Exact relation to current epoch | None | No digest/evidence |
| `bindingLifecycleState` | `validatedBinding.record.bindingLifecycleState` [S8] | string enum | Must equal `"CURRENT"` | Verbatim copy | Missing → `UNKNOWN`; wrong type → `INVALID`; other value → `UNKNOWN` |
| `bindingFreshnessState` | `validatedBinding.record.bindingFreshnessState` [S8] | string enum | Must equal `"CURRENT"` | Verbatim copy | Missing → `UNKNOWN`; wrong type → `INVALID`; other value → `UNKNOWN` |
| `bindingContradictionState` | `validatedBinding.record.contradictionState` [S8] | string enum | Must equal `"NONE"` | **Proposed field rename only:** `record.contradictionState → bindingContradictionState`; verbatim value | Missing → `UNKNOWN`; wrong type → `INVALID`; non-`NONE` → `CONTRADICTED` |
| `authenticationLifecycleState` | `liveMaterial.lifecycleState` [S4][S5] | string enum | Must equal `"CURRENT"` | **Proposed field rename only**; verbatim copy | Missing → `UNKNOWN`; wrong type → `INVALID`; non-current → no evidence |
| `authenticationFreshnessState` | `liveMaterial.freshnessState` [S4][S5] | string enum | Must equal `"CURRENT"` | **Proposed field rename only**; verbatim copy | Missing → `UNKNOWN`; wrong type → `INVALID`; non-current → no evidence |
| `authenticationContradictionState` | `liveMaterial.contradictionState` [S4][S5] | string enum | Must equal `"NONE"` | **Proposed field rename only**; verbatim copy | Missing → `UNKNOWN`; wrong type → `INVALID`; non-`NONE` → `CONTRADICTED` |
| `authority` | Same contract constant as output | string `"NONE"` | Both accepted inputs also have authority `NONE` | None | Mismatch → `REJECTED` |
| `authorityEffect` | Same contract constant as output | string `"NONE"` | Both applicable inputs have effect `NONE` | None | Mismatch → `REJECTED` |

## 7.1 Binding-state precision

Exact mappings:

```text
digest.bindingLifecycleState
  = validatedBinding.record.bindingLifecycleState

digest.bindingFreshnessState
  = validatedBinding.record.bindingFreshnessState

digest.bindingContradictionState
  = validatedBinding.record.contradictionState
```

`bindingContradictionState` is a disambiguating name introduced only in the new digest schema. Its value is not derived or translated; it is the verbatim validated value of `record.contradictionState`.

## 7.2 Authentication-state precision

Exact mappings:

```text
digest.authenticationLifecycleState
  = liveMaterial.lifecycleState

digest.authenticationFreshnessState
  = liveMaterial.freshnessState

digest.authenticationContradictionState
  = liveMaterial.contradictionState
```

These are copies from the validated live source material. They are not created by the admission assessment.

Separately:

```text
output.lifecycleState      = "CURRENT"
output.freshnessState      = "CURRENT"
output.contradictionState  = "NONE"
```

are admission-result constants emitted only after both evidence surfaces and all cross-checks succeed.

Missing input state is never replaced with an output constant.

---

# 8. Type and revision-domain rules

| Field | Normative type | Allowed value/domain | Admission coercion |
|---|---|---|---|
| `observedPrincipalAuthEpoch` | string | Positive base-10 integer without sign, decimal point or leading zero | None |
| `currentPrincipalAuthEpoch` | string | Positive base-10 integer without sign, decimal point or leading zero | None |
| `sessionVersion` | string | Non-empty upstream session-version string | None |
| `aClassEvidenceRevision` | string | Current V0 source value `"1"` | None |
| `principalRevision` | string | Durable binding revision domain; Binding #1 is `aya-principal-binding-revision:1` | None |
| `observedPrincipalRevision` | string | `principalAuthEpoch:${observedPrincipalAuthEpoch}` | None |
| `currentPrincipalRevision` | string | `principalAuthEpoch:${currentPrincipalAuthEpoch}` | None |

Current upstream code explicitly converts:

- A-class revision to string [S2];
- session version to string [S2];
- observed auth epoch to string [S2];
- current auth epoch to canonical positive-integer string [S4].

The admission contract consumes the resulting live-source strings. It performs no further number/string coercion.

Thus:

```text
1 !== "1"
```

at the admission boundary. A numeric value where the mapping requires a string is `INVALID`, even if JavaScript could coerce it.

Revision domains remain distinct:

```text
principalRevision
≠ observedPrincipalRevision
≠ currentPrincipalRevision
≠ aClassEvidenceRevision
≠ sessionVersion
```

---

# 9. Serialization and exact identity rules

Before hashing:

1. All mapped values must already be present and valid.
2. Only the exact digest fields in §7 are used.
3. Object keys are recursively sorted.
4. Array order is preserved.
5. Strings are preserved exactly.
6. No NFC, NFD, case folding or locale transformation is applied.
7. Unpaired UTF-16 surrogates produce `INVALID`.
8. `undefined`, functions, symbols and non-finite numbers produce `INVALID`.
9. Deterministic JSON is encoded as UTF-8.
10. SHA-256 is rendered as lower-case hexadecimal.

Example:

```text
A = "é"   = U+00E9
B = "é"  = U+0065 U+0301
```

Results:

```text
A !== B

digest(material containing A)
  !==
digest(material containing B)
```

Upstream references are preserved verbatim and are not recomputed under the new serialization rule.

---

# 10. Currentness, lifetime and producer boundary

Every `authenticatedPrincipalPort` call:

- reads a new snapshot;
- performs a new live assessment;
- validates current session and epoch;
- validates the current durable binding;
- constructs a new evidence object;
- never reuses a prior result.

Evidence validity begins after all checks succeed and ends when the enclosing synchronous consumer evaluation returns.

```text
NO CACHE
NO REUSE ACROSS PORT CALLS
NO REUSE ACROSS CONSUMER EVALUATIONS
```

The object’s `CURRENT/CURRENT/NONE` fields do not mutate automatically afterward.

The unchanged consumer cannot independently distinguish fresh conforming output from a stale object returned by a non-conforming port. Freshness therefore depends on exclusive producer ownership and conforming wiring.

A bare `principalEvidenceRef` identifies material but never proves current validity.

`contextScope`:

- is structurally validated as query input;
- is query-only;
- is excluded from output identity;
- is excluded from digest material;
- creates no eligibility or authority.

---

# 11. Complete fail-closed table

| Condition | Internal outcome | Port result |
|---|---:|---:|
| Malformed query or unsupported scope | `INVALID` | `null` |
| Missing required property | `UNKNOWN` | `null` |
| Required property has wrong type | `INVALID` | `null` |
| Unpaired surrogate | `INVALID` | `null` |
| Unsupported serialization value | `INVALID` | `null` |
| `readDb` unavailable/throws | `UNKNOWN` | `null` |
| DB snapshot/collection unavailable | `UNKNOWN` | `null` |
| Current account unavailable | `UNKNOWN` | `null` |
| Multiple matching accounts | `CONTRADICTED` | `null` |
| Live assessment unavailable/unknown | `UNKNOWN` | `null` |
| Live material incomplete | `UNKNOWN` | `null` |
| Session binding unavailable | `UNKNOWN` | `null` |
| Session signature invalid | `REJECTED` | `null` |
| Session expired | `REJECTED` | `null` |
| Beta bypass present | `REJECTED` | `null` |
| Session version mismatch | `REJECTED` | `null` |
| Request/session/account mismatch | `REJECTED` | `null` |
| Auth epoch unavailable | `UNKNOWN` | `null` |
| Auth epoch wrong type | `INVALID` | `null` |
| Auth epoch positive mismatch | `REJECTED` | `null` |
| Epoch revision relation invalid | `CONTRADICTED` | `null` |
| A-class provenance unavailable | `UNKNOWN` | `null` |
| A-class revision wrong type | `INVALID` | `null` |
| A-class revision unsupported | `REJECTED` | `null` |
| Durable binding unavailable | `UNKNOWN` | `null` |
| Multiple current bindings | `CONTRADICTED` | `null` |
| Binding state missing | `UNKNOWN` | `null` |
| Binding state wrong type | `INVALID` | `null` |
| Binding lifecycle/freshness non-current | `UNKNOWN` | `null` |
| Binding contradiction positive | `CONTRADICTED` | `null` |
| Binding identity mismatch | `CONTRADICTED` | `null` |
| Live/binding/account subject mismatch | `CONTRADICTED` | `null` |
| Query principal mismatch | `REJECTED` | `null` |
| Query principal revision mismatch | `REJECTED` | `null` |
| Authentication state missing | `UNKNOWN` | `null` |
| Authentication state wrong type | `INVALID` | `null` |
| Authentication state non-current | propagated `UNKNOWN`/`REJECTED` | `null` |
| Authentication contradiction positive | `CONTRADICTED` | `null` |
| Upstream evidence ref missing | `UNKNOWN` | `null` |
| Upstream evidence ref wrong type | `INVALID` | `null` |
| Composition digest failure | `INVALID` | `null` |
| Supplied/computed ref mismatch | `CONTRADICTED` | `null` |
| Authority/effect mismatch | `REJECTED` | `null` |
| All checks succeed | `ACCEPTED` | Complete evidence |

```text
UNKNOWN does not become REJECTED without positive mismatch evidence.
No non-ACCEPTED path produces evidence.
```

---

# 12. Compatibility with the unchanged consumer

The existing consumer requires:

```text
principalRef exact match
principalRevision exact match
non-empty principalEvidenceRef
lifecycleState = CURRENT
freshnessState = CURRENT
contradictionState = NONE
authority = NONE
```

The proposed output satisfies those fields without changing consumer semantics [S10].

Additional provenance and non-claim fields are permitted because the consumer does not require an exact output field set.

No eligibility assessment is performed by this contract or this inspection.

---

# 13. Updated verification criteria

A future implementation must prove:

## Snapshot

1. Exactly one physical `readDb()` per port call.
2. Account and binding derive from the same object.
3. No ledger lookup triggers another DB read.
4. Read-only view exposes no `commit` or writer.
5. Snapshot/view mutation fails closed.
6. No DB mutation occurs.

## Field completeness

7. Every output field is covered by §6.
8. Every provenance field is covered by §6.2.
9. Every digest field is covered by §7.
10. Every field source is either a validated property or explicit constant.
11. No undefined variable enters output or digest.
12. No hidden default supplies a missing value.
13. Output and digest reuse the same accepted mapped values.
14. No field is independently reread after mapping.

## Specific mappings

15. `bindingRef → authEventSessionBindingRef` preserves the exact string.
16. Output and digest use the same `authEventSessionBindingRef`.
17. `record.contradictionState → bindingContradictionState` preserves the exact value.
18. Authentication state fields copy the exact validated live values.
19. Admission output states are produced only after component-state validation.
20. Missing component state is not replaced with `CURRENT` or `NONE`.

## Types and revisions

21. Epochs are positive-decimal strings.
22. `sessionVersion` is a string.
23. `aClassEvidenceRevision` is string `"1"`.
24. `principalRevision` is the durable binding revision.
25. Epoch revisions exactly correspond to their epoch strings.
26. No admission number/string coercion occurs.
27. All revision domains remain distinct.

## Authentication and provenance

28. Every port call performs fresh live assessment.
29. Session signature, expiry and bypass exclusion are checked.
30. Request/session/account subjects match.
31. Session version is current.
32. Observed and current epochs match.
33. A-class identity/revision remain bound through the validated session binding.
34. Missing provenance produces no principal.

## Binding

35. Exactly one current subject binding is required.
36. Envelope and record are revalidated.
37. Binding evidence reference remains verbatim.
38. Binding subject matches account and live source.
39. Binding #1 is not modified or recreated.
40. Binding currentness is not substituted for authentication currentness.

## Evidence identity and Unicode

41. `principalBindingEvidenceRef` is not reused as `principalEvidenceRef`.
42. Only the exact digest material is hashed.
43. Identical exact material gives the same ref.
44. Any exact material change changes the ref.
45. Upstream identities remain verbatim.
46. No Unicode normalization occurs.
47. Canonically equivalent but differently encoded strings compare unequal.
48. They produce different composition digests.
49. Unpaired surrogates produce `INVALID`.
50. Unsupported JSON values produce no evidence.
51. Serialization and UTF-8 encoding are deterministic.

## Lifetime and port behavior

52. Every port call performs a new admission.
53. No result is cached.
54. No result is reused across evaluations.
55. A prior object cannot enter the producer as evidence input.
56. A bare evidence ref cannot establish currentness.
57. The consumer freshness-enforcement limitation remains explicit.
58. Only the exclusive producer emits this evidence type.
59. `ACCEPTED` returns complete evidence.
60. Every other result returns `null`.

## Fail-closed and authority

61. Missing data remains `UNKNOWN`.
62. Wrong type becomes `INVALID`.
63. Positive mismatch is not treated as missing.
64. Positive contradiction produces `CONTRADICTED`.
65. Partial evidence is never returned.
66. `contextScope` creates no authority.
67. Authority remains `NONE`.
68. Authority effect remains `NONE`.
69. Every downstream non-claim remains false.
70. No eligibility or downstream governance artifact is created.

---

# 14. Human-acceptance decisions

All decisions remain unresolved.

1. Accept the proposed input topology.
2. Accept the output schema and evidence type.
3. Accept the proposed schema and ruleset identifiers.
4. Accept exactly one authoritative snapshot per admission.
5. Accept the snapshot-bound read-only adapter boundary.
6. Accept account and binding derivation from the same snapshot.
7. Accept durable binding `principalRef` as principal identity.
8. Accept durable binding `principalRevision` as consumer-facing revision.
9. Accept `principalAuthEpoch` as a separate currentness domain.
10. Accept the proposed `principalEvidenceRef` namespace.
11. Accept the exact digest material.
12. Accept the deterministic serialization rule.
13. Accept exact Unicode identity semantics without normalization.
14. Accept `INVALID` for unpaired surrogates.
15. Accept verbatim preservation of upstream identities.
16. Accept distinct binding and authenticated-principal evidence identities.
17. Accept `contextScope` as query-only and outside evidence identity.
18. Accept validated auth-event/session binding as sufficient minimum A-class provenance.
19. Accept the derived ephemeral evidence model.
20. Accept no persistence in V0.
21. Accept exclusive producer ownership.
22. Accept a new admission for every port call.
23. Accept no cache or reuse.
24. Accept validity only within the enclosing synchronous consumer evaluation.
25. Accept the consumer freshness-enforcement limitation.
26. Accept the proposed outcome classifications.
27. Accept `null` for every non-`ACCEPTED` port result.
28. Accept fixed `authority: "NONE"` and `authorityEffect: "NONE"`.
29. Accept all downstream non-claims.
30. Accept the direct, verbatim `bindingRef → authEventSessionBindingRef` mapping.
31. Accept the exact field types, revision-domain validations and prohibition on admission-level implicit coercion.
32. Accept the distinction between copied component-state fields in digest material and admission-produced top-level `CURRENT/CURRENT/NONE`.

---

# 15. Concrete change report

This precision revision adds:

- a complete normative mapping for every output, provenance, non-claim and digest field;
- exact source properties and current-source references;
- the proven identity chain behind `bindingRef`;
- the proposed verbatim rename to `authEventSessionBindingRef`;
- exact binding-state mappings;
- exact authentication-state mappings;
- separation between copied input states and admission-produced output states;
- exact field types for all revision and epoch domains;
- an explicit prohibition on admission-level number/string coercion;
- complete missing/invalid/mismatch classifications;
- verification criteria for field completeness and output/digest consistency;
- three additional human decisions created by the mapping precision.

```text
PROPOSAL STATUS: NOT ACCEPTED
IMPLEMENTATION AUTHORIZED: NO
RUNTIME EVIDENCE CREATED: NO

BINDING #1: PROVEN AND CLOSED
BINDING MATERIALIZATION REOPENED: NO

ELIGIBILITY ASSESSED OR CREATED: NO
ROLE CREATED: NO
DELEGATION CREATED: NO
HUMAN GATE CREATED: NO
GOVERNANCE PACKAGE CREATED: NO
EFFECT AUTHORIZATION CREATED: NO
OFFER MUTATION PERFORMED: NO

MACHINE AUTHORITY: NONE
authorityEffect: NONE
```