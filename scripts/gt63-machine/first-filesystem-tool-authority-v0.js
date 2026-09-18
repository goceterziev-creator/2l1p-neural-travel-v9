"use strict";

const crypto=require("node:crypto");

const RULESET_VERSION="first-filesystem-tool-authority-v0.1.0";
const OUTCOMES=Object.freeze({
  AUTHORIZED:"FILESYSTEM_TOOL_AUTHORIZED",
  ALREADY_AUTHORIZED:"FILESYSTEM_TOOL_ALREADY_AUTHORIZED",
  NOT_AUTHORIZED:"FILESYSTEM_TOOL_NOT_AUTHORIZED",
  UNKNOWN:"FILESYSTEM_TOOL_AUTHORITY_UNKNOWN",
  CONFLICT:"FILESYSTEM_TOOL_AUTHORITY_CONFLICT",
  INVALID:"FILESYSTEM_TOOL_AUTHORITY_INVALID"
});

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
function stringify(v){return JSON.stringify(canonical(v));}
function digest(v){return "sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");}
function result(outcome,reason=null,authority=null){return freeze({outcome,reason,toolAuthority:clone(authority),authorityEffect:"NONE",effectPerformed:false});}

function createFirstFilesystemToolAuthorityV0({
  exactEffectAuthorizationPort,
  rootResolutionPort,
  adapterRegistryPort,
  authorityLedger
}={}){
  for(const [n,p] of Object.entries({exactEffectAuthorizationPort,rootResolutionPort,adapterRegistryPort})){
    if(typeof p!=="function") throw new TypeError(n+" must be a function");
  }
  for(const n of ["findByAuthorizationId","commit"]){
    if(!authorityLedger||typeof authorityLedger[n]!=="function") throw new TypeError("authorityLedger."+n+" must be a function");
  }

  function authorize(request){
    const fields=["rulesetVersion","exactEffectAuthorizationId","rootResolutionId","adapterRef","adapterRevision"];
    if(!plain(request)||Object.keys(request).sort().join("|")!==fields.sort().join("|")
      ||request.rulesetVersion!==RULESET_VERSION
      ||!nonEmpty(request.exactEffectAuthorizationId)||!nonEmpty(request.rootResolutionId)
      ||!nonEmpty(request.adapterRef)||!nonEmpty(request.adapterRevision)){
      return result(OUTCOMES.INVALID,"unsupported request schema");
    }

    let auth;try{auth=exactEffectAuthorizationPort({authorizationId:request.exactEffectAuthorizationId});}
    catch(_){return result(OUTCOMES.UNKNOWN,"exact effect authorization unavailable");}
    if(!plain(auth)||auth.authorizationId!==request.exactEffectAuthorizationId||auth.authorizationState!=="AUTHORIZED"
      ||auth.authorityEffect!=="NONE"||auth.effectPerformed!==false){
      return result(OUTCOMES.UNKNOWN,"exact effect authorization invalid");
    }

    let root;try{root=rootResolutionPort({resolutionId:request.rootResolutionId});}
    catch(_){return result(OUTCOMES.UNKNOWN,"root resolution unavailable");}
    if(!plain(root)||root.resolutionId!==request.rootResolutionId||root.exactEffectAuthorizationId!==auth.authorizationId
      ||root.resolutionState!=="RESOLVED"||root.authorityEffect!=="NONE"
      ||root.filesystemToolAuthority!==false||root.effectPerformed!==false){
      return result(OUTCOMES.NOT_AUTHORIZED,"root resolution does not bind exact authorization");
    }

    let adapter;try{adapter=adapterRegistryPort({adapterRef:request.adapterRef,adapterRevision:request.adapterRevision});}
    catch(_){return result(OUTCOMES.UNKNOWN,"filesystem adapter registry unavailable");}
    if(!plain(adapter)||adapter.adapterRef!==request.adapterRef||adapter.adapterRevision!==request.adapterRevision
      ||adapter.capability!=="CREATE_NEW_FILE"
      ||adapter.lifecycleState!=="CURRENT"||adapter.freshnessState!=="CURRENT"
      ||adapter.contradictionState!=="NONE"||adapter.authorityEffect!=="NONE"){
      return result(OUTCOMES.NOT_AUTHORIZED,"filesystem adapter is not exact/current");
    }

    const material={
      type:"GT63_FIRST_FILESYSTEM_TOOL_AUTHORITY",
      schemaVersion:"1.0",
      rulesetVersion:RULESET_VERSION,
      exactEffectAuthorizationId:auth.authorizationId,
      rootResolutionId:root.resolutionId,
      adapterRef:adapter.adapterRef,
      adapterRevision:adapter.adapterRevision,
      capability:"CREATE_NEW_FILE",
      rootPath:root.rootPath,
      target:clone(root.target),
      toolAuthorityState:"AUTHORIZED",
      scope:{
        operation:"CREATE_NEW_FILE",
        rootPath:root.rootPath,
        relativeTargetPath:root.target.path,
        overwriteAllowed:false,
        deleteAllowed:false,
        renameAllowed:false,
        arbitraryPathAllowed:false
      },
      authorityEffect:"NONE",
      effectPerformed:false
    };
    const toolAuthorityId="gt63-authority:first-filesystem-tool:"+digest(material).slice(7);
    const authority=freeze({toolAuthorityId,...material});

    let prior;try{prior=authorityLedger.findByAuthorizationId(auth.authorizationId);}
    catch(_){return result(OUTCOMES.UNKNOWN,"tool authority ledger unavailable");}
    if(!Array.isArray(prior)) return result(OUTCOMES.UNKNOWN,"tool authority ledger invalid");
    if(prior.length>1) return result(OUTCOMES.CONFLICT,"multiple tool authorities for exact effect authorization");
    if(prior.length===1){
      return stringify(prior[0])===stringify(authority)
        ? result(OUTCOMES.ALREADY_AUTHORIZED,"same bounded tool authority already accepted",prior[0])
        : result(OUTCOMES.CONFLICT,"exact effect authorization already has different tool authority");
    }

    let committed;try{committed=authorityLedger.commit(authority);}
    catch(_){return result(OUTCOMES.CONFLICT,"tool authority ledger commit conflict");}
    if(!committed||stringify(committed)!==stringify(authority)){
      return result(OUTCOMES.CONFLICT,"tool authority ledger returned conflicting material");
    }
    return result(OUTCOMES.AUTHORIZED,null,committed);
  }

  return freeze({authorize,rulesetVersion:RULESET_VERSION,authorityEffect:"NONE"});
}

module.exports=Object.freeze({RULESET_VERSION,OUTCOMES,createFirstFilesystemToolAuthorityV0});
