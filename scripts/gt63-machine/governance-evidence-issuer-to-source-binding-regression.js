"use strict";
const assert=require("node:assert/strict");
const {RULESET_VERSION,OUTCOMES,ISSUER,SOURCES,createGovernanceEvidenceIssuerToSourceBinding}=require("./governance-evidence-issuer-to-source-binding");
const clone=v=>JSON.parse(JSON.stringify(v));
const PATH="config/gt63-machine/governance-evidence-issuer-to-source-binding-v0.json",REPO="goceterziev-creator/2l1p-neural-travel-v9";
function req(kind,p={}){return {rulesetVersion:RULESET_VERSION,issuerRef:ISSUER.issuerRef,issuerRevision:ISSUER.issuerRevision,subjectKind:kind,sourceRef:SOURCES[kind].sourceRef,sourceRevision:SOURCES[kind].sourceRevision,...clone(p)};}
function permission(kind,p={}){return {outcome:"PERMITTED",authority:"NONE",evidence:{issuerRef:ISSUER.issuerRef,issuerRevision:ISSUER.issuerRevision,subjectKind:kind,policyEvidenceRef:`evidence:permission:${kind}`},...clone(p)};}
function trust(kind,p={}){return {outcome:"TRUSTED",authority:"NONE",registryRecord:{sourceRef:SOURCES[kind].sourceRef,sourceRevision:SOURCES[kind].sourceRevision,trustState:"TRUSTED",registryEvidenceRef:`evidence:trust:${kind}`},...clone(p)};}
function source(p={}){return {status:"VERIFIED",authority:"NONE",verificationMethod:"AUTHORITATIVE_GIT_BLOB_MEMBERSHIP_V1",repositoryIdentity:REPO,sourcePath:PATH,sourceBlobSha:"a".repeat(40),source:{type:"GOVERNANCE_EVIDENCE_ISSUER_TO_SOURCE_BINDING_SET",statementClass:"GOVERNANCE_EVIDENCE_ISSUER_TO_SOURCE_BINDING_SET",status:"CANDIDATE_NOT_ACCEPTED",authority:"NONE",repositoryIdentity:REPO,bindingSetSemantics:"CLOSED_WORLD_EXACT",bindings:Object.entries(SOURCES).map(([subjectKind,s])=>({issuerRef:ISSUER.issuerRef,issuerRevision:ISSUER.issuerRevision,subjectKind,sourceRef:s.sourceRef,sourceRevision:s.sourceRevision}))},...clone(p)};}
function c(o={}){return createGovernanceEvidenceIssuerToSourceBinding({issuerPermissionPort:q=>o.permission||permission(q.subjectKind),sourceTrustPort:q=>o.trust||trust(q.subjectKind),bindingSourcePort:()=>o.source||source()});}
const tests=[];const test=(n,f)=>tests.push([n,f]);
test("constructor-requires-issuer-permission-port",()=>assert.throws(()=>createGovernanceEvidenceIssuerToSourceBinding({sourceTrustPort(){},bindingSourcePort(){}}),/issuerPermissionPort/));
test("constructor-requires-source-trust-port",()=>assert.throws(()=>createGovernanceEvidenceIssuerToSourceBinding({issuerPermissionPort(){},bindingSourcePort(){}}),/sourceTrustPort/));
test("constructor-requires-binding-source-port",()=>assert.throws(()=>createGovernanceEvidenceIssuerToSourceBinding({issuerPermissionPort(){},sourceTrustPort(){}}),/bindingSourcePort/));
for(const k of ["POLICY","ASSIGNMENT","DELEGATION"])test(`exact-${k.toLowerCase()}-issuer-source-bound`,()=>assert.equal(c().bind(req(k)).outcome,OUTCOMES.BOUND));
test("wrong-issuer-ref-not-bound",()=>assert.equal(c().bind(req("POLICY",{issuerRef:"other"})).outcome,OUTCOMES.NOT_BOUND));
test("wrong-issuer-revision-not-bound",()=>assert.equal(c().bind(req("POLICY",{issuerRevision:"2"})).outcome,OUTCOMES.NOT_BOUND));
test("wrong-source-ref-not-bound",()=>assert.equal(c().bind(req("POLICY",{sourceRef:"registry:governance-policy"})).outcome,OUTCOMES.NOT_BOUND));
test("wrong-source-revision-not-bound",()=>assert.equal(c().bind(req("POLICY",{sourceRevision:"2"})).outcome,OUTCOMES.NOT_BOUND));
test("unsupported-subject-invalid",()=>assert.equal(c().bind({rulesetVersion:RULESET_VERSION,issuerRef:ISSUER.issuerRef,issuerRevision:"1",subjectKind:"EXECUTION",sourceRef:"x",sourceRevision:"1"}).outcome,OUTCOMES.INVALID));
test("caller-cannot-inject-trust",()=>assert.equal(c().bind({...req("POLICY"),trustState:"TRUSTED"}).outcome,OUTCOMES.INVALID));
test("caller-cannot-inject-permission",()=>assert.equal(c().bind({...req("POLICY"),permitted:true}).outcome,OUTCOMES.INVALID));
test("unpermitted-issuer-not-bound",()=>assert.equal(c({permission:{outcome:"NOT_PERMITTED",authority:"NONE",evidence:null}}).bind(req("POLICY")).outcome,OUTCOMES.NOT_BOUND));
test("permission-wrong-authority-not-bound",()=>assert.equal(c({permission:permission("POLICY",{authority:"EXECUTE"})}).bind(req("POLICY")).outcome,OUTCOMES.NOT_BOUND));
test("untrusted-source-not-bound",()=>assert.equal(c({trust:{outcome:"NOT_TRUSTED",authority:"NONE",registryRecord:null}}).bind(req("POLICY")).outcome,OUTCOMES.NOT_BOUND));
test("trust-record-wrong-source-not-bound",()=>{const t=trust("POLICY");t.registryRecord.sourceRef="other";assert.equal(c({trust:t}).bind(req("POLICY")).outcome,OUTCOMES.NOT_BOUND)});
test("open-world-binding-set-not-bound",()=>{const s=source();s.source.bindingSetSemantics="OPEN_WORLD";assert.equal(c({source:s}).bind(req("POLICY")).outcome,OUTCOMES.NOT_BOUND)});
test("extra-binding-breaks-exact-set",()=>{const s=source();s.source.bindings.push({...s.source.bindings[0]});assert.equal(c({source:s}).bind(req("POLICY")).outcome,OUTCOMES.NOT_BOUND)});
test("missing-binding-breaks-exact-set",()=>{const s=source();s.source.bindings.pop();assert.equal(c({source:s}).bind(req("POLICY")).outcome,OUTCOMES.NOT_BOUND)});
test("unverified-binding-source-unknown",()=>assert.equal(c({source:source({status:"UNVERIFIED"})}).bind(req("POLICY")).outcome,OUTCOMES.UNKNOWN));
test("wrong-repository-unknown",()=>assert.equal(c({source:source({repositoryIdentity:"other/repo"})}).bind(req("POLICY")).outcome,OUTCOMES.UNKNOWN));
test("permission-port-failure-unknown",()=>{const x=createGovernanceEvidenceIssuerToSourceBinding({issuerPermissionPort(){throw Error("x")},sourceTrustPort(){},bindingSourcePort(){}});assert.equal(x.bind(req("POLICY")).outcome,OUTCOMES.UNKNOWN)});
test("trust-port-failure-unknown",()=>{const x=createGovernanceEvidenceIssuerToSourceBinding({issuerPermissionPort:q=>permission(q.subjectKind),sourceTrustPort(){throw Error("x")},bindingSourcePort(){}});assert.equal(x.bind(req("POLICY")).outcome,OUTCOMES.UNKNOWN)});
test("binding-source-port-failure-unknown",()=>{const x=createGovernanceEvidenceIssuerToSourceBinding({issuerPermissionPort:q=>permission(q.subjectKind),sourceTrustPort:q=>trust(q.subjectKind),bindingSourcePort(){throw Error("x")}});assert.equal(x.bind(req("POLICY")).outcome,OUTCOMES.UNKNOWN)});
test("deterministic-exact-replay",()=>assert.deepEqual(c().bind(req("POLICY")),c().bind(req("POLICY"))));
test("different-subjects-have-different-binding-evidence",()=>assert.notEqual(c().bind(req("POLICY")).evidence.bindingEvidenceRef,c().bind(req("ASSIGNMENT")).evidence.bindingEvidenceRef));
test("all-outcomes-authority-none-and-no-downstream-authority",()=>{for(const r of [c().bind(req("POLICY")),c().bind(req("POLICY",{sourceRevision:"2"})),c({source:source({status:"UNVERIFIED"})}).bind(req("POLICY")),c().bind({...req("POLICY"),trustState:"TRUSTED"})]){assert.equal(r.authority,"NONE");assert.equal(r.evidenceProduced,false);assert.equal(r.evidenceAccepted,false);assert.equal(r.principalEligibilityCreated,false);assert.equal(r.authorizationCreated,false);assert.equal(r.humanGateSatisfied,false);assert.equal(r.continuationAuthorityCreated,false);assert.equal(r.executionAuthorityCreated,false);assert.equal(r.effectAuthorized,false);}});
let passed=0;for(const[n,f]of tests){try{f();passed++;console.log(`PASS - ${n}`)}catch(e){console.error(`FAIL - ${n}`);console.error(e.stack||e);process.exitCode=1}}console.log(`${passed}/${tests.length} PASS`);if(passed!==tests.length)process.exitCode=1;
