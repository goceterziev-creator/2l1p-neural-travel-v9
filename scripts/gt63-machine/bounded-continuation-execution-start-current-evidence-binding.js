'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'bounded-continuation-execution-start-current-evidence-binding-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({ STARTABLE:'STARTABLE', NOT_STARTABLE:'NOT_STARTABLE', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });

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

function result(outcome, reason, startRecord=null){
  return Object.freeze({
    rulesetVersion:RULESET_VERSION,
    outcome,
    reason:reason||null,
    startRecord:clone(startRecord),
    authority:AUTHORITY,
    executionStartPermitted:outcome===OUTCOMES.STARTABLE,
    executionStarted:false,
    continuationExecuted:false,
    effectAuthorized:false,
    effectPerformed:false,
    effectVerified:false
  });
}

function validCurrentExecutionIntentResult(wrapper){
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
    && e.type === 'GT63_CURRENT_CONTROLLED_CONTINUATION_EXECUTION_INTENT_EVIDENCE'
    && nonEmpty(e.currentExecutionIntentEvidenceRef)
    && nonEmpty(e.executionIntentId)
    && /^sha256:[0-9a-f]{64}$/.test(e.executionIntentDigest)
    && nonEmpty(e.currentContinuationAuthorizationEvidenceRef)
    && nonEmpty(e.executionRequirementEvidenceRef)
    && nonEmpty(e.principalRef)
    && nonEmpty(e.principalRevision)
    && nonEmpty(e.executionTargetRef)
    && validScope(e.contextScope)
    && e.lifecycleState === 'CURRENT'
    && e.freshnessState === 'CURRENT'
    && e.contradictionState === 'NONE'
    && e.authority === AUTHORITY
    && e.continuationExecutionPermitted === true
    && e.executionStartPermitted === false
    && e.executionStarted === false
    && e.continuationExecuted === false
    && e.effectAuthorized === false
    && e.effectPerformed === false
    && e.effectVerified === false);
}

