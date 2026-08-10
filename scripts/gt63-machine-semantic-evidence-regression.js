"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  RULESET_VERSION,
  canonicalSerialize,
  conflictId,
  directRelationshipId,
  semanticStatementId
} = require("./gt63-machine/semantic-canonical");

const repositoryRoot = __dirname.includes(`${path.sep}scripts`)
  ? path.resolve(__dirname, "..")
  : process.cwd();

function baseStatement(overrides = {}) {
  return {
    capability: "semantic-evidence",
    schemaVersion: "1.0",
    rulesetVersion: RULESET_VERSION,
    outputCollection: "artifactStates",
    propositionKind: "artifactIdentity",
    artifactId: "artifact:a",
    semanticState: "ESTABLISHED",
    derivationRuleId: "SE-V1-T-STATEMENT",
    provenanceScope: "scope:repo",
    temporalFrameRef: "time:current",
    evidenceRefs: ["ev:a", "ev:b"],
    ...overrides
  };
}

function baseConflict(overrides = {}) {
  return {
    capability: "semantic-evidence",
    schemaVersion: "1.0",
    rulesetVersion: RULESET_VERSION,
    conflictType: "IDENTITY_CONFLICT",
    propositionKind: "identityResolution",
    provenanceScope: "scope:repo",
    temporalFrameRef: "time:current",
    semanticMembers: ["idres:b", "idres:a"],
    evidenceRefs: ["ev:b", "ev:a"],
    ...overrides
  };
}

function baseRelation(overrides = {}) {
  return {
    capability: "semantic-evidence",
    schemaVersion: "1.0",
    rulesetVersion: RULESET_VERSION,
    relationshipId: "ignored",
    provenanceScope: "scope:repo",
    temporalFrameRef: "time:current",
    source: "artifact:source",
    relationType: "IMPORTS",
    normalizedTargetKey: "./module.js",
    adapterCoverageRef: "adapter:js",
    directOrDerived: "DIRECT",
    evidenceRefs: ["ev:import"],
    target: null,
    factStatus: "UNRESOLVED_TARGET",
    identityResolutionRef: "idres:unresolved",
    relationStatus: "UNKNOWN",
    conflictStatus: "NONE",
    ...overrides
  };
}

