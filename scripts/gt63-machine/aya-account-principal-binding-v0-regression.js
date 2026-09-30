"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const M = require("./aya-account-principal-binding-v0");

const ROOT = path.resolve(__dirname, "..", "..");
const serverSource = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");

let passed = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function store(seed = {}) {
  let db = {
    schemaVersion: "test",
    users: [],
    activities: [],
    offers: [],
    gt63GovernanceEvidence: [],
    ...clone(seed)
  };
  return {
    readDb: () => clone(db),
    writeDb: (next) => { db = clone(next); },
    raw: () => clone(db)
  };
}

function ledger(seed) {
  return M.createDurablePrincipalBindingLedger(store(seed));
}

function decision(overrides = {}) {
  const agencyId = overrides.agencyId || "AGY-AYA";
  const applicationUserId = overrides.applicationUserId || "USR-ADMIN";
  const principalRef = M.canonicalPrincipalRef({ agencyId, applicationUserId });
  return {
    type: M.DECISION_TYPE,
    decision: M.DECISION,
    decisionRevision: 1,
    decisionEvidenceRef: overrides.decisionEvidenceRef || "gt63-human-decision:aya-principal-binding:1",
    decidedAt: "2026-09-30T05:00:00.000Z",
    decisionActor: {
      actorKind: "HUMAN_PRINCIPAL",
      actorRef: "gt63-human-principal:goce",
      actorEvidenceRef: "gt63-human-decision-capture:1",
      ...(overrides.decisionActor || {})
    },
    ayaAccountSubject: { agencyId, applicationUserId },
    proposedPrincipalRef: Object.prototype.hasOwnProperty.call(overrides, "proposedPrincipalRef")
      ? overrides.proposedPrincipalRef
      : principalRef,
    proposedPrincipalRevision: Object.prototype.hasOwnProperty.call(overrides, "proposedPrincipalRevision")
      ? overrides.proposedPrincipalRevision
      : M.INITIAL_PRINCIPAL_REVISION,
    decisionScope: overrides.decisionScope || "INITIAL_BINDING_CREATION_ONLY",
    nonClaims: {
      principalEligibilityCreated: false,
      roleCreated: false,
      delegationCreated: false,
      humanGateAuthorized: false,
      governancePackageCreated: false,
      effectAuthorized: false,
      offerMutationAuthorized: false,
      ...(overrides.nonClaims || {})
    },
    authority: Object.prototype.hasOwnProperty.call(overrides, "authority") ? overrides.authority : "NONE",
    authorityEffect: Object.prototype.hasOwnProperty.call(overrides, "authorityEffect") ? overrides.authorityEffect : "NONE",
    ...(overrides.extra || {})
  };
}

function account(overrides = {}) {
  return {
    id: overrides.id || "USR-ADMIN",
    agencyId: overrides.agencyId || "AGY-AYA",
    email: "goce@example.test",
    createdAt: "2026-09-30T04:00:00.000Z",
    principalAuthEpoch: Object.prototype.hasOwnProperty.call(overrides, "principalAuthEpoch") ? overrides.principalAuthEpoch : 1,
    sessionVersion: Object.prototype.hasOwnProperty.call(overrides, "sessionVersion") ? overrides.sessionVersion : 1,
    ...overrides
  };
}

function candidate(options = {}) {
  return M.buildCandidateBindingEvidence({
    humanDecision: Object.prototype.hasOwnProperty.call(options, "humanDecision")
      ? options.humanDecision
      : decision(options.decision || {}),
    currentAccountRecord: Object.prototype.hasOwnProperty.call(options, "currentAccountRecord")
      ? options.currentAccountRecord
      : account(options.account || {})
  });
}

function acceptedCandidate(options) {
  const out = candidate(options);
  assert.equal(out.outcome, M.OUTCOMES.ACCEPTED);
  return out.record;
}

function noAuthority(out) {
  assert.equal(out.authority, "NONE");
  assert.equal(out.authorityEffect, "NONE");
  assert.equal(out.principalEligibilityCreated, false);
  assert.equal(out.roleCreated, false);
  assert.equal(out.delegationCreated, false);
  assert.equal(out.humanGateCreated, false);
  assert.equal(out.governancePackageCreated, false);
  assert.equal(out.effectAuthorizationCreated, false);
  assert.equal(out.offerMutationPerformed, false);
}

test("valid explicit human decision produces valid candidate binding evidence", () => {
  const out = candidate();
  assert.equal(out.outcome, M.OUTCOMES.ACCEPTED);
  assert.equal(out.record.type, M.EVIDENCE_TYPE);
  assert.equal(out.record.agencyId, "AGY-AYA");
  assert.equal(out.record.applicationUserId, "USR-ADMIN");
  noAuthority(out);
});

