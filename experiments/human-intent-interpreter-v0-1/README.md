# Human Intent Interpreter V0.1 — External Blind Model Handoff

Status: `FAIL — STOP CONDITION B`

This isolated evidence package evaluates a real clean-context ChatGPT interpreter against the accepted Human Intent Layer V0 contract. It does not implement automated provider transport.

## Blind procedure

The interpreter received one raw brief at a time, language, legitimate evidence when present, and the provider-neutral output schema. It did not inherit the MACHINE conversation and received no gold contract, expected contents, finding codes or conformance feedback. Each candidate was persisted before the next case. No candidate was repaired.

The corpus contains 16 previously unseen paraphrases: four domains multiplied by concise, conversational, fragmented and mixed explicit/implied styles.

## Result

Strong dimensions:

- explicit recall: 100%
- false-explicit rate: 0%
- explicit/inferred separation: 100%
- locked-invariant recovery: 100%
- UNKNOWN preservation: 96%
- authority/prohibition accuracy: 100%
- Human Gate accuracy: 100%
- structural validity: 100%

Material failure:

- proposed-improvement recall: 100%
- proposed-improvement precision: 9.68%
- 28 ordinary authorized execution actions were incorrectly placed in `PROPOSED`
- the same failure occurred in Architecture, Software, Travel and Knowledge

The failure is therefore cross-domain and material. The remaining blocker is not transport/adapter integration only.

## Accepted V0 compatibility

All 16 candidate interpretations compile through the unchanged accepted V0 schema. A no-mutation execution projection produced nine `PASS` and seven `HUMAN_GATE_REQUIRED` results, with zero V0 evaluator failures.

This proves structural/runtime-path compatibility but does not erase hidden-gold conformance failure. The accepted evaluator cannot detect a semantically misclassified `PROPOSED` entry when the execution projection implements no proposal.

## Reproduce

From the repository root:

```bash
node experiments/human-intent-interpreter-v0-1/external-blind-validation.js
```

The script validates frozen source provenance, compiles every candidate through the accepted V0 module, runs the projected Intent Regression path and reproduces aggregate metrics from the frozen conformance record.

No production path, dependency, accepted V0 file, provider configuration or governance document is changed.
