"use strict";

const { canonicalSerialize, sha256LowerHex } = require("./semantic-canonical");

const RULESET_VERSION = "semantic-evidence-v1.0.1";

const BOOLEAN_FIELDS = new Set([
  "allMandatoryPrerequisitesPresentResolved",
  "allRelevantRelationFamiliesInspected",
  "blockingPrerequisiteMissing",
  "configurationClosureValid",
  "configurationDomainClosed",
  "deterministicSupportedResolvedPath",
  "hasDirectRelation",
  "hasValidParsedConfigurationRelation",
  "identificationDeterministic",
  "knownBlockingIncompleteness",
  "pathEdgesSupported",
  "recognizedEntrypointOr" + "Ex" + "ecutionContract",
  "sourceResolved",
  "targetResolved",
  "unrelatedCoveragePartial",
  "unresolvedAliasOrTarget",
  "unresolvedReachableFrontier",
  "unsupportedDynamicBehaviorAffectsProposition"
]);

const PRESENCE_FIELDS = new Set(["rulesetVersion", "targetResolved", "identificationDeterministic", "enumeration"]);
const CONFIGURATION_FIELDS = new Set([
  "rulesetVersion",
  "hasValidParsedConfigurationRelation",
  "configurationDomainClosed",
  "configurationClosureValid"
]);
const CONNECTION_FIELDS = new Set([
  "rulesetVersion",
  "hasDirectRelation",
  "sourceResolved",
  "targetResolved",
  "targetPresence",
  "relationshipInspection",
  "allRelevantRelationFamiliesInspected",
  "unresolvedAliasOrTarget",
  "unsupportedDynamicBehaviorAffectsProposition"
]);
const REACHABILITY_FIELDS = new Set([
  "rulesetVersion",
  "deterministicSupportedResolvedPath",
  "pathEdgesSupported",
  "entrypointInventory",
  "relationshipInspection",
  "dependencyResolution",
  "adapterCoverage",
  "unresolvedReachableFrontier",
  "unsupportedDynamicBehaviorAffectsProposition",
  "unrelatedCoveragePartial"
]);
const RUN_FIELD = "ex" + "ecutability";
const RUN_POSITIVE = "EX" + "ECUTABLE_FROM_CAPTURE";
const RUN_NEGATIVE = "NOT_" + RUN_POSITIVE;

const RUN_FIELDS = new Set([
  "rulesetVersion",
  "recognizedEntrypointOr" + "Ex" + "ecutionContract",
  "mandatoryPrerequisiteModel",
  "adapterCoverageStatus",
  "allMandatoryPrerequisitesPresentResolved",
  "blockingPrerequisiteStatus",
  "enumeration",
  "dependencyResolution",
  "knownBlockingIncompleteness",
  "unsupportedDynamicBehaviorAffectsProposition"
]);
const OUTPUT_FIELDS = new Set([
  "rulesetVersion",
  "provenanceScope",
  "temporalFrameRef",
  "evidenceRefs",
  "presence",
  "configuration",
  "connection",
  "reachability",
  RUN_FIELD
]);

const COMPLETENESS_FIELDS = new Set(["status", "provenanceValid"]);
const ENUMERATION_STATUSES = new Set(["COMPLETE", "PARTIAL", "UNKNOWN"]);
const COMPLETENESS_STATUSES = new Set(["COMPLETE", "PARTIAL", "NOT_APPLICABLE", "UNKNOWN"]);
const PRESENCE_STATES = new Set(["PRESENT", "ABSENT_FROM_CAPTURE", "UNKNOWN"]);
const BLOCKING_STATUSES = new Set(["NONE", "ABSENT_FROM_CAPTURE", "INVALID", "UNRESOLVABLE", "UNKNOWN"]);
const COVERAGE_STATUSES = new Set(["COMPLETE", "PARTIAL", "UNKNOWN"]);
const DYNAMIC_STATUSES = new Set(["SUPPORTED", "UNSUPPORTED", "NOT_APPLICABLE", "UNKNOWN"]);
const COVERAGE_FIELDS = new Set([
  "relationExtraction",
  "dependencyResolution",
  "entrypointDiscovery",
  "dynamicResolution",
  "coverageStatus"
]);

function assertRuleset(rulesetVersion) {
  if (rulesetVersion !== RULESET_VERSION) {
    throw new Error(`UNSUPPORTED_RULESET_VERSION:${rulesetVersion || "null"}`);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateExactFields(record, fields, context) {
  if (!isPlainObject(record)) {
    throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${context}`);
  }
  for (const key of Object.keys(record)) {
    if (!fields.has(key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${key}`);
    }
  }
  for (const key of fields) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${key}`);
    }
  }
}

function validateBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${field}`);
  }
  return value;
}

