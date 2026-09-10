"use strict";

const assert = require("node:assert/strict");
const approval = require("./human-governance-approval-surface");
const bindingModule = require("./authenticated-human-source-event-binding");
const adapterModule = require("./human-governance-production-binding-adapter");

function bindingLedger() {
  const records = [];
  return {
    findBySourceEventRef(ref) { return records.filter((item) => item.sourceEventRef === ref); },
    listByContentDigest(digest) { return records.filter((item) => item.contentDigest === digest); },
    commit(record) { records.push(record); return record; }
  };
}

const presentationLedger = approval.createMemoryLedger();
const sourceEventLedger = approval.createMemoryLedger();
const surface = approval.createHumanGovernanceApprovalSurface({ presentationLedger, sourceEventLedger });
const session = {
  sessionRef: "gt63-runtime-session:USR-ADMIN:1",
  sessionRevision: "1",
  authenticatedAccountRef: "gt63-runtime-user:USR-ADMIN",
  authenticationProviderRef: "gt63-existing-signed-session-v0",
  authenticationEvidenceRef: "gt63-runtime-session-evidence:USR-ADMIN:1",
  authenticationState: "AUTHENTICATED",
  freshnessState: "CURRENT"
};
const payload = JSON.stringify({ decision: "APPROVE", type: "GT63_BOOTSTRAP_APPROVAL" });
const gate = {
  gateId: "gate:test", gateRevision: "1", repositoryIdentity: "repo:test", targetPath: "config:test",
  beforeStateId: "sha256:before", afterStateId: "sha256:after", approvalPayloadText: payload, authority: "NONE"
};
const presentation = surface.present({ session, gate });
const sourceEvent = surface.decide({ session, presentationId: presentation.presentationId, decision: "APPROVE" });
const adapter = adapterModule.createHumanGovernanceProductionBindingAdapter({ presentationLedger, sourceEventLedger });

assert.equal(adapter.authority, "NONE");
assert.deepEqual(adapter.sourceEventSnapshotPort({ sourceEventRef: sourceEvent.sourceEventRef }), sourceEvent);
assert.equal(adapter.sourceRegistryPort({ sourceProviderRef: sourceEvent.sourceProviderRef, sourceProviderRevision: "1" }).trustState, "UNKNOWN");
assert.equal(adapter.principalIdentityPort({ sourceEventRef: sourceEvent.sourceEventRef, sourceProviderRef: sourceEvent.sourceProviderRef, providerEventId: sourceEvent.providerEventId }).status, "MISSING");
assert.equal(adapter.verificationMethodPort({ verificationMethodRef: adapterModule.VERIFICATION_METHOD_REF, verificationMethodRevision: "1" }).trustState, "UNKNOWN");
assert.equal(adapter.interactionRoutingPort({ sourceEventRef: sourceEvent.sourceEventRef, interactionId: sourceEvent.interactionId, contextRevision: sourceEvent.contextRevision }).bindingState, "BOUND");

const binding = bindingModule.createAuthenticatedHumanSourceEventBinding({ ...adapter, bindingLedger: bindingLedger() });
const result = binding.accept({
  rulesetVersion: bindingModule.RULESET_VERSION,
  sourceEventRef: sourceEvent.sourceEventRef,
  expectedSourceEventRevision: "1",
  expectedSourceProviderRevision: "1",
  expectedPrincipalRevision: null,
  expectedVerificationMethodRevision: "1",
  expectedRoutingRevision: "1",
  expectedContextRevision: "1"
});
assert.equal(result.outcome, bindingModule.OUTCOMES.ACCEPTED);
assert.equal(result.binding.principalResolutionState, "MISSING");
assert.equal(result.binding.principalRef, null);
assert.equal(result.binding.sourceTrustState, "UNKNOWN");
assert.equal(result.binding.verificationMethodTrustState, "UNKNOWN");
assert.equal(result.binding.originAuthenticationState, "UNKNOWN");
assert.equal(result.binding.interactionBindingState, "BOUND");
assert.equal(result.binding.contentByteLength, Buffer.byteLength(payload, "utf8"));
assert.equal(result.binding.authority, "NONE");
assert.equal(result.authority, "NONE");

console.log("PASS 14/14 human-governance production binding adapter v0 fail-closed regression");
