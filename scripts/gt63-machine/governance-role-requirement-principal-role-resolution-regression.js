"use strict";

const assert = require("node:assert/strict");
const {
  RULESET_VERSION,
  createGovernanceRoleRequirementPrincipalRoleResolution
} = require("./governance-role-requirement-principal-role-resolution");

const PRINCIPAL = "gt63-machine:human-principal:goce-v0";
const ROLE = "gt63-machine:role:gate-authorizer-v0";
const POLICY_ID = "governance-role-policy:accepted-v0";

function gate(overrides = {}) {
  return {
    scopeType: "GATE",
    interactionId: "interaction-1",
    fromInteractionRevision: 1,
    throughInteractionRevision: 3,
    gateId: "gate-1",
    gateRevision: 1,
    authorityScopeDigest: `sha256:${"a".repeat(64)}`,
    continuationTargetRef: "gt63-machine:continuation:test-v0",
    ...overrides
  };
}

function policy(overrides = {}) {
  return {
    type: "GOVERNANCE_ROLE_POLICY_REQUIREMENT_EVIDENCE_ACCEPTANCE",
    policyAcceptanceId: POLICY_ID,
    policyRef: "gt63-machine:role-policy:v0",
    policyRevision: "1",
    policyDocument: {
      roles: [],
      requirements: [{
        requirementRef: "gt63-machine:role-requirement:gate-authorizer-v0",
        requirementRevision: "1",
        governanceAct: "GATE_AUTHORIZATION",
        requiredRoleRef: ROLE,
        requiredRoleRevision: "1",
        contextScope: gate()
      }],
      assignmentIssuerRefs: []
    },
    authority: "NONE",
    ...overrides
  };
}

function assignment(overrides = {}) {
  return {
    type: "DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE",
    assignmentKind: "DIRECT",
    assignmentAcceptanceId: "direct-role-assignment:accepted-v0",
    principalRef: PRINCIPAL,
    principalRevision: "1",
    roleRef: ROLE,
    roleRevision: "1",
    policyAcceptanceId: POLICY_ID,
    contextScope: gate(),
    observedLifecycleState: "CURRENT",
    authority: "NONE",
    ...overrides
  };
}

function delegation(overrides = {}) {
  return {
    type: "DIRECT_DELEGATION_EVIDENCE_ACCEPTANCE",
    delegationAcceptanceId: "direct-delegation:accepted-v0",
    granteeRef: PRINCIPAL,
    granteeRevision: "1",
    roleRef: ROLE,
    roleRevision: "1",
    policyAcceptanceId: POLICY_ID,
    delegatedScope: gate(),
    observedLifecycleState: "CURRENT",
    chainDepth: 1,
    authority: "NONE",
    ...overrides
  };
}

function make({ policies = [policy()], assignments = [assignment()], delegations = [] } = {}) {
  return createGovernanceRoleRequirementPrincipalRoleResolution({
    acceptedPolicyPort: () => policies,
    acceptedAssignmentsPort: () => assignments,
    acceptedDelegationsPort: () => delegations
  });
}

function requirementRequest(overrides = {}) {
  return {
    rulesetVersion: RULESET_VERSION,
    governanceAct: "GATE_AUTHORIZATION",
    contextScope: gate(),
    ...overrides
  };
}

