# Human Intent Interpreter V0.2 — Automated Blind Transport

Status: `BLOCKED_REAL_MODEL_ACCESS` until a securely configured real-model
credential is available to the isolated generation command.

This additive experiment removes the manual handoff between a frozen raw brief
and a model adapter without changing accepted Human Intent Layer V0, accepted
V0.1 semantics, or the independent V0.1 evaluator.

## Phase boundary

Generation receives only the public corpus, public V0.1 protocol, output schema,
adapter selection, model identity, and generation parameters. The model-facing
worker runs under the Node permission system with an explicit filesystem read
allowlist. Hidden gold is outside that allowlist. The worker environment is
rebuilt from a small allowlist and contains no gold path or conformance data.

Generation writes, in order:

1. a read-only request manifest;
2. the unmodified raw provider response;
3. a strictly extracted candidate contract;
4. a sealed freeze manifest containing artifact SHA-256 identities.

The output directory is then made read-only. Reusing an existing output path is
rejected. Evaluation verifies every frozen hash before opening hidden gold and
has no adapter or regeneration path.

## Provider boundary

The experimental OpenAI adapter reuses the repository's existing
`provider-layer` and its native-fetch Responses API implementation. It adds no
SDK or dependency. `OPENAI_API_KEY` enters only through the child execution
environment and is never copied into an envelope, manifest, response wrapper,
candidate, fixture, or log. The adapter uses `store: false` and Structured
Outputs through `text.format`. The proof model is pinned to
`gpt-4.1-mini-2025-04-14`; its manifest records the model, parameters, current
token-rate snapshot, conservative maximum cost, and actual provider token usage.
The eight-call maximum is bounded well below the authorized USD 5 ceiling.

The fake adapter implements the same `invoke(envelope, context)` protocol. It is
only a transport/isolation test double and is deliberately incapable of proving
semantic acceptance.

## Fresh blind corpus

The corpus has eight unseen English cases: two each for Architecture, Software,
Travel, and Knowledge, with concise, conversational, fragmented, mixed, and
supplied-evidence variants. Hidden gold is evaluation-only.

## Validation

```sh
HUMAN_INTENT_V0_MODULE="$PWD/experiments/human-intent-layer-v0/intent-layer.js" \
HII_V0_1_EVALUATOR="$PWD/experiments/human-intent-interpreter-v0-1/acceptance-hardening/independent-semantic-evaluator.js" \
node experiments/human-intent-interpreter-v0-1/v0-2-automated-blind-transport/transport.test.js
```

A real run uses a new, empty output path and makes exactly one call per case:

```sh
node experiments/human-intent-interpreter-v0-1/v0-2-automated-blind-transport/transport/run-generation.js \
  --corpus experiments/human-intent-interpreter-v0-1/v0-2-automated-blind-transport/corpus/blind-corpus.json \
  --output /secure/path/hii-v0-2-run \
  --adapter openai \
  --run-id v0-2-real-blind-1
```

Only after generation reports `FROZEN` may the separate evaluation command be
given the hidden-gold path. A semantic FAIL is terminal evidence for that frozen
run; evaluation never invokes an adapter or repairs/regenerates a candidate.

## Non-claims

Until a real call is available and the fresh corpus meets every accepted V0.1
threshold, this build does not claim V0.2 PASS. It does not establish production
readiness, universal or multilingual understanding, deterministic model output,
provider integration, or independent runtime execution-evidence collection.
