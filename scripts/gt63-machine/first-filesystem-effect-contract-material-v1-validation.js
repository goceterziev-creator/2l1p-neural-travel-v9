"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "first-filesystem-effect-contract-material-v1-validation-v0.1.0";
const EXPECTED = Object.freeze({
  type: "GT63_FIRST_FILESYSTEM_EFFECT_CONTRACT_MATERIAL",
  schemaVersion: "1.0",
  materialRevision: 1,
  materialIdentity: "gt63-machine:effect-contract-material:first-filesystem-create-file-v1@1",
  operation: "CREATE_NEW_FILE",
  authorizedRootIdentity: "GT63_FIRST_EFFECT_TEST/",
  targetKind: "RELATIVE_FILE",
  targetPath: "GT63_FIRST_OPERATION.txt",
  payloadEncoding: "UTF-8",
  payloadBase64: "SGVsbG8gZnJvbSBHVDYz",
  payloadDigest: "sha256:241d88cea11b71564b4aa1597ecf6cc49cb06a3dca4044d0afddd9ca2116f3f9",
  effectContractDigest: "sha256:2d1f3d534c4989a1f6f4ec86f7bd3446a79fc20999507f3d5ad42e8e91b851b1"
});

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function canonical(v){
  if(Array.isArray(v)) return v.map(canonical);
  if(plain(v)) return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});
  return v;
}
function canonicalStringify(v){return JSON.stringify(canonical(v));}
function sha256Bytes(bytes){return "sha256:"+crypto.createHash("sha256").update(bytes).digest("hex");}
function sha256Value(v){return sha256Bytes(Buffer.from(canonicalStringify(v),"utf8"));}
function strictBase64(s){
  if(!nonEmpty(s)||s.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
  const b=Buffer.from(s,"base64");
  return b.toString("base64")===s?b:null;
}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function deepFreeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))deepFreeze(x);}return v;}
function result(state,reason=null,details=null){return deepFreeze({state,reason,details:clone(details),authorityEffect:"NONE"});}

function validateFirstFilesystemEffectContractMaterialV1(material){
  if(!plain(material)) return result("INVALID","material must be an object");
  if(material.type!==EXPECTED.type||material.schemaVersion!==EXPECTED.schemaVersion
    ||material.materialRevision!==EXPECTED.materialRevision||material.materialIdentity!==EXPECTED.materialIdentity)
    return result("INVALID","material identity/schema mismatch");

  if(!plain(material.provenance)
    ||material.provenance.materializationKind!=="RE_MATERIALIZED_FROM_PREVIOUSLY_HUMAN_APPROVED_EXACT_SEMANTIC_CONTRACT"
    ||material.provenance.recoveredHistoricalArtifact!==false
    ||material.provenance.historicalArtifactIdentityClaimed!==false)
    return result("INVALID","re-materialization provenance mismatch");

  const e=material.effectContract;
  if(!plain(e)
    ||e.effectContractRef!=="gt63-machine:effect-contract:first-filesystem-create-file-v1"
    ||e.effectContractRevision!==1
    ||e.operation!==EXPECTED.operation
    ||e.authorizedRootIdentity!==EXPECTED.authorizedRootIdentity
    ||!plain(e.target)||e.target.kind!==EXPECTED.targetKind||e.target.path!==EXPECTED.targetPath
    ||!plain(e.payload)||e.payload.encoding!==EXPECTED.payloadEncoding||e.payload.bytesBase64!==EXPECTED.payloadBase64
    ||!plain(e.precondition)||e.precondition.mustNotExist!==true
    ||!plain(e.expectedPostcondition)||e.expectedPostcondition.fileExists!==true
    ||e.expectedPostcondition.contentDigest!==EXPECTED.payloadDigest)
    return result("INVALID","effect semantics mismatch");

  const payloadBytes=strictBase64(e.payload.bytesBase64);
  if(!payloadBytes||payloadBytes.toString("utf8")!=="Hello from GT63")
    return result("INVALID","payload bytes invalid");
  if(sha256Bytes(payloadBytes)!==EXPECTED.payloadDigest)
    return result("INVALID","payload digest mismatch");

  const semanticMaterial={
    operation:e.operation,
    target:{kind:e.target.kind,path:e.target.path},
    payload:{encoding:e.payload.encoding,bytesBase64:e.payload.bytesBase64},
    precondition:{mustNotExist:e.precondition.mustNotExist},
    expectedPostcondition:{
      fileExists:e.expectedPostcondition.fileExists,
      contentDigest:e.expectedPostcondition.contentDigest
    }
  };
  const computedEffectContractDigest=sha256Value(semanticMaterial);
  if(computedEffectContractDigest!==EXPECTED.effectContractDigest
    ||material.expectedEffectContractDigest!==EXPECTED.effectContractDigest)
    return result("INVALID","effect contract digest mismatch",{computedEffectContractDigest});

  if(material.materialState!=="CANDIDATE_RE_MATERIALIZED_NOT_ACCEPTED"
    ||material.authorityEffect!=="NONE"
    ||!plain(material.nonClaims)
    ||material.nonClaims.recoveredHistoricalArtifact!==false
    ||material.nonClaims.sourceBound!==false
    ||material.nonClaims.materialAccepted!==false
    ||material.nonClaims.effectAuthorized!==false
    ||material.nonClaims.authorizedRootResolved!==false
    ||material.nonClaims.filesystemToolAuthority!==false
    ||material.nonClaims.effectPerformed!==false
    ||material.nonClaims.machineAuthority!==false)
    return result("INVALID","authority/non-claim boundary mismatch");

  return result("VALID",null,{
    payloadByteLength:payloadBytes.length,
    payloadDigest:EXPECTED.payloadDigest,
    effectContractDigest:computedEffectContractDigest,
    historicalArtifactRecovered:false
  });
}

module.exports=Object.freeze({RULESET_VERSION,EXPECTED,validateFirstFilesystemEffectContractMaterialV1});
