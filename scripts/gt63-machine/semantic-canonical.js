"use strict";

const crypto = require("crypto");

const RULESET_VERSION = "semantic-evidence-v1.0.0";
const STATEMENT_ID_PREFIX = "sem:";
const CONFLICT_ID_PREFIX = "conflict:";
const RELATIONSHIP_ID_PREFIX = "rel:";

const DEFAULT_SET_LIKE_KEYS = new Set([
  "aliases",
  "artifactIds",
  "authorityAssessmentIds",
  "basisEvidenceIds",
  "conflictMembers",
  "conflictRefs",
  "entityIds",
  "evidenceRefs",
  "identityResolutionRefs",
  "members",
  "relationMembers",
  "scopeRefs",
  "semanticMembers",
  "sourceEvidenceIds",
  "supportingEvidenceIds",
  "temporalFrameRefs"
]);

const DIRECT_RELATION_IDENTITY_FIELDS = [
  "capability",
  "schemaVersion",
  "rulesetVersion",
  "provenanceScope",
  "temporalFrameRef",
  "source",
  "relationType",
  "normalizedTargetKey",
  "adapterCoverageRef",
  "directOrDerived",
  "evidenceRefs"
];

const STATEMENT_IDENTITY_FIELDS = [
  "capability",
  "schemaVersion",
  "rulesetVersion",
  "outputCollection",
  "propositionKind",
  "artifactId",
  "entityId",
  "source",
  "target",
  "sourceArtifactId",
  "targetArtifactId",
  "sourceEntityId",
  "targetEntityId",
  "relationType",
  "normalizedTargetKey",
  "semanticState",
  "relationStatus",
  "derivationRuleId",
  "provenanceScope",
  "temporalFrameRef",
  "baselineRef",
  "adapterCoverageRef",
  "directOrDerived",
  "identityResolutionId",
  "resolutionStatus",
  "declaredIdentity",
  "observedIdentity",
  "identityAlignment",
  "artifactClassification",
  "evidenceType",
  "presenceState",
  "connectionState",
  "generatorState",
  "binaryIntegrationState",
  "executionState",
  "executabilityState",
  "temporalComparison",
  "currentBaselineRef",
  "scopeRef",
  "aliases",
  "evidenceRefs"
];

const CONFLICT_IDENTITY_FIELDS = [
  "capability",
  "schemaVersion",
  "rulesetVersion",
  "propositionKind",
  "artifactId",
  "entityId",
  "source",
  "target",
  "relationType",
  "conflictType",
  "provenanceScope",
  "temporalFrameRef",
  "semanticMembers",
  "conflictMembers",
  "members",
  "evidenceRefs"
];

const NON_IDENTITY_PRESENTATION_FIELDS = new Set([
  "conflictId",
  "displayLabel",
  "explanation",
  "id",
  "notes",
  "renderHint",
  "runtimeDebug",
  "statementId",
  "temporaryMetadata"
]);

function compareCodePointStrings(left, right) {
  const leftText = String(left);
  const rightText = String(right);
  const leftPoints = Array.from(leftText);
  const rightPoints = Array.from(rightText);
  const length = Math.min(leftPoints.length, rightPoints.length);

  for (let index = 0; index < length; index += 1) {
    const leftCode = leftPoints[index].codePointAt(0);
    const rightCode = rightPoints[index].codePointAt(0);
    if (leftCode !== rightCode) {
      return leftCode - rightCode;
    }
  }

  return leftPoints.length - rightPoints.length;
}

