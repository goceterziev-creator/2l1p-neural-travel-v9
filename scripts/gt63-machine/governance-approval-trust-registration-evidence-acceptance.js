"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "governance-approval-trust-registration-evidence-acceptance-v0.1.0";
const OUTCOMES = Object.freeze({
  ACCEPTED: "TRUST_REGISTRATION_EVIDENCE_ACCEPTED",
  ALREADY_ACCEPTED: "TRUST_REGISTRATION_EVIDENCE_ALREADY_ACCEPTED",
  REJECTED: "TRUST_REGISTRATION_EVIDENCE_REJECTED",
  STALE: "TRUST_REGISTRATION_EVIDENCE_STALE",
  UNCERTAIN: "TRUST_REGISTRATION_EVIDENCE_UNCERTAIN",
  CONFLICT: "TRUST_REGISTRATION_EVIDENCE_CONFLICT"
});

const EXPECTED_TYPE = "GT63_GOVERNANCE_APPROVAL_TRUST_REGISTRATION";
const EXPECTED_SOURCE_PROVIDER_REF = "gt63-machine:human-governance-approval-surface-v0";
const EXPECTED_SOURCE_PROVIDER_REVISION = "1";
const EXPECTED_VERIFICATION_METHOD_REF = "gt63-machine:verification-method:approval-surface-session-continuity-v0";
const EXPECTED_VERIFICATION_METHOD_REVISION = "1";
const TRUST_STATES = new Set(["TRUSTED", "UNTRUSTED"]);
const LIFECYCLE_STATES = new Set(["CURRENT", "REVOKED", "DEACTIVATED"]);
const FRESHNESS_STATES = new Set(["CURRENT", "STALE"]);
const CONTRADICTION_STATES = new Set(["NONE", "CONTRADICTORY_EVIDENCE"]);

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

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

