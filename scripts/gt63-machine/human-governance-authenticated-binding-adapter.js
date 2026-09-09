"use strict";

const crypto = require("node:crypto");

const ADAPTER_RULESET_VERSION = "human-governance-authenticated-binding-adapter-v0.2.0";
const BINDING_RULESET_VERSION = "authenticated-human-source-event-binding-v1.0.0";
const SOURCE_PROVIDER_REF = "gt63-machine:human-governance-approval-surface-v0";
const SOURCE_PROVIDER_REVISION = "1";
const VERIFICATION_METHOD_REF = "gt63-machine:verification-method:approval-surface-session-continuity-v0";
const VERIFICATION_METHOD_REVISION = "1";
const ROUTING_REVISION = "1";

function clone(value) {
  return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

function localEvidenceRef(kind, sourceEventRef) {
  const digest = crypto.createHash("sha256").update(`${kind}\u0000${sourceEventRef}`, "utf8").digest("hex");
  return `gt63-process-local-evidence:${kind}:${digest}`;
}

function requireLedger(name, ledger) {
  if (!ledger || typeof ledger.get !== "function") throw new TypeError(`${name}.get must be a function`);
}

function createHumanGovernanceAuthenticatedBindingAdapter({
  presentationLedger,
  sourceEventLedger,
  identityProvider = null
}) {
  requireLedger("presentationLedger", presentationLedger);
  requireLedger("sourceEventLedger", sourceEventLedger);
  if (identityProvider !== null && (!identityProvider || typeof identityProvider.getIdentityBySession !== "function")) {
    throw new TypeError("identityProvider.getIdentityBySession must be a function");
  }

  function sourceEventSnapshotPort({ sourceEventRef }) {
    if (!nonEmpty(sourceEventRef)) return null;
    return clone(sourceEventLedger.get(sourceEventRef));
  }

  function sourceRegistryPort({ sourceProviderRef, sourceProviderRevision }) {
    if (sourceProviderRef !== SOURCE_PROVIDER_REF || sourceProviderRevision !== SOURCE_PROVIDER_REVISION) return null;
    return deepFreeze({
      sourceProviderRef: SOURCE_PROVIDER_REF,
      sourceProviderRevision: SOURCE_PROVIDER_REVISION,
      trustState: "UNKNOWN",
      verificationMethodRef: VERIFICATION_METHOD_REF,
      verificationMethodRevision: VERIFICATION_METHOD_REVISION,
      registryEvidenceRef: "gt63-process-local-evidence:source-registry:approval-surface-v0:unknown-trust"
    });
  }

  function principalIdentityPort({ sourceEventRef, sourceProviderRef, providerEventId }) {
    const source = sourceEventLedger.get(sourceEventRef);
    if (!source || source.sourceProviderRef !== sourceProviderRef || source.providerEventId !== providerEventId) return null;

    const identity = identityProvider ? identityProvider.getIdentityBySession(source.sessionRef) : null;
    const exactIdentity = Boolean(identity
      && identity.type === "GT63_EXTERNAL_AUTHENTICATED_IDENTITY_BINDING"
      && nonEmpty(identity.principalRef)
      && nonEmpty(identity.principalNamespace)
      && nonEmpty(identity.principalRevision)
      && identity.sessionRef === source.sessionRef
      && identity.sessionRevision === source.sessionRevision
      && identity.lifecycleState === "CURRENT"
      && identity.freshnessState === "CURRENT"
      && identity.contradictionState === "NONE"
      && nonEmpty(identity.principalEvidenceRef));

    if (!exactIdentity) {
      return deepFreeze({
        sourceEventRef,
        sourceProviderRef,
        providerEventId,
        status: "MISSING",
        candidates: [],
        resolutionEvidenceRef: localEvidenceRef("principal-resolution-missing", sourceEventRef)
      });
    }

    return deepFreeze({
      sourceEventRef,
      sourceProviderRef,
      providerEventId,
      status: "RESOLVED",
      candidates: [{
        principalRef: identity.principalRef,
        principalNamespace: identity.principalNamespace,
        principalRevision: identity.principalRevision,
        lifecycleState: identity.lifecycleState,
        freshnessState: identity.freshnessState,
        principalEvidenceRef: identity.principalEvidenceRef,
        displayName: nonEmpty(identity.githubLogin) ? identity.githubLogin : null
      }],
      resolutionEvidenceRef: localEvidenceRef("principal-resolution-github-session-bound", sourceEventRef)
    });
  }

  function verificationMethodPort({ verificationMethodRef, verificationMethodRevision }) {
    if (verificationMethodRef !== VERIFICATION_METHOD_REF
      || verificationMethodRevision !== VERIFICATION_METHOD_REVISION) return null;
    return deepFreeze({
      verificationMethodRef: VERIFICATION_METHOD_REF,
      verificationMethodRevision: VERIFICATION_METHOD_REVISION,
      trustState: "UNKNOWN",
      freshnessState: "CURRENT",
      methodEvidenceRef: "gt63-process-local-evidence:verification-method:approval-surface-session-continuity-v0:unknown-trust"
    });
  }

  function originVerifierPort({ sourceEvent, principal, verificationMethodRef, verificationMethodRevision }) {
    if (!sourceEvent || sourceEvent.sourceProviderRef !== SOURCE_PROVIDER_REF) return null;
    if (verificationMethodRef !== VERIFICATION_METHOD_REF
      || verificationMethodRevision !== VERIFICATION_METHOD_REVISION) return null;

    const principalMatchesSessionIdentity = Boolean(principal && identityProvider
      && (() => {
        const identity = identityProvider.getIdentityBySession(sourceEvent.sessionRef);
        return identity
          && identity.sessionRef === sourceEvent.sessionRef
          && identity.sessionRevision === sourceEvent.sessionRevision
          && identity.principalRef === principal.principalRef
          && identity.principalRevision === principal.principalRevision
          && identity.contradictionState === "NONE";
      })());

    return deepFreeze({
      verificationState: "UNKNOWN",
      verifiedPrincipalRef: principalMatchesSessionIdentity ? principal.principalRef : null,
      verifiedSourceEventRef: null,
      verifiedContentDigest: null,
      verifiedChannelRef: null,
      verifiedSessionRef: principalMatchesSessionIdentity ? sourceEvent.sessionRef : null,
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      evidenceRefs: [localEvidenceRef(
        principalMatchesSessionIdentity ? "origin-session-principal-related-but-untrusted" : "origin-verification-unknown",
        sourceEvent.sourceEventRef
      )]
    });
  }

  function interactionRoutingPort({ sourceEventRef, interactionId, contextRevision }) {
    const source = sourceEventLedger.get(sourceEventRef);
    if (!source || source.interactionId !== interactionId || source.contextRevision !== contextRevision) return null;
    const presentation = presentationLedger.get(interactionId);
    const bound = Boolean(presentation
      && presentation.presentationId === source.interactionId
      && presentation.gateRevision === source.contextRevision
      && presentation.sessionRef === source.sessionRef
      && presentation.sessionRevision === source.sessionRevision
      && presentation.authenticationProviderRef === "gt63-existing-signed-session-v0");
    return deepFreeze({
      sourceEventRef: source.sourceEventRef,
      providerEventId: source.providerEventId,
      interactionId: source.interactionId,
      contextRevision: source.contextRevision,
      routingRevision: ROUTING_REVISION,
      sourceProviderRef: source.sourceProviderRef,
      sourceProviderRevision: source.sourceProviderRevision,
      channelRef: source.channelRef,
      channelRevision: source.channelRevision,
      sessionRef: source.sessionRef,
      sessionRevision: source.sessionRevision,
      bindingState: bound ? "BOUND" : "UNKNOWN",
      routingEvidenceRef: localEvidenceRef(bound ? "approval-routing-bound" : "approval-routing-unknown", sourceEventRef)
    });
  }

  function createBindingRequest(sourceEventRef) {
    const source = sourceEventLedger.get(sourceEventRef);
    if (!source) throw new Error("source event unavailable");
    const identity = identityProvider ? identityProvider.getIdentityBySession(source.sessionRef) : null;
    const expectedPrincipalRevision = identity
      && identity.sessionRef === source.sessionRef
      && identity.sessionRevision === source.sessionRevision
      && identity.lifecycleState === "CURRENT"
      && identity.freshnessState === "CURRENT"
      && identity.contradictionState === "NONE"
      ? identity.principalRevision
      : null;
    return deepFreeze({
      rulesetVersion: BINDING_RULESET_VERSION,
      sourceEventRef: source.sourceEventRef,
      expectedSourceEventRevision: source.sourceEventRevision,
      expectedSourceProviderRevision: source.sourceProviderRevision,
      expectedPrincipalRevision,
      expectedVerificationMethodRevision: VERIFICATION_METHOD_REVISION,
      expectedRoutingRevision: ROUTING_REVISION,
      expectedContextRevision: source.contextRevision
    });
  }

  return deepFreeze({
    authority: "NONE",
    rulesetVersion: ADAPTER_RULESET_VERSION,
    sourceEventSnapshotPort,
    sourceRegistryPort,
    principalIdentityPort,
    verificationMethodPort,
    originVerifierPort,
    interactionRoutingPort,
    createBindingRequest
  });
}

module.exports = Object.freeze({
  ADAPTER_RULESET_VERSION,
  BINDING_RULESET_VERSION,
  SOURCE_PROVIDER_REF,
  SOURCE_PROVIDER_REVISION,
  VERIFICATION_METHOD_REF,
  VERIFICATION_METHOD_REVISION,
  ROUTING_REVISION,
  createHumanGovernanceAuthenticatedBindingAdapter
});
