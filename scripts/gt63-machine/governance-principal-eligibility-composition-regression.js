"use strict";
const assert=require("node:assert/strict");
const C=require("./governance-principal-eligibility-composition");
const B=require("./authenticated-governance-authorization-binding");
const R=require("./governance-role-resolution");
const scope={scopeType:"GATE",interactionId:"i1",fromInteractionRevision:2,throughInteractionRevision:8,gateId:"g1",gateRevision:1,authorityScopeDigest:"sha256:"+"a".repeat(64),continuationTargetRef:"c1"};
const principal={principalRef:"p1",principalRevision:"1",principalEvidenceRef:"ep",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE"};
const requirement={requirementRef:"rq",requirementRevision:"1",governanceAct:"GATE_AUTHORIZATION",requiredRoleRef:"GATE_AUTHORIZER",requiredRoleRevision:"1",contextScope:scope,roleRequirementEvidenceRef:"er",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE"};
const assignment={type:"DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE",assignmentAcceptanceId:"a1",principalRef:"p1",principalRevision:"1",roleRef:"GATE_AUTHORIZER",roleRevision:"1",contextScope:scope,authority:"NONE"};
const state={assignmentAcceptanceId:"a1",state:"CURRENT",lifecycleRevision:"1",contradictionState:"NONE",evidenceRef:"current:a1"};
const make=(patch={})=>C.createGovernancePrincipalEligibilityComposition({authenticatedPrincipalPort:()=>principal,governanceRoleRequirementPort:()=>requirement,acceptedAssignmentPort:patch.a||(()=>[assignment]),acceptedDelegationPort:()=>[],assignmentCurrentStatePort:patch.s||(()=>state),delegationCurrentStatePort:()=>null});
let n=0;const t=(s,f)=>{f();n++;console.log("PASS - "+s)};
t("composition produces binding-compatible eligibility",()=>{const x=make().principalEligibilityPort({principalRef:"p1",principalRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope});assert.equal(x.eligibilityState,"ELIGIBLE");assert.equal(x.authority,"NONE")});
t("absence stays null at binding port not false eligibility",()=>{const x=make({a:()=>[]}).principalEligibilityPort({principalRef:"p1",principalRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope});assert.equal(x,null)});
t("stale role stays null at binding port",()=>{const x=make({s:()=>({...state,state:"STALE"})}).principalEligibilityPort({principalRef:"p1",principalRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope});assert.equal(x,null)});
t("existing authorization binding consumes same composed role resolution and eligibility",()=>{
 const c=make(),ledger=B.createMemoryLedger();
 const binding=B.createAuthenticatedGovernanceAuthorizationBinding({
  authenticatedPrincipalPort:()=>principal,
  principalEligibilityPort:c.principalEligibilityPort,
  governanceRoleRequirementPort:()=>requirement,
  roleResolutionPort(query){const x=c.resolver.resolve({rulesetVersion:R.RULESET_VERSION,...query});return x.resolution},
  humanAuthorizationEventPort:()=>({humanAuthorizationEvidenceRef:"ha1",principalRef:"p1",principalRevision:"1",authorizationSubjectRef:"sub1",authorizationSubjectRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope,decision:"APPROVE",exactSemanticDigest:"sha256:"+"b".repeat(64),lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE"}),
  bindingLedger:ledger
 });
 const x=binding.assess({rulesetVersion:B.RULESET_VERSION,authorizationSubjectRef:"sub1",authorizationSubjectRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope,principalRef:"p1",principalRevision:"1",humanAuthorizationEvidenceRef:"ha1"});
 assert.equal(x.outcome,"AUTHORIZED");assert.equal(x.binding.eligibilityEvidenceRef,c.principalEligibilityPort({principalRef:"p1",principalRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope}).eligibilityEvidenceRef);assert.deepEqual(x.binding.roleEvidenceRefs,["a1","current:a1"]);assert.equal(x.binding.authority,"NONE");assert.equal(x.humanGateSatisfied,false)
});
console.log(JSON.stringify({suite:"GT63 MACHINE — PRINCIPAL ELIGIBILITY COMPOSITION COMPATIBILITY",passed:n,cases:n,authorityInvariant:"PASS: NONE"}));