function sha256LowerHex(value) {
  return crypto.createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

function assertRuleset(rulesetVersion) {
  if (rulesetVersion !== RULESET_VERSION) {
    throw new Error(`UNSUPPORTED_RULESET_VERSION:${rulesetVersion || "null"}`);
  }
}

function normalizeString(value) {
  return String(value).normalize("NFC");
}

function jsonString(value) {
  return JSON.stringify(normalizeString(value));
}

function isSetLikeArray(path, setLikeKeys) {
  const key = path[path.length - 1];
  return Boolean(key && setLikeKeys.has(key));
}

function canonicalSerialize(value, options = {}) {
  const setLikeKeys = new Set([...(options.setLikeKeys || DEFAULT_SET_LIKE_KEYS)]);
  const integerKeys = new Set([...(options.integerKeys || [])]);

  function isIntegerPermitted(path) {
    const key = path[path.length - 1];
    const fullPath = path.join(".");
    return integerKeys.has(key) || integerKeys.has(fullPath);
  }

  function serialize(current, path) {
    if (current === null) {
      return "null";
    }

    if (typeof current === "string") {
      return jsonString(current);
    }

    if (typeof current === "boolean") {
      return current ? "true" : "false";
    }

    if (typeof current === "number") {
      if (!isIntegerPermitted(path) || !Number.isSafeInteger(current) || Object.is(current, -0)) {
        throw new Error("UNSUPPORTED_NUMBER");
      }
      return String(current);
    }

    if (Array.isArray(current)) {
      if (isSetLikeArray(path, setLikeKeys)) {
        const uniqueBySemanticValue = new Map();
        for (const item of current) {
          const key = typeof item === "string" ? `s:${normalizeString(item)}` : `j:${serialize(item, path.concat("*"))}`;
          if (!uniqueBySemanticValue.has(key)) {
            uniqueBySemanticValue.set(key, item);
          }
        }
        const unique = Array.from(uniqueBySemanticValue.values());
        unique.sort((left, right) => {
          if (typeof left === "string" && typeof right === "string") {
            return compareCodePointStrings(normalizeString(left), normalizeString(right));
          }
          return compareCodePointStrings(serialize(left, path.concat("*")), serialize(right, path.concat("*")));
        });
        const serialized = unique.map((item) => serialize(item, path.concat("*")));
        return `[${serialized.join(",")}]`;
      }
      const serialized = current.map((item, index) => serialize(item, path.concat(String(index))));
      return `[${serialized.join(",")}]`;
    }

    if (typeof current === "object") {
      const entries = Object.keys(current).map((key) => {
        const normalizedKey = normalizeString(key);
        const entryValue = current[key];
        if (typeof entryValue === "undefined" || typeof entryValue === "function" || typeof entryValue === "symbol") {
          throw new Error(`UNSUPPORTED_VALUE:${normalizedKey}`);
        }
        return [normalizedKey, entryValue];
      });

      const seen = new Set();
      for (const [key] of entries) {
        if (seen.has(key)) {
          throw new Error(`DUPLICATE_NORMALIZED_KEY:${key}`);
        }
        seen.add(key);
      }

      entries.sort((left, right) => compareCodePointStrings(left[0], right[0]));
      return `{${entries.map(([key, entryValue]) => `${jsonString(key)}:${serialize(entryValue, path.concat(key))}`).join(",")}}`;
    }

    throw new Error(`UNSUPPORTED_VALUE_TYPE:${typeof current}`);
  }

  return serialize(value, []);
}

function projectIdentity(value, fields, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context}_MUST_BE_OBJECT`);
  }
  const allowed = new Set(fields);
  const result = {};
  for (const key of Object.keys(value)) {
    if (allowed.has(key)) {
      result[key] = value[key];
    } else if (!NON_IDENTITY_PRESENTATION_FIELDS.has(key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${key}`);
    }
  }
  return result;
}

function canonicalHash(value, options) {
  return sha256LowerHex(canonicalSerialize(value, options));
}

function semanticStatementId(statement) {
  assertRuleset(statement && statement.rulesetVersion);
  return `${STATEMENT_ID_PREFIX}${canonicalHash(projectIdentity(statement, STATEMENT_IDENTITY_FIELDS, "STATEMENT"))}`;
}

function conflictId(conflict) {
  assertRuleset(conflict && conflict.rulesetVersion);
  return `${CONFLICT_ID_PREFIX}${canonicalHash(projectIdentity(conflict, CONFLICT_IDENTITY_FIELDS, "CONFLICT"))}`;
}

function directRelationIdentity(relation) {
  assertRuleset(relation && relation.rulesetVersion);
  const identity = {};
  for (const field of DIRECT_RELATION_IDENTITY_FIELDS) {
    identity[field] = Object.prototype.hasOwnProperty.call(relation, field) ? relation[field] : null;
  }
  return identity;
}

function directRelationshipId(relation) {
  return `${RELATIONSHIP_ID_PREFIX}${canonicalHash(directRelationIdentity(relation))}`;
}

module.exports = {
  RULESET_VERSION,
  canonicalHash,
  canonicalSerialize,
  compareCodePointStrings,
  conflictId,
  directRelationIdentity,
  directRelationshipId,
  semanticStatementId,
  sha256LowerHex
};
