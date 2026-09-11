"use strict";
const assert=require("node:assert/strict");
const {RULESET_VERSION,OUTCOMES,createAcceptedEvidenceRoleResolutionWiring}=require("./accepted-evidence-role-resolution-wiring");
const tests=[];const test=(n,f)=>tests.push([n,f]);const sha=(c)=>`sha256:${c.repeat(64)}`;
const gate={scopeType:"GATE",interactionId:"interaction:1",fromInteractionRevision:1,throughInteractionRevision:1,gateId:"gate:1",gateRevision:1,authorityScopeDigest:sha("a"),continuationTargetRef:"continuation:1"};
const policy={type:"GOVERNANCE_ROLE_POLICY_REQUIREMENT_EVIDENCE_ACCEPTANCE",policyAcceptanceId:"policy-acceptance:1",policyRef:"policy:1",policyRevision:"1",policyDocument:{roles:[{roleRef:"role:authorizer",roleRevision:"1",assignmentCardinality:"SINGLE",delegable:true,maxDelegationDepth:1,redelegationPermitted:false}],requirements:[{requirementRef:"requirement:gate",requirementRevision:"1",governanceAct:"GATE_AUTHORIZATION",requiredRoleRef:"role:authorizer",requiredRoleRevision:"1",contextScope:gate}]},authority:"NONE"};
const assignment={type:"DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE",assignmentKind:"DIRECT",assignmentAcceptanceId:"assignment-acceptance:1",principalRef:"principal:1",principalRevision:"1",roleRef:"role:authorizer",roleRevision:"1",policyAcceptanceId:"policy-acceptance:1",contextScope:gate,observedLifecycleState:"CURRENT",authority:"NONE"};
const delegation={type:"DIRECT_DELEGATION_EVIDENCE_ACCEPTANCE",delegationAcceptanceId:"delegation-acceptance:1",granteeRef:"principal:2",granteeRevision:"1",roleRef:"role:authorizer",roleRevision:"1",policyAcceptanceId:"policy-acceptance:1",delegatedScope:gate,observedLifecycleState:"CURRENT",chainDepth:1,authority:"NONE"};
function deps(o={}){return {acceptedPolicyLedgerPort:()=>[policy],acceptedAssignmentLedgerPort:()=>[assignment],acceptedDelegationLedgerPort:()=>[delegation],...o};}
function wiring(o={}){return createAcceptedEvidenceRoleResolutionWiring(deps(o));}
function reqRequirement(){return {rulesetVersion:RULESET_VERSION,governanceAct:"GATE_AUTHORIZATION",contextScope:gate};}
function reqRole(principalRef="principal:1"){return {rulesetVersion:RULESET_VERSION,principalRef,principalRevision:"1",roleRef:"role:authorizer",roleRevision:"1",contextScope:gate};}
function assertNone(r){assert.equal(r.authority,"NONE");assert.equal(r.principalEligibilityCreated,false);assert.equal(r.authorizationCreated,false);assert.equal(r.humanGateSatisfied,false);assert.equal(r.continuationAuthorityCreated,false);assert.equal(r.executionAuthorityCreated,false);assert.equal(r.effectAuthorized,false);}

