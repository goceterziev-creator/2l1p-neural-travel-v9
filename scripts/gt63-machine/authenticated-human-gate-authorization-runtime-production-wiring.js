"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "authenticated-human-gate-authorization-runtime-production-wiring-v0.1.0";
const AUTHORITY = "NONE";
const GOVERNANCE_ACT = "GATE_AUTHORIZATION";
const GOVERNANCE_PRINCIPAL_REF = "gt63-machine:human-principal:goce-v0";
const GOVERNANCE_PRINCIPAL_REVISION = "1";
const DOWNSTREAM_RULESET_VERSION = "authenticated-human-gate-authorization-evidence-v0.1.0";
const OUTCOMES = Object.freeze({
  PRESENTED: "HUMAN_GATE_AUTHORIZATION_PRESENTED",
  RESOLVED: "HUMAN_GATE_AUTHORIZATION_RUNTIME_EVIDENCE_RESOLVED",
  NOT_AUTHORIZED: "HUMAN_GATE_AUTHORIZATION_RUNTIME_NOT_AUTHORIZED",
  UNKNOWN: "HUMAN_GATE_AUTHORIZATION_RUNTIME_UNKNOWN",
  INVALID: "HUMAN_GATE_AUTHORIZATION_RUNTIME_INVALID"
});
const DECISIONS = new Set(["APPROVE", "DENY", "NON_AUTHORIZATION"]);

