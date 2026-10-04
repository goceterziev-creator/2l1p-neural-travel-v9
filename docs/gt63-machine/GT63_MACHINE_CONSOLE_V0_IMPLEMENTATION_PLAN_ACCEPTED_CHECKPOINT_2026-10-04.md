# GT63 MACHINE Console V0 — Implementation Plan Accepted Checkpoint

Date: 2026-10-04 Europe/Sofia

## Status

The GT63 MACHINE Console V0 implementation plan is accepted in full by explicit human governance decision.

Acceptance covers the dormant stdout-only CLI implementation plan and its provider-free regression strategy.

This checkpoint is documentation-only. It preserves accepted implementation-plan semantics but does not authorize coding, file creation, file modification, test execution, staging, commit, push, merge, pull request creation, deployment, runtime wiring, external access, execution, or authority widening.

```text
MACHINE CONSOLE V0 IMPLEMENTATION PLAN: ACCEPTED
MACHINE CONSOLE V0 IMPLEMENTATION: NOT AUTHORIZED
MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

## Human Governance Decision

The human governance decision accepts the complete GT63 MACHINE Console V0 implementation plan.

The accepted plan defines Console V0 as:

- a dormant stdout-only Node.js CLI;
- an evidence console, not an operator console;
- pinned to an explicitly supplied main commit;
- limited to exact Git object inspection;
- isolated from application and runtime modules;
- unable to access the working tree as repository evidence;
- unable to discover or update remote state;
- unable to execute workflows or authority-bearing actions.

Implementation remains separately unauthorized.

## Exact Accepted File Paths

Primary CLI:

```text
scripts/gt63-machine/gt63-machine-console-v0.js
```

Provider-free regression:

```text
scripts/gt63-machine/gt63-machine-console-v0-regression.js
```

No additional implementation, adapter, configuration, package, route, fixture, runtime or source file is authorized by acceptance of this plan.

The accepted paths identify proposed future implementation surfaces only. They do not authorize file creation.

## Future Invocation Contract

The accepted future invocation is:

```text
node scripts/gt63-machine/gt63-machine-console-v0.js --repo . --main-commit <exact-sha>
```

`<exact-sha>` must identify an explicitly supplied immutable commit object.

The CLI must:

- accept one pinned main commit identity;
- inspect only exact Git objects reachable through that evidence scope;
- write bounded output to stdout;
- terminate after rendering;
- start no listener;
- create no persistent process;
- perform no repository or application mutation.

The supplied SHA must not be labelled as current remote main because Console V0 performs no remote-currentness discovery.

## Pinned Main Evidence Scope

Console V0 has exactly one V0 evidence scope:

```text
PINNED MAIN EVIDENCE SCOPE
```

The supplied commit is treated as an immutable main-scope evidence object.

Console V0 must display:

- the supplied commit identity;
- its parent identity;
- its tree identity;
- its commit date;
- its commit subject;
- exact allowlisted checkpoint paths and blob identities.

Console V0 must not infer:

- that the supplied commit is still the remote main head;
- that local tracking refs are current;
- that a remote branch remains unchanged;
- that repository presence creates governance authority.

Working-tree, index, dirty and untracked content are outside the accepted evidence scope.

## Git-Object Data Boundary

Exact Git object inspection is the only accepted repository evidence source.

Permitted evidence classes include:

- commit identity;
- parent identity;
- tree identity;
- blob identity;
- exact repository path;
- commit metadata;
- exact commit history;
- checkpoint content read from an exact commit/blob;
- source presence established through an exact tree/blob.

Checkpoint content may become a governance data source only when its path and labels are explicitly allowlisted for that purpose.

Discovery of a path in the exact tree does not independently make that path authoritative.

Code presence, document presence, regression presence and checkpoint presence must remain distinct from:

- acceptance;
- execution;
- deployment;
- runtime integration;
- authority.

## Filesystem and `fs` Prohibition

Console V0 must not import Node.js `fs`.

Console V0 must not read repository files directly from the filesystem for evidence.

It must not use:

- working-tree files;
- index content;
- dirty files;
- untracked files;
- filesystem directory enumeration;
- direct checkpoint-file reads;
- filesystem fallback behavior.

Repository evidence must be obtained exclusively through allowlisted Git object commands.

If exact Git-object evidence is unavailable, Console V0 must render `UNKNOWN` or produce `HARD STOP` according to the accepted classification rules.

Unavailable evidence must never cause an `fs` fallback.

## Application and Runtime Isolation

Console V0 must not import, require, load or execute:

- `server.js`;
- application modules;
- runtime modules;
- GT63 executable governance modules;
- AYA runtime modules;
- admission modules;
- observation modules;
- eligibility modules;
- Gate modules;
- workflow modules;
- continuation modules;
- effect modules;
- offer modules;
- database modules;
- Railway modules;
- authentication or session modules.

Console V0 must not use:

- dynamic imports;
- plugin loading;
- module-path discovery;
- discovered module execution.

Application source modules may be represented only as inert Git paths and blob identities.

Their presence must not be interpreted as runtime use, acceptance or authority.

## Allowlisted Git Operations

Only fixed, read-only Git command forms are accepted.

Accepted command forms:

```text
git rev-parse --show-toplevel
git cat-file -e <commit>^{commit}
git show -s --format=<fixed-format> <commit>
git merge-base --is-ancestor <ancestor> <commit>
git ls-tree <commit> -- <path>
git ls-tree -r --name-only <commit> -- docs/gt63-machine
git show <commit>:<path>
git log <commit> -- <allowlisted-path>
git diff-tree --no-commit-id --name-status -r <commit>
```

Git commands must be invoked with argument arrays.

Constructed shell command strings are prohibited.

Every Git argument must come from:

- a validated exact object identity;
- a fixed accepted option;
- an explicitly allowlisted repository path.

No generic shell execution is permitted.

Any required Git operation outside the allowlist causes `HARD STOP`.

## No Remote Discovery or Update

Console V0 must not perform:

```text
git ls-remote
git fetch
git pull
git push
git remote update
git update-ref
```

Console V0 must not:

- contact a remote repository;
- inspect live remote refs;
- refresh tracking refs;
- fetch missing objects;
- update local refs;
- update remote refs;
- infer remote currentness.

No network fallback is permitted.

Remote currentness remains outside Console V0.

A missing local object must remain `UNKNOWN` or cause `HARD STOP`; it must not trigger remote retrieval.

## Seven Stdout Sections

Console V0 must render exactly seven stdout sections, in this order:

```text
1. Repository Identity
2. Provider-Free Owner
3. Latest Checkpoints
4. Governance State
5. Blocked Frontiers
6. Next Bounded Action
7. Not Authorized
```

### 1. Repository Identity

May display:

- `PINNED MAIN EVIDENCE SCOPE`;
- supplied commit;
- parent;
- tree;
- commit date;
- commit subject;
- exact checkpoint paths;
- checkpoint blob identities;
- local object-materialization status.

It must not claim live remote currentness.

### 2. Provider-Free Owner

May display checkpoint-backed states only, including:

```text
IMPLEMENTATION AUTHORIZED: PROVIDER-FREE ONLY
PROVIDER-FREE IMPLEMENTATION CANDIDATE: ACCEPTED
PRINCIPAL ELIGIBILITY: NOT REACHED / NOT ASSESSED
CONCRETE AUTHORITATIVE GATE QUERY: ABSENT
BINDING #1: PROVEN / CLOSED / UNCHANGED
MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

