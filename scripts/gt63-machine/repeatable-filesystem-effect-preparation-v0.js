"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="repeatable-filesystem-effect-preparation-v0.1.0",AUTHORITY="NONE";
const OUTCOMES=Object.freeze({READY:"READY",ALREADY_READY:"ALREADY_READY",NOT_READY:"NOT_READY",UNKNOWN:"UNKNOWN",CONFLICT:"CONFLICT",INVALID:"INVALID"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v)),nonEmpty=v=>typeof v==="string"&&v.length>0,clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
const stringify=v=>JSON.stringify(canonical(v)),digest=v=>"sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");
const result=(outcome,reason=null,execution=null)=>Object.freeze({outcome,reason,execution:clone(execution),authority:AUTHORITY,authorityEffect:"NONE",effectPerformed:false,effectVerified:false});
function createRepeatableFilesystemEffectPreparationV0({authorizationPort,rootResolutionPort,toolAuthorityPort,executionLedger}={}){
 for(const [n,p] of Object.entries({authorizationPort,rootResolutionPort,toolAuthorityPort}))if(typeof p!=="function")throw new TypeError(n+" required");
 if(!executionLedger||typeof executionLedger.findByAuthorizationId!=="function"||typeof executionLedger.commit!=="function")throw new TypeError("executionLedger required");
 function prepare(req){
  if(!plain(req)||Object.keys(req).sort().join("|")!==["rulesetVersion","authorizationId"].sort().join("|")||req.rulesetVersion!==RULESET_VERSION||!nonEmpty(req.authorizationId))return result(OUTCOMES.INVALID,"unsupported request schema");
  let a;try{a=authorizationPort({authorizationId:req.authorizationId});}catch(_){return result(OUTCOMES.UNKNOWN,"authorization unavailable");}
  if(!plain(a)||a.authorizationId!==req.authorizationId||a.authorizationState!=="AUTHORIZED"||a.consumptionState!=="UNCONSUMED"||a.operation!=="CREATE_NEW_FILE"||a.precondition?.mustNotExist!==true||a.authority!=="NONE"||a.authorityEffect!=="NONE"||a.effectPerformed!==false)return result(OUTCOMES.NOT_READY,"authorization invalid, consumed, or widened");
  let root;try{root=rootResolutionPort({authorizationId:a.authorizationId,authorizedRootIdentity:a.authorizedRootIdentity,target:a.target});}catch(_){return result(OUTCOMES.UNKNOWN,"root resolution unavailable");}
  if(!plain(root)||root.authorizationId!==a.authorizationId||root.authorizedRootIdentity!==a.authorizedRootIdentity||root.rootState!=="RESOLVED"||root.target?.kind!=="RELATIVE_FILE"||root.target.path!==a.target.path||root.targetExists!==false||root.lifecycleState!=="CURRENT"||root.freshnessState!=="CURRENT"||root.contradictionState!=="NONE"||root.authorityEffect!=="NONE")return result(OUTCOMES.NOT_READY,"root or create-new precondition not proven");
  let ad;try{ad=adapterPort({capability:"CREATE_NEW_FILE"});}catch(_){return result(OUTCOMES.UNKNOWN,"adapter unavailable");}
  if(!plain(ad)||ad.capability!=="CREATE_NEW_FILE"||ad.lifecycleState!=="CURRENT"||ad.freshnessState!=="CURRENT"||ad.contradictionState!=="NONE"||ad.authorityEffect!=="NONE")return result(OUTCOMES.NOT_READY,"adapter invalid");
  const mat={type:"GT63_REPEATABLE_FILESYSTEM_EFFECT_EXECUTION_PREPARATION",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,authorizationId:a.authorizationId,effectContractId:a.effectContractId,toolAuthorityId:t.toolAuthorityId,adapterRef:t.adapterRef,adapterRevision:t.adapterRevision,operation:"CREATE_NEW_FILE",rootPath:root.rootPath,relativeTargetPath:a.target.path,payload:clone(a.payload),expectedPostcondition:clone(a.expectedPostcondition),mustNotExist:true,executionState:"READY",authority:AUTHORITY,authorityEffect:"NONE",effectPerformed:false,effectVerified:false};
  const e=Object.freeze({executionPreparationId:"gt63-execution:repeatable-filesystem:"+digest(mat).slice(7),...mat});
  let p;try{p=executionLedger.findByAuthorizationId(a.authorizationId);}catch(_){return result(OUTCOMES.UNKNOWN,"execution ledger unavailable");}
  if(!Array.isArray(p))return result(OUTCOMES.UNKNOWN,"execution ledger invalid");if(p.length>1)return result(OUTCOMES.CONFLICT,"multiple preparations");
  if(p.length===1)return stringify(p[0])===stringify(e)?result(OUTCOMES.ALREADY_READY,"same preparation already captured",p[0]):result(OUTCOMES.CONFLICT,"different preparation exists");
  let c;try{c=executionLedger.commit(e);}catch(_){return result(OUTCOMES.CONFLICT,"execution commit conflict");}
  return c&&stringify(c)===stringify(e)?result(OUTCOMES.READY,null,c):result(OUTCOMES.CONFLICT,"execution ledger returned conflicting material");
 }
 return Object.freeze({prepare,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createRepeatableFilesystemEffectPreparationV0});
