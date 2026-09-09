"use strict";

const assert = require("node:assert/strict");
const captureModule = require("./human-governance-trust-decision-presentation-capture");
const chainModule = require("./human-governance-trust-runtime-chain");

const SESSION_REF = "gt63-runtime-session:USR-ADMIN:runtime-chain";
const PRINCIPAL_REF = "gt63-machine:principal:github:239696056";

function session() {
  return {
    sessionRef: SESSION_REF,
    sessionRevision: "1",
    authenticatedAccountRef: "gt63-runtime-user:USR-ADMIN",
    authenticationProviderRef: "gt63-existing-signed-session-v0",
    authenticationEvidenceRef: "gt63-runtime-session-evidence:USR-ADMIN:runtime-chain",
    authenticationState: "AUTHENTICATED",
    freshnessState: "CURRENT"
  };
}

function principal(patch = {}) {
  return {
    type: "GT63_EXTERNAL_AUTHENTICATED_IDENTITY_BINDING",
    principalRef: PRINCIPAL_REF,
    principalRevision: "1",
    sessionRef: SESSION_REF,
    sessionRevision: "1",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    principalEvidenceRef: "gt63-process-local-evidence:github-authenticated-identity:runtime-chain",
    authority: "NONE",
    ...patch
  };
}

function fixture(options = {}) {
  const presentationLedger = captureModule.createMemoryLedger();
  const decisionLedger = captureModule.createMemoryLedger();
  const surface = captureModule.createHumanGovernanceTrustDecisionPresentationCapture({
    presentationLedger,
    decisionLedger,
    clock: () => "2026-09-10T00:00:00.000Z"
  });
  const s = session();
  const p = principal(options.principalPatch || {});
  const presentation = surface.present({ session: s, principal: p });
  const decision = surface.decide({ session: s, principal: p, presentationId: presentation.presentationId, decision: "APPROVE_TRUST_REGISTRATION" });
  const identityBootstrap = {
    getIdentityBySession(ref) {
      if (ref !== SESSION_REF) return null;
      return principal(options.identityPatch || {});
    }
  };
  const chain = chainModule.createHumanGovernanceTrustRuntimeChain({ decisionLedger, identityBootstrap });
  return { chain, decision };
}

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`PASS - ${name}`); }

test("constructor requires decision ledger", () => {
  assert.throws(() => chainModule.createHumanGovernanceTrustRuntimeChain({ identityBootstrap: { getIdentityBySession() {} } }), TypeError);
});

test("constructor requires identity bootstrap", () => {
  assert.throws(() => chainModule.createHumanGovernanceTrustRuntimeChain({ decisionLedger: { get() {} } }), TypeError);
});

test("missing decision evidence fails closed", () => {
  const f = fixture();
  const out = f.chain.authorizeTrustDecision("gt63-evidence:trust-decision:missing");
  assert.equal(out.outcome, "TRUST_RUNTIME_CHAIN_BLOCKED");
  assert.equal(out.stage, "PROVENANCE");
});

test("wrong same-session principal evidence fails closed", () => {
  const f = fixture({ identityPatch: { principalEvidenceRef: "other" } });
  const out = f.chain.authorizeTrustDecision(f.decision.decisionEvidenceRef);
  assert.equal(out.outcome, "TRUST_RUNTIME_CHAIN_BLOCKED");
  assert.equal(out.stage, "PROVENANCE");
});

test("exact captured decision resolves full trust runtime chain", () => {
  const f = fixture();
  const out = f.chain.authorizeTrustDecision(f.decision.decisionEvidenceRef);
  assert.equal(out.outcome, "TRUST_RUNTIME_CHAIN_RESOLVED");
  assert.equal(out.stage, "RESOLVED");
});

test("resolved chain accepts decision provenance", () => {
  const f = fixture();
  const out = f.chain.authorizeTrustDecision(f.decision.decisionEvidenceRef);
  assert.equal(out.provenanceResult.outcome, "TRUST_DECISION_PROVENANCE_ACCEPTED");
});

test("resolved chain authorizes trust declaration", () => {
  const f = fixture();
  const out = f.chain.authorizeTrustDecision(f.decision.decisionEvidenceRef);
  assert.equal(out.authorizationResult.outcome, "TRUST_DECLARATION_AUTHORIZED");
});

test("resolved chain accepts and resolves TRUSTED registration", () => {
  const f = fixture();
  const out = f.chain.authorizeTrustDecision(f.decision.decisionEvidenceRef);
  assert.equal(out.registrationAcceptanceResult.outcome, "TRUST_REGISTRATION_EVIDENCE_ACCEPTED");
  assert.equal(out.resolutionResult.outcome, "TRUST_REGISTRATION_RESOLVED");
  assert.equal(out.resolutionResult.registration.sourceTrustState, "TRUSTED");
  assert.equal(out.resolutionResult.registration.verificationMethodTrustState, "TRUSTED");
});

test("full runtime chain remains authority NONE", () => {
  const f = fixture();
  const out = f.chain.authorizeTrustDecision(f.decision.decisionEvidenceRef);
  assert.equal(out.authority, "NONE");
  assert.equal(out.provenanceResult.authority, "NONE");
  assert.equal(out.authorizationResult.authority, "NONE");
  assert.equal(out.registrationAcceptanceResult.authority, "NONE");
  assert.equal(out.resolutionResult.authority, "NONE");
});

console.log(`${passed}/9 PASS`);
