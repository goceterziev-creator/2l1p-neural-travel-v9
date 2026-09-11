"use strict";

const {
  POLICY_RULESET_VERSION,
  ASSIGNMENT_RULESET_VERSION,
  DELEGATION_RULESET_VERSION,
  POLICY_OUTCOMES,
  ASSIGNMENT_OUTCOMES,
  DELEGATION_OUTCOMES,
  createGovernanceRolePolicyRequirementEvidenceAcceptance,
  createDirectPrincipalRoleAssignmentEvidenceAcceptance,
  createDirectDelegationEvidenceAcceptance
} = require("./accepted-governance-role-evidence");

const RULESET_VERSION = "governance-evidence-production-to-acceptance-wiring-v0.1.0";
const OUTCOMES = Object.freeze({
  ACCEPTED: "ACCEPTED",
  ALREADY_ACCEPTED: "ALREADY_ACCEPTED",
  NOT_ACCEPTED: "NOT_ACCEPTED",
  UNKNOWN: "UNKNOWN",
  INVALID: "INVALID"
});

const ACCEPTED = Object.freeze({
  POLICY: new Set([POLICY_OUTCOMES.ACCEPTED, POLICY_OUTCOMES.ALREADY_ACCEPTED]),
  ASSIGNMENT: new Set([ASSIGNMENT_OUTCOMES.ACCEPTED, ASSIGNMENT_OUTCOMES.ALREADY_ACCEPTED]),
  DELEGATION: new Set([DELEGATION_OUTCOMES.ACCEPTED, DELEGATION_OUTCOMES.ALREADY_ACCEPTED])
});

function plain(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function nonEmpty(value) { return typeof value === "string" && value.length > 0; }
function exact(record, fields) {
  return plain(record) && Object.keys(record).length === fields.length
    && Object.keys(record).every((key) => fields.includes(key));
}
function clone(value) { return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(deepFreeze);
  }
  return value;
}
function base(outcome, reason) {
  return {
    rulesetVersion: RULESET_VERSION, outcome, reason: reason || null,
    acceptanceOutcome: null, acceptanceEvidence: null, authority: "NONE",
    principalEligibilityCreated: false, authorizationCreated: false,
    humanGateSatisfied: false, continuationAuthorityCreated: false,
    executionAuthorityCreated: false, effectAuthorized: false
  };
}
function snapshotPort(productionResult, kind) {
  return () => {
    if (!productionResult || productionResult.outcome !== "PRODUCED" || productionResult.authority !== "NONE"
      || productionResult.evidenceAccepted !== false || !plain(productionResult.evidenceObject)
      || !plain(productionResult.productionEvidence)
      || productionResult.productionEvidence.subjectKind !== kind
      || productionResult.productionEvidence.authority !== "NONE") {
      throw new Error("produced evidence unavailable");
    }
    return deepFreeze(clone(productionResult.evidenceObject));
  };
}
function registryPort(sourceTrustPort, kind) {
  return ({sourceRef, sourceRevision}) => {
    const trust = sourceTrustPort({subjectKind:kind, sourceRef, sourceRevision});
    if (!trust || trust.outcome !== "TRUSTED" || trust.authority !== "NONE" || !plain(trust.registryRecord)) {
      throw new Error("trusted source unavailable");
    }
    return deepFreeze(clone(trust.registryRecord));
  };
}
function classify(kind, result) {
  if (!result || result.authority !== "NONE" || !nonEmpty(result.outcome)) return base(OUTCOMES.UNKNOWN, "ACCEPTANCE_RESULT_INVALID");
  const all = kind === "POLICY" ? POLICY_OUTCOMES : kind === "ASSIGNMENT" ? ASSIGNMENT_OUTCOMES : DELEGATION_OUTCOMES;
  let outcome = OUTCOMES.NOT_ACCEPTED;
  if (result.outcome === all.ACCEPTED) outcome = OUTCOMES.ACCEPTED;
  else if (result.outcome === all.ALREADY_ACCEPTED) outcome = OUTCOMES.ALREADY_ACCEPTED;
  else if (result.outcome === all.UNCERTAIN) outcome = OUTCOMES.UNKNOWN;
  return deepFreeze({...base(outcome, result.reason), acceptanceOutcome: result.outcome,
    acceptanceEvidence: ACCEPTED[kind].has(result.outcome) ? clone(result.evidence) : null});
}

