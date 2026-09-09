"use strict";
const assert=require("node:assert/strict");
const {RULESET_VERSION,OUTCOMES,createBootstrapApprovalEvidenceComposition}=require("./bootstrap-approval-evidence-composition");
const D="sha256:"+"a".repeat(64);
const p=()=>({type:"BOOTSTRAP_APPROVAL_PRESENTATION_EVIDENCE",presentationId:"presentation:1",presentationEvidenceId:"presentation-evidence:1",interactionId:"interaction:1",payloadDigest:D,payloadByteLength:100,payloadMediaType:"application/vnd.gt63.bootstrap-approval+json",authority:"NONE"});
const c=()=>({type:"BOOTSTRAP_APPROVAL_CAPTURE_EVIDENCE",captureEvidenceId:"capture:1",presentationId:"presentation:1",presentationEvidenceId:"presentation-evidence:1",interactionId:"interaction:1",bindingId:"binding:1",sourceEventRef:"event:1",principalRef:"principal:human",payloadDigest:D,payloadByteLength:100,payloadMediaType:"application/vnd.gt63.bootstrap-approval+json",authority:"NONE"});
const i=()=>({type:"BOOTSTRAP_APPROVAL_INTENT_BINDING",approvalIntentBindingId:"intent:1",governanceAct:"INITIAL_GOVERNANCE_BOOTSTRAP",decision:"APPROVE",bindingId:"binding:1",sourceEventRef:"event:1",principalRef:"principal:human",contentDigest:D,bootstrapGateId:"gate:1",bootstrapGateRevision:"1",repositoryIdentity:"goceterziev-creator/2l1p-neural-travel-v9",targetPath:"config/gt63-machine/governance-lifecycle-issuer-scope-policy-v0.json",beforeStateId:"sha256:before",afterStateId:"sha256:after",oneTime:true,authority:"NONE"});
function ledger(){const rows=[];return{findByGateId:id=>rows.filter(x=>x.bootstrapGateId===id),findByBindingId:id=>rows.filter(x=>x.bindingId===id),commit:e=>{rows.push(JSON.parse(JSON.stringify(e)));return JSON.parse(JSON.stringify(e));}}}
function env(o={}){const l=o.ledger||ledger();return{component:createBootstrapApprovalEvidenceComposition({presentationEvidencePort:()=>o.p||p(),captureEvidencePort:()=>o.c||c(),approvalIntentBindingPort:()=>o.i||i(),compositionLedger:l}),ledger:l};}
const req=(x={})=>({rulesetVersion:RULESET_VERSION,presentationId:"presentation:1",captureEvidenceId:"capture:1",approvalIntentBindingId:"intent:1",bootstrapGateId:"gate:1",...x});
const T=[];const test=(n,f)=>T.push([n,f]);
test("exact evidence chain composes",()=>assert.equal(env().component.compose(req()).outcome,OUTCOMES.COMPOSED));
test("caller authorization flag rejected",()=>assert.equal(env().component.compose({...req(),authorized:true}).outcome,OUTCOMES.REJECTED));
test("wrong requested gate is stale",()=>assert.equal(env().component.compose(req({bootstrapGateId:"gate:2"})).outcome,OUTCOMES.STALE));
test("presentation identity drift conflicts",()=>assert.equal(env({c:{...c(),presentationEvidenceId:"other"}}).component.compose(req()).outcome,OUTCOMES.CONFLICT));
test("interaction drift conflicts",()=>assert.equal(env({c:{...c(),interactionId:"interaction:2"}}).component.compose(req()).outcome,OUTCOMES.CONFLICT));
test("payload digest drift conflicts",()=>assert.equal(env({c:{...c(),payloadDigest:"sha256:"+"b".repeat(64)}}).component.compose(req()).outcome,OUTCOMES.CONFLICT));
test("binding drift conflicts",()=>assert.equal(env({i:{...i(),bindingId:"binding:2"}}).component.compose(req()).outcome,OUTCOMES.CONFLICT));
test("principal drift conflicts",()=>assert.equal(env({i:{...i(),principalRef:"principal:other"}}).component.compose(req()).outcome,OUTCOMES.CONFLICT));
test("non-approve intent is uncertain",()=>assert.equal(env({i:{...i(),decision:"REJECT"}}).component.compose(req()).outcome,OUTCOMES.UNCERTAIN));
test("same composition idempotent",()=>{const e=env();const a=e.component.compose(req());const b=e.component.compose(req());assert.equal(a.outcome,OUTCOMES.COMPOSED);assert.equal(b.outcome,OUTCOMES.ALREADY_COMPOSED);assert.equal(a.evidence.composedApprovalEvidenceId,b.evidence.composedApprovalEvidenceId)});
test("same binding cannot compose second gate",()=>{const e=env();assert.equal(e.component.compose(req()).outcome,OUTCOMES.COMPOSED);const ii={...i(),bootstrapGateId:"gate:2"};const x=createBootstrapApprovalEvidenceComposition({presentationEvidencePort:()=>p(),captureEvidencePort:()=>c(),approvalIntentBindingPort:()=>ii,compositionLedger:e.ledger});assert.equal(x.compose(req({bootstrapGateId:"gate:2"})).outcome,OUTCOMES.CONFLICT)});
test("composition creates no authorization or mutation",()=>{const r=env().component.compose(req());assert.equal(r.humanAuthorizationCreated,false);assert.equal(r.mutationAuthorized,false);assert.equal(r.mutationPerformed,false);assert.equal(r.evidence.authority,"NONE")});
let passed=0;for(const[n,f]of T){f();passed++;console.log(`PASS ${n}`)}console.log(`RESULT ${passed}/${T.length} PASS`);