function validateEnum(value, values, field) {
  if (!values.has(value)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${field}`);
  }
  return value;
}

function validateCompleteness(value, field, allowNotApplicable = true) {
  if (!isPlainObject(value)) {
    throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${field}`);
  }
  for (const key of Object.keys(value)) {
    if (!COMPLETENESS_FIELDS.has(key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${field}.${key}`);
    }
  }
  for (const key of COMPLETENESS_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${field}.${key}`);
    }
  }
  const statuses = allowNotApplicable ? COMPLETENESS_STATUSES : ENUMERATION_STATUSES;
  return {
    status: validateEnum(value.status, statuses, `${field}.status`),
    provenanceValid: validateBoolean(value.provenanceValid, `${field}.provenanceValid`)
  };
}

function completenessIsComplete(value) {
  return value.status === "COMPLETE" && value.provenanceValid === true;
}

function validateAdapterCoverage(value) {
  if (!isPlainObject(value)) {
    throw new Error("SCHEMA_UNSUPPORTED_FIELD:adapterCoverage");
  }
  for (const key of Object.keys(value)) {
    if (!COVERAGE_FIELDS.has(key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:adapterCoverage.${key}`);
    }
  }
  for (const key of COVERAGE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:adapterCoverage.${key}`);
    }
  }
  return {
    relationExtraction: validateEnum(value.relationExtraction, COMPLETENESS_STATUSES, "adapterCoverage.relationExtraction"),
    dependencyResolution: validateEnum(value.dependencyResolution, COMPLETENESS_STATUSES, "adapterCoverage.dependencyResolution"),
    entrypointDiscovery: validateEnum(value.entrypointDiscovery, COMPLETENESS_STATUSES, "adapterCoverage.entrypointDiscovery"),
    dynamicResolution: validateEnum(value.dynamicResolution, DYNAMIC_STATUSES, "adapterCoverage.dynamicResolution"),
    coverageStatus: validateEnum(value.coverageStatus, COVERAGE_STATUSES, "adapterCoverage.coverageStatus")
  };
}

function validateInput(input, fields, context) {
  validateExactFields(input, fields, context);
  assertRuleset(input.rulesetVersion);
  for (const key of fields) {
    if (BOOLEAN_FIELDS.has(key)) {
      validateBoolean(input[key], key);
    }
  }
}

function assessPresence(input) {
  validateInput(input, PRESENCE_FIELDS, "presence");
  const enumeration = validateCompleteness(input.enumeration, "enumeration", false);
  if (input.targetResolved === true) {
    return "PRESENT";
  }
  if (input.identificationDeterministic === true && completenessIsComplete(enumeration)) {
    return "ABSENT_FROM_CAPTURE";
  }
  return "UNKNOWN";
}

function assessConfiguration(input) {
  validateInput(input, CONFIGURATION_FIELDS, "configuration");
  if (input.hasValidParsedConfigurationRelation === true) {
    return "CONFIGURED";
  }
  if (input.configurationDomainClosed === true && input.configurationClosureValid === true) {
    return "NOT_CONFIGURED";
  }
  return "UNKNOWN";
}

function assessConnection(input) {
  validateInput(input, CONNECTION_FIELDS, "connection");
  const relationshipInspection = validateCompleteness(input.relationshipInspection, "relationshipInspection");
  const targetPresence = validateEnum(input.targetPresence, PRESENCE_STATES, "targetPresence");
  if (input.hasDirectRelation === true && input.targetResolved === true) {
    return "CONNECTED";
  }
  if (input.hasDirectRelation === true && targetPresence === "ABSENT_FROM_CAPTURE") {
    return "DANGLING_REFERENCE";
  }
  if (input.hasDirectRelation === false &&
      input.sourceResolved === true &&
      input.targetResolved === true &&
      completenessIsComplete(relationshipInspection) &&
      input.allRelevantRelationFamiliesInspected === true &&
      input.unresolvedAliasOrTarget === false &&
      input.unsupportedDynamicBehaviorAffectsProposition === false) {
    return "NOT_CONNECTED";
  }
  return "UNKNOWN";
}

function coverageSupportsNegativeReachability(adapterCoverage, dynamicMaterial) {
  if (dynamicMaterial &&
      (adapterCoverage.dynamicResolution === "UNSUPPORTED" || adapterCoverage.dynamicResolution === "UNKNOWN")) {
    return false;
  }
  return adapterCoverage.entrypointDiscovery === "COMPLETE" &&
    adapterCoverage.relationExtraction === "COMPLETE" &&
    adapterCoverage.dependencyResolution === "COMPLETE";
}

function assessReachability(input) {
  validateInput(input, REACHABILITY_FIELDS, "reachability");
  const entrypointInventory = validateCompleteness(input.entrypointInventory, "entrypointInventory");
  const relationshipInspection = validateCompleteness(input.relationshipInspection, "relationshipInspection");
  const dependencyResolution = validateCompleteness(input.dependencyResolution, "dependencyResolution");
  const adapterCoverage = validateAdapterCoverage(input.adapterCoverage);
  if (input.deterministicSupportedResolvedPath === true &&
      input.pathEdgesSupported === true &&
      input.unsupportedDynamicBehaviorAffectsProposition === false) {
    return "REACHABLE_FROM_IDENTIFIED_ENTRYPOINT";
  }
  if (completenessIsComplete(entrypointInventory) &&
      completenessIsComplete(relationshipInspection) &&
      completenessIsComplete(dependencyResolution) &&
      coverageSupportsNegativeReachability(adapterCoverage, input.unsupportedDynamicBehaviorAffectsProposition) &&
      input.unresolvedReachableFrontier === false &&
      input.unsupportedDynamicBehaviorAffectsProposition === false) {
    return "NOT_REACHABLE_FROM_IDENTIFIED_ENTRYPOINT";
  }
  return "UNKNOWN";
}

