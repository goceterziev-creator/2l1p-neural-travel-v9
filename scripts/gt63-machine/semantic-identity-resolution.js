"use strict";

const { compareTemporalFrameRefs } = require("./semantic-temporal-frame");

const RULESET_VERSION = "semantic-evidence-v1.0.1";

const RESOLUTION_STATUSES = new Set(["RESOLVED", "UNRESOLVED", "AMBIGUOUS", "CONTRADICTED"]);
const BRIDGE_STATUSES = new Set(["BRIDGED", "NOT_BRIDGED", "AMBIGUOUS", "CONTRADICTED"]);
const IDENTITY_FIELDS = new Set([
  "resolutionId",
  "scopeId",
  "temporalFrameRef",
  "sourceId",
  "adapterCoverageRef",
  "normalizedTargetKey",
  "resolvedTargetId",
  "aliases",
  "resolutionStatus",
  "crossScopeBridge",
  "evidenceRefs"
]);
const BRIDGE_FIELDS = new Set(["fromScopeId", "toScopeId", "bridgeStatus", "evidenceRefs"]);

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
    if (delta !== 0) {
      return delta;
    }
  }
  return leftPoints.length - rightPoints.length;
}

function normalizeStringSet(values, fieldName, prefix = null) {
  if (!Array.isArray(values)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}`);
  }
  const normalized = [];
  const seen = new Set();
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

function validateRequiredString(value, fieldName, prefix = null) {
  if (typeof value !== "string" || value.length === 0 || (prefix && (!value.startsWith(prefix) || value.length === prefix.length))) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}`);
  }
  return value.normalize("NFC");
}

function validateNullableTarget(value, fieldName) {
  if (value === null) {
    return null;
  }
  return validateEntityOrArtifactId(value, fieldName);
}

function validateEntityOrArtifactId(value, fieldName) {
  if (typeof value !== "string" ||
      value.length === 0 ||
      !(value.startsWith("artifact:") || value.startsWith("entity:")) ||
      value.endsWith(":")) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}`);
  }
  return value.normalize("NFC");
}

function validateKnownRef(value, knownValues, fieldName) {
  if (knownValues && !knownValues.has(value)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}:unresolved:${value}`);
  }
}

function validateCrossScopeBridge(bridge) {
  if (!isPlainObject(bridge)) {
    throw new Error("SCHEMA_UNSUPPORTED_FIELD:crossScopeBridge");
  }
  for (const key of Object.keys(bridge)) {
    if (!BRIDGE_FIELDS.has(key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:crossScopeBridge.${key}`);
    }
  }
  for (const key of BRIDGE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(bridge, key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:crossScopeBridge.${key}`);
    }
  }
  const normalized = {
    fromScopeId: validateRequiredString(bridge.fromScopeId, "crossScopeBridge.fromScopeId", "scope:"),
    toScopeId: validateRequiredString(bridge.toScopeId, "crossScopeBridge.toScopeId", "scope:"),
    bridgeStatus: bridge.bridgeStatus,
    evidenceRefs: normalizeStringSet(bridge.evidenceRefs, "crossScopeBridge.evidenceRefs", "ev:")
  };
  if (!BRIDGE_STATUSES.has(normalized.bridgeStatus)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:crossScopeBridge.bridgeStatus:${normalized.bridgeStatus}`);
  }
  return normalized;
}

function validateIdentityResolution(record, context = {}, rulesetVersion = RULESET_VERSION) {
  assertRuleset(rulesetVersion);
  if (!isPlainObject(record)) {
    throw new Error("SCHEMA_UNSUPPORTED_FIELD:identityResolution");
  }
  for (const key of Object.keys(record)) {
    if (!IDENTITY_FIELDS.has(key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${key}`);
    }
  }
  for (const key of IDENTITY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${key}`);
    }
  }

  const normalized = {
    resolutionId: validateRequiredString(record.resolutionId, "resolutionId", "idres:"),
    scopeId: validateRequiredString(record.scopeId, "scopeId", "scope:"),
    temporalFrameRef: validateRequiredString(record.temporalFrameRef, "temporalFrameRef", "time:"),
    sourceId: validateEntityOrArtifactId(record.sourceId, "sourceId"),
    adapterCoverageRef: validateRequiredString(record.adapterCoverageRef, "adapterCoverageRef", "adapter:"),
    normalizedTargetKey: validateRequiredString(record.normalizedTargetKey, "normalizedTargetKey"),
    resolvedTargetId: validateNullableTarget(record.resolvedTargetId, "resolvedTargetId"),
    aliases: normalizeStringSet(record.aliases, "aliases"),
    resolutionStatus: record.resolutionStatus,
    crossScopeBridge: validateCrossScopeBridge(record.crossScopeBridge),
    evidenceRefs: normalizeStringSet(record.evidenceRefs, "evidenceRefs", "ev:")
  };

  if (!RESOLUTION_STATUSES.has(normalized.resolutionStatus)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:resolutionStatus:${normalized.resolutionStatus}`);
  }
  if (normalized.resolutionStatus === "RESOLVED" && normalized.resolvedTargetId === null) {
    throw new Error("SCHEMA_UNSUPPORTED_VALUE:resolvedTargetId:requiredForResolved");
  }
  if (normalized.resolutionStatus !== "RESOLVED" && normalized.resolvedTargetId !== null) {
    throw new Error("SCHEMA_UNSUPPORTED_VALUE:resolvedTargetId:mustBeNullUnlessResolved");
  }

  validateKnownRef(normalized.scopeId, context.scopeIds, "scopeId");
  validateKnownRef(normalized.temporalFrameRef, context.temporalFrameIds, "temporalFrameRef");
  validateKnownRef(normalized.adapterCoverageRef, context.adapterCoverageIds, "adapterCoverageRef");
  for (const ref of normalized.evidenceRefs) {
    validateKnownRef(ref, context.evidenceIds, "evidenceRefs");
  }

  return {
    ok: true,
    identityResolution: normalized
  };
}

