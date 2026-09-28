"use strict";

const assert = require("node:assert/strict");
const M = require("./human-rooted-lifecycle-issuer-bootstrap-v0");

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log("PASS - " + name); };

const principal = () => ({
  principalRef: "principal:human:1", principalRevision: "1",
  principalEvidenceRef: "evidence:principal:1", lifecycleState: "CURRENT",
  freshnessState: "CURRENT", contradictionState: "NONE", authority: "NONE"
});
const source = () => ({
  type: "REGISTERED_GOVERNANCE_SOURCE_VERIFICATION", status: "VERIFIED",
  sourceVerificationId: "source-verification:1", rootVerificationId: "root-verification:1",
  registeredSourceRef: "gt63-machine:repository-source:governance-lifecycle-issuer-scope-policy",
  sourceBlobSha: "a".repeat(40), sourceBlobSha256: "sha256:" + "b".repeat(64),
  sourcePolicyRevision: 1, sourceStatus: "UNCONFIGURED_FAIL_CLOSED",
  issuerSetSemantics: "CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY",
  permittedIssuerRefs: [], subjectKinds: ["POLICY","ASSIGNMENT","DELEGATION"], authority: "NONE"
});
const decision = () => ({
  bootstrapDecisionEvidenceRef: "decision:1", decision: M.DECISION,
  principalRef: "principal:human:1", principalRevision: "1",
  sourceVerificationId: "source-verification:1", sourcePolicyRevision: 1,
  sourceBlobSha256: "sha256:" + "b".repeat(64),
  lifecycleState: "CURRENT", freshnessState: "CURRENT",
  contradictionState: "NONE", authority: "NONE"
});
const request = () => ({
  rulesetVersion: M.RULESET_VERSION, principalRef: "principal:human:1",
  principalRevision: "1", sourceVerificationId: "source-verification:1",
  sourcePolicyRevision: 1, bootstrapDecisionEvidenceRef: "decision:1"
});
function fixture(overrides = {}) {
  const ledger = overrides.ledger || M.createMemoryLedger();
  const bootstrap = M.createHumanRootedLifecycleIssuerBootstrap({
    verifiedSourcePort: overrides.verifiedSourcePort || (() => source()),
    authenticatedHumanPrincipalPort: overrides.authenticatedHumanPrincipalPort || (() => principal()),
    bootstrapDecisionPort: overrides.bootstrapDecisionPort || (() => decision()),
    acceptanceLedger: ledger
  });
  return { bootstrap, ledger };
}

test("accepts exact human-rooted V0 bootstrap", () => {
  const out = fixture().bootstrap.accept(request());
  assert.equal(out.outcome, M.OUTCOMES.ACCEPTED);
  assert.equal(out.authority, "NONE");
  assert.equal(out.evidence.bootstrapHumanPrincipalRef, "principal:human:1");
  assert.deepEqual(out.evidence.permittedIssuers, [
    { evidenceClass: "POLICY", issuerRef: "principal:human:1", issuerRevision: "1" },
    { evidenceClass: "ASSIGNMENT", issuerRef: "principal:human:1", issuerRevision: "1" }
  ]);
  assert.equal(out.evidence.delegationBootstrapIssuable, false);
  assert.equal(out.evidence.roleAssigned, false);
  assert.equal(out.evidence.principalEligible, false);
  assert.equal(out.evidence.humanGateSatisfied, false);
  assert.equal(out.evidence.effectAuthorized, false);
});

test("same exact bootstrap is idempotent", () => {
  const f = fixture();
  assert.equal(f.bootstrap.accept(request()).outcome, M.OUTCOMES.ACCEPTED);
  assert.equal(f.bootstrap.accept(request()).outcome, M.OUTCOMES.ALREADY_ACCEPTED);
});

test("rejects unsupported request ruleset", () => {
  const r = request(); r.rulesetVersion = "other";
  assert.equal(fixture().bootstrap.accept(r).outcome, M.OUTCOMES.REJECTED);
});

test("unknown when frozen source unavailable", () => {
  const f = fixture({ verifiedSourcePort: () => { throw new Error("down"); } });
  assert.equal(f.bootstrap.accept(request()).outcome, M.OUTCOMES.UNKNOWN);
});

test("unknown when registered source is not exact fail-closed V0", () => {
  const f = fixture({ verifiedSourcePort: () => ({ ...source(), sourceStatus: "ACTIVE" }) });
  assert.equal(f.bootstrap.accept(request()).outcome, M.OUTCOMES.UNKNOWN);
});

test("unknown when frozen source already carries issuers", () => {
  const f = fixture({ verifiedSourcePort: () => ({ ...source(), permittedIssuerRefs: ["machine"] }) });
  assert.equal(f.bootstrap.accept(request()).outcome, M.OUTCOMES.UNKNOWN);
});

