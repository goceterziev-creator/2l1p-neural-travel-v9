"use strict";

const RULESET_VERSION = "governance-approval-trust-decision-provenance-acceptance-v0.1.0";
const AUTHORITY = "NONE";
const EXPECTED_REGISTRATION_REF = "gt63-machine:trust-registration:human-governance-approval-surface-v0";
const EXPECTED_REGISTRATION_REVISION = "1";
const EXPECTED_PRINCIPAL_REF = "gt63-machine:principal:github:239696056";

function clone(v) { return v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)); }
function deepFreeze(v) { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); } return v; }
function plain(v) { return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function nonEmpty(v) { return typeof v === "string" && v.length > 0; }
function result(outcome, reason = null, provenance = null) { return deepFreeze({ outcome, reason, provenance: clone(provenance), authority: AUTHORITY }); }

function createGovernanceApprovalTrustDecisionProvenanceAcceptance({ decisionPort, principalIdentityPort, provenanceLedger } = {}) {
  if (typeof decisionPort !== "function") throw new TypeError("decisionPort must be a function");
  if (typeof principalIdentityPort !== "function") throw new TypeError("principalIdentityPort must be a function");
  for (const name of ["findByEvidenceRef", "commit"]) {
    if (!provenanceLedger || typeof provenanceLedger[name] !== "function") throw new TypeError(`provenanceLedger.${name} must be a function`);
  }

  function accept(request) {
    const keys = ["decisionEvidenceRef", "registrationRef", "registrationRevision", "rulesetVersion"].sort().join("|");
    if (!plain(request) || Object.keys(request).sort().join("|") !== keys || request.rulesetVersion !== RULESET_VERSION
      || request.registrationRef !== EXPECTED_REGISTRATION_REF || request.registrationRevision !== EXPECTED_REGISTRATION_REVISION
      || !nonEmpty(request.decisionEvidenceRef)) return result("TRUST_DECISION_PROVENANCE_REJECTED", "unsupported request schema or subject");

    let decision;
    try { decision = decisionPort({ decisionEvidenceRef: request.decisionEvidenceRef }); }
    catch (_) { return result("TRUST_DECISION_PROVENANCE_UNCERTAIN", "decision evidence unavailable"); }
    if (!plain(decision) || decision.decisionEvidenceRef !== request.decisionEvidenceRef
      || decision.type !== "GT63_GOVERNANCE_APPROVAL_TRUST_DECISION"
      || decision.registrationRef !== EXPECTED_REGISTRATION_REF || decision.registrationRevision !== EXPECTED_REGISTRATION_REVISION
      || decision.decision !== "APPROVE_TRUST_REGISTRATION" || decision.sourceTrustState !== "TRUSTED"
      || decision.verificationMethodTrustState !== "TRUSTED" || decision.principalRef !== EXPECTED_PRINCIPAL_REF
      || decision.principalResolutionState !== "RESOLVED" || !nonEmpty(decision.sessionRef) || !nonEmpty(decision.sessionRevision)
      || decision.lifecycleState !== "CURRENT" || decision.freshnessState !== "CURRENT"
      || decision.contradictionState !== "NONE" || !nonEmpty(decision.principalEvidenceRef) || !nonEmpty(decision.exactPayloadDigest)
      || decision.authority !== AUTHORITY) return result("TRUST_DECISION_PROVENANCE_UNCERTAIN", "decision evidence is not exact/current/principal-bound");

    let principal;
    try { principal = principalIdentityPort({ principalRef: decision.principalRef, sessionRef: decision.sessionRef, sessionRevision: decision.sessionRevision }); }
    catch (_) { return result("TRUST_DECISION_PROVENANCE_UNCERTAIN", "principal evidence unavailable"); }
    if (!plain(principal) || principal.principalRef !== EXPECTED_PRINCIPAL_REF
      || principal.sessionRef !== decision.sessionRef || principal.sessionRevision !== decision.sessionRevision
      || principal.principalEvidenceRef !== decision.principalEvidenceRef || principal.lifecycleState !== "CURRENT"
      || principal.freshnessState !== "CURRENT" || principal.contradictionState !== "NONE" || principal.authority !== AUTHORITY) {
      return result("TRUST_DECISION_PROVENANCE_UNCERTAIN", "principal evidence is not same-session/current");
    }

    let historical;
    try { historical = provenanceLedger.findByEvidenceRef(request.decisionEvidenceRef); }
    catch (_) { return result("TRUST_DECISION_PROVENANCE_UNCERTAIN", "provenance ledger unavailable"); }
    if (!Array.isArray(historical)) return result("TRUST_DECISION_PROVENANCE_UNCERTAIN", "provenance ledger invalid");
    if (historical.length > 1) return result("TRUST_DECISION_PROVENANCE_CONFLICT", "multiple provenance records for decision evidence");

    const provenance = deepFreeze({
      type: "GT63_TRUST_DECISION_PROVENANCE",
      rulesetVersion: RULESET_VERSION,
      evidenceRef: decision.decisionEvidenceRef,
      subjectRef: EXPECTED_REGISTRATION_REF,
      subjectRevision: EXPECTED_REGISTRATION_REVISION,
      acceptanceState: "ACCEPTED",
      principalRef: decision.principalRef,
      principalRevision: principal.principalRevision,
      sessionRef: decision.sessionRef,
      sessionRevision: decision.sessionRevision,
      principalEvidenceRef: decision.principalEvidenceRef,
      decisionPresentationId: decision.presentationId,
      decisionPayloadDigest: decision.exactPayloadDigest,
      provenanceEvidenceRef: `gt63-evidence:trust-decision-provenance:${request.decisionEvidenceRef.split(":").pop()}`,
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      authority: AUTHORITY
    });

    if (historical.length === 1) return JSON.stringify(historical[0]) === JSON.stringify(provenance)
      ? result("TRUST_DECISION_PROVENANCE_ACCEPTED", "same provenance already accepted", historical[0])
      : result("TRUST_DECISION_PROVENANCE_CONFLICT", "different provenance already exists");

    let committed;
    try { committed = provenanceLedger.commit(provenance); }
    catch (_) { return result("TRUST_DECISION_PROVENANCE_CONFLICT", "provenance commit conflict"); }
    if (!committed || committed.evidenceRef !== provenance.evidenceRef) return result("TRUST_DECISION_PROVENANCE_CONFLICT", "provenance ledger returned conflicting identity");
    return result("TRUST_DECISION_PROVENANCE_ACCEPTED", null, committed);
  }

  return deepFreeze({ accept, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
}

module.exports = Object.freeze({ RULESET_VERSION, EXPECTED_REGISTRATION_REF, EXPECTED_REGISTRATION_REVISION, EXPECTED_PRINCIPAL_REF, createGovernanceApprovalTrustDecisionProvenanceAcceptance });
