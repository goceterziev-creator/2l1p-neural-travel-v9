"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="execution-start-observation-currentness-assessment-v0.1.0",AUTHORITY="NONE";
const OUTCOMES=Object.freeze({CURRENT:"CURRENT",STALE:"STALE",UNKNOWN:"UNKNOWN",CONFLICT:"CONFLICT",INVALID:"INVALID"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v)),nonEmpty=v=>typeof v==="string"&&v.length>0,clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
const stringify=v=>JSON.stringify(canonical(v)),digest=v=>"sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");
const result=(outcome,reason=null,assessment=null)=>Object.freeze({outcome,reason,assessment:clone(assessment),authority:AUTHORITY,authorityEffect:"NONE",continuationExecuted:false,effectPerformed:false,effectVerified:false});
function createExecutionStartObservationCurrentnessAssessmentV0({executionStartObservationPort,currentnessEvidencePort,assessmentLedger}={}){
 if(typeof executionStartObservationPort!=="function"||typeof currentnessEvidencePort!=="function")throw new TypeError("ports required");
 if(!assessmentLedger||typeof assessmentLedger.findByExecutionStartObservationId!=="function"||typeof assessmentLedger.commit!=="function")throw new TypeError("assessmentLedger required");
 function assess(req){
  if(!plain(req)||Object.keys(req).sort().join("|")!==["rulesetVersion","executionStartObservationId","currentnessEvidenceRef"].sort().join("|")||req.rulesetVersion!==RULESET_VERSION||!nonEmpty(req.executionStartObservationId)||!nonEmpty(req.currentnessEvidenceRef))return result(OUTCOMES.INVALID,"unsupported request schema");
  let o;try{o=executionStartObservationPort({executionStartObservationId:req.executionStartObservationId});}catch(_){return result(OUTCOMES.UNKNOWN,"execution start observation unavailable");}
  if(!plain(o)||o.executionStartObservationId!==req.executionStartObservationId||o.type!=="GT63_EXECUTION_START_OBSERVATION"||o.observationState!=="OBSERVED"||o.executionStarted!==true||o.continuationExecuted!==false||o.effectPerformed!==false||o.effectVerified!==false||o.authority!==AUTHORITY||!nonEmpty(o.executionTargetRef))return result(OUTCOMES.UNKNOWN,"execution start observation invalid or widened");
  let e;try{e=currentnessEvidencePort({currentnessEvidenceRef:req.currentnessEvidenceRef});}catch(_){return result(OUTCOMES.UNKNOWN,"currentness evidence unavailable");}
  if(!plain(e)||e.currentnessEvidenceRef!==req.currentnessEvidenceRef||e.executionStartObservationId!==o.executionStartObservationId||e.executionTargetRef!==o.executionTargetRef||e.authority!==AUTHORITY)return result(OUTCOMES.UNKNOWN,"currentness evidence not exactly bound");
  if(e.contradictionState!=="NONE")return result(OUTCOMES.CONFLICT,"contradictory currentness evidence");
  if(e.lifecycleState==="STALE"||e.freshnessState==="STALE")return result(OUTCOMES.STALE,"execution start observation stale");
  if(e.lifecycleState!=="CURRENT"||e.freshnessState!=="CURRENT")return result(OUTCOMES.UNKNOWN,"observation currentness not positively established");
  const mat={type:"GT63_EXECUTION_START_OBSERVATION_CURRENTNESS_ASSESSMENT",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,executionStartObservationId:o.executionStartObservationId,executionTargetRef:o.executionTargetRef,currentnessEvidenceRef:e.currentnessEvidenceRef,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:AUTHORITY,authorityEffect:"NONE",continuationExecuted:false,effectPerformed:false,effectVerified:false};
  const a=Object.freeze({executionStartObservationCurrentnessAssessmentId:"gt63-currentness:execution-start-observation:"+digest(mat).slice(7),...mat});
  let p;try{p=assessmentLedger.findByExecutionStartObservationId(o.executionStartObservationId);}catch(_){return result(OUTCOMES.UNKNOWN,"assessment ledger unavailable");}
  if(!Array.isArray(p))return result(OUTCOMES.UNKNOWN,"assessment ledger invalid");if(p.length>1)return result(OUTCOMES.CONFLICT,"multiple currentness assessments");
  if(p.length===1)return stringify(p[0])===stringify(a)?result(OUTCOMES.CURRENT,"same assessment already captured",p[0]):result(OUTCOMES.CONFLICT,"different currentness assessment exists");
  let c;try{c=assessmentLedger.commit(a);}catch(_){return result(OUTCOMES.CONFLICT,"assessment commit conflict");}
  return c&&stringify(c)===stringify(a)?result(OUTCOMES.CURRENT,null,c):result(OUTCOMES.CONFLICT,"assessment ledger returned conflicting material");
 }
 return Object.freeze({assess,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createExecutionStartObservationCurrentnessAssessmentV0});
