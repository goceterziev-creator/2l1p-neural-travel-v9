"use strict";

const assert = require("node:assert/strict");
const mod = require("./human-governance-trust-decision-presentation-capture");

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function ledger() { return mod.createMemoryLedger(); }
function session(patch = {}) {
  return {
    sessionRef: "gt63-runtime-session:USR-ADMIN:trust-decision-test",
    sessionRevision: "1",
    authenticatedAccountRef: "gt63-runtime-user:USR-ADMIN",
    authenticationProviderRef: "gt63-existing-signed-session-v0",
    authenticationEvidenceRef: "gt63-runtime-session-evidence:USR-ADMIN:trust-decision-test",
    authenticationState: "AUTHENTICATED",
    freshnessState: "CURRENT",
    ...clone(patch)
  };
}
function principal(patch = {}) {
  return {
    principalRef: mod.EXPECTED_PRINCIPAL_REF,
    principalRevision: "1",
    sessionRef: "gt63-runtime-session:USR-ADMIN:trust-decision-test",
    sessionRevision: "1",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    principalEvidenceRef: "gt63-process-local-evidence:github-authenticated-identity:trust-decision-test",
    authority: "NONE",
    ...clone(patch)
  };
}
function system() {
  const presentationLedger = ledger();
  const decisionLedger = ledger();
  const component = mod.createHumanGovernanceTrustDecisionPresentationCapture({
    clock: () => "2026-09-10T00:00:00.000Z",
    presentationLedger,
    decisionLedger
  });
  return { component, presentationLedger, decisionLedger };
}

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`PASS - ${name}`); }

test("constructor requires immutable ledgers", () => {
  assert.throws(() => mod.createHumanGovernanceTrustDecisionPresentationCapture({}), TypeError);
});

test("presentation requires authenticated current session", () => {
  const s = system();
  assert.throws(() => s.component.present({ session: session({ authenticationState: "UNAUTHENTICATED" }), principal: principal() }));
});

test("presentation requires exact current session-bound GitHub principal", () => {
  const s = system();
  assert.throws(() => s.component.present({ session: session(), principal: principal({ principalRef: "gt63-machine:principal:github:999" }) }));
});

test("presentation freezes exact trust approval payload", () => {
  const s = system();
  const p = s.component.present({ session: session(), principal: principal() });
  const payload = JSON.parse(Buffer.from(p.exactPayloadBytesBase64, "base64").toString("utf8"));
  assert.deepEqual(payload, mod.buildDecisionPayload());
  assert.equal(payload.decision, "APPROVE_TRUST_REGISTRATION");
  assert.equal(payload.registrationRef, mod.EXPECTED_REGISTRATION_REF);
  assert.equal(p.authority, "NONE");
});

test("decision must match exact presented payload", () => {
  const s = system();
  const p = s.component.present({ session: session(), principal: principal() });
  assert.throws(() => s.component.decide({ session: session(), principal: principal(), presentationId: p.presentationId, decision: "REJECT_TRUST_REGISTRATION" }));
});

test("different session cannot decide presentation", () => {
  const s = system();
  const p = s.component.present({ session: session(), principal: principal() });
  const otherSession = session({ sessionRef: "gt63-runtime-session:OTHER:1" });
  const otherPrincipal = principal({ sessionRef: "gt63-runtime-session:OTHER:1" });
  assert.throws(() => s.component.decide({ session: otherSession, principal: otherPrincipal, presentationId: p.presentationId, decision: "APPROVE_TRUST_REGISTRATION" }));
});

test("different principal evidence cannot decide presentation", () => {
  const s = system();
  const p = s.component.present({ session: session(), principal: principal() });
  assert.throws(() => s.component.decide({ session: session(), principal: principal({ principalEvidenceRef: "evidence:other" }), presentationId: p.presentationId, decision: "APPROVE_TRUST_REGISTRATION" }));
});

test("exact approval produces principal-bound trust decision record", () => {
  const s = system();
  const p = s.component.present({ session: session(), principal: principal() });
  const d = s.component.decide({ session: session(), principal: principal(), presentationId: p.presentationId, decision: "APPROVE_TRUST_REGISTRATION" });
  assert.equal(d.type, "GT63_GOVERNANCE_APPROVAL_TRUST_DECISION");
  assert.equal(d.principalRef, mod.EXPECTED_PRINCIPAL_REF);
  assert.equal(d.principalResolutionState, "RESOLVED");
  assert.equal(d.decision, "APPROVE_TRUST_REGISTRATION");
  assert.equal(d.authority, "NONE");
});

test("capture does not assert trust authorization eligibility or role", () => {
  const s = system();
  const p = s.component.present({ session: session(), principal: principal() });
  const d = s.component.decide({ session: session(), principal: principal(), presentationId: p.presentationId, decision: "APPROVE_TRUST_REGISTRATION" });
  for (const forbidden of ["authorizationId", "authorizationState", "eligibilityState", "roleRef", "governanceAuthorizationRef"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(d, forbidden), false);
  }
});

console.log(`${passed}/9 PASS`);
