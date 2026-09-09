"use strict";

const assert = require("node:assert/strict");
const approval = require("./human-governance-approval-surface");
const runtimeModule = require("./human-governance-authenticated-binding-runtime");

function fixture() {
  const presentationLedger = approval.createMemoryLedger();
  const sourceEventLedger = approval.createMemoryLedger();
  const presentation = {
    type: "GT63_GOVERNANCE_APPROVAL_PRESENTATION",
    presentationId: "gt63-presentation:identity-bind-001",
    gateRevision: "1",
    sessionRef: "gt63-runtime-session:USR-ADMIN:1788986303480",
    sessionRevision: "1",
    authenticationProviderRef: "gt63-existing-signed-session-v0"
  };
  const sourceEvent = {
    type: "HUMAN_SOURCE_EVENT",
    sourceEventRef: "gt63-human-source-event:identity-bind-001",
    sourceEventRevision: "1",
    sourceProviderRef: "gt63-machine:human-governance-approval-surface-v0",
    sourceProviderRevision: "1",
    providerEventId: "gt63-provider-event:identity-bind-001",
    contentBytesBase64: Buffer.from('{"decision":"APPROVE"}', "utf8").toString("base64"),
    contentEncoding: "utf8",
    contentMediaType: "application/json",
    contentBindingContractRef: "gt63-machine:content-binding:exact-presented-approval-bytes-v0",
    contentBindingContractRevision: "1",
    channelRef: "gt63-machine:channel:human-governance-approval-v0",
    channelRevision: "1",
    sessionRef: presentation.sessionRef,
    sessionRevision: presentation.sessionRevision,
    occurredTemporalFrameRef: "time:2026-09-09T20:47:39.680Z",
    receivedTemporalFrameRef: "time:2026-09-09T20:47:39.680Z",
    interactionId: presentation.presentationId,
    contextRevision: presentation.gateRevision,
    claimedActorRef: "gt63-runtime-user:USR-ADMIN",
    presentationClass: "DIRECT",
    attributedPrincipalRef: null,
    sourceEventEvidenceRef: "gt63-evidence:human-source-event:identity-bind-001"
  };
  presentationLedger.commit(presentation.presentationId, presentation);
  sourceEventLedger.commit(sourceEvent.sourceEventRef, sourceEvent);
  return { presentationLedger, sourceEventLedger, sourceEvent };
}

