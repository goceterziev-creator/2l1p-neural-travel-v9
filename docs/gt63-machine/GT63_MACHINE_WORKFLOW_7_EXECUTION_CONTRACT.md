# GT63 Machine - Workflow #7 Execution Contract

Status: DRAFT

Workflow: #7 - Intake Processing Bridge

Authority: NONE

Implementation: NOT AUTHORIZED

Commit: NOT AUTHORIZED

## 1. Purpose

Workflow #7 consumes a valid Workflow #6 staged intake and bridges it into the existing Machine evidence-processing path.

Workflow #7 does not perform external artifact intake.

Workflow #7 does not extract archives.

Workflow #7 does not modify Workflow #6 output.

Workflow #7 does not create canonical knowledge or governance decisions.

## 2. Authoritative Basis

This draft contract is derived from:

```text
docs/gt63-machine/GT63_MACHINE_WORKFLOW_7_DIRECTION.md
```

Repository evidence identifies the exact downstream Machine evidence-processing capability as:

```text
run-bootstrap.js
-> machine-core.js executeWorkflow()
-> workflow: local-repository-bootstrap
-> repositoryPath: <Workflow #6 staged snapshot path>
-> repository-scanner.js
-> evidence-extractor.js
-> evidence-classifier.js
```

Workflow #7 must not invent a new scanner.

Workflow #7 must not change existing scanner limits.

Workflow #7 reuses the current `local-repository-bootstrap` behavior as the downstream evidence-processing path.

## 3. Capability Boundary

Workflow #7 boundary:

```text
valid Workflow #6 staged intake
-> Workflow #7 Intake Processing Bridge
-> local-repository-bootstrap evidence-processing path
-> structured downstream evidence result
```

Workflow #7 is not:

- Workflow #6 intake;
- archive extraction;
- external path scanning;
- scanner redesign;
- candidate review;
- canonical promotion;
- governance review.

## 4. Workflow Name

The Workflow #7 runtime workflow name is:

```text
intake-processing-bridge
```

## 5. Input Contract

Workflow #7 accepts exactly one input field:

```json
{
  "workflow": "intake-processing-bridge",
  "manifestPath": "tmp/gt63-machine-intake/<intakeId>/manifest.json"
}
```

`workflow` is required and must equal `intake-processing-bridge`.

`manifestPath` is required and must be a non-empty string.

Workflow #7 v1 does not accept `intakeId` as an external input field.

Workflow #7 v1 does not accept `snapshotPath` as an external input field.

If `intakeId`, `snapshotPath`, `repositoryPath`, `externalSourcePath`, or any other redundant source reference is present in the input, Workflow #7 must fail with `INPUT_REFERENCE_UNSUPPORTED`.

The caller must never supply the original external source path as a downstream `repositoryPath`.

## 6. Path Normalization

`manifestPath` is interpreted relative to the active repository workspace root.

Absolute `manifestPath` input is rejected.

Backslashes in `manifestPath` are normalized to `/` for validation and output.

The normalized manifest path must match:

```text
tmp/gt63-machine-intake/<intakeId>/manifest.json
```

`<intakeId>` must match:

```text
intake-[a-f0-9]{64}
```

The resolved manifest path must remain inside:

```text
<workspaceRoot>/tmp/gt63-machine-intake/
```

Otherwise Workflow #7 must fail with `STAGING_BOUNDARY_VIOLATION`.

Containment validation has two required layers:

1. lexical containment after path normalization;
2. final filesystem-resolved containment after resolving symlinks, junctions, reparse points, and filesystem indirection relevant to the active platform.

Both layers must remain inside the approved Workflow #6 staging boundary.

Lexical containment alone is insufficient.

If final filesystem target resolution fails for an existing candidate manifest path, Workflow #7 must fail with `STAGING_BOUNDARY_VIOLATION`.

If the final filesystem-resolved manifest target is outside the approved staging boundary, Workflow #7 must fail with `STAGING_BOUNDARY_VIOLATION`.

Downstream processing must not occur after a containment failure.

## 7. Workflow #6 Manifest Validation

