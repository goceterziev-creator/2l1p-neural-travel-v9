'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'current-bounded-continuation-execution-start-evidence-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({ RESOLVED:'RESOLVED', NOT_RESOLVED:'NOT_RESOLVED', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });

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

function result(outcome, reason, evidence=null){
  return Object.freeze({
    rulesetVersion:RULESET_VERSION,
    outcome,
    reason:reason||null,
    evidence:clone(evidence),
    authority:AUTHORITY,
    executionStartPermitted:false,
    executionStarted:false,
    continuationExecuted:false,
    effectAuthorized:false,
    effectPerformed:false,
    effectVerified:false
  });
}

function validStartRecord(start){
  return Boolean(plain(start)
    && nonEmpty(start.executionStartId)
    && start.type === 'GT63_BOUNDED_CONTINUATION_EXECUTION_START'
    && nonEmpty(start.executionIntentId)
    && nonEmpty(start.currentExecutionIntentEvidenceRef)
    && nonEmpty(start.executionStartRequirementEvidenceRef)
    && nonEmpty(start.principalRef)
    && nonEmpty(start.principalRevision)
    && nonEmpty(start.executionTargetRef)
    && validScope(start.contextScope)
    && start.startState === 'PERMITTED'
    && start.authority === AUTHORITY
    && start.executionStartPermitted === true
    && start.executionStarted === false
    && start.continuationExecuted === false
    && start.effectAuthorized === false
    && start.effectPerformed === false
    && start.effectVerified === false);
}

function validState(state){
  if(!plain(state)) return false;
  const fields=['executionStartId','executionStartDigest','lifecycleState','freshnessState','contradictionState','authority'];
  return Object.keys(state).length === fields.length
    && Object.keys(state).every(key=>fields.includes(key))
    && nonEmpty(state.executionStartId)
    && /^sha256:[0-9a-f]{64}$/.test(state.executionStartDigest)
    && state.lifecycleState === 'CURRENT'
    && state.freshnessState === 'CURRENT'
    && state.contradictionState === 'NONE'
    && state.authority === AUTHORITY;
}

function createCurrentBoundedContinuationExecutionStartEvidence({ executionStartPort, executionStartStatePort } = {}){
  if(typeof executionStartPort !== 'function') throw new TypeError('executionStartPort must be a function');
  if(typeof executionStartStatePort !== 'function') throw new TypeError('executionStartStatePort must be a function');

  function assess(request){
    const fields=['rulesetVersion','executionStartId','executionIntentId','currentExecutionIntentEvidenceRef','executionStartRequirementEvidenceRef','expectedPrincipalRef','expectedPrincipalRevision','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','executionTargetRef'];
    if(!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key=>!fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.executionStartId)
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

    let start;
    try { start = executionStartPort({ executionStartId:request.executionStartId }); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'execution start record unavailable'); }

    if(start == null) return result(OUTCOMES.NOT_RESOLVED,'execution start record not found');
    if(!validStartRecord(start)) return result(OUTCOMES.UNKNOWN,'execution start record invalid');
    if(start.executionStartId !== request.executionStartId) return result(OUTCOMES.NOT_RESOLVED,'execution start id mismatch');

    if(start.executionIntentId !== request.executionIntentId
      || start.currentExecutionIntentEvidenceRef !== request.currentExecutionIntentEvidenceRef
      || start.executionStartRequirementEvidenceRef !== request.executionStartRequirementEvidenceRef
      || start.principalRef !== request.expectedPrincipalRef
      || start.principalRevision !== request.expectedPrincipalRevision
      || start.executionTargetRef !== request.executionTargetRef
      || start.contextScope.interactionId !== request.interactionId
      || start.contextScope.gateId !== request.gateId
      || start.contextScope.gateRevision !== request.gateRevision
      || start.contextScope.authorityScopeDigest !== request.authorityScopeDigest
      || start.contextScope.continuationTargetRef !== request.continuationTargetRef
      || request.interactionRevision < start.contextScope.fromInteractionRevision
      || (start.contextScope.throughInteractionRevision !== null && request.interactionRevision > start.contextScope.throughInteractionRevision)) {
      return result(OUTCOMES.NOT_RESOLVED,'execution start record does not match requested governed scope');
    }

    const executionStartDigest = digest(start);

    let state;
    try { state = executionStartStatePort({ executionStartId:start.executionStartId, executionStartDigest }); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'execution start state unavailable'); }

    if(!validState(state)
      || state.executionStartId !== start.executionStartId
      || state.executionStartDigest !== executionStartDigest) return result(OUTCOMES.UNKNOWN,'execution start state invalid or non-current');

    const material={
      type:'GT63_CURRENT_BOUNDED_CONTINUATION_EXECUTION_START_EVIDENCE',
      schemaVersion:'1.0',
      rulesetVersion:RULESET_VERSION,
      executionStartId:start.executionStartId,
      executionStartDigest,
      executionIntentId:start.executionIntentId,
      currentExecutionIntentEvidenceRef:start.currentExecutionIntentEvidenceRef,
      executionStartRequirementEvidenceRef:start.executionStartRequirementEvidenceRef,
      principalRef:start.principalRef,
      principalRevision:start.principalRevision,
      executionTargetRef:start.executionTargetRef,
      contextScope:clone(start.contextScope),
      lifecycleState:'CURRENT',
      freshnessState:'CURRENT',
      contradictionState:'NONE',
      authority:AUTHORITY,
      executionStartPermitted:false,
      executionStarted:false,
      continuationExecuted:false,
      effectAuthorized:false,
      effectPerformed:false,
      effectVerified:false
    };

    const evidence=Object.freeze({
      currentExecutionStartEvidenceRef:`gt63-evidence:current-bounded-continuation-execution-start:${digest(material).slice(7)}`,
      ...material
    });

    return result(OUTCOMES.RESOLVED,null,evidence);
  }

  return Object.freeze({ assess, rulesetVersion:RULESET_VERSION, authority:AUTHORITY });
}

module.exports=Object.freeze({ RULESET_VERSION, AUTHORITY, OUTCOMES, createCurrentBoundedContinuationExecutionStartEvidence });
