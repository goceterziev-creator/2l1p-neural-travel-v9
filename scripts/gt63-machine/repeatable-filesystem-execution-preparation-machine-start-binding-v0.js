"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="repeatable-filesystem-execution-preparation-machine-start-binding-v0.1.0",AUTHORITY="NONE";
const OUTCOMES=Object.freeze({BOUND:"BOUND",ALREADY_BOUND:"ALREADY_BOUND",NOT_BOUND:"NOT_BOUND",UNKNOWN:"UNKNOWN",CONFLICT:"CONFLICT",INVALID:"INVALID"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v)),nonEmpty=v=>typeof v==="string"&&v.length>0,clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
const stringify=v=>JSON.stringify(canonical(v)),digest=v=>"sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");
const result=(outcome,reason=null,binding=null)=>Object.freeze({outcome,reason,binding:clone(binding),authority:AUTHORITY,authorityEffect:"NONE",executionStarted:false,effectPerformed:false,effectVerified:false,additionalEffectAuthorized:false});
function createRepeatableFilesystemExecutionPreparationMachineStartBindingV0({executionPreparationPort,machineExecutionStartPort,bindingLedger}={}){
 if(typeof executionPreparationPort!=="function"||typeof machineExecutionStartPort!=="function")throw new TypeError("ports required");
 if(!bindingLedger||typeof bindingLedger.findByExecutionPreparationId!=="function"||typeof bindingLedger.commit!=="function")throw new TypeError("bindingLedger required");
 function bind(req){
  if(!plain(req)||Object.keys(req).sort().join("|")!==["rulesetVersion","executionPreparationId","executionStartId"].sort().join("|")||req.rulesetVersion!==RULESET_VERSION||!nonEmpty(req.executionPreparationId)||!nonEmpty(req.executionStartId))return result(OUTCOMES.INVALID,"unsupported request schema");
  let p;try{p=executionPreparationPort({executionPreparationId:req.executionPreparationId});}catch(_){return result(OUTCOMES.UNKNOWN,"preparation unavailable");}
  if(!plain(p)||p.executionPreparationId!==req.executionPreparationId||p.type!=="GT63_REPEATABLE_FILESYSTEM_EFFECT_EXECUTION_PREPARATION"||p.executionState!=="READY"||p.operation!=="CREATE_NEW_FILE"||p.mustNotExist!==true||p.authority!=="NONE"||p.authorityEffect!=="NONE"||p.effectPerformed!==false||p.effectVerified!==false||!nonEmpty(p.authorizationId)||!nonEmpty(p.effectContractId)||!nonEmpty(p.rootPath)||!nonEmpty(p.relativeTargetPath))return result(OUTCOMES.UNKNOWN,"preparation invalid or widened");
  let s;try{s=machineExecutionStartPort({executionStartId:req.executionStartId});}catch(_){return result(OUTCOMES.UNKNOWN,"machine start unavailable");}
  if(!plain(s)||s.executionStartId!==req.executionStartId||s.type!=="GT63_BOUNDED_CONTINUATION_EXECUTION_START"||s.startState!=="PERMITTED"||s.executionStartPermitted!==true||s.executionStarted!==false||s.continuationExecuted!==false||s.effectPerformed!==false||s.effectVerified!==false||s.authority!==AUTHORITY||!nonEmpty(s.executionTargetRef))return result(OUTCOMES.UNKNOWN,"machine start invalid or widened");
  if(s.executionTargetRef!==p.executionPreparationId)return result(OUTCOMES.NOT_BOUND,"machine execution target must exactly equal preparation identity");
  const mat={type:"GT63_REPEATABLE_FILESYSTEM_EXECUTION_PREPARATION_MACHINE_START_BINDING",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,executionPreparationId:p.executionPreparationId,executionStartId:s.executionStartId,executionTargetRef:s.executionTargetRef,authorizationId:p.authorizationId,effectContractId:p.effectContractId,operation:p.operation,rootPath:p.rootPath,relativeTargetPath:p.relativeTargetPath,bindingState:"BOUND",authority:AUTHORITY,authorityEffect:"NONE",executionStarted:false,effectPerformed:false,effectVerified:false,additionalEffectAuthorized:false};
  const b=Object.freeze({bindingId:"gt63-binding:repeatable-filesystem-execution-start:"+digest(mat).slice(7),...mat});
  let prior;try{prior=bindingLedger.findByExecutionPreparationId(p.executionPreparationId);}catch(_){return result(OUTCOMES.UNKNOWN,"binding ledger unavailable");}
  if(!Array.isArray(prior))return result(OUTCOMES.UNKNOWN,"binding ledger invalid");if(prior.length>1)return result(OUTCOMES.CONFLICT,"multiple bindings");
  if(prior.length===1)return stringify(prior[0])===stringify(b)?result(OUTCOMES.ALREADY_BOUND,"same exact binding already captured",prior[0]):result(OUTCOMES.CONFLICT,"different binding exists");
  let c;try{c=bindingLedger.commit(b);}catch(_){return result(OUTCOMES.CONFLICT,"binding commit conflict");}
  return c&&stringify(c)===stringify(b)?result(OUTCOMES.BOUND,null,c):result(OUTCOMES.CONFLICT,"binding ledger returned conflicting material");
 }
 return Object.freeze({bind,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createRepeatableFilesystemExecutionPreparationMachineStartBindingV0});
