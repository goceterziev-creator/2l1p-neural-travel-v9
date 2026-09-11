"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "authenticated-human-gate-authorization-evidence-v0.1.0";
const AUTHORITY = "NONE";
const GOVERNANCE_ACT = "GATE_AUTHORIZATION";
const GOVERNANCE_PRINCIPAL_REF = "gt63-machine:human-principal:goce-v0";
const GOVERNANCE_PRINCIPAL_REVISION = "1";
const OUTCOMES = Object.freeze({
  RESOLVED: "AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED",
  NOT_AUTHORIZED: "AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_NOT_AUTHORIZED",
  UNKNOWN: "AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_UNKNOWN",
  INVALID: "AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_INVALID"
});
const DECISIONS = new Set(["APPROVE", "DENY", "NON_AUTHORIZATION"]);

function plain(v) { return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function nonEmpty(v) { return typeof v === "string" && v.length > 0; }
function freeze(v) { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(freeze); } return v; }
function canonicalize(v) { if (Array.isArray(v)) return v.map(canonicalize); if (plain(v)) return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonicalize(v[k]),o),{}); return typeof v === "string" ? v.normalize("NFC") : v; }
function canonicalStringify(v) { return JSON.stringify(canonicalize(v)); }
function digest(v) { return `sha256:${crypto.createHash("sha256").update(Buffer.from(canonicalStringify(v), "utf8")).digest("hex")}`; }
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

function result(outcome, reason, evidence = null) {
  return freeze({
    outcome,
    reason: reason || null,
    evidence: clone(evidence),
    authority: AUTHORITY,
    humanGateSatisfied: false,
    continuationAuthorityCreated: false,
    executionAuthorityCreated: false,
    effectAuthorized: false
  });
}

function createAuthenticatedHumanGateAuthorizationEvidence({
  governancePrincipalPort,
  presentationPort,
  decisionPort
} = {}) {
  for (const [name, port] of Object.entries({ governancePrincipalPort, presentationPort, decisionPort })) {
    if (typeof port !== "function") throw new TypeError(`${name} must be a function`);
  }

  function assess(request) {
    const fields = ["rulesetVersion","presentationRef","presentationRevision","authorizationSubjectRef","authorizationSubjectRevision","principalRef","principalRevision","governanceAct","contextScope"];
    if (!exact(request, fields)
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.presentationRef)
      || !nonEmpty(request.presentationRevision)
      || !nonEmpty(request.authorizationSubjectRef)
      || !nonEmpty(request.authorizationSubjectRevision)
      || request.principalRef !== GOVERNANCE_PRINCIPAL_REF
      || request.principalRevision !== GOVERNANCE_PRINCIPAL_REVISION
      || request.governanceAct !== GOVERNANCE_ACT
      || !validScope(request.contextScope)) {
      return result(OUTCOMES.INVALID, "unsupported request schema, principal, act, or scope");
    }

    let principal;
    try { principal = governancePrincipalPort({ principalRef: request.principalRef, principalRevision: request.principalRevision, contextScope: clone(request.contextScope) }); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "governance principal evidence unavailable"); }
    if (!plain(principal)
      || principal.principalRef !== request.principalRef
      || principal.principalRevision !== request.principalRevision
      || !nonEmpty(principal.principalEvidenceRef)
      || principal.lifecycleState !== "CURRENT"
      || principal.freshnessState !== "CURRENT"
      || principal.contradictionState !== "NONE"
      || principal.authority !== AUTHORITY) {
      return result(OUTCOMES.UNKNOWN, "governance principal evidence invalid or non-current");
    }

    let presentation;
    try { presentation = presentationPort({ presentationRef: request.presentationRef, presentationRevision: request.presentationRevision }); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "gate authorization presentation unavailable"); }
    if (!plain(presentation)
      || presentation.type !== "GT63_HUMAN_GATE_AUTHORIZATION_PRESENTATION"
      || presentation.presentationRef !== request.presentationRef
      || presentation.presentationRevision !== request.presentationRevision
      || presentation.authorizationSubjectRef !== request.authorizationSubjectRef
      || presentation.authorizationSubjectRevision !== request.authorizationSubjectRevision
      || presentation.principalRef !== request.principalRef
      || presentation.principalRevision !== request.principalRevision
      || presentation.governanceAct !== request.governanceAct
      || !validScope(presentation.contextScope)
      || canonicalStringify(presentation.contextScope) !== canonicalStringify(request.contextScope)
      || !/^sha256:[0-9a-f]{64}$/.test(presentation.exactSemanticDigest)
      || presentation.lifecycleState !== "CURRENT"
      || presentation.freshnessState !== "CURRENT"
      || presentation.contradictionState !== "NONE"
      || presentation.authority !== AUTHORITY) {
      return result(OUTCOMES.UNKNOWN, "gate authorization presentation invalid, mismatched, or non-current");
    }

    let decision;
    try { decision = decisionPort({ presentationRef: request.presentationRef, presentationRevision: request.presentationRevision }); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "human authorization decision unavailable"); }
    if (!plain(decision)
      || decision.type !== "GT63_HUMAN_GATE_AUTHORIZATION_DECISION"
      || decision.presentationRef !== request.presentationRef
      || decision.presentationRevision !== request.presentationRevision
      || decision.principalRef !== request.principalRef
      || decision.principalRevision !== request.principalRevision
      || decision.authorizationSubjectRef !== request.authorizationSubjectRef
      || decision.authorizationSubjectRevision !== request.authorizationSubjectRevision
      || decision.governanceAct !== request.governanceAct
      || !validScope(decision.contextScope)
      || canonicalStringify(decision.contextScope) !== canonicalStringify(request.contextScope)
      || !DECISIONS.has(decision.decision)
      || decision.exactSemanticDigest !== presentation.exactSemanticDigest
      || decision.lifecycleState !== "CURRENT"
      || decision.freshnessState !== "CURRENT"
      || decision.contradictionState !== "NONE"
      || decision.authority !== AUTHORITY) {
      return result(OUTCOMES.UNKNOWN, "human authorization decision invalid, mismatched, contradictory, or non-current");
    }

    const material = {
      type: "GT63_AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE",
      schemaVersion: "1.0",
      rulesetVersion: RULESET_VERSION,
      principalRef: request.principalRef,
      principalRevision: request.principalRevision,
      principalEvidenceRef: principal.principalEvidenceRef,
      presentationRef: presentation.presentationRef,
      presentationRevision: presentation.presentationRevision,
      authorizationSubjectRef: request.authorizationSubjectRef,
      authorizationSubjectRevision: request.authorizationSubjectRevision,
      governanceAct: GOVERNANCE_ACT,
      contextScope: canonicalize(request.contextScope),
      decision: decision.decision,
      exactSemanticDigest: presentation.exactSemanticDigest,
      decisionEvidenceRef: decision.decisionEvidenceRef,
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      authority: AUTHORITY
    };
    const evidence = {
      humanAuthorizationEvidenceRef: `gt63-evidence:authenticated-human-gate-authorization:${digest(material).slice(7)}`,
      ...material
    };
    return result(OUTCOMES.RESOLVED, null, evidence);
  }

  return Object.freeze({ assess, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  AUTHORITY,
  GOVERNANCE_ACT,
  GOVERNANCE_PRINCIPAL_REF,
  GOVERNANCE_PRINCIPAL_REVISION,
  OUTCOMES,
  createAuthenticatedHumanGateAuthorizationEvidence
});
