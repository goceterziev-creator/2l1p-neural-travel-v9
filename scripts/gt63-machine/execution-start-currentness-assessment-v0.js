"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="execution-start-currentness-assessment-v0.1.0",AUTHORITY="NONE";
const OUTCOMES=Object.freeze({CURRENT:"CURRENT",STALE:"STALE",UNKNOWN:"UNKNOWN",CONFLICT:"CONFLICT",INVALID:"INVALID"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v)),nonEmpty=v=>typeof v==="string"&&v.length>0,clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
const stringify=v=>JSON.stringify(canonical(v)),digest=v=>"sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");
const result=(outcome,reason=null,assessment=null)=>Object.freeze({outcome,reason,assessment:clone(assessment),authority:AUTHORITY,authorityEffect:"NONE",executionStarted:false,continuationExecuted:false,effectPerformed:false,effectVerified:false});
function createExecutionStartCurrentnessAssessmentV0({executionStartPort,currentnessEvidencePort,assessmentLedger}={}){
 if(typeof executionStartPort!=="function"||typeof currentnessEvidencePort!=="function")throw new TypeError("ports required");
 if(!assessmentLedger||typeof assessmentLedger.findByExecutionStartId!=="function"||typeof assessmentLedger.commit!=="function")throw new TypeError("assessmentLedger required");
 function assess(req){
  if(!plain(req)||Object.keys(req).sort().join("|")!==["rulesetVersion","executionStartId","currentnessEvidenceRef"].sort().join("|")||req.rulesetVersion!==RULESET_VERSION||!nonEmpty(req.executionStartId)||!nonEmpty(req.currentnessEvidenceRef))return result(OUTCOMES.INVALID,"unsupported request schema");
  let s;try{s=executionStartPort({executionStartId:req.executionStartId});}catch(_){return result(OUTCOMES.UNKNOWN,"execution start unavailable");}
  if(!plain(s)||s.executionStartId!==req.executionStartId||s.type!=="GT63_BOUNDED_CONTINUATION_EXECUTION_START"||s.startState!=="PERMITTED"||s.executionStartPermitted!==true||s.executionStarted!==false||s.continuationExecuted!==false||s.effectPerformed!==false||s.effectVerified!==false||s.authority!==AUTHORITY||!nonEmpty(s.executionTargetRef))return result(OUTCOMES.UNKNOWN,"execution start invalid or widened");
  let e;try{e=currentnessEvidencePort({currentnessEvidenceRef:req.currentnessEvidenceRef});}catch(_){return result(OUTCOMES.UNKNOWN,"currentness evidence unavailable");}
  if(!plain(e)||e.currentnessEvidenceRef!==req.currentnessEvidenceRef||e.executionStartId!==s.executionStartId||e.executionTargetRef!==s.executionTargetRef||e.authority!==AUTHORITY)return result(OUTCOMES.UNKNOWN,"currentness evidence not exactly bound");
  if(e.contradictionState!=="NONE")return result(OUTCOMES.CONFLICT,"contradictory currentness evidence");
  if(e.lifecycleState==="STALE"||e.freshnessState==="STALE")return result(OUTCOMES.STALE,"execution start evidence stale");
  if(e.lifecycleState!=="CURRENT"||e.freshnessState!=="CURRENT")return result(OUTCOMES.UNKNOWN,"execution start currentness not positively established");
  const mat={type:"GT63_EXECUTION_START_CURRENTNESS_ASSESSMENT",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,executionStartId:s.executionStartId,executionTargetRef:s.executionTargetRef,currentnessEvidenceRef:e.currentnessEvidenceRef,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:AUTHORITY,authorityEffect:"NONE",executionStarted:false,continuationExecuted:false,effectPerformed:false,effectVerified:false};
  const a=Object.freeze({executionStartCurrentnessAssessmentId:"gt63-currentness:execution-start:"+digest(mat).slice(7),...mat});
  let p;try{p=assessmentLedger.findByExecutionStartId(s.executionStartId);}catch(_){return result(OUTCOMES.UNKNOWN,"assessment ledger unavailable");}
  if(!Array.isArray(p))return result(OUTCOMES.UNKNOWN,"assessment ledger invalid");if(p.length>1)return result(OUTCOMES.CONFLICT,"multiple currentness assessments");
  if(p.length===1)return stringify(p[0])===stringify(a)?result(OUTCOMES.CURRENT,"same assessment already captured",p[0]):result(OUTCOMES.CONFLICT,"different currentness assessment exists");
  let c;try{c=assessmentLedger.commit(a);}catch(_){return result(OUTCOMES.CONFLICT,"assessment commit conflict");}
  return c&&stringify(c)===stringify(a)?result(OUTCOMES.CURRENT,null,c):result(OUTCOMES.CONFLICT,"assessment ledger returned conflicting material");
 }
 return Object.freeze({assess,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createExecutionStartCurrentnessAssessmentV0});
