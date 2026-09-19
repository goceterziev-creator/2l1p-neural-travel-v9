"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="repeatable-filesystem-tool-authority-v0.1.0",AUTHORITY="NONE";
const OUTCOMES=Object.freeze({AUTHORIZED:"AUTHORIZED",ALREADY_AUTHORIZED:"ALREADY_AUTHORIZED",NOT_AUTHORIZED:"NOT_AUTHORIZED",UNKNOWN:"UNKNOWN",CONFLICT:"CONFLICT",INVALID:"INVALID"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v)),nonEmpty=v=>typeof v==="string"&&v.length>0,clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
const stringify=v=>JSON.stringify(canonical(v)),digest=v=>"sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");
const result=(outcome,reason=null,toolAuthority=null)=>Object.freeze({outcome,reason,toolAuthority:clone(toolAuthority),authority:AUTHORITY,authorityEffect:"NONE",effectPerformed:false});
function createRepeatableFilesystemToolAuthorityV0({authorizationPort,rootResolutionPort,adapterRegistryPort,authorityLedger}={}){
 for(const [n,p] of Object.entries({authorizationPort,rootResolutionPort,adapterRegistryPort}))if(typeof p!=="function")throw new TypeError(n+" required");
 if(!authorityLedger||typeof authorityLedger.findByAuthorizationId!=="function"||typeof authorityLedger.commit!=="function")throw new TypeError("authorityLedger required");
 function authorize(req){
  const fields=["rulesetVersion","authorizationId","rootResolutionId","adapterRef","adapterRevision"];
  if(!plain(req)||Object.keys(req).sort().join("|")!==fields.sort().join("|")||req.rulesetVersion!==RULESET_VERSION||!nonEmpty(req.authorizationId)||!nonEmpty(req.rootResolutionId)||!nonEmpty(req.adapterRef)||!nonEmpty(req.adapterRevision))return result(OUTCOMES.INVALID,"unsupported request schema");
  let a;try{a=authorizationPort({authorizationId:req.authorizationId});}catch(_){return result(OUTCOMES.UNKNOWN,"authorization unavailable");}
  if(!plain(a)||a.authorizationId!==req.authorizationId||a.type!=="GT63_REPEATABLE_FILESYSTEM_EXACT_EFFECT_AUTHORIZATION"||a.authorizationState!=="AUTHORIZED"||a.consumptionState!=="UNCONSUMED"||a.operation!=="CREATE_NEW_FILE"||a.target?.kind!=="RELATIVE_FILE"||!nonEmpty(a.target.path)||a.precondition?.mustNotExist!==true||a.authority!=="NONE"||a.authorityEffect!=="NONE"||a.effectPerformed!==false)return result(OUTCOMES.UNKNOWN,"authorization invalid, consumed, or widened");
  let r;try{r=rootResolutionPort({rootResolutionId:req.rootResolutionId});}catch(_){return result(OUTCOMES.UNKNOWN,"root resolution unavailable");}
  if(!plain(r)||r.rootResolutionId!==req.rootResolutionId||r.type!=="GT63_REPEATABLE_FILESYSTEM_AUTHORIZED_ROOT_RESOLUTION"||r.authorizationId!==a.authorizationId||r.authorizedRootIdentity!==a.authorizedRootIdentity||r.rootState!=="RESOLVED"||r.target?.kind!=="RELATIVE_FILE"||r.target.path!==a.target.path||r.targetExists!==false||r.lifecycleState!=="CURRENT"||r.freshnessState!=="CURRENT"||r.contradictionState!=="NONE"||r.authority!=="NONE"||r.authorityEffect!=="NONE"||r.filesystemToolAuthority!==false||r.effectPerformed!==false)return result(OUTCOMES.NOT_AUTHORIZED,"root resolution does not bind exact authorization");
  let d;try{d=adapterRegistryPort({adapterRef:req.adapterRef,adapterRevision:req.adapterRevision});}catch(_){return result(OUTCOMES.UNKNOWN,"adapter registry unavailable");}
  if(!plain(d)||d.adapterRef!==req.adapterRef||d.adapterRevision!==req.adapterRevision||d.capability!=="CREATE_NEW_FILE"||d.lifecycleState!=="CURRENT"||d.freshnessState!=="CURRENT"||d.contradictionState!=="NONE"||d.authorityEffect!=="NONE")return result(OUTCOMES.NOT_AUTHORIZED,"adapter is not exact/current");
  const mat={type:"GT63_REPEATABLE_FILESYSTEM_TOOL_AUTHORITY",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,authorizationId:a.authorizationId,rootResolutionId:r.rootResolutionId,adapterRef:d.adapterRef,adapterRevision:d.adapterRevision,capability:"CREATE_NEW_FILE",rootPath:r.rootPath,target:clone(r.target),toolAuthorityState:"AUTHORIZED",scope:{operation:"CREATE_NEW_FILE",rootPath:r.rootPath,relativeTargetPath:r.target.path,overwriteAllowed:false,deleteAllowed:false,renameAllowed:false,arbitraryPathAllowed:false},authority:AUTHORITY,authorityEffect:"NONE",effectPerformed:false};
  const t=Object.freeze({toolAuthorityId:"gt63-authority:repeatable-filesystem-tool:"+digest(mat).slice(7),...mat});
  let p;try{p=authorityLedger.findByAuthorizationId(a.authorizationId);}catch(_){return result(OUTCOMES.UNKNOWN,"authority ledger unavailable");}
  if(!Array.isArray(p))return result(OUTCOMES.UNKNOWN,"authority ledger invalid");if(p.length>1)return result(OUTCOMES.CONFLICT,"multiple tool authorities");
  if(p.length===1)return stringify(p[0])===stringify(t)?result(OUTCOMES.ALREADY_AUTHORIZED,"same bounded tool authority already captured",p[0]):result(OUTCOMES.CONFLICT,"different tool authority exists");
  let c;try{c=authorityLedger.commit(t);}catch(_){return result(OUTCOMES.CONFLICT,"authority commit conflict");}
  return c&&stringify(c)===stringify(t)?result(OUTCOMES.AUTHORIZED,null,c):result(OUTCOMES.CONFLICT,"authority ledger returned conflicting material");
 }
 return Object.freeze({authorize,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createRepeatableFilesystemToolAuthorityV0});