function roleRequest(overrides = {}) {
  return {
    rulesetVersion: RULESET_VERSION,
    principalRef: PRINCIPAL,
    principalRevision: "1",
    roleRef: ROLE,
    roleRevision: "1",
    contextScope: gate(),
    ...overrides
  };
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("constructor-requires-all-ports", () => {
  assert.throws(() => createGovernanceRoleRequirementPrincipalRoleResolution({}), TypeError);
});

test("exact-gate-requirement-resolves", () => {
  const out = make().resolveRequirement(requirementRequest());
  assert.equal(out.outcome, "RESOLVED");
  assert.equal(out.evidence.requiredRoleRef, ROLE);
  assert.equal(out.evidence.authority, "NONE");
  assert.ok(out.evidence.roleRequirementEvidenceRef.startsWith("gt63-evidence:role-requirement-resolution:"));
});

test("missing-requirement-not-resolved", () => {
  const out = make({ policies: [] }).resolveRequirement(requirementRequest());
  assert.equal(out.outcome, "NOT_RESOLVED");
});

test("conflicting-requirements-unknown", () => {
  const second = policy({
    policyAcceptanceId: "governance-role-policy:accepted-v1",
    policyRef: "gt63-machine:role-policy:v1"
  });
  const out = make({ policies: [policy(), second] }).resolveRequirement(requirementRequest());
  assert.equal(out.outcome, "UNKNOWN");
});

test("cross-gate-requirement-not-resolved", () => {
  const p = policy();
  p.policyDocument.requirements[0].contextScope = gate({ gateId: "gate-other" });
  const out = make({ policies: [p] }).resolveRequirement(requirementRequest());
  assert.equal(out.outcome, "NOT_RESOLVED");
});

test("cross-authority-scope-requirement-not-resolved", () => {
  const p = policy();
  p.policyDocument.requirements[0].contextScope = gate({ authorityScopeDigest: `sha256:${"b".repeat(64)}` });
  const out = make({ policies: [p] }).resolveRequirement(requirementRequest());
  assert.equal(out.outcome, "NOT_RESOLVED");
});

test("unsupported-governance-act-invalid", () => {
  const out = make().resolveRequirement(requirementRequest({ governanceAct: "INTENT_CONFIRMATION" }));
  assert.equal(out.outcome, "INVALID");
});

test("direct-assignment-resolves-exact-principal-role", () => {
  const out = make().resolvePrincipalRole(roleRequest());
  assert.equal(out.outcome, "RESOLVED");
  assert.equal(out.evidence.roleResolutionType, "DIRECT_ASSIGNMENT");
  assert.deepEqual(out.evidence.roleEvidenceRefs, ["direct-role-assignment:accepted-v0"]);
  assert.equal(out.evidence.lifecycleState, "CURRENT");
  assert.equal(out.evidence.freshnessState, "CURRENT");
  assert.equal(out.evidence.contradictionState, "NONE");
});

test("delegation-resolves-exact-principal-role", () => {
  const out = make({ assignments: [], delegations: [delegation()] }).resolvePrincipalRole(roleRequest());
  assert.equal(out.outcome, "RESOLVED");
  assert.equal(out.evidence.roleResolutionType, "DELEGATION");
  assert.deepEqual(out.evidence.roleEvidenceRefs, ["direct-delegation:accepted-v0"]);
});

test("missing-role-evidence-not-resolved", () => {
  const out = make({ assignments: [], delegations: [] }).resolvePrincipalRole(roleRequest());
  assert.equal(out.outcome, "NOT_RESOLVED");
});

test("principal-mismatch-not-resolved", () => {
  const out = make().resolvePrincipalRole(roleRequest({ principalRef: "gt63-machine:human-principal:other-v0" }));
  assert.equal(out.outcome, "NOT_RESOLVED");
});

test("principal-revision-mismatch-not-resolved", () => {
  const out = make().resolvePrincipalRole(roleRequest({ principalRevision: "2" }));
  assert.equal(out.outcome, "NOT_RESOLVED");
});

test("role-mismatch-not-resolved", () => {
  const out = make().resolvePrincipalRole(roleRequest({ roleRef: "gt63-machine:role:other-v0" }));
  assert.equal(out.outcome, "NOT_RESOLVED");
});

test("role-revision-mismatch-not-resolved", () => {
  const out = make().resolvePrincipalRole(roleRequest({ roleRevision: "2" }));
  assert.equal(out.outcome, "NOT_RESOLVED");
});

test("cross-gate-assignment-not-resolved", () => {
  const out = make({ assignments: [assignment({ contextScope: gate({ gateId: "gate-other" }) })] })
    .resolvePrincipalRole(roleRequest());
  assert.equal(out.outcome, "NOT_RESOLVED");
});

test("stale-assignment-record-unknown", () => {
  const out = make({ assignments: [assignment({ observedLifecycleState: "STALE" })] })
    .resolvePrincipalRole(roleRequest());
  assert.equal(out.outcome, "UNKNOWN");
});

test("stale-delegation-record-unknown", () => {
  const out = make({ assignments: [], delegations: [delegation({ observedLifecycleState: "STALE" })] })
    .resolvePrincipalRole(roleRequest());
  assert.equal(out.outcome, "UNKNOWN");
});

test("direct-and-delegation-path-conflict-unknown", () => {
  const out = make({ assignments: [assignment()], delegations: [delegation()] })
    .resolvePrincipalRole(roleRequest());
  assert.equal(out.outcome, "UNKNOWN");
});

test("conflicting-policy-identities-unknown", () => {
  const out = make({
    assignments: [assignment(), assignment({
      assignmentAcceptanceId: "direct-role-assignment:accepted-v1",
      policyAcceptanceId: "governance-role-policy:other"
    })]
  }).resolvePrincipalRole(roleRequest());
  assert.equal(out.outcome, "UNKNOWN");
});

test("conflicting-role-scopes-unknown", () => {
  const wider = gate({ fromInteractionRevision: 0, throughInteractionRevision: 4 });
  const out = make({
    assignments: [assignment(), assignment({
      assignmentAcceptanceId: "direct-role-assignment:accepted-v1",
      contextScope: wider
    })]
  }).resolvePrincipalRole(roleRequest());
  assert.equal(out.outcome, "UNKNOWN");
});

test("deterministic-requirement-replay", () => {
  const resolver = make();
  const a = resolver.resolveRequirement(requirementRequest());
  const b = resolver.resolveRequirement(requirementRequest());
  assert.deepEqual(a, b);
});

test("deterministic-role-replay", () => {
  const resolver = make();
  const a = resolver.resolvePrincipalRole(roleRequest());
  const b = resolver.resolvePrincipalRole(roleRequest());
  assert.deepEqual(a, b);
});

test("changed-scope-changes-resolution-identity", () => {
  const resolver = make({ assignments: [assignment({ contextScope: gate({ throughInteractionRevision: null }) })] });
  const a = resolver.resolvePrincipalRole(roleRequest());
  const b = resolver.resolvePrincipalRole(roleRequest({
    contextScope: gate({ fromInteractionRevision: 2, throughInteractionRevision: 3 })
  }));
  assert.equal(a.outcome, "RESOLVED");
  assert.equal(b.outcome, "RESOLVED");
  assert.notEqual(a.evidence.roleResolutionEvidenceRef, b.evidence.roleResolutionEvidenceRef);
});

test("caller-cannot-inject-role-resolution", () => {
  const out = make({ assignments: [], delegations: [] }).resolvePrincipalRole({
    ...roleRequest(),
    roleResolutionType: "DIRECT_ASSIGNMENT"
  });
  assert.equal(out.outcome, "INVALID");
});

test("all-outcomes-authority-none-and-no-downstream-authority", () => {
  const outputs = [
    make().resolveRequirement(requirementRequest()),
    make({ policies: [] }).resolveRequirement(requirementRequest()),
    make().resolvePrincipalRole(roleRequest()),
    make({ assignments: [], delegations: [] }).resolvePrincipalRole(roleRequest()),
    make().resolvePrincipalRole({ ...roleRequest(), injected: true })
  ];
  for (const out of outputs) {
    assert.equal(out.authority, "NONE");
    assert.equal(out.principalEligibilityCreated, false);
    assert.equal(out.roleAssignmentCreated, false);
    assert.equal(out.delegationCreated, false);
    assert.equal(out.humanGateSatisfied, false);
    assert.equal(out.continuationAuthorityCreated, false);
    assert.equal(out.executionAuthorityCreated, false);
    assert.equal(out.effectAuthorized, false);
  }
});

let passed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
}

console.log(`${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
