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
