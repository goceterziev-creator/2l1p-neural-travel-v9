'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'bounded-continuation-execution-invocation-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({ INVOKED:'INVOKED', NOT_INVOKABLE:'NOT_INVOKABLE', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });

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

function result(outcome, reason, invocationRecord=null){
  return Object.freeze({
    rulesetVersion:RULESET_VERSION,
    outcome,
    reason:reason||null,
    invocationRecord:clone(invocationRecord),
    authority:AUTHORITY,
    invocationAttempted:outcome===OUTCOMES.INVOKED,
    executionStarted:false,
    continuationExecuted:false,
    executionSucceeded:false,
    effectAuthorized:false,
    effectPerformed:false,
    effectVerified:false
  });
}

function validCurrentStartResult(wrapper){
  const e = wrapper && wrapper.evidence;
  return Boolean(plain(wrapper)
    && wrapper.outcome === 'RESOLVED'
    && wrapper.authority === AUTHORITY
    && wrapper.executionStartPermitted === false
    && wrapper.executionStarted === false
    && wrapper.continuationExecuted === false
    && wrapper.effectAuthorized === false
    && wrapper.effectPerformed === false
    && wrapper.effectVerified === false
    && plain(e)
    && e.type === 'GT63_CURRENT_BOUNDED_CONTINUATION_EXECUTION_START_EVIDENCE'
    && nonEmpty(e.currentExecutionStartEvidenceRef)
    && nonEmpty(e.executionStartId)
    && /^sha256:[0-9a-f]{64}$/.test(e.executionStartDigest)
    && nonEmpty(e.executionIntentId)
    && nonEmpty(e.currentExecutionIntentEvidenceRef)
    && nonEmpty(e.executionStartRequirementEvidenceRef)
    && nonEmpty(e.principalRef)
    && nonEmpty(e.principalRevision)
    && nonEmpty(e.executionTargetRef)
    && validScope(e.contextScope)
    && e.lifecycleState === 'CURRENT'
    && e.freshnessState === 'CURRENT'
    && e.contradictionState === 'NONE'
    && e.authority === AUTHORITY
    && e.executionStartPermitted === false
    && e.executionStarted === false
    && e.continuationExecuted === false
    && e.effectAuthorized === false
    && e.effectPerformed === false
    && e.effectVerified === false);
}

function validAdapterResult(value){
  if(!plain(value)) return false;
  const fields=['runtimeOccurrenceRef','runtimeOccurrenceMaterial'];
  return Object.keys(value).length === fields.length
    && Object.keys(value).every(key=>fields.includes(key))
    && nonEmpty(value.runtimeOccurrenceRef)
    && plain(value.runtimeOccurrenceMaterial);
}

