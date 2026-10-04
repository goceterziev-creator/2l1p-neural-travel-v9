# GT63 MACHINE Browser Console V0.1 — Implementation Plan Accepted Checkpoint

Date: 2026-10-04 Europe/Sofia

## Status

The GT63 MACHINE Browser Console V0.1 implementation plan is accepted in full by explicit human governance decision.

The accepted implementation plan preserves the evidence chain:

```text
exact Git objects → Console V0 stdout → escaped static HTML
```

Implementation remains separately unauthorized.

BROWSER CONSOLE V0.1 IMPLEMENTATION PLAN: ACCEPTED

BROWSER CONSOLE V0.1 IMPLEMENTATION: NOT AUTHORIZED

## Human Governance Decision

Human governance accepts the Browser Console V0.1 implementation plan with the corrected Git boundary:

```text
direct Git commands by the browser generator itself;
Git object inspection remains delegated only to Console V0.
```

The accepted implementation-plan scope is:

- one offline generator script;
- one provider-free regression script;
- generator invocation of Console V0 as a subprocess;
- HTML output to stdout only;
- no snapshot file creation by the generator command;
- no direct Git commands by the browser generator itself;
- no browser-side repository reads;
- no JavaScript in the generated normal dashboard;
- no external assets;
- no server, route, listener, package command, or runtime wiring;
- no DB, Railway, login, observation, or external action;
- no workflow execution;
- no eligibility execution;
- no Gate action;
- no offer mutation;
- no authority widening.

Acceptance of this implementation plan does not authorize implementation.

## Exact Implementation Files

Proposed generator:

```text
scripts/gt63-machine/gt63-machine-browser-console-v0-1.js
```

Proposed provider-free regression:

```text
scripts/gt63-machine/gt63-machine-browser-console-v0-1-regression.js
```

No other implementation file is included in the accepted plan.

The accepted plan requires no:

- HTML template file;
- standalone stylesheet;
- JavaScript asset;
- image asset;
- font asset;
- package manifest change;
- server file;
- route file;
- runtime configuration;
- application module modification.

## Exact Future Command

The accepted future generator invocation is:

```text
node scripts/gt63-machine/gt63-machine-browser-console-v0-1.js --repo . --main-commit d8b6186f7258ee918ccee636e271df6fd98f00a2
```

The generator-command contract is:

- generated HTML is written to stdout only;
- diagnostics are written to stderr only;
- no snapshot file is created;
- no repository file is modified;
- exit code `0` means a valid bounded dashboard document;
- exit code `2` means HARD STOP or rejected Console V0 output;
- no other exit code is part of the accepted contract.

Execution of this command requires separate human authorization.

The exact pinned commit may be changed only by a separate explicit governance decision.

## Input Mode

The browser generator invokes Console V0 as a subprocess.

It does not accept arbitrary Console V0 evidence through stdin.

The planned child invocation is:

```text
node scripts/gt63-machine/gt63-machine-console-v0.js --repo <repo> --main-commit <exact-sha>
```

The proposed Node subprocess form is equivalent to:

```text
spawnSync(process.execPath, [
  "scripts/gt63-machine/gt63-machine-console-v0.js",
  "--repo",
  repo,
  "--main-commit",
  commit
])
```

Required subprocess properties:

- `shell: false`;
- explicit working directory;
- UTF-8 decoding;
- bounded output buffer;
- captured stdout;
- captured stderr;
- exact exit-code inspection;
- no inherited interactive input;
- no shell-generated command string;
- no fallback executable;
- no alternative evidence source.

The generator invokes Console V0 only. It does not invoke Git.

## Why Subprocess Mode Is Safest

Subprocess mode preserves the accepted evidence chain:

```text
exact Git objects → Console V0 stdout → escaped static HTML
```

It permits exact verification of:

- the Console V0 script path;
- the pinned repository argument;
- the pinned commit argument;
- the subprocess exit code;
- stdout completeness;
- stderr state;
- the absence of a shell intermediary;
- the distinction between successful bounded output and HARD STOP.

Arbitrary stdin is not accepted because it could supply text that was not produced by the accepted Console V0 boundary.

A shell pipeline is not the preferred evidence boundary because it could obscure the upstream exit code or allow partial output to be consumed.

