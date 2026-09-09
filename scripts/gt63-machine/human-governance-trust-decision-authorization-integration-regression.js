"use strict";

const assert = require("node:assert/strict");
const captureModule = require("./human-governance-trust-decision-presentation-capture");
const authModule = require("./governance-approval-trust-declaration-authorization");

const REGISTRATION_REF = authModule.EXPECTED_REGISTRATION_REF;
const REGISTRATION_REVISION = authModule.EXPECTED_REGISTRATION_REVISION;
const PRINCIPAL_REF = authModule.EXPECTED_PRINCIPAL_REF;
const SESSION_REF = "gt63-runtime-session:USR-ADMIN:trust-integration";

function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function memoryLedger() {
  const records = new Map();
  return {
    get(k) { return records.has(k) ? clone(records.get(k)) : null; },
    commit(k, v) { if (records.has(k)) throw new Error("immutable-ledger-conflict"); records.set(k, clone(v)); return clone(v); },
    records() { return [...records.values()].map(clone); }
  };
}
function authLedger() {
  const records = [];
  return {
    findByRegistrationRef(ref) { return records.filter(x => x.registrationRef === ref).map(clone); },
    commit(v) { records.push(clone(v)); return clone(v); }
  };
}
function session(patch = {}) {
  return {
    sessionRef: SESSION_REF,
    sessionRevision: "1",
    authenticatedAccountRef: "gt63-runtime-user:USR-ADMIN",
    authenticationProviderRef: "gt63-existing-signed-session-v0",
    authenticationEvidenceRef: "gt63-runtime-session-evidence:USR-ADMIN:trust-integration",
    authenticationState: "AUTHENTICATED",
    freshnessState: "CURRENT",
    ...patch
  };
}
function principal(patch = {}) {
  return {
    principalRef: PRINCIPAL_REF,
    principalRevision: "1",
    sessionRef: SESSION_REF,
    sessionRevision: "1",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    principalEvidenceRef: "gt63-process-local-evidence:github-authenticated-identity:trust-integration",
    authority: "NONE",
    ...patch
  };
}
function fixture(options = {}) {
  const presentationLedger = memoryLedger();
  const decisionLedger = memoryLedger();
  const capture = captureModule.createHumanGovernanceTrustDecisionPresentationCapture({
    presentationLedger,
    trustDecisionLedger: decisionLedger,
    clock: () => "2026-09-10T00:00:00.000Z"
  });
  const s = session(options.sessionPatch || {});
  const p = principal(options.principalPatch || {});
  const presentation = capture.present({ session: s, principal: p });
  const decision = capture.decide({
    session: options.decisionSession || s,
    principal: options.decisionPrincipal || p,
    presentationId: presentation.presentationId,
    decision: options.decision || "APPROVE_TRUST_REGISTRATION"
  });
  const provenance = {
    evidenceRef: decision.decisionEvidenceRef,
    subjectRef: REGISTRATION_REF,
    subjectRevision: REGISTRATION_REVISION,
    acceptanceState: "ACCEPTED",
    principalRef: PRINCIPAL_REF,
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    provenanceEvidenceRef: "gt63-evidence:trust-decision-provenance:integration",
    authority: "NONE",
    ...(options.provenancePatch || {})
  };
  const component = authModule.createGovernanceApprovalTrustDeclarationAuthorization({
    trustDecisionPort() { return clone(decision); },
    provenancePort({ evidenceRef }) { return evidenceRef === provenance.evidenceRef ? clone(provenance) : null; },
    authorizationLedger: authLedger()
  });
  const out = component.authorize({
    rulesetVersion: authModule.RULESET_VERSION,
    registrationRef: REGISTRATION_REF,
    registrationRevision: REGISTRATION_REVISION
  });
  return { presentation, decision, provenance, out };
}

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`PASS - ${name}`); }

test("captured human trust decision feeds declaration authorization", () => {
  const f = fixture();
  assert.equal(f.out.outcome, authModule.OUTCOMES.AUTHORIZED);
});

test("authorization preserves exact registration subject", () => {
  const f = fixture();
  assert.equal(f.out.authorization.registrationRef, REGISTRATION_REF);
  assert.equal(f.out.authorization.registrationRevision, REGISTRATION_REVISION);
});

test("authorization preserves exact GitHub principal", () => {
  const f = fixture();
  assert.equal(f.out.authorization.principalRef, PRINCIPAL_REF);
});

test("authorization declares only expected TRUSTED states", () => {
  const f = fixture();
  assert.equal(f.out.authorization.sourceTrustState, "TRUSTED");
  assert.equal(f.out.authorization.verificationMethodTrustState, "TRUSTED");
});

test("authorization remains authority NONE", () => {
  const f = fixture();
  assert.equal(f.out.authority, "NONE");
  assert.equal(f.out.authorization.authority, "NONE");
});

test("capture output does not imply eligibility role or governance authorization", () => {
  const f = fixture();
  for (const forbidden of ["eligibilityState", "roleRef", "governanceAuthorizationRef"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(f.decision, forbidden), false);
  }
});

test("cross-subject provenance blocks declaration authorization", () => {
  const f = fixture({ provenancePatch: { subjectRef: "other-registration" } });
  assert.notEqual(f.out.outcome, authModule.OUTCOMES.AUTHORIZED);
});

test("unaccepted provenance blocks declaration authorization", () => {
  const f = fixture({ provenancePatch: { acceptanceState: "OBSERVED" } });
  assert.notEqual(f.out.outcome, authModule.OUTCOMES.AUTHORIZED);
});

test("contradictory provenance blocks declaration authorization", () => {
  const f = fixture({ provenancePatch: { contradictionState: "CONTRADICTORY_EVIDENCE" } });
  assert.notEqual(f.out.outcome, authModule.OUTCOMES.AUTHORIZED);
});

console.log(`${passed}/9 PASS`);
