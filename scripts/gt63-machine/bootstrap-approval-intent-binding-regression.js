"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {RULESET_VERSION,MEDIA_TYPE,OUTCOMES,canonicalStringify,createBootstrapApprovalIntentBinding}=require("./bootstrap-approval-intent-binding");

const payload=(p={})=>({type:"GT63_BOOTSTRAP_APPROVAL",decision:"APPROVE",governanceAct:"INITIAL_GOVERNANCE_BOOTSTRAP",bootstrapGateId:"gate:bootstrap:1",bootstrapGateRevision:"1",repositoryIdentity:"goceterziev-creator/2l1p-neural-travel-v9",targetPath:"config/gt63-machine/governance-lifecycle-issuer-scope-policy-v0.json",beforeStateId:"sha256:before",afterStateId:"sha256:after",oneTime:true,...p});
const bytes=p=>Buffer.from(`${canonicalStringify(p)}\n`,"utf8");
const sha256=b=>`sha256:${crypto.createHash("sha256").update(b).digest("hex")}`;
function source(p=payload()){const b=bytes(p);return{type:"HUMAN_SOURCE_EVENT",sourceEventRef:"event:1",contentBytesBase64:b.toString("base64"),contentEncoding:"utf8",contentMediaType:MEDIA_TYPE};}
function binding(p=payload()){const b=bytes(p);return{type:"AUTHENTICATED_HUMAN_SOURCE_EVENT_BINDING",bindingId:"binding:1",sourceEventRef:"event:1",principalRef:"principal:human",contentDigest:sha256(b),contentByteLength:b.length,contentMediaType:MEDIA_TYPE,originAuthenticationState:"AUTHENTICATED",contentIntegrityState:"EXACT_BYTES",interactionBindingState:"BOUND",authority:"NONE"};}
function ledger(seed=[]){const rows=[...seed];return{findByBindingId:id=>rows.filter(x=>x.bindingId===id),findByGateId:id=>rows.filter(x=>x.bootstrapGateId===id),commit:e=>{rows.push(JSON.parse(JSON.stringify(e)));return JSON.parse(JSON.stringify(e));}}}
function system(o={}){const p=o.payload||payload();const l=o.ledger||ledger();return{c:createBootstrapApprovalIntentBinding({authenticatedBindingPort:()=>o.binding||binding(p),sourceEventSnapshotPort:()=>o.source||source(p),intentLedger:l}),l};}
const req=(p={})=>({rulesetVersion:RULESET_VERSION,bindingId:"binding:1",sourceEventRef:"event:1",bootstrapGateId:"gate:bootstrap:1",bootstrapGateRevision:"1",repositoryIdentity:"goceterziev-creator/2l1p-neural-travel-v9",targetPath:"config/gt63-machine/governance-lifecycle-issuer-scope-policy-v0.json",expectedBeforeStateId:"sha256:before",expectedAfterStateId:"sha256:after",...p});
const tests=[];const test=(n,f)=>tests.push([n,f]);
test("exact authenticated structured approval intent binds",()=>{const r=system().c.bind(req());assert.equal(r.outcome,OUTCOMES.BOUND);assert.equal(r.authority,"NONE");assert.equal(r.evidence.decision,"APPROVE");});
test("caller approved flag rejected",()=>assert.equal(system().c.bind({...req(),approvalState:"APPROVED"}).outcome,OUTCOMES.REJECTED));
test("unauthenticated binding cannot bind approval",()=>assert.equal(system({binding:{...binding(),originAuthenticationState:"UNKNOWN"}}).c.bind(req()).outcome,OUTCOMES.UNCERTAIN));
test("unbound event cannot bind approval",()=>assert.equal(system({binding:{...binding(),interactionBindingState:"NOT_BOUND"}}).c.bind(req()).outcome,OUTCOMES.UNCERTAIN));
test("source bytes drift conflicts with authenticated digest",()=>{const s=source(payload({targetPath:"config/other.json"}));assert.equal(system({source:s}).c.bind(req()).outcome,OUTCOMES.CONFLICT);});
test("natural language text is rejected",()=>{const raw=Buffer.from("Давай","utf8");const s={type:"HUMAN_SOURCE_EVENT",sourceEventRef:"event:1",contentBytesBase64:raw.toString("base64"),contentEncoding:"utf8",contentMediaType:MEDIA_TYPE};const b={...binding(),contentDigest:sha256(raw),contentByteLength:raw.length};assert.equal(system({source:s,binding:b}).c.bind(req()).outcome,OUTCOMES.REJECTED);});
test("non-approve decision rejected",()=>assert.equal(system({payload:payload({decision:"REJECT"})}).c.bind(req()).outcome,OUTCOMES.REJECTED));
test("wrong repository stale",()=>assert.equal(system({payload:payload({repositoryIdentity:"other/repo"})}).c.bind(req()).outcome,OUTCOMES.STALE));
test("wrong target stale",()=>assert.equal(system({payload:payload({targetPath:"config/other.json"})}).c.bind(req()).outcome,OUTCOMES.STALE));
test("before state stale",()=>assert.equal(system({payload:payload({beforeStateId:"sha256:old"})}).c.bind(req()).outcome,OUTCOMES.STALE));
test("after state stale",()=>assert.equal(system({payload:payload({afterStateId:"sha256:other"})}).c.bind(req()).outcome,OUTCOMES.STALE));
test("same approval is idempotent",()=>{const s=system();const a=s.c.bind(req());const b=s.c.bind(req());assert.equal(a.outcome,OUTCOMES.BOUND);assert.equal(b.outcome,OUTCOMES.ALREADY_BOUND);assert.equal(a.evidence.approvalIntentBindingId,b.evidence.approvalIntentBindingId);});
test("one authenticated event cannot bind second gate",()=>{const s=system();assert.equal(s.c.bind(req()).outcome,OUTCOMES.BOUND);const p2=payload({bootstrapGateId:"gate:bootstrap:2"});const c=createBootstrapApprovalIntentBinding({authenticatedBindingPort:()=>binding(p2),sourceEventSnapshotPort:()=>source(p2),intentLedger:s.l});assert.equal(c.bind({...req(),bootstrapGateId:"gate:bootstrap:2"}).outcome,OUTCOMES.CONFLICT);});
test("binding creates no human authorization or mutation",()=>{const r=system().c.bind(req());assert.equal(r.humanAuthorizationCreated,false);assert.equal(r.mutationAuthorized,false);assert.equal(r.mutationPerformed,false);assert.equal(r.evidence.authority,"NONE");});
let passed=0;for(const[n,f]of tests){f();passed++;console.log(`PASS ${n}`)}console.log(`RESULT ${passed}/${tests.length} PASS`);
