"use strict";
const assert = require("node:assert/strict");
const { RULESET_VERSION, OUTCOMES, EXPECTED, createRepositoryFrozenGovernanceEvidenceIssuerIdentitySource } = require("./repository-frozen-governance-evidence-issuer-identity-source");
function clone(v){return JSON.parse(JSON.stringify(v));}
function source(p={}){return {type:EXPECTED.type,statementClass:EXPECTED.statementClass,status:EXPECTED.status,authority:"NONE",governanceNamespace:"GT63_MACHINE_GOVERNANCE",issuerRef:"gt63-machine:issuer:governance-evidence-v0",issuerRevision:"1",repositoryIdentity:EXPECTED.repositoryIdentity,schemaVersion:"1.0",subjectKinds:["POLICY","ASSIGNMENT","DELEGATION"],...clone(p)};}
function observed(p={}){return {status:"VERIFIED",authority:"NONE",verificationMethod:"AUTHORITATIVE_GIT_BLOB_MEMBERSHIP_V1",repositoryIdentity:EXPECTED.repositoryIdentity,sourcePath:EXPECTED.sourcePath,commitSha:"1".repeat(40),treeSha:"2".repeat(40),sourceBlobSha:"3".repeat(40),sourceBlobSha256:`sha256:${"4".repeat(64)}`,source:source(),...clone(p)};}
function request(p={}){return {rulesetVersion:RULESET_VERSION,issuerRef:"gt63-machine:issuer:governance-evidence-v0",issuerRevision:"1",...clone(p)};}
function component(o=observed()){return createRepositoryFrozenGovernanceEvidenceIssuerIdentitySource({repositorySourcePort(){return clone(o);}});}
const tests=[]; function test(n,f){tests.push([n,f]);}
test("constructor-requires-repository-source-port",()=>assert.throws(()=>createRepositoryFrozenGovernanceEvidenceIssuerIdentitySource(),/repositorySourcePort/));
test("exact-repository-frozen-source-verifies",()=>assert.equal(component().verify(request()).outcome,OUTCOMES.VERIFIED));
test("wrong-issuer-ref-not-verified",()=>assert.equal(component().verify(request({issuerRef:"gt63-machine:issuer:other"})).outcome,OUTCOMES.NOT_VERIFIED));
test("wrong-issuer-revision-not-verified",()=>assert.equal(component().verify(request({issuerRevision:"2"})).outcome,OUTCOMES.NOT_VERIFIED));
test("scope-policy-cannot-substitute-identity-source",()=>{const o=observed();o.source={type:"GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY",statementClass:"GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY",status:"UNCONFIGURED_FAIL_CLOSED",authority:"NONE",repositoryIdentity:EXPECTED.repositoryIdentity,issuerRef:request().issuerRef,issuerRevision:"1",subjectKinds:["POLICY","ASSIGNMENT","DELEGATION"]};assert.equal(component(o).verify(request()).outcome,OUTCOMES.NOT_VERIFIED);});
test("repository-owner-cannot-substitute-issuer",()=>assert.equal(component().verify({...request(),repositoryOwner:"goceterziev-creator"}).outcome,OUTCOMES.INVALID));
test("caller-cannot-inject-verified",()=>assert.equal(component().verify({...request(),verified:true}).outcome,OUTCOMES.INVALID));
test("unverified-source-unknown",()=>assert.equal(component(observed({status:"UNVERIFIED"})).verify(request()).outcome,OUTCOMES.UNKNOWN));
test("wrong-source-authority-unknown",()=>assert.equal(component(observed({authority:"EXECUTE"})).verify(request()).outcome,OUTCOMES.UNKNOWN));
test("wrong-verification-method-unknown",()=>assert.equal(component(observed({verificationMethod:"PATH_MATCH_ONLY"})).verify(request()).outcome,OUTCOMES.UNKNOWN));
test("wrong-repository-unknown",()=>assert.equal(component(observed({repositoryIdentity:"other/repo"})).verify(request()).outcome,OUTCOMES.UNKNOWN));
test("wrong-source-path-unknown",()=>assert.equal(component(observed({sourcePath:"config/other.json"})).verify(request()).outcome,OUTCOMES.UNKNOWN));
test("invalid-commit-sha-unknown",()=>assert.equal(component(observed({commitSha:"bad"})).verify(request()).outcome,OUTCOMES.UNKNOWN));
test("invalid-blob-sha256-unknown",()=>assert.equal(component(observed({sourceBlobSha256:"sha256:bad"})).verify(request()).outcome,OUTCOMES.UNKNOWN));
test("subject-kind-contract-mismatch-not-verified",()=>{const o=observed();o.source.subjectKinds=["POLICY"];assert.equal(component(o).verify(request()).outcome,OUTCOMES.NOT_VERIFIED);});
test("port-failure-unknown",()=>{const c=createRepositoryFrozenGovernanceEvidenceIssuerIdentitySource({repositorySourcePort(){throw new Error("offline");}});assert.equal(c.verify(request()).outcome,OUTCOMES.UNKNOWN);});
test("deterministic-exact-replay",()=>assert.deepEqual(component().verify(request()),component().verify(request())));
test("changed-provenance-changes-verification-identity",()=>{const a=component().verify(request());const b=component(observed({sourceBlobSha:"5".repeat(40)})).verify(request());assert.notEqual(a.evidence.sourceVerificationRef,b.evidence.sourceVerificationRef);});
test("all-outcomes-authority-none-and-no-downstream-authority",()=>{const rs=[component().verify(request()),component().verify(request({issuerRef:"x"})),component(observed({status:"UNVERIFIED"})).verify(request()),component().verify({...request(),verified:true})];for(const r of rs){assert.equal(r.authority,"NONE");assert.equal(r.issuerPermissionCreated,false);assert.equal(r.policyEvidenceAccepted,false);assert.equal(r.assignmentEvidenceAccepted,false);assert.equal(r.delegationEvidenceAccepted,false);assert.equal(r.principalEligibilityCreated,false);assert.equal(r.humanGateSatisfied,false);assert.equal(r.continuationAuthorityCreated,false);assert.equal(r.executionAuthorityCreated,false);assert.equal(r.effectAuthorized,false);}});
let passed=0;for(const [name,fn] of tests){try{fn();passed++;console.log(`PASS - ${name}`);}catch(e){console.error(`FAIL - ${name}`);console.error(e.stack||e);process.exitCode=1;}}
console.log(`${passed}/${tests.length} PASS`);if(passed!==tests.length)process.exitCode=1;
