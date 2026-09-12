'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'controlled-continuation-execution-current-evidence-binding-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({ EXECUTABLE:'EXECUTABLE', NOT_EXECUTABLE:'NOT_EXECUTABLE', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });

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
    && Number.isInteger(scope.fromInteractionRevision)
    && scope.fromInteractionRevision >= 0
    && (scope.throughInteractionRevision === null || (Number.isInteger(scope.throughInteractionRevision) && scope.throughInteractionRevision >= scope.fromInteractionRevision))
    && nonEmpty(scope.gateId)
    && Number.isInteger(scope.gateRevision)
    && scope.gateRevision > 0
    && /^sha256:[0-9a-f]{64}$/.test(scope.authorityScopeDigest)
    && nonEmpty(scope.continuationTargetRef));
}

function covers(scope, revision){
  return validScope(scope)
    && revision >= scope.fromInteractionRevision
    && (scope.throughInteractionRevision === null || revision <= scope.throughInteractionRevision);
}

function result(outcome, reason, executionIntent=null){
  return Object.freeze({
    rulesetVersion:RULESET_VERSION,
    outcome,
    reason:reason||null,
    executionIntent:clone(executionIntent),
    authority:AUTHORITY,
    continuationExecutionPermitted:outcome===OUTCOMES.EXECUTABLE,
    continuationExecuted:false,
    executionStarted:false,
    effectAuthorized:false,
    effectPerformed:false,
    effectVerified:false
  });
}

function validCurrentAuthorizationResult(wrapper){
  const evidence = wrapper && wrapper.evidence;
  return Boolean(plain(wrapper)
    && wrapper.outcome === 'RESOLVED'
    && wrapper.authority === AUTHORITY
    && wrapper.continuationAuthorized === false
    && wrapper.continuationExecuted === false
    && wrapper.executionAuthorityCreated === false
    && wrapper.executionStartPermitted === false
    && wrapper.executionStarted === false
    && wrapper.effectAuthorized === false
    && wrapper.effectPerformed === false
    && wrapper.effectVerified === false
    && plain(evidence)
    && evidence.type === 'GT63_CURRENT_GOVERNED_CONTINUATION_AUTHORIZATION_EVIDENCE'
    && nonEmpty(evidence.currentContinuationAuthorizationEvidenceRef)
    && nonEmpty(evidence.continuationAuthorizationId)
    && /^sha256:[0-9a-f]{64}$/.test(evidence.authorizationDigest)
    && nonEmpty(evidence.currentSatisfactionEvidenceRef)
    && nonEmpty(evidence.continuationRequirementEvidenceRef)
    && nonEmpty(evidence.principalRef)
    && nonEmpty(evidence.principalRevision)
    && validScope(evidence.contextScope)
    && evidence.lifecycleState === 'CURRENT'
    && evidence.freshnessState === 'CURRENT'
    && evidence.contradictionState === 'NONE'
    && evidence.authority === AUTHORITY
    && evidence.continuationAuthorized === true
    && evidence.continuationExecuted === false
    && evidence.executionAuthorityCreated === false
    && evidence.executionStartPermitted === false
    && evidence.executionStarted === false
    && evidence.effectAuthorized === false
    && evidence.effectPerformed === false
    && evidence.effectVerified === false);
}

function validExecutionRequirementResult(wrapper){
  const evidence = wrapper && wrapper.evidence;
  return Boolean(plain(wrapper)
    && wrapper.outcome === 'RESOLVED'
    && wrapper.authority === AUTHORITY
    && wrapper.executionPermitted === false
    && wrapper.executionStartPermitted === false
    && wrapper.continuationExecuted === false
    && wrapper.executionStarted === false
    && wrapper.effectAuthorized === false
    && wrapper.effectPerformed === false
    && plain(evidence)
    && evidence.type === 'GT63_EXECUTION_REQUIREMENT_EVIDENCE'
    && nonEmpty(evidence.executionRequirementEvidenceRef)
    && nonEmpty(evidence.executionTargetRef)
    && nonEmpty(evidence.continuationTargetRef)
    && nonEmpty(evidence.interactionId)
    && Number.isInteger(evidence.fromInteractionRevision)
    && evidence.fromInteractionRevision >= 0
    && (evidence.throughInteractionRevision === null || (Number.isInteger(evidence.throughInteractionRevision) && evidence.throughInteractionRevision >= evidence.fromInteractionRevision))
    && nonEmpty(evidence.gateId)
    && Number.isInteger(evidence.gateRevision)
    && evidence.gateRevision > 0
    && /^sha256:[0-9a-f]{64}$/.test(evidence.authorityScopeDigest)
    && nonEmpty(evidence.requiredPrincipalRef)
    && nonEmpty(evidence.requiredPrincipalRevision)
    && evidence.lifecycleState === 'CURRENT'
    && evidence.freshnessState === 'CURRENT'
    && evidence.contradictionState === 'NONE'
    && evidence.authority === AUTHORITY
    && evidence.executionPermitted === false
    && evidence.executionStartPermitted === false
    && evidence.continuationExecuted === false
    && evidence.executionStarted === false
    && evidence.effectAuthorized === false
    && evidence.effectPerformed === false);
}

