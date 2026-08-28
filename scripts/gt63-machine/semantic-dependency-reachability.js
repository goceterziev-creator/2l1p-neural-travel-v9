"use strict";

const crypto = require("crypto");

const RULESET_VERSION = "semantic-evidence-v1.0.1";
const SCHEMA_VERSION = "1.0";

const PRESENCE = new Set(["PRESENT", "ABSENT_FROM_CAPTURE", "UNKNOWN"]);
const CONFIGURATION = new Set(["CONFIGURED", "NOT_CONFIGURED", "UNKNOWN"]);
const CONNECTION = new Set(["CONNECTED", "DANGLING_REFERENCE", "NOT_CONNECTED", "UNKNOWN"]);
const REACHABILITY = new Set(["REACHABLE_FROM_IDENTIFIED_ENTRYPOINT", "NOT_REACHABLE_FROM_IDENTIFIED_ENTRYPOINT", "UNKNOWN"]);
const EXECUTABILITY = new Set(["EXECUTABLE_FROM_CAPTURE", "NOT_EXECUTABLE_FROM_CAPTURE", "UNKNOWN"]);
const COMPLETE_STATES = new Set(["COMPLETE", "PARTIAL", "UNKNOWN"]);
const COMPLETE_NA_STATES = new Set(["COMPLETE", "PARTIAL", "NOT_APPLICABLE", "UNKNOWN"]);
const DYNAMIC_STATES = new Set(["SUPPORTED", "UNSUPPORTED", "UNKNOWN"]);
const BLOCKING_STATES = new Set(["NONE", "ABSENT_FROM_CAPTURE", "INVALID", "UNRESOLVABLE", "UNKNOWN"]);

function fail(kind, field, value) {
  const suffix = value === undefined ? "" : `:${String(value)}`;
  throw new Error(`${kind}:${field}${suffix}`);
}

function assertRuleset(value) {
  if (value !== RULESET_VERSION) fail("UNSUPPORTED_RULESET_VERSION", "rulesetVersion", value);
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exactFields(record, allowed) {
  if (!plainObject(record)) fail("SCHEMA_UNSUPPORTED_FIELD", "input");
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail("SCHEMA_UNSUPPORTED_FIELD", key);
  }
}

function bool(record, field) {
  if (typeof record[field] !== "boolean") fail("SCHEMA_UNSUPPORTED_VALUE", field, record[field]);
}

function enumValue(record, field, allowed) {
  if (!allowed.has(record[field])) fail("SCHEMA_UNSUPPORTED_VALUE", field, record[field]);
}

function completeness(value, field, allowNotApplicable = false) {
  if (!plainObject(value)) fail("SCHEMA_UNSUPPORTED_FIELD", field);
  exactFields(value, new Set(["status", "provenanceValid"]));
  const allowed = allowNotApplicable ? COMPLETE_NA_STATES : COMPLETE_STATES;
  if (!allowed.has(value.status)) fail("SCHEMA_UNSUPPORTED_VALUE", `${field}.status`, value.status);
  if (typeof value.provenanceValid !== "boolean") fail("SCHEMA_UNSUPPORTED_VALUE", `${field}.provenanceValid`, value.provenanceValid);
  return value.status === "COMPLETE" && value.provenanceValid === true;
}

function validateCommon(record, fields) {
  exactFields(record, new Set(["rulesetVersion", ...fields]));
  assertRuleset(record.rulesetVersion);
}

function assessPresence(input) {
  validateCommon(input, ["targetResolved", "identificationDeterministic", "enumeration"]);
  bool(input, "targetResolved");
  bool(input, "identificationDeterministic");
  const enumerationComplete = completeness(input.enumeration, "enumeration");
  if (input.targetResolved) return "PRESENT";
  if (enumerationComplete && input.identificationDeterministic) return "ABSENT_FROM_CAPTURE";
  return "UNKNOWN";
}

function assessConfiguration(input) {
  validateCommon(input, ["hasValidParsedConfigurationRelation", "configurationDomainClosed", "configurationClosureValid"]);
  bool(input, "hasValidParsedConfigurationRelation");
  bool(input, "configurationDomainClosed");
  bool(input, "configurationClosureValid");
  if (input.hasValidParsedConfigurationRelation) return "CONFIGURED";
  if (input.configurationDomainClosed && input.configurationClosureValid) return "NOT_CONFIGURED";
  return "UNKNOWN";
}

