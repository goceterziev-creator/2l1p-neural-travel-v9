"use strict";
const assert=require("node:assert/strict");const {RULESET_VERSION,OUTCOMES,EXPECTED,createGovernanceEvidenceIssuerScopePolicy}=require("./governance-evidence-issuer-scope-policy");
const clone=v=>JSON.parse(JSON.stringify(v));
function identity(p={}){return {outcome:"ESTABLISHED",authority:"NONE",evidence:{issuerRef:EXPECTED.issuerRef,issuerRevision:EXPECTED.issuerRevision},...clone(p)};}
function policy(p={}){return {type:"GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY",statementClass:"GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY",status:"CONFIGURED_CANDIDATE_NOT_ACCEPTED",authority:"NONE",issuerSetSemantics:"CLOSED_WORLD_EXACT",permittedIssuerRefs:[EXPECTED.issuerRef],permittedIssuers:[{issuerRef:EXPECTED.issuerRef,issuerRevision:EXPECTED.issuerRevision,subjectKinds:["POLICY","ASSIGNMENT","DELEGATION"]}],policyRevision:2,subjectKinds:["POLICY","ASSIGNMENT","DELEGATION"],...clone(p)};}
function observed(p={}){return {status:"VERIFIED",authority:"NONE",verificationMethod:"AUTHORITATIVE_GIT_BLOB_MEMBERSHIP_V1",repositoryIdentity:EXPECTED.repositoryIdentity,sourcePath:EXPECTED.sourcePath,sourceBlobSha:"a".repeat(40),source:policy(),...clone(p)};}
function req(kind="POLICY",p={}){return {rulesetVersion:RULESET_VERSION,issuerRef:EXPECTED.issuerRef,issuerRevision:EXPECTED.issuerRevision,subjectKind:kind,...clone(p)};}
function c(i=identity(),o=observed()){return createGovernanceEvidenceIssuerScopePolicy({issuerIdentityEvidencePort(){return clone(i);},policySourcePort(){return clone(o);}});}
const tests=[];const test=(n,f)=>tests.push([n,f]);
test("constructor-requires-identity-port",()=>assert.throws(()=>createGovernanceEvidenceIssuerScopePolicy({policySourcePort(){}}),/issuerIdentityEvidencePort/));
test("constructor-requires-policy-port",()=>assert.throws(()=>createGovernanceEvidenceIssuerScopePolicy({issuerIdentityEvidencePort(){}}),/policySourcePort/));
for(const k of ["POLICY","ASSIGNMENT","DELEGATION"])test(`exact-established-issuer-permitted-for-${k.toLowerCase()}`,()=>assert.equal(c().evaluate(req(k)).outcome,OUTCOMES.PERMITTED));
test("unestablished-issuer-not-permitted",()=>assert.equal(c(identity({outcome:"NOT_ESTABLISHED",evidence:null})).evaluate(req()).outcome,OUTCOMES.NOT_PERMITTED));
test("wrong-issuer-ref-not-permitted",()=>assert.equal(c().evaluate(req("POLICY",{issuerRef:"gt63-machine:issuer:other"})).outcome,OUTCOMES.NOT_PERMITTED));
test("wrong-issuer-revision-not-permitted",()=>assert.equal(c().evaluate(req("POLICY",{issuerRevision:"2"})).outcome,OUTCOMES.NOT_PERMITTED));
test("unsupported-subject-kind-invalid",()=>assert.equal(c().evaluate(req("EXECUTION")).outcome,OUTCOMES.INVALID));
test("caller-cannot-inject-permission",()=>assert.equal(c().evaluate({...req(),permitted:true}).outcome,OUTCOMES.INVALID));
test("open-world-policy-not-permitted",()=>{const o=observed();o.source.issuerSetSemantics="OPEN_WORLD";assert.equal(c(identity(),o).evaluate(req()).outcome,OUTCOMES.NOT_PERMITTED);});
test("unconfigured-policy-not-permitted",()=>{const o=observed();o.source.status="UNCONFIGURED_FAIL_CLOSED";assert.equal(c(identity(),o).evaluate(req()).outcome,OUTCOMES.NOT_PERMITTED);});
test("extra-issuer-not-exact",()=>{const o=observed();o.source.permittedIssuerRefs.push("x");o.source.permittedIssuers.push({issuerRef:"x",issuerRevision:"1",subjectKinds:["POLICY"]});assert.equal(c(identity(),o).evaluate(req()).outcome,OUTCOMES.NOT_PERMITTED);});
test("subject-outside-issuer-scope-not-permitted",()=>{const o=observed();o.source.permittedIssuers[0].subjectKinds=["POLICY"];assert.equal(c(identity(),o).evaluate(req("ASSIGNMENT")).outcome,OUTCOMES.NOT_PERMITTED);});
test("policy-source-unverified-unknown",()=>assert.equal(c(identity(),observed({status:"UNVERIFIED"})).evaluate(req()).outcome,OUTCOMES.UNKNOWN));
test("wrong-policy-source-authority-unknown",()=>assert.equal(c(identity(),observed({authority:"EXECUTE"})).evaluate(req()).outcome,OUTCOMES.UNKNOWN));
test("wrong-repository-unknown",()=>assert.equal(c(identity(),observed({repositoryIdentity:"other/repo"})).evaluate(req()).outcome,OUTCOMES.UNKNOWN));
test("identity-port-failure-unknown",()=>{const x=createGovernanceEvidenceIssuerScopePolicy({issuerIdentityEvidencePort(){throw Error("x")},policySourcePort(){return observed()}});assert.equal(x.evaluate(req()).outcome,OUTCOMES.UNKNOWN);});
test("policy-port-failure-unknown",()=>{const x=createGovernanceEvidenceIssuerScopePolicy({issuerIdentityEvidencePort(){return identity()},policySourcePort(){throw Error("x")}});assert.equal(x.evaluate(req()).outcome,OUTCOMES.UNKNOWN);});
test("deterministic-exact-replay",()=>assert.deepEqual(c().evaluate(req()),c().evaluate(req())));
test("changed-subject-kind-changes-policy-evidence",()=>assert.notEqual(c().evaluate(req("POLICY")).evidence.policyEvidenceRef,c().evaluate(req("ASSIGNMENT")).evidence.policyEvidenceRef));
test("all-outcomes-authority-none-and-no-downstream-authority",()=>{for(const r of [c().evaluate(req()),c(identity({outcome:"NOT_ESTABLISHED",evidence:null})).evaluate(req()),c(identity(),observed({status:"UNVERIFIED"})).evaluate(req()),c().evaluate(req("EXECUTION"))]){assert.equal(r.authority,"NONE");assert.equal(r.policyEvidenceAccepted,false);assert.equal(r.assignmentEvidenceAccepted,false);assert.equal(r.delegationEvidenceAccepted,false);assert.equal(r.principalEligibilityCreated,false);assert.equal(r.humanGateSatisfied,false);assert.equal(r.continuationAuthorityCreated,false);assert.equal(r.executionAuthorityCreated,false);assert.equal(r.effectAuthorized,false);}});
let passed=0;for(const[n,f]of tests){try{f();passed++;console.log(`PASS - ${n}`)}catch(e){console.error(`FAIL - ${n}`);console.error(e.stack||e);process.exitCode=1}}console.log(`${passed}/${tests.length} PASS`);if(passed!==tests.length)process.exitCode=1;
