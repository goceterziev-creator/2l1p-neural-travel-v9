# Human Intent Interpreter V0.1 — Semantic Correction Pass #1

Status: `FAIL — STOP CONDITION B`

This additive blind retest clarifies only two interpreter-boundary semantics:

- requested or delegated execution is not a `PROPOSED` improvement;
- provenance distinguishes exact raw-text support, supplied evidence, and inference support.

The corpus is entirely new: 16 cases across Architecture, Software, Travel, and Knowledge, with concise, conversational, fragmented, and mixed styles per domain. Candidates were generated from scratch, one case at a time, by the clean external-model interpreter. Each candidate was frozen before conformance comparison. No failed candidate from the previous corpus was reused or repaired.

The accepted V0 contract and evaluator remain unchanged.

## Result

- 16/16 structurally valid
- explicit recall: 100%
- false-explicit rate: 0%
- explicit/inferred separation: 100%
- locked-invariant recovery: 100%
- UNKNOWN preservation: 100%
- authority/prohibition accuracy: 100%
- Human Gate accuracy: 93.75%
- proposed-improvement recall: 60%
- proposed-improvement precision: 100%
- provenance source-type validity: 100%
- provenance source-reference validity: 100%

The correction eliminated the prior systematic false-positive behavior: no requested or delegated execution action was placed in `PROPOSED`. It did not meet the success gate because two optional improvements explicitly framed as separate ideas were omitted from `PROPOSED`, and one fragmented travel case preserved unresolved route facts but omitted the gate required before route-specific selection.

The remaining defect is therefore narrower than the original cross-domain drift but still material under the approved thresholds. No candidate was repaired.

Run from the repository root:

```bash
node experiments/human-intent-interpreter-v0-1/correction-pass-1/validate-correction-pass.js
```
