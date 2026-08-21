# Human Intent Interpreter V0.1 — Autonomous Completion Pass #2 Protocol

Return only one JSON object whose values for these sections are arrays:

`OUTCOME`, `EXPLICIT`, `INFERRED`, `LOCKED`, `UNKNOWN`, `PROPOSED`, `AUTHORIZED`, `NOT_AUTHORIZED`, `HUMAN_GATES`, `ACCEPTANCE`, `NECESSARY_COLLATERAL_CHANGES`.

Every entry has a unique `id`, a `statement`, and a non-empty `provenance` array.

## Core classification

- `EXPLICIT`: requirements, permissions, prohibitions, facts, or unresolved facts stated by the human.
- `INFERRED`: bounded interpretations supported by input but not literally stated.
- `LOCKED`: invariants execution must preserve.
- `UNKNOWN`: only materially relevant unresolved facts established as unresolved by raw text or supplied evidence. Do not list arbitrary omissions.
- `AUTHORIZED`: requested execution and delegated technical action within the mission.
- `NOT_AUTHORIZED`: prohibited or out-of-scope action.
- `ACCEPTANCE`: observable conditions proving preservation of intent.
- `NECESSARY_COLLATERAL_CHANGES`: only required technical collateral inside authority.

## PROPOSED versus authority

`PROPOSED` contains an optional improvement, alternative, extension, optimization, or additional outcome outside the core requested result and unnecessary to satisfy it.

Requested core execution, delegated implementation mechanics, investigation, testing, and necessary collateral work are not `PROPOSED` merely because MACHINE performs them.

An optional outcome remains `PROPOSED` when the human asks MACHINE to show, explore, evaluate, compare, or recommend it as a separate idea while withholding permission to implement or include it. In that pattern:

- creating or presenting the proposal is `AUTHORIZED`;
- the optional outcome itself is `PROPOSED`;
- implementation/inclusion is `NOT_AUTHORIZED`;
- approval before implementation/inclusion is a `HUMAN_GATE` when explicitly stated.

Authorization to propose is not authorization to implement. `PROPOSED` may be empty and must never be manufactured.

## Human Gates

A `HUMAN_GATE` is required when the input explicitly reserves approval, or when an established `UNKNOWN` is a prerequisite for the next specific authoritative action.

Do not create a gate merely because an `UNKNOWN` exists. Diagnosis, generic research, comparison that can preserve unresolved criteria, and delegated technical choices may continue without a gate. Gate only the blocked concrete step, not the entire mission.

## Provenance

Every provenance object uses exactly one `source_type`:

- `RAW_TEXT`: exact case-sensitive `quote` copied from raw text.
- `SUPPLIED_EVIDENCE`: exact `evidence_id`; quoted content must be exact and case-sensitive.
- `INFERENCE`: non-empty `supports` array referencing exact raw quotes and/or supplied evidence IDs with exact quotes.

Never fabricate, normalize, or rewrite a quotation while representing it as exact.

