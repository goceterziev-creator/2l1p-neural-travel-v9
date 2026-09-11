"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "governance-role-requirement-principal-role-resolution-v0.1.0";
const AUTHORITY = "NONE";

const OUTCOMES = Object.freeze({
  RESOLVED: "RESOLVED",
  NOT_RESOLVED: "NOT_RESOLVED",
  UNKNOWN: "UNKNOWN",
  INVALID: "INVALID"
});

const RESOLUTION_TYPES = new Set(["DIRECT_ASSIGNMENT", "DELEGATION"]);

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

function callPort(port, argument) {
  try { return { ok: true, value: port(deepFreeze(clone(argument))) }; }
  catch (_) { return { ok: false, value: null }; }
}

function result(outcome, reason, evidence = null) {
  return deepFreeze({
    outcome,
    reason: reason || null,
    evidence: clone(evidence),
    authority: AUTHORITY,
    principalEligibilityCreated: false,
    roleAssignmentCreated: false,
    delegationCreated: false,
    humanGateSatisfied: false,
    continuationAuthorityCreated: false,
    executionAuthorityCreated: false,
    effectAuthorized: false
  });
}

function validPolicyAcceptance(record) {
  return plain(record)
    && record.type === "GOVERNANCE_ROLE_POLICY_REQUIREMENT_EVIDENCE_ACCEPTANCE"
    && nonEmpty(record.policyAcceptanceId)
    && nonEmpty(record.policyRef)
    && nonEmpty(record.policyRevision)
    && plain(record.policyDocument)
    && Array.isArray(record.policyDocument.requirements)
    && record.authority === AUTHORITY;
}

function validRequirement(requirement) {
  return plain(requirement)
    && nonEmpty(requirement.requirementRef)
    && nonEmpty(requirement.requirementRevision)
    && requirement.governanceAct === "GATE_AUTHORIZATION"
    && nonEmpty(requirement.requiredRoleRef)
    && nonEmpty(requirement.requiredRoleRevision)
    && validGateScope(requirement.contextScope);
}

function validAssignmentAcceptance(record) {
  return plain(record)
    && record.type === "DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE"
    && record.assignmentKind === "DIRECT"
    && nonEmpty(record.assignmentAcceptanceId)
    && nonEmpty(record.principalRef)
    && nonEmpty(record.principalRevision)
    && nonEmpty(record.roleRef)
    && nonEmpty(record.roleRevision)
    && nonEmpty(record.policyAcceptanceId)
    && validGateScope(record.contextScope)
    && record.observedLifecycleState === "CURRENT"
    && record.authority === AUTHORITY;
}

function validDelegationAcceptance(record) {
  return plain(record)
    && record.type === "DIRECT_DELEGATION_EVIDENCE_ACCEPTANCE"
    && nonEmpty(record.delegationAcceptanceId)
    && nonEmpty(record.granteeRef)
    && nonEmpty(record.granteeRevision)
    && nonEmpty(record.roleRef)
    && nonEmpty(record.roleRevision)
    && nonEmpty(record.policyAcceptanceId)
    && validGateScope(record.delegatedScope)
    && record.observedLifecycleState === "CURRENT"
    && record.chainDepth === 1
    && record.authority === AUTHORITY;
}

