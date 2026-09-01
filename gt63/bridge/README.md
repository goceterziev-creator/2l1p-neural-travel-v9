# GT63 Bridge V0

Purpose: provide a small, explicit handoff contract between the GT63 architect/reviewer and the implementation agent working in ChatGPT Work/Codex.

## Flow

1. Architect writes or updates `task.json`.
2. Implementation agent reads the task from this branch.
3. Agent performs only the bounded scope.
4. Agent records execution evidence in `result.json`.
5. Architect reviews the diff and evidence.
6. Human approval remains required for merge into `main`.

## Safety rules

- Never modify `main` directly.
- Never merge automatically.
- Never expand scope silently.
- Preserve unknown/uncertain facts as unknown.
- Record tests actually run; do not claim tests that were not run.
- If blocked, return `BLOCKED` with a concrete reason.
- Human remains the final authority for merge/deploy.

## Files

- `task.json` — current bounded task contract.
- `result.json` — implementation result/evidence contract.
