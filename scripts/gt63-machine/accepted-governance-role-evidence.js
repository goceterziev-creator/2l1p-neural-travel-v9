"use strict";

const crypto = require("node:crypto");

const POLICY_RULESET_VERSION = "governance-role-policy-requirement-evidence-v1.0.0";
const ASSIGNMENT_RULESET_VERSION = "direct-principal-role-assignment-evidence-v1.0.0";
const DELEGATION_RULESET_VERSION = "direct-delegation-evidence-v1.0.0";
const SCHEMA_VERSION = "1.0";

const POLICY_OUTCOMES = Object.freeze({
  ACCEPTED: "ROLE_POLICY_EVIDENCE_ACCEPTED",
  ALREADY_ACCEPTED: "ROLE_POLICY_EVIDENCE_ALREADY_ACCEPTED",
  REJECTED: "ROLE_POLICY_EVIDENCE_REJECTED",
  STALE: "ROLE_POLICY_EVIDENCE_STALE",
  UNCERTAIN: "ROLE_POLICY_EVIDENCE_UNCERTAIN",
  CONFLICT: "ROLE_POLICY_EVIDENCE_CONFLICT"
});

const ASSIGNMENT_OUTCOMES = Object.freeze({
  ACCEPTED: "ROLE_ASSIGNMENT_EVIDENCE_ACCEPTED",
  ALREADY_ACCEPTED: "ROLE_ASSIGNMENT_EVIDENCE_ALREADY_ACCEPTED",
  REJECTED: "ROLE_ASSIGNMENT_EVIDENCE_REJECTED",
  STALE: "ROLE_ASSIGNMENT_EVIDENCE_STALE",
  UNCERTAIN: "ROLE_ASSIGNMENT_EVIDENCE_UNCERTAIN",
  CONFLICT: "ROLE_ASSIGNMENT_EVIDENCE_CONFLICT"
});

const DELEGATION_OUTCOMES = Object.freeze({
  ACCEPTED: "DIRECT_DELEGATION_EVIDENCE_ACCEPTED",
  ALREADY_ACCEPTED: "DIRECT_DELEGATION_EVIDENCE_ALREADY_ACCEPTED",
  REJECTED: "DIRECT_DELEGATION_EVIDENCE_REJECTED",
  STALE: "DIRECT_DELEGATION_EVIDENCE_STALE",
  UNCERTAIN: "DIRECT_DELEGATION_EVIDENCE_UNCERTAIN",
  CONFLICT: "DIRECT_DELEGATION_EVIDENCE_CONFLICT"
});

const LIFECYCLE_STATES = new Set([
  "CURRENT", "STALE", "REVOKED", "DEACTIVATED", "SUPERSEDED", "UNKNOWN", "CONFLICT"
]);
const FRESHNESS_STATES = new Set(["CURRENT", "STALE", "UNKNOWN"]);
const TRUST_STATES = new Set(["TRUSTED", "UNTRUSTED", "UNKNOWN"]);
const TEMPORAL_STATES = new Set(["CURRENT", "STALE", "UNKNOWN", "CONFLICT"]);
const CONTRADICTION_STATES = new Set(["NONE", "CONFLICT"]);
const GOVERNANCE_ACTS = new Set([
  "INTERACTION_OWNERSHIP", "INTENT_AUTHORSHIP", "INTENT_CONFIRMATION",
  "INTENT_CORRECTION", "GATE_AUTHORIZATION"
]);

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
const sha256 = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const digestValue = (value) => sha256(Buffer.from(canonicalStringify(value), "utf8"));
const clone = (value) => value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
const nonEmpty = (value) => typeof value === "string" && value.length > 0;
const nullableString = (value) => value === null || nonEmpty(value);

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

function strings(record, fields) {
  return fields.every((field) => nonEmpty(record[field]));
}

function evidenceRefs(values) {
  return Array.from(new Set(values.map((value) => value.normalize("NFC")))).sort(compareCodePoints);
}

function callPort(port, argument) {
  try { return { ok: true, value: port(deepFreeze(clone(argument))) }; }
  catch (_) { return { ok: false, value: null }; }
}

function result(outcome, reason, evidence = null) {
  return deepFreeze({ outcome, reason: reason || null, evidence: clone(evidence), authority: "NONE" });
}

