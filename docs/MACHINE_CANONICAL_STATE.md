# GT63 MACHINE — CANONICAL STATE INDEX

> Status: BOOTSTRAP / NAVIGATION INDEX
>
> This file is an index into repository evidence. It is **not** itself a substitute for Git objects, validation artifacts, or runtime evidence.
>
> **SUMMARY ≠ EVIDENCE**  
> **MEMORY ≠ CANONICAL PROJECT STATE**

## 1. Authoritative repository baseline at bootstrap

- Repository: `goceterziev-creator/2l1p-neural-travel-v9`
- Authoritative ref: `refs/heads/main`
- Verified main commit at bootstrap: `ad76351972ec0805a01349fec584a7e3c34e535d`
- Verified main tree at bootstrap: `82f90e7bb35a90af151fb61552674e4f0457745b`
- Bootstrap branch for this index: `docs/machine-canonical-state-bootstrap`

`LAST_VERIFIED_AGAINST_REPOSITORY` is represented by an exact commit/tree identity, not by a date alone.

## 2. Proven formal governance ancestry subset

The following sequence is established as direct Git commit-parent ancestry:

```text
Runtime Result / Output Observation V0
9924650c9e8e0c143c3db02af8b0d5015a3126bc
        │ direct child
        ▼
Authenticated Human Principal / Source Event Binding V0
45b5954cf7b4253718cfb2f8ce09b15749dcd060
        │ direct child
        ▼
Accepted Governance Role Policy / Assignment / Delegation Evidence V0
d1c6d25e5326c8ca88e2029b60350ead8aa657c0
        │ direct child
        ▼
Repository-Frozen Governance Trust Root V0
5e05bda344a20161052f8c1ed579e02b5f0e0720
 tree c32158e4d70be6c7fc30c0943986905a2e03e800
```

For this subset, the archaeology status is:

- `SURVIVED`
- `IMPLEMENTED`
- `INTEGRATED`

This section is a proven governance ancestry subset, **not a claim that `5e05bda...` is the current `main` head or the last capability integrated into the repository**.

### Trust boundary invariants

> **REPOSITORY PRESENCE ≠ TRUST**
>
> **VERIFIED FROZEN TRUST SOURCE ≠ OPERATIONAL AUTHORITY**
>
> `repository state ≠ trusted governance evidence ≠ authority`

The Trust Root verifies exact Git `ref → commit → tree → blob → canonical bytes`, while the governance result remains `authority: NONE`.

## 3. Principal Eligibility Assessment V0

Current archaeology classification:

- `IMPLEMENTED`
- `VALIDATED`
- `EXACT-BYTE PRESERVED`
- `NON-INTEGRATED`
- frozen candidate tree: `4683c53ddfcc7053a0e4908f00f4344aa635be4b`

Principal Eligibility constructively preserves:

```text
humanAuthorizationCreated: false
humanGateSatisfied: false
continuationAuthorityCreated: false
executionAuthorityCreated: false
authority: NONE
```

Canonical boundary:

> **PRINCIPAL ELIGIBLE TO AUTHORIZE ≠ AUTHORIZATION OCCURRED**

## 4. Current semantic archaeology frontier

### Authenticated Governance Authorization Binding V0

Status:

- `FIRST SEEN`
- `CONCEPT / DISCOVERED SEMANTIC BOUNDARY`
- `NOT IMPLEMENTED`

Missing truth claim:

> Given an authenticated event, a known principal, principal eligibility for `GATE_AUTHORIZATION`, and an approval statement resolved to a specific pending Gate, establish whether **that exact event is a valid exercise of that eligibility over that exact Gate**.

Canonical invariants:

> **AUTHENTICATED APPROVAL EVENT ≠ VALID GOVERNANCE AUTHORIZATION**
>
> **ELIGIBLE PRINCIPAL ≠ AUTHORIZING PRINCIPAL EVENT**
>
> **CONTEXT-BOUND APPROVAL ≠ ELIGIBILITY-BOUND AUTHORIZATION**
>
> **VALID AUTHORIZATION ≠ GATE SATISFACTION**
>
> **VALID AUTHORIZATION ≠ CONTINUATION AUTHORITY**

Current conceptual path:

```text
authenticated event
        │
        ├─ principal identity
        ├─ approval / referent resolution
        └─ principal eligibility
                │
                ▼
Authenticated Governance Authorization Binding V0
                │
                ▼
valid authorization
                │
                ▼
Human Gate SATISFIED
                │
                ▼
continuation authority
```

**Semantic frontier ≠ accepted implementation frontier.**

Discovery of this boundary creates no implementation, gate, continuation, execution, merge, or deployment authority.

## 5. Open archaeology / prohibited inference

`Current Governance Evidence Set Resolution V0` remains:

- `FIRST SEEN`
- `CONCEPT ONLY`

The exact implementation/transition by which its prerequisite boundary was overcome before construction of the frozen Principal Eligibility candidate has not been proven by the currently recorded evidence.

