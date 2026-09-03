# EDGE01 INDEPENDENT VERIFIER PROTOCOL V0

**Status:** CANDIDATE CONTRACT  
**Implementation Authority:** NONE  
**Repository Mutation Authority:** NONE  
**Verification Authority:** OBSERVE / EXECUTE BOUNDED VERIFICATION / REPORT  
**Change Authority:** NONE

## 1. Purpose
EDGE01 е независим verifier node, чиято задача е да провери определен Git target, без да използва working state-а на системата, която проверява.

> **VERIFIER STATE ≠ SUBJECT STATE**

> **INDEPENDENT VERIFICATION SHOULD NOT SHARE THE SAME WORKING STATE AS THE SYSTEM IT VERIFIES.**

EDGE01 не доказва „цялата MACHINE“. Той произвежда bounded evidence за точно определен target и точно определени verification surfaces.

## 2. Required Inputs
Всеки verification run трябва да е обвързан поне с:

- `repositoryIdentity`
- `targetCommit`
- `verifierBaselineCommit`
- `verificationProtocolVersion`
- `runtimeIdentity`
- `verificationSurfaces[]`

Reference execution:

- repositoryIdentity: `goceterziev-creator/2l1p-neural-travel-v9`
- targetCommit: `5e05bda344a20161052f8c1ed579e02b5f0e0720`
- verifierBaselineCommit: `881e9a8a02de2e22ce0941deaf71d7cff9aa346d`
- runtimeIdentity: `Android / Termux / aarch64 / Node v24.18.0`

## 3. Protocol Phases
0. IDENTIFY
1. BASELINE
2. RESOLVE TARGET
3. MATERIAL EVIDENCE
4. SAFETY PREFLIGHT
5. ISOLATED MATERIALIZATION
6. EXECUTE
7. OBSERVE
8. CLEANUP
9. BASELINE REVALIDATION
10. VERDICT
11. EVIDENCE RECORD

## 0 — IDENTIFY
Verifier записва device/node identity, architecture, runtime versions, protocol version и timestamp.

> **DEVICE LABEL ≠ CRYPTOGRAPHIC DEVICE IDENTITY**

`EDGE01` е operational label, не силна cryptographic machine identity.

## 1 — BASELINE
Преди изпълнение:

```bash
git rev-parse HEAD
git status --short
```

Изискване: baseline commit known и working tree clean.

Ако не е clean:

```text
VERIFICATION_STATUS = BLOCKED
CAUSE = VERIFIER_BASELINE_NOT_CLEAN
```

Не се clean-ва автоматично.

## 2 — RESOLVE TARGET
Target трябва да бъде exact Git commit:

```bash
git cat-file -t "$TARGET"
git show -s --format='%H%n%P%n%s' "$TARGET"
```

> **BRANCH NAME ≠ TARGET IDENTITY**

## 3 — MATERIAL EVIDENCE
За всяка verification surface:

- `implementationPath`
- `implementationBlob`
- `testPath`
- `testBlob`

> **PATH MATCH ≠ SEMANTIC MATCH**

> **TEST ARTIFACT EXISTS ≠ TEST PASSES**

## 4 — SAFETY PREFLIGHT
Преди execution verifier проверява test harness-а за очевидни network calls, filesystem writes, shell/subprocess execution, environment mutation, external tool invocation и repository mutation.

> **PATTERN MATCH ≠ SIDE EFFECT**

> **SIDE-EFFECT CAPABILITY ≠ SIDE-EFFECT EXECUTION**

Ако има finding → exact context inspection.

## 5 — ISOLATED MATERIALIZATION
Никакъв checkout върху verifier baseline.

```bash
git archive "$TARGET" | tar -x -C "$TMP"
```

Това създава `EPHEMERAL EXECUTION WORKSPACE`.

> **TARGET EXECUTION MUST NOT REQUIRE VERIFIER BASELINE REPLACEMENT**

