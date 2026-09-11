'use strict';

const crypto=require('node:crypto');
const RULESET_VERSION='human-gate-satisfaction-continuation-authorization-v0.1.0';
const AUTHORITY='NONE';
const OUTCOMES=Object.freeze({AUTHORIZED:'AUTHORIZED',NOT_AUTHORIZED:'NOT_AUTHORIZED',UNKNOWN:'UNKNOWN',INVALID:'INVALID'});
function plain(v){return !!(v&&typeof v==='object'&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==='string'&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function canonical(v){return Array.isArray(v)?v.map(canonical):(v&&typeof v==='object'?Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{}):v);}
function stringify(v){return JSON.stringify(canonical(v));}
function digest(v){return `sha256:${crypto.createHash('sha256').update(Buffer.from(stringify(v),'utf8')).digest('hex')}`;}
function result(outcome,reason,evidence=null){return freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:AUTHORITY,humanGateSatisfied:outcome===OUTCOMES.AUTHORIZED,continuationAuthorized:outcome===OUTCOMES.AUTHORIZED,continuationExecuted:false,executionAuthorityCreated:false,effectAuthorized:false,effectPerformed:false});}
function validScope(s){return plain(s)&&s.scopeType==='GATE'&&nonEmpty(s.interactionId)&&Number.isInteger(s.fromInteractionRevision)&&s.fromInteractionRevision>=0&&Number.isInteger(s.throughInteractionRevision)&&s.throughInteractionRevision===s.fromInteractionRevision&&nonEmpty(s.gateId)&&Number.isInteger(s.gateRevision)&&s.gateRevision>0&&/^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest)&&nonEmpty(s.continuationTargetRef);}
function validSatisfaction(s){return plain(s)&&nonEmpty(s.satisfactionId)&&s.type==='GT63_HUMAN_GATE_AUTHORIZATION_CONSUMPTION'&&s.schemaVersion==='1.0'&&nonEmpty(s.rulesetVersion)&&nonEmpty(s.authorizationBindingId)&&nonEmpty(s.gateRequirementEvidenceRef)&&nonEmpty(s.principalRef)&&nonEmpty(s.principalRevision)&&validScope(s.contextScope)&&s.satisfactionState==='SATISFIED'&&s.authority===AUTHORITY&&s.humanGateSatisfied===true&&s.continuationExecuted===false&&s.executionAuthorityCreated===false&&s.effectPerformed===false;}
function exact(o,fields){return plain(o)&&Object.keys(o).length===fields.length&&Object.keys(o).every(k=>fields.includes(k));}
function createHumanGateSatisfactionContinuationAuthorization({satisfactionLedger,continuationAuthorizationLedger}={}){
  if(!satisfactionLedger||typeof satisfactionLedger.get!=='function')throw new TypeError('satisfactionLedger.get is required');
  if(!continuationAuthorizationLedger||typeof continuationAuthorizationLedger.get!=='function'||typeof continuationAuthorizationLedger.commit!=='function')throw new TypeError('continuationAuthorizationLedger get/commit required');
  function assess(request){
    const fields=['rulesetVersion','satisfactionId','continuationTargetRef','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','expectedPrincipalRef','expectedPrincipalRevision'];
    if(!exact(request,fields)||request.rulesetVersion!==RULESET_VERSION||!nonEmpty(request.satisfactionId)||!nonEmpty(request.continuationTargetRef)||!nonEmpty(request.interactionId)||!Number.isInteger(request.interactionRevision)||request.interactionRevision<0||!nonEmpty(request.gateId)||!Number.isInteger(request.gateRevision)||request.gateRevision<1||!/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)||!nonEmpty(request.expectedPrincipalRef)||!nonEmpty(request.expectedPrincipalRevision))return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');
    let raw;try{raw=satisfactionLedger.get(request.satisfactionId);}catch(_){return result(OUTCOMES.UNKNOWN,'satisfaction evidence unavailable');}
    if(raw==null)return result(OUTCOMES.UNKNOWN,'satisfaction evidence unavailable');
    const list=Array.isArray(raw)?raw:[raw];
    if(list.length!==1)return result(OUTCOMES.UNKNOWN,'satisfaction evidence identity conflict');
    const s=list[0];
    if(!validSatisfaction(s)||s.satisfactionId!==request.satisfactionId)return result(OUTCOMES.UNKNOWN,'satisfaction evidence invalid or non-current');
    const scope=s.contextScope;
    if(s.principalRef!==request.expectedPrincipalRef||s.principalRevision!==request.expectedPrincipalRevision)return result(OUTCOMES.NOT_AUTHORIZED,'principal mismatch');
    if(scope.continuationTargetRef!==request.continuationTargetRef||scope.interactionId!==request.interactionId||scope.gateId!==request.gateId||scope.gateRevision!==request.gateRevision||scope.authorityScopeDigest!==request.authorityScopeDigest)return result(OUTCOMES.NOT_AUTHORIZED,'continuation scope mismatch');
    if(scope.fromInteractionRevision!==request.interactionRevision||scope.throughInteractionRevision!==request.interactionRevision)return result(OUTCOMES.NOT_AUTHORIZED,'satisfaction evidence stale for requested continuation revision');
    const material={type:'GT63_CONTINUATION_AUTHORIZATION_EVIDENCE',schemaVersion:'1.0',rulesetVersion:RULESET_VERSION,satisfactionId:s.satisfactionId,authorizationBindingId:s.authorizationBindingId,gateRequirementEvidenceRef:s.gateRequirementEvidenceRef,principalRef:s.principalRef,principalRevision:s.principalRevision,contextScope:clone(scope),continuationTargetRef:request.continuationTargetRef,authorizationState:'AUTHORIZED',authority:AUTHORITY,humanGateSatisfied:true,continuationAuthorized:true,continuationExecuted:false,executionAuthorityCreated:false,effectAuthorized:false,effectPerformed:false};
    const evidence=freeze({continuationAuthorizationId:`continuation-authorization:${digest(material).slice(7)}`,...material});
    let prior;try{prior=continuationAuthorizationLedger.get(evidence.continuationAuthorizationId);}catch(_){return result(OUTCOMES.UNKNOWN,'continuation authorization ledger unavailable');}
    if(prior)return stringify(prior)===stringify(evidence)?result(OUTCOMES.AUTHORIZED,'same continuation authorization already accepted',prior):result(OUTCOMES.UNKNOWN,'continuation authorization identity conflict');
    try{const committed=continuationAuthorizationLedger.commit(evidence.continuationAuthorizationId,evidence);if(!committed||stringify(committed)!==stringify(evidence))return result(OUTCOMES.UNKNOWN,'continuation authorization ledger commit conflict');}catch(_){return result(OUTCOMES.UNKNOWN,'continuation authorization ledger commit conflict');}
    return result(OUTCOMES.AUTHORIZED,null,evidence);
  }
  return freeze({rulesetVersion:RULESET_VERSION,authority:AUTHORITY,assess});
}
function createMemoryLedger(){const m=new Map();return freeze({get:k=>m.has(k)?m.get(k):null,commit(k,v){if(m.has(k))throw new Error('immutable-ledger-conflict');m.set(k,freeze(clone(v)));return m.get(k);}});}
module.exports=freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createHumanGateSatisfactionContinuationAuthorization,createMemoryLedger});