Workflow #7 must load the referenced Workflow #6 manifest before downstream processing.

The manifest is valid only when all of the following are true:

- file exists;
- file is readable;
- file parses as JSON;
- `workflow` equals `external-artifact-intake`;
- `authority` equals `NONE`;
- `logicalDocumentName` equals `external-artifact-intake-manifest.json`;
- `status` is one of the finalized Workflow #6 statuses: `PASS`, `PASS_WITH_WARNINGS`, or `FAIL`;
- `intake.intakeId` equals the intake ID derived from `manifestPath`;
- `intake.manifestPath` equals the normalized input `manifestPath`;
- `intake.stagingRoot` equals `tmp/gt63-machine-intake/<intakeId>`;
- `intake.snapshotRoot` equals `tmp/gt63-machine-intake/<intakeId>/snapshot`;
- `intake.sourcePath` is a non-empty string;
- `intake.sourceKind` is `directory` or `zip`;
- `intake.downstreamEligibility` is one of `ELIGIBLE`, `ELIGIBLE_WITH_WARNINGS`, or `NOT_ELIGIBLE`;
- `summary` is an object;
- `summary.warnings` is an array;
- `summary.limitViolations` is an array;
- `artifacts` is an array;
- `failures` is an array.

If the manifest is missing, fail with `MANIFEST_MISSING`.

If the manifest cannot be parsed, fail with `MANIFEST_INVALID`.

If the manifest schema or required values are invalid, fail with `MANIFEST_INVALID`.

If `intake.intakeId` does not match the path-derived intake ID, fail with `INTAKE_ID_MISMATCH`.

If any manifest path field escapes the approved staging root, fail with `STAGING_BOUNDARY_VIOLATION`.

If manifest `status` is any value other than `PASS`, `PASS_WITH_WARNINGS`, or `FAIL`, fail with `MANIFEST_INVALID`.

The valid finalized Workflow #6 status and downstream eligibility pairs are exactly:

| Workflow #6 status | downstreamEligibility | Workflow #7 behavior |
|---|---|---|
| `PASS` | `ELIGIBLE` | may continue |
| `PASS_WITH_WARNINGS` | `ELIGIBLE_WITH_WARNINGS` | may continue |
| `FAIL` | `NOT_ELIGIBLE` | fail with `INTAKE_NOT_ELIGIBLE` |

Any other status/eligibility pair is invalid and must fail with `MANIFEST_INVALID`.

A manifest must not be processed merely because `downstreamEligibility` says `ELIGIBLE` or `ELIGIBLE_WITH_WARNINGS` when manifest `status` is not the corresponding valid finalized Workflow #6 status.

Workflow #7 must not repair or rewrite the manifest.

## 8. Downstream Eligibility

Workflow #7 may proceed only when:

- `intake.downstreamEligibility` is `ELIGIBLE`;
- or `intake.downstreamEligibility` is `ELIGIBLE_WITH_WARNINGS`.

Workflow #7 must fail with `INTAKE_NOT_ELIGIBLE` when:

- `intake.downstreamEligibility` is `NOT_ELIGIBLE`;
- or manifest `status` is `FAIL`.

Workflow #6 warnings are propagated into the Workflow #7 output under:

```text
intake.warnings
```

Workflow #6 warnings do not become authority-bearing decisions.

If Workflow #6 eligibility is `ELIGIBLE_WITH_WARNINGS`, Workflow #7 must include warning `INTAKE_WARNINGS_PROPAGATED` and derive top-level status according to the Workflow #7 status derivation rule.

## 9. Staged Snapshot Validation

Before downstream processing, Workflow #7 must validate:

- the snapshot path from the manifest exists;
- the snapshot path is a directory;
- the snapshot path is lexically contained inside `<workspaceRoot>/tmp/gt63-machine-intake/<intakeId>/snapshot`;
- the final filesystem-resolved snapshot target remains inside `<workspaceRoot>/tmp/gt63-machine-intake/<intakeId>/snapshot` after resolving symlinks, junctions, reparse points, and filesystem indirection relevant to the active platform;
- the snapshot path belongs to the same intake ID as the manifest;
- the snapshot path is not the original external source;
- the snapshot path is not supplied directly by the caller;
- the snapshot path is not outside the repository workspace.

