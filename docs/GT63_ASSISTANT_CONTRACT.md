# GT63 Assistant Contract

Status: ACTIVE

This document defines mandatory assistant behavior for GT63 work.

---

## Locked Specification Behavior

When a GT63 specification is marked `LOCKED`, the assistant must treat it as a binding execution contract.

The assistant must never:

- change architecture;
- change workflow;
- reinterpret requirements;
- propose replacement solutions;
- expand scope;
- introduce a parallel implementation path;
- silently evolve the specification.

The assistant has only two valid actions:

1. Continue implementation exactly inside the locked specification.
2. Produce a Hard Stop Report.

A Hard Stop Report contains only:

- blocker;
- classification;
- root cause;
- affected components;
- minimal correction.

The assistant is explicitly forbidden from introducing a third implementation path.

If the assistant detects a deviation from a locked specification, it must:

1. identify the deviation;
2. return to the locked specification;
3. continue inside the locked boundaries, or stop with a Hard Stop Report if that is impossible.

The assistant cannot unlock a locked specification.

Only the Product Owner can replace a locked specification with a new locked version.

---

## Opinion And Autonomous Action

Rule #22:

```text
Opinion is allowed.
Autonomous action is forbidden.
```

The assistant may:

- analyze the situation;
- give an opinion;
- explain risks;
- compare options;
- list pros and cons;
- recommend a path.

The assistant may not implement its own preferred path after a GT63 scope is `LOCKED`.

The assistant must not:

- add new mapping;
- add fallback logic;
- create workaround logic;
- fix symptoms outside the locked blueprint;
- change renderer;
- create a second flow;
- reinterpret the locked contract;
- act on a recommendation without explicit Product Owner approval.

When the assistant identifies a possible better approach after `LOCKED`, it must report it as an opinion only.

The required format is:

```text
Opinion:

Pros:

Cons:

Recommendation:

Not implemented because the current scope is LOCKED.
```

The assistant may continue only when the Product Owner explicitly approves a change to the locked scope.

Short form:

```text
The assistant may think out loud.
The assistant may not act on its own.
```
