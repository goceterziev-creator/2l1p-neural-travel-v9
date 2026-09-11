'use strict';

const crypto=require('node:crypto');
const RULESET_VERSION='continuation-authorization-consumption-v0.1.0';
const AUTHORITY='NONE';
const OUTCOMES=Object.freeze({CONSUMED:'CONSUMED',NOT_CONSUMED:'NOT_CONSUMED',UNKNOWN:'UNKNOWN',INVALID:'INVALID'});
function plain(v){return !!(v&&typeof v==='object'&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==='string'&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function canonical(v){return Array.isArray(v)?v.map(canonical):(v&&typeof v==='object'?Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{}):v);}
function stringify(v){return JSON.stringify(canonical(v));}
function digest(v){return `sha256:${crypto.createHash('sha256').update(Buffer.from(stringify(v),'utf8')).digest('hex')}`;}
function exact(o,f){return plain(o)&&Object.keys(o).length===f.length&&Object.keys(o).every(k=>f.includes(k));}
function validScope(s){return plain(s)&&s.scopeType==='GATE'&&nonEmpty(s.interactionId)&&Number.isInteger(s.fromInteractionRevision)&&s.fromInteractionRevision>=0&&Number.isInteger(s.throughInteractionRevision)&&s.throughInteractionRevision===s.fromInteractionRevision&&nonEmpty(s.gateId)&&Number.isInteger(s.gateRevision)&&s.gateRevision>0&&/^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest)&&nonEmpty(s.continuationTargetRef);}
function validAuthorization(a){return plain(a)&&nonEmpty(a.continuationAuthorizationId)&&a.type==='GT63_CONTINUATION_AUTHORIZATION_EVIDENCE'&&a.schemaVersion==='1.0'&&nonEmpty(a.rulesetVersion)&&nonEmpty(a.satisfactionId)&&nonEmpty(a.authorizationBindingId)&&nonEmpty(a.gateRequirementEvidenceRef)&&nonEmpty(a.principalRef)&&nonEmpty(a.principalRevision)&&validScope(a.contextScope)&&a.continuationTargetRef===a.contextScope.continuationTargetRef&&a.authorizationState==='AUTHORIZED'&&a.authority===AUTHORITY&&a.humanGateSatisfied===true&&a.continuationAuthorized===true&&a.continuationExecuted===false&&a.executionAuthorityCreated===false&&a.effectAuthorized===false&&a.effectPerformed===false;}
function result(outcome,reason,evidence=null){return freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:AUTHORITY,humanGateSatisfied:outcome===OUTCOMES.CONSUMED,continuationAuthorized:outcome===OUTCOMES.CONSUMED,continuationExecuted:outcome===OUTCOMES.CONSUMED,executionAuthorityCreated:false,toolInvocationAuthorized:false,effectAuthorized:false,effectPerformed:false});}
function createContinuationAuthorizationConsumption({continuationAuthorizationLedger,continuationConsumptionLedger}={}){
  if(!continuationAuthorizationLedger||typeof continuationAuthorizationLedger.get!=='function')throw new TypeError('continuationAuthorizationLedger.get is required');
  if(!continuationConsumptionLedger||typeof continuationConsumptionLedger.get!=='function'||typeof continuationConsumptionLedger.commit!=='function')throw new TypeError('continuationConsumptionLedger get/commit required');
  function assess(request){
    const fields=['rulesetVersion','continuationAuthorizationId','continuationTargetRef','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','expectedPrincipalRef','expectedPrincipalRevision'];
    if(!exact(request,fields)||request.rulesetVersion!==RULESET_VERSION||!nonEmpty(request.continuationAuthorizationId)||!nonEmpty(request.continuationTargetRef)||!nonEmpty(request.interactionId)||!Number.isInteger(request.interactionRevision)||request.interactionRevision<0||!nonEmpty(request.gateId)||!Number.isInteger(request.gateRevision)||request.gateRevision<1||!/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)||!nonEmpty(request.expectedPrincipalRef)||!nonEmpty(request.expectedPrincipalRevision))return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');
    let raw;try{raw=continuationAuthorizationLedger.get(request.continuationAuthorizationId);}catch(_){return result(OUTCOMES.UNKNOWN,'continuation authorization unavailable');}
    if(raw==null)return result(OUTCOMES.UNKNOWN,'continuation authorization unavailable');
    const list=Array.isArray(raw)?raw:[raw];if(list.length!==1)return result(OUTCOMES.UNKNOWN,'continuation authorization identity conflict');
    const a=list[0];if(!validAuthorization(a)||a.continuationAuthorizationId!==request.continuationAuthorizationId)return result(OUTCOMES.UNKNOWN,'continuation authorization invalid or non-current');
    if(a.principalRef!==request.expectedPrincipalRef||a.principalRevision!==request.expectedPrincipalRevision)return result(OUTCOMES.NOT_CONSUMED,'principal mismatch');
    const s=a.contextScope;
    if(a.continuationTargetRef!==request.continuationTargetRef||s.interactionId!==request.interactionId||s.gateId!==request.gateId||s.gateRevision!==request.gateRevision||s.authorityScopeDigest!==request.authorityScopeDigest)return result(OUTCOMES.NOT_CONSUMED,'continuation scope mismatch');
    if(s.fromInteractionRevision!==request.interactionRevision||s.throughInteractionRevision!==request.interactionRevision)return result(OUTCOMES.NOT_CONSUMED,'continuation authorization stale for requested revision');
    const material={type:'GT63_CONTINUATION_AUTHORIZATION_CONSUMPTION',schemaVersion:'1.0',rulesetVersion:RULESET_VERSION,continuationAuthorizationId:a.continuationAuthorizationId,satisfactionId:a.satisfactionId,authorizationBindingId:a.authorizationBindingId,gateRequirementEvidenceRef:a.gateRequirementEvidenceRef,principalRef:a.principalRef,principalRevision:a.principalRevision,contextScope:clone(s),continuationTargetRef:a.continuationTargetRef,consumptionState:'CONSUMED',authority:AUTHORITY,humanGateSatisfied:true,continuationAuthorized:true,continuationExecuted:true,executionAuthorityCreated:false,toolInvocationAuthorized:false,effectAuthorized:false,effectPerformed:false};
    const evidence=freeze({continuationConsumptionId:`continuation-consumption:${digest(material).slice(7)}`,...material});
    let prior;try{prior=continuationConsumptionLedger.get(evidence.continuationConsumptionId);}catch(_){return result(OUTCOMES.UNKNOWN,'continuation consumption ledger unavailable');}
    if(prior)return stringify(prior)===stringify(evidence)?result(OUTCOMES.CONSUMED,'same continuation consumption already accepted',prior):result(OUTCOMES.UNKNOWN,'continuation consumption identity conflict');
    try{const committed=continuationConsumptionLedger.commit(evidence.continuationConsumptionId,evidence);if(!committed||stringify(committed)!==stringify(evidence))return result(OUTCOMES.UNKNOWN,'continuation consumption ledger commit conflict');}catch(_){return result(OUTCOMES.UNKNOWN,'continuation consumption ledger commit conflict');}
    return result(OUTCOMES.CONSUMED,null,evidence);
  }
  return freeze({rulesetVersion:RULESET_VERSION,authority:AUTHORITY,assess});
}
function createMemoryLedger(){const m=new Map();return freeze({get:k=>m.has(k)?m.get(k):null,commit(k,v){if(m.has(k))throw new Error('immutable-ledger-conflict');m.set(k,freeze(clone(v)));return m.get(k);}});}
module.exports=freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createContinuationAuthorizationConsumption,createMemoryLedger});
