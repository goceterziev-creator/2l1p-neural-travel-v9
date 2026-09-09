"use strict";

const assert = require("node:assert/strict");
const producerModule = require("./governance-approval-trust-registration-provenance-producer");

function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function ledger() {
  const records = [];
  return {
    findBySubjectRef(ref) { return records.filter((r) => r.subjectRef === ref).map(clone); },
    commit(record) { records.push(clone(record)); return clone(record); },
    records
  };
}

function fixture(options = {}) {
  const sessionRef = "gt63-runtime-session:USR-ADMIN:1788987995896";
  const sessionRevision = "1";
  const principalRef = producerModule.EXPECTED_PRINCIPAL_REF;
  const binding = {
    outcome: "BINDING_EVIDENCE_ACCEPTED",
    binding: {
      bindingId: "human-source-binding:test",
      principalResolutionState: "RESOLVED",
      principalRef,
      principalRevision: "1",
      principalLifecycleState: "CURRENT",
      principalFreshnessState: "CURRENT",
      interactionBindingState: "BOUND",
      contradictionState: "NONE",
      contentDigest: producerModule.EXPECTED_APPROVAL_DIGEST,
      sessionRef,
      sessionRevision,
      authority: "NONE",
      ...(options.bindingPatch || {})
    },
    authority: "NONE"
  };
  const principal = {
    principalRef,
    principalRevision: "1",
    sessionRef,
    sessionRevision,
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    principalEvidenceRef: "gt63-process-local-evidence:github-authenticated-identity:test",
    authority: "NONE",
    ...(options.principalPatch || {})
  };
  const l = ledger();
  const producer = producerModule.createGovernanceApprovalTrustRegistrationProvenanceProducer({
    approvalBindingPort() { if (options.failBinding) throw new Error("unavailable"); return clone(binding); },
    principalIdentityPort() { if (options.failPrincipal) throw new Error("unavailable"); return clone(principal); },
    provenanceLedger: l
  });
  const request = (patch = {}) => ({
    rulesetVersion: producerModule.RULESET_VERSION,
    registrationRef: producerModule.EXPECTED_REGISTRATION_REF,
    registrationRevision: producerModule.EXPECTED_REGISTRATION_REVISION,
    ...patch
  });
  return { producer, request, ledger: l };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS - ${name}`);
}

test("constructor requires exact ports", () => {
  assert.throws(() => producerModule.createGovernanceApprovalTrustRegistrationProvenanceProducer({}), TypeError);
});

test("caller-added acceptance fields are rejected", () => {
  const f = fixture();
  const out = f.producer.produce(f.request({ acceptanceState: "ACCEPTED" }));
  assert.equal(out.outcome, producerModule.OUTCOMES.REJECTED);
});

test("unresolved principal binding cannot produce provenance", () => {
  const f = fixture({ bindingPatch: { principalResolutionState: "MISSING" } });
  assert.equal(f.producer.produce(f.request()).outcome, producerModule.OUTCOMES.UNCERTAIN);
});

test("wrong principal cannot produce provenance", () => {
  const f = fixture({ bindingPatch: { principalRef: "gt63-machine:principal:github:999" } });
  assert.equal(f.producer.produce(f.request()).outcome, producerModule.OUTCOMES.UNCERTAIN);
});

test("wrong approval digest cannot produce provenance", () => {
  const f = fixture({ bindingPatch: { contentDigest: `sha256:${"0".repeat(64)}` } });
  assert.equal(f.producer.produce(f.request()).outcome, producerModule.OUTCOMES.UNCERTAIN);
});

test("contradictory binding cannot produce provenance", () => {
  const f = fixture({ bindingPatch: { contradictionState: "CONTRADICTORY_EVIDENCE" } });
  assert.equal(f.producer.produce(f.request()).outcome, producerModule.OUTCOMES.UNCERTAIN);
});

test("principal must be bound to exact same session", () => {
  const f = fixture({ principalPatch: { sessionRef: "gt63-runtime-session:OTHER:1" } });
  assert.equal(f.producer.produce(f.request()).outcome, producerModule.OUTCOMES.UNCERTAIN);
});

test("exact current approval binding plus exact principal produces subject-bound provenance", () => {
  const f = fixture();
  const out = f.producer.produce(f.request());
  assert.equal(out.outcome, producerModule.OUTCOMES.PRODUCED);
  assert.equal(out.provenance.subjectRef, producerModule.EXPECTED_REGISTRATION_REF);
  assert.equal(out.provenance.subjectRevision, producerModule.EXPECTED_REGISTRATION_REVISION);
  assert.equal(out.provenance.acceptanceState, "ACCEPTED");
  assert.equal(out.provenance.principalRef, producerModule.EXPECTED_PRINCIPAL_REF);
  assert.equal(out.provenance.approvalContentDigest, producerModule.EXPECTED_APPROVAL_DIGEST);
  assert.equal(out.provenance.authority, "NONE");
});

test("exact replay is idempotent", () => {
  const f = fixture();
  const first = f.producer.produce(f.request());
  const second = f.producer.produce(f.request());
  assert.equal(first.outcome, producerModule.OUTCOMES.PRODUCED);
  assert.equal(second.outcome, producerModule.OUTCOMES.PRODUCED);
  assert.equal(second.reason, "same provenance already produced");
  assert.equal(second.provenance.evidenceRef, first.provenance.evidenceRef);
});

console.log(`${passed}/9 PASS`);
