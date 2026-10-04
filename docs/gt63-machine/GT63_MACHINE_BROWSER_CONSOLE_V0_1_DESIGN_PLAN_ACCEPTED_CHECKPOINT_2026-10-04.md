# GT63 MACHINE Browser Console V0.1 — Design Plan Accepted Checkpoint

Date: 2026-10-04 Europe/Sofia

## Status

The GT63 MACHINE Browser Console V0.1 design plan is accepted in full by explicit human governance decision.

BROWSER CONSOLE V0.1 DESIGN PLAN: ACCEPTED

BROWSER CONSOLE V0.1 IMPLEMENTATION: NOT AUTHORIZED

This checkpoint preserves design acceptance only. It does not authorize implementation, file creation, testing, snapshot generation, browser opening, repository mutation, deployment, runtime wiring, execution, or authority widening.

## Human Governance Decision

Human governance accepts Browser Console V0.1 as an offline-generated, self-contained static HTML evidence snapshot.

The accepted evidence chain is:

```text
exact Git objects → Console V0 stdout → escaped static HTML
```

Browser Console V0.1 is an evidence display, not an operator console.

The browser layer must not reinterpret, enrich, repair, infer, promote, or otherwise modify the semantics produced by Console V0.

## Accepted Architecture

Browser Console V0.1 uses an offline snapshot architecture:

1. An exact commit SHA is explicitly pinned.
2. Existing Console V0 reads repository evidence only through its accepted exact-Git-object boundary.
3. Console V0 produces bounded stdout.
4. A separately authorized generator validates and escapes that stdout.
5. The generator produces one self-contained static HTML snapshot.
6. The browser renders only the already-generated snapshot.

The resulting HTML is a derivative presentation artifact. It is not a new authoritative governance source.

The accepted architecture includes no server, route, listener, background process, live refresh, API, remote lookup, or application runtime integration.

## Exact Data Source

The sole repository/governance evidence source is the output of the existing Console V0 invocation:

```text
node scripts/gt63-machine/gt63-machine-console-v0.js --repo . --main-commit <exact-40-character-sha>
```

The initial proposed snapshot pin is:

```text
commit: 7819af071cf3cc44d8725e9029564f6cb0e4c532
tree: 1aae8699171ed0f9aa84f68b33968af4ec941cdf
```

The generator may accept normal dashboard input only when all of the following are true:

- Console V0 exits with code `0`;
- the rendered commit equals the explicitly requested commit;
- the commit identity is an exact 40-character SHA;
- the output contains exactly the seven accepted top-level sections;
- every required section appears exactly once;
- no unexpected top-level section appears;
- the permanent Not Authorized boundary is present exactly;
- the output is not a HARD STOP result.

The generator must treat Console V0 stdout as the complete semantic source. It must not inspect documentation, source files, Git history, remote refs, runtime state, or external evidence independently.

## Browser Read Boundary

The browser reads only the generated HTML document.

Browser Console V0.1 performs no:

- repository evidence reads;
- Git operations;
- filesystem repository inspection;
- HTTP requests;
- `fetch` calls;
- WebSocket connections;
- API calls;
- DB reads or writes;
- runtime inspection;
- login or session access;
- cookie-based evidence access;
- browser-storage evidence access;
- remote currentness lookup;
- telemetry;
- analytics.

The normal Browser Console V0.1 snapshot requires no client-side JavaScript.

All styling must be embedded in the generated document. No external fonts, stylesheets, scripts, images, libraries, trackers, or CDNs are permitted.

The static document should use a restrictive policy equivalent to:

```text
default-src 'none';
style-src 'unsafe-inline';
img-src data:;
connect-src 'none';
form-action 'none';
base-uri 'none';
```

## Proposed Files

Proposed implementation source:

```text
scripts/gt63-machine/gt63-machine-browser-console-v0-1.js
```

Proposed provider-free regression source:

```text
scripts/gt63-machine/gt63-machine-browser-console-v0-1-regression.js
```

Proposed first generated snapshot:

```text
docs/gt63-machine/browser-console-v0-1/snapshots/7819af071cf3cc44d8725e9029564f6cb0e4c532/index.html
```

These paths are design proposals only.

No file is authorized for creation or modification by this checkpoint.

Whether a generated snapshot remains local/untracked or becomes a separately preserved documentation artifact is deferred to an explicit future human decision.

## Visual Layout

### Central Identity Core

The top-center identity area displays:

```text
GT63
MACHINE CONSOLE
EVIDENCE SNAPSHOT
```

It may show:

- pinned commit;
- tree;
- parent;
- pinned evidence scope;
- remote currentness state;
- MACHINE authority state;
- authority effect.

Blue and violet evidence-flow lines may connect the identity core visually to the evidence panels.

These lines are decorative only. They do not represent workflow execution, causal proof, dependency activation, authority flow, or runtime state.

### Repository Identity Panel

The Repository Identity panel displays only CLI-provided values, including:

- scope;
- pinned commit;
- tree;
- parent or parents;
- commit date;
- commit subject;
- exact checkpoint paths;
- checkpoint blob identities;
- remote currentness status;
- UNKNOWN reason and source when applicable;
- authority effect.

