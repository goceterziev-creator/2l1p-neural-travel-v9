# GT63 Machine Workflow #5B Execution Contract

## Status

APPROVED / LOCKED

## Workflow

#5B - Candidate Review & Resolution

## Authority

NONE

## 1. Purpose

Workflow #5B reviews the candidate knowledge model produced by Workflow #5A.

Its responsibility is limited to analysis and recommendation.

Workflow #5B does not modify candidate knowledge, create canonical knowledge, or make governance decisions.

## 2. Execution Authority

This execution contract is the sole implementation authority for Workflow #5B.

Implementation must not extend beyond the scope explicitly defined by this document.

If this contract is missing, internally contradictory, or impossible to implement without exceeding its authority boundary, the implementing agent must stop and produce a Hard Stop Report.

A Hard Stop Report is an implementation-process behavior. It is not a Workflow #5B runtime output.

## 3. Input Contract

Required input:

- a canonical candidate model JSON document conforming to the Workflow #5A output contract.

The input may be provided as:

- a file named `canonical-candidate.json`; or
- a captured JSON document from Workflow #5A runtime output.

Workflow #5B must not require Workflow #5A to write `canonical-candidate.json`.

Workflow #5B must not modify Workflow #5A in order to obtain its input.

The runtime must return a deterministic failure payload if the required candidate model input is:

- missing;
- malformed;
- structurally invalid;
- or incompatible with the Workflow #5A output contract.

## 4. Responsibilities

Workflow #5B may:

- review candidate objects;
- detect duplicate candidates;
- detect conflicting candidates;
- identify candidates with missing evidence;
- identify unsupported candidates;
- evaluate review completeness;
- organize review findings;
- generate recommendations.

Workflow #5B must preserve all source-evidence references used by its review findings.

## 5. Output Contract

Workflow #5B produces one structured JSON document to stdout.

The logical output document is named `canonical-review.json`, but Workflow #5B does not write `canonical-review.json` unless a future execution contract explicitly authorizes file output.

The output is recommendation-only.

It has no canonical authority.

It must not represent recommendations as accepted decisions or governance outcomes.

## 6. Authority Boundaries

Workflow #5B has no review-decision or canonical authority.

Workflow #5B may not:

- create `canonical.json`;
- promote candidates to canonical;
- accept candidates;
- reject candidates;
- lock decisions;
- update Constitution;
- update Governance;
- modify Locks;
- modify candidate objects;
- redefine product truth;
- represent recommendations as governance outcomes.

Authority remains `NONE`.

## 7. Candidate Preservation

The candidate input model is read-only.

Workflow #5B must not:

- alter candidate fields;
- alter candidate status;
- alter candidate identifiers;
- remove candidates;
- add candidates to the input model;
- rewrite source evidence;
- or overwrite the candidate input artifact.

Any review classification or recommendation must exist only inside the Workflow #5B output.

## 8. Determinism

Given identical valid input, Workflow #5B must produce identical logical output.

The workflow must not use:

- random ordering;
- timestamps that change the result;
- nondeterministic identifiers;
- environment-dependent ordering;
- or unstable serialization.

All output collections must use explicitly defined deterministic ordering.

## 9. Runtime Failure Behavior

The Workflow #5B runtime must return a deterministic failure payload when runtime execution cannot proceed because of invalid or missing input.

The failure payload must:

- identify Workflow #5B;
- report `status: FAIL`;
- identify the failure reason;
- preserve authority as `NONE`;
- perform no partial candidate mutation;
- create no canonical artifact.

A runtime input failure is not a Hard Stop Report.

## 10. Implementation Hard Stop Conditions

The implementing agent must stop and produce a Hard Stop Report if:

- this execution contract is missing;
- the contract is internally contradictory;
- the contract cannot be implemented exactly;
- implementation requires authority beyond Workflow #5B;
- implementation requires modifying Workflow #5A;
- implementation requires modifying candidate knowledge;
- implementation requires creating canonical knowledge;
- or implementation requires an architectural decision not authorized by this contract.

No implementation may continue after a Hard Stop.

## 11. Regression Requirements

Regression must verify:

- deterministic output from identical input;
- deterministic failure output for missing input;
- deterministic failure output for malformed or invalid input;
- preservation of source-evidence references;
- no modification of the candidate input model;
- no creation of `canonical.json`;
- no candidate acceptance or rejection;
- no governance decision output;
- authority remains `NONE`;
- recommendations remain explicitly non-binding.

Regression must not require Workflow #5A to write `canonical-candidate.json`.

## 12. Success Criteria

Workflow #5B succeeds when it:

- accepts a valid candidate model conforming to the Workflow #5A output contract;
- reviews candidate knowledge without modifying it;
- produces a deterministic recommendation-only review document;
- preserves relevant evidence provenance;
- performs no canonical or governance operation;
- and remains strictly within authority `NONE`.

## 13. Explicit Non-Goals

Workflow #5B does not:

- create candidate knowledge;
- modify candidate knowledge;
- canonize knowledge;
- accept or reject candidates;
- resolve governance decisions;
- update product truth;
- modify Constitution;
- modify Governance;
- modify Locks;
- promote recommendations;
- modify Workflow #5A;
- or change repository state beyond its explicitly authorized implementation and test files.

These responsibilities remain outside Workflow #5B.
