"use strict";

const { normalizeTargetToken } = require("./semantic-target-normalization");

const RULESET_VERSION = "semantic-evidence-v1.0.1";

const COMPLETE_SET = new Set(["COMPLETE", "PARTIAL", "UNKNOWN"]);
const COMPLETE_NA_SET = new Set(["COMPLETE", "PARTIAL", "NOT_APPLICABLE", "UNKNOWN"]);
const OWNERS = new Set(["repository-scanner", "evidence-extractor", "relationship-mapper"]);
const ARTIFACT_FAMILIES = new Set([
  "EXECUTABLE_SOURCE",
  "CONFIGURATION",
  "DOCUMENT",
  "BINARY",
  "ARCHIVE",
  "GIT_HISTORY",
  "GENERATED_OUTPUT"
]);
const DYNAMIC_VALUES = new Set(["SUPPORTED", "UNSUPPORTED", "NOT_APPLICABLE", "UNKNOWN"]);
const COVERAGE_FIELDS = new Set([
  "adapterId",
  "adapterVersion",
  "scopeId",
  "artifactFamily",
  "supportedLanguageOrFormat",
  "relationExtraction",
  "dependencyResolution",
  "entrypointDiscovery",
  "mandatoryPrerequisiteModel",
  "dynamicResolution",
  "targetNormalizationPolicy",
  "coverageStatus",
  "evidenceRefs"
]);
const COMPLETENESS_FIELDS = new Set([
  "scopeId",
  "enumeration",
  "contentInspection",
  "relationshipInspection",
  "entrypointInventory",
  "dependencyResolution",
  "executionEvidenceInspection",
  "gitInspection",
  "declaredBy",
  "provenanceRefs",
  "completenessRuleId"
]);
const OWNER_DIMENSIONS = {
  "repository-scanner": new Set(["enumeration", "gitInspection", "entrypointInventory"]),
  "evidence-extractor": new Set(["contentInspection"]),
  "relationship-mapper": new Set(["relationshipInspection", "dependencyResolution"])
};
const COMPLETENESS_DIMENSIONS = [
  "enumeration",
  "contentInspection",
  "relationshipInspection",
  "entrypointInventory",
  "dependencyResolution",
  "executionEvidenceInspection",
  "gitInspection"
];

function assertRuleset(rulesetVersion) {
  if (rulesetVersion !== RULESET_VERSION) {
    throw new Error(`UNSUPPORTED_RULESET_VERSION:${rulesetVersion || "null"}`);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compareCodePointStrings(left, right) {
  const leftPoints = Array.from(String(left).normalize("NFC"));
  const rightPoints = Array.from(String(right).normalize("NFC"));
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const delta = leftPoints[index].codePointAt(0) - rightPoints[index].codePointAt(0);
    if (delta !== 0) return delta;
  }
  return leftPoints.length - rightPoints.length;
}

function normalizeStringSet(values, fieldName, prefix = null) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}`);
  }
  const seen = new Set();
  const normalized = [];
  for (const value of values) {
    if (typeof value !== "string" || (prefix && (!value.startsWith(prefix) || value.length === prefix.length))) {
      throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}`);
    }
    const text = value.normalize("NFC");
    if (!seen.has(text)) {
      seen.add(text);
      normalized.push(text);
    }
  }
  normalized.sort(compareCodePointStrings);
  return normalized;
}

function validateExactFields(record, fields, fieldName) {
  if (!isPlainObject(record)) {
    throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${fieldName}`);
  }
  for (const key of Object.keys(record)) {
    if (!fields.has(key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${fieldName}.${key}`);
    }
  }
  for (const key of fields) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${fieldName}.${key}`);
    }
  }
}

function validateRequiredString(value, fieldName, prefix = null) {
  if (typeof value !== "string" || value.length === 0 || (prefix && (!value.startsWith(prefix) || value.length === prefix.length))) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}`);
  }
  return value.normalize("NFC");
}

function validateEnum(value, values, fieldName) {
  if (!values.has(value)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}:${value}`);
  }
  return value;
}

function hasKnownRefs(refs, knownEvidenceIds) {
  return refs.every((ref) => !knownEvidenceIds || knownEvidenceIds.has(ref));
}

function validateCaptureCompleteness(record, context = {}, rulesetVersion = RULESET_VERSION) {
  assertRuleset(rulesetVersion);
  validateExactFields(record, COMPLETENESS_FIELDS, "captureCompleteness");
  const normalized = {
    scopeId: validateRequiredString(record.scopeId, "scopeId", "scope:"),
    enumeration: validateEnum(record.enumeration, COMPLETE_SET, "enumeration"),
    contentInspection: validateEnum(record.contentInspection, COMPLETE_SET, "contentInspection"),
    relationshipInspection: validateEnum(record.relationshipInspection, COMPLETE_SET, "relationshipInspection"),
    entrypointInventory: validateEnum(record.entrypointInventory, COMPLETE_NA_SET, "entrypointInventory"),
    dependencyResolution: validateEnum(record.dependencyResolution, COMPLETE_NA_SET, "dependencyResolution"),
    executionEvidenceInspection: validateEnum(record.executionEvidenceInspection, COMPLETE_NA_SET, "executionEvidenceInspection"),
    gitInspection: validateEnum(record.gitInspection, COMPLETE_NA_SET, "gitInspection"),
    declaredBy: record.declaredBy,
    provenanceRefs: normalizeStringSet(record.provenanceRefs, "provenanceRefs", "ev:"),
    completenessRuleId: validateRequiredString(record.completenessRuleId, "completenessRuleId", "SE-V1-COMP-")
  };
  if (!OWNERS.has(normalized.declaredBy)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:declaredBy:${normalized.declaredBy}`);
  }
  const scopeKnown = !context.scopeIds || context.scopeIds.has(normalized.scopeId);
  const provenanceKnown = hasKnownRefs(normalized.provenanceRefs, context.evidenceIds);
  const usable = {};
  for (const dimension of COMPLETENESS_DIMENSIONS) {
    const ownerMayDeclare = OWNER_DIMENSIONS[normalized.declaredBy].has(dimension);
    const value = normalized[dimension];
    usable[dimension] = scopeKnown && provenanceKnown && ownerMayDeclare ? value : "UNKNOWN";
  }
  return {
    ok: true,
    captureCompleteness: normalized,
    usableDimensions: usable,
    invalidDerivationRuleId: Object.values(usable).some((value, index) => value !== normalized[COMPLETENESS_DIMENSIONS[index]])
      ? "SE-V1-COMP-INVALID"
      : null
  };
}

