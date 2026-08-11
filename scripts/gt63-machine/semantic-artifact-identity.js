"use strict";

const { canonicalHash } = require("./semantic-canonical");

const RULESET_VERSION = "semantic-evidence-v1.0.1";

const CLASSIFICATIONS = new Set([
  "EXECUTABLE_SOURCE",
  "CONFIGURATION",
  "DOCUMENTATION",
  "HTML_DOCUMENT",
  "GENERATED_OUTPUT",
  "BINARY_ARTIFACT",
  "ARCHIVE",
  "REPOSITORY_METADATA",
  "RUNTIME_LOG",
  "DATA_FILE",
  "UNKNOWN_ARTIFACT"
]);
const ALIGNMENTS = new Set(["MATCH", "MISMATCH", "PARTIAL_MATCH", "NOT_COMPARABLE", "UNKNOWN"]);
const OBSERVATION_KINDS = new Set([
  "VALIDATED_PARSER",
  "MAGIC_BYTES",
  "VALIDATED_SYNTAX",
  "DECLARED_MIME",
  "EXTENSION",
  "FILENAME_LABEL"
]);
const OBSERVATION_STATUSES = new Set(["OBSERVED", "PARSE_FAILED", "UNREADABLE", "UNSUPPORTED", "CONFLICTING", "UNKNOWN"]);
const ARTIFACT_FIELDS = new Set(["artifactId", "scopeId", "declaredIdentity", "observedIdentity", "classification", "evidenceRefs"]);
const DECLARED_FIELDS = new Set(["declaredType", "declaredMime", "extension", "filenameLabel", "evidenceRefs"]);
const OBSERVED_FIELDS = new Set(["observedType", "observationKind", "parserId", "parserVersion", "observationStatus", "evidenceRefs"]);
const PRECEDENCE = {
  VALIDATED_PARSER: 6,
  MAGIC_BYTES: 5,
  VALIDATED_SYNTAX: 4,
  DECLARED_MIME: 3,
  EXTENSION: 2,
  FILENAME_LABEL: 1
};

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

function validateNullableString(value, fieldName) {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}`);
  }
  return value.normalize("NFC");
}

function validateRequiredString(value, fieldName, prefix) {
  if (typeof value !== "string" || !value.startsWith(prefix) || value.length === prefix.length) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}`);
  }
  return value.normalize("NFC");
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

function validateDeclaredIdentity(value) {
  validateExactFields(value, DECLARED_FIELDS, "declaredIdentity");
  return {
    declaredType: validateNullableString(value.declaredType, "declaredIdentity.declaredType"),
    declaredMime: validateNullableString(value.declaredMime, "declaredIdentity.declaredMime"),
    extension: validateNullableString(value.extension, "declaredIdentity.extension"),
    filenameLabel: validateNullableString(value.filenameLabel, "declaredIdentity.filenameLabel"),
    evidenceRefs: normalizeStringSet(value.evidenceRefs, "declaredIdentity.evidenceRefs", "ev:")
  };
}

function validateObservedIdentity(value) {
  validateExactFields(value, OBSERVED_FIELDS, "observedIdentity");
  const observed = {
    observedType: validateNullableString(value.observedType, "observedIdentity.observedType"),
    observationKind: value.observationKind,
    parserId: value.parserId === null ? null : validateRequiredString(value.parserId, "observedIdentity.parserId", "adapter:"),
    parserVersion: validateNullableString(value.parserVersion, "observedIdentity.parserVersion"),
    observationStatus: value.observationStatus,
    evidenceRefs: normalizeStringSet(value.evidenceRefs, "observedIdentity.evidenceRefs", "ev:")
  };
  if (!OBSERVATION_KINDS.has(observed.observationKind)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:observedIdentity.observationKind:${observed.observationKind}`);
  }
  if (!OBSERVATION_STATUSES.has(observed.observationStatus)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:observedIdentity.observationStatus:${observed.observationStatus}`);
  }
  if (observed.observationStatus === "OBSERVED" && observed.observedType === null) {
    throw new Error("SCHEMA_UNSUPPORTED_VALUE:observedIdentity.observedType:requiredForObserved");
  }
  return observed;
}

