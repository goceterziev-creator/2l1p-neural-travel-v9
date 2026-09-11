"use strict";

const assert = require("node:assert/strict");
const {
  RULESET_VERSION,
  OUTCOMES,
  createGovernanceEvidenceProductionToAcceptanceWiring
} = require("./governance-evidence-production-to-acceptance-wiring");
const production = require("./governance-evidence-object-production");

const tests=[]; const test=(n,f)=>tests.push([n,f]);
const sha=(c)=>`sha256:${c.repeat(64)}`;
const gateScope={scopeType:"GATE",interactionId:"interaction:1",fromInteractionRevision:1,throughInteractionRevision:1,gateId:"gate:1",gateRevision:1,authorityScopeDigest:sha("a"),continuationTargetRef:"continuation:1"};
const policyDoc={roles:[{roleRef:"role:authorizer",roleRevision:"1",assignmentCardinality:"SINGLE",delegable:false,maxDelegationDepth:0,redelegationPermitted:false}],requirements:[{requirementRef:"requirement:gate",requirementRevision:"1",governanceAct:"GATE_AUTHORIZATION",requiredRoleRef:"role:authorizer",requiredRoleRevision:"1",contextScope:gateScope}],assignmentIssuerRefs:[production.ISSUER.issuerRef]};
const materials={
 POLICY:{policyRef:"policy:1",policyRevision:"1",policyDocument:policyDoc,validFromTemporalFrameRef:"temporal:1",validThroughTemporalFrameRef:null,lifecycleState:"CURRENT",supersedesPolicyRef:null},
 ASSIGNMENT:{assignmentRef:"assignment:1",assignmentRevision:"1",principalRef:"principal:1",principalRevision:"1",roleRef:"role:authorizer",roleRevision:"1",policyRef:"policy:1",policyRevision:"1",contextScope:gateScope,validFromTemporalFrameRef:"temporal:1",validThroughTemporalFrameRef:null,lifecycleState:"CURRENT",supersedesAssignmentRef:null},
 DELEGATION:{delegationRef:"delegation:1",delegationRevision:"1",sourceEventBindingRef:"source-event-binding:1",grantBytesBase64:Buffer.from(JSON.stringify({grantorRef:"principal:1",grantorRevision:"1",granteeRef:"principal:2",granteeRevision:"1",roleRef:"role:authorizer",roleRevision:"1",grantorAssignmentRef:"assignment:1",grantorAssignmentRevision:"1",policyRef:"policy:1",policyRevision:"1",delegatedScope:gateScope,chainDepth:1,redelegationPermitted:false,parentDelegationRef:null,validFromTemporalFrameRef:"temporal:1",validThroughTemporalFrameRef:null,lifecycleState:"CURRENT",assignmentLifecycleRevision:"1",policyLifecycleRevision:"1",delegationLifecycleRevision:"1",temporalFrameRevision:"1"}),"utf8").toString("base64"),grantContentEncoding:"utf-8"}
};
function bindingPort(a){const s=production.SOURCES[a.subjectKind];return {outcome:"BOUND",authority:"NONE",evidence:{issuerRef:production.ISSUER.issuerRef,issuerRevision:"1",subjectKind:a.subjectKind,sourceRef:s.sourceRef,sourceRevision:"1",bindingEvidenceRef:sha("b"),authority:"NONE"}};}
const producer=production.createGovernanceEvidenceObjectProduction({issuerSourceBindingPort:bindingPort});
function evidenceProductionPort(r){return producer.produce(r);}
function sourceTrustPort(a){return {outcome:"TRUSTED",authority:"NONE",registryRecord:{sourceRef:a.sourceRef,sourceRevision:a.sourceRevision,trustState:"TRUSTED",registryEvidenceRef:sha("c")}};}
function temporalFramePort(){return {state:"CURRENT",temporalFrameRevision:"1",evidenceRef:sha("d")};}
function ledger(key){const rows=[];return {findByPolicyRef:()=>rows.filter(x=>x.policyRef===key),findByAssignmentRef:()=>rows.filter(x=>x.assignmentRef===key),findByDelegationRef:()=>rows.filter(x=>x.delegationRef===key),commit:(x)=>{rows.push(x);return x;}};}
function principalIdentityPort({principalRef}){return {principalRef,principalRevision:"1",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",principalEvidenceRef:sha("e")};}
const acceptedPolicy={type:"GOVERNANCE_ROLE_POLICY_REQUIREMENT_EVIDENCE_ACCEPTANCE",policyAcceptanceId:"policy-acceptance:1",policyRef:"policy:1",policyRevision:"1",policyContentDigest:sha("f"),policyDocument:policyDoc,sourceRef:production.SOURCES.POLICY.sourceRef,sourceRevision:"1",validFromTemporalFrameRef:"temporal:1",validThroughTemporalFrameRef:null,observedLifecycleState:"CURRENT",supersedesPolicyRef:null,temporalFrameRevision:"1",evidenceRefs:[sha("f")],authority:"NONE"};
function policyAcceptancePort(){return acceptedPolicy;}
function productionRequest(kind){return {rulesetVersion:production.RULESET_VERSION,issuerRef:production.ISSUER.issuerRef,issuerRevision:"1",subjectKind:kind,material:materials[kind]};}
function policyAcceptanceRequest(){return {rulesetVersion:"governance-role-policy-requirement-evidence-v1.0.0",policyRef:"policy:1",expectedPolicyRevision:"1",expectedSourceRevision:"1",expectedTemporalFrameRevision:"1"};}
function deps(overrides={}){return {evidenceProductionPort,sourceTrustPort,temporalFramePort,policyLedger:ledger("policy:1"),assignmentLedger:ledger("assignment:1"),delegationLedger:ledger("delegation:1"),principalIdentityPort,policyAcceptancePort,authenticatedSourceBindingPort:()=>({type:"AUTHENTICATED_HUMAN_PRINCIPAL_SOURCE_EVENT_BINDING",sourceEventBindingRef:"source-event-binding:1",principalRef:"principal:1",principalRevision:"1",sourceEventDigest:sha("1"),authority:"NONE"}),grantorAssignmentPort:()=>({assignmentAcceptanceId:"assignment-acceptance:1",assignmentRef:"assignment:1",assignmentRevision:"1",principalRef:"principal:1",principalRevision:"1",roleRef:"role:authorizer",roleRevision:"1",policyAcceptanceId:"policy-acceptance:1",contextScope:gateScope,authority:"NONE"}),assignmentCurrentStatePort:()=>({state:"CURRENT",assignmentLifecycleRevision:"1",evidenceRef:sha("2")}),policyCurrentStatePort:()=>({state:"CURRENT",policyLifecycleRevision:"1",evidenceRef:sha("3")}),delegationCurrentStatePort:()=>({state:"CURRENT",delegationLifecycleRevision:"1",evidenceRef:sha("4")}),...overrides};}
function wire(o={}){return createGovernanceEvidenceProductionToAcceptanceWiring(deps(o));}
function request(kind, acceptanceRequest){return {rulesetVersion:RULESET_VERSION,subjectKind:kind,productionRequest:productionRequest(kind),acceptanceRequest};}
function noAuthority(r){assert.equal(r.authority,"NONE");assert.equal(r.principalEligibilityCreated,false);assert.equal(r.authorizationCreated,false);assert.equal(r.humanGateSatisfied,false);assert.equal(r.continuationAuthorityCreated,false);assert.equal(r.executionAuthorityCreated,false);assert.equal(r.effectAuthorized,false);}

test("constructor-requires-production-port",()=>assert.throws(()=>createGovernanceEvidenceProductionToAcceptanceWiring({sourceTrustPort}),/evidenceProductionPort/));
test("constructor-requires-source-trust-port",()=>assert.throws(()=>createGovernanceEvidenceProductionToAcceptanceWiring({evidenceProductionPort}),/sourceTrustPort/));
test("exact-policy-production-can-be-accepted",()=>{const r=wire().accept(request("POLICY",policyAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.ACCEPTED);assert.ok(r.acceptanceEvidence);});
test("same-policy-can-be-already-accepted",()=>{const w=wire();const q=request("POLICY",policyAcceptanceRequest());assert.equal(w.accept(q).outcome,OUTCOMES.ACCEPTED);assert.equal(w.accept(q).outcome,OUTCOMES.ALREADY_ACCEPTED);});
test("production-failure-is-not-accepted",()=>{const r=wire({evidenceProductionPort:()=>({outcome:"NOT_PRODUCED",authority:"NONE",evidenceAccepted:false})}).accept(request("POLICY",policyAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);});
test("production-port-failure-is-unknown",()=>{const r=wire({evidenceProductionPort:()=>{throw Error("offline");}}).accept(request("POLICY",policyAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("untrusted-source-cannot-be-accepted",()=>{const r=wire({sourceTrustPort:()=>({outcome:"NOT_TRUSTED",authority:"NONE",registryRecord:null})}).accept(request("POLICY",policyAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.UNKNOWN);assert.equal(r.acceptanceEvidence,null);});
test("trust-port-failure-is-unknown",()=>{const r=wire({sourceTrustPort:()=>{throw Error("offline");}}).accept(request("POLICY",policyAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("stale-temporal-policy-not-accepted",()=>{const r=wire({temporalFramePort:()=>({state:"STALE",temporalFrameRevision:"1",evidenceRef:sha("d")})}).accept(request("POLICY",policyAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);assert.equal(r.acceptanceEvidence,null);});
test("wrong-policy-revision-not-accepted",()=>{const q=policyAcceptanceRequest();q.expectedPolicyRevision="2";const r=wire().accept(request("POLICY",q));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);});
test("extra-top-level-field-invalid",()=>{const r=wire().accept({...request("POLICY",policyAcceptanceRequest()),evidenceAccepted:true});assert.equal(r.outcome,OUTCOMES.INVALID);});
test("unsupported-subject-invalid",()=>{const r=wire().accept({rulesetVersion:RULESET_VERSION,subjectKind:"OTHER",productionRequest:{},acceptanceRequest:{}});assert.equal(r.outcome,OUTCOMES.INVALID);});
test("caller-cannot-force-acceptance",()=>{const r=wire().accept({...request("POLICY",policyAcceptanceRequest()),acceptanceOutcome:"ROLE_POLICY_EVIDENCE_ACCEPTED"});assert.equal(r.outcome,OUTCOMES.INVALID);});
test("acceptance-result-wrong-authority-is-unknown",()=>{const bad={...deps(),policyLedger:{findByPolicyRef:()=>[],commit:(x)=>({...x,authority:"WRITE"})}};const r=createGovernanceEvidenceProductionToAcceptanceWiring(bad).accept(request("POLICY",policyAcceptanceRequest()));assert.notEqual(r.outcome,OUTCOMES.ACCEPTED);});
test("deterministic-policy-wiring-with-fresh-ledgers",()=>{const a=wire().accept(request("POLICY",policyAcceptanceRequest()));const b=wire().accept(request("POLICY",policyAcceptanceRequest()));assert.deepEqual(a,b);});
test("accepted-result-preserves-no-downstream-authority",()=>noAuthority(wire().accept(request("POLICY",policyAcceptanceRequest()))));
test("not-accepted-result-preserves-no-downstream-authority",()=>{const q=policyAcceptanceRequest();q.expectedSourceRevision="2";noAuthority(wire().accept(request("POLICY",q)));});
test("unknown-result-preserves-no-downstream-authority",()=>noAuthority(wire({sourceTrustPort:()=>{throw Error("x");}}).accept(request("POLICY",policyAcceptanceRequest()))));
test("invalid-result-preserves-no-downstream-authority",()=>noAuthority(wire().accept({}))); 

let passed=0;for(const [name,fn] of tests){try{fn();passed++;console.log(`PASS - ${name}`);}catch(e){console.error(`FAIL - ${name}`);console.error(e&&e.stack?e.stack:e);process.exitCode=1;}}console.log(`${passed}/${tests.length} PASS`);if(passed!==tests.length)process.exitCode=1;