Implementation and regression identities may be displayed as paths and blobs.

Neither implementation nor regression may be loaded or executed.

### 3. Latest Checkpoints

May display exact checkpoint chronology derived from:

- exact commit history;
- exact object presence;
- exact evidence scope.

Each checkpoint entry must retain:

```text
scope
path
commit
blob
commit date
classification
```

Filename dates alone must not determine latest state.

A stale continuity pointer must not drive latest-state selection.

### 4. Governance State

May display only exact, unique and allowlisted governance labels extracted from accepted checkpoint blobs.

Console V0 must not synthesize new governance decisions.

### 5. Blocked Frontiers

May display only explicitly recorded:

- `BLOCKED`;
- `DEFERRED`;
- `ABSENT`;
- `UNKNOWN`;
- `NOT AUTHORIZED`.

It must not infer that a frontier has been satisfied.

### 6. Next Bounded Action

Must be visibly separated from repository and governance facts.

Accepted classification:

```text
NEXT BOUNDED ACTION
classification: NON-AUTHORITATIVE RECOMMENDATION
recommendation: Separate human authorization is required before Console V0 coding.
authorityEffect: NONE
```

The recommendation creates no authority and authorizes no execution.

### 7. Not Authorized

Must display the permanent prohibited-action and authority boundary.

No eighth stdout section is authorized for V0.

## Main and Candidate Separation

