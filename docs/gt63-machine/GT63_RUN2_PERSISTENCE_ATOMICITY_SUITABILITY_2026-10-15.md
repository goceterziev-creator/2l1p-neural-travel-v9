# GT63 Run #2 — persistence and atomic one-shot suitability review (2026-10-15)

## Inspected source
- `server.js:305-320`: `writeDb` serializes a complete JSON snapshot, creates `<DB_FILE>.<pid>.tmp`, copies a backup, writes and validates the temporary file, then renames it into place. It does not show file/directory `fsync`, cross-process locking, or a compare-and-swap revision guard.
- `server.js:325-337`: `mutateDb` serializes mutation functions with an **in-process** Promise queue. This is not a distributed or cross-process lock, and is not proof of crash-durable one-shot consumption.
- `scripts/gt63-machine/repeatable-filesystem-run2-real-execution-preparation-v0.js:7`: the preparation ledger is an ephemeral array, recreated for each `prepareRun2` call.
- `scripts/gt63-machine/repeatable-filesystem-native-link-read-adapter-v0.js`: requires additional evidence-reference and link-store read ports not shown by the above storage components.

## Determination
**Existing JSON database: potentially reusable as a storage substrate, but NOT PROVEN SUITABLE for atomic, crash-safe one-shot filesystem effects.**

A same-process queue can prevent overlapping `mutateDb` calls within that process. Atomic rename can reduce partially visible snapshot risk on an appropriate filesystem. Neither proves exactly-once effects across restarts, multiple processes, interrupted writes, or a crash between a reservation and the external filesystem operation.

## Minimum proof before promotion
1. Explicit durable schema and provenance for claim/preparation/link/consumption evidence; exact unique effect identity.
2. Concurrency and restart tests on the actual target storage, including multiple processes and duplicate requests.
3. Atomic reservation semantics and recovery for RESERVED / EFFECT_UNCERTAIN / VERIFIED states.
4. Re-observe target and authority immediately before any effect, and fail closed when ambiguous.
5. Separate exact human authorization before enabling the physical Run #2 write.

No live database inspection, mutation, or execution was performed. No deployment readiness claimed. MACHINE AUTHORITY: NONE.
