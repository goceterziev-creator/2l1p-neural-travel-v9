"use strict";

const bindingModule = require("./authenticated-human-source-event-binding");

const PROVIDER_REF = "gt63-machine:human-governance-approval-surface-v0";
const PROVIDER_REVISION = "1";
const METHOD_REF = "gt63-machine:verification:approval-surface-capture-v0";
const METHOD_REVISION = "1";
const ROUTING_REVISION = "1";

function clone(value) { return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value)); }
function nonEmpty(value) { return typeof value === "string" && value.length > 0; }

function createBindingLedger() {
  const records = [];
  return Object.freeze({
    findBySourceEventRef(ref) { return Object.freeze(records.filter((r) => r.sourceEventRef === ref)); },
    listByContentDigest(digest) { return Object.freeze(records.filter((r) => r.contentDigest === digest)); },
    commit(binding) {
      if (records.some((r) => r.sourceEventRef === binding.sourceEventRef || r.bindingId === binding.bindingId)) {
        throw new Error("immutable-ledger-conflict");
      }
      const stored = Object.freeze(clone(binding));
      records.push(stored);
      return stored;
    },
    records() { return Object.freeze(records.slice()); }
  });
}

function createHumanGovernanceProductionBindingAdapter({ presentationLedger, sourceEventLedger, bindingLedger = createBindingLedger() }) {
  if (!presentationLedger || typeof presentationLedger.get !== "function") throw new TypeError("presentationLedger.get required");
  if (!sourceEventLedger || typeof sourceEventLedger.get !== "function") throw new TypeError("sourceEventLedger.get required");

  function sourceEventSnapshotPort({ sourceEventRef }) {
    return clone(sourceEventLedger.get(sourceEventRef));
  }

  function sourceRegistryPort({ sourceProviderRef, sourceProviderRevision }) {
    if (sourceProviderRef !== PROVIDER_REF || sourceProviderRevision !== PROVIDER_REVISION) return null;
    return {
      sourceProviderRef: PROVIDER_REF,
      sourceProviderRevision: PROVIDER_REVISION,
      trustState: "UNKNOWN",
      verificationMethodRef: METHOD_REF,
      verificationMethodRevision: METHOD_REVISION,
      registryEvidenceRef: "gt63-evidence:approval-surface-provider-contract-v0"
    };
  }

  function principalIdentityPort({ sourceEventRef, sourceProviderRef, providerEventId }) {
    return {
      sourceEventRef,
      sourceProviderRef,
      providerEventId,
      status: "MISSING",
      candidates: [],
      resolutionEvidenceRef: `gt63-evidence:principal-resolution:not-established:${sourceEventRef}`
    };
  }

  function verificationMethodPort({ verificationMethodRef, verificationMethodRevision }) {
    if (verificationMethodRef !== METHOD_REF || verificationMethodRevision !== METHOD_REVISION) return null;
    return {
      verificationMethodRef: METHOD_REF,
      verificationMethodRevision: METHOD_REVISION,
      trustState: "UNKNOWN",
      freshnessState: "CURRENT",
      methodEvidenceRef: "gt63-evidence:approval-surface-verification-method-v0"
    };
  }

  function presentationFor(sourceEvent) {
    if (!sourceEvent || !nonEmpty(sourceEvent.interactionId)) return null;
    return presentationLedger.get(sourceEvent.interactionId);
  }

  function originVerifierPort({ sourceEvent }) {
    const presentation = presentationFor(sourceEvent);
    const captureMatches = Boolean(presentation
      && presentation.presentationId === sourceEvent.interactionId
      && presentation.exactPayloadBytesBase64 === sourceEvent.contentBytesBase64
      && presentation.sessionRef === sourceEvent.sessionRef
      && presentation.sessionRevision === sourceEvent.sessionRevision
      && presentation.authenticatedAccountRef === sourceEvent.claimedActorRef);
    return {
      verificationState: "UNKNOWN",
      verifiedPrincipalRef: null,
      verifiedSourceEventRef: captureMatches ? sourceEvent.sourceEventRef : null,
      verifiedContentDigest: null,
      verifiedChannelRef: captureMatches ? sourceEvent.channelRef : null,
      verifiedSessionRef: captureMatches ? sourceEvent.sessionRef : null,
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      evidenceRefs: [captureMatches
        ? `gt63-evidence:approval-presentation-capture-continuity:${sourceEvent.interactionId}`
        : `gt63-evidence:approval-presentation-capture-unresolved:${sourceEvent.sourceEventRef}`]
    };
  }

  function interactionRoutingPort({ sourceEventRef, interactionId, contextRevision }) {
    const sourceEvent = sourceEventLedger.get(sourceEventRef);
    const presentation = sourceEvent && presentationLedger.get(interactionId);
    const bound = Boolean(sourceEvent && presentation
      && sourceEvent.interactionId === interactionId
      && sourceEvent.contextRevision === contextRevision
      && presentation.presentationId === interactionId
      && presentation.sessionRef === sourceEvent.sessionRef
      && presentation.sessionRevision === sourceEvent.sessionRevision);
    return {
      sourceEventRef,
      providerEventId: sourceEvent ? sourceEvent.providerEventId : "unknown:provider-event",
      interactionId,
      contextRevision,
      routingRevision: ROUTING_REVISION,
      sourceProviderRef: sourceEvent ? sourceEvent.sourceProviderRef : PROVIDER_REF,
      sourceProviderRevision: sourceEvent ? sourceEvent.sourceProviderRevision : PROVIDER_REVISION,
      channelRef: sourceEvent ? sourceEvent.channelRef : "unknown:channel",
      channelRevision: sourceEvent ? sourceEvent.channelRevision : "unknown",
      sessionRef: sourceEvent ? sourceEvent.sessionRef : "unknown:session",
      sessionRevision: sourceEvent ? sourceEvent.sessionRevision : "unknown",
      bindingState: bound ? "BOUND" : "NOT_BOUND",
      routingEvidenceRef: bound
        ? `gt63-evidence:approval-routing-bound:${interactionId}`
        : `gt63-evidence:approval-routing-not-bound:${sourceEventRef}`
    };
  }

  const binding = bindingModule.createAuthenticatedHumanSourceEventBinding({
    sourceEventSnapshotPort, sourceRegistryPort, principalIdentityPort,
    verificationMethodPort, originVerifierPort, interactionRoutingPort, bindingLedger
  });

  return Object.freeze({
    accept: binding.accept,
    bindingLedger,
    constants: Object.freeze({ PROVIDER_REF, PROVIDER_REVISION, METHOD_REF, METHOD_REVISION, ROUTING_REVISION }),
    authority: "NONE"
  });
}

module.exports = Object.freeze({ createHumanGovernanceProductionBindingAdapter, createBindingLedger });