function plain(v) { return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function nonEmpty(v) { return typeof v === "string" && v.length > 0; }
function freeze(v) { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(freeze); } return v; }
function canonicalize(v) { if (Array.isArray(v)) return v.map(canonicalize); if (plain(v)) return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonicalize(v[k]),o),{}); return typeof v === "string" ? v.normalize("NFC") : v; }
function canonicalStringify(v) { return JSON.stringify(canonicalize(v)); }
function sha256Bytes(bytes) { return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`; }
function digest(v) { return sha256Bytes(Buffer.from(canonicalStringify(v), "utf8")); }
function exact(record, fields) { return plain(record) && Object.keys(record).length === fields.length && Object.keys(record).every(k => fields.includes(k)); }

function validScope(s) {
  const fields = ["scopeType","interactionId","fromInteractionRevision","throughInteractionRevision","gateId","gateRevision","authorityScopeDigest","continuationTargetRef"];
  return exact(s, fields)
    && s.scopeType === "GATE"
    && nonEmpty(s.interactionId)
    && Number.isInteger(s.fromInteractionRevision) && s.fromInteractionRevision >= 0
    && (s.throughInteractionRevision === null || (Number.isInteger(s.throughInteractionRevision) && s.throughInteractionRevision >= s.fromInteractionRevision))
    && nonEmpty(s.gateId)
    && Number.isInteger(s.gateRevision) && s.gateRevision > 0
    && /^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest)
    && nonEmpty(s.continuationTargetRef);
}

function result(outcome, reason, value = null) {
  return freeze({
    outcome,
    reason: reason || null,
    value: clone(value),
    authority: AUTHORITY,
    humanGateSatisfied: false,
    continuationAuthorityCreated: false,
    executionAuthorityCreated: false,
    effectAuthorized: false
  });
}

function validGovernanceBinding(g) {
  return plain(g)
    && g.type === "GT63_GOVERNANCE_PRINCIPAL_IDENTITY_BINDING_EVIDENCE"
    && g.governancePrincipalRef === GOVERNANCE_PRINCIPAL_REF
    && g.governancePrincipalRevision === GOVERNANCE_PRINCIPAL_REVISION
    && nonEmpty(g.principalEvidenceRef)
    && nonEmpty(g.externalPrincipalRef)
    && nonEmpty(g.externalPrincipalRevision)
    && nonEmpty(g.externalPrincipalEvidenceRef)
    && g.lifecycleState === "CURRENT"
    && g.freshnessState === "CURRENT"
    && g.contradictionState === "NONE"
    && g.authority === AUTHORITY;
}

function validAcceptedSourceBinding(b) {
  return plain(b)
    && b.type === "AUTHENTICATED_HUMAN_SOURCE_EVENT_BINDING"
    && nonEmpty(b.bindingId)
    && nonEmpty(b.sourceEventRef)
    && nonEmpty(b.sourceEventRevision)
    && /^sha256:[0-9a-f]{64}$/.test(b.contentDigest)
    && nonEmpty(b.principalRef)
    && nonEmpty(b.principalRevision)
    && b.principalResolutionState === "RESOLVED"
    && b.principalLifecycleState === "CURRENT"
    && b.principalFreshnessState === "CURRENT"
    && b.originAuthenticationState === "AUTHENTICATED"
    && b.contentIntegrityState === "EXACT_BYTES"
    && b.interactionBindingState === "BOUND"
    && b.contradictionState === "NONE"
    && b.authority === AUTHORITY;
}

function decodeExactJsonSource(source, binding) {
  if (!plain(source)
    || source.type !== "HUMAN_SOURCE_EVENT"
    || source.sourceEventRef !== binding.sourceEventRef
    || source.sourceEventRevision !== binding.sourceEventRevision
    || !nonEmpty(source.contentBytesBase64)) return null;
  let bytes;
  try { bytes = Buffer.from(source.contentBytesBase64, "base64"); }
  catch (_) { return null; }
  if (bytes.toString("base64") !== source.contentBytesBase64 || sha256Bytes(bytes) !== binding.contentDigest) return null;
  try { return { bytes, payload: JSON.parse(bytes.toString("utf8")) }; }
  catch (_) { return null; }
}

function createAuthenticatedHumanGateAuthorizationRuntimeProductionWiring({
  governancePrincipalBindingPort,
  authenticatedSourceBindingPort,
  sourceEventSnapshotPort,
  presentationLedger,
  decisionLedger,
  authorizationEvidenceConsumer
} = {}) {
  for (const [name, port] of Object.entries({ governancePrincipalBindingPort, authenticatedSourceBindingPort, sourceEventSnapshotPort })) {
    if (typeof port !== "function") throw new TypeError(`${name} must be a function`);
  }
  for (const [name, ledger] of Object.entries({ presentationLedger, decisionLedger })) {
    if (!ledger || typeof ledger.get !== "function" || typeof ledger.commit !== "function") throw new TypeError(`${name} must expose get() and commit()`);
  }
  if (!authorizationEvidenceConsumer || typeof authorizationEvidenceConsumer.assess !== "function") {
    throw new TypeError("authorizationEvidenceConsumer.assess must be a function");
  }

  function present(request) {
    const fields = ["rulesetVersion","authorizationSubjectRef","authorizationSubjectRevision","principalRef","principalRevision","governanceAct","contextScope"];
    if (!exact(request, fields)
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.authorizationSubjectRef)
      || !nonEmpty(request.authorizationSubjectRevision)
      || request.principalRef !== GOVERNANCE_PRINCIPAL_REF
      || request.principalRevision !== GOVERNANCE_PRINCIPAL_REVISION
      || request.governanceAct !== GOVERNANCE_ACT
      || !validScope(request.contextScope)) return result(OUTCOMES.INVALID, "unsupported presentation request");

    let binding;
    try { binding = governancePrincipalBindingPort({ principalRef: request.principalRef, principalRevision: request.principalRevision, contextScope: clone(request.contextScope) }); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "governance principal binding unavailable"); }
    if (!validGovernanceBinding(binding)) return result(OUTCOMES.UNKNOWN, "governance principal binding invalid or non-current");

    const semantic = canonicalize({
      authorizationSubjectRef: request.authorizationSubjectRef,
      authorizationSubjectRevision: request.authorizationSubjectRevision,
      principalRef: request.principalRef,
      principalRevision: request.principalRevision,
      governanceAct: GOVERNANCE_ACT,
      contextScope: request.contextScope
    });
    const exactSemanticDigest = digest(semantic);
    const presentationRef = `gt63-human-gate-authorization-presentation:${exactSemanticDigest.slice(7)}`;
    const presentation = freeze({
      type: "GT63_HUMAN_GATE_AUTHORIZATION_PRESENTATION",
      presentationRef,
      presentationRevision: "1",
      authorizationSubjectRef: request.authorizationSubjectRef,
      authorizationSubjectRevision: request.authorizationSubjectRevision,
      principalRef: request.principalRef,
      principalRevision: request.principalRevision,
      governanceAct: GOVERNANCE_ACT,
      contextScope: canonicalize(request.contextScope),
      exactSemanticDigest,
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      authority: AUTHORITY
    });
    let prior;
    try { prior = presentationLedger.get(presentationRef); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "presentation ledger unavailable"); }
    if (prior) return canonicalStringify(prior) === canonicalStringify(presentation)
      ? result(OUTCOMES.PRESENTED, null, prior)
      : result(OUTCOMES.UNKNOWN, "presentation identity conflict");
    try { presentationLedger.commit(presentationRef, presentation); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "presentation ledger commit conflict"); }
    return result(OUTCOMES.PRESENTED, null, presentation);
  }

  function consume(request) {
    const fields = ["rulesetVersion","presentationRef","presentationRevision","sourceEventRef","sourceEventRevision"];
    if (!exact(request, fields)
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.presentationRef)
      || !nonEmpty(request.presentationRevision)
      || !nonEmpty(request.sourceEventRef)
      || !nonEmpty(request.sourceEventRevision)) return result(OUTCOMES.INVALID, "unsupported consumption request");

    let presentation;
    try { presentation = presentationLedger.get(request.presentationRef); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "presentation ledger unavailable"); }
    if (!plain(presentation)
      || presentation.type !== "GT63_HUMAN_GATE_AUTHORIZATION_PRESENTATION"
      || presentation.presentationRef !== request.presentationRef
      || presentation.presentationRevision !== request.presentationRevision
      || presentation.principalRef !== GOVERNANCE_PRINCIPAL_REF
      || presentation.principalRevision !== GOVERNANCE_PRINCIPAL_REVISION
      || presentation.governanceAct !== GOVERNANCE_ACT
      || !validScope(presentation.contextScope)
      || presentation.lifecycleState !== "CURRENT"
      || presentation.freshnessState !== "CURRENT"
      || presentation.contradictionState !== "NONE"
      || presentation.authority !== AUTHORITY) return result(OUTCOMES.UNKNOWN, "presentation invalid or non-current");

    let governanceBinding;
    try { governanceBinding = governancePrincipalBindingPort({ principalRef: presentation.principalRef, principalRevision: presentation.principalRevision, contextScope: clone(presentation.contextScope) }); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "governance principal binding unavailable"); }
    if (!validGovernanceBinding(governanceBinding)) return result(OUTCOMES.UNKNOWN, "governance principal binding invalid or non-current");

    let sourceBinding;
    try { sourceBinding = authenticatedSourceBindingPort({ sourceEventRef: request.sourceEventRef, sourceEventRevision: request.sourceEventRevision }); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "authenticated human source binding unavailable"); }
    if (!validAcceptedSourceBinding(sourceBinding)) return result(OUTCOMES.UNKNOWN, "human source event is not exact authenticated accepted evidence");
    if (sourceBinding.sourceEventRef !== request.sourceEventRef || sourceBinding.sourceEventRevision !== request.sourceEventRevision) return result(OUTCOMES.NOT_AUTHORIZED, "source-event identity mismatch");
    if (sourceBinding.principalRef !== governanceBinding.externalPrincipalRef || sourceBinding.principalRevision !== governanceBinding.externalPrincipalRevision) {
      return result(OUTCOMES.NOT_AUTHORIZED, "authenticated application principal is not the exact external principal bound to governance principal");
    }
    if (sourceBinding.interactionId !== presentation.contextScope.interactionId) return result(OUTCOMES.NOT_AUTHORIZED, "source event interaction does not match gate scope");

    let source;
    try { source = sourceEventSnapshotPort({ sourceEventRef: request.sourceEventRef }); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "source event snapshot unavailable"); }
    const decoded = decodeExactJsonSource(source, sourceBinding);
    if (!decoded) return result(OUTCOMES.UNKNOWN, "source event bytes unavailable, malformed, or not bound to accepted digest");
    const p = decoded.payload;
    const decisionFields = ["type","presentationRef","presentationRevision","exactSemanticDigest","decision"];
    if (!exact(p, decisionFields)
      || p.type !== "GT63_HUMAN_GATE_AUTHORIZATION_DECISION_INPUT"
      || p.presentationRef !== presentation.presentationRef
      || p.presentationRevision !== presentation.presentationRevision
      || p.exactSemanticDigest !== presentation.exactSemanticDigest
      || !DECISIONS.has(p.decision)) return result(OUTCOMES.NOT_AUTHORIZED, "authenticated human decision bytes do not match exact presentation semantics");

    const decisionEvidenceRef = `gt63-evidence:human-gate-authorization-decision:${sourceBinding.bindingId}`;
    const decision = freeze({
      type: "GT63_HUMAN_GATE_AUTHORIZATION_DECISION",
      presentationRef: presentation.presentationRef,
      presentationRevision: presentation.presentationRevision,
      principalRef: presentation.principalRef,
      principalRevision: presentation.principalRevision,
      authorizationSubjectRef: presentation.authorizationSubjectRef,
      authorizationSubjectRevision: presentation.authorizationSubjectRevision,
      governanceAct: GOVERNANCE_ACT,
      contextScope: canonicalize(presentation.contextScope),
      decision: p.decision,
      exactSemanticDigest: presentation.exactSemanticDigest,
      decisionEvidenceRef,
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      authority: AUTHORITY
    });
    let priorDecision;
    try { priorDecision = decisionLedger.get(presentation.presentationRef); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "decision ledger unavailable"); }
    if (priorDecision && canonicalStringify(priorDecision) !== canonicalStringify(decision)) return result(OUTCOMES.UNKNOWN, "decision identity conflict");
    if (!priorDecision) {
      try { decisionLedger.commit(presentation.presentationRef, decision); }
      catch (_) { return result(OUTCOMES.UNKNOWN, "decision ledger commit conflict"); }
    }

    let downstream;
    try {
      downstream = authorizationEvidenceConsumer.assess({
        rulesetVersion: DOWNSTREAM_RULESET_VERSION,
        presentationRef: presentation.presentationRef,
        presentationRevision: presentation.presentationRevision,
        authorizationSubjectRef: presentation.authorizationSubjectRef,
        authorizationSubjectRevision: presentation.authorizationSubjectRevision,
        principalRef: presentation.principalRef,
        principalRevision: presentation.principalRevision,
        governanceAct: GOVERNANCE_ACT,
        contextScope: clone(presentation.contextScope)
      });
    } catch (_) { return result(OUTCOMES.UNKNOWN, "authenticated authorization evidence consumer unavailable"); }
    if (!plain(downstream) || downstream.authority !== AUTHORITY) return result(OUTCOMES.UNKNOWN, "downstream authorization evidence result invalid");
    if (downstream.outcome === "AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_NOT_AUTHORIZED") return result(OUTCOMES.NOT_AUTHORIZED, downstream.reason || "human decision not authorized", downstream);
    if (downstream.outcome !== "AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED" || !plain(downstream.evidence)) {
      return result(OUTCOMES.UNKNOWN, downstream.reason || "authenticated authorization evidence unresolved", downstream);
    }
    return result(OUTCOMES.RESOLVED, null, downstream.evidence);
  }

  return Object.freeze({ present, consume, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
}

function createMemoryLedger() {
  const records = new Map();
  return Object.freeze({
    get(key) { return records.has(key) ? records.get(key) : null; },
    commit(key, value) { if (records.has(key)) throw new Error("immutable-ledger-conflict"); records.set(key, freeze(clone(value))); return records.get(key); },
    records() { return Object.freeze(Array.from(records.values())); }
  });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  AUTHORITY,
  GOVERNANCE_ACT,
  GOVERNANCE_PRINCIPAL_REF,
  GOVERNANCE_PRINCIPAL_REVISION,
  OUTCOMES,
  createAuthenticatedHumanGateAuthorizationRuntimeProductionWiring,
  createMemoryLedger
});
