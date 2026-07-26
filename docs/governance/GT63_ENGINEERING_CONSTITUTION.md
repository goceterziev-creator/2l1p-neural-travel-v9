# GT63 Engineering Constitution v1.0

Status: Locked
Applies to: All GT63 product lines

## Core Principle

```text
Infrastructure
  -> Capability
  -> Acceptance
  -> Release
  -> Stable
```

No capability may skip this sequence.

## Product Governance

### GT63 Stable

Stable is the production reference line.

Stable protects:

- production reliability;
- client trust;
- release history;
- controlled maintenance.

Only critical hotfixes may enter Stable:

- security;
- compatibility;
- data integrity.

Stable is never a laboratory.

### GT63 Next

Next is the only active development line.

Next contains:

- new architectures;
- new capabilities;
- controlled experiments;
- future product evolution.

Next must never develop on unproven infrastructure.

## Engineering Gates

### Phase 0 - Product Line Separation

Stable and Next must have independent:

- repositories;
- runtime environments;
- databases;
- storage;
- deployment history;
- rollback history.

### Gate 0 - Infrastructure Acceptance

Infrastructure Acceptance proves that the active Next line has an independent operating environment.

Required proof:

- independent service;
- independent runtime;
- independent dependencies;
- independent database;
- independent storage;
- independent rollback.

No capability work begins before this gate passes.

### Gate 1 - Foundation

Foundation begins capability construction on top of proven infrastructure.

The first V9 foundation capability is:

```text
Block 001 - GT63 Hotel Image Memory
```

### Gate 2 - Capability Acceptance

Every capability must pass its own acceptance cycle:

- architecture review;
- implementation;
- QA;
- regression;
- documentation;
- acceptance.

A capability is not complete until its acceptance evidence is complete.

### Gate 3 - Release Readiness

Release Readiness evaluates the system as a whole.

Required checks:

- integration;
- performance;
- reliability;
- upgrade notes;
- migration plan;
- documentation.

### Gate 4 - Stable Promotion

Only after Release Readiness passes may Next be promoted:

```text
Next
  -> Release Candidate
  -> Production
  -> Stable
```

When a Next line becomes Stable, the following Next line begins separately.

## Engineering Laws

### Law 1 - Stable Is Never A Laboratory

Stable protects production trust and accepts only critical maintenance changes.

### Law 2 - Infrastructure Before Capability

Next never develops capabilities on unproven infrastructure.

### Law 3 - Every Capability Has Its Own Acceptance

No capability is complete merely because code exists.

It is complete only when evidence proves it works and preserves the product promise.

### Law 4 - No Direct Path From Idea To Production

The forbidden path:

```text
Idea
  -> Production
```

The required path:

```text
Idea
  -> Architecture
  -> Infrastructure
  -> Capability
  -> Acceptance
  -> Release
  -> Stable
```

### Law 5 - One Canonical Repository Per Product Line

Every official GT63 product line has exactly one canonical GitHub owner and repository.

For the current lines:

```text
V8 Stable
  -> goceterziev-creator/2l1p-neural-travel

V9 Next
  -> goceterziev-creator/2l1p-neural-travel-v9
```

Railway services must deploy only from the canonical repository for their product line.

The following are not allowed as normal development practice:

- maintaining the same product line under two GitHub owners;
- deploying from a mirror repository;
- switching a Railway service source repo to another product line;
- using a personal fork as the active source of truth;
- creating V9-copy, V9-test, V9-new, or similar parallel product repositories.

If a temporary fork is required for recovery or investigation, it must remain explicitly temporary and must never be connected to Railway deployment.

Any change to the canonical repository for a product line requires an explicit governance decision before code, deployment, or Railway configuration changes.

## Constitutional Outcome

GT63 evolves through controlled product lines, proven infrastructure, evidence-backed capabilities, and deliberate release promotion.

This Constitution exists so GT63 can grow without turning Stable into a moving target or Next into uncontrolled experimentation.
