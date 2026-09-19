"use strict";
const RULESET_VERSION="effect-performance-observation-current-view-v0.1.0",AUTHORITY="NONE";
const OUTCOMES=Object.freeze({READY:"READY",NOT_READY:"NOT_READY",UNKNOWN:"UNKNOWN",INVALID:"INVALID"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v)),nonEmpty=v=>typeof v==="string"&&v.length>0,clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const result=(outcome,reason=null,currentView=null)=>Object.freeze({outcome,reason,currentView:clone(currentView),authority:AUTHORITY,authorityEffect:"NONE",effectVerified:false,executionAuthorityCreated:false,additionalEffectAuthorized:false});
function createEffectPerformanceObservationCurrentViewV0({effectPerformanceObservationPort,currentnessAssessmentPort}={}){
 if(typeof effectPerformanceObservationPort!=="function"||typeof currentnessAssessmentPort!=="function")throw new TypeError("ports required");
 function resolve(req){
  if(!plain(req)||Object.keys(req).sort().join("|")!==["rulesetVersion","effectPerformanceObservationId","effectPerformanceObservationCurrentnessAssessmentId"].sort().join("|")||req.rulesetVersion!==RULESET_VERSION||!nonEmpty(req.effectPerformanceObservationId)||!nonEmpty(req.effectPerformanceObservationCurrentnessAssessmentId))return result(OUTCOMES.INVALID,"unsupported request schema");
  let o;try{o=effectPerformanceObservationPort({effectPerformanceObservationId:req.effectPerformanceObservationId});}catch(_){return result(OUTCOMES.UNKNOWN,"effect performance observation unavailable");}
  if(!plain(o)||o.effectPerformanceObservationId!==req.effectPerformanceObservationId||o.type!=="GT63_EFFECT_PERFORMANCE_OBSERVATION"||o.observationState!=="OBSERVED"||o.effectPerformed!==true||o.effectVerified!==false||o.authority!==AUTHORITY||!nonEmpty(o.executionTargetRef))return result(OUTCOMES.NOT_READY,"effect performance observation invalid or widened");
  let a;try{a=currentnessAssessmentPort({effectPerformanceObservationCurrentnessAssessmentId:req.effectPerformanceObservationCurrentnessAssessmentId});}catch(_){return result(OUTCOMES.UNKNOWN,"currentness assessment unavailable");}
  if(!plain(a)||a.effectPerformanceObservationCurrentnessAssessmentId!==req.effectPerformanceObservationCurrentnessAssessmentId||a.type!=="GT63_EFFECT_PERFORMANCE_OBSERVATION_CURRENTNESS_ASSESSMENT"||a.effectPerformanceObservationId!==o.effectPerformanceObservationId||a.executionTargetRef!==o.executionTargetRef||a.lifecycleState!=="CURRENT"||a.freshnessState!=="CURRENT"||a.contradictionState!=="NONE"||a.authority!==AUTHORITY||a.authorityEffect!=="NONE"||a.effectVerified!==false||a.executionAuthorityCreated!==false||a.additionalEffectAuthorized!==false)return result(OUTCOMES.NOT_READY,"currentness assessment invalid, mismatched, or widened");
  return result(OUTCOMES.READY,null,Object.freeze({...clone(o),lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",effectPerformanceObservationCurrentnessAssessmentId:a.effectPerformanceObservationCurrentnessAssessmentId}));
 }
 return Object.freeze({resolve,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createEffectPerformanceObservationCurrentViewV0});
