"use strict";

const assert = require("assert");
const crypto = require("crypto");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const runtime = require("./gt63-machine/runtime-execution-observation");

const ROOT = path.resolve(__dirname, "..");
const R = runtime.RULESET_VERSION;
const evidence = (overrides = {}) => ({
  observed: false, subjectBound: true, frameBound: true,
  provenanceValid: true, sourceTrusted: true, ...overrides
});
const frame = (overrides = {}) => ({
  status: "CLOSED", identityResolved: true, boundsValid: true,
  clockCorrelationValid: true, ...overrides
});
const coverage = (overrides = {}) => ({
  status: "COMPLETE", provenanceValid: true, allSupportedExecutionPathsCovered: true,
  enumerationComplete: true, instrumentationAvailable: true,
  unsupportedDynamicPath: false, ...overrides
});
const input = (overrides = {}) => ({
  rulesetVersion: R,
  provenanceScope: "scope:runtime",
  temporalFrameRef: "time:2026-08-28",
  observationFrameRef: "frame:001",
  executionSubjectRef: "subject:001",
  artifactIdentityRef: "artifact:sha256:001",
  configurationIdentityRef: "config:sha256:001",
  dependencyAssessmentRef: "sem:dependency:001",
  entrypointIdentityRef: "entrypoint:001",
  invocationIdentityRef: "invocation:001",
  instrumentationIdentity: "instrumentation:test",
  instrumentationRevision: "1",
  evidenceRefs: ["ev:coverage", "ev:runtime"],
  subjectIdentityResolved: true,
  observationFrame: frame(),
  instrumentationCoverage: coverage(),
  invocationEvidence: evidence(),
  startEvidence: evidence(),
  terminationEvidence: evidence(),
  terminationClass: "NOT_APPLICABLE",
  contradictionStatus: "NONE",
  ...overrides
});

function states(result) {
  return Object.fromEntries(result.observationStates.map((item) => [item.dimension, item.observationState]));
}

function throws(fn, pattern) {
  assert.throws(fn, (error) => pattern.test(error.message));
}

