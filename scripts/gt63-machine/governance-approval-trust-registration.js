"use strict";

const RULESET_VERSION = "governance-approval-trust-registration-v0.1.0";
const SOURCE_PROVIDER_REF = "gt63-machine:human-governance-approval-surface-v0";
const SOURCE_PROVIDER_REVISION = "1";
const VERIFICATION_METHOD_REF = "gt63-machine:verification-method:approval-surface-session-continuity-v0";
const VERIFICATION_METHOD_REVISION = "1";

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

function exact(record, fields) {
  return Boolean(record && typeof record === "object" && !Array.isArray(record)
    && Object.keys(record).every((key) => fields.has(key)));
}

const REGISTRATION_FIELDS = new Set([
  "type", "schemaVersion", "rulesetVersion", "registrationRevision",
  "sourceProviderRef", "sourceProviderRevision", "sourceTrustState",
  "verificationMethodRef", "verificationMethodRevision", "verificationMethodTrustState",
  "lifecycleState", "freshnessState", "contradictionState", "acceptedEvidenceRef",
  "supersedesRegistrationRef", "authority"
]);

function validRegistration(record) {
  return exact(record, REGISTRATION_FIELDS)
    && record.type === "GT63_GOVERNANCE_APPROVAL_TRUST_REGISTRATION"
    && record.schemaVersion === "1.0"
    && record.rulesetVersion === RULESET_VERSION
    && nonEmpty(record.registrationRevision)
    && record.sourceProviderRef === SOURCE_PROVIDER_REF
    && record.sourceProviderRevision === SOURCE_PROVIDER_REVISION
    && ["TRUSTED", "UNTRUSTED"].includes(record.sourceTrustState)
    && record.verificationMethodRef === VERIFICATION_METHOD_REF
    && record.verificationMethodRevision === VERIFICATION_METHOD_REVISION
    && ["TRUSTED", "UNTRUSTED"].includes(record.verificationMethodTrustState)
    && ["CURRENT", "REVOKED", "DEACTIVATED"].includes(record.lifecycleState)
    && ["CURRENT", "STALE"].includes(record.freshnessState)
    && ["NONE", "CONTRADICTORY_EVIDENCE"].includes(record.contradictionState)
    && nonEmpty(record.acceptedEvidenceRef)
    && (record.supersedesRegistrationRef === null || nonEmpty(record.supersedesRegistrationRef))
    && record.authority === "NONE";
}

function createGovernanceApprovalTrustRegistration({ registrationProvider } = {}) {
  if (typeof registrationProvider !== "function") {
    throw new TypeError("registrationProvider must be a function");
  }

  function resolve() {
    let registration;
    try { registration = registrationProvider(); }
    catch (_) {
      return deepFreeze({ outcome: "TRUST_REGISTRATION_UNAVAILABLE", registration: null, authority: "NONE" });
    }

    if (registration === null || registration === undefined) {
      return deepFreeze({ outcome: "TRUST_REGISTRATION_MISSING", registration: null, authority: "NONE" });
    }
    if (!validRegistration(registration)) {
      return deepFreeze({ outcome: "TRUST_REGISTRATION_INVALID", registration: null, authority: "NONE" });
    }
    if (registration.lifecycleState !== "CURRENT" || registration.freshnessState !== "CURRENT") {
      return deepFreeze({ outcome: "TRUST_REGISTRATION_INACTIVE", registration: clone(registration), authority: "NONE" });
    }
    if (registration.contradictionState !== "NONE") {
      return deepFreeze({ outcome: "TRUST_REGISTRATION_CONFLICT", registration: clone(registration), authority: "NONE" });
    }

    return deepFreeze({ outcome: "TRUST_REGISTRATION_RESOLVED", registration: clone(registration), authority: "NONE" });
  }

  return deepFreeze({
    authority: "NONE",
    rulesetVersion: RULESET_VERSION,
    resolve
  });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  SOURCE_PROVIDER_REF,
  SOURCE_PROVIDER_REVISION,
  VERIFICATION_METHOD_REF,
  VERIFICATION_METHOD_REVISION,
  validRegistration,
  createGovernanceApprovalTrustRegistration
});
