"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  RULESET_VERSION,
  assessArtifactIdentity,
  selectObservedIdentity,
  validateArtifactClassification
} = require("./gt63-machine/semantic-artifact-identity");

const repositoryRoot = __dirname.includes(`${path.sep}scripts`)
  ? path.resolve(__dirname, "..")
  : process.cwd();

function declaredIdentity(overrides = {}) {
  return {
    declaredType: "JSON",
    declaredMime: "application/json",
    extension: ".json",
    filenameLabel: "config",
    evidenceRefs: ["ev:declared"],
    ...overrides
  };
}

function observedIdentity(overrides = {}) {
  return {
    observedType: "JSON",
    observationKind: "VALIDATED_PARSER",
    parserId: "adapter:json",
    parserVersion: "1.0.0",
    observationStatus: "OBSERVED",
    evidenceRefs: ["ev:observed"],
    ...overrides
  };
}

function artifactClassification(overrides = {}) {
  return {
    artifactId: "artifact:config",
    scopeId: "scope:repo",
    declaredIdentity: declaredIdentity(),
    observedIdentity: observedIdentity(),
    classification: "CONFIGURATION",
    evidenceRefs: ["ev:artifact"],
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
  const match = assessArtifactIdentity(artifactClassification(), {}, RULESET_VERSION);
  assert.strictEqual(match.identityAlignment, "MATCH");
  assert.strictEqual(match.semanticState, "ESTABLISHED");
  assert.deepStrictEqual(match.evidenceRefs, ["ev:artifact", "ev:declared", "ev:observed"]);

  const mismatch = assessArtifactIdentity(artifactClassification({
    observedIdentity: observedIdentity({ observedType: "HTML" })
  }), {}, RULESET_VERSION);
  assert.strictEqual(mismatch.identityAlignment, "MISMATCH");
  assert.strictEqual(mismatch.declaredIdentity.declaredType, "JSON");
  assert.strictEqual(mismatch.observedIdentity.observedType, "HTML");

  const unknown = assessArtifactIdentity(artifactClassification({
    observedIdentity: observedIdentity({
      observedType: null,
      observationStatus: "UNKNOWN",
      evidenceRefs: ["ev:unknown"]
    })
  }), {}, RULESET_VERSION);
  assert.strictEqual(unknown.identityAlignment, "UNKNOWN");
  assert.strictEqual(unknown.semanticState, "UNKNOWN");

  const parseFailed = assessArtifactIdentity(artifactClassification({
    observedIdentity: observedIdentity({
      observedType: "HTML",
      observationStatus: "PARSE_FAILED",
      evidenceRefs: ["ev:parse-failed"]
    })
  }), {
    observedIdentityCandidates: [
      observedIdentity({
        observedType: "HTML",
        observationStatus: "PARSE_FAILED",
        evidenceRefs: ["ev:parse-failed"]
      }),
      observedIdentity({
        observedType: "JSON",
        observationKind: "MAGIC_BYTES",
        parserId: null,
        parserVersion: null,
        evidenceRefs: ["ev:magic"]
      })
    ]
  }, RULESET_VERSION);
  assert.strictEqual(parseFailed.identityAlignment, "MATCH");
  assert.strictEqual(parseFailed.observedIdentity.observedType, "JSON");
  assert.deepStrictEqual(parseFailed.observedIdentity.evidenceRefs, ["ev:magic"]);

  const precedence = assessArtifactIdentity(artifactClassification(), {
    observedIdentityCandidates: [
      observedIdentity({
        observedType: "TEXT",
        observationKind: "EXTENSION",
        parserId: null,
        parserVersion: null,
        evidenceRefs: ["ev:extension"]
      }),
      observedIdentity({
        observedType: "JSON",
        observationKind: "VALIDATED_PARSER",
        evidenceRefs: ["ev:parser"]
      })
    ]
  }, RULESET_VERSION);
  assert.strictEqual(precedence.identityAlignment, "MATCH");
  assert.strictEqual(precedence.observedIdentity.observationKind, "VALIDATED_PARSER");

  const conflict = assessArtifactIdentity(artifactClassification(), {
    observedIdentityCandidates: [
      observedIdentity({
        observedType: "HTML",
        observationKind: "VALIDATED_PARSER",
        evidenceRefs: ["ev:b"]
      }),
      observedIdentity({
        observedType: "JSON",
        observationKind: "VALIDATED_PARSER",
        evidenceRefs: ["ev:a"]
      })
    ]
  }, RULESET_VERSION);
  assert.strictEqual(conflict.identityAlignment, "UNKNOWN");
  assert.strictEqual(conflict.observedIdentity.observationStatus, "CONFLICTING");
  assert.strictEqual(conflict.observedIdentity.observedType, null);
  assert(conflict.conflict.conflictId.startsWith("conflict:"));
  assert.deepStrictEqual(conflict.conflict.evidenceRefs, ["ev:a", "ev:b"]);

  const conflictReordered = assessArtifactIdentity(artifactClassification(), {
    observedIdentityCandidates: [
      observedIdentity({
        observedType: "JSON",
        observationKind: "VALIDATED_PARSER",
        evidenceRefs: ["ev:a", "ev:a"]
      }),
      observedIdentity({
        observedType: "HTML",
        observationKind: "VALIDATED_PARSER",
        evidenceRefs: ["ev:b"]
      })
    ]
  }, RULESET_VERSION);
  assert.strictEqual(conflict.conflict.conflictId, conflictReordered.conflict.conflictId);

  const selected = selectObservedIdentity([
    observedIdentity({ observedType: "HTML", observationKind: "EXTENSION", parserId: null, parserVersion: null }),
    observedIdentity({ observedType: "JSON", observationKind: "MAGIC_BYTES", parserId: null, parserVersion: null })
  ], validateArtifactClassification(artifactClassification(), RULESET_VERSION).artifactClassification, RULESET_VERSION);
  assert.strictEqual(selected.observedIdentity.observationKind, "MAGIC_BYTES");

  assertThrowsMessage(() => validateArtifactClassification(artifactClassification({ unsupported: true }), RULESET_VERSION), /SCHEMA_UNSUPPORTED_FIELD:artifactClassification.unsupported/);
  assertThrowsMessage(() => validateArtifactClassification(artifactClassification({ classification: "PRODUCT_TRUTH" }), RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:classification/);
  assertThrowsMessage(() => validateArtifactClassification(artifactClassification({
    observedIdentity: observedIdentity({ observationKind: "MODEL_GUESS" })
  }), RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:observedIdentity.observationKind/);
  assertThrowsMessage(() => validateArtifactClassification(artifactClassification({
    observedIdentity: observedIdentity({ observationStatus: "AUTHORIZED" })
  }), RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:observedIdentity.observationStatus/);
  assertThrowsMessage(() => validateArtifactClassification(artifactClassification({
    observedIdentity: observedIdentity({ observedType: null })
  }), RULESET_VERSION), /SCHEMA_UNSUPPORTED_VALUE:observedIdentity.observedType:requiredForObserved/);
  assertThrowsMessage(() => validateArtifactClassification(artifactClassification(), "semantic-evidence-v1.0.0"), /UNSUPPORTED_RULESET_VERSION/);

  const source = fs.readFileSync(path.join(repositoryRoot, "scripts", "gt63-machine", "semantic-artifact-identity.js"), "utf8");
  for (const forbidden of ["Date.now", "new Date(", "Date.parse", "process.cwd", "process.env", "require(\"fs\")", ".stat", "statSync", ".mtime", "require(\"os\")", "os.", "localeCompare", "Intl", "Math.random", "execFileSync"]) {
    assert(!source.includes(forbidden), `artifact identity implementation must not use ${forbidden}`);
  }
  for (const forbiddenAuthority of ["CANONICAL", "ACCEPTED", "AUTHORIZED", "GOVERNING", "APPROVED_PRODUCT_TRUTH"]) {
    assert(!source.includes(`\"${forbiddenAuthority}\"`), `artifact identity implementation must not emit ${forbiddenAuthority}`);
  }
  assert(!source.includes("canonical.json"), "artifact identity implementation must not write canonical.json");
  assert(!source.includes("canonical-review.json"), "artifact identity implementation must not write canonical-review.json");

  runNodeCheck("scripts/gt63-machine/semantic-artifact-identity.js");
  runNodeCheck("scripts/gt63-machine-semantic-artifact-identity-regression.js");
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical.json")), false);
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical-review.json")), false);

  const outputs = {
    match: match.identityAlignment,
    mismatch: mismatch.identityAlignment,
    unknown: unknown.identityAlignment,
    precedence: precedence.observedIdentity.observationKind,
    conflictStatus: conflict.observedIdentity.observationStatus,
    conflictId: conflict.conflict.conflictId,
    parseFailedSelected: parseFailed.observedIdentity.observedType
  };
  const output = {
    status: "PASS",
    workflow: "semantic-evidence-artifact-identity-regression",
    trace: {
      rulesetVersion: RULESET_VERSION,
      derivationRuleId: "SE-V1-ARTIFACT-IDENTITY",
      fixtureId: "artifact-identity-assessment"
    },
    outputs: {
      outputHash: crypto.createHash("sha256").update(JSON.stringify(outputs)).digest("hex"),
      ...outputs
    }
  };
  console.log(JSON.stringify(output, null, 2));
}

main();