test("unknown for stale human principal", () => {
  const f = fixture({ authenticatedHumanPrincipalPort: () => ({ ...principal(), freshnessState: "STALE" }) });
  assert.equal(f.bootstrap.accept(request()).outcome, M.OUTCOMES.UNKNOWN);
});

test("rejects principal identity mismatch", () => {
  const f = fixture({ authenticatedHumanPrincipalPort: () => ({ ...principal(), principalRef: "principal:human:2" }) });
  assert.equal(f.bootstrap.accept(request()).outcome, M.OUTCOMES.REJECTED);
});

test("unknown without exact current human decision", () => {
  const f = fixture({ bootstrapDecisionPort: () => ({ ...decision(), decision: "APPROVE" }) });
  assert.equal(f.bootstrap.accept(request()).outcome, M.OUTCOMES.UNKNOWN);
});

test("rejects decision from another human principal", () => {
  const f = fixture({ bootstrapDecisionPort: () => ({ ...decision(), principalRef: "principal:human:2" }) });
  assert.equal(f.bootstrap.accept(request()).outcome, M.OUTCOMES.REJECTED);
});

test("rejects replay onto changed source verification", () => {
  const f = fixture({ bootstrapDecisionPort: () => ({ ...decision(), sourceVerificationId: "source-verification:old" }) });
  assert.equal(f.bootstrap.accept(request()).outcome, M.OUTCOMES.REJECTED);
});

test("rejects replay onto changed source bytes", () => {
  const f = fixture({ bootstrapDecisionPort: () => ({ ...decision(), sourceBlobSha256: "sha256:" + "c".repeat(64) }) });
  assert.equal(f.bootstrap.accept(request()).outcome, M.OUTCOMES.REJECTED);
});

test("rejects replay onto changed source policy revision", () => {
  const f = fixture({ bootstrapDecisionPort: () => ({ ...decision(), sourcePolicyRevision: 2 }) });
  assert.equal(f.bootstrap.accept(request()).outcome, M.OUTCOMES.REJECTED);
});

test("policy registry trusts only exact accepted human issuer", () => {
  const out = fixture().bootstrap.accept(request());
  const adapter = M.createIssuerSourceRegistryAdapter({ acceptedPolicyPort: () => out.evidence });
  assert.deepEqual(adapter.policySourceRegistryPort({
    sourceRef: "principal:human:1", sourceRevision: "1"
  }), {
    sourceRef: "principal:human:1", sourceRevision: "1", trustState: "TRUSTED",
    registryEvidenceRef: out.evidence.acceptanceId
  });
  assert.equal(adapter.policySourceRegistryPort({
    sourceRef: "principal:human:2", sourceRevision: "1"
  }), null);
});

test("assignment registry trusts only exact accepted human issuer", () => {
  const out = fixture().bootstrap.accept(request());
  const adapter = M.createIssuerSourceRegistryAdapter({ acceptedPolicyPort: () => out.evidence });
  assert.equal(adapter.assignmentSourceRegistryPort({
    sourceRef: "principal:human:1", sourceRevision: "1"
  }).trustState, "TRUSTED");
  assert.equal(adapter.assignmentSourceRegistryPort({
    sourceRef: "principal:human:1", sourceRevision: "2"
  }), null);
});

test("adapter has no delegation bootstrap registry surface", () => {
  const out = fixture().bootstrap.accept(request());
  const adapter = M.createIssuerSourceRegistryAdapter({ acceptedPolicyPort: () => out.evidence });
  assert.equal(Object.prototype.hasOwnProperty.call(adapter, "delegationSourceRegistryPort"), false);
  assert.equal(adapter.authority, "NONE");
});

test("non-current accepted policy cannot produce trusted issuer evidence", () => {
  const out = fixture().bootstrap.accept(request());
  const stale = { ...out.evidence, freshnessState: "STALE" };
  const adapter = M.createIssuerSourceRegistryAdapter({ acceptedPolicyPort: () => stale });
  assert.equal(adapter.policySourceRegistryPort({
    sourceRef: "principal:human:1", sourceRevision: "1"
  }), null);
});

test("ledger conflict fails closed", () => {
  const ledger = {
    get: () => null,
    commit: () => ({ conflict: true })
  };
  assert.equal(fixture({ ledger }).bootstrap.accept(request()).outcome, M.OUTCOMES.CONFLICT);
});

console.log(JSON.stringify({
  rulesetVersion: M.RULESET_VERSION,
  testsPassed: passed,
  authorityInvariant: "PASS: NONE",
  humanRootInvariant: "PASS: HUMAN != MACHINE",
  issuerInvariant: "PASS: POLICY+ASSIGNMENT ONLY",
  delegationInvariant: "PASS: ASSIGNMENT_BOUND / NOT BOOTSTRAP_ISSUABLE"
}, null, 2));
