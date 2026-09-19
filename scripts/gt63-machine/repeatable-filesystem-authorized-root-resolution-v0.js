"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="repeatable-filesystem-authorized-root-resolution-v0.1.0",AUTHORITY="NONE";
const OUTCOMES=Object.freeze({RESOLVED:"RESOLVED",ALREADY_RESOLVED:"ALREADY_RESOLVED",NOT_RESOLVED:"NOT_RESOLVED",UNKNOWN:"UNKNOWN",CONFLICT:"CONFLICT",INVALID:"INVALID"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v)),nonEmpty=v=>typeof v==="string"&&v.length>0,clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
const stringify=v=>JSON.stringify(canonical(v)),digest=v=>"sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");
function isAbsoluteLike(p){return /^[A-Za-z]:[\\/]/.test(p)||p.startsWith("/")||p.startsWith("\\");}
function hasTraversal(p){return p.split(/[\\/]+/).some(x=>x==="..");}
function strictDescendant(root,target){if(!nonEmpty(root)||!nonEmpty(target)||isAbsoluteLike(target)||hasTraversal(target))return false;const r=root.replace(/[\\/]+$/,""),t=target.replace(/^[\\/]+/,"");return nonEmpty(t)&&r+"/"+t!==r&&(r+"/"+t).startsWith(r+"/");}
const result=(outcome,reason=null,resolution=null)=>Object.freeze({outcome,reason,resolution:clone(resolution),authority:AUTHORITY,authorityEffect:"NONE",filesystemToolAuthority:false,effectPerformed:false});
function createRepeatableFilesystemAuthorizedRootResolutionV0({authorizationPort,rootRegistryPort,filesystemObservationPort,resolutionLedger}={}){
 for(const [n,p] of Object.entries({authorizationPort,rootRegistryPort,filesystemObservationPort}))if(typeof p!=="function")throw new TypeError(n+" required");
 if(!resolutionLedger||typeof resolutionLedger.findByAuthorizationId!=="function"||typeof resolutionLedger.commit!=="function")throw new TypeError("resolutionLedger required");
 function resolve(req){
  if(!plain(req)||Object.keys(req).sort().join("|")!==["rulesetVersion","authorizationId"].sort().join("|")||req.rulesetVersion!==RULESET_VERSION||!nonEmpty(req.authorizationId))return result(OUTCOMES.INVALID,"unsupported request schema");
  let a;try{a=authorizationPort({authorizationId:req.authorizationId});}catch(_){return result(OUTCOMES.UNKNOWN,"authorization unavailable");}
  if(!plain(a)||a.authorizationId!==req.authorizationId||a.type!=="GT63_REPEATABLE_FILESYSTEM_EXACT_EFFECT_AUTHORIZATION"||a.authorizationState!=="AUTHORIZED"||a.consumptionState!=="UNCONSUMED"||a.operation!=="CREATE_NEW_FILE"||!nonEmpty(a.authorizedRootIdentity)||a.target?.kind!=="RELATIVE_FILE"||!nonEmpty(a.target.path)||a.precondition?.mustNotExist!==true||a.authority!=="NONE"||a.authorityEffect!=="NONE"||a.effectPerformed!==false)return result(OUTCOMES.UNKNOWN,"authorization invalid, consumed, or widened");
  let reg;try{reg=rootRegistryPort({authorizedRootIdentity:a.authorizedRootIdentity});}catch(_){return result(OUTCOMES.UNKNOWN,"authorized root registry unavailable");}
  if(!plain(reg)||reg.authorizedRootIdentity!==a.authorizedRootIdentity||!nonEmpty(reg.rootPath)||reg.lifecycleState!=="CURRENT"||reg.freshnessState!=="CURRENT"||reg.contradictionState!=="NONE"||reg.authorityEffect!=="NONE")return result(OUTCOMES.UNKNOWN,"authorized root registry invalid or non-current");
  if(!strictDescendant(reg.rootPath,a.target.path))return result(OUTCOMES.NOT_RESOLVED,"target is not a strict descendant of authorized root");
  let obs;try{obs=filesystemObservationPort({rootPath:reg.rootPath,targetPath:a.target.path});}catch(_){return result(OUTCOMES.UNKNOWN,"filesystem observation unavailable");}
  if(!plain(obs)||obs.rootPath!==reg.rootPath||obs.rootExists!==true||obs.rootIsDirectory!==true||obs.targetPath!==a.target.path||obs.targetExists!==false||obs.observationState!=="CURRENT"||obs.contradictionState!=="NONE"||obs.authorityEffect!=="NONE")return result(OUTCOMES.NOT_RESOLVED,"authorized root or create-new precondition not proven");
  const mat={type:"GT63_REPEATABLE_FILESYSTEM_AUTHORIZED_ROOT_RESOLUTION",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,authorizationId:a.authorizationId,authorizedRootIdentity:a.authorizedRootIdentity,rootPath:reg.rootPath,target:clone(a.target),targetExists:false,rootState:"RESOLVED",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:AUTHORITY,authorityEffect:"NONE",filesystemToolAuthority:false,effectPerformed:false};
  const r=Object.freeze({rootResolutionId:"gt63-resolution:repeatable-filesystem-root:"+digest(mat).slice(7),...mat});
  let p;try{p=resolutionLedger.findByAuthorizationId(a.authorizationId);}catch(_){return result(OUTCOMES.UNKNOWN,"resolution ledger unavailable");}
  if(!Array.isArray(p))return result(OUTCOMES.UNKNOWN,"resolution ledger invalid");if(p.length>1)return result(OUTCOMES.CONFLICT,"multiple root resolutions");
  if(p.length===1)return stringify(p[0])===stringify(r)?result(OUTCOMES.ALREADY_RESOLVED,"same root already resolved",p[0]):result(OUTCOMES.CONFLICT,"different root resolution exists");
  let c;try{c=resolutionLedger.commit(r);}catch(_){return result(OUTCOMES.CONFLICT,"resolution commit conflict");}
  return c&&stringify(c)===stringify(r)?result(OUTCOMES.RESOLVED,null,c):result(OUTCOMES.CONFLICT,"resolution ledger returned conflicting material");
 }
 return Object.freeze({resolve,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,strictDescendant,createRepeatableFilesystemAuthorizedRootResolutionV0});
