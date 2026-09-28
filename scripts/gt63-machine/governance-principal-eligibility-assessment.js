"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="governance-principal-eligibility-assessment-v0.1.0",AUTHORITY="NONE",GOVERNANCE_ACT="GATE_AUTHORIZATION";
const OUTCOMES=Object.freeze({ELIGIBLE:"ELIGIBLE",NOT_ELIGIBLE:"NOT_ELIGIBLE",UNKNOWN:"UNKNOWN",INVALID:"INVALID"});
const plain=v=>!!(v&&typeof v==="object"&&!Array.isArray(v)), nonEmpty=v=>typeof v==="string"&&v.length>0, clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function canon(v){if(Array.isArray(v))return v.map(canon);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canon(v[k]),o),{});return typeof v==="string"?v.normalize("NFC"):v}
const digest=v=>"sha256:"+crypto.createHash("sha256").update(JSON.stringify(canon(v))).digest("hex");
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze)}return v}
function exact(o,fs){return plain(o)&&Object.keys(o).length===fs.length&&Object.keys(o).every(k=>fs.includes(k))}
function validScope(s){const f=["scopeType","interactionId","fromInteractionRevision","throughInteractionRevision","gateId","gateRevision","authorityScopeDigest","continuationTargetRef"];return exact(s,f)&&s.scopeType==="GATE"&&nonEmpty(s.interactionId)&&Number.isInteger(s.fromInteractionRevision)&&s.fromInteractionRevision>=0&&(s.throughInteractionRevision===null||(Number.isInteger(s.throughInteractionRevision)&&s.throughInteractionRevision>=s.fromInteractionRevision))&&nonEmpty(s.gateId)&&Number.isInteger(s.gateRevision)&&s.gateRevision>0&&/^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest)&&nonEmpty(s.continuationTargetRef)}
const sameScope=(a,b)=>validScope(a)&&validScope(b)&&JSON.stringify(canon(a))===JSON.stringify(canon(b));
function call(p,a){try{return{ok:true,value:p(freeze(clone(a)))}}catch(_){return{ok:false,value:null}}}
function result(outcome,reason,evidence=null){return freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:AUTHORITY,humanAuthorizationCreated:false,humanGateSatisfied:false,continuationAuthorityCreated:false,executionAuthorityCreated:false,effectAuthorized:false})}
function validRequest(r){const f=["rulesetVersion","principalRef","principalRevision","governanceAct","contextScope"];return exact(r,f)&&r.rulesetVersion===RULESET_VERSION&&nonEmpty(r.principalRef)&&nonEmpty(r.principalRevision)&&r.governanceAct===GOVERNANCE_ACT&&validScope(r.contextScope)}
function currentPrincipal(p,r){return plain(p)&&p.principalRef===r.principalRef&&p.principalRevision===r.principalRevision&&nonEmpty(p.principalEvidenceRef)&&p.lifecycleState==="CURRENT"&&p.freshnessState==="CURRENT"&&p.contradictionState==="NONE"&&p.authority===AUTHORITY}
function validRequirement(x,r){return plain(x)&&nonEmpty(x.requirementRef)&&nonEmpty(x.requirementRevision)&&x.governanceAct===r.governanceAct&&nonEmpty(x.requiredRoleRef)&&nonEmpty(x.requiredRoleRevision)&&nonEmpty(x.roleRequirementEvidenceRef)&&sameScope(x.contextScope,r.contextScope)&&x.lifecycleState==="CURRENT"&&x.freshnessState==="CURRENT"&&x.contradictionState==="NONE"&&x.authority===AUTHORITY}
function validResolution(x,r,q){return plain(x)&&["DIRECT_ASSIGNMENT","DELEGATION"].includes(x.roleResolutionType)&&x.principalRef===r.principalRef&&x.principalRevision===r.principalRevision&&x.roleRef===q.requiredRoleRef&&x.roleRevision===q.requiredRoleRevision&&sameScope(x.contextScope,r.contextScope)&&Array.isArray(x.roleEvidenceRefs)&&x.roleEvidenceRefs.length>0&&x.roleEvidenceRefs.every(nonEmpty)&&["MATCH","MISMATCH","UNKNOWN"].includes(x.resolutionState)&&["CURRENT","STALE","UNKNOWN"].includes(x.freshnessState)&&["CURRENT","STALE","REVOKED","DEACTIVATED","SUPERSEDED","UNKNOWN","CONFLICT"].includes(x.lifecycleState)&&["NONE","CONFLICT"].includes(x.contradictionState)&&x.authority===AUTHORITY}
function createGovernancePrincipalEligibilityAssessment({authenticatedPrincipalPort,governanceRoleRequirementPort,roleResolutionPort}){
 for(const [n,p] of Object.entries({authenticatedPrincipalPort,governanceRoleRequirementPort,roleResolutionPort}))if(typeof p!=="function")throw new TypeError(n+" must be a function");
 function assess(request){
  if(!validRequest(request))return result(OUTCOMES.INVALID,"unsupported request schema or ruleset");
  const pr=call(authenticatedPrincipalPort,{principalRef:request.principalRef,principalRevision:request.principalRevision,contextScope:request.contextScope});
  if(!pr.ok||!currentPrincipal(pr.value,request))return result(OUTCOMES.UNKNOWN,"authenticated principal evidence unavailable, invalid, or non-current");
  const rr=call(governanceRoleRequirementPort,{governanceAct:request.governanceAct,contextScope:request.contextScope});
  if(!rr.ok||!validRequirement(rr.value,request))return result(OUTCOMES.UNKNOWN,"accepted current role requirement unavailable, invalid, or unbound");
  const role=call(roleResolutionPort,{principalRef:request.principalRef,principalRevision:request.principalRevision,roleRef:rr.value.requiredRoleRef,roleRevision:rr.value.requiredRoleRevision,contextScope:request.contextScope});
  if(!role.ok||!validResolution(role.value,request,rr.value))return result(OUTCOMES.UNKNOWN,"role evidence unavailable, invalid, or unbound");
  const x=role.value;
  if(x.lifecycleState!=="CURRENT"||x.freshnessState!=="CURRENT"||x.contradictionState!=="NONE"||x.resolutionState==="UNKNOWN")return result(OUTCOMES.UNKNOWN,"role evidence is incomplete, stale, conflicting, or unknown");
  const material={type:"GT63_GOVERNANCE_PRINCIPAL_ELIGIBILITY_EVIDENCE",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,principalRef:request.principalRef,principalRevision:request.principalRevision,governanceAct:request.governanceAct,contextScope:canon(request.contextScope),eligibilityState:x.resolutionState==="MATCH"?OUTCOMES.ELIGIBLE:OUTCOMES.NOT_ELIGIBLE,principalEvidenceRef:pr.value.principalEvidenceRef,roleRequirementEvidenceRef:rr.value.roleRequirementEvidenceRef,roleResolutionType:x.roleResolutionType,roleEvidenceRefs:Array.from(new Set(x.roleEvidenceRefs)).sort(),lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:AUTHORITY};
  const evidence=freeze({eligibilityEvidenceRef:"gt63-evidence:principal-eligibility:"+digest(material).slice(7),...material});
  return result(evidence.eligibilityState,null,evidence)
 }
 return Object.freeze({assess,rulesetVersion:RULESET_VERSION,authority:AUTHORITY})
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,GOVERNANCE_ACT,OUTCOMES,createGovernancePrincipalEligibilityAssessment});
