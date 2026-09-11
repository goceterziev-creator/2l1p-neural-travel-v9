"use strict";

const assert = require("node:assert/strict");
const mod = require("./governance-principal-identity-binding");
const anchor = Object.freeze({type:"GT63_GOVERNANCE_PRINCIPAL_IDENTITY_ANCHOR",schemaVersion:"1.0",rulesetVersion:"governance-principal-identity-anchor-v0.1.0",governancePrincipalRef:"gt63-machine:human-principal:goce-v0",governancePrincipalRevision:"1",identityProvider:"github.com",githubUserId:239696056,githubLogin:"goceterziev-creator",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",acceptanceState:"ACCEPTED",authority:"NONE"});
function identity(overrides={}){return {type:"GT63_EXTERNAL_AUTHENTICATED_IDENTITY_BINDING",rulesetVersion:"github-human-identity-trust-bootstrap-v0.1.0",principalRef:"gt63-machine:principal:github:239696056",principalNamespace:"github.com",principalRevision:"1",githubUserId:239696056,githubLogin:"goceterziev-creator",sessionRef:"session:1",sessionRevision:"1",authenticatedAccountRef:"account:1",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",principalEvidenceRef:"evidence:github:1",verificationMethodRef:"gt63-machine:verification-method:github-oauth-device-flow-v0",verificationMethodRevision:"1",verifiedAt:"2026-09-11T00:00:00.000Z",authority:"NONE",...overrides};}
function make(port=()=>anchor){return mod.createGovernancePrincipalIdentityBinding({identityAnchorPort:port});}
const tests=[];function t(name,fn){tests.push([name,fn]);}
t("constructor-requires-anchor-port",()=>assert.throws(()=>mod.createGovernancePrincipalIdentityBinding(),/identityAnchorPort/));
t("exact-authenticated-identity-binds-governance-principal",()=>{const r=make().assess(identity());assert.equal(r.outcome,mod.OUTCOMES.BOUND);assert.equal(r.evidence.principalRef,"gt63-machine:human-principal:goce-v0");assert.equal(r.evidence.externalPrincipalRef,"gt63-machine:principal:github:239696056");});
t("numeric-id-mismatch-not-bound",()=>assert.equal(make().assess(identity({githubUserId:1,principalRef:"gt63-machine:principal:github:1"})).outcome,mod.OUTCOMES.NOT_BOUND));
t("login-mismatch-not-bound",()=>assert.equal(make().assess(identity({githubLogin:"other"})).outcome,mod.OUTCOMES.NOT_BOUND));
t("application-account-ref-cannot-substitute-for-external-principal",()=>assert.equal(make().assess(identity({principalRef:"gt63-runtime-user:USR-ADMIN"})).outcome,mod.OUTCOMES.NOT_BOUND));
t("stale-external-identity-unknown",()=>assert.equal(make().assess(identity({freshnessState:"STALE"})).outcome,mod.OUTCOMES.UNKNOWN));
t("contradictory-external-identity-unknown",()=>assert.equal(make().assess(identity({contradictionState:"CONFLICT"})).outcome,mod.OUTCOMES.UNKNOWN));
t("missing-anchor-unknown",()=>assert.equal(make(()=>null).assess(identity()).outcome,mod.OUTCOMES.UNKNOWN));
t("unaccepted-anchor-unknown",()=>assert.equal(make(()=>({...anchor,acceptanceState:"UNACCEPTED"})).assess(identity()).outcome,mod.OUTCOMES.UNKNOWN));
t("stale-anchor-unknown",()=>assert.equal(make(()=>({...anchor,freshnessState:"STALE"})).assess(identity()).outcome,mod.OUTCOMES.UNKNOWN));
t("wrong-anchor-principal-unknown",()=>assert.equal(make(()=>({...anchor,governancePrincipalRef:"other"})).assess(identity()).outcome,mod.OUTCOMES.UNKNOWN));
t("deterministic-exact-replay",()=>{const a=make().assess(identity()),b=make().assess(identity());assert.deepEqual(a,b);});
t("changed-external-evidence-changes-binding-identity",()=>{const a=make().assess(identity()),b=make().assess(identity({principalEvidenceRef:"evidence:github:2"}));assert.notEqual(a.evidence.principalEvidenceRef,b.evidence.principalEvidenceRef);});
t("all-outcomes-authority-none",()=>{for(const r of [make().assess(identity()),make().assess(identity({githubUserId:1,principalRef:"gt63-machine:principal:github:1"})),make(()=>null).assess(identity())])assert.equal(r.authority,"NONE");});
t("binding-does-not-create-downstream-authority",()=>{const r=make().assess(identity());assert.equal(r.eligibilityCreated,false);assert.equal(r.roleAuthorityCreated,false);assert.equal(r.humanGateSatisfied,false);assert.equal(r.continuationAuthorityCreated,false);assert.equal(r.executionAuthorityCreated,false);assert.equal(r.effectAuthorized,false);});
let passed=0;for(const [name,fn] of tests){try{fn();console.log(`PASS - ${name}`);passed++;}catch(e){console.error(`FAIL - ${name}`);console.error(e.stack||e);process.exitCode=1;}}console.log(`${passed}/${tests.length} PASS`);if(passed!==tests.length)process.exitCode=1;
