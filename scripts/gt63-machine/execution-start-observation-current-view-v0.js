"use strict";
const RULESET_VERSION="execution-start-observation-current-view-v0.1.0",AUTHORITY="NONE";
const OUTCOMES=Object.freeze({READY:"READY",NOT_READY:"NOT_READY",UNKNOWN:"UNKNOWN",INVALID:"INVALID"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v)),nonEmpty=v=>typeof v==="string"&&v.length>0,clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const result=(outcome,reason=null,currentView=null)=>Object.freeze({outcome,reason,currentView:clone(currentView),authority:AUTHORITY,authorityEffect:"NONE",continuationExecuted:false,effectPerformed:false,effectVerified:false});
function createExecutionStartObservationCurrentViewV0({executionStartObservationPort,currentnessAssessmentPort}={}){
 if(typeof executionStartObservationPort!=="function"||typeof currentnessAssessmentPort!=="function")throw new TypeError("ports required");
 function resolve(req){
  if(!plain(req)||Object.keys(req).sort().join("|")!==["rulesetVersion","executionStartObservationId","executionStartObservationCurrentnessAssessmentId"].sort().join("|")||req.rulesetVersion!==RULESET_VERSION||!nonEmpty(req.executionStartObservationId)||!nonEmpty(req.executionStartObservationCurrentnessAssessmentId))return result(OUTCOMES.INVALID,"unsupported request schema");
  let o;try{o=executionStartObservationPort({executionStartObservationId:req.executionStartObservationId});}catch(_){return result(OUTCOMES.UNKNOWN,"execution start observation unavailable");}
  if(!plain(o)||o.executionStartObservationId!==req.executionStartObservationId||o.type!=="GT63_EXECUTION_START_OBSERVATION"||o.observationState!=="OBSERVED"||o.executionStarted!==true||o.continuationExecuted!==false||o.effectPerformed!==false||o.effectVerified!==false||o.authority!==AUTHORITY||!nonEmpty(o.executionTargetRef))return result(OUTCOMES.NOT_READY,"execution start observation invalid or widened");
  let a;try{a=currentnessAssessmentPort({executionStartObservationCurrentnessAssessmentId:req.executionStartObservationCurrentnessAssessmentId});}catch(_){return result(OUTCOMES.UNKNOWN,"currentness assessment unavailable");}
  if(!plain(a)||a.executionStartObservationCurrentnessAssessmentId!==req.executionStartObservationCurrentnessAssessmentId||a.type!=="GT63_EXECUTION_START_OBSERVATION_CURRENTNESS_ASSESSMENT"||a.executionStartObservationId!==o.executionStartObservationId||a.executionTargetRef!==o.executionTargetRef||a.lifecycleState!=="CURRENT"||a.freshnessState!=="CURRENT"||a.contradictionState!=="NONE"||a.authority!==AUTHORITY||a.authorityEffect!=="NONE"||a.continuationExecuted!==false||a.effectPerformed!==false||a.effectVerified!==false)return result(OUTCOMES.NOT_READY,"currentness assessment invalid, mismatched, or widened");
  return result(OUTCOMES.READY,null,Object.freeze({...clone(o),lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",executionStartObservationCurrentnessAssessmentId:a.executionStartObservationCurrentnessAssessmentId}));
 }
 return Object.freeze({resolve,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createExecutionStartObservationCurrentViewV0});