function createGovernanceRoleRequirementPrincipalRoleResolution({
  acceptedPolicyPort,
  acceptedAssignmentsPort,
  acceptedDelegationsPort
}) {
  for (const [name, port] of Object.entries({
    acceptedPolicyPort, acceptedAssignmentsPort, acceptedDelegationsPort
  })) {
    if (typeof port !== "function") throw new TypeError(`${name} must be a function`);
  }

  function resolveRequirement(request) {
    const fields = ["rulesetVersion", "governanceAct", "contextScope"];
    if (!exact(request, fields)
      || request.rulesetVersion !== RULESET_VERSION
      || request.governanceAct !== "GATE_AUTHORIZATION"
      || !validGateScope(request.contextScope)) {
      return result(OUTCOMES.INVALID, "unsupported requirement request");
    }

    const policyResult = callPort(acceptedPolicyPort, {
      governanceAct: request.governanceAct,
      contextScope: request.contextScope
    });
    if (!policyResult.ok) return result(OUTCOMES.UNKNOWN, "accepted policy evidence unavailable");
    const policies = policyResult.value;
    if (!Array.isArray(policies)) return result(OUTCOMES.UNKNOWN, "accepted policy evidence invalid");

    const candidates = [];
    for (const policy of policies) {
      if (!validPolicyAcceptance(policy)) return result(OUTCOMES.UNKNOWN, "accepted policy record invalid");
      for (const requirement of policy.policyDocument.requirements) {
        if (!validRequirement(requirement)) continue;
        if (requirement.governanceAct !== request.governanceAct
          || !scopeContains(requirement.contextScope, request.contextScope)) continue;
        candidates.push({ policy, requirement });
      }
    }

    if (candidates.length === 0) return result(OUTCOMES.NOT_RESOLVED, "no accepted role requirement for exact gate scope");
    if (candidates.length > 1) return result(OUTCOMES.UNKNOWN, "conflicting accepted role requirements for exact gate scope");

    const { policy, requirement } = candidates[0];
    const material = {
      type: "GT63_GOVERNANCE_ROLE_REQUIREMENT_RESOLUTION",
      schemaVersion: "1.0",
      rulesetVersion: RULESET_VERSION,
      requirementRef: requirement.requirementRef,
      requirementRevision: requirement.requirementRevision,
      governanceAct: requirement.governanceAct,
      requiredRoleRef: requirement.requiredRoleRef,
      requiredRoleRevision: requirement.requiredRoleRevision,
      contextScope: canonicalize(requirement.contextScope),
      policyAcceptanceId: policy.policyAcceptanceId,
      authority: AUTHORITY
    };
    return result(OUTCOMES.RESOLVED, null, {
      ...material,
      roleRequirementEvidenceRef: `gt63-evidence:role-requirement-resolution:${digestValue(material).slice(7)}`
    });
  }

  function resolvePrincipalRole(request) {
    const fields = [
      "rulesetVersion", "principalRef", "principalRevision",
      "roleRef", "roleRevision", "contextScope"
    ];
    if (!exact(request, fields)
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.principalRef)
      || !nonEmpty(request.principalRevision)
      || !nonEmpty(request.roleRef)
      || !nonEmpty(request.roleRevision)
      || !validGateScope(request.contextScope)) {
      return result(OUTCOMES.INVALID, "unsupported principal-role request");
    }

    const assignmentResult = callPort(acceptedAssignmentsPort, {
      principalRef: request.principalRef,
      principalRevision: request.principalRevision,
      roleRef: request.roleRef,
      roleRevision: request.roleRevision,
      contextScope: request.contextScope
    });
    if (!assignmentResult.ok) return result(OUTCOMES.UNKNOWN, "accepted assignment evidence unavailable");
    const delegationResult = callPort(acceptedDelegationsPort, {
      principalRef: request.principalRef,
      principalRevision: request.principalRevision,
      roleRef: request.roleRef,
      roleRevision: request.roleRevision,
      contextScope: request.contextScope
    });
    if (!delegationResult.ok) return result(OUTCOMES.UNKNOWN, "accepted delegation evidence unavailable");

    if (!Array.isArray(assignmentResult.value) || !Array.isArray(delegationResult.value)) {
      return result(OUTCOMES.UNKNOWN, "accepted role evidence invalid");
    }

    const matches = [];
    for (const assignment of assignmentResult.value) {
      if (!validAssignmentAcceptance(assignment)) return result(OUTCOMES.UNKNOWN, "accepted assignment record invalid");
      if (assignment.principalRef === request.principalRef
        && assignment.principalRevision === request.principalRevision
        && assignment.roleRef === request.roleRef
        && assignment.roleRevision === request.roleRevision
        && scopeContains(assignment.contextScope, request.contextScope)) {
        matches.push({
          roleResolutionType: "DIRECT_ASSIGNMENT",
          contextScope: assignment.contextScope,
          ref: assignment.assignmentAcceptanceId,
          policyAcceptanceId: assignment.policyAcceptanceId
        });
      }
    }

    for (const delegation of delegationResult.value) {
      if (!validDelegationAcceptance(delegation)) return result(OUTCOMES.UNKNOWN, "accepted delegation record invalid");
      if (delegation.granteeRef === request.principalRef
        && delegation.granteeRevision === request.principalRevision
        && delegation.roleRef === request.roleRef
        && delegation.roleRevision === request.roleRevision
        && scopeContains(delegation.delegatedScope, request.contextScope)) {
        matches.push({
          roleResolutionType: "DELEGATION",
          contextScope: delegation.delegatedScope,
          ref: delegation.delegationAcceptanceId,
          policyAcceptanceId: delegation.policyAcceptanceId
        });
      }
    }

    if (matches.length === 0) return result(OUTCOMES.NOT_RESOLVED, "no current accepted role evidence for exact principal and gate scope");

    const kinds = new Set(matches.map((item) => item.roleResolutionType));
    if (kinds.size > 1) return result(OUTCOMES.UNKNOWN, "conflicting direct-assignment and delegation role paths");

    const normalizedScope = canonicalStringify(matches[0].contextScope);
    if (matches.some((item) => canonicalStringify(item.contextScope) !== normalizedScope)) {
      return result(OUTCOMES.UNKNOWN, "conflicting accepted role scopes");
    }

    const roleResolutionType = matches[0].roleResolutionType;
    if (!RESOLUTION_TYPES.has(roleResolutionType)) return result(OUTCOMES.UNKNOWN, "unsupported role resolution type");
    const roleEvidenceRefs = Array.from(new Set(matches.map((item) => item.ref))).sort(compareCodePoints);
    const policyAcceptanceIds = Array.from(new Set(matches.map((item) => item.policyAcceptanceId))).sort(compareCodePoints);
    if (policyAcceptanceIds.length !== 1) return result(OUTCOMES.UNKNOWN, "conflicting accepted policy identities for role resolution");

    const material = {
      type: "GT63_PRINCIPAL_ROLE_RESOLUTION",
      schemaVersion: "1.0",
      rulesetVersion: RULESET_VERSION,
      roleResolutionType,
      principalRef: request.principalRef,
      principalRevision: request.principalRevision,
      roleRef: request.roleRef,
      roleRevision: request.roleRevision,
      contextScope: canonicalize(matches[0].contextScope),
      roleEvidenceRefs,
      policyAcceptanceId: policyAcceptanceIds[0],
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      authority: AUTHORITY
    };
    return result(OUTCOMES.RESOLVED, null, {
      ...material,
      roleResolutionEvidenceRef: `gt63-evidence:principal-role-resolution:${digestValue(material).slice(7)}`
    });
  }

  return Object.freeze({ resolveRequirement, resolvePrincipalRole });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  canonicalStringify,
  createGovernanceRoleRequirementPrincipalRoleResolution
});
