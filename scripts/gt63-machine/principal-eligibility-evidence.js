"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "principal-eligibility-evidence-v0.1.0";
const AUTHORITY = "NONE";
const OUTCOMES = Object.freeze({
  RESOLVED: "PRINCIPAL_ELIGIBILITY_RESOLVED",
  UNKNOWN: "PRINCIPAL_ELIGIBILITY_UNKNOWN",
  INVALID: "PRINCIPAL_ELIGIBILITY_INVALID"
});

function plain(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function nonEmpty(value) { return typeof value === "string" && value.length > 0; }
function clone(value) { return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
function compareCodePoints(left, right) {
  const a = Array.from(String(left)); const b = Array.from(String(right));
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const d = a[i].codePointAt(0) - b[i].codePointAt(0); if (d) return d;
  }
  return a.length - b.length;
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) return Object.keys(value).sort(compareCodePoints).reduce((out, key) => {
    out[key.normalize("NFC")] = canonicalize(value[key]); return out;
  }, {});
  return typeof value === "string" ? value.normalize("NFC") : value;
}
function digestValue(value) {
  const bytes = Buffer.from(JSON.stringify(canonicalize(value)), "utf8");
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}
function exact(record, fields) {
  return plain(record) && Object.keys(record).length === fields.length
    && Object.keys(record).every((key) => fields.includes(key));
}
function validGateScope(scope) {
  const fields = ["scopeType", "interactionId", "fromInteractionRevision", "throughInteractionRevision",
    "gateId", "gateRevision", "authorityScopeDigest", "continuationTargetRef"];
  return exact(scope, fields)
    && scope.scopeType === "GATE"
    && nonEmpty(scope.interactionId)
    && Number.isInteger(scope.fromInteractionRevision) && scope.fromInteractionRevision >= 0
    && (scope.throughInteractionRevision === null || (Number.isInteger(scope.throughInteractionRevision)
      && scope.throughInteractionRevision >= scope.fromInteractionRevision))
    && nonEmpty(scope.gateId) && Number.isInteger(scope.gateRevision) && scope.gateRevision > 0
    && /^sha256:[0-9a-f]{64}$/.test(scope.authorityScopeDigest)
    && nonEmpty(scope.continuationTargetRef);
}
function validRequest(request) {
  const fields = ["rulesetVersion", "principalRef", "principalRevision", "governanceAct", "contextScope"];
  return exact(request, fields)
    && request.rulesetVersion === RULESET_VERSION
    && nonEmpty(request.principalRef) && nonEmpty(request.principalRevision)
    && request.governanceAct === "GATE_AUTHORIZATION"
    && validGateScope(request.contextScope);
}
function validPrincipal(record, request) {
  return plain(record)
    && record.principalRef === request.principalRef
    && record.principalRevision === request.principalRevision
    && nonEmpty(record.principalEvidenceRef)
    && record.lifecycleState === "CURRENT"
    && record.freshnessState === "CURRENT"
    && record.contradictionState === "NONE"
    && record.authority === AUTHORITY;
}
function validPolicy(record, request) {
  return plain(record)
    && nonEmpty(record.eligibilityPolicyEvidenceRef)
    && record.principalRef === request.principalRef
    && record.principalRevision === request.principalRevision
    && record.governanceAct === request.governanceAct
    && JSON.stringify(canonicalize(record.contextScope)) === JSON.stringify(canonicalize(request.contextScope))
    && ["ELIGIBLE", "NOT_ELIGIBLE", "UNKNOWN"].includes(record.eligibilityState)
    && record.lifecycleState === "CURRENT"
    && record.freshnessState === "CURRENT"
    && record.contradictionState === "NONE"
    && record.authority === AUTHORITY;
}
function result(outcome, reason, evidence = null) {
  return deepFreeze({ outcome, reason: reason || null, evidence: clone(evidence), authority: AUTHORITY,
    humanGateSatisfied: false, continuationAuthorityCreated: false, executionAuthorityCreated: false,
    effectAuthorized: false });
}

function createPrincipalEligibilityEvidence({ authenticatedPrincipalPort, eligibilityPolicyPort } = {}) {
  if (typeof authenticatedPrincipalPort !== "function") throw new TypeError("authenticatedPrincipalPort must be a function");
  if (typeof eligibilityPolicyPort !== "function") throw new TypeError("eligibilityPolicyPort must be a function");

  function assess(request) {
    if (!validRequest(request)) return result(OUTCOMES.INVALID, "unsupported request schema or ruleset");
    let principal;
    try { principal = authenticatedPrincipalPort(deepFreeze(clone(request))); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "authenticated principal evidence unavailable"); }
    if (!validPrincipal(principal, request)) return result(OUTCOMES.UNKNOWN, "authenticated principal evidence invalid, mismatched, or non-current");

    let policy;
    try { policy = eligibilityPolicyPort(deepFreeze(clone(request))); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "eligibility policy evidence unavailable"); }
    if (!validPolicy(policy, request)) return result(OUTCOMES.UNKNOWN, "eligibility policy evidence invalid, mismatched, or non-current");

    const material = {
      type: "GT63_PRINCIPAL_ELIGIBILITY_EVIDENCE",
      schemaVersion: "1.0",
      rulesetVersion: RULESET_VERSION,
      principalRef: request.principalRef,
      principalRevision: request.principalRevision,
      principalEvidenceRef: principal.principalEvidenceRef,
      eligibilityPolicyEvidenceRef: policy.eligibilityPolicyEvidenceRef,
      eligibilityState: policy.eligibilityState,
      governanceAct: request.governanceAct,
      contextScope: canonicalize(request.contextScope),
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      authority: AUTHORITY
    };
    const evidence = deepFreeze({
      eligibilityEvidenceRef: `gt63-evidence:principal-eligibility:${digestValue(material).slice(7)}`,
      ...material
    });
    return result(OUTCOMES.RESOLVED, null, evidence);
  }

  return Object.freeze({ assess, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
}

module.exports = Object.freeze({ RULESET_VERSION, AUTHORITY, OUTCOMES, createPrincipalEligibilityEvidence });