function assessConnection(input) {
  validateCommon(input, [
    "hasDirectRelation", "sourceResolved", "targetResolved", "targetPresence",
    "relationshipInspection", "allRelevantRelationFamiliesInspected",
    "unresolvedAliasOrTarget", "unsupportedDynamicBehaviorAffectsProposition"
  ]);
  for (const field of ["hasDirectRelation", "sourceResolved", "targetResolved", "allRelevantRelationFamiliesInspected", "unresolvedAliasOrTarget", "unsupportedDynamicBehaviorAffectsProposition"]) bool(input, field);
  enumValue(input, "targetPresence", PRESENCE);
  const inspectionComplete = completeness(input.relationshipInspection, "relationshipInspection");
  if (input.unsupportedDynamicBehaviorAffectsProposition || input.unresolvedAliasOrTarget) return "UNKNOWN";
  if (input.hasDirectRelation && input.sourceResolved && input.targetResolved && input.targetPresence === "PRESENT") return "CONNECTED";
  if (input.hasDirectRelation && input.sourceResolved && !input.targetResolved && input.targetPresence === "ABSENT_FROM_CAPTURE") return "DANGLING_REFERENCE";
  if (input.hasDirectRelation) return "UNKNOWN";
  if (inspectionComplete && input.allRelevantRelationFamiliesInspected && input.sourceResolved && input.targetResolved) return "NOT_CONNECTED";
  return "UNKNOWN";
}

function validateAdapterCoverage(value) {
  if (!plainObject(value)) fail("SCHEMA_UNSUPPORTED_FIELD", "adapterCoverage");
  exactFields(value, new Set(["relationExtraction", "dependencyResolution", "entrypointDiscovery", "dynamicResolution", "coverageStatus"]));
  for (const field of ["relationExtraction", "dependencyResolution", "entrypointDiscovery", "coverageStatus"]) {
    if (!COMPLETE_NA_STATES.has(value[field])) fail("SCHEMA_UNSUPPORTED_VALUE", `adapterCoverage.${field}`, value[field]);
  }
  if (!DYNAMIC_STATES.has(value.dynamicResolution)) fail("SCHEMA_UNSUPPORTED_VALUE", "adapterCoverage.dynamicResolution", value.dynamicResolution);
  return value;
}

function assessReachability(input) {
  validateCommon(input, [
    "deterministicSupportedResolvedPath", "pathEdgesSupported", "entrypointInventory",
    "relationshipInspection", "dependencyResolution", "adapterCoverage",
    "unresolvedReachableFrontier", "unsupportedDynamicBehaviorAffectsProposition",
    "unrelatedCoveragePartial"
  ]);
  for (const field of ["deterministicSupportedResolvedPath", "pathEdgesSupported", "unresolvedReachableFrontier", "unsupportedDynamicBehaviorAffectsProposition", "unrelatedCoveragePartial"]) bool(input, field);
  const entrypointsComplete = completeness(input.entrypointInventory, "entrypointInventory", true);
  const relationshipsComplete = completeness(input.relationshipInspection, "relationshipInspection", true);
  const dependenciesComplete = completeness(input.dependencyResolution, "dependencyResolution", true);
  const adapter = validateAdapterCoverage(input.adapterCoverage);
  if (input.unsupportedDynamicBehaviorAffectsProposition || adapter.dynamicResolution === "UNSUPPORTED") return "UNKNOWN";
  if (input.deterministicSupportedResolvedPath && input.pathEdgesSupported) return "REACHABLE_FROM_IDENTIFIED_ENTRYPOINT";
  if (!entrypointsComplete || !relationshipsComplete || !dependenciesComplete) return "UNKNOWN";
  if (input.unresolvedReachableFrontier) return "UNKNOWN";
  if (adapter.relationExtraction !== "COMPLETE" || adapter.dependencyResolution !== "COMPLETE" || adapter.entrypointDiscovery !== "COMPLETE") return "UNKNOWN";
  return "NOT_REACHABLE_FROM_IDENTIFIED_ENTRYPOINT";
}

