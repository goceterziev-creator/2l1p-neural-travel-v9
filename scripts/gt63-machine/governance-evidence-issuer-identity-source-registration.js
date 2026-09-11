"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "governance-evidence-issuer-identity-source-registration-v0.1.0";
const AUTHORITY = "NONE";
const SUBJECT_KINDS = Object.freeze(["POLICY", "ASSIGNMENT", "DELEGATION"]);
const OUTCOMES = Object.freeze({
  REGISTERED: "GOVERNANCE_EVIDENCE_ISSUER_REGISTERED",
  NOT_REGISTERED: "GOVERNANCE_EVIDENCE_ISSUER_NOT_REGISTERED",
  UNKNOWN: "GOVERNANCE_EVIDENCE_ISSUER_REGISTRATION_UNKNOWN",
  INVALID: "GOVERNANCE_EVIDENCE_ISSUER_REGISTRATION_INVALID"
});

function plain(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function nonEmpty(value) { return typeof value === "string" && value.length > 0; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) return Object.keys(value).sort().reduce((out, key) => { out[key] = canonicalize(value[key]); return out; }, {});
  return value;
}
function digest(value) { return `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`; }
function result(outcome, reason, evidence = null) {
  return freeze({
    outcome,
    reason: reason || null,
    evidence: clone(evidence),
    authority: AUTHORITY,
    issuerPermissionCreated: false,
    policyEvidenceAccepted: false,
    assignmentEvidenceAccepted: false,
    delegationEvidenceAccepted: false,
    eligibilityCreated: false,
    humanGateSatisfied: false,
    continuationAuthorityCreated: false,
    executionAuthorityCreated: false,
    effectAuthorized: false
  });
}
function exact(value, fields) { return plain(value) && Object.keys(value).length === fields.length && Object.keys(value).every((key) => fields.includes(key)); }
function sameKinds(value) {
  return Array.isArray(value) && value.length === SUBJECT_KINDS.length && SUBJECT_KINDS.every((kind, i) => value[i] === kind);
}

function validVerification(record) {
  return plain(record)
    && record.type === "REGISTERED_GOVERNANCE_SOURCE_VERIFICATION"
    && record.status === "VERIFIED"
    && nonEmpty(record.sourceVerificationId)
    && nonEmpty(record.rootVerificationId)
    && nonEmpty(record.repositoryIdentity)
    && /^[0-9a-f]{40}$/.test(record.commitSha || "")
    && /^[0-9a-f]{40}$/.test(record.treeSha || "")
    && nonEmpty(record.registeredSourceRef)
    && nonEmpty(record.registeredSourcePath)
    && /^[0-9a-f]{40}$/.test(record.sourceBlobSha || "")
    && /^sha256:[0-9a-f]{64}$/.test(record.sourceBlobSha256 || "")
    && Number.isInteger(record.sourcePolicyRevision)
    && nonEmpty(record.sourceStatementClass)
    && nonEmpty(record.sourceIssuerPolicyNamespace)
    && nonEmpty(record.sourceStatus)
    && nonEmpty(record.issuerSetSemantics)
    && Array.isArray(record.permittedIssuerRefs)
    && record.permittedIssuerRefs.every(nonEmpty)
    && sameKinds(record.subjectKinds)
    && Array.isArray(record.evidenceRefs)
    && record.evidenceRefs.every(nonEmpty)
    && record.authority === AUTHORITY;
}

function createGovernanceEvidenceIssuerIdentitySourceRegistration({ registeredSourceVerificationPort } = {}) {
  if (typeof registeredSourceVerificationPort !== "function") {
    throw new TypeError("registeredSourceVerificationPort must be a function");
  }

  function assess(request) {
    const fields = ["rulesetVersion", "issuerRef", "issuerRevision", "subjectKind"];
    if (!exact(request, fields)
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.issuerRef)
      || !nonEmpty(request.issuerRevision)
      || !SUBJECT_KINDS.includes(request.subjectKind)) {
      return result(OUTCOMES.INVALID, "unsupported issuer registration request");
    }

    let sourceResult;
    try { sourceResult = registeredSourceVerificationPort(); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "registered governance source verification unavailable"); }

    if (!plain(sourceResult)
      || sourceResult.outcome !== "REGISTERED_GOVERNANCE_SOURCE_VERIFIED"
      || sourceResult.authority !== AUTHORITY
      || !validVerification(sourceResult.verification)) {
      return result(OUTCOMES.UNKNOWN, "repository-frozen governance source is not verified");
    }

    const source = sourceResult.verification;
    if (!source.subjectKinds.includes(request.subjectKind)) {
      return result(OUTCOMES.NOT_REGISTERED, "subject kind is outside verified issuer policy scope");
    }
    if (source.sourceStatus !== "CONFIGURED" && source.sourceStatus !== "UNCONFIGURED_FAIL_CLOSED") {
      return result(OUTCOMES.UNKNOWN, "verified issuer policy status is unsupported");
    }
    if (!source.issuerSetSemantics.startsWith("CLOSED_WORLD")) {
      return result(OUTCOMES.INVALID, "issuer policy is not closed-world");
    }
    if (source.sourceStatus === "UNCONFIGURED_FAIL_CLOSED" || source.permittedIssuerRefs.length === 0) {
      return result(OUTCOMES.NOT_REGISTERED, "verified issuer policy permits no issuer identities");
    }
    if (!source.permittedIssuerRefs.includes(request.issuerRef)) {
      return result(OUTCOMES.NOT_REGISTERED, "issuer identity is absent from verified closed-world policy");
    }

    const material = {
      type: "GOVERNANCE_EVIDENCE_ISSUER_SOURCE_REGISTRATION_EVIDENCE",
      schemaVersion: "1.0",
      rulesetVersion: RULESET_VERSION,
      issuerRef: request.issuerRef,
      issuerRevision: request.issuerRevision,
      subjectKind: request.subjectKind,
      sourceVerificationId: source.sourceVerificationId,
      rootVerificationId: source.rootVerificationId,
      repositoryIdentity: source.repositoryIdentity,
      commitSha: source.commitSha,
      treeSha: source.treeSha,
      registeredSourceRef: source.registeredSourceRef,
      registeredSourcePath: source.registeredSourcePath,
      sourceBlobSha: source.sourceBlobSha,
      sourceBlobSha256: source.sourceBlobSha256,
      sourcePolicyRevision: source.sourcePolicyRevision,
      issuerSetSemantics: source.issuerSetSemantics,
      authority: AUTHORITY
    };
    return result(OUTCOMES.REGISTERED, null, {
      registrationEvidenceRef: `gt63-evidence:governance-evidence-issuer-source-registration:${digest(material)}`,
      ...material
    });
  }

  return Object.freeze({ assess, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  AUTHORITY,
  SUBJECT_KINDS,
  OUTCOMES,
  createGovernanceEvidenceIssuerIdentitySourceRegistration
});
