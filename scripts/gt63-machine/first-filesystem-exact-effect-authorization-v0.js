"use strict";

const crypto=require("node:crypto");

const RULESET_VERSION="first-filesystem-exact-effect-authorization-v0.1.0";
const OUTCOMES=Object.freeze({
  AUTHORIZED:"EXACT_EFFECT_AUTHORIZED",
  ALREADY_AUTHORIZED:"EXACT_EFFECT_ALREADY_AUTHORIZED",
  NOT_AUTHORIZED:"EXACT_EFFECT_NOT_AUTHORIZED",
  STALE:"EXACT_EFFECT_AUTHORIZATION_STALE",
  UNKNOWN:"EXACT_EFFECT_AUTHORIZATION_UNKNOWN",
  CONFLICT:"EXACT_EFFECT_AUTHORIZATION_CONFLICT",
  INVALID:"EXACT_EFFECT_AUTHORIZATION_INVALID"
});

const EXPECTED=Object.freeze({
  effectContractRef:"gt63-machine:effect-contract:first-filesystem-create-file-v1",
  effectContractRevision:1,
  materialIdentity:"gt63-machine:effect-contract-material:first-filesystem-create-file-v1@1",
  effectContractDigest:"sha256:2d1f3d534c4989a1f6f4ec86f7bd3446a79fc20999507f3d5ad42e8e91b851b1",
  operation:"CREATE_NEW_FILE",
  authorizedRootIdentity:"GT63_FIRST_EFFECT_TEST/",
  targetKind:"RELATIVE_FILE",
  targetPath:"GT63_FIRST_OPERATION.txt",
  payloadEncoding:"UTF-8",
  payloadBase64:"SGVsbG8gZnJvbSBHVDYz",
  payloadDigest:"sha256:241d88cea11b71564b4aa1597ecf6cc49cb06a3dca4044d0afddd9ca2116f3f9"
});

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
function stringify(v){return JSON.stringify(canonical(v));}
function digest(v){return "sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");}
function result(outcome,reason=null,authorization=null){return freeze({
  outcome,reason,authorization:clone(authorization),
  authorityEffect:"NONE",
  authorizedRootResolved:false,
  filesystemToolAuthority:false,
  effectPerformed:false
});}

