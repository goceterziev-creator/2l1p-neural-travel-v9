"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const mod=require("./gt63-machine/first-filesystem-effect-post-verification-v0");
const EXEC_ID="gt63-execution:first-filesystem:fixture";
const EVIDENCE_REF="gt63-evidence:first-filesystem-runtime:fixture";

function clone(v){return JSON.parse(JSON.stringify(v));}
function ledger(seed=[]){const rows=seed.map(clone);return{
  findByExecutionPreparationId(id){return rows.filter(x=>x.executionPreparationId===id).map(clone);},
  commit(x){rows.push(clone(x));return clone(x);}
};}
function evidence(o={}){return{
  runtimeEffectEvidenceRef:EVIDENCE_REF,
  executionPreparationId:EXEC_ID,
  operation:"CREATE_NEW_FILE",
  relativeTargetPath:"GT63_FIRST_OPERATION.txt",
  effectPerformed:true,
  fileExists:true,
  byteLength:15,
  contentDigest:mod.EXPECTED_DIGEST,
  lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authorityEffect:"NONE",...o};}
function request(o={}){return{rulesetVersion:mod.RULESET_VERSION,executionPreparationId:EXEC_ID,runtimeEffectEvidenceRef:EVIDENCE_REF,...o};}
function system({e=evidence(),l=ledger(),fail=false}={}){
  const c=mod.createFirstFilesystemEffectPostVerificationV0({
    runtimeEffectEvidencePort(){if(fail)throw new Error();return clone(e);},
    verificationLedger:l
  });return{c,l};
}
const cases=[];function run(n,f){f();cases.push(n);}
run("exact-first-filesystem-effect-verified",()=>{const x=system().c.verify(request());assert.equal(x.outcome,mod.OUTCOMES.VERIFIED);assert.equal(x.verification.effectPerformed,true);assert.equal(x.verification.effectVerified,true);assert.equal(x.verification.additionalEffectAuthorized,false);});
run("unsupported-schema-invalid",()=>assert.equal(system().c.verify({...request(),x:true}).outcome,mod.OUTCOMES.INVALID));
run("runtime-evidence-unavailable-unknown",()=>assert.equal(system({fail:true}).c.verify(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("wrong-execution-id-not-verified",()=>assert.equal(system({e:evidence({executionPreparationId:"other"})}).c.verify(request()).outcome,mod.OUTCOMES.NOT_VERIFIED));
run("wrong-operation-not-verified",()=>assert.equal(system({e:evidence({operation:"OVERWRITE_FILE"})}).c.verify(request()).outcome,mod.OUTCOMES.NOT_VERIFIED));
run("wrong-target-not-verified",()=>assert.equal(system({e:evidence({relativeTargetPath:"other.txt"})}).c.verify(request()).outcome,mod.OUTCOMES.NOT_VERIFIED));
run("effect-not-performed-not-verified",()=>assert.equal(system({e:evidence({effectPerformed:false})}).c.verify(request()).outcome,mod.OUTCOMES.NOT_VERIFIED));
run("file-missing-not-verified",()=>assert.equal(system({e:evidence({fileExists:false})}).c.verify(request()).outcome,mod.OUTCOMES.NOT_VERIFIED));
run("wrong-byte-length-not-verified",()=>assert.equal(system({e:evidence({byteLength:14})}).c.verify(request()).outcome,mod.OUTCOMES.NOT_VERIFIED));
run("wrong-digest-not-verified",()=>assert.equal(system({e:evidence({contentDigest:"sha256:"+"0".repeat(64)})}).c.verify(request()).outcome,mod.OUTCOMES.NOT_VERIFIED));
run("stale-evidence-not-verified",()=>assert.equal(system({e:evidence({freshnessState:"STALE"})}).c.verify(request()).outcome,mod.OUTCOMES.NOT_VERIFIED));
run("contradictory-evidence-not-verified",()=>assert.equal(system({e:evidence({contradictionState:"CONFLICT"})}).c.verify(request()).outcome,mod.OUTCOMES.NOT_VERIFIED));
run("duplicate-same-verification-idempotent",()=>{const s=system();const a=s.c.verify(request());const b=s.c.verify(request());assert.equal(a.outcome,mod.OUTCOMES.VERIFIED);assert.equal(b.outcome,mod.OUTCOMES.VERIFIED);assert.equal(a.verification.verificationId,b.verification.verificationId);});
run("different-existing-verification-conflict",()=>{const first=system().c.verify(request());const changed={...first.verification,contentDigest:"sha256:"+"0".repeat(64)};assert.equal(system({l:ledger([changed])}).c.verify(request()).outcome,mod.OUTCOMES.CONFLICT);});
run("multiple-verifications-conflict",()=>{const x={executionPreparationId:EXEC_ID};assert.equal(system({l:ledger([x,x])}).c.verify(request()).outcome,mod.OUTCOMES.CONFLICT);});
run("deterministic-verification-identity",()=>{const a=system().c.verify(request());const b=system().c.verify(request());assert.equal(a.verification.verificationId,b.verification.verificationId);});
run("verification-does-not-authorize-additional-effect",()=>assert.equal(system().c.verify(request()).verification.additionalEffectAuthorized,false));
run("authority-effect-remains-none",()=>assert.equal(system().c.verify(request()).authorityEffect,"NONE"));

const semantic={cases,rulesetVersion:mod.RULESET_VERSION,outcomes:Object.values(mod.OUTCOMES)};
const validationIdentity="sha256:"+crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
process.stdout.write(JSON.stringify({status:"PASS",workflow:"first-filesystem-effect-post-verification-v0-regression",cases:cases.length,validationIdentity,semantic})+"\n");