function validExecutionStartRequirementResult(wrapper){
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
    && e.type === 'GT63_EXECUTION_START_REQUIREMENT_EVIDENCE'
    && nonEmpty(e.executionStartRequirementEvidenceRef)
    && nonEmpty(e.executionTargetRef)
    && nonEmpty(e.continuationTargetRef)
    && nonEmpty(e.interactionId)
    && Number.isInteger(e.fromInteractionRevision) && e.fromInteractionRevision >= 0
    && (e.throughInteractionRevision === null || (Number.isInteger(e.throughInteractionRevision) && e.throughInteractionRevision >= e.fromInteractionRevision))
    && nonEmpty(e.gateId)
    && Number.isInteger(e.gateRevision) && e.gateRevision > 0
    && /^sha256:[0-9a-f]{64}$/.test(e.authorityScopeDigest)
    && nonEmpty(e.requiredPrincipalRef)
    && nonEmpty(e.requiredPrincipalRevision)
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

function createBoundedContinuationExecutionStartCurrentEvidenceBinding({ currentExecutionIntentResultPort, executionStartRequirementResultPort, startLedger } = {}){
  if(typeof currentExecutionIntentResultPort !== 'function') throw new TypeError('currentExecutionIntentResultPort must be a function');
  if(typeof executionStartRequirementResultPort !== 'function') throw new TypeError('executionStartRequirementResultPort must be a function');
  if(!startLedger || typeof startLedger.get !== 'function' || typeof startLedger.commit !== 'function') throw new TypeError('startLedger required');

  function assess(request){
    const fields=['rulesetVersion','executionIntentId','currentExecutionIntentEvidenceRef','executionStartRequirementEvidenceRef','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','executionTargetRef','expectedPrincipalRef','expectedPrincipalRevision'];
    if(!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key=>!fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.executionIntentId)
      || !nonEmpty(request.currentExecutionIntentEvidenceRef)
      || !nonEmpty(request.executionStartRequirementEvidenceRef)
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision) || request.interactionRevision < 0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision) || request.gateRevision < 1
      || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.executionTargetRef)
      || !nonEmpty(request.expectedPrincipalRef)
      || !nonEmpty(request.expectedPrincipalRevision)) return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');

    let intentResult;
    try { intentResult = currentExecutionIntentResultPort({ currentExecutionIntentEvidenceRef:request.currentExecutionIntentEvidenceRef }); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'current execution intent evidence unavailable'); }
    if(!validCurrentExecutionIntentResult(intentResult)) return result(OUTCOMES.UNKNOWN,'current execution intent evidence invalid or non-current');

    let requirementResult;
    try { requirementResult = executionStartRequirementResultPort({ executionStartRequirementEvidenceRef:request.executionStartRequirementEvidenceRef }); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'execution start requirement evidence unavailable'); }
    if(!validExecutionStartRequirementResult(requirementResult)) return result(OUTCOMES.UNKNOWN,'execution start requirement evidence invalid or non-current');

    const i = intentResult.evidence;
    const r = requirementResult.evidence;

    if(i.currentExecutionIntentEvidenceRef !== request.currentExecutionIntentEvidenceRef
      || r.executionStartRequirementEvidenceRef !== request.executionStartRequirementEvidenceRef) return result(OUTCOMES.UNKNOWN,'upstream evidence reference mismatch');

    if(i.executionIntentId !== request.executionIntentId) return result(OUTCOMES.NOT_STARTABLE,'execution intent id mismatch');

    if(i.principalRef !== request.expectedPrincipalRef
      || i.principalRevision !== request.expectedPrincipalRevision
      || r.requiredPrincipalRef !== request.expectedPrincipalRef
      || r.requiredPrincipalRevision !== request.expectedPrincipalRevision) return result(OUTCOMES.NOT_STARTABLE,'principal mismatch');

    if(i.contextScope.interactionId !== request.interactionId
      || r.interactionId !== request.interactionId
      || i.contextScope.gateId !== request.gateId
      || r.gateId !== request.gateId
      || i.contextScope.gateRevision !== request.gateRevision
      || r.gateRevision !== request.gateRevision
      || i.contextScope.authorityScopeDigest !== request.authorityScopeDigest
      || r.authorityScopeDigest !== request.authorityScopeDigest
      || i.contextScope.continuationTargetRef !== request.continuationTargetRef
      || r.continuationTargetRef !== request.continuationTargetRef
      || i.executionTargetRef !== request.executionTargetRef
      || r.executionTargetRef !== request.executionTargetRef
      || request.interactionRevision < i.contextScope.fromInteractionRevision
      || (i.contextScope.throughInteractionRevision !== null && request.interactionRevision > i.contextScope.throughInteractionRevision)
      || request.interactionRevision < r.fromInteractionRevision
      || (r.throughInteractionRevision !== null && request.interactionRevision > r.throughInteractionRevision)) return result(OUTCOMES.NOT_STARTABLE,'execution start scope mismatch');

    const currentScope={
      scopeType:'GATE', interactionId:request.interactionId,
      fromInteractionRevision:request.interactionRevision, throughInteractionRevision:request.interactionRevision,
      gateId:request.gateId, gateRevision:request.gateRevision,
      authorityScopeDigest:request.authorityScopeDigest,
      continuationTargetRef:request.continuationTargetRef
    };

    const material={
      type:'GT63_BOUNDED_CONTINUATION_EXECUTION_START',
      schemaVersion:'1.0',
      rulesetVersion:RULESET_VERSION,
      executionIntentId:i.executionIntentId,
      currentExecutionIntentEvidenceRef:i.currentExecutionIntentEvidenceRef,
      executionStartRequirementEvidenceRef:r.executionStartRequirementEvidenceRef,
      principalRef:request.expectedPrincipalRef,
      principalRevision:request.expectedPrincipalRevision,
      executionTargetRef:request.executionTargetRef,
      contextScope:currentScope,
      startState:'PERMITTED',
      authority:AUTHORITY,
      executionStartPermitted:true,
      executionStarted:false,
      continuationExecuted:false,
      effectAuthorized:false,
      effectPerformed:false,
      effectVerified:false
    };

    const startRecord=Object.freeze({ executionStartId:`continuation-execution-start:${digest(material).slice(7)}`,...material });
    let prior;
    try { prior = startLedger.get(startRecord.executionStartId); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'execution start ledger unavailable'); }

    if(prior) return stringify(prior)===stringify(startRecord)
      ? result(OUTCOMES.STARTABLE,'same execution start already accepted',prior)
      : result(OUTCOMES.UNKNOWN,'execution start identity conflict');

    try {
      const committed = startLedger.commit(startRecord.executionStartId,Object.freeze(clone(startRecord)));
      if(!committed || stringify(committed)!==stringify(startRecord)) return result(OUTCOMES.UNKNOWN,'execution start ledger commit conflict');
    } catch(_) { return result(OUTCOMES.UNKNOWN,'execution start ledger commit conflict'); }

    return result(OUTCOMES.STARTABLE,null,startRecord);
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

module.exports=Object.freeze({ RULESET_VERSION, AUTHORITY, OUTCOMES, createBoundedContinuationExecutionStartCurrentEvidenceBinding, createMemoryLedger });