function createFirstFilesystemExactEffectAuthorizationV0({
  materialValidationPort,
  aClassMaterialAcceptancePort,
  humanEffectDecisionPort,
  authorizationLedger
}={}){
  for(const [name,port] of Object.entries({materialValidationPort,aClassMaterialAcceptancePort,humanEffectDecisionPort})){
    if(typeof port!=="function") throw new TypeError(name+" must be a function");
  }
  for(const name of ["findByEffectContractRef","commit"]){
    if(!authorizationLedger||typeof authorizationLedger[name]!=="function") throw new TypeError("authorizationLedger."+name+" must be a function");
  }

  function authorize(request){
    const fields=["rulesetVersion","effectContractRef","effectContractRevision","expectedMaterialIdentity","expectedEffectContractDigest","aClassAcceptanceId","humanEffectDecisionEvidenceRef"];
    if(!plain(request)||Object.keys(request).sort().join("|")!==fields.sort().join("|")
      ||request.rulesetVersion!==RULESET_VERSION
      ||request.effectContractRef!==EXPECTED.effectContractRef
      ||request.effectContractRevision!==EXPECTED.effectContractRevision
      ||request.expectedMaterialIdentity!==EXPECTED.materialIdentity
      ||request.expectedEffectContractDigest!==EXPECTED.effectContractDigest
      ||!nonEmpty(request.aClassAcceptanceId)
      ||!nonEmpty(request.humanEffectDecisionEvidenceRef)){
      return result(OUTCOMES.INVALID,"unsupported request schema or exact effect subject");
    }

    let material;
    try{material=materialValidationPort({effectContractRef:request.effectContractRef,effectContractRevision:request.effectContractRevision});}
    catch(_){return result(OUTCOMES.UNKNOWN,"validated effect material unavailable");}
    if(!plain(material)
      ||material.validationState!=="VALID"
      ||material.materialIdentity!==EXPECTED.materialIdentity
      ||material.effectContractRef!==EXPECTED.effectContractRef
      ||material.effectContractRevision!==EXPECTED.effectContractRevision
      ||material.effectContractDigest!==EXPECTED.effectContractDigest
      ||material.operation!==EXPECTED.operation
      ||material.authorizedRootIdentity!==EXPECTED.authorizedRootIdentity
      ||material.targetKind!==EXPECTED.targetKind
      ||material.targetPath!==EXPECTED.targetPath
      ||material.payloadEncoding!==EXPECTED.payloadEncoding
      ||material.payloadBase64!==EXPECTED.payloadBase64
      ||material.payloadDigest!==EXPECTED.payloadDigest
      ||material.mustNotExist!==true
      ||material.fileExistsPostcondition!==true
      ||material.authorityEffect!=="NONE"){
      return result(OUTCOMES.UNKNOWN,"exact validated effect material not established");
    }

    let accepted;
    try{accepted=aClassMaterialAcceptancePort({acceptanceId:request.aClassAcceptanceId});}
    catch(_){return result(OUTCOMES.UNKNOWN,"A-class material acceptance unavailable");}
    if(!plain(accepted)
      ||accepted.acceptanceId!==request.aClassAcceptanceId
      ||accepted.type!=="GT63_A_CLASS_MATERIAL_ACCEPTANCE"
      ||accepted.acceptanceState!=="ACCEPTED"
      ||accepted.authorityEffect!=="NONE"){
      return result(OUTCOMES.UNKNOWN,"A-class material acceptance invalid or unavailable");
    }

    let human;
    try{human=humanEffectDecisionPort({humanEffectDecisionEvidenceRef:request.humanEffectDecisionEvidenceRef});}
    catch(_){return result(OUTCOMES.UNKNOWN,"human exact-effect decision evidence unavailable");}
    if(!plain(human)
      ||human.humanEffectDecisionEvidenceRef!==request.humanEffectDecisionEvidenceRef
      ||human.decision!=="APPROVE"
      ||human.effectContractRef!==EXPECTED.effectContractRef
      ||human.effectContractRevision!==EXPECTED.effectContractRevision
      ||human.effectContractDigest!==EXPECTED.effectContractDigest
      ||human.materialIdentity!==EXPECTED.materialIdentity
      ||human.lifecycleState!=="CURRENT"
      ||human.freshnessState!=="CURRENT"
      ||human.contradictionState!=="NONE"
      ||human.authorityEffect!=="NONE"){
      return result(OUTCOMES.NOT_AUTHORIZED,"human decision does not approve exact current effect contract");
    }

    const authMaterial={
      type:"GT63_FIRST_FILESYSTEM_EXACT_EFFECT_AUTHORIZATION",
      schemaVersion:"1.0",
      rulesetVersion:RULESET_VERSION,
      effectContractRef:EXPECTED.effectContractRef,
      effectContractRevision:EXPECTED.effectContractRevision,
      materialIdentity:EXPECTED.materialIdentity,
      effectContractDigest:EXPECTED.effectContractDigest,
      operation:EXPECTED.operation,
      authorizedRootIdentity:EXPECTED.authorizedRootIdentity,
      target:{kind:EXPECTED.targetKind,path:EXPECTED.targetPath},
      payload:{encoding:EXPECTED.payloadEncoding,bytesBase64:EXPECTED.payloadBase64,digest:EXPECTED.payloadDigest},
      precondition:{mustNotExist:true},
      expectedPostcondition:{fileExists:true,contentDigest:EXPECTED.payloadDigest},
      aClassAcceptanceId:accepted.acceptanceId,
      humanEffectDecisionEvidenceRef:human.humanEffectDecisionEvidenceRef,
      authorizationState:"AUTHORIZED",
      authorityEffect:"NONE",
      authorizedRootResolved:false,
      filesystemToolAuthority:false,
      effectPerformed:false
    };
    const authorizationId="gt63-authorization:first-filesystem-exact-effect:"+digest(authMaterial).slice(7);
    const authorization=freeze({authorizationId,...authMaterial});

    let prior;
    try{prior=authorizationLedger.findByEffectContractRef(EXPECTED.effectContractRef);}
    catch(_){return result(OUTCOMES.UNKNOWN,"authorization ledger unavailable");}
    if(!Array.isArray(prior)) return result(OUTCOMES.UNKNOWN,"authorization ledger invalid");
    if(prior.length>1) return result(OUTCOMES.CONFLICT,"multiple authorizations for exact effect contract");
    if(prior.length===1){
      return stringify(prior[0])===stringify(authorization)
        ? result(OUTCOMES.ALREADY_AUTHORIZED,"same exact effect already authorized",prior[0])
        : result(OUTCOMES.CONFLICT,"effect contract already authorized with different material");
    }

    let committed;
    try{committed=authorizationLedger.commit(authorization);}
    catch(_){return result(OUTCOMES.CONFLICT,"authorization ledger commit conflict");}
    if(!committed||stringify(committed)!==stringify(authorization)){
      return result(OUTCOMES.CONFLICT,"authorization ledger returned conflicting material");
    }
    return result(OUTCOMES.AUTHORIZED,null,committed);
  }

  return freeze({authorize,rulesetVersion:RULESET_VERSION,authorityEffect:"NONE"});
}

module.exports=Object.freeze({RULESET_VERSION,OUTCOMES,EXPECTED,createFirstFilesystemExactEffectAuthorizationV0});
