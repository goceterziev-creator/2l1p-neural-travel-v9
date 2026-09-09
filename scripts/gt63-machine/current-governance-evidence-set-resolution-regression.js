"use strict";
const assert = require("node:assert/strict");
const { RULESET_VERSION, OUTCOMES, resolveCurrentGovernanceEvidenceSet, canonicalStringify } = require("./current-governance-evidence-set-resolution");

function base() {
  const policy = { type:"GOVERNANCE_ROLE_POLICY_REQUIREMENT_EVIDENCE_ACCEPTANCE", policyAcceptanceId:"policy-acc-1", policyRef:"policy:main", policyRevision:"p1", authority:"NONE" };
  const assignment = { type:"DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE", assignmentAcceptanceId:"assign-acc-1", assignmentRef:"assignment:owner", assignmentRevision:"a1", authority:"NONE" };
  const delegation = { type:"DIRECT_DELEGATION_EVIDENCE_ACCEPTANCE", delegationAcceptanceId:"deleg-acc-1", delegationRef:"delegation:gate", delegationRevision:"d1", authority:"NONE" };
  return {
    rulesetVersion:RULESET_VERSION, resolutionFrameRevision:"frame-1",
    acceptedPolicies:[policy], acceptedAssignments:[assignment], acceptedDelegations:[delegation],
    policyLifecycle:[{policyAcceptanceId:"policy-acc-1",state:"CURRENT",lifecycleRevision:"lp1",contradictionState:"NONE",evidenceRef:"e:lp1"}],
    assignmentLifecycle:[{assignmentAcceptanceId:"assign-acc-1",state:"CURRENT",lifecycleRevision:"la1",contradictionState:"NONE",evidenceRef:"e:la1"}],
    delegationLifecycle:[{delegationAcceptanceId:"deleg-acc-1",state:"CURRENT",lifecycleRevision:"ld1",contradictionState:"NONE",evidenceRef:"e:ld1"}],
    coverage:[
      {kind:"POLICY",ref:"policy:main",completeThroughRevision:"p1",evidenceRef:"e:cp"},
      {kind:"ASSIGNMENT",ref:"assignment:owner",completeThroughRevision:"a1",evidenceRef:"e:ca"},
      {kind:"DELEGATION",ref:"delegation:gate",completeThroughRevision:"d1",evidenceRef:"e:cd"}
    ]
  };
}
const tests = [];
function test(name, fn){ tests.push([name,fn]); }

test("resolves complete current set deterministically",()=>{
  const a=resolveCurrentGovernanceEvidenceSet(base()); const b=resolveCurrentGovernanceEvidenceSet(base());
  assert.equal(a.outcome,OUTCOMES.RESOLVED); assert.equal(a.authority,"NONE"); assert.equal(a.evidenceSet.authority,"NONE");
  assert.equal(canonicalStringify(a),canonicalStringify(b)); assert.equal(a.evidenceSet.resolutionDigest,b.evidenceSet.resolutionDigest);
});

test("missing coverage preserves UNKNOWN",()=>{
  const x=base(); x.coverage=x.coverage.filter(i=>i.kind!=="ASSIGNMENT");
  assert.equal(resolveCurrentGovernanceEvidenceSet(x).outcome,OUTCOMES.UNKNOWN);
});

test("coverage revision drift preserves UNKNOWN",()=>{
  const x=base(); x.coverage.find(i=>i.kind==="DELEGATION").completeThroughRevision="d0";
  assert.equal(resolveCurrentGovernanceEvidenceSet(x).outcome,OUTCOMES.UNKNOWN);
});

test("revoked records are excluded from current set",()=>{
  const x=base(); x.delegationLifecycle[0].state="REVOKED";
  const r=resolveCurrentGovernanceEvidenceSet(x); assert.equal(r.outcome,OUTCOMES.RESOLVED); assert.equal(r.evidenceSet.delegations.length,0);
});

test("superseded records are excluded from current set",()=>{
  const x=base(); x.assignmentLifecycle[0].state="SUPERSEDED";
  const r=resolveCurrentGovernanceEvidenceSet(x); assert.equal(r.outcome,OUTCOMES.RESOLVED); assert.equal(r.evidenceSet.assignments.length,0);
});

test("unknown lifecycle preserves UNKNOWN",()=>{
  const x=base(); x.policyLifecycle[0].state="UNKNOWN";
  assert.equal(resolveCurrentGovernanceEvidenceSet(x).outcome,OUTCOMES.UNKNOWN);
});

test("contradiction produces CONFLICT",()=>{
  const x=base(); x.assignmentLifecycle[0].contradictionState="CONFLICT";
  assert.equal(resolveCurrentGovernanceEvidenceSet(x).outcome,OUTCOMES.CONFLICT);
});

test("multiple CURRENT records for one ref conflict",()=>{
  const x=base();
  x.acceptedAssignments.push({type:"DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE",assignmentAcceptanceId:"assign-acc-2",assignmentRef:"assignment:owner",assignmentRevision:"a2",authority:"NONE"});
  x.assignmentLifecycle.push({assignmentAcceptanceId:"assign-acc-2",state:"CURRENT",lifecycleRevision:"la2",contradictionState:"NONE",evidenceRef:"e:la2"});
  x.coverage.find(i=>i.kind==="ASSIGNMENT").completeThroughRevision="a2";
  assert.equal(resolveCurrentGovernanceEvidenceSet(x).outcome,OUTCOMES.CONFLICT);
});

test("caller supplied eligible flag cannot create truth",()=>{
  const x=base(); x.eligible=true;
  assert.equal(resolveCurrentGovernanceEvidenceSet(x).outcome,OUTCOMES.REJECTED);
});

test("authority remains NONE in all terminal outcomes",()=>{
  for (const make of [()=>base(),()=>{const x=base();x.policyLifecycle[0].state="UNKNOWN";return x;},()=>{const x=base();x.policyLifecycle[0].state="CONFLICT";return x;}]) {
    assert.equal(resolveCurrentGovernanceEvidenceSet(make()).authority,"NONE");
  }
});

let passed=0;
for (const [name,fn] of tests) { try { fn(); passed+=1; console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}`); throw error; } }
console.log(`RESULT ${passed}/${tests.length} PASS`);