### Provider-Free Owner Panel

The Provider-Free Owner panel displays the exact preserved provider-free state supplied by Console V0, including:

- implementation authorization scope;
- provider-free candidate acceptance;
- principal eligibility state;
- authoritative Gate-query state;
- Binding #1 state;
- MACHINE authority;
- authority effect.

No browser-side inference may be added.

### Latest Checkpoints Panel

The Latest Checkpoints panel displays the CLI-provided checkpoint ledger.

Each entry may show:

- scope;
- path;
- commit;
- blob;
- commit date;
- classification.

`ACCEPTED_CHECKPOINT` and `OBJECT_PRESENT_ONLY` must remain visually and semantically distinct.

Presence of a code or documentation object must never be rendered as acceptance, authority, currentness, runtime proof, or execution proof.

### Governance State Panel

The Governance State panel displays exact governance markers extracted and emitted by Console V0.

Historical checkpoint statements must remain historical evidence. The browser layer must not rewrite them based on later implementation, commits, conversation history, or inferred project state.

### Blocked Frontiers Panel

The Blocked Frontiers panel displays the exact bounded frontier list provided by Console V0.

It must not provide controls for resolving, approving, selecting, executing, or bypassing a frontier.

### Next Bounded Action Panel

The Next Bounded Action panel displays only the CLI-provided recommendation.

It must carry the explicit classification:

```text
NON-AUTHORITATIVE RECOMMENDATION
```

It must not include an action button or imply that the recommendation has been authorized.

### Not Authorized Bottom Boundary

A permanent, full-width, high-contrast red boundary must remain visible at the bottom of the document.

It must display:

```text
NO WORKFLOW EXECUTION
NO ELIGIBILITY EXECUTION
NO GATE ACTION
NO OFFER MUTATION
NO RUNTIME / DB / RAILWAY / LOGIN ACTION
MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

The boundary cannot be closed, dismissed, collapsed, hidden, or converted into an interactive control.

## Color and Status System

The accepted semantic status system is:

| Status | Visual treatment | Meaning |
|---|---|---|
| `ACCEPTED` | Emerald/cyan solid chip | Explicitly accepted evidence |
| `PASS` | Electric-blue solid chip | A stated verification passed |
| `UNKNOWN` | Amber outlined chip | Evidence is absent, unavailable, or not assessed |
| `BLOCKED` | Orange outlined or striped chip | A frontier remains closed |
| `NOT AUTHORIZED` | Red high-contrast boundary | The action or capability is prohibited |
| `NONE` | Neutral violet/gray outlined chip | Authority or effect is absent |

Color must never be the only carrier of meaning. Every state must retain its exact textual label.

Decorative styling must not imply confidence, authority, execution, acceptance, currentness, or causality beyond the CLI evidence.

## Interaction Rules

Browser Console V0.1 contains no:

- buttons;
- forms;
- input controls;
- execute controls;
- approve or reject controls;
- mutation controls;
- refresh controls;
- upload controls;
- navigation that triggers evidence reads;
- expand-to-load behavior;
- drag-and-drop behavior;
- workflow controls;
- authority-bearing controls;
- automatic refresh;
- polling.

Only passive browser behavior is permitted:

- scrolling;
- text selection;
- browser-native zoom;
- browser-native printing or saving outside the Console UI.

No browser interaction may change evidence, repository state, governance state, runtime state, or authority.

## Forbidden Data Sources and Actions

The following are forbidden:

- live DB access;
- DB writes;
- Railway access;
- login or session refresh;
- cookie inspection;
- runtime observation;
- application-runtime imports;
- GT63 executable-module imports by the browser layer;
- filesystem-based repository evidence reads;
- independent documentation reads;
- remote discovery;
- remote-currentness lookup;
- `git fetch`;
- `git pull`;
- `git push`;
- `git ls-remote`;
- ref updates;
- workflow execution;
- eligibility execution;
- Gate selection;
- Gate satisfaction;
- Gate action;
- offer mutation;
- deployment;
- server creation;
- route creation;
- listener creation;
- runtime wiring;
- telemetry;
- analytics;
- external fonts;
- external scripts;
- external images;
- external stylesheets;
- semantic enrichment;
- fallback inference;
- evidence repair;
- acceptance inference;
- authority creation or widening.

## Main and Candidate Separation

Main evidence and candidate references must remain visibly and semantically separate.

Main evidence must:

- retain `scope: MAIN`;
- appear in solid evidence panels;
- derive only from the pinned Console V0 output.

Candidate references must:

- appear in a separate dashed violet container;
- retain `scope: CANDIDATE_REFERENCE_ONLY`;
- retain `mainFact: false`;
- retain `contentInspected: false` when emitted;
- never be mixed into main facts;
- never be promoted through visual styling;
- never be opened or inspected independently by the browser layer.

The browser layer cannot change a scope classification.

## UNKNOWN Rendering

UNKNOWN is a valid bounded result.

It must be displayed with:

- the exact `UNKNOWN` label;
- the exact reason;
- the exact source;
- `authorityEffect: NONE`;
- amber visual treatment.

UNKNOWN must not be rendered as:

- false;
- rejected;
- absent, unless absence is explicitly proven;
- blocked, unless explicitly classified as blocked;
- accepted;
- authorized;
- erroneous inference.

A bounded UNKNOWN does not prevent rendering of the other valid evidence panels.

## HARD STOP Rendering

If Console V0 exits with code `2`, the normal seven-panel dashboard must not be generated.

A separately authorized HARD STOP artifact may contain only:

```text
HARD STOP
reason: <exact reason>
no further state rendered
MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

