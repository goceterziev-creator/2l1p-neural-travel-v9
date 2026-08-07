# GT63 Machine - Workflow #6 Direction

## Title

Workflow #6 - External Artifact Intake

## Evidence Basis

Operational Validation #1 and Operational Validation #2 independently produced the same finding:

```text
INPUT_PATH_INVALID
```

The current GT63 Machine runtime cannot process external artifact folders or bundles because existing workflows require `repositoryPath` to remain inside the active repository workspace.

This behavior is intentional and protects the current safety model.

## Finding Classification

Missing capability / contract mismatch

This is not classified as a runtime bug.

## Purpose

Define a new workflow direction for safely accepting external artifact sets without weakening the existing repository boundary.

The workflow should:

- accept an explicitly supplied external folder or archive;
- validate the source path;
- prevent traversal, symlink, junction, and archive-extraction escapes;
- enforce file-count and byte-size limits;
- materialize a deterministic read-only snapshot in a Machine-controlled staging area;
- preserve provenance between original source and staged copy;
- produce a manifest containing files, hashes, sizes, metadata, and unreadable-file errors;
- allow existing GT63 Machine workflows to consume only the staged workspace-safe snapshot.

## Authority

NONE

The workflow may stage and describe evidence.

It may not:

- create canonical knowledge;
- accept or reject candidates;
- modify Constitution;
- modify Governance;
- modify Locks;
- write to the external source;
- treat external artifacts as current repository truth.

## Existing Workflow Boundary

Do not modify Workflows #1-#5B.

Do not relax the current `repositoryPath` protection.

Do not allow existing workflows to scan arbitrary absolute paths directly.

## Status

Direction proposal only

Implementation is not authorized.

Execution contract is not authorized.

Runtime changes are not authorized.

Regression changes are not authorized.

Commit is not authorized unless separately approved.
