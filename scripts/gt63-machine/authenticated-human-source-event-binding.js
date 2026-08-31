"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "authenticated-human-source-event-binding-v1.0.0";
const SCHEMA_VERSION = "1.0";
const OUTCOMES = Object.freeze({
  ACCEPTED: "BINDING_EVIDENCE_ACCEPTED",
  ALREADY_ACCEPTED: "BINDING_EVIDENCE_ALREADY_ACCEPTED",
  REJECTED: "BINDING_EVIDENCE_REJECTED",
  STALE: "BINDING_EVIDENCE_STALE",
  UNCERTAIN: "BINDING_EVIDENCE_UNCERTAIN",
  IDENTITY_CONFLICT: "BINDING_IDENTITY_CONFLICT"
});

const SOURCE_TRUST = new Set(["TRUSTED", "UNTRUSTED", "UNKNOWN"]);
const METHOD_TRUST = new Set(["TRUSTED", "UNTRUSTED", "UNKNOWN"]);
const FRESHNESS = new Set(["CURRENT", "STALE", "UNKNOWN"]);
const LIFECYCLE = new Set(["CURRENT", "REVOKED", "DEACTIVATED", "UNKNOWN"]);
const RESOLUTION = new Set(["RESOLVED", "MISSING", "AMBIGUOUS"]);
const VERIFICATION = new Set(["VERIFIED", "NOT_VERIFIED", "UNKNOWN"]);
const BINDING = new Set(["BOUND", "NOT_BOUND", "UNKNOWN"]);
const CONTRADICTION = new Set(["NONE", "CONTRADICTORY_EVIDENCE"]);
const PRESENTATION = new Set(["DIRECT", "FORWARDED", "QUOTED"]);

const REQUEST_FIELDS = new Set([
  "rulesetVersion", "sourceEventRef", "expectedSourceEventRevision",
  "expectedSourceProviderRevision", "expectedPrincipalRevision",
  "expectedVerificationMethodRevision", "expectedRoutingRevision",
  "expectedContextRevision"
]);

