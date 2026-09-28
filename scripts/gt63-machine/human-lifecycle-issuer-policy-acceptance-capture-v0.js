"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "human-lifecycle-issuer-policy-acceptance-capture-v0.1.0";
const AUTHORITY = "NONE";
const DECISION = "ACCEPT_LIFECYCLE_ISSUER_SCOPE_POLICY";
const SOURCE_STATUS = "UNCONFIGURED_FAIL_CLOSED";
const SOURCE_ISSUER_SET = "CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY";
const SUBJECT_KINDS = Object.freeze(["POLICY", "ASSIGNMENT", "DELEGATION"]);

function plain(v) { return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function nonEmpty(v) { return typeof v === "string" && v.length > 0; }
function exact(v, fields) {
  return plain(v) && Object.keys(v).length === fields.length
    && Object.keys(v).every((k) => fields.includes(k));
}
function compareCodePoints(a, b) {
  const x = Array.from(String(a)), y = Array.from(String(b));
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    const d = x[i].codePointAt(0) - y[i].codePointAt(0);
    if (d) return d;
  }
  return x.length - y.length;
}
function canonicalize(v) {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (plain(v)) return Object.keys(v).sort(compareCodePoints).reduce((o, raw) => {
    const k = raw.normalize("NFC");
    if (Object.prototype.hasOwnProperty.call(o, k)) throw new TypeError("canonical key conflict");
    o[k] = canonicalize(v[raw]); return o;
  }, {});
  return typeof v === "string" ? v.normalize("NFC") : v;
}
const canonicalStringify = (v) => JSON.stringify(canonicalize(v));
const sha256 = (v) => `sha256:${crypto.createHash("sha256").update(Buffer.from(String(v), "utf8")).digest("hex")}`;
const clone = (v) => v === null || v === undefined ? v : JSON.parse(JSON.stringify(v));
function deepFreeze(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v); Object.values(v).forEach(deepFreeze);
  }
  return v;
}
function same(a, b) { return canonicalStringify(a) === canonicalStringify(b); }
function validSession(s) {
  return exact(s, ["sessionRef","sessionRevision","authenticatedAccountRef","authenticationProviderRef",
    "authenticationEvidenceRef","authenticationState","freshnessState"])
    && ["sessionRef","sessionRevision","authenticatedAccountRef","authenticationProviderRef",
      "authenticationEvidenceRef"].every((k) => nonEmpty(s[k]))
    && s.authenticationState === "AUTHENTICATED" && s.freshnessState === "CURRENT";
}
function validPrincipal(p, session) {
  return plain(p)
    && nonEmpty(p.principalRef) && nonEmpty(p.principalRevision) && nonEmpty(p.principalEvidenceRef)
    && p.sessionRef === session.sessionRef && p.sessionRevision === session.sessionRevision
    && p.lifecycleState === "CURRENT" && p.freshnessState === "CURRENT"
    && p.contradictionState === "NONE" && p.authority === AUTHORITY;
}
function validSource(v) {
  return plain(v)
    && v.type === "REGISTERED_GOVERNANCE_SOURCE_VERIFICATION"
    && v.status === "VERIFIED"
    && nonEmpty(v.sourceVerificationId) && nonEmpty(v.rootVerificationId)
    && nonEmpty(v.registeredSourceRef) && nonEmpty(v.sourceBlobSha)
    && /^sha256:[0-9a-f]{64}$/.test(v.sourceBlobSha256)
    && Number.isInteger(v.sourcePolicyRevision) && v.sourcePolicyRevision > 0
    && v.sourceStatus === SOURCE_STATUS && v.issuerSetSemantics === SOURCE_ISSUER_SET
    && Array.isArray(v.permittedIssuerRefs) && v.permittedIssuerRefs.length === 0
    && Array.isArray(v.subjectKinds)
    && canonicalStringify(v.subjectKinds) === canonicalStringify(SUBJECT_KINDS)
    && v.authority === AUTHORITY;
}
function buildPayload(source, principal) {
  return deepFreeze({
    type: "GT63_LIFECYCLE_ISSUER_SCOPE_POLICY_ACCEPTANCE_DECISION",
    decision: DECISION,
    sourceVerificationId: source.sourceVerificationId,
    sourcePolicyRevision: source.sourcePolicyRevision,
    sourceBlobSha256: source.sourceBlobSha256,
    principalRef: principal.principalRef,
    principalRevision: principal.principalRevision,
    issuerScope: {
      POLICY: { issuerRef: principal.principalRef, issuerRevision: principal.principalRevision },
      ASSIGNMENT: { issuerRef: principal.principalRef, issuerRevision: principal.principalRevision },
      DELEGATION: "NOT_BOOTSTRAP_ISSUABLE"
    },
    machineAuthority: AUTHORITY
  });
}

