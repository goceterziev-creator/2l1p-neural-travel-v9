"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "accepted-lifecycle-issuer-scope-policy-v0.1.0";
const SCHEMA_VERSION = "1.0";
const SOURCE_REF = "gt63-machine:repository-source:governance-lifecycle-issuer-scope-policy";
const SOURCE_STATUS = "UNCONFIGURED_FAIL_CLOSED";
const ISSUER_SET_SEMANTICS = "CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY";
const STATEMENT_CLASS = "GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY";
const GOVERNANCE_NAMESPACE = "GT63_MACHINE_GOVERNANCE";
const ISSUER_POLICY_NAMESPACE = "GT63_MACHINE_GOVERNANCE_LIFECYCLE_ISSUER_SCOPE";
const SUBJECT_KINDS = Object.freeze(["POLICY", "ASSIGNMENT", "DELEGATION"]);

const OUTCOMES = Object.freeze({
  ACCEPTED: "LIFECYCLE_ISSUER_SCOPE_POLICY_ACCEPTED",
  ALREADY_ACCEPTED: "LIFECYCLE_ISSUER_SCOPE_POLICY_ALREADY_ACCEPTED",
  REJECTED: "LIFECYCLE_ISSUER_SCOPE_POLICY_REJECTED",
  STALE: "LIFECYCLE_ISSUER_SCOPE_POLICY_STALE",
  UNCERTAIN: "LIFECYCLE_ISSUER_SCOPE_POLICY_UNCERTAIN",
  CONFLICT: "LIFECYCLE_ISSUER_SCOPE_POLICY_CONFLICT"
});

function plain(v) { return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function nonEmpty(v) { return typeof v === "string" && v.length > 0; }
function exact(v, fields) {
  return plain(v) && Object.keys(v).length === fields.length
    && Object.keys(v).every((key) => fields.includes(key));
}
function compareCodePoints(left, right) {
  const a = Array.from(String(left)); const b = Array.from(String(right));
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const d = a[i].codePointAt(0) - b[i].codePointAt(0); if (d) return d;
  }
  return a.length - b.length;
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) return Object.keys(value).sort(compareCodePoints).reduce((out, rawKey) => {
    const key = rawKey.normalize("NFC");
    if (Object.prototype.hasOwnProperty.call(out, key)) throw new TypeError("canonical key normalization conflict");
    out[key] = canonicalize(value[rawKey]); return out;
  }, {});
  return typeof value === "string" ? value.normalize("NFC") : value;
}
const canonicalStringify = (value) => JSON.stringify(canonicalize(value));
const digestValue = (value) => `sha256:${crypto.createHash("sha256").update(Buffer.from(canonicalStringify(value), "utf8")).digest("hex")}`;
const clone = (v) => v === null || v === undefined ? v : JSON.parse(JSON.stringify(v));
function deepFreeze(v) { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(deepFreeze); } return v; }
function result(outcome, reason, evidence = null) { return deepFreeze({ outcome, reason: reason || null, evidence: clone(evidence), authority: "NONE" }); }
function call(port, arg) { try { return { ok: true, value: port(deepFreeze(clone(arg))) }; } catch (_) { return { ok: false, value: null }; } }

function validVerifiedSource(record) {
  if (!plain(record) || record.type !== "REGISTERED_GOVERNANCE_SOURCE_VERIFICATION"
    || record.status !== "VERIFIED" || record.authority !== "NONE"
    || !nonEmpty(record.sourceVerificationId) || !/^sha256:[0-9a-f]{64}$/.test(record.sourceVerificationId)
    || !nonEmpty(record.rootVerificationId) || !/^sha256:[0-9a-f]{64}$/.test(record.rootVerificationId)
    || record.registeredSourceRef !== SOURCE_REF
    || record.sourceStatementClass !== STATEMENT_CLASS
    || record.sourceIssuerPolicyNamespace !== ISSUER_POLICY_NAMESPACE
    || record.sourceStatus !== SOURCE_STATUS
    || record.issuerSetSemantics !== ISSUER_SET_SEMANTICS
    || record.sourcePolicyRevision !== 1
    || !Array.isArray(record.permittedIssuerRefs) || record.permittedIssuerRefs.length !== 0
    || !Array.isArray(record.subjectKinds)
    || canonicalStringify(record.subjectKinds) !== canonicalStringify(SUBJECT_KINDS)
    || record.governanceNamespace && record.governanceNamespace !== GOVERNANCE_NAMESPACE) return false;
  return true;
}

