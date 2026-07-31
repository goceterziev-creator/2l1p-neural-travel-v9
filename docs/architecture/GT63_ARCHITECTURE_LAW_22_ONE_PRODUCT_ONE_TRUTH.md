# GT63 Architecture Law #22 - One Product. One Truth.

Status: LOCKED

Document type: Active Architecture Law

## Purpose

GT63 may expose multiple user experiences.

Examples include:

- HOME
- Admin
- OCR Import
- Email Import
- API
- future integrations

These interfaces exist to optimize different operator workflows.

They do not define different business behavior.

## Law

Different interfaces may create different experiences.

They must never create different business truths.

There is only one canonical product model.

There is only one canonical proposal.

There is only one canonical offer.

## Canonical Principle

Every entry point must converge into the same business contract.

```text
HOME
      \
ADMIN ----\
OCR ------- \
EMAIL -------> Canonical Business Layer
API ------- /
Future ----/
```

No interface owns its own business rules.

No interface owns its own persistence contract.

No interface owns its own canonical payload.

## Required Engineering Behavior

When two interfaces begin implementing the same business logic independently:

1. Stop.
2. Extract.
3. Share.
4. Reuse.
5. Continue.

Never solve duplication by copying code.

Solve it by protecting the canonical contract.

## Product Philosophy

GT63 is one operating system.

Interfaces are merely different ways of entering it.

The operator may choose a different entrance.

The product must always produce the same truth.

## Design Philosophy

A better interface should never create a different result.

A better interface should only create a better experience.

## North Star

Many experiences.

One engine.

One truth.

## Enforcement

Any future task that introduces, modifies or connects a GT63 interface must answer:

```text
Does this interface converge into the canonical business contract?
```

If the answer is no, the task is blocked until the duplication is removed or the Product Owner explicitly unlocks the architecture.

## Related Locked Checkpoint

This law is grounded by:

```text
de56a23 refactor: unify canonical offer creation flow
```

That checkpoint established:

```text
Admin --\
         -> GT63CanonicalOfferService -> POST/PUT /api/offers
HOME  --/
```

HOME and Admin are different entrances.

The offer truth is one.