Subprocess mode does not transfer Git authority to the browser generator. All Git-object inspection remains inside Console V0.

## Argument Validation

The generator accepts exactly:

```text
--repo <non-empty-value> --main-commit <40-lowercase-hex-sha>
```

The generator rejects:

- missing arguments;
- additional arguments;
- duplicate flags;
- reordered flags;
- unknown flags;
- empty repository values;
- NUL characters;
- abbreviated commit identities;
- uppercase commit identities;
- malformed commit identities;
- non-40-character commit identities;
- output-path arguments;
- asset-path arguments;
- server arguments;
- route arguments;
- runtime arguments;
- network arguments;
- fallback input arguments.

The pinned commit must be forwarded unchanged to Console V0.

The generator must not derive a commit from:

- `HEAD`;
- a branch;
- a tag;
- a remote ref;
- the working tree;
- a continuity pointer;
- a filename;
- a previous snapshot;
- browser state.

## CLI Stdout Validation

Normal dashboard generation is permitted only when all of the following are true:

1. Console V0 exits with code `0`.
2. Console V0 stderr is empty.
3. Stdout begins exactly with:

```text
GT63 MACHINE CONSOLE V0
PINNED MAIN EVIDENCE SCOPE
```

4. Stdout contains exactly seven top-level sections.
5. Each required section appears exactly once.
6. The sections appear in this exact order:

```text
Repository Identity
Provider-Free Owner
Latest Checkpoints
Governance State
Blocked Frontiers
Next Bounded Action
Not Authorized
```

7. No unexpected `=== ... ===` section appears.
8. Repository Identity contains the exact requested commit.
9. Repository Identity contains a valid 40-character tree identity.
10. Repository Identity retains:

```text
scope: MAIN
scopeLabel: PINNED MAIN EVIDENCE SCOPE
```

11. Remote currentness is preserved exactly as emitted.
12. Candidate-reference fields remain inside Blocked Frontiers.
13. Not Authorized contains all permanent boundary markers.
14. `MACHINE AUTHORITY: NONE` remains present.
15. `authorityEffect: NONE` remains present.
16. Successful output contains no `HARD STOP`.
17. No CLI line is silently removed.
18. No missing line is synthesized.
19. No evidence value is rewritten.
20. No semantic fallback is applied.

Any validation failure causes exit code `2`.

There is no best-effort parsing mode.

## Parsing Boundary

Parsing is presentation-only.

The generator may:

- identify the exact document header;
- identify the seven exact section boundaries;
- split checkpoint records using their emitted blank-line boundaries;
- identify exact `key: value` lines for visual layout;
- recognize exact status tokens for styling;
- preserve non-key lines as escaped text;
- group already-emitted lines into visual panels;
- preserve the original order within each section.

The generator must not:

- infer missing evidence;
- inspect repository files;
- inspect documentation;
- inspect Git objects directly;
- inspect Git history;
- inspect remote refs;
- resolve UNKNOWN;
- repair malformed CLI output;
- normalize governance wording;
- remove repeated governance markers;
- promote object presence to acceptance;
- promote candidate evidence to a main fact;
- convert recommendations into authorization;
- infer currentness;
- infer authority;
- infer execution;
- reorder evidence semantically;
- suppress inconvenient evidence;
- enrich evidence from conversation context.

The original CLI-provided text must remain available in the generated document.

## HTML Escaping and Document Rules

Every CLI-derived value must be HTML-escaped before insertion.

Required escaping:

```text
&  → &amp;
<  → &lt;
>  → &gt;
"  → &quot;
'  → &#39;
```

Escaping occurs exactly once.

The normal generated dashboard must be:

- one complete HTML5 document;
- UTF-8;
- deterministic for identical Console V0 output;
- self-contained;
- static;
- free of client-side JavaScript;
- free of external dependencies;
- free of executable controls;
- free of mutation controls.

The generated document must include a restrictive content-security policy equivalent to:

```text
default-src 'none';
style-src 'unsafe-inline';
img-src data:;
connect-src 'none';
form-action 'none';
base-uri 'none';
```

The normal dashboard must not contain:

- `<script>`;
- `<form>`;
- `<button>`;
- interactive `<input>`;
- `<iframe>`;
- external `<link>`;
- externally sourced `<img>`;
- inline event handlers;
- `onclick` or equivalent attributes;
- refresh directives;
- executable URLs;
- external navigation controls;
- browser-side repository access;
- browser-side evidence loading.

