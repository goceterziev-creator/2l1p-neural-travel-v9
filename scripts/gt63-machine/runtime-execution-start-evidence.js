'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'runtime-execution-start-evidence-v0.1.0';
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

function result(outcome, reason, evidence=null){
  return Object.freeze({
    rulesetVersion:RULESET_VERSION,
    outcome,
    reason:reason||null,
    evidence:clone(evidence),
    authority:AUTHORITY,
    invocationAttempted:outcome===OUTCOMES.OBSERVED || outcome===OUTCOMES.NOT_OBSERVED,
    executionStarted:outcome===OUTCOMES.OBSERVED,
    executionSucceeded:false,
    continuationExecuted:false,
    effectAuthorized:false,
    effectPerformed:false,
    effectVerified:false
  });
}

function validInvocation(record){
  return Boolean(plain(record)
    && nonEmpty(record.invocationId)
    && record.type === 'GT63_BOUNDED_CONTINUATION_EXECUTION_INVOCATION'
    && record.invocationState === 'ATTEMPTED'
    && record.authority === AUTHORITY
    && nonEmpty(record.executionStartId)
    && nonEmpty(record.currentExecutionStartEvidenceRef)
    && /^sha256:[0-9a-f]{64}$/.test(record.executionStartDigest)
    && nonEmpty(record.executionIntentId)
    && nonEmpty(record.currentExecutionIntentEvidenceRef)
    && nonEmpty(record.executionStartRequirementEvidenceRef)
    && nonEmpty(record.principalRef)
    && nonEmpty(record.principalRevision)
    && nonEmpty(record.executionTargetRef)
    && validScope(record.contextScope)
    && nonEmpty(record.runtimeOccurrenceRef)
    && plain(record.runtimeOccurrenceMaterial)
    && record.executionStarted === false
    && record.continuationExecuted === false
    && record.executionSucceeded === false
    && record.effectAuthorized === false
    && record.effectPerformed === false
    && record.effectVerified === false);
}

function validAttestation(attestation){
  if(!plain(attestation)) return false;
  const fields=['invocationId','invocationDigest','runtimeOccurrenceRef','runtimeOccurrenceDigest','observationState','executionStarted','lifecycleState','freshnessState','contradictionState','authority'];
  return Object.keys(attestation).length === fields.length
    && Object.keys(attestation).every(key=>fields.includes(key))
    && nonEmpty(attestation.invocationId)
    && /^sha256:[0-9a-f]{64}$/.test(attestation.invocationDigest)
    && nonEmpty(attestation.runtimeOccurrenceRef)
    && /^sha256:[0-9a-f]{64}$/.test(attestation.runtimeOccurrenceDigest)
    && ['OBSERVED','NOT_OBSERVED'].includes(attestation.observationState)
    && typeof attestation.executionStarted === 'boolean'
    && ((attestation.observationState === 'OBSERVED' && attestation.executionStarted === true)
      || (attestation.observationState === 'NOT_OBSERVED' && attestation.executionStarted === false))
    && attestation.lifecycleState === 'CURRENT'
    && attestation.freshnessState === 'CURRENT'
    && attestation.contradictionState === 'NONE'
    && attestation.authority === AUTHORITY;
}