Therefore:

> **Current Governance Evidence Set Resolution → Principal Eligibility = ANCESTOR UNKNOWN**

Do not infer the missing transition from the existence of a later descendant/candidate.

## 6. Maintenance protocol

The purpose of this file is to make cross-chat and cross-agent continuity depend on repository evidence rather than conversational memory.

### Roles

- **Human Authority (Goce):** approves authority-bearing repository mutations and decides disputed archaeology.
- **Architecture / State Keeper (Atanas / ChatGPT):** synchronizes from repository evidence, compares new evidence with the current canonical state, proposes/applies bounded state deltas when authorized, and preserves unknowns rather than filling gaps by inference.
- **Bounded Executor (Goshko / Codex or other authorized executor):** performs only the explicitly authorized discovery, validation, construction, or integration operation and returns exact evidence identities.
- **Git / repository evidence:** technical evidence substrate.
- **This file:** navigation index over that evidence, never a replacement for it.

Role labels are workflow responsibilities only. They do not themselves create MACHINE governance authority.

### New-chat synchronization

When beginning or resuming MACHINE work:

```text
NEW CHAT
  → READ MACHINE_CANONICAL_STATE FIRST
  → RESOLVE authoritative refs from repository
  → VERIFY current main commit/tree
  → COMPARE current repository state with recorded state
  → PRESERVE contradictions/unknowns
  → CONTINUE only from evidenced state
```

Canonical rule:

> **NEW CHAT → READ CANONICAL STATE FIRST**

Conversational memory may help locate evidence, but it must not override contradictory repository evidence.

### Evidence precedence

For technical project state:

```text
repository / immutable artifact evidence
        > canonical navigation summary
        > conversational memory
```

This precedence is not a claim that Git proves semantic truth by itself. Evidence still has to be interpreted according to its type and scope.

### State-update workflow

For each materially new discovery, validation, candidate, integration, contradiction, or frontier change:

```text
NEW EVIDENCE
  → identify exact source identity
  → compare against current canonical state
  → derive minimal STATE DELTA
  → preserve unresolved claims explicitly
  → update current-state sections if warranted
  → append an audit delta when warranted
  → read back and verify the resulting repository object
  → verify authoritative main remains unchanged unless its mutation was explicitly authorized
```

Canonical rules:

> **NEW EVIDENCE → APPLY DELTA, DO NOT RECONSTRUCT FROM MEMORY**
>
> **NO STATE CHANGE WITHOUT SOURCE IDENTITY**

A chat statement, summary, filename, or remembered claim alone is not sufficient technical source identity.

### Minimum source identity

A technical state change should point to the strongest applicable evidence identity, for example:

- authoritative commit + tree;
- candidate tree / blob identity;
- exact artifact SHA-256;
- validation identity and result;
- repository path + Git object identity;
- other bounded immutable evidence anchor appropriate to the claim.

Dates alone are not evidence of artifact chronology or identity.

### STATE DELTA format

```text
MACHINE_STATE_DELTA

BASELINE_BEFORE:
  main_commit: <exact commit>
  main_tree: <exact tree>

SOURCE_IDENTITY:
  <exact evidence anchors>

NEW_EVIDENCE:
  <capability / finding / artifact identity>

STATUS_CHANGE:
  from: <prior status or NONE>
  to: <new evidenced status>

FRONTIER_CHANGE:
  accepted_frontier: <unchanged | exact change>
  implementation_frontier: <unchanged | exact change>
  semantic_frontier: <unchanged | exact change>

NEW_INVARIANTS:
  - <new evidenced invariant or NONE>

UNRESOLVED:
  - <unknown / contradiction / prohibited inference>

AUTHORITY_CREATED: NONE | <explicitly evidenced authority>
MAIN_MUTATED: false | true
```

A state delta is an indexing/update proposal. Its claims remain subordinate to the underlying evidence.

### Human Gate for maintenance

Reading/synchronizing the canonical state does not create mutation authority. Repository writes, branch/ref changes, PRs, merges, and deployments remain bounded by their separately granted authority.

Maintenance of this index must never be interpreted as authorization to implement the capability it describes.

> **STATE RECORDING ≠ IMPLEMENTATION AUTHORITY**
>
> **FRONTIER DISCOVERY ≠ IMPLEMENTATION AUTHORITY**

## 7. Core preservation rules

> **OBSERVED DESCENDANT ≠ PROVEN TRANSITION PATH**
>
> **CONFIGURED POLICY ≠ ENFORCED RUNTIME BEHAVIOR**
>
> **UPSTREAM FIXED ≠ FIX DEPLOYED IN TARGET RUNTIME**

The latter two are general runtime-evidence cautions: declared/configured state does not prove enforced behavior, and an upstream fix does not prove presence in the target runtime.

---

Bootstrap authority: bounded creation and maintenance-protocol definition on a non-main branch only.  
No merge, no movement of `main`, no deploy.