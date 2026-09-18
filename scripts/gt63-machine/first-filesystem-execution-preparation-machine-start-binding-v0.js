"use strict";

const crypto=require("node:crypto");
const RULESET_VERSION="first-filesystem-execution-preparation-machine-start-binding-v0.1.0";
const AUTHORITY="NONE";
const OUTCOMES=Object.freeze({
  BOUND:"EXECUTION_PREPARATION_MACHINE_START_BOUND",
  ALREADY_BOUND:"EXECUTION_PREPARATION_MACHINE_START_ALREADY_BOUND",
  NOT_BOUND:"EXECUTION_PREPARATION_MACHINE_START_NOT_BOUND",
  UNKNOWN:"EXECUTION_PREPARATION_MACHINE_START_UNKNOWN",
  CONFLICT:"EXECUTION_PREPARATION_MACHINE_START_CONFLICT",
  INVALID:"EXECUTION_PREPARATION_MACHINE_START_INVALID"
});

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
function stringify(v){return JSON.stringify(canonical(v));}
function digest(v){return "sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");}
function result(outcome,reason=null,binding=null){return freeze({
  outcome,reason,binding:clone(binding),authority:AUTHORITY,authorityEffect:"NONE",
  executionStarted:false,effectPerformed:false,effectVerified:false,additionalEffectAuthorized:false
});}

function createFirstFilesystemExecutionPreparationMachineStartBindingV0({
  executionPreparationPort,machineExecutionStartPort,bindingLedger
}={}){
  if(typeof executionPreparationPort!=="function")throw new TypeError("executionPreparationPort must be a function");
  if(typeof machineExecutionStartPort!=="function")throw new TypeError("machineExecutionStartPort must be a function");
  for(const n of ["findByExecutionPreparationId","commit"]){
    if(!bindingLedger||typeof bindingLedger[n]!=="function")throw new TypeError("bindingLedger."+n+" must be a function");
  }

  function bind(request){
    const fields=["rulesetVersion","executionPreparationId","executionStartId"];
    if(!plain(request)||Object.keys(request).sort().join("|")!==fields.sort().join("|")
      ||request.rulesetVersion!==RULESET_VERSION||!nonEmpty(request.executionPreparationId)||!nonEmpty(request.executionStartId)){
      return result(OUTCOMES.INVALID,"unsupported request schema");
    }

    let prep;try{prep=executionPreparationPort({executionPreparationId:request.executionPreparationId});}
    catch(_){return result(OUTCOMES.UNKNOWN,"filesystem execution preparation unavailable");}
    if(!plain(prep)
      ||prep.executionPreparationId!==request.executionPreparationId
      ||prep.type!=="GT63_FIRST_FILESYSTEM_EFFECT_EXECUTION_GATEWAY"
      ||prep.executionState!=="READY"
      ||prep.operation!=="CREATE_NEW_FILE"
      ||prep.mustNotExist!==true
      ||prep.authorityEffect!=="NONE"
      ||prep.effectPerformed!==false
      ||prep.effectVerified!==false
      ||!nonEmpty(prep.rootPath)||!nonEmpty(prep.relativeTargetPath)
      ||!nonEmpty(prep.toolAuthorityId)||!nonEmpty(prep.exactEffectAuthorizationId)||!nonEmpty(prep.rootResolutionId)){
      return result(OUTCOMES.UNKNOWN,"filesystem execution preparation invalid");
    }

    let start;try{start=machineExecutionStartPort({executionStartId:request.executionStartId});}
    catch(_){return result(OUTCOMES.UNKNOWN,"machine execution start unavailable");}
    if(!plain(start)
      ||start.executionStartId!==request.executionStartId
      ||start.type!=="GT63_BOUNDED_CONTINUATION_EXECUTION_START"
      ||start.startState!=="PERMITTED"
      ||start.executionStartPermitted!==true
      ||start.executionStarted!==false
      ||start.continuationExecuted!==false
      ||start.effectPerformed!==false
      ||start.effectVerified!==false
      ||start.authority!==AUTHORITY
      ||!nonEmpty(start.executionTargetRef)){
      return result(OUTCOMES.UNKNOWN,"machine execution start invalid");
    }

    if(start.executionTargetRef!==prep.executionPreparationId){
      return result(OUTCOMES.NOT_BOUND,"machine execution target does not exactly reference filesystem execution preparation");
    }

    const material={
      type:"GT63_FIRST_FILESYSTEM_EXECUTION_PREPARATION_MACHINE_START_BINDING",
      schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,
      executionPreparationId:prep.executionPreparationId,
      executionStartId:start.executionStartId,
      executionTargetRef:start.executionTargetRef,
      toolAuthorityId:prep.toolAuthorityId,
      exactEffectAuthorizationId:prep.exactEffectAuthorizationId,
      rootResolutionId:prep.rootResolutionId,
      operation:prep.operation,
      rootPath:prep.rootPath,
      relativeTargetPath:prep.relativeTargetPath,
      bindingState:"BOUND",
      authority:AUTHORITY,authorityEffect:"NONE",
      executionStarted:false,effectPerformed:false,effectVerified:false,
      additionalEffectAuthorized:false
    };
    const binding=freeze({
      executionPreparationMachineStartBindingId:"gt63-binding:first-filesystem-execution-start:"+digest(material).slice(7),
      ...material
    });

    let prior;try{prior=bindingLedger.findByExecutionPreparationId(prep.executionPreparationId);}
    catch(_){return result(OUTCOMES.UNKNOWN,"binding ledger unavailable");}
    if(!Array.isArray(prior))return result(OUTCOMES.UNKNOWN,"binding ledger invalid");
    if(prior.length>1)return result(OUTCOMES.CONFLICT,"multiple bindings for filesystem execution preparation");
    if(prior.length===1){
      return stringify(prior[0])===stringify(binding)
        ?result(OUTCOMES.ALREADY_BOUND,"same exact binding already accepted",prior[0])
        :result(OUTCOMES.CONFLICT,"filesystem execution preparation already has different machine start binding");
    }
    let committed;try{committed=bindingLedger.commit(binding);}
    catch(_){return result(OUTCOMES.CONFLICT,"binding ledger commit conflict");}
    if(!committed||stringify(committed)!==stringify(binding))return result(OUTCOMES.CONFLICT,"binding ledger returned conflicting material");
    return result(OUTCOMES.BOUND,null,committed);
  }
  return freeze({bind,rulesetVersion:RULESET_VERSION,authority:AUTHORITY,authorityEffect:"NONE"});
}

module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createFirstFilesystemExecutionPreparationMachineStartBindingV0});