Console V0 accepts only:

```text
--main-commit <exact-sha>
```

V0 has no candidate-branch or candidate-commit input.

Candidate material referenced by a main checkpoint must be labelled:

```text
scope: CANDIDATE_REFERENCE_ONLY
mainFact: false
```

Candidate-reference material must not:

- become a main fact;
- alter main governance state;
- satisfy a blocked main frontier;
- create currentness;
- create acceptance;
- create authority.

The candidate commit:

```text
7f655b71101eacc4dc6b826b456f5ab9b5419ffb
```

is not a main fact merely because it is referenced by a main checkpoint.

Main-only V0 must not open or interpret the content of candidate commits.

Candidate-scope support requires a separate design and explicit human governance authorization.

## UNKNOWN Rendering

Missing non-critical evidence must be rendered explicitly:

```text
STATUS: UNKNOWN
reason: <fixed reason code>
source: <expected exact Git object/path>
authorityEffect: NONE
```

Accepted proposed `UNKNOWN` reason codes:

```text
OBJECT_NOT_MATERIALIZED
CHECKPOINT_NOT_PRESENT
LABEL_NOT_PRESENT
HISTORICAL_ONLY
CANDIDATE_SCOPE_EXCLUDED
CURRENT_REMOTE_STATE_NOT_ASSESSED
```

`UNKNOWN` must not be silently converted into:

- `ABSENT`;
- `REJECTED`;
- `ACCEPTED`;
- `AUTHORIZED`;
- `CURRENT`;
- `PROVEN`;
- `SATISFIED`.

`UNKNOWN` permits bounded rendering to complete when the remaining evidence can still be represented safely.

No automatic retry, repair, reconstruction or fallback is permitted.

## HARD STOP Rendering

Identity-invalid, conflicting, duplicate or scope-colliding authoritative evidence must produce:

