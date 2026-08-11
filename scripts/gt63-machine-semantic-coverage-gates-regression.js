"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  RULESET_VERSION,
  absentFromCaptureGate,
  notConnectedGate,
  notExecutableGate,
  notReachableGate,
  validateAdapterCoverage,
  validateCaptureCompleteness
} = require("./gt63-machine/semantic-coverage-gates");

const repositoryRoot = __dirname.includes(`${path.sep}scripts`)
  ? path.resolve(__dirname, "..")
  : process.cwd();

const context = {
  scopeIds: new Set(["scope:repo"]),
  evidenceIds: new Set(["ev:scan", "ev:extract", "ev:map", "ev:adapter"])
};

function completeness(overrides = {}) {
  return {
    scopeId: "scope:repo",
    enumeration: "COMPLETE",
    contentInspection: "COMPLETE",
    relationshipInspection: "COMPLETE",
    entrypointInventory: "COMPLETE",
    dependencyResolution: "COMPLETE",
    executionEvidenceInspection: "NOT_APPLICABLE",
    gitInspection: "NOT_APPLICABLE",
    declaredBy: "repository-scanner",
    provenanceRefs: ["ev:scan"],
    completenessRuleId: "SE-V1-COMP-scan",
    ...overrides
  };
}

function adapter(overrides = {}) {
  return {
    adapterId: "adapter:js",
    adapterVersion: "1.0.0",
    scopeId: "scope:repo",
    artifactFamily: "EXECUTABLE_SOURCE",
    supportedLanguageOrFormat: "javascript",
    relationExtraction: "COMPLETE",
    dependencyResolution: "COMPLETE",
    entrypointDiscovery: "COMPLETE",
    mandatoryPrerequisiteModel: "COMPLETE",
    dynamicResolution: "UNSUPPORTED",
    targetNormalizationPolicy: {
      whitespace: "TRIM_SURROUNDING",
      caseSensitivity: "CASE_SENSITIVE",
      pathNormalization: "SLASH_DOT_SEGMENTS"
    },
    coverageStatus: "COMPLETE",
    evidenceRefs: ["ev:adapter"],
    ...overrides
  };
}

function assertThrowsMessage(fn, pattern) {
  assert.throws(fn, (error) => pattern.test(error.message));
}

