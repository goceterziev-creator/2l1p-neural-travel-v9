'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'continuation-completion-observation-current-evidence-binding-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({ OBSERVED:'OBSERVED', NOT_OBSERVED:'NOT_OBSERVED', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const plain = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const nonEmpty = value => typeof value === 'string' && value.length > 0;
const canonical = value => Array.isArray(value) ? value.map(canonical) : (plain(value) ? Object.keys(value).sort().reduce((out,key)=>(out[key]=canonical(value[key]),out),{}) : value);
const stringify = value => JSON.stringify(canonical(value));
const digest = value => `sha256:${crypto.createHash('sha256').update(Buffer.from(stringify(value),'utf8')).digest('hex')}`;

function validScope(scope){
  return Boolean(plain(scope)
    && scope.scopeType === 'GATE'
    && nonEmpty(scope.interactionId)
    && Number.isInteger(scope.fromInteractionRevision) && scope.fromInteractionRevision >= 0
    && (scope.throughInteractionRevision === null || (Number.isInteger(scope.throughInteractionRevision) && scope.throughInteractionRevision >= scope.fromInteractionRevision))
    && nonEmpty(scope.gateId)
    && Number.isInteger(scope.gateRevision) && scope.gateRevision > 0
    && /^sha256:[0-9a-f]{64}$/.test(scope.authorityScopeDigest)
    && nonEmpty(scope.continuationTargetRef));
}

function result(outcome, reason, observation=null){
  return Object.freeze({
    rulesetVersion:RULESET_VERSION,
    outcome,
    reason:reason||null,
    observation:clone(observation),
    authority:AUTHORITY,
    executionStarted:outcome===OUTCOMES.OBSERVED || outcome===OUTCOMES.NOT_OBSERVED,
    executionSucceeded:false,
    continuationExecuted:outcome===OUTCOMES.OBSERVED,
    effectAuthorized:false,
    effectPerformed:false,
    effectVerified:false
  });
}

function validStartObservation(wrapper){
  const o=wrapper && wrapper.observation;
  return Boolean(plain(wrapper)
    && wrapper.outcome==='OBSERVED'
    && wrapper.authority===AUTHORITY
    && wrapper.executionStarted===true
    && wrapper.executionSucceeded===false
    && wrapper.continuationExecuted===false
    && wrapper.effectAuthorized===false
    && wrapper.effectPerformed===false
    && wrapper.effectVerified===false
    && plain(o)
    && o.type==='GT63_EXECUTION_START_OBSERVATION'
    && nonEmpty(o.executionStartObservationId)
    && nonEmpty(o.executionStartId)
    && nonEmpty(o.currentExecutionStartEvidenceRef)
    && nonEmpty(o.runtimeStartEvidenceRef)
    && /^sha256:[0-9a-f]{64}$/.test(o.executionStartDigest)
    && nonEmpty(o.executionIntentId)
    && nonEmpty(o.currentExecutionIntentEvidenceRef)
    && nonEmpty(o.executionStartRequirementEvidenceRef)
    && nonEmpty(o.invocationId)
    && /^sha256:[0-9a-f]{64}$/.test(o.invocationDigest)
    && nonEmpty(o.principalRef)
    && nonEmpty(o.principalRevision)
    && nonEmpty(o.executionTargetRef)
    && validScope(o.contextScope)
    && o.observationState==='OBSERVED'
    && o.authority===AUTHORITY
    && o.executionStarted===true
    && o.executionSucceeded===false
    && o.continuationExecuted===false
    && o.effectAuthorized===false
    && o.effectPerformed===false
    && o.effectVerified===false);
}

function validCompletionEvidence(wrapper){
  const e=wrapper && wrapper.evidence;
  return Boolean(plain(wrapper)
    && wrapper.outcome==='OBSERVED'
    && wrapper.authority===AUTHORITY
    && wrapper.executionStarted===true
    && wrapper.executionSucceeded===false
    && wrapper.continuationExecuted===true
    && wrapper.effectAuthorized===false
    && wrapper.effectPerformed===false
    && wrapper.effectVerified===false
    && plain(e)
    && e.type==='GT63_RUNTIME_CONTINUATION_COMPLETION_EVIDENCE'
    && nonEmpty(e.runtimeCompletionEvidenceRef)
    && nonEmpty(e.executionStartObservationId)
    && nonEmpty(e.executionStartId)
    && nonEmpty(e.currentExecutionStartEvidenceRef)
    && nonEmpty(e.runtimeStartEvidenceRef)
    && /^sha256:[0-9a-f]{64}$/.test(e.executionStartDigest)
    && nonEmpty(e.executionIntentId)
    && nonEmpty(e.currentExecutionIntentEvidenceRef)
    && nonEmpty(e.executionStartRequirementEvidenceRef)
    && nonEmpty(e.invocationId)
    && /^sha256:[0-9a-f]{64}$/.test(e.invocationDigest)
    && nonEmpty(e.runtimeOccurrenceRef)
    && /^sha256:[0-9a-f]{64}$/.test(e.runtimeOccurrenceDigest)
    && nonEmpty(e.runtimeCompletionRef)
    && /^sha256:[0-9a-f]{64}$/.test(e.runtimeCompletionDigest)
    && nonEmpty(e.principalRef)
    && nonEmpty(e.principalRevision)
    && nonEmpty(e.executionTargetRef)
    && validScope(e.contextScope)
    && e.lifecycleState==='CURRENT'
    && e.freshnessState==='CURRENT'
    && e.contradictionState==='NONE'
    && e.authority===AUTHORITY
    && e.executionStarted===true
    && e.executionSucceeded===false
    && e.continuationExecuted===true
    && e.effectAuthorized===false
    && e.effectPerformed===false
    && e.effectVerified===false);
}

function createContinuationCompletionObservationCurrentEvidenceBinding({ executionStartObservationPort, runtimeCompletionEvidencePort, observationLedger } = {}){
  if(typeof executionStartObservationPort!=='function') throw new TypeError('executionStartObservationPort must be a function');
  if(typeof runtimeCompletionEvidencePort!=='function') throw new TypeError('runtimeCompletionEvidencePort must be a function');
  if(!observationLedger || typeof observationLedger.get!=='function' || typeof observationLedger.commit!=='function') throw new TypeError('observationLedger required');

  function assess(request){
    const fields=['rulesetVersion','executionStartObservationId','runtimeCompletionEvidenceRef','executionStartId','currentExecutionStartEvidenceRef','runtimeStartEvidenceRef','executionStartDigest','executionIntentId','currentExecutionIntentEvidenceRef','executionStartRequirementEvidenceRef','invocationId','invocationDigest','runtimeOccurrenceRef','runtimeOccurrenceDigest','runtimeCompletionRef','runtimeCompletionDigest','expectedPrincipalRef','expectedPrincipalRevision','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','executionTargetRef'];
    if(!plain(request)
      || Object.keys(request).length!==fields.length
      || Object.keys(request).some(key=>!fields.includes(key))
      || request.rulesetVersion!==RULESET_VERSION
      || !nonEmpty(request.executionStartObservationId)
      || !nonEmpty(request.runtimeCompletionEvidenceRef)
      || !nonEmpty(request.executionStartId)
      || !nonEmpty(request.currentExecutionStartEvidenceRef)
      || !nonEmpty(request.runtimeStartEvidenceRef)
      || !/^sha256:[0-9a-f]{64}$/.test(request.executionStartDigest)
      || !nonEmpty(request.executionIntentId)
      || !nonEmpty(request.currentExecutionIntentEvidenceRef)
      || !nonEmpty(request.executionStartRequirementEvidenceRef)
      || !nonEmpty(request.invocationId)
      || !/^sha256:[0-9a-f]{64}$/.test(request.invocationDigest)
      || !nonEmpty(request.runtimeOccurrenceRef)
      || !/^sha256:[0-9a-f]{64}$/.test(request.runtimeOccurrenceDigest)
      || !nonEmpty(request.runtimeCompletionRef)
      || !/^sha256:[0-9a-f]{64}$/.test(request.runtimeCompletionDigest)
      || !nonEmpty(request.expectedPrincipalRef)
      || !nonEmpty(request.expectedPrincipalRevision)
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision) || request.interactionRevision<0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision) || request.gateRevision<1
      || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.executionTargetRef)) return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');

    let startWrapper;
    try { startWrapper=executionStartObservationPort({executionStartObservationId:request.executionStartObservationId}); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'execution start observation unavailable'); }
    if(!validStartObservation(startWrapper)) return result(OUTCOMES.UNKNOWN,'execution start observation invalid');

    let completionWrapper;
    try { completionWrapper=runtimeCompletionEvidencePort({runtimeCompletionEvidenceRef:request.runtimeCompletionEvidenceRef}); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'runtime completion evidence unavailable'); }
    if(completionWrapper && completionWrapper.outcome==='NOT_OBSERVED') return result(OUTCOMES.NOT_OBSERVED,'runtime continuation completion not observed');
    if(!validCompletionEvidence(completionWrapper)) return result(OUTCOMES.UNKNOWN,'runtime completion evidence invalid or non-current');

    const o=startWrapper.observation;
    const e=completionWrapper.evidence;

    if(o.executionStartObservationId!==request.executionStartObservationId || e.runtimeCompletionEvidenceRef!==request.runtimeCompletionEvidenceRef) return result(OUTCOMES.UNKNOWN,'upstream evidence reference mismatch');

    if(o.executionStartObservationId!==e.executionStartObservationId
      || o.executionStartId!==request.executionStartId || e.executionStartId!==request.executionStartId
      || o.currentExecutionStartEvidenceRef!==request.currentExecutionStartEvidenceRef || e.currentExecutionStartEvidenceRef!==request.currentExecutionStartEvidenceRef
      || o.runtimeStartEvidenceRef!==request.runtimeStartEvidenceRef || e.runtimeStartEvidenceRef!==request.runtimeStartEvidenceRef
      || o.executionStartDigest!==request.executionStartDigest || e.executionStartDigest!==request.executionStartDigest
      || o.executionIntentId!==request.executionIntentId || e.executionIntentId!==request.executionIntentId
      || o.currentExecutionIntentEvidenceRef!==request.currentExecutionIntentEvidenceRef || e.currentExecutionIntentEvidenceRef!==request.currentExecutionIntentEvidenceRef
      || o.executionStartRequirementEvidenceRef!==request.executionStartRequirementEvidenceRef || e.executionStartRequirementEvidenceRef!==request.executionStartRequirementEvidenceRef
      || o.invocationId!==request.invocationId || e.invocationId!==request.invocationId
      || o.invocationDigest!==request.invocationDigest || e.invocationDigest!==request.invocationDigest
      || e.runtimeOccurrenceRef!==request.runtimeOccurrenceRef || e.runtimeOccurrenceDigest!==request.runtimeOccurrenceDigest
      || e.runtimeCompletionRef!==request.runtimeCompletionRef || e.runtimeCompletionDigest!==request.runtimeCompletionDigest
      || o.principalRef!==request.expectedPrincipalRef || e.principalRef!==request.expectedPrincipalRef
      || o.principalRevision!==request.expectedPrincipalRevision || e.principalRevision!==request.expectedPrincipalRevision
      || o.executionTargetRef!==request.executionTargetRef || e.executionTargetRef!==request.executionTargetRef) return result(OUTCOMES.NOT_OBSERVED,'completion evidence identity mismatch');

    const scopes=[o.contextScope,e.contextScope];
    for(const s of scopes){
      if(s.interactionId!==request.interactionId || s.gateId!==request.gateId || s.gateRevision!==request.gateRevision
        || s.authorityScopeDigest!==request.authorityScopeDigest || s.continuationTargetRef!==request.continuationTargetRef
        || request.interactionRevision<s.fromInteractionRevision
        || (s.throughInteractionRevision!==null && request.interactionRevision>s.throughInteractionRevision)) return result(OUTCOMES.NOT_OBSERVED,'completion evidence scope mismatch');
    }
    if(stringify(o.contextScope)!==stringify(e.contextScope)) return result(OUTCOMES.NOT_OBSERVED,'start observation and completion evidence scopes disagree');

    const currentScope={scopeType:'GATE',interactionId:request.interactionId,fromInteractionRevision:request.interactionRevision,throughInteractionRevision:request.interactionRevision,gateId:request.gateId,gateRevision:request.gateRevision,authorityScopeDigest:request.authorityScopeDigest,continuationTargetRef:request.continuationTargetRef};
    const material={
      type:'GT63_CONTINUATION_COMPLETION_OBSERVATION',schemaVersion:'1.0',rulesetVersion:RULESET_VERSION,
      executionStartObservationId:o.executionStartObservationId,
      runtimeCompletionEvidenceRef:e.runtimeCompletionEvidenceRef,
      executionStartId:o.executionStartId,currentExecutionStartEvidenceRef:o.currentExecutionStartEvidenceRef,runtimeStartEvidenceRef:o.runtimeStartEvidenceRef,
      executionStartDigest:o.executionStartDigest,executionIntentId:o.executionIntentId,currentExecutionIntentEvidenceRef:o.currentExecutionIntentEvidenceRef,
      executionStartRequirementEvidenceRef:o.executionStartRequirementEvidenceRef,
      invocationId:o.invocationId,invocationDigest:o.invocationDigest,
      runtimeOccurrenceRef:e.runtimeOccurrenceRef,runtimeOccurrenceDigest:e.runtimeOccurrenceDigest,
      runtimeCompletionRef:e.runtimeCompletionRef,runtimeCompletionDigest:e.runtimeCompletionDigest,
      principalRef:o.principalRef,principalRevision:o.principalRevision,executionTargetRef:o.executionTargetRef,contextScope:currentScope,
      observationState:'OBSERVED',authority:AUTHORITY,
      executionStarted:true,executionSucceeded:false,continuationExecuted:true,effectAuthorized:false,effectPerformed:false,effectVerified:false
    };
    const observation=Object.freeze({continuationCompletionObservationId:`continuation-completion-observation:${digest(material).slice(7)}`,...material});

    let prior;
    try { prior=observationLedger.get(observation.continuationCompletionObservationId); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'observation ledger unavailable'); }
    if(prior) return stringify(prior)===stringify(observation)
      ? result(OUTCOMES.OBSERVED,'same continuation completion observation already accepted',prior)
      : result(OUTCOMES.UNKNOWN,'continuation completion observation identity conflict');

    try {
      const committed=observationLedger.commit(observation.continuationCompletionObservationId,Object.freeze(clone(observation)));
      if(!committed || stringify(committed)!==stringify(observation)) return result(OUTCOMES.UNKNOWN,'observation ledger commit conflict');
    } catch(_) { return result(OUTCOMES.UNKNOWN,'observation ledger commit conflict'); }

    return result(OUTCOMES.OBSERVED,null,observation);
  }

  return Object.freeze({assess,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}

function createMemoryLedger(){
  const records=new Map();
  return Object.freeze({get(key){return records.has(key)?records.get(key):null;},commit(key,value){if(records.has(key)) throw new Error('immutable-ledger-conflict');records.set(key,Object.freeze(clone(value)));return records.get(key);}});
}

module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createContinuationCompletionObservationCurrentEvidenceBinding,createMemoryLedger});
