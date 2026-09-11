"use strict";

const {
  createAuthenticatedGovernanceAuthorizationBinding
} = require("./authenticated-governance-authorization-binding");
const {
  createAuthenticatedGovernanceAuthorizationEvidencePorts
} = require("./authenticated-governance-authorization-evidence-ports");
const {
  createAuthenticatedHumanAuthorizationEvidenceLookup
} = require("./authenticated-human-authorization-evidence-lookup");
const {
  createGovernancePrincipalEligibilityEvidenceLookup
} = require("./governance-principal-eligibility-evidence-lookup");
const {
  createAcceptedEvidenceRoleResolutionAuthorizationAdapterBridge
} = require("./accepted-evidence-role-resolution-authorization-adapter-bridge");
const {
  createRoleResolutionGovernanceAuthorizationBindingAdapter
} = require("./role-resolution-governance-authorization-binding-adapter");

const RULESET_VERSION = "authenticated-governance-authorization-end-to-end-composition-v0.1.0";
const AUTHORITY = "NONE";

function createAuthenticatedGovernanceAuthorizationEndToEndComposition({
  principalEligibilityEvidenceRegistry,
  humanAuthorizationEvidenceRegistry,
  acceptedEvidenceRoleResolutionWiring,
  bindingLedger
} = {}) {
  if (!principalEligibilityEvidenceRegistry) throw new TypeError("principalEligibilityEvidenceRegistry is required");
  if (!humanAuthorizationEvidenceRegistry) throw new TypeError("humanAuthorizationEvidenceRegistry is required");
  if (!acceptedEvidenceRoleResolutionWiring) throw new TypeError("acceptedEvidenceRoleResolutionWiring is required");
  if (!bindingLedger) throw new TypeError("bindingLedger is required");

  const principalEligibilityLookup = createGovernancePrincipalEligibilityEvidenceLookup({
    registry: principalEligibilityEvidenceRegistry
  });
  const humanAuthorizationLookup = createAuthenticatedHumanAuthorizationEvidenceLookup({
    registry: humanAuthorizationEvidenceRegistry
  });
  const evidencePorts = createAuthenticatedGovernanceAuthorizationEvidencePorts({
    governancePrincipalBindingPort: principalEligibilityLookup.governancePrincipalBindingPort,
    principalEligibilityEvidencePort: principalEligibilityLookup.principalEligibilityEvidencePort,
    humanAuthorizationEvidenceLookupPort: humanAuthorizationLookup.lookup
  });
  const roleBridge = createAcceptedEvidenceRoleResolutionAuthorizationAdapterBridge({
    acceptedEvidenceRoleResolutionWiring
  });
  const roleAdapter = createRoleResolutionGovernanceAuthorizationBindingAdapter({
    roleResolutionPrimitive: roleBridge
  });
  const binding = createAuthenticatedGovernanceAuthorizationBinding({
    authenticatedPrincipalPort: evidencePorts.authenticatedPrincipalPort,
    principalEligibilityPort: evidencePorts.principalEligibilityPort,
    governanceRoleRequirementPort: roleAdapter.governanceRoleRequirementPort,
    roleResolutionPort: roleAdapter.roleResolutionPort,
    humanAuthorizationEventPort: evidencePorts.humanAuthorizationEventPort,
    bindingLedger
  });

  return Object.freeze({
    rulesetVersion: RULESET_VERSION,
    authority: AUTHORITY,
    assess: binding.assess
  });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  AUTHORITY,
  createAuthenticatedGovernanceAuthorizationEndToEndComposition
});