function same(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

function validContextScope(scope) {
  if (!plain(scope) || !["INTERACTION", "INTENT", "GATE"].includes(scope.scopeType)) return false;
  const base = ["scopeType", "interactionId", "fromInteractionRevision", "throughInteractionRevision"];
  const fields = scope.scopeType === "INTERACTION" ? base
    : scope.scopeType === "INTENT"
      ? [...base, "intentContractRef", "intentContractDigest"]
      : [...base, "gateId", "gateRevision", "authorityScopeDigest", "continuationTargetRef"];
  if (!exact(scope, fields) || !nonEmpty(scope.interactionId)
    || !Number.isInteger(scope.fromInteractionRevision) || scope.fromInteractionRevision < 0
    || !(scope.throughInteractionRevision === null
      || (Number.isInteger(scope.throughInteractionRevision)
        && scope.throughInteractionRevision >= scope.fromInteractionRevision))) return false;
  if (scope.scopeType === "INTENT") {
    return nonEmpty(scope.intentContractRef) && /^sha256:[0-9a-f]{64}$/.test(scope.intentContractDigest);
  }
  if (scope.scopeType === "GATE") {
    return strings(scope, ["gateId", "authorityScopeDigest", "continuationTargetRef"])
      && Number.isInteger(scope.gateRevision) && scope.gateRevision > 0
      && /^sha256:[0-9a-f]{64}$/.test(scope.authorityScopeDigest);
  }
  return true;
}

function normalizeContextScope(scope) {
  return canonicalize(scope);
}

function scopeContains(parent, child) {
  if (!validContextScope(parent) || !validContextScope(child) || parent.scopeType !== child.scopeType
    || parent.interactionId !== child.interactionId
    || child.fromInteractionRevision < parent.fromInteractionRevision
    || (parent.throughInteractionRevision !== null
      && (child.throughInteractionRevision === null
        || child.throughInteractionRevision > parent.throughInteractionRevision))) return false;
  const withoutRange = (scope) => Object.fromEntries(Object.entries(scope)
    .filter(([key]) => !["fromInteractionRevision", "throughInteractionRevision"].includes(key)));
  return same(withoutRange(parent), withoutRange(child));
}

function validTemporal(record) {
  return exact(record, ["state", "temporalFrameRevision", "evidenceRef"])
    && TEMPORAL_STATES.has(record.state)
    && strings(record, ["temporalFrameRevision", "evidenceRef"]);
}

function temporalOutcome(snapshot, expectedRevision, outcomes) {
  if (!validTemporal(snapshot)) return result(outcomes.UNCERTAIN, "temporal evidence invalid");
  if (snapshot.temporalFrameRevision !== expectedRevision || snapshot.state === "STALE") {
    return result(outcomes.STALE, "temporal evidence is stale");
  }
  if (snapshot.state === "UNKNOWN") return result(outcomes.UNCERTAIN, "temporal state is unknown");
  if (snapshot.state === "CONFLICT") return result(outcomes.CONFLICT, "temporal evidence conflicts");
  return null;
}

function lifecycleOutcome(state, outcomes, subject) {
  if (state === "CONFLICT") return result(outcomes.CONFLICT, `${subject} lifecycle conflicts`);
  if (state === "UNKNOWN") return result(outcomes.UNCERTAIN, `${subject} lifecycle is unknown`);
  if (state !== "CURRENT") return result(outcomes.STALE, `${subject} is not current`);
  return null;
}

function validTrustedSource(record) {
  return exact(record, ["sourceRef", "sourceRevision", "trustState", "registryEvidenceRef"])
    && strings(record, ["sourceRef", "sourceRevision", "registryEvidenceRef"])
    && TRUST_STATES.has(record.trustState);
}

function normalizePolicyDocument(document) {
  return {
    roles: document.roles.map((role) => canonicalize(role))
      .sort((a, b) => compareCodePoints(`${a.roleRef}:${a.roleRevision}`, `${b.roleRef}:${b.roleRevision}`)),
    requirements: document.requirements.map((requirement) => ({
      ...canonicalize(requirement), contextScope: normalizeContextScope(requirement.contextScope)
    })).sort((a, b) => compareCodePoints(`${a.requirementRef}:${a.requirementRevision}`,
      `${b.requirementRef}:${b.requirementRevision}`)),
    assignmentIssuerRefs: Array.from(new Set(document.assignmentIssuerRefs.map((item) => item.normalize("NFC"))))
      .sort(compareCodePoints)
  };
}

function validPolicyDocument(document) {
  if (!exact(document, ["roles", "requirements", "assignmentIssuerRefs"])
    || !Array.isArray(document.roles) || document.roles.length === 0
    || !Array.isArray(document.requirements) || document.requirements.length === 0
    || !Array.isArray(document.assignmentIssuerRefs) || document.assignmentIssuerRefs.length === 0
    || !document.assignmentIssuerRefs.every(nonEmpty)) return false;
  const roles = new Set();
  for (const role of document.roles) {
    if (!exact(role, ["roleRef", "roleRevision", "assignmentCardinality", "delegable",
      "maxDelegationDepth", "redelegationPermitted"])
      || !strings(role, ["roleRef", "roleRevision"])
      || !["SINGLE", "MULTIPLE"].includes(role.assignmentCardinality)
      || typeof role.delegable !== "boolean"
      || !Number.isInteger(role.maxDelegationDepth) || role.maxDelegationDepth < 0
      || typeof role.redelegationPermitted !== "boolean"
      || (role.redelegationPermitted && role.maxDelegationDepth < 2)) return false;
    const key = `${role.roleRef}\u0000${role.roleRevision}`;
    if (roles.has(key)) return false;
    roles.add(key);
  }
  const requirements = new Set();
  for (const requirement of document.requirements) {
    if (!exact(requirement, ["requirementRef", "requirementRevision", "governanceAct",
      "requiredRoleRef", "requiredRoleRevision", "contextScope"])
      || !strings(requirement, ["requirementRef", "requirementRevision", "requiredRoleRef",
        "requiredRoleRevision"])
      || !GOVERNANCE_ACTS.has(requirement.governanceAct)
      || !validContextScope(requirement.contextScope)
      || !roles.has(`${requirement.requiredRoleRef}\u0000${requirement.requiredRoleRevision}`)) return false;
    const key = `${requirement.requirementRef}\u0000${requirement.requirementRevision}`;
    if (requirements.has(key)) return false;
    requirements.add(key);
  }
  return true;
}

function validPolicyAcceptance(record) {
  return plain(record) && record.type === "GOVERNANCE_ROLE_POLICY_REQUIREMENT_EVIDENCE_ACCEPTANCE"
    && nonEmpty(record.policyAcceptanceId) && nonEmpty(record.policyRef)
    && nonEmpty(record.policyRevision) && /^sha256:[0-9a-f]{64}$/.test(record.policyContentDigest)
    && validPolicyDocument(record.policyDocument) && record.authority === "NONE";
}

function createGovernanceRolePolicyRequirementEvidenceAcceptance({
  policySnapshotPort, policySourceRegistryPort, temporalFramePort, policyLedger
}) {
  for (const [name, port] of Object.entries({ policySnapshotPort, policySourceRegistryPort, temporalFramePort })) {
    if (typeof port !== "function") throw new TypeError(`${name} must be a function`);
  }
  for (const name of ["findByPolicyRef", "commit"]) {
    if (!policyLedger || typeof policyLedger[name] !== "function") throw new TypeError(`policyLedger.${name} must be a function`);
  }

  function accept(request) {
    const requestFields = ["rulesetVersion", "policyRef", "expectedPolicyRevision",
      "expectedSourceRevision", "expectedTemporalFrameRevision"];
    if (!exact(request, requestFields) || !requestFields.every((field) => nonEmpty(request[field]))) {
      return result(POLICY_OUTCOMES.REJECTED, "unsupported request schema");
    }
    if (request.rulesetVersion !== POLICY_RULESET_VERSION) {
      return result(POLICY_OUTCOMES.REJECTED, "unsupported ruleset");
    }
    const snapshotResult = callPort(policySnapshotPort, { policyRef: request.policyRef });
    if (!snapshotResult.ok) return result(POLICY_OUTCOMES.UNCERTAIN, "policy source unavailable");
    const policy = snapshotResult.value;
    const fields = ["type", "policyRef", "policyRevision", "sourceRef", "sourceRevision",
      "policyDocument", "validFromTemporalFrameRef", "validThroughTemporalFrameRef",
      "lifecycleState", "supersedesPolicyRef", "policyEvidenceRef"];
    if (!exact(policy, fields) || policy.type !== "GOVERNANCE_ROLE_POLICY"
      || !strings(policy, ["policyRef", "policyRevision", "sourceRef", "sourceRevision",
        "validFromTemporalFrameRef", "policyEvidenceRef"])
      || !nullableString(policy.validThroughTemporalFrameRef) || !nullableString(policy.supersedesPolicyRef)
      || !LIFECYCLE_STATES.has(policy.lifecycleState) || !validPolicyDocument(policy.policyDocument)
      || policy.policyRef !== request.policyRef) {
      return result(POLICY_OUTCOMES.REJECTED, "invalid policy evidence");
    }
    if (policy.policyRevision !== request.expectedPolicyRevision
      || policy.sourceRevision !== request.expectedSourceRevision) {
      return result(POLICY_OUTCOMES.STALE, "policy or source revision is stale");
    }
    const lifecycle = lifecycleOutcome(policy.lifecycleState, POLICY_OUTCOMES, "policy");
    if (lifecycle) return lifecycle;

    const registryResult = callPort(policySourceRegistryPort, {
      sourceRef: policy.sourceRef, sourceRevision: policy.sourceRevision
    });
    if (!registryResult.ok) return result(POLICY_OUTCOMES.UNCERTAIN, "policy registry unavailable");
    const registry = registryResult.value;
    if (!validTrustedSource(registry) || registry.sourceRef !== policy.sourceRef
      || registry.sourceRevision !== policy.sourceRevision) {
      return result(POLICY_OUTCOMES.UNCERTAIN, "policy registry evidence invalid or unbound");
    }
    if (registry.trustState !== "TRUSTED") {
      return result(POLICY_OUTCOMES.UNCERTAIN, "policy source is not trusted");
    }
    const temporalResult = callPort(temporalFramePort, {
      validFromTemporalFrameRef: policy.validFromTemporalFrameRef,
      validThroughTemporalFrameRef: policy.validThroughTemporalFrameRef
    });
    if (!temporalResult.ok) return result(POLICY_OUTCOMES.UNCERTAIN, "temporal verifier unavailable");
    const temporalFailure = temporalOutcome(temporalResult.value,
      request.expectedTemporalFrameRevision, POLICY_OUTCOMES);
    if (temporalFailure) return temporalFailure;

    const policyDocument = normalizePolicyDocument(policy.policyDocument);
    const policyContentDigest = digestValue(policyDocument);
    const material = {
      type: "GOVERNANCE_ROLE_POLICY_REQUIREMENT_EVIDENCE_ACCEPTANCE",
      schemaVersion: SCHEMA_VERSION,
      rulesetVersion: POLICY_RULESET_VERSION,
      policyRef: policy.policyRef,
      policyRevision: policy.policyRevision,
      policyContentDigest,
      policyDocument,
      sourceRef: policy.sourceRef,
      sourceRevision: policy.sourceRevision,
      validFromTemporalFrameRef: policy.validFromTemporalFrameRef,
      validThroughTemporalFrameRef: policy.validThroughTemporalFrameRef,
      observedLifecycleState: policy.lifecycleState,
      supersedesPolicyRef: policy.supersedesPolicyRef,
      temporalFrameRevision: temporalResult.value.temporalFrameRevision,
      evidenceRefs: evidenceRefs([policy.policyEvidenceRef, registry.registryEvidenceRef,
        temporalResult.value.evidenceRef]),
      authority: "NONE"
    };
    const policyAcceptanceId = `governance-role-policy:${digestValue(material).slice(7)}`;
    const acceptance = deepFreeze({ policyAcceptanceId, ...material });
    let prior;
    try { prior = policyLedger.findByPolicyRef(policy.policyRef); }
    catch (_) { return result(POLICY_OUTCOMES.UNCERTAIN, "policy ledger unavailable"); }
    if (!Array.isArray(prior)) return result(POLICY_OUTCOMES.UNCERTAIN, "policy ledger evidence invalid");
    if (prior.length > 1) return result(POLICY_OUTCOMES.CONFLICT, "multiple accepted records for policy identity");
    if (prior.length === 1) {
      return prior[0].policyAcceptanceId === policyAcceptanceId && same(prior[0], acceptance)
        ? result(POLICY_OUTCOMES.ALREADY_ACCEPTED, "same policy evidence already accepted", prior[0])
        : result(POLICY_OUTCOMES.CONFLICT, "policy identity reused with changed material");
    }
    try {
      const committed = policyLedger.commit(acceptance);
      return committed && same(committed, acceptance)
        ? result(POLICY_OUTCOMES.ACCEPTED, null, committed)
        : result(POLICY_OUTCOMES.CONFLICT, "policy ledger returned conflicting identity");
    } catch (_) {
      return result(POLICY_OUTCOMES.CONFLICT, "policy ledger commit conflict");
    }
  }

  return Object.freeze({ accept });
}

function validPrincipalSnapshot(record) {
  return exact(record, ["principalRef", "principalRevision", "lifecycleState", "freshnessState",
    "contradictionState", "principalEvidenceRef"])
    && strings(record, ["principalRef", "principalRevision", "principalEvidenceRef"])
    && LIFECYCLE_STATES.has(record.lifecycleState)
    && FRESHNESS_STATES.has(record.freshnessState)
    && CONTRADICTION_STATES.has(record.contradictionState);
}

function principalFailure(principal, expectedRef, expectedRevision, outcomes) {
  if (!validPrincipalSnapshot(principal) || principal.principalRef !== expectedRef) {
    return result(outcomes.UNCERTAIN, "principal evidence invalid or unbound");
  }
  if (principal.principalRevision !== expectedRevision || principal.freshnessState === "STALE") {
    return result(outcomes.STALE, "principal revision or freshness is stale");
  }
  if (principal.contradictionState === "CONFLICT" || principal.lifecycleState === "CONFLICT") {
    return result(outcomes.CONFLICT, "principal evidence conflicts");
  }
  if (principal.freshnessState === "UNKNOWN" || principal.lifecycleState === "UNKNOWN") {
    return result(outcomes.UNCERTAIN, "principal currentness is unknown");
  }
  if (principal.lifecycleState !== "CURRENT") return result(outcomes.STALE, "principal is not current");
  return null;
}

function validAssignmentAcceptance(record) {
  return plain(record) && record.type === "DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE"
    && record.assignmentKind === "DIRECT" && nonEmpty(record.assignmentAcceptanceId)
    && nonEmpty(record.assignmentRef) && nonEmpty(record.assignmentRevision)
    && nonEmpty(record.principalRef) && nonEmpty(record.principalRevision)
    && nonEmpty(record.roleRef) && nonEmpty(record.roleRevision)
    && nonEmpty(record.policyAcceptanceId) && validContextScope(record.contextScope)
    && record.authority === "NONE";
}

function createDirectPrincipalRoleAssignmentEvidenceAcceptance({
  assignmentSnapshotPort, assignmentSourceRegistryPort, principalIdentityPort,
  policyAcceptancePort, temporalFramePort, assignmentLedger
}) {
  for (const [name, port] of Object.entries({ assignmentSnapshotPort, assignmentSourceRegistryPort,
    principalIdentityPort, policyAcceptancePort, temporalFramePort })) {
    if (typeof port !== "function") throw new TypeError(`${name} must be a function`);
  }
  for (const name of ["findByAssignmentRef", "listCurrentByRoleContext", "commit"]) {
    if (!assignmentLedger || typeof assignmentLedger[name] !== "function") {
      throw new TypeError(`assignmentLedger.${name} must be a function`);
    }
  }

  function accept(request) {
    const requestFields = ["rulesetVersion", "assignmentRef", "expectedAssignmentRevision",
      "expectedSourceRevision", "expectedPrincipalRevision", "expectedPolicyAcceptanceId",
      "expectedTemporalFrameRevision"];
    if (!exact(request, requestFields) || !requestFields.every((field) => nonEmpty(request[field]))) {
      return result(ASSIGNMENT_OUTCOMES.REJECTED, "unsupported request schema");
    }
    if (request.rulesetVersion !== ASSIGNMENT_RULESET_VERSION) {
      return result(ASSIGNMENT_OUTCOMES.REJECTED, "unsupported ruleset");
    }
    const snapshotResult = callPort(assignmentSnapshotPort, { assignmentRef: request.assignmentRef });
    if (!snapshotResult.ok) return result(ASSIGNMENT_OUTCOMES.UNCERTAIN, "assignment source unavailable");
    const assignment = snapshotResult.value;
    const fields = ["type", "assignmentRef", "assignmentRevision", "sourceRef", "sourceRevision",
      "principalRef", "principalRevision", "roleRef", "roleRevision", "policyRef", "policyRevision",
      "contextScope", "validFromTemporalFrameRef", "validThroughTemporalFrameRef", "lifecycleState",
      "supersedesAssignmentRef", "assignmentEvidenceRef"];
    if (!exact(assignment, fields) || assignment.type !== "DIRECT_PRINCIPAL_ROLE_ASSIGNMENT"
      || !strings(assignment, ["assignmentRef", "assignmentRevision", "sourceRef", "sourceRevision",
        "principalRef", "principalRevision", "roleRef", "roleRevision", "policyRef", "policyRevision",
        "validFromTemporalFrameRef", "assignmentEvidenceRef"])
      || !nullableString(assignment.validThroughTemporalFrameRef)
      || !nullableString(assignment.supersedesAssignmentRef)
      || !validContextScope(assignment.contextScope) || !LIFECYCLE_STATES.has(assignment.lifecycleState)
      || assignment.assignmentRef !== request.assignmentRef) {
      return result(ASSIGNMENT_OUTCOMES.REJECTED, "invalid direct-assignment evidence");
    }
    if (assignment.assignmentRevision !== request.expectedAssignmentRevision
      || assignment.sourceRevision !== request.expectedSourceRevision
      || assignment.principalRevision !== request.expectedPrincipalRevision) {
      return result(ASSIGNMENT_OUTCOMES.STALE, "assignment, source or principal revision is stale");
    }
    const lifecycle = lifecycleOutcome(assignment.lifecycleState, ASSIGNMENT_OUTCOMES, "assignment");
    if (lifecycle) return lifecycle;

    const registryResult = callPort(assignmentSourceRegistryPort, {
      sourceRef: assignment.sourceRef, sourceRevision: assignment.sourceRevision
    });
    if (!registryResult.ok) return result(ASSIGNMENT_OUTCOMES.UNCERTAIN, "assignment registry unavailable");
    const registry = registryResult.value;
    if (!validTrustedSource(registry) || registry.sourceRef !== assignment.sourceRef
      || registry.sourceRevision !== assignment.sourceRevision) {
      return result(ASSIGNMENT_OUTCOMES.UNCERTAIN, "assignment registry evidence invalid or unbound");
    }
    if (registry.trustState !== "TRUSTED") {
      return result(ASSIGNMENT_OUTCOMES.UNCERTAIN, "assignment source is not trusted");
    }

    const principalResult = callPort(principalIdentityPort, { principalRef: assignment.principalRef });
    if (!principalResult.ok) return result(ASSIGNMENT_OUTCOMES.UNCERTAIN, "principal registry unavailable");
    const principal = principalResult.value;
    const principalProblem = principalFailure(principal, assignment.principalRef,
      request.expectedPrincipalRevision, ASSIGNMENT_OUTCOMES);
    if (principalProblem) return principalProblem;

    const policyResult = callPort(policyAcceptancePort, {
      policyRef: assignment.policyRef, policyRevision: assignment.policyRevision
    });
    if (!policyResult.ok) return result(ASSIGNMENT_OUTCOMES.UNCERTAIN, "accepted policy unavailable");
    const policy = policyResult.value;
    if (!validPolicyAcceptance(policy) || policy.policyRef !== assignment.policyRef
      || policy.policyRevision !== assignment.policyRevision
      || policy.policyAcceptanceId !== request.expectedPolicyAcceptanceId) {
      return result(ASSIGNMENT_OUTCOMES.STALE, "accepted policy identity or revision mismatch");
    }
    const role = policy.policyDocument.roles.find((item) => item.roleRef === assignment.roleRef
      && item.roleRevision === assignment.roleRevision);
    if (!role) return result(ASSIGNMENT_OUTCOMES.REJECTED, "role is not defined by exact policy revision");
    if (!policy.policyDocument.assignmentIssuerRefs.includes(assignment.sourceRef)) {
      return result(ASSIGNMENT_OUTCOMES.REJECTED, "source is not an accepted assignment issuer");
    }

    const temporalResult = callPort(temporalFramePort, {
      validFromTemporalFrameRef: assignment.validFromTemporalFrameRef,
      validThroughTemporalFrameRef: assignment.validThroughTemporalFrameRef
    });
    if (!temporalResult.ok) return result(ASSIGNMENT_OUTCOMES.UNCERTAIN, "temporal verifier unavailable");
    const temporalProblem = temporalOutcome(temporalResult.value,
      request.expectedTemporalFrameRevision, ASSIGNMENT_OUTCOMES);
    if (temporalProblem) return temporalProblem;

    let prior;
    let peers;
    try {
      prior = assignmentLedger.findByAssignmentRef(assignment.assignmentRef);
      peers = assignmentLedger.listCurrentByRoleContext({
        policyAcceptanceId: policy.policyAcceptanceId,
        roleRef: assignment.roleRef,
        roleRevision: assignment.roleRevision,
        contextScope: normalizeContextScope(assignment.contextScope)
      });
    } catch (_) {
      return result(ASSIGNMENT_OUTCOMES.UNCERTAIN, "assignment ledger unavailable");
    }
    if (!Array.isArray(prior) || !Array.isArray(peers)) {
      return result(ASSIGNMENT_OUTCOMES.UNCERTAIN, "assignment ledger evidence invalid");
    }
    if (prior.length > 1) return result(ASSIGNMENT_OUTCOMES.CONFLICT, "multiple records for assignment identity");

    const material = {
      type: "DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE",
      schemaVersion: SCHEMA_VERSION,
      rulesetVersion: ASSIGNMENT_RULESET_VERSION,
      assignmentKind: "DIRECT",
      assignmentRef: assignment.assignmentRef,
      assignmentRevision: assignment.assignmentRevision,
      assignmentContentDigest: digestValue({
        principalRef: assignment.principalRef, principalRevision: assignment.principalRevision,
        roleRef: assignment.roleRef, roleRevision: assignment.roleRevision,
        policyRef: assignment.policyRef, policyRevision: assignment.policyRevision,
        contextScope: normalizeContextScope(assignment.contextScope),
        validFromTemporalFrameRef: assignment.validFromTemporalFrameRef,
        validThroughTemporalFrameRef: assignment.validThroughTemporalFrameRef
      }),
      sourceRef: assignment.sourceRef,
      sourceRevision: assignment.sourceRevision,
      principalRef: assignment.principalRef,
      principalRevision: assignment.principalRevision,
      roleRef: assignment.roleRef,
      roleRevision: assignment.roleRevision,
      policyRef: assignment.policyRef,
      policyRevision: assignment.policyRevision,
      policyAcceptanceId: policy.policyAcceptanceId,
      contextScope: normalizeContextScope(assignment.contextScope),
      validFromTemporalFrameRef: assignment.validFromTemporalFrameRef,
      validThroughTemporalFrameRef: assignment.validThroughTemporalFrameRef,
      observedLifecycleState: assignment.lifecycleState,
      observedPrincipalLifecycleState: principal.lifecycleState,
      supersedesAssignmentRef: assignment.supersedesAssignmentRef,
      temporalFrameRevision: temporalResult.value.temporalFrameRevision,
      evidenceRefs: evidenceRefs([assignment.assignmentEvidenceRef, registry.registryEvidenceRef,
        principal.principalEvidenceRef, temporalResult.value.evidenceRef, policy.policyAcceptanceId]),
      authority: "NONE"
    };
    const assignmentAcceptanceId = `direct-role-assignment:${digestValue(material).slice(7)}`;
    const acceptance = deepFreeze({ assignmentAcceptanceId, ...material });
    if (prior.length === 1) {
      return prior[0].assignmentAcceptanceId === assignmentAcceptanceId && same(prior[0], acceptance)
        ? result(ASSIGNMENT_OUTCOMES.ALREADY_ACCEPTED, "same assignment evidence already accepted", prior[0])
        : result(ASSIGNMENT_OUTCOMES.CONFLICT, "assignment identity reused with changed material");
    }
    const incompatible = role.assignmentCardinality === "SINGLE"
      && peers.some((item) => item.principalRef !== assignment.principalRef);
    if (incompatible) {
      return result(ASSIGNMENT_OUTCOMES.CONFLICT, "conflicting current trusted role assignments");
    }
    try {
      const committed = assignmentLedger.commit(acceptance);
      return committed && same(committed, acceptance)
        ? result(ASSIGNMENT_OUTCOMES.ACCEPTED, null, committed)
        : result(ASSIGNMENT_OUTCOMES.CONFLICT, "assignment ledger returned conflicting identity");
    } catch (_) {
      return result(ASSIGNMENT_OUTCOMES.CONFLICT, "assignment ledger commit conflict");
    }
  }

  return Object.freeze({ accept });
}

function strictBase64(value) {
  if (!nonEmpty(value) || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const bytes = Buffer.from(value, "base64");
  return bytes.toString("base64") === value ? bytes : null;
}

function parseCanonicalGrant(bytes) {
  try {
    const text = bytes.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(bytes)) return null;
    const parsed = JSON.parse(text);
    return canonicalStringify(parsed) === text ? parsed : null;
  } catch (_) { return null; }
}

function validGrantDocument(grant) {
  const fields = ["grantorRef", "grantorRevision", "granteeRef", "granteeRevision", "roleRef",
    "roleRevision", "grantorAssignmentRef", "grantorAssignmentRevision", "policyRef",
    "policyRevision", "delegatedScope", "validFromTemporalFrameRef", "validThroughTemporalFrameRef",
    "chainDepth", "redelegationPermitted", "parentDelegationRef"];
  return exact(grant, fields)
    && strings(grant, ["grantorRef", "grantorRevision", "granteeRef", "granteeRevision", "roleRef",
      "roleRevision", "grantorAssignmentRef", "grantorAssignmentRevision", "policyRef",
      "policyRevision", "validFromTemporalFrameRef"])
    && nullableString(grant.validThroughTemporalFrameRef)
    && nullableString(grant.parentDelegationRef)
    && validContextScope(grant.delegatedScope)
    && Number.isInteger(grant.chainDepth) && grant.chainDepth > 0
    && typeof grant.redelegationPermitted === "boolean";
}

function validCurrentState(record, fields) {
  return exact(record, [...fields, "state", "lifecycleRevision", "contradictionState", "evidenceRef"])
    && fields.every((field) => nonEmpty(record[field]))
    && LIFECYCLE_STATES.has(record.state)
    && nonEmpty(record.lifecycleRevision) && CONTRADICTION_STATES.has(record.contradictionState)
    && nonEmpty(record.evidenceRef);
}

function currentStateFailure(record, expectedRevision, outcomes, subject) {
  if (record.lifecycleRevision !== expectedRevision) return result(outcomes.STALE, `${subject} lifecycle revision is stale`);
  if (record.contradictionState === "CONFLICT" || record.state === "CONFLICT") {
    return result(outcomes.CONFLICT, `${subject} current evidence conflicts`);
  }
  if (record.state === "UNKNOWN") return result(outcomes.UNCERTAIN, `${subject} current state is unknown`);
  if (record.state !== "CURRENT") return result(outcomes.STALE, `${subject} is not current`);
  return null;
}

function createDirectDelegationEvidenceAcceptance({
  delegationSnapshotPort, delegationSourceRegistryPort, authenticatedSourceBindingPort,
  grantorAssignmentPort, assignmentCurrentStatePort, policyAcceptancePort,
  policyCurrentStatePort, principalIdentityPort, temporalFramePort,
  delegationCurrentStatePort, delegationLedger
}) {
  for (const [name, port] of Object.entries({ delegationSnapshotPort, delegationSourceRegistryPort,
    authenticatedSourceBindingPort, grantorAssignmentPort, assignmentCurrentStatePort,
    policyAcceptancePort, policyCurrentStatePort, principalIdentityPort, temporalFramePort,
    delegationCurrentStatePort })) {
    if (typeof port !== "function") throw new TypeError(`${name} must be a function`);
  }
  for (const name of ["findByDelegationRef", "commit"]) {
    if (!delegationLedger || typeof delegationLedger[name] !== "function") {
      throw new TypeError(`delegationLedger.${name} must be a function`);
    }
  }

  function accept(request) {
    const requestFields = ["rulesetVersion", "delegationRef", "expectedDelegationRevision",
      "expectedSourceRevision", "expectedGrantorRevision", "expectedGranteeRevision",
      "expectedGrantorAssignmentAcceptanceId", "expectedAssignmentLifecycleRevision",
      "expectedPolicyAcceptanceId", "expectedPolicyLifecycleRevision",
      "expectedTemporalFrameRevision", "expectedDelegationLifecycleRevision"];
    if (!exact(request, requestFields) || !requestFields.every((field) => nonEmpty(request[field]))) {
      return result(DELEGATION_OUTCOMES.REJECTED, "unsupported request schema");
    }
    if (request.rulesetVersion !== DELEGATION_RULESET_VERSION) {
      return result(DELEGATION_OUTCOMES.REJECTED, "unsupported ruleset");
    }
    const snapshotResult = callPort(delegationSnapshotPort, { delegationRef: request.delegationRef });
    if (!snapshotResult.ok) return result(DELEGATION_OUTCOMES.UNCERTAIN, "delegation source unavailable");
    const snapshot = snapshotResult.value;
    const fields = ["type", "delegationRef", "delegationRevision", "sourceRef", "sourceRevision",
      "sourceEventBindingRef", "grantBytesBase64", "grantContentEncoding", "grantEvidenceRef"];
    if (!exact(snapshot, fields) || snapshot.type !== "DIRECT_DELEGATION_GRANT"
      || !strings(snapshot, ["delegationRef", "delegationRevision", "sourceRef", "sourceRevision",
        "sourceEventBindingRef", "grantBytesBase64", "grantContentEncoding", "grantEvidenceRef"])
      || snapshot.delegationRef !== request.delegationRef) {
      return result(DELEGATION_OUTCOMES.REJECTED, "invalid delegation evidence");
    }
    if (snapshot.delegationRevision !== request.expectedDelegationRevision
      || snapshot.sourceRevision !== request.expectedSourceRevision) {
      return result(DELEGATION_OUTCOMES.STALE, "delegation or source revision is stale");
    }
    const grantBytes = strictBase64(snapshot.grantBytesBase64);
    const grant = grantBytes && parseCanonicalGrant(grantBytes);
    if (!grant || !validGrantDocument(grant) || snapshot.grantContentEncoding !== "utf-8") {
      return result(DELEGATION_OUTCOMES.REJECTED, "grant bytes are not exact canonical delegation semantics");
    }
    if (grant.grantorRevision !== request.expectedGrantorRevision
      || grant.granteeRevision !== request.expectedGranteeRevision) {
      return result(DELEGATION_OUTCOMES.STALE, "grant principal revision is stale");
    }
    if (grant.chainDepth !== 1 || grant.parentDelegationRef !== null
      || grant.redelegationPermitted !== false) {
      return result(DELEGATION_OUTCOMES.REJECTED, "V0 permits direct non-redelegable delegation only");
    }
    if (grant.grantorRef === grant.granteeRef) {
      return result(DELEGATION_OUTCOMES.REJECTED, "delegation cycle is prohibited");
    }

    const registryResult = callPort(delegationSourceRegistryPort, {
      sourceRef: snapshot.sourceRef, sourceRevision: snapshot.sourceRevision
    });
    if (!registryResult.ok) return result(DELEGATION_OUTCOMES.UNCERTAIN, "delegation registry unavailable");
    const registry = registryResult.value;
    if (!validTrustedSource(registry) || registry.sourceRef !== snapshot.sourceRef
      || registry.sourceRevision !== snapshot.sourceRevision) {
      return result(DELEGATION_OUTCOMES.UNCERTAIN, "delegation registry evidence invalid or unbound");
    }
    if (registry.trustState !== "TRUSTED") {
      return result(DELEGATION_OUTCOMES.UNCERTAIN, "delegation source is not trusted");
    }

    const bindingResult = callPort(authenticatedSourceBindingPort, {
      bindingId: snapshot.sourceEventBindingRef
    });
    if (!bindingResult.ok) return result(DELEGATION_OUTCOMES.UNCERTAIN, "authenticated source binding unavailable");
    const binding = bindingResult.value;
    const grantDigest = sha256(grantBytes);
    if (!plain(binding) || binding.bindingId !== snapshot.sourceEventBindingRef
      || binding.originAuthenticationState !== "AUTHENTICATED"
      || binding.interactionBindingState !== "BOUND"
      || binding.contentIntegrityState !== "EXACT_BYTES"
      || binding.presentationClass !== "DIRECT"
      || binding.principalRef !== grant.grantorRef
      || binding.principalRevision !== grant.grantorRevision
      || binding.contentDigest !== grantDigest || binding.authority !== "NONE") {
      return result(DELEGATION_OUTCOMES.REJECTED, "grant is not bound to an exact direct authenticated source event");
    }
    if (binding.interactionId !== grant.delegatedScope.interactionId) {
      return result(DELEGATION_OUTCOMES.REJECTED, "delegation source event belongs to another interaction");
    }

    const assignmentResult = callPort(grantorAssignmentPort, {
      assignmentRef: grant.grantorAssignmentRef,
      assignmentRevision: grant.grantorAssignmentRevision
    });
    if (!assignmentResult.ok) return result(DELEGATION_OUTCOMES.UNCERTAIN, "grantor assignment unavailable");
    const assignment = assignmentResult.value;
    if (!validAssignmentAcceptance(assignment)
      || assignment.assignmentAcceptanceId !== request.expectedGrantorAssignmentAcceptanceId
      || assignment.assignmentRef !== grant.grantorAssignmentRef
      || assignment.assignmentRevision !== grant.grantorAssignmentRevision
      || assignment.assignmentKind !== "DIRECT" || assignment.principalRef !== grant.grantorRef
      || assignment.principalRevision !== grant.grantorRevision
      || assignment.roleRef !== grant.roleRef || assignment.roleRevision !== grant.roleRevision) {
      return result(DELEGATION_OUTCOMES.REJECTED, "exact current direct grantor assignment is not established");
    }
    const assignmentStateResult = callPort(assignmentCurrentStatePort, {
      assignmentAcceptanceId: assignment.assignmentAcceptanceId
    });
    if (!assignmentStateResult.ok) return result(DELEGATION_OUTCOMES.UNCERTAIN, "assignment current-state evidence unavailable");
    const assignmentState = assignmentStateResult.value;
    if (!validCurrentState(assignmentState, ["assignmentAcceptanceId"])
      || assignmentState.assignmentAcceptanceId !== assignment.assignmentAcceptanceId) {
      return result(DELEGATION_OUTCOMES.UNCERTAIN, "assignment current-state evidence invalid or unbound");
    }
    const assignmentStateProblem = currentStateFailure(assignmentState,
      request.expectedAssignmentLifecycleRevision, DELEGATION_OUTCOMES, "grantor assignment");
    if (assignmentStateProblem) return assignmentStateProblem;

    const policyResult = callPort(policyAcceptancePort, {
      policyRef: grant.policyRef, policyRevision: grant.policyRevision
    });
    if (!policyResult.ok) return result(DELEGATION_OUTCOMES.UNCERTAIN, "accepted policy unavailable");
    const policy = policyResult.value;
    if (!validPolicyAcceptance(policy) || policy.policyAcceptanceId !== request.expectedPolicyAcceptanceId
      || policy.policyRef !== grant.policyRef || policy.policyRevision !== grant.policyRevision
      || assignment.policyAcceptanceId !== policy.policyAcceptanceId) {
      return result(DELEGATION_OUTCOMES.STALE, "exact accepted policy is not established");
    }
    const policyStateResult = callPort(policyCurrentStatePort, { policyAcceptanceId: policy.policyAcceptanceId });
    if (!policyStateResult.ok) return result(DELEGATION_OUTCOMES.UNCERTAIN, "policy current-state evidence unavailable");
    const policyState = policyStateResult.value;
    if (!validCurrentState(policyState, ["policyAcceptanceId"])
      || policyState.policyAcceptanceId !== policy.policyAcceptanceId) {
      return result(DELEGATION_OUTCOMES.UNCERTAIN, "policy current-state evidence invalid or unbound");
    }
    const policyStateProblem = currentStateFailure(policyState,
      request.expectedPolicyLifecycleRevision, DELEGATION_OUTCOMES, "policy");
    if (policyStateProblem) return policyStateProblem;
    const role = policy.policyDocument.roles.find((item) => item.roleRef === grant.roleRef
      && item.roleRevision === grant.roleRevision);
    if (!role || role.delegable !== true || role.maxDelegationDepth < 1
      || role.redelegationPermitted !== false) {
      return result(DELEGATION_OUTCOMES.REJECTED, "exact policy does not permit direct non-redelegable delegation");
    }
    if (!scopeContains(assignment.contextScope, grant.delegatedScope)) {
      return result(DELEGATION_OUTCOMES.REJECTED, "delegated scope exceeds or differs from grantor scope");
    }

    for (const [label, principalRef, principalRevision] of [
      ["grantor", grant.grantorRef, grant.grantorRevision],
      ["grantee", grant.granteeRef, grant.granteeRevision]
    ]) {
      const principalResult = callPort(principalIdentityPort, { principalRef });
      if (!principalResult.ok) return result(DELEGATION_OUTCOMES.UNCERTAIN, `${label} principal unavailable`);
      const problem = principalFailure(principalResult.value, principalRef, principalRevision, DELEGATION_OUTCOMES);
      if (problem) return problem;
    }

    const temporalResult = callPort(temporalFramePort, {
      validFromTemporalFrameRef: grant.validFromTemporalFrameRef,
      validThroughTemporalFrameRef: grant.validThroughTemporalFrameRef
    });
    if (!temporalResult.ok) return result(DELEGATION_OUTCOMES.UNCERTAIN, "temporal verifier unavailable");
    const temporalProblem = temporalOutcome(temporalResult.value,
      request.expectedTemporalFrameRevision, DELEGATION_OUTCOMES);
    if (temporalProblem) return temporalProblem;

    const delegationStateResult = callPort(delegationCurrentStatePort, {
      delegationRef: snapshot.delegationRef, delegationRevision: snapshot.delegationRevision
    });
    if (!delegationStateResult.ok) return result(DELEGATION_OUTCOMES.UNCERTAIN, "delegation lifecycle unavailable");
    const delegationState = delegationStateResult.value;
    if (!validCurrentState(delegationState, ["delegationRef", "delegationRevision"])
      || delegationState.delegationRef !== snapshot.delegationRef
      || delegationState.delegationRevision !== snapshot.delegationRevision) {
      return result(DELEGATION_OUTCOMES.UNCERTAIN, "delegation lifecycle evidence invalid or unbound");
    }
    const delegationStateProblem = currentStateFailure(delegationState,
      request.expectedDelegationLifecycleRevision, DELEGATION_OUTCOMES, "delegation");
    if (delegationStateProblem) return delegationStateProblem;

    const material = {
      type: "DIRECT_DELEGATION_EVIDENCE_ACCEPTANCE",
      schemaVersion: SCHEMA_VERSION,
      rulesetVersion: DELEGATION_RULESET_VERSION,
      delegationRef: snapshot.delegationRef,
      delegationRevision: snapshot.delegationRevision,
      delegationContentDigest: grantDigest,
      sourceRef: snapshot.sourceRef,
      sourceRevision: snapshot.sourceRevision,
      sourceEventBindingRef: snapshot.sourceEventBindingRef,
      grantorRef: grant.grantorRef,
      grantorRevision: grant.grantorRevision,
      granteeRef: grant.granteeRef,
      granteeRevision: grant.granteeRevision,
      roleRef: grant.roleRef,
      roleRevision: grant.roleRevision,
      grantorAssignmentRef: grant.grantorAssignmentRef,
      grantorAssignmentRevision: grant.grantorAssignmentRevision,
      grantorAssignmentAcceptanceId: assignment.assignmentAcceptanceId,
      policyRef: grant.policyRef,
      policyRevision: grant.policyRevision,
      policyAcceptanceId: policy.policyAcceptanceId,
      delegatedScope: normalizeContextScope(grant.delegatedScope),
      validFromTemporalFrameRef: grant.validFromTemporalFrameRef,
      validThroughTemporalFrameRef: grant.validThroughTemporalFrameRef,
      chainDepth: 1,
      redelegationPermitted: false,
      parentDelegationRef: null,
      observedLifecycleState: delegationState.state,
      assignmentLifecycleRevision: assignmentState.lifecycleRevision,
      policyLifecycleRevision: policyState.lifecycleRevision,
      delegationLifecycleRevision: delegationState.lifecycleRevision,
      temporalFrameRevision: temporalResult.value.temporalFrameRevision,
      evidenceRefs: evidenceRefs([snapshot.grantEvidenceRef, registry.registryEvidenceRef,
        snapshot.sourceEventBindingRef, assignment.assignmentAcceptanceId, assignmentState.evidenceRef,
        policy.policyAcceptanceId, policyState.evidenceRef, temporalResult.value.evidenceRef,
        delegationState.evidenceRef]),
      authority: "NONE"
    };
    const delegationAcceptanceId = `direct-delegation:${digestValue(material).slice(7)}`;
    const acceptance = deepFreeze({ delegationAcceptanceId, ...material });
    let prior;
    try { prior = delegationLedger.findByDelegationRef(snapshot.delegationRef); }
    catch (_) { return result(DELEGATION_OUTCOMES.UNCERTAIN, "delegation ledger unavailable"); }
    if (!Array.isArray(prior)) return result(DELEGATION_OUTCOMES.UNCERTAIN, "delegation ledger evidence invalid");
    if (prior.length > 1) return result(DELEGATION_OUTCOMES.CONFLICT, "multiple records for delegation identity");
    if (prior.length === 1) {
      return prior[0].delegationAcceptanceId === delegationAcceptanceId && same(prior[0], acceptance)
        ? result(DELEGATION_OUTCOMES.ALREADY_ACCEPTED, "same delegation evidence already accepted", prior[0])
        : result(DELEGATION_OUTCOMES.CONFLICT, "delegation identity reused with changed material");
    }
    try {
      const committed = delegationLedger.commit(acceptance);
      return committed && same(committed, acceptance)
        ? result(DELEGATION_OUTCOMES.ACCEPTED, null, committed)
        : result(DELEGATION_OUTCOMES.CONFLICT, "delegation ledger returned conflicting identity");
    } catch (_) {
      return result(DELEGATION_OUTCOMES.CONFLICT, "delegation ledger commit conflict");
    }
  }

  return Object.freeze({ accept });
}

module.exports = Object.freeze({
  POLICY_RULESET_VERSION,
  ASSIGNMENT_RULESET_VERSION,
  DELEGATION_RULESET_VERSION,
  POLICY_OUTCOMES,
  ASSIGNMENT_OUTCOMES,
  DELEGATION_OUTCOMES,
  canonicalStringify,
  createGovernanceRolePolicyRequirementEvidenceAcceptance,
  createDirectPrincipalRoleAssignmentEvidenceAcceptance,
  createDirectDelegationEvidenceAcceptance
});
