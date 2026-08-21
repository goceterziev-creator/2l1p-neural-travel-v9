# Human Intent Interpreter V0.1 independent acceptance hardening

This directory contains a deterministic, model-free acceptance harness for the
frozen autonomous-completion-pass-2 evidence. It does not call an interpreter
and does not read precomputed conformance counters when deciding PASS or FAIL.

## Evidence boundary

The harness derives conformance after candidate generation from four frozen
inputs:

1. `blind-corpus.json` (raw brief and legitimately supplied evidence);
2. `candidates/<case>.json` (the frozen interpreter output);
3. `hidden-gold.json` (evaluation-only semantic expectations);
4. the byte-identical accepted V0 compiler and Intent Regression evaluator.

Pinned SHA-256 identities:

- corpus: `805d9d7bb3ca24304e91de732f62e8f551bf2edbfaecd508e4b1959c111b7e08`
- ordered candidate set: `4ed470b4cb4bb0badaa8b40d9ee87154f4fd425ff15ba7f1d75fdad7a13c6132`
- hidden gold: `51a6631c8f4a3f8fd918508eb00329f6ec4d316c3f190fe66d46fa9185723343`

## Design

`independent-semantic-evaluator.js` derives denominators, matches hidden-gold
semantic units against the corresponding candidate sections, validates exact
raw/evidence provenance references, detects unsupported explicit claims and
authority conflicts, computes all locked metrics, and projects every candidate
through accepted V0 Intent Regression. Its API has no conformance-record input.

`run-independent-acceptance.js` loads only frozen primary evidence and emits a
canonical JSON result. It explicitly records that `conformance-record.json` was
not loaded and was not used for the verdict.

`adversarial-sensitivity.test.js` deep-clones candidates in memory and proves
sensitivity to all nine required defect classes. It also passes an in-memory
copy of `conformance-record.json` whose counters were poisoned to zero as an
unknown extra property; the independently derived result must remain identical.
No frozen file is changed.

## Run

From the repository root:

```sh
FROZEN_EVIDENCE_DIR="$PWD/interpreter-spike-work/autonomous-completion-pass-2" \
HUMAN_INTENT_V0_MODULE="$PWD/validation-pr2-ba45a75d/intent-layer.js" \
node interpreter-spike-work/acceptance-hardening/run-independent-acceptance.js

FROZEN_EVIDENCE_DIR="$PWD/interpreter-spike-work/autonomous-completion-pass-2" \
HUMAN_INTENT_V0_MODULE="$PWD/validation-pr2-ba45a75d/intent-layer.js" \
node interpreter-spike-work/acceptance-hardening/adversarial-sensitivity.test.js
```

## Boundaries

The comparison is deterministic lexical/concept normalization over the frozen
English evaluation corpus. It establishes reproducibility and defect
sensitivity for this evidence set; it is not a claim of universal semantic
equivalence, multilingual scoring, automated provider transport, production
integration, or independent execution-evidence collection.
