"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const M=require("./github-git-object-evidence-adapter-v0");
const root=require("./repository-frozen-governance-trust-root");
const sourceVerifier=require("./repository-frozen-governance-registered-source-verifier");

let passed=0;const test=(n,f)=>{f();passed++;console.log("PASS - "+n);};
const COMMIT="1".repeat(40),TREE="2".repeat(40);
const rootManifest={
  authoritativeRef:root.AUTHORITATIVE_REF,authority:"NONE",governanceNamespace:root.GOVERNANCE_NAMESPACE,
  issuerPolicyNamespace:root.ISSUER_POLICY_NAMESPACE,registeredSourcePath:root.REGISTERED_SOURCE_PATH,
  registeredSourceRef:root.REGISTERED_SOURCE_REF,repositoryIdentity:root.REPOSITORY_IDENTITY,
  rootMaterialType:"REPOSITORY_BLOB_SOURCE_REGISTRATION",rootSetSemantics:"CLOSED_WORLD_EXACT_ONE",
  rootTrustAnchorRef:root.ROOT_ANCHOR_REF,rootTrustAnchorRevision:1,rulesetVersion:root.RULESET_VERSION,
  runtimeRootRevocation:"UNSUPPORTED_V0",schemaVersion:"1.0",statementClass:root.STATEMENT_CLASS,
  supersedesRootAnchorId:null,type:"REPOSITORY_FROZEN_GOVERNANCE_TRUST_ROOT",verificationMethod:"AUTHORITATIVE_GIT_BLOB_MEMBERSHIP_V1"
};
const policy={authority:"NONE",governanceNamespace:root.GOVERNANCE_NAMESPACE,issuerPolicyNamespace:root.ISSUER_POLICY_NAMESPACE,
  issuerSetSemantics:"CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY",permittedIssuerRefs:[],policyRevision:1,
  registeredSourceRef:root.REGISTERED_SOURCE_REF,schemaVersion:"1.0",statementClass:root.STATEMENT_CLASS,
  status:"UNCONFIGURED_FAIL_CLOSED",subjectKinds:["POLICY","ASSIGNMENT","DELEGATION"],type:"GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY"};