CSS must be embedded in the generated document.

## Visual Layout

### Central Identity Core

A centered identity core displays:

```text
GT63
MACHINE CONSOLE
EVIDENCE SNAPSHOT
```

The core may display CLI-provided:

- pinned commit;
- tree;
- parent;
- pinned evidence scope;
- remote-currentness status;
- MACHINE authority state;
- authority effect.

Blue and violet evidence-flow lines may be produced through CSS gradients and pseudo-elements.

These lines are decorative only. They do not claim workflow, causality, authority flow, activation, or runtime execution.

### Repository Identity

A wide glass panel presents the exact Repository Identity section.

Commit, tree, parent, and blob identities use a system monospace font.

### Provider-Free Owner

A dedicated evidence panel presents the exact provider-free owner states without reinterpretation.

### Latest Checkpoints

A full-width ledger presents each emitted checkpoint record in its original order.

`ACCEPTED_CHECKPOINT` and `OBJECT_PRESENT_ONLY` remain visually and semantically distinct.

### Governance State

A dedicated panel presents exact governance labels.

Historical labels remain historical checkpoint evidence. They are not rewritten from later repository or conversation context.

### Blocked Frontiers

A wide panel presents the exact blocked-frontier list.

Candidate-reference information appears in a separate dashed violet container.

### Next Bounded Action

A full-width advisory panel preserves:

```text
NON-AUTHORITATIVE RECOMMENDATION
```

It contains no action control.

### Not Authorized

A permanent full-width red bottom boundary preserves the exact CLI-emitted prohibition lines.

It cannot be dismissed, collapsed, hidden, or turned into an interactive control.

### CSS Approach

The accepted CSS approach uses:

- near-black or navy background;
- translucent glass panels;
- restrained blue and violet borders;
- CSS gradients;
- CSS pseudo-elements;
- system sans-serif fonts;
- system monospace fonts;
- responsive CSS Grid;
- readable spacing and contrast;
- no downloaded fonts;
- no animation requirement;
- no external stylesheet.

Status styling preserves exact textual labels:

| State | Visual treatment |
|---|---|
| `ACCEPTED` | Emerald/cyan solid chip |
| `PASS` | Electric-blue solid chip |
| `UNKNOWN` | Amber outlined chip |
| `BLOCKED` | Orange outlined chip |
| `NOT AUTHORIZED` | Red high-contrast boundary |
| `NONE` | Neutral violet/gray outlined chip |

Color is never the only semantic indicator.

## Main and Candidate Separation

Main evidence is rendered in solid evidence panels and retains:

```text
scope: MAIN
```

Candidate references are rendered only in a separate dashed violet sub-panel.

They retain exact emitted fields such as:

```text
scope: CANDIDATE_REFERENCE_ONLY
mainFact: false
contentInspected: false
```

The generator must not:

- inspect candidate content;
- load candidate objects;
- move candidate references into main panels;
- classify a candidate as current;
- classify a candidate as accepted;
- promote a candidate through styling;
- merge candidate facts into Latest Checkpoints unless Console V0 already emits them there as main-scoped evidence.

## UNKNOWN Rendering

UNKNOWN remains a valid bounded result.

It is rendered with:

- exact `STATUS: UNKNOWN`;
- exact reason;
- exact source;
- amber visual treatment;
- exact `authorityEffect: NONE`.

UNKNOWN must not be rendered as:

- false;
- rejected;
- resolved;
- accepted;
- authorized;
- absent unless absence is explicitly proven;
- blocked unless explicitly classified as blocked.

Other valid evidence panels remain visible when a bounded UNKNOWN is present.

## HARD STOP Rendering

If Console V0 exits with code `2`, normal dashboard rendering is forbidden.

The generator must:

- return exit code `2`;
- emit no partial normal dashboard;
- preserve the exact HARD STOP reason;
- preserve `MACHINE AUTHORITY: NONE`;
- preserve `authorityEffect: NONE`;
- avoid fallback evidence;
- avoid inferred evidence.

A minimal static HARD STOP document may be emitted to stdout only if that behavior is explicitly included in the future coding authorization.

Its allowed semantic content is limited to:

