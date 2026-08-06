# GT63 Machine Workflow #5A Execution Contract

## Purpose

Workflow #5A builds an evidence-backed Canonical Candidate Model from existing GT63 Machine runtime outputs.

It creates one deterministic `canonical-candidate.json` document containing candidate knowledge objects only.

Workflow #5A may:

- collect evidence-backed candidate objects;
- normalize candidate object structure;
- merge exact duplicate candidates when evidence supports the merge;
- preserve provenance;
- assign stable candidate identifiers;
- produce deterministic candidate output.

Workflow #5A must not:

- declare canonical truth;
- resolve authority-bearing conflicts;
- review, accept or reject candidates;
- lock decisions;
- update the Constitution;
- update Governance;
- promote candidates to canonical;
- write `canonical.json`.

## Input Contract

Workflow #5A consumes only existing GT63 Machine local runtime outputs and repository evidence.

Valid input must include:

- repository path resolved inside the active repository workspace;
- configured scanner limits;
- evidence records produced by the existing Evidence Extractor;
- document classifications produced by Workflow #2;
- relationship graph output produced by Workflow #3;
- summary output produced by Workflow #4.

The input workflow name must be:

```text
canonical-candidate-builder
```

The input fixture must use:

```json
{
  "workflow": "canonical-candidate-builder",
  "repositoryPath": "."
}
```

A valid input path:

- must be a string;
- must resolve to an existing directory;
- must remain inside the active repository workspace;
- must not require external APIs, databases, UI state or generated artifacts.

Invalid input must return deterministic failure JSON and a non-zero exit code.

## Output Contract

Workflow #5A produces one structured JSON document to stdout.

The output is a candidate model, not a canonical model.

The output object must follow this shape:

```json
{
  "status": "PASS",
  "workflow": "canonical-candidate-builder",
  "repository": {
    "root": "C:/Users/user/Desktop/2l1p-neural-travel-v9",
    "gitStatus": "AVAILABLE",
    "branch": "main",
    "head": "..."
  },
  "candidateModel": {
    "schemaVersion": "candidate-v1",
    "authority": "NONE",
    "canonicalStatus": "NOT_CANONICAL",
    "generatedFrom": {
      "workflow1": "local-repository-bootstrap",
      "workflow2": "local-document-report",
      "workflow3": "document-relationship-map",
      "workflow4": "machine-graph-summary"
    },
    "objects": [
      {
        "id": "candidate:architecture:docs/example.md",
        "type": "Architecture",
        "status": "CANDIDATE",
        "title": "example",
        "sourceEvidence": [
          {
            "path": "docs/example.md",
            "evidenceType": "DOCUMENT"
          }
        ],
        "confidence": "EVIDENCE_BACKED",
        "relatedObjects": [],
        "lastUpdated": null
      }
    ],
    "evidenceIndex": [
      {
        "path": "docs/example.md",
        "candidateIds": ["candidate:architecture:docs/example.md"]
      }
    ],
    "warnings": []
  },
  "failures": []
}
```

Required candidate object fields:

- `id`;
- `type`;
- `status`;
- `title`;
- `sourceEvidence`;
- `confidence`;
- `relatedObjects`;
- `lastUpdated`.

Allowed candidate object types:

- `CandidateConstitution`;
- `CandidateNorthStar`;
- `CandidateProductIdentity`;
- `CandidateArchitecture`;
- `CandidateGovernance`;
- `CandidateProductMode`;
- `CandidateSubsystem`;
- `CandidateWorkstream`;
- `CandidateDecision`;
- `CandidateLock`;
- `CandidateGlossary`;
- `CandidateEvidence`.

Required ordering:

- candidate objects sorted by `id`;
- source evidence sorted by `path`, then `evidenceType`;
- related objects sorted lexically;
- evidence index sorted by `path`;
- candidate IDs inside each evidence index entry sorted lexically;
- object keys emitted in a stable order.

Every candidate object must have at least one source evidence record.

No candidate object may claim canonical, locked, accepted or authoritative status.

## Regression Criteria

Workflow #5A regression must verify:

- Workflow #1 regression remains PASS;
- Workflow #2 regression remains PASS;
- Workflow #3 regression remains PASS;
- Workflow #4 regression remains PASS;
- Workflow #5A command returns exit code `0`;
- stdout contains exactly one parseable JSON document;
- `candidateModel.authority` is `NONE`;
- `candidateModel.canonicalStatus` is `NOT_CANONICAL`;
- candidate objects are non-empty;
- every candidate object has stable required fields;
- every candidate object has at least one source evidence record;
- every candidate object status is `CANDIDATE`;
- no output file named `canonical.json` is written;
- invalid repository input exits non-zero with deterministic failure JSON;
- two identical runs produce deeply equal normalized JSON;
- no child Node processes remain after execution;
- existing dirty files remain untouched.

PASS means all regression checks pass and no out-of-scope files are modified.

FAIL means any required regression check fails, output is non-deterministic, candidate objects lack evidence, authority-bearing status appears, or unrelated files are modified.
