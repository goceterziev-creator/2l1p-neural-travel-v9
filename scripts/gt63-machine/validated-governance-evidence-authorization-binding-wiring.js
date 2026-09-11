"use strict";

const {
  RULESET_VERSION: BINDING_RULESET_VERSION,
  OUTCOMES: BINDING_OUTCOMES,
  createAuthenticatedGovernanceAuthorizationBinding
} = require("./authenticated-governance-authorization-binding");

const RULESET_VERSION = "validated-governance-evidence-authorization-binding-wiring-v0.1.0";
const AUTHORITY = "NONE";
const OUTCOMES = Object.freeze({
  AUTHORIZED: "AUTHORIZED",
  NOT_AUTHORIZED: "NOT_AUTHORIZED",
  UNKNOWN: "UNKNOWN",
  INVALID: "INVALID"
});

function plain(v) { return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function freeze(v) { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(freeze); } return v; }
function exact(o, fields) { return plain(o) && Object.keys(o).length === fields.length && Object.keys(o).every(k => fields.includes(k)); }
function result(outcome, reason, binding = null) {
  return freeze({
    rulesetVersion: RULESET_VERSION,
    outcome,
    reason: reason || null,
    binding: clone(binding),
    authority: AUTHORITY,
    humanGateSatisfied: false,
    continuationAuthorityCreated: false,
    executionAuthorityCreated: false,
    effectAuthorized: false
  });
}
function call(port, arg) { try { return port(freeze(clone(arg))); } catch (_) { return null; } }
function evidenceFrom(wrapper, acceptedOutcomes, field) {
  if (!plain(wrapper) || wrapper.authority !== AUTHORITY || !acceptedOutcomes.includes(wrapper.outcome)) return null;
  const value = wrapper[field];
  return plain(value) && value.authority === AUTHORITY ? value : null;
}

function createValidatedGovernanceEvidenceAuthorizationBindingWiring({
  governancePrincipalBindingResultPort,
  principalEligibilityResultPort,
  roleRequirementResultPort,
  principalRoleResultPort,
  humanAuthorizationResultPort,
  bindingLedger
} = {}) {
  for (const [name, port] of Object.entries({
    governancePrincipalBindingResultPort,
    principalEligibilityResultPort,
    roleRequirementResultPort,
    principalRoleResultPort,
    humanAuthorizationResultPort
  })) if (typeof port !== "function") throw new TypeError(`${name} must be a function`);
  if (!bindingLedger || typeof bindingLedger.get !== "function" || typeof bindingLedger.commit !== "function") {
    throw new TypeError("bindingLedger get/commit required");
  }

  const binder = createAuthenticatedGovernanceAuthorizationBinding({
    authenticatedPrincipalPort: q => evidenceFrom(call(governancePrincipalBindingResultPort, q), ["GOVERNANCE_PRINCIPAL_IDENTITY_BOUND"], "evidence"),
    principalEligibilityPort: q => evidenceFrom(call(principalEligibilityResultPort, q), ["PRINCIPAL_ELIGIBILITY_RESOLVED"], "evidence"),
    governanceRoleRequirementPort: q => evidenceFrom(call(roleRequirementResultPort, q), ["RESOLVED"], "resolution"),
    roleResolutionPort: q => evidenceFrom(call(principalRoleResultPort, q), ["RESOLVED"], "resolution"),
    humanAuthorizationEventPort: q => evidenceFrom(call(humanAuthorizationResultPort, q), ["AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED"], "evidence"),
    bindingLedger
  });

  function assess(request) {
    const fields = ["rulesetVersion", "authorizationSubjectRef", "authorizationSubjectRevision", "governanceAct", "contextScope", "principalRef", "principalRevision", "humanAuthorizationEvidenceRef"];
    if (!exact(request, fields) || request.rulesetVersion !== RULESET_VERSION) return result(OUTCOMES.INVALID, "INVALID_REQUEST");
    const bindingRequest = clone(request);
    bindingRequest.rulesetVersion = BINDING_RULESET_VERSION;
    let assessed;
    try { assessed = binder.assess(freeze(bindingRequest)); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "AUTHORIZATION_BINDING_UNAVAILABLE"); }
    if (!plain(assessed) || assessed.authority !== AUTHORITY) return result(OUTCOMES.UNKNOWN, "AUTHORIZATION_BINDING_RESULT_INVALID");
    const mapped = assessed.outcome === BINDING_OUTCOMES.AUTHORIZED ? OUTCOMES.AUTHORIZED
      : assessed.outcome === BINDING_OUTCOMES.NOT_AUTHORIZED ? OUTCOMES.NOT_AUTHORIZED
      : assessed.outcome === BINDING_OUTCOMES.INVALID ? OUTCOMES.INVALID : OUTCOMES.UNKNOWN;
    return result(mapped, assessed.reason, assessed.binding);
  }

  return Object.freeze({ assess, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
}

module.exports = Object.freeze({ RULESET_VERSION, AUTHORITY, OUTCOMES, createValidatedGovernanceEvidenceAuthorizationBindingWiring });
