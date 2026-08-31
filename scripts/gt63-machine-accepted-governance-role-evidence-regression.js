"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  POLICY_RULESET_VERSION,
  ASSIGNMENT_RULESET_VERSION,
  DELEGATION_RULESET_VERSION,
  POLICY_OUTCOMES: PO,
  ASSIGNMENT_OUTCOMES: AO,
  DELEGATION_OUTCOMES: DO,
  canonicalStringify,
  createGovernanceRolePolicyRequirementEvidenceAcceptance,
  createDirectPrincipalRoleAssignmentEvidenceAcceptance,
  createDirectDelegationEvidenceAcceptance
} = require("./gt63-machine/accepted-governance-role-evidence");

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const digest = (value) => `sha256:${hash(value)}`;
const SCOPE_DIGEST = `sha256:${"a".repeat(64)}`;
const CONTRACT_DIGEST = `sha256:${"b".repeat(64)}`;

function immutableLedger(idField, refField, extra = {}) {
  const records = [];
  return {
    records,
    find(ref) { return records.filter((record) => record[refField] === ref).map(clone); },
    commit(record) {
      if (records.some((item) => item[idField] === record[idField])) throw new Error("identity conflict");
      const saved = clone(record);
      records.push(saved);
      return clone(saved);
    },
    ...extra(records)
  };
}

function gateScope(patch = {}) {
  return {
    scopeType: "GATE",
    interactionId: "interaction-1",
    fromInteractionRevision: 2,
    throughInteractionRevision: 10,
    gateId: "gate-1",
    gateRevision: 1,
    authorityScopeDigest: SCOPE_DIGEST,
    continuationTargetRef: "repo.entrypoint.syntax-check@1",
    ...clone(patch)
  };
}

function interactionScope(patch = {}) {
  return {
    scopeType: "INTERACTION",
    interactionId: "interaction-1",
    fromInteractionRevision: 0,
    throughInteractionRevision: null,
    ...clone(patch)
  };
}

function intentScope(patch = {}) {
  return {
    scopeType: "INTENT",
    interactionId: "interaction-1",
    fromInteractionRevision: 0,
    throughInteractionRevision: null,
    intentContractRef: "intent-contract-1",
    intentContractDigest: CONTRACT_DIGEST,
    ...clone(patch)
  };
}

function basePolicyDocument() {
  return {
    roles: [
      { roleRef: "INTERACTION_OWNER", roleRevision: "1", assignmentCardinality: "SINGLE",
        delegable: false, maxDelegationDepth: 0, redelegationPermitted: false },
      { roleRef: "INTENT_AUTHOR", roleRevision: "1", assignmentCardinality: "MULTIPLE",
        delegable: false, maxDelegationDepth: 0, redelegationPermitted: false },
      { roleRef: "INTENT_CONFIRMER", roleRevision: "1", assignmentCardinality: "MULTIPLE",
        delegable: false, maxDelegationDepth: 0, redelegationPermitted: false },
      { roleRef: "GATE_AUTHORIZER", roleRevision: "1", assignmentCardinality: "MULTIPLE",
        delegable: true, maxDelegationDepth: 1, redelegationPermitted: false }
    ],
    requirements: [
      { requirementRef: "requirement-owner-1", requirementRevision: "1",
        governanceAct: "INTERACTION_OWNERSHIP", requiredRoleRef: "INTERACTION_OWNER",
        requiredRoleRevision: "1", contextScope: interactionScope() },
      { requirementRef: "requirement-intent-author-1", requirementRevision: "1",
        governanceAct: "INTENT_AUTHORSHIP", requiredRoleRef: "INTENT_AUTHOR",
        requiredRoleRevision: "1", contextScope: intentScope() },
      { requirementRef: "requirement-intent-confirm-1", requirementRevision: "1",
        governanceAct: "INTENT_CONFIRMATION", requiredRoleRef: "INTENT_CONFIRMER",
        requiredRoleRevision: "1", contextScope: intentScope() },
      { requirementRef: "requirement-gate-authorizer-1", requirementRevision: "1",
        governanceAct: "GATE_AUTHORIZATION", requiredRoleRef: "GATE_AUTHORIZER",
        requiredRoleRevision: "1", contextScope: gateScope() }
    ],
    assignmentIssuerRefs: ["registry:governance-assignments"]
  };
}