```text
HARD STOP
reason: <exact reason>
no further state rendered
MACHINE AUTHORITY: NONE
authorityEffect: NONE
```

A HARD STOP document contains no:

- normal evidence panels;
- candidate content;
- recommendation;
- partial state;
- recovery button;
- retry button;
- approval control;
- execution control;
- authority-bearing control.

The generator must not convert HARD STOP into UNKNOWN or partial success.

## Proposed Snapshot Location

If separately authorized, the proposed first snapshot path is:

```text
docs/gt63-machine/browser-console-v0-1/snapshots/d8b6186f7258ee918ccee636e271df6fd98f00a2/index.html
```

The generator command itself remains stdout-only and creates no file.

Snapshot materialization is a separate operation requiring explicit authorization for:

- the exact pinned commit;
- the exact target path;
- the exact output bytes;
- worktree mutation;
- identity calculation;
- verification;
- preservation status.

A generated snapshot is a derivative display artifact. It is not an authoritative governance source.

## Regression and Verification Strategy

Allowed static checks require separate authorization and are proposed as:

```text
node --check scripts/gt63-machine/gt63-machine-browser-console-v0-1.js
node --check scripts/gt63-machine/gt63-machine-browser-console-v0-1-regression.js
git diff --check
```

The provider-free regression plan covers:

1. exact argument validation;
2. exact subprocess executable;
3. exact subprocess arguments;
4. `shell: false`;
5. rejection of arbitrary stdin evidence mode;
6. Console V0 exit code `0`;
7. Console V0 exit code `2`;
8. rejection of unexpected exit codes;
9. rejection of non-empty stderr for normal output;
10. exact seven-section validation;
11. required section order;
12. missing-section rejection;
13. duplicate-section rejection;
14. unexpected-section rejection;
15. pinned-commit mismatch rejection;
16. malformed-tree rejection;
17. permanent-boundary validation;
18. main/candidate separation;
19. UNKNOWN preservation;
20. HARD STOP non-partial rendering;
21. escaping of `<`, `>`, `&`, quotes, and script-like text;
22. rejection of double escaping;
23. absence of `<script>`;
24. absence of forms and buttons;
25. absence of event handlers;
26. absence of external assets;
27. absence of network URLs;
28. CSP presence;
29. deterministic output;
30. exact status labels;
31. permanent red Not Authorized boundary;
32. no Git invocation by the browser generator;
33. no `fs` repository evidence reads;
34. no application/runtime imports;
35. no snapshot creation during regression;
36. no worktree mutation;
37. preservation of `MACHINE AUTHORITY: NONE`;
38. preservation of `authorityEffect: NONE`.

The accepted commit-first discipline remains:

- static verification may occur before commit only when explicitly authorized;
- regression should run against exact committed generator bytes;
- regression execution requires separate authorization;
- physical browser opening requires separate authorization;
- snapshot generation requires separate authorization.

## Forbidden Scope

The browser generator and regression must not introduce:

- browser-side repository reads;
- direct Git commands by the browser generator itself;
- Git object inspection outside Console V0;
- stdin as an alternative evidence source;
- HTTP requests;
- `fetch`;
- WebSocket;
- API activity;
- network access;
- DB access;
- Railway access;
- login access;
- session or cookie access;
- runtime observation;
- client-side JavaScript in the normal dashboard;
- external fonts;
- external scripts;
- external images;
- external stylesheets;
- CDNs;
- telemetry;
- analytics;
- buttons;
- forms;
- interactive inputs;
- execute controls;
- approval controls;
- mutation controls;
- `package.json` commands;
- `server.js` changes;
- server creation;
- route creation;
- listener creation;
- runtime wiring;
- workflow execution;
- eligibility execution;
- Gate selection;
- Gate satisfaction;
- Gate action;
- offer mutation;
- automatic snapshot generation;
- browser opening without authorization;
- deployment;
- authority creation;
- authority widening.

The corrected Git boundary is:

```text
direct Git commands by the browser generator itself;
Git object inspection remains delegated only to Console V0.
```

The generator may invoke Console V0 as a subprocess.

The generator itself must not invoke Git.

## Runtime Impact

Runtime behavior remains unchanged because:

