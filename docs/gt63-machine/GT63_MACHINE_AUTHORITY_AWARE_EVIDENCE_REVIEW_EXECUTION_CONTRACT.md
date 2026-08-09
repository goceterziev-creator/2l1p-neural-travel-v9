# GT63 Machine - Authority-Aware Evidence Review Execution Contract

Status: DRAFT

Workflow: Authority-Aware Evidence Review

Runtime workflow name: `authority-aware-evidence-review`

Authority: NONE

Implementation: NOT AUTHORIZED

Commit: NOT AUTHORIZED

## 1. Workflow Identity

Purpose:

Produce a deterministic, provenance-preserving, authority-aware Review Packet from an explicit analysis task and bounded repository evidence.

Terminal behavior:

The workflow stops at Review Packet generation.

Workflow #8 may not:

- accept candidates;
- promote canonical truth;
- modify Product Knowledge;
- modify repository files;
- modify runtime or business state;
- commit;
- deploy;
- modify Constitution;
- modify Governance;
- modify Locks.

## 2. Reuse Requirement

Workflow #8 must reuse the existing Machine evidence pipeline.

Normative reusable components:

- `machine-core.js`;
- `repository-scanner.js`;
- `evidence-extractor.js`;
- `evidence-classifier.js`;
- `document-discovery.js`;
- `document-classifier.js`;
- `relationship-mapper.js`;
- `canonical-candidate-builder.js` where candidate structure is reused;
- `candidate-reviewer.js` where review-only semantics are reused.

Workflow #8 must not duplicate scanner, extractor, classifier, document classification, or relationship-mapping logic.

If an existing helper does not expose enough information, implementation may add the smallest interface extension required to return the existing helper's already-computed structured data.

Permitted interface extension must not change helper behavior, ordering, classification policy, authority semantics, or existing workflow output meaning.

## 3. Input Contract

Workflow #8 accepts exactly this V1 input schema:

```json
{
  "workflow": "authority-aware-evidence-review",
  "task": "string",
  "repositoryPath": ".",
  "scope": {
    "mode": "current",
    "allowedSources": ["repository"],
    "explicitPaths": []
  }
}
```

Required fields:

- `workflow`;
- `task`;
- `repositoryPath`;
- `scope`;
- `scope.mode`;
- `scope.allowedSources`;
- `scope.explicitPaths`.

`workflow` must equal `authority-aware-evidence-review`.

`task` must be a non-empty string after trimming leading and trailing whitespace.

`repositoryPath` must be a non-empty string and must preserve the existing Machine repository containment rule. It must resolve to an existing directory inside the active repository workspace. Arbitrary external absolute paths remain invalid.

`scope.mode` must be exactly one of:

- `current`;
- `historical`;
- `mixed`.

`scope.allowedSources` must be exactly:

```json
["repository"]
```

No other source class is valid in V1.

`scope.explicitPaths` must be an array of strings. Each entry must be non-empty after trimming, must be repository-relative, must normalize to `/`, must not be absolute, must not contain `..` path traversal, and must resolve inside the validated `repositoryPath`.

An empty `explicitPaths` array means the validated repository path is the evidence scope.

If `explicitPaths` is non-empty, the scanner may process only files under those explicit paths. Directory entries include their contained files subject to existing scanner limits.

Input normalization:

