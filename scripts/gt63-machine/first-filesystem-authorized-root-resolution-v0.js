"use strict";

const crypto=require("node:crypto");

const RULESET_VERSION="first-filesystem-authorized-root-resolution-v0.1.0";
const OUTCOMES=Object.freeze({
  RESOLVED:"AUTHORIZED_ROOT_RESOLVED",
  ALREADY_RESOLVED:"AUTHORIZED_ROOT_ALREADY_RESOLVED",
  NOT_RESOLVED:"AUTHORIZED_ROOT_NOT_RESOLVED",
  UNKNOWN:"AUTHORIZED_ROOT_UNKNOWN",
  CONFLICT:"AUTHORIZED_ROOT_CONFLICT",
  INVALID:"AUTHORIZED_ROOT_INVALID"
});

const EXPECTED=Object.freeze({
  effectContractRef:"gt63-machine:effect-contract:first-filesystem-create-file-v1",
  authorizedRootIdentity:"GT63_FIRST_EFFECT_TEST/",
  targetKind:"RELATIVE_FILE",
  targetPath:"GT63_FIRST_OPERATION.txt"
});

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
function stringify(v){return JSON.stringify(canonical(v));}
function digest(v){return "sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");}
function isAbsoluteLike(p){return /^[A-Za-z]:[\\/]/.test(p)||p.startsWith("/")||p.startsWith("\\");}
function hasTraversal(p){return p.split(/[\\/]+/).some(x=>x==="..");}
function strictDescendant(root,target){
  if(!nonEmpty(root)||!nonEmpty(target)) return false;
  if(isAbsoluteLike(target)||hasTraversal(target)) return false;
  const cleanRoot=root.replace(/[\\/]+$/,"");
  const resolved=cleanRoot+"/"+target.replace(/^[\\/]+/,"");
  return resolved!==cleanRoot && resolved.startsWith(cleanRoot+"/");
}
function result(outcome,reason=null,resolution=null){return freeze({
  outcome,reason,resolution:clone(resolution),
  authorityEffect:"NONE",
  filesystemToolAuthority:false,
  effectPerformed:false
});}

