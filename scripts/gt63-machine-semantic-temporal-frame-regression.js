"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  RULESET_VERSION,
  compareTemporalFrameRefs,
  validateTemporalFrame,
  validateTemporalFrames
} = require("./gt63-machine/semantic-temporal-frame");

const repositoryRoot = __dirname.includes(`${path.sep}scripts`)
  ? path.resolve(__dirname, "..")
  : process.cwd();

function frame(overrides = {}) {
  return {
    temporalFrameId: "time:current",
    scopeId: "scope:repo",
    frameType: "CURRENT_BASELINE",
    start: "2026-08-11T00:00:00Z",
    end: null,
    baselineRef: "baseline:main",
    evidenceRefs: ["ev:baseline"],
    ...overrides
  };
}

function assertThrowsMessage(fn, pattern) {
  assert.throws(fn, (error) => pattern.test(error.message));
}

function assertThrowsExact(fn, message) {
  assert.throws(fn, (error) => error.message === message);
}

function runNodeCheck(filePath) {
  const run = childProcess.spawnSync(process.execPath, ["--check", filePath], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  assert.strictEqual(run.status, 0, run.stderr || run.stdout);
}

function assertValid(record) {
  assert.strictEqual(validateTemporalFrame(record, RULESET_VERSION).ok, true);
}

function main() {
  const frames = [
    frame(),
    frame({
      temporalFrameId: "time:history",
      frameType: "HISTORICAL_INTERVAL",
      start: "2024-01-01T00:00:00Z",
      end: "2024-12-31T23:59:59Z",
      baselineRef: null,
      evidenceRefs: ["ev:history"]
    }),
    frame({
      temporalFrameId: "time:commit",
      frameType: "COMMIT_FRAME",
      start: "2025-05-05T05:05:05Z",
      end: null,
      baselineRef: null,
      evidenceRefs: ["ev:commit"]
    }),
    frame({
      temporalFrameId: "time:runtime",
      frameType: "RUNTIME_OBSERVATION_FRAME",
      start: "2025-06-06T06:06:06Z",
      end: "2025-06-06T06:07:06Z",
      baselineRef: null,
      evidenceRefs: ["ev:runtime"]
    }),
    frame({
      temporalFrameId: "time:declared",
      frameType: "DECLARED_FRAME",
      start: null,
      end: null,
      baselineRef: null,
      evidenceRefs: ["ev:declared"]
    }),
    frame({
      temporalFrameId: "time:unknown",
      frameType: "UNKNOWN_FRAME",
      start: null,
      end: null,
      baselineRef: null,
      evidenceRefs: ["ev:unknown"]
    })
  ];

  // TF-01 through TF-06.
  for (const record of frames) {
    assertValid(record);
  }

  // TF-07 through TF-11.
  assertThrowsMessage(() => validateTemporalFrame(frame({ frameType: "CURRENT" }), RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:frameType/);
  const missingScope = frame();
  delete missingScope.scopeId;
  assertThrowsMessage(() => validateTemporalFrame(missingScope, RULESET_VERSION), /SCHEMA_UNSUPPORTED_FIELD:scopeId/);
  assertThrowsMessage(() => validateTemporalFrame(frame({ start: "2026-13-01T00:00:00Z" }), RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:start/);
  assertThrowsMessage(() => validateTemporalFrame(frame({ start: "2026-08-11" }), RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:start/);
  assertThrowsMessage(() => validateTemporalFrame(frame({ start: "2026-08-11T00:00:00" }), RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:start/);
  assertThrowsMessage(() => validateTemporalFrame(frame({ start: "2026-08-11T00:00:00+02:00" }), RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:start/);
  assertThrowsMessage(() => validateTemporalFrame(frame({ start: "2026-02-30T00:00:00Z" }), RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:start/);

  // TF-12 through TF-20.
  assert.strictEqual(compareTemporalFrameRefs("time:current", "time:current", frames, RULESET_VERSION), "SAME_FRAME");
  assert.strictEqual(compareTemporalFrameRefs("time:current", "time:history", frames, RULESET_VERSION), "DIFFERENT_FRAME");
  const sameDates = [
    frame({ temporalFrameId: "time:same-a", start: "2025-01-01T00:00:00Z", end: null }),
    frame({ temporalFrameId: "time:same-b", start: "2025-01-01T00:00:00Z", end: null })
  ];
  const differentScopes = [
    frame({ temporalFrameId: "time:scope-a", scopeId: "scope:a" }),
    frame({ temporalFrameId: "time:scope-b", scopeId: "scope:b" })
  ];
  const unknownFrames = [
    frame({ temporalFrameId: "time:unknown-a", frameType: "UNKNOWN_FRAME", start: null, end: null, baselineRef: null }),
    frame({ temporalFrameId: "time:unknown-b", frameType: "UNKNOWN_FRAME", start: null, end: null, baselineRef: null })
  ];
  assert.notStrictEqual(compareTemporalFrameRefs("time:same-a", "time:same-b", sameDates, RULESET_VERSION), "SAME_FRAME");
  assert.strictEqual(compareTemporalFrameRefs(null, "time:current", frames, RULESET_VERSION), "UNKNOWN");
  assert.strictEqual(compareTemporalFrameRefs("time:current", null, frames, RULESET_VERSION), "UNKNOWN");
  assert.strictEqual(compareTemporalFrameRefs("time:missing", "time:current", frames, RULESET_VERSION), "UNKNOWN");
  assert.strictEqual(compareTemporalFrameRefs("time:current", "time:unknown", frames, RULESET_VERSION), "UNKNOWN");
  assert.strictEqual(compareTemporalFrameRefs("time:current", "time:history", frames.slice().reverse(), RULESET_VERSION), "DIFFERENT_FRAME");
  assert.strictEqual(compareTemporalFrameRefs("time:current", "time:history", frames, RULESET_VERSION), compareTemporalFrameRefs("time:current", "time:history", frames, RULESET_VERSION));
  assert.strictEqual(compareTemporalFrameRefs("time:unknown", "time:unknown", frames, RULESET_VERSION), "SAME_FRAME");
  assert.strictEqual(compareTemporalFrameRefs("time:unknown-a", "time:unknown-b", unknownFrames, RULESET_VERSION), "UNKNOWN");
  assert.strictEqual(compareTemporalFrameRefs("time:scope-a", "time:scope-b", differentScopes, RULESET_VERSION), "UNKNOWN");
  assert.strictEqual(compareTemporalFrameRefs("time:scope-a", "time:scope-b", differentScopes, RULESET_VERSION) === "NOT_COMPARABLE", false);

  // Adversarial cases.
  assert.strictEqual(compareTemporalFrameRefs("time:same-a", "time:same-b", sameDates, RULESET_VERSION), "DIFFERENT_FRAME");
  assert.strictEqual(validateTemporalFrames(frames.slice().reverse(), RULESET_VERSION).frames[0].temporalFrameId, "time:commit");
  assertValid(frame({ temporalFrameId: "time:file-final-2026", evidenceRefs: ["ev:filename-looking"] }));
  assertThrowsExact(
    () => validateTemporalFrames([frame({ temporalFrameId: "time:A" }), frame({ temporalFrameId: "time:A" })], RULESET_VERSION),
    "SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:time:A"
  );
  assertThrowsExact(
    () => validateTemporalFrames([
      frame({ temporalFrameId: "time:A", scopeId: "scope:a" }),
      frame({ temporalFrameId: "time:A", scopeId: "scope:b" })
    ], RULESET_VERSION),
    "SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:time:A"
  );
  assertThrowsExact(
    () => validateTemporalFrames([frame({ temporalFrameId: "time:A" }), frame({ temporalFrameId: "time:A" }), frame({ temporalFrameId: "time:A" })], RULESET_VERSION),
    "SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:time:A"
  );
  assertThrowsExact(
    () => validateTemporalFrames([frame({ temporalFrameId: "time:A" }), frame({ temporalFrameId: "time:B" }), frame({ temporalFrameId: "time:A" })], RULESET_VERSION),
    "SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:time:A"
  );
  const duplicateAB = [
    frame({ temporalFrameId: "time:A" }),
    frame({ temporalFrameId: "time:B" }),
    frame({ temporalFrameId: "time:A" }),
    frame({ temporalFrameId: "time:B" })
  ];
  const duplicateBA = [
    frame({ temporalFrameId: "time:B" }),
    frame({ temporalFrameId: "time:A" }),
    frame({ temporalFrameId: "time:B" }),
    frame({ temporalFrameId: "time:A" })
  ];
  assertThrowsExact(() => validateTemporalFrames(duplicateAB, RULESET_VERSION), "SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:time:A");
  assertThrowsExact(() => validateTemporalFrames(duplicateBA, RULESET_VERSION), "SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:time:A");
  assertThrowsExact(
    () => validateTemporalFrames([
      frame({ temporalFrameId: "time:C" }),
      frame({ temporalFrameId: "time:B" }),
      frame({ temporalFrameId: "time:A" }),
      frame({ temporalFrameId: "time:C" }),
      frame({ temporalFrameId: "time:B" }),
      frame({ temporalFrameId: "time:A" })
    ], RULESET_VERSION),
    "SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:time:A"
  );
  assertThrowsMessage(() => validateTemporalFrame(frame({ extraSemanticField: "CURRENT" }), RULESET_VERSION), /SCHEMA_UNSUPPORTED_FIELD:extraSemanticField/);
  assertThrowsMessage(() => validateTemporalFrame(frame(), "semantic-evidence-v1.0.0"), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => validateTemporalFrame(frame(), "semantic-evidence-v2.0.0"), /UNSUPPORTED_RULESET_VERSION/);

  const source = fs.readFileSync(path.join(repositoryRoot, "scripts", "gt63-machine", "semantic-temporal-frame.js"), "utf8");
  for (const forbidden of ["Date.now", "new Date(", "Date.parse", "process.cwd", "process.env", "require(\"fs\")", ".stat", "statSync", ".mtime", "require(\"os\")", "os.", "localeCompare", "Intl", "Math.random", "path.", "execFileSync"]) {
    assert(!source.includes(forbidden), `temporal frame implementation must not use ${forbidden}`);
  }

  runNodeCheck("scripts/gt63-machine/semantic-temporal-frame.js");
  runNodeCheck("scripts/gt63-machine-semantic-temporal-frame-regression.js");
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical.json")), false);
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical-review.json")), false);

  const comparisonResults = {
    same: compareTemporalFrameRefs("time:current", "time:current", frames, RULESET_VERSION),
    different: compareTemporalFrameRefs("time:current", "time:history", frames, RULESET_VERSION),
    notComparable: "UNREACHABLE_IN_UNIT_3_V1_0_1_CLOSED_INPUT",
    unknown: compareTemporalFrameRefs("time:missing", "time:current", frames, RULESET_VERSION)
  };
  const output = {
    status: "PASS",
    workflow: "semantic-evidence-unit-3-temporal-frame-regression",
    trace: {
      rulesetVersion: RULESET_VERSION,
      derivationRuleId: "SE-V1-UNIT-3",
      fixtureId: "unit3-temporal-frame"
    },
    outputs: {
      frameCount: frames.length,
      comparisonResults,
      outputHash: crypto.createHash("sha256").update(JSON.stringify({ frames, comparisonResults })).digest("hex")
    }
  };
  console.log(JSON.stringify(output, null, 2));
}

main();
