"use strict";

const assert = require("node:assert/strict");
const { RULESET_VERSION, AUTHORITY, createAuthenticatedGovernanceAuthorizationEvidencePorts } = require("./authenticated-governance-authorization-evidence-ports");

const tests=[]; const test=(n,f)=>tests.push([n,f]);
const scope={scopeType:"GATE",interactionId:"interaction:1",fromInteractionRevision:1,throughInteractionRevision:1,gateId:"gate:1",gateRevision:1,authorityScopeDigest:`sha256:${"a".repeat(64)}`,continuationTargetRef:"continuation:1"};
const principalEvidence={principalRef:"gt63-machine:human-principal:goce-v0",principalRevision:"1",principalEvidenceRef:"evidence:principal:1",type:"GT63_GOVERNANCE_PRINCIPAL_IDENTITY_BINDING_EVIDENCE",schemaVersion:"1.0",rulesetVersion:"governance-principal-identity-binding-v0.1.0",governancePrincipalRef:"gt63-machine:human-principal:goce-v0",governancePrincipalRevision:"1",externalPrincipalRef:"gt63-machine:principal:github:239696056",externalPrincipalRevision:"1",externalPrincipalEvidenceRef:"external:evidence:1",identityProvider:"github.com",githubUserId:239696056,githubLogin:"goceterziev-creator",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE"};
const eligibilityEvidence={eligibilityEvidenceRef:"evidence:eligibility:1",type:"GT63_PRINCIPAL_ELIGIBILITY_EVIDENCE",schemaVersion:"1.0",rulesetVersion:"principal-eligibility-evidence-v0.1.0",principalRef:"gt63-machine:human-principal:goce-v0",principalRevision:"1",principalEvidenceRef:"evidence:principal:1",eligibilityPolicyEvidenceRef:"evidence:policy:1",eligibilityState:"ELIGIBLE",governanceAct:"GATE_AUTHORIZATION",contextScope:scope,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE"};
const humanEvidence={humanAuthorizationEvidenceRef:"evidence:human-auth:1",type:"GT63_AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE",schemaVersion:"1.0",rulesetVersion:"authenticated-human-gate-authorization-evidence-v0.1.0",principalRef:"gt63-machine:human-principal:goce-v0",principalRevision:"1",principalEvidenceRef:"evidence:principal:1",presentationRef:"presentation:1",presentationRevision:"1",authorizationSubjectRef:"subject:1",authorizationSubjectRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope,decision:"APPROVE",exactSemanticDigest:`sha256:${"b".repeat(64)}`,decisionEvidenceRef:"decision:1",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE"};

function deps(overrides={}){return {
  governancePrincipalBindingPort:()=>({outcome:"GOVERNANCE_PRINCIPAL_IDENTITY_BOUND",evidence:principalEvidence,authority:"NONE"}),
  principalEligibilityEvidencePort:()=>({outcome:"PRINCIPAL_ELIGIBILITY_RESOLVED",evidence:eligibilityEvidence,authority:"NONE"}),
  humanAuthorizationEvidenceLookupPort:()=>({outcome:"AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED",evidence:humanEvidence,authority:"NONE"}),
  ...overrides
};}
function ports(overrides={}){return createAuthenticatedGovernanceAuthorizationEvidencePorts(deps(overrides));}
const principalReq={principalRef:principalEvidence.principalRef,principalRevision:"1",contextScope:scope};
const eligibilityReq={principalRef:principalEvidence.principalRef,principalRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope};
const humanReq={humanAuthorizationEvidenceRef:humanEvidence.humanAuthorizationEvidenceRef};

test("constructor-requires-principal-binding-port",()=>assert.throws(()=>createAuthenticatedGovernanceAuthorizationEvidencePorts({...deps(),governancePrincipalBindingPort:null}),/governancePrincipalBindingPort/));
test("constructor-requires-eligibility-evidence-port",()=>assert.throws(()=>createAuthenticatedGovernanceAuthorizationEvidencePorts({...deps(),principalEligibilityEvidencePort:null}),/principalEligibilityEvidencePort/));
test("constructor-requires-human-authorization-lookup-port",()=>assert.throws(()=>createAuthenticatedGovernanceAuthorizationEvidencePorts({...deps(),humanAuthorizationEvidenceLookupPort:null}),/humanAuthorizationEvidenceLookupPort/));
test("exact-principal-wrapper-unwrapped",()=>assert.deepEqual(ports().authenticatedPrincipalPort(principalReq),principalEvidence));
test("exact-eligibility-wrapper-unwrapped",()=>assert.deepEqual(ports().principalEligibilityPort(eligibilityReq),eligibilityEvidence));
test("exact-human-authorization-looked-up-by-ref",()=>assert.deepEqual(ports().humanAuthorizationEventPort(humanReq),humanEvidence));
test("principal-not-bound-fails-closed",()=>assert.throws(()=>ports({governancePrincipalBindingPort:()=>({outcome:"GOVERNANCE_PRINCIPAL_IDENTITY_NOT_BOUND",evidence:null,authority:"NONE"})}).authenticatedPrincipalPort(principalReq)));
test("principal-unknown-fails-closed",()=>assert.throws(()=>ports({governancePrincipalBindingPort:()=>({outcome:"GOVERNANCE_PRINCIPAL_IDENTITY_UNKNOWN",evidence:null,authority:"NONE"})}).authenticatedPrincipalPort(principalReq)));
test("principal-invalid-fails-closed",()=>assert.throws(()=>ports({governancePrincipalBindingPort:()=>({outcome:"GOVERNANCE_PRINCIPAL_IDENTITY_INVALID",evidence:null,authority:"NONE"})}).authenticatedPrincipalPort(principalReq)));
test("eligibility-unknown-fails-closed",()=>assert.throws(()=>ports({principalEligibilityEvidencePort:()=>({outcome:"PRINCIPAL_ELIGIBILITY_UNKNOWN",evidence:null,authority:"NONE"})}).principalEligibilityPort(eligibilityReq)));
test("eligibility-invalid-fails-closed",()=>assert.throws(()=>ports({principalEligibilityEvidencePort:()=>({outcome:"PRINCIPAL_ELIGIBILITY_INVALID",evidence:null,authority:"NONE"})}).principalEligibilityPort(eligibilityReq)));
test("human-auth-unresolved-fails-closed",()=>assert.throws(()=>ports({humanAuthorizationEvidenceLookupPort:()=>({outcome:"AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_UNKNOWN",evidence:null,authority:"NONE"})}).humanAuthorizationEventPort(humanReq)));
test("wrong-wrapper-authority-fails-closed",()=>assert.throws(()=>ports({governancePrincipalBindingPort:()=>({outcome:"GOVERNANCE_PRINCIPAL_IDENTITY_BOUND",evidence:principalEvidence,authority:"WRITE"})}).authenticatedPrincipalPort(principalReq)));
test("stale-principal-evidence-fails-closed",()=>assert.throws(()=>ports({governancePrincipalBindingPort:()=>({outcome:"GOVERNANCE_PRINCIPAL_IDENTITY_BOUND",evidence:{...principalEvidence,freshnessState:"STALE"},authority:"NONE"})}).authenticatedPrincipalPort(principalReq)));
test("stale-eligibility-evidence-fails-closed",()=>assert.throws(()=>ports({principalEligibilityEvidencePort:()=>({outcome:"PRINCIPAL_ELIGIBILITY_RESOLVED",evidence:{...eligibilityEvidence,lifecycleState:"STALE"},authority:"NONE"})}).principalEligibilityPort(eligibilityReq)));
test("stale-human-authorization-fails-closed",()=>assert.throws(()=>ports({humanAuthorizationEvidenceLookupPort:()=>({outcome:"AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED",evidence:{...humanEvidence,freshnessState:"STALE"},authority:"NONE"})}).humanAuthorizationEventPort(humanReq)));
test("principal-identity-mismatch-fails-closed",()=>assert.throws(()=>ports().authenticatedPrincipalPort({...principalReq,principalRef:"other"})));
test("eligibility-principal-mismatch-fails-closed",()=>assert.throws(()=>ports().principalEligibilityPort({...eligibilityReq,principalRef:"other"})));
test("human-authorization-ref-mismatch-fails-closed",()=>assert.throws(()=>ports({humanAuthorizationEvidenceLookupPort:()=>({outcome:"AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED",evidence:{...humanEvidence,humanAuthorizationEvidenceRef:"other"},authority:"NONE"})}).humanAuthorizationEventPort(humanReq)));
test("human-authorization-lookup-request-is-exact-ref-only",()=>{let seen;ports({humanAuthorizationEvidenceLookupPort:r=>(seen=r,{outcome:"AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED",evidence:humanEvidence,authority:"NONE"})}).humanAuthorizationEventPort(humanReq);assert.deepEqual(seen,humanReq);});
test("returned-principal-is-frozen",()=>assert.equal(Object.isFrozen(ports().authenticatedPrincipalPort(principalReq)),true));
test("returned-eligibility-is-frozen",()=>assert.equal(Object.isFrozen(ports().principalEligibilityPort(eligibilityReq)),true));
test("returned-human-auth-is-frozen",()=>assert.equal(Object.isFrozen(ports().humanAuthorizationEventPort(humanReq)),true));
test("deterministic-principal-lookup",()=>assert.deepEqual(ports().authenticatedPrincipalPort(principalReq),ports().authenticatedPrincipalPort(principalReq)));
test("deterministic-eligibility-lookup",()=>assert.deepEqual(ports().principalEligibilityPort(eligibilityReq),ports().principalEligibilityPort(eligibilityReq)));
test("deterministic-human-auth-lookup",()=>assert.deepEqual(ports().humanAuthorizationEventPort(humanReq),ports().humanAuthorizationEventPort(humanReq)));
test("ports-authority-remains-none",()=>{const p=ports();assert.equal(p.authority,AUTHORITY);assert.equal(p.rulesetVersion,RULESET_VERSION);});

let passed=0;for(const [name,fn] of tests){try{fn();passed++;console.log(`PASS - ${name}`);}catch(e){console.error(`FAIL - ${name}`);console.error(e&&e.stack?e.stack:e);process.exitCode=1;}}console.log(`${passed}/${tests.length} PASS`);if(passed!==tests.length)process.exitCode=1;
