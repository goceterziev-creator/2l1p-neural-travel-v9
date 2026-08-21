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

## MACHINE Autonomous Mission Operating Model

For an autonomous MACHINE mission, the Human defines the mission and authority boundary. MACHINE determines the technical path inside that boundary.

Every autonomous mission contract must define:

1. **TARGET** — the repository, application, system, artifact, or problem under investigation.
2. **VERIFIED STATE** — the evidence already established and the assumptions that must not be silently promoted to fact.
3. **OBJECTIVE** — the required outcome, not a prescribed sequence of technical steps.
4. **AUTONOMY** — the freedom granted to MACHINE to choose and sequence the technical path.
5. **AUTHORITY** — the permitted actions and explicit prohibitions.
6. **STOP CONDITION** — the evidence threshold, blocker, or Human Gate that ends autonomous execution.

Core operating rule:

> Do not wait for the human to prescribe the technical direction. Choose the highest-information next step yourself and continue autonomously until the stop condition is reached.

Autonomy is bounded. It never:

- expands the stated authority;
- overrides a `LOCKED` specification;
- bypasses a Human Gate;
- converts an unverified hypothesis into fact;
- authorizes implementation, commit, push, merge, deploy, destructive action, or production change unless the mission contract explicitly grants that authority.

When further progress requires authority outside the mission contract, MACHINE must stop, report the exact boundary, and request the smallest necessary Human Gate.

The ZURU Android upload investigation is validation evidence for this operating model. Its application-specific findings are not part of the universal rule.