function createBoundedContinuationExecutionInvocation({ currentExecutionStartResultPort, executionAdapter, invocationLedger } = {}){
  if(typeof currentExecutionStartResultPort !== 'function') throw new TypeError('currentExecutionStartResultPort must be a function');
  if(typeof executionAdapter !== 'function') throw new TypeError('executionAdapter must be a function');
  if(!invocationLedger || typeof invocationLedger.get !== 'function' || typeof invocationLedger.commit !== 'function') throw new TypeError('invocationLedger required');

  function assess(request){
    const fields=['rulesetVersion','currentExecutionStartEvidenceRef','executionStartId','executionStartDigest','executionIntentId','currentExecutionIntentEvidenceRef','executionStartRequirementEvidenceRef','expectedPrincipalRef','expectedPrincipalRevision','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','executionTargetRef'];
    if(!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key=>!fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.currentExecutionStartEvidenceRef)
      || !nonEmpty(request.executionStartId)
      || !/^sha256:[0-9a-f]{64}$/.test(request.executionStartDigest)
      || !nonEmpty(request.executionIntentId)
      || !nonEmpty(request.currentExecutionIntentEvidenceRef)
      || !nonEmpty(request.executionStartRequirementEvidenceRef)
      || !nonEmpty(request.expectedPrincipalRef)
      || !nonEmpty(request.expectedPrincipalRevision)
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision) || request.interactionRevision < 0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision) || request.gateRevision < 1
      || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.executionTargetRef)) return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');

    let currentResult;
    try { currentResult = currentExecutionStartResultPort({ currentExecutionStartEvidenceRef:request.currentExecutionStartEvidenceRef }); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'current execution start evidence unavailable'); }
    if(!validCurrentStartResult(currentResult)) return result(OUTCOMES.UNKNOWN,'current execution start evidence invalid or non-current');

    const e = currentResult.evidence;
    if(e.currentExecutionStartEvidenceRef !== request.currentExecutionStartEvidenceRef) return result(OUTCOMES.UNKNOWN,'current execution start evidence reference mismatch');

    if(e.executionStartId !== request.executionStartId
      || e.executionStartDigest !== request.executionStartDigest
      || e.executionIntentId !== request.executionIntentId
      || e.currentExecutionIntentEvidenceRef !== request.currentExecutionIntentEvidenceRef
      || e.executionStartRequirementEvidenceRef !== request.executionStartRequirementEvidenceRef
      || e.principalRef !== request.expectedPrincipalRef
      || e.principalRevision !== request.expectedPrincipalRevision
      || e.executionTargetRef !== request.executionTargetRef
      || e.contextScope.interactionId !== request.interactionId
      || e.contextScope.gateId !== request.gateId
      || e.contextScope.gateRevision !== request.gateRevision
      || e.contextScope.authorityScopeDigest !== request.authorityScopeDigest
      || e.contextScope.continuationTargetRef !== request.continuationTargetRef
      || request.interactionRevision < e.contextScope.fromInteractionRevision
      || (e.contextScope.throughInteractionRevision !== null && request.interactionRevision > e.contextScope.throughInteractionRevision)) {
      return result(OUTCOMES.NOT_INVOKABLE,'current execution start evidence does not match requested governed scope');
    }

    const governedEnvelope=Object.freeze({
      executionStartId:e.executionStartId,
      currentExecutionStartEvidenceRef:e.currentExecutionStartEvidenceRef,
      executionStartDigest:e.executionStartDigest,
      executionIntentId:e.executionIntentId,
      currentExecutionIntentEvidenceRef:e.currentExecutionIntentEvidenceRef,
      executionStartRequirementEvidenceRef:e.executionStartRequirementEvidenceRef,
      principalRef:e.principalRef,
      principalRevision:e.principalRevision,
      executionTargetRef:e.executionTargetRef,
      contextScope:clone(e.contextScope),
      authority:AUTHORITY
    });

    const invocationMaterial={
      type:'GT63_BOUNDED_CONTINUATION_EXECUTION_INVOCATION',
      schemaVersion:'1.0',
      rulesetVersion:RULESET_VERSION,
      ...clone(governedEnvelope),
      invocationState:'ATTEMPTED',
      authority:AUTHORITY,
      executionStarted:false,
      continuationExecuted:false,
      executionSucceeded:false,
      effectAuthorized:false,
      effectPerformed:false,
      effectVerified:false
    };
    const invocationId=`continuation-execution-invocation:${digest(invocationMaterial).slice(7)}`;

    let prior;
    try { prior = invocationLedger.get(invocationId); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'invocation ledger unavailable'); }
    if(prior) return stringify(prior.invocationRecord)===stringify(prior.invocationRecord)
      ? result(OUTCOMES.INVOKED,'same invocation already accepted',prior.invocationRecord)
      : result(OUTCOMES.UNKNOWN,'invocation identity conflict');

    let adapterResult;
    try { adapterResult = executionAdapter(governedEnvelope); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'execution adapter failure'); }
    if(!validAdapterResult(adapterResult)) return result(OUTCOMES.UNKNOWN,'execution adapter result ambiguous');

    const invocationRecord=Object.freeze({
      invocationId,
      ...invocationMaterial,
      runtimeOccurrenceRef:adapterResult.runtimeOccurrenceRef,
      runtimeOccurrenceMaterial:clone(adapterResult.runtimeOccurrenceMaterial)
    });

    try {
      const committed = invocationLedger.commit(invocationId,Object.freeze({ invocationRecord }));
      if(!committed || !committed.invocationRecord || stringify(committed.invocationRecord)!==stringify(invocationRecord)) return result(OUTCOMES.UNKNOWN,'invocation ledger commit conflict');
    } catch(_) { return result(OUTCOMES.UNKNOWN,'invocation ledger commit conflict'); }

    return result(OUTCOMES.INVOKED,null,invocationRecord);
  }

  return Object.freeze({ assess, rulesetVersion:RULESET_VERSION, authority:AUTHORITY });
}

function createMemoryLedger(){
  const records=new Map();
  return Object.freeze({
    get(key){ return records.has(key)?records.get(key):null; },
    commit(key,value){ if(records.has(key)) throw new Error('immutable-ledger-conflict'); records.set(key,Object.freeze(clone(value))); return records.get(key); }
  });
}

module.exports=Object.freeze({ RULESET_VERSION, AUTHORITY, OUTCOMES, createBoundedContinuationExecutionInvocation, createMemoryLedger });
