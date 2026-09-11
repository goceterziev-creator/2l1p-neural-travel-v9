"use strict";

const assert = require("node:assert/strict");
const {
  RULESET_VERSION, OUTCOMES, STATEMENT_CLASS, VERIFICATION_METHOD,
  createGovernanceEvidenceIssuerIdentityEvidence
} = require("./governance-evidence-issuer-identity-evidence");

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function identity(patch = {}) {
  return {
    type: "REPOSITORY_FROZEN_GOVERNANCE_ISSUER_IDENTITY_EVIDENCE",
    status: "VERIFIED",
    statementClass: STATEMENT_CLASS,
    issuerRef: "gt63-machine:issuer:governance-evidence-v0",
    issuerRevision: "1",
    repositoryIdentity: "goceterziev-creator/2l1p-neural-travel-v9",
    commitSha: "1".repeat(40), treeSha: "2".repeat(40),
    sourceRef: "gt63-machine:repository-source:governance-evidence-issuer-identity-v0",
    sourcePath: "config/gt63-machine/governance-evidence-issuer-identity-v0.json",
    blobSha: "3".repeat(40), blobSha256: `sha256:${"4".repeat(64)}`,
    verificationMethod: VERIFICATION_METHOD,
    provenanceEvidenceRefs: ["evidence:blob", "evidence:tree", "evidence:root"],
    authority: "NONE",
    ...clone(patch)
  };
}
function currentScopePolicyEvidence() {
  return {
    type: "REGISTERED_GOVERNANCE_SOURCE_VERIFICATION",
    status: "VERIFIED",
    statementClass: "GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY",
    sourceRef: "gt63-machine:repository-source:governance-lifecycle-issuer-scope-policy",
    authority: "NONE"
  };
}
function request(patch = {}) {
  return { rulesetVersion: RULESET_VERSION, issuerRef: "gt63-machine:issuer:governance-evidence-v0", issuerRevision: "1", ...clone(patch) };
}
function component(observed = null) {
  return createGovernanceEvidenceIssuerIdentityEvidence({ repositoryIssuerIdentityEvidencePort() { return clone(observed); } });
}
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test("constructor-requires-repository-identity-evidence-port", () => {
  assert.throws(() => createGovernanceEvidenceIssuerIdentityEvidence(), /repositoryIssuerIdentityEvidencePort/);
});
test("missing-repository-identity-evidence-not-established", () => {
  assert.equal(component(null).assess(request()).outcome, OUTCOMES.NOT_ESTABLISHED);
});
test("current-scope-policy-is-not-issuer-identity", () => {
  assert.equal(component(currentScopePolicyEvidence()).assess(request()).outcome, OUTCOMES.NOT_ESTABLISHED);
});
test("exact-repository-frozen-identity-establishes", () => {
  const r = component(identity()).assess(request());
  assert.equal(r.outcome, OUTCOMES.ESTABLISHED);
  assert.equal(r.evidence.issuerRef, request().issuerRef);
  assert.equal(r.evidence.issuerRevision, "1");
});
test("wrong-issuer-ref-not-established", () => {
  const r = component(identity({ issuerRef: "gt63-machine:issuer:other" })).assess(request());
  assert.equal(r.outcome, OUTCOMES.NOT_ESTABLISHED);
});
test("wrong-issuer-revision-not-established", () => {
  const r = component(identity({ issuerRevision: "2" })).assess(request());
  assert.equal(r.outcome, OUTCOMES.NOT_ESTABLISHED);
});
test("unverified-identity-unknown", () => {
  assert.equal(component(identity({ status: "UNVERIFIED" })).assess(request()).outcome, OUTCOMES.UNKNOWN);
});
test("wrong-authority-unknown", () => {
  assert.equal(component(identity({ authority: "EXECUTE" })).assess(request()).outcome, OUTCOMES.UNKNOWN);
});
test("wrong-verification-method-unknown", () => {
  assert.equal(component(identity({ verificationMethod: "TRUST_ME" })).assess(request()).outcome, OUTCOMES.UNKNOWN);
});
test("missing-provenance-unknown", () => {
  assert.equal(component(identity({ provenanceEvidenceRefs: [] })).assess(request()).outcome, OUTCOMES.UNKNOWN);
});
test("invalid-blob-sha-unknown", () => {
  assert.equal(component(identity({ blobSha: "bad" })).assess(request()).outcome, OUTCOMES.UNKNOWN);
});
test("invalid-blob-sha256-unknown", () => {
  assert.equal(component(identity({ blobSha256: "bad" })).assess(request()).outcome, OUTCOMES.UNKNOWN);
});
test("caller-cannot-inject-established", () => {
  assert.equal(component(identity()).assess({ ...request(), established: true }).outcome, OUTCOMES.INVALID);
});
test("port-failure-unknown", () => {
  const c = createGovernanceEvidenceIssuerIdentityEvidence({ repositoryIssuerIdentityEvidencePort() { throw new Error("offline"); } });
  assert.equal(c.assess(request()).outcome, OUTCOMES.UNKNOWN);
});
test("deterministic-exact-replay", () => {
  assert.deepEqual(component(identity()).assess(request()), component(identity()).assess(request()));
});
test("changed-revision-changes-evidence-identity", () => {
  const a = component(identity()).assess(request());
  const b = component(identity({ issuerRevision: "2" })).assess(request({ issuerRevision: "2" }));
  assert.notEqual(a.evidence.issuerIdentityEvidenceRef, b.evidence.issuerIdentityEvidenceRef);
});
test("changed-provenance-changes-evidence-identity", () => {
  const a = component(identity()).assess(request());
  const b = component(identity({ blobSha: "5".repeat(40) })).assess(request());
  assert.notEqual(a.evidence.issuerIdentityEvidenceRef, b.evidence.issuerIdentityEvidenceRef);
});
test("all-outcomes-authority-none-and-no-downstream-authority", () => {
  const cases = [component(identity()).assess(request()), component(null).assess(request()), component(identity({ status: "BAD" })).assess(request()), component(identity()).assess({ ...request(), extra: true })];
  for (const r of cases) {
    assert.equal(r.authority, "NONE");
    assert.equal(r.issuerPermissionCreated, false);
    assert.equal(r.policyEvidenceAccepted, false);
    assert.equal(r.assignmentEvidenceAccepted, false);
    assert.equal(r.delegationEvidenceAccepted, false);
    assert.equal(r.eligibilityCreated, false);
    assert.equal(r.authorizationCreated, false);
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
