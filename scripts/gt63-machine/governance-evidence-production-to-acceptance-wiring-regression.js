"use strict";

const assert = require("node:assert/strict");
const {
  RULESET_VERSION,
  OUTCOMES,
  createGovernanceEvidenceProductionToAcceptanceWiring
} = require("./governance-evidence-production-to-acceptance-wiring");
const production = require("./governance-evidence-object-production");
const accepted = require("./accepted-governance-role-evidence");

const tests=[]; const test=(n,f)=>tests.push([n,f]);
const sha=(c)=>`sha256:${c.repeat(64)}`;
const gateScope={scopeType:"GATE",interactionId:"interaction:1",fromInteractionRevision:1,throughInteractionRevision:1,gateId:"gate:1",gateRevision:1,authorityScopeDigest:sha("a"),continuationTargetRef:"continuation:1"};
const policyDoc={roles:[{roleRef:"role:authorizer",roleRevision:"1",assignmentCardinality:"SINGLE",delegable:true,maxDelegationDepth:1,redelegationPermitted:false}],requirements:[{requirementRef:"requirement:gate",requirementRevision:"1",governanceAct:"GATE_AUTHORIZATION",requiredRoleRef:"role:authorizer",requiredRoleRevision:"1",contextScope:gateScope}],assignmentIssuerRefs:[production.SOURCES.ASSIGNMENT.sourceRef]};
const grant={grantorRef:"principal:1",grantorRevision:"1",granteeRef:"principal:2",granteeRevision:"1",roleRef:"role:authorizer",roleRevision:"1",grantorAssignmentRef:"assignment:1",grantorAssignmentRevision:"1",policyRef:"policy:1",policyRevision:"1",delegatedScope:gateScope,validFromTemporalFrameRef:"temporal:1",validThroughTemporalFrameRef:null,chainDepth:1,redelegationPermitted:false,parentDelegationRef:null};
const canonicalGrant=accepted.canonicalStringify(grant);
const materials={
 POLICY:{policyRef:"policy:1",policyRevision:"1",policyDocument:policyDoc,validFromTemporalFrameRef:"temporal:1",validThroughTemporalFrameRef:null,lifecycleState:"CURRENT",supersedesPolicyRef:null},
 ASSIGNMENT:{assignmentRef:"assignment:1",assignmentRevision:"1",principalRef:"principal:1",principalRevision:"1",roleRef:"role:authorizer",roleRevision:"1",policyRef:"policy:1",policyRevision:"1",contextScope:gateScope,validFromTemporalFrameRef:"temporal:1",validThroughTemporalFrameRef:null,lifecycleState:"CURRENT",supersedesAssignmentRef:null},
 DELEGATION:{delegationRef:"delegation:1",delegationRevision:"1",sourceEventBindingRef:"source-event-binding:1",grantBytesBase64:Buffer.from(canonicalGrant,"utf8").toString("base64"),grantContentEncoding:"utf-8"}
};
function bindingPort(a){const s=production.SOURCES[a.subjectKind];return {outcome:"BOUND",authority:"NONE",evidence:{issuerRef:production.ISSUER.issuerRef,issuerRevision:"1",subjectKind:a.subjectKind,sourceRef:s.sourceRef,sourceRevision:"1",bindingEvidenceRef:sha("b"),authority:"NONE"}};}
const producer=production.createGovernanceEvidenceObjectProduction({issuerSourceBindingPort:bindingPort});
function evidenceProductionPort(r){return producer.produce(r);}
function sourceTrustPort(a){return {outcome:"TRUSTED",authority:"NONE",registryRecord:{sourceRef:a.sourceRef,sourceRevision:a.sourceRevision,trustState:"TRUSTED",registryEvidenceRef:sha("c")}};}
function temporalFramePort(){return {state:"CURRENT",temporalFrameRevision:"1",evidenceRef:sha("d")};}
function policyLedger(){const rows=[];return {findByPolicyRef:(ref)=>rows.filter(x=>x.policyRef===ref),commit:(x)=>{rows.push(x);return x;}};}
function assignmentLedger(){const rows=[];return {findByAssignmentRef:(ref)=>rows.filter(x=>x.assignmentRef===ref),listCurrentByRoleContext:()=>rows,commit:(x)=>{rows.push(x);return x;}};}
function delegationLedger(){const rows=[];return {findByDelegationRef:(ref)=>rows.filter(x=>x.delegationRef===ref),commit:(x)=>{rows.push(x);return x;}};}
function principalIdentityPort({principalRef}){return {principalRef,principalRevision:"1",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",principalEvidenceRef:sha(principalRef.endsWith("2")?"6":"e")};}
const acceptedPolicy={type:"GOVERNANCE_ROLE_POLICY_REQUIREMENT_EVIDENCE_ACCEPTANCE",policyAcceptanceId:"policy-acceptance:1",policyRef:"policy:1",policyRevision:"1",policyContentDigest:sha("f"),policyDocument:policyDoc,sourceRef:production.SOURCES.POLICY.sourceRef,sourceRevision:"1",validFromTemporalFrameRef:"temporal:1",validThroughTemporalFrameRef:null,observedLifecycleState:"CURRENT",supersedesPolicyRef:null,temporalFrameRevision:"1",evidenceRefs:[sha("f")],authority:"NONE"};
function policyAcceptancePort(){return acceptedPolicy;}
const acceptedAssignment={type:"DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE",assignmentKind:"DIRECT",assignmentAcceptanceId:"assignment-acceptance:1",assignmentRef:"assignment:1",assignmentRevision:"1",principalRef:"principal:1",principalRevision:"1",roleRef:"role:authorizer",roleRevision:"1",policyAcceptanceId:"policy-acceptance:1",contextScope:gateScope,authority:"NONE"};
function productionRequest(kind){return {rulesetVersion:production.RULESET_VERSION,issuerRef:production.ISSUER.issuerRef,issuerRevision:"1",subjectKind:kind,material:materials[kind]};}
function policyAcceptanceRequest(){return {rulesetVersion:accepted.POLICY_RULESET_VERSION,policyRef:"policy:1",expectedPolicyRevision:"1",expectedSourceRevision:"1",expectedTemporalFrameRevision:"1"};}
function assignmentAcceptanceRequest(){return {rulesetVersion:accepted.ASSIGNMENT_RULESET_VERSION,assignmentRef:"assignment:1",expectedAssignmentRevision:"1",expectedSourceRevision:"1",expectedPrincipalRevision:"1",expectedPolicyAcceptanceId:"policy-acceptance:1",expectedTemporalFrameRevision:"1"};}
function delegationAcceptanceRequest(){return {rulesetVersion:accepted.DELEGATION_RULESET_VERSION,delegationRef:"delegation:1",expectedDelegationRevision:"1",expectedSourceRevision:"1",expectedGrantorRevision:"1",expectedGranteeRevision:"1",expectedGrantorAssignmentAcceptanceId:"assignment-acceptance:1",expectedAssignmentLifecycleRevision:"1",expectedPolicyAcceptanceId:"policy-acceptance:1",expectedPolicyLifecycleRevision:"1",expectedTemporalFrameRevision:"1",expectedDelegationLifecycleRevision:"1"};}
function authenticatedSourceBindingPort(){return {bindingId:"source-event-binding:1",originAuthenticationState:"AUTHENTICATED",interactionBindingState:"BOUND",contentIntegrityState:"EXACT_BYTES",presentationClass:"DIRECT",principalRef:"principal:1",principalRevision:"1",contentDigest:`sha256:${require("node:crypto").createHash("sha256").update(Buffer.from(canonicalGrant,"utf8")).digest("hex")}`,interactionId:"interaction:1",authority:"NONE"};}
function assignmentCurrentStatePort(){return {assignmentAcceptanceId:"assignment-acceptance:1",state:"CURRENT",lifecycleRevision:"1",contradictionState:"NONE",evidenceRef:sha("2")};}
function policyCurrentStatePort(){return {policyAcceptanceId:"policy-acceptance:1",state:"CURRENT",lifecycleRevision:"1",contradictionState:"NONE",evidenceRef:sha("3")};}
function delegationCurrentStatePort(){return {delegationRef:"delegation:1",delegationRevision:"1",state:"CURRENT",lifecycleRevision:"1",contradictionState:"NONE",evidenceRef:sha("4")};}
function deps(overrides={}){return {evidenceProductionPort,sourceTrustPort,temporalFramePort,policyLedger:policyLedger(),assignmentLedger:assignmentLedger(),delegationLedger:delegationLedger(),principalIdentityPort,policyAcceptancePort,authenticatedSourceBindingPort,grantorAssignmentPort:()=>acceptedAssignment,assignmentCurrentStatePort,policyCurrentStatePort,delegationCurrentStatePort,...overrides};}
function wire(o={}){return createGovernanceEvidenceProductionToAcceptanceWiring(deps(o));}
function request(kind, acceptanceRequest){return {rulesetVersion:RULESET_VERSION,subjectKind:kind,productionRequest:productionRequest(kind),acceptanceRequest};}
function noAuthority(r){assert.equal(r.authority,"NONE");assert.equal(r.principalEligibilityCreated,false);assert.equal(r.authorizationCreated,false);assert.equal(r.humanGateSatisfied,false);assert.equal(r.continuationAuthorityCreated,false);assert.equal(r.executionAuthorityCreated,false);assert.equal(r.effectAuthorized,false);}

test("constructor-requires-production-port",()=>assert.throws(()=>createGovernanceEvidenceProductionToAcceptanceWiring({sourceTrustPort}),/evidenceProductionPort/));
test("constructor-requires-source-trust-port",()=>assert.throws(()=>createGovernanceEvidenceProductionToAcceptanceWiring({evidenceProductionPort}),/sourceTrustPort/));
test("exact-policy-production-can-be-accepted",()=>{const r=wire().accept(request("POLICY",policyAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.ACCEPTED);assert.ok(r.acceptanceEvidence);});
test("same-policy-can-be-already-accepted",()=>{const w=wire();const q=request("POLICY",policyAcceptanceRequest());assert.equal(w.accept(q).outcome,OUTCOMES.ACCEPTED);assert.equal(w.accept(q).outcome,OUTCOMES.ALREADY_ACCEPTED);});
test("exact-assignment-production-can-be-accepted",()=>{const r=wire().accept(request("ASSIGNMENT",assignmentAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.ACCEPTED);assert.equal(r.acceptanceEvidence.type,"DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE");});
test("same-assignment-can-be-already-accepted",()=>{const w=wire();const q=request("ASSIGNMENT",assignmentAcceptanceRequest());assert.equal(w.accept(q).outcome,OUTCOMES.ACCEPTED);assert.equal(w.accept(q).outcome,OUTCOMES.ALREADY_ACCEPTED);});
test("exact-delegation-production-can-be-accepted",()=>{const r=wire().accept(request("DELEGATION",delegationAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.ACCEPTED);assert.equal(r.acceptanceEvidence.type,"DIRECT_DELEGATION_EVIDENCE_ACCEPTANCE");});
test("same-delegation-can-be-already-accepted",()=>{const w=wire();const q=request("DELEGATION",delegationAcceptanceRequest());assert.equal(w.accept(q).outcome,OUTCOMES.ACCEPTED);assert.equal(w.accept(q).outcome,OUTCOMES.ALREADY_ACCEPTED);});
test("production-failure-is-not-accepted",()=>{const r=wire({evidenceProductionPort:()=>({outcome:"NOT_PRODUCED",authority:"NONE",evidenceAccepted:false})}).accept(request("POLICY",policyAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);});
test("production-port-failure-is-unknown",()=>{const r=wire({evidenceProductionPort:()=>{throw Error("offline");}}).accept(request("POLICY",policyAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("untrusted-policy-source-cannot-be-accepted",()=>{const r=wire({sourceTrustPort:()=>({outcome:"NOT_TRUSTED",authority:"NONE",registryRecord:null})}).accept(request("POLICY",policyAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.UNKNOWN);assert.equal(r.acceptanceEvidence,null);});
test("untrusted-assignment-source-cannot-be-accepted",()=>{const r=wire({sourceTrustPort:()=>({outcome:"NOT_TRUSTED",authority:"NONE",registryRecord:null})}).accept(request("ASSIGNMENT",assignmentAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("untrusted-delegation-source-cannot-be-accepted",()=>{const r=wire({sourceTrustPort:()=>({outcome:"NOT_TRUSTED",authority:"NONE",registryRecord:null})}).accept(request("DELEGATION",delegationAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("trust-port-failure-is-unknown",()=>{const r=wire({sourceTrustPort:()=>{throw Error("offline");}}).accept(request("POLICY",policyAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("stale-temporal-policy-not-accepted",()=>{const r=wire({temporalFramePort:()=>({state:"STALE",temporalFrameRevision:"1",evidenceRef:sha("d")})}).accept(request("POLICY",policyAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);assert.equal(r.acceptanceEvidence,null);});
test("stale-assignment-principal-not-accepted",()=>{const r=wire({principalIdentityPort:({principalRef})=>({principalRef,principalRevision:"1",lifecycleState:"CURRENT",freshnessState:"STALE",contradictionState:"NONE",principalEvidenceRef:sha("e")})}).accept(request("ASSIGNMENT",assignmentAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);});
test("delegation-without-authenticated-source-binding-not-accepted",()=>{const r=wire({authenticatedSourceBindingPort:()=>({bindingId:"source-event-binding:1",originAuthenticationState:"UNAUTHENTICATED",authority:"NONE"})}).accept(request("DELEGATION",delegationAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);});
test("delegation-with-stale-assignment-state-not-accepted",()=>{const r=wire({assignmentCurrentStatePort:()=>({assignmentAcceptanceId:"assignment-acceptance:1",state:"STALE",lifecycleRevision:"1",contradictionState:"NONE",evidenceRef:sha("2")})}).accept(request("DELEGATION",delegationAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);});
test("delegation-with-stale-policy-state-not-accepted",()=>{const r=wire({policyCurrentStatePort:()=>({policyAcceptanceId:"policy-acceptance:1",state:"STALE",lifecycleRevision:"1",contradictionState:"NONE",evidenceRef:sha("3")})}).accept(request("DELEGATION",delegationAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);});
test("delegation-with-stale-delegation-state-not-accepted",()=>{const r=wire({delegationCurrentStatePort:()=>({delegationRef:"delegation:1",delegationRevision:"1",state:"STALE",lifecycleRevision:"1",contradictionState:"NONE",evidenceRef:sha("4")})}).accept(request("DELEGATION",delegationAcceptanceRequest()));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);});
test("wrong-policy-revision-not-accepted",()=>{const q=policyAcceptanceRequest();q.expectedPolicyRevision="2";const r=wire().accept(request("POLICY",q));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);});
test("wrong-assignment-policy-acceptance-not-accepted",()=>{const q=assignmentAcceptanceRequest();q.expectedPolicyAcceptanceId="policy-acceptance:wrong";const r=wire().accept(request("ASSIGNMENT",q));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);});
test("wrong-delegation-grantor-assignment-not-accepted",()=>{const q=delegationAcceptanceRequest();q.expectedGrantorAssignmentAcceptanceId="assignment-acceptance:wrong";const r=wire().accept(request("DELEGATION",q));assert.equal(r.outcome,OUTCOMES.NOT_ACCEPTED);});
test("extra-top-level-field-invalid",()=>{const r=wire().accept({...request("POLICY",policyAcceptanceRequest()),evidenceAccepted:true});assert.equal(r.outcome,OUTCOMES.INVALID);});
test("unsupported-subject-invalid",()=>{const r=wire().accept({rulesetVersion:RULESET_VERSION,subjectKind:"OTHER",productionRequest:{},acceptanceRequest:{}});assert.equal(r.outcome,OUTCOMES.INVALID);});
test("caller-cannot-force-acceptance",()=>{const r=wire().accept({...request("POLICY",policyAcceptanceRequest()),acceptanceOutcome:"ROLE_POLICY_EVIDENCE_ACCEPTED"});assert.equal(r.outcome,OUTCOMES.INVALID);});
test("acceptance-result-wrong-authority-is-not-accepted",()=>{const badLedger={findByPolicyRef:()=>[],commit:(x)=>({...x,authority:"WRITE"})};const r=wire({policyLedger:badLedger}).accept(request("POLICY",policyAcceptanceRequest()));assert.notEqual(r.outcome,OUTCOMES.ACCEPTED);});
test("deterministic-policy-wiring-with-fresh-ledgers",()=>{const a=wire().accept(request("POLICY",policyAcceptanceRequest()));const b=wire().accept(request("POLICY",policyAcceptanceRequest()));assert.deepEqual(a,b);});
test("deterministic-assignment-wiring-with-fresh-ledgers",()=>{const a=wire().accept(request("ASSIGNMENT",assignmentAcceptanceRequest()));const b=wire().accept(request("ASSIGNMENT",assignmentAcceptanceRequest()));assert.deepEqual(a,b);});
test("deterministic-delegation-wiring-with-fresh-ledgers",()=>{const a=wire().accept(request("DELEGATION",delegationAcceptanceRequest()));const b=wire().accept(request("DELEGATION",delegationAcceptanceRequest()));assert.deepEqual(a,b);});
test("policy-accepted-result-preserves-no-downstream-authority",()=>noAuthority(wire().accept(request("POLICY",policyAcceptanceRequest()))));
test("assignment-accepted-result-preserves-no-downstream-authority",()=>noAuthority(wire().accept(request("ASSIGNMENT",assignmentAcceptanceRequest()))));
test("delegation-accepted-result-preserves-no-downstream-authority",()=>noAuthority(wire().accept(request("DELEGATION",delegationAcceptanceRequest()))));
test("not-accepted-result-preserves-no-downstream-authority",()=>{const q=policyAcceptanceRequest();q.expectedSourceRevision="2";noAuthority(wire().accept(request("POLICY",q)));});
test("unknown-result-preserves-no-downstream-authority",()=>noAuthority(wire({sourceTrustPort:()=>{throw Error("x");}}).accept(request("POLICY",policyAcceptanceRequest()))));
test("invalid-result-preserves-no-downstream-authority",()=>noAuthority(wire().accept({})));

let passed=0;for(const [name,fn] of tests){try{fn();passed++;console.log(`PASS - ${name}`);}catch(e){console.error(`FAIL - ${name}`);console.error(e&&e.stack?e.stack:e);process.exitCode=1;}}console.log(`${passed}/${tests.length} PASS`);if(passed!==tests.length)process.exitCode=1;