function createFirstFilesystemAuthorizedRootResolutionV0({
  exactEffectAuthorizationPort,
  rootRegistryPort,
  filesystemObservationPort,
  resolutionLedger
}={}){
  for(const [n,p] of Object.entries({exactEffectAuthorizationPort,rootRegistryPort,filesystemObservationPort})){
    if(typeof p!=="function") throw new TypeError(n+" must be a function");
  }
  for(const n of ["findByAuthorizationId","commit"]){
    if(!resolutionLedger||typeof resolutionLedger[n]!=="function") throw new TypeError("resolutionLedger."+n+" must be a function");
  }

  function resolve(request){
    const fields=["rulesetVersion","exactEffectAuthorizationId","authorizedRootIdentity"];
    if(!plain(request)||Object.keys(request).sort().join("|")!==fields.sort().join("|")
      ||request.rulesetVersion!==RULESET_VERSION
      ||!nonEmpty(request.exactEffectAuthorizationId)
      ||request.authorizedRootIdentity!==EXPECTED.authorizedRootIdentity){
      return result(OUTCOMES.INVALID,"unsupported request schema or root identity");
    }

    let auth;
    try{auth=exactEffectAuthorizationPort({authorizationId:request.exactEffectAuthorizationId});}
    catch(_){return result(OUTCOMES.UNKNOWN,"exact effect authorization unavailable");}
    if(!plain(auth)
      ||auth.authorizationId!==request.exactEffectAuthorizationId
      ||auth.authorizationState!=="AUTHORIZED"
      ||auth.effectContractRef!==EXPECTED.effectContractRef
      ||auth.authorizedRootIdentity!==EXPECTED.authorizedRootIdentity
      ||!plain(auth.target)||auth.target.kind!==EXPECTED.targetKind||auth.target.path!==EXPECTED.targetPath
      ||auth.authorityEffect!=="NONE"
      ||auth.authorizedRootResolved!==false
      ||auth.filesystemToolAuthority!==false
      ||auth.effectPerformed!==false){
      return result(OUTCOMES.UNKNOWN,"exact effect authorization invalid or widened");
    }

    let reg;
    try{reg=rootRegistryPort({authorizedRootIdentity:request.authorizedRootIdentity});}
    catch(_){return result(OUTCOMES.UNKNOWN,"authorized root registry unavailable");}
    if(!plain(reg)
      ||reg.authorizedRootIdentity!==EXPECTED.authorizedRootIdentity
      ||!nonEmpty(reg.rootPath)
      ||reg.lifecycleState!=="CURRENT"
      ||reg.freshnessState!=="CURRENT"
      ||reg.contradictionState!=="NONE"
      ||reg.authorityEffect!=="NONE"){
      return result(OUTCOMES.UNKNOWN,"authorized root registry invalid or non-current");
    }

    if(!strictDescendant(reg.rootPath,EXPECTED.targetPath)){
      return result(OUTCOMES.NOT_RESOLVED,"target is not a strict descendant of authorized root");
    }

    let obs;
    try{obs=filesystemObservationPort({rootPath:reg.rootPath,targetPath:EXPECTED.targetPath});}
    catch(_){return result(OUTCOMES.UNKNOWN,"filesystem root observation unavailable");}
    if(!plain(obs)
      ||obs.rootPath!==reg.rootPath
      ||obs.rootExists!==true
      ||obs.rootIsDirectory!==true
      ||obs.targetPath!==EXPECTED.targetPath
      ||obs.targetExists!==false
      ||obs.observationState!=="CURRENT"
      ||obs.contradictionState!=="NONE"
      ||obs.authorityEffect!=="NONE"){
      return result(OUTCOMES.NOT_RESOLVED,"authorized root or create-new precondition not proven");
    }

    const material={
      type:"GT63_FIRST_FILESYSTEM_AUTHORIZED_ROOT_RESOLUTION",
      schemaVersion:"1.0",
      rulesetVersion:RULESET_VERSION,
      exactEffectAuthorizationId:auth.authorizationId,
      authorizedRootIdentity:EXPECTED.authorizedRootIdentity,
      rootPath:reg.rootPath,
      target:{kind:EXPECTED.targetKind,path:EXPECTED.targetPath},
      targetMustNotExist:true,
      observedTargetExists:false,
      resolutionState:"RESOLVED",
      authorityEffect:"NONE",
      filesystemToolAuthority:false,
      effectPerformed:false
    };
    const resolutionId="gt63-resolution:first-filesystem-root:"+digest(material).slice(7);
    const resolution=freeze({resolutionId,...material});

    let prior;
    try{prior=resolutionLedger.findByAuthorizationId(auth.authorizationId);}
    catch(_){return result(OUTCOMES.UNKNOWN,"root resolution ledger unavailable");}
    if(!Array.isArray(prior)) return result(OUTCOMES.UNKNOWN,"root resolution ledger invalid");
    if(prior.length>1) return result(OUTCOMES.CONFLICT,"multiple root resolutions for authorization");
    if(prior.length===1){
      return stringify(prior[0])===stringify(resolution)
        ? result(OUTCOMES.ALREADY_RESOLVED,"same root already resolved",prior[0])
        : result(OUTCOMES.CONFLICT,"authorization already resolved to different root material");
    }

    let committed;
    try{committed=resolutionLedger.commit(resolution);}
    catch(_){return result(OUTCOMES.CONFLICT,"root resolution ledger commit conflict");}
    if(!committed||stringify(committed)!==stringify(resolution)){
      return result(OUTCOMES.CONFLICT,"root resolution ledger returned conflicting material");
    }
    return result(OUTCOMES.RESOLVED,null,committed);
  }

  return freeze({resolve,rulesetVersion:RULESET_VERSION,authorityEffect:"NONE"});
}

module.exports=Object.freeze({RULESET_VERSION,OUTCOMES,EXPECTED,strictDescendant,createFirstFilesystemAuthorizedRootResolutionV0});
