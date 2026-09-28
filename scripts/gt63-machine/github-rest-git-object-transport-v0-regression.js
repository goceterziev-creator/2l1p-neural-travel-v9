"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const T=require("./github-rest-git-object-transport-v0");
const A=require("./github-git-object-evidence-adapter-v0");
const root=require("./repository-frozen-governance-trust-root");
const source=require("./repository-frozen-governance-registered-source-verifier");
let passed=0;const test=(n,f)=>{f();passed++;console.log("PASS - "+n);};
const C="1".repeat(40),TR="2".repeat(40);
const rm={authoritativeRef:root.AUTHORITATIVE_REF,authority:"NONE",governanceNamespace:root.GOVERNANCE_NAMESPACE,issuerPolicyNamespace:root.ISSUER_POLICY_NAMESPACE,registeredSourcePath:root.REGISTERED_SOURCE_PATH,registeredSourceRef:root.REGISTERED_SOURCE_REF,repositoryIdentity:root.REPOSITORY_IDENTITY,rootMaterialType:"REPOSITORY_BLOB_SOURCE_REGISTRATION",rootSetSemantics:"CLOSED_WORLD_EXACT_ONE",rootTrustAnchorRef:root.ROOT_ANCHOR_REF,rootTrustAnchorRevision:1,rulesetVersion:root.RULESET_VERSION,runtimeRootRevocation:"UNSUPPORTED_V0",schemaVersion:"1.0",statementClass:root.STATEMENT_CLASS,supersedesRootAnchorId:null,type:"REPOSITORY_FROZEN_GOVERNANCE_TRUST_ROOT",verificationMethod:"AUTHORITATIVE_GIT_BLOB_MEMBERSHIP_V1"};
const sp={authority:"NONE",governanceNamespace:root.GOVERNANCE_NAMESPACE,issuerPolicyNamespace:root.ISSUER_POLICY_NAMESPACE,issuerSetSemantics:"CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY",permittedIssuerRefs:[],policyRevision:1,registeredSourceRef:root.REGISTERED_SOURCE_REF,schemaVersion:"1.0",statementClass:root.STATEMENT_CLASS,status:"UNCONFIGURED_FAIL_CLOSED",subjectKinds:["POLICY","ASSIGNMENT","DELEGATION"],type:"GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY"};
const bytes=v=>Buffer.from(source.canonicalStringify(v)+"\n");const gs=b=>crypto.createHash("sha1").update(Buffer.from(`blob ${b.length}\0`)).update(b).digest("hex");
const RB=bytes(rm),PB=bytes(sp),RS=gs(RB),PS=gs(PB);
function fixture(o={}){
 const calls=[];
 const request=q=>{calls.push(q);assert.equal(q.method,"GET");assert.equal(q.headers["X-GitHub-Api-Version"],T.API_VERSION);
  if(q.path.endsWith("/git/ref/heads/main"))return {status:200,body:{ref:T.AUTHORITATIVE_REF,object:{type:"commit",sha:o.refSha||C}}};
  if(q.path.includes("/git/commits/")){const sha=q.path.split("/").pop();return {status:200,body:{sha,tree:{sha:TR}}};}
  if(q.path.includes("/git/trees/"))return {status:200,body:{sha:TR,truncated:Boolean(o.truncated),tree:[
    {path:root.ROOT_PATH,mode:"100644",type:"blob",sha:RS},{path:root.REGISTERED_SOURCE_PATH,mode:"100644",type:"blob",sha:PS}]}};
  if(q.path.includes("/git/blobs/")){const sha=q.path.split("/").pop(),b=sha===RS?RB:PB;return {status:200,body:{sha,encoding:"base64",content:b.toString("base64")}};}
  if(q.path.endsWith("/commits"))return {status:200,body:o.history||[]};
  throw new Error("unexpected");
 };
 return {calls,transport:T.createGitHubRestGitObjectTransport({request,token:o.token||""})};
}
test("transport authority is NONE",()=>assert.equal(fixture().transport.authority,"NONE"));
test("ref uses exact read-only main endpoint",()=>assert.equal(fixture().transport.resolveRef({repositoryIdentity:T.REPOSITORY_IDENTITY,authoritativeRef:T.AUTHORITATIVE_REF}).commitSha,C));
test("cross repository rejected",()=>assert.throws(()=>fixture().transport.resolveRef({repositoryIdentity:"x/y",authoritativeRef:T.AUTHORITATIVE_REF}),/cross-repository/));
test("non-main ref rejected",()=>assert.throws(()=>fixture().transport.resolveRef({repositoryIdentity:T.REPOSITORY_IDENTITY,authoritativeRef:"refs/heads/x"}),/non-authoritative/));
test("commit maps exact tree sha",()=>assert.equal(fixture().transport.readCommit({repositoryIdentity:T.REPOSITORY_IDENTITY,commitSha:C}).treeSha,TR));
test("tree maps exact root blob",()=>assert.equal(fixture().transport.readTreeEntry({repositoryIdentity:T.REPOSITORY_IDENTITY,treeSha:TR,path:root.ROOT_PATH}).blobSha,RS));
test("truncated recursive tree fails closed",()=>assert.throws(()=>fixture({truncated:true}).transport.readTreeEntry({repositoryIdentity:T.REPOSITORY_IDENTITY,treeSha:TR,path:root.ROOT_PATH}),/truncated/));
test("blob maps exact base64 bytes",()=>assert.equal(Buffer.from(fixture().transport.readBlob({repositoryIdentity:T.REPOSITORY_IDENTITY,blobSha:PS}).bytesBase64,"base64").toString(),PB.toString()));
test("optional token is only authorization header",()=>{const f=fixture({token:"test-token"});f.transport.resolveRef({repositoryIdentity:T.REPOSITORY_IDENTITY,authoritativeRef:T.AUTHORITATIVE_REF});assert.equal(f.calls[0].headers.Authorization,"Bearer test-token");});
test("history is bounded to current commit and path",()=>{const h=[{sha:C,commit:{tree:{sha:TR}}}];const f=fixture({history:h});const r=f.transport.listPathHistory({repositoryIdentity:T.REPOSITORY_IDENTITY,authoritativeRef:T.AUTHORITATIVE_REF,currentCommitSha:C,path:root.ROOT_PATH});assert.equal(r.entries[0].commitSha,C);const call=f.calls.find(x=>x.path.endsWith("/commits"));assert.equal(call.query.sha,C);assert.equal(call.query.path,root.ROOT_PATH);});
test("transport plus adapter satisfies registered source verifier",()=>{const f=fixture();const a=A.createGitHubGitObjectEvidenceAdapter({transport:f.transport});const v=source.createRegisteredGovernanceSourceVerifier({gitObjectPort:a});const rr={rulesetVersion:root.RULESET_VERSION,expectedState:{commitSha:C,treeSha:TR,expectedRootAnchorId:null},sourceQuery:{statementClass:root.STATEMENT_CLASS,governanceNamespace:root.GOVERNANCE_NAMESPACE,issuerPolicyNamespace:root.ISSUER_POLICY_NAMESPACE,registeredSourceRef:root.REGISTERED_SOURCE_REF,registeredSourcePath:root.REGISTERED_SOURCE_PATH}};const r=v.verify({rulesetVersion:source.RULESET_VERSION,rootRequest:rr});assert.equal(r.outcome,source.OUTCOMES.VERIFIED);assert.equal(r.authority,"NONE");});
test("ref movement remains STALE through full chain",()=>{const f=fixture({refSha:"9".repeat(40)});const a=A.createGitHubGitObjectEvidenceAdapter({transport:f.transport});const v=source.createRegisteredGovernanceSourceVerifier({gitObjectPort:a});const rr={rulesetVersion:root.RULESET_VERSION,expectedState:{commitSha:C,treeSha:TR,expectedRootAnchorId:null},sourceQuery:{statementClass:root.STATEMENT_CLASS,governanceNamespace:root.GOVERNANCE_NAMESPACE,issuerPolicyNamespace:root.ISSUER_POLICY_NAMESPACE,registeredSourceRef:root.REGISTERED_SOURCE_REF,registeredSourcePath:root.REGISTERED_SOURCE_PATH}};assert.equal(v.verify({rulesetVersion:source.RULESET_VERSION,rootRequest:rr}).outcome,source.OUTCOMES.STALE);});
console.log(JSON.stringify({testsPassed:passed,authorityInvariant:"PASS: NONE",networkInvariant:"PASS: GET ONLY",chainCompatibility:"PASS: TRANSPORT -> ADAPTER -> VERIFIER"},null,2));