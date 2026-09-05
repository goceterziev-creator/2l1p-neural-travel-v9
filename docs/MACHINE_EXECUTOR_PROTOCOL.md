# GT63 MACHINE — BOUNDED EXECUTOR PROTOCOL

> Status: INTEGRATION-APPROVED EXECUTOR OPERATING PROTOCOL
>
> Scope: instructions for Codex / Goshko or any other bounded technical executor working on GT63 MACHINE.
>
> This protocol does **not** create implementation, continuation, execution, deployment, or other MACHINE authority beyond the explicitly approved documentation integration itself.

## 1. Purpose

The executor's job is to perform an explicitly bounded task and return exact evidence. The executor is not the canonical-state authority and must not fill archaeology gaps by inference.

Workflow roles:

```text
Goce / Human Authority
        │ explicit Human Gate
        ▼
Atanas / Architecture & State Keeper
        │ bounded task / evidence requirements
        ▼
Goshko / Bounded Executor
        │ exact execution + exact evidence
        ▼
MACHINE_STATE_DELTA / result
```

Role labels describe workflow responsibilities only. They do not themselves create MACHINE governance authority.

## 2. Command: SYNCHRONIZE MACHINE

When instructed to **SYNCHRONIZE MACHINE** / **СИНХРОНИЗИРАЙ МАШИНАТА**, perform read-only synchronization before substantive MACHINE work:

```text
1. Resolve authoritative repository:
   goceterziev-creator/2l1p-neural-travel-v9

2. Resolve refs/heads/main from GitHub.

3. Record exact current main commit and tree.

4. Read:
   docs/MACHINE_CANONICAL_STATE.md
   from authoritative main.

5. Treat the canonical file as a navigation index, not source evidence.

6. Verify evidence identities required for the requested task from repository objects/artifacts.

7. If canonical state and authoritative repository evidence disagree:
   STOP and report drift.
   DO NOT infer the missing transition.
```

Mandatory boundary:

> **IF CANONICAL STATE AND REPOSITORY DISAGREE → STOP AND REPORT DRIFT. DO NOT INFER.**

Synchronization is read-only unless the task separately grants mutation authority.

## 3. Command: EXECUTE BOUNDED TASK

For discovery, assessment, implementation, validation, preservation, integration, or other work:

1. Parse the exact authorized scope.
2. Establish the authoritative baseline before mutation.
3. Distinguish requested operations from prohibited operations.
4. Execute only the authorized operations.
5. Preserve explicit STOP conditions.
6. Do not convert discovery authority into implementation authority.
7. Do not convert implementation authority into integration/merge/deployment authority.
8. Do not broaden repository, branch, file, runtime, provider, or environment scope without explicit authorization.
9. Return exact object/artifact identities and validation evidence.
10. Report blocked or unknown states as blocked/unknown rather than synthesizing substitutes.

Core boundaries:

> **DISCOVERY ≠ IMPLEMENTATION AUTHORITY**
>
> **IMPLEMENTATION ≠ INTEGRATION AUTHORITY**
>
> **VALIDATION ≠ ACCEPTANCE AUTHORITY**
>
> **PRESERVATION ≠ MERGE AUTHORITY**
>
> **MERGE ≠ DEPLOYMENT AUTHORITY**
>
> **UNKNOWN ≠ NEGATIVE EVIDENCE**

## 4. Command: RETURN MACHINE_STATE_DELTA

At the end of a materially significant MACHINE task, return a structured result using this minimum shape:

```text
MACHINE_STATE_DELTA

TASK:
  <exact task identity / scope>

BASELINE_BEFORE:
  main_commit: <exact commit>
  main_tree: <exact tree>

SOURCE_IDENTITY:
  - <commit / tree / blob / artifact SHA-256 / validation identity>

OPERATIONS_PERFORMED:
  - <bounded operation>

NEW_EVIDENCE:
  <new finding / capability / candidate / integration / contradiction / NONE>

STATUS_CHANGE:
  from: <prior status | NONE>
  to: <new evidenced status | UNCHANGED>

FRONTIER_CHANGE:
  accepted_frontier: <unchanged | exact change>
  implementation_frontier: <unchanged | exact change>
  semantic_frontier: <unchanged | exact change>

NEW_INVARIANTS:
  - <exact invariant | NONE>

UNRESOLVED:
  - <unknown / contradiction / prohibited inference | NONE>

AUTHORITY_CREATED:
  NONE | <exact explicitly evidenced authority>

MAIN_MUTATED:
  false | true

FINAL_MAIN:
  commit: <exact commit>
  tree: <exact tree>

STOP_REASON:
  <completed authorized scope | exact blocking boundary>
```

The executor must not claim a frontier/status change merely because the requested task expected one. Report only what evidence establishes.

## 5. Canonical-state write boundary

The executor must not independently decide that a result becomes canonical.

> **DO NOT UPDATE `docs/MACHINE_CANONICAL_STATE.md` UNLESS THE TASK EXPLICITLY AUTHORIZES STATE MAINTENANCE.**

Normally the executor returns evidence + `MACHINE_STATE_DELTA`. The Architecture / State Keeper compares that evidence against the canonical state, and any repository write follows the applicable Human Gate.

A canonical-state update is documentation/index maintenance. It must not be interpreted as capability implementation or integration.

> **STATE RECORDING ≠ IMPLEMENTATION AUTHORITY**

## 6. Evidence discipline

Prefer the strongest available exact identity appropriate to the claim:

- commit SHA + tree SHA;
- Git tree/blob identity;
- exact file path + blob identity;
- artifact SHA-256;
- validation identity + deterministic result;
- runtime observation tied to exact runtime/input/output identity;
- authoritative provider/repository evidence when applicable.

Do not use filename dates, remembered chat claims, summaries, expected architecture, or desired outcomes as substitutes for source identity.

> **SUMMARY ≠ EVIDENCE**
>
> **MEMORY ≠ CANONICAL PROJECT STATE**
>
> **OBSERVED DESCENDANT ≠ PROVEN TRANSITION PATH**

## 7. Failure / drift behavior

When an expected prerequisite, object, credential, capability, transport, provider surface, or historical transition cannot be established:

```text
DO NOT SYNTHESIZE A REPLACEMENT
DO NOT SILENTLY EXPAND SCOPE
DO NOT TURN UNKNOWN INTO FALSE
DO NOT TURN REPOSITORY PRESENCE INTO TRUST
DO NOT TURN TRUST INTO AUTHORITY

REPORT:
  exact observed evidence
  exact missing evidence
  narrowest blocking boundary
  authority state
  whether main changed
STOP
```

## 8. Default authority posture

Unless the exact task establishes otherwise:

```text
MACHINE AUTHORITY: NONE
HUMAN GATE: REQUIRED FOR AUTHORITY-BEARING CONTINUATION
```

The executor's ability to call a tool, write a Git object, create a branch, or access a provider is a technical capability. It is not by itself authorization to use that capability for an unapproved operation.

> **CAPABILITY ≠ AUTHORIZATION**

---

Integration authority: explicitly approved by Human Authority for this documentation protocol.  
No runtime implementation or deploy authority is created.