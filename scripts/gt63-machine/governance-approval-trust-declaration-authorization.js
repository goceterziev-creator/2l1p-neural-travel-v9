"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "governance-approval-trust-declaration-authorization-v0.1.0";
const OUTCOMES = Object.freeze({
  AUTHORIZED: "TRUST_DECLARATION_AUTHORIZED",
  REJECTED: "TRUST_DECLARATION_REJECTED",
  UNCERTAIN: "TRUST_DECLARATION_UNCERTAIN",
  CONFLICT: "TRUST_DECLARATION_CONFLICT"
});

const EXPECTED_REGISTRATION_REF = "gt63-machine:trust-registration:human-governance-approval-surface-v0";
const EXPECTED_REGISTRATION_REVISION = "1";
const EXPECTED_SOURCE_PROVIDER_REF = "gt63-machine:human-governance-approval-surface-v0";
const EXPECTED_SOURCE_PROVIDER_REVISION = "1";
const EXPECTED_VERIFICATION_METHOD_REF = "gt63-machine:verification-method:approval-surface-session-continuity-v0";
const EXPECTED_VERIFICATION_METHOD_REVISION = "1";
const EXPECTED_PRINCIPAL_REF = "gt63-machine:principal:github:239696056";

function clone(value) {
  return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
}
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
function plain(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) return Object.keys(value).sort().reduce((out, key) => { out[key] = canonicalize(value[key]); return out; }, {});
  return value;
}
function canonicalStringify(value) { return JSON.stringify(canonicalize(value)); }
function sha256(value) { return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`; }
function result(outcome, reason = null, authorization = null) {
  return deepFreeze({ outcome, reason, authorization: clone(authorization), authority: "NONE" });
}

function createGovernanceApprovalTrustDeclarationAuthorization({
  trustDecisionPort,
  provenancePort,
  authorizationLedger
} = {}) {
  if (typeof trustDecisionPort !== "function") throw new TypeError("trustDecisionPort must be a function");
  if (typeof provenancePort !== "function") throw new TypeError("provenancePort must be a function");
  for (const name of ["findByRegistrationRef", "commit"]) {
    if (!authorizationLedger || typeof authorizationLedger[name] !== "function") {
      throw new TypeError(`authorizationLedger.${name} must be a function`);
    }
  }

  function authorize(request) {
    if (!plain(request)
      || Object.keys(request).sort().join("|") !== ["registrationRef", "registrationRevision", "rulesetVersion"].sort().join("|")
      || request.rulesetVersion !== RULESET_VERSION
      || request.registrationRef !== EXPECTED_REGISTRATION_REF
      || request.registrationRevision !== EXPECTED_REGISTRATION_REVISION) {
      return result(OUTCOMES.REJECTED, "unsupported request schema or subject");
    }

    let decision;
    try { decision = trustDecisionPort({ registrationRef: request.registrationRef, registrationRevision: request.registrationRevision }); }
    catch (_) { return result(OUTCOMES.UNCERTAIN, "trust decision evidence unavailable"); }

    if (!plain(decision)
      || decision.type !== "GT63_GOVERNANCE_APPROVAL_TRUST_DECISION"
      || decision.registrationRef !== EXPECTED_REGISTRATION_REF
      || decision.registrationRevision !== EXPECTED_REGISTRATION_REVISION
      || decision.sourceProviderRef !== EXPECTED_SOURCE_PROVIDER_REF
      || decision.sourceProviderRevision !== EXPECTED_SOURCE_PROVIDER_REVISION
      || decision.verificationMethodRef !== EXPECTED_VERIFICATION_METHOD_REF
      || decision.verificationMethodRevision !== EXPECTED_VERIFICATION_METHOD_REVISION
      || decision.sourceTrustState !== "TRUSTED"
      || decision.verificationMethodTrustState !== "TRUSTED"
      || decision.decision !== "APPROVE_TRUST_REGISTRATION"
      || decision.principalRef !== EXPECTED_PRINCIPAL_REF
      || decision.principalResolutionState !== "RESOLVED"
      || decision.lifecycleState !== "CURRENT"
      || decision.freshnessState !== "CURRENT"
      || decision.contradictionState !== "NONE"
      || decision.authority !== "NONE"
      || typeof decision.decisionEvidenceRef !== "string"
      || decision.decisionEvidenceRef.length === 0) {
      return result(OUTCOMES.UNCERTAIN, "trust decision is not exact/current/principal-bound");
    }

    let provenance;
    try { provenance = provenancePort({ evidenceRef: decision.decisionEvidenceRef }); }
    catch (_) { return result(OUTCOMES.UNCERTAIN, "trust decision provenance unavailable"); }

    if (!plain(provenance)
      || provenance.evidenceRef !== decision.decisionEvidenceRef
      || provenance.subjectRef !== EXPECTED_REGISTRATION_REF
      || provenance.subjectRevision !== EXPECTED_REGISTRATION_REVISION
      || provenance.acceptanceState !== "ACCEPTED"
      || provenance.principalRef !== EXPECTED_PRINCIPAL_REF
      || provenance.lifecycleState !== "CURRENT"
      || provenance.freshnessState !== "CURRENT"
      || provenance.contradictionState !== "NONE"
      || provenance.authority !== "NONE") {
      return result(OUTCOMES.UNCERTAIN, "trust decision provenance is not accepted/current/subject-bound");
    }

    let historical;
    try { historical = authorizationLedger.findByRegistrationRef(request.registrationRef); }
    catch (_) { return result(OUTCOMES.UNCERTAIN, "authorization ledger unavailable"); }
    if (!Array.isArray(historical)) return result(OUTCOMES.UNCERTAIN, "authorization ledger evidence invalid");
    if (historical.length > 1) return result(OUTCOMES.CONFLICT, "multiple trust declaration authorizations for registration subject");

    const material = {
      type: "GT63_GOVERNANCE_APPROVAL_TRUST_DECLARATION_AUTHORIZATION",
      rulesetVersion: RULESET_VERSION,
      registrationRef: EXPECTED_REGISTRATION_REF,
      registrationRevision: EXPECTED_REGISTRATION_REVISION,
      sourceProviderRef: EXPECTED_SOURCE_PROVIDER_REF,
      sourceProviderRevision: EXPECTED_SOURCE_PROVIDER_REVISION,
      sourceTrustState: "TRUSTED",
      verificationMethodRef: EXPECTED_VERIFICATION_METHOD_REF,
      verificationMethodRevision: EXPECTED_VERIFICATION_METHOD_REVISION,
      verificationMethodTrustState: "TRUSTED",
      principalRef: EXPECTED_PRINCIPAL_REF,
      decisionEvidenceRef: decision.decisionEvidenceRef,
      provenanceEvidenceRef: provenance.provenanceEvidenceRef || provenance.evidenceRef,
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      authority: "NONE"
    };
    const authorizationId = `trust-declaration-authorization:${sha256(canonicalStringify(material)).slice(7)}`;
    const authorization = deepFreeze({ authorizationId, ...material });

    if (historical.length === 1) {
      return canonicalStringify(historical[0]) === canonicalStringify(authorization)
        ? result(OUTCOMES.AUTHORIZED, "same trust declaration already authorized", historical[0])
        : result(OUTCOMES.CONFLICT, "registration subject already has different trust declaration authorization");
    }

    let committed;
    try { committed = authorizationLedger.commit(authorization); }
    catch (_) { return result(OUTCOMES.CONFLICT, "authorization ledger commit conflict"); }
    if (!committed || committed.authorizationId !== authorizationId) {
      return result(OUTCOMES.CONFLICT, "authorization ledger returned conflicting identity");
    }
    return result(OUTCOMES.AUTHORIZED, null, committed);
  }

  return deepFreeze({ authorize, authority: "NONE", rulesetVersion: RULESET_VERSION });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  OUTCOMES,
  EXPECTED_REGISTRATION_REF,
  EXPECTED_REGISTRATION_REVISION,
  EXPECTED_PRINCIPAL_REF,
  createGovernanceApprovalTrustDeclarationAuthorization
});
