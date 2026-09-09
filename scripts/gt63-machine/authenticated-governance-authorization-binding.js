"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "authenticated-governance-authorization-binding-v0.1.0";
const AUTHORITY = "NONE";

const OUTCOMES = Object.freeze({
  AUTHORIZED: "AUTHORIZED",
  NOT_AUTHORIZED: "NOT_AUTHORIZED",
  UNKNOWN: "UNKNOWN",
  INVALID: "INVALID"
});

const GOVERNANCE_ACT = "GATE_AUTHORIZATION";

function plain(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

const canonicalStringify = (value) => JSON.stringify(canonicalize(value));
const digestValue = (value) => `sha256:${crypto.createHash("sha256")
  .update(Buffer.from(canonicalStringify(value), "utf8")).digest("hex")}`;
const clone = (value) => value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
const nonEmpty = (value) => typeof value === "string" && value.length > 0;

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function exact(record, fields) {
  return plain(record)
    && Object.keys(record).length === fields.length
    && Object.keys(record).every((key) => fields.includes(key));
}

function validGateScope(scope) {
  const fields = [
    "scopeType", "interactionId", "fromInteractionRevision", "throughInteractionRevision",
    "gateId", "gateRevision", "authorityScopeDigest", "continuationTargetRef"
  ];
  return exact(scope, fields)
    && scope.scopeType === "GATE"
    && nonEmpty(scope.interactionId)
    && Number.isInteger(scope.fromInteractionRevision)
    && scope.fromInteractionRevision >= 0
    && (scope.throughInteractionRevision === null
      || (Number.isInteger(scope.throughInteractionRevision)
        && scope.throughInteractionRevision >= scope.fromInteractionRevision))
    && nonEmpty(scope.gateId)
    && Number.isInteger(scope.gateRevision)
    && scope.gateRevision > 0
    && /^sha256:[0-9a-f]{64}$/.test(scope.authorityScopeDigest)
    && nonEmpty(scope.continuationTargetRef);
}

function scopeContains(parent, child) {
  if (!validGateScope(parent) || !validGateScope(child)) return false;
  if (parent.interactionId !== child.interactionId
    || parent.gateId !== child.gateId
    || parent.gateRevision !== child.gateRevision
    || parent.authorityScopeDigest !== child.authorityScopeDigest
    || parent.continuationTargetRef !== child.continuationTargetRef
    || child.fromInteractionRevision < parent.fromInteractionRevision) return false;
  if (parent.throughInteractionRevision !== null
    && (child.throughInteractionRevision === null
      || child.throughInteractionRevision > parent.throughInteractionRevision)) return false;
  return true;
}

function result(outcome, reason, binding = null) {
  return deepFreeze({
    outcome,
    reason: reason || null,
    binding: clone(binding),
    authority: AUTHORITY,
    humanGateSatisfied: false,
    continuationAuthorityCreated: false,
    executionAuthorityCreated: false,
    effectAuthorized: false
  });
}

function callPort(port, argument) {
  try { return { ok: true, value: port(deepFreeze(clone(argument))) }; }
  catch (_) { return { ok: false, value: null }; }
}

function validRequest(request) {
  const fields = [
    "rulesetVersion", "authorizationSubjectRef", "authorizationSubjectRevision",
    "governanceAct", "contextScope", "principalRef", "principalRevision",
    "humanAuthorizationEvidenceRef"
  ];
  return exact(request, fields)
    && request.rulesetVersion === RULESET_VERSION
    && nonEmpty(request.authorizationSubjectRef)
    && nonEmpty(request.authorizationSubjectRevision)
    && request.governanceAct === GOVERNANCE_ACT
    && validGateScope(request.contextScope)
    && nonEmpty(request.principalRef)
    && nonEmpty(request.principalRevision)
    && nonEmpty(request.humanAuthorizationEvidenceRef);
}

function validPrincipalEvidence(record) {
  return plain(record)
    && nonEmpty(record.principalRef)
    && nonEmpty(record.principalRevision)
    && nonEmpty(record.principalEvidenceRef)
    && record.lifecycleState === "CURRENT"
    && record.freshnessState === "CURRENT"
    && record.contradictionState === "NONE"
    && record.authority === AUTHORITY;
}

function validEligibility(record) {
  return plain(record)
    && nonEmpty(record.principalRef)
    && nonEmpty(record.principalRevision)
    && nonEmpty(record.eligibilityEvidenceRef)
    && ["ELIGIBLE", "NOT_ELIGIBLE", "UNKNOWN"].includes(record.eligibilityState)
    && ["CURRENT", "STALE", "UNKNOWN"].includes(record.freshnessState)
    && ["CURRENT", "STALE", "REVOKED", "DEACTIVATED", "SUPERSEDED", "UNKNOWN", "CONFLICT"].includes(record.lifecycleState)
    && ["NONE", "CONFLICT"].includes(record.contradictionState)
    && validGateScope(record.contextScope)
    && record.governanceAct === GOVERNANCE_ACT
    && record.authority === AUTHORITY;
}

function validRoleRequirement(record) {
  return plain(record)
    && nonEmpty(record.requirementRef)
    && nonEmpty(record.requirementRevision)
    && record.governanceAct === GOVERNANCE_ACT
    && nonEmpty(record.requiredRoleRef)
    && nonEmpty(record.requiredRoleRevision)
    && validGateScope(record.contextScope)
    && nonEmpty(record.roleRequirementEvidenceRef)
    && record.authority === AUTHORITY;
}

function validRoleResolution(record) {
  return plain(record)
    && ["DIRECT_ASSIGNMENT", "DELEGATION"].includes(record.roleResolutionType)
    && nonEmpty(record.principalRef)
    && nonEmpty(record.principalRevision)
    && nonEmpty(record.roleRef)
    && nonEmpty(record.roleRevision)
    && validGateScope(record.contextScope)
    && Array.isArray(record.roleEvidenceRefs)
    && record.roleEvidenceRefs.length > 0
    && record.roleEvidenceRefs.every(nonEmpty)
    && record.lifecycleState === "CURRENT"
    && record.freshnessState === "CURRENT"
    && record.contradictionState === "NONE"
    && record.authority === AUTHORITY;
}

function validHumanAuthorization(record) {
  return plain(record)
    && nonEmpty(record.humanAuthorizationEvidenceRef)
    && nonEmpty(record.principalRef)
    && nonEmpty(record.principalRevision)
    && nonEmpty(record.authorizationSubjectRef)
    && nonEmpty(record.authorizationSubjectRevision)
    && record.governanceAct === GOVERNANCE_ACT
    && validGateScope(record.contextScope)
    && ["APPROVE", "DENY", "NON_AUTHORIZATION"].includes(record.decision)
    && /^sha256:[0-9a-f]{64}$/.test(record.exactSemanticDigest)
    && record.lifecycleState === "CURRENT"
    && record.freshnessState === "CURRENT"
    && record.contradictionState === "NONE"
    && record.authority === AUTHORITY;
}

function createAuthenticatedGovernanceAuthorizationBinding({
  authenticatedPrincipalPort,
  principalEligibilityPort,
  governanceRoleRequirementPort,
  roleResolutionPort,
  humanAuthorizationEventPort,
  bindingLedger
}) {
  for (const [name, port] of Object.entries({
    authenticatedPrincipalPort,
    principalEligibilityPort,
    governanceRoleRequirementPort,
    roleResolutionPort,
    humanAuthorizationEventPort
  })) {
    if (typeof port !== "function") throw new TypeError(`${name} must be a function`);
  }
  for (const name of ["get", "commit"]) {
    if (!bindingLedger || typeof bindingLedger[name] !== "function") {
      throw new TypeError(`bindingLedger.${name} must be a function`);
    }
  }

  function assess(request) {
    if (!validRequest(request)) return result(OUTCOMES.INVALID, "unsupported request schema or ruleset");

    const principalResult = callPort(authenticatedPrincipalPort, {
      principalRef: request.principalRef,
      principalRevision: request.principalRevision,
      contextScope: request.contextScope
    });
    if (!principalResult.ok) return result(OUTCOMES.UNKNOWN, "authenticated principal evidence unavailable");
    const principal = principalResult.value;
    if (!validPrincipalEvidence(principal)) return result(OUTCOMES.UNKNOWN, "authenticated principal evidence invalid or non-current");
    if (principal.principalRef !== request.principalRef || principal.principalRevision !== request.principalRevision) {
      return result(OUTCOMES.NOT_AUTHORIZED, "authenticated principal mismatch");
    }

    const eligibilityResult = callPort(principalEligibilityPort, {
      principalRef: request.principalRef,
      principalRevision: request.principalRevision,
      governanceAct: request.governanceAct,
      contextScope: request.contextScope
    });
    if (!eligibilityResult.ok) return result(OUTCOMES.UNKNOWN, "principal eligibility evidence unavailable");
    const eligibility = eligibilityResult.value;
    if (!validEligibility(eligibility)) return result(OUTCOMES.UNKNOWN, "principal eligibility evidence invalid");
    if (eligibility.principalRef !== request.principalRef || eligibility.principalRevision !== request.principalRevision
      || !scopeContains(eligibility.contextScope, request.contextScope)) {
      return result(OUTCOMES.NOT_AUTHORIZED, "eligibility evidence mismatch");
    }
    if (eligibility.lifecycleState !== "CURRENT" || eligibility.freshnessState !== "CURRENT"
      || eligibility.contradictionState !== "NONE") return result(OUTCOMES.UNKNOWN, "eligibility evidence is not current");
    if (eligibility.eligibilityState === "UNKNOWN") return result(OUTCOMES.UNKNOWN, "principal eligibility is unknown");
    if (eligibility.eligibilityState === "NOT_ELIGIBLE") return result(OUTCOMES.NOT_AUTHORIZED, "principal positively not eligible for exact gate scope");

    const requirementResult = callPort(governanceRoleRequirementPort, {
      governanceAct: request.governanceAct,
      contextScope: request.contextScope
    });
    if (!requirementResult.ok) return result(OUTCOMES.UNKNOWN, "governance role requirement unavailable");
    const requirement = requirementResult.value;
    if (!validRoleRequirement(requirement)) return result(OUTCOMES.UNKNOWN, "governance role requirement invalid");
    if (requirement.governanceAct !== request.governanceAct || !scopeContains(requirement.contextScope, request.contextScope)) {
      return result(OUTCOMES.NOT_AUTHORIZED, "governance role requirement mismatch");
    }

    const roleResult = callPort(roleResolutionPort, {
      principalRef: request.principalRef,
      principalRevision: request.principalRevision,
      roleRef: requirement.requiredRoleRef,
      roleRevision: requirement.requiredRoleRevision,
      contextScope: request.contextScope
    });
    if (!roleResult.ok) return result(OUTCOMES.UNKNOWN, "role resolution unavailable");
    const role = roleResult.value;
    if (!validRoleResolution(role)) return result(OUTCOMES.UNKNOWN, "role resolution invalid or non-current");
    if (role.principalRef !== request.principalRef || role.principalRevision !== request.principalRevision
      || role.roleRef !== requirement.requiredRoleRef || role.roleRevision !== requirement.requiredRoleRevision
      || !scopeContains(role.contextScope, request.contextScope)) {
      return result(OUTCOMES.NOT_AUTHORIZED, "role resolution mismatch");
    }

    const authResult = callPort(humanAuthorizationEventPort, {
      humanAuthorizationEvidenceRef: request.humanAuthorizationEvidenceRef
    });
    if (!authResult.ok) return result(OUTCOMES.UNKNOWN, "human authorization evidence unavailable");
    const authorization = authResult.value;
    if (!validHumanAuthorization(authorization)) return result(OUTCOMES.UNKNOWN, "human authorization evidence invalid or non-current");
    if (authorization.humanAuthorizationEvidenceRef !== request.humanAuthorizationEvidenceRef) {
      return result(OUTCOMES.NOT_AUTHORIZED, "human authorization evidence identity mismatch");
    }
    if (authorization.principalRef !== request.principalRef || authorization.principalRevision !== request.principalRevision) {
      return result(OUTCOMES.NOT_AUTHORIZED, "human authorization principal mismatch");
    }
    if (authorization.authorizationSubjectRef !== request.authorizationSubjectRef
      || authorization.authorizationSubjectRevision !== request.authorizationSubjectRevision) {
      return result(OUTCOMES.NOT_AUTHORIZED, "human authorization subject mismatch");
    }
    if (authorization.governanceAct !== request.governanceAct || !scopeContains(authorization.contextScope, request.contextScope)) {
      return result(OUTCOMES.NOT_AUTHORIZED, "human authorization act or scope mismatch");
    }
    if (authorization.decision === "DENY" || authorization.decision === "NON_AUTHORIZATION") {
      return result(OUTCOMES.NOT_AUTHORIZED, "authenticated human evidence positively does not authorize requested gate action");
    }

    const material = {
      type: "GT63_AUTHENTICATED_GOVERNANCE_AUTHORIZATION_BINDING",
      schemaVersion: "1.0",
      rulesetVersion: RULESET_VERSION,
      authorizationSubjectRef: request.authorizationSubjectRef,
      authorizationSubjectRevision: request.authorizationSubjectRevision,
      governanceAct: request.governanceAct,
      contextScope: canonicalize(request.contextScope),
      principalRef: request.principalRef,
      principalRevision: request.principalRevision,
      principalEvidenceRef: principal.principalEvidenceRef,
      eligibilityEvidenceRef: eligibility.eligibilityEvidenceRef,
      roleRequirementEvidenceRef: requirement.roleRequirementEvidenceRef,
      roleResolutionType: role.roleResolutionType,
      roleEvidenceRefs: Array.from(new Set(role.roleEvidenceRefs)).sort(compareCodePoints),
      humanAuthorizationEvidenceRef: authorization.humanAuthorizationEvidenceRef,
      humanAuthorizationSemanticDigest: authorization.exactSemanticDigest,
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      authorizationState: "BOUND",
      authority: AUTHORITY,
      humanGateSatisfied: false,
      continuationAuthorityCreated: false,
      executionAuthorityCreated: false,
      effectAuthorized: false
    };
    const bindingId = `governance-authorization-binding:${digestValue(material).slice(7)}`;
    const binding = deepFreeze({ bindingId, ...material });

    let prior;
    try { prior = bindingLedger.get(bindingId); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "authorization binding ledger unavailable"); }
    if (prior !== null && prior !== undefined) {
      return canonicalStringify(prior) === canonicalStringify(binding)
        ? result(OUTCOMES.AUTHORIZED, "same authorization binding already accepted", prior)
        : result(OUTCOMES.UNKNOWN, "authorization binding identity conflict");
    }

    try {
      const committed = bindingLedger.commit(bindingId, binding);
      if (!committed || canonicalStringify(committed) !== canonicalStringify(binding)) {
        return result(OUTCOMES.UNKNOWN, "authorization binding ledger commit conflict");
      }
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, "authorization binding ledger commit conflict");
    }

    return result(OUTCOMES.AUTHORIZED, null, binding);
  }

  return Object.freeze({ assess, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
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
  OUTCOMES,
  GOVERNANCE_ACT,
  canonicalStringify,
  validGateScope,
  scopeContains,
  createAuthenticatedGovernanceAuthorizationBinding,
  createMemoryLedger
});
