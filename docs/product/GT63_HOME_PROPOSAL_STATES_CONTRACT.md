# GT63 HOME Proposal States Contract

Status: LOCKED

Document type: Product / UX Contract

Milestone: GT63 HOME v1

Mode: Design Lock Input

Implementation: NOT STARTED

## Purpose

Define what GT63 HOME must communicate before implementation begins.

HOME is not a dashboard.

HOME is not Admin.

HOME is not a reporting surface.

HOME is a calm proposal command surface.

Its purpose is to reduce the travel agent's first-minute uncertainty and guide them to the next proposal action.

## Core Rule

Every HOME element must answer one of only three questions:

```text
What should I do?
What needs my attention?
Where do I continue?
```

If an element does not answer one of these questions, it does not belong on GT63 HOME v1.

## Business Test

GT63 HOME v1 must help a travel agent complete more proposals with less mental effort.

If the HOME screen is only a better-looking interface, it fails.

The agent should feel:

```text
I do not need to scan email first.
GT63 already knows which proposal work matters.
```

## Product Direction

HOME v1 is not a launch surface.

HOME v1 is a proposal command surface.

The primary user job is not:

```text
Find a menu.
```

The primary user job is:

```text
Understand which proposal action matters now.
```

## Required Proposal States

HOME v1 must organize active proposal work around human-readable readiness states.

Required states:

- Ready to Send
- Needs Review
- Waiting for Client
- Drafts in Progress
- Blocked

Optional state:

- Delivered

These are product states for operator clarity.

They must not expose internal logs, provider details, confidence internals or technical validation language on HOME.

## State Meaning

### Ready to Send

The proposal is complete enough for delivery.

Expected action:

```text
Open or send the proposal.
```

### Needs Review

The proposal has useful data but needs operator confirmation before delivery.

Expected action:

```text
Review in Workspace.
```

### Waiting for Client

The proposal has been shared or is waiting for client choice, response or confirmation.

Expected action:

```text
Open client-facing proposal status.
```

### Drafts in Progress

The proposal exists but is not ready for review or delivery.

Expected action:

```text
Continue building.
```

### Blocked

The proposal cannot progress without missing data or operator decision.

Expected action:

```text
Resolve the blocker in Workspace.
```

### Delivered

The proposal has already been sent or completed.

Expected action:

```text
Open history only when needed.
```

Delivered items must not dominate HOME v1.

## HOME Information Architecture

HOME v1 may contain:

- primary New Proposal action;
- next best proposal action;
- small proposal readiness summary;
- compact Continue Work list;
- recent proposal work only when it helps continuation.

HOME v1 must not contain:

- agency analytics;
- revenue metrics;
- generic charts;
- CRM activity feeds;
- system widgets;
- broad reporting;
- provider logs;
- technical confidence internals;
- settings shortcuts unless needed to complete proposal work.

## HOME vs Workspace

HOME owns:

- orientation;
- next best action;
- proposal readiness summary;
- continuation entry points;
- starting a new proposal.

Workspace owns:

- source upload;
- extracted data review;
- flight/hotel/price/date validation;
- operator corrections;
- selected hotel decisions;
- blocker resolution;
- proposal generation.

No capability should live in a third category for HOME v1.

If it is not orientation or continuation, it belongs in Workspace.

## Visual Implication

HOME should feel premium and calm because it removes uncertainty, not because it adds visual effects.

Whitespace is acceptable only when the operator still understands:

- what matters now;
- what is ready;
- what is blocked;
- where to continue.

## Design Lock Criteria

GT63 HOME v1 is ready for Design Lock when:

- the first action is obvious;
- proposal readiness is visible without dashboard overload;
- next best action is clear;
- the agent can understand HOME within 10 seconds;
- the first 60 seconds naturally lead to Workspace;
- no HOME element exists only because it looks impressive;
- Agency Overview, analytics and reporting are out of HOME v1 scope;
- HOME supports proposal work before aesthetics.

## Feature Freeze

Feature Freeze is active for GT63 HOME v1.

New ideas discovered after this contract must go to:

```text
Future Ideas Lab
```

They do not enter HOME v1 unless the Product Owner explicitly unlocks the scope.

## Final Rule

HOME should not show how much GT63 can do.

HOME should make the next proposal feel inevitable.
