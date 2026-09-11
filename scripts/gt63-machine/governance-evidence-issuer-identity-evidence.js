"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "governance-evidence-issuer-identity-evidence-v0.1.0";
const AUTHORITY = "NONE";
const STATEMENT_CLASS = "GOVERNANCE_EVIDENCE_ISSUER_IDENTITY";
const VERIFICATION_METHOD = "AUTHORITATIVE_GIT_BLOB_MEMBERSHIP_V1";
const OUTCOMES = Object.freeze({
  ESTABLISHED: "GOVERNANCE_EVIDENCE_ISSUER_IDENTITY_ESTABLISHED",
  NOT_ESTABLISHED: "GOVERNANCE_EVIDENCE_ISSUER_IDENTITY_NOT_ESTABLISHED",
  UNKNOWN: "GOVERNANCE_EVIDENCE_ISSUER_IDENTITY_UNKNOWN",
  INVALID: "GOVERNANCE_EVIDENCE_ISSUER_IDENTITY_INVALID"
});

function plain(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function nonEmpty(value) { return typeof value === "string" && value.length > 0; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function exact(value, fields) { return plain(value) && Object.keys(value).length === fields.length && Object.keys(value).every((key) => fields.includes(key)); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) return Object.keys(value).sort().reduce((out, key) => { out[key] = canonicalize(value[key]); return out; }, {});
  return value;
}
function digest(value) { return `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`; }
function result(outcome, reason, evidence = null) {
  return freeze({ outcome, reason: reason || null, evidence: clone(evidence), authority: AUTHORITY,
    issuerPermissionCreated: false, policyEvidenceAccepted: false, assignmentEvidenceAccepted: false,
    delegationEvidenceAccepted: false, eligibilityCreated: false, authorizationCreated: false,
    humanGateSatisfied: false, continuationAuthorityCreated: false, executionAuthorityCreated: false,
    effectAuthorized: false });
}

const IDENTITY_FIELDS = Object.freeze([
  "type", "status", "statementClass", "issuerRef", "issuerRevision", "repositoryIdentity",
  "commitSha", "treeSha", "sourceRef", "sourcePath", "blobSha", "blobSha256",
  "verificationMethod", "provenanceEvidenceRefs", "authority"
]);

function validIdentityEvidence(record) {
  return exact(record, IDENTITY_FIELDS)
    && record.type === "REPOSITORY_FROZEN_GOVERNANCE_ISSUER_IDENTITY_EVIDENCE"
    && record.status === "VERIFIED"
    && record.statementClass === STATEMENT_CLASS
    && nonEmpty(record.issuerRef) && nonEmpty(record.issuerRevision)
    && nonEmpty(record.repositoryIdentity)
    && /^[0-9a-f]{40}$/.test(record.commitSha || "")
    && /^[0-9a-f]{40}$/.test(record.treeSha || "")
    && nonEmpty(record.sourceRef) && nonEmpty(record.sourcePath)
    && /^[0-9a-f]{40}$/.test(record.blobSha || "")
    && /^sha256:[0-9a-f]{64}$/.test(record.blobSha256 || "")
    && record.verificationMethod === VERIFICATION_METHOD
    && Array.isArray(record.provenanceEvidenceRefs) && record.provenanceEvidenceRefs.length > 0
    && record.provenanceEvidenceRefs.every(nonEmpty)
    && record.authority === AUTHORITY;
}

function createGovernanceEvidenceIssuerIdentityEvidence({ repositoryIssuerIdentityEvidencePort } = {}) {
  if (typeof repositoryIssuerIdentityEvidencePort !== "function") {
    throw new TypeError("repositoryIssuerIdentityEvidencePort must be a function");
  }

  function assess(request) {
    const fields = ["rulesetVersion", "issuerRef", "issuerRevision"];
    if (!exact(request, fields) || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.issuerRef) || !nonEmpty(request.issuerRevision)) {
      return result(OUTCOMES.INVALID, "unsupported issuer identity request");
    }

    let observed;
    try { observed = repositoryIssuerIdentityEvidencePort({ issuerRef: request.issuerRef, issuerRevision: request.issuerRevision }); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "repository issuer identity evidence unavailable"); }

    if (observed == null) return result(OUTCOMES.NOT_ESTABLISHED, "no repository-frozen issuer identity evidence exists");
    if (!plain(observed)) return result(OUTCOMES.UNKNOWN, "repository issuer identity evidence malformed");

    if (observed.statementClass !== STATEMENT_CLASS) {
      return result(OUTCOMES.NOT_ESTABLISHED, "repository evidence does not assert issuer identity");
    }
    if (!validIdentityEvidence(observed)) {
      return result(OUTCOMES.UNKNOWN, "issuer identity evidence is invalid, unverified, or outside V0 provenance contract");
    }
    if (observed.issuerRef !== request.issuerRef || observed.issuerRevision !== request.issuerRevision) {
      return result(OUTCOMES.NOT_ESTABLISHED, "repository-frozen issuer identity does not match requested identity");
    }

    const material = {
      type: "GT63_GOVERNANCE_EVIDENCE_ISSUER_IDENTITY_EVIDENCE",
      schemaVersion: "1.0", rulesetVersion: RULESET_VERSION,
      issuerRef: observed.issuerRef, issuerRevision: observed.issuerRevision,
      repositoryIdentity: observed.repositoryIdentity, commitSha: observed.commitSha,
      treeSha: observed.treeSha, sourceRef: observed.sourceRef, sourcePath: observed.sourcePath,
      blobSha: observed.blobSha, blobSha256: observed.blobSha256,
      verificationMethod: observed.verificationMethod,
      provenanceEvidenceRefs: Array.from(new Set(observed.provenanceEvidenceRefs)).sort(),
      authority: AUTHORITY
    };
    return result(OUTCOMES.ESTABLISHED, null, {
      issuerIdentityEvidenceRef: `gt63-evidence:governance-evidence-issuer-identity:${digest(material)}`,
      ...material
    });
  }

  return Object.freeze({ assess, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
}

module.exports = Object.freeze({ RULESET_VERSION, AUTHORITY, STATEMENT_CLASS, VERIFICATION_METHOD, OUTCOMES,
  createGovernanceEvidenceIssuerIdentityEvidence });
