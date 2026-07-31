# GT63 Master Architecture

Status: ACTIVE

Purpose: provide the first architectural reading path before working in GT63 code.

## 1. Vision

GT63 is a Travel Proposal Operating System.

The product transforms approved travel data into premium client proposals.

## 2. Product Principles

GT63 follows:

- many experiences;
- one engine;
- one truth;
- one canonical proposal;
- no renderer drift;
- no duplicated business meaning.

## 3. Architecture Laws

Current active laws and governance documents:

- `docs/GT63_ENGINEERING_RULES.md`
- `docs/architecture/GT63_ARCHITECTURE_LAW_22_ONE_PRODUCT_ONE_TRUTH.md`
- `docs/product/GT63_PRESENTATION_CONTRACT.md` when present in the active branch

## 4. Canonical Contracts

Start with:

- `docs/GT63_CANONICAL_CONTEXT.md`

Canonical data must be resolved before presentation branches.

## 5. Renderer Contracts

Presentation modes may differ in layout and density.

They may not differ in business truth.

## 6. HOME Architecture

HOME is a premium entry point into GT63.

HOME does not own a separate proposal engine or save contract.

## 7. Proposal Experience

Proposal Experience is the review and confidence surface.

It must consume canonical offer data rather than redefine it.

## 8. PDF Architecture

Premium PDF is a dedicated print presentation mode.

It must consume the same canonical offer truth as Client HTML.

## 9. Regression Gates

Regression gates must protect:

- canonical offer creation;
- presentation contract parity;
- render determinism;
- no provider lookup during render;
- no second renderer;
- no second offer model.

## First Question For Any New Work

```text
Which canonical contract does this change touch?
```

If the answer is unclear, stop and clarify before implementation.