function syntaxCheck(file) {
  const result = childProcess.spawnSync(process.execPath, ["--check", file], { cwd: ROOT, encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
}

function main() {
  const cases = [];
  const ok = (name, fn) => { fn(); cases.push(name); };

  ok("ruleset-binding", () => {
    assert.strictEqual(R, "semantic-evidence-v1.0.1");
    for (const value of [undefined, "semantic-evidence-v1.0.0", "semantic-evidence-v1.0.2", "semantic-evidence-v2.0.0"]) {
      throws(() => runtime.assessRuntimeExecutionObservation(input({ rulesetVersion: value })), /UNSUPPORTED_RULESET_VERSION/);
    }
  });
  ok("start-positive-proves-execution", () => {
    const result = runtime.assessRuntimeExecutionObservation(input({ startEvidence: evidence({ observed: true }) }));
    assert.strictEqual(states(result).EXECUTION_START, "OBSERVED");
    assert.strictEqual(states(result).EXECUTION, "EXECUTION_OBSERVED");
  });
  ok("termination-positive-proves-execution-without-fabricating-start", () => {
    const result = runtime.assessRuntimeExecutionObservation(input({
      observationFrame: frame({ status: "OPEN" }),
      terminationEvidence: evidence({ observed: true }), terminationClass: "EXITED"
    }));
    assert.strictEqual(states(result).EXECUTION_START, "UNKNOWN");
    assert.strictEqual(states(result).TERMINATION, "OBSERVED");
    assert.strictEqual(states(result).EXECUTION, "EXECUTION_OBSERVED");
    assert.strictEqual(result.terminationClass, "EXITED");
  });
  ok("complete-frame-negative", () => {
    const result = runtime.assessRuntimeExecutionObservation(input());
    assert.deepStrictEqual(states(result), {
      INVOCATION: "NOT_OBSERVED", EXECUTION_START: "NOT_OBSERVED",
      TERMINATION: "NOT_APPLICABLE", EXECUTION: "NOT_EXECUTED_IN_OBSERVATION_FRAME"
    });
  });
  for (const [name, patch] of [
    ["partial-coverage", { instrumentationCoverage: coverage({ status: "PARTIAL" }) }],
    ["invalid-coverage-provenance", { instrumentationCoverage: coverage({ provenanceValid: false }) }],
    ["instrumentation-outage", { instrumentationCoverage: coverage({ instrumentationAvailable: false }) }],
    ["incomplete-enumeration", { instrumentationCoverage: coverage({ enumerationComplete: false }) }],
    ["unsupported-dynamic-path", { instrumentationCoverage: coverage({ unsupportedDynamicPath: true }) }],
    ["open-frame", { observationFrame: frame({ status: "OPEN" }) }],
    ["invalid-frame-bounds", { observationFrame: frame({ boundsValid: false }) }],
    ["invalid-clock-correlation", { observationFrame: frame({ clockCorrelationValid: false }) }],
    ["unresolved-subject", { subjectIdentityResolved: false }]
  ]) ok(`${name}-preserves-unknown`, () => {
    assert.strictEqual(states(runtime.assessRuntimeExecutionObservation(input(patch))).EXECUTION, "UNKNOWN");
  });
  ok("untrusted-positive-unknown", () => {
    const result = runtime.assessRuntimeExecutionObservation(input({
      observationFrame: frame({ status: "OPEN" }), startEvidence: evidence({ observed: true, sourceTrusted: false })
    }));
    assert.strictEqual(states(result).EXECUTION, "UNKNOWN");
  });
  ok("invalid-positive-provenance-unknown", () => {
    const result = runtime.assessRuntimeExecutionObservation(input({
      observationFrame: frame({ status: "OPEN" }), startEvidence: evidence({ observed: true, provenanceValid: false })
    }));
    assert.strictEqual(states(result).EXECUTION, "UNKNOWN");
  });
  ok("unbound-positive-unknown", () => {
    const result = runtime.assessRuntimeExecutionObservation(input({
      observationFrame: frame({ status: "OPEN" }), startEvidence: evidence({ observed: true, subjectBound: false })
    }));
    assert.strictEqual(states(result).EXECUTION, "UNKNOWN");
  });
  ok("out-of-frame-positive-unknown", () => {
    const result = runtime.assessRuntimeExecutionObservation(input({
      observationFrame: frame({ status: "OPEN" }), startEvidence: evidence({ observed: true, frameBound: false })
    }));
    assert.strictEqual(states(result).EXECUTION, "UNKNOWN");
  });
  ok("contradiction-preserved-as-unknown", () => {
    const result = runtime.assessRuntimeExecutionObservation(input({
      contradictionStatus: "CONTRADICTORY_EVIDENCE", startEvidence: evidence({ observed: true })
    }));
    assert.strictEqual(states(result).EXECUTION, "UNKNOWN");
    assert.strictEqual(result.contradictionStatus, "CONTRADICTORY_EVIDENCE");
  });
  ok("invocation-alone-does-not-prove-execution", () => {
    const result = runtime.assessRuntimeExecutionObservation(input({
      observationFrame: frame({ status: "OPEN" }), invocationEvidence: evidence({ observed: true })
    }));
    assert.strictEqual(states(result).INVOCATION, "OBSERVED");
    assert.strictEqual(states(result).EXECUTION, "UNKNOWN");
  });
  for (const terminationClass of ["EXITED", "SIGNALED", "TIMED_OUT", "CANCELLED", "CRASHED", "PROVIDER_TERMINATED", "UNKNOWN_TERMINATION_CLASS"]) {
    ok(`termination-${terminationClass}`, () => {
      const result = runtime.assessRuntimeExecutionObservation(input({
        terminationEvidence: evidence({ observed: true }), terminationClass
      }));
      assert.strictEqual(result.terminationClass, terminationClass);
      assert.strictEqual(states(result).EXECUTION, "EXECUTION_OBSERVED");
    });
  }
  ok("authority-none", () => {
    const result = runtime.assessRuntimeExecutionObservation(input({ startEvidence: evidence({ observed: true }) }));
    assert.strictEqual(result.authority, "NONE");
    for (const forbidden of ["AUTHORIZED", "EFFECT_CONFIRMED", "RESULT_ACCEPTED", "COMPLETED", "SUCCESS", "RETRY_ALLOWED"]) {
      assert(!JSON.stringify(result).includes(forbidden));
    }
  });
  ok("deterministic-evidence-set", () => {
    const left = runtime.assessRuntimeExecutionObservation(input({ evidenceRefs: ["ev:runtime", "ev:coverage", "ev:runtime"] }));
    const right = runtime.assessRuntimeExecutionObservation(input());
    assert.deepStrictEqual(left, right);
  });
  ok("material-binding-changes-identity", () => {
    const left = runtime.assessRuntimeExecutionObservation(input());
    const right = runtime.assessRuntimeExecutionObservation(input({ artifactIdentityRef: "artifact:sha256:002" }));
    assert.notStrictEqual(left.observationStates[0].statementId, right.observationStates[0].statementId);
  });
  ok("unicode-nfc-determinism", () => {
    const composed = runtime.assessRuntimeExecutionObservation(input({ provenanceScope: "scope:caf\u00e9" }));
    const decomposed = runtime.assessRuntimeExecutionObservation(input({ provenanceScope: "scope:cafe\u0301" }));
    assert.deepStrictEqual(composed.observationStates.map((item) => item.statementId), decomposed.observationStates.map((item) => item.statementId));
  });
  ok("schema-extra-field-fails-closed", () => throws(
    () => runtime.assessRuntimeExecutionObservation({ ...input(), extra: true }), /SCHEMA_UNSUPPORTED_FIELD:extra/
  ));
  ok("schema-wrong-type-fails-closed", () => throws(
    () => runtime.assessRuntimeExecutionObservation(input({ subjectIdentityResolved: "true" })), /SCHEMA_UNSUPPORTED_VALUE:subjectIdentityResolved/
  ));
  ok("schema-invalid-enum-fails-closed", () => throws(
    () => runtime.assessRuntimeExecutionObservation(input({ terminationClass: "SUCCESS" })), /SCHEMA_UNSUPPORTED_VALUE:terminationClass/
  ));
  ok("source-isolation-audit", () => {
    const source = fs.readFileSync(path.join(ROOT, "scripts/gt63-machine/runtime-execution-observation.js"), "utf8");
    for (const forbidden of [
      "require(\"fs\")", "require('fs')", "require(\"path\")", "require('path')",
      "process.cwd", "process.env", "Date.", "new Date", "performance.now", "Math.random",
      "localeCompare", "Intl", "child_process", "execSync", "execFile", "spawn", "git "
    ]) assert(!source.includes(forbidden), `forbidden:${forbidden}`);
  });
  ok("syntax-checks", () => {
    syntaxCheck("scripts/gt63-machine/runtime-execution-observation.js");
    syntaxCheck("scripts/gt63-machine-runtime-execution-observation-regression.js");
  });

  const sample = runtime.assessRuntimeExecutionObservation(input({ startEvidence: evidence({ observed: true }) }));
  const semantic = {
    cases,
    states: sample.observationStates.map((item) => `${item.dimension}:${item.observationState}`),
    statementIds: sample.observationStates.map((item) => item.statementId),
    rulesetVersion: R,
    authority: sample.authority
  };
  const identity = crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
  process.stdout.write(`${JSON.stringify({
    status: "PASS", workflow: "semantic-evidence-runtime-execution-observation-v0-regression",
    cases: cases.length, validationIdentity: identity, outputHash: identity, semantic
  })}\n`);
}

main();