function runNodeCheck(filePath) {
  const run = childProcess.spawnSync(process.execPath, ["--check", filePath], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  assert.strictEqual(run.status, 0, run.stderr || run.stdout);
}

function main() {
  const scan = validateCaptureCompleteness(completeness(), context, RULESET_VERSION);
  assert.strictEqual(scan.usableDimensions.enumeration, "COMPLETE");
  assert.strictEqual(scan.usableDimensions.gitInspection, "NOT_APPLICABLE");
  assert.strictEqual(scan.usableDimensions.contentInspection, "UNKNOWN");

  const extract = validateCaptureCompleteness(completeness({
    declaredBy: "evidence-extractor",
    provenanceRefs: ["ev:extract"],
    completenessRuleId: "SE-V1-COMP-extract"
  }), context, RULESET_VERSION);
  assert.strictEqual(extract.usableDimensions.contentInspection, "COMPLETE");
  assert.strictEqual(extract.usableDimensions.enumeration, "UNKNOWN");

  const map = validateCaptureCompleteness(completeness({
    declaredBy: "relationship-mapper",
    provenanceRefs: ["ev:map"],
    completenessRuleId: "SE-V1-COMP-map"
  }), context, RULESET_VERSION);
  assert.strictEqual(map.usableDimensions.relationshipInspection, "COMPLETE");
  assert.strictEqual(map.usableDimensions.dependencyResolution, "COMPLETE");
  assert.strictEqual(map.usableDimensions.enumeration, "UNKNOWN");

  const missingEvidence = validateCaptureCompleteness(completeness({ provenanceRefs: ["ev:missing"] }), context, RULESET_VERSION);
  assert.strictEqual(missingEvidence.usableDimensions.enumeration, "UNKNOWN");
  assert.strictEqual(missingEvidence.invalidDerivationRuleId, "SE-V1-COMP-INVALID");

  const invalidScope = validateCaptureCompleteness(completeness({ scopeId: "scope:missing" }), context, RULESET_VERSION);
  assert.strictEqual(invalidScope.usableDimensions.enumeration, "UNKNOWN");

  assertThrowsMessage(() => validateCaptureCompleteness(completeness({ extra: true }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_FIELD:captureCompleteness.extra/);
  assertThrowsMessage(() => validateCaptureCompleteness(completeness({ declaredBy: "semantic-evidence-resolver" }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:declaredBy/);
  assertThrowsMessage(() => validateCaptureCompleteness(completeness({ enumeration: "CLOSED" }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:enumeration/);
  assertThrowsMessage(() => validateCaptureCompleteness(completeness({ entrypointInventory: "COMPLETE" }), context, "semantic-evidence-v1.0.0"), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => validateCaptureCompleteness(completeness({ provenanceRefs: [] }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:provenanceRefs/);

  const adapterResult = validateAdapterCoverage(adapter(), context, RULESET_VERSION);
  assert.strictEqual(adapterResult.adapterCoverage.coverageStatus, "COMPLETE");
  assert.strictEqual(adapterResult.adapterCoverage.dynamicResolution, "UNSUPPORTED");
  assertThrowsMessage(() => validateAdapterCoverage(adapter({ extra: true }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_FIELD:adapterCoverage.extra/);
  assertThrowsMessage(() => validateAdapterCoverage(adapter({ artifactFamily: "PRODUCT" }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:artifactFamily/);
  assertThrowsMessage(() => validateAdapterCoverage(adapter({ dynamicResolution: "AUTO_DISCOVER" }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:dynamicResolution/);
  assertThrowsMessage(() => validateAdapterCoverage(adapter({
    targetNormalizationPolicy: { whitespace: "TRIM_SURROUNDING", caseSensitivity: "CASE_SENSITIVE" }
  }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_FIELD:pathNormalization/);
  assertThrowsMessage(() => validateAdapterCoverage(adapter({ evidenceRefs: ["ev:missing"] }), context, RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:evidenceRefs:unresolved/);

  assert.strictEqual(absentFromCaptureGate(scan, true), "ALLOWED");
  assert.strictEqual(absentFromCaptureGate(missingEvidence, true), "UNKNOWN");
  assert.strictEqual(absentFromCaptureGate(scan, false), "UNKNOWN");
  assert.strictEqual(notConnectedGate(map, true), "ALLOWED");
  assert.strictEqual(notConnectedGate(scan, true), "UNKNOWN");
  const reachableGate = {
    usableDimensions: {
      entrypointInventory: "COMPLETE",
      relationshipInspection: "COMPLETE",
      dependencyResolution: "COMPLETE"
    }
  };
  assert.strictEqual(notReachableGate(reachableGate, true), "ALLOWED");
  assert.strictEqual(notReachableGate(scan, true), "UNKNOWN");
  assert.strictEqual(notExecutableGate(map, adapterResult, true), "UNKNOWN");
  const scannerClosed = validateCaptureCompleteness(completeness({
    dependencyResolution: "COMPLETE",
    declaredBy: "repository-scanner"
  }), context, RULESET_VERSION);
  const mapperClosed = validateCaptureCompleteness(completeness({
    declaredBy: "relationship-mapper",
    provenanceRefs: ["ev:map"],
    completenessRuleId: "SE-V1-COMP-map"
  }), context, RULESET_VERSION);
  assert.strictEqual(notExecutableGate(scannerClosed, adapterResult, true), "UNKNOWN");
  assert.strictEqual(notExecutableGate(mapperClosed, adapterResult, true), "UNKNOWN");
  const executableGate = {
    usableDimensions: {
      enumeration: "COMPLETE",
      dependencyResolution: "COMPLETE"
    }
  };
  assert.strictEqual(notExecutableGate(executableGate, adapterResult, true), "ALLOWED");
  assert.strictEqual(notExecutableGate(executableGate, validateAdapterCoverage(adapter({ coverageStatus: "PARTIAL" }), context, RULESET_VERSION), true), "UNKNOWN");

  const source = fs.readFileSync(path.join(repositoryRoot, "scripts", "gt63-machine", "semantic-coverage-gates.js"), "utf8");
  for (const forbidden of ["Date.now", "new Date(", "Date.parse", "process.cwd", "process.env", "require(\"fs\")", ".stat", "statSync", ".mtime", "require(\"os\")", "os.", "localeCompare", "Intl", "Math.random", "execFileSync"]) {
    assert(!source.includes(forbidden), `coverage gates implementation must not use ${forbidden}`);
  }
  for (const forbiddenAuthority of ["CANONICAL", "ACCEPTED", "AUTHORIZED", "GOVERNING", "APPROVED_PRODUCT_TRUTH"]) {
    assert(!source.includes(`\"${forbiddenAuthority}\"`), `coverage gates implementation must not emit ${forbiddenAuthority}`);
  }
  assert(!source.includes("canonical.json"), "coverage gates implementation must not write canonical.json");
  assert(!source.includes("canonical-review.json"), "coverage gates implementation must not write canonical-review.json");

  runNodeCheck("scripts/gt63-machine/semantic-coverage-gates.js");
  runNodeCheck("scripts/gt63-machine-semantic-coverage-gates-regression.js");
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical.json")), false);
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical-review.json")), false);

  const outputs = {
    scannerEnumeration: scan.usableDimensions.enumeration,
    extractorContent: extract.usableDimensions.contentInspection,
    mapperRelationship: map.usableDimensions.relationshipInspection,
    invalidProvenanceEnumeration: missingEvidence.usableDimensions.enumeration,
    adapterCoverage: adapterResult.adapterCoverage.coverageStatus,
    absentAllowed: absentFromCaptureGate(scan, true),
    absentUnknown: absentFromCaptureGate(missingEvidence, true),
    notConnectedUnknown: notConnectedGate(scan, true),
    notReachableUnknown: notReachableGate(scan, true),
    notExecutableUnknown: notExecutableGate(map, adapterResult, true)
  };
  const output = {
    status: "PASS",
    workflow: "semantic-evidence-coverage-gates-regression",
    trace: {
      rulesetVersion: RULESET_VERSION,
      derivationRuleId: "SE-V1-COVERAGE-GATES",
      fixtureId: "coverage-gates"
    },
    outputs: {
      outputHash: crypto.createHash("sha256").update(JSON.stringify(outputs)).digest("hex"),
      ...outputs
    }
  };
  console.log(JSON.stringify(output, null, 2));
}

main();
