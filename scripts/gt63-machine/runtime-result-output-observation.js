"use strict";

const crypto = require("crypto");

const RULESET_VERSION = "semantic-evidence-v1.0.1";
const SCHEMA_VERSION = "1.0";

const FRAME_STATES = new Set(["CLOSED", "OPEN", "UNKNOWN"]);
const COVERAGE_STATES = new Set(["COMPLETE", "PARTIAL", "UNKNOWN"]);
const FRAGMENT_STATES = new Set(["COMPLETE", "PARTIAL", "NOT_APPLICABLE", "UNKNOWN"]);
const INTEGRITY_STATES = new Set(["VERIFIED", "INVALID", "UNKNOWN"]);
const GRAMMAR_STATES = new Set(["PARSEABLE", "UNPARSEABLE", "UNSUPPORTED", "NOT_APPLICABLE", "UNKNOWN"]);
const CONTRADICTION_STATES = new Set(["NONE", "CONTRADICTORY_EVIDENCE"]);
const OUTPUT_CHANNELS = new Set([
  "DIRECT_RETURN", "STRUCTURED_PROVIDER_RESPONSE", "STDOUT", "STDERR",
  "RUNTIME_EVENT", "TRACE_PAYLOAD", "ARTIFACT", "MESSAGE_RESPONSE",
  "CALLBACK_PAYLOAD", "MULTI_FRAGMENT_STREAM"
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

function validatePresenceEvidence(value) {
  exactFields(value, new Set([
    "observed", "materiallyPresent", "recognizedEmptyRepresentation", "correlated",
    "frameBound", "provenanceValid", "sourceTrusted"
  ]), "presenceEvidence");
  for (const field of [
    "observed", "materiallyPresent", "recognizedEmptyRepresentation", "correlated",
    "frameBound", "provenanceValid", "sourceTrusted"
  ]) bool(value, field);
  return value;
}

function validateFrame(value) {
  exactFields(value, new Set([
    "status", "identityResolved", "boundsValid", "clockCorrelationValid"
  ]), "observationFrame");
  enumValue(value, "status", FRAME_STATES);
  for (const field of ["identityResolved", "boundsValid", "clockCorrelationValid"]) bool(value, field);
  return value;
}

function validateCoverage(value) {
  exactFields(value, new Set([
    "status", "provenanceValid", "allApplicableSurfacesCovered", "enumerationComplete",
    "instrumentationAvailable", "unsupportedDynamicOutputPath", "unresolvedCorrelationFrontier"
  ]), "captureCoverage");
  enumValue(value, "status", COVERAGE_STATES);
  for (const field of [
    "provenanceValid", "allApplicableSurfacesCovered", "enumerationComplete",
    "instrumentationAvailable", "unsupportedDynamicOutputPath", "unresolvedCorrelationFrontier"
  ]) bool(value, field);
  return value;
}

function validateFragments(value) {
  exactFields(value, new Set([
    "status", "provenanceValid", "sequenceValid", "streamClosed", "revision", "digest"
  ]), "fragmentSet");
  enumValue(value, "status", FRAGMENT_STATES);
  bool(value, "provenanceValid");
  bool(value, "sequenceValid");
  bool(value, "streamClosed");
  if (!Number.isInteger(value.revision) || value.revision < 0) {
    fail("SCHEMA_UNSUPPORTED_VALUE", "fragmentSet.revision", value.revision);
  }
  stringValue(value, "digest");
  return value;
}

function validateIntegrity(value) {
  exactFields(value, new Set(["status", "provenanceValid"]), "integrityEvidence");
  enumValue(value, "status", INTEGRITY_STATES);
  bool(value, "provenanceValid");
  return value;
}

function validateGrammar(value) {
  exactFields(value, new Set(["status", "bindingValid", "applicabilityEstablished"]), "grammarAssessment");
  enumValue(value, "status", GRAMMAR_STATES);
  bool(value, "bindingValid");
  bool(value, "applicabilityEstablished");
  return value;
}

function completeNegativeFrame(frame, coverage, fragments) {
  const fragmentClosed = fragments.status === "NOT_APPLICABLE"
    || (fragments.status === "COMPLETE" && fragments.provenanceValid
      && fragments.sequenceValid && fragments.streamClosed);
  return frame.status === "CLOSED" && frame.identityResolved && frame.boundsValid
    && frame.clockCorrelationValid && coverage.status === "COMPLETE"
    && coverage.provenanceValid && coverage.allApplicableSurfacesCovered
    && coverage.enumerationComplete && coverage.instrumentationAvailable
    && !coverage.unsupportedDynamicOutputPath && !coverage.unresolvedCorrelationFrontier
    && fragmentClosed;
}

function compareCodePoints(left, right) {
  const a = Array.from(String(left));
  const b = Array.from(String(right));
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = a[index].codePointAt(0) - b[index].codePointAt(0);
    if (difference) return difference;
  }
  return a.length - b.length;
}

function canonical(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (plainObject(value)) {
    const keys = Object.keys(value).sort(compareCodePoints);
    return `{${keys.map((key) => `${JSON.stringify(key.normalize("NFC"))}:${canonical(value[key])}`).join(",")}}`;
  }
  fail("SCHEMA_UNSUPPORTED_VALUE", "canonicalType", typeof value);
}

function statement(input, dimension, observationState) {
  const material = {
    capability: "semantic-evidence-runtime-result-output-observation",
    schemaVersion: SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    dimension,
    observationState,
    provenanceScope: input.provenanceScope,
    temporalFrameRef: input.temporalFrameRef,
    observationFrameRef: input.observationFrameRef,
    executionObservationRef: input.executionObservationRef,
    executionSubjectRef: input.executionSubjectRef,
    executionStartRef: input.executionStartRef,
    executionInvocationRef: input.executionInvocationRef,
    artifactIdentityRef: input.artifactIdentityRef,
    configurationIdentityRef: input.configurationIdentityRef,
    inputIdentityRef: input.inputIdentityRef,
    outputSurfaceIdentity: input.outputSurfaceIdentity,
    outputSurfaceRevision: input.outputSurfaceRevision,
    outputChannel: input.outputChannel,
    expectedResultGrammarRef: input.expectedResultGrammarRef,
    expectedResultGrammarRevision: input.expectedResultGrammarRevision,
    fragmentSetRevision: input.fragmentSet.revision,
    fragmentSetDigest: input.fragmentSet.digest,
    evidenceRefs: Array.from(new Set(input.evidenceRefs.map((value) => value.normalize("NFC")))).sort(compareCodePoints),
    contradictionStatus: input.contradictionStatus
  };
  const statementId = `sem:${crypto.createHash("sha256").update(canonical(material), "utf8").digest("hex")}`;
  return Object.freeze({ statementId, ...material });
}

function assessRuntimeResultOutputObservation(input) {
  exactFields(input, new Set([
    "rulesetVersion", "provenanceScope", "temporalFrameRef", "observationFrameRef",
    "executionObservationRef", "executionSubjectRef", "executionStartRef",
    "executionInvocationRef", "artifactIdentityRef", "configurationIdentityRef",
    "inputIdentityRef", "outputSurfaceIdentity", "outputSurfaceRevision", "outputChannel",
    "expectedResultGrammarRef", "expectedResultGrammarRevision", "evidenceRefs",
    "subjectIdentityResolved", "observationFrame", "captureCoverage", "fragmentSet",
    "presenceEvidence", "integrityEvidence", "grammarAssessment", "contradictionStatus"
  ]));
  assertRuleset(input.rulesetVersion);
  for (const field of [
    "provenanceScope", "temporalFrameRef", "observationFrameRef", "executionObservationRef",
    "executionSubjectRef", "executionStartRef", "executionInvocationRef", "artifactIdentityRef",
    "configurationIdentityRef", "inputIdentityRef", "outputSurfaceIdentity",
    "outputSurfaceRevision", "expectedResultGrammarRef", "expectedResultGrammarRevision"
  ]) stringValue(input, field);
  enumValue(input, "outputChannel", OUTPUT_CHANNELS);
  if (!Array.isArray(input.evidenceRefs)
    || input.evidenceRefs.some((value) => typeof value !== "string" || !value)) {
    fail("SCHEMA_UNSUPPORTED_VALUE", "evidenceRefs");
  }
  bool(input, "subjectIdentityResolved");
  enumValue(input, "contradictionStatus", CONTRADICTION_STATES);

  const frame = validateFrame(input.observationFrame);
  const coverage = validateCoverage(input.captureCoverage);
  const fragments = validateFragments(input.fragmentSet);
  const presence = validatePresenceEvidence(input.presenceEvidence);
  const integrity = validateIntegrity(input.integrityEvidence);
  const grammar = validateGrammar(input.grammarAssessment);

  if (grammar.status === "NOT_APPLICABLE" && !grammar.applicabilityEstablished) {
    fail("SCHEMA_UNSUPPORTED_VALUE", "grammarAssessment.applicabilityEstablished", false);
  }
  const contradictory = input.contradictionStatus === "CONTRADICTORY_EVIDENCE";
  const trustedObservation = presence.observed && presence.frameBound
    && presence.provenanceValid && presence.sourceTrusted;
  const legitimateEmpty = presence.recognizedEmptyRepresentation
    && grammar.status === "PARSEABLE" && grammar.bindingValid && grammar.applicabilityEstablished;
  const physicalPresence = trustedObservation && (presence.materiallyPresent || legitimateEmpty);
  const correlatedPositive = physicalPresence && presence.correlated
    && input.subjectIdentityResolved && !contradictory;
  const negativeReady = input.subjectIdentityResolved && !contradictory
    && completeNegativeFrame(frame, coverage, fragments);

  const presenceState = correlatedPositive
    ? "RESULT_OUTPUT_OBSERVED"
    : negativeReady && !presence.observed ? "NO_RESULT_OUTPUT_OBSERVED_IN_COMPLETE_FRAME"
      : "UNKNOWN";
  const correlationState = correlatedPositive
    ? "CORRELATED_TO_EXACT_EXECUTION"
    : physicalPresence && !presence.correlated ? "NOT_CORRELATED_TO_EXACT_EXECUTION"
      : "UNKNOWN";
  const captureState = coverage.status === "COMPLETE" && coverage.provenanceValid
    && coverage.allApplicableSurfacesCovered && coverage.enumerationComplete
    && coverage.instrumentationAvailable && !coverage.unsupportedDynamicOutputPath
    && !coverage.unresolvedCorrelationFrontier
    ? "CAPTURE_COMPLETE" : coverage.status === "PARTIAL" ? "CAPTURE_PARTIAL" : "UNKNOWN";
  const fragmentState = fragments.status === "COMPLETE" && fragments.provenanceValid
    && fragments.sequenceValid && fragments.streamClosed
    ? "FRAGMENT_SET_COMPLETE"
    : fragments.status === "PARTIAL" ? "FRAGMENT_SET_PARTIAL"
      : fragments.status === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "UNKNOWN";
  const integrityState = integrity.status === "VERIFIED" && integrity.provenanceValid
    ? "INTEGRITY_VERIFIED" : integrity.status === "INVALID" && integrity.provenanceValid
      ? "INTEGRITY_INVALID" : "UNKNOWN";
  const grammarState = grammar.status === "PARSEABLE" && grammar.bindingValid
    ? "PARSEABLE_UNDER_BOUND_GRAMMAR"
    : grammar.status === "UNPARSEABLE" && grammar.bindingValid
      ? "UNPARSEABLE_UNDER_BOUND_GRAMMAR"
      : grammar.status === "UNSUPPORTED" ? "GRAMMAR_UNSUPPORTED"
        : grammar.status === "NOT_APPLICABLE" && grammar.applicabilityEstablished
          ? "NOT_APPLICABLE" : "UNKNOWN";

  let aggregateState = "UNKNOWN";
  if (correlatedPositive && integrityState !== "INTEGRITY_INVALID") {
    aggregateState = "RESULT_OUTPUT_EVIDENCE_OBSERVED";
  } else if (presenceState === "NO_RESULT_OUTPUT_OBSERVED_IN_COMPLETE_FRAME") {
    aggregateState = "NO_RESULT_OUTPUT_EVIDENCE_IN_COMPLETE_FRAME";
  }

  const dimensions = [
    ["PRESENCE", presenceState],
    ["CORRELATION", correlationState],
    ["CAPTURE_COMPLETENESS", captureState],
    ["FRAGMENT_SET", fragmentState],
    ["INTEGRITY", integrityState],
    ["GRAMMAR", grammarState],
    ["RESULT_OUTPUT", aggregateState]
  ];
  return Object.freeze({
    capability: "semantic-evidence-runtime-result-output-observation",
    schemaVersion: SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    authority: "NONE",
    contradictionStatus: input.contradictionStatus,
    observationStates: dimensions.map(([dimension, state]) => statement(input, dimension, state))
  });
}

module.exports = Object.freeze({ RULESET_VERSION, assessRuntimeResultOutputObservation });