function validAcceptance(record) {
  return plain(record)
    && record.type === "LIFECYCLE_ISSUER_SCOPE_POLICY_EVIDENCE_ACCEPTANCE"
    && nonEmpty(record.policyAcceptanceId)
    && record.registeredSourceRef === SOURCE_REF
    && record.policyRevision === 1
    && /^sha256:[0-9a-f]{64}$/.test(record.policyContentDigest)
    && /^sha256:[0-9a-f]{64}$/.test(record.sourceVerificationId)
    && /^sha256:[0-9a-f]{64}$/.test(record.rootVerificationId)
    && record.sourceStatus === SOURCE_STATUS
    && record.issuerSetSemantics === ISSUER_SET_SEMANTICS
    && Array.isArray(record.permittedIssuerRefs) && record.permittedIssuerRefs.length === 0
    && Array.isArray(record.subjectKinds)
    && canonicalStringify(record.subjectKinds) === canonicalStringify(SUBJECT_KINDS)
    && record.authority === "NONE";
}

function createAcceptedLifecycleIssuerScopePolicy({ registeredSourceVerificationPort, policyLedger }) {
  if (typeof registeredSourceVerificationPort !== "function") {
    throw new TypeError("registeredSourceVerificationPort must be a function");
  }
  for (const method of ["findBySourceRef", "commit"]) {
    if (!policyLedger || typeof policyLedger[method] !== "function") {
      throw new TypeError(`policyLedger.${method} must be a function`);
    }
  }

  function accept(request) {
    const fields = ["rulesetVersion", "expectedSourceVerificationId", "expectedRootVerificationId"];
    if (!exact(request, fields) || request.rulesetVersion !== RULESET_VERSION
      || !/^sha256:[0-9a-f]{64}$/.test(request.expectedSourceVerificationId)
      || !/^sha256:[0-9a-f]{64}$/.test(request.expectedRootVerificationId)) {
      return result(OUTCOMES.REJECTED, "unsupported acceptance request");
    }

    const verificationResult = call(registeredSourceVerificationPort, {});
    if (!verificationResult.ok) return result(OUTCOMES.UNCERTAIN, "registered source verification unavailable");
    const verification = verificationResult.value;
    if (!validVerifiedSource(verification)) {
      return result(OUTCOMES.UNCERTAIN, "registered source verification invalid or not verified");
    }
    if (verification.sourceVerificationId !== request.expectedSourceVerificationId
      || verification.rootVerificationId !== request.expectedRootVerificationId) {
      return result(OUTCOMES.STALE, "registered source or root verification moved");
    }

    const policyMaterial = canonicalize({
      registeredSourceRef: SOURCE_REF,
      policyRevision: verification.sourcePolicyRevision,
      sourceStatus: verification.sourceStatus,
      issuerSetSemantics: verification.issuerSetSemantics,
      permittedIssuerRefs: verification.permittedIssuerRefs,
      subjectKinds: verification.subjectKinds
    });
    const policyContentDigest = digestValue(policyMaterial);
    const acceptanceMaterial = canonicalize({
      type: "LIFECYCLE_ISSUER_SCOPE_POLICY_EVIDENCE_ACCEPTANCE",
      schemaVersion: SCHEMA_VERSION,
      rulesetVersion: RULESET_VERSION,
      registeredSourceRef: SOURCE_REF,
      policyRevision: verification.sourcePolicyRevision,
      policyContentDigest,
      sourceVerificationId: verification.sourceVerificationId,
      rootVerificationId: verification.rootVerificationId,
      sourceStatus: verification.sourceStatus,
      issuerSetSemantics: verification.issuerSetSemantics,
      permittedIssuerRefs: verification.permittedIssuerRefs,
      subjectKinds: verification.subjectKinds,
      authority: "NONE"
    });
    const policyAcceptanceId = digestValue(acceptanceMaterial);
    const evidence = deepFreeze({ policyAcceptanceId, ...acceptanceMaterial });

    const existingResult = call(policyLedger.findBySourceRef.bind(policyLedger), { registeredSourceRef: SOURCE_REF });
    if (!existingResult.ok) return result(OUTCOMES.UNCERTAIN, "policy ledger unavailable");
    const existing = existingResult.value;
    if (existing !== null && existing !== undefined) {
      if (!validAcceptance(existing)) return result(OUTCOMES.CONFLICT, "existing policy acceptance is invalid");
      if (canonicalStringify(existing) === canonicalStringify(evidence)) {
        return result(OUTCOMES.ALREADY_ACCEPTED, null, existing);
      }
      return result(OUTCOMES.CONFLICT, "different issuer-scope policy already accepted for frozen V0 source");
    }

    const commitResult = call(policyLedger.commit.bind(policyLedger), evidence);
    if (!commitResult.ok) return result(OUTCOMES.UNCERTAIN, "policy ledger commit unavailable");
    if (commitResult.value !== undefined && commitResult.value !== null
      && canonicalStringify(commitResult.value) !== canonicalStringify(evidence)) {
      return result(OUTCOMES.CONFLICT, "policy ledger committed conflicting evidence");
    }
    return result(OUTCOMES.ACCEPTED, null, evidence);
  }

  return Object.freeze({ accept });
}

module.exports = Object.freeze({
  RULESET_VERSION, OUTCOMES, SOURCE_REF, SOURCE_STATUS, ISSUER_SET_SEMANTICS,
  createAcceptedLifecycleIssuerScopePolicy, canonicalStringify, digestValue
});
