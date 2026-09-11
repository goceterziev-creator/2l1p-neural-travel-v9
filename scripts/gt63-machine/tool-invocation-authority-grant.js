'use strict';

const crypto=require('node:crypto');
const RULESET_VERSION='tool-invocation-authority-grant-v0.1.0';
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
function validExecutionAuthority(e){return plain(e)&&nonEmpty(e.executionAuthorityId)&&e.type==='GT63_EXECUTION_AUTHORITY_EVIDENCE'&&e.schemaVersion==='1.0'&&nonEmpty(e.rulesetVersion)&&nonEmpty(e.continuationConsumptionId)&&nonEmpty(e.continuationAuthorizationId)&&nonEmpty(e.satisfactionId)&&nonEmpty(e.authorizationBindingId)&&nonEmpty(e.gateRequirementEvidenceRef)&&nonEmpty(e.principalRef)&&nonEmpty(e.principalRevision)&&validScope(e.contextScope)&&e.continuationTargetRef===e.contextScope.continuationTargetRef&&nonEmpty(e.executionTargetRef)&&nonEmpty(e.actionType)&&/^sha256:[0-9a-f]{64}$/.test(e.actionContractDigest)&&e.grantState==='GRANTED'&&e.authority===AUTHORITY&&e.humanGateSatisfied===true&&e.continuationAuthorized===true&&e.continuationExecuted===true&&e.executionAuthorityGranted===true&&e.toolInvocationAuthorized===false&&e.effectAuthorized===false&&e.effectPerformed===false;}
function validInvocationContract(c){return plain(c)&&exact(c,['toolIdentityRef','operation','invocationContractDigest'])&&nonEmpty(c.toolIdentityRef)&&nonEmpty(c.operation)&&/^sha256:[0-9a-f]{64}$/.test(c.invocationContractDigest);}
function result(outcome,reason,evidence=null){return freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:AUTHORITY,toolInvocationAuthorityGranted:outcome===OUTCOMES.GRANTED,toolInvocationExecuted:false,effectAuthorized:false,effectPerformed:false});}
function createToolInvocationAuthorityGrant({executionAuthorityLedger,toolInvocationAuthorityLedger}={}){
  if(!executionAuthorityLedger||typeof executionAuthorityLedger.get!=='function')throw new TypeError('executionAuthorityLedger.get is required');
  if(!toolInvocationAuthorityLedger||typeof toolInvocationAuthorityLedger.get!=='function'||typeof toolInvocationAuthorityLedger.commit!=='function')throw new TypeError('toolInvocationAuthorityLedger get/commit required');
  function assess(request){
    const fields=['rulesetVersion','executionAuthorityId','continuationTargetRef','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','expectedPrincipalRef','expectedPrincipalRevision','executionTargetRef','actionType','actionContractDigest','invocationContract'];
    if(!exact(request,fields)||request.rulesetVersion!==RULESET_VERSION||!nonEmpty(request.executionAuthorityId)||!nonEmpty(request.continuationTargetRef)||!nonEmpty(request.interactionId)||!Number.isInteger(request.interactionRevision)||request.interactionRevision<0||!nonEmpty(request.gateId)||!Number.isInteger(request.gateRevision)||request.gateRevision<1||!/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)||!nonEmpty(request.expectedPrincipalRef)||!nonEmpty(request.expectedPrincipalRevision)||!nonEmpty(request.executionTargetRef)||!nonEmpty(request.actionType)||!/^sha256:[0-9a-f]{64}$/.test(request.actionContractDigest)||!validInvocationContract(request.invocationContract))return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');
    let raw;try{raw=executionAuthorityLedger.get(request.executionAuthorityId);}catch(_){return result(OUTCOMES.UNKNOWN,'execution authority unavailable');}
    if(raw==null)return result(OUTCOMES.UNKNOWN,'execution authority unavailable');
    const list=Array.isArray(raw)?raw:[raw];if(list.length!==1)return result(OUTCOMES.UNKNOWN,'execution authority identity conflict');
    const e=list[0];if(!validExecutionAuthority(e)||e.executionAuthorityId!==request.executionAuthorityId)return result(OUTCOMES.UNKNOWN,'execution authority invalid or non-current');
    if(e.principalRef!==request.expectedPrincipalRef||e.principalRevision!==request.expectedPrincipalRevision)return result(OUTCOMES.NOT_GRANTED,'principal mismatch');
    const s=e.contextScope;
    if(e.continuationTargetRef!==request.continuationTargetRef||s.interactionId!==request.interactionId||s.gateId!==request.gateId||s.gateRevision!==request.gateRevision||s.authorityScopeDigest!==request.authorityScopeDigest)return result(OUTCOMES.NOT_GRANTED,'continuation scope mismatch');
    if(s.fromInteractionRevision!==request.interactionRevision||s.throughInteractionRevision!==request.interactionRevision)return result(OUTCOMES.NOT_GRANTED,'execution authority stale for requested revision');
    if(e.executionTargetRef!==request.executionTargetRef||e.actionType!==request.actionType||e.actionContractDigest!==request.actionContractDigest)return result(OUTCOMES.NOT_GRANTED,'execution action contract mismatch');
    const material={type:'GT63_TOOL_INVOCATION_AUTHORITY_EVIDENCE',schemaVersion:'1.0',rulesetVersion:RULESET_VERSION,executionAuthorityId:e.executionAuthorityId,continuationConsumptionId:e.continuationConsumptionId,continuationAuthorizationId:e.continuationAuthorizationId,satisfactionId:e.satisfactionId,authorizationBindingId:e.authorizationBindingId,gateRequirementEvidenceRef:e.gateRequirementEvidenceRef,principalRef:e.principalRef,principalRevision:e.principalRevision,contextScope:clone(s),continuationTargetRef:e.continuationTargetRef,executionTargetRef:e.executionTargetRef,actionType:e.actionType,actionContractDigest:e.actionContractDigest,toolIdentityRef:request.invocationContract.toolIdentityRef,operation:request.invocationContract.operation,invocationContractDigest:request.invocationContract.invocationContractDigest,grantState:'GRANTED',authority:AUTHORITY,humanGateSatisfied:true,continuationAuthorized:true,continuationExecuted:true,executionAuthorityGranted:true,toolInvocationAuthorityGranted:true,toolInvocationExecuted:false,effectAuthorized:false,effectPerformed:false};
    const evidence=freeze({toolInvocationAuthorityId:`tool-invocation-authority:${digest(material).slice(7)}`,...material});
    let prior;try{prior=toolInvocationAuthorityLedger.get(evidence.toolInvocationAuthorityId);}catch(_){return result(OUTCOMES.UNKNOWN,'tool invocation authority ledger unavailable');}
    if(prior)return stringify(prior)===stringify(evidence)?result(OUTCOMES.GRANTED,'same tool invocation authority already accepted',prior):result(OUTCOMES.UNKNOWN,'tool invocation authority identity conflict');
    try{const committed=toolInvocationAuthorityLedger.commit(evidence.toolInvocationAuthorityId,evidence);if(!committed||stringify(committed)!==stringify(evidence))return result(OUTCOMES.UNKNOWN,'tool invocation authority ledger commit conflict');}catch(_){return result(OUTCOMES.UNKNOWN,'tool invocation authority ledger commit conflict');}
    return result(OUTCOMES.GRANTED,null,evidence);
  }
  return freeze({rulesetVersion:RULESET_VERSION,authority:AUTHORITY,assess});
}
function createMemoryLedger(){const m=new Map();return freeze({get:k=>m.has(k)?m.get(k):null,commit(k,v){if(m.has(k))throw new Error('immutable-ledger-conflict');m.set(k,freeze(clone(v)));return m.get(k);}});}
module.exports=freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createToolInvocationAuthorityGrant,createMemoryLedger});
