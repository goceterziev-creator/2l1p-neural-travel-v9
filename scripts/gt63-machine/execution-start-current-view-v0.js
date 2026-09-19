"use strict";
const RULESET_VERSION="execution-start-current-view-v0.1.0",AUTHORITY="NONE";
const OUTCOMES=Object.freeze({READY:"READY",NOT_READY:"NOT_READY",UNKNOWN:"UNKNOWN",INVALID:"INVALID"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v)),nonEmpty=v=>typeof v==="string"&&v.length>0,clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const result=(outcome,reason=null,currentView=null)=>Object.freeze({outcome,reason,currentView:clone(currentView),authority:AUTHORITY,authorityEffect:"NONE",executionStarted:false,continuationExecuted:false,effectPerformed:false,effectVerified:false});
function createExecutionStartCurrentViewV0({executionStartPort,currentnessAssessmentPort}={}){
 if(typeof executionStartPort!=="function"||typeof currentnessAssessmentPort!=="function")throw new TypeError("ports required");
 function resolve(req){
  if(!plain(req)||Object.keys(req).sort().join("|")!==["rulesetVersion","executionStartId","executionStartCurrentnessAssessmentId"].sort().join("|")||req.rulesetVersion!==RULESET_VERSION||!nonEmpty(req.executionStartId)||!nonEmpty(req.executionStartCurrentnessAssessmentId))return result(OUTCOMES.INVALID,"unsupported request schema");
  let s;try{s=executionStartPort({executionStartId:req.executionStartId});}catch(_){return result(OUTCOMES.UNKNOWN,"execution start unavailable");}
  if(!plain(s)||s.executionStartId!==req.executionStartId||s.type!=="GT63_BOUNDED_CONTINUATION_EXECUTION_START"||s.startState!=="PERMITTED"||s.executionStartPermitted!==true||s.executionStarted!==false||s.continuationExecuted!==false||s.effectPerformed!==false||s.effectVerified!==false||s.authority!==AUTHORITY||!nonEmpty(s.executionTargetRef))return result(OUTCOMES.NOT_READY,"execution start invalid or widened");
  let a;try{a=currentnessAssessmentPort({executionStartCurrentnessAssessmentId:req.executionStartCurrentnessAssessmentId});}catch(_){return result(OUTCOMES.UNKNOWN,"currentness assessment unavailable");}
  if(!plain(a)||a.executionStartCurrentnessAssessmentId!==req.executionStartCurrentnessAssessmentId||a.type!=="GT63_EXECUTION_START_CURRENTNESS_ASSESSMENT"||a.executionStartId!==s.executionStartId||a.executionTargetRef!==s.executionTargetRef||a.lifecycleState!=="CURRENT"||a.freshnessState!=="CURRENT"||a.contradictionState!=="NONE"||a.authority!==AUTHORITY||a.authorityEffect!=="NONE"||a.executionStarted!==false||a.continuationExecuted!==false||a.effectPerformed!==false||a.effectVerified!==false)return result(OUTCOMES.NOT_READY,"currentness assessment invalid, mismatched, or widened");
  const view=Object.freeze({...clone(s),lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",executionStartCurrentnessAssessmentId:a.executionStartCurrentnessAssessmentId});
  return result(OUTCOMES.READY,null,view);
 }
 return Object.freeze({resolve,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createExecutionStartCurrentViewV0});