function createRuntimeExecutionStartEvidence({ invocationPort, runtimeOccurrenceVerifier } = {}){
  if(typeof invocationPort !== 'function') throw new TypeError('invocationPort must be a function');
  if(typeof runtimeOccurrenceVerifier !== 'function') throw new TypeError('runtimeOccurrenceVerifier must be a function');

  function assess(request){
    const fields=['rulesetVersion','invocationId','executionStartId','currentExecutionStartEvidenceRef','executionStartDigest','executionIntentId','currentExecutionIntentEvidenceRef','executionStartRequirementEvidenceRef','expectedPrincipalRef','expectedPrincipalRevision','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','executionTargetRef','runtimeOccurrenceRef'];
    if(!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key=>!fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.invocationId)
      || !nonEmpty(request.executionStartId)
      || !nonEmpty(request.currentExecutionStartEvidenceRef)
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
      || !nonEmpty(request.executionTargetRef)
      || !nonEmpty(request.runtimeOccurrenceRef)) return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');

    let invocation;
    try { invocation = invocationPort({ invocationId:request.invocationId }); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'execution invocation unavailable'); }

    if(invocation == null) return result(OUTCOMES.UNKNOWN,'execution invocation unavailable');
    if(!validInvocation(invocation)) return result(OUTCOMES.UNKNOWN,'execution invocation invalid');

    if(invocation.invocationId !== request.invocationId
      || invocation.executionStartId !== request.executionStartId
      || invocation.currentExecutionStartEvidenceRef !== request.currentExecutionStartEvidenceRef
      || invocation.executionStartDigest !== request.executionStartDigest
      || invocation.executionIntentId !== request.executionIntentId
      || invocation.currentExecutionIntentEvidenceRef !== request.currentExecutionIntentEvidenceRef
      || invocation.executionStartRequirementEvidenceRef !== request.executionStartRequirementEvidenceRef
      || invocation.principalRef !== request.expectedPrincipalRef
      || invocation.principalRevision !== request.expectedPrincipalRevision
      || invocation.executionTargetRef !== request.executionTargetRef
      || invocation.runtimeOccurrenceRef !== request.runtimeOccurrenceRef
      || invocation.contextScope.interactionId !== request.interactionId
      || invocation.contextScope.gateId !== request.gateId
      || invocation.contextScope.gateRevision !== request.gateRevision
      || invocation.contextScope.authorityScopeDigest !== request.authorityScopeDigest
      || invocation.contextScope.continuationTargetRef !== request.continuationTargetRef
      || request.interactionRevision < invocation.contextScope.fromInteractionRevision
      || (invocation.contextScope.throughInteractionRevision !== null && request.interactionRevision > invocation.contextScope.throughInteractionRevision)) {
      return result(OUTCOMES.UNKNOWN,'execution invocation does not match requested governed scope');
    }

    const invocationDigest=digest(invocation);
    const runtimeOccurrenceDigest=digest(invocation.runtimeOccurrenceMaterial);

    let attestation;
    try {
      attestation = runtimeOccurrenceVerifier(Object.freeze({
        invocationId:invocation.invocationId,
        invocationDigest,
        runtimeOccurrenceRef:invocation.runtimeOccurrenceRef,
        runtimeOccurrenceDigest,
        runtimeOccurrenceMaterial:clone(invocation.runtimeOccurrenceMaterial),
        executionStartId:invocation.executionStartId,
        executionTargetRef:invocation.executionTargetRef,
        principalRef:invocation.principalRef,
        principalRevision:invocation.principalRevision,
        contextScope:clone(invocation.contextScope),
        authority:AUTHORITY
      }));
    } catch(_) { return result(OUTCOMES.UNKNOWN,'runtime occurrence verifier failure'); }

    if(!validAttestation(attestation)
      || attestation.invocationId !== invocation.invocationId
      || attestation.invocationDigest !== invocationDigest
      || attestation.runtimeOccurrenceRef !== invocation.runtimeOccurrenceRef
      || attestation.runtimeOccurrenceDigest !== runtimeOccurrenceDigest) {
      return result(OUTCOMES.UNKNOWN,'runtime occurrence attestation invalid or ambiguous');
    }

    if(attestation.observationState === 'NOT_OBSERVED') {
      return result(OUTCOMES.NOT_OBSERVED,'runtime verifier did not positively establish execution start');
    }

    const material={
      type:'GT63_RUNTIME_EXECUTION_START_EVIDENCE',
      schemaVersion:'1.0',
      rulesetVersion:RULESET_VERSION,
      invocationId:invocation.invocationId,
      invocationDigest,
      runtimeOccurrenceRef:invocation.runtimeOccurrenceRef,
      runtimeOccurrenceDigest,
      executionStartId:invocation.executionStartId,
      currentExecutionStartEvidenceRef:invocation.currentExecutionStartEvidenceRef,
      executionStartDigest:invocation.executionStartDigest,
      executionIntentId:invocation.executionIntentId,
      currentExecutionIntentEvidenceRef:invocation.currentExecutionIntentEvidenceRef,
      executionStartRequirementEvidenceRef:invocation.executionStartRequirementEvidenceRef,
      principalRef:invocation.principalRef,
      principalRevision:invocation.principalRevision,
      executionTargetRef:invocation.executionTargetRef,
      contextScope:clone(invocation.contextScope),
      lifecycleState:'CURRENT',
      freshnessState:'CURRENT',
      contradictionState:'NONE',
      authority:AUTHORITY,
      invocationAttempted:true,
      executionStarted:true,
      executionSucceeded:false,
      continuationExecuted:false,
      effectAuthorized:false,
      effectPerformed:false,
      effectVerified:false
    };

    const evidence=Object.freeze({
      runtimeStartEvidenceRef:`gt63-evidence:runtime-execution-start:${digest(material).slice(7)}`,
      ...material
    });
    return result(OUTCOMES.OBSERVED,null,evidence);
  }

  return Object.freeze({ assess, rulesetVersion:RULESET_VERSION, authority:AUTHORITY });
}

module.exports=Object.freeze({ RULESET_VERSION, AUTHORITY, OUTCOMES, createRuntimeExecutionStartEvidence });