function validateIdentityResolutions(records, context = {}, rulesetVersion = RULESET_VERSION) {
  assertRuleset(rulesetVersion);
  if (!Array.isArray(records)) {
    throw new Error("SCHEMA_UNSUPPORTED_FIELD:identityResolution");
  }
  const byId = new Map();
  const duplicatedIds = new Set();
  const normalized = [];
  for (const record of records) {
    const result = validateIdentityResolution(record, context, rulesetVersion).identityResolution;
    if (byId.has(result.resolutionId)) {
      duplicatedIds.add(result.resolutionId);
    } else {
      byId.set(result.resolutionId, result);
    }
    normalized.push(result);
  }
  if (duplicatedIds.size > 0) {
    const selectedId = Array.from(duplicatedIds).sort(compareCodePointStrings)[0];
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:duplicateIdentityResolutionId:${selectedId}`);
  }
  normalized.sort((left, right) => compareCodePointStrings(left.resolutionId, right.resolutionId));
  return {
    ok: true,
    identityResolution: normalized
  };
}

function classifyTargetCandidates(targetIds, rulesetVersion = RULESET_VERSION) {
  assertRuleset(rulesetVersion);
  if (!Array.isArray(targetIds)) {
    throw new Error("SCHEMA_UNSUPPORTED_FIELD:targetCandidates");
  }
  const targets = normalizeStringSet(targetIds, "targetCandidates");
  for (const target of targets) {
    validateNullableTarget(target, "targetCandidates");
  }
  if (targets.length === 0) {
    return { resolutionStatus: "UNRESOLVED", resolvedTargetId: null, targetCandidates: [] };
  }
  if (targets.length === 1) {
    return { resolutionStatus: "RESOLVED", resolvedTargetId: targets[0], targetCandidates: targets };
  }
  return { resolutionStatus: "AMBIGUOUS", resolvedTargetId: null, targetCandidates: targets };
}

function hasEstablishedCrossScopeBridge(identityResolution) {
  const bridge = identityResolution.crossScopeBridge;
  return Boolean(bridge &&
    bridge.bridgeStatus === "BRIDGED" &&
    bridge.fromScopeId !== bridge.toScopeId &&
    bridge.evidenceRefs.length > 0);
}

function sameIdentityProposition(left, right) {
  return left.scopeId === right.scopeId &&
    left.sourceId === right.sourceId &&
    left.adapterCoverageRef === right.adapterCoverageRef &&
    left.normalizedTargetKey === right.normalizedTargetKey;
}

function materiallyIncompatible(left, right) {
  return left.resolutionStatus === "RESOLVED" &&
    right.resolutionStatus === "RESOLVED" &&
    left.resolvedTargetId !== right.resolvedTargetId;
}

function compareIdentityResolutionPair(leftRecord, rightRecord, temporalFrames, context = {}, rulesetVersion = RULESET_VERSION) {
  const left = validateIdentityResolution(leftRecord, context, rulesetVersion).identityResolution;
  const right = validateIdentityResolution(rightRecord, context, rulesetVersion).identityResolution;
  if (!sameIdentityProposition(left, right)) {
    return { result: "DIFFERENT_PROPOSITION", conflictRequired: false };
  }
  const temporalComparison = compareTemporalFrameRefs(left.temporalFrameRef, right.temporalFrameRef, temporalFrames, rulesetVersion);
  if (temporalComparison !== "SAME_FRAME") {
    return { result: "NO_CONFLICT", temporalComparison, conflictRequired: false };
  }
  if (!materiallyIncompatible(left, right)) {
    return { result: "COMPATIBLE", temporalComparison, conflictRequired: false };
  }
  const evidenceRefs = normalizeStringSet([...left.evidenceRefs, ...right.evidenceRefs], "evidenceRefs", "ev:");
  const members = normalizeStringSet([left.resolutionId, right.resolutionId], "identityResolutionRefs", "idres:");
  return {
    result: "CONTRADICTED",
    temporalComparison,
    resolutionStatus: "CONTRADICTED",
    conflictRequired: true,
    selectedTarget: null,
    conflict: {
      conflictType: "IDENTITY_RESOLUTION_CONFLICT",
      propositionKind: "identityResolution",
      provenanceScope: left.scopeId,
      sourceId: left.sourceId,
      adapterCoverageRef: left.adapterCoverageRef,
      normalizedTargetKey: left.normalizedTargetKey,
      semanticMembers: members,
      evidenceRefs
    }
  };
}

module.exports = {
  BRIDGE_STATUSES,
  RESOLUTION_STATUSES,
  RULESET_VERSION,
  classifyTargetCandidates,
  compareIdentityResolutionPair,
  hasEstablishedCrossScopeBridge,
  validateIdentityResolution,
  validateIdentityResolutions
};