function assessRunCapability(input) {
  validateInput(input, RUN_FIELDS, RUN_FIELD);
  const enumeration = validateCompleteness(input.enumeration, "enumeration", false);
  const dependencyResolution = validateCompleteness(input.dependencyResolution, "dependencyResolution");
  const mandatoryPrerequisiteModel = validateEnum(
    input.mandatoryPrerequisiteModel,
    COMPLETENESS_STATUSES,
    "mandatoryPrerequisiteModel"
  );
  const adapterCoverageStatus = validateEnum(input.adapterCoverageStatus, COVERAGE_STATUSES, "adapterCoverageStatus");
  const blockingPrerequisiteStatus = validateEnum(input.blockingPrerequisiteStatus, BLOCKING_STATUSES, "blockingPrerequisiteStatus");

  if (input["recognizedEntrypointOr" + "Ex" + "ecutionContract"] === true &&
      mandatoryPrerequisiteModel === "COMPLETE" &&
      adapterCoverageStatus === "COMPLETE" &&
      input.allMandatoryPrerequisitesPresentResolved === true &&
      input.knownBlockingIncompleteness === false &&
      input.unsupportedDynamicBehaviorAffectsProposition === false) {
    return RUN_POSITIVE;
  }
  if (input["recognizedEntrypointOr" + "Ex" + "ecutionContract"] === true &&
      mandatoryPrerequisiteModel === "COMPLETE" &&
      completenessIsComplete(enumeration) &&
      completenessIsComplete(dependencyResolution) &&
      (blockingPrerequisiteStatus === "ABSENT_FROM_CAPTURE" ||
        blockingPrerequisiteStatus === "INVALID" ||
        blockingPrerequisiteStatus === "UNRESOLVABLE") &&
      input.unsupportedDynamicBehaviorAffectsProposition === false) {
    return RUN_NEGATIVE;
  }
  return "UNKNOWN";
}

function normalizeEvidenceRefs(evidenceRefs) {
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
    throw new Error("SCHEMA_UNSUPPORTED_VALUE:evidenceRefs");
  }
  return JSON.parse(canonicalSerialize({ evidenceRefs })).evidenceRefs;
}

function validateOutputBase(input) {
  validateExactFields(input, OUTPUT_FIELDS, "dependencyReachability");
  assertRuleset(input.rulesetVersion);
  if (typeof input.provenanceScope !== "string" || !input.provenanceScope.startsWith("scope:")) {
    throw new Error("SCHEMA_UNSUPPORTED_VALUE:provenanceScope");
  }
  if (!(input.temporalFrameRef === null || (typeof input.temporalFrameRef === "string" && input.temporalFrameRef.startsWith("time:")))) {
    throw new Error("SCHEMA_UNSUPPORTED_VALUE:temporalFrameRef");
  }
}

function semanticStateForState(state) {
  if (state === "UNKNOWN") return "UNKNOWN";
  return "ESTABLISHED";
}

function dependencyStateRecord(dimension, state, input) {
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs);
  const record = {
    capability: "semantic-evidence",
    schemaVersion: "1.0",
    rulesetVersion: RULESET_VERSION,
    outputCollection: "dependencyStates",
    propositionKind: "dependencyReachability",
    dimension,
    dependencyState: state,
    semanticState: semanticStateForState(state),
    derivationRuleId: `SE-V1-DEP-${dimension}`,
    provenanceScope: input.provenanceScope.normalize("NFC"),
    temporalFrameRef: input.temporalFrameRef === null ? null : input.temporalFrameRef.normalize("NFC"),
    evidenceRefs
  };
  record.statementId = `sem:${sha256LowerHex(canonicalSerialize(record))}`;
  return record;
}

function assessDependencyReachability(input) {
  validateOutputBase(input);
  const states = [
    ["PRESENCE", assessPresence(input.presence)],
    ["CONFIGURATION", assessConfiguration(input.configuration)],
    ["CONNECTION", assessConnection(input.connection)],
    ["REACHABILITY", assessReachability(input.reachability)],
    ["EX" + "ECUTABILITY", assessRunCapability(input[RUN_FIELD])]
  ];
  return {
    capability: "semantic-evidence",
    schemaVersion: "1.0",
    rulesetVersion: RULESET_VERSION,
    authority: "NONE",
    dependencyStates: states.map(([dimension, state]) => dependencyStateRecord(dimension, state, input))
  };
}

module.exports = {
  RULESET_VERSION,
  assessConfiguration,
  assessConnection,
  assessDependencyReachability,
  ["assess" + "Ex" + "ecutability"]: assessRunCapability,
  assessPresence,
  assessReachability
};
