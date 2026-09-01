"use strict";

const assert = require("assert");
const crypto = require("crypto");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const output = require("./gt63-machine/runtime-result-output-observation");

const ROOT = path.resolve(__dirname, "..");
const R = output.RULESET_VERSION;
const presence = (overrides = {}) => ({
  observed: false, materiallyPresent: false, recognizedEmptyRepresentation: false,
  correlated: true, frameBound: true, provenanceValid: true, sourceTrusted: true,
  ...overrides
});
const frame = (overrides = {}) => ({
  status: "CLOSED", identityResolved: true, boundsValid: true,
  clockCorrelationValid: true, ...overrides
});
const coverage = (overrides = {}) => ({
  status: "COMPLETE", provenanceValid: true, allApplicableSurfacesCovered: true,
  enumerationComplete: true, instrumentationAvailable: true,
  unsupportedDynamicOutputPath: false, unresolvedCorrelationFrontier: false,
  ...overrides
});
const fragments = (overrides = {}) => ({
  status: "NOT_APPLICABLE", provenanceValid: true, sequenceValid: true,
  streamClosed: true, revision: 0, digest: "sha256:fragment-none", ...overrides
});
const integrity = (overrides = {}) => ({ status: "VERIFIED", provenanceValid: true, ...overrides });
const grammar = (overrides = {}) => ({
  status: "PARSEABLE", bindingValid: true, applicabilityEstablished: true, ...overrides
});
const input = (overrides = {}) => ({
  rulesetVersion: R,
  provenanceScope: "scope:runtime-output",
  temporalFrameRef: "time:current",
  observationFrameRef: "frame:output:001",
  executionObservationRef: "sem:execution:001",
  executionSubjectRef: "subject:001",
  executionStartRef: "start:001",
  executionInvocationRef: "invocation:001",
  artifactIdentityRef: "artifact:sha256:001",
  configurationIdentityRef: "configuration:001",
  inputIdentityRef: "input:sha256:001",
  outputSurfaceIdentity: "surface:test",
  outputSurfaceRevision: "1",
  outputChannel: "DIRECT_RETURN",
  expectedResultGrammarRef: "grammar:test",
  expectedResultGrammarRevision: "1",
  evidenceRefs: ["ev:capture", "ev:output"],
  subjectIdentityResolved: true,
  observationFrame: frame(),
  captureCoverage: coverage(),
  fragmentSet: fragments(),
  presenceEvidence: presence(),
  integrityEvidence: integrity(),
  grammarAssessment: grammar(),
  contradictionStatus: "NONE",
  ...overrides
});