If the snapshot is missing, fail with `SNAPSHOT_MISSING`.

If the snapshot is not a directory, fail with `SNAPSHOT_INVALID`.

If final filesystem target resolution fails for an existing candidate snapshot path, fail with `STAGING_BOUNDARY_VIOLATION`.

If the snapshot escapes the staging root lexically or after final filesystem target resolution, fail with `STAGING_BOUNDARY_VIOLATION`.

Workflow #7 must not modify the staged snapshot.

Workflow #7 must not extract archives.

## 10. Downstream Execution

Workflow #7 must invoke or directly reuse the existing `local-repository-bootstrap` behavior with this effective downstream input:

```json
{
  "workflow": "local-repository-bootstrap",
  "repositoryPath": "tmp/gt63-machine-intake/<intakeId>/snapshot"
}
```

The downstream target is always the staged snapshot path from the validated Workflow #6 manifest.

Workflow #7 must not pass the original external source path to downstream processing.

Workflow #7 must not pass an arbitrary caller-supplied repository path to downstream processing.

The existing `local-repository-bootstrap` scanner limits remain authoritative.

The downstream output consumed by Workflow #7 is the structured result from `local-repository-bootstrap`, including:

- `status`;
- `repository`;
- `scan`;
- `evidence`;
- `classifications`;
- `logs`;
- `failures`.

## 11. Execution Sequence

Workflow #7 execution order is:

```text
validate Workflow #7 input
-> normalize manifestPath
-> resolve Workflow #6 intake ID
-> validate manifest path containment
-> load Workflow #6 manifest
-> validate manifest schema and intake consistency
-> validate downstream eligibility
-> validate staged snapshot
-> invoke local-repository-bootstrap on staged snapshot
-> validate downstream result shape
-> attach Workflow #6 provenance
-> emit Workflow #7 result
```

If any validation step fails, downstream processing must not occur.

No hidden partial continuation is allowed after a blocking validation failure.

## 12. Output Contract

Workflow #7 emits exactly one structured JSON document to stdout through the existing bootstrap entrypoint.

Top-level object fields, in order:

```text
status
workflow
authority
intake
downstream
provenance
warnings
failures
```

`status` is one of:

- `PASS`;
- `PASS_WITH_WARNINGS`;
- `FAIL`.

`workflow` is:

```text
intake-processing-bridge
```

`authority` is:

```text
NONE
```

`intake` object fields:

```text
intakeId
sourceKind
sourcePath
manifestPath
stagingRoot
snapshotRoot
downstreamEligibility
status
warnings
limitViolations
artifactSummary
```

`artifactSummary` fields:

```text
totalDiscovered
staged
unsupported
unreadable
rejected
totalSourceBytes
totalStagedBytes
```

`downstream` object fields:

```text
workflow
status
repository
scan
filesScanned
filesSkipped
truncated
truncationReason
evidenceCount
classifications
warnings
failures
```

`provenance` object fields:

```text
externalSourcePath
workflow6IntakeId
workflow6ManifestPath
workflow6SnapshotRoot
workflow7DownstreamWorkflow
```

`warnings` is a deterministic array of Workflow #7 warnings.

`failures` is a deterministic array of Workflow #7 failures.

Failure output must still include all top-level fields. Unknown values must be `null`, empty arrays, or empty objects according to field type.

Workflow #7 warning aggregation occurs before top-level status derivation.

Top-level Workflow #7 status derivation is exactly:

1. any blocking Workflow #7 failure -> `FAIL`;
2. successful downstream execution plus one or more Workflow #7 warnings -> `PASS_WITH_WARNINGS`;
3. successful downstream execution plus zero Workflow #7 warnings -> `PASS`.

This rule applies equally to:

- `INTAKE_WARNINGS_PROPAGATED`;
- `DOWNSTREAM_TRUNCATED`;
- `DOWNSTREAM_WARNINGS_PROPAGATED`;
- any future Contract-defined non-fatal Workflow #7 warning.