- both proposed implementation files are standalone dormant scripts;
- no existing module imports them;
- no package command invokes them;
- no server references them;
- no route references them;
- no listener references them;
- no runtime configuration references them;
- no browser snapshot is generated automatically;
- no browser view is opened automatically;
- no DB or Railway service is connected;
- no workflow or eligibility path is connected;
- execution requires an explicit local command and exact commit argument.

Browser Console V0.1 remains an offline derivative evidence view.

## Required Future Human Authorization

Before coding, human governance must separately authorize:

1. creation of the exact generator path;
2. creation of the exact regression path;
3. subprocess input mode;
4. exact CLI invocation;
5. argument validation semantics;
6. stdout validation semantics;
7. parsing boundaries;
8. HTML escaping rules;
9. normal dashboard output contract;
10. HARD STOP output contract;
11. allowed imports;
12. exact static verification commands;
13. branch or worktree location;
14. whether any additional file is permitted.

Later separate authorizations remain required for:

- static verification;
- local implementation commit;
- regression execution;
- snapshot generation;
- exact snapshot path materialization;
- physical browser opening;
- visual acceptance;
- snapshot preservation;
- staging;
- commit;
- push;
- merge;
- publication;
- deployment.

No authorization may be inferred from implementation-plan acceptance.

## Explicit Non-Claims

This checkpoint does not claim that:

- Browser Console V0.1 is implemented;
- the generator file exists;
- the regression file exists;
- any implementation bytes have been accepted;
- any static verification has run;
- any Browser Console regression has run;
- any snapshot has been generated;
- any snapshot file exists;
- any browser view has been opened;
- any visual design has been physically accepted;
- the generator reads Git objects;
- the browser reads repository evidence;
- the browser view is live;
- the browser view proves remote currentness;
- the browser view observes runtime state;
- a snapshot is authoritative evidence;
- object presence proves acceptance;
- visual prominence proves authority;
- candidate evidence is a main fact;
- UNKNOWN has been resolved;
- any blocked frontier has been closed;
- any workflow is executable;
- principal eligibility has been reached or assessed;
- any Gate has been selected or satisfied;
- any offer mutation is authorized;
- any runtime, DB, Railway, login, or observation action is authorized;
- MACHINE authority exists;
- authority effect exists;
- implementation-plan acceptance authorizes coding.

MACHINE CONSOLE V0 REGRESSION: PASS 24/24 applies to the accepted Console V0 regression evidence. It is not a Browser Console V0.1 implementation, regression, snapshot, or visual verdict.

## STOP Conditions

Browser Console V0.1 implementation work must HARD STOP if:

- coding is attempted without separate authorization;
- a file outside the exact authorized paths would change;
- the generator would invoke Git directly;
- Git-object inspection would occur outside Console V0;
- stdin would become an alternative evidence source;
- the Console V0 subprocess path differs from the authorized path;
- the pinned commit is absent, malformed, abbreviated, or changed;
- the Console V0 exit code is not accepted;
- Console V0 stderr violates the accepted contract;
- a required section is absent;
- a required section appears more than once;
- section order differs;
- an unexpected section appears;
- Repository Identity does not match the requested commit;
- the permanent Not Authorized boundary is absent or altered;
- main and candidate evidence cannot remain separate;
- evidence would require inference, enrichment, repair, or promotion;
- output would require browser-side repository access;
- output would require JavaScript or an external asset;
- output would require HTTP, API, WebSocket, DB, Railway, login, session, runtime, or observation access;
- partial normal evidence would be rendered after HARD STOP;
- snapshot generation would occur without separate authorization;
- browser opening would occur without separate authorization;
- an action or authority-bearing control would be introduced;
- a server, route, listener, package command, or runtime connection would be introduced;
- any workflow, eligibility, Gate, offer, deployment, or authority action would occur;
- the implementation would exceed the separately authorized scope.

There is no fallback implementation path under this checkpoint.

## Preserved Final States

BROWSER CONSOLE V0.1 IMPLEMENTATION PLAN: ACCEPTED

BROWSER CONSOLE V0.1 IMPLEMENTATION: NOT AUTHORIZED

BROWSER CONSOLE V0.1 DESIGN PLAN: ACCEPTED

MACHINE CONSOLE V0 REGRESSION: PASS 24/24

MACHINE AUTHORITY: NONE

authorityEffect: NONE