test("applicationUserId alone cannot establish canonical subject", () => {
  assert.equal(M.canonicalSubject({ applicationUserId: "USR-ADMIN" }), null);
});

test("agencyId plus applicationUserId produces canonical subject", () => {
  assert.deepEqual(M.canonicalSubject({ agencyId: "AGY-AYA", applicationUserId: "USR-ADMIN" }), {
    agencyId: "AGY-AYA",
    applicationUserId: "USR-ADMIN"
  });
});

test("canonical principalRef is deterministic", () => {
  const a = M.canonicalPrincipalRef({ agencyId: "AGY-AYA", applicationUserId: "USR-ADMIN" });
  const b = M.canonicalPrincipalRef({ agencyId: "AGY-AYA", applicationUserId: "USR-ADMIN" });
  assert.equal(a, b);
  assert.equal(a, "gt63-principal:aya-account:AGY-AYA:USR-ADMIN");
});

test("login alone cannot create binding", () => {
  assert.equal(candidate({ humanDecision: null }).outcome, M.OUTCOMES.UNKNOWN);
});

test("A-class evidence alone cannot create binding", () => {
  const aClassOnly = { type: "gt63_a_class_authentication_evidence", userId: "USR-ADMIN", agencyId: "AGY-AYA" };
  assert.equal(M.validateHumanBindingDecision(aClassOnly).outcome, M.OUTCOMES.REJECTED);
});

test("principalAuthEpoch cannot create binding", () => {
  assert.equal(candidate({ humanDecision: { principalAuthEpoch: 1 }, currentAccountRecord: account() }).outcome, M.OUTCOMES.REJECTED);
});

test("sessionVersion cannot become principalRevision", () => {
  const out = candidate({ decision: { proposedPrincipalRevision: "sessionVersion:1" } });
  assert.equal(out.outcome, M.OUTCOMES.CONTRADICTED);
});

test("principalAuthEpoch cannot become principalRevision", () => {
  const out = candidate({ decision: { proposedPrincipalRevision: "principalAuthEpoch:1" } });
  assert.equal(out.outcome, M.OUTCOMES.CONTRADICTED);
});

test("initial binding revision is exact", () => {
  assert.equal(acceptedCandidate().principalRevision, "aya-principal-binding-revision:1");
});

test("missing human decision remains unknown and creates no binding", () => {
  const out = candidate({ humanDecision: undefined });
  assert.equal(out.outcome, M.OUTCOMES.UNKNOWN);
  noAuthority(out);
});

test("missing durable ledger remains unknown", () => {
  const l = M.createDurablePrincipalBindingLedger({
    readDb: () => ({ schemaVersion: "test" }),
    writeDb: () => { throw new Error("must not write"); }
  });
  const out = l.commit(acceptedCandidate());
  assert.equal(out.outcome, M.OUTCOMES.UNKNOWN);
});

test("missing account record remains unknown", () => {
  assert.equal(candidate({ currentAccountRecord: null }).outcome, M.OUTCOMES.UNKNOWN);
});

test("uncertain account continuity remains unknown", () => {
  assert.equal(candidate({ account: { continuityState: "UNKNOWN" } }).outcome, M.OUTCOMES.UNKNOWN);
  assert.equal(candidate({ account: { deletedAt: "2026-09-30T05:00:00.000Z" } }).outcome, M.OUTCOMES.UNKNOWN);
});

test("positive subject mismatch is contradicted", () => {
  assert.equal(candidate({ account: { id: "USR-OTHER" } }).outcome, M.OUTCOMES.CONTRADICTED);
  assert.equal(candidate({ account: { agencyId: "AGY-OTHER" } }).outcome, M.OUTCOMES.CONTRADICTED);
});

test("malformed principalRef is contradicted", () => {
  assert.equal(candidate({ decision: { proposedPrincipalRef: "principal:wrong" } }).outcome, M.OUTCOMES.CONTRADICTED);
});

test("malformed initial principalRevision is contradicted", () => {
  assert.equal(candidate({ decision: { proposedPrincipalRevision: "aya-principal-binding-revision:2" } }).outcome, M.OUTCOMES.CONTRADICTED);
});

test("missing human decision evidence fails closed", () => {
  const d = decision();
  delete d.decisionEvidenceRef;
  assert.equal(candidate({ humanDecision: d }).outcome, M.OUTCOMES.UNKNOWN);
});

test("mismatched human decision evidence fails closed", () => {
  const record = acceptedCandidate();
  record.humanBindingDecisionEvidenceRef = "gt63-human-decision:aya-principal-binding:other";
  assert.equal(M.validateBindingRecord(record).outcome, M.OUTCOMES.CONTRADICTED);
});

test("identical duplicate evidence is idempotent", () => {
  const l = ledger();
  const record = acceptedCandidate();
  assert.equal(l.commit(record).outcome, M.OUTCOMES.ACCEPTED);
  const second = l.commit(record);
  assert.equal(second.outcome, M.OUTCOMES.ALREADY_ACCEPTED);
  noAuthority(second);
});

