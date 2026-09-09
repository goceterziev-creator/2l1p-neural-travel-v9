"use strict";

const assert = require("node:assert/strict");
const trust = require("./governance-approval-trust-registration");

function registration(overrides = {}) {
  return {
    type: "GT63_GOVERNANCE_APPROVAL_TRUST_REGISTRATION",
    schemaVersion: "1.0",
    rulesetVersion: trust.RULESET_VERSION,
    registrationRevision: "1",
    sourceProviderRef: trust.SOURCE_PROVIDER_REF,
    sourceProviderRevision: trust.SOURCE_PROVIDER_REVISION,
    sourceTrustState: "TRUSTED",
    verificationMethodRef: trust.VERIFICATION_METHOD_REF,
    verificationMethodRevision: trust.VERIFICATION_METHOD_REVISION,
    verificationMethodTrustState: "TRUSTED",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    acceptedEvidenceRef: "gt63-accepted-evidence:trust-registration:test-only",
    supersedesRegistrationRef: null,
    authority: "NONE",
    ...overrides
  };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS - ${name}`);
}

function system(value) {
  return trust.createGovernanceApprovalTrustRegistration({ registrationProvider: () => value });
}

test("constructor requires evidence provider", () => {
  assert.throws(() => trust.createGovernanceApprovalTrustRegistration(), TypeError);
});

test("missing registration fails closed", () => {
  const result = system(null).resolve();
  assert.equal(result.outcome, "TRUST_REGISTRATION_MISSING");
  assert.equal(result.registration, null);
  assert.equal(result.authority, "NONE");
});

test("caller-extra fields invalidate registration", () => {
  const result = system(registration({ callerTrusted: true })).resolve();
  assert.equal(result.outcome, "TRUST_REGISTRATION_INVALID");
});

test("wrong source provider cannot be registered", () => {
  const result = system(registration({ sourceProviderRef: "gt63-machine:other-source" })).resolve();
  assert.equal(result.outcome, "TRUST_REGISTRATION_INVALID");
});

test("wrong verification method cannot be registered", () => {
  const result = system(registration({ verificationMethodRef: "gt63-machine:verification-method:other" })).resolve();
  assert.equal(result.outcome, "TRUST_REGISTRATION_INVALID");
});

test("stale or revoked registration cannot resolve active trust", () => {
  assert.equal(system(registration({ freshnessState: "STALE" })).resolve().outcome, "TRUST_REGISTRATION_INACTIVE");
  assert.equal(system(registration({ lifecycleState: "REVOKED" })).resolve().outcome, "TRUST_REGISTRATION_INACTIVE");
});

test("contradictory registration cannot resolve active trust", () => {
  const result = system(registration({ contradictionState: "CONTRADICTORY_EVIDENCE" })).resolve();
  assert.equal(result.outcome, "TRUST_REGISTRATION_CONFLICT");
});

test("exact current accepted registration resolves declared trust only", () => {
  const record = registration();
  const result = system(record).resolve();
  assert.equal(result.outcome, "TRUST_REGISTRATION_RESOLVED");
  assert.equal(result.registration.sourceTrustState, "TRUSTED");
  assert.equal(result.registration.verificationMethodTrustState, "TRUSTED");
  assert.equal(result.registration.acceptedEvidenceRef, record.acceptedEvidenceRef);
  assert.equal(result.authority, "NONE");
});

test("resolver never asserts principal eligibility role or governance authorization", () => {
  const result = system(registration()).resolve();
  for (const prohibited of ["principalRef", "eligibilityState", "roleRef", "authorizationState", "gateSatisfied"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(result.registration, prohibited), false);
  }
  assert.equal(result.authority, "NONE");
});

console.log(`${passed}/9 PASS`);
