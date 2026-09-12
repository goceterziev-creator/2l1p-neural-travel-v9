'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'current-controlled-continuation-execution-intent-evidence-v0.1.0';
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

function validExecutionIntent(intent){
  return Boolean(plain(intent)
    && nonEmpty(intent.executionIntentId)
    && intent.type === 'GT63_CONTROLLED_CONTINUATION_EXECUTION_INTENT'
    && intent.executionState === 'PERMITTED'
    && intent.continuationExecutionPermitted === true
    && intent.authority === AUTHORITY
    && nonEmpty(intent.currentContinuationAuthorizationEvidenceRef)
    && nonEmpty(intent.executionRequirementEvidenceRef)
    && nonEmpty(intent.continuationAuthorizationId)
    && /^sha256:[0-9a-f]{64}$/.test(intent.authorizationDigest)
    && nonEmpty(intent.principalRef)
    && nonEmpty(intent.principalRevision)
    && nonEmpty(intent.executionTargetRef)
    && validScope(intent.contextScope)
    && intent.continuationExecuted === false
    && intent.executionStarted === false
    && intent.effectAuthorized === false
    && intent.effectPerformed === false
    && intent.effectVerified === false);
}

function createCurrentControlledContinuationExecutionIntentEvidence({ executionIntentPort, executionIntentStatePort } = {}){
  if(typeof executionIntentPort !== 'function') throw new TypeError('executionIntentPort must be a function');
  if(typeof executionIntentStatePort !== 'function') throw new TypeError('executionIntentStatePort must be a function');

  function assess(request){
    const fields=[
      'rulesetVersion','executionIntentId','currentContinuationAuthorizationEvidenceRef','executionRequirementEvidenceRef',
      'expectedPrincipalRef','expectedPrincipalRevision','interactionId','interactionRevision','gateId','gateRevision',
      'authorityScopeDigest','continuationTargetRef','executionTargetRef'
    ];

    if(!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key => !fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.executionIntentId)
      || !nonEmpty(request.currentContinuationAuthorizationEvidenceRef)
      || !nonEmpty(request.executionRequirementEvidenceRef)
      || !nonEmpty(request.expectedPrincipalRef)
      || !nonEmpty(request.expectedPrincipalRevision)
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision) || request.interactionRevision < 0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision) || request.gateRevision < 1
      || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.executionTargetRef)) {
      return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');
    }

    let intent;
    try { intent = executionIntentPort({ executionIntentId:request.executionIntentId }); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'execution intent unavailable'); }

    if(intent == null) return result(OUTCOMES.NOT_RESOLVED,'execution intent not found');
    if(!validExecutionIntent(intent)) return result(OUTCOMES.UNKNOWN,'execution intent invalid');
    if(intent.executionIntentId !== request.executionIntentId) return result(OUTCOMES.NOT_RESOLVED,'execution intent id mismatch');

    const scope = intent.contextScope;
    if(intent.currentContinuationAuthorizationEvidenceRef !== request.currentContinuationAuthorizationEvidenceRef
      || intent.executionRequirementEvidenceRef !== request.executionRequirementEvidenceRef
      || intent.principalRef !== request.expectedPrincipalRef
      || intent.principalRevision !== request.expectedPrincipalRevision
      || scope.interactionId !== request.interactionId
      || scope.gateId !== request.gateId
      || scope.gateRevision !== request.gateRevision
      || scope.authorityScopeDigest !== request.authorityScopeDigest
      || scope.continuationTargetRef !== request.continuationTargetRef
      || intent.executionTargetRef !== request.executionTargetRef
      || request.interactionRevision < scope.fromInteractionRevision
      || (scope.throughInteractionRevision !== null && request.interactionRevision > scope.throughInteractionRevision)) {
      return result(OUTCOMES.NOT_RESOLVED,'execution intent does not match requested current scope');
    }

    const executionIntentDigest = digest(intent);
    let state;
    try { state = executionIntentStatePort({ executionIntentId:intent.executionIntentId, executionIntentDigest }); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'execution intent state unavailable'); }

    if(!plain(state)) return result(OUTCOMES.UNKNOWN,'execution intent state missing');
    const stateFields=['executionIntentId','executionIntentDigest','lifecycleState','freshnessState','contradictionState','authority'];
    if(Object.keys(state).length !== stateFields.length || Object.keys(state).some(key => !stateFields.includes(key))) {
      return result(OUTCOMES.UNKNOWN,'execution intent state schema invalid');
    }

    if(state.executionIntentId !== intent.executionIntentId
      || state.executionIntentDigest !== executionIntentDigest
      || state.lifecycleState !== 'CURRENT'
      || state.freshnessState !== 'CURRENT'
      || state.contradictionState !== 'NONE'
      || state.authority !== AUTHORITY) {
      return result(OUTCOMES.UNKNOWN,'execution intent state not current, exact or non-contradictory');
    }

    const material={
      type:'GT63_CURRENT_CONTROLLED_CONTINUATION_EXECUTION_INTENT_EVIDENCE',
      schemaVersion:'1.0',
      rulesetVersion:RULESET_VERSION,
      executionIntentId:intent.executionIntentId,
      executionIntentDigest,
      currentContinuationAuthorizationEvidenceRef:intent.currentContinuationAuthorizationEvidenceRef,
      executionRequirementEvidenceRef:intent.executionRequirementEvidenceRef,
      continuationAuthorizationId:intent.continuationAuthorizationId,
      authorizationDigest:intent.authorizationDigest,
      principalRef:intent.principalRef,
      principalRevision:intent.principalRevision,
      executionTargetRef:intent.executionTargetRef,
      contextScope:clone(intent.contextScope),
      lifecycleState:'CURRENT',
      freshnessState:'CURRENT',
      contradictionState:'NONE',
      authority:AUTHORITY,
      continuationExecutionPermitted:true,
      executionStartPermitted:false,
      executionStarted:false,
      continuationExecuted:false,
      effectAuthorized:false,
      effectPerformed:false,
      effectVerified:false
    };

    const evidence=Object.freeze({
      currentExecutionIntentEvidenceRef:`gt63-evidence:current-controlled-continuation-execution-intent:${digest(material).slice(7)}`,
      ...material
    });
    return result(OUTCOMES.RESOLVED,null,evidence);
  }

  return Object.freeze({ assess, rulesetVersion:RULESET_VERSION, authority:AUTHORITY });
}

module.exports=Object.freeze({
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  createCurrentControlledContinuationExecutionIntentEvidence
});
