"use strict";

const assert = require("node:assert/strict");
const M = require("./human-lifecycle-issuer-policy-acceptance-capture-v0");
const bootstrapModule = require("./human-rooted-lifecycle-issuer-bootstrap-v0");

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log("PASS - " + name); };
const fixedRandom = () => Buffer.from("00112233445566778899aabbccddeeff", "hex");

const session = () => ({
  sessionRef: "session:1", sessionRevision: "1", authenticatedAccountRef: "account:1",
  authenticationProviderRef: "auth-provider:1", authenticationEvidenceRef: "auth-evidence:1",
  authenticationState: "AUTHENTICATED", freshnessState: "CURRENT"
});
const identity = () => ({
  type: "GT63_EXTERNAL_AUTHENTICATED_IDENTITY_BINDING",
  principalRef: "principal:human:1", principalNamespace: "github.com", principalRevision: "1",
  githubUserId: 1, githubLogin: "human", sessionRef: "session:1", sessionRevision: "1",
  authenticatedAccountRef: "account:1", lifecycleState: "CURRENT", freshnessState: "CURRENT",
  contradictionState: "NONE", principalEvidenceRef: "principal-evidence:1",
  verificationMethodRef: "method:1", verificationMethodRevision: "1",
  verifiedAt: "2026-09-28T00:00:00.000Z", authority: "NONE"
});
const source = () => ({
  type: "REGISTERED_GOVERNANCE_SOURCE_VERIFICATION", status: "VERIFIED",
  sourceVerificationId: "source-verification:1", rootVerificationId: "root-verification:1",
  repositoryIdentity: "repo:1", commitSha: "a".repeat(40), treeSha: "b".repeat(40),
  registeredSourceRef: "gt63-machine:repository-source:governance-lifecycle-issuer-scope-policy",
  registeredSourcePath: "config/gt63-machine/governance-lifecycle-issuer-scope-policy-v0.json",
  sourceBlobSha: "c".repeat(40), sourceBlobSha256: "sha256:" + "d".repeat(64),
  sourcePolicyRevision: 1, sourceStatementClass: "GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY",
  sourceIssuerPolicyNamespace: "gt63-machine:governance-lifecycle-issuer-scope-policy",
  sourceStatus: "UNCONFIGURED_FAIL_CLOSED",
  issuerSetSemantics: "CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY",
  permittedIssuerRefs: [], subjectKinds: ["POLICY","ASSIGNMENT","DELEGATION"],
  evidenceRefs: ["evidence:blob","evidence:tree"], authority: "NONE"
});
function fixture(overrides = {}) {
  const presentationLedger = overrides.presentationLedger || M.createMemoryLedger();
  const decisionLedger = overrides.decisionLedger || M.createMemoryLedger();
  const capture = M.createHumanLifecycleIssuerPolicyAcceptanceCapture({
    clock: () => "2026-09-28T00:00:00.000Z", randomBytes: fixedRandom,
    presentationLedger, decisionLedger
  });
  return { capture, presentationLedger, decisionLedger };
}
function context() {
  const s = session(), i = identity(), p = M.projectAuthenticatedHumanPrincipal(i), v = source();
  return { s, i, p, v };
}
function presented(f = fixture()) {
  const c = context();
  const presentation = f.capture.present({ session:c.s, principal:c.i, verifiedSource:c.v });
  return { f, ...c, presentation };
}