function plain(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) {
    return Object.keys(value).sort(compareCodePoints).reduce((out, key) => {
      out[key.normalize("NFC")] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return typeof value === "string" ? value.normalize("NFC") : value;
}

function compareCodePoints(left, right) {
  const a = Array.from(String(left));
  const b = Array.from(String(right));
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const difference = a[index].codePointAt(0) - b[index].codePointAt(0);
    if (difference) return difference;
  }
  return a.length - b.length;
}

const canonicalStringify = (value) => JSON.stringify(canonicalize(value));
const sha256 = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const clone = (value) => value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
const nonEmpty = (value) => typeof value === "string" && value.length > 0;
const nullableString = (value) => value === null || nonEmpty(value);
const evidenceSet = (values) => Array.from(new Set(values.map((value) => value.normalize("NFC")))).sort(compareCodePoints);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

function exact(record, fields) {
  if (!plain(record)) return false;
  return Object.keys(record).every((key) => fields.has(key));
}

function hasStrings(record, fields) {
  return fields.every((field) => nonEmpty(record[field]));
}

function result(outcome, reason, binding = null) {
  return deepFreeze({ outcome, reason: reason || null, binding: clone(binding), authority: "NONE" });
}

function validRequest(request) {
  return exact(request, REQUEST_FIELDS)
    && hasStrings(request, [
      "rulesetVersion", "sourceEventRef", "expectedSourceEventRevision",
      "expectedSourceProviderRevision", "expectedVerificationMethodRevision",
      "expectedRoutingRevision", "expectedContextRevision"
    ])
    && nullableString(request.expectedPrincipalRevision);
}

function validSourceEvent(record) {
  const fields = new Set([
    "type", "sourceEventRef", "sourceEventRevision", "sourceProviderRef",
    "sourceProviderRevision", "providerEventId", "contentBytesBase64",
    "contentEncoding", "contentMediaType", "contentBindingContractRef",
    "contentBindingContractRevision", "channelRef", "channelRevision",
    "sessionRef", "sessionRevision", "occurredTemporalFrameRef",
    "receivedTemporalFrameRef", "interactionId", "contextRevision",
    "claimedActorRef", "presentationClass", "attributedPrincipalRef",
    "sourceEventEvidenceRef"
  ]);
  return exact(record, fields)
    && record.type === "HUMAN_SOURCE_EVENT"
    && hasStrings(record, [
      "sourceEventRef", "sourceEventRevision", "sourceProviderRef",
      "sourceProviderRevision", "providerEventId", "contentBytesBase64",
      "contentEncoding", "contentMediaType", "contentBindingContractRef",
      "contentBindingContractRevision", "channelRef", "channelRevision",
      "sessionRef", "sessionRevision", "occurredTemporalFrameRef",
      "receivedTemporalFrameRef", "interactionId", "contextRevision",
      "sourceEventEvidenceRef"
    ])
    && nullableString(record.claimedActorRef)
    && nullableString(record.attributedPrincipalRef)
    && PRESENTATION.has(record.presentationClass);
}

function validSourceRegistry(record) {
  return exact(record, new Set([
    "sourceProviderRef", "sourceProviderRevision", "trustState",
    "verificationMethodRef", "verificationMethodRevision", "registryEvidenceRef"
  ]))
    && hasStrings(record, [
      "sourceProviderRef", "sourceProviderRevision", "verificationMethodRef",
      "verificationMethodRevision", "registryEvidenceRef"
    ])
    && SOURCE_TRUST.has(record.trustState);
}

function validPrincipal(record) {
  if (!exact(record, new Set([
    "principalRef", "principalNamespace", "principalRevision", "lifecycleState",
    "freshnessState", "principalEvidenceRef", "displayName"
  ]))) return false;
  return hasStrings(record, [
    "principalRef", "principalNamespace", "principalRevision", "principalEvidenceRef"
  ]) && LIFECYCLE.has(record.lifecycleState) && FRESHNESS.has(record.freshnessState)
    && (record.displayName === null || typeof record.displayName === "string");
}

function validIdentityResolution(record) {
  return exact(record, new Set([
    "sourceEventRef", "sourceProviderRef", "providerEventId", "status",
    "candidates", "resolutionEvidenceRef"
  ]))
    && hasStrings(record, ["sourceEventRef", "sourceProviderRef", "providerEventId"])
    && RESOLUTION.has(record.status)
    && Array.isArray(record.candidates)
    && record.candidates.every(validPrincipal)
    && nonEmpty(record.resolutionEvidenceRef)
    && ((record.status === "RESOLVED" && record.candidates.length === 1)
      || (record.status === "MISSING" && record.candidates.length === 0)
      || (record.status === "AMBIGUOUS" && record.candidates.length > 1));
}

function validMethod(record) {
  return exact(record, new Set([
    "verificationMethodRef", "verificationMethodRevision", "trustState",
    "freshnessState", "methodEvidenceRef"
  ]))
    && hasStrings(record, ["verificationMethodRef", "verificationMethodRevision", "methodEvidenceRef"])
    && METHOD_TRUST.has(record.trustState)
    && FRESHNESS.has(record.freshnessState);
}

function validVerification(record) {
  return exact(record, new Set([
    "verificationState", "verifiedPrincipalRef", "verifiedSourceEventRef",
    "verifiedContentDigest", "verifiedChannelRef", "verifiedSessionRef",
    "freshnessState", "contradictionState", "evidenceRefs"
  ]))
    && VERIFICATION.has(record.verificationState)
    && ["verifiedPrincipalRef", "verifiedSourceEventRef", "verifiedContentDigest",
      "verifiedChannelRef", "verifiedSessionRef"].every((field) => nullableString(record[field]))
    && FRESHNESS.has(record.freshnessState)
    && CONTRADICTION.has(record.contradictionState)
    && Array.isArray(record.evidenceRefs)
    && record.evidenceRefs.every(nonEmpty);
}

function validRouting(record) {
  return exact(record, new Set([
    "sourceEventRef", "providerEventId", "interactionId", "contextRevision",
    "routingRevision", "sourceProviderRef", "sourceProviderRevision", "channelRef",
    "channelRevision", "sessionRef", "sessionRevision", "bindingState", "routingEvidenceRef"
  ]))
    && hasStrings(record, [
      "sourceEventRef", "providerEventId", "interactionId", "contextRevision",
      "routingRevision", "sourceProviderRef", "sourceProviderRevision", "channelRef",
      "channelRevision", "sessionRef", "sessionRevision", "routingEvidenceRef"
    ])
    && BINDING.has(record.bindingState);
}

function strictBase64(value) {
  if (!nonEmpty(value) || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const bytes = Buffer.from(value, "base64");
  return bytes.toString("base64") === value ? bytes : null;
}

function callPort(port, argument) {
  try { return { ok: true, value: port(clone(argument)) }; }
  catch (_) { return { ok: false, value: null }; }
}

function createAuthenticatedHumanSourceEventBinding({
  sourceEventSnapshotPort,
  sourceRegistryPort,
  principalIdentityPort,
  verificationMethodPort,
  originVerifierPort,
  interactionRoutingPort,
  bindingLedger
}) {
  for (const [name, port] of Object.entries({
    sourceEventSnapshotPort, sourceRegistryPort, principalIdentityPort,
    verificationMethodPort, originVerifierPort, interactionRoutingPort
  })) {
    if (typeof port !== "function") throw new TypeError(`${name} must be a function`);
  }
  for (const name of ["findBySourceEventRef", "listByContentDigest", "commit"]) {
    if (!bindingLedger || typeof bindingLedger[name] !== "function") {
      throw new TypeError(`bindingLedger.${name} must be a function`);
    }
  }

  function accept(request) {
    if (!validRequest(request)) return result(OUTCOMES.REJECTED, "unsupported request schema");
    if (request.rulesetVersion !== RULESET_VERSION) return result(OUTCOMES.REJECTED, "unsupported ruleset");

    const sourceResult = callPort(sourceEventSnapshotPort, { sourceEventRef: request.sourceEventRef });
    if (!sourceResult.ok) return result(OUTCOMES.UNCERTAIN, "source event unavailable");
    const source = sourceResult.value;
    if (!validSourceEvent(source) || source.sourceEventRef !== request.sourceEventRef) {
      return result(OUTCOMES.REJECTED, "invalid source-event evidence");
    }
    const bytes = strictBase64(source.contentBytesBase64);
    if (!bytes) return result(OUTCOMES.REJECTED, "invalid exact content bytes");
    const contentDigest = sha256(bytes);

    let historical;
    try { historical = bindingLedger.findBySourceEventRef(source.sourceEventRef); }
    catch (_) { return result(OUTCOMES.UNCERTAIN, "binding ledger unavailable"); }
    if (!Array.isArray(historical)) return result(OUTCOMES.UNCERTAIN, "binding ledger evidence invalid");
    if (historical.length > 1) return result(OUTCOMES.IDENTITY_CONFLICT, "multiple ledger records for source event");
    if (historical.length === 1) {
      const prior = historical[0];
      const staleReplay = prior.sourceEventRevision !== request.expectedSourceEventRevision
        || prior.sourceProviderRevision !== request.expectedSourceProviderRevision
        || prior.verificationMethodRevision !== request.expectedVerificationMethodRevision
        || prior.routingRevision !== request.expectedRoutingRevision
        || prior.contextRevision !== request.expectedContextRevision
        || (request.expectedPrincipalRevision !== null
          && prior.principalRevision !== request.expectedPrincipalRevision);
      if (staleReplay) return result(OUTCOMES.STALE, "accepted binding does not match expected revisions");
      const exactHistoricalSource = prior.sourceEventRevision === source.sourceEventRevision
        && prior.sourceProviderRef === source.sourceProviderRef
        && prior.sourceProviderRevision === source.sourceProviderRevision
        && prior.providerEventId === source.providerEventId
        && prior.contentDigest === contentDigest
        && prior.contentByteLength === bytes.length
        && prior.contentEncoding === source.contentEncoding
        && prior.contentMediaType === source.contentMediaType
        && prior.contentBindingContractRef === source.contentBindingContractRef
        && prior.contentBindingContractRevision === source.contentBindingContractRevision
        && prior.channelRef === source.channelRef
        && prior.channelRevision === source.channelRevision
        && prior.sessionRef === source.sessionRef
        && prior.sessionRevision === source.sessionRevision
        && prior.occurredTemporalFrameRef === source.occurredTemporalFrameRef
        && prior.receivedTemporalFrameRef === source.receivedTemporalFrameRef
        && prior.interactionId === source.interactionId
        && prior.contextRevision === source.contextRevision
        && prior.claimedActorRef === source.claimedActorRef
        && prior.presentationClass === source.presentationClass
        && prior.attributedPrincipalRef === source.attributedPrincipalRef;
      return exactHistoricalSource
        ? result(OUTCOMES.ALREADY_ACCEPTED, "same binding evidence already accepted", prior)
        : result(OUTCOMES.IDENTITY_CONFLICT, "source event identity reused with changed material");
    }

    const registryResult = callPort(sourceRegistryPort, {
      sourceProviderRef: source.sourceProviderRef,
      sourceProviderRevision: source.sourceProviderRevision
    });
    if (!registryResult.ok) return result(OUTCOMES.UNCERTAIN, "source registry unavailable");
    if (!validSourceRegistry(registryResult.value)) return result(OUTCOMES.UNCERTAIN, "source registry evidence invalid");
    const registry = registryResult.value;
    if (registry.sourceProviderRef !== source.sourceProviderRef
      || registry.sourceProviderRevision !== source.sourceProviderRevision) {
      return result(OUTCOMES.UNCERTAIN, "source registry evidence is not subject-bound");
    }

    const identityResult = callPort(principalIdentityPort, {
      sourceEventRef: source.sourceEventRef,
      sourceProviderRef: source.sourceProviderRef,
      providerEventId: source.providerEventId
    });
    if (!identityResult.ok) return result(OUTCOMES.UNCERTAIN, "principal resolution unavailable");
    if (!validIdentityResolution(identityResult.value)) return result(OUTCOMES.UNCERTAIN, "principal evidence invalid");
    const identity = identityResult.value;
    if (identity.sourceEventRef !== source.sourceEventRef
      || identity.sourceProviderRef !== source.sourceProviderRef
      || identity.providerEventId !== source.providerEventId) {
      return result(OUTCOMES.UNCERTAIN, "principal evidence is not source-event-bound");
    }
    const principal = identity.status === "RESOLVED" ? identity.candidates[0] : null;

    const methodResult = callPort(verificationMethodPort, {
      verificationMethodRef: registry.verificationMethodRef,
      verificationMethodRevision: registry.verificationMethodRevision
    });
    if (!methodResult.ok) return result(OUTCOMES.UNCERTAIN, "verification method unavailable");
    if (!validMethod(methodResult.value)) return result(OUTCOMES.UNCERTAIN, "verification method evidence invalid");
    const method = methodResult.value;
    if (method.verificationMethodRef !== registry.verificationMethodRef
      || method.verificationMethodRevision !== registry.verificationMethodRevision) {
      return result(OUTCOMES.UNCERTAIN, "verification method evidence is not registry-bound");
    }

    const verificationResult = callPort(originVerifierPort, {
      sourceEvent: source,
      principal: principal,
      verificationMethodRef: method.verificationMethodRef,
      verificationMethodRevision: method.verificationMethodRevision
    });
    if (!verificationResult.ok) return result(OUTCOMES.UNCERTAIN, "origin verification unavailable");
    if (!validVerification(verificationResult.value)) return result(OUTCOMES.UNCERTAIN, "origin verification evidence invalid");
    const verification = verificationResult.value;

    const routingResult = callPort(interactionRoutingPort, {
      sourceEventRef: source.sourceEventRef,
      interactionId: source.interactionId,
      contextRevision: source.contextRevision
    });
    if (!routingResult.ok) return result(OUTCOMES.UNCERTAIN, "interaction routing unavailable");
    if (!validRouting(routingResult.value)) return result(OUTCOMES.UNCERTAIN, "routing evidence invalid");
    const routing = routingResult.value;
    if (routing.sourceEventRef !== source.sourceEventRef || routing.providerEventId !== source.providerEventId) {
      return result(OUTCOMES.UNCERTAIN, "routing evidence is not source-event-bound");
    }

    const stale = source.sourceEventRevision !== request.expectedSourceEventRevision
      || source.sourceProviderRevision !== request.expectedSourceProviderRevision
      || registry.sourceProviderRevision !== request.expectedSourceProviderRevision
      || registry.verificationMethodRevision !== request.expectedVerificationMethodRevision
      || method.verificationMethodRevision !== request.expectedVerificationMethodRevision
      || routing.routingRevision !== request.expectedRoutingRevision
      || source.contextRevision !== request.expectedContextRevision
      || routing.contextRevision !== request.expectedContextRevision
      || (request.expectedPrincipalRevision !== null
        && (!principal || principal.principalRevision !== request.expectedPrincipalRevision))
      || (principal && principal.freshnessState === "STALE")
      || method.freshnessState === "STALE" || verification.freshnessState === "STALE";
    if (stale) return result(OUTCOMES.STALE, "expected evidence revision or freshness is stale");

    const identityConflict = verification.contradictionState === "CONTRADICTORY_EVIDENCE"
      || (verification.verificationState === "VERIFIED" && (!principal
        || verification.verifiedPrincipalRef !== principal.principalRef));
    if (identityConflict) return result(OUTCOMES.IDENTITY_CONFLICT, "trusted identity evidence conflicts");

    const providerMatches = registry.sourceProviderRef === source.sourceProviderRef
      && routing.sourceProviderRef === source.sourceProviderRef
      && routing.sourceProviderRevision === source.sourceProviderRevision;
    const routeMatches = routing.interactionId === source.interactionId
      && routing.contextRevision === source.contextRevision
      && routing.channelRef === source.channelRef
      && routing.channelRevision === source.channelRevision
      && routing.sessionRef === source.sessionRef
      && routing.sessionRevision === source.sessionRevision;
    const verifiedBytes = verification.verifiedSourceEventRef === source.sourceEventRef
      && verification.verifiedContentDigest === contentDigest;
    const verifiedTransport = verification.verifiedChannelRef === source.channelRef
      && verification.verifiedSessionRef === source.sessionRef;
    const positiveTrust = registry.trustState === "TRUSTED" && method.trustState === "TRUSTED";

    let originState = "UNKNOWN";
    if (verification.verificationState === "NOT_VERIFIED") originState = "NOT_AUTHENTICATED";
    else if (verification.verificationState === "VERIFIED" && principal && verifiedBytes
      && verifiedTransport && providerMatches && positiveTrust) originState = "AUTHENTICATED";

    const integrityState = verification.verificationState === "UNKNOWN" ? "UNKNOWN"
      : verifiedBytes ? "EXACT_BYTES" : "BYTES_MISMATCH";
    const interactionBindingState = routing.bindingState === "BOUND" && providerMatches && routeMatches
      ? "BOUND" : routing.bindingState === "NOT_BOUND" || !providerMatches || !routeMatches
        ? "NOT_BOUND" : "UNKNOWN";
    const claimedActorRelation = !source.claimedActorRef ? "NO_CLAIM"
      : principal && source.claimedActorRef === principal.principalRef
        ? "MATCHES_VERIFIED_PRINCIPAL" : principal ? "DIFFERS_FROM_VERIFIED_PRINCIPAL" : "UNKNOWN";
    const attributionState = source.presentationClass === "DIRECT" && source.attributedPrincipalRef === null
      ? "NOT_APPLICABLE" : "UNVERIFIED_ATTRIBUTION";
    const delegationState = source.attributedPrincipalRef === null
      ? "NOT_CLAIMED" : "UNRESOLVED";

    let priorByDigest;
    try {
      priorByDigest = bindingLedger.listByContentDigest(contentDigest);
    } catch (_) {
      return result(OUTCOMES.UNCERTAIN, "binding ledger unavailable");
    }
    if (!Array.isArray(priorByDigest)) {
      return result(OUTCOMES.UNCERTAIN, "binding ledger evidence invalid");
    }
    const priorContentEventRefs = evidenceSet(priorByDigest
      .filter((item) => item && item.sourceEventRef !== source.sourceEventRef)
      .map((item) => item.sourceEventRef));
    const evidenceRefs = evidenceSet([
      source.sourceEventEvidenceRef, registry.registryEvidenceRef,
      identity.resolutionEvidenceRef, method.methodEvidenceRef,
      routing.routingEvidenceRef, ...verification.evidenceRefs,
      ...identity.candidates.map((candidate) => candidate.principalEvidenceRef)
    ]);

    const material = {
      type: "AUTHENTICATED_HUMAN_SOURCE_EVENT_BINDING",
      schemaVersion: SCHEMA_VERSION,
      rulesetVersion: RULESET_VERSION,
      sourceEventRef: source.sourceEventRef,
      sourceEventRevision: source.sourceEventRevision,
      sourceProviderRef: source.sourceProviderRef,
      sourceProviderRevision: source.sourceProviderRevision,
      providerEventId: source.providerEventId,
      contentDigest,
      contentByteLength: bytes.length,
      contentEncoding: source.contentEncoding,
      contentMediaType: source.contentMediaType,
      contentBindingContractRef: source.contentBindingContractRef,
      contentBindingContractRevision: source.contentBindingContractRevision,
      principalRef: principal ? principal.principalRef : null,
      principalNamespace: principal ? principal.principalNamespace : null,
      principalRevision: principal ? principal.principalRevision : null,
      principalResolutionState: identity.status,
      principalLifecycleState: principal ? principal.lifecycleState : "UNKNOWN",
      principalFreshnessState: principal ? principal.freshnessState : "UNKNOWN",
      channelRef: source.channelRef,
      channelRevision: source.channelRevision,
      sessionRef: source.sessionRef,
      sessionRevision: source.sessionRevision,
      occurredTemporalFrameRef: source.occurredTemporalFrameRef,
      receivedTemporalFrameRef: source.receivedTemporalFrameRef,
      interactionId: source.interactionId,
      contextRevision: source.contextRevision,
      routingRevision: routing.routingRevision,
      verificationMethodRef: method.verificationMethodRef,
      verificationMethodRevision: method.verificationMethodRevision,
      sourceTrustState: registry.trustState,
      verificationMethodTrustState: method.trustState,
      verificationFreshnessState: method.freshnessState === "UNKNOWN"
        || verification.freshnessState === "UNKNOWN" ? "UNKNOWN" : "CURRENT",
      originAuthenticationState: originState,
      contentIntegrityState: integrityState,
      interactionBindingState,
      contradictionState: verification.contradictionState,
      claimedActorRef: source.claimedActorRef,
      claimedActorRelation,
      presentationClass: source.presentationClass,
      attributedPrincipalRef: source.attributedPrincipalRef,
      attributionState,
      delegationState,
      priorContentEventRefs,
      evidenceRefs,
      authority: "NONE"
    };
    const bindingId = `human-source-binding:${sha256(Buffer.from(canonicalStringify(material), "utf8")).slice(7)}`;
    const binding = Object.freeze({ bindingId, ...material });

    let committed;
    try { committed = bindingLedger.commit(binding); }
    catch (_) { return result(OUTCOMES.IDENTITY_CONFLICT, "binding ledger commit conflict"); }
    if (!committed || committed.bindingId !== bindingId) {
      return result(OUTCOMES.IDENTITY_CONFLICT, "binding ledger returned conflicting identity");
    }
    return result(OUTCOMES.ACCEPTED, null, committed);
  }

  return Object.freeze({ accept });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  OUTCOMES,
  createAuthenticatedHumanSourceEventBinding
});
