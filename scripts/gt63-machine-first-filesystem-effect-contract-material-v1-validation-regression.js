"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {RULESET_VERSION,EXPECTED,validateFirstFilesystemEffectContractMaterialV1}=require("./gt63-machine/first-filesystem-effect-contract-material-v1-validation");

function base(){
  return {
    type:"GT63_FIRST_FILESYSTEM_EFFECT_CONTRACT_MATERIAL",
    schemaVersion:"1.0",
    materialRevision:1,
    materialIdentity:"gt63-machine:effect-contract-material:first-filesystem-create-file-v1@1",
    provenance:{
      materializationKind:"RE_MATERIALIZED_FROM_PREVIOUSLY_HUMAN_APPROVED_EXACT_SEMANTIC_CONTRACT",
      recoveredHistoricalArtifact:false,
      historicalArtifactIdentityClaimed:false
    },
    effectContract:{
      effectContractRef:"gt63-machine:effect-contract:first-filesystem-create-file-v1",
      effectContractRevision:1,
      operation:"CREATE_NEW_FILE",
      authorizedRootIdentity:"GT63_FIRST_EFFECT_TEST/",
      target:{kind:"RELATIVE_FILE",path:"GT63_FIRST_OPERATION.txt"},
      payload:{encoding:"UTF-8",bytesBase64:"SGVsbG8gZnJvbSBHVDYz"},
      precondition:{mustNotExist:true},
      expectedPostcondition:{fileExists:true,contentDigest:"sha256:241d88cea11b71564b4aa1597ecf6cc49cb06a3dca4044d0afddd9ca2116f3f9"}
    },
    expectedEffectContractDigest:"sha256:2d1f3d534c4989a1f6f4ec86f7bd3446a79fc20999507f3d5ad42e8e91b851b1",
    materialState:"CANDIDATE_RE_MATERIALIZED_NOT_ACCEPTED",
    authorityEffect:"NONE",
    nonClaims:{
      recoveredHistoricalArtifact:false,
      sourceBound:false,
      materialAccepted:false,
      effectAuthorized:false,
      authorizedRootResolved:false,
      filesystemToolAuthority:false,
      effectPerformed:false,
      machineAuthority:false
    }
  };
}
const clone=v=>JSON.parse(JSON.stringify(v));
const cases=[];
function run(name,fn){fn();cases.push(name);}
function expectInvalid(mutator){
  const x=base();mutator(x);const r=validateFirstFilesystemEffectContractMaterialV1(x);
  assert.equal(r.state,"INVALID");assert.equal(r.authorityEffect,"NONE");
}
run("exact-rematerialized-material-valid",()=>{
  const r=validateFirstFilesystemEffectContractMaterialV1(base());
  assert.equal(r.state,"VALID");
  assert.equal(r.details.payloadByteLength,15);
  assert.equal(r.details.payloadDigest,EXPECTED.payloadDigest);
  assert.equal(r.details.effectContractDigest,EXPECTED.effectContractDigest);
  assert.equal(r.details.historicalArtifactRecovered,false);
});
run("not-historical-recovery",()=>assert.equal(base().provenance.recoveredHistoricalArtifact,false));
run("operation-mismatch-invalid",()=>expectInvalid(x=>x.effectContract.operation="OVERWRITE_FILE"));
run("root-mismatch-invalid",()=>expectInvalid(x=>x.effectContract.authorizedRootIdentity="OTHER/"));
run("target-kind-mismatch-invalid",()=>expectInvalid(x=>x.effectContract.target.kind="ABSOLUTE_FILE"));
run("target-path-mismatch-invalid",()=>expectInvalid(x=>x.effectContract.target.path="other.txt"));
run("payload-encoding-mismatch-invalid",()=>expectInvalid(x=>x.effectContract.payload.encoding="ASCII"));
run("payload-bytes-mismatch-invalid",()=>expectInvalid(x=>x.effectContract.payload.bytesBase64="SGVsbG8="));
run("payload-digest-mismatch-invalid",()=>expectInvalid(x=>x.effectContract.expectedPostcondition.contentDigest="sha256:"+"0".repeat(64)));
run("must-not-exist-required",()=>expectInvalid(x=>x.effectContract.precondition.mustNotExist=false));
run("file-exists-postcondition-required",()=>expectInvalid(x=>x.effectContract.expectedPostcondition.fileExists=false));
run("effect-digest-mismatch-invalid",()=>expectInvalid(x=>x.expectedEffectContractDigest="sha256:"+"0".repeat(64)));
run("recovery-claim-forbidden",()=>expectInvalid(x=>x.provenance.recoveredHistoricalArtifact=true));
run("historical-identity-claim-forbidden",()=>expectInvalid(x=>x.provenance.historicalArtifactIdentityClaimed=true));
run("accepted-state-forbidden",()=>expectInvalid(x=>x.materialState="ACCEPTED"));
run("authority-widening-forbidden",()=>expectInvalid(x=>x.authorityEffect="FILESYSTEM_WRITE"));
run("effect-authorized-nonclaim-must-remain-false",()=>expectInvalid(x=>x.nonClaims.effectAuthorized=true));
run("filesystem-authority-nonclaim-must-remain-false",()=>expectInvalid(x=>x.nonClaims.filesystemToolAuthority=true));
run("effect-performed-nonclaim-must-remain-false",()=>expectInvalid(x=>x.nonClaims.effectPerformed=true));
run("deterministic-validation",()=>{
  const a=validateFirstFilesystemEffectContractMaterialV1(base());
  const b=validateFirstFilesystemEffectContractMaterialV1(base());
  assert.deepEqual(a,b);
});
run("authority-always-none",()=>{
  assert.equal(validateFirstFilesystemEffectContractMaterialV1(base()).authorityEffect,"NONE");
  const x=base();x.effectContract.operation="BAD";
  assert.equal(validateFirstFilesystemEffectContractMaterialV1(x).authorityEffect,"NONE");
});

const semantic={cases,rulesetVersion:RULESET_VERSION};
const validationIdentity="sha256:"+crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
process.stdout.write(JSON.stringify({
  status:"PASS",
  workflow:"first-filesystem-effect-contract-material-v1-validation-regression",
  cases:cases.length,
  validationIdentity,
  semantic
})+"\n");
