"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "human-governance-approval-surface-v0.1.0";
const AUTHORITY = "NONE";
const DECISIONS = new Set(["APPROVE", "REJECT"]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function randomRef(prefix) {
  return `${prefix}:${crypto.randomBytes(16).toString("hex")}`;
}

function canonicalPayloadBytes(payloadText) {
  if (!nonEmpty(payloadText)) throw new Error("approval payload bytes required");
  const bytes = Buffer.from(payloadText, "utf8");
  JSON.parse(bytes.toString("utf8"));
  return bytes;
}

function requireSession(session) {
  if (!session || typeof session !== "object") throw new Error("authenticated session required");
  for (const field of ["sessionRef", "sessionRevision", "authenticatedAccountRef", "authenticationProviderRef", "authenticationEvidenceRef"]) {
    if (!nonEmpty(session[field])) throw new Error(`authenticated session missing ${field}`);
  }
  if (session.authenticationState !== "AUTHENTICATED") throw new Error("session not authenticated");
  if (session.freshnessState !== "CURRENT") throw new Error("session not current");
  return session;
}

function requireGate(gate) {
  if (!gate || typeof gate !== "object") throw new Error("gate required");
  for (const field of ["gateId", "gateRevision", "repositoryIdentity", "targetPath", "beforeStateId", "afterStateId", "approvalPayloadText"]) {
    if (!nonEmpty(gate[field])) throw new Error(`gate missing ${field}`);
  }
  return gate;
}

function createHumanGovernanceApprovalSurface({
  clock = () => new Date().toISOString(),
  presentationLedger,
  sourceEventLedger
}) {
  for (const [name, ledger] of Object.entries({ presentationLedger, sourceEventLedger })) {
    if (!ledger || typeof ledger.get !== "function" || typeof ledger.commit !== "function") {
      throw new TypeError(`${name} must expose get() and commit()`);
    }
  }

  function present({ session, gate }) {
    const s = requireSession(session);
    const g = requireGate(gate);
    const bytes = canonicalPayloadBytes(g.approvalPayloadText);
    const presentation = deepFreeze({
      type: "GT63_GOVERNANCE_APPROVAL_PRESENTATION",
      schemaVersion: "1.0",
      rulesetVersion: RULESET_VERSION,
      presentationId: randomRef("gt63-presentation"),
      gateId: g.gateId,
      gateRevision: g.gateRevision,
      repositoryIdentity: g.repositoryIdentity,
      targetPath: g.targetPath,
      beforeStateId: g.beforeStateId,
      afterStateId: g.afterStateId,
      exactPayloadDigest: sha256(bytes),
      exactPayloadByteLength: bytes.length,
      exactPayloadBytesBase64: bytes.toString("base64"),
      sessionRef: s.sessionRef,
      sessionRevision: s.sessionRevision,
      authenticatedAccountRef: s.authenticatedAccountRef,
      authenticationProviderRef: s.authenticationProviderRef,
      authenticationEvidenceRef: s.authenticationEvidenceRef,
      presentedAt: clock(),
      authority: AUTHORITY
    });
    presentationLedger.commit(presentation.presentationId, presentation);
    return presentation;
  }

  function decide({ session, presentationId, decision }) {
    const s = requireSession(session);
    if (!nonEmpty(presentationId)) throw new Error("presentationId required");
    if (!DECISIONS.has(decision)) throw new Error("unsupported decision");
    const presentation = presentationLedger.get(presentationId);
    if (!presentation) throw new Error("presentation not found");
    if (presentation.sessionRef !== s.sessionRef
      || presentation.sessionRevision !== s.sessionRevision
      || presentation.authenticatedAccountRef !== s.authenticatedAccountRef
      || presentation.authenticationProviderRef !== s.authenticationProviderRef
      || presentation.authenticationEvidenceRef !== s.authenticationEvidenceRef) {
      throw new Error("decision session does not match presentation session");
    }

    const sourceEventRef = randomRef("gt63-human-source-event");
    const sourceEvent = deepFreeze({
      type: "HUMAN_SOURCE_EVENT",
      sourceEventRef,
      sourceEventRevision: "1",
      sourceProviderRef: "gt63-machine:human-governance-approval-surface-v0",
      sourceProviderRevision: "1",
      providerEventId: randomRef("gt63-provider-event"),
      contentBytesBase64: presentation.exactPayloadBytesBase64,
      contentEncoding: "utf8",
      contentMediaType: "application/json",
      contentBindingContractRef: "gt63-machine:content-binding:exact-presented-approval-bytes-v0",
      contentBindingContractRevision: "1",
      channelRef: "gt63-machine:channel:human-governance-approval-v0",
      channelRevision: "1",
      sessionRef: s.sessionRef,
      sessionRevision: s.sessionRevision,
      occurredTemporalFrameRef: `time:${clock()}`,
      receivedTemporalFrameRef: `time:${clock()}`,
      interactionId: presentation.presentationId,
      contextRevision: presentation.gateRevision,
      claimedActorRef: s.authenticatedAccountRef,
      presentationClass: "DIRECT",
      attributedPrincipalRef: null,
      sourceEventEvidenceRef: randomRef("gt63-evidence:human-source-event")
    });

    sourceEventLedger.commit(sourceEvent.sourceEventRef, sourceEvent);
    return sourceEvent;
  }

  return Object.freeze({ present, decide });
}

function createMemoryLedger() {
  const records = new Map();
  return Object.freeze({
    get(key) { return records.has(key) ? records.get(key) : null; },
    commit(key, value) {
      if (records.has(key)) throw new Error("immutable-ledger-conflict");
      records.set(key, deepFreeze(clone(value)));
      return records.get(key);
    },
    records() { return Object.freeze(Array.from(records.values())); }
  });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  AUTHORITY,
  createHumanGovernanceApprovalSurface,
  createMemoryLedger
});
