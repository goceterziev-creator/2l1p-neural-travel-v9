"use strict";

const crypto = require("node:crypto");

const SOURCE_PROVIDER_REF = "gt63-machine:human-governance-approval-surface-v0";
const SOURCE_PROVIDER_REVISION = "1";
const VERIFICATION_METHOD_REF = "gt63-machine:verification-method:existing-signed-session-observation-v0";
const VERIFICATION_METHOD_REVISION = "1";
const ROUTING_REVISION = "1";

const clone = (value) => value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
const sha256 = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;

function requireLedger(name, ledger) {
  if (!ledger || typeof ledger.get !== "function") throw new TypeError(`${name}.get must be a function`);
  return ledger;
}

function createHumanGovernanceProductionBindingAdapter({ presentationLedger, sourceEventLedger }) {
  requireLedger("presentationLedger", presentationLedger);
  requireLedger("sourceEventLedger", sourceEventLedger);

  function sourceEventSnapshotPort({ sourceEventRef }) {
    return clone(sourceEventLedger.get(sourceEventRef));
  }

  function sourceRegistryPort({ sourceProviderRef, sourceProviderRevision }) {
    if (sourceProviderRef !== SOURCE_PROVIDER_REF || sourceProviderRevision !== SOURCE_PROVIDER_REVISION) return null;
    return {
      sourceProviderRef,
      sourceProviderRevision,
      trustState: "UNKNOWN",
      verificationMethodRef: VERIFICATION_METHOD_REF,
      verificationMethodRevision: VERIFICATION_METHOD_REVISION,
      registryEvidenceRef: "gt63-evidence:source-registry:human-governance-approval-surface-v0"
    };
  }

  function principalIdentityPort({ sourceEventRef, sourceProviderRef, providerEventId }) {
    return {
      sourceEventRef,
      sourceProviderRef,
      providerEventId,
      status: "MISSING",
      candidates: [],
      resolutionEvidenceRef: `gt63-evidence:principal-resolution:unresolved:${sourceEventRef}`
    };
  }

  function verificationMethodPort({ verificationMethodRef, verificationMethodRevision }) {
    if (verificationMethodRef !== VERIFICATION_METHOD_REF
      || verificationMethodRevision !== VERIFICATION_METHOD_REVISION) return null;
    return {
      verificationMethodRef,
      verificationMethodRevision,
      trustState: "UNKNOWN",
      freshnessState: "CURRENT",
      methodEvidenceRef: "gt63-evidence:verification-method:existing-signed-session-observation-v0"
    };
  }

  function originVerifierPort({ sourceEvent, principal, verificationMethodRef, verificationMethodRevision }) {
    const presentation = presentationLedger.get(sourceEvent.interactionId);
    const exactPresentation = presentation
      && presentation.presentationId === sourceEvent.interactionId
      && presentation.sessionRef === sourceEvent.sessionRef
      && presentation.sessionRevision === sourceEvent.sessionRevision
      && presentation.exactPayloadBytesBase64 === sourceEvent.contentBytesBase64;
    const evidenceRefs = [sourceEvent.sourceEventEvidenceRef];
    if (presentation && presentation.authenticationEvidenceRef) evidenceRefs.push(presentation.authenticationEvidenceRef);
    return {
      verificationState: "UNKNOWN",
      verifiedPrincipalRef: null,
      verifiedSourceEventRef: exactPresentation ? sourceEvent.sourceEventRef : null,
      verifiedContentDigest: exactPresentation ? sha256(Buffer.from(sourceEvent.contentBytesBase64, "base64")) : null,
      verifiedChannelRef: exactPresentation ? sourceEvent.channelRef : null,
      verifiedSessionRef: exactPresentation ? sourceEvent.sessionRef : null,
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      evidenceRefs
    };
  }

  function interactionRoutingPort({ sourceEventRef, interactionId, contextRevision }) {
    const sourceEvent = sourceEventLedger.get(sourceEventRef);
    const presentation = presentationLedger.get(interactionId);
    if (!sourceEvent || !presentation) return null;
    const bound = sourceEvent.interactionId === presentation.presentationId
      && sourceEvent.contextRevision === contextRevision
      && sourceEvent.sessionRef === presentation.sessionRef
      && sourceEvent.sessionRevision === presentation.sessionRevision
      && sourceEvent.contentBytesBase64 === presentation.exactPayloadBytesBase64;
    return {
      sourceEventRef: sourceEvent.sourceEventRef,
      providerEventId: sourceEvent.providerEventId,
      interactionId: sourceEvent.interactionId,
      contextRevision: sourceEvent.contextRevision,
      routingRevision: ROUTING_REVISION,
      sourceProviderRef: sourceEvent.sourceProviderRef,
      sourceProviderRevision: sourceEvent.sourceProviderRevision,
      channelRef: sourceEvent.channelRef,
      channelRevision: sourceEvent.channelRevision,
      sessionRef: sourceEvent.sessionRef,
      sessionRevision: sourceEvent.sessionRevision,
      bindingState: bound ? "BOUND" : "NOT_BOUND",
      routingEvidenceRef: `gt63-evidence:routing:approval-presentation:${presentation.presentationId}`
    };
  }

  return Object.freeze({
    sourceEventSnapshotPort,
    sourceRegistryPort,
    principalIdentityPort,
    verificationMethodPort,
    originVerifierPort,
    interactionRoutingPort,
    authority: "NONE"
  });
}

module.exports = Object.freeze({
  SOURCE_PROVIDER_REF,
  SOURCE_PROVIDER_REVISION,
  VERIFICATION_METHOD_REF,
  VERIFICATION_METHOD_REVISION,
  ROUTING_REVISION,
  createHumanGovernanceProductionBindingAdapter
});
