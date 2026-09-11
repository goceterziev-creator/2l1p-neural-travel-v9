'use strict';

const crypto=require('node:crypto');
const RULESET_VERSION='execution-authority-grant-v0.1.0';
const AUTHORITY='NONE';
const OUTCOMES=Object.freeze({GRANTED:'GRANTED',NOT_GRANTED:'NOT_GRANTED',UNKNOWN:'UNKNOWN',INVALID:'INVALID'});
function plain(v){return !!(v&&typeof v==='object'&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==='string'&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function canonical(v){return Array.isArray(v)?v.map(canonical):(v&&typeof v==='object'?Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{}):v);}
function stringify(v){return JSON.stringify(canonical(v));}
function digest(v){return `sha256:${crypto.createHash('sha256').update(Buffer.from(stringify(v),'utf8')).digest('hex')}`;}
function exact(o,f){return plain(o)&&Object.keys(o).length===f.length&&Object.keys(o).every(k=>f.includes(k));}
function validScope(s){return plain(s)&&s.scopeType==='GATE'&&nonEmpty(s.interactionId)&&Number.isInteger(s.fromInteractionRevision)&&s.fromInteractionRevision>=0&&Number.isInteger(s.throughInteractionRevision)&&s.throughInteractionRevision===s.fromInteractionRevision&&nonEmpty(s.gateId)&&Number.isInteger(s.gateRevision)&&s.gateRevision>0&&/^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest)&&nonEmpty(s.continuationTargetRef);}
function validConsumption(c){return plain(c)&&nonEmpty(c.continuationConsumptionId)&&c.type==='GT63_CONTINUATION_AUTHORIZATION_CONSUMPTION'&&c.schemaVersion==='1.0'&&nonEmpty(c.rulesetVersion)&&nonEmpty(c.continuationAuthorizationId)&&nonEmpty(c.satisfactionId)&&nonEmpty(c.authorizationBindingId)&&nonEmpty(c.gateRequirementEvidenceRef)&&nonEmpty(c.principalRef)&&nonEmpty(c.principalRevision)&&validScope(c.contextScope)&&c.continuationTargetRef===c.contextScope.continuationTargetRef&&c.consumptionState==='CONSUMED'&&c.authority===AUTHORITY&&c.humanGateSatisfied===true&&c.continuationAuthorized===true&&c.continuationExecuted===true&&c.executionAuthorityCreated===false&&c.toolInvocationAuthorized===false&&c.effectAuthorized===false&&c.effectPerformed===false;}
function validActionContract(a){return plain(a)&&exact(a,['executionTargetRef','actionType','actionContractDigest'])&&nonEmpty(a.executionTargetRef)&&nonEmpty(a.actionType)&&/^sha256:[0-9a-f]{64}$/.test(a.actionContractDigest);}
function result(outcome,reason,evidence=null){return freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:AUTHORITY,executionAuthorityGranted:outcome===OUTCOMES.GRANTED,toolInvocationAuthorized:false,effectAuthorized:false,effectPerformed:false});}
function createExecutionAuthorityGrant({continuationConsumptionLedger,executionAuthorityLedger}={}){
  if(!continuationConsumptionLedger||typeof continuationConsumptionLedger.get!=='function')throw new TypeError('continuationConsumptionLedger.get is required');
  if(!executionAuthorityLedger||typeof executionAuthorityLedger.get!=='function'||typeof executionAuthorityLedger.commit!=='function')throw new TypeError('executionAuthorityLedger get/commit required');
  function assess(request){
    const fields=['rulesetVersion','continuationConsumptionId','continuationTargetRef','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','expectedPrincipalRef','expectedPrincipalRevision','actionContract'];
    if(!exact(request,fields)||request.rulesetVersion!==RULESET_VERSION||!nonEmpty(request.continuationConsumptionId)||!nonEmpty(request.continuationTargetRef)||!nonEmpty(request.interactionId)||!Number.isInteger(request.interactionRevision)||request.interactionRevision<0||!nonEmpty(request.gateId)||!Number.isInteger(request.gateRevision)||request.gateRevision<1||!/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)||!nonEmpty(request.expectedPrincipalRef)||!nonEmpty(request.expectedPrincipalRevision)||!validActionContract(request.actionContract))return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');
    let raw;try{raw=continuationConsumptionLedger.get(request.continuationConsumptionId);}catch(_){return result(OUTCOMES.UNKNOWN,'continuation consumption unavailable');}
    if(raw==null)return result(OUTCOMES.UNKNOWN,'continuation consumption unavailable');
    const list=Array.isArray(raw)?raw:[raw];if(list.length!==1)return result(OUTCOMES.UNKNOWN,'continuation consumption identity conflict');
    const c=list[0];if(!validConsumption(c)||c.continuationConsumptionId!==request.continuationConsumptionId)return result(OUTCOMES.UNKNOWN,'continuation consumption invalid or non-current');
    if(c.principalRef!==request.expectedPrincipalRef||c.principalRevision!==request.expectedPrincipalRevision)return result(OUTCOMES.NOT_GRANTED,'principal mismatch');
    const s=c.contextScope;
    if(c.continuationTargetRef!==request.continuationTargetRef||s.interactionId!==request.interactionId||s.gateId!==request.gateId||s.gateRevision!==request.gateRevision||s.authorityScopeDigest!==request.authorityScopeDigest)return result(OUTCOMES.NOT_GRANTED,'continuation scope mismatch');
    if(s.fromInteractionRevision!==request.interactionRevision||s.throughInteractionRevision!==request.interactionRevision)return result(OUTCOMES.NOT_GRANTED,'continuation consumption stale for requested revision');
    const material={type:'GT63_EXECUTION_AUTHORITY_EVIDENCE',schemaVersion:'1.0',rulesetVersion:RULESET_VERSION,continuationConsumptionId:c.continuationConsumptionId,continuationAuthorizationId:c.continuationAuthorizationId,satisfactionId:c.satisfactionId,authorizationBindingId:c.authorizationBindingId,gateRequirementEvidenceRef:c.gateRequirementEvidenceRef,principalRef:c.principalRef,principalRevision:c.principalRevision,contextScope:clone(s),continuationTargetRef:c.continuationTargetRef,executionTargetRef:request.actionContract.executionTargetRef,actionType:request.actionContract.actionType,actionContractDigest:request.actionContract.actionContractDigest,grantState:'GRANTED',authority:AUTHORITY,humanGateSatisfied:true,continuationAuthorized:true,continuationExecuted:true,executionAuthorityGranted:true,toolInvocationAuthorized:false,effectAuthorized:false,effectPerformed:false};
    const evidence=freeze({executionAuthorityId:`execution-authority:${digest(material).slice(7)}`,...material});
    let prior;try{prior=executionAuthorityLedger.get(evidence.executionAuthorityId);}catch(_){return result(OUTCOMES.UNKNOWN,'execution authority ledger unavailable');}
    if(prior)return stringify(prior)===stringify(evidence)?result(OUTCOMES.GRANTED,'same execution authority already accepted',prior):result(OUTCOMES.UNKNOWN,'execution authority identity conflict');
    try{const committed=executionAuthorityLedger.commit(evidence.executionAuthorityId,evidence);if(!committed||stringify(committed)!==stringify(evidence))return result(OUTCOMES.UNKNOWN,'execution authority ledger commit conflict');}catch(_){return result(OUTCOMES.UNKNOWN,'execution authority ledger commit conflict');}
    return result(OUTCOMES.GRANTED,null,evidence);
  }
  return freeze({rulesetVersion:RULESET_VERSION,authority:AUTHORITY,assess});
}
function createMemoryLedger(){const m=new Map();return freeze({get:k=>m.has(k)?m.get(k):null,commit(k,v){if(m.has(k))throw new Error('immutable-ledger-conflict');m.set(k,freeze(clone(v)));return m.get(k);}});}
module.exports=freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createExecutionAuthorityGrant,createMemoryLedger});