function policySystem(options = {}) {
  const state = {
    policy: {
      type: "GOVERNANCE_ROLE_POLICY",
      policyRef: "governance-policy-1",
      policyRevision: "1",
      sourceRef: "registry:governance-policy",
      sourceRevision: "7",
      policyDocument: basePolicyDocument(),
      validFromTemporalFrameRef: "time:policy-start",
      validThroughTemporalFrameRef: null,
      lifecycleState: "CURRENT",
      supersedesPolicyRef: null,
      policyEvidenceRef: "evidence:policy-1",
      ...clone(options.policyPatch || {})
    },
    registry: {
      sourceRef: "registry:governance-policy", sourceRevision: "7",
      trustState: "TRUSTED", registryEvidenceRef: "evidence:policy-registry-7",
      ...clone(options.registryPatch || {})
    },
    temporal: {
      state: "CURRENT", temporalFrameRevision: "11", evidenceRef: "evidence:time-policy-11",
      ...clone(options.temporalPatch || {})
    }
  };
  const ledger = immutableLedger("policyAcceptanceId", "policyRef", () => ({
    findByPolicyRef(ref) { return this.find(ref); }
  }));
  if (Array.isArray(options.seed)) ledger.records.push(...clone(options.seed));
  const component = createGovernanceRolePolicyRequirementEvidenceAcceptance({
    policySnapshotPort() { if (options.failPolicy) throw new Error("unavailable"); return clone(state.policy); },
    policySourceRegistryPort() { if (options.failRegistry) throw new Error("unavailable"); return clone(state.registry); },
    temporalFramePort() { if (options.failTemporal) throw new Error("unavailable"); return clone(state.temporal); },
    policyLedger: ledger
  });
  const request = (patch = {}) => ({
    rulesetVersion: POLICY_RULESET_VERSION,
    policyRef: "governance-policy-1",
    expectedPolicyRevision: "1",
    expectedSourceRevision: "7",
    expectedTemporalFrameRevision: "11",
    ...clone(patch)
  });
  return { state, ledger, component, request };
}

function acceptedPolicy(options = {}) {
  const env = policySystem(options);
  const response = env.component.accept(env.request());
  assert.equal(response.outcome, PO.ACCEPTED);
  return response.evidence;
}

function assignmentSystem(options = {}) {
  const policy = options.policy || acceptedPolicy();
  const roleRef = options.roleRef || "GATE_AUTHORIZER";
  const roleRevision = options.roleRevision || "1";
  const contextScope = options.contextScope || (roleRef === "INTERACTION_OWNER" ? interactionScope() : gateScope());
  const state = {
    assignment: {
      type: "DIRECT_PRINCIPAL_ROLE_ASSIGNMENT",
      assignmentRef: options.assignmentRef || "assignment-alice-gate",
      assignmentRevision: "1",
      sourceRef: "registry:governance-assignments",
      sourceRevision: "4",
      principalRef: options.principalRef || "principal:alice",
      principalRevision: options.principalRevision || "3",
      roleRef,
      roleRevision,
      policyRef: policy.policyRef,
      policyRevision: policy.policyRevision,
      contextScope: clone(contextScope),
      validFromTemporalFrameRef: "time:assignment-start",
      validThroughTemporalFrameRef: null,
      lifecycleState: "CURRENT",
      supersedesAssignmentRef: null,
      assignmentEvidenceRef: `evidence:${options.assignmentRef || "assignment-alice-gate"}`,
      ...clone(options.assignmentPatch || {})
    },
    registry: {
      sourceRef: "registry:governance-assignments", sourceRevision: "4",
      trustState: "TRUSTED", registryEvidenceRef: "evidence:assignment-registry-4",
      ...clone(options.registryPatch || {})
    },
    principal: {
      principalRef: options.principalRef || "principal:alice",
      principalRevision: options.principalRevision || "3",
      lifecycleState: "CURRENT", freshnessState: "CURRENT", contradictionState: "NONE",
      principalEvidenceRef: `evidence:${options.principalRef || "principal:alice"}`,
      ...clone(options.principalPatch || {})
    },
    temporal: {
      state: "CURRENT", temporalFrameRevision: "12", evidenceRef: "evidence:time-assignment-12",
      ...clone(options.temporalPatch || {})
    }
  };
  const ledger = immutableLedger("assignmentAcceptanceId", "assignmentRef", (records) => ({
    findByAssignmentRef(ref) { return records.filter((item) => item.assignmentRef === ref).map(clone); },
    listCurrentByRoleContext(query) {
      return records.filter((item) => item.policyAcceptanceId === query.policyAcceptanceId
        && item.roleRef === query.roleRef && item.roleRevision === query.roleRevision
        && canonicalStringify(item.contextScope) === canonicalStringify(query.contextScope)).map(clone);
    }
  }));
  if (Array.isArray(options.seed)) ledger.records.push(...clone(options.seed));
  const component = createDirectPrincipalRoleAssignmentEvidenceAcceptance({
    assignmentSnapshotPort() { if (options.failAssignment) throw new Error("unavailable"); return clone(state.assignment); },
    assignmentSourceRegistryPort() { if (options.failRegistry) throw new Error("unavailable"); return clone(state.registry); },
    principalIdentityPort() { if (options.failPrincipal) throw new Error("unavailable"); return clone(state.principal); },
    policyAcceptancePort() { if (options.failPolicy) throw new Error("unavailable"); return clone(policy); },
    temporalFramePort() { if (options.failTemporal) throw new Error("unavailable"); return clone(state.temporal); },
    assignmentLedger: ledger
  });
  const request = (patch = {}) => ({
    rulesetVersion: ASSIGNMENT_RULESET_VERSION,
    assignmentRef: state.assignment.assignmentRef,
    expectedAssignmentRevision: "1",
    expectedSourceRevision: "4",
    expectedPrincipalRevision: options.principalRevision || "3",
    expectedPolicyAcceptanceId: policy.policyAcceptanceId,
    expectedTemporalFrameRevision: "12",
    ...clone(patch)
  });
  return { state, ledger, policy, component, request };
}

