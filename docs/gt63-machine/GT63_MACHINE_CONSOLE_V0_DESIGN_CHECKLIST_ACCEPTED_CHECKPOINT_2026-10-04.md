# GT63 MACHINE Console V0 — Design Checklist Accepted Checkpoint

Date: 2026-10-04 Europe/Sofia

## Status

The GT63 MACHINE Console V0 design checklist is accepted in full by explicit human governance decision.

Acceptance covers the evidence-console design and the dormant stdout-only CLI implementation direction only.

This checkpoint is documentation-only. It preserves the accepted design semantics but does not authorize implementation, file creation or modification, tests, repository operations, runtime wiring, deployment, execution, external access, or authority widening.

```text
MACHINE CONSOLE V0 DESIGN CHECKLIST: ACCEPTED
MACHINE CONSOLE V0 IMPLEMENTATION: NOT AUTHORIZED
MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

## Human Governance Decision

The human governance decision accepts GT63 MACHINE Console V0 as an evidence console only.

Console V0 is not an operator console. It may display repository and governance evidence from exact Git objects but may not initiate, perform, authorize, or imply operational activity.

The acceptance applies to design semantics only. It creates no implementation authority and no MACHINE authority.

## Accepted Scope

Console V0 has one accepted purpose:

> Present bounded repository and governance evidence from exact Git objects without executing workflows, inspecting runtime state, accessing external systems, mutating data, or creating authority.

Accepted scope:

- evidence display only;
- repository identity display;
- governance-state display;
- checkpoint chronology display;
- provider-free owner status display;
- blocked-frontier display;
- explicitly non-authoritative bounded recommendations;
- permanent display of prohibited actions and authority boundaries;
- dormant stdout-only CLI as the recommended implementation direction.

Console V0 must remain passive, read-only, dormant and non-authoritative.

## Data-Source Boundary

The only accepted data source is exact Git object inspection.

Permitted evidence classes:

- exact remote ref identity;
- commit identity;
- parent identity;
- tree identity;
- blob identity;
- repository path;
- commit date and subject;
- exact commit history;
- checkpoint content read from an exact Git object;
- source presence established through an exact tree or blob.

The accepted discovery baseline is:

```text
origin/main:
d429d808f5a5c4e762f1d2e721caf8472f02e7c6