function assessExecutability(input) {
  validateCommon(input, [
    "recognizedEntrypointOrExecutionContract", "mandatoryPrerequisiteModel", "adapterCoverageStatus",
    "allMandatoryPrerequisitesPresentResolved", "blockingPrerequisiteStatus", "enumeration",
    "dependencyResolution", "knownBlockingIncompleteness", "unsupportedDynamicBehaviorAffectsProposition"
  ]);
  for (const field of ["recognizedEntrypointOrExecutionContract", "allMandatoryPrerequisitesPresentResolved", "knownBlockingIncompleteness", "unsupportedDynamicBehaviorAffectsProposition"]) bool(input, field);
  if (!COMPLETE_NA_STATES.has(input.mandatoryPrerequisiteModel)) fail("SCHEMA_UNSUPPORTED_VALUE", "mandatoryPrerequisiteModel", input.mandatoryPrerequisiteModel);
  if (!COMPLETE_NA_STATES.has(input.adapterCoverageStatus)) fail("SCHEMA_UNSUPPORTED_VALUE", "adapterCoverageStatus", input.adapterCoverageStatus);
  if (!BLOCKING_STATES.has(input.blockingPrerequisiteStatus)) fail("SCHEMA_UNSUPPORTED_VALUE", "blockingPrerequisiteStatus", input.blockingPrerequisiteStatus);
  const enumerationComplete = completeness(input.enumeration, "enumeration");
  const dependenciesComplete = completeness(input.dependencyResolution, "dependencyResolution", true);
  if (input.unsupportedDynamicBehaviorAffectsProposition) return "UNKNOWN";
  if (!input.recognizedEntrypointOrExecutionContract) return "UNKNOWN";
  if (input.mandatoryPrerequisiteModel !== "COMPLETE" || input.adapterCoverageStatus !== "COMPLETE") return "UNKNOWN";
  if (input.knownBlockingIncompleteness) return "UNKNOWN";
  if (input.allMandatoryPrerequisitesPresentResolved) return "EXECUTABLE_FROM_CAPTURE";
  const deterministicBlock = new Set(["ABSENT_FROM_CAPTURE", "INVALID", "UNRESOLVABLE"]).has(input.blockingPrerequisiteStatus);
  if (deterministicBlock && enumerationComplete && dependenciesComplete) return "NOT_EXECUTABLE_FROM_CAPTURE";
  return "UNKNOWN";
}

function compareCodePoints(a, b) {
  const aa = Array.from(String(a));
  const bb = Array.from(String(b));
  const n = Math.min(aa.length, bb.length);
  for (let i = 0; i < n; i += 1) {
    const d = aa[i].codePointAt(0) - bb[i].codePointAt(0);
    if (d) return d;
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
    return `{${keys.map((k) => `${JSON.stringify(k.normalize("NFC"))}:${canonical(value[k])}`).join(",")}}`;
  }
  fail("SCHEMA_UNSUPPORTED_VALUE", "canonicalType", typeof value);
}

function statement(dimension, state, envelope) {
  const material = {
    capability: "semantic-evidence",
    schemaVersion: SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    dimension,
    dependencyState: state,
    provenanceScope: envelope.provenanceScope,
    temporalFrameRef: envelope.temporalFrameRef,
    evidenceRefs: Array.from(new Set(envelope.evidenceRefs.map((v) => String(v).normalize("NFC")))).sort(compareCodePoints)
  };
  const statementId = `sem:${crypto.createHash("sha256").update(canonical(material), "utf8").digest("hex")}`;
  return Object.freeze({ statementId, ...material });
}

function assessDependencyReachability(input) {
  validateCommon(input, ["provenanceScope", "temporalFrameRef", "evidenceRefs", "presence", "configuration", "connection", "reachability", "executability"]);
  if (typeof input.provenanceScope !== "string" || !input.provenanceScope) fail("SCHEMA_UNSUPPORTED_VALUE", "provenanceScope", input.provenanceScope);
  if (typeof input.temporalFrameRef !== "string" || !input.temporalFrameRef) fail("SCHEMA_UNSUPPORTED_VALUE", "temporalFrameRef", input.temporalFrameRef);
  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.some((v) => typeof v !== "string" || !v)) fail("SCHEMA_UNSUPPORTED_VALUE", "evidenceRefs");
  const states = [
    ["PRESENCE", assessPresence(input.presence)],
    ["CONFIGURATION", assessConfiguration(input.configuration)],
    ["CONNECTION", assessConnection(input.connection)],
    ["REACHABILITY", assessReachability(input.reachability)],
    ["EXECUTABILITY", assessExecutability(input.executability)]
  ].map(([dimension, state]) => statement(dimension, state, input));
  return Object.freeze({
    capability: "semantic-evidence-dependency-reachability",
    schemaVersion: SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    authority: "NONE",
    dependencyStates: states
  });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  assessPresence,
  assessConfiguration,
  assessConnection,
  assessReachability,
  assessExecutability,
  assessDependencyReachability
});