function createHumanLifecycleIssuerPolicyAcceptanceCapture({
  clock = () => new Date().toISOString(),
  randomBytes = crypto.randomBytes,
  presentationLedger,
  decisionLedger
} = {}) {
  for (const [name, ledger] of Object.entries({ presentationLedger, decisionLedger })) {
    if (!ledger || typeof ledger.get !== "function" || typeof ledger.commit !== "function") {
      throw new TypeError(`${name} must expose get() and commit()`);
    }
  }

  function present({ session, principal, verifiedSource }) {
    if (!validSession(session)) throw new Error("current authenticated session required");
    if (!validPrincipal(principal, session)) throw new Error("current exact session-bound human principal required");
    if (!validSource(verifiedSource)) throw new Error("exact verified frozen issuer policy source required");
    const payload = buildPayload(verifiedSource, principal);
    const exactPayloadDigest = sha256(canonicalStringify(payload));
    const presentationId = `gt63-lifecycle-issuer-policy-presentation:${randomBytes(16).toString("hex")}`;
    const record = deepFreeze({
      type: "GT63_LIFECYCLE_ISSUER_SCOPE_POLICY_ACCEPTANCE_PRESENTATION",
      schemaVersion: "1.0", rulesetVersion: RULESET_VERSION, presentationId,
      sourceVerificationId: verifiedSource.sourceVerificationId,
      sourcePolicyRevision: verifiedSource.sourcePolicyRevision,
      sourceBlobSha256: verifiedSource.sourceBlobSha256,
      principalRef: principal.principalRef, principalRevision: principal.principalRevision,
      principalEvidenceRef: principal.principalEvidenceRef,
      sessionRef: session.sessionRef, sessionRevision: session.sessionRevision,
      authenticatedAccountRef: session.authenticatedAccountRef,
      authenticationProviderRef: session.authenticationProviderRef,
      authenticationEvidenceRef: session.authenticationEvidenceRef,
      exactPayloadDigest, exactPayload: payload, presentedAt: clock(), authority: AUTHORITY
    });
    presentationLedger.commit(presentationId, record);
    return record;
  }

  function decide({ session, principal, verifiedSource, presentationId, decision }) {
    if (!validSession(session)) throw new Error("current authenticated session required");
    if (!validPrincipal(principal, session)) throw new Error("current exact session-bound human principal required");
    if (!validSource(verifiedSource)) throw new Error("exact verified frozen issuer policy source required");
    if (!nonEmpty(presentationId)) throw new Error("presentationId required");
    if (decision !== DECISION) throw new Error("unsupported lifecycle issuer policy decision");
    const presentation = presentationLedger.get(presentationId);
    if (!presentation) throw new Error("presentation unavailable");
    const payload = buildPayload(verifiedSource, principal);
    const digest = sha256(canonicalStringify(payload));
    if (presentation.sourceVerificationId !== verifiedSource.sourceVerificationId
      || presentation.sourcePolicyRevision !== verifiedSource.sourcePolicyRevision
      || presentation.sourceBlobSha256 !== verifiedSource.sourceBlobSha256
      || presentation.principalRef !== principal.principalRef
      || presentation.principalRevision !== principal.principalRevision
      || presentation.principalEvidenceRef !== principal.principalEvidenceRef
      || presentation.sessionRef !== session.sessionRef
      || presentation.sessionRevision !== session.sessionRevision
      || presentation.authenticatedAccountRef !== session.authenticatedAccountRef
      || presentation.authenticationProviderRef !== session.authenticationProviderRef
      || presentation.authenticationEvidenceRef !== session.authenticationEvidenceRef
      || presentation.exactPayloadDigest !== digest
      || !same(presentation.exactPayload, payload)) {
      throw new Error("decision context does not match exact presentation");
    }
    const identityMaterial = {
      presentationId, exactPayloadDigest: digest, principalEvidenceRef: principal.principalEvidenceRef
    };
    const bootstrapDecisionEvidenceRef = `gt63-evidence:lifecycle-issuer-policy-decision:${sha256(canonicalStringify(identityMaterial)).slice(7)}`;
    const record = deepFreeze({
      bootstrapDecisionEvidenceRef, decision: DECISION,
      principalRef: principal.principalRef, principalRevision: principal.principalRevision,
      sourceVerificationId: verifiedSource.sourceVerificationId,
      sourcePolicyRevision: verifiedSource.sourcePolicyRevision,
      sourceBlobSha256: verifiedSource.sourceBlobSha256,
      lifecycleState: "CURRENT", freshnessState: "CURRENT",
      contradictionState: "NONE", authority: AUTHORITY
    });
    const prior = decisionLedger.get(bootstrapDecisionEvidenceRef);
    if (prior !== null && prior !== undefined) {
      if (!same(prior, record)) throw new Error("bootstrap decision evidence conflict");
      return prior;
    }
    const committed = decisionLedger.commit(bootstrapDecisionEvidenceRef, record);
    if (!committed || !same(committed, record)) throw new Error("bootstrap decision ledger conflict");
    return committed;
  }

  return Object.freeze({ present, decide, authority: AUTHORITY, rulesetVersion: RULESET_VERSION });
}

function projectAuthenticatedHumanPrincipal(identity) {
  if (!plain(identity) || identity.type !== "GT63_EXTERNAL_AUTHENTICATED_IDENTITY_BINDING"
    || !nonEmpty(identity.principalRef) || !nonEmpty(identity.principalRevision)
    || !nonEmpty(identity.principalEvidenceRef)
    || identity.lifecycleState !== "CURRENT" || identity.freshnessState !== "CURRENT"
    || identity.contradictionState !== "NONE" || identity.authority !== AUTHORITY) return null;
  return deepFreeze({
    principalRef: identity.principalRef, principalRevision: identity.principalRevision,
    principalEvidenceRef: identity.principalEvidenceRef, lifecycleState: identity.lifecycleState,
    freshnessState: identity.freshnessState, contradictionState: identity.contradictionState,
    authority: AUTHORITY
  });
}

function createMemoryLedger() {
  const m = new Map();
  return Object.freeze({
    get(k) { return m.has(k) ? m.get(k) : null; },
    commit(k, v) {
      if (m.has(k)) throw new Error("immutable-ledger-conflict");
      m.set(k, deepFreeze(clone(v))); return m.get(k);
    }
  });
}

module.exports = Object.freeze({
  RULESET_VERSION, AUTHORITY, DECISION, buildPayload,
  createHumanLifecycleIssuerPolicyAcceptanceCapture,
  projectAuthenticatedHumanPrincipal, createMemoryLedger
});
