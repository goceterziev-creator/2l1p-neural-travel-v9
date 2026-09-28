"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="governance-role-resolution-v0.1.0",AUTHORITY="NONE";
const OUTCOMES=Object.freeze({MATCH:"MATCH",UNKNOWN:"UNKNOWN",CONFLICT:"CONFLICT",INVALID:"INVALID"});
const plain=v=>!!(v&&typeof v==="object"&&!Array.isArray(v)),nonEmpty=v=>typeof v==="string"&&v.length>0,clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function canon(v){if(Array.isArray(v))return v.map(canon);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canon(v[k]),o),{});return typeof v==="string"?v.normalize("NFC"):v}
const same=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
const digest=v=>"sha256:"+crypto.createHash("sha256").update(JSON.stringify(canon(v))).digest("hex");
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze)}return v}
function exact(o,fs){return plain(o)&&Object.keys(o).length===fs.length&&Object.keys(o).every(k=>fs.includes(k))}
function validScope(s){const f=["scopeType","interactionId","fromInteractionRevision","throughInteractionRevision","gateId","gateRevision","authorityScopeDigest","continuationTargetRef"];return exact(s,f)&&s.scopeType==="GATE"&&nonEmpty(s.interactionId)&&Number.isInteger(s.fromInteractionRevision)&&s.fromInteractionRevision>=0&&(s.throughInteractionRevision===null||(Number.isInteger(s.throughInteractionRevision)&&s.throughInteractionRevision>=s.fromInteractionRevision))&&nonEmpty(s.gateId)&&Number.isInteger(s.gateRevision)&&s.gateRevision>0&&/^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest)&&nonEmpty(s.continuationTargetRef)}
function scopeContains(parent,child){if(!validScope(parent)||!validScope(child))return false;return parent.interactionId===child.interactionId&&parent.gateId===child.gateId&&parent.gateRevision===child.gateRevision&&parent.authorityScopeDigest===child.authorityScopeDigest&&parent.continuationTargetRef===child.continuationTargetRef&&child.fromInteractionRevision>=parent.fromInteractionRevision&&(parent.throughInteractionRevision===null||(child.throughInteractionRevision!==null&&child.throughInteractionRevision<=parent.throughInteractionRevision))}
function call(p,a){try{return{ok:true,value:p(freeze(clone(a)))}}catch(_){return{ok:false,value:null}}}
function result(outcome,reason,resolution=null){return freeze({outcome,reason:reason||null,resolution:clone(resolution),authority:AUTHORITY,eligibilityCreated:false,humanAuthorizationCreated:false,humanGateSatisfied:false,continuationAuthorityCreated:false,executionAuthorityCreated:false,effectAuthorized:false})}
function validRequest(r){const f=["rulesetVersion","principalRef","principalRevision","roleRef","roleRevision","contextScope"];return exact(r,f)&&r.rulesetVersion===RULESET_VERSION&&nonEmpty(r.principalRef)&&nonEmpty(r.principalRevision)&&nonEmpty(r.roleRef)&&nonEmpty(r.roleRevision)&&validScope(r.contextScope)}
function acceptedAssignment(x,r){return plain(x)&&x.type==="DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE"&&nonEmpty(x.assignmentAcceptanceId)&&x.principalRef===r.principalRef&&x.principalRevision===r.principalRevision&&x.roleRef===r.roleRef&&x.roleRevision===r.roleRevision&&scopeContains(x.contextScope,r.contextScope)&&x.authority===AUTHORITY}
function acceptedDelegation(x,r){return plain(x)&&x.type==="DIRECT_DELEGATION_EVIDENCE_ACCEPTANCE"&&nonEmpty(x.delegationAcceptanceId)&&x.granteeRef===r.principalRef&&x.granteeRevision===r.principalRevision&&x.roleRef===r.roleRef&&x.roleRevision===r.roleRevision&&scopeContains(x.delegatedScope,r.contextScope)&&x.chainDepth===1&&x.redelegationPermitted===false&&x.authority===AUTHORITY}
function currentState(x,idField,id){return plain(x)&&x[idField]===id&&x.state==="CURRENT"&&nonEmpty(x.lifecycleRevision)&&x.contradictionState==="NONE"&&nonEmpty(x.evidenceRef)}
function createGovernanceRoleResolution({acceptedAssignmentPort,acceptedDelegationPort,assignmentCurrentStatePort,delegationCurrentStatePort}){
 for(const [n,p] of Object.entries({acceptedAssignmentPort,acceptedDelegationPort,assignmentCurrentStatePort,delegationCurrentStatePort}))if(typeof p!=="function")throw new TypeError(n+" must be a function");
 function resolve(request){
  if(!validRequest(request))return result(OUTCOMES.INVALID,"unsupported request schema or ruleset");
  const query={principalRef:request.principalRef,principalRevision:request.principalRevision,roleRef:request.roleRef,roleRevision:request.roleRevision,contextScope:request.contextScope};
  const ar=call(acceptedAssignmentPort,query),dr=call(acceptedDelegationPort,query);
  if(!ar.ok||!dr.ok||!Array.isArray(ar.value)||!Array.isArray(dr.value))return result(OUTCOMES.UNKNOWN,"accepted role evidence unavailable");
  const assignments=ar.value.filter(x=>acceptedAssignment(x,request)),delegations=dr.value.filter(x=>acceptedDelegation(x,request));
  if(assignments.length>1||delegations.length>1||(assignments.length&&delegations.length))return result(OUTCOMES.CONFLICT,"multiple current-role evidence candidates");
  const kind=assignments.length?"DIRECT_ASSIGNMENT":delegations.length?"DELEGATION":null,evidence=assignments[0]||delegations[0]||null;
  if(!evidence)return result(OUTCOMES.UNKNOWN,"no accepted positive role evidence; absence is not mismatch");
  const idField=kind==="DIRECT_ASSIGNMENT"?"assignmentAcceptanceId":"delegationAcceptanceId",port=kind==="DIRECT_ASSIGNMENT"?assignmentCurrentStatePort:delegationCurrentStatePort;
  const sr=call(port,{[idField]:evidence[idField]});
  if(!sr.ok||!currentState(sr.value,idField,evidence[idField]))return result(OUTCOMES.UNKNOWN,"role evidence currentness unavailable, stale, revoked, conflicting, or unbound");
  const evidenceRefs=[evidence[idField],sr.value.evidenceRef];
  const material={type:"GT63_GOVERNANCE_ROLE_RESOLUTION",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,roleResolutionType:kind,principalRef:request.principalRef,principalRevision:request.principalRevision,roleRef:request.roleRef,roleRevision:request.roleRevision,contextScope:canon(request.contextScope),roleEvidenceRefs:evidenceRefs.slice().sort(),resolutionState:"MATCH",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:AUTHORITY};
  return result(OUTCOMES.MATCH,null,freeze({roleResolutionRef:"gt63-role-resolution:"+digest(material).slice(7),...material}))
 }
 return Object.freeze({resolve,rulesetVersion:RULESET_VERSION,authority:AUTHORITY})
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createGovernanceRoleResolution});
