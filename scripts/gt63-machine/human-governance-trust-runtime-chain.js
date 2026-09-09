"use strict";

const provenanceModule = require("./governance-approval-trust-decision-provenance-acceptance");
const authorizationModule = require("./governance-approval-trust-declaration-authorization");
const registrationAcceptanceModule = require("./governance-approval-trust-registration-evidence-acceptance");
const registrationResolverModule = require("./governance-approval-trust-registration");

function clone(v) { return v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)); }

function createArrayLedger(findField, idField) {
  const records = [];
  return Object.freeze({
    find(value) { return records.filter((x) => x[findField] === value).map(clone); },
    commit(record) {
      if (records.some((x) => x[idField] === record[idField])) throw new Error("immutable-ledger-conflict");
      records.push(clone(record));
      return clone(record);
    },
    records() { return records.map(clone); }
  });
}

function createHumanGovernanceTrustRuntimeChain({ decisionLedger, identityBootstrap } = {}) {
  if (!decisionLedger || typeof decisionLedger.get !== "function") throw new TypeError("decisionLedger.get required");
  if (!identityBootstrap || typeof identityBootstrap.getIdentityBySession !== "function") throw new TypeError("identityBootstrap.getIdentityBySession required");

  const provenanceStore = createArrayLedger("evidenceRef", "evidenceRef");
  const authorizationStore = createArrayLedger("registrationRef", "authorizationId");
  const registrationStore = createArrayLedger("registrationRef", "acceptanceId");

  function principalIdentityPort({ principalRef, sessionRef, sessionRevision }) {
    const identity = identityBootstrap.getIdentityBySession(sessionRef);
    if (!identity || identity.principalRef !== principalRef || identity.sessionRevision !== sessionRevision) return null;
    return clone(identity);
  }

  const provenanceAcceptance = provenanceModule.createGovernanceApprovalTrustDecisionProvenanceAcceptance({
    decisionPort({ decisionEvidenceRef }) { return clone(decisionLedger.get(decisionEvidenceRef)); },
    principalIdentityPort,
    provenanceLedger: {
      findByEvidenceRef(ref) { return provenanceStore.find(ref); },
      commit(record) { return provenanceStore.commit(record); }
    }
  });

  function resolveProvenance(evidenceRef) {
    const matches = provenanceStore.find(evidenceRef);
    return matches.length === 1 ? matches[0] : null;
  }

  function authorizeTrustDecision(decisionEvidenceRef) {
    const provenanceResult = provenanceAcceptance.accept({
      rulesetVersion: provenanceModule.RULESET_VERSION,
      registrationRef: provenanceModule.EXPECTED_REGISTRATION_REF,
      registrationRevision: provenanceModule.EXPECTED_REGISTRATION_REVISION,
      decisionEvidenceRef
    });
    if (provenanceResult.outcome !== "TRUST_DECISION_PROVENANCE_ACCEPTED") {
      return Object.freeze({ outcome: "TRUST_RUNTIME_CHAIN_BLOCKED", stage: "PROVENANCE", provenanceResult, authority: "NONE" });
    }

    const decision = decisionLedger.get(decisionEvidenceRef);
    const authorization = authorizationModule.createGovernanceApprovalTrustDeclarationAuthorization({
      trustDecisionPort() { return clone(decision); },
      provenancePort({ evidenceRef }) { return evidenceRef === decisionEvidenceRef ? clone(resolveProvenance(evidenceRef)) : null; },
      authorizationLedger: {
        findByRegistrationRef(ref) { return authorizationStore.find(ref); },
        commit(record) { return authorizationStore.commit(record); }
      }
    });
    const authorizationResult = authorization.authorize({
      rulesetVersion: authorizationModule.RULESET_VERSION,
      registrationRef: authorizationModule.EXPECTED_REGISTRATION_REF,
      registrationRevision: authorizationModule.EXPECTED_REGISTRATION_REVISION
    });
    if (authorizationResult.outcome !== authorizationModule.OUTCOMES.AUTHORIZED) {
      return Object.freeze({ outcome: "TRUST_RUNTIME_CHAIN_BLOCKED", stage: "AUTHORIZATION", provenanceResult, authorizationResult, authority: "NONE" });
    }

    const authz = authorizationResult.authorization;
    const registrationSnapshot = {
      type: registrationAcceptanceModule.EXPECTED_TYPE,
      registrationRef: authz.registrationRef,
      registrationRevision: authz.registrationRevision,
      sourceProviderRef: authz.sourceProviderRef,
      sourceProviderRevision: authz.sourceProviderRevision,
      verificationMethodRef: authz.verificationMethodRef,
      verificationMethodRevision: authz.verificationMethodRevision,
      sourceTrustState: authz.sourceTrustState,
      verificationMethodTrustState: authz.verificationMethodTrustState,
      lifecycleState: authz.lifecycleState,
      freshnessState: authz.freshnessState,
      contradictionState: authz.contradictionState,
      registrationEvidenceRef: provenanceResult.provenance.evidenceRef
    };

    const registrationAcceptance = registrationAcceptanceModule.createGovernanceApprovalTrustRegistrationEvidenceAcceptance({
      registrationSnapshotPort() { return clone(registrationSnapshot); },
      registrationEvidencePort({ evidenceRef }) { return evidenceRef === provenanceResult.provenance.evidenceRef ? clone(provenanceResult.provenance) : null; },
      registrationLedger: {
        findByRegistrationRef(ref) { return registrationStore.find(ref); },
        commit(record) { return registrationStore.commit(record); }
      }
    });
    const registrationAcceptanceResult = registrationAcceptance.accept({
      rulesetVersion: registrationAcceptanceModule.RULESET_VERSION,
      registrationRef: authz.registrationRef,
      expectedRegistrationRevision: authz.registrationRevision
    });
    if (![registrationAcceptanceModule.OUTCOMES.ACCEPTED, registrationAcceptanceModule.OUTCOMES.ALREADY_ACCEPTED].includes(registrationAcceptanceResult.outcome)) {
      return Object.freeze({ outcome: "TRUST_RUNTIME_CHAIN_BLOCKED", stage: "REGISTRATION_ACCEPTANCE", provenanceResult, authorizationResult, registrationAcceptanceResult, authority: "NONE" });
    }

    const accepted = registrationAcceptanceResult.evidence;
    const registration = {
      type: "GT63_GOVERNANCE_APPROVAL_TRUST_REGISTRATION",
      schemaVersion: "1.0",
      rulesetVersion: registrationResolverModule.RULESET_VERSION,
      registrationRevision: accepted.registrationRevision,
      sourceProviderRef: accepted.sourceProviderRef,
      sourceProviderRevision: accepted.sourceProviderRevision,
      sourceTrustState: accepted.sourceTrustState,
      verificationMethodRef: accepted.verificationMethodRef,
      verificationMethodRevision: accepted.verificationMethodRevision,
      verificationMethodTrustState: accepted.verificationMethodTrustState,
      lifecycleState: accepted.lifecycleState,
      freshnessState: accepted.freshnessState,
      contradictionState: accepted.contradictionState,
      acceptedEvidenceRef: accepted.acceptanceId,
      supersedesRegistrationRef: null,
      authority: "NONE"
    };
    const resolver = registrationResolverModule.createGovernanceApprovalTrustRegistration({ registrationProvider() { return clone(registration); } });
    const resolutionResult = resolver.resolve();

    return Object.freeze({
      outcome: resolutionResult.outcome === "TRUST_REGISTRATION_RESOLVED" ? "TRUST_RUNTIME_CHAIN_RESOLVED" : "TRUST_RUNTIME_CHAIN_BLOCKED",
      stage: resolutionResult.outcome === "TRUST_REGISTRATION_RESOLVED" ? "RESOLVED" : "RESOLUTION",
      provenanceResult,
      authorizationResult,
      registrationAcceptanceResult,
      resolutionResult,
      authority: "NONE"
    });
  }

  return Object.freeze({ authorizeTrustDecision, authority: "NONE" });
}

module.exports = Object.freeze({ createHumanGovernanceTrustRuntimeChain });
