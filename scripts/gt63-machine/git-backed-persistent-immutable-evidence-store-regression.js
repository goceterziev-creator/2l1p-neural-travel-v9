"use strict";
const assert=require("node:assert/strict");
const {RULESET_VERSION,REF_NAME,OUTCOMES,canonicalStringify,gitBlobSha,createGitBackedPersistentImmutableEvidenceStore}=require("./git-backed-persistent-immutable-evidence-store");
const repo="goceterziev-creator/2l1p-neural-travel-v9";const evidence=()=>({type:"TEST_GOVERNANCE_EVIDENCE",subject:"x",revision:1,authority:"NONE"});
function fakeGit(){let seq=0,ref=null;const commits=new Map(),trees=new Map(),blobs=new Map();return{
 readRef:()=>ref?{commitSha:ref}:null,
 appendCanonicalEvidence:({path,bytesBase64,expectedBlobSha})=>{const bytes=Buffer.from(bytesBase64,"base64");assert.equal(gitBlobSha(bytes),expectedBlobSha);if(ref){const c=commits.get(ref),t=trees.get(c.treeSha);if(t[path]===expectedBlobSha)return{commitSha:ref,alreadyPresent:true};}blobs.set(expectedBlobSha,bytesBase64);const base=ref?{...trees.get(commits.get(ref).treeSha)}:{};base[path]=expectedBlobSha;const treeSha=`tree:${++seq}`;trees.set(treeSha,base);const commitSha=`commit:${seq}`;commits.set(commitSha,{treeSha});ref=commitSha;return{commitSha,alreadyPresent:false};},
 readCommit:({commitSha})=>{const c=commits.get(commitSha);return c?{commitSha,treeSha:c.treeSha}:null;},
 readTreeEntry:({treeSha,path})=>{const t=trees.get(treeSha);return t&&t[path]?{path,objectType:"blob",blobSha:t[path]}:null;},
 readBlob:({blobSha})=>blobs.has(blobSha)?{blobSha,bytesBase64:blobs.get(blobSha)}:null,
 _tamperBlob:(sha,b64)=>blobs.set(sha,b64),_setRef:v=>{ref=v;},_state:{commits,trees,blobs}
};}
function env(g=fakeGit()){return{g,store:createGitBackedPersistentImmutableEvidenceStore({repositoryIdentity:repo,gitStorePort:g})};}
const T=[];const test=(n,f)=>T.push([n,f]);
test("persist exact evidence to Git-backed ref",()=>{const {store}=env();const r=store.persist({rulesetVersion:RULESET_VERSION,evidence:evidence()});assert.equal(r.outcome,OUTCOMES.PERSISTED);assert.equal(r.membership.refName,REF_NAME);assert.equal(r.semanticAcceptanceCreated,false);});
test("same exact evidence idempotent",()=>{const {store}=env();const a=store.persist({rulesetVersion:RULESET_VERSION,evidence:evidence()});const b=store.persist({rulesetVersion:RULESET_VERSION,evidence:evidence()});assert.equal(b.outcome,OUTCOMES.ALREADY_PRESENT);assert.equal(a.membership.evidenceId,b.membership.evidenceId);});
test("verify exact membership from current Git ref",()=>{const {store}=env();const a=store.persist({rulesetVersion:RULESET_VERSION,evidence:evidence()});const v=store.verify({rulesetVersion:RULESET_VERSION,evidenceId:a.membership.evidenceId,evidence:evidence()});assert.equal(v.outcome,OUTCOMES.VERIFIED);assert.equal(v.membership.blobSha,a.membership.blobSha);});
test("caller semantic acceptance rejected",()=>{const {store}=env();assert.equal(store.persist({rulesetVersion:RULESET_VERSION,evidence:evidence(),semanticAcceptance:true}).outcome,OUTCOMES.REJECTED);});
test("evidence with authority rejected",()=>{const {store}=env();assert.equal(store.persist({rulesetVersion:RULESET_VERSION,evidence:{type:"X",authority:"EXECUTE"}}).outcome,OUTCOMES.REJECTED);});
test("evidence identity mismatch conflicts",()=>{const {store}=env();store.persist({rulesetVersion:RULESET_VERSION,evidence:evidence()});assert.equal(store.verify({rulesetVersion:RULESET_VERSION,evidenceId:"sha256:wrong",evidence:evidence()}).outcome,OUTCOMES.CONFLICT);});
test("blob byte drift conflicts",()=>{const {store,g}=env();const a=store.persist({rulesetVersion:RULESET_VERSION,evidence:evidence()});g._tamperBlob(a.membership.blobSha,Buffer.from("tampered\n").toString("base64"));assert.equal(store.verify({rulesetVersion:RULESET_VERSION,evidenceId:a.membership.evidenceId,evidence:evidence()}).outcome,OUTCOMES.CONFLICT);});
test("current ref drift prevents verification of absent membership",()=>{const {store,g}=env();const a=store.persist({rulesetVersion:RULESET_VERSION,evidence:evidence()});g._setRef("commit:missing");assert.notEqual(store.verify({rulesetVersion:RULESET_VERSION,evidenceId:a.membership.evidenceId,evidence:evidence()}).outcome,OUTCOMES.VERIFIED);});
test("canonical key order produces same persisted identity",()=>{const {store}=env();const a={type:"X",b:2,a:1,authority:"NONE"},b={authority:"NONE",a:1,b:2,type:"X"};const x=store.persist({rulesetVersion:RULESET_VERSION,evidence:a});const y=store.persist({rulesetVersion:RULESET_VERSION,evidence:b});assert.equal(x.membership.evidenceId,y.membership.evidenceId);});
test("membership creates no authority",()=>{const {store}=env();const r=store.persist({rulesetVersion:RULESET_VERSION,evidence:evidence()});assert.equal(r.authority,"NONE");assert.equal(r.semanticAcceptanceCreated,false);assert.equal(r.continuationAuthorityCreated,false);assert.equal(r.executionAuthorityCreated,false);assert.equal(r.mutationAuthorized,false);assert.equal(r.mutationPerformed,false);});
let passed=0;for(const[n,f]of T){f();passed++;console.log(`PASS ${n}`)}console.log(`RESULT ${passed}/${T.length} PASS`);
