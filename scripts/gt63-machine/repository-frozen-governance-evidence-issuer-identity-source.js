"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "repository-frozen-governance-evidence-issuer-identity-source-v0.1.0";
const OUTCOMES = Object.freeze({ VERIFIED: "VERIFIED", NOT_VERIFIED: "NOT_VERIFIED", UNKNOWN: "UNKNOWN", INVALID: "INVALID" });
const EXPECTED = Object.freeze({
  repositoryIdentity: "goceterziev-creator/2l1p-neural-travel-v9",
  sourcePath: "config/gt63-machine/governance-evidence-issuer-identity-source-v0.json",
  type: "GOVERNANCE_EVIDENCE_ISSUER_IDENTITY_SOURCE",
  statementClass: "GOVERNANCE_EVIDENCE_ISSUER_IDENTITY",
  status: "CANDIDATE_NOT_ACCEPTED",
  authority: "NONE"
});

function digest(v) { return `sha256:${crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex")}`; }
function base(outcome, reason) { return { rulesetVersion: RULESET_VERSION, outcome, reason, evidence: null, authority: "NONE", issuerPermissionCreated: false, policyEvidenceAccepted: false, assignmentEvidenceAccepted: false, delegationEvidenceAccepted: false, principalEligibilityCreated: false, humanGateSatisfied: false, continuationAuthorityCreated: false, executionAuthorityCreated: false, effectAuthorized: false }; }
function validSha(v,n){ return typeof v === "string" && new RegExp(`^[0-9a-f]{${n}}$`).test(v); }
function exactKeys(o, keys) { return o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).sort().join("|") === [...keys].sort().join("|"); }

function createRepositoryFrozenGovernanceEvidenceIssuerIdentitySource({ repositorySourcePort } = {}) {
  if (typeof repositorySourcePort !== "function") throw new TypeError("repositorySourcePort is required");
  return Object.freeze({
    verify(request) {
      const allowed = ["rulesetVersion","issuerRef","issuerRevision"];
      if (!exactKeys(request, allowed) || request.rulesetVersion !== RULESET_VERSION || typeof request.issuerRef !== "string" || !request.issuerRef || typeof request.issuerRevision !== "string" || !request.issuerRevision) return base(OUTCOMES.INVALID,"INVALID_REQUEST");
      let observed;
      try { observed = repositorySourcePort({ sourcePath: EXPECTED.sourcePath }); } catch { return base(OUTCOMES.UNKNOWN,"REPOSITORY_SOURCE_UNAVAILABLE"); }
      if (!observed || observed.status !== "VERIFIED" || observed.authority !== "NONE") return base(OUTCOMES.UNKNOWN,"SOURCE_NOT_REPOSITORY_VERIFIED");
      if (observed.verificationMethod !== "AUTHORITATIVE_GIT_BLOB_MEMBERSHIP_V1" || observed.repositoryIdentity !== EXPECTED.repositoryIdentity || observed.sourcePath !== EXPECTED.sourcePath) return base(OUTCOMES.UNKNOWN,"PROVENANCE_NOT_EXACT");
      if (!validSha(observed.commitSha,40) || !validSha(observed.treeSha,40) || !validSha(observed.sourceBlobSha,40) || !/^sha256:[0-9a-f]{64}$/.test(observed.sourceBlobSha256 || "")) return base(OUTCOMES.UNKNOWN,"PROVENANCE_IDENTITY_INVALID");
      const source = observed.source;
      if (!source || source.type !== EXPECTED.type || source.statementClass !== EXPECTED.statementClass || source.status !== EXPECTED.status || source.authority !== EXPECTED.authority || source.repositoryIdentity !== EXPECTED.repositoryIdentity) return base(OUTCOMES.NOT_VERIFIED,"SOURCE_CONTRACT_MISMATCH");
      if (source.issuerRef !== request.issuerRef || source.issuerRevision !== request.issuerRevision) return base(OUTCOMES.NOT_VERIFIED,"ISSUER_IDENTITY_MISMATCH");
      if (!Array.isArray(source.subjectKinds) || source.subjectKinds.length !== 3 || !["POLICY","ASSIGNMENT","DELEGATION"].every(x => source.subjectKinds.includes(x))) return base(OUTCOMES.NOT_VERIFIED,"SUBJECT_KINDS_MISMATCH");
      const evidence = Object.freeze({ type:"REPOSITORY_FROZEN_GOVERNANCE_EVIDENCE_ISSUER_IDENTITY_SOURCE_VERIFICATION", issuerRef:source.issuerRef, issuerRevision:source.issuerRevision, sourcePath:observed.sourcePath, repositoryIdentity:observed.repositoryIdentity, commitSha:observed.commitSha, treeSha:observed.treeSha, sourceBlobSha:observed.sourceBlobSha, sourceBlobSha256:observed.sourceBlobSha256, sourceVerificationRef:digest({issuerRef:source.issuerRef,issuerRevision:source.issuerRevision,commitSha:observed.commitSha,treeSha:observed.treeSha,sourceBlobSha:observed.sourceBlobSha,sourceBlobSha256:observed.sourceBlobSha256}), authority:"NONE" });
      return Object.freeze({ ...base(OUTCOMES.VERIFIED,null), evidence });
    }
  });
}

module.exports = { RULESET_VERSION, OUTCOMES, EXPECTED, createRepositoryFrozenGovernanceEvidenceIssuerIdentitySource };
