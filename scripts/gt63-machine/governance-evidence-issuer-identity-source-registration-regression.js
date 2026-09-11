"use strict";

const assert = require("node:assert/strict");
const {
  RULESET_VERSION,
  OUTCOMES,
  createGovernanceEvidenceIssuerIdentitySourceRegistration
} = require("./governance-evidence-issuer-identity-source-registration");

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function verification(patch = {}) {
  return {
    type: "REGISTERED_GOVERNANCE_SOURCE_VERIFICATION",
    status: "VERIFIED",
    sourceVerificationId: `sha256:${"1".repeat(64)}`,
    rootVerificationId: `sha256:${"2".repeat(64)}`,
    repositoryIdentity: "goceterziev-creator/2l1p-neural-travel-v9",
    commitSha: "3".repeat(40),
    treeSha: "4".repeat(40),
    registeredSourceRef: "gt63-machine:repository-source:governance-lifecycle-issuer-scope-policy",
    registeredSourcePath: "config/gt63-machine/governance-lifecycle-issuer-scope-policy-v0.json",
    sourceBlobSha: "5".repeat(40),
    sourceBlobSha256: `sha256:${"6".repeat(64)}`,
    sourcePolicyRevision: 1,
    sourceStatementClass: "GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY",
    sourceIssuerPolicyNamespace: "GT63_MACHINE_GOVERNANCE_LIFECYCLE_ISSUER_SCOPE",
    sourceStatus: "UNCONFIGURED_FAIL_CLOSED",
    issuerSetSemantics: "CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY",
    permittedIssuerRefs: [],
    subjectKinds: ["POLICY", "ASSIGNMENT", "DELEGATION"],
    evidenceRefs: ["evidence:blob", "evidence:tree"],
    authority: "NONE",
    ...clone(patch)
  };
}

function sourceResult(patch = {}) {
  return {
    outcome: "REGISTERED_GOVERNANCE_SOURCE_VERIFIED",
    reason: null,
    verification: verification(patch),
    authority: "NONE"
  };
}

function request(patch = {}) {
  return {
    rulesetVersion: RULESET_VERSION,
    issuerRef: "gt63-machine:issuer:governance-evidence-v0",
    issuerRevision: "1",
    subjectKind: "POLICY",
    ...clone(patch)
  };
}

