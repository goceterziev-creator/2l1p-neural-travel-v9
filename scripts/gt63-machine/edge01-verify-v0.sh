#!/data/data/com.termux/files/usr/bin/bash
set -u

PROTOCOL="EDGE01-INDEPENDENT-VERIFIER-V0"
AUTHORITY="NONE"
TARGET="${1:-}"
REPO_ID="${REPO_ID:-goceterziev-creator/2l1p-neural-travel-v9}"
BASE="${BASE:-$HOME/edge01-workspace/2l1p-neural-travel-v9}"
MANIFEST="${MANIFEST:-$HOME/edge01-verification-surfaces-v0.json}"
TMP="${TMP:-$PREFIX/tmp/edge01-independent-verifier-v0}"
WORK="${WORK:-$PREFIX/tmp/edge01-verifier-v0-work}"
RESULT="${RESULT:-$HOME/edge01-verifier-result-v0.json}"

cleanup_ephemeral() {
  rm -rf "$TMP" "$WORK"
}

block() {
  REASON="$1"
  cleanup_ephemeral
  echo "BLOCKED: $REASON"
  exit 3
}

[ -n "$TARGET" ] || { echo "Usage: $0 <exact-40-char-target-commit>"; exit 2; }
[[ "$TARGET" =~ ^[0-9a-f]{40}$ ]] || block "TARGET_MUST_BE_EXACT_40_HEX_COMMIT"
[ -f "$MANIFEST" ] || block "SURFACE_MANIFEST_MISSING"
cd "$BASE" || block "BASE_REPOSITORY_UNAVAILABLE"

BASELINE_BEFORE="$(git rev-parse HEAD 2>/dev/null || true)"
STATUS_BEFORE="$(git status --short 2>/dev/null || true)"
NODE_VERSION="$(node --version 2>/dev/null || true)"
NPM_VERSION="$(npm --version 2>/dev/null || true)"
PYTHON_VERSION="$(python --version 2>/dev/null || true)"
ARCH="$(uname -m 2>/dev/null || true)"

[ -n "$BASELINE_BEFORE" ] || block "VERIFIER_BASELINE_IDENTITY_UNAVAILABLE"
[ -z "$STATUS_BEFORE" ] || block "VERIFIER_BASELINE_NOT_CLEAN"
[ -n "$NODE_VERSION" ] || block "NODE_RUNTIME_ABSENT"
[ -n "$PYTHON_VERSION" ] || block "PYTHON_RUNTIME_ABSENT"
git cat-file -e "$TARGET^{commit}" 2>/dev/null || block "TARGET_COMMIT_UNAVAILABLE"

cleanup_ephemeral
mkdir -p "$WORK" "$TMP" || block "EPHEMERAL_WORKSPACE_CREATE_FAILED"

SURFACE_TSV="$WORK/surfaces.tsv"
python - "$MANIFEST" > "$SURFACE_TSV" <<'PY'
import json, sys
m=json.load(open(sys.argv[1], encoding='utf-8'))
for s in m['surfaces']:
    print('\t'.join([
        s['id'], s['implementationPath'], s['implementationBlob'],
        s['testPath'], s['testBlob'], s['safetyPreflight']
    ]))
PY

TOTAL="$(wc -l < "$SURFACE_TSV" | tr -d ' ')"
[ "$TOTAL" -gt 0 ] 2>/dev/null || block "NO_VERIFICATION_SURFACES"

while IFS=$'\t' read -r ID IMPL EXPECTED_IMPL TEST EXPECTED_TEST SAFETY; do
  ACTUAL_IMPL="$(git rev-parse "$TARGET:$IMPL" 2>/dev/null || true)"
  ACTUAL_TEST="$(git rev-parse "$TARGET:$TEST" 2>/dev/null || true)"
  [ "$ACTUAL_IMPL" = "$EXPECTED_IMPL" ] || block "IMPLEMENTATION_BLOB_DRIFT:$ID"
  [ "$ACTUAL_TEST" = "$EXPECTED_TEST" ] || block "TEST_BLOB_DRIFT_REQUIRES_NEW_SAFETY_PREFLIGHT:$ID"
  case "$SAFETY" in
    ACCEPTED|ACCEPTED_WITH_CONTEXT_REVIEW) ;;
    *) block "SAFETY_PREFLIGHT_NOT_ACCEPTED:$ID" ;;
  esac
done < "$SURFACE_TSV"

git archive "$TARGET" | tar -x -C "$TMP" || block "TARGET_MATERIALIZATION_FAILED"

RUN_JSONL="$WORK/run.jsonl"
: > "$RUN_JSONL"
PASS=0
FAIL=0
EXECUTED=0

cd "$TMP" || block "EPHEMERAL_WORKSPACE_UNAVAILABLE"

while IFS=$'\t' read -r ID IMPL EXPECTED_IMPL TEST EXPECTED_TEST SAFETY; do
  OUT="$WORK/$ID.stdout"
  ERR="$WORK/$ID.stderr"

  node "$TEST" >"$OUT" 2>"$ERR"
  RC=$?
  EXECUTED=$((EXECUTED + 1))

  if [ "$RC" -eq 0 ]; then
    RESULT_CLASS="PASS"; PASS=$((PASS + 1))
  else
    RESULT_CLASS="FAIL"; FAIL=$((FAIL + 1))
  fi

  python - "$ID" "$IMPL" "$EXPECTED_IMPL" "$TEST" "$EXPECTED_TEST" "$RESULT_CLASS" "$RC" "$OUT" "$ERR" >> "$RUN_JSONL" <<'PY'
