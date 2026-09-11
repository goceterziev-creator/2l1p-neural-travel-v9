"use strict";

const RULESET_VERSION = "authenticated-governance-authorization-evidence-ports-v0.1.0";
const AUTHORITY = "NONE";

const PRINCIPAL_BOUND = "GOVERNANCE_PRINCIPAL_IDENTITY_BOUND";
const ELIGIBILITY_RESOLVED = "PRINCIPAL_ELIGIBILITY_RESOLVED";
const HUMAN_AUTH_RESOLVED = "AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED";

function plain(v) { return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function nonEmpty(v) { return typeof v === "string" && v.length > 0; }
function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function freeze(v) { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(freeze); } return v; }
function exact(obj, fields) { return plain(obj) && Object.keys(obj).length === fields.length && Object.keys(obj).every(k => fields.includes(k)); }

function validPrincipalEvidence(e) {
  return plain(e)
    && nonEmpty(e.principalRef)
    && nonEmpty(e.principalRevision)
    && nonEmpty(e.principalEvidenceRef)
    && e.lifecycleState === "CURRENT"
    && e.freshnessState === "CURRENT"
    && e.contradictionState === "NONE"
    && e.authority === AUTHORITY;
}

function validEligibilityEvidence(e) {
  return plain(e)
    && nonEmpty(e.principalRef)
    && nonEmpty(e.principalRevision)
    && nonEmpty(e.eligibilityEvidenceRef)
    && ["ELIGIBLE", "NOT_ELIGIBLE", "UNKNOWN"].includes(e.eligibilityState)
    && e.lifecycleState === "CURRENT"
    && e.freshnessState === "CURRENT"
    && e.contradictionState === "NONE"
    && e.authority === AUTHORITY;
}

function validHumanAuthorizationEvidence(e) {
  return plain(e)
    && nonEmpty(e.humanAuthorizationEvidenceRef)
    && nonEmpty(e.principalRef)
    && nonEmpty(e.principalRevision)
    && nonEmpty(e.authorizationSubjectRef)
    && nonEmpty(e.authorizationSubjectRevision)
    && e.governanceAct === "GATE_AUTHORIZATION"
    && ["APPROVE", "DENY", "NON_AUTHORIZATION"].includes(e.decision)
    && /^sha256:[0-9a-f]{64}$/.test(e.exactSemanticDigest)
    && e.lifecycleState === "CURRENT"
    && e.freshnessState === "CURRENT"
    && e.contradictionState === "NONE"
    && e.authority === AUTHORITY;
}

function unwrapSuccessful(wrapper, expectedOutcome, validator) {
  if (!plain(wrapper) || wrapper.outcome !== expectedOutcome || wrapper.authority !== AUTHORITY || !validator(wrapper.evidence)) {
    throw new Error("evidence unavailable");
  }
  return freeze(clone(wrapper.evidence));
}

function createAuthenticatedGovernanceAuthorizationEvidencePorts({
  governancePrincipalBindingPort,
  principalEligibilityEvidencePort,
  humanAuthorizationEvidenceLookupPort
} = {}) {
  if (typeof governancePrincipalBindingPort !== "function") throw new TypeError("governancePrincipalBindingPort must be a function");
  if (typeof principalEligibilityEvidencePort !== "function") throw new TypeError("principalEligibilityEvidencePort must be a function");
  if (typeof humanAuthorizationEvidenceLookupPort !== "function") throw new TypeError("humanAuthorizationEvidenceLookupPort must be a function");

  function authenticatedPrincipalPort(request) {
    if (!plain(request) || !nonEmpty(request.principalRef) || !nonEmpty(request.principalRevision)) throw new Error("invalid principal request");
    const wrapper = governancePrincipalBindingPort(freeze(clone(request)));
    const evidence = unwrapSuccessful(wrapper, PRINCIPAL_BOUND, validPrincipalEvidence);
    if (evidence.principalRef !== request.principalRef || evidence.principalRevision !== request.principalRevision) throw new Error("principal mismatch");
    return evidence;
  }

  function principalEligibilityPort(request) {
    const fields = ["principalRef", "principalRevision", "governanceAct", "contextScope"];
    if (!exact(request, fields) || !nonEmpty(request.principalRef) || !nonEmpty(request.principalRevision)
      || request.governanceAct !== "GATE_AUTHORIZATION" || !plain(request.contextScope)) throw new Error("invalid eligibility request");
    const wrapper = principalEligibilityEvidencePort(freeze(clone(request)));
    const evidence = unwrapSuccessful(wrapper, ELIGIBILITY_RESOLVED, validEligibilityEvidence);
    if (evidence.principalRef !== request.principalRef || evidence.principalRevision !== request.principalRevision
      || evidence.governanceAct !== request.governanceAct) throw new Error("eligibility mismatch");
    return evidence;
  }

  function humanAuthorizationEventPort(request) {
    if (!exact(request, ["humanAuthorizationEvidenceRef"]) || !nonEmpty(request.humanAuthorizationEvidenceRef)) throw new Error("invalid human authorization lookup");
    const wrapper = humanAuthorizationEvidenceLookupPort(freeze(clone(request)));
    const evidence = unwrapSuccessful(wrapper, HUMAN_AUTH_RESOLVED, validHumanAuthorizationEvidence);
    if (evidence.humanAuthorizationEvidenceRef !== request.humanAuthorizationEvidenceRef) throw new Error("human authorization identity mismatch");
    return evidence;
  }

  return Object.freeze({
    rulesetVersion: RULESET_VERSION,
    authority: AUTHORITY,
    authenticatedPrincipalPort,
    principalEligibilityPort,
    humanAuthorizationEventPort
  });
}

module.exports = Object.freeze({ RULESET_VERSION, AUTHORITY, createAuthenticatedGovernanceAuthorizationEvidencePorts });