tree:
dd652d04c404761acab72561b07e3a51ae65a2cd
```

Working-tree content is not authoritative Console V0 evidence.

Source modules may be inspected as inert Git blobs. They must not be imported, required, evaluated or executed.

Checkpoint documents may be displayed only with their exact Git provenance and evidence scope.

Exact Git object inspection does not authorize fetch, checkout, ref mutation, repository mutation or execution of repository material.

## Prohibited Access and Execution

Console V0 must not perform or initiate:

- live database access;
- filesystem database inspection;
- database mutation;
- runtime inspection;
- runtime attachment;
- process inspection;
- Railway access;
- deployment-platform access;
- login;
- session interaction;
- observation execution;
- workflow execution;
- eligibility execution;
- Gate creation;
- Gate selection;
- Gate satisfaction;
- continuation execution;
- effect execution;
- offer mutation;
- deployment;
- merge;
- repository mutation;
- authority creation.

Console V0 must not import or execute GT63 workflow, eligibility, admission, observation, Gate, continuation, effect or offer modules.

## Allowed Views

Console V0 may contain exactly these views:

### 1. Repository Identity

May display:

- evidence scope;
- remote ref;
- commit;
- parent;
- tree;
- commit date;
- commit subject.

### 2. Provider-Free Owner

May display:

- exact accepted checkpoint identity;
- exact provider-free implementation identity;
- exact regression identity;
- accepted provider-free status;
- preserved non-authority boundaries.

The view must not execute the owner or regression suite.

Provider-free implementation presence or conformance must not be presented as production trust, runtime integration, principal eligibility or authority.

### 3. Latest Checkpoints

May display checkpoint chronology derived from exact Git history and exact object presence.

Each entry must retain:

- evidence scope;
- path;
- commit identity;
- blob identity when available;
- date;
- checkpoint classification.

Chronology must not independently create acceptance, supersession or authority.

### 4. Governance State

May display only explicit preserved governance labels with exact source provenance.

It must not synthesize new governance decisions.

### 5. Blocked Frontiers

May display only boundaries explicitly classified as:

- blocked;
- deferred;
- absent;
- unknown;
- not authorized.

It must not infer that a blocked frontier has been satisfied.

### 6. Next Bounded Action

May display a clearly labelled non-authoritative recommendation.

The recommendation must remain separate from:

- repository facts;
- governance decisions;
- accepted scope;
- implementation authority;
- MACHINE authority.

A displayed recommendation does not authorize execution.

### 7. Not Authorized

Must permanently display the prohibited-action and authority boundary.

No additional Console V0 view is authorized by this checkpoint.

## Main Versus Candidate-Branch Separation

Facts from `origin/main` and facts from candidate branches must remain separate.

A candidate-branch object must not be presented as an `origin/main` fact.

The Account→Interaction blocked-frontier checkpoint at:

```text
7f655b71101eacc4dc6b826b456f5ab9b5419ffb
```

is not an `origin/main` fact at the accepted discovery baseline.

Console V0 must not include that checkpoint in a main-only view.

Candidate-branch material may be displayed only if candidate-branch scope is separately and explicitly included. Any such future view must visibly preserve:

- branch or ref identity;
- commit identity;
- tree identity;
- evidence scope;
- non-main classification.

Candidate-branch presence does not establish:

- merge;
- main inclusion;
- current-main status;
- human acceptance;
- implementation acceptance;
- runtime integration;
- authority.

No fact may cross from candidate scope into main scope through inference.

## Evidence Interpretation Rules

Console V0 must preserve these distinctions:

- code presence does not mean implementation acceptance;
- document presence does not mean governance acceptance;
- checkpoint presence does not mean runtime integration;
- regression-file presence does not mean regression execution;
- regression-file presence does not mean regression success;
- implementation presence does not mean deployment;
- provider-free conformance does not mean trusted-provider status;
- dependency injection does not establish provider provenance;
- a structurally valid candidate set does not establish authoritative production evidence;
- a derived query does not establish principal eligibility;
- repository material does not independently create MACHINE authority;
- material presence and governance authority are separate classifications;
- chronology does not independently establish acceptance or supersession;
- historical evidence does not automatically establish current runtime state;
- a recommendation is not a governance decision;
- display is not execution;
- inspection is not authorization.

Console V0 must not promote filenames, code paths, component names or prose claims into stronger evidence classes.

## UNKNOWN and HARD STOP Behavior

Missing required evidence must remain:

```text
UNKNOWN
```

Ambiguous scope must remain:

```text
UNKNOWN
```

A missing or non-materialized required Git object must produce `UNKNOWN` or `HARD STOP`, according to the accepted evidence requirement.

Conflicting authoritative labels must produce:

```text
HARD STOP
```

Duplicate authoritative labels that cannot be reconciled through exact accepted provenance must produce:

```text
HARD STOP
```

Unverifiable commit, parent, tree, blob, path, branch or ref identity must produce:

```text
HARD STOP
```

`UNKNOWN` must not be silently converted into:

- `ABSENT`;
- `REJECTED`;
- `ACCEPTED`;
- `AUTHORIZED`;
- `CURRENT`;
- `PROVEN`;
- `SATISFIED`.

Console V0 must provide no fallback evidence source when exact Git evidence is unavailable.

Console V0 must not repair, reinterpret or synthesize missing governance evidence.

## Latest-State Determination

Latest state must be determined from:

- exact evidence scope;
- exact Git history;
- exact commit identity;
- exact tree identity;
- exact object presence;
- explicit checkpoint classification.

Latest state must not be determined from:

- filename date alone;
- prose claim alone;
- working-tree presence;
- stale pointer material;
- candidate-branch material presented without candidate scope;
- implementation naming;
- historical runtime claims;
- inferred product sequence.

`GT63_LATEST_CONTINUITY_POINTER.md` is stale relative to the accepted discovery baseline and must not drive Console V0 latest state.

A continuity pointer may be displayed only as a dated historical artifact with its exact commit provenance and an explicit indication that it is not the current-state authority.

## Dormant Implementation Direction

The accepted recommended implementation direction is:

> A dormant stdout-only CLI that reads exact Git objects and renders passive evidence views.

The direction permits design consideration of:

- one standalone CLI entry point;
- stdout-only output;
- exact Git ref and object inspection;
- allowlisted checkpoint paths;
- allowlisted governance labels;
- deterministic display ordering;
- explicit evidence-scope labels;
- fail-closed `UNKNOWN` and `HARD STOP` behavior.

The direction does not authorize implementation.

Console V0 must not introduce:

- a web server;
- an Express route;
- a browser control surface;
- an HTTP endpoint;
- application runtime wiring;
- `server.js` wiring;
- a database adapter;
- a Railway adapter;
- a login adapter;
- an observation adapter;
- a workflow adapter;
- an eligibility adapter;
- an execution provider;
- an authority-bearing control.

Any change from the dormant stdout-only CLI direction requires a separate explicit human governance decision.

## Permanent Bottom Boundary

The following boundary must remain permanently visible and must be reproduced exactly:

```text
NO WORKFLOW EXECUTION
NO ELIGIBILITY EXECUTION
NO GATE ACTION
NO OFFER MUTATION
NO RUNTIME / DB / RAILWAY / LOGIN ACTION
MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