function states(result) {
  return Object.fromEntries(result.observationStates.map((item) => [item.dimension, item.observationState]));
}
function throws(fn, pattern) { assert.throws(fn, (error) => pattern.test(error.message)); }
function check(file) {
  const result = childProcess.spawnSync(process.execPath, ["--check", file], { cwd: ROOT, encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
}

function main() {
  const cases = [];
  const ok = (name, fn) => { fn(); cases.push(name); };

  ok("ruleset-binding", () => {
    assert.strictEqual(R, "semantic-evidence-v1.0.1");
    for (const value of [undefined, "semantic-evidence-v1.0.0", "semantic-evidence-v1.0.2", "semantic-evidence-v2.0.0"]) {
      throws(() => output.assessRuntimeResultOutputObservation(input({ rulesetVersion: value })), /UNSUPPORTED_RULESET_VERSION/);
    }
  });
  for (const channel of [
    "DIRECT_RETURN", "STRUCTURED_PROVIDER_RESPONSE", "STDOUT", "STDERR", "RUNTIME_EVENT",
    "TRACE_PAYLOAD", "ARTIFACT", "MESSAGE_RESPONSE", "CALLBACK_PAYLOAD", "MULTI_FRAGMENT_STREAM"
  ]) ok(`presence-positive-${channel}`, () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      outputChannel: channel, presenceEvidence: presence({ observed: true, materiallyPresent: true })
    }));
    assert.strictEqual(states(result).PRESENCE, "RESULT_OUTPUT_OBSERVED");
    assert.strictEqual(states(result).RESULT_OUTPUT, "RESULT_OUTPUT_EVIDENCE_OBSERVED");
  });
  ok("complete-frame-negative", () => {
    const result = output.assessRuntimeResultOutputObservation(input());
    assert.strictEqual(states(result).PRESENCE, "NO_RESULT_OUTPUT_OBSERVED_IN_COMPLETE_FRAME");
    assert.strictEqual(states(result).RESULT_OUTPUT, "NO_RESULT_OUTPUT_EVIDENCE_IN_COMPLETE_FRAME");
  });
  ok("legitimate-empty-result-positive", () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      presenceEvidence: presence({ observed: true, recognizedEmptyRepresentation: true })
    }));
    assert.strictEqual(states(result).RESULT_OUTPUT, "RESULT_OUTPUT_EVIDENCE_OBSERVED");
  });
  ok("unrecognized-empty-does-not-prove-presence", () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      observationFrame: frame({ status: "OPEN" }), presenceEvidence: presence({ observed: true })
    }));
    assert.strictEqual(states(result).RESULT_OUTPUT, "UNKNOWN");
  });
  ok("unparseable-output-still-proves-presence", () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      presenceEvidence: presence({ observed: true, materiallyPresent: true }),
      grammarAssessment: grammar({ status: "UNPARSEABLE" })
    }));
    assert.strictEqual(states(result).GRAMMAR, "UNPARSEABLE_UNDER_BOUND_GRAMMAR");
    assert.strictEqual(states(result).RESULT_OUTPUT, "RESULT_OUTPUT_EVIDENCE_OBSERVED");
  });
  ok("unsupported-grammar-still-proves-physical-presence", () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      presenceEvidence: presence({ observed: true, materiallyPresent: true }),
      grammarAssessment: grammar({ status: "UNSUPPORTED", bindingValid: false })
    }));
    assert.strictEqual(states(result).GRAMMAR, "GRAMMAR_UNSUPPORTED");
    assert.strictEqual(states(result).RESULT_OUTPUT, "RESULT_OUTPUT_EVIDENCE_OBSERVED");
  });
  ok("partial-output-proves-presence-not-completeness", () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      presenceEvidence: presence({ observed: true, materiallyPresent: true }),
      captureCoverage: coverage({ status: "PARTIAL" }),
      fragmentSet: fragments({ status: "PARTIAL", revision: 2, digest: "sha256:partial" })
    }));
    assert.strictEqual(states(result).CAPTURE_COMPLETENESS, "CAPTURE_PARTIAL");
    assert.strictEqual(states(result).FRAGMENT_SET, "FRAGMENT_SET_PARTIAL");
    assert.strictEqual(states(result).RESULT_OUTPUT, "RESULT_OUTPUT_EVIDENCE_OBSERVED");
  });
  ok("uncorrelated-output-not-attributed", () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      presenceEvidence: presence({ observed: true, materiallyPresent: true, correlated: false })
    }));
    assert.strictEqual(states(result).CORRELATION, "NOT_CORRELATED_TO_EXACT_EXECUTION");
    assert.strictEqual(states(result).RESULT_OUTPUT, "UNKNOWN");
  });
  for (const [name, patch] of [
    ["partial-coverage", { captureCoverage: coverage({ status: "PARTIAL" }) }],
    ["coverage-invalid-provenance", { captureCoverage: coverage({ provenanceValid: false }) }],
    ["surface-coverage-incomplete", { captureCoverage: coverage({ allApplicableSurfacesCovered: false }) }],
    ["enumeration-incomplete", { captureCoverage: coverage({ enumerationComplete: false }) }],
    ["instrumentation-outage", { captureCoverage: coverage({ instrumentationAvailable: false }) }],
    ["dynamic-output-unsupported", { captureCoverage: coverage({ unsupportedDynamicOutputPath: true }) }],
    ["correlation-frontier-unresolved", { captureCoverage: coverage({ unresolvedCorrelationFrontier: true }) }],
    ["open-frame", { observationFrame: frame({ status: "OPEN" }) }],
    ["invalid-frame", { observationFrame: frame({ boundsValid: false }) }],
    ["clock-uncertain", { observationFrame: frame({ clockCorrelationValid: false }) }],
    ["subject-unresolved", { subjectIdentityResolved: false }],
    ["fragment-partial", { fragmentSet: fragments({ status: "PARTIAL", revision: 1, digest: "sha256:partial" }) }],
    ["fragment-sequence-invalid", { fragmentSet: fragments({ status: "COMPLETE", sequenceValid: false, revision: 2, digest: "sha256:bad-order" }) }],
    ["stream-open", { fragmentSet: fragments({ status: "COMPLETE", streamClosed: false, revision: 2, digest: "sha256:open" }) }]
  ]) ok(`${name}-blocks-negative`, () => {
    assert.strictEqual(states(output.assessRuntimeResultOutputObservation(input(patch))).RESULT_OUTPUT, "UNKNOWN");
  });
  for (const [name, patch] of [
    ["untrusted-source", { sourceTrusted: false }],
    ["invalid-provenance", { provenanceValid: false }],
    ["outside-frame", { frameBound: false }]
  ]) ok(`${name}-blocks-positive`, () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      observationFrame: frame({ status: "OPEN" }),
      presenceEvidence: presence({ observed: true, materiallyPresent: true, ...patch })
    }));
    assert.strictEqual(states(result).RESULT_OUTPUT, "UNKNOWN");
  });
  ok("invalid-integrity-preserves-presence-but-aggregate-unknown", () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      presenceEvidence: presence({ observed: true, materiallyPresent: true }),
      integrityEvidence: integrity({ status: "INVALID" })
    }));
    assert.strictEqual(states(result).PRESENCE, "RESULT_OUTPUT_OBSERVED");
    assert.strictEqual(states(result).INTEGRITY, "INTEGRITY_INVALID");
    assert.strictEqual(states(result).RESULT_OUTPUT, "UNKNOWN");
  });
  ok("unknown-integrity-does-not-erase-observation", () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      presenceEvidence: presence({ observed: true, materiallyPresent: true }),
      integrityEvidence: integrity({ status: "UNKNOWN", provenanceValid: false })
    }));
    assert.strictEqual(states(result).INTEGRITY, "UNKNOWN");
    assert.strictEqual(states(result).RESULT_OUTPUT, "RESULT_OUTPUT_EVIDENCE_OBSERVED");
  });
  ok("explicit-grammar-not-applicable", () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      grammarAssessment: grammar({ status: "NOT_APPLICABLE", bindingValid: false })
    }));
    assert.strictEqual(states(result).GRAMMAR, "NOT_APPLICABLE");
  });
  ok("unproven-grammar-not-applicable-fails-closed", () => throws(
    () => output.assessRuntimeResultOutputObservation(input({
      grammarAssessment: grammar({ status: "NOT_APPLICABLE", bindingValid: false, applicabilityEstablished: false })
    })), /SCHEMA_UNSUPPORTED_VALUE:grammarAssessment.applicabilityEstablished/
  ));
  ok("contradiction-preserved", () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      contradictionStatus: "CONTRADICTORY_EVIDENCE",
      presenceEvidence: presence({ observed: true, materiallyPresent: true })
    }));
    assert.strictEqual(states(result).RESULT_OUTPUT, "UNKNOWN");
    assert.strictEqual(result.contradictionStatus, "CONTRADICTORY_EVIDENCE");
  });
  ok("authority-none-and-no-downstream-conclusions", () => {
    const result = output.assessRuntimeResultOutputObservation(input({
      presenceEvidence: presence({ observed: true, materiallyPresent: true })
    }));
    assert.strictEqual(result.authority, "NONE");
    for (const forbidden of ["RESULT_ACCEPTED", "EFFECT_CONFIRMED", "COMPLETED", "SUCCESS", "RETRY_ALLOWED", "AUTHORIZED"]) {
      assert(!JSON.stringify(result).includes(forbidden));
    }
  });
  ok("deterministic-evidence-set", () => {
    const left = output.assessRuntimeResultOutputObservation(input({ evidenceRefs: ["ev:output", "ev:capture", "ev:output"] }));
    const right = output.assessRuntimeResultOutputObservation(input());
    assert.deepStrictEqual(left, right);
  });
  ok("material-execution-change-changes-identity", () => {
    const left = output.assessRuntimeResultOutputObservation(input());
    const right = output.assessRuntimeResultOutputObservation(input({ executionStartRef: "start:002" }));
    assert.notStrictEqual(left.observationStates[0].statementId, right.observationStates[0].statementId);
  });
  ok("material-fragment-change-changes-identity", () => {
    const left = output.assessRuntimeResultOutputObservation(input());
    const right = output.assessRuntimeResultOutputObservation(input({
      fragmentSet: fragments({ revision: 1, digest: "sha256:new-fragments" })
    }));
    assert.notStrictEqual(left.observationStates[0].statementId, right.observationStates[0].statementId);
  });
  ok("unicode-nfc-determinism", () => {
    const left = output.assessRuntimeResultOutputObservation(input({ provenanceScope: "scope:caf\u00e9" }));
    const right = output.assessRuntimeResultOutputObservation(input({ provenanceScope: "scope:cafe\u0301" }));
    assert.deepStrictEqual(left.observationStates.map((item) => item.statementId), right.observationStates.map((item) => item.statementId));
  });
  ok("schema-extra-field-fails-closed", () => throws(
    () => output.assessRuntimeResultOutputObservation({ ...input(), extra: true }), /SCHEMA_UNSUPPORTED_FIELD:extra/
  ));
  ok("schema-wrong-type-fails-closed", () => throws(
    () => output.assessRuntimeResultOutputObservation(input({ subjectIdentityResolved: "true" })), /SCHEMA_UNSUPPORTED_VALUE:subjectIdentityResolved/
  ));
  ok("schema-invalid-channel-fails-closed", () => throws(
    () => output.assessRuntimeResultOutputObservation(input({ outputChannel: "CONSOLE" })), /SCHEMA_UNSUPPORTED_VALUE:outputChannel/
  ));
  ok("source-isolation-audit", () => {
    const source = fs.readFileSync(path.join(ROOT, "scripts/gt63-machine/runtime-result-output-observation.js"), "utf8");
    for (const forbidden of [
      "require(\"fs\")", "require('fs')", "require(\"path\")", "require('path')",
      "process.cwd", "process.env", "Date.", "new Date", "performance.now", "Math.random",
      "localeCompare", "Intl", "child_process", "execSync", "execFile", "spawn", "git "
    ]) assert(!source.includes(forbidden), `forbidden:${forbidden}`);
  });
  ok("syntax-checks", () => {
    check("scripts/gt63-machine/runtime-result-output-observation.js");
    check("scripts/gt63-machine-runtime-result-output-observation-regression.js");
  });

  const sample = output.assessRuntimeResultOutputObservation(input({
    presenceEvidence: presence({ observed: true, materiallyPresent: true })
  }));
  const semantic = {
    cases,
    states: sample.observationStates.map((item) => `${item.dimension}:${item.observationState}`),
    statementIds: sample.observationStates.map((item) => item.statementId),
    rulesetVersion: R,
    authority: sample.authority
  };
  const identity = crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
  process.stdout.write(`${JSON.stringify({
    status: "PASS", workflow: "semantic-evidence-runtime-result-output-observation-v0-regression",
    cases: cases.length, validationIdentity: identity, outputHash: identity, semantic
  })}\n`);
}

main();