function runNodeCheck(filePath) {
  const run = childProcess.spawnSync(process.execPath, ["--check", filePath], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  assert.strictEqual(run.status, 0, run.stderr || run.stdout);
}

function assertThrowsMessage(fn, pattern) {
  assert.throws(fn, (error) => pattern.test(error.message));
}

function unit1SemanticOutput() {
  const statement = baseStatement();
  const conflict = baseConflict();
  const relation = baseRelation();
  return {
    rulesetVersion: RULESET_VERSION,
    statementId: semanticStatementId(statement),
    conflictId: conflictId(conflict),
    relationshipId: directRelationshipId(relation),
    statementCanonical: canonicalSerialize(statement),
    conflictCanonical: canonicalSerialize(conflict),
    relationCanonical: canonicalSerialize(relation)
  };
}

function main() {
  const trace = {
    rulesetVersion: RULESET_VERSION,
    derivationRuleId: "SE-V1-UNIT-1",
    fixtureId: "unit1-canonical-serialization"
  };

  // T-01 Object key order.
  assert.strictEqual(canonicalSerialize({ b: "2", a: "1" }), canonicalSerialize({ a: "1", b: "2" }));
  assert.strictEqual(
    semanticStatementId(baseStatement({ declaredIdentity: { b: "2", a: "1" } })),
    semanticStatementId(baseStatement({ declaredIdentity: { a: "1", b: "2" } }))
  );

  // T-02 evidenceRefs order.
  assert.strictEqual(
    semanticStatementId(baseStatement({ evidenceRefs: ["ev:b", "ev:a"] })),
    semanticStatementId(baseStatement({ evidenceRefs: ["ev:a", "ev:b"] }))
  );

  // T-03 evidenceRefs duplicates.
  assert.strictEqual(
    canonicalSerialize({ evidenceRefs: ["ev:a", "ev:a", "ev:b"] }),
    canonicalSerialize({ evidenceRefs: ["ev:b", "ev:a"] })
  );
  assert.strictEqual(
    semanticStatementId(baseStatement({ evidenceRefs: ["ev:a", "ev:a", "ev:b"] })),
    semanticStatementId(baseStatement({ evidenceRefs: ["ev:b", "ev:a"] }))
  );

  // R1/R2 aliases are set-like: order-independent and duplicate-independent.
  assert.strictEqual(
    canonicalSerialize({ aliases: ["b", "a"] }),
    canonicalSerialize({ aliases: ["a", "b"] })
  );
  assert.strictEqual(
    canonicalSerialize({ aliases: ["a", "a", "b"] }),
    canonicalSerialize({ aliases: ["b", "a"] })
  );
  assert.strictEqual(canonicalSerialize({ aliases: ["\u00e9", "e\u0301"] }), "{\"aliases\":[\"\u00e9\"]}");
  assert.strictEqual(canonicalSerialize({ relationMembers: ["b", "a", "a"] }), "{\"relationMembers\":[\"a\",\"b\"]}");
  assert.strictEqual(
    canonicalSerialize({ relationMembers: ["\u00e9", "e\u0301", "a"] }),
    "{\"relationMembers\":[\"a\",\u0022\u00e9\u0022]}"
  );
  assert.strictEqual(canonicalSerialize({ scopeRefs: ["scope:2", "scope:1", "scope:1"] }), "{\"scopeRefs\":[\"scope:1\",\"scope:2\"]}");
  assert.strictEqual(
    canonicalSerialize({ temporalFrameRefs: ["time:2", "time:1", "time:1"] }),
    "{\"temporalFrameRefs\":[\"time:1\",\"time:2\"]}"
  );
  assert.strictEqual(
    canonicalSerialize({ identityResolutionRefs: ["idres:b", "idres:a", "idres:a"] }),
    "{\"identityResolutionRefs\":[\"idres:a\",\"idres:b\"]}"
  );

  // T-04 Ordered array preservation.
  assert.notStrictEqual(canonicalSerialize({ ordered: ["a", "b"] }), canonicalSerialize({ ordered: ["b", "a"] }));
  assert.strictEqual(canonicalSerialize({ steps: ["b", "a"] }), "{\"steps\":[\"b\",\"a\"]}");

  // T-05 Unicode NFC.
  assert.strictEqual(canonicalSerialize({ text: "\u00e9" }), canonicalSerialize({ text: "e\u0301" }));
  assert.strictEqual(
    semanticStatementId(baseStatement({ declaredIdentity: "\u00e9" })),
    semanticStatementId(baseStatement({ declaredIdentity: "e\u0301" }))
  );

  // R3 Set-like string sorting uses semantic code points before JSON escaping.
  assert.strictEqual(canonicalSerialize({ evidenceRefs: ["ev:A", "ev:\n"] }), "{\"evidenceRefs\":[\"ev:\\n\",\"ev:A\"]}");

  // T-06 Boolean/null.
  assert.strictEqual(canonicalSerialize({ yes: true, no: false, none: null }), "{\"no\":false,\"none\":null,\"yes\":true}");

  // T-07 Integer serialization.
  assert.strictEqual(canonicalSerialize({ version: 1 }, { integerKeys: ["version"] }), "{\"version\":1}");
  assert.strictEqual(canonicalSerialize({ version: 1.0 }, { integerKeys: ["version"] }), "{\"version\":1}");
  assertThrowsMessage(() => semanticStatementId(baseStatement({ arbitraryField: 1 })), /SCHEMA_UNSUPPORTED_FIELD:arbitraryField/);
  assertThrowsMessage(() => canonicalSerialize({ value: 1 }), /UNSUPPORTED_NUMBER/);
  assertThrowsMessage(() => canonicalSerialize({ version: Number.MAX_SAFE_INTEGER + 1 }, { integerKeys: ["version"] }), /UNSUPPORTED_NUMBER/);
  assertThrowsMessage(() => canonicalSerialize({ version: 1.25 }, { integerKeys: ["version"] }), /UNSUPPORTED_NUMBER/);
  assertThrowsMessage(() => canonicalSerialize({ version: Number.NaN }, { integerKeys: ["version"] }), /UNSUPPORTED_NUMBER/);
  assertThrowsMessage(() => canonicalSerialize({ version: Number.POSITIVE_INFINITY }, { integerKeys: ["version"] }), /UNSUPPORTED_NUMBER/);
  assertThrowsMessage(() => canonicalSerialize({ version: Number.NEGATIVE_INFINITY }, { integerKeys: ["version"] }), /UNSUPPORTED_NUMBER/);
  assertThrowsMessage(() => canonicalSerialize({ version: -0 }, { integerKeys: ["version"] }), /UNSUPPORTED_NUMBER/);

  // T-08 RFC JSON escaping.
  assert.strictEqual(canonicalSerialize({ text: "quote\" slash\\ line\n tab\t \u2603" }), JSON.stringify({
    text: "quote\" slash\\ line\n tab\t \u2603".normalize("NFC")
  }));

  // T-09 Statement ID determinism.
  const repeatedStatementIds = Array.from({ length: 5 }, () => semanticStatementId(baseStatement()));
  assert.strictEqual(new Set(repeatedStatementIds).size, 1);

  // T-10 Statement ID semantic difference.
  assert.strictEqual(
    semanticStatementId(baseStatement()),
    semanticStatementId(baseStatement({ runtimeDebug: "x" }))
  );
  assert.strictEqual(
    semanticStatementId(baseStatement()),
    semanticStatementId(baseStatement({ explanation: "presentation-only prose" }))
  );
  assert.notStrictEqual(
    semanticStatementId(baseStatement({ semanticState: "ESTABLISHED" })),
    semanticStatementId(baseStatement({ semanticState: "UNKNOWN" }))
  );

  // T-11 conflictId input order.
  assert.strictEqual(
    conflictId(baseConflict({ semanticMembers: ["idres:b", "idres:a"], evidenceRefs: ["ev:b", "ev:a"] })),
    conflictId(baseConflict({ semanticMembers: ["idres:a", "idres:b"], evidenceRefs: ["ev:a", "ev:b"] }))
  );
  assert.strictEqual(
    conflictId(baseConflict()),
    conflictId(baseConflict({ displayLabel: "x" }))
  );
  assert.strictEqual(
    conflictId(baseConflict()),
    conflictId(baseConflict({ runtimeDebug: { reviewer: "debug-only" } }))
  );
  assert.strictEqual(
    conflictId(baseConflict({ semanticMembers: ["sem:a", "sem:b"] })),
    conflictId(baseConflict({ semanticMembers: ["sem:b", "sem:a", "sem:a"] }))
  );
  assert.notStrictEqual(
    conflictId(baseConflict({ conflictType: "IDENTITY_CONFLICT" })),
    conflictId(baseConflict({ conflictType: "TEMPORAL_CONFLICT" }))
  );

  // T-12 relationshipId resolution stability.
  const unresolved = baseRelation();
  const resolved = baseRelation({
    target: "artifact:module",
    factStatus: "OBSERVED_FACT",
    identityResolutionRef: "idres:resolved",
    relationStatus: "PROVEN",
    conflictStatus: "NONE"
  });
  assert.strictEqual(directRelationshipId(unresolved), directRelationshipId(resolved));
  assert.strictEqual(
    directRelationshipId(baseRelation({ evidenceRefs: ["ev:b", "ev:a"] })),
    directRelationshipId(baseRelation({ evidenceRefs: ["ev:a", "ev:b", "ev:a"] }))
  );

  // T-13 relationshipId material change.
  assert.notStrictEqual(
    directRelationshipId(baseRelation({ normalizedTargetKey: "./module.js" })),
    directRelationshipId(baseRelation({ normalizedTargetKey: "./other.js" }))
  );

  // T-14 Ruleset binding.
  assertThrowsMessage(() => semanticStatementId(baseStatement({ rulesetVersion: "semantic-evidence-v2.0.0" })), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => conflictId(baseConflict({ rulesetVersion: null })), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => directRelationshipId(baseRelation({ rulesetVersion: undefined })), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => directRelationshipId(baseRelation({ rulesetVersion: "wrong-ruleset" })), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => directRelationshipId(baseRelation({ rulesetVersion: "semantic-evidence-v2.0.0" })), /UNSUPPORTED_RULESET_VERSION/);

  // T-15 Cross-platform semantic determinism.
  const source = fs.readFileSync(path.join(repositoryRoot, "scripts", "gt63-machine", "semantic-canonical.js"), "utf8");
  assert(!source.includes("localeCompare"), "semantic canonical implementation must not use localeCompare");
  assert(!source.includes("require(\"path\")"), "semantic canonical implementation must not import path APIs");
  assert(!source.includes("path.sep"), "semantic canonical implementation must not use platform path separators");
  assert(!source.includes("Date"), "semantic canonical implementation must not use wall-clock APIs");
  assert(!source.includes("Math.random"), "semantic canonical implementation must not use randomness");

  const first = unit1SemanticOutput();
  const second = unit1SemanticOutput();
  assert.deepStrictEqual(second, first);

  runNodeCheck("scripts/gt63-machine/semantic-canonical.js");
  runNodeCheck("scripts/gt63-machine-semantic-evidence-regression.js");

  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical.json")), false);
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical-review.json")), false);

  console.log(JSON.stringify({
    status: "PASS",
    workflow: "semantic-evidence-unit-1-regression",
    trace,
    outputs: first
  }, null, 2));
}

main();
