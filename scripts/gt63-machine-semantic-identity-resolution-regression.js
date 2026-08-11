"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  RULESET_VERSION,
  classifyTargetCandidates,
  compareIdentityResolutionPair,
  hasEstablishedCrossScopeBridge,
  validateIdentityResolution,
  validateIdentityResolutions
} = require("./gt63-machine/semantic-identity-resolution");
const { compareTemporalFrameRefs } = require("./gt63-machine/semantic-temporal-frame");

const repositoryRoot = __dirname.includes(`${path.sep}scripts`)
  ? path.resolve(__dirname, "..")
  : process.cwd();

function temporalFrame(overrides = {}) {
  return {
    temporalFrameId: "time:current",
    scopeId: "scope:repo",
    frameType: "CURRENT_BASELINE",
    start: "2026-08-11T00:00:00Z",
    end: null,
    baselineRef: "baseline:main",
    evidenceRefs: ["ev:time"],
    ...overrides
  };
}

function identityResolution(overrides = {}) {
  return {
    resolutionId: "idres:a",
    scopeId: "scope:repo",
    temporalFrameRef: "time:current",
    sourceId: "artifact:source",
    adapterCoverageRef: "adapter:js",
    normalizedTargetKey: "./module.js",
    resolvedTargetId: "artifact:module-a",
    aliases: ["alias:b", "alias:a", "alias:a", "e\u0301"],
    resolutionStatus: "RESOLVED",
    crossScopeBridge: {
      fromScopeId: "scope:repo",
      toScopeId: "scope:repo",
      bridgeStatus: "NOT_BRIDGED",
      evidenceRefs: ["ev:bridge"]
    },
    evidenceRefs: ["ev:b", "ev:a", "ev:a"],
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

function main() {
  const temporalFrames = [
    temporalFrame(),
    temporalFrame({
      temporalFrameId: "time:historical",
      frameType: "HISTORICAL_INTERVAL",
      start: "2025-01-01T00:00:00Z",
      end: "2025-12-31T23:59:59Z",
      baselineRef: null
    }),
    temporalFrame({
      temporalFrameId: "time:unknown",
      frameType: "UNKNOWN_FRAME",
      start: null,
      end: null,
      baselineRef: null
    })
  ];
  const context = {
    scopeIds: new Set(["scope:repo", "scope:other"]),
    temporalFrameIds: new Set(["time:current", "time:historical", "time:unknown"]),
    adapterCoverageIds: new Set(["adapter:js"]),
    evidenceIds: new Set(["ev:a", "ev:b", "ev:bridge", "ev:time"])
  };

  const validated = validateIdentityResolution(identityResolution(), context, RULESET_VERSION).identityResolution;
  assert.deepStrictEqual(validated.aliases, ["alias:a", "alias:b", "é"]);
  assert.deepStrictEqual(validated.evidenceRefs, ["ev:a", "ev:b"]);
  assert.strictEqual(validated.resolutionStatus, "RESOLVED");

  assert.strictEqual(validateIdentityResolution(identityResolution({
    resolutionId: "idres:unresolved",
    resolvedTargetId: null,
    resolutionStatus: "UNRESOLVED"
  }), context, RULESET_VERSION).identityResolution.resolutionStatus, "UNRESOLVED");
  assert.strictEqual(validateIdentityResolution(identityResolution({
    resolutionId: "idres:ambiguous",
    resolvedTargetId: null,
    resolutionStatus: "AMBIGUOUS"
  }), context, RULESET_VERSION).identityResolution.resolutionStatus, "AMBIGUOUS");
  assert.strictEqual(validateIdentityResolution(identityResolution({
    resolutionId: "idres:contradicted",
    resolvedTargetId: null,
    resolutionStatus: "CONTRADICTED"
  }), context, RULESET_VERSION).identityResolution.resolutionStatus, "CONTRADICTED");

  assertThrowsMessage(() => validateIdentityResolution(identityResolution({ unexpected: true }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_FIELD:unexpected/);
  const missingTemporal = identityResolution();
  delete missingTemporal.temporalFrameRef;
  assertThrowsMessage(() => validateIdentityResolution(missingTemporal, context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_FIELD:temporalFrameRef/);
  assertThrowsMessage(() => validateIdentityResolution(identityResolution({ resolutionStatus: "UNKNOWN" }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:resolutionStatus/);
  assertThrowsMessage(() => validateIdentityResolution(identityResolution({
    crossScopeBridge: { ...identityResolution().crossScopeBridge, bridgeStatus: "OPEN" }
  }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:crossScopeBridge.bridgeStatus/);
  assertThrowsMessage(() => validateIdentityResolution(identityResolution({ resolvedTargetId: null }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:resolvedTargetId:requiredForResolved/);
  assertThrowsMessage(() => validateIdentityResolution(identityResolution({
    resolvedTargetId: "artifact:module-a",
    resolutionStatus: "UNRESOLVED"
  }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:resolvedTargetId:mustBeNullUnlessResolved/);
  assertThrowsMessage(() => validateIdentityResolution(identityResolution({ temporalFrameRef: "time:missing" }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:temporalFrameRef:unresolved/);
  assertThrowsMessage(() => validateIdentityResolution(identityResolution(), context, "semantic-evidence-v1.0.0"), /UNSUPPORTED_RULESET_VERSION/);

  assert.deepStrictEqual(classifyTargetCandidates([], RULESET_VERSION), {
    resolutionStatus: "UNRESOLVED",
    resolvedTargetId: null,
    targetCandidates: []
  });
  assert.deepStrictEqual(classifyTargetCandidates(["artifact:module-a"], RULESET_VERSION), {
    resolutionStatus: "RESOLVED",
    resolvedTargetId: "artifact:module-a",
    targetCandidates: ["artifact:module-a"]
  });
  assert.deepStrictEqual(classifyTargetCandidates(["artifact:module-b", "artifact:module-a", "artifact:module-a"], RULESET_VERSION), {
    resolutionStatus: "AMBIGUOUS",
    resolvedTargetId: null,
    targetCandidates: ["artifact:module-a", "artifact:module-b"]
  });

  assertThrowsExact(
    () => validateIdentityResolutions([identityResolution(), identityResolution()], context, RULESET_VERSION),
    "SCHEMA_UNSUPPORTED_VALUE:duplicateIdentityResolutionId:idres:a"
  );
  assertThrowsExact(
    () => validateIdentityResolutions([
      identityResolution({ resolutionId: "idres:b" }),
      identityResolution({ resolutionId: "idres:a" }),
      identityResolution({ resolutionId: "idres:b" }),
      identityResolution({ resolutionId: "idres:a" })
    ], context, RULESET_VERSION),
    "SCHEMA_UNSUPPORTED_VALUE:duplicateIdentityResolutionId:idres:a"
  );
  assert.strictEqual(validateIdentityResolutions([
    identityResolution({ resolutionId: "idres:b" }),
    identityResolution({ resolutionId: "idres:a" })
  ], context, RULESET_VERSION).identityResolution[0].resolutionId, "idres:a");

  const conflict = compareIdentityResolutionPair(
    identityResolution({ resolutionId: "idres:a", resolvedTargetId: "artifact:module-a", evidenceRefs: ["ev:b"] }),
    identityResolution({ resolutionId: "idres:b", resolvedTargetId: "artifact:module-b", evidenceRefs: ["ev:a"] }),
    temporalFrames,
    context,
    RULESET_VERSION
  );
  assert.strictEqual(conflict.result, "CONTRADICTED");
  assert.strictEqual(conflict.conflictRequired, true);
  assert.strictEqual(conflict.selectedTarget, null);
  assert.deepStrictEqual(conflict.conflict.semanticMembers, ["idres:a", "idres:b"]);
  assert.deepStrictEqual(conflict.conflict.evidenceRefs, ["ev:a", "ev:b"]);

  assert.strictEqual(compareIdentityResolutionPair(
    identityResolution({ resolutionId: "idres:a" }),
    identityResolution({ resolutionId: "idres:b", normalizedTargetKey: "./other.js", resolvedTargetId: "artifact:module-b" }),
    temporalFrames,
    context,
    RULESET_VERSION
  ).result, "DIFFERENT_PROPOSITION");
  assert.strictEqual(compareIdentityResolutionPair(
    identityResolution({ resolutionId: "idres:a" }),
    identityResolution({ resolutionId: "idres:b", resolvedTargetId: "artifact:module-b", temporalFrameRef: "time:historical" }),
    temporalFrames,
    context,
    RULESET_VERSION
  ).result, "NO_CONFLICT");
  assert.strictEqual(compareIdentityResolutionPair(
    identityResolution({ resolutionId: "idres:a" }),
    identityResolution({ resolutionId: "idres:b", resolvedTargetId: "artifact:module-b", temporalFrameRef: "time:unknown" }),
    temporalFrames,
    context,
    RULESET_VERSION
  ).temporalComparison, "UNKNOWN");

  assert.strictEqual(compareTemporalFrameRefs("time:current", "time:current", temporalFrames, RULESET_VERSION), "SAME_FRAME");
  assert.strictEqual(hasEstablishedCrossScopeBridge(identityResolution({
    crossScopeBridge: {
      fromScopeId: "scope:repo",
      toScopeId: "scope:other",
      bridgeStatus: "BRIDGED",
      evidenceRefs: ["ev:bridge"]
    }
  })), true);
  assert.strictEqual(hasEstablishedCrossScopeBridge(identityResolution({
    crossScopeBridge: {
      fromScopeId: "scope:repo",
      toScopeId: "scope:other",
      bridgeStatus: "NOT_BRIDGED",
      evidenceRefs: ["ev:bridge"]
    }
  })), false);

  const source = fs.readFileSync(path.join(repositoryRoot, "scripts", "gt63-machine", "semantic-identity-resolution.js"), "utf8");
  for (const forbidden of ["Date.now", "new Date(", "Date.parse", "process.cwd", "process.env", "require(\"fs\")", ".stat", "statSync", ".mtime", "require(\"os\")", "os.", "localeCompare", "Intl", "Math.random", "execFileSync"]) {
    assert(!source.includes(forbidden), `identity resolution implementation must not use ${forbidden}`);
  }
  assert(!source.includes("canonical.json"), "identity resolution implementation must not write canonical.json");
  assert(!source.includes("canonical-review.json"), "identity resolution implementation must not write canonical-review.json");

  runNodeCheck("scripts/gt63-machine/semantic-identity-resolution.js");
  runNodeCheck("scripts/gt63-machine-semantic-identity-resolution-regression.js");
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical.json")), false);
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical-review.json")), false);

  const insufficientTemporal = compareIdentityResolutionPair(
    identityResolution({ resolutionId: "idres:a" }),
    identityResolution({ resolutionId: "idres:b", temporalFrameRef: "time:missing", resolvedTargetId: "artifact:module-b" }),
    temporalFrames,
    {},
    RULESET_VERSION
  );
  const outputs = {
    aliases: validated.aliases,
    candidateResolved: classifyTargetCandidates(["artifact:module-a"], RULESET_VERSION),
    candidateAmbiguous: classifyTargetCandidates(["artifact:module-b", "artifact:module-a"], RULESET_VERSION),
    conflictResult: conflict.result,
    conflictMembers: conflict.conflict.semanticMembers,
    conflictEvidenceRefs: conflict.conflict.evidenceRefs,
    insufficientTemporal: insufficientTemporal.temporalComparison
  };
  const output = {
    status: "PASS",
    workflow: "semantic-evidence-unit-4-identity-resolution-regression",
    trace: {
      rulesetVersion: RULESET_VERSION,
      derivationRuleId: "SE-V1-UNIT-4",
      fixtureId: "unit4-identity-resolution"
    },
    outputs: {
      outputHash: crypto.createHash("sha256").update(JSON.stringify(outputs)).digest("hex"),
      ...outputs
    }
  };
  console.log(JSON.stringify(output, null, 2));
}

main();