Two conforming implementations must not emit different top-level status for the same warnings array and downstream result.

## 13. Warning Vocabulary

Workflow #7 warning codes:

- `INTAKE_WARNINGS_PROPAGATED`;
- `DOWNSTREAM_TRUNCATED`;
- `DOWNSTREAM_WARNINGS_PROPAGATED`.

Warning order is the order listed above.

`INTAKE_WARNINGS_PROPAGATED` is included when Workflow #6 manifest `summary.warnings` is non-empty.

`DOWNSTREAM_TRUNCATED` is included when downstream `scan.truncated` is `true`.

`DOWNSTREAM_WARNINGS_PROPAGATED` is included when downstream logs or warnings indicate non-fatal downstream warnings.

## 14. Failure Vocabulary

Workflow #7 failure codes and deterministic messages:

| code | message |
|---|---|
| `INPUT_INVALID` | `Workflow #7 input is invalid.` |
| `INPUT_REFERENCE_UNSUPPORTED` | `Workflow #7 accepts only manifestPath as an intake reference.` |
| `MANIFEST_PATH_INVALID` | `Workflow #7 manifestPath is invalid.` |
| `MANIFEST_MISSING` | `Workflow #6 manifest was not found.` |
| `MANIFEST_INVALID` | `Workflow #6 manifest is invalid.` |
| `INTAKE_ID_MISMATCH` | `Workflow #6 manifest intakeId does not match manifestPath.` |
| `STAGING_BOUNDARY_VIOLATION` | `Workflow #6 staging boundary validation failed.` |
| `SNAPSHOT_MISSING` | `Workflow #6 staged snapshot was not found.` |
| `SNAPSHOT_INVALID` | `Workflow #6 staged snapshot is invalid.` |
| `INTAKE_NOT_ELIGIBLE` | `Workflow #6 intake is not eligible for downstream processing.` |
| `DOWNSTREAM_INVOCATION_FAILED` | `Downstream evidence processing failed.` |
| `DOWNSTREAM_RESULT_INVALID` | `Downstream evidence-processing result is invalid.` |
| `PROVENANCE_INCONSISTENCY` | `Workflow #7 provenance validation failed.` |

Every failure output has `status: FAIL`.

If a Workflow #7 validation failure occurs before downstream invocation, `downstream.status` is `NOT_RUN`.

If downstream processing is invoked and returns `FAIL`, Workflow #7 fails with `DOWNSTREAM_INVOCATION_FAILED`.

If downstream processing returns malformed output, Workflow #7 fails with `DOWNSTREAM_RESULT_INVALID`.

Workflow #7 must not mutate Workflow #6 state during failure handling.

## 15. Truncation Semantics

Workflow #7 detects truncation from downstream:

```text
downstream.scan.truncated
downstream.scan.truncationReason
```

When downstream truncation is present:

- `downstream.truncated` is `true`;
- `downstream.truncationReason` copies downstream `scan.truncationReason`;
- `downstream.filesScanned` copies downstream `scan.filesScanned`;
- `downstream.filesSkipped` copies downstream `scan.filesSkipped`;
- `downstream.evidenceCount` is the length of downstream `evidence`;
- warning `DOWNSTREAM_TRUNCATED` is included.

Downstream truncation is not a Workflow #6 defect.

Downstream truncation is not automatically a Workflow #7 failure.

If downstream status is `PASS` and truncation is present, Workflow #7 status is `PASS_WITH_WARNINGS`.

Workflow #7 must not change scanner limits.

## 16. Provenance Policy

Workflow #7 copies these values from the Workflow #6 manifest:

- `intake.intakeId`;
- `intake.sourceKind`;
- `intake.sourcePath`;
- `intake.manifestPath`;
- `intake.stagingRoot`;
- `intake.snapshotRoot`;
- `intake.downstreamEligibility`;
- `summary.warnings`;
- `summary.limitViolations`.

Workflow #7 derives:

- downstream workflow as `local-repository-bootstrap`;
- downstream target from `intake.snapshotRoot`;
- downstream evidence result from the downstream output.

