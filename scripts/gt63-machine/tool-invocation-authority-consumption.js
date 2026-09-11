'use strict';

const crypto=require('node:crypto');
const RULESET_VERSION='tool-invocation-authority-consumption-v0.1.0';
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
function validToolAuthority(a){return plain(a)&&nonEmpty(a.toolInvocationAuthorityId)&&a.type==='GT63_TOOL_INVOCATION_AUTHORITY_EVIDENCE'&&a.schemaVersion==='1.0'&&nonEmpty(a.rulesetVersion)&&nonEmpty(a.executionAuthorityId)&&nonEmpty(a.continuationConsumptionId)&&nonEmpty(a.principalRef)&&nonEmpty(a.principalRevision)&&validScope(a.contextScope)&&nonEmpty(a.continuationTargetRef)&&nonEmpty(a.executionTargetRef)&&nonEmpty(a.actionType)&&/^sha256:[0-9a-f]{64}$/.test(a.actionContractDigest)&&nonEmpty(a.toolIdentityRef)&&nonEmpty(a.operation)&&/^sha256:[0-9a-f]{64}$/.test(a.invocationContractDigest)&&a.grantState==='GRANTED'&&a.authority===AUTHORITY&&a.executionAuthorityGranted===true&&a.toolInvocationAuthorized===true&&a.toolInvocationExecuted===false&&a.effectAuthorized===false&&a.effectPerformed===false;}
function result(outcome,reason,evidence=null){return freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:AUTHORITY,toolInvocationAuthorized:outcome===OUTCOMES.CONSUMED,toolInvocationExecuted:outcome===OUTCOMES.CONSUMED,effectAuthorized:false,effectPerformed:false});}
function createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger,toolInvocationConsumptionLedger}={}){
  if(!toolInvocationAuthorityLedger||typeof toolInvocationAuthorityLedger.get!=='function')throw new TypeError('toolInvocationAuthorityLedger.get is required');
  if(!toolInvocationConsumptionLedger||typeof toolInvocationConsumptionLedger.get!=='function'||typeof toolInvocationConsumptionLedger.commit!=='function')throw new TypeError('toolInvocationConsumptionLedger get/commit required');
  function assess(request){
    const fields=['rulesetVersion','toolInvocationAuthorityId','continuationTargetRef','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','expectedPrincipalRef','expectedPrincipalRevision','executionTargetRef','actionType','actionContractDigest','toolIdentityRef','operation','invocationContractDigest'];
    if(!exact(request,fields)||request.rulesetVersion!==RULESET_VERSION||!nonEmpty(request.toolInvocationAuthorityId)||!nonEmpty(request.continuationTargetRef)||!nonEmpty(request.interactionId)||!Number.isInteger(request.interactionRevision)||request.interactionRevision<0||!nonEmpty(request.gateId)||!Number.isInteger(request.gateRevision)||request.gateRevision<1||!/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)||!nonEmpty(request.expectedPrincipalRef)||!nonEmpty(request.expectedPrincipalRevision)||!nonEmpty(request.executionTargetRef)||!nonEmpty(request.actionType)||!/^sha256:[0-9a-f]{64}$/.test(request.actionContractDigest)||!nonEmpty(request.toolIdentityRef)||!nonEmpty(request.operation)||!/^sha256:[0-9a-f]{64}$/.test(request.invocationContractDigest))return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');
    let raw;try{raw=toolInvocationAuthorityLedger.get(request.toolInvocationAuthorityId);}catch(_){return result(OUTCOMES.UNKNOWN,'tool invocation authority unavailable');}
    if(raw==null)return result(OUTCOMES.UNKNOWN,'tool invocation authority unavailable');
    const list=Array.isArray(raw)?raw:[raw];if(list.length!==1)return result(OUTCOMES.UNKNOWN,'tool invocation authority identity conflict');
    const a=list[0];if(!validToolAuthority(a)||a.toolInvocationAuthorityId!==request.toolInvocationAuthorityId)return result(OUTCOMES.UNKNOWN,'tool invocation authority invalid or non-current');
    if(a.principalRef!==request.expectedPrincipalRef||a.principalRevision!==request.expectedPrincipalRevision)return result(OUTCOMES.NOT_CONSUMED,'principal mismatch');
    const s=a.contextScope;
    if(a.continuationTargetRef!==request.continuationTargetRef||s.interactionId!==request.interactionId||s.gateId!==request.gateId||s.gateRevision!==request.gateRevision||s.authorityScopeDigest!==request.authorityScopeDigest)return result(OUTCOMES.NOT_CONSUMED,'scope mismatch');
    if(s.fromInteractionRevision!==request.interactionRevision||s.throughInteractionRevision!==request.interactionRevision)return result(OUTCOMES.NOT_CONSUMED,'tool invocation authority stale for requested revision');
    if(a.executionTargetRef!==request.executionTargetRef||a.actionType!==request.actionType||a.actionContractDigest!==request.actionContractDigest)return result(OUTCOMES.NOT_CONSUMED,'execution contract mismatch');
    if(a.toolIdentityRef!==request.toolIdentityRef||a.operation!==request.operation||a.invocationContractDigest!==request.invocationContractDigest)return result(OUTCOMES.NOT_CONSUMED,'invocation contract mismatch');
    const material={type:'GT63_TOOL_INVOCATION_AUTHORITY_CONSUMPTION',schemaVersion:'1.0',rulesetVersion:RULESET_VERSION,toolInvocationAuthorityId:a.toolInvocationAuthorityId,executionAuthorityId:a.executionAuthorityId,continuationConsumptionId:a.continuationConsumptionId,principalRef:a.principalRef,principalRevision:a.principalRevision,contextScope:clone(s),continuationTargetRef:a.continuationTargetRef,executionTargetRef:a.executionTargetRef,actionType:a.actionType,actionContractDigest:a.actionContractDigest,toolIdentityRef:a.toolIdentityRef,operation:a.operation,invocationContractDigest:a.invocationContractDigest,consumptionState:'CONSUMED',authority:AUTHORITY,executionAuthorityGranted:true,toolInvocationAuthorized:true,toolInvocationExecuted:true,effectAuthorized:false,effectPerformed:false};
    const evidence=freeze({toolInvocationConsumptionId:`tool-invocation-consumption:${digest(material).slice(7)}`,...material});
    let prior;try{prior=toolInvocationConsumptionLedger.get(evidence.toolInvocationConsumptionId);}catch(_){return result(OUTCOMES.UNKNOWN,'tool invocation consumption ledger unavailable');}
    if(prior)return stringify(prior)===stringify(evidence)?result(OUTCOMES.CONSUMED,'same tool invocation consumption already accepted',prior):result(OUTCOMES.UNKNOWN,'tool invocation consumption identity conflict');
    try{const committed=toolInvocationConsumptionLedger.commit(evidence.toolInvocationConsumptionId,evidence);if(!committed||stringify(committed)!==stringify(evidence))return result(OUTCOMES.UNKNOWN,'tool invocation consumption ledger commit conflict');}catch(_){return result(OUTCOMES.UNKNOWN,'tool invocation consumption ledger commit conflict');}
    return result(OUTCOMES.CONSUMED,null,evidence);
  }
  return freeze({rulesetVersion:RULESET_VERSION,authority:AUTHORITY,assess});
}
function createMemoryLedger(){const m=new Map();return freeze({get:k=>m.has(k)?m.get(k):null,commit(k,v){if(m.has(k))throw new Error('immutable-ledger-conflict');m.set(k,freeze(clone(v)));return m.get(k);}});}
module.exports=freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createToolInvocationAuthorityConsumption,createMemoryLedger});