function verifiedIdentityProvider(sessionRef, sessionRevision = "1") {
  const identity = {
    type: "GT63_EXTERNAL_AUTHENTICATED_IDENTITY_BINDING",
    rulesetVersion: "github-human-identity-trust-bootstrap-v0.1.0",
    principalRef: "gt63-machine:principal:github:239696056",
    principalNamespace: "github.com",
    principalRevision: "1",
    githubUserId: 239696056,
    githubLogin: "goceterziev-creator",
    sessionRef,
    sessionRevision,
    authenticatedAccountRef: "gt63-runtime-user:USR-ADMIN",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    principalEvidenceRef: "gt63-process-local-evidence:github-authenticated-identity:test",
    verificationMethodRef: "gt63-machine:verification-method:github-oauth-device-flow-v0",
    verificationMethodRevision: "1",
    verifiedAt: "2026-09-09T20:47:39.680Z",
    authority: "NONE"
  };
  return {
    getIdentityBySession(ref) {
      return ref === sessionRef ? JSON.parse(JSON.stringify(identity)) : null;
    }
  };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS - ${name}`);
}

test("without verified external identity principal resolution remains MISSING", () => {
  const f = fixture();
  const runtime = runtimeModule.createHumanGovernanceAuthenticatedBindingRuntime(f);
  const result = runtime.acceptSourceEvent(f.sourceEvent);
  assert.equal(result.outcome, "BINDING_EVIDENCE_ACCEPTED");
  assert.equal(result.binding.principalResolutionState, "MISSING");
  assert.equal(result.binding.principalRef, null);
});

test("same-session verified GitHub identity resolves provider-bound principal", () => {
  const f = fixture();
  const runtime = runtimeModule.createHumanGovernanceAuthenticatedBindingRuntime({
    ...f,
    identityProvider: verifiedIdentityProvider(f.sourceEvent.sessionRef)
  });
  const result = runtime.acceptSourceEvent(f.sourceEvent);
  assert.equal(result.outcome, "BINDING_EVIDENCE_ACCEPTED");
  assert.equal(result.binding.principalResolutionState, "RESOLVED");
  assert.equal(result.binding.principalRef, "gt63-machine:principal:github:239696056");
  assert.equal(result.binding.principalNamespace, "github.com");
  assert.equal(result.binding.principalRevision, "1");
});

test("resolved principal does not promote source trust", () => {
  const f = fixture();
  const runtime = runtimeModule.createHumanGovernanceAuthenticatedBindingRuntime({
    ...f,
    identityProvider: verifiedIdentityProvider(f.sourceEvent.sessionRef)
  });
  const result = runtime.acceptSourceEvent(f.sourceEvent);
  assert.equal(result.binding.sourceTrustState, "UNKNOWN");
  assert.equal(result.binding.verificationMethodTrustState, "UNKNOWN");
});

test("resolved principal does not manufacture authenticated origin", () => {
  const f = fixture();
  const runtime = runtimeModule.createHumanGovernanceAuthenticatedBindingRuntime({
    ...f,
    identityProvider: verifiedIdentityProvider(f.sourceEvent.sessionRef)
  });
  const result = runtime.acceptSourceEvent(f.sourceEvent);
  assert.equal(result.binding.originAuthenticationState, "UNKNOWN");
  assert.equal(result.binding.contentIntegrityState, "UNKNOWN");
});

test("interaction routing remains BOUND for exact presentation/session continuity", () => {
  const f = fixture();
  const runtime = runtimeModule.createHumanGovernanceAuthenticatedBindingRuntime({
    ...f,
    identityProvider: verifiedIdentityProvider(f.sourceEvent.sessionRef)
  });
  const result = runtime.acceptSourceEvent(f.sourceEvent);
  assert.equal(result.binding.interactionBindingState, "BOUND");
});

test("different-session identity cannot resolve principal", () => {
  const f = fixture();
  const runtime = runtimeModule.createHumanGovernanceAuthenticatedBindingRuntime({
    ...f,
    identityProvider: verifiedIdentityProvider("gt63-runtime-session:OTHER:1")
  });
  const result = runtime.acceptSourceEvent(f.sourceEvent);
  assert.equal(result.binding.principalResolutionState, "MISSING");
  assert.equal(result.binding.principalRef, null);
});

test("same sessionRef but different sessionRevision cannot resolve principal", () => {
  const f = fixture();
  const runtime = runtimeModule.createHumanGovernanceAuthenticatedBindingRuntime({
    ...f,
    identityProvider: verifiedIdentityProvider(f.sourceEvent.sessionRef, "2")
  });
  const result = runtime.acceptSourceEvent(f.sourceEvent);
  assert.equal(result.binding.principalResolutionState, "MISSING");
});

test("claimed local account is not rewritten as GitHub principal", () => {
  const f = fixture();
  const runtime = runtimeModule.createHumanGovernanceAuthenticatedBindingRuntime({
    ...f,
    identityProvider: verifiedIdentityProvider(f.sourceEvent.sessionRef)
  });
  const result = runtime.acceptSourceEvent(f.sourceEvent);
  assert.equal(result.binding.claimedActorRef, "gt63-runtime-user:USR-ADMIN");
  assert.equal(result.binding.claimedActorRelation, "DIFFERS_FROM_VERIFIED_PRINCIPAL");
});

test("integration preserves authority NONE", () => {
  const f = fixture();
  const runtime = runtimeModule.createHumanGovernanceAuthenticatedBindingRuntime({
    ...f,
    identityProvider: verifiedIdentityProvider(f.sourceEvent.sessionRef)
  });
  const result = runtime.acceptSourceEvent(f.sourceEvent);
  assert.equal(runtime.authority, "NONE");
  assert.equal(result.authority, "NONE");
  assert.equal(result.binding.authority, "NONE");
});

console.log(`${passed}/9 PASS`);
