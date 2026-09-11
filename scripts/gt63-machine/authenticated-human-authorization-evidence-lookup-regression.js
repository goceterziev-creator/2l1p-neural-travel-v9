"use strict";

const assert=require("node:assert/strict");
const {RULESET_VERSION,AUTHORITY,OUTCOMES,createAuthenticatedHumanAuthorizationEvidenceLookup,createMemoryRegistry}=require("./authenticated-human-authorization-evidence-lookup");

const tests=[];const test=(n,f)=>tests.push([n,f]);
const scope={scopeType:"GATE",interactionId:"interaction:1",fromInteractionRevision:1,throughInteractionRevision:1,gateId:"gate:1",gateRevision:1,authorityScopeDigest:`sha256:${"a".repeat(64)}`,continuationTargetRef:"continuation:1"};
const evidence={humanAuthorizationEvidenceRef:"gt63-evidence:authenticated-human-gate-authorization:test1",type:"GT63_AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE",schemaVersion:"1.0",rulesetVersion:"authenticated-human-gate-authorization-evidence-v0.1.0",principalRef:"gt63-machine:human-principal:goce-v0",principalRevision:"1",principalEvidenceRef:"evidence:principal:1",presentationRef:"presentation:1",presentationRevision:"1",authorizationSubjectRef:"subject:1",authorizationSubjectRevision:"1",governanceAct:"GATE_AUTHORIZATION",contextScope:scope,decision:"APPROVE",exactSemanticDigest:`sha256:${"b".repeat(64)}`,decisionEvidenceRef:"decision:1",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE"};
const ref=evidence.humanAuthorizationEvidenceRef;
const req={humanAuthorizationEvidenceRef:ref};
const lookup=(registry)=>createAuthenticatedHumanAuthorizationEvidenceLookup({registry});

test("constructor-requires-registry",()=>assert.throws(()=>createAuthenticatedHumanAuthorizationEvidenceLookup({}),/registry.get/));
test("memory-registry-rejects-invalid-initial-evidence",()=>assert.throws(()=>createMemoryRegistry([{...evidence,authority:"WRITE"}]),/invalid initial/));
test("memory-registry-rejects-duplicate-ref",()=>assert.throws(()=>createMemoryRegistry([evidence,{...evidence}]),/duplicate/));
test("exact-ref-resolves-current-evidence",()=>{const r=lookup(createMemoryRegistry([evidence])).lookup(req);assert.equal(r.outcome,OUTCOMES.RESOLVED);assert.deepEqual(r.evidence,evidence);});
test("missing-ref-is-unknown",()=>{const r=lookup(createMemoryRegistry([])).lookup(req);assert.equal(r.outcome,OUTCOMES.UNKNOWN);assert.equal(r.evidence,null);});
test("registry-failure-is-unknown",()=>{const r=lookup({get(){throw Error("offline");}}).lookup(req);assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("conflicting-records-are-unknown",()=>{const r=lookup({get(){return [evidence,{...evidence}];}}).lookup(req);assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("stale-lifecycle-is-unknown",()=>{const r=lookup({get(){return {...evidence,lifecycleState:"STALE"};}}).lookup(req);assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("stale-freshness-is-unknown",()=>{const r=lookup({get(){return {...evidence,freshnessState:"STALE"};}}).lookup(req);assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("contradictory-evidence-is-unknown",()=>{const r=lookup({get(){return {...evidence,contradictionState:"CONFLICT"};}}).lookup(req);assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("wrong-authority-is-unknown",()=>{const r=lookup({get(){return {...evidence,authority:"WRITE"};}}).lookup(req);assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("ref-mismatch-is-unknown",()=>{const r=lookup({get(){return {...evidence,humanAuthorizationEvidenceRef:"other"};}}).lookup(req);assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("invalid-type-is-unknown",()=>{const r=lookup({get(){return {...evidence,type:"OTHER"};}}).lookup(req);assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("invalid-decision-is-unknown",()=>{const r=lookup({get(){return {...evidence,decision:"MAYBE"};}}).lookup(req);assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("invalid-digest-is-unknown",()=>{const r=lookup({get(){return {...evidence,exactSemanticDigest:"bad"};}}).lookup(req);assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test("extra-request-field-invalid",()=>{const r=lookup(createMemoryRegistry([evidence])).lookup({...req,principalRef:evidence.principalRef});assert.equal(r.outcome,OUTCOMES.INVALID);});
test("missing-request-ref-invalid",()=>{const r=lookup(createMemoryRegistry([evidence])).lookup({});assert.equal(r.outcome,OUTCOMES.INVALID);});
test("empty-request-ref-invalid",()=>{const r=lookup(createMemoryRegistry([evidence])).lookup({humanAuthorizationEvidenceRef:""});assert.equal(r.outcome,OUTCOMES.INVALID);});
test("lookup-passes-exact-ref-to-registry",()=>{let seen;lookup({get(x){seen=x;return evidence;}}).lookup(req);assert.equal(seen,ref);});
test("returned-wrapper-is-frozen",()=>{const r=lookup(createMemoryRegistry([evidence])).lookup(req);assert.equal(Object.isFrozen(r),true);assert.equal(Object.isFrozen(r.evidence),true);});
test("registry-record-is-immutable-copy",()=>{const source=JSON.parse(JSON.stringify(evidence));const reg=createMemoryRegistry([source]);source.decision="DENY";const r=lookup(reg).lookup(req);assert.equal(r.evidence.decision,"APPROVE");});
test("deterministic-replay",()=>{const l=lookup(createMemoryRegistry([evidence]));assert.deepEqual(l.lookup(req),l.lookup(req));});
test("approve-is-preserved-not-created",()=>assert.equal(lookup(createMemoryRegistry([evidence])).lookup(req).evidence.decision,"APPROVE"));
test("deny-is-preserved",()=>{const e={...evidence,decision:"DENY",humanAuthorizationEvidenceRef:"gt63-evidence:authenticated-human-gate-authorization:test2"};const r=lookup(createMemoryRegistry([e])).lookup({humanAuthorizationEvidenceRef:e.humanAuthorizationEvidenceRef});assert.equal(r.outcome,OUTCOMES.RESOLVED);assert.equal(r.evidence.decision,"DENY");});
test("non-authorization-is-preserved",()=>{const e={...evidence,decision:"NON_AUTHORIZATION",humanAuthorizationEvidenceRef:"gt63-evidence:authenticated-human-gate-authorization:test3"};const r=lookup(createMemoryRegistry([e])).lookup({humanAuthorizationEvidenceRef:e.humanAuthorizationEvidenceRef});assert.equal(r.outcome,OUTCOMES.RESOLVED);assert.equal(r.evidence.decision,"NON_AUTHORIZATION");});
test("resolved-wrapper-authority-none",()=>{const r=lookup(createMemoryRegistry([evidence])).lookup(req);assert.equal(r.authority,AUTHORITY);assert.equal(r.humanGateSatisfied,false);assert.equal(r.continuationAuthorityCreated,false);assert.equal(r.executionAuthorityCreated,false);assert.equal(r.effectAuthorized,false);});
test("unknown-wrapper-authority-none",()=>{const r=lookup(createMemoryRegistry([])).lookup(req);assert.equal(r.authority,AUTHORITY);assert.equal(r.humanGateSatisfied,false);});
test("invalid-wrapper-authority-none",()=>{const r=lookup(createMemoryRegistry([])).lookup({});assert.equal(r.authority,AUTHORITY);assert.equal(r.effectAuthorized,false);});
test("primitive-metadata-authority-none",()=>{const l=lookup(createMemoryRegistry([evidence]));assert.equal(l.rulesetVersion,RULESET_VERSION);assert.equal(l.authority,AUTHORITY);});

let passed=0;for(const [name,fn] of tests){try{fn();passed++;console.log(`PASS - ${name}`);}catch(e){console.error(`FAIL - ${name}`);console.error(e&&e.stack?e.stack:e);process.exitCode=1;}}console.log(`${passed}/${tests.length} PASS`);if(passed!==tests.length)process.exitCode=1;
