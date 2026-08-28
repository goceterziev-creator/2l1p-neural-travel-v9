"use strict";

const crypto = require("crypto");

const RULESET_VERSION = "semantic-evidence-v1.0.1";
const SCHEMA_VERSION = "1.0";

const OBSERVATION = new Set(["OBSERVED", "NOT_OBSERVED", "UNKNOWN"]);
const TERMINATION_OBSERVATION = new Set(["OBSERVED", "NOT_OBSERVED", "NOT_APPLICABLE", "UNKNOWN"]);
const AGGREGATE = new Set(["EXECUTION_OBSERVED", "NOT_EXECUTED_IN_OBSERVATION_FRAME", "UNKNOWN"]);
const COVERAGE = new Set(["COMPLETE", "PARTIAL", "UNKNOWN"]);
const FRAME = new Set(["CLOSED", "OPEN", "UNKNOWN"]);
const CONTRADICTION = new Set(["NONE", "CONTRADICTORY_EVIDENCE"]);
const TERMINATION_CLASS = new Set([
  "EXITED", "SIGNALED", "TIMED_OUT", "CANCELLED", "CRASHED",
  "PROVIDER_TERMINATED", "UNKNOWN_TERMINATION_CLASS", "NOT_APPLICABLE"
]);

function fail(kind, field, value) {
  const suffix = value === undefined ? "" : `:${String(value)}`;
  throw new Error(`${kind}:${field}${suffix}`);
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exactFields(record, allowed, field = "input") {
  if (!plainObject(record)) fail("SCHEMA_UNSUPPORTED_FIELD", field);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail("SCHEMA_UNSUPPORTED_FIELD", key);
  }
}

function assertRuleset(value) {
  if (value !== RULESET_VERSION) fail("UNSUPPORTED_RULESET_VERSION", "rulesetVersion", value);
}

function stringValue(record, field) {
  if (typeof record[field] !== "string" || !record[field]) {
    fail("SCHEMA_UNSUPPORTED_VALUE", field, record[field]);
  }
}

function bool(record, field) {
  if (typeof record[field] !== "boolean") fail("SCHEMA_UNSUPPORTED_VALUE", field, record[field]);
}

function enumValue(record, field, values) {
  if (!values.has(record[field])) fail("SCHEMA_UNSUPPORTED_VALUE", field, record[field]);
}

function validateEvidence(value, field) {
  exactFields(value, new Set([
    "observed", "subjectBound", "frameBound", "provenanceValid", "sourceTrusted"
  ]), field);
  for (const name of ["observed", "subjectBound", "frameBound", "provenanceValid", "sourceTrusted"]) {
    bool(value, name);
  }
  return value;
}

function validateCoverage(value) {
  exactFields(value, new Set([
    "status", "provenanceValid", "allSupportedExecutionPathsCovered",
    "enumerationComplete", "instrumentationAvailable", "unsupportedDynamicPath"
  ]), "instrumentationCoverage");
  enumValue(value, "status", COVERAGE);
  for (const name of [
    "provenanceValid", "allSupportedExecutionPathsCovered", "enumerationComplete",
    "instrumentationAvailable", "unsupportedDynamicPath"
  ]) bool(value, name);
  return value;
}

function validateFrame(value) {
  exactFields(value, new Set(["status", "identityResolved", "boundsValid", "clockCorrelationValid"]), "observationFrame");
  enumValue(value, "status", FRAME);
  for (const name of ["identityResolved", "boundsValid", "clockCorrelationValid"]) bool(value, name);
  return value;
}

function trustworthyPositive(evidence) {
  return evidence.observed && evidence.subjectBound && evidence.frameBound
    && evidence.provenanceValid && evidence.sourceTrusted;
}

function completeNegativeFrame(frame, coverage) {
  return frame.status === "CLOSED" && frame.identityResolved && frame.boundsValid
    && frame.clockCorrelationValid && coverage.status === "COMPLETE"
    && coverage.provenanceValid && coverage.allSupportedExecutionPathsCovered
    && coverage.enumerationComplete && coverage.instrumentationAvailable
    && !coverage.unsupportedDynamicPath;
}