function createControlledContinuationExecutionCurrentEvidenceBinding({ currentAuthorizationResultPort, executionRequirementResultPort, executionLedger } = {}){
  if(typeof currentAuthorizationResultPort !== 'function') throw new TypeError('currentAuthorizationResultPort must be a function');
  if(typeof executionRequirementResultPort !== 'function') throw new TypeError('executionRequirementResultPort must be a function');
  if(!executionLedger || typeof executionLedger.get !== 'function' || typeof executionLedger.commit !== 'function') throw new TypeError('executionLedger required');

  function assess(request){
    const fields=['rulesetVersion','currentContinuationAuthorizationEvidenceRef','executionRequirementEvidenceRef','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','executionTargetRef','expectedPrincipalRef','expectedPrincipalRevision'];
    if(!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key=>!fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.currentContinuationAuthorizationEvidenceRef)
      || !nonEmpty(request.executionRequirementEvidenceRef)
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision)
      || request.interactionRevision < 0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision)
      || request.gateRevision < 1
      || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.executionTargetRef)
      || !nonEmpty(request.expectedPrincipalRef)
      || !nonEmpty(request.expectedPrincipalRevision)) return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');

    let authResult;
    try { authResult = currentAuthorizationResultPort({ currentContinuationAuthorizationEvidenceRef:request.currentContinuationAuthorizationEvidenceRef }); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'current continuation authorization evidence unavailable'); }
    if(!validCurrentAuthorizationResult(authResult)) return result(OUTCOMES.UNKNOWN,'current continuation authorization evidence invalid or non-current');

    let reqResult;
    try { reqResult = executionRequirementResultPort({ executionRequirementEvidenceRef:request.executionRequirementEvidenceRef }); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'execution requirement evidence unavailable'); }
    if(!validExecutionRequirementResult(reqResult)) return result(OUTCOMES.UNKNOWN,'execution requirement evidence invalid or non-current');

    const a = authResult.evidence;
    const r = reqResult.evidence;

    if(a.currentContinuationAuthorizationEvidenceRef !== request.currentContinuationAuthorizationEvidenceRef
      || r.executionRequirementEvidenceRef !== request.executionRequirementEvidenceRef) return result(OUTCOMES.UNKNOWN,'upstream evidence reference mismatch');

    if(a.principalRef !== request.expectedPrincipalRef
      || a.principalRevision !== request.expectedPrincipalRevision
      || r.requiredPrincipalRef !== request.expectedPrincipalRef
      || r.requiredPrincipalRevision !== request.expectedPrincipalRevision) return result(OUTCOMES.NOT_EXECUTABLE,'principal mismatch');

    if(a.contextScope.interactionId !== request.interactionId
      || r.interactionId !== request.interactionId
      || a.contextScope.gateId !== request.gateId
      || r.gateId !== request.gateId
      || a.contextScope.gateRevision !== request.gateRevision
      || r.gateRevision !== request.gateRevision
      || a.contextScope.authorityScopeDigest !== request.authorityScopeDigest
      || r.authorityScopeDigest !== request.authorityScopeDigest
      || a.contextScope.continuationTargetRef !== request.continuationTargetRef
      || r.continuationTargetRef !== request.continuationTargetRef
      || r.executionTargetRef !== request.executionTargetRef
      || !covers(a.contextScope,request.interactionRevision)
      || request.interactionRevision < r.fromInteractionRevision
      || (r.throughInteractionRevision !== null && request.interactionRevision > r.throughInteractionRevision)) return result(OUTCOMES.NOT_EXECUTABLE,'execution scope mismatch');

    const currentScope={
      scopeType:'GATE', interactionId:request.interactionId,
      fromInteractionRevision:request.interactionRevision, throughInteractionRevision:request.interactionRevision,
      gateId:request.gateId, gateRevision:request.gateRevision,
      authorityScopeDigest:request.authorityScopeDigest,
      continuationTargetRef:request.continuationTargetRef
    };

    const material={
      type:'GT63_CONTROLLED_CONTINUATION_EXECUTION_INTENT', schemaVersion:'1.0', rulesetVersion:RULESET_VERSION,
      currentContinuationAuthorizationEvidenceRef:a.currentContinuationAuthorizationEvidenceRef,
      executionRequirementEvidenceRef:r.executionRequirementEvidenceRef,
      continuationAuthorizationId:a.continuationAuthorizationId,
      authorizationDigest:a.authorizationDigest,
      principalRef:request.expectedPrincipalRef, principalRevision:request.expectedPrincipalRevision,
      executionTargetRef:request.executionTargetRef,
      contextScope:currentScope,
      executionState:'PERMITTED', authority:AUTHORITY,
      continuationExecutionPermitted:true,
      continuationExecuted:false, executionStarted:false,
      effectAuthorized:false, effectPerformed:false, effectVerified:false
    };

    const executionIntent=Object.freeze({ executionIntentId:`continuation-execution-intent:${digest(material).slice(7)}`,...material });
    let prior;
    try { prior=executionLedger.get(executionIntent.executionIntentId); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'execution ledger unavailable'); }
    if(prior) return stringify(prior)===stringify(executionIntent)
      ? result(OUTCOMES.EXECUTABLE,'same execution intent already accepted',prior)
      : result(OUTCOMES.UNKNOWN,'execution intent identity conflict');

    try {
      const committed=executionLedger.commit(executionIntent.executionIntentId,Object.freeze(clone(executionIntent)));
      if(!committed || stringify(committed)!==stringify(executionIntent)) return result(OUTCOMES.UNKNOWN,'execution ledger commit conflict');
    } catch(_) { return result(OUTCOMES.UNKNOWN,'execution ledger commit conflict'); }

    return result(OUTCOMES.EXECUTABLE,null,executionIntent);
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

module.exports=Object.freeze({ RULESET_VERSION, AUTHORITY, OUTCOMES, createControlledContinuationExecutionCurrentEvidenceBinding, createMemoryLedger });
