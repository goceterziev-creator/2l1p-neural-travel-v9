"use strict";

const assert = require("node:assert/strict");
const {
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  createAuthenticatedGovernanceAuthorizationBinding,
  createMemoryLedger
} = require("./authenticated-governance-authorization-binding");

const digest = `sha256:${"a".repeat(64)}`;
const semanticDigest = `sha256:${"b".repeat(64)}`;

function gateScope(overrides = {}) {
  return {
    scopeType: "GATE",
    interactionId: "interaction:1",
    fromInteractionRevision: 1,
    throughInteractionRevision: 3,
    gateId: "gate:1",
    gateRevision: 1,
    authorityScopeDigest: digest,
    continuationTargetRef: "continuation:1",
    ...overrides
  };
}

function request(overrides = {}) {
  return {
    rulesetVersion: RULESET_VERSION,
    authorizationSubjectRef: "subject:1",
    authorizationSubjectRevision: "1",
    governanceAct: "GATE_AUTHORIZATION",
    contextScope: gateScope(),
    principalRef: "principal:1",
    principalRevision: "1",
    humanAuthorizationEvidenceRef: "evidence:human-auth:1",
    ...overrides
  };
}

function fixtures(overrides = {}) {
  const principal = {
    principalRef: "principal:1",
    principalRevision: "1",
    principalEvidenceRef: "evidence:principal:1",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    authority: "NONE",
    ...(overrides.principal || {})
  };
  const eligibility = {
    principalRef: "principal:1",
    principalRevision: "1",
    eligibilityEvidenceRef: "evidence:eligibility:1",
    eligibilityState: "ELIGIBLE",
    governanceAct: "GATE_AUTHORIZATION",
    contextScope: gateScope(),
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    authority: "NONE",
    ...(overrides.eligibility || {})
  };
  const requirement = {
    requirementRef: "requirement:1",
    requirementRevision: "1",
    governanceAct: "GATE_AUTHORIZATION",
    requiredRoleRef: "role:gate-authorizer",
    requiredRoleRevision: "1",
    contextScope: gateScope(),
    roleRequirementEvidenceRef: "evidence:requirement:1",
    authority: "NONE",
    ...(overrides.requirement || {})
  };
  const role = {
    roleResolutionType: "DIRECT_ASSIGNMENT",
    principalRef: "principal:1",
    principalRevision: "1",
    roleRef: "role:gate-authorizer",
    roleRevision: "1",
    contextScope: gateScope(),
    roleEvidenceRefs: ["evidence:assignment:1"],
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    authority: "NONE",
    ...(overrides.role || {})
  };
  const authorization = {
    humanAuthorizationEvidenceRef: "evidence:human-auth:1",
    principalRef: "principal:1",
    principalRevision: "1",
    authorizationSubjectRef: "subject:1",
    authorizationSubjectRevision: "1",
    governanceAct: "GATE_AUTHORIZATION",
    contextScope: gateScope(),
    decision: "APPROVE",
    exactSemanticDigest: semanticDigest,
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    authority: "NONE",
    ...(overrides.authorization || {})
  };
  return { principal, eligibility, requirement, role, authorization };
}

function system(overrides = {}) {
  const f = fixtures(overrides.fixtures || {});
  const ledger = overrides.ledger || createMemoryLedger();
  return {
    ledger,
    component: createAuthenticatedGovernanceAuthorizationBinding({
      authenticatedPrincipalPort: overrides.authenticatedPrincipalPort || (() => f.principal),
      principalEligibilityPort: overrides.principalEligibilityPort || (() => f.eligibility),
      governanceRoleRequirementPort: overrides.governanceRoleRequirementPort || (() => f.requirement),
      roleResolutionPort: overrides.roleResolutionPort || (() => f.role),
      humanAuthorizationEventPort: overrides.humanAuthorizationEventPort || (() => f.authorization),
      bindingLedger: ledger
    })
  };
}

const cases = [];
function check(name, fn) {
  fn();
  cases.push(name);
  console.log(`PASS - ${name}`);
}

function assertNoAuthority(output) {
  assert.equal(output.authority, AUTHORITY);
  assert.equal(output.humanGateSatisfied, false);
  assert.equal(output.continuationAuthorityCreated, false);
  assert.equal(output.executionAuthorityCreated, false);
  assert.equal(output.effectAuthorized, false);
}

check("constructor-requires-all-ports-and-ledger", () => {
  assert.throws(() => createAuthenticatedGovernanceAuthorizationBinding({}), TypeError);
});

check("exact-positive-path-authorized", () => {
  const output = system().component.assess(request());
  assert.equal(output.outcome, OUTCOMES.AUTHORIZED);
  assert.equal(output.binding.authorizationState, "BOUND");
  assertNoAuthority(output);
});

check("caller-derived-authority-field-invalid", () => {
  const output = system().component.assess({ ...request(), authorized: true });
  assert.equal(output.outcome, OUTCOMES.INVALID);
  assertNoAuthority(output);
});

