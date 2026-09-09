"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "human-governance-trust-decision-presentation-capture-v0.1.0";
const AUTHORITY = "NONE";
const EXPECTED_REGISTRATION_REF = "gt63-machine:trust-registration:human-governance-approval-surface-v0";
const EXPECTED_REGISTRATION_REVISION = "1";
const EXPECTED_PRINCIPAL_REF = "gt63-machine:principal:github:239696056";
const SOURCE_PROVIDER_REF = "gt63-machine:human-governance-approval-surface-v0";
const SOURCE_PROVIDER_REVISION = "1";
const VERIFICATION_METHOD_REF = "gt63-machine:verification-method:approval-surface-session-continuity-v0";
const VERIFICATION_METHOD_REVISION = "1";

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
function nonEmpty(value) { return typeof value === "string" && value.length > 0; }
function sha256(bytes) { return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`; }
function randomRef(prefix) { return `${prefix}:${crypto.randomBytes(16).toString("hex")}`; }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.keys(value).sort().reduce((o, k) => { o[k] = canonicalize(value[k]); return o; }, {});
  return value;
}
function canonicalStringify(value) { return JSON.stringify(canonicalize(value)); }

function requireSession(session) {
  if (!session || typeof session !== "object") throw new Error("authenticated session required");
  for (const field of ["sessionRef", "sessionRevision", "authenticatedAccountRef", "authenticationProviderRef", "authenticationEvidenceRef"]) {
    if (!nonEmpty(session[field])) throw new Error(`authenticated session missing ${field}`);
  }
  if (session.authenticationState !== "AUTHENTICATED") throw new Error("session not authenticated");
  if (session.freshnessState !== "CURRENT") throw new Error("session not current");
  return session;
}

function requirePrincipal(principal, session) {
  if (!principal || typeof principal !== "object") throw new Error("verified principal required");
  if (principal.principalRef !== EXPECTED_PRINCIPAL_REF
    || principal.principalRevision !== "1"
    || principal.sessionRef !== session.sessionRef
    || principal.sessionRevision !== session.sessionRevision
    || principal.lifecycleState !== "CURRENT"
    || principal.freshnessState !== "CURRENT"
    || principal.contradictionState !== "NONE"
    || !nonEmpty(principal.principalEvidenceRef)
    || principal.authority !== "NONE") {
    throw new Error("principal not exact/current/session-bound");
  }
  return principal;
}

function buildDecisionPayload() {
  return {
    type: "GT63_GOVERNANCE_APPROVAL_TRUST_DECISION",
    registrationRef: EXPECTED_REGISTRATION_REF,
    registrationRevision: EXPECTED_REGISTRATION_REVISION,
    sourceProviderRef: SOURCE_PROVIDER_REF,
    sourceProviderRevision: SOURCE_PROVIDER_REVISION,
    sourceTrustState: "TRUSTED",
    verificationMethodRef: VERIFICATION_METHOD_REF,
    verificationMethodRevision: VERIFICATION_METHOD_REVISION,
    verificationMethodTrustState: "TRUSTED",
    decision: "APPROVE_TRUST_REGISTRATION"
  };
}

function createHumanGovernanceTrustDecisionPresentationCapture({
  clock = () => new Date().toISOString(),
  presentationLedger,
  decisionLedger
} = {}) {
  for (const [name, ledger] of Object.entries({ presentationLedger, decisionLedger })) {
    if (!ledger || typeof ledger.get !== "function" || typeof ledger.commit !== "function") throw new TypeError(`${name} must expose get() and commit()`);
  }

  function present({ session, principal }) {
    const s = requireSession(session);
    const p = requirePrincipal(principal, s);
    const payload = buildDecisionPayload();
    const bytes = Buffer.from(canonicalStringify(payload), "utf8");
    const presentation = deepFreeze({
      type: "GT63_GOVERNANCE_APPROVAL_TRUST_DECISION_PRESENTATION",
      schemaVersion: "1.0",
      rulesetVersion: RULESET_VERSION,
      presentationId: randomRef("gt63-trust-decision-presentation"),
      registrationRef: EXPECTED_REGISTRATION_REF,
      registrationRevision: EXPECTED_REGISTRATION_REVISION,
      exactPayloadDigest: sha256(bytes),
      exactPayloadByteLength: bytes.length,
      exactPayloadBytesBase64: bytes.toString("base64"),
      principalRef: p.principalRef,
      principalRevision: p.principalRevision,
      principalEvidenceRef: p.principalEvidenceRef,
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

  function decide({ session, principal, presentationId, decision }) {
    const s = requireSession(session);
    const p = requirePrincipal(principal, s);
    if (!nonEmpty(presentationId)) throw new Error("presentationId required");
    if (decision !== "APPROVE_TRUST_REGISTRATION" && decision !== "REJECT_TRUST_REGISTRATION") throw new Error("unsupported trust decision");
    const presentation = presentationLedger.get(presentationId);
    if (!presentation) throw new Error("presentation not found");
    if (presentation.sessionRef !== s.sessionRef
      || presentation.sessionRevision !== s.sessionRevision
      || presentation.principalRef !== p.principalRef
      || presentation.principalRevision !== p.principalRevision
      || presentation.principalEvidenceRef !== p.principalEvidenceRef
      || presentation.authenticatedAccountRef !== s.authenticatedAccountRef
      || presentation.authenticationProviderRef !== s.authenticationProviderRef
      || presentation.authenticationEvidenceRef !== s.authenticationEvidenceRef) {
      throw new Error("decision context does not match presentation context");
    }
    const payload = JSON.parse(Buffer.from(presentation.exactPayloadBytesBase64, "base64").toString("utf8"));
    if (payload.decision !== "APPROVE_TRUST_REGISTRATION") throw new Error("presented payload is not trust approval");
    if (decision !== payload.decision) throw new Error("decision does not match exact presented payload");

    const decisionEvidenceRef = randomRef("gt63-evidence:trust-decision");
    const record = deepFreeze({
      ...payload,
      principalRef: p.principalRef,
      principalResolutionState: "RESOLVED",
      sessionRef: s.sessionRef,
      sessionRevision: s.sessionRevision,
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      decisionEvidenceRef,
      principalEvidenceRef: p.principalEvidenceRef,
      presentationId: presentation.presentationId,
      exactPayloadDigest: presentation.exactPayloadDigest,
      decidedAt: clock(),
      authority: AUTHORITY
    });
    decisionLedger.commit(decisionEvidenceRef, record);
    return record;
  }

  return Object.freeze({ present, decide, authority: AUTHORITY, rulesetVersion: RULESET_VERSION });
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
  EXPECTED_REGISTRATION_REF,
  EXPECTED_REGISTRATION_REVISION,
  EXPECTED_PRINCIPAL_REF,
  buildDecisionPayload,
  createHumanGovernanceTrustDecisionPresentationCapture,
  createMemoryLedger
});
