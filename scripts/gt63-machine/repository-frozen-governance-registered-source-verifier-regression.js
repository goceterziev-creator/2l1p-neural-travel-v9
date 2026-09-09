"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const root = require("./repository-frozen-governance-trust-root");
const sourceVerifier = require("./repository-frozen-governance-registered-source-verifier");

const COMMIT = "1".repeat(40); const TREE = "2".repeat(40);
const rootManifest = {
  authoritativeRef:root.AUTHORITATIVE_REF, authority:"NONE", governanceNamespace:root.GOVERNANCE_NAMESPACE,
  issuerPolicyNamespace:root.ISSUER_POLICY_NAMESPACE, registeredSourcePath:root.REGISTERED_SOURCE_PATH,
  registeredSourceRef:root.REGISTERED_SOURCE_REF, repositoryIdentity:root.REPOSITORY_IDENTITY,
  rootMaterialType:"REPOSITORY_BLOB_SOURCE_REGISTRATION", rootSetSemantics:"CLOSED_WORLD_EXACT_ONE",
  rootTrustAnchorRef:root.ROOT_ANCHOR_REF, rootTrustAnchorRevision:1, rulesetVersion:root.RULESET_VERSION,
  runtimeRootRevocation:"UNSUPPORTED_V0", schemaVersion:"1.0", statementClass:root.STATEMENT_CLASS,
  supersedesRootAnchorId:null, type:"REPOSITORY_FROZEN_GOVERNANCE_TRUST_ROOT", verificationMethod:"AUTHORITATIVE_GIT_BLOB_MEMBERSHIP_V1"
};
const sourcePolicy = {
  authority:"NONE", governanceNamespace:root.GOVERNANCE_NAMESPACE, issuerPolicyNamespace:root.ISSUER_POLICY_NAMESPACE,
  issuerSetSemantics:"CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY", permittedIssuerRefs:[], policyRevision:1,
  registeredSourceRef:root.REGISTERED_SOURCE_REF, schemaVersion:"1.0", statementClass:root.STATEMENT_CLASS,
  status:"UNCONFIGURED_FAIL_CLOSED", subjectKinds:["POLICY","ASSIGNMENT","DELEGATION"], type:"GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY"
};
function bytes(value){ return Buffer.from(`${sourceVerifier.canonicalStringify(value)}\n`,"utf8"); }
function gitBlobSha(data){ const h=Buffer.from(`blob ${data.length}\0`,"utf8"); return crypto.createHash("sha1").update(h).update(data).digest("hex"); }
const rootBytes=bytes(rootManifest), sourceBytes=bytes(sourcePolicy), rootSha=gitBlobSha(rootBytes), sourceSha=gitBlobSha(sourceBytes);
function port(options={}){
  const blobs=new Map([[rootSha,rootBytes],[sourceSha,options.sourceBytes || sourceBytes]]);
  return {
    resolveRef:()=>({repositoryIdentity:root.REPOSITORY_IDENTITY,authoritativeRef:root.AUTHORITATIVE_REF,commitSha:options.commitSha||COMMIT,evidenceRef:"e:ref"}),
    readCommit:({commitSha})=>({commitSha,treeSha:TREE,evidenceRef:"e:commit"}),
    readTreeEntry:({treeSha,path})=>{
      if(path===root.ROOT_PATH) return {treeSha,path,mode:"100644",objectType:"blob",blobSha:rootSha,evidenceRef:"e:root-tree"};
      if(path===root.REGISTERED_SOURCE_PATH){ if(options.sourceAbsent) return null; return {treeSha,path:options.sourceEntryPath||path,mode:"100644",objectType:"blob",blobSha:options.sourceBlobSha||sourceSha,evidenceRef:"e:source-tree"}; }
      return null;
    },
    readBlob:({blobSha})=>{ const data=blobs.get(blobSha); if(!data) throw new Error("missing blob"); return {blobSha,bytesBase64:data.toString("base64"),evidenceRef:`e:blob:${blobSha}`}; },
    listPathHistory:()=>({entries:[],evidenceRef:"e:history"})
  };
}
function rootRequest(overrides={}){
  return {
    rulesetVersion:root.RULESET_VERSION,
    expectedState:{commitSha:overrides.commitSha||COMMIT,treeSha:TREE,expectedRootAnchorId:null},
    sourceQuery:{statementClass:root.STATEMENT_CLASS,governanceNamespace:root.GOVERNANCE_NAMESPACE,issuerPolicyNamespace:root.ISSUER_POLICY_NAMESPACE,registeredSourceRef:root.REGISTERED_SOURCE_REF,registeredSourcePath:root.REGISTERED_SOURCE_PATH}
  };
}
function verify(p=port(), rr=rootRequest()){
  return sourceVerifier.createRegisteredGovernanceSourceVerifier({gitObjectPort:p}).verify({rulesetVersion:sourceVerifier.RULESET_VERSION,rootRequest:rr});
}
const tests=[]; const test=(name,fn)=>tests.push([name,fn]);
test("registered source exact bytes verified",()=>{const r=verify();assert.equal(r.outcome,sourceVerifier.OUTCOMES.VERIFIED);assert.equal(r.verification.sourceStatus,"UNCONFIGURED_FAIL_CLOSED");assert.deepEqual(r.verification.permittedIssuerRefs,[]);assert.equal(r.authority,"NONE");assert.equal(r.verification.authority,"NONE");});
test("registered source path absent invalid",()=>assert.equal(verify(port({sourceAbsent:true})).outcome,sourceVerifier.OUTCOMES.INVALID));
test("cross-path source substitution invalid",()=>assert.equal(verify(port({sourceEntryPath:"config/other.json"})).outcome,sourceVerifier.OUTCOMES.INVALID));
test("source bytes tampering conflicts with blob identity",()=>{const changed=bytes({...sourcePolicy,status:"CHANGED"});assert.equal(verify(port({sourceBytes:changed})).outcome,sourceVerifier.OUTCOMES.CONFLICT);});
test("noncanonical source bytes invalid",()=>{const noncanonical=Buffer.from(`${JSON.stringify(sourcePolicy,null,2)}\n`,"utf8");const sha=gitBlobSha(noncanonical);const p=port({sourceBlobSha:sha});const original=p.readBlob;p.readBlob=({blobSha})=>blobSha===sha?{blobSha,bytesBase64:noncanonical.toString("base64"),evidenceRef:"e:noncanonical"}:original({blobSha});assert.equal(verify(p).outcome,sourceVerifier.OUTCOMES.INVALID);});
test("caller source override rejected",()=>{const v=sourceVerifier.createRegisteredGovernanceSourceVerifier({gitObjectPort:port()});const r=v.verify({rulesetVersion:sourceVerifier.RULESET_VERSION,rootRequest:rootRequest(),sourcePath:"config/other.json"});assert.equal(r.outcome,sourceVerifier.OUTCOMES.INVALID);});
test("stale root prerequisite propagates stale",()=>{const p=port({commitSha:"3".repeat(40)});assert.equal(verify(p,rootRequest()).outcome,sourceVerifier.OUTCOMES.STALE);});
test("source verification binds exact commit tree and blob",()=>{const r=verify();assert.equal(r.verification.commitSha,COMMIT);assert.equal(r.verification.treeSha,TREE);assert.equal(r.verification.sourceBlobSha,sourceSha);assert.match(r.verification.sourceBlobSha256,/^sha256:[0-9a-f]{64}$/);assert.match(r.verification.sourceVerificationId,/^sha256:[0-9a-f]{64}$/);});
test("materialization alone creates no issuer authority",()=>{const r=verify();assert.equal(r.verification.issuerSetSemantics,"CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY");assert.equal(r.verification.permittedIssuerRefs.length,0);assert.equal(r.authority,"NONE");});
let passed=0;for(const [name,fn] of tests){try{fn();passed++;console.log(`PASS ${name}`);}catch(error){console.error(`FAIL ${name}`);throw error;}}console.log(`RESULT ${passed}/${tests.length} PASS`);