check("unsupported-act-invalid", () => {
  const output = system().component.assess(request({ governanceAct: "DEPLOY" }));
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("missing-principal-port-evidence-unknown", () => {
  const output = system({ authenticatedPrincipalPort: () => { throw new Error("missing"); } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});

check("cross-principal-not-authorized", () => {
  const output = system({ fixtures: { principal: { principalRef: "principal:2" } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});

check("eligibility-unknown-preserved", () => {
  const output = system({ fixtures: { eligibility: { eligibilityState: "UNKNOWN" } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});

check("positive-not-eligible-not-authorized", () => {
  const output = system({ fixtures: { eligibility: { eligibilityState: "NOT_ELIGIBLE" } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});

check("stale-eligibility-unknown", () => {
  const output = system({ fixtures: { eligibility: { freshnessState: "STALE" } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});

check("cross-gate-requirement-not-authorized", () => {
  const output = system({ fixtures: { requirement: { contextScope: gateScope({ gateId: "gate:2" }) } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});

check("direct-assignment-positive-path", () => {
  const output = system().component.assess(request());
  assert.equal(output.outcome, OUTCOMES.AUTHORIZED);
  assert.equal(output.binding.roleResolutionType, "DIRECT_ASSIGNMENT");
});

check("delegation-positive-path", () => {
  const output = system({ fixtures: { role: { roleResolutionType: "DELEGATION", roleEvidenceRefs: ["evidence:delegation:1"] } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.AUTHORIZED);
  assert.equal(output.binding.roleResolutionType, "DELEGATION");
});

check("wrong-role-not-authorized", () => {
  const output = system({ fixtures: { role: { roleRef: "role:other" } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});

check("stale-role-evidence-unknown", () => {
  const output = system({ fixtures: { role: { freshnessState: "STALE" } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});

check("generic-or-invalid-human-authorization-unknown", () => {
  const output = system({ fixtures: { authorization: { decision: "ACKNOWLEDGE" } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});

check("cross-subject-not-authorized", () => {
  const output = system({ fixtures: { authorization: { authorizationSubjectRef: "subject:2" } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});

check("cross-authorization-principal-not-authorized", () => {
  const output = system({ fixtures: { authorization: { principalRef: "principal:2" } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});

check("cross-target-not-authorized", () => {
  const output = system({ fixtures: { authorization: { contextScope: gateScope({ continuationTargetRef: "continuation:2" }) } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});

check("explicit-denial-not-authorized", () => {
  const output = system({ fixtures: { authorization: { decision: "DENY" } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});

check("verification-non-authorization-not-authorized", () => {
  const output = system({ fixtures: { authorization: { decision: "NON_AUTHORIZATION" } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});

check("stale-human-authorization-unknown", () => {
  const output = system({ fixtures: { authorization: { freshnessState: "STALE" } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});

check("exact-replay-is-deterministic-and-authorized", () => {
  const { component } = system();
  const first = component.assess(request());
  const second = component.assess(request());
  assert.equal(first.outcome, OUTCOMES.AUTHORIZED);
  assert.equal(second.outcome, OUTCOMES.AUTHORIZED);
  assert.equal(first.binding.bindingId, second.binding.bindingId);
  assert.deepEqual(first.binding, second.binding);
});

check("changed-target-changes-binding-identity", () => {
  const a = system().component.assess(request());
  const changedScope = gateScope({ continuationTargetRef: "continuation:2" });
  const b = system({ fixtures: {
    eligibility: { contextScope: changedScope },
    requirement: { contextScope: changedScope },
    role: { contextScope: changedScope },
    authorization: { contextScope: changedScope }
  }}).component.assess(request({ contextScope: changedScope }));
  assert.equal(a.outcome, OUTCOMES.AUTHORIZED);
  assert.equal(b.outcome, OUTCOMES.AUTHORIZED);
  assert.notEqual(a.binding.bindingId, b.binding.bindingId);
});

check("changed-scope-range-changes-binding-identity", () => {
  const a = system().component.assess(request());
  const narrowed = gateScope({ fromInteractionRevision: 2, throughInteractionRevision: 3 });
  const b = system().component.assess(request({ contextScope: narrowed }));
  assert.equal(a.outcome, OUTCOMES.AUTHORIZED);
  assert.equal(b.outcome, OUTCOMES.AUTHORIZED);
  assert.notEqual(a.binding.bindingId, b.binding.bindingId);
});

check("ledger-conflict-does-not-create-authority", () => {
  const seed = system();
  const first = seed.component.assess(request());
  assert.equal(first.outcome, OUTCOMES.AUTHORIZED);
  const badLedger = {
    get(id) { return { ...first.binding, bindingId: id, authorizationSubjectRef: "subject:conflict" }; },
    commit() { throw new Error("should-not-commit"); }
  };
  const output = system({ ledger: badLedger }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
  assertNoAuthority(output);
});

check("all-outcomes-remain-authority-none", () => {
  const outputs = [
    system().component.assess(request()),
    system({ fixtures: { authorization: { decision: "DENY" } } }).component.assess(request()),
    system({ principalEligibilityPort: () => { throw new Error("unavailable"); } }).component.assess(request()),
    system().component.assess({ ...request(), effectAuthorized: true })
  ];
  outputs.forEach(assertNoAuthority);
});

console.log(`${cases.length}/${cases.length} PASS`);
