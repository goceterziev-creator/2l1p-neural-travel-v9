"use strict";

const { createAuthenticatedHumanSourceEventBinding } = require("./authenticated-human-source-event-binding");
const { createHumanGovernanceAuthenticatedBindingAdapter } = require("./human-governance-authenticated-binding-adapter");

function createMemoryBindingLedger() {
  const records = [];
  return {
    findBySourceEventRef(sourceEventRef) {
      return records.filter((record) => record.sourceEventRef === sourceEventRef).map(clone);
    },
    listByContentDigest(contentDigest) {
      return records.filter((record) => record.contentDigest === contentDigest).map(clone);
    },
    commit(record) {
      const stored = clone(record);
      records.push(stored);
      return clone(stored);
    }
  };
}

function clone(value) {
  return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function createHumanGovernanceAuthenticatedBindingRuntime({
  presentationLedger,
  sourceEventLedger,
  identityProvider = null,
  bindingLedger = createMemoryBindingLedger()
}) {
  const adapter = createHumanGovernanceAuthenticatedBindingAdapter({
    presentationLedger,
    sourceEventLedger,
    identityProvider
  });

  const binding = createAuthenticatedHumanSourceEventBinding({
    sourceEventSnapshotPort: adapter.sourceEventSnapshotPort,
    sourceRegistryPort: adapter.sourceRegistryPort,
    principalIdentityPort: adapter.principalIdentityPort,
    verificationMethodPort: adapter.verificationMethodPort,
    originVerifierPort: adapter.originVerifierPort,
    interactionRoutingPort: adapter.interactionRoutingPort,
    bindingLedger
  });

  function acceptSourceEvent(sourceEvent) {
    if (!sourceEvent || sourceEvent.type !== "HUMAN_SOURCE_EVENT") {
      return Object.freeze({ outcome: "BINDING_EVIDENCE_REJECTED", reason: "invalid human source event", binding: null, authority: "NONE" });
    }

    return binding.accept(adapter.createBindingRequest(sourceEvent.sourceEventRef));
  }

  return Object.freeze({
    acceptSourceEvent,
    adapter,
    bindingLedger,
    authority: "NONE"
  });
}

module.exports = Object.freeze({
  createHumanGovernanceAuthenticatedBindingRuntime,
  createMemoryBindingLedger
});
