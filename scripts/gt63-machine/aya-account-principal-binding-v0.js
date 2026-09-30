"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "aya-account-principal-binding-v0.1.0";
const COLLECTION = "gt63GovernanceEvidence";
const REPRESENTATION_REVISION = 1;
const EVIDENCE_TYPE = "GT63_AYA_ACCOUNT_PRINCIPAL_BINDING_EVIDENCE";
const DECISION_TYPE = "GT63_HUMAN_AYA_ACCOUNT_PRINCIPAL_BINDING_DECISION";
const DECISION = "ACCEPT_AYA_ACCOUNT_GT63_PRINCIPAL_BINDING";
const INITIAL_PRINCIPAL_REVISION = "aya-principal-binding-revision:1";
const AUTHORITY = "NONE";
const AUTHORITY_EFFECT = "NONE";

const OUTCOMES = Object.freeze({
  ACCEPTED: "ACCEPTED",
  ALREADY_ACCEPTED: "ALREADY_ACCEPTED",
  UNKNOWN: "UNKNOWN",
  REJECTED: "REJECTED",
  CONTRADICTED: "CONTRADICTED",
  INVALID: "INVALID"
});

function plain(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

function canonicalize(value) {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) {
    return Object.keys(value).sort().reduce((out, key) => {
      const item = value[key];
      if (item === undefined || typeof item === "function" || typeof item === "symbol") {
        throw new TypeError("unsupported AYA principal binding material");
      }
      out[key] = canonicalize(item);
      return out;
    }, {});
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("unsupported non-finite AYA principal binding number");
  }
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError("unsupported AYA principal binding material");
  }
  return typeof value === "string" ? value.normalize("NFC") : value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return crypto.createHash("sha256").update(Buffer.from(canonicalStringify(value), "utf8")).digest("hex");
}

