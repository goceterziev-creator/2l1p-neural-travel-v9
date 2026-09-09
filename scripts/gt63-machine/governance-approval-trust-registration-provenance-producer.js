"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "governance-approval-trust-registration-provenance-producer-v0.1.0";
const OUTCOMES = Object.freeze({
  PRODUCED: "TRUST_REGISTRATION_PROVENANCE_PRODUCED",
  REJECTED: "TRUST_REGISTRATION_PROVENANCE_REJECTED",
  STALE: "TRUST_REGISTRATION_PROVENANCE_STALE",
  UNCERTAIN: "TRUST_REGISTRATION_PROVENANCE_UNCERTAIN",
  CONFLICT: "TRUST_REGISTRATION_PROVENANCE_CONFLICT"
});

const EXPECTED_REGISTRATION_REF = "gt63-machine:trust-registration:human-governance-approval-surface-v0";
const EXPECTED_REGISTRATION_REVISION = "1";
const EXPECTED_PRINCIPAL_REF = "gt63-machine:principal:github:239696056";
const EXPECTED_APPROVAL_DIGEST = "sha256:0bba51ea1427c2e5a3542c9a46de7b4de7e44861ebdf82f14469d2f8777899aa";

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
function nonEmpty(value) { return typeof value === "string" && value.length > 0; }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) return Object.keys(value).sort().reduce((out, key) => { out[key] = canonicalize(value[key]); return out; }, {});
  return value;
}
function canonicalStringify(value) { return JSON.stringify(canonicalize(value)); }
function sha256(value) { return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`; }
function result(outcome, reason = null, provenance = null) {
  return deepFreeze({ outcome, reason, provenance: clone(provenance), authority: "NONE" });
}

function createGovernanceApprovalTrustRegistrationProvenanceProducer({
  approvalBindingPort,
  principalIdentityPort,
  provenanceLedger
} = {}) {
  if (typeof approvalBindingPort !== "function") throw new TypeError("approvalBindingPort must be a function");
  if (typeof principalIdentityPort !== "function") throw new TypeError("principalIdentityPort must be a function");
  for (const name of ["findBySubjectRef", "commit"]) {
    if (!provenanceLedger || typeof provenanceLedger[name] !== "function") throw new TypeError(`provenanceLedger.${name} must be a function`);
  }

  function produce(request) {
    if (!plain(request)
      || Object.keys(request).sort().join("|") !== ["registrationRef", "registrationRevision", "rulesetVersion"].sort().join("|")
      || request.rulesetVersion !== RULESET_VERSION
      || request.registrationRef !== EXPECTED_REGISTRATION_REF
      || request.registrationRevision !== EXPECTED_REGISTRATION_REVISION) {
      return result(OUTCOMES.REJECTED, "unsupported request schema or subject");
    }

    let binding;
    try { binding = approvalBindingPort({ registrationRef: request.registrationRef, registrationRevision: request.registrationRevision }); }
    catch (_) { return result(OUTCOMES.UNCERTAIN, "approval binding evidence unavailable"); }
    if (!plain(binding)
      || binding.outcome !== "BINDING_EVIDENCE_ACCEPTED"
      || !plain(binding.binding)
      || binding.binding.principalResolutionState !== "RESOLVED"
      || binding.binding.principalRef !== EXPECTED_PRINCIPAL_REF
      || binding.binding.principalLifecycleState !== "CURRENT"
      || binding.binding.principalFreshnessState !== "CURRENT"
      || binding.binding.interactionBindingState !== "BOUND"
      || binding.binding.contradictionState !== "NONE"
      || binding.binding.contentDigest !== EXPECTED_APPROVAL_DIGEST
      || binding.binding.authority !== "NONE") {
      return result(OUTCOMES.UNCERTAIN, "approval binding is not exact/current/principal-bound");
    }

    let principal;
    try { principal = principalIdentityPort({ principalRef: binding.binding.principalRef, sessionRef: binding.binding.sessionRef, sessionRevision: binding.binding.sessionRevision }); }
    catch (_) { return result(OUTCOMES.UNCERTAIN, "principal evidence unavailable"); }
    if (!plain(principal)
      || principal.principalRef !== EXPECTED_PRINCIPAL_REF
      || principal.principalRevision !== binding.binding.principalRevision
      || principal.sessionRef !== binding.binding.sessionRef
      || principal.sessionRevision !== binding.binding.sessionRevision
      || principal.lifecycleState !== "CURRENT"
      || principal.freshnessState !== "CURRENT"
      || principal.contradictionState !== "NONE"
      || !nonEmpty(principal.principalEvidenceRef)
      || principal.authority !== "NONE") {
      return result(OUTCOMES.UNCERTAIN, "principal evidence is not current or session-bound");
    }

    let historical;
    try { historical = provenanceLedger.findBySubjectRef(request.registrationRef); }
    catch (_) { return result(OUTCOMES.UNCERTAIN, "provenance ledger unavailable"); }
    if (!Array.isArray(historical)) return result(OUTCOMES.UNCERTAIN, "provenance ledger evidence invalid");
    if (historical.length > 1) return result(OUTCOMES.CONFLICT, "multiple provenance records for registration subject");

    const material = {
      type: "GT63_TRUST_REGISTRATION_PROVENANCE",
      rulesetVersion: RULESET_VERSION,
      evidenceRef: `gt63-evidence:trust-registration-provenance:${sha256([request.registrationRef, request.registrationRevision, binding.binding.bindingId, principal.principalEvidenceRef].join("\u0000")).slice(7)}`,
      subjectRef: request.registrationRef,
      subjectRevision: request.registrationRevision,
      acceptanceState: "ACCEPTED",
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      principalRef: principal.principalRef,
      principalRevision: principal.principalRevision,
      sessionRef: principal.sessionRef,
      sessionRevision: principal.sessionRevision,
      approvalBindingId: binding.binding.bindingId,
      approvalContentDigest: binding.binding.contentDigest,
      principalEvidenceRef: principal.principalEvidenceRef,
      provenanceEvidenceRef: `gt63-evidence:trust-registration-provenance-material:${sha256(canonicalStringify({
        subjectRef: request.registrationRef,
        subjectRevision: request.registrationRevision,
        principalRef: principal.principalRef,
        principalRevision: principal.principalRevision,
        sessionRef: principal.sessionRef,
        sessionRevision: principal.sessionRevision,
        approvalBindingId: binding.binding.bindingId,
        approvalContentDigest: binding.binding.contentDigest,
        principalEvidenceRef: principal.principalEvidenceRef
      })).slice(7)}`,
      authority: "NONE"
    };
    const provenance = deepFreeze(material);

    if (historical.length === 1) {
      return canonicalStringify(historical[0]) === canonicalStringify(provenance)
        ? result(OUTCOMES.PRODUCED, "same provenance already produced", historical[0])
        : result(OUTCOMES.CONFLICT, "registration subject already has different provenance");
    }

    let committed;
    try { committed = provenanceLedger.commit(provenance); }
    catch (_) { return result(OUTCOMES.CONFLICT, "provenance ledger commit conflict"); }
    if (!committed || committed.evidenceRef !== provenance.evidenceRef) return result(OUTCOMES.CONFLICT, "provenance ledger returned conflicting identity");
    return result(OUTCOMES.PRODUCED, null, committed);
  }

  return deepFreeze({ produce, authority: "NONE", rulesetVersion: RULESET_VERSION });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  OUTCOMES,
  EXPECTED_REGISTRATION_REF,
  EXPECTED_REGISTRATION_REVISION,
  EXPECTED_PRINCIPAL_REF,
  EXPECTED_APPROVAL_DIGEST,
  createGovernanceApprovalTrustRegistrationProvenanceProducer
});
