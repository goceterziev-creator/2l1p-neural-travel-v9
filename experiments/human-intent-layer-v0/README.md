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

`AUTHORIZED` entries may declare exact `targets`. A semantic/user-facing delta or proposed improvement is authorized only when its cited authority explicitly covers that exact target. Merely citing some valid authority ID is insufficient.

Human Gate declarations must explicitly state whether they are required. Runtime gate events must point to a gate declared by the intent contract.

## Intent Regression

The evaluator checks:

1. explicit requirements and acceptance evidence;
2. locked invariants;
3. unauthorized semantic or user-facing deltas, including authority-scope laundering;
4. inference promoted to fact;
5. UNKNOWN converted to certainty;
6. claims with fabricated or undeclared provenance;
7. unauthorized proposed improvements;
8. necessary collateral-change boundaries;
9. Human Gate preservation, including undeclared and unnecessary gates;
10. final intent preservation.

Results are `PASS`, `FAIL`, or `HUMAN_GATE_REQUIRED` and contain stable machine-readable findings.

## Validation

Run without installing dependencies:

```bash
node experiments/human-intent-layer-v0/intent-layer.test.js
```

The suite runs four positive domain fixtures and ten adversarial cases twice, plus two contract-schema hardening cases, then verifies deterministic contract and result serialization.

The added adversarial cases explicitly test authority laundering, fabricated claim provenance, and undeclared Human Gate events.

## V0 boundary

V0 proves the contract and regression semantics, not universal natural-language understanding. A future interpreter may be deterministic, model-backed or human-assisted, but it must emit the same provider-independent interpretation and must preserve evidence provenance. No interpreter receives execution authority merely by producing a contract candidate.

Execution evidence is still supplied to the evaluator in V0. Independent runtime/provenance evidence collection remains a later layer and is not claimed here.

V0 has no runtime, GT63 HOME, travel, BIM, image-generation, deployment or external-side-effect integration.
