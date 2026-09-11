"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "governance-evidence-object-production-v0.1.0";
const OUTCOMES = Object.freeze({
  PRODUCED: "PRODUCED",
  NOT_PRODUCED: "NOT_PRODUCED",
  UNKNOWN: "UNKNOWN",
  INVALID: "INVALID"
});

const ISSUER = Object.freeze({
  issuerRef: "gt63-machine:issuer:governance-evidence-v0",
  issuerRevision: "1"
});

const SOURCES = Object.freeze({
  POLICY: Object.freeze({
    sourceRef: "gt63-machine:repository-source:governance-role-policy",
    sourceRevision: "1",
    type: "GOVERNANCE_ROLE_POLICY"
  }),
  ASSIGNMENT: Object.freeze({
    sourceRef: "gt63-machine:repository-source:direct-principal-role-assignment",
    sourceRevision: "1",
    type: "DIRECT_PRINCIPAL_ROLE_ASSIGNMENT"
  }),
  DELEGATION: Object.freeze({
    sourceRef: "gt63-machine:repository-source:direct-delegation-grant",
    sourceRevision: "1",
    type: "DIRECT_DELEGATION_GRANT"
  })
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}

function digest(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function exact(record, fields) {
  return Boolean(record && typeof record === "object" && !Array.isArray(record)
    && Object.keys(record).length === fields.length
    && Object.keys(record).every((key) => fields.includes(key)));
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

function nullableString(value) {
  return value === null || nonEmpty(value);
}

function base(outcome, reason) {
  return {
    rulesetVersion: RULESET_VERSION,
    outcome,
    reason: reason || null,
    evidenceObject: null,
    productionEvidence: null,
    authority: "NONE",
    evidenceAccepted: false,
    principalEligibilityCreated: false,
    authorizationCreated: false,
    humanGateSatisfied: false,
    continuationAuthorityCreated: false,
    executionAuthorityCreated: false,
    effectAuthorized: false
  };
}

function validContextScope(scope) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return false;
  if (!["INTERACTION", "INTENT", "GATE"].includes(scope.scopeType)) return false;
  const baseFields = ["scopeType", "interactionId", "fromInteractionRevision", "throughInteractionRevision"];
  const fields = scope.scopeType === "INTERACTION" ? baseFields
    : scope.scopeType === "INTENT"
      ? [...baseFields, "intentContractRef", "intentContractDigest"]
      : [...baseFields, "gateId", "gateRevision", "authorityScopeDigest", "continuationTargetRef"];
  if (!exact(scope, fields) || !nonEmpty(scope.interactionId)
    || !Number.isInteger(scope.fromInteractionRevision) || scope.fromInteractionRevision < 0
    || !(scope.throughInteractionRevision === null
      || (Number.isInteger(scope.throughInteractionRevision)
        && scope.throughInteractionRevision >= scope.fromInteractionRevision))) return false;
  if (scope.scopeType === "INTENT") {
    return nonEmpty(scope.intentContractRef) && /^sha256:[0-9a-f]{64}$/.test(scope.intentContractDigest);
  }
  if (scope.scopeType === "GATE") {
    return nonEmpty(scope.gateId)
      && Number.isInteger(scope.gateRevision) && scope.gateRevision > 0
      && /^sha256:[0-9a-f]{64}$/.test(scope.authorityScopeDigest || "")
      && nonEmpty(scope.continuationTargetRef);
  }
  return true;
}

function validPolicyMaterial(material) {
  const fields = ["policyRef", "policyRevision", "policyDocument", "validFromTemporalFrameRef",
    "validThroughTemporalFrameRef", "lifecycleState", "supersedesPolicyRef"];
  return exact(material, fields)
    && nonEmpty(material.policyRef)
    && nonEmpty(material.policyRevision)
    && material.policyDocument && typeof material.policyDocument === "object" && !Array.isArray(material.policyDocument)
    && nonEmpty(material.validFromTemporalFrameRef)
    && nullableString(material.validThroughTemporalFrameRef)
    && ["CURRENT", "STALE", "REVOKED", "DEACTIVATED", "SUPERSEDED", "UNKNOWN", "CONFLICT"].includes(material.lifecycleState)
    && nullableString(material.supersedesPolicyRef);
}

function validAssignmentMaterial(material) {
  const fields = ["assignmentRef", "assignmentRevision", "principalRef", "principalRevision", "roleRef",
    "roleRevision", "policyRef", "policyRevision", "contextScope", "validFromTemporalFrameRef",
    "validThroughTemporalFrameRef", "lifecycleState", "supersedesAssignmentRef"];
  return exact(material, fields)
    && ["assignmentRef", "assignmentRevision", "principalRef", "principalRevision", "roleRef",
      "roleRevision", "policyRef", "policyRevision", "validFromTemporalFrameRef"].every((f) => nonEmpty(material[f]))
    && validContextScope(material.contextScope)
    && nullableString(material.validThroughTemporalFrameRef)
    && ["CURRENT", "STALE", "REVOKED", "DEACTIVATED", "SUPERSEDED", "UNKNOWN", "CONFLICT"].includes(material.lifecycleState)
    && nullableString(material.supersedesAssignmentRef);
}

function validDelegationMaterial(material) {
  const fields = ["delegationRef", "delegationRevision", "sourceEventBindingRef", "grantBytesBase64", "grantContentEncoding"];
  if (!exact(material, fields)
    || !["delegationRef", "delegationRevision", "sourceEventBindingRef", "grantBytesBase64", "grantContentEncoding"].every((f) => nonEmpty(material[f]))
    || material.grantContentEncoding !== "utf-8") return false;
  try {
    const bytes = Buffer.from(material.grantBytesBase64, "base64");
    return bytes.length > 0 && bytes.toString("base64") === material.grantBytesBase64;
  } catch (_) {
    return false;
  }
}

function buildSnapshot(subjectKind, source, material) {
  if (subjectKind === "POLICY") {
    return Object.freeze({
      type: source.type,
      policyRef: material.policyRef,
      policyRevision: material.policyRevision,
      sourceRef: source.sourceRef,
      sourceRevision: source.sourceRevision,
      policyDocument: canonicalize(material.policyDocument),
      validFromTemporalFrameRef: material.validFromTemporalFrameRef,
      validThroughTemporalFrameRef: material.validThroughTemporalFrameRef,
      lifecycleState: material.lifecycleState,
      supersedesPolicyRef: material.supersedesPolicyRef,
      policyEvidenceRef: digest({subjectKind, sourceRef: source.sourceRef, sourceRevision: source.sourceRevision, material})
    });
  }
  if (subjectKind === "ASSIGNMENT") {
    return Object.freeze({
      type: source.type,
      assignmentRef: material.assignmentRef,
      assignmentRevision: material.assignmentRevision,
      sourceRef: source.sourceRef,
      sourceRevision: source.sourceRevision,
      principalRef: material.principalRef,
      principalRevision: material.principalRevision,
      roleRef: material.roleRef,
      roleRevision: material.roleRevision,
      policyRef: material.policyRef,
      policyRevision: material.policyRevision,
      contextScope: canonicalize(material.contextScope),
      validFromTemporalFrameRef: material.validFromTemporalFrameRef,
      validThroughTemporalFrameRef: material.validThroughTemporalFrameRef,
      lifecycleState: material.lifecycleState,
      supersedesAssignmentRef: material.supersedesAssignmentRef,
      assignmentEvidenceRef: digest({subjectKind, sourceRef: source.sourceRef, sourceRevision: source.sourceRevision, material})
    });
  }
  return Object.freeze({
    type: source.type,
    delegationRef: material.delegationRef,
    delegationRevision: material.delegationRevision,
    sourceRef: source.sourceRef,
    sourceRevision: source.sourceRevision,
    sourceEventBindingRef: material.sourceEventBindingRef,
    grantBytesBase64: material.grantBytesBase64,
    grantContentEncoding: material.grantContentEncoding,
    grantEvidenceRef: digest({subjectKind, sourceRef: source.sourceRef, sourceRevision: source.sourceRevision, material})
  });
}

function createGovernanceEvidenceObjectProduction({ issuerSourceBindingPort } = {}) {
  if (typeof issuerSourceBindingPort !== "function") throw new TypeError("issuerSourceBindingPort is required");

  return Object.freeze({
    produce(request) {
      const fields = ["rulesetVersion", "issuerRef", "issuerRevision", "subjectKind", "material"];
      if (!exact(request, fields) || request.rulesetVersion !== RULESET_VERSION || !SOURCES[request.subjectKind]) {
        return base(OUTCOMES.INVALID, "INVALID_REQUEST");
      }
      if (request.issuerRef !== ISSUER.issuerRef || request.issuerRevision !== ISSUER.issuerRevision) {
        return base(OUTCOMES.NOT_PRODUCED, "ISSUER_IDENTITY_MISMATCH");
      }
      const source = SOURCES[request.subjectKind];
      const materialValid = request.subjectKind === "POLICY" ? validPolicyMaterial(request.material)
        : request.subjectKind === "ASSIGNMENT" ? validAssignmentMaterial(request.material)
          : validDelegationMaterial(request.material);
      if (!materialValid) return base(OUTCOMES.INVALID, "INVALID_TYPED_MATERIAL");

      let binding;
      try {
        binding = issuerSourceBindingPort({
          issuerRef: request.issuerRef,
          issuerRevision: request.issuerRevision,
          subjectKind: request.subjectKind,
          sourceRef: source.sourceRef,
          sourceRevision: source.sourceRevision
        });
      } catch (_) {
        return base(OUTCOMES.UNKNOWN, "ISSUER_SOURCE_BINDING_UNAVAILABLE");
      }
      if (!binding || binding.outcome !== "BOUND" || binding.authority !== "NONE" || !binding.evidence
        || binding.evidence.issuerRef !== request.issuerRef
        || binding.evidence.issuerRevision !== request.issuerRevision
        || binding.evidence.subjectKind !== request.subjectKind
        || binding.evidence.sourceRef !== source.sourceRef
        || binding.evidence.sourceRevision !== source.sourceRevision) {
        return base(OUTCOMES.NOT_PRODUCED, "ISSUER_SOURCE_NOT_EXACTLY_BOUND");
      }

      const evidenceObject = buildSnapshot(request.subjectKind, source, request.material);
      const productionEvidence = Object.freeze({
        type: "GOVERNANCE_EVIDENCE_OBJECT_PRODUCTION_EVIDENCE",
        issuerRef: request.issuerRef,
        issuerRevision: request.issuerRevision,
        subjectKind: request.subjectKind,
        sourceRef: source.sourceRef,
        sourceRevision: source.sourceRevision,
        bindingEvidenceRef: binding.evidence.bindingEvidenceRef,
        evidenceObjectDigest: digest(evidenceObject),
        productionEvidenceRef: digest({
          issuerRef: request.issuerRef,
          issuerRevision: request.issuerRevision,
          subjectKind: request.subjectKind,
          sourceRef: source.sourceRef,
          sourceRevision: source.sourceRevision,
          bindingEvidenceRef: binding.evidence.bindingEvidenceRef,
          evidenceObject
        }),
        authority: "NONE"
      });
      return Object.freeze({...base(OUTCOMES.PRODUCED, null), evidenceObject, productionEvidence});
    }
  });
}

module.exports = {
  RULESET_VERSION,
  OUTCOMES,
  ISSUER,
  SOURCES,
  createGovernanceEvidenceObjectProduction
};
