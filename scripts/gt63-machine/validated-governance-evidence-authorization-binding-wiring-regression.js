"use strict";

const assert = require("node:assert/strict");
const { RULESET_VERSION, OUTCOMES, createValidatedGovernanceEvidenceAuthorizationBindingWiring } = require("./validated-governance-evidence-authorization-binding-wiring");
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
const scope = Object.freeze({scopeType:"GATE",interactionId:"i-1",fromInteractionRevision:1,throughInteractionRevision:1,gateId:"g-1",gateRevision:1,authorityScopeDigest:`sha256:${"a".repeat(64)}`,continuationTargetRef:"op:minimal-v0"});
const principal = {principalRef:"gt63-machine:human-principal:goce-v0",principalRevision:"1",principalEvidenceRef:"ev:principal",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE"};
const eligibility = {principalRef:principal.principalRef,principalRevision:"1",eligibilityEvidenceRef:"ev:eligibility",eligibilityState:"ELIGIBLE",freshnessState:"CURRENT",lifecycleState:"CURRENT",contradictionState:"NONE",contextScope:scope,governanceAct:"GATE_AUTHORIZATION",authority:"NONE"};
const requirement = {requirementRef:"req:gate",requirementRevision:"1",governanceAct:"GATE_AUTHORIZATION",requiredRoleRef:"role:gate-authorizer",requiredRoleRevision:"1",contextScope:scope,roleRequirementEvidenceRef:"ev:req",authority:"NONE"};
const role = {roleResolutionType:"DIRECT_ASSIGNMENT",principalRef:principal.principalRef,principalRevision:"1",roleRef:requirement.requiredRoleRef,roleRevision:"1",contextScope:scope,roleEvidenceRefs:["ev:assignment"],lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE"};
const human = {humanAuthorizationEvidenceRef:"ev:human-auth",principalRef:principal.principalRef,principalRevision:"1",authorizationSubjectRef:"subject:minimal",authorizationSubjectRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope,decision:"APPROVE",exactSemanticDigest:`sha256:${"b".repeat(64)}`,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE"};
const request = {rulesetVersion:RULESET_VERSION,authorizationSubjectRef:"subject:minimal",authorizationSubjectRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope,principalRef:principal.principalRef,principalRevision:"1",humanAuthorizationEvidenceRef:"ev:human-auth"};
function ledger(){const m=new Map();return {get:k=>m.get(k)||null,commit:(k,v)=>{if(m.has(k))throw Error("conflict");m.set(k,v);return v;}};}
function ports(overrides={}){return {
 governancePrincipalBindingResultPort:()=>({outcome:"GOVERNANCE_PRINCIPAL_IDENTITY_BOUND",evidence:principal,authority:"NONE"}),
 principalEligibilityResultPort:()=>({outcome:"PRINCIPAL_ELIGIBILITY_RESOLVED",evidence:eligibility,authority:"NONE"}),
 roleRequirementResultPort:()=>({outcome:"RESOLVED",resolution:requirement,authority:"NONE"}),
 principalRoleResultPort:()=>({outcome:"RESOLVED",resolution:role,authority:"NONE"}),
 humanAuthorizationResultPort:()=>({outcome:"AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED",evidence:human,authority:"NONE"}),
 bindingLedger:ledger(),...overrides};}
function make(o={}){return createValidatedGovernanceEvidenceAuthorizationBindingWiring(ports(o));}
function noDownstream(r){assert.equal(r.authority,"NONE");assert.equal(r.humanGateSatisfied,false);assert.equal(r.continuationAuthorityCreated,false);assert.equal(r.executionAuthorityCreated,false);assert.equal(r.effectAuthorized,false);}

for(const name of ["governancePrincipalBindingResultPort","principalEligibilityResultPort","roleRequirementResultPort","principalRoleResultPort","humanAuthorizationResultPort"]){test(`constructor-requires-${name}`,()=>{const p=ports();delete p[name];assert.throws(()=>createValidatedGovernanceEvidenceAuthorizationBindingWiring(p));});}
test("constructor-requires-binding-ledger",()=>{const p=ports();delete p.bindingLedger;assert.throws(()=>createValidatedGovernanceEvidenceAuthorizationBindingWiring(p));});
test("exact-validated-evidence-can-bind-authorization",()=>{const r=make().assess(request);assert.equal(r.outcome,OUTCOMES.AUTHORIZED);assert.equal(r.binding.authorizationState,"BOUND");noDownstream(r);});
test("same-binding-is-deterministic",()=>{const w=make();const a=w.assess(request),b=w.assess(request);assert.equal(a.outcome,OUTCOMES.AUTHORIZED);assert.deepEqual(a,b);});
test("principal-nonbound-cannot-authorize",()=>assert.equal(make({governancePrincipalBindingResultPort:()=>({outcome:"GOVERNANCE_PRINCIPAL_IDENTITY_NOT_BOUND",evidence:principal,authority:"NONE"})}).assess(request).outcome,OUTCOMES.UNKNOWN));
test("eligibility-unknown-cannot-authorize",()=>assert.equal(make({principalEligibilityResultPort:()=>({outcome:"PRINCIPAL_ELIGIBILITY_UNKNOWN",evidence:eligibility,authority:"NONE"})}).assess(request).outcome,OUTCOMES.UNKNOWN));
test("role-requirement-not-resolved-cannot-authorize",()=>assert.equal(make({roleRequirementResultPort:()=>({outcome:"NOT_RESOLVED",resolution:null,authority:"NONE"})}).assess(request).outcome,OUTCOMES.UNKNOWN));
test("principal-role-not-resolved-cannot-authorize",()=>assert.equal(make({principalRoleResultPort:()=>({outcome:"NOT_RESOLVED",resolution:null,authority:"NONE"})}).assess(request).outcome,OUTCOMES.UNKNOWN));
test("human-authorization-not-authorized-cannot-authorize",()=>assert.equal(make({humanAuthorizationResultPort:()=>({outcome:"AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_NOT_AUTHORIZED",evidence:human,authority:"NONE"})}).assess(request).outcome,OUTCOMES.UNKNOWN));
test("upstream-wrong-authority-cannot-authorize",()=>assert.equal(make({principalRoleResultPort:()=>({outcome:"RESOLVED",resolution:role,authority:"SOME"})}).assess(request).outcome,OUTCOMES.UNKNOWN));
test("evidence-wrong-authority-cannot-authorize",()=>assert.equal(make({principalEligibilityResultPort:()=>({outcome:"PRINCIPAL_ELIGIBILITY_RESOLVED",evidence:{...eligibility,authority:"SOME"},authority:"NONE"})}).assess(request).outcome,OUTCOMES.UNKNOWN));
test("not-eligible-is-not-authorized",()=>assert.equal(make({principalEligibilityResultPort:()=>({outcome:"PRINCIPAL_ELIGIBILITY_RESOLVED",evidence:{...eligibility,eligibilityState:"NOT_ELIGIBLE"},authority:"NONE"})}).assess(request).outcome,OUTCOMES.NOT_AUTHORIZED));
test("deny-human-decision-is-not-authorized",()=>assert.equal(make({humanAuthorizationResultPort:()=>({outcome:"AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED",evidence:{...human,decision:"DENY"},authority:"NONE"})}).assess(request).outcome,OUTCOMES.NOT_AUTHORIZED));
test("wrong-principal-evidence-is-not-authorized",()=>assert.equal(make({governancePrincipalBindingResultPort:()=>({outcome:"GOVERNANCE_PRINCIPAL_IDENTITY_BOUND",evidence:{...principal,principalRef:"other"},authority:"NONE"})}).assess(request).outcome,OUTCOMES.NOT_AUTHORIZED));
test("wrong-role-is-not-authorized",()=>assert.equal(make({principalRoleResultPort:()=>({outcome:"RESOLVED",resolution:{...role,roleRef:"role:other"},authority:"NONE"})}).assess(request).outcome,OUTCOMES.NOT_AUTHORIZED));
test("wrong-human-subject-is-not-authorized",()=>assert.equal(make({humanAuthorizationResultPort:()=>({outcome:"AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED",evidence:{...human,authorizationSubjectRef:"subject:other"},authority:"NONE"})}).assess(request).outcome,OUTCOMES.NOT_AUTHORIZED));
test("principal-port-failure-is-unknown",()=>assert.equal(make({governancePrincipalBindingResultPort:()=>{throw Error("x");}}).assess(request).outcome,OUTCOMES.UNKNOWN));
test("eligibility-port-failure-is-unknown",()=>assert.equal(make({principalEligibilityResultPort:()=>{throw Error("x");}}).assess(request).outcome,OUTCOMES.UNKNOWN));
test("role-port-failure-is-unknown",()=>assert.equal(make({principalRoleResultPort:()=>{throw Error("x");}}).assess(request).outcome,OUTCOMES.UNKNOWN));
test("human-port-failure-is-unknown",()=>assert.equal(make({humanAuthorizationResultPort:()=>{throw Error("x");}}).assess(request).outcome,OUTCOMES.UNKNOWN));
test("wrong-ruleset-invalid",()=>assert.equal(make().assess({...request,rulesetVersion:"wrong"}).outcome,OUTCOMES.INVALID));
test("extra-field-invalid",()=>assert.equal(make().assess({...request,forceAuthorization:true}).outcome,OUTCOMES.INVALID));
test("caller-cannot-force-human-gate",()=>{const r=make().assess({...request,forceHumanGateSatisfied:true});assert.equal(r.outcome,OUTCOMES.INVALID);noDownstream(r);});
test("authorized-result-preserves-no-downstream-authority",()=>noDownstream(make().assess(request)));
test("not-authorized-result-preserves-no-downstream-authority",()=>noDownstream(make({principalEligibilityResultPort:()=>({outcome:"PRINCIPAL_ELIGIBILITY_RESOLVED",evidence:{...eligibility,eligibilityState:"NOT_ELIGIBLE"},authority:"NONE"})}).assess(request)));
test("unknown-result-preserves-no-downstream-authority",()=>noDownstream(make({principalRoleResultPort:()=>({outcome:"UNKNOWN",resolution:null,authority:"NONE"})}).assess(request)));
test("invalid-result-preserves-no-downstream-authority",()=>noDownstream(make().assess({...request,rulesetVersion:"wrong"})));

let passed=0;for(const [name,fn] of tests){try{fn();passed++;console.log(`PASS - ${name}`);}catch(e){console.error(`FAIL - ${name}`);console.error(e&&e.stack||e);process.exitCode=1;}}
console.log(`${passed}/${tests.length} PASS`);if(passed!==tests.length)process.exitCode=1;