```text
HARD STOP
reason: <fixed reason code>
no further state rendered
MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

Accepted proposed `HARD STOP` reason codes:

```text
INVALID_COMMIT_IDENTITY
COMMIT_OBJECT_TYPE_MISMATCH
CHECKPOINT_BLOB_MISMATCH
CONFLICTING_AUTHORITATIVE_LABELS
DUPLICATE_AUTHORITATIVE_LABELS
MAIN_CANDIDATE_SCOPE_COLLISION
UNALLOWLISTED_DATA_SOURCE
UNSAFE_GIT_OPERATION_REQUESTED
```

After `HARD STOP`, Console V0 must not:

- infer missing state;
- continue authoritative rendering;
- introduce a fallback;
- execute a second flow;
- repair evidence;
- contact an external source.

## Exit-Code Contract

Accepted exit codes:

```text
0 = bounded output completed, including output containing explicit UNKNOWN
2 = HARD STOP
```

No additional semantic exit code is accepted for V0.

Exit code `0` does not mean:

- workflow success;
- eligibility success;
- governance acceptance;
- implementation acceptance;
- runtime readiness;
- authority.

Exit code `2` means only that the accepted evidence-rendering boundary could not continue safely.

Neither exit code creates authority.

## Forbidden Imports and Actions

Forbidden imports include:

```text
fs
server.js
express
http
https
net
tls
database modules
Railway modules
authentication/session modules
AYA runtime modules
eligibility modules
Gate modules
workflow modules
continuation modules
effect modules
offer modules
existing executable GT63 governance modules
```

Forbidden Git operations include:

```text
git ls-remote
git fetch
git pull
git push
git add
git commit
git checkout
git switch
git branch
git worktree
git update-ref
git reset
git clean
git merge
git rebase
git cherry-pick
git apply
git am
```

Other forbidden actions include:

- repository-file reads through `fs`;
- filesystem writes;
- repository mutation;
- environment mutation;
- generic shell execution;
- network requests;
- DB access;
- Railway access;
- login;
- session interaction;
- observation;
- workflow execution;
- eligibility execution;
- Gate action;
- continuation execution;
- effect execution;
- offer mutation;
- listener creation;
- daemon creation;
- persistent process creation;
- authority-bearing action.

## Regression and Check Strategy

The accepted plan includes a future provider-free regression at:

```text
scripts/gt63-machine/gt63-machine-console-v0-regression.js
```

The future regression strategy must cover:

1. exact repository-identity rendering;
2. deterministic output for identical Git objects;
3. all seven stdout sections;
4. exact governance-marker preservation;
5. missing optional evidence producing `UNKNOWN`;
6. missing required commit evidence producing `HARD STOP`;
7. conflicting authoritative labels producing `HARD STOP`;
8. duplicate authoritative labels producing `HARD STOP`;
9. candidate references never becoming main facts;
10. stale continuity pointers never driving latest state;
11. code or document presence never becoming acceptance;
12. absence of application/runtime imports;
13. absence of `fs` repository-evidence reads;
14. absence of working-tree evidence reads;
15. enforcement of the Git-command allowlist;
16. rejection of forbidden Git operations;
17. absence of network, DB and runtime dependencies;
18. exact permanent-boundary rendering;
19. stdout-only behavior;
20. exit-code behavior;
21. no filesystem or repository mutation;
22. `authorityEffect: NONE` on completed and stopped paths.

The regression may use:

- synthetic Git-command responses; or
- an isolated disposable fixture repository.

The active dirty checkout must not be used as a mutable regression fixture.

Regression creation and execution remain separately unauthorized.

## Runtime Remains Unchanged

The proposed CLI remains dormant because it is not:

- imported by `server.js`;
- registered during application startup;
- exposed through an Express route;
- exposed through an HTTP endpoint;
- added to a `package.json` command;
- added to a package lifecycle hook;
- connected to a database;
- connected to Railway;
- connected to authentication or observation;
- connected to workflows, eligibility, Gates, effects or offers.

The CLI runs only when explicitly invoked from a terminal with an exact commit identity.

It prints bounded stdout output and terminates.

Physical terminal visibility does not constitute runtime wiring, application behavior, operational readiness or authority.

## Deferred Decisions

The following remain deferred:

- implementation authorization;
- file-creation authorization;
- regression-creation authorization;
- regression-execution authorization;
- exact implementation branch or worktree;
- whether regression uses synthetic command responses or an isolated disposable repository;
- exact fixture representation;
- exact stdout spacing;
- cosmetic terminal formatting;
- exact stderr formatting;
- whether machine-readable output will ever exist;
- candidate-commit input mode;
- live remote-currentness mode;
- any web surface;
- any route;
- any package command;
- any operator-console surface;
- staging;
- commit;
- push;
- merge;
- pull request creation;
- deployment;
- runtime integration.

Deferred decisions must not be silently resolved during planning or coding.

## Explicit Non-Claims

Acceptance of the implementation plan does not establish or authorize:

- implementation;
- source-file creation;
- source-file modification;
- regression-file creation;
- regression execution;
- test execution;
- staging;
- commit;
- push;
- merge;
- pull request creation;
- deployment;
- runtime wiring;
- package modification;
- server creation;
- route creation;
- remote discovery;
- remote update;
- filesystem-based repository evidence reads;
- DB access;
- DB mutation;
- Railway access;
- login;
- observation;
- workflow execution;
- eligibility execution;
- Gate action;
- continuation authority;
- execution authority;
- effect authorization;
- offer mutation;
- trusted-provider status;
- current remote-main verification;
- principal eligibility;
- implementation acceptance;
- release acceptance;
- operational readiness;
- MACHINE authority.

Plan acceptance is not implementation authorization.

Terminal display is not execution authority.

Git-object presence is not governance authority.

## STOP Conditions

Future planning or coding must stop if:

- implementation begins without separate explicit authorization;
- a file outside the accepted primary and regression paths becomes necessary;
- repository evidence requires `fs`;
- working-tree or index content is used as evidence;
- an application or runtime module must be imported;
- an executable GT63 module must be imported;
- a Git operation outside the allowlist becomes necessary;
- generic shell execution becomes necessary;
- live remote discovery becomes necessary;
- fetch, pull, push or ref update becomes necessary;
- network access becomes necessary;
- DB, Railway, login or observation access becomes necessary;
- a web server, route, listener or package command becomes necessary;
- candidate material cannot remain separate from main facts;
- missing evidence cannot remain `UNKNOWN`;
- conflicting or duplicate authoritative evidence does not cause `HARD STOP`;
- the accepted exit-code contract must change;
- the seven-section stdout boundary must change;
- a fallback or second flow is introduced;
- regression requires the active dirty checkout as a mutable fixture;
- runtime behavior would change;
- workflow or eligibility execution becomes possible;
- Gate, continuation, effect or offer action becomes possible;
- authority or `authorityEffect` would differ from `NONE`.

## Preserved Final States

```text
MACHINE CONSOLE V0 IMPLEMENTATION PLAN: ACCEPTED

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
