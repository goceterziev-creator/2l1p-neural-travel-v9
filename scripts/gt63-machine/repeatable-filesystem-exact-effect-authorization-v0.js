"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="repeatable-filesystem-exact-effect-authorization-v0.1.0",AUTHORITY="NONE";
const OUTCOMES=Object.freeze({AUTHORIZED:"AUTHORIZED",ALREADY_AUTHORIZED:"ALREADY_AUTHORIZED",NOT_AUTHORIZED:"NOT_AUTHORIZED",UNKNOWN:"UNKNOWN",CONFLICT:"CONFLICT",INVALID:"INVALID"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v)), nonEmpty=v=>typeof v==="string"&&v.length>0;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
const stringify=v=>JSON.stringify(canonical(v)),digest=v=>"sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");
const result=(outcome,reason=null,authorization=null)=>Object.freeze({outcome,reason,authorization:clone(authorization),authority:AUTHORITY,authorityEffect:"NONE",effectPerformed:false});
function createRepeatableFilesystemExactEffectAuthorizationV0({materialPort,humanDecisionPort,authorizationLedger}={}){
 if(typeof materialPort!=="function"||typeof humanDecisionPort!=="function")throw new TypeError("ports required");
 if(!authorizationLedger||typeof authorizationLedger.findByEffectContractId!=="function"||typeof authorizationLedger.commit!=="function")throw new TypeError("authorizationLedger required");
 function authorize(req){
  if(!plain(req)||Object.keys(req).sort().join("|")!==["rulesetVersion","effectContractId","humanDecisionEvidenceRef"].sort().join("|")||req.rulesetVersion!==RULESET_VERSION||!nonEmpty(req.effectContractId)||!nonEmpty(req.humanDecisionEvidenceRef))return result(OUTCOMES.INVALID,"unsupported request schema");
  let m;try{m=materialPort({effectContractId:req.effectContractId});}catch(_){return result(OUTCOMES.UNKNOWN,"material unavailable");}
  if(!plain(m)||m.effectContractId!==req.effectContractId||m.type!=="GT63_REPEATABLE_FILESYSTEM_EFFECT_MATERIAL"||m.materialState!=="VALIDATED_NOT_AUTHORIZED"||m.operation!=="CREATE_NEW_FILE"||m.precondition?.mustNotExist!==true||m.authority!=="NONE"||m.authorityEffect!=="NONE"||m.effectAuthorized!==false||m.effectPerformed!==false)return result(OUTCOMES.UNKNOWN,"material invalid or widened");
  let h;try{h=humanDecisionPort({humanDecisionEvidenceRef:req.humanDecisionEvidenceRef});}catch(_){return result(OUTCOMES.UNKNOWN,"human decision unavailable");}
  if(!plain(h)||h.humanDecisionEvidenceRef!==req.humanDecisionEvidenceRef||h.decision!=="APPROVE"||h.effectContractId!==m.effectContractId||h.effectContractDigest!==m.effectContractDigest||h.lifecycleState!=="CURRENT"||h.freshnessState!=="CURRENT"||h.contradictionState!=="NONE"||h.authorityEffect!=="NONE")return result(OUTCOMES.NOT_AUTHORIZED,"fresh human decision does not approve exact effect");
  const mat={type:"GT63_REPEATABLE_FILESYSTEM_EXACT_EFFECT_AUTHORIZATION",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,effectContractId:m.effectContractId,effectContractDigest:m.effectContractDigest,humanDecisionEvidenceRef:h.humanDecisionEvidenceRef,operation:m.operation,authorizedRootIdentity:m.authorizedRootIdentity,target:clone(m.target),payload:clone(m.payload),precondition:clone(m.precondition),expectedPostcondition:clone(m.expectedPostcondition),authorizationState:"AUTHORIZED",consumptionState:"UNCONSUMED",authority:AUTHORITY,authorityEffect:"NONE",effectPerformed:false};
  const a=Object.freeze({authorizationId:"gt63-authorization:repeatable-filesystem:"+digest(mat).slice(7),...mat});
  let p;try{p=authorizationLedger.findByEffectContractId(m.effectContractId);}catch(_){return result(OUTCOMES.UNKNOWN,"authorization ledger unavailable");}
  if(!Array.isArray(p))return result(OUTCOMES.UNKNOWN,"authorization ledger invalid");if(p.length>1)return result(OUTCOMES.CONFLICT,"multiple authorizations for exact effect");
  if(p.length===1)return stringify(p[0])===stringify(a)?result(OUTCOMES.ALREADY_AUTHORIZED,"same exact authorization already accepted",p[0]):result(OUTCOMES.CONFLICT,"different authorization already exists");
  let c;try{c=authorizationLedger.commit(a);}catch(_){return result(OUTCOMES.CONFLICT,"authorization commit conflict");}
  return c&&stringify(c)===stringify(a)?result(OUTCOMES.AUTHORIZED,null,c):result(OUTCOMES.CONFLICT,"authorization ledger returned conflicting material");
 }
 return Object.freeze({authorize,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createRepeatableFilesystemExactEffectAuthorizationV0});
