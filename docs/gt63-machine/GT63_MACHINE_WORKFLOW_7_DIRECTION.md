# GT63 Machine - Workflow #7 Direction

## Title

Workflow #7 - Intake Processing Bridge

## Status

Direction proposal only

Implementation is not authorized.

Execution contract is not authorized.

Runtime changes are not authorized.

Regression changes are not authorized.

Commit is not authorized unless separately approved.

## 1. Problem Statement

Workflow #6 can safely transform an external directory or ZIP artifact into a validated workspace-safe staged snapshot and manifest.

The existing Machine evidence-processing workflows can process a repository-relative workspace path.

The connection between these two capabilities is currently manual.

Without an explicit bridge, an operator must manually point downstream processing at the staged snapshot and manually preserve the relationship between:

```text
external source
-> intakeId
-> manifest
-> staged snapshot
-> downstream evidence result
```

This is a missing capability boundary, not a Workflow #6 defect.

## 2. Capability Purpose

Workflow #7 defines a Machine-controlled bridge from a valid Workflow #6 staged intake into the existing Machine evidence-processing path.

The workflow should:

- consume only a valid Workflow #6 staged intake;
- verify downstream eligibility before processing;
- process only the staged workspace-safe snapshot;
- preserve intake provenance in the downstream result;
- expose downstream evidence-processing outcomes, including truncation and failures;
- keep external-source access and repository containment boundaries intact.

## 3. Position in the Machine Workflow Chain

Workflow #7 sits after Workflow #6 and before downstream evidence interpretation.

```text
External source
        |
        v
Workflow #6 External Artifact Intake
        |
        v
Validated manifest + staged snapshot
        |
        v
Workflow #7 Intake Processing Bridge
        |
        v
Existing Machine evidence-processing capability
```

## 4. Inputs

Workflow #7 may accept only a reference to a valid Workflow #6 intake.

Permitted input concepts:

- a Workflow #6 `intakeId`;
- a Workflow #6 `manifestPath` under `tmp/gt63-machine-intake/`;
- a Workflow #6 staged snapshot path under `tmp/gt63-machine-intake/<intakeId>/snapshot`.

The workflow must not accept the original external source path as downstream `repositoryPath`.

## 5. Outputs

Workflow #7 should produce one structured Machine result describing:

- intake identity;
- intake manifest reference;
- staged snapshot reference;
- downstream workflow executed;
- files scanned;
- files skipped;
- truncation state;
- truncation reason;
- evidence count;
- classification summary;
- downstream warnings;
- downstream failures;
- provenance links back to the Workflow #6 intake.

The output is descriptive and processing-oriented.

It has no canonical authority.

## 6. Required Behavior

Workflow #7 must:

- load and validate the referenced Workflow #6 intake manifest;
- verify that the staged snapshot exists under the approved Machine staging root;
- verify downstream eligibility before processing;
- reject non-eligible failed intakes;
- invoke or reuse existing Machine evidence-processing behavior only on the staged snapshot;
- preserve deterministic output ordering;
- expose scanner truncation, warnings, and failures instead of hiding them;
- avoid changing existing Workflow #1-#6 behavior.

## 7. Provenance Requirements

Workflow #7 must preserve the evidence chain:

```text
external source
-> intakeId
-> manifest
-> staged snapshot
-> downstream evidence result
```

The downstream result must remain traceable to:

- original external source path as recorded by Workflow #6;
- Workflow #6 `intakeId`;
- Workflow #6 manifest path;
- staged snapshot path;
- downstream evidence records.

## 8. Downstream Eligibility Handling

Workflow #7 may process only intakes marked by Workflow #6 as:

- `ELIGIBLE`;
- `ELIGIBLE_WITH_WARNINGS`.

Workflow #7 must not process intakes marked:

- `NOT_ELIGIBLE`.

Warnings from Workflow #6 remain warnings.

They do not become authority-bearing decisions.

## 9. Scanner Truncation Reporting

Workflow #7 must report downstream scanner truncation explicitly.

If downstream evidence processing reaches an existing scanner limit, the Workflow #7 output should identify:

- `truncated`;
- `truncationReason`;
- files scanned;
- files skipped where available;
- evidence count actually produced.

Scanner truncation is not automatically a Workflow #6 defect.

Scanner truncation is an existing downstream evidence-processing boundary.

## 10. Relationship to Workflow #6

Workflow #7 depends on Workflow #6 output.

Workflow #7 must not modify Workflow #6.

Workflow #7 must not reopen Workflow #6 Contract research.

Workflow #7 must not change Workflow #6 staging, manifest, safety, hashing, ZIP, or provenance rules.

## 11. Relationship to Workflows #1-#5B

Workflow #7 may reuse existing Machine evidence-processing capabilities.

Workflow #7 must not weaken the existing `repositoryPath` containment rule.

Workflow #7 must not allow Workflows #1-#5B to scan arbitrary external absolute paths directly.

Workflow #7 must use only the staged workspace-safe snapshot as the downstream processing target.

## 12. Safety Boundaries

Workflow #7 must not:

- read the original external source as downstream `repositoryPath`;
- write to the original external source;
- extract archives;
- alter Workflow #6 staging output;
- scan outside the active repository workspace;
- write outside approved Machine-controlled paths;
- treat staged evidence as current repository truth.

## 13. Authority Boundaries

Authority: NONE

Workflow #7 may process and report evidence.

It may not:

- create canonical knowledge;
- promote candidates;
- accept or reject candidates;
- modify Constitution;
- modify Governance;
- modify Locks;
- redefine product truth;
- infer that external evidence applies to GT63 without evidence and review.

## 14. Explicit Non-Goals

Workflow #7 does not:

- implement Workflow #6 intake;
- expand Workflow #6 archive support;
- change scanner limits;
- solve large-scale scanning;
- create a database;
- create UI;
- create canonical knowledge;
- perform governance review;
- perform candidate acceptance or rejection;
- replace Workflows #1-#5B.

## 15. Success Criteria

Workflow #7 direction is successful when it defines a safe next capability boundary for:

- consuming a valid Workflow #6 staged intake;
- invoking downstream evidence processing only on the staged snapshot;
- preserving provenance;
- reporting downstream truncation and failures;
- preserving authority as `NONE`;
- preserving existing workspace containment.

## 16. Preconditions for a Future Execution Contract

A future Workflow #7 execution contract may be drafted only after explicit approval.

Before implementation can be authorized, the execution contract must define:

- exact accepted input shape;
- exact manifest validation rules;
- exact staged snapshot validation rules;
- exact downstream workflow selection;
- exact output schema;
- exact failure payloads;
- exact determinism requirements;
- exact regression requirements;
- exact commit scope.

Until that contract exists and is approved, Workflow #7 implementation is not authorized.
