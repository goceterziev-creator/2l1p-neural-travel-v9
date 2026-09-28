"use strict";

const COLLECTION = "gt63GovernanceEvidence";
const REPRESENTATION_REVISION = 1;
const DECISION_TYPE = "GT63_LIFECYCLE_ISSUER_SCOPE_POLICY_ACCEPTANCE_DECISION";
const ACCEPTANCE_TYPE = "GT63_ACCEPTED_LIFECYCLE_ISSUER_SCOPE_POLICY";
const AUTHORITY = "NONE";

function plain(v) { return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function nonEmpty(v) { return typeof v === "string" && v.length > 0; }

function collection(db) {
  if (!plain(db) || !Array.isArray(db[COLLECTION])) {
    throw new Error("GT63 governance evidence ledger not established");
  }
  return db[COLLECTION];
}

function validateDecision(ref, record) {
  if (!nonEmpty(ref) || !plain(record)) throw new TypeError("lifecycle issuer decision evidence required");
  if (record.bootstrapDecisionEvidenceRef !== ref) throw new Error("lifecycle issuer decision identity mismatch");
  if (record.decision !== "ACCEPT_LIFECYCLE_ISSUER_SCOPE_POLICY") throw new Error("unsupported lifecycle issuer decision");
  if (record.authority !== AUTHORITY) throw new Error("lifecycle issuer decision authority must remain NONE");
  if (!nonEmpty(record.principalRef) || !nonEmpty(record.principalRevision)
    || !nonEmpty(record.sourceVerificationId) || !Number.isInteger(record.sourcePolicyRevision)
    || record.sourcePolicyRevision < 1 || !/^sha256:[0-9a-f]{64}$/.test(record.sourceBlobSha256)
    || record.lifecycleState !== "CURRENT" || record.freshnessState !== "CURRENT"
    || record.contradictionState !== "NONE") {
    throw new Error("invalid lifecycle issuer decision record");
  }
}

function validateAcceptance(ref, record) {
  if (!nonEmpty(ref) || !plain(record)) throw new TypeError("accepted lifecycle issuer policy evidence required");
  if (record.acceptanceId !== ref || record.type !== ACCEPTANCE_TYPE) throw new Error("accepted lifecycle issuer policy identity mismatch");
  if (record.authority !== AUTHORITY) throw new Error("accepted lifecycle issuer policy authority must remain NONE");
  if (!nonEmpty(record.sourceVerificationId) || !nonEmpty(record.rootVerificationId)
    || !nonEmpty(record.registeredSourceRef) || !Number.isInteger(record.sourcePolicyRevision)
    || record.sourcePolicyRevision < 1 || !nonEmpty(record.bootstrapHumanPrincipalRef)
    || !nonEmpty(record.bootstrapHumanPrincipalRevision)
    || record.issuerSetSemantics !== "CLOSED_WORLD_EXACT_ONE_HUMAN_V0"
    || record.delegationBootstrapIssuable !== false
    || record.lifecycleState !== "CURRENT" || record.freshnessState !== "CURRENT"
    || record.contradictionState !== "NONE"
    || record.roleAssigned !== false || record.principalEligible !== false
    || record.humanGateSatisfied !== false || record.continuationAuthorityCreated !== false
    || record.executionAuthorityCreated !== false || record.effectAuthorized !== false) {
    throw new Error("invalid accepted lifecycle issuer policy record");
  }
}

function validateEnvelope(entry, evidenceType, validateRecord) {
  if (!plain(entry) || entry.representationRevision !== REPRESENTATION_REVISION
    || entry.evidenceType !== evidenceType || !nonEmpty(entry.evidenceRef)) {
    throw new Error("invalid lifecycle issuer governance evidence envelope");
  }
  validateRecord(entry.evidenceRef, entry.record);
}

function createLedger({ readDb, writeDb, evidenceType, validateRecord } = {}) {
  if (typeof readDb !== "function" || typeof writeDb !== "function") throw new TypeError("readDb and writeDb required");
  function get(ref) {
    if (!nonEmpty(ref)) return null;
    const entries = collection(readDb());
    const matches = entries.filter((entry) => entry.evidenceType === evidenceType && entry.evidenceRef === ref);
    matches.forEach((entry) => validateEnvelope(entry, evidenceType, validateRecord));
    if (matches.length > 1) throw new Error("duplicate lifecycle issuer governance evidence identity");
    return matches.length === 1 ? clone(matches[0].record) : null;
  }
  function commit(ref, record) {
    validateRecord(ref, record);
    const db = readDb(), entries = collection(db);
    const matches = entries.filter((entry) => entry.evidenceType === evidenceType && entry.evidenceRef === ref);
    matches.forEach((entry) => validateEnvelope(entry, evidenceType, validateRecord));
    if (matches.length > 1) throw new Error("duplicate lifecycle issuer governance evidence identity");
    if (matches.length === 1) {
      if (!same(matches[0].record, record)) throw new Error("conflicting lifecycle issuer governance evidence identity");
      return clone(matches[0].record);
    }
    entries.push({ evidenceRef: ref, evidenceType, representationRevision: REPRESENTATION_REVISION, record: clone(record) });
    writeDb(db);
    return clone(record);
  }
  return Object.freeze({ get, commit, authority: AUTHORITY, evidenceType });
}

function createDurableLifecycleIssuerDecisionLedger(options = {}) {
  return createLedger({ ...options, evidenceType: DECISION_TYPE, validateRecord: validateDecision });
}
function createDurableLifecycleIssuerAcceptanceLedger(options = {}) {
  return createLedger({ ...options, evidenceType: ACCEPTANCE_TYPE, validateRecord: validateAcceptance });
}

module.exports = Object.freeze({
  COLLECTION, REPRESENTATION_REVISION, DECISION_TYPE, ACCEPTANCE_TYPE, AUTHORITY,
  createDurableLifecycleIssuerDecisionLedger, createDurableLifecycleIssuerAcceptanceLedger
});