function same(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

function result(outcome, reason, material = {}) {
  return Object.freeze({
    outcome,
    reason: reason || null,
    ...clone(material),
    authority: AUTHORITY,
    authorityEffect: AUTHORITY_EFFECT,
    principalEligibilityCreated: false,
    roleCreated: false,
    delegationCreated: false,
    humanGateCreated: false,
    governancePackageCreated: false,
    effectAuthorizationCreated: false,
    offerMutationPerformed: false
  });
}

function accepted(material) { return result(OUTCOMES.ACCEPTED, null, material); }
function alreadyAccepted(material) { return result(OUTCOMES.ALREADY_ACCEPTED, "same binding evidence already accepted", material); }
function unknown(reason, material) { return result(OUTCOMES.UNKNOWN, reason, material); }
function rejected(reason, material) { return result(OUTCOMES.REJECTED, reason, material); }
function contradicted(reason, material) { return result(OUTCOMES.CONTRADICTED, reason, material); }
function invalid(reason, material) { return result(OUTCOMES.INVALID, reason, material); }

function canonicalPrincipalRef({ agencyId, applicationUserId } = {}) {
  if (!nonEmpty(agencyId) || !nonEmpty(applicationUserId)) return null;
  return `gt63-principal:aya-account:${agencyId}:${applicationUserId}`;
}

function canonicalSubject(input = {}) {
  const agencyId = input.agencyId || input.ayaAccountSubject?.agencyId;
  const applicationUserId = input.applicationUserId || input.ayaAccountSubject?.applicationUserId;
  if (!nonEmpty(agencyId) || !nonEmpty(applicationUserId)) return null;
  return Object.freeze({ agencyId, applicationUserId });
}

function principalBindingEvidenceRefMaterial(record = {}) {
  return {
    rulesetVersion: record.rulesetVersion,
    evidenceType: EVIDENCE_TYPE,
    agencyId: record.agencyId,
    applicationUserId: record.applicationUserId,
    principalRef: record.principalRef,
    principalRevision: record.principalRevision,
    humanBindingDecisionEvidenceRef: record.humanBindingDecisionEvidenceRef,
    decision: record.createdByDecision,
    bindingLifecycleState: record.bindingLifecycleState,
    bindingFreshnessState: record.bindingFreshnessState,
    contradictionState: record.contradictionState,
    authority: record.authority,
    authorityEffect: record.authorityEffect
  };
}

function principalBindingEvidenceRef(record = {}) {
  return `gt63-principal-binding-evidence:aya-account:${digest(principalBindingEvidenceRefMaterial(record))}`;
}

function validateHumanBindingDecision(decision) {
  if (!plain(decision)) return unknown("human binding decision required");
  if (decision.type !== DECISION_TYPE || decision.decision !== DECISION) {
    return rejected("unsupported human binding decision");
  }
  if (decision.decisionRevision !== 1) return rejected("unsupported human binding decision revision");
  if (!nonEmpty(decision.decisionEvidenceRef)) return unknown("human binding decision evidence ref required");
  if (decision.decisionScope !== "INITIAL_BINDING_CREATION_ONLY") return rejected("unsupported human binding decision scope");
  if (decision.authority !== AUTHORITY || decision.authorityEffect !== AUTHORITY_EFFECT) {
    return rejected("human binding decision authority mismatch");
  }
  if (!plain(decision.decisionActor) || decision.decisionActor.actorKind !== "HUMAN_PRINCIPAL") {
    return unknown("human principal decision actor required");
  }
  if (!nonEmpty(decision.decisionActor.actorRef) || !nonEmpty(decision.decisionActor.actorEvidenceRef)) {
    return unknown("human decision actor evidence required");
  }
  const subject = canonicalSubject(decision);
  if (!subject) return unknown("AYA account subject required");
  const expectedPrincipalRef = canonicalPrincipalRef(subject);
  if (decision.proposedPrincipalRef !== expectedPrincipalRef) return contradicted("proposed principalRef mismatch");
  if (decision.proposedPrincipalRevision !== INITIAL_PRINCIPAL_REVISION) {
    return contradicted("proposed initial principalRevision mismatch");
  }
  const nonClaims = decision.nonClaims || {};
  const forbidden = [
    "principalEligibilityCreated",
    "roleCreated",
    "delegationCreated",
    "humanGateAuthorized",
    "governancePackageCreated",
    "effectAuthorized",
    "offerMutationAuthorized"
  ];
  if (forbidden.some((key) => nonClaims[key] !== false)) return rejected("human binding decision contains downstream authority claim");
  return accepted({ decision: clone(decision), subject, principalRef: expectedPrincipalRef });
}

function validateCurrentAccountSubject(accountRecord = {}, subject = {}) {
  if (!plain(accountRecord)) return unknown("current account record required");
  if (accountRecord.continuityState && accountRecord.continuityState !== "CURRENT") {
    return unknown("account continuity uncertain");
  }
  if (accountRecord.deletedAt || accountRecord.recreatedFrom || accountRecord.reassignedFromAgencyId) {
    return unknown("account continuity uncertain");
  }
  if (accountRecord.id !== subject.applicationUserId || (accountRecord.agencyId || "AGY-AYA") !== subject.agencyId) {
    return contradicted("current account subject mismatch");
  }
  return accepted({ accountRecord: clone(accountRecord) });
}

function recordFromDecision(decision = {}) {
  const decisionResult = validateHumanBindingDecision(decision);
  if (decisionResult.outcome !== OUTCOMES.ACCEPTED) return decisionResult;
  const { subject, principalRef } = decisionResult;
  const record = {
    type: EVIDENCE_TYPE,
    rulesetVersion: RULESET_VERSION,
    principalBindingEvidenceRef: null,
    agencyId: subject.agencyId,
    applicationUserId: subject.applicationUserId,
    principalRef,
    principalRevision: INITIAL_PRINCIPAL_REVISION,
    bindingLifecycleState: "CURRENT",
    bindingFreshnessState: "CURRENT",
    contradictionState: "NONE",
    humanBindingDecisionEvidenceRef: decision.decisionEvidenceRef,
    createdByDecision: DECISION,
    authority: AUTHORITY,
    authorityEffect: AUTHORITY_EFFECT,
    principalEligibilityCreated: false,
    roleCreated: false,
    delegationCreated: false,
    humanGateCreated: false,
    governancePackageCreated: false,
    effectAuthorizationCreated: false,
    offerMutationPerformed: false
  };
  record.principalBindingEvidenceRef = principalBindingEvidenceRef(record);
  return accepted({ record });
}

function validateBindingRecord(record = {}) {
  if (!plain(record)) return invalid("binding record required");
  if (record.type !== EVIDENCE_TYPE || record.rulesetVersion !== RULESET_VERSION) return rejected("binding evidence contract mismatch");
  if (record.authority !== AUTHORITY || record.authorityEffect !== AUTHORITY_EFFECT) return rejected("binding authority mismatch");
  const subject = canonicalSubject(record);
  if (!subject) return unknown("binding subject required");
  const expectedPrincipalRef = canonicalPrincipalRef(subject);
  if (record.principalRef !== expectedPrincipalRef) return contradicted("principalRef does not match canonical AYA account subject");
  if (record.principalRevision !== INITIAL_PRINCIPAL_REVISION) return contradicted("initial principalRevision mismatch");
  if (!nonEmpty(record.humanBindingDecisionEvidenceRef)) return unknown("human binding decision evidence ref required");
  if (record.createdByDecision !== DECISION) return rejected("binding evidence was not created by accepted binding decision");
  if (record.bindingLifecycleState !== "CURRENT" || record.bindingFreshnessState !== "CURRENT") {
    return unknown("binding evidence is not current");
  }
  if (record.contradictionState !== "NONE") return contradicted("binding evidence is contradicted");
  const flags = [
    "principalEligibilityCreated",
    "roleCreated",
    "delegationCreated",
    "humanGateCreated",
    "governancePackageCreated",
    "effectAuthorizationCreated",
    "offerMutationPerformed"
  ];
  if (flags.some((key) => record[key] !== false)) return rejected("binding evidence contains downstream authority claim");
  if (record.principalBindingEvidenceRef !== principalBindingEvidenceRef(record)) {
    return contradicted("principalBindingEvidenceRef mismatch");
  }
  return accepted({ record: clone(record), subject });
}

function envelopeFromRecord(record = {}) {
  const validation = validateBindingRecord(record);
  if (validation.outcome !== OUTCOMES.ACCEPTED) return validation;
  return accepted({
    envelope: {
      evidenceRef: record.principalBindingEvidenceRef,
      evidenceType: EVIDENCE_TYPE,
      representationRevision: REPRESENTATION_REVISION,
      record: clone(record)
    }
  });
}

function validateEnvelope(envelope = {}) {
  if (!plain(envelope)) return invalid("binding evidence envelope required");
  if (envelope.evidenceType !== EVIDENCE_TYPE) return rejected("unsupported binding evidence envelope type");
  if (envelope.representationRevision !== REPRESENTATION_REVISION) return rejected("unsupported binding evidence representation revision");
  if (!nonEmpty(envelope.evidenceRef)) return unknown("binding evidence envelope ref required");
  const recordResult = validateBindingRecord(envelope.record);
  if (recordResult.outcome !== OUTCOMES.ACCEPTED) return recordResult;
  if (envelope.evidenceRef !== envelope.record.principalBindingEvidenceRef) {
    return contradicted("envelope evidenceRef does not match record principalBindingEvidenceRef");
  }
  return accepted({ envelope: clone(envelope), record: clone(envelope.record) });
}

function assessCollection(entries = []) {
  if (!Array.isArray(entries)) return unknown("GT63 governance evidence ledger not established");
  for (const entry of entries.filter((item) => item?.evidenceType === EVIDENCE_TYPE)) {
    const valid = validateEnvelope(entry);
    if (valid.outcome !== OUTCOMES.ACCEPTED) return valid;
  }
  return accepted();
}

function createDurablePrincipalBindingLedger({ readDb, writeDb } = {}) {
  if (typeof readDb !== "function" || typeof writeDb !== "function") throw new TypeError("readDb and writeDb required");

  function collection() {
    const db = readDb();
    if (!plain(db) || !Array.isArray(db[COLLECTION])) return { db, result: unknown("GT63 governance evidence ledger not established") };
    const assessed = assessCollection(db[COLLECTION]);
    if (assessed.outcome !== OUTCOMES.ACCEPTED) return { db, result: assessed };
    return { db, entries: db[COLLECTION] };
  }

  function get(ref) {
    if (!nonEmpty(ref)) return unknown("principal binding evidence ref required");
    const state = collection();
    if (state.result) return state.result;
    const matches = state.entries.filter((entry) => entry.evidenceType === EVIDENCE_TYPE && entry.evidenceRef === ref);
    if (matches.length > 1) return contradicted("duplicate principal binding evidence identity");
    if (matches.length === 0) return unknown("principal binding evidence unavailable");
    const valid = validateEnvelope(matches[0]);
    return valid.outcome === OUTCOMES.ACCEPTED ? accepted({ record: valid.record, envelope: valid.envelope }) : valid;
  }

  function findCurrentBySubject(subject = {}) {
    const state = collection();
    if (state.result) return state.result;
    const matches = state.entries
      .filter((entry) => entry.evidenceType === EVIDENCE_TYPE)
      .map((entry) => entry.record)
      .filter((record) => record.agencyId === subject.agencyId && record.applicationUserId === subject.applicationUserId
        && record.bindingLifecycleState === "CURRENT");
    if (matches.length > 1) return contradicted("multiple current principal bindings for account subject");
    if (matches.length === 0) return unknown("current principal binding unavailable");
    return accepted({ record: clone(matches[0]) });
  }

  function commit(record = {}) {
    const validRecord = validateBindingRecord(record);
    if (validRecord.outcome !== OUTCOMES.ACCEPTED) return validRecord;
    const envelopeResult = envelopeFromRecord(record);
    if (envelopeResult.outcome !== OUTCOMES.ACCEPTED) return envelopeResult;
    const envelope = envelopeResult.envelope;
    const state = collection();
    if (state.result) return state.result;

    const sameRef = state.entries.filter((entry) => entry.evidenceType === EVIDENCE_TYPE && entry.evidenceRef === envelope.evidenceRef);
    if (sameRef.length > 1) return contradicted("duplicate principal binding evidence identity");
    if (sameRef.length === 1) {
      return same(sameRef[0], envelope)
        ? alreadyAccepted({ record: clone(record), envelope: clone(envelope) })
        : contradicted("conflicting principal binding evidence identity");
    }

    const competingSubject = state.entries.find((entry) =>
      entry.evidenceType === EVIDENCE_TYPE
      && entry.record?.agencyId === record.agencyId
      && entry.record?.applicationUserId === record.applicationUserId
      && entry.record?.bindingLifecycleState === "CURRENT"
    );
    if (competingSubject) return contradicted("competing current binding for account subject");

    const competingPrincipal = state.entries.find((entry) =>
      entry.evidenceType === EVIDENCE_TYPE
      && entry.record?.principalRef === record.principalRef
      && (entry.record?.agencyId !== record.agencyId || entry.record?.applicationUserId !== record.applicationUserId)
      && entry.record?.bindingLifecycleState === "CURRENT"
    );
    if (competingPrincipal) return contradicted("competing current account subject for principalRef");

    state.entries.push(clone(envelope));
    writeDb(state.db);
    return accepted({ record: clone(record), envelope: clone(envelope) });
  }

  return Object.freeze({ get, findCurrentBySubject, commit, authority: AUTHORITY, authorityEffect: AUTHORITY_EFFECT });
}

function buildCandidateBindingEvidence({ humanDecision, currentAccountRecord } = {}) {
  const decisionResult = validateHumanBindingDecision(humanDecision);
  if (decisionResult.outcome !== OUTCOMES.ACCEPTED) return decisionResult;
  const accountResult = validateCurrentAccountSubject(currentAccountRecord, decisionResult.subject);
  if (accountResult.outcome !== OUTCOMES.ACCEPTED) return accountResult;
  return recordFromDecision(humanDecision);
}

function verifyReadback({ ledger, principalBindingEvidenceRef: ref } = {}) {
  if (!ledger || typeof ledger.get !== "function") return unknown("durable principal binding ledger required");
  const read = ledger.get(ref);
  if (read.outcome !== OUTCOMES.ACCEPTED) return read;
  const envelopeResult = validateEnvelope(read.envelope);
  if (envelopeResult.outcome !== OUTCOMES.ACCEPTED) return envelopeResult;
  return accepted({
    record: envelopeResult.record,
    envelope: envelopeResult.envelope,
    verified: true
  });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  COLLECTION,
  REPRESENTATION_REVISION,
  EVIDENCE_TYPE,
  DECISION_TYPE,
  DECISION,
  INITIAL_PRINCIPAL_REVISION,
  AUTHORITY,
  AUTHORITY_EFFECT,
  OUTCOMES,
  canonicalPrincipalRef,
  canonicalSubject,
  principalBindingEvidenceRef,
  validateHumanBindingDecision,
  validateCurrentAccountSubject,
  buildCandidateBindingEvidence,
  validateBindingRecord,
  envelopeFromRecord,
  validateEnvelope,
  createDurablePrincipalBindingLedger,
  verifyReadback,
  canonicalStringify
});
