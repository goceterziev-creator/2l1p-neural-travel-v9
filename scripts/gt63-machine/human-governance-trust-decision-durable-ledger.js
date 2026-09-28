"use strict";

const COLLECTION = "gt63GovernanceEvidence";
const REPRESENTATION_REVISION = 1;
const SUPPORTED_TYPE = "GT63_GOVERNANCE_APPROVAL_TRUST_DECISION";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateDecision(ref, record) {
  if (typeof ref !== "string" || ref.length === 0) throw new TypeError("decision evidence ref required");
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new TypeError("decision record required");
  if (record.type !== SUPPORTED_TYPE) throw new Error("unsupported governance evidence type");
  if (record.decisionEvidenceRef !== ref) throw new Error("decision evidence identity mismatch");
  if (record.authority !== "NONE") throw new Error("durable decision evidence must remain authority NONE");
  return record;
}

function validateCollection(db, { allowUnestablished = false } = {}) {
  if (!db || typeof db !== "object" || Array.isArray(db)) throw new Error("invalid database snapshot");
  if (!Object.prototype.hasOwnProperty.call(db, COLLECTION)) {
    if (allowUnestablished) return null;
    throw new Error("GT63 governance evidence ledger not established");
  }
  if (!Array.isArray(db[COLLECTION])) throw new Error("invalid GT63 governance evidence ledger");
  return db[COLLECTION];
}

function validateEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("invalid GT63 governance evidence entry");
  if (entry.representationRevision !== REPRESENTATION_REVISION) throw new Error("unsupported GT63 governance evidence representation revision");
  if (entry.evidenceType !== SUPPORTED_TYPE) throw new Error("unsupported GT63 governance evidence entry type");
  validateDecision(entry.evidenceRef, entry.record);
  if (entry.evidenceRef !== entry.record.decisionEvidenceRef) throw new Error("GT63 governance evidence envelope identity mismatch");
  return entry;
}

function establishCollection(db) {
  const existing = validateCollection(db, { allowUnestablished: true });
  if (existing) return db;
  db[COLLECTION] = [];
  return db;
}

function createDurableTrustDecisionLedger({ readDb, writeDb } = {}) {
  if (typeof readDb !== "function") throw new TypeError("readDb required");
  if (typeof writeDb !== "function") throw new TypeError("writeDb required");

  function get(ref) {
    if (typeof ref !== "string" || ref.length === 0) return null;
    const db = readDb();
    const entries = validateCollection(db);
    const matches = entries.filter((entry) => {
      validateEntry(entry);
      return entry.evidenceRef === ref;
    });
    if (matches.length > 1) throw new Error("duplicate GT63 governance evidence identity");
    return matches.length === 1 ? clone(matches[0].record) : null;
  }

  function commit(ref, record) {
    validateDecision(ref, record);
    const db = readDb();
    const entries = validateCollection(db);
    entries.forEach(validateEntry);
    const matches = entries.filter((entry) => entry.evidenceRef === ref);
    if (matches.length > 1) throw new Error("duplicate GT63 governance evidence identity");
    if (matches.length === 1) {
      if (!exactEqual(matches[0].record, record)) throw new Error("conflicting GT63 governance evidence identity");
      return clone(matches[0].record);
    }

    const entry = {
      evidenceRef: ref,
      evidenceType: SUPPORTED_TYPE,
      representationRevision: REPRESENTATION_REVISION,
      record: clone(record)
    };
    entries.push(entry);
    writeDb(db);
    return clone(record);
  }

  return Object.freeze({ commit, get, authority: "NONE" });
}

module.exports = Object.freeze({
  COLLECTION,
  REPRESENTATION_REVISION,
  SUPPORTED_TYPE,
  establishCollection,
  createDurableTrustDecisionLedger
});
