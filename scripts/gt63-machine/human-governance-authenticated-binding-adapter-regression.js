"use strict";

const assert = require("node:assert/strict");
const approval = require("./human-governance-approval-surface");
const bindingModule = require("./authenticated-human-source-event-binding");
const adapterModule = require("./human-governance-authenticated-binding-adapter");

function bindingLedger() {
  const records = [];
  return {
    findBySourceEventRef(ref) { return records.filter((item) => item.sourceEventRef === ref); },
    listByContentDigest(digest) { return records.filter((item) => item.contentDigest === digest); },
    commit(value) { records.push(value); return value; }
  };
}

function fixture() {
  const presentationLedger = approval.createMemoryLedger();
  const sourceEventLedger = approval.createMemoryLedger();
  const presentation = {
    type: "GT63_GOVERNANCE_APPROVAL_PRESENTATION",
    presentationId: "gt63-presentation:test-001",
    gateRevision: "1",
    sessionRef: "gt63-runtime-session:USR-ADMIN:1",
    sessionRevision: "1",
    authenticationProviderRef: "gt63-existing-signed-session-v0"
  };
  const sourceEvent = {
    type: "HUMAN_SOURCE_EVENT",
    sourceEventRef: "gt63-human-source-event:test-001",
    sourceEventRevision: "1",
    sourceProviderRef: "gt63-machine:human-governance-approval-surface-v0",
    sourceProviderRevision: "1",
    providerEventId: "gt63-provider-event:test-001",
    contentBytesBase64: Buffer.from('{"decision":"APPROVE"}', "utf8").toString("base64"),
    contentEncoding: "utf8",
    contentMediaType: "application/json",
    contentBindingContractRef: "gt63-machine:content-binding:exact-presented-approval-bytes-v0",
    contentBindingContractRevision: "1",
    channelRef: "gt63-machine:channel:human-governance-approval-v0",
    channelRevision: "1",
    sessionRef: presentation.sessionRef,
    sessionRevision: presentation.sessionRevision,
    occurredTemporalFrameRef: "time:2026-09-09T19:26:09.070Z",
    receivedTemporalFrameRef: "time:2026-09-09T19:26:09.070Z",
    interactionId: presentation.presentationId,
    contextRevision: presentation.gateRevision,
    claimedActorRef: "gt63-runtime-user:USR-ADMIN",
    presentationClass: "DIRECT",
    attributedPrincipalRef: null,
    sourceEventEvidenceRef: "gt63-evidence:human-source-event:test-001"
  };
  presentationLedger.commit(presentation.presentationId, presentation);
  sourceEventLedger.commit(sourceEvent.sourceEventRef, sourceEvent);
  return { presentationLedger, sourceEventLedger, sourceEvent };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test("adapter preserves authority NONE", () => {
  const f = fixture();
  const adapter = adapterModule.createHumanGovernanceAuthenticatedBindingAdapter(f);
  assert.equal(adapter.authority, "NONE");
});

test("source snapshot returns exact stored HUMAN_SOURCE_EVENT", () => {
  const f = fixture();
  const adapter = adapterModule.createHumanGovernanceAuthenticatedBindingAdapter(f);
  assert.deepEqual(adapter.sourceEventSnapshotPort({ sourceEventRef: f.sourceEvent.sourceEventRef }), f.sourceEvent);
});

test("source registry remains UNKNOWN trust", () => {
  const f = fixture();
  const adapter = adapterModule.createHumanGovernanceAuthenticatedBindingAdapter(f);
  const registry = adapter.sourceRegistryPort({ sourceProviderRef: f.sourceEvent.sourceProviderRef, sourceProviderRevision: "1" });
  assert.equal(registry.trustState, "UNKNOWN");
});

test("authenticated account is not promoted to principal", () => {
  const f = fixture();
  const adapter = adapterModule.createHumanGovernanceAuthenticatedBindingAdapter(f);
  const identity = adapter.principalIdentityPort({
    sourceEventRef: f.sourceEvent.sourceEventRef,
    sourceProviderRef: f.sourceEvent.sourceProviderRef,
    providerEventId: f.sourceEvent.providerEventId
  });
  assert.equal(identity.status, "MISSING");
  assert.deepEqual(identity.candidates, []);
});

test("verification method remains UNKNOWN trust", () => {
  const f = fixture();
  const adapter = adapterModule.createHumanGovernanceAuthenticatedBindingAdapter(f);
  const method = adapter.verificationMethodPort({
    verificationMethodRef: adapterModule.VERIFICATION_METHOD_REF,
    verificationMethodRevision: adapterModule.VERIFICATION_METHOD_REVISION
  });
  assert.equal(method.trustState, "UNKNOWN");
  assert.equal(method.freshnessState, "CURRENT");
});

test("origin verification remains UNKNOWN and proves no principal", () => {
  const f = fixture();
  const adapter = adapterModule.createHumanGovernanceAuthenticatedBindingAdapter(f);
  const verification = adapter.originVerifierPort({
    sourceEvent: f.sourceEvent,
    principal: null,
    verificationMethodRef: adapterModule.VERIFICATION_METHOD_REF,
    verificationMethodRevision: adapterModule.VERIFICATION_METHOD_REVISION
  });
  assert.equal(verification.verificationState, "UNKNOWN");
  assert.equal(verification.verifiedPrincipalRef, null);
  assert.equal(verification.verifiedSourceEventRef, null);
});

test("approval presentation and source event establish process-local routing BOUND", () => {
  const f = fixture();
  const adapter = adapterModule.createHumanGovernanceAuthenticatedBindingAdapter(f);
  const routing = adapter.interactionRoutingPort({
    sourceEventRef: f.sourceEvent.sourceEventRef,
    interactionId: f.sourceEvent.interactionId,
    contextRevision: f.sourceEvent.contextRevision
  });
  assert.equal(routing.bindingState, "BOUND");
});

test("binding accepts evidence without manufacturing authenticated origin", () => {
  const f = fixture();
  const adapter = adapterModule.createHumanGovernanceAuthenticatedBindingAdapter(f);
  const binding = bindingModule.createAuthenticatedHumanSourceEventBinding({
    sourceEventSnapshotPort: adapter.sourceEventSnapshotPort,
    sourceRegistryPort: adapter.sourceRegistryPort,
    principalIdentityPort: adapter.principalIdentityPort,
    verificationMethodPort: adapter.verificationMethodPort,
    originVerifierPort: adapter.originVerifierPort,
    interactionRoutingPort: adapter.interactionRoutingPort,
    bindingLedger: bindingLedger()
  });
  const result = binding.accept(adapter.createBindingRequest(f.sourceEvent.sourceEventRef));
  assert.equal(result.outcome, bindingModule.OUTCOMES.ACCEPTED);
  assert.equal(result.authority, "NONE");
  assert.equal(result.binding.originAuthenticationState, "UNKNOWN");
  assert.equal(result.binding.principalResolutionState, "MISSING");
  assert.equal(result.binding.sourceTrustState, "UNKNOWN");
  assert.equal(result.binding.verificationMethodTrustState, "UNKNOWN");
  assert.equal(result.binding.interactionBindingState, "BOUND");
});

test("missing presentation cannot be promoted to BOUND routing", () => {
  const f = fixture();
  const emptyPresentationLedger = approval.createMemoryLedger();
  const adapter = adapterModule.createHumanGovernanceAuthenticatedBindingAdapter({
    presentationLedger: emptyPresentationLedger,
    sourceEventLedger: f.sourceEventLedger
  });
  const routing = adapter.interactionRoutingPort({
    sourceEventRef: f.sourceEvent.sourceEventRef,
    interactionId: f.sourceEvent.interactionId,
    contextRevision: f.sourceEvent.contextRevision
  });
  assert.equal(routing.bindingState, "UNKNOWN");
});

console.log(`${passed}/9 PASS`);