function acceptedAssignment(options = {}) {
  const env = assignmentSystem(options);
  const response = env.component.accept(env.request());
  assert.equal(response.outcome, AO.ACCEPTED);
  return { policy: env.policy, assignment: response.evidence };
}

function delegationSystem(options = {}) {
  const roleRef = options.roleRef || "GATE_AUTHORIZER";
  const delegatedScope = options.delegatedScope || (roleRef === "INTERACTION_OWNER"
    ? interactionScope({ fromInteractionRevision: 2, throughInteractionRevision: 8 })
    : gateScope({ fromInteractionRevision: 3, throughInteractionRevision: 8 }));
  const foundation = acceptedAssignment({
    roleRef,
    contextScope: options.assignmentScope || (roleRef === "INTERACTION_OWNER" ? interactionScope() : gateScope()),
    assignmentRef: options.assignmentRef || `assignment-alice-${roleRef.toLowerCase()}`
  });
  const policy = foundation.policy;
  const assignment = foundation.assignment;
  const state = {
    grant: {
      grantorRef: "principal:alice", grantorRevision: "3",
      granteeRef: "principal:bob", granteeRevision: "5",
      roleRef, roleRevision: "1",
      grantorAssignmentRef: assignment.assignmentRef,
      grantorAssignmentRevision: assignment.assignmentRevision,
      policyRef: policy.policyRef, policyRevision: policy.policyRevision,
      delegatedScope: clone(delegatedScope),
      validFromTemporalFrameRef: "time:delegation-start",
      validThroughTemporalFrameRef: "time:delegation-end",
      chainDepth: 1, redelegationPermitted: false, parentDelegationRef: null,
      ...clone(options.grantPatch || {})
    },
    registry: {
      sourceRef: "registry:delegation-grants", sourceRevision: "2",
      trustState: "TRUSTED", registryEvidenceRef: "evidence:delegation-registry-2",
      ...clone(options.registryPatch || {})
    },
    assignmentState: {
      assignmentAcceptanceId: assignment.assignmentAcceptanceId,
      state: "CURRENT", lifecycleRevision: "21", contradictionState: "NONE",
      evidenceRef: "evidence:assignment-current-21",
      ...clone(options.assignmentStatePatch || {})
    },
    policyState: {
      policyAcceptanceId: policy.policyAcceptanceId,
      state: "CURRENT", lifecycleRevision: "22", contradictionState: "NONE",
      evidenceRef: "evidence:policy-current-22",
      ...clone(options.policyStatePatch || {})
    },
    principals: {
      "principal:alice": { principalRef: "principal:alice", principalRevision: "3",
        lifecycleState: "CURRENT", freshnessState: "CURRENT", contradictionState: "NONE",
        principalEvidenceRef: "evidence:alice-current" },
      "principal:bob": { principalRef: "principal:bob", principalRevision: "5",
        lifecycleState: "CURRENT", freshnessState: "CURRENT", contradictionState: "NONE",
        principalEvidenceRef: "evidence:bob-current" }
    },
    temporal: {
      state: "CURRENT", temporalFrameRevision: "23", evidenceRef: "evidence:time-delegation-23",
      ...clone(options.temporalPatch || {})
    },
    delegationState: {
      delegationRef: options.delegationRef || "delegation-alice-bob-gate",
      delegationRevision: "1", state: "CURRENT", lifecycleRevision: "24",
      contradictionState: "NONE", evidenceRef: "evidence:delegation-current-24",
      ...clone(options.delegationStatePatch || {})
    }
  };
  if (options.grantorPrincipalPatch) Object.assign(state.principals["principal:alice"], clone(options.grantorPrincipalPatch));
  if (options.granteePrincipalPatch) Object.assign(state.principals["principal:bob"], clone(options.granteePrincipalPatch));

  function grantBytes() { return Buffer.from(canonicalStringify(state.grant), "utf8"); }
  function snapshot() {
    return {
      type: "DIRECT_DELEGATION_GRANT",
      delegationRef: state.delegationState.delegationRef,
      delegationRevision: state.delegationState.delegationRevision,
      sourceRef: "registry:delegation-grants",
      sourceRevision: "2",
      sourceEventBindingRef: "human-source-binding:grant-1",
      grantBytesBase64: grantBytes().toString("base64"),
      grantContentEncoding: "utf-8",
      grantEvidenceRef: "evidence:grant-1",
      ...clone(options.snapshotPatch || {})
    };
  }
  function binding() {
    return {
      bindingId: "human-source-binding:grant-1",
      principalRef: state.grant.grantorRef,
      principalRevision: state.grant.grantorRevision,
      contentDigest: digest(grantBytes()),
      interactionId: state.grant.delegatedScope.interactionId,
      originAuthenticationState: "AUTHENTICATED",
      contentIntegrityState: "EXACT_BYTES",
      interactionBindingState: "BOUND",
      presentationClass: "DIRECT",
      authority: "NONE",
      ...clone(options.bindingPatch || {})
    };
  }
  const ledger = immutableLedger("delegationAcceptanceId", "delegationRef", () => ({
    findByDelegationRef(ref) { return this.find(ref); }
  }));
  const component = createDirectDelegationEvidenceAcceptance({
    delegationSnapshotPort() { if (options.failDelegation) throw new Error("unavailable"); return snapshot(); },
    delegationSourceRegistryPort() { if (options.failRegistry) throw new Error("unavailable"); return clone(state.registry); },
    authenticatedSourceBindingPort() { if (options.failBinding) throw new Error("unavailable"); return binding(); },
    grantorAssignmentPort() { if (options.noAssignment) return null; return clone(assignment); },
    assignmentCurrentStatePort() { if (options.failAssignmentState) throw new Error("unavailable"); return clone(state.assignmentState); },
    policyAcceptancePort() { if (options.failPolicy) throw new Error("unavailable"); return clone(policy); },
    policyCurrentStatePort() { if (options.failPolicyState) throw new Error("unavailable"); return clone(state.policyState); },
    principalIdentityPort({ principalRef }) {
      if (options.failPrincipal) throw new Error("unavailable");
      return clone(state.principals[principalRef]);
    },
    temporalFramePort() { if (options.failTemporal) throw new Error("unavailable"); return clone(state.temporal); },
    delegationCurrentStatePort() { if (options.failLifecycle) throw new Error("unavailable"); return clone(state.delegationState); },
    delegationLedger: ledger
  });
  const request = (patch = {}) => ({
    rulesetVersion: DELEGATION_RULESET_VERSION,
    delegationRef: state.delegationState.delegationRef,
    expectedDelegationRevision: "1",
    expectedSourceRevision: "2",
    expectedGrantorRevision: "3",
    expectedGranteeRevision: "5",
    expectedGrantorAssignmentAcceptanceId: assignment.assignmentAcceptanceId,
    expectedAssignmentLifecycleRevision: "21",
    expectedPolicyAcceptanceId: policy.policyAcceptanceId,
    expectedPolicyLifecycleRevision: "22",
    expectedTemporalFrameRevision: "23",
    expectedDelegationLifecycleRevision: "24",
    ...clone(patch)
  });
  return { state, ledger, policy, assignment, component, request, snapshot, binding };
}

