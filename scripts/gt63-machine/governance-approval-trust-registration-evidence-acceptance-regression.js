"use strict";

const assert = require("node:assert/strict");
const mod = require("./governance-approval-trust-registration-evidence-acceptance");

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function fixture(options = {}) {
  const snapshot = {
    type: mod.EXPECTED_TYPE,
    registrationRef: "gt63-machine:trust-registration:approval-surface-v0",
    registrationRevision: "1",
    sourceProviderRef: mod.EXPECTED_SOURCE_PROVIDER_REF,
    sourceProviderRevision: mod.EXPECTED_SOURCE_PROVIDER_REVISION,
    verificationMethodRef: mod.EXPECTED_VERIFICATION_METHOD_REF,
    verificationMethodRevision: mod.EXPECTED_VERIFICATION_METHOD_REVISION,
    sourceTrustState: "TRUSTED",
    verificationMethodTrustState: "TRUSTED",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    registrationEvidenceRef: "evidence:trust-registration:approval-surface-v0",
    ...(options.snapshotPatch || {})
  };
  const provenance = {
    evidenceRef: snapshot.registrationEvidenceRef,
    subjectRef: snapshot.registrationRef,
    subjectRevision: snapshot.registrationRevision,
    acceptanceState: "ACCEPTED",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    provenanceEvidenceRef: "evidence:provenance:trust-registration:approval-surface-v0",
    ...(options.provenancePatch || {})
  };
  const records = clone(options.seed || []);
  const registrationLedger = {
    findByRegistrationRef(ref) { return records.filter((x) => x.registrationRef === ref).map(clone); },
    commit(value) { records.push(clone(value)); return clone(value); }
  };
  const component = mod.createGovernanceApprovalTrustRegistrationEvidenceAcceptance({
    registrationSnapshotPort() {
      if (options.failSnapshot) throw new Error("unavailable");
      return options.missingSnapshot ? null : clone(snapshot);
    },
    registrationEvidencePort() {
      if (options.failProvenance) throw new Error("unavailable");
      return options.missingProvenance ? null : clone(provenance);
    },
    registrationLedger
  });
  const request = {
    rulesetVersion: mod.RULESET_VERSION,
    registrationRef: snapshot.registrationRef,
    expectedRegistrationRevision: "1",
    ...(options.requestPatch || {})
  };
  return { snapshot, provenance, records, component, request };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS - ${name}`);
}

test("constructor requires exact ports", () => {
  assert.throws(() => mod.createGovernanceApprovalTrustRegistrationEvidenceAcceptance({}), TypeError);
});

test("unsupported caller fields cannot assert acceptance", () => {
  const f = fixture({ requestPatch: { callerTrusted: true } });
  const out = f.component.accept(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.REJECTED);
});

test("invalid registration snapshot is rejected", () => {
  const f = fixture({ snapshotPatch: { sourceProviderRef: "other" } });
  const out = f.component.accept(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.REJECTED);
});

test("stale registration snapshot cannot be accepted", () => {
  const f = fixture({ snapshotPatch: { freshnessState: "STALE" } });
  const out = f.component.accept(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.STALE);
});

test("contradictory registration snapshot conflicts", () => {
  const f = fixture({ snapshotPatch: { contradictionState: "CONTRADICTORY_EVIDENCE" } });
  const out = f.component.accept(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.CONFLICT);
});

test("unaccepted provenance cannot manufacture accepted evidence", () => {
  const f = fixture({ provenancePatch: { acceptanceState: "OBSERVED" } });
  const out = f.component.accept(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.UNCERTAIN);
});

test("cross-subject provenance cannot be accepted", () => {
  const f = fixture({ provenancePatch: { subjectRef: "other-registration" } });
  const out = f.component.accept(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.UNCERTAIN);
});

test("exact accepted current provenance produces accepted trust registration evidence", () => {
  const f = fixture();
  const out = f.component.accept(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.ACCEPTED);
  assert.equal(out.evidence.sourceTrustState, "TRUSTED");
  assert.equal(out.evidence.verificationMethodTrustState, "TRUSTED");
  assert.equal(out.evidence.authority, "NONE");
  assert.equal(Object.prototype.hasOwnProperty.call(out.evidence, "principalEligibility"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(out.evidence, "governanceAuthorization"), false);
});

test("exact replay is idempotent", () => {
  const f = fixture();
  const first = f.component.accept(f.request);
  const second = f.component.accept(f.request);
  assert.equal(first.outcome, mod.OUTCOMES.ACCEPTED);
  assert.equal(second.outcome, mod.OUTCOMES.ALREADY_ACCEPTED);
  assert.equal(second.evidence.acceptanceId, first.evidence.acceptanceId);
});

console.log(`${passed}/9 PASS`);