## 6 — EXECUTE
Изпълняват се само предварително определените suites. За всяка се записват testPath, start, stdout/stderr, exitCode и result.

- exit 0 → PASS
- non-zero after actual execution → FAIL
- runtime/tool absent → BLOCKED

> **EXECUTION PREREQUISITE FAILURE ≠ TEST FAILURE**

## 7 — OBSERVE
Където е налично, записваме case count, validationIdentity, outputHash, deterministic status, authority status и suite identity.

## 8 — CLEANUP

```bash
rm -rf "$TMP"
```

Cleanup failure не се скрива.

## 9 — BASELINE REVALIDATION
След verification:

```bash
git rev-parse HEAD
git status --short
```

Трябва `HEAD_before == HEAD_after` и `working_tree_after == clean`.

## 10. Verdict Grammar
Допустими V0 verdict-и:

- `VERIFIED_PASS`
- `VERIFIED_FAIL`
- `BLOCKED`
- `INCONCLUSIVE`
- `VERIFIER_INTEGRITY_FAILURE`

`VERIFIED_PASS` изисква verified target identity, material evidence, accepted safety preflight, всички required suites да са executed+passed, cleanup да е completed и verifier baseline да е preserved.

`VERIFIED_FAIL` означава, че test действително е изпълнен и bounded acceptance condition не е удовлетворена.

`BLOCKED` покрива липсващ runtime, unavailable target, dependency или required test.

`INCONCLUSIVE` означава execution без достатъчно evidence за claim.

`VERIFIER_INTEGRITY_FAILURE` означава неочаквана промяна на verifier baseline/environment по време на run-а.

## 11. Result Record V0
Всеки run трябва да произвежда machine-readable JSON evidence object по `edge01-verifier-result.schema.json`.

Production result трябва да съдържа exact implementation/test blob IDs и output hashes за всяка suite, когато са налични.

## 12. Core Invariants
1. **VERIFIER STATE ≠ SUBJECT STATE**
2. **BRANCH NAME ≠ TARGET IDENTITY**
3. **PATH MATCH ≠ SEMANTIC MATCH**
4. **TEST EXISTS ≠ TEST EXECUTED**
5. **TEST EXECUTED ≠ TEST PASSED**
6. **EXECUTION PREREQUISITE FAILURE ≠ TEST FAILURE**
7. **PATTERN MATCH ≠ SIDE EFFECT**
8. **PASSING TEST ≠ WHOLE CAPABILITY PROVEN**
9. **VERIFICATION EVIDENCE ≠ CHANGE AUTHORITY**
10. **VERIFIER SUCCESS REQUIRES VERIFIER INTEGRITY PRESERVATION**
11. **EVERY VERIFICATION CLAIM MUST BE BOUND TO THE EXACT SUBJECT STATE THAT PRODUCED IT.**

## 13. Reference Execution — First Proven Run

**TARGET**  
`5e05bda344a20161052f8c1ed579e02b5f0e0720`

**VERIFIER BASELINE**  
`881e9a8a02de2e22ce0941deaf71d7cff9aa346d`

**RUNTIME**  
`EDGE01 / aarch64 / Node v24.18.0`

**MATERIAL PAIRS**  
`9/9`

**EXECUTION**  
`9/9 executed`

**RESULT**  
`9 PASS / 0 FAIL`

**POST-INTEGRITY**  
`HEAD unchanged / working tree clean`

**REFERENCE VERDICT**  
`VERIFIED_PASS`

---

This document is a candidate contract only. It grants no repository mutation, deployment, merge, push, or product-change authority.

## 14. Safety-Preflight Binding Manifest

V0 uses `edge01-verification-surfaces-v0.json` to bind an accepted execution-safety review to the **exact implementation and test Git blob identities** that were inspected. If either blob changes, automated execution must stop with `BLOCKED` until a new safety preflight is completed.

> **SAFETY REVIEW OF VERSION A ≠ SAFETY AUTHORITY FOR VERSION B**