- trim `task`;
- normalize `repositoryPath` through the existing Machine path validation behavior;
- replace `\` with `/` in `explicitPaths`;
- remove duplicate `explicitPaths` after normalization;
- sort normalized `explicitPaths` lexically.

Input must not authorize:

- semantic search;
- memory lookup;
- arbitrary web access;
- product-runtime routing;
- external artifact scanning;
- direct external repository paths.

External artifacts must continue through Workflow #6 and Workflow #7 boundaries before any downstream evidence processing.

### Input Failure Mapping

Input validation is ordered and stops at the first matching failure condition.

Deterministic input failure table:

| Order | Condition | Failure code | Top-level status | Stop immediately |
| --- | --- | --- | --- | --- |
| 1 | input is not an object | `INPUT_INVALID` | `FAIL` | yes |
| 2 | `workflow` is missing | `INPUT_INVALID` | `FAIL` | yes |
| 3 | `workflow` is not `authority-aware-evidence-review` | `INPUT_INVALID` | `FAIL` | yes |
| 4 | `task` is missing | `TASK_INVALID` | `FAIL` | yes |
| 5 | `task` is not a string | `TASK_INVALID` | `FAIL` | yes |
| 6 | trimmed `task` is empty | `TASK_INVALID` | `FAIL` | yes |
| 7 | `repositoryPath` is missing | `REPOSITORY_PATH_INVALID` | `FAIL` | yes |
| 8 | `repositoryPath` is not a non-empty string | `REPOSITORY_PATH_INVALID` | `FAIL` | yes |
| 9 | `repositoryPath` fails existing Machine repository containment validation | `REPOSITORY_PATH_INVALID` | `FAIL` | yes |
| 10 | `repositoryPath` resolves outside the active repository workspace | `REPOSITORY_PATH_INVALID` | `FAIL` | yes |
| 11 | `repositoryPath` does not resolve to an existing directory | `REPOSITORY_PATH_INVALID` | `FAIL` | yes |
| 12 | `scope` is missing or is not an object | `SCOPE_INVALID` | `FAIL` | yes |
| 13 | `scope.mode` is missing or is not `current`, `historical`, or `mixed` | `SCOPE_INVALID` | `FAIL` | yes |
| 14 | `scope.allowedSources` is missing or is not exactly `["repository"]` | `SCOPE_INVALID` | `FAIL` | yes |
| 15 | `scope.explicitPaths` is missing or is not an array | `SCOPE_INVALID` | `FAIL` | yes |
| 16 | any `explicitPaths` entry is not a non-empty string | `SCOPE_INVALID` | `FAIL` | yes |
| 17 | any normalized `explicitPaths` entry is absolute, contains path traversal, or resolves outside the validated `repositoryPath` | `EXPLICIT_PATH_OUTSIDE_REPOSITORY` | `FAIL` | yes |
| 18 | any normalized `explicitPaths` entry does not exist | `EXPLICIT_PATH_NOT_FOUND` | `FAIL` | yes |
| 19 | any normalized `explicitPaths` entry resolves outside the validated `repositoryPath` through symlink, junction, reparse point, or final filesystem resolution where existing containment checks expose it | `EXPLICIT_PATH_OUTSIDE_REPOSITORY` | `FAIL` | yes |

No downstream evidence processing may occur after any input failure.

### explicitPaths Semantics

Deterministic `explicitPaths` behavior:

| Case | Result |
| --- | --- |
| empty array | proceed; evidence scope is the validated `repositoryPath`; no warning is emitted solely for emptiness |
| exact duplicate path strings | normalize, deduplicate, sort, proceed |
| duplicate after `/` normalization | deduplicate after normalization, sort, proceed |
| nonexistent path | `FAIL` with `EXPLICIT_PATH_NOT_FOUND`; stop immediately |
| file path | proceed; scan only that file subject to existing scanner support and limits |
| directory path | proceed; scan contained files subject to existing scanner support and limits |
| path outside repository | `FAIL` with `EXPLICIT_PATH_OUTSIDE_REPOSITORY`; stop immediately |
| traversal escape | `FAIL` with `EXPLICIT_PATH_OUTSIDE_REPOSITORY`; stop immediately |
| symlink, junction, reparse, or resolved filesystem escape where existing containment checks expose it | `FAIL` with `EXPLICIT_PATH_OUTSIDE_REPOSITORY`; stop immediately |

`explicitPaths` does not authorize external paths.

## 4. Context Resolver Contract

Context Resolver V1 translates the explicit task and scope into a bounded evidence-processing context.

It may determine:

- repository baseline;
- scope mode;
- normalized explicit path scope;
- allowed evidence source classes.

It must not:

- query Product Knowledge automatically;
- query Travel Knowledge automatically;
- become long-term memory;
- perform semantic retrieval outside explicit evidence scope;
- route product actions;
- invoke HOME;
- infer authority.

Exact output shape:

```json
{
  "task": "string",
  "scope": {
    "mode": "current|historical|mixed",
    "allowedSources": ["repository"],
    "explicitPaths": []
  },
  "repository": {
    "root": "string",
    "relativeRoot": ".",
    "gitStatus": "AVAILABLE|NOT_AVAILABLE",
    "branch": "string|null",
    "head": "string|null",
    "dirty": true
  },
  "evidenceSourceClasses": ["repository"],
  "warnings": []
}
```

`dirty` is `true` when repository status contains any modified, deleted, staged, or untracked entry. It is `false` only when the working tree is clean.

`warnings` is a deterministic array of warning codes.

## 5. Evidence Pipeline Reuse Contract

Workflow #8 processing sequence:

```text
validated input
-> context resolver
-> repository scan
-> evidence extraction
-> evidence classification
-> document discovery
-> document classification
-> relationship analysis
-> candidate/conflict preparation
-> authority assessment
-> Review Packet assembly
```

Normative dependencies:

- repository scan uses `repository-scanner.js`;
- evidence extraction uses `evidence-extractor.js`;
- evidence classification uses `evidence-classifier.js`;
- document discovery uses `document-discovery.js`;
- document classification uses `document-classifier.js`;
- relationship analysis uses `relationship-mapper.js`;
- candidate shape may reuse `canonical-candidate-builder.js` data conventions without canonical status;
- review-only semantics may reuse `candidate-reviewer.js` data conventions without accept/reject decisions.

Workflow #8 must not redefine those components' internal behavior.

## 6. Record Type Definitions

All record arrays must be sorted deterministically by `path`, then `id`, then `type`, where fields exist.

### OBSERVATION

A directly observed repository fact produced by scanning or structured metadata.

Minimum fields:

```json
{
  "id": "string",
  "type": "OBSERVATION",
  "path": "string|null",
  "statement": "string",
  "sourceEvidenceIds": []
}
```

OBSERVATION is not an authority claim.

### EVIDENCE

A repository-backed content or metadata item that supports review.

Minimum fields:

```json
{
  "id": "string",
  "type": "EVIDENCE",
  "path": "string",
  "category": "string",
  "sourceEvidenceIds": [],
  "contentClass": "AUTHORITY_EVIDENCE|CONTENT_EVIDENCE|EXECUTABLE_BEHAVIOR"
}
```

EVIDENCE is not INFERENCE.

### INFERENCE

A deterministic interpretation derived from one or more evidence records.

Minimum fields:

```json
{
  "id": "string",
  "type": "INFERENCE",
  "statement": "string",
  "basisEvidenceIds": [],
  "confidence": "HIGH|MEDIUM|LOW"
}
```

INFERENCE must always identify evidence basis.

### RELATIONSHIP

A relationship record produced by relationship mapping.

Minimum fields:

```json
{
  "id": "string",
  "type": "RELATIONSHIP",
  "relationshipType": "string",
  "from": "string",
  "to": "string",
  "basisEvidenceIds": []
}
```

### CONFLICT

A deterministic unresolved incompatibility between evidence, claims, relationships, or authority assessments.

Minimum fields:

```json
{
  "id": "string",
  "type": "CONFLICT",
  "conflictType": "string",
  "statements": [],
  "evidenceIds": [],
  "resolution": "UNRESOLVED"
}
```

CONFLICT is not a resolved decision.

### CANDIDATE

A proposed interpretation or knowledge item derived from evidence that has not been accepted by external authority.

Minimum fields:

```json
{
  "id": "string",
  "type": "CANDIDATE",
  "statement": "string",
  "supportingEvidenceIds": [],
  "conflictingEvidenceIds": [],
  "confidence": "HIGH|MEDIUM|LOW",
  "authorityRequirement": "NONE|REVIEW_REQUIRED|GOVERNANCE_REQUIRED",
  "reviewStatus": "PROPOSED"
}
```

CANDIDATE is not accepted knowledge.

### UNKNOWN

A known gap where the evidence scope does not support a deterministic conclusion.

Minimum fields:

```json
{
  "id": "string",
  "type": "UNKNOWN",
  "question": "string",
  "reason": "NOT_FOUND|INSUFFICIENT_EVIDENCE|OUT_OF_SCOPE",
  "searchedEvidenceScope": []
}
```

UNKNOWN is not CONTRADICTION.

### AUTHORITY_ASSESSMENT

A deterministic review of authority status for a claim, evidence record, conflict, or candidate.

Minimum fields:

```json
{
  "id": "string",
  "type": "AUTHORITY_ASSESSMENT",
  "targetId": "string",
  "result": "string",
  "basisEvidenceIds": [],
  "requiresReview": true
}
```

## 7. Authority Resolver Contract

Authority Resolver V1 uses only:

```text
EVIDENCE + DETERMINISTIC RULES
```

It may:

- identify explicit claimed authority;
- identify source or document status;
- identify lack of authority;
- identify competing authority claims;
- identify authority ambiguity;
- identify required review;
- return UNKNOWN;
- return CONFLICT.

It must not:

- grant authority to itself;
- promote canonical truth;
- resolve governance hierarchy unless explicitly established by governing evidence;
- infer authority from filename alone;
- treat `CANON`, `MASTER`, `FINAL`, `LOCKED`, or `APPROVED` as authoritative solely because of naming;
- treat executable behavior as governance authority;
- treat repeated claims as independent corroboration.

Closed V1 authority result vocabulary:

- `NO_AUTHORITY`: no authority evidence supports the target claim.
- `CLAIMED_AUTHORITY`: a source claims authority, but supporting governing evidence is absent in scope.
- `AUTHORITY_SUPPORTED`: explicit governing evidence in scope supports the claim's authority status.
- `AUTHORITY_CONFLICT`: two or more authority evidence records make incompatible authority claims and no explicit governing rule in scope resolves them.
- `AUTHORITY_UNKNOWN`: the evidence scope is insufficient to determine authority status.
- `REVIEW_REQUIRED`: human or governance review is required before acceptance, rejection, promotion, or lock.

`AUTHORITY_SUPPORTED` does not mean canonical truth. It means the authority claim is supported by explicit authority evidence in the bounded evidence scope.

### Authority Result Precedence

Authority assessment is performed per target subject. A target subject is the claim, evidence record, inference, conflict, or candidate being assessed.

Exactly one primary authority result is emitted per target subject.

Authority Resolver V1 applies this ordered decision table:

| Order | Evidence state for the target subject | Result |
| --- | --- | --- |
| 1 | Two or more authority evidence records make incompatible authority claims and no explicit governing hierarchy in scope resolves them | `AUTHORITY_CONFLICT` |
| 2 | Two or more authority evidence records appear incompatible, but an explicit governing hierarchy in scope resolves which authority applies | `AUTHORITY_SUPPORTED` |
| 3 | One or more explicit authority evidence records directly support the target subject's authority status | `AUTHORITY_SUPPORTED` |
| 4 | One or more source records claim authority, but no supporting authority evidence exists in scope | `CLAIMED_AUTHORITY` |
| 5 | The task or candidate explicitly requires authority review, and evidence scope does not establish authority support or conflict | `REVIEW_REQUIRED` |
| 6 | Authority evidence should be expected for the target subject because it contains an authority-bearing claim, but no authority evidence can be established in scope | `AUTHORITY_UNKNOWN` |
| 7 | No authority evidence exists for the target subject and the target subject does not contain an authority-bearing claim | `NO_AUTHORITY` |

Filename-only authority language such as `CANON`, `MASTER`, `FINAL`, `LOCKED`, or `APPROVED` is treated as content metadata and reaches `NO_AUTHORITY` unless separate authority evidence exists.

Executable behavior claiming authority is treated as executable behavior and reaches `NO_AUTHORITY` unless separate authority evidence exists.

Repeated identical claims without independent authority evidence are treated as one unsupported authority claim and reach `CLAIMED_AUTHORITY`.

Multiple compatible authority claims supported by the same explicit governing evidence reach `AUTHORITY_SUPPORTED`.

If the same evidence scope produces assessments for different target subjects, each subject receives its own result according to this table.

## 8. Authority Evidence Rules

Authority evidence can include only explicit repository evidence that states or records authority, governance, decision, lock, or document-status rules.

V1 authority evidence classes:

- `CONSTITUTION_RULE`: explicit Constitution hierarchy or rule.
- `GOVERNANCE_RULE`: explicit governance rule.
- `DECISION_RECORD`: committed decision record or equivalent repository document.
- `LOCK_RECORD`: lock registry or lock document.
- `DOCUMENT_STATUS`: explicit document status metadata or text.
- `REPOSITORY_COMMIT_STATE`: Git branch, HEAD, and dirty-state provenance.

Content evidence classes:

- `README_STATEMENT`;
- `DOCUMENTATION_STATEMENT`;
- `HISTORICAL_STATEMENT`;
- `RUNTIME_COMMENT`;
- `TEST_FIXTURE_CONTENT`;
- `GENERAL_CONTENT`.

Executable behavior class:

- `RUNTIME_CODE`;
- `TEST_CODE`;
- `CONFIGURATION_CODE`;
- `SCRIPT_BEHAVIOR`.

Rules:

- Authority evidence may support authority assessment.
- Content evidence may support observations, candidates, conflicts, and unknowns.
- Executable behavior may support implemented-capability observations.
- Executable behavior does not create governance authority unless explicit authority evidence says it does.
- Filename alone is content metadata, not authority evidence.
- Repeated historical claims are multiple content claims, not independent authority.

## 9. Conflict Contract

Workflow #8 must emit a conflict when bounded evidence contains deterministic incompatible claims and no explicit authority rule in scope resolves them.

Conflict categories:

- `AUTHORITY_CLAIM_CONFLICT`;
- `CURRENT_VS_HISTORICAL_CONFLICT`;
- `DOCUMENTATION_VS_RUNTIME_CONFLICT`;
- `IDENTITY_ROLE_CONFLICT`;
- `STATUS_CONFLICT`;
- `RELATIONSHIP_CONFLICT`.

Examples:

- README says canonical while an index says Canonical Authority: NO.
- Documentation says current while runtime behavior contradicts it.
- Two authority sources disagree.
- Historical and current statements differ.
- Same identity has incompatible roles.

Conflict fields:

```json
{
  "id": "conflict:<type>:<stable-key>",
  "type": "CONFLICT",
  "conflictType": "AUTHORITY_CLAIM_CONFLICT|CURRENT_VS_HISTORICAL_CONFLICT|DOCUMENTATION_VS_RUNTIME_CONFLICT|IDENTITY_ROLE_CONFLICT|STATUS_CONFLICT|RELATIONSHIP_CONFLICT",
  "statements": [
    {
      "statement": "string",
      "evidenceIds": []
    }
  ],
  "evidenceIds": [],
  "authorityAssessmentIds": [],
  "resolution": "UNRESOLVED"
}
```

Conflict ordering:

1. `conflictType`;
2. first evidence path;
3. `id`.

The Machine must not invent precedence.

## 10. Candidate Contract

A candidate is a proposed interpretation or knowledge item derived from evidence that has not been accepted by external authority.

Every candidate must contain:

```json
{
  "id": "candidate:<stable-key>",
  "type": "CANDIDATE",
  "statement": "string",
  "supportingEvidenceIds": [],
  "conflictingEvidenceIds": [],
  "confidence": "HIGH|MEDIUM|LOW",
  "authorityRequirement": "NONE|REVIEW_REQUIRED|GOVERNANCE_REQUIRED",
  "reviewStatus": "PROPOSED"
}
```

Candidate ID derivation:

`candidate:<lowercase-sha256-of-normalized-statement-and-sorted-supporting-evidence-ids>`

Candidate status must never imply canonical acceptance.

No output field named `canonical` is permitted on candidate records.

No output field named `canonical` with value `true` is permitted anywhere in the Review Packet.

Candidate records must include:

```json
{
  "canonicalStatus": "NOT_CANONICAL",
  "authority": "NONE"
}
```

### Candidate Membership Rules

Candidate emission is deterministic and based on inferences.

A CANDIDATE must be emitted when:

- an INFERENCE has at least one `basisEvidenceIds` entry;
- the inference proposes a reviewable product, architecture, governance, runtime, identity, relationship, historical, or authority interpretation;
- and the inference is not already represented by an identical candidate ID.

A CANDIDATE must be emitted for:

- inference supported by evidence;
- inference with conflicting evidence;
- historical-only inference;
- authority-ambiguous inference;
- inference derived from another inference when the derived inference also identifies original evidence basis.

A CANDIDATE must not be emitted for:

- observation-only records with no inference;
- evidence-only records with no inference;
- insufficient-evidence inference where no positive statement can be made;
- UNKNOWN records;
- CONFLICT records by themselves;
- authority assessment records by themselves;
- duplicate derivations that produce an already existing candidate ID.

Insufficient-evidence cases produce UNKNOWN, not CANDIDATE.

Conflicting evidence does not suppress candidate emission when a supported inference exists. The candidate must include `conflictingEvidenceIds`.

Historical-only candidates must remain explicitly historical in their statement or supporting metadata and must not imply current truth.

Duplicate candidate handling:

1. normalize the candidate statement by trimming whitespace and collapsing internal whitespace to one ASCII space;
2. sort `supportingEvidenceIds` lexically;
3. derive candidate ID from normalized statement plus sorted supporting evidence IDs;
4. if two derivations produce the same ID, emit one candidate;
5. merge `conflictingEvidenceIds` by normalized lexical set union;
6. choose the lowest confidence in this order when merged derivations differ: `LOW`, `MEDIUM`, `HIGH`;
7. choose the highest authority requirement in this order when merged derivations differ: `GOVERNANCE_REQUIRED`, `REVIEW_REQUIRED`, `NONE`;
8. `reviewStatus` remains `PROPOSED`;
9. `canonicalStatus` remains `NOT_CANONICAL`;
10. `authority` remains `NONE`.

Candidate emission never implies acceptance.

## 11. Review Packet Output Schema

Workflow #8 emits exactly one structured JSON document to stdout through the existing bootstrap entrypoint.

Required top-level schema:

```json
{
  "workflow": "authority-aware-evidence-review",
  "status": "PASS",
  "authority": "NONE",
  "task": "string",
  "context": {},
  "baseline": {},
  "observations": [],
  "evidence": [],
  "inferences": [],
  "relationships": [],
  "conflicts": [],
  "candidates": [],
  "authorityAssessment": [],
  "unknowns": [],
  "provenance": {},
  "reviewRequired": true,
  "failures": [],
  "warnings": []
}
```

Required field types:

- `workflow`: string;
- `status`: string;
- `authority`: string;
- `task`: string;
- `context`: object;
- `baseline`: object;
- `observations`: array;
- `evidence`: array;
- `inferences`: array;
- `relationships`: array;
- `conflicts`: array;
- `candidates`: array;
- `authorityAssessment`: array;
- `unknowns`: array;
- `provenance`: object;
- `reviewRequired`: boolean;
- `failures`: array;
- `warnings`: array.

Sort order:

- `observations`: by `path`, then `id`;
- `evidence`: by `path`, then `id`;
- `inferences`: by `id`;
- `relationships`: existing relationship mapper deterministic order;
- `conflicts`: by `conflictType`, then first evidence path, then `id`;
- `candidates`: by `id`;
- `authorityAssessment`: by `targetId`, then `result`, then `id`;
- `unknowns`: by `reason`, then `id`;
- `failures`: by closed failure-code order;
- `warnings`: by closed warning-code order.

The Review Packet must be self-contained enough for independent human or review workflow inspection.

### Baseline Object

The top-level `baseline` object is required and has exactly this V1 schema:

```json
{
  "repository": {
    "root": "string",
    "relativeRoot": ".",
    "gitStatus": "AVAILABLE|NOT_AVAILABLE",
    "branch": "string|null",
    "head": "string|null",
    "detachedHead": false,
    "dirty": false
  },
  "scope": {
    "mode": "current|historical|mixed",
    "allowedSources": ["repository"],
    "explicitPaths": []
  },
  "scanner": {
    "filesScanned": 0,
    "filesSkipped": 0,
    "truncated": false,
    "truncationReason": null
  }
}
```

Required baseline fields:

- `repository.root`: normalized absolute repository root using `/`;
- `repository.relativeRoot`: `.` in V1;
- `repository.gitStatus`: `AVAILABLE` when branch/head metadata is available, otherwise `NOT_AVAILABLE`;
- `repository.branch`: current branch name, or `null` when unavailable or detached;
- `repository.head`: Git HEAD SHA, or `null` when unavailable;
- `repository.detachedHead`: `true` only when Git metadata is available and HEAD is detached;
- `repository.dirty`: deterministic boolean from working-tree status;
- `scope`: normalized scope copied from validated input;
- `scanner`: copied from reused scanner result.

Non-Git repository behavior:

- `gitStatus`: `NOT_AVAILABLE`;
- `branch`: `null`;
- `head`: `null`;
- `detachedHead`: `false`;
- `dirty`: `false` unless existing Machine Git-status behavior can determine dirty state.

Baseline is the normative top-level repository snapshot.

`context.repository` and `provenance.repository` must either copy the same repository values or contain a strict subset of the same values. They must not contradict `baseline.repository`.

No hashes, timestamps, run IDs, remotes, author metadata, or generated build IDs are part of V1 baseline.

### reviewRequired Derivation

`reviewRequired` is deterministic.

For any successful Review Packet with `status` `PASS` or `PASS_WITH_WARNINGS`, `reviewRequired` is always `true`.

Reason: Workflow #8 terminal output is a review packet and has no authority to accept, reject, promote, or lock knowledge.

For `FAIL`, `reviewRequired` is also `true` because a failed review packet requires operator review before it can be used.

Therefore V1 has one rule:

```text
reviewRequired = true
```

This applies to:

- candidates;
- conflicts;
- authority conflict;
- authority unknown;
- unknowns;
- warnings;
- `PASS`;
- `PASS_WITH_WARNINGS`;
- `FAIL`;
- empty findings.

## 12. Status Derivation

Closed top-level status vocabulary:

- `PASS`;
- `PASS_WITH_WARNINGS`;
- `FAIL`.

Derivation:

1. Any runtime processing, safety, or input failure produces `FAIL`.
2. Successful processing with one or more warnings produces `PASS_WITH_WARNINGS`.
3. Successful processing with no warnings produces `PASS`.

Unresolved authority conflict does not automatically mean runtime `FAIL` when the workflow successfully detected and reported it.

Ordinary `UNKNOWN`, `AUTHORITY_UNKNOWN`, `AUTHORITY_CONFLICT`, and unresolved `CONFLICT` records do not create runtime failure.

## 13. Provenance Contract

Minimum V1 provenance:

```json
{
  "repository": {
    "root": "string",
    "branch": "string|null",
    "head": "string|null",
    "gitStatus": "AVAILABLE|NOT_AVAILABLE",
    "dirty": true
  },
  "workflow": {
    "name": "authority-aware-evidence-review",
    "runIdentity": null
  },
  "scope": {
    "mode": "current|historical|mixed",
    "allowedSources": ["repository"],
    "explicitPaths": []
  },
  "scanner": {
    "filesScanned": 0,
    "filesSkipped": 0,
    "truncated": false,
    "truncationReason": null
  },
  "sourceStatus": "CURRENT|HISTORICAL|MIXED|UNKNOWN"
}
```

Evidence-level provenance must include normalized repository-relative file paths.

Content hashes are optional in V1 unless existing reused pipeline components already compute them. V1 must not invent hashes by policy if the reused pipeline does not expose them.

`runIdentity` is `null` in V1. No timestamp, random ID, or environment-specific run ID is permitted.

## 14. Scope Semantics

`current`:

Evidence is reviewed as current repository evidence at the captured Git baseline. Historical claims inside current files remain claims, not automatic current truth.

`historical`:

Evidence is reviewed as historical evidence. Historical findings must remain explicitly historical and must not become current truth.

`mixed`:

Current and historical evidence may both be included. The workflow must keep current and historical records explicitly labeled and must not silently reconcile them.

Prohibited conversions:

- historical evidence to automatic current truth;
- current runtime behavior to automatic historical intent;
- mixed scope to silent reconciliation.

## 15. No-Write Boundary

Workflow #8 is read-only.

It may not write:

- Product Knowledge;
- Historical Knowledge;
- canonical state;
- runtime business data;
- source repository files;
- Constitution;
- Governance;
- Locks.

Normal runtime output is stdout JSON only.

No runtime output artifact is authorized in V1.

Temporary artifacts are not authorized for normal runtime V1.

Regression tests in a later implementation may create temporary fixtures only under a test-owned temporary directory and must clean them after execution.

## 16. External Evidence Boundary

Workflow #8 must not weaken Workflow #6 or Workflow #7.

Direct external repository paths remain invalid.

External artifacts must arrive only through the existing approved Workflow #6 staging and Workflow #7 bridge mechanism before any downstream evidence processing.

Workflow #8 V1 input accepts only `allowedSources: ["repository"]`.

If a future contract authorizes consuming Workflow #7 output directly, Workflow #8 must treat it as provenance-preserving downstream evidence and must not use the original external source as `repositoryPath`.

Workflow #8 must not redesign Workflow #6 or Workflow #7.

## 17. Failure / Warning / Conflict / Unknown Vocabulary

Closed V1 failure-code vocabulary:

- `INPUT_INVALID`;
- `TASK_INVALID`;
- `SCOPE_INVALID`;
- `REPOSITORY_PATH_INVALID`;
- `EXPLICIT_PATH_OUTSIDE_REPOSITORY`;
- `EXPLICIT_PATH_NOT_FOUND`;
- `REPOSITORY_SCAN_FAILED`;
- `EVIDENCE_EXTRACTION_FAILED`;
- `EVIDENCE_CLASSIFICATION_FAILED`;
- `DOCUMENT_PROCESSING_FAILED`;
- `RELATIONSHIP_PROCESSING_FAILED`;
- `AUTHORITY_ASSESSMENT_FAILED`;
- `REVIEW_PACKET_ASSEMBLY_FAILED`.

Closed V1 warning-code vocabulary:

- `REPOSITORY_DIRTY`;
- `SCAN_TRUNCATED`;
- `EXPLICIT_SCOPE_EMPTY`;
- `AUTHORITY_AMBIGUITY_PRESENT`;
- `CONFLICTS_PRESENT`;
- `UNKNOWNS_PRESENT`.

Warning derivation is deterministic.

Warning emission table:

| Condition | Warning code | Emission cardinality | Effect on top-level status |
| --- | --- | --- | --- |
| repository baseline dirty state is `true` | `REPOSITORY_DIRTY` | once | successful packet becomes `PASS_WITH_WARNINGS` |
| scanner result has `truncated: true` | `SCAN_TRUNCATED` | once | successful packet becomes `PASS_WITH_WARNINGS` |
| any authority assessment result is `AUTHORITY_UNKNOWN`, `AUTHORITY_CONFLICT`, `CLAIMED_AUTHORITY`, or `REVIEW_REQUIRED` | `AUTHORITY_AMBIGUITY_PRESENT` | once | successful packet becomes `PASS_WITH_WARNINGS` |
| `conflicts` array is non-empty | `CONFLICTS_PRESENT` | once | successful packet becomes `PASS_WITH_WARNINGS` |
| `unknowns` array is non-empty | `UNKNOWNS_PRESENT` | once | successful packet becomes `PASS_WITH_WARNINGS` |

`EXPLICIT_SCOPE_EMPTY` is not emitted for `explicitPaths: []`.

`EXPLICIT_SCOPE_EMPTY` is emitted once only when `explicitPaths` is non-empty after validation and normalization but all explicit paths contain zero scannable files under existing scanner rules.

Candidate presence alone does not emit a warning. Candidate review requirement is represented by `reviewRequired: true` and candidate fields.

Warnings are unique by code.

Warning order is exactly:

1. `REPOSITORY_DIRTY`;
2. `SCAN_TRUNCATED`;
3. `EXPLICIT_SCOPE_EMPTY`;
4. `AUTHORITY_AMBIGUITY_PRESENT`;
5. `CONFLICTS_PRESENT`;
6. `UNKNOWNS_PRESENT`.

Warnings are emitted only on successful packet assembly. Runtime failures use `failures`, not `warnings`, unless a partial warning is already available from completed earlier steps; such partial warnings do not change `FAIL` status.

Closed V1 conflict-status vocabulary:

- `UNRESOLVED`.

Closed V1 unknown-reason vocabulary:

- `NOT_FOUND`;
- `INSUFFICIENT_EVIDENCE`;
- `OUT_OF_SCOPE`.

Distinctions:

- A failure is a runtime inability to safely or correctly complete the workflow.
- A warning is a successful runtime condition that requires attention.
- A conflict is an unresolved evidence or authority incompatibility.
- An unknown is a bounded evidence gap.

Ordinary `UNKNOWN` and `AUTHORITY_CONFLICT` findings must not become runtime failure codes.

## 18. Determinism Rules

For fixed input, repository state, and configuration, Workflow #8 must produce deterministic:

- record membership;
- structural classifications;
- top-level status;
- authority outcomes;
- conflict membership;
- unknown membership;
- relationship ordering;
- candidate ordering;
- failure ordering;
- warning ordering;
- baseline representation.

Natural-language explanatory text is not required to be byte-identical, but structured fields used for review decisions must be deterministic.

Output should prefer structured deterministic fields over prose.

No timestamp, random identifier, filesystem enumeration order, platform-dependent path representation, memory lookup, or web result may affect V1 output.

## 19. Historical Regression Requirements

Each regression category must assert semantic output, not exact prose wording.

- `R-01 coexistence != lineage`: coexisting names or artifacts must not imply lineage.
- `R-02 same name != same component`: identical names must not merge identities without evidence.
- `R-03 documentation != implementation`: documentation claims and runtime implementation evidence must remain separable.
- `R-04 filename != authority`: filename labels do not grant authority.
- `R-05 executable control != authority`: runtime behavior does not grant governance authority.
- `R-06 historical truth != current truth`: historical claim does not become current truth.
- `R-07 AYA replacement not proven`: AYA replacement or continuity is UNKNOWN unless evidence proves it.
- `R-08 2L1P rename not proven`: 2L1P rename or continuity is UNKNOWN unless evidence proves it.
- `R-09 Product Knowledge != Travel Knowledge`: product knowledge and travel knowledge remain distinct.
- `R-10 Machine != product runtime`: Machine review output is not product runtime behavior.
- `R-11 NOT_FOUND != CONTRADICTED`: absence of evidence is not contradiction.
- `R-12 superseded != deleted`: supersession claim does not imply deletion.
- `R-13 retrospective claim != contemporary implementation`: later claims do not prove earlier implementation.
- `R-14 external artifact != repository truth`: external staged evidence is not repository truth.
- `R-15 incomplete snapshot != intentional deletion`: incomplete evidence does not prove intentional deletion.
- `R-16 candidate != accepted knowledge`: candidate output remains unaccepted.
- `R-17 authority conflict must remain unresolved without explicit governing evidence`: conflicts stay unresolved when no governing evidence resolves them.

## 20. Existing Workflow Preservation Requirements

Implementation must preserve Workflow #1 through Workflow #7 behavior.

Required regression preservation gate:

- Workflow #1 regression: PASS;
- Workflow #2 regression: PASS;
- Workflow #3 regression: PASS;
- Workflow #4 regression: PASS;
- Workflow #5A regression: PASS;
- Workflow #5B regression: PASS;
- Workflow #6 regression: PASS;
- Workflow #7 regression: PASS.

No existing workflow may:

- gain authority;
- change output meaning;
- lose containment;
- gain canonical side effects.

Required side-effect checks:

- `canonical.json` not created;
- `canonical-review.json` not created;
- no Product Knowledge writes;
- no Governance writes;
- no Lock writes.

## 21. Implementation Surface

Expected implementation surface to validate in a future implementation authorization:

Modify:

- `scripts/gt63-machine/machine-core.js`

Create:

- `scripts/gt63-machine/authority-aware-review-packet.js`
- `scripts/gt63-machine/context-resolver.js`
- `scripts/gt63-machine/authority-resolver.js`
- `scripts/gt63-machine/fixtures/local-authority-aware-review-input.json`
- `scripts/gt63-machine-authority-aware-review-regression.js`

No change expected:

- existing scanner;
- existing extractor;
- existing classifier;
- existing relationship mapper;
- existing candidate builder behavior;
- existing candidate reviewer behavior;
- GT63 Core;
- HOME;
- 2L1P;
- Product Knowledge;
- Travel Knowledge.

This file list is not implementation authorization.

A future implementation review must validate whether this surface is sufficient before code changes are made.

## 22. Explicit Non-Goals

V1 does not include:

- persistent general memory;
- Product Knowledge writes;
- Historical Knowledge writes;
- autonomous execution;
- code modification beyond later explicitly authorized implementation files;
- commit;
- deploy;
- HOME integration;
- GT63 Core integration;
- Travel Knowledge integration;
- agent or persona orchestration;
- arbitrary external source access;
- web research;
- autonomous authority decisions;
- semantic search;
- long-term memory.

## 23. Contract Review Questions

1. Can two reasonable implementers produce materially different authority outcomes while both believing they conform?

Answer: NO. Authority result vocabulary and evidence classes are closed in V1.

2. Can two reasonable implementers confuse evidence and inference while conforming?

Answer: NO. Record type definitions separate EVIDENCE and INFERENCE and require different minimum fields.

3. Can candidate output accidentally become accepted knowledge?

Answer: NO. Candidate status is restricted to `PROPOSED`, and canonical acceptance fields are prohibited.

4. Can filename or document labels accidentally grant authority?

Answer: NO. Filename alone is explicitly not authority evidence.

5. Can historical evidence accidentally become current truth?

Answer: NO. Scope semantics prohibit historical evidence becoming automatic current truth.

6. Can Workflow #8 weaken #6/#7 containment?

Answer: NO. Direct external paths remain invalid, and external artifacts must use Workflow #6/#7 boundaries.

7. Can Product Knowledge or Travel Knowledge be mutated?

Answer: NO. V1 is read-only and prohibits those writes.

8. Can runtime code be interpreted as governance authority without explicit evidence?

Answer: NO. Executable behavior is separate from authority evidence.

9. Are conflicts and unknowns separately deterministic?

Answer: YES. Conflict and unknown vocabularies, fields, and ordering are defined separately.

10. Can implementation proceed without inventing new policy?

Answer: YES, for the V1 supported surface defined by this draft.

11. Can deterministic regression tests have one correct semantic result for every required case?

Answer: YES, for the required V1 regression categories.

## 24. Closure Rule

Contract review must not become unrestricted adversarial exploration.

A new blocking finding is valid only if it demonstrates a concrete case where two reasonable implementations of the supported V1 surface could produce materially different:

- authority outcome;
- evidence or inference classification;
- candidate status;
- conflict status;
- current or historical status;
- Review Packet membership;
- safety result;
- downstream eligibility or authority implication.

Implementation-level choices that do not change externally observable V1 policy are not Contract blockers.

## 25. Required Output For Contract Creation Review

Required report sections:

1. Files Changed
2. Workflow Identity
3. Input Contract
4. Context Resolver Contract
5. Evidence Pipeline Reuse Contract
6. Record Type Definitions
7. Authority Resolver Contract
8. Authority Evidence Rules
9. Conflict Contract
10. Candidate Contract
11. Review Packet Output Schema
12. Status Derivation
13. Provenance Contract
14. Scope Semantics
15. No-Write Boundary
16. External Evidence Boundary
17. Failure / Warning / Conflict / Unknown Vocabulary
18. Determinism Rules
19. Historical Regression Requirements
20. Existing Workflow Preservation Requirements
21. Implementation Surface
22. Explicit Non-Goals
23. Remaining Ambiguities
24. Contract Review Questions
25. PASS / FAIL

Final result vocabulary:

- `PASS - READY_FOR_INDEPENDENT_CONTRACT_REVIEW`
- `FAIL - CONTRACT_CORRECTION_REQUIRED`

## 26. Side Effects

Only this draft Execution Contract may be created or modified during contract definition.

Do not:

- implement code;
- modify existing workflows;
- modify Product Knowledge;
- modify Constitution;
- modify Governance;
- modify Locks;
- commit;
- push.

Authority: NONE.
