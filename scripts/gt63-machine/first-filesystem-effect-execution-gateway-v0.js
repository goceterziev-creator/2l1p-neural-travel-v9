"use strict";

const crypto=require("node:crypto");
const RULESET_VERSION="first-filesystem-effect-execution-gateway-v0.1.0";
const OUTCOMES=Object.freeze({
  READY:"EFFECT_EXECUTION_READY",
  ALREADY_READY:"EFFECT_EXECUTION_ALREADY_READY",
  NOT_READY:"EFFECT_EXECUTION_NOT_READY",
  UNKNOWN:"EFFECT_EXECUTION_UNKNOWN",
  CONFLICT:"EFFECT_EXECUTION_CONFLICT",
  INVALID:"EFFECT_EXECUTION_INVALID"
});

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
function stringify(v){return JSON.stringify(canonical(v));}
function digest(v){return "sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");}
function result(outcome,reason=null,execution=null){return freeze({
  outcome,reason,execution:clone(execution),
  authorityEffect:"NONE",
  effectPerformed:false,
  effectVerified:false
});}

function createFirstFilesystemEffectExecutionGatewayV0({
  toolAuthorityPort,
  exactEffectAuthorizationPort,
  rootResolutionPort,
  executionLedger
}={}){
  for(const [n,p] of Object.entries({toolAuthorityPort,exactEffectAuthorizationPort,rootResolutionPort})){
    if(typeof p!=="function") throw new TypeError(n+" must be a function");
  }
  for(const n of ["findByToolAuthorityId","commit"]){
    if(!executionLedger||typeof executionLedger[n]!=="function") throw new TypeError("executionLedger."+n+" must be a function");
  }

  function prepare(request){
    const fields=["rulesetVersion","toolAuthorityId","exactEffectAuthorizationId","rootResolutionId"];
    if(!plain(request)||Object.keys(request).sort().join("|")!==fields.sort().join("|")
      ||request.rulesetVersion!==RULESET_VERSION
      ||!nonEmpty(request.toolAuthorityId)
      ||!nonEmpty(request.exactEffectAuthorizationId)
      ||!nonEmpty(request.rootResolutionId)){
      return result(OUTCOMES.INVALID,"unsupported request schema");
    }

    let tool;try{tool=toolAuthorityPort({toolAuthorityId:request.toolAuthorityId});}
    catch(_){return result(OUTCOMES.UNKNOWN,"filesystem tool authority unavailable");}
    if(!plain(tool)
      ||tool.toolAuthorityId!==request.toolAuthorityId
      ||tool.toolAuthorityState!=="AUTHORIZED"
      ||tool.exactEffectAuthorizationId!==request.exactEffectAuthorizationId
      ||tool.rootResolutionId!==request.rootResolutionId
      ||tool.capability!=="CREATE_NEW_FILE"
      ||tool.authorityEffect!=="NONE"
      ||tool.effectPerformed!==false
      ||!plain(tool.scope)
      ||tool.scope.operation!=="CREATE_NEW_FILE"
      ||tool.scope.overwriteAllowed!==false
      ||tool.scope.deleteAllowed!==false
      ||tool.scope.renameAllowed!==false
      ||tool.scope.arbitraryPathAllowed!==false){
      return result(OUTCOMES.NOT_READY,"tool authority invalid or widened");
    }

    let auth;try{auth=exactEffectAuthorizationPort({authorizationId:request.exactEffectAuthorizationId});}
    catch(_){return result(OUTCOMES.UNKNOWN,"exact effect authorization unavailable");}
    if(!plain(auth)
      ||auth.authorizationId!==request.exactEffectAuthorizationId
      ||auth.authorizationState!=="AUTHORIZED"
      ||auth.operation!=="CREATE_NEW_FILE"
      ||auth.effectPerformed!==false
      ||auth.authorityEffect!=="NONE"){
      return result(OUTCOMES.NOT_READY,"exact effect authorization invalid");
    }

    let root;try{root=rootResolutionPort({resolutionId:request.rootResolutionId});}
    catch(_){return result(OUTCOMES.UNKNOWN,"root resolution unavailable");}
    if(!plain(root)
      ||root.resolutionId!==request.rootResolutionId
      ||root.exactEffectAuthorizationId!==auth.authorizationId
      ||root.resolutionState!=="RESOLVED"
      ||root.rootPath!==tool.rootPath
      ||!plain(root.target)
      ||root.target.path!==tool.scope.relativeTargetPath
      ||root.target.kind!=="RELATIVE_FILE"
      ||root.targetMustNotExist!==true
      ||root.observedTargetExists!==false
      ||root.effectPerformed!==false
      ||root.authorityEffect!=="NONE"){
      return result(OUTCOMES.NOT_READY,"root resolution does not prove create-new precondition");
    }

    const material={
      type:"GT63_FIRST_FILESYSTEM_EFFECT_EXECUTION_GATEWAY",
      schemaVersion:"1.0",
      rulesetVersion:RULESET_VERSION,
      toolAuthorityId:tool.toolAuthorityId,
      exactEffectAuthorizationId:auth.authorizationId,
      rootResolutionId:root.resolutionId,
      operation:"CREATE_NEW_FILE",
      rootPath:root.rootPath,
      relativeTargetPath:root.target.path,
      payloadEncoding:auth.payload.encoding,
      payloadBytesBase64:auth.payload.bytesBase64,
      payloadDigest:auth.payload.digest,
      mustNotExist:true,
      executionState:"READY",
      authorityEffect:"NONE",
      effectPerformed:false,
      effectVerified:false
    };
    const executionPreparationId="gt63-execution:first-filesystem:"+digest(material).slice(7);
    const execution=freeze({executionPreparationId,...material});

    let prior;try{prior=executionLedger.findByToolAuthorityId(tool.toolAuthorityId);}
    catch(_){return result(OUTCOMES.UNKNOWN,"execution gateway ledger unavailable");}
    if(!Array.isArray(prior)) return result(OUTCOMES.UNKNOWN,"execution gateway ledger invalid");
    if(prior.length>1) return result(OUTCOMES.CONFLICT,"multiple execution preparations for tool authority");
    if(prior.length===1){
      return stringify(prior[0])===stringify(execution)
        ? result(OUTCOMES.ALREADY_READY,"same exact execution already prepared",prior[0])
        : result(OUTCOMES.CONFLICT,"tool authority already prepared with different execution material");
    }

    let committed;try{committed=executionLedger.commit(execution);}
    catch(_){return result(OUTCOMES.CONFLICT,"execution gateway ledger commit conflict");}
    if(!committed||stringify(committed)!==stringify(execution)){
      return result(OUTCOMES.CONFLICT,"execution gateway ledger returned conflicting material");
    }
    return result(OUTCOMES.READY,null,committed);
  }

  return freeze({prepare,rulesetVersion:RULESET_VERSION,authorityEffect:"NONE"});
}

module.exports=Object.freeze({RULESET_VERSION,OUTCOMES,createFirstFilesystemEffectExecutionGatewayV0});