test("constructor-requires-policy-ledger",()=>assert.throws(()=>createAcceptedEvidenceRoleResolutionWiring({acceptedAssignmentLedgerPort:()=>[],acceptedDelegationLedgerPort:()=>[]}),/acceptedPolicyLedgerPort/));
test("constructor-requires-assignment-ledger",()=>assert.throws(()=>createAcceptedEvidenceRoleResolutionWiring({acceptedPolicyLedgerPort:()=>[],acceptedDelegationLedgerPort:()=>[]}),/acceptedAssignmentLedgerPort/));
test("constructor-requires-delegation-ledger",()=>assert.throws(()=>createAcceptedEvidenceRoleResolutionWiring({acceptedPolicyLedgerPort:()=>[],acceptedAssignmentLedgerPort:()=>[]}),/acceptedDelegationLedgerPort/));
test("exact-gate-requirement-resolved",()=>{const r=wiring().resolveRequirement(reqRequirement());assert.equal(r.outcome,OUTCOMES.RESOLVED);assert.equal(r.resolution.requiredRoleRef,"role:authorizer");});
test("direct-assignment-role-resolved",()=>{const r=wiring().resolvePrincipalRole(reqRole("principal:1"));assert.equal(r.outcome,OUTCOMES.RESOLVED);assert.equal(r.resolution.roleResolutionType,"DIRECT_ASSIGNMENT");});
test("delegated-role-resolved",()=>{const r=wiring().resolvePrincipalRole(reqRole("principal:2"));assert.equal(r.outcome,OUTCOMES.RESOLVED);assert.equal(r.resolution.roleResolutionType,"DELEGATION");});
test("no-policy-requirement-not-resolved",()=>{const r=wiring({acceptedPolicyLedgerPort:()=>[]}).resolveRequirement(reqRequirement());assert.equal(r.outcome,OUTCOMES.NOT_RESOLVED);});
test("no-role-evidence-not-resolved",()=>{const r=wiring({acceptedAssignmentLedgerPort:()=>[],acceptedDelegationLedgerPort:()=>[]}).resolvePrincipalRole(reqRole("principal:9"));assert.equal(r.outcome,OUTCOMES.NOT_RESOLVED);});
test("conflicting-direct-and-delegation-is-unknown",()=>{const d={...delegation,granteeRef:"principal:1"};const r=wiring({acceptedDelegationLedgerPort:()=>[d]}).resolvePrincipalRole(reqRole("principal:1"));assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("invalid-policy-record-is-unknown",()=>{const r=wiring({acceptedPolicyLedgerPort:()=>[{...policy,authority:"WRITE"}]}).resolveRequirement(reqRequirement());assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("invalid-assignment-record-is-unknown",()=>{const r=wiring({acceptedAssignmentLedgerPort:()=>[{...assignment,observedLifecycleState:"STALE"}]}).resolvePrincipalRole(reqRole("principal:1"));assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("invalid-delegation-record-is-unknown",()=>{const r=wiring({acceptedDelegationLedgerPort:()=>[{...delegation,chainDepth:2}]}).resolvePrincipalRole(reqRole("principal:2"));assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("policy-ledger-failure-unknown",()=>{const r=wiring({acceptedPolicyLedgerPort:()=>{throw Error("offline");}}).resolveRequirement(reqRequirement());assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("assignment-ledger-failure-unknown",()=>{const r=wiring({acceptedAssignmentLedgerPort:()=>{throw Error("offline");}}).resolvePrincipalRole(reqRole("principal:1"));assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("delegation-ledger-failure-unknown",()=>{const r=wiring({acceptedDelegationLedgerPort:()=>{throw Error("offline");}}).resolvePrincipalRole(reqRole("principal:1"));assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("wrong-ruleset-invalid",()=>{const q=reqRequirement();q.rulesetVersion="wrong";assert.equal(wiring().resolveRequirement(q).outcome,OUTCOMES.INVALID);});
test("extra-requirement-field-invalid",()=>assert.equal(wiring().resolveRequirement({...reqRequirement(),authorization:true}).outcome,OUTCOMES.INVALID));
test("extra-role-field-invalid",()=>assert.equal(wiring().resolvePrincipalRole({...reqRole(),eligibility:true}).outcome,OUTCOMES.INVALID));
test("deterministic-requirement-resolution",()=>assert.deepEqual(wiring().resolveRequirement(reqRequirement()),wiring().resolveRequirement(reqRequirement())));
test("deterministic-direct-role-resolution",()=>assert.deepEqual(wiring().resolvePrincipalRole(reqRole("principal:1")),wiring().resolvePrincipalRole(reqRole("principal:1"))));
test("deterministic-delegated-role-resolution",()=>assert.deepEqual(wiring().resolvePrincipalRole(reqRole("principal:2")),wiring().resolvePrincipalRole(reqRole("principal:2"))));
test("resolved-requirement-no-downstream-authority",()=>assertNone(wiring().resolveRequirement(reqRequirement())));
test("resolved-direct-role-no-downstream-authority",()=>assertNone(wiring().resolvePrincipalRole(reqRole("principal:1"))));
test("resolved-delegated-role-no-downstream-authority",()=>assertNone(wiring().resolvePrincipalRole(reqRole("principal:2"))));
test("unknown-no-downstream-authority",()=>assertNone(wiring({acceptedPolicyLedgerPort:()=>{throw Error("x");}}).resolveRequirement(reqRequirement())));
test("invalid-no-downstream-authority",()=>assertNone(wiring().resolveRequirement({})));

let passed=0;for(const [n,f]of tests){try{f();passed++;console.log(`PASS - ${n}`);}catch(e){console.error(`FAIL - ${n}`);console.error(e&&e.stack?e.stack:e);process.exitCode=1;}}console.log(`${passed}/${tests.length} PASS`);if(passed!==tests.length)process.exitCode=1;
