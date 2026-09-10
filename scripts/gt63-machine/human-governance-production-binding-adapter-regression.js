"use strict";
const assert = require("node:assert/strict");
const approval = require("./human-governance-approval-surface");
const gateModule = require("./exact-bootstrap-gate-provider");
const adapterModule = require("./human-governance-production-binding-adapter");
const bindingModule = require("./authenticated-human-source-event-binding");

async function run() {
  const cases = [];
  const ok = (name, fn) => { fn(); cases.push(name); };
  const presentationLedger = approval.createMemoryLedger();
  const sourceEventLedger = approval.createMemoryLedger();
  const surface = approval.createHumanGovernanceApprovalSurface({
    clock: () => "2026-09-10T10:46:53.202Z", presentationLedger, sourceEventLedger
  });
  const gate = await gateModule.createExactBootstrapGateProvider().getGate("gt63-machine:bootstrap-gate:lifecycle-issuer-policy-v0");
  const session = Object.freeze({
    sessionRef: "gt63-runtime-session:USR-ADMIN:1788981470184", sessionRevision: "1",
    authenticatedAccountRef: "gt63-runtime-user:USR-ADMIN",
    authenticationProviderRef: "gt63-existing-signed-session-v0",
    authenticationEvidenceRef: "gt63-runtime-session-evidence:USR-ADMIN:1788981470184",
    authenticationState: "AUTHENTICATED", freshnessState: "CURRENT"
  });
  const presentation = surface.present({ session, gate });
  const sourceEvent = surface.decide({ session, presentationId: presentation.presentationId, decision: "APPROVE" });
  const adapter = adapterModule.createHumanGovernanceProductionBindingAdapter({ presentationLedger, sourceEventLedger });
  const request = {
    rulesetVersion: bindingModule.RULESET_VERSION,
    sourceEventRef: sourceEvent.sourceEventRef,
    expectedSourceEventRevision: "1", expectedSourceProviderRevision: "1",
    expectedPrincipalRevision: null, expectedVerificationMethodRevision: "1",
    expectedRoutingRevision: "1", expectedContextRevision: "1"
  };
  const result = adapter.accept(request);

  ok("binding-record-created-without-authority", () => {
    assert.equal(result.outcome, bindingModule.OUTCOMES.ACCEPTED);
    assert.equal(result.authority, "NONE");
    assert.equal(result.binding.authority, "NONE");
  });
  ok("principal-is-not-inferred-from-runtime-account", () => {
    assert.equal(result.binding.principalRef, null);
    assert.equal(result.binding.principalRevision, null);
    assert.equal(result.binding.principalResolutionState, "MISSING");
    assert.equal(result.binding.claimedActorRef, "gt63-runtime-user:USR-ADMIN");
    assert.equal(result.binding.claimedActorRelation, "UNKNOWN");
  });
  ok("authentication-is-not-overclaimed", () => {
    assert.equal(result.binding.sourceTrustState, "UNKNOWN");
    assert.equal(result.binding.verificationMethodTrustState, "UNKNOWN");
    assert.equal(result.binding.originAuthenticationState, "UNKNOWN");
    assert.equal(result.binding.contentIntegrityState, "UNKNOWN");
  });
  ok("presentation-routing-continuity-is-bound", () => {
    assert.equal(result.binding.interactionId, presentation.presentationId);
    assert.equal(result.binding.sessionRef, session.sessionRef);
    assert.equal(result.binding.interactionBindingState, "BOUND");
  });
  ok("exact-event-identity-is-preserved", () => {
    assert.equal(result.binding.sourceEventRef, sourceEvent.sourceEventRef);
    assert.equal(result.binding.providerEventId, sourceEvent.providerEventId);
    assert.equal(result.binding.contentByteLength, 548);
  });
  ok("replay-is-idempotent", () => {
    assert.equal(adapter.accept(request).outcome, bindingModule.OUTCOMES.ALREADY_ACCEPTED);
  });
  ok("stale-request-fails-closed", () => {
    assert.equal(adapter.accept({ ...request, expectedRoutingRevision: "2" }).outcome, bindingModule.OUTCOMES.STALE);
  });
  ok("unknown-event-does-not-bind", () => {
    const isolated = adapterModule.createHumanGovernanceProductionBindingAdapter({ presentationLedger, sourceEventLedger });
    const r = isolated.accept({ ...request, sourceEventRef: "gt63-human-source-event:missing" });
    assert.notEqual(r.outcome, bindingModule.OUTCOMES.ACCEPTED);
  });

  console.log(JSON.stringify({ status: "PASS", passed: cases.length, total: 8, cases, authority: "NONE" }, null, 2));
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
