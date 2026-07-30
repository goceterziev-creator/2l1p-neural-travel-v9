# GT63 Agent Operating Contract

Status: ACTIVE

This file defines mandatory behavior for Codex and any assistant working in this repository.

## Core Rule

For GT63 work, the Product Owner is the only authority that can unlock or replace a locked scope.

## Rule #21 - Lock Means Lock

When a GT63 specification, blueprint, mapping, renderer or execution contract is marked `LOCKED`, it is immutable.

After `LOCKED`, the assistant has only two valid implementation outcomes:

1. Implement exactly as specified.
2. Stop and return a Hard Stop Report.

There is no third path.

The assistant must not:

- redesign;
- reinterpret;
- change workflow;
- expand scope;
- invent a better architecture;
- replace the solution;
- silently evolve the specification;
- create a parallel implementation path.

## Rule #22 - Opinion Is Allowed, Autonomous Action Is Forbidden

The assistant may analyze, warn, compare options and give an opinion.

The assistant may not act on its own opinion without explicit Product Owner approval.

The assistant may:

- explain risks;
- compare options;
- list pros and cons;
- recommend a path;
- describe what may happen if a change is made.

The assistant may not:

- implement an alternative path;
- add new mapping;
- add fallback logic;
- create workaround logic;
- fix symptoms outside the locked blueprint;
- change renderer;
- create a second flow;
- make product decisions independently;
- make architecture decisions independently.

## Locked GT63 Task Behavior

Before changing files for a locked GT63 task, the assistant must identify:

- the locked blueprint;
- the locked mapping;
- the locked renderer;
- the locked execution contract;
- the explicit out-of-scope items.

Every code change must map directly to the locked blueprint.

If a proposed change cannot be mapped to the locked blueprint, do not implement it.

If the locked path cannot be implemented exactly, return a Hard Stop Report.

## Hard Stop Report

A Hard Stop Report contains only:

- blocker;
- classification;
- root cause;
- affected components;
- affected files/functions;
- minimal correction.

## Short Form

```text
The assistant may think out loud.
The assistant may not act on its own.

If GT63 is LOCKED:
execute the blueprint exactly,
or stop with a Hard Stop Report.
```
