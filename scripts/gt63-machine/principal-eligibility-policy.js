"use strict";

const crypto = require("node:crypto");
const RULESET_VERSION = "principal-eligibility-policy-v0.1.0";
const AUTHORITY = "NONE";
const APPROVED_PRINCIPAL_REF = "gt63-machine:human-principal:goce-v0";
const SUPPORTED_ACT = "GATE_AUTHORIZATION";
const STATES = new Set(["ELIGIBLE", "NOT_ELIGIBLE", "UNKNOWN"]);
const OUTCOMES = Object.freeze({ RESOLVED:"PRINCIPAL_ELIGIBILITY_POLICY_RESOLVED", UNKNOWN:"PRINCIPAL_ELIGIBILITY_POLICY_UNKNOWN", INVALID:"PRINCIPAL_ELIGIBILITY_POLICY_INVALID" });
function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function canon(v){if(Array.isArray(v))return v.map(canon);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canon(v[k]),o),{});return typeof v==="string"?v.normalize("NFC"):v;}
function same(a,b){return JSON.stringify(canon(a))===JSON.stringify(canon(b));}
function digest(v){return crypto.createHash("sha256").update(Buffer.from(JSON.stringify(canon(v)),"utf8")).digest("hex");}
function validScope(s){return plain(s)&&s.scopeType==="GATE"&&nonEmpty(s.interactionId)&&Number.isInteger(s.fromInteractionRevision)&&s.fromInteractionRevision>=0&&(s.throughInteractionRevision===null||(Number.isInteger(s.throughInteractionRevision)&&s.throughInteractionRevision>=s.fromInteractionRevision))&&nonEmpty(s.gateId)&&Number.isInteger(s.gateRevision)&&s.gateRevision>0&&/^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest)&&nonEmpty(s.continuationTargetRef);}
function result(outcome,reason,evidence=null){return freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:AUTHORITY,humanGateSatisfied:false,continuationAuthorityCreated:false,executionAuthorityCreated:false,effectAuthorized:false});}
function createPrincipalEligibilityPolicy({policyEvidencePort}={}){
 if(typeof policyEvidencePort!=="function")throw new TypeError("policyEvidencePort must be a function");
 function assess(request){
  if(!plain(request)||Object.keys(request).some(k=>!["rulesetVersion","principalRef","principalRevision","governanceAct","contextScope","expectedPolicyRevision"].includes(k))||Object.keys(request).length!==6||request.rulesetVersion!==RULESET_VERSION||request.principalRef!==APPROVED_PRINCIPAL_REF||!nonEmpty(request.principalRevision)||request.governanceAct!==SUPPORTED_ACT||!validScope(request.contextScope)||!nonEmpty(request.expectedPolicyRevision))return result(OUTCOMES.INVALID,"unsupported request, principal, act, or scope");
  let e;try{e=policyEvidencePort(freeze(clone(request)));}catch(_){return result(OUTCOMES.UNKNOWN,"policy evidence unavailable");}
  if(!plain(e)||!nonEmpty(e.policyEvidenceRef)||e.policyRevision!==request.expectedPolicyRevision||e.principalRef!==request.principalRef||e.principalRevision!==request.principalRevision||e.governanceAct!==request.governanceAct||!same(e.contextScope,request.contextScope)||!STATES.has(e.eligibilityState)||e.lifecycleState!=="CURRENT"||e.freshnessState!=="CURRENT"||e.contradictionState!=="NONE"||e.acceptanceState!=="ACCEPTED"||e.authority!==AUTHORITY)return result(OUTCOMES.UNKNOWN,"policy evidence missing, mismatched, non-current, contradictory, or unaccepted");
  const material={type:"GT63_PRINCIPAL_ELIGIBILITY_POLICY_EVIDENCE",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,policyRevision:e.policyRevision,sourcePolicyEvidenceRef:e.policyEvidenceRef,principalRef:e.principalRef,principalRevision:e.principalRevision,governanceAct:e.governanceAct,contextScope:canon(e.contextScope),eligibilityState:e.eligibilityState,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:AUTHORITY};
  return result(OUTCOMES.RESOLVED,null,{eligibilityPolicyEvidenceRef:`gt63-evidence:principal-eligibility-policy:${digest(material)}`,...material});
 }
 return Object.freeze({assess,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,APPROVED_PRINCIPAL_REF,SUPPORTED_ACT,OUTCOMES,createPrincipalEligibilityPolicy});