import hashlib, json, pathlib, sys
sid, impl, iblob, test, tblob, result, rc, outp, errp = sys.argv[1:]
outb = pathlib.Path(outp).read_bytes()
errb = pathlib.Path(errp).read_bytes()
record = {
    "id": sid,
    "implementationPath": impl,
    "implementationBlob": iblob,
    "testPath": test,
    "testBlob": tblob,
    "result": result,
    "exitCode": int(rc),
    "stdoutSha256": "sha256:" + hashlib.sha256(outb).hexdigest(),
    "stderrSha256": "sha256:" + hashlib.sha256(errb).hexdigest(),
}
try:
    obj = json.loads(outb.decode("utf-8"))
    for key in ("validationIdentity","outputHash","deterministic","authority","status","suite","workflow","cases","count"):
        if key in obj:
            record[key] = obj[key]
except Exception:
    pass
print(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
PY
done < "$SURFACE_TSV"

cd "$BASE" || exit 4
rm -rf "$TMP"
CLEANUP_COMPLETED=true
[ ! -e "$TMP" ] || CLEANUP_COMPLETED=false

BASELINE_AFTER="$(git rev-parse HEAD 2>/dev/null || true)"
STATUS_AFTER="$(git status --short 2>/dev/null || true)"
WORKTREE_AFTER=true
[ -z "$STATUS_AFTER" ] || WORKTREE_AFTER=false

if [ "$BASELINE_BEFORE" != "$BASELINE_AFTER" ] || [ "$WORKTREE_AFTER" != true ] || [ "$CLEANUP_COMPLETED" != true ]; then
  VERDICT="VERIFIER_INTEGRITY_FAILURE"
elif [ "$FAIL" -gt 0 ]; then
  VERDICT="VERIFIED_FAIL"
elif [ "$EXECUTED" -ne "$TOTAL" ]; then
  VERDICT="BLOCKED"
else
  VERDICT="VERIFIED_PASS"
fi

RESULT_TMP="$WORK/result.json.tmp"
if ! python - "$RUN_JSONL" "$RESULT_TMP" "$WORKTREE_AFTER" "$CLEANUP_COMPLETED" <<PY
import json, sys, datetime
runlog, result_path, worktree_after, cleanup_completed = sys.argv[1:]
def shell_bool(value):
    if value == "true":
        return True
    if value == "false":
        return False
    raise ValueError(f"invalid shell boolean: {value!r}")
surfaces=[]
with open(runlog, encoding="utf-8") as f:
    for line in f:
        if line.strip():
            surfaces.append(json.loads(line))
doc={
  "protocol":"$PROTOCOL",
  "authority":"$AUTHORITY",
  "timestampUtc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "repository":{"identity":"$REPO_ID","targetCommit":"$TARGET"},
  "verifier":{
    "node":"EDGE01",
    "baselineCommitBefore":"$BASELINE_BEFORE",
    "baselineCommitAfter":"$BASELINE_AFTER",
    "architecture":"$ARCH",
    "runtime":{"node":"$NODE_VERSION","npm":"$NPM_VERSION","python":"$PYTHON_VERSION"},
    "workingTreeCleanBefore":True,
    "workingTreeCleanAfter":shell_bool(worktree_after)
  },
  "surfaces":surfaces,
  "verification":{
    "materialization":"EPHEMERAL_GIT_ARCHIVE",
    "requiredSuites":int("$TOTAL"),
    "executedSuites":$EXECUTED,
    "passedSuites":$PASS,
    "failedSuites":$FAIL,
    "cleanupCompleted":shell_bool(cleanup_completed)
  },
  "verdict":"$VERDICT"
}
with open(result_path, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY
then
  rm -f "$RESULT_TMP"
  rm -rf "$WORK"
  echo "VERDICT=VERIFIER_INTEGRITY_FAILURE"
  echo "RESULT_EMISSION_FAILED"
  exit 5
fi

if ! python - "$RESULT_TMP" >/dev/null <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    json.load(f)
PY
then
  rm -f "$RESULT_TMP"
  rm -rf "$WORK"
  echo "VERDICT=VERIFIER_INTEGRITY_FAILURE"
  echo "RESULT_VALIDATION_FAILED"
  exit 5
fi

if ! mv "$RESULT_TMP" "$RESULT"; then
  rm -f "$RESULT_TMP"
  rm -rf "$WORK"
  echo "VERDICT=VERIFIER_INTEGRITY_FAILURE"
  echo "RESULT_PUBLISH_FAILED"
  exit 5
fi

rm -rf "$WORK"
echo "RESULT_FILE=$RESULT"
echo "VERDICT=$VERDICT"
echo "PASS=$PASS FAIL=$FAIL EXECUTED=$EXECUTED TOTAL=$TOTAL"