function assessRuntimeExecutionObservation(input) {
  exactFields(input, new Set([
    "rulesetVersion", "provenanceScope", "temporalFrameRef", "observationFrameRef",
    "executionSubjectRef", "artifactIdentityRef", "configurationIdentityRef",
    "dependencyAssessmentRef", "entrypointIdentityRef", "invocationIdentityRef",
    "instrumentationIdentity", "instrumentationRevision", "evidenceRefs",
    "subjectIdentityResolved", "observationFrame", "instrumentationCoverage",
    "invocationEvidence", "startEvidence", "terminationEvidence",
    "terminationClass", "contradictionStatus"
  ]));
  assertRuleset(input.rulesetVersion);
  for (const field of [
    "provenanceScope", "temporalFrameRef", "observationFrameRef", "executionSubjectRef",
    "artifactIdentityRef", "configurationIdentityRef", "dependencyAssessmentRef",
    "entrypointIdentityRef", "invocationIdentityRef", "instrumentationIdentity",
    "instrumentationRevision"
  ]) stringValue(input, field);
  if (!Array.isArray(input.evidenceRefs)
    || input.evidenceRefs.some((value) => typeof value !== "string" || !value)) {
    fail("SCHEMA_UNSUPPORTED_VALUE", "evidenceRefs");
  }
  bool(input, "subjectIdentityResolved");
  enumValue(input, "contradictionStatus", CONTRADICTION);
  enumValue(input, "terminationClass", TERMINATION_CLASS);
  const frame = validateFrame(input.observationFrame);
  const coverage = validateCoverage(input.instrumentationCoverage);
  const invocation = validateEvidence(input.invocationEvidence, "invocationEvidence");
  const start = validateEvidence(input.startEvidence, "startEvidence");
  const termination = validateEvidence(input.terminationEvidence, "terminationEvidence");

  const identityUsable = input.subjectIdentityResolved;
  const contradictory = input.contradictionStatus === "CONTRADICTORY_EVIDENCE";
  const negativeReady = identityUsable && completeNegativeFrame(frame, coverage) && !contradictory;
  const invocationPositive = identityUsable && !contradictory && trustworthyPositive(invocation);
  const startPositive = identityUsable && !contradictory && trustworthyPositive(start);
  const terminationPositive = identityUsable && !contradictory && trustworthyPositive(termination);

  const invocationState = invocationPositive
    ? "OBSERVED" : negativeReady && !invocation.observed ? "NOT_OBSERVED" : "UNKNOWN";
  const startState = startPositive
    ? "OBSERVED" : negativeReady && !start.observed ? "NOT_OBSERVED" : "UNKNOWN";
  const terminationState = terminationPositive
    ? "OBSERVED"
    : startState === "NOT_OBSERVED" && invocationState === "NOT_OBSERVED" ? "NOT_APPLICABLE"
      : negativeReady && !termination.observed ? "NOT_OBSERVED" : "UNKNOWN";

  let aggregateState = "UNKNOWN";
  if (startPositive || terminationPositive) aggregateState = "EXECUTION_OBSERVED";
  else if (negativeReady && invocationState === "NOT_OBSERVED" && startState === "NOT_OBSERVED") {
    aggregateState = "NOT_EXECUTED_IN_OBSERVATION_FRAME";
  }
  if (!AGGREGATE.has(aggregateState)) fail("SCHEMA_UNSUPPORTED_VALUE", "aggregateState", aggregateState);

  const dimensions = [
    ["INVOCATION", invocationState],
    ["EXECUTION_START", startState],
    ["TERMINATION", terminationState],
    ["EXECUTION", aggregateState]
  ];
  const statements = dimensions.map(([dimension, observationState]) => statement(input, dimension, observationState));
  return Object.freeze({
    capability: "semantic-evidence-runtime-execution-observation",
    schemaVersion: SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    authority: "NONE",
    contradictionStatus: input.contradictionStatus,
    terminationClass: terminationPositive ? input.terminationClass : "NOT_APPLICABLE",
    observationStates: statements
  });
}

function compareCodePoints(a, b) {
  const aa = Array.from(String(a));
  const bb = Array.from(String(b));
  const length = Math.min(aa.length, bb.length);
  for (let index = 0; index < length; index += 1) {
    const difference = aa[index].codePointAt(0) - bb[index].codePointAt(0);
    if (difference) return difference;
  }
  return aa.length - bb.length;
}

function canonical(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (plainObject(value)) {
    const keys = Object.keys(value).sort(compareCodePoints);
    return `{${keys.map((key) => `${JSON.stringify(key.normalize("NFC"))}:${canonical(value[key])}`).join(",")}}`;
  }
  fail("SCHEMA_UNSUPPORTED_VALUE", "canonicalType", typeof value);
}

function statement(input, dimension, observationState) {
  const material = {
    capability: "semantic-evidence-runtime-execution-observation",
    schemaVersion: SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    dimension,
    observationState,
    provenanceScope: input.provenanceScope,
    temporalFrameRef: input.temporalFrameRef,
    observationFrameRef: input.observationFrameRef,
    executionSubjectRef: input.executionSubjectRef,
    artifactIdentityRef: input.artifactIdentityRef,
    configurationIdentityRef: input.configurationIdentityRef,
    dependencyAssessmentRef: input.dependencyAssessmentRef,
    entrypointIdentityRef: input.entrypointIdentityRef,
    invocationIdentityRef: input.invocationIdentityRef,
    instrumentationIdentity: input.instrumentationIdentity,
    instrumentationRevision: input.instrumentationRevision,
    evidenceRefs: Array.from(new Set(input.evidenceRefs.map((value) => value.normalize("NFC")))).sort(compareCodePoints),
    contradictionStatus: input.contradictionStatus
  };
  const statementId = `sem:${crypto.createHash("sha256").update(canonical(material), "utf8").digest("hex")}`;
  return Object.freeze({ statementId, ...material });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  assessRuntimeExecutionObservation
});