function createGovernanceEvidenceProductionToAcceptanceWiring(deps = {}) {
  if (typeof deps.evidenceProductionPort !== "function") throw new TypeError("evidenceProductionPort is required");
  if (typeof deps.sourceTrustPort !== "function") throw new TypeError("sourceTrustPort is required");
  return Object.freeze({
    accept(request) {
      const fields = ["rulesetVersion","subjectKind","productionRequest","acceptanceRequest"];
      if (!exact(request, fields) || request.rulesetVersion !== RULESET_VERSION
        || !["POLICY","ASSIGNMENT","DELEGATION"].includes(request.subjectKind)
        || !plain(request.productionRequest) || !plain(request.acceptanceRequest)) {
        return base(OUTCOMES.INVALID, "INVALID_REQUEST");
      }
      let produced;
      try { produced = deps.evidenceProductionPort(deepFreeze(clone(request.productionRequest))); }
      catch (_) { return base(OUTCOMES.UNKNOWN, "PRODUCTION_UNAVAILABLE"); }
      if (!produced || produced.outcome !== "PRODUCED" || produced.authority !== "NONE"
        || produced.evidenceAccepted !== false || !produced.evidenceObject || !produced.productionEvidence
        || produced.productionEvidence.subjectKind !== request.subjectKind) {
        return base(OUTCOMES.NOT_ACCEPTED, "EVIDENCE_NOT_EXACTLY_PRODUCED");
      }
      const sourceRegistry = registryPort(deps.sourceTrustPort, request.subjectKind);
      let primitive;
      try {
        if (request.subjectKind === "POLICY") {
          primitive = createGovernanceRolePolicyRequirementEvidenceAcceptance({
            policySnapshotPort: snapshotPort(produced, "POLICY"),
            policySourceRegistryPort: sourceRegistry,
            temporalFramePort: deps.temporalFramePort,
            policyLedger: deps.policyLedger
          });
        } else if (request.subjectKind === "ASSIGNMENT") {
          primitive = createDirectPrincipalRoleAssignmentEvidenceAcceptance({
            assignmentSnapshotPort: snapshotPort(produced, "ASSIGNMENT"),
            assignmentSourceRegistryPort: sourceRegistry,
            principalIdentityPort: deps.principalIdentityPort,
            policyAcceptancePort: deps.policyAcceptancePort,
            temporalFramePort: deps.temporalFramePort,
            assignmentLedger: deps.assignmentLedger
          });
        } else {
          primitive = createDirectDelegationEvidenceAcceptance({
            delegationSnapshotPort: snapshotPort(produced, "DELEGATION"),
            delegationSourceRegistryPort: sourceRegistry,
            authenticatedSourceBindingPort: deps.authenticatedSourceBindingPort,
            grantorAssignmentPort: deps.grantorAssignmentPort,
            assignmentCurrentStatePort: deps.assignmentCurrentStatePort,
            policyAcceptancePort: deps.policyAcceptancePort,
            policyCurrentStatePort: deps.policyCurrentStatePort,
            principalIdentityPort: deps.principalIdentityPort,
            temporalFramePort: deps.temporalFramePort,
            delegationCurrentStatePort: deps.delegationCurrentStatePort,
            delegationLedger: deps.delegationLedger
          });
        }
      } catch (_) { return base(OUTCOMES.UNKNOWN, "ACCEPTANCE_PRIMITIVE_UNAVAILABLE"); }
      let result;
      try { result = primitive.accept(deepFreeze(clone(request.acceptanceRequest))); }
      catch (_) { return base(OUTCOMES.UNKNOWN, "ACCEPTANCE_EXECUTION_UNAVAILABLE"); }
      return classify(request.subjectKind, result);
    }
  });
}

module.exports = { RULESET_VERSION, OUTCOMES, createGovernanceEvidenceProductionToAcceptanceWiring };
