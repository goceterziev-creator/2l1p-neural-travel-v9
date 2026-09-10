"use strict";
const assert=require("node:assert/strict");
const {RULESET_VERSION,AUTHORITY,APPROVED_PRINCIPAL_REF,OUTCOMES,createPrincipalEligibilityPolicy}=require("./principal-eligibility-policy");
const d=`sha256:${"a".repeat(64)}`;
function scope(o={}){return {scopeType:"GATE",interactionId:"interaction:1",fromInteractionRevision:1,throughInteractionRevision:3,gateId:"gate:1",gateRevision:1,authorityScopeDigest:d,continuationTargetRef:"continuation:1",...o};}
function req(o={}){return {rulesetVersion:RULESET_VERSION,principalRef:APPROVED_PRINCIPAL_REF,principalRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope(),expectedPolicyRevision:"1",...o};}
function ev(o={}){return {policyEvidenceRef:"evidence:policy:1",policyRevision:"1",principalRef:APPROVED_PRINCIPAL_REF,principalRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope(),eligibilityState:"ELIGIBLE",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",acceptanceState:"ACCEPTED",authority:"NONE",...o};}
function sys(e=ev()){return createPrincipalEligibilityPolicy({policyEvidencePort:()=>e});}
function noAuth(o){assert.equal(o.authority,AUTHORITY);assert.equal(o.humanGateSatisfied,false);assert.equal(o.continuationAuthorityCreated,false);assert.equal(o.executionAuthorityCreated,false);assert.equal(o.effectAuthorized,false);}
const cases=[];function check(n,f){f();cases.push(n);console.log(`PASS - ${n}`);}
check("constructor-requires-policy-evidence-port",()=>assert.throws(()=>createPrincipalEligibilityPolicy({}),TypeError));
check("explicit-current-accepted-positive-evidence-eligible",()=>{const o=sys().assess(req());assert.equal(o.outcome,OUTCOMES.RESOLVED);assert.equal(o.evidence.eligibilityState,"ELIGIBLE");noAuth(o);});
check("missing-policy-evidence-unknown",()=>assert.equal(sys(null).assess(req()).outcome,OUTCOMES.UNKNOWN));
check("stale-policy-evidence-unknown",()=>assert.equal(sys(ev({freshnessState:"STALE"})).assess(req()).outcome,OUTCOMES.UNKNOWN));
check("contradictory-policy-evidence-unknown",()=>assert.equal(sys(ev({contradictionState:"CONFLICT"})).assess(req()).outcome,OUTCOMES.UNKNOWN));
check("unaccepted-policy-evidence-unknown",()=>assert.equal(sys(ev({acceptanceState:"UNACCEPTED"})).assess(req()).outcome,OUTCOMES.UNKNOWN));
check("wrong-principal-evidence-unknown",()=>assert.equal(sys(ev({principalRef:"principal:other"})).assess(req()).outcome,OUTCOMES.UNKNOWN));
check("unsupported-principal-request-invalid",()=>assert.equal(sys().assess(req({principalRef:"principal:other"})).outcome,OUTCOMES.INVALID));
check("wrong-principal-revision-unknown",()=>assert.equal(sys(ev({principalRevision:"2"})).assess(req()).outcome,OUTCOMES.UNKNOWN));
check("wrong-governance-act-evidence-unknown",()=>assert.equal(sys(ev({governanceAct:"DEPLOY"})).assess(req()).outcome,OUTCOMES.UNKNOWN));
check("unsupported-governance-act-request-invalid",()=>assert.equal(sys().assess(req({governanceAct:"DEPLOY"})).outcome,OUTCOMES.INVALID));
check("cross-gate-evidence-unknown",()=>assert.equal(sys(ev({contextScope:scope({gateId:"gate:2"})})).assess(req()).outcome,OUTCOMES.UNKNOWN));
check("cross-scope-evidence-unknown",()=>assert.equal(sys(ev({contextScope:scope({fromInteractionRevision:2})})).assess(req()).outcome,OUTCOMES.UNKNOWN));
check("wrong-policy-revision-unknown",()=>assert.equal(sys(ev({policyRevision:"2"})).assess(req()).outcome,OUTCOMES.UNKNOWN));
check("explicit-positive-prohibition-not-eligible",()=>{const o=sys(ev({eligibilityState:"NOT_ELIGIBLE"})).assess(req());assert.equal(o.outcome,OUTCOMES.RESOLVED);assert.equal(o.evidence.eligibilityState,"NOT_ELIGIBLE");noAuth(o);});
check("explicit-unknown-preserved",()=>{const o=sys(ev({eligibilityState:"UNKNOWN"})).assess(req());assert.equal(o.evidence.eligibilityState,"UNKNOWN");noAuth(o);});
check("caller-cannot-inject-eligibility",()=>assert.equal(sys().assess({...req(),eligibilityState:"ELIGIBLE"}).outcome,OUTCOMES.INVALID));
check("deterministic-exact-replay",()=>{const s=sys();assert.deepEqual(s.assess(req()),s.assess(req()));});
check("changed-scope-changes-evidence-identity",()=>{const a=sys().assess(req());const s=scope({fromInteractionRevision:2});const b=sys(ev({contextScope:s})).assess(req({contextScope:s}));assert.notEqual(a.evidence.eligibilityPolicyEvidenceRef,b.evidence.eligibilityPolicyEvidenceRef);});
check("changed-principal-revision-changes-evidence-identity",()=>{const a=sys().assess(req());const b=sys(ev({principalRevision:"2"})).assess(req({principalRevision:"2"}));assert.notEqual(a.evidence.eligibilityPolicyEvidenceRef,b.evidence.eligibilityPolicyEvidenceRef);});
check("changed-policy-revision-changes-evidence-identity",()=>{const a=sys().assess(req());const b=sys(ev({policyRevision:"2"})).assess(req({expectedPolicyRevision:"2"}));assert.notEqual(a.evidence.eligibilityPolicyEvidenceRef,b.evidence.eligibilityPolicyEvidenceRef);});
console.log(`${cases.length}/${cases.length} PASS`);