function validateAdapterCoverage(record, context = {}, rulesetVersion = RULESET_VERSION) {
  assertRuleset(rulesetVersion);
  validateExactFields(record, COVERAGE_FIELDS, "adapterCoverage");
  normalizeTargetToken("", record.targetNormalizationPolicy);
  const normalized = {
    adapterId: validateRequiredString(record.adapterId, "adapterId", "adapter:"),
    adapterVersion: validateRequiredString(record.adapterVersion, "adapterVersion"),
    scopeId: validateRequiredString(record.scopeId, "scopeId", "scope:"),
    artifactFamily: validateEnum(record.artifactFamily, ARTIFACT_FAMILIES, "artifactFamily"),
    supportedLanguageOrFormat: validateRequiredString(record.supportedLanguageOrFormat, "supportedLanguageOrFormat"),
    relationExtraction: validateEnum(record.relationExtraction, COMPLETE_NA_SET, "relationExtraction"),
    dependencyResolution: validateEnum(record.dependencyResolution, COMPLETE_NA_SET, "dependencyResolution"),
    entrypointDiscovery: validateEnum(record.entrypointDiscovery, COMPLETE_NA_SET, "entrypointDiscovery"),
    mandatoryPrerequisiteModel: validateEnum(record.mandatoryPrerequisiteModel, COMPLETE_NA_SET, "mandatoryPrerequisiteModel"),
    dynamicResolution: validateEnum(record.dynamicResolution, DYNAMIC_VALUES, "dynamicResolution"),
    targetNormalizationPolicy: { ...record.targetNormalizationPolicy },
    coverageStatus: validateEnum(record.coverageStatus, COMPLETE_SET, "coverageStatus"),
    evidenceRefs: normalizeStringSet(record.evidenceRefs, "evidenceRefs", "ev:")
  };
  if (context.scopeIds && !context.scopeIds.has(normalized.scopeId)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:scopeId:unresolved:${normalized.scopeId}`);
  }
  if (!hasKnownRefs(normalized.evidenceRefs, context.evidenceIds)) {
    throw new Error("SCHEMA_UNSUPPORTED_VALUE:evidenceRefs:unresolved");
  }
  return { ok: true, adapterCoverage: normalized };
}

function completenessGate(result, dimensions) {
  if (!result || !result.usableDimensions) return "UNKNOWN";
  return dimensions.every((dimension) => result.usableDimensions[dimension] === "COMPLETE") ? "COMPLETE" : "UNKNOWN";
}

function absentFromCaptureGate(result, targetIdentificationDeterministic) {
  return completenessGate(result, ["enumeration"]) === "COMPLETE" && targetIdentificationDeterministic ? "ALLOWED" : "UNKNOWN";
}

function notConnectedGate(result, resolvedIdentities) {
  return completenessGate(result, ["relationshipInspection"]) === "COMPLETE" && resolvedIdentities ? "ALLOWED" : "UNKNOWN";
}

function notReachableGate(result, noUnresolvedFrontier) {
  return completenessGate(result, ["entrypointInventory", "relationshipInspection", "dependencyResolution"]) === "COMPLETE" && noUnresolvedFrontier ? "ALLOWED" : "UNKNOWN";
}

function notExecutableGate(completenessResult, adapterResult, blockingPrerequisiteMissing) {
  const adapter = adapterResult && adapterResult.adapterCoverage;
  if (!adapter ||
      adapter.mandatoryPrerequisiteModel !== "COMPLETE" ||
      adapter.coverageStatus !== "COMPLETE" ||
      completenessGate(completenessResult, ["enumeration", "dependencyResolution"]) !== "COMPLETE" ||
      !blockingPrerequisiteMissing) {
    return "UNKNOWN";
  }
  return "ALLOWED";
}

module.exports = {
  RULESET_VERSION,
  absentFromCaptureGate,
  completenessGate,
  notConnectedGate,
  notExecutableGate,
  notReachableGate,
  validateAdapterCoverage,
  validateCaptureCompleteness
};