function runSuite() {
  const cases = [];
  function check(name, test) { test(); cases.push(name); }

  check("policy-exact-schema-rejects-caller-eligible", () => {
    const h = policySystem();
    assert.equal(h.component.accept({ ...h.request(), eligible: true }).outcome, PO.REJECTED);
  });
  check("policy-unsupported-ruleset-rejected", () => {
    const h = policySystem(); assert.equal(h.component.accept(h.request({ rulesetVersion: "future" })).outcome, PO.REJECTED);
  });
  check("policy-evidence-accepted", () => assert.equal(policySystem().component.accept(policySystem().request()).outcome, PO.ACCEPTED));
  check("policy-duplicate-idempotent", () => {
    const h = policySystem(); const first = h.component.accept(h.request()); const second = h.component.accept(h.request());
    assert.equal(second.outcome, PO.ALREADY_ACCEPTED); assert.deepEqual(second.evidence, first.evidence);
  });
  check("policy-same-identity-changed-material-conflicts", () => {
    const h = policySystem(); h.component.accept(h.request());
    h.state.policy.policyDocument.requirements[0].requirementRevision = "2";
    assert.equal(h.component.accept(h.request()).outcome, PO.CONFLICT);
  });
  check("policy-revision-drift-stale", () => {
    const h = policySystem(); assert.equal(h.component.accept(h.request({ expectedPolicyRevision: "2" })).outcome, PO.STALE);
  });
  check("policy-revoked-stale-not-rewritten", () => {
    const h = policySystem({ policyPatch: { lifecycleState: "REVOKED" } });
    assert.equal(h.component.accept(h.request()).outcome, PO.STALE); assert.equal(h.ledger.records.length, 0);
  });
  check("policy-unknown-preserved", () => {
    const h = policySystem({ policyPatch: { lifecycleState: "UNKNOWN" } });
    assert.equal(h.component.accept(h.request()).outcome, PO.UNCERTAIN);
  });
  check("policy-conflict-preserved", () => {
    const h = policySystem({ policyPatch: { lifecycleState: "CONFLICT" } });
    assert.equal(h.component.accept(h.request()).outcome, PO.CONFLICT);
  });
  check("policy-untrusted-source-uncertain", () => {
    const h = policySystem({ registryPatch: { trustState: "UNTRUSTED" } });
    assert.equal(h.component.accept(h.request()).outcome, PO.UNCERTAIN);
  });
  check("policy-requirements-keep-owner-and-authorizer-distinct", () => {
    const h = policySystem(); const evidence = h.component.accept(h.request()).evidence;
    const pairs = evidence.policyDocument.requirements.map((item) => [item.governanceAct, item.requiredRoleRef]);
    assert.ok(pairs.some(([act, role]) => act === "INTERACTION_OWNERSHIP" && role === "INTERACTION_OWNER"));
    assert.ok(pairs.some(([act, role]) => act === "GATE_AUTHORIZATION" && role === "GATE_AUTHORIZER"));
  });
  check("policy-authority-none", () => {
    const response = policySystem().component.accept(policySystem().request());
    assert.equal(response.authority, "NONE"); assert.equal(response.evidence.authority, "NONE");
  });

  check("assignment-evidence-accepted", () => {
    const h = assignmentSystem(); assert.equal(h.component.accept(h.request()).outcome, AO.ACCEPTED);
  });
  check("assignment-duplicate-idempotent", () => {
    const h = assignmentSystem(); const first = h.component.accept(h.request()); const second = h.component.accept(h.request());
    assert.equal(second.outcome, AO.ALREADY_ACCEPTED); assert.deepEqual(second.evidence, first.evidence);
  });
  check("authenticated-attacker-owner-claim-is-not-assignment", () => {
    const h = assignmentSystem({ roleRef: "INTERACTION_OWNER", principalRef: "principal:attacker",
      registryPatch: { trustState: "UNTRUSTED" } });
    assert.equal(h.component.accept(h.request()).outcome, AO.UNCERTAIN); assert.equal(h.ledger.records.length, 0);
  });
  check("owner-assignment-does-not-imply-gate-authorizer", () => {
    const h = assignmentSystem({ roleRef: "INTERACTION_OWNER" }); const evidence = h.component.accept(h.request()).evidence;
    assert.equal(evidence.roleRef, "INTERACTION_OWNER");
    assert.equal("gateAuthorizer" in evidence, false); assert.equal("eligible" in evidence, false);
  });
  check("assignment-caller-eligible-rejected", () => {
    const h = assignmentSystem(); assert.equal(h.component.accept({ ...h.request(), eligible: true }).outcome, AO.REJECTED);
  });
  check("assignment-caller-authorized-by-rejected", () => {
    const h = assignmentSystem(); assert.equal(h.component.accept({ ...h.request(), authorizedBy: "principal:alice" }).outcome, AO.REJECTED);
  });
  check("assignment-missing-evidence-unknown-not-ineligible", () => {
    const h = assignmentSystem({ failAssignment: true }); const response = h.component.accept(h.request());
    assert.equal(response.outcome, AO.UNCERTAIN); assert.equal(response.outcome.includes("NOT_ELIGIBLE"), false);
  });
  check("assignment-revoked-is-stale", () => {
    const h = assignmentSystem({ assignmentPatch: { lifecycleState: "REVOKED" } });
    assert.equal(h.component.accept(h.request()).outcome, AO.STALE);
  });
  check("assignment-replay-after-revocation-invalidates-current-use", () => {
    const h = assignmentSystem(); const accepted = h.component.accept(h.request());
    h.state.assignment.lifecycleState = "REVOKED";
    assert.equal(h.component.accept(h.request()).outcome, AO.STALE);
    assert.deepEqual(h.ledger.records[0], accepted.evidence);
  });
  check("assignment-principal-revision-drift-stale", () => {
    const h = assignmentSystem(); assert.equal(h.component.accept(h.request({ expectedPrincipalRevision: "4" })).outcome, AO.STALE);
  });
  check("assignment-policy-revision-drift-stale", () => {
    const h = assignmentSystem(); assert.equal(h.component.accept(h.request({ expectedPolicyAcceptanceId: "wrong" })).outcome, AO.STALE);
  });
  check("assignment-role-revision-drift-rejected", () => {
    const h = assignmentSystem({ roleRevision: "2" }); assert.equal(h.component.accept(h.request()).outcome, AO.REJECTED);
  });
  check("assignment-cross-interaction-identity-reuse-conflicts", () => {
    const h = assignmentSystem(); h.component.accept(h.request());
    h.state.assignment.contextScope.interactionId = "interaction-2";
    assert.equal(h.component.accept(h.request()).outcome, AO.CONFLICT);
  });
  check("conflicting-trusted-single-role-assignments-conflict", () => {
    const first = acceptedAssignment({ roleRef: "INTERACTION_OWNER", assignmentRef: "owner-1" }).assignment;
    const h = assignmentSystem({ roleRef: "INTERACTION_OWNER", assignmentRef: "owner-2",
      principalRef: "principal:bob", principalRevision: "5", seed: [first] });
    assert.equal(h.component.accept(h.request()).outcome, AO.CONFLICT);
  });
  check("conflicting-owner-records-have-no-arbitrary-winner", () => {
    const first = acceptedAssignment({ roleRef: "INTERACTION_OWNER", assignmentRef: "owner-a" }).assignment;
    const h = assignmentSystem({ roleRef: "INTERACTION_OWNER", assignmentRef: "owner-b",
      principalRef: "principal:bob", principalRevision: "5", seed: [first] });
    const response = h.component.accept(h.request());
    assert.equal(response.outcome, AO.CONFLICT); assert.equal(h.ledger.records.length, 1);
  });
  check("assignment-same-identity-changed-material-conflicts", () => {
    const h = assignmentSystem(); h.component.accept(h.request()); h.state.assignment.validThroughTemporalFrameRef = "time:new-end";
    assert.equal(h.component.accept(h.request()).outcome, AO.CONFLICT);
  });
  check("deactivated-principal-invalidates-current-assignment", () => {
    const h = assignmentSystem({ principalPatch: { lifecycleState: "DEACTIVATED" } });
    assert.equal(h.component.accept(h.request()).outcome, AO.STALE);
  });
  check("assignment-authority-none", () => {
    const h = assignmentSystem(); const response = h.component.accept(h.request());
    assert.equal(response.authority, "NONE"); assert.equal(response.evidence.authority, "NONE");
  });

  check("direct-delegation-evidence-accepted", () => {
    const h = delegationSystem(); assert.equal(h.component.accept(h.request()).outcome, DO.ACCEPTED);
  });
  check("direct-delegation-duplicate-idempotent", () => {
    const h = delegationSystem(); const first = h.component.accept(h.request()); const second = h.component.accept(h.request());
    assert.equal(second.outcome, DO.ALREADY_ACCEPTED); assert.deepEqual(second.evidence, first.evidence);
  });
  check("forwarded-approval-is-not-delegation", () => {
    const h = delegationSystem({ bindingPatch: { presentationClass: "FORWARDED" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.REJECTED);
  });
  check("delegation-without-direct-grantor-assignment-rejected", () => {
    const h = delegationSystem({ noAssignment: true }); assert.equal(h.component.accept(h.request()).outcome, DO.REJECTED);
  });
  check("expired-delegation-stale", () => {
    const h = delegationSystem({ temporalPatch: { state: "STALE" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.STALE);
  });
  check("revoked-delegation-stale", () => {
    const h = delegationSystem({ delegationStatePatch: { state: "REVOKED" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.STALE);
  });
  check("superseded-delegation-stale", () => {
    const h = delegationSystem({ delegationStatePatch: { state: "SUPERSEDED" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.STALE);
  });
  check("historical-delegation-survives-later-revocation", () => {
    const h = delegationSystem(); const accepted = h.component.accept(h.request());
    h.state.delegationState.state = "REVOKED";
    assert.equal(h.component.accept(h.request()).outcome, DO.STALE);
    assert.deepEqual(h.ledger.records[0], accepted.evidence);
  });
  check("cross-interaction-delegation-reuse-rejected", () => {
    const h = delegationSystem({ bindingPatch: { interactionId: "interaction-2" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.REJECTED);
  });
  check("cross-gate-delegation-reuse-rejected", () => {
    const h = delegationSystem({ grantPatch: { delegatedScope: gateScope({ gateId: "gate-2" }) } });
    assert.equal(h.component.accept(h.request()).outcome, DO.REJECTED);
  });
  check("delegation-policy-revision-drift-stale", () => {
    const h = delegationSystem(); assert.equal(h.component.accept(h.request({ expectedPolicyAcceptanceId: "wrong" })).outcome, DO.STALE);
  });
  check("delegation-policy-lifecycle-drift-stale", () => {
    const h = delegationSystem({ policyStatePatch: { lifecycleRevision: "23" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.STALE);
  });
  check("delegation-principal-revision-drift-stale", () => {
    const h = delegationSystem(); assert.equal(h.component.accept(h.request({ expectedGranteeRevision: "6" })).outcome, DO.STALE);
  });
  check("delegation-role-revision-drift-rejected", () => {
    const h = delegationSystem({ grantPatch: { roleRevision: "2" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.REJECTED);
  });
  check("delegation-cannot-silently-become-ownership", () => {
    const h = delegationSystem({ roleRef: "INTERACTION_OWNER" });
    assert.equal(h.component.accept(h.request()).outcome, DO.REJECTED);
  });
  check("unauthorized-redelegation-rejected", () => {
    const h = delegationSystem({ grantPatch: { redelegationPermitted: true } });
    assert.equal(h.component.accept(h.request()).outcome, DO.REJECTED);
  });
  check("delegation-depth-greater-than-one-rejected", () => {
    const h = delegationSystem({ grantPatch: { chainDepth: 2, parentDelegationRef: "delegation-parent" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.REJECTED);
  });
  check("delegation-cycle-rejected", () => {
    const h = delegationSystem({ grantPatch: { granteeRef: "principal:alice", granteeRevision: "3" } });
    assert.equal(h.component.accept(h.request({ expectedGranteeRevision: "3" })).outcome, DO.REJECTED);
  });
  check("delegation-same-identity-changed-material-conflicts", () => {
    const h = delegationSystem(); h.component.accept(h.request());
    h.state.grant.validThroughTemporalFrameRef = "time:delegation-later-end";
    assert.equal(h.component.accept(h.request()).outcome, DO.CONFLICT);
  });
  check("delegation-caller-eligible-rejected", () => {
    const h = delegationSystem(); assert.equal(h.component.accept({ ...h.request(), eligible: true }).outcome, DO.REJECTED);
  });
  check("delegation-caller-authorized-by-rejected", () => {
    const h = delegationSystem(); assert.equal(h.component.accept({ ...h.request(), authorizedBy: "principal:alice" }).outcome, DO.REJECTED);
  });
  check("delegation-missing-evidence-unknown-not-ineligible", () => {
    const h = delegationSystem({ failRegistry: true }); const response = h.component.accept(h.request());
    assert.equal(response.outcome, DO.UNCERTAIN); assert.equal(response.outcome.includes("NOT_ELIGIBLE"), false);
  });
  check("revoked-grantor-assignment-invalidates-delegation", () => {
    const h = delegationSystem({ assignmentStatePatch: { state: "REVOKED" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.STALE);
  });
  check("conflicting-grantor-assignment-has-no-winner", () => {
    const h = delegationSystem({ assignmentStatePatch: { state: "CONFLICT", contradictionState: "CONFLICT" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.CONFLICT);
  });
  check("conflicting-policy-has-no-winner", () => {
    const h = delegationSystem({ policyStatePatch: { state: "CONFLICT", contradictionState: "CONFLICT" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.CONFLICT);
  });
  check("deactivated-grantee-invalidates-current-delegation", () => {
    const h = delegationSystem({ granteePrincipalPatch: { lifecycleState: "DEACTIVATED" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.STALE);
  });
  check("untrusted-delegation-source-uncertain", () => {
    const h = delegationSystem({ registryPatch: { trustState: "UNTRUSTED" } });
    assert.equal(h.component.accept(h.request()).outcome, DO.UNCERTAIN);
  });
  check("delegation-evidence-refs-deduplicated-and-sorted", () => {
    const h = delegationSystem(); const refs = h.component.accept(h.request()).evidence.evidenceRefs;
    assert.deepEqual(refs, [...new Set(refs)].sort());
  });
  check("delegation-material-change-changes-deterministic-id", () => {
    const first = delegationSystem().component.accept(delegationSystem().request());
    const secondHarness = delegationSystem({ delegationRef: "delegation-alice-bob-gate-2" });
    const second = secondHarness.component.accept(secondHarness.request());
    assert.notEqual(first.evidence.delegationAcceptanceId, second.evidence.delegationAcceptanceId);
  });
  check("delegation-authority-none-on-all-outcome-classes", () => {
    const environments = [delegationSystem(), delegationSystem({ failRegistry: true }),
      delegationSystem({ delegationStatePatch: { state: "REVOKED" } }),
      delegationSystem({ delegationStatePatch: { state: "CONFLICT", contradictionState: "CONFLICT" } })];
    environments.forEach((h) => assert.equal(h.component.accept(h.request()).authority, "NONE"));
  });
  check("accepted-governance-evidence-never-contains-eligibility-or-action-authority", () => {
    const policyHarness = policySystem();
    const assignmentHarness = assignmentSystem();
    const delegationHarness = delegationSystem();
    for (const response of [policyHarness.component.accept(policyHarness.request()),
      assignmentHarness.component.accept(assignmentHarness.request()),
      delegationHarness.component.accept(delegationHarness.request())]) {
      const serialized = JSON.stringify(response.evidence);
      assert.equal(response.authority, "NONE");
      assert.equal(serialized.includes("NOT_ELIGIBLE"), false);
      assert.equal(serialized.includes('"eligible":true'), false);
      assert.equal(serialized.includes('"authority":"NONE"'), true);
    }
  });
  check("same-material-produces-same-identities", () => {
    const p1 = policySystem(); const p2 = policySystem();
    assert.equal(p1.component.accept(p1.request()).evidence.policyAcceptanceId,
      p2.component.accept(p2.request()).evidence.policyAcceptanceId);
    const a1 = assignmentSystem(); const a2 = assignmentSystem();
    assert.equal(a1.component.accept(a1.request()).evidence.assignmentAcceptanceId,
      a2.component.accept(a2.request()).evidence.assignmentAcceptanceId);
    const d1 = delegationSystem(); const d2 = delegationSystem();
    assert.equal(d1.component.accept(d1.request()).evidence.delegationAcceptanceId,
      d2.component.accept(d2.request()).evidence.delegationAcceptanceId);
  });

  const samplePolicyHarness = policySystem();
  const sampleAssignmentHarness = assignmentSystem();
  const sampleDelegationHarness = delegationSystem();
  const samplePolicy = samplePolicyHarness.component.accept(samplePolicyHarness.request()).evidence;
  const sampleAssignment = sampleAssignmentHarness.component.accept(sampleAssignmentHarness.request()).evidence;
  const sampleDelegation = sampleDelegationHarness.component.accept(sampleDelegationHarness.request()).evidence;
  const validationMaterial = {
    suite: "gt63-machine-accepted-governance-role-evidence-v0",
    cases,
    samplePolicyAcceptanceId: samplePolicy.policyAcceptanceId,
    sampleAssignmentAcceptanceId: sampleAssignment.assignmentAcceptanceId,
    sampleDelegationAcceptanceId: sampleDelegation.delegationAcceptanceId,
    authority: "NONE"
  };
  return Object.freeze({
    suite: validationMaterial.suite,
    passed: cases.length,
    failed: 0,
    cases,
    validationIdentity: hash(canonicalStringify(validationMaterial)),
    samplePolicyAcceptanceId: samplePolicy.policyAcceptanceId,
    sampleAssignmentAcceptanceId: sampleAssignment.assignmentAcceptanceId,
    sampleDelegationAcceptanceId: sampleDelegation.delegationAcceptanceId,
    authority: "NONE"
  });
}

const first = runSuite();
const second = runSuite();
assert.equal(JSON.stringify(first), JSON.stringify(second));
process.stdout.write(`${JSON.stringify({
  ...first,
  deterministicRuns: 2,
  byteIdentical: true,
  outputHash: hash(JSON.stringify(first))
})}\n`);