## Deferred Decisions

The following decisions remain deferred:

- exact CLI filename;
- exact CLI path;
- exact command-line arguments;
- exact text-output schema;
- whether a machine-readable output format will exist;
- exact label-extraction contract;
- checkpoint precedence rules;
- checkpoint supersession rules;
- whether candidate-branch scope will ever be included;
- exact candidate-scope presentation;
- whether local repository status will be displayed separately;
- behavior when the remote commit object is not locally materialized;
- exact provenance schema for “Next Bounded Action”;
- exact output ordering;
- exact terminal formatting;
- exact error formatting;
- exact `UNKNOWN` classification schema;
- exact `HARD STOP` report schema;
- regression design;
- regression execution;
- implementation authorization;
- file creation or modification;
- staging;
- commit;
- push;
- merge;
- pull request creation;
- deployment;
- runtime wiring;
- any future web or operator-console surface.

Deferred decisions must not be silently resolved during implementation planning or implementation.

## Explicit Non-Claims

Acceptance of the Console V0 design checklist does not establish or authorize:

- Console V0 implementation;
- source-file creation;
- source-file modification;
- documentation-file creation;
- documentation-file modification;
- test creation;
- test execution;
- regression execution;
- staging;
- commit;
- push;
- merge;
- pull request creation;
- deployment;
- runtime wiring;
- DB access;
- DB mutation;
- Railway access;
- login;
- observation;
- workflow execution;
- eligibility execution;
- trusted production-provider status;
- an authoritative account–interaction association;
- an authoritative Gate;
- an authoritative Gate query;
- principal eligibility;
- role creation;
- assignment creation;
- delegation creation;
- Gate creation;
- Gate selection;
- Gate satisfaction;
- human authorization;
- continuation authority;
- execution authority;
- effect authorization;
- offer mutation;
- implementation acceptance;
- release acceptance;
- operational readiness;
- MACHINE authority.

The accepted design does not convert repository presence into authority.

The accepted design does not convert candidate-branch evidence into main evidence.

The accepted design does not convert recommendations into human governance decisions.

## STOP Conditions

Future planning or implementation must stop if:

- Console V0 is treated as an operator console;
- a non-Git evidence source becomes necessary;
- a source module must be imported or executed;
- live DB access becomes necessary;
- runtime inspection becomes necessary;
- Railway access becomes necessary;
- login or session interaction becomes necessary;
- observation execution becomes necessary;
- workflow execution becomes necessary;
- eligibility execution becomes necessary;
- Gate action becomes necessary;
- offer mutation becomes necessary;
- an action button, form or mutation control is introduced;
- main and candidate-branch facts cannot remain separate;
- a candidate-branch fact is presented as an `origin/main` fact;
- commit, parent, tree, blob, path, branch or ref identity cannot be verified;
- candidate commit `7f655b71101eacc4dc6b826b456f5ab9b5419ffb` is presented as a main fact;
- code or document presence is promoted into acceptance or authority;
- regression-file presence is promoted into executed proof;
- stale continuity material drives latest state;
- missing evidence is inferred instead of classified as `UNKNOWN`;
- conflicting authoritative labels do not cause `HARD STOP`;
- duplicate authoritative labels are resolved through inference;
- a fallback evidence source or second flow is introduced;
- the dormant stdout-only CLI direction changes without explicit human approval;
- implementation is attempted without separate authorization;
- runtime wiring, deployment or external action is attempted;
- authority or `authorityEffect` would differ from `NONE`.

## Preserved Final States

```text
MACHINE CONSOLE V0 DESIGN CHECKLIST: ACCEPTED

MACHINE CONSOLE V0 IMPLEMENTATION: NOT AUTHORIZED

NO WORKFLOW EXECUTION

NO ELIGIBILITY EXECUTION

NO GATE ACTION

NO OFFER MUTATION

NO RUNTIME / DB / RAILWAY / LOGIN ACTION

MACHINE AUTHORITY: NONE

authorityEffect: NONE
```

STOP.