function plain(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function result(outcome, reason = null, evidence = null) {
  return deepFreeze({ outcome, reason, evidence: clone(evidence), authority: "NONE" });
}

function validSnapshot(snapshot) {
  const fields = [
    "type", "registrationRef", "registrationRevision", "sourceProviderRef", "sourceProviderRevision",
    "verificationMethodRef", "verificationMethodRevision", "sourceTrustState", "verificationMethodTrustState",
    "lifecycleState", "freshnessState", "contradictionState", "registrationEvidenceRef"
  ];
  return plain(snapshot)
    && Object.keys(snapshot).length === fields.length
    && fields.every((field) => Object.prototype.hasOwnProperty.call(snapshot, field))
    && snapshot.type === EXPECTED_TYPE
    && nonEmpty(snapshot.registrationRef)
    && nonEmpty(snapshot.registrationRevision)
    && snapshot.sourceProviderRef === EXPECTED_SOURCE_PROVIDER_REF
    && snapshot.sourceProviderRevision === EXPECTED_SOURCE_PROVIDER_REVISION
    && snapshot.verificationMethodRef === EXPECTED_VERIFICATION_METHOD_REF
    && snapshot.verificationMethodRevision === EXPECTED_VERIFICATION_METHOD_REVISION
    && TRUST_STATES.has(snapshot.sourceTrustState)
    && TRUST_STATES.has(snapshot.verificationMethodTrustState)
    && LIFECYCLE_STATES.has(snapshot.lifecycleState)
    && FRESHNESS_STATES.has(snapshot.freshnessState)
    && CONTRADICTION_STATES.has(snapshot.contradictionState)
    && nonEmpty(snapshot.registrationEvidenceRef);
}

function createGovernanceApprovalTrustRegistrationEvidenceAcceptance({
  registrationSnapshotPort,
  registrationEvidencePort,
  registrationLedger
} = {}) {
  if (typeof registrationSnapshotPort !== "function") throw new TypeError("registrationSnapshotPort must be a function");
  if (typeof registrationEvidencePort !== "function") throw new TypeError("registrationEvidencePort must be a function");
  for (const name of ["findByRegistrationRef", "commit"]) {
    if (!registrationLedger || typeof registrationLedger[name] !== "function") {
      throw new TypeError(`registrationLedger.${name} must be a function`);
    }
  }

  function accept(request) {
    if (!plain(request)
      || Object.keys(request).sort().join("|") !== ["expectedRegistrationRevision", "registrationRef", "rulesetVersion"].sort().join("|")
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.registrationRef)
      || !nonEmpty(request.expectedRegistrationRevision)) {
      return result(OUTCOMES.REJECTED, "unsupported request schema");
    }

    let snapshot;
    try { snapshot = registrationSnapshotPort({ registrationRef: request.registrationRef }); }
    catch (_) { return result(OUTCOMES.UNCERTAIN, "registration snapshot unavailable"); }
    if (!validSnapshot(snapshot) || snapshot.registrationRef !== request.registrationRef) {
      return result(OUTCOMES.REJECTED, "invalid trust registration snapshot");
    }
    if (snapshot.registrationRevision !== request.expectedRegistrationRevision) {
      return result(OUTCOMES.STALE, "registration revision does not match expected revision");
    }
    if (snapshot.lifecycleState !== "CURRENT" || snapshot.freshnessState !== "CURRENT") {
      return result(OUTCOMES.STALE, "trust registration is not current");
    }
    if (snapshot.contradictionState !== "NONE") {
      return result(OUTCOMES.CONFLICT, "trust registration has contradictory evidence");
    }

    let provenance;
    try { provenance = registrationEvidencePort({ evidenceRef: snapshot.registrationEvidenceRef }); }
    catch (_) { return result(OUTCOMES.UNCERTAIN, "registration provenance unavailable"); }
    if (!plain(provenance)
      || provenance.evidenceRef !== snapshot.registrationEvidenceRef
      || provenance.subjectRef !== snapshot.registrationRef
      || provenance.subjectRevision !== snapshot.registrationRevision
      || provenance.acceptanceState !== "ACCEPTED"
      || provenance.lifecycleState !== "CURRENT"
      || provenance.freshnessState !== "CURRENT"
      || provenance.contradictionState !== "NONE"
      || !nonEmpty(provenance.provenanceEvidenceRef)) {
      return result(OUTCOMES.UNCERTAIN, "registration provenance is not accepted/current/subject-bound");
    }

    let historical;
    try { historical = registrationLedger.findByRegistrationRef(snapshot.registrationRef); }
    catch (_) { return result(OUTCOMES.UNCERTAIN, "registration ledger unavailable"); }
    if (!Array.isArray(historical)) return result(OUTCOMES.UNCERTAIN, "registration ledger evidence invalid");
    if (historical.length > 1) return result(OUTCOMES.CONFLICT, "multiple accepted registrations for registrationRef");

    const material = {
      type: "ACCEPTED_GT63_GOVERNANCE_APPROVAL_TRUST_REGISTRATION_EVIDENCE",
      rulesetVersion: RULESET_VERSION,
      registrationRef: snapshot.registrationRef,
      registrationRevision: snapshot.registrationRevision,
      sourceProviderRef: snapshot.sourceProviderRef,
      sourceProviderRevision: snapshot.sourceProviderRevision,
      verificationMethodRef: snapshot.verificationMethodRef,
      verificationMethodRevision: snapshot.verificationMethodRevision,
      sourceTrustState: snapshot.sourceTrustState,
      verificationMethodTrustState: snapshot.verificationMethodTrustState,
      lifecycleState: snapshot.lifecycleState,
      freshnessState: snapshot.freshnessState,
      contradictionState: snapshot.contradictionState,
      registrationEvidenceRef: snapshot.registrationEvidenceRef,
      provenanceEvidenceRef: provenance.provenanceEvidenceRef,
      authority: "NONE"
    };
    const acceptanceId = `trust-registration-acceptance:${sha256(canonicalStringify(material)).slice(7)}`;
    const evidence = deepFreeze({ acceptanceId, ...material });

    if (historical.length === 1) {
      return canonicalStringify(historical[0]) === canonicalStringify(evidence)
        ? result(OUTCOMES.ALREADY_ACCEPTED, "same trust registration already accepted", historical[0])
        : result(OUTCOMES.CONFLICT, "registrationRef already accepted with different material");
    }

    let committed;
    try { committed = registrationLedger.commit(evidence); }
    catch (_) { return result(OUTCOMES.CONFLICT, "registration ledger commit conflict"); }
    if (!committed || committed.acceptanceId !== acceptanceId) {
      return result(OUTCOMES.CONFLICT, "registration ledger returned conflicting acceptance identity");
    }
    return result(OUTCOMES.ACCEPTED, null, committed);
  }

  return deepFreeze({ accept, authority: "NONE", rulesetVersion: RULESET_VERSION });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  OUTCOMES,
  EXPECTED_TYPE,
  EXPECTED_SOURCE_PROVIDER_REF,
  EXPECTED_SOURCE_PROVIDER_REVISION,
  EXPECTED_VERIFICATION_METHOD_REF,
  EXPECTED_VERIFICATION_METHOD_REVISION,
  createGovernanceApprovalTrustRegistrationEvidenceAcceptance
});