const bytes=v=>Buffer.from(sourceVerifier.canonicalStringify(v)+"\n","utf8");
const gitSha=b=>crypto.createHash("sha1").update(Buffer.from(`blob ${b.length}\0`,"utf8")).update(b).digest("hex");
const rb=bytes(rootManifest),pb=bytes(policy),RS=gitSha(rb),PS=gitSha(pb);
function transport(o={}){
 const blobs=new Map([[RS,rb],[PS,pb]]);
 return {
  resolveRef:()=>({commitSha:o.commitSha||COMMIT}),
  readCommit:({commitSha})=>({commitSha,treeSha:o.treeSha||TREE}),
  readTreeEntry:({treeSha,path})=>{
   if(o.absentPath===path)return null;
   if(path===root.ROOT_PATH)return {treeSha,path,mode:"100644",objectType:"blob",blobSha:RS};
   if(path===root.REGISTERED_SOURCE_PATH)return {treeSha,path:o.crossPath||path,mode:"100644",objectType:"blob",blobSha:PS};
   return null;
  },
  readBlob:({blobSha})=>{const b=blobs.get(blobSha);if(!b)throw new Error("missing");return {blobSha,bytesBase64:b.toString("base64")};},
  listPathHistory:()=>({entries:o.history||[]})
 };
}
const adapter=o=>M.createGitHubGitObjectEvidenceAdapter({transport:transport(o)});
test("adapter exposes exact authority-none contract",()=>{const a=adapter();assert.equal(a.authority,"NONE");assert.equal(a.rulesetVersion,M.RULESET_VERSION);});
test("resolves only authoritative main ref",()=>{const r=adapter().resolveRef({repositoryIdentity:M.REPOSITORY_IDENTITY,authoritativeRef:M.AUTHORITATIVE_REF});assert.equal(r.commitSha,COMMIT);assert.match(r.evidenceRef,/^gt63-github-git-object:ref:/);});
test("rejects another repository",()=>assert.throws(()=>adapter().resolveRef({repositoryIdentity:"other/repo",authoritativeRef:M.AUTHORITATIVE_REF}),/cross-repository/));
test("rejects another ref",()=>assert.throws(()=>adapter().resolveRef({repositoryIdentity:M.REPOSITORY_IDENTITY,authoritativeRef:"refs/heads/candidate"}),/non-authoritative/));
test("commit observation is exact",()=>{const r=adapter().readCommit({repositoryIdentity:M.REPOSITORY_IDENTITY,commitSha:COMMIT});assert.equal(r.treeSha,TREE);});
test("tree observation is path bound",()=>{const r=adapter().readTreeEntry({repositoryIdentity:M.REPOSITORY_IDENTITY,treeSha:TREE,path:root.ROOT_PATH});assert.equal(r.path,root.ROOT_PATH);assert.equal(r.blobSha,RS);});
test("absent tree entry remains null",()=>assert.equal(adapter({absentPath:"missing"}).readTreeEntry({repositoryIdentity:M.REPOSITORY_IDENTITY,treeSha:TREE,path:"missing"}),null));
test("cross-path substitution fails closed",()=>assert.throws(()=>adapter({crossPath:"other"}).readTreeEntry({repositoryIdentity:M.REPOSITORY_IDENTITY,treeSha:TREE,path:root.REGISTERED_SOURCE_PATH}),/invalid GitHub tree/));
test("blob observation preserves exact bytes",()=>{const r=adapter().readBlob({repositoryIdentity:M.REPOSITORY_IDENTITY,blobSha:PS});assert.equal(Buffer.from(r.bytesBase64,"base64").toString("utf8"),pb.toString("utf8"));});
test("history observations are exact and authority free",()=>{const h=[{commitSha:"3".repeat(40),treeSha:"4".repeat(40),blobSha:RS}];const r=adapter({history:h}).listPathHistory({repositoryIdentity:M.REPOSITORY_IDENTITY,authoritativeRef:M.AUTHORITATIVE_REF,currentCommitSha:COMMIT,path:root.ROOT_PATH});assert.equal(r.entries.length,1);assert.equal(Object.hasOwn(r,"authority"),false);});
test("invalid history entry fails closed",()=>assert.throws(()=>adapter({history:[{commitSha:"bad",treeSha:TREE,blobSha:RS}]}).listPathHistory({repositoryIdentity:M.REPOSITORY_IDENTITY,authoritativeRef:M.AUTHORITATIVE_REF,currentCommitSha:COMMIT,path:root.ROOT_PATH}),/invalid GitHub history entry/));
test("adapter cannot emit VERIFIED or TRUSTED semantics",()=>{const a=adapter();for(const r of [a.resolveRef({repositoryIdentity:M.REPOSITORY_IDENTITY,authoritativeRef:M.AUTHORITATIVE_REF}),a.readCommit({repositoryIdentity:M.REPOSITORY_IDENTITY,commitSha:COMMIT})]){assert.equal(Object.hasOwn(r,"status"),false);assert.equal(Object.hasOwn(r,"trustState"),false);assert.equal(Object.hasOwn(r,"authority"),false);}});
test("existing registered-source verifier accepts adapter evidence",()=>{
 const a=adapter();
 const v=sourceVerifier.createRegisteredGovernanceSourceVerifier({gitObjectPort:a});
 const rr={rulesetVersion:root.RULESET_VERSION,expectedState:{commitSha:COMMIT,treeSha:TREE,expectedRootAnchorId:null},
  sourceQuery:{statementClass:root.STATEMENT_CLASS,governanceNamespace:root.GOVERNANCE_NAMESPACE,
   issuerPolicyNamespace:root.ISSUER_POLICY_NAMESPACE,registeredSourceRef:root.REGISTERED_SOURCE_REF,
   registeredSourcePath:root.REGISTERED_SOURCE_PATH}};
 const out=v.verify({rulesetVersion:sourceVerifier.RULESET_VERSION,rootRequest:rr});
 assert.equal(out.outcome,sourceVerifier.OUTCOMES.VERIFIED);assert.equal(out.authority,"NONE");
 assert.equal(out.verification.sourceStatus,"UNCONFIGURED_FAIL_CLOSED");assert.deepEqual(out.verification.permittedIssuerRefs,[]);
});
test("ref movement becomes stale in existing verifier",()=>{
 const a=adapter({commitSha:"9".repeat(40)});const v=sourceVerifier.createRegisteredGovernanceSourceVerifier({gitObjectPort:a});
 const rr={rulesetVersion:root.RULESET_VERSION,expectedState:{commitSha:COMMIT,treeSha:TREE,expectedRootAnchorId:null},
  sourceQuery:{statementClass:root.STATEMENT_CLASS,governanceNamespace:root.GOVERNANCE_NAMESPACE,
   issuerPolicyNamespace:root.ISSUER_POLICY_NAMESPACE,registeredSourceRef:root.REGISTERED_SOURCE_REF,
   registeredSourcePath:root.REGISTERED_SOURCE_PATH}};
 assert.equal(v.verify({rulesetVersion:sourceVerifier.RULESET_VERSION,rootRequest:rr}).outcome,sourceVerifier.OUTCOMES.STALE);
});
console.log(JSON.stringify({rulesetVersion:M.RULESET_VERSION,testsPassed:passed,authorityInvariant:"PASS: NONE",
 providerInvariant:"PASS: OBSERVATION ONLY",repositoryInvariant:"PASS: EXACT REPOSITORY + MAIN",
 verifierCompatibility:"PASS: REGISTERED SOURCE VERIFIER"},null,2));