function validateArtifactClassification(record, rulesetVersion = RULESET_VERSION) {
  assertRuleset(rulesetVersion);
  validateExactFields(record, ARTIFACT_FIELDS, "artifactClassification");
  const normalized = {
    artifactId: validateRequiredString(record.artifactId, "artifactId", "artifact:"),
    scopeId: validateRequiredString(record.scopeId, "scopeId", "scope:"),
    declaredIdentity: validateDeclaredIdentity(record.declaredIdentity),
    observedIdentity: validateObservedIdentity(record.observedIdentity),
    classification: record.classification,
    evidenceRefs: normalizeStringSet(record.evidenceRefs, "evidenceRefs", "ev:")
  };
  if (!CLASSIFICATIONS.has(normalized.classification)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:classification:${normalized.classification}`);
  }
  return {
    ok: true,
    artifactClassification: normalized
  };
}

function qualifyingObservedIdentity(observedIdentity) {
  return observedIdentity.observationStatus === "OBSERVED" && observedIdentity.observedType !== null;
}

function strongestDeclaredType(declaredIdentity) {
  return declaredIdentity.declaredType ||
    declaredIdentity.declaredMime ||
    declaredIdentity.extension ||
    declaredIdentity.filenameLabel ||
    null;
}

function alignmentFor(declaredIdentity, observedIdentity) {
  if (!qualifyingObservedIdentity(observedIdentity)) {
    return "UNKNOWN";
  }
  const declaredType = strongestDeclaredType(declaredIdentity);
  if (declaredType === null) {
    return "UNKNOWN";
  }
  return declaredType === observedIdentity.observedType ? "MATCH" : "MISMATCH";
}

function selectObservedIdentity(observations, baseRecord, rulesetVersion = RULESET_VERSION) {
  assertRuleset(rulesetVersion);
  if (!Array.isArray(observations)) {
    throw new Error("SCHEMA_UNSUPPORTED_FIELD:observedIdentityCandidates");
  }
  const candidates = observations
    .map(validateObservedIdentity)
    .filter(qualifyingObservedIdentity);
  if (candidates.length === 0) {
    return {
      observedIdentity: validateObservedIdentity(baseRecord.observedIdentity),
      identityAlignment: "UNKNOWN",
      conflict: null
    };
  }
  const maxPrecedence = Math.max(...candidates.map((candidate) => PRECEDENCE[candidate.observationKind]));
  const top = candidates.filter((candidate) => PRECEDENCE[candidate.observationKind] === maxPrecedence);
  const topTypes = normalizeStringSet(top.map((candidate) => candidate.observedType), "observedTypes");
  if (topTypes.length > 1) {
    const evidenceRefs = normalizeStringSet(top.flatMap((candidate) => candidate.evidenceRefs), "evidenceRefs", "ev:");
    const conflict = {
      capability: "semantic-evidence",
      schemaVersion: "1.0",
      rulesetVersion,
      propositionKind: "artifactIdentity",
      artifactId: baseRecord.artifactId,
      conflictType: "ARTIFACT_IDENTITY_OBSERVATION_CONFLICT",
      provenanceScope: baseRecord.scopeId,
      temporalFrameRef: null,
      semanticMembers: topTypes,
      evidenceRefs
    };
    conflict.conflictId = `conflict:${canonicalHash(conflict)}`;
    return {
      observedIdentity: {
        observedType: null,
        observationKind: top[0].observationKind,
        parserId: null,
        parserVersion: null,
        observationStatus: "CONFLICTING",
        evidenceRefs
      },
      identityAlignment: "UNKNOWN",
      conflict
    };
  }
  const selected = top.slice().sort((left, right) => compareCodePointStrings(left.observedType, right.observedType))[0];
  return {
    observedIdentity: selected,
    identityAlignment: alignmentFor(baseRecord.declaredIdentity, selected),
    conflict: null
  };
}

function assessArtifactIdentity(record, options = {}, rulesetVersion = RULESET_VERSION) {
  const normalized = validateArtifactClassification(record, rulesetVersion).artifactClassification;
  const selected = options.observedIdentityCandidates
    ? selectObservedIdentity(options.observedIdentityCandidates, normalized, rulesetVersion)
    : {
        observedIdentity: normalized.observedIdentity,
        identityAlignment: alignmentFor(normalized.declaredIdentity, normalized.observedIdentity),
        conflict: null
      };
  if (!ALIGNMENTS.has(selected.identityAlignment)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:identityAlignment:${selected.identityAlignment}`);
  }
  return {
    artifactId: normalized.artifactId,
    scopeId: normalized.scopeId,
    declaredIdentity: normalized.declaredIdentity,
    observedIdentity: selected.observedIdentity,
    classification: normalized.classification,
    identityAlignment: selected.identityAlignment,
    semanticState: selected.identityAlignment === "UNKNOWN" ? "UNKNOWN" : "ESTABLISHED",
    evidenceRefs: normalizeStringSet([
      ...normalized.evidenceRefs,
      ...normalized.declaredIdentity.evidenceRefs,
      ...selected.observedIdentity.evidenceRefs
    ], "evidenceRefs", "ev:"),
    conflict: selected.conflict
  };
}

module.exports = {
  ALIGNMENTS,
  CLASSIFICATIONS,
  OBSERVATION_KINDS,
  OBSERVATION_STATUSES,
  RULESET_VERSION,
  assessArtifactIdentity,
  selectObservedIdentity,
  validateArtifactClassification,
  validateDeclaredIdentity,
  validateObservedIdentity
};
