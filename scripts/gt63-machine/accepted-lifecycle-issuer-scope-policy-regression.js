"use strict";
const assert = require("node:assert/strict");
const {
  RULESET_VERSION, OUTCOMES, SOURCE_REF,
  createAcceptedLifecycleIssuerScopePolicy, canonicalStringify
} = require("./accepted-lifecycle-issuer-scope-policy");

const SV = `sha256:${"1".repeat(64)}`;
const RV = `sha256:${"2".repeat(64)}`;
function verified(overrides = {}) {
  return {
    type: "REGISTERED_GOVERNANCE_SOURCE_VERIFICATION",
    status: "VERIFIED",
    sourceVerificationId: SV,
    rootVerificationId: RV,
    registeredSourceRef: SOURCE_REF,
    sourceStatementClass: "GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY",
    sourceIssuerPolicyNamespace: "GT63_MACHINE_GOVERNANCE_LIFECYCLE_ISSUER_SCOPE",
    sourceStatus: "UNCONFIGURED_FAIL_CLOSED",
    issuerSetSemantics: "CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY",
    sourcePolicyRevision: 1,
    permittedIssuerRefs: [],
    subjectKinds: ["POLICY", "ASSIGNMENT", "DELEGATION"],
    authority: "NONE",
    ...overrides
  };
}
function ledger(existing = null) {
  let current = existing;
  return {
    findBySourceRef: () => current,
    commit: (evidence) => { current = evidence; return evidence; },
    read: () => current
  };
}
function system(v = verified(), l = ledger()) {
  return { component: createAcceptedLifecycleIssuerScopePolicy({
    registeredSourceVerificationPort: () => v,
    policyLedger: l
  }), ledger: l };
}
const request = (overrides = {}) => ({
  rulesetVersion: RULESET_VERSION,
  expectedSourceVerificationId: SV,
  expectedRootVerificationId: RV,
  ...overrides
});

const tests=[]; const test=(n,f)=>tests.push([n,f]);
test("accepts exact fail-closed verified policy",()=>{
  const s=system(); const r=s.component.accept(request());
  assert.equal(r.outcome,OUTCOMES.ACCEPTED);
  assert.equal(r.authority,"NONE"); assert.equal(r.evidence.authority,"NONE");
  assert.deepEqual(r.evidence.permittedIssuerRefs,[]);
  assert.equal(r.evidence.sourceStatus,"UNCONFIGURED_FAIL_CLOSED");
  assert.equal(canonicalStringify(s.ledger.read()),canonicalStringify(r.evidence));
});
test("same exact policy is idempotent",()=>{
  const s=system(); const first=s.component.accept(request()); const second=s.component.accept(request());
  assert.equal(first.outcome,OUTCOMES.ACCEPTED); assert.equal(second.outcome,OUTCOMES.ALREADY_ACCEPTED);
  assert.equal(first.evidence.policyAcceptanceId,second.evidence.policyAcceptanceId);
});
test("stale source verification is rejected as STALE",()=>{
  const r=system(verified({sourceVerificationId:`sha256:${"3".repeat(64)}`})).component.accept(request());
  assert.equal(r.outcome,OUTCOMES.STALE);
});
test("stale root verification is rejected as STALE",()=>{
  const r=system(verified({rootVerificationId:`sha256:${"4".repeat(64)}`})).component.accept(request());
  assert.equal(r.outcome,OUTCOMES.STALE);
});
test("unverified source cannot be accepted",()=>{
  const r=system(verified({status:"UNVERIFIED"})).component.accept(request());
  assert.equal(r.outcome,OUTCOMES.UNCERTAIN);
});
test("caller cannot inject permitted issuer",()=>{
  const r=system().component.accept({...request(),permittedIssuerRefs:["issuer:caller"]});
  assert.equal(r.outcome,OUTCOMES.REJECTED);
});
test("verified source containing issuer is outside frozen V0",()=>{
  const r=system(verified({permittedIssuerRefs:["issuer:x"]})).component.accept(request());
  assert.equal(r.outcome,OUTCOMES.UNCERTAIN);
});
test("conflicting prior acceptance blocks replacement",()=>{
  const s1=system(); const accepted=s1.component.accept(request()).evidence;
  const changed={...accepted,policyAcceptanceId:`sha256:${"5".repeat(64)}`};
  const r=system(verified(),ledger(changed)).component.accept(request());
  assert.equal(r.outcome,OUTCOMES.CONFLICT);
});
test("ledger commit conflict is detected",()=>{
  const l={findBySourceRef:()=>null,commit:()=>({bad:true})};
  const r=system(verified(),l).component.accept(request());
  assert.equal(r.outcome,OUTCOMES.CONFLICT);
});
test("materialization creates no lifecycle issuer authority",()=>{
  const r=system().component.accept(request());
  assert.equal(r.outcome,OUTCOMES.ACCEPTED);
  assert.equal(r.evidence.permittedIssuerRefs.length,0);
  assert.equal(r.authority,"NONE");
});
let passed=0;
for(const [n,f] of tests){try{f();passed++;console.log(`PASS ${n}`);}catch(e){console.error(`FAIL ${n}`);throw e;}}
console.log(`RESULT ${passed}/${tests.length} PASS`);