test("same evidenceRef with different record is contradiction", () => {
  const s = store();
  const l = M.createDurablePrincipalBindingLedger(s);
  const record = acceptedCandidate();
  assert.equal(l.commit(record).outcome, M.OUTCOMES.ACCEPTED);
  const db = s.raw();
  db.gt63GovernanceEvidence[0].record.applicationUserId = "USR-TAMPERED";
  s.writeDb(db);
  assert.equal(l.get(record.principalBindingEvidenceRef).outcome, M.OUTCOMES.CONTRADICTED);
});

test("competing current binding for same account subject is contradicted", () => {
  const s = store();
  const l = M.createDurablePrincipalBindingLedger(s);
  const first = acceptedCandidate();
  assert.equal(l.commit(first).outcome, M.OUTCOMES.ACCEPTED);
  const second = acceptedCandidate({ decision: { decisionEvidenceRef: "gt63-human-decision:aya-principal-binding:2" } });
  assert.equal(l.commit(second).outcome, M.OUTCOMES.CONTRADICTED);
});

test("competing current account subject for same principalRef is contradicted", () => {
  const s = store();
  const l = M.createDurablePrincipalBindingLedger(s);
  const first = acceptedCandidate();
  assert.equal(l.commit(first).outcome, M.OUTCOMES.ACCEPTED);
  const second = acceptedCandidate({
    decision: { applicationUserId: "USR-OTHER", proposedPrincipalRef: "gt63-principal:aya-account:AGY-AYA:USR-OTHER" },
    account: { id: "USR-OTHER" }
  });
  second.principalRef = first.principalRef;
  second.principalBindingEvidenceRef = M.principalBindingEvidenceRef(second);
  assert.equal(l.commit(second).outcome, M.OUTCOMES.CONTRADICTED);
});

test("durable envelope and record evidenceRef correspondence is verified", () => {
  const record = acceptedCandidate();
  const envelope = M.envelopeFromRecord(record);
  assert.equal(envelope.outcome, M.OUTCOMES.ACCEPTED);
  assert.equal(envelope.envelope.evidenceRef, record.principalBindingEvidenceRef);
  assert.equal(M.validateEnvelope(envelope.envelope).outcome, M.OUTCOMES.ACCEPTED);
});

test("representationRevision one is enforced", () => {
  const envelope = M.envelopeFromRecord(acceptedCandidate()).envelope;
  envelope.representationRevision = 2;
  assert.equal(M.validateEnvelope(envelope).outcome, M.OUTCOMES.REJECTED);
});

test("lifecycle current is required for accepted readback", () => {
  const record = acceptedCandidate();
  record.bindingLifecycleState = "STALE";
  record.principalBindingEvidenceRef = M.principalBindingEvidenceRef(record);
  assert.equal(M.validateBindingRecord(record).outcome, M.OUTCOMES.UNKNOWN);
});

test("freshness current is required for accepted readback", () => {
  const record = acceptedCandidate();
  record.bindingFreshnessState = "UNKNOWN";
  record.principalBindingEvidenceRef = M.principalBindingEvidenceRef(record);
  assert.equal(M.validateBindingRecord(record).outcome, M.OUTCOMES.UNKNOWN);
});

test("contradiction none is required for accepted readback", () => {
  const record = acceptedCandidate();
  record.contradictionState = "CONTRADICTED";
  record.principalBindingEvidenceRef = M.principalBindingEvidenceRef(record);
  assert.equal(M.validateBindingRecord(record).outcome, M.OUTCOMES.CONTRADICTED);
});

test("authority remains none", () => {
  const out = candidate({ decision: { authority: "ALLOW" } });
  assert.equal(out.outcome, M.OUTCOMES.REJECTED);
});

test("authorityEffect remains none", () => {
  const out = candidate({ decision: { authorityEffect: "CREATE_BINDING" } });
  assert.equal(out.outcome, M.OUTCOMES.REJECTED);
});

test("principalEligibilityCreated remains false", () => {
  const record = acceptedCandidate();
  record.principalEligibilityCreated = true;
  record.principalBindingEvidenceRef = M.principalBindingEvidenceRef(record);
  assert.equal(M.validateBindingRecord(record).outcome, M.OUTCOMES.REJECTED);
});

test("roleCreated remains false", () => {
  const record = acceptedCandidate();
  record.roleCreated = true;
  record.principalBindingEvidenceRef = M.principalBindingEvidenceRef(record);
  assert.equal(M.validateBindingRecord(record).outcome, M.OUTCOMES.REJECTED);
});

test("delegationCreated remains false", () => {
  const record = acceptedCandidate();
  record.delegationCreated = true;
  record.principalBindingEvidenceRef = M.principalBindingEvidenceRef(record);
  assert.equal(M.validateBindingRecord(record).outcome, M.OUTCOMES.REJECTED);
});

