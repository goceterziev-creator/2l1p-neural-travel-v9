# Human Intent Layer V0

Status: isolated experiment; no production integration.

## Purpose

This is the smallest working proof of the provider-agnostic pipeline:

```text
natural-language source
  -> evidence-bound interpretation
  -> normalized intent contract
  -> execution evidence
  -> intent regression result
```

The human supplies ordinary natural language. `createIntentLayer({ interpret })` routes that input to an interpreter responsible for producing the evidence-bound interpretation. V0 deliberately defines the interpreter as an injected adapter boundary: it does not pretend that a fixture-specific phrase parser is general language understanding, and it does not bind the contract to a model or provider.

`intent-layer.js` contains the generic core semantics. The same compiler and evaluator are used unchanged for architecture, software, travel and knowledge fixtures.

## Contract

Every interpretation contains:

- `OUTCOME`
- `EXPLICIT`
- `INFERRED`
- `LOCKED`
- `UNKNOWN`
- `PROPOSED`
- `AUTHORIZED`
- `NOT_AUTHORIZED`
- `HUMAN_GATES`
- `ACCEPTANCE`
- `NECESSARY_COLLATERAL_CHANGES`

The original natural-language source is retained in the compiled contract. IDs are unique and every section is explicit, including empty sections. Claims point back to actual `INFERRED` or `UNKNOWN` entries. Canonical key and ID ordering makes the output deterministic for the same input and interpretation.

## Intent Regression

The evaluator checks:

1. explicit requirements and acceptance evidence;
2. locked invariants;
3. unauthorized semantic or user-facing deltas;
4. inference promoted to fact;
5. UNKNOWN converted to certainty;
6. unauthorized proposed improvements;
7. necessary collateral-change boundaries;
8. Human Gate preservation, including unnecessary gates;
9. final intent preservation.

Results are `PASS`, `FAIL`, or `HUMAN_GATE_REQUIRED` and contain stable machine-readable findings.

## Validation

Run without installing dependencies:

```bash
node experiments/human-intent-layer-v0/intent-layer.test.js
```

The suite runs four positive domain fixtures and seven adversarial cases twice, then verifies deterministic contract and result serialization.

## V0 boundary

V0 proves the contract and regression semantics, not universal natural-language understanding. A future interpreter may be deterministic, model-backed or human-assisted, but it must emit the same provider-independent interpretation and must preserve evidence provenance. No interpreter receives execution authority merely by producing a contract candidate.

V0 has no runtime, GT63 HOME, travel, BIM, image-generation, deployment or external-side-effect integration.
