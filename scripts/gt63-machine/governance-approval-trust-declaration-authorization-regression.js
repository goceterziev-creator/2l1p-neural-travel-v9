"use strict";

const assert = require("node:assert/strict");
const mod = require("./governance-approval-trust-declaration-authorization");

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }

function fixture(options = {}) {
  const decision = {
    type: "GT63_GOVERNANCE_APPROVAL_TRUST_DECISION",
    registrationRef: mod.EXPECTED_REGISTRATION_REF,
    registrationRevision: mod.EXPECTED_REGISTRATION_REVISION,
    sourceProviderRef: "gt63-machine:human-governance-approval-surface-v0",
    sourceProviderRevision: "1",
    verificationMethodRef: "gt63-machine:verification-method:approval-surface-session-continuity-v0",
    verificationMethodRevision: "1",
    sourceTrustState: "TRUSTED",
    verificationMethodTrustState: "TRUSTED",
    decision: "APPROVE_TRUST_REGISTRATION",
    principalRef: mod.EXPECTED_PRINCIPAL_REF,
    principalResolutionState: "RESOLVED",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    decisionEvidenceRef: "gt63-evidence:trust-decision:1",
    authority: "NONE",
    ...(options.decisionPatch || {})
  };
  const provenance = {
    evidenceRef: decision.decisionEvidenceRef,
    subjectRef: mod.EXPECTED_REGISTRATION_REF,
    subjectRevision: mod.EXPECTED_REGISTRATION_REVISION,
    acceptanceState: "ACCEPTED",
    principalRef: mod.EXPECTED_PRINCIPAL_REF,
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    provenanceEvidenceRef: "gt63-evidence:trust-decision-provenance:1",
    authority: "NONE",
    ...(options.provenancePatch || {})
  };
  const records = clone(options.seed || []);
  const ledger = {
    findByRegistrationRef(ref) { return records.filter((item) => item.registrationRef === ref).map(clone); },
    commit(record) { records.push(clone(record)); return clone(record); }
  };
  const component = mod.createGovernanceApprovalTrustDeclarationAuthorization({
    trustDecisionPort() {
      if (options.failDecision) throw new Error("unavailable");
      return options.missingDecision ? null : clone(decision);
    },
    provenancePort() {
      if (options.failProvenance) throw new Error("unavailable");
      return options.missingProvenance ? null : clone(provenance);
    },
    authorizationLedger: ledger
  });
  const request = {
    rulesetVersion: mod.RULESET_VERSION,
    registrationRef: mod.EXPECTED_REGISTRATION_REF,
    registrationRevision: mod.EXPECTED_REGISTRATION_REVISION,
    ...(options.requestPatch || {})
  };
  return { decision, provenance, records, component, request };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS - ${name}`);
}

test("constructor requires exact ports", () => {
  assert.throws(() => mod.createGovernanceApprovalTrustDeclarationAuthorization({}), TypeError);
});

test("caller cannot assert trust authorization", () => {
  const f = fixture({ requestPatch: { trustAuthorized: true } });
  const out = f.component.authorize(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.REJECTED);
});

test("wrong principal cannot authorize trust declaration", () => {
  const f = fixture({ decisionPatch: { principalRef: "gt63-machine:principal:github:999" } });
  const out = f.component.authorize(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.UNCERTAIN);
});

test("wrong registration subject cannot authorize trust declaration", () => {
  const f = fixture({ decisionPatch: { registrationRef: "gt63-machine:trust-registration:other" } });
  const out = f.component.authorize(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.UNCERTAIN);
});

test("stale trust decision cannot authorize declaration", () => {
  const f = fixture({ decisionPatch: { freshnessState: "STALE" } });
  const out = f.component.authorize(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.UNCERTAIN);
});

test("contradictory trust decision cannot authorize declaration", () => {
  const f = fixture({ decisionPatch: { contradictionState: "CONTRADICTORY_EVIDENCE" } });
  const out = f.component.authorize(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.UNCERTAIN);
});

test("unaccepted or cross-subject provenance cannot authorize declaration", () => {
  const f = fixture({ provenancePatch: { acceptanceState: "OBSERVED", subjectRef: "other" } });
  const out = f.component.authorize(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.UNCERTAIN);
});

test("exact current principal-bound trust decision authorizes declared TRUSTED states", () => {
  const f = fixture();
  const out = f.component.authorize(f.request);
  assert.equal(out.outcome, mod.OUTCOMES.AUTHORIZED);
  assert.equal(out.authorization.sourceTrustState, "TRUSTED");
  assert.equal(out.authorization.verificationMethodTrustState, "TRUSTED");
  assert.equal(out.authorization.principalRef, mod.EXPECTED_PRINCIPAL_REF);
  assert.equal(out.authorization.authority, "NONE");
  for (const forbidden of ["eligibilityState", "roleRef", "governanceAuthorizationState"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(out.authorization, forbidden), false);
  }
});

test("exact replay is idempotent and authority remains NONE", () => {
  const f = fixture();
  const first = f.component.authorize(f.request);
  const second = f.component.authorize(f.request);
  assert.equal(first.outcome, mod.OUTCOMES.AUTHORIZED);
  assert.equal(second.outcome, mod.OUTCOMES.AUTHORIZED);
  assert.equal(second.authorization.authorizationId, first.authorization.authorizationId);
  assert.equal(second.authority, "NONE");
});

console.log(`${passed}/9 PASS`);
