"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "a-class-evidence-specific-source-binding-v0.1.0";
const STATES = Object.freeze({
  SOURCE_BOUND: "SOURCE_BOUND",
  NOT_BOUND: "NOT_BOUND",
  UNKNOWN: "UNKNOWN"
});

const EXPECTED = Object.freeze({
  evidenceClass: "ACCOUNT_AUTHENTICATION_EVIDENCE",
  authenticationMethod: "PASSWORD",
  authenticationResult: "SUCCESS",
  provenanceState: "POSITIVE",
  provenanceSource: "NORMAL_PASSWORD_VERIFICATION",
  capturePoint: "POST_PASSWORD_VERIFICATION_SUCCESS_PRE_SESSION_ISSUANCE",
  sourceIdentity: "gt63-machine:evidence-source:aya-session-normal-auth-session",
  sourceRevision: 1
});

function plain(v) { return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function nonEmpty(v) { return typeof v === "string" && v.length > 0; }
function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function freeze(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) freeze(x);
  }
  return v;
}
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (plain(v)) return Object.keys(v).sort().reduce((o,k) => { o[k] = canonical(v[k]); return o; }, {});
  return v;
}
function digest(v) {
  return "sha256:" + crypto.createHash("sha256").update(JSON.stringify(canonical(v))).digest("hex");
}
function result(state, reason, evidenceRefs = []) {
  const material = {
    type: "GT63_A_CLASS_EVIDENCE_SPECIFIC_SOURCE_BINDING_ASSESSMENT",
    rulesetVersion: RULESET_VERSION,
    sourceBindingState: state,
    reason,
    evidenceRefs: [...new Set(evidenceRefs)].sort(),
    authorityEffect: "NONE",
    nonClaims: {
      evidenceAccepted: false,
      materialAcceptance: false,
      authenticatedHumanPrincipal: false,
      principalEligibility: false,
      capabilityAuthorization: false,
      filesystemEffectAuthority: false,
      machineAuthority: false
    }
  };
  return freeze({ ...material, assessmentIdentity: "gt63-assessment:a-class-source-binding:" + digest(material).slice(7) });
}

