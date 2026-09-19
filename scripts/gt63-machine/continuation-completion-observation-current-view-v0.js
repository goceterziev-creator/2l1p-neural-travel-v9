"use strict";
const RULESET_VERSION="continuation-completion-observation-current-view-v0.1.0",AUTHORITY="NONE";
const OUTCOMES=Object.freeze({READY:"READY",NOT_READY:"NOT_READY",UNKNOWN:"UNKNOWN",INVALID:"INVALID"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v)),nonEmpty=v=>typeof v==="string"&&v.length>0,clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const result=(outcome,reason=null,currentView=null)=>Object.freeze({outcome,reason,currentView:clone(currentView),authority:AUTHORITY,authorityEffect:"NONE",effectPerformed:false,effectVerified:false});
function createContinuationCompletionObservationCurrentViewV0({continuationCompletionObservationPort,currentnessAssessmentPort}={}){
 if(typeof continuationCompletionObservationPort!=="function"||typeof currentnessAssessmentPort!=="function")throw new TypeError("ports required");
 function resolve(req){
  if(!plain(req)||Object.keys(req).sort().join("|")!==["rulesetVersion","continuationCompletionObservationId","continuationCompletionObservationCurrentnessAssessmentId"].sort().join("|")||req.rulesetVersion!==RULESET_VERSION||!nonEmpty(req.continuationCompletionObservationId)||!nonEmpty(req.continuationCompletionObservationCurrentnessAssessmentId))return result(OUTCOMES.INVALID,"unsupported request schema");
  let o;try{o=continuationCompletionObservationPort({continuationCompletionObservationId:req.continuationCompletionObservationId});}catch(_){return result(OUTCOMES.UNKNOWN,"continuation completion observation unavailable");}
  if(!plain(o)||o.continuationCompletionObservationId!==req.continuationCompletionObservationId||o.type!=="GT63_CONTINUATION_COMPLETION_OBSERVATION"||o.observationState!=="OBSERVED"||o.continuationExecuted!==true||o.effectPerformed!==false||o.effectVerified!==false||o.authority!==AUTHORITY||!nonEmpty(o.executionTargetRef))return result(OUTCOMES.NOT_READY,"continuation completion observation invalid or widened");
  let a;try{a=currentnessAssessmentPort({continuationCompletionObservationCurrentnessAssessmentId:req.continuationCompletionObservationCurrentnessAssessmentId});}catch(_){return result(OUTCOMES.UNKNOWN,"currentness assessment unavailable");}
  if(!plain(a)||a.continuationCompletionObservationCurrentnessAssessmentId!==req.continuationCompletionObservationCurrentnessAssessmentId||a.type!=="GT63_CONTINUATION_COMPLETION_OBSERVATION_CURRENTNESS_ASSESSMENT"||a.continuationCompletionObservationId!==o.continuationCompletionObservationId||a.executionTargetRef!==o.executionTargetRef||a.lifecycleState!=="CURRENT"||a.freshnessState!=="CURRENT"||a.contradictionState!=="NONE"||a.authority!==AUTHORITY||a.authorityEffect!=="NONE"||a.effectPerformed!==false||a.effectVerified!==false)return result(OUTCOMES.NOT_READY,"currentness assessment invalid, mismatched, or widened");
  return result(OUTCOMES.READY,null,Object.freeze({...clone(o),lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",continuationCompletionObservationCurrentnessAssessmentId:a.continuationCompletionObservationCurrentnessAssessmentId}));
 }
 return Object.freeze({resolve,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createContinuationCompletionObservationCurrentViewV0});