test("humanGateCreated remains false", () => {
  const record = acceptedCandidate();
  record.humanGateCreated = true;
  record.principalBindingEvidenceRef = M.principalBindingEvidenceRef(record);
  assert.equal(M.validateBindingRecord(record).outcome, M.OUTCOMES.REJECTED);
});

test("governancePackageCreated remains false", () => {
  const record = acceptedCandidate();
  record.governancePackageCreated = true;
  record.principalBindingEvidenceRef = M.principalBindingEvidenceRef(record);
  assert.equal(M.validateBindingRecord(record).outcome, M.OUTCOMES.REJECTED);
});

test("effectAuthorizationCreated remains false", () => {
  const record = acceptedCandidate();
  record.effectAuthorizationCreated = true;
  record.principalBindingEvidenceRef = M.principalBindingEvidenceRef(record);
  assert.equal(M.validateBindingRecord(record).outcome, M.OUTCOMES.REJECTED);
});

test("offerMutationPerformed remains false", () => {
  const record = acceptedCandidate();
  record.offerMutationPerformed = true;
  record.principalBindingEvidenceRef = M.principalBindingEvidenceRef(record);
  assert.equal(M.validateBindingRecord(record).outcome, M.OUTCOMES.REJECTED);
});

test("login/session/auth event cannot silently mutate binding implementation", () => {
  assert.equal(serverSource.includes("aya-account-principal-binding-v0"), false);
  assert.equal(serverSource.includes("GT63_AYA_ACCOUNT_PRINCIPAL_BINDING_EVIDENCE"), false);
});

test("process-local-only state cannot masquerade as durable binding evidence", () => {
  const l = M.createDurablePrincipalBindingLedger({
    readDb: () => ({ schemaVersion: "test", processLocalBindings: [acceptedCandidate()] }),
    writeDb: () => { throw new Error("must not write"); }
  });
  assert.equal(l.get(acceptedCandidate().principalBindingEvidenceRef).outcome, M.OUTCOMES.UNKNOWN);
});

test("readback verifier proves accepted durable record", () => {
  const l = ledger();
  const record = acceptedCandidate();
  assert.equal(l.commit(record).outcome, M.OUTCOMES.ACCEPTED);
  const out = M.verifyReadback({ ledger: l, principalBindingEvidenceRef: record.principalBindingEvidenceRef });
  assert.equal(out.outcome, M.OUTCOMES.ACCEPTED);
  assert.equal(out.verified, true);
  noAuthority(out);
});

test("readback verifier fails closed for missing record", () => {
  const out = M.verifyReadback({ ledger: ledger(), principalBindingEvidenceRef: "missing" });
  assert.equal(out.outcome, M.OUTCOMES.UNKNOWN);
});

test("principalBindingEvidenceRef is deterministic", () => {
  const a = acceptedCandidate();
  const b = acceptedCandidate();
  assert.equal(a.principalBindingEvidenceRef, b.principalBindingEvidenceRef);
});

test("changing decision evidence changes principalBindingEvidenceRef", () => {
  const a = acceptedCandidate();
  const b = acceptedCandidate({ decision: { decisionEvidenceRef: "gt63-human-decision:aya-principal-binding:2" } });
  assert.notEqual(a.principalBindingEvidenceRef, b.principalBindingEvidenceRef);
});

test("ledger preserves unrelated governance evidence", () => {
  const unrelated = { evidenceRef: "other:1", evidenceType: "OTHER", representationRevision: 1, record: { x: 1 } };
  const s = store({ gt63GovernanceEvidence: [unrelated] });
  const l = M.createDurablePrincipalBindingLedger(s);
  assert.equal(l.commit(acceptedCandidate()).outcome, M.OUTCOMES.ACCEPTED);
  assert.deepEqual(s.raw().gt63GovernanceEvidence[0], unrelated);
});

test("application account remains distinct from GT63 principal", () => {
  const record = acceptedCandidate();
  assert.equal(record.applicationUserId, "USR-ADMIN");
  assert.notEqual(record.applicationUserId, record.principalRef);
});

test("deterministic identity derivation alone returns no accepted evidence", () => {
  const principalRef = M.canonicalPrincipalRef({ agencyId: "AGY-AYA", applicationUserId: "USR-ADMIN" });
  assert.equal(principalRef, "gt63-principal:aya-account:AGY-AYA:USR-ADMIN");
  assert.equal(M.validateBindingRecord({ principalRef }).outcome, M.OUTCOMES.REJECTED);
});

for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error && error.stack ? error.stack : error);
    console.log(`${passed}/${tests.length} PASS`);
    process.exit(1);
  }
}

console.log(`${passed}/${tests.length} PASS`);