function assessAClassEvidenceSpecificSourceBinding(input) {
  if (!plain(input) || !plain(input.evidence) || !plain(input.byteIdentity)
      || !plain(input.sourceDefinition) || !plain(input.sourceEstablishment)
      || !plain(input.sourceCurrentness) || !plain(input.producingImplementation)) {
    return result(STATES.UNKNOWN, "REQUIRED_EVIDENCE_UNAVAILABLE");
  }

  const e = input.evidence;
  const b = input.byteIdentity;
  const d = input.sourceDefinition;
  const s = input.sourceEstablishment;
  const c = input.sourceCurrentness;
  const p = input.producingImplementation;
  const refs = [
    nonEmpty(e.evidenceIdentity) ? e.evidenceIdentity : null,
    nonEmpty(d.materialIdentity) ? d.materialIdentity : null,
    nonEmpty(s.establishmentEvidenceIdentity) ? s.establishmentEvidenceIdentity : null,
    nonEmpty(c.sourceCurrentnessEvidenceIdentity) ? c.sourceCurrentnessEvidenceIdentity : null
  ].filter(Boolean);

  if (!nonEmpty(e.evidenceIdentity) || e.evidenceRevision !== 1
      || !nonEmpty(e.authenticationEventIdentity)
      || !nonEmpty(b.sha256) || !Number.isInteger(b.byteLength) || b.byteLength <= 0) {
    return result(STATES.UNKNOWN, "EXACT_EVIDENCE_IDENTITY_INCOMPLETE", refs);
  }

  if (e.evidenceClass !== EXPECTED.evidenceClass
      || e.authenticationMethod !== EXPECTED.authenticationMethod
      || e.authenticationResult !== EXPECTED.authenticationResult) {
    return result(STATES.NOT_BOUND, "EVIDENCE_CLASS_OR_AUTHENTICATION_SEMANTICS_MISMATCH", refs);
  }

  if (!plain(e.normalPathProvenance)
      || e.normalPathProvenance.state !== EXPECTED.provenanceState
      || e.normalPathProvenance.bypassExcluded !== true
      || e.normalPathProvenance.source !== EXPECTED.provenanceSource
      || e.capturePoint !== EXPECTED.capturePoint) {
    return result(STATES.NOT_BOUND, "ADMITTED_A_CLASS_PROVENANCE_NOT_PROVEN", refs);
  }

  if (!plain(e.sourceContext)
      || e.sourceContext.sourceIdentity !== EXPECTED.sourceIdentity
      || e.sourceContext.sourceRevision !== EXPECTED.sourceRevision) {
    return result(STATES.NOT_BOUND, "EVIDENCE_SOURCE_REFERENCE_MISMATCH", refs);
  }

  if (!plain(d.sourceSubject)
      || d.sourceSubject.sourceIdentity !== EXPECTED.sourceIdentity
      || d.sourceSubject.sourceRevision !== EXPECTED.sourceRevision
      || !Array.isArray(d.evidenceClassCoverage)
      || !d.evidenceClassCoverage.some(x => x && x.class === EXPECTED.evidenceClass)
      || !plain(d.provenanceBoundary)
      || !Array.isArray(d.provenanceBoundary.admittedPath)
      || !d.provenanceBoundary.admittedPath.includes("NORMAL_PASSWORD_AUTHENTICATION_SUCCESS")
      || !Array.isArray(d.provenanceBoundary.excludedPaths)
      || !d.provenanceBoundary.excludedPaths.includes("BETA_AUTH_BYPASS_SYNTHESIZED_REQUEST_CONTEXT")) {
    return result(STATES.UNKNOWN, "SOURCE_DEFINITION_NOT_APPLICABLE_TO_A_CLASS", refs);
  }

  if (!plain(s.decision) || s.decision.outcome !== "SOURCE_ESTABLISHED"
      || !plain(s.establishmentTarget)
      || s.establishmentTarget.sourceIdentity !== EXPECTED.sourceIdentity
      || s.establishmentTarget.sourceRevision !== EXPECTED.sourceRevision
      || s.establishmentTarget.validatedSourceDefinitionMaterialBlob !== input.sourceDefinitionBlob) {
    return result(STATES.UNKNOWN, "SOURCE_ESTABLISHMENT_NOT_PROVEN", refs);
  }

  if (!plain(c.assessmentTarget) || !plain(c.assessmentBoundary) || !plain(c.outcome)
      || c.assessmentTarget.sourceIdentity !== EXPECTED.sourceIdentity
      || c.assessmentTarget.sourceRevision !== EXPECTED.sourceRevision
      || c.assessmentTarget.validatedSourceDefinitionMaterialBlob !== input.sourceDefinitionBlob
      || c.outcome.lifecycleOutcome !== "CURRENT") {
    return result(STATES.UNKNOWN, "SOURCE_CURRENTNESS_NOT_POSITIVELY_PROVEN", refs);
  }

  if (!nonEmpty(p.repository) || !nonEmpty(p.serverPath) || !nonEmpty(p.serverBlob)
      || p.repository !== c.assessmentBoundary.authoritativeRepository
      || p.serverPath !== c.assessmentBoundary.relevantImplementationPath
      || p.serverBlob !== c.assessmentBoundary.assessedImplementationBlob) {
    return result(STATES.UNKNOWN, "PRODUCING_IMPLEMENTATION_NOT_CURRENTNESS_BOUND", refs);
  }

  if (e.sourceContext.validatedSourceDefinitionMaterialBlob !== input.sourceDefinitionBlob) {
    return result(STATES.NOT_BOUND, "EVIDENCE_SOURCE_DEFINITION_REFERENCE_MISMATCH", refs);
  }

  return result(STATES.SOURCE_BOUND, "EXACT_A_CLASS_EVIDENCE_BOUND_TO_ESTABLISHED_CURRENT_SOURCE", refs);
}

module.exports = Object.freeze({
  RULESET_VERSION,
  STATES,
  assessAClassEvidenceSpecificSourceBinding
});