A HARD STOP view must not contain:

- partial normal panels;
- fallback values;
- inferred evidence;
- candidate content;
- a recommended action;
- execution controls;
- recovery controls;
- authority-bearing controls.

The browser generator must not convert a HARD STOP into UNKNOWN or a partial success.

## CLI Semantics

Browser Console V0.1 does not require or authorize changes to Console V0 semantics.

Console V0 remains:

- dormant;
- stdout-only;
- exact-Git-objects-only;
- pinned-commit scoped;
- provider-free;
- non-authoritative;
- exit code `0` for bounded output, including explicit UNKNOWN;
- exit code `2` for HARD STOP.

Browser Console V0.1 is a downstream presentation layer only.

It must not reinterpret, enrich, repair, reorder semantically, promote, or suppress Console V0 evidence.

The stdout format consumed by the generator must be version-locked. Unexpected format drift causes generation to stop rather than perform best-effort parsing.

## Future Human Authorizations

Separate explicit human authorization is required before each of the following:

1. Browser Console V0.1 implementation planning acceptance, if a separate checklist is requested.
2. Creation or modification of the proposed generator.
3. Creation or modification of the proposed regression file.
4. Static verification.
5. Regression execution.
6. Snapshot generation.
7. Selection of the exact snapshot commit.
8. Selection of the exact generated-output path.
9. Preservation of a generated snapshot in the repository.
10. Physical browser opening.
11. Visual acceptance review.
12. Staging.
13. Local commit.
14. Push.
15. Merge.
16. Any later publication or deployment.

None of these authorizations may be inferred from design acceptance.

Server, route, runtime wiring, workflow execution, eligibility execution, Gate action, offer mutation, deployment, or authority widening require their own distinct governance decisions and remain outside Browser Console V0.1.

## Explicit Non-Claims

This checkpoint does not claim that:

- Browser Console V0.1 is implemented;
- any proposed file exists;
- any snapshot has been generated;
- any browser view has been opened;
- any browser regression has been written or executed;
- Console V0 output proves remote currentness;
- a pinned local commit is necessarily the current remote main;
- the HTML snapshot is an authoritative governance source;
- the HTML snapshot is live;
- the HTML snapshot observes runtime state;
- object presence proves acceptance;
- visual prominence proves authority;
- candidate evidence is a main fact;
- UNKNOWN is resolved;
- any blocked frontier is closed;
- any workflow is executable;
- principal eligibility has been reached or assessed;
- any Gate has been selected or satisfied;
- any offer mutation is authorized;
- any runtime, DB, Railway, login, or observation action is authorized;
- MACHINE authority exists;
- authority effect exists;
- design acceptance authorizes implementation.

MACHINE CONSOLE V0 REGRESSION: PASS 24/24 applies to the accepted CLI regression evidence. It is not a Browser Console V0.1 implementation or regression verdict.

## STOP Conditions

Browser Console V0.1 work must HARD STOP if:

- implementation is attempted without separate human authorization;
- a proposed file path differs from the authorized path;
- evidence is requested from anything other than Console V0 stdout;
- the pinned commit is missing, malformed, or different from the authorized commit;
- Console V0 exits with code `2`;
- Console V0 emits HARD STOP;
- Console V0 output lacks any required section;
- a required section appears more than once;
- an unexpected top-level section appears;
- the permanent Not Authorized boundary is missing or altered;
- main and candidate scopes cannot be kept separate;
- evidence would require browser-side Git or repository reads;
- evidence would require HTTP, API, WebSocket, DB, runtime, session, login, Railway, or external access;
- generation would require semantic inference, enrichment, repair, or promotion;
- a normal dashboard would contain partial HARD STOP evidence;
- an interaction or authority-bearing control would be introduced;
- external assets or telemetry would be required;
- any workflow, eligibility, Gate, offer, runtime, deployment, or authority action would occur;
- the task would exceed the exact separately authorized files or operation.

There is no fallback implementation path under this checkpoint.

## Preserved Final States

BROWSER CONSOLE V0.1 DESIGN PLAN: ACCEPTED

BROWSER CONSOLE V0.1 IMPLEMENTATION: NOT AUTHORIZED

MACHINE CONSOLE V0: DORMANT / STDOUT-ONLY / EXACT-GIT-OBJECTS

MACHINE CONSOLE V0 REGRESSION: PASS 24/24

MACHINE AUTHORITY: NONE

authorityEffect: NONE
