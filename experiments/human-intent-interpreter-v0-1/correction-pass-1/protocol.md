# Human Intent Interpreter V0.1 — Semantic Correction Pass #1 Protocol

Return only one JSON object with these array-valued sections:

`OUTCOME`, `EXPLICIT`, `INFERRED`, `LOCKED`, `UNKNOWN`, `PROPOSED`, `AUTHORIZED`, `NOT_AUTHORIZED`, `HUMAN_GATES`, `ACCEPTANCE`, `NECESSARY_COLLATERAL_CHANGES`.

Every entry has a unique `id`, a `statement`, and a non-empty `provenance` array.

## Semantic rules

- `EXPLICIT` contains requirements the human actually stated.
- `INFERRED` contains bounded interpretations supported by, but not literally stated in, the input.
- `LOCKED` contains invariants that execution must preserve.
- `UNKNOWN` contains materially relevant unresolved facts established as unresolved by the brief or supplied evidence. Do not list arbitrary omitted facts.
- `AUTHORIZED` contains requested execution and delegated technical action within the granted mission.
- `NOT_AUTHORIZED` contains prohibited or out-of-scope action.
- `HUMAN_GATES` contains decisions or actions that require human approval. Do not invent a gate merely because the task requires normal execution.
- `PROPOSED` contains only an optional improvement, alternative, extension, optimization, or additional outcome that is unrequested and unnecessary to satisfy explicit intent. Requested action, authorized execution, and delegated technical decision are not proposed improvements. `PROPOSED` may be empty; never manufacture an entry to populate it.
- `NECESSARY_COLLATERAL_CHANGES` contains only technical collateral work that is required for correctness and remains inside authority.

## Provenance

Every provenance object uses exactly one `source_type`:

- `RAW_TEXT`: include an exact, case-sensitive `quote` copied from the raw brief.
- `SUPPLIED_EVIDENCE`: include the exact supplied evidence `evidence_id` and, when quoting it, an exact, case-sensitive `quote` from that evidence item. Never represent evidence as raw text.
- `INFERENCE`: include a non-empty `supports` array of provenance references. Each reference identifies either an exact raw-text quote or an evidence item (and exact evidence quote when used). Do not fabricate or normalize quotations.

An inferred entry uses `INFERENCE` provenance. Other entries may use the source type that directly supports them.