Workflow #7 must not convert provenance into product truth.

External evidence remains evidence.

## 17. Determinism

Given identical valid Workflow #6 intake state and identical downstream Machine state/configuration, Workflow #7 must produce identical normalized output.

Deterministic requirements:

- same `status`;
- same `warnings` order;
- same `failures` order;
- same provenance representation;
- same downstream scan/truncation representation;
- same evidence count;
- same classification summary.

Workflow #7 must not add timestamps, random identifiers, environment-specific path representations, or nondeterministic ordering to output.

Paths in output use `/`.

## 18. Safety Boundaries

Workflow #7 must not:

- read the original external source as downstream `repositoryPath`;
- write to the original external source;
- modify Workflow #6 manifest;
- modify Workflow #6 snapshot;
- extract archives;
- scan arbitrary external paths;
- weaken repositoryPath containment;
- write outside approved Machine-controlled output paths;
- treat staged evidence as repository truth;
- create canonical knowledge.

Existing behavior must remain:

```text
arbitrary external repositoryPath
-> Workflows #1-#5B
-> INPUT_PATH_INVALID
```

## 19. Authority

Authority: NONE

Workflow #7 may process and report evidence.

Workflow #7 may not:

- create canonical knowledge;
- promote candidates;
- accept candidates;
- reject candidates;
- modify Constitution;
- modify Governance;
- modify Locks;
- redefine product truth;
- infer GT63 applicability from external evidence alone.

Workflow #7 must not create:

- `canonical.json`;
- `canonical-review.json`.

## 20. Relationship to Workflows #1-#6

Workflow #6 produces validated staged intake.

Workflow #7 bridges that intake into downstream evidence processing.

Workflows #1-#5B retain their existing responsibilities and containment rules.

Workflow #7 must not redefine public contracts for Workflows #1-#6.

## 21. Regression Requirements

A future Workflow #7 implementation must include deterministic regression coverage for:

- valid `ELIGIBLE` intake;
- valid `ELIGIBLE_WITH_WARNINGS` intake;
- `NOT_ELIGIBLE` rejection;
- missing `manifestPath`;
- unsupported `intakeId` input;
- unsupported `snapshotPath` input;
- unsupported `repositoryPath` input;
- invalid manifest path;
- missing manifest;
- malformed manifest;
- manifest/intakeId mismatch;
- missing snapshot;
- invalid snapshot;
- staging escape attempt;
- manifest path lexically inside staging but filesystem-resolved outside staging;
- staged snapshot lexically inside staging but filesystem-resolved outside staging;
- final filesystem target resolution failure;
- every valid finalized Workflow #6 status;
- unknown or non-final Workflow #6 status;
- valid downstream eligibility paired with invalid or non-final manifest status;
- original external path rejection;
- provenance preservation;
- deterministic repeated run;
- scanner truncation propagation;
- successful downstream execution with zero warnings;
- successful downstream execution with Workflow #6 warnings only;
- successful downstream execution with downstream warnings only;
- successful downstream execution with truncation warning only;
- successful downstream execution with multiple warning classes;
- downstream failure propagation;
- downstream malformed result;
- Workflow #6 state remains unchanged;
- external source remains unchanged;
- Workflows #1-#5B regressions remain PASS;
- arbitrary external repositoryPath remains `INPUT_PATH_INVALID`;
- no canonical, governance, or lock side effects;
- no residual child processes where applicable.

## 22. Commit Scope for Future Implementation

This draft authorizes no implementation.

A future implementation commit scope must be defined by a later approved execution prompt.

This drafting step may create only:

```text
docs/gt63-machine/GT63_MACHINE_WORKFLOW_7_EXECUTION_CONTRACT.md
```

## 23. Contract Closure Rule

The contract is implementation-ready only when two reasonable independent implementers can produce materially equivalent observable Workflow #7 v1 behavior.

Review blockers are valid when ambiguity can produce material differences in:

- security;
- status;
- provenance;
- downstream execution;
- truncation;
- deterministic output;
- cleanup;
- authority.

Implementation mechanics that preserve contract-defined observable behavior are not contract blockers.