test("projects existing GitHub authenticated identity without widening authority", () => {
  const p = M.projectAuthenticatedHumanPrincipal(identity());
  assert.deepEqual(p, {
    principalRef:"principal:human:1", principalRevision:"1", principalEvidenceRef:"principal-evidence:1",
    lifecycleState:"CURRENT", freshnessState:"CURRENT", contradictionState:"NONE", authority:"NONE"
  });
});
test("rejects stale identity projection", () => {
  assert.equal(M.projectAuthenticatedHumanPrincipal({ ...identity(), freshnessState:"STALE" }), null);
});
test("presents exact human-rooted issuer semantics", () => {
  const { presentation } = presented();
  assert.equal(presentation.exactPayload.decision, M.DECISION);
  assert.equal(presentation.exactPayload.issuerScope.POLICY.issuerRef, "principal:human:1");
  assert.equal(presentation.exactPayload.issuerScope.ASSIGNMENT.issuerRef, "principal:human:1");
  assert.equal(presentation.exactPayload.issuerScope.DELEGATION, "NOT_BOOTSTRAP_ISSUABLE");
  assert.equal(presentation.exactPayload.machineAuthority, "NONE");
});
test("captures exact accepted decision", () => {
  const x = presented();
  const d = x.f.capture.decide({ session:x.s, principal:x.i, verifiedSource:x.v,
    presentationId:x.presentation.presentationId, decision:M.DECISION });
  assert.equal(d.decision, M.DECISION);
  assert.equal(d.sourceVerificationId, x.v.sourceVerificationId);
  assert.equal(d.principalRef, x.i.principalRef);
  assert.equal(d.authority, "NONE");
});
test("exact decision replay is idempotent", () => {
  const x = presented();
  const args = { session:x.s, principal:x.i, verifiedSource:x.v,
    presentationId:x.presentation.presentationId, decision:M.DECISION };
  assert.deepEqual(x.f.capture.decide(args), x.f.capture.decide(args));
});
test("rejects decision without presentation", () => {
  const c=context(), f=fixture();
  assert.throws(()=>f.capture.decide({session:c.s,principal:c.i,verifiedSource:c.v,
    presentationId:"missing",decision:M.DECISION}), /presentation unavailable/);
});
test("rejects wrong decision literal", () => {
  const x=presented();
  assert.throws(()=>x.f.capture.decide({session:x.s,principal:x.i,verifiedSource:x.v,
    presentationId:x.presentation.presentationId,decision:"APPROVE_TRUST_REGISTRATION"}), /unsupported/);
});
test("rejects another principal", () => {
  const x=presented(); const other={...x.i,principalRef:"principal:human:2",principalEvidenceRef:"principal-evidence:2"};
  assert.throws(()=>x.f.capture.decide({session:x.s,principal:other,verifiedSource:x.v,
    presentationId:x.presentation.presentationId,decision:M.DECISION}), /does not match/);
});
test("rejects changed principal revision", () => {
  const x=presented(); const other={...x.i,principalRevision:"2"};
  assert.throws(()=>x.f.capture.decide({session:x.s,principal:other,verifiedSource:x.v,
    presentationId:x.presentation.presentationId,decision:M.DECISION}), /does not match/);
});
test("rejects another session", () => {
  const x=presented(); const s={...x.s,sessionRef:"session:2"}; const i={...x.i,sessionRef:"session:2"};
  assert.throws(()=>x.f.capture.decide({session:s,principal:i,verifiedSource:x.v,
    presentationId:x.presentation.presentationId,decision:M.DECISION}), /does not match/);
});
test("rejects stale principal", () => {
  const c=context(), f=fixture(), i={...c.i,freshnessState:"STALE"};
  assert.throws(()=>f.capture.present({session:c.s,principal:i,verifiedSource:c.v}), /current exact/);
});
test("rejects stale session", () => {
  const c=context(), f=fixture(), s={...c.s,freshnessState:"STALE"};
  assert.throws(()=>f.capture.present({session:s,principal:c.i,verifiedSource:c.v}), /current authenticated/);
});
test("rejects changed source verification", () => {
  const x=presented(), v={...x.v,sourceVerificationId:"source-verification:2"};
  assert.throws(()=>x.f.capture.decide({session:x.s,principal:x.i,verifiedSource:v,
    presentationId:x.presentation.presentationId,decision:M.DECISION}), /does not match/);
});
test("rejects changed source bytes", () => {
  const x=presented(), v={...x.v,sourceBlobSha256:"sha256:"+"e".repeat(64)};
  assert.throws(()=>x.f.capture.decide({session:x.s,principal:x.i,verifiedSource:v,
    presentationId:x.presentation.presentationId,decision:M.DECISION}), /does not match/);
});
test("rejects changed source policy revision", () => {
  const x=presented(), v={...x.v,sourcePolicyRevision:2};
  assert.throws(()=>x.f.capture.decide({session:x.s,principal:x.i,verifiedSource:v,
    presentationId:x.presentation.presentationId,decision:M.DECISION}), /does not match/);
});
test("rejects source that already names an issuer", () => {
  const c=context(), f=fixture(), v={...c.v,permittedIssuerRefs:["machine"]};
  assert.throws(()=>f.capture.present({session:c.s,principal:c.i,verifiedSource:v}), /exact verified/);
});
test("rejects source that changes delegation bootstrap semantics", () => {
  const c=context(), f=fixture(), v={...c.v,subjectKinds:["POLICY","ASSIGNMENT"]};
  assert.throws(()=>f.capture.present({session:c.s,principal:c.i,verifiedSource:v}), /exact verified/);
});
test("presentation substitution is rejected", () => {
  const x=presented();
  const fake={...x.presentation,exactPayload:{...x.presentation.exactPayload,machineAuthority:"WIDENED"}};
  const ledger={get:()=>fake,commit:()=>fake};
  const f=fixture({presentationLedger:ledger});
  assert.throws(()=>f.capture.decide({session:x.s,principal:x.i,verifiedSource:x.v,
    presentationId:x.presentation.presentationId,decision:M.DECISION}), /does not match/);
});
test("decision ledger material conflict fails closed", () => {
  const x=presented();
  const ledger={get:()=>null,commit:()=>({conflict:true})};
  const f=fixture({presentationLedger:x.f.presentationLedger,decisionLedger:ledger});
  assert.throws(()=>f.capture.decide({session:x.s,principal:x.i,verifiedSource:x.v,
    presentationId:x.presentation.presentationId,decision:M.DECISION}), /ledger conflict/);
});
test("captured decision is directly consumable by integrated bootstrap contract", () => {
  const x=presented();
  const d=x.f.capture.decide({session:x.s,principal:x.i,verifiedSource:x.v,
    presentationId:x.presentation.presentationId,decision:M.DECISION});
  const ledger=bootstrapModule.createMemoryLedger();
  const b=bootstrapModule.createHumanRootedLifecycleIssuerBootstrap({
    verifiedSourcePort:()=>x.v,
    authenticatedHumanPrincipalPort:()=>x.p,
    bootstrapDecisionPort:()=>d,
    acceptanceLedger:ledger
  });
  const out=b.accept({
    rulesetVersion:bootstrapModule.RULESET_VERSION,
    principalRef:x.p.principalRef,principalRevision:x.p.principalRevision,
    sourceVerificationId:x.v.sourceVerificationId,sourcePolicyRevision:x.v.sourcePolicyRevision,
    bootstrapDecisionEvidenceRef:d.bootstrapDecisionEvidenceRef
  });
  assert.equal(out.outcome, bootstrapModule.OUTCOMES.ACCEPTED);
  assert.equal(out.evidence.authority, "NONE");
  assert.equal(out.evidence.delegationBootstrapIssuable, false);
});
test("capture itself creates no role, eligibility, gate or effect authority", () => {
  const x=presented();
  const d=x.f.capture.decide({session:x.s,principal:x.i,verifiedSource:x.v,
    presentationId:x.presentation.presentationId,decision:M.DECISION});
  assert.equal(Object.hasOwn(d,"roleAssigned"),false);
  assert.equal(Object.hasOwn(d,"principalEligible"),false);
  assert.equal(Object.hasOwn(d,"humanGateSatisfied"),false);
  assert.equal(Object.hasOwn(d,"effectAuthorized"),false);
  assert.equal(d.authority,"NONE");
});

console.log(JSON.stringify({
  rulesetVersion:M.RULESET_VERSION, testsPassed:passed,
  authorityInvariant:"PASS: NONE",
  decisionInvariant:"PASS: EXACT HUMAN DECISION ONLY",
  replayInvariant:"PASS: EXACT SOURCE+PRINCIPAL+SESSION BINDING",
  delegationInvariant:"PASS: NOT BOOTSTRAP_ISSUABLE",
  consumerCompatibility:"PASS: HUMAN-ROOTED BOOTSTRAP V0"
},null,2));