function component(result = sourceResult()) {
  return createGovernanceEvidenceIssuerIdentitySourceRegistration({
    registeredSourceVerificationPort() { return clone(result); }
  });
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test("constructor-requires-verification-port", () => {
  assert.throws(() => createGovernanceEvidenceIssuerIdentitySourceRegistration(), /registeredSourceVerificationPort/);
});

test("current-fail-closed-source-registers-no-issuer", () => {
  assert.equal(component().assess(request()).outcome, OUTCOMES.NOT_REGISTERED);
});

test("empty-permitted-set-remains-not-registered", () => {
  const r = component(sourceResult({ sourceStatus: "CONFIGURED", issuerSetSemantics: "CLOSED_WORLD_EXACT", permittedIssuerRefs: [] })).assess(request());
  assert.equal(r.outcome, OUTCOMES.NOT_REGISTERED);
});

test("exact-repository-verified-policy-issuer-can-register", () => {
  const r = component(sourceResult({ sourceStatus: "CONFIGURED", issuerSetSemantics: "CLOSED_WORLD_EXACT", permittedIssuerRefs: [request().issuerRef] })).assess(request());
  assert.equal(r.outcome, OUTCOMES.REGISTERED);
  assert.equal(r.evidence.subjectKind, "POLICY");
});

test("exact-repository-verified-assignment-issuer-can-register", () => {
  const q = request({ subjectKind: "ASSIGNMENT" });
  const r = component(sourceResult({ sourceStatus: "CONFIGURED", issuerSetSemantics: "CLOSED_WORLD_EXACT", permittedIssuerRefs: [q.issuerRef] })).assess(q);
  assert.equal(r.outcome, OUTCOMES.REGISTERED);
});

test("exact-repository-verified-delegation-issuer-can-register", () => {
  const q = request({ subjectKind: "DELEGATION" });
  const r = component(sourceResult({ sourceStatus: "CONFIGURED", issuerSetSemantics: "CLOSED_WORLD_EXACT", permittedIssuerRefs: [q.issuerRef] })).assess(q);
  assert.equal(r.outcome, OUTCOMES.REGISTERED);
});

test("unlisted-issuer-not-registered", () => {
  const r = component(sourceResult({ sourceStatus: "CONFIGURED", issuerSetSemantics: "CLOSED_WORLD_EXACT", permittedIssuerRefs: ["gt63-machine:issuer:other"] })).assess(request());
  assert.equal(r.outcome, OUTCOMES.NOT_REGISTERED);
});

test("unsupported-subject-kind-invalid", () => {
  assert.equal(component().assess(request({ subjectKind: "ELIGIBILITY" })).outcome, OUTCOMES.INVALID);
});

test("caller-cannot-inject-registration", () => {
  assert.equal(component().assess({ ...request(), registered: true }).outcome, OUTCOMES.INVALID);
});

test("verification-port-failure-unknown", () => {
  const c = createGovernanceEvidenceIssuerIdentitySourceRegistration({ registeredSourceVerificationPort() { throw new Error("offline"); } });
  assert.equal(c.assess(request()).outcome, OUTCOMES.UNKNOWN);
});

test("unverified-source-unknown", () => {
  const r = component({ outcome: "REGISTERED_GOVERNANCE_SOURCE_INVALID", verification: null, authority: "NONE" }).assess(request());
  assert.equal(r.outcome, OUTCOMES.UNKNOWN);
});

test("wrong-source-authority-unknown", () => {
  const s = sourceResult(); s.authority = "EXECUTE";
  assert.equal(component(s).assess(request()).outcome, OUTCOMES.UNKNOWN);
});

test("open-world-source-invalid", () => {
  const r = component(sourceResult({ sourceStatus: "CONFIGURED", issuerSetSemantics: "OPEN_WORLD", permittedIssuerRefs: [request().issuerRef] })).assess(request());
  assert.equal(r.outcome, OUTCOMES.INVALID);
});

test("unsupported-source-status-unknown", () => {
  const r = component(sourceResult({ sourceStatus: "ACTIVE", issuerSetSemantics: "CLOSED_WORLD_EXACT", permittedIssuerRefs: [request().issuerRef] })).assess(request());
  assert.equal(r.outcome, OUTCOMES.UNKNOWN);
});

test("deterministic-exact-replay", () => {
  const s = sourceResult({ sourceStatus: "CONFIGURED", issuerSetSemantics: "CLOSED_WORLD_EXACT", permittedIssuerRefs: [request().issuerRef] });
  assert.deepEqual(component(s).assess(request()), component(s).assess(request()));
});

test("changed-issuer-revision-changes-registration-identity", () => {
  const s = sourceResult({ sourceStatus: "CONFIGURED", issuerSetSemantics: "CLOSED_WORLD_EXACT", permittedIssuerRefs: [request().issuerRef] });
  const a = component(s).assess(request());
  const b = component(s).assess(request({ issuerRevision: "2" }));
  assert.notEqual(a.evidence.registrationEvidenceRef, b.evidence.registrationEvidenceRef);
});

test("changed-source-verification-changes-registration-identity", () => {
  const a = component(sourceResult({ sourceStatus: "CONFIGURED", issuerSetSemantics: "CLOSED_WORLD_EXACT", permittedIssuerRefs: [request().issuerRef] })).assess(request());
  const b = component(sourceResult({ sourceStatus: "CONFIGURED", issuerSetSemantics: "CLOSED_WORLD_EXACT", permittedIssuerRefs: [request().issuerRef], sourceVerificationId: `sha256:${"7".repeat(64)}` })).assess(request());
  assert.notEqual(a.evidence.registrationEvidenceRef, b.evidence.registrationEvidenceRef);
});

test("all-outcomes-authority-none-and-no-downstream-authority", () => {
  const cases = [
    component().assess(request()),
    component(sourceResult({ sourceStatus: "CONFIGURED", issuerSetSemantics: "CLOSED_WORLD_EXACT", permittedIssuerRefs: [request().issuerRef] })).assess(request()),
    component().assess(request({ subjectKind: "BAD" }))
  ];
  for (const r of cases) {
    assert.equal(r.authority, "NONE");
    assert.equal(r.issuerPermissionCreated, false);
    assert.equal(r.policyEvidenceAccepted, false);
    assert.equal(r.assignmentEvidenceAccepted, false);
    assert.equal(r.delegationEvidenceAccepted, false);
    assert.equal(r.eligibilityCreated, false);
    assert.equal(r.humanGateSatisfied, false);
    assert.equal(r.continuationAuthorityCreated, false);
    assert.equal(r.executionAuthorityCreated, false);
    assert.equal(r.effectAuthorized, false);
  }
});

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`PASS - ${name}`); passed += 1; }
  catch (error) { console.error(`FAIL - ${name}`); console.error(error.stack || error); process.exitCode = 1; }
}
console.log(`${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
