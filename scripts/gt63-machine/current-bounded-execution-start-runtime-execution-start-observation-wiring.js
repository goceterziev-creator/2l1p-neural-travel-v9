'use strict';

const { RULESET_VERSION: INVOCATION_RULESET_VERSION, createBoundedContinuationExecutionInvocation } = require('./bounded-continuation-execution-invocation');
const { RULESET_VERSION: RUNTIME_START_RULESET_VERSION, createRuntimeExecutionStartEvidence } = require('./runtime-execution-start-evidence');
const { RULESET_VERSION: OBSERVATION_RULESET_VERSION, createExecutionStartObservationCurrentEvidenceBinding } = require('./execution-start-observation-current-evidence-binding');

const RULESET_VERSION = 'current-bounded-execution-start-runtime-execution-start-observation-wiring-v0.1.0';
const AUTHORITY = 'NONE';
const GOVERNANCE_PRINCIPAL_REF = 'gt63-machine:human-principal:goce-v0';
const GOVERNANCE_PRINCIPAL_REVISION = '1';
const OUTCOMES = Object.freeze({ OBSERVED:'OBSERVED', NOT_INVOKABLE:'NOT_INVOKABLE', NOT_OBSERVED:'NOT_OBSERVED', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });

const plain = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const nonEmpty = v => typeof v === 'string' && v.length > 0;
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const freeze = v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(freeze); } return v; };
const exact = (o, fields) => plain(o) && Object.keys(o).length === fields.length && Object.keys(o).every(k => fields.includes(k));
const validScopeDigest = v => /^sha256:[0-9a-f]{64}$/.test(v);

function result(outcome, reason, observation=null) {
  return freeze({
    rulesetVersion:RULESET_VERSION,
    outcome,
    reason:reason||null,
    observation:clone(observation),
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

function createCurrentBoundedExecutionStartRuntimeExecutionStartObservationWiring({ currentExecutionStartResultPort, executionAdapter, runtimeOccurrenceVerifier, invocationLedger, observationLedger } = {}) {
  if (typeof currentExecutionStartResultPort !== 'function') throw new TypeError('currentExecutionStartResultPort must be a function');
  if (typeof executionAdapter !== 'function') throw new TypeError('executionAdapter must be a function');
  if (typeof runtimeOccurrenceVerifier !== 'function') throw new TypeError('runtimeOccurrenceVerifier must be a function');
  if (!invocationLedger || typeof invocationLedger.get !== 'function' || typeof invocationLedger.commit !== 'function') throw new TypeError('invocationLedger required');
  if (!observationLedger || typeof observationLedger.get !== 'function' || typeof observationLedger.commit !== 'function') throw new TypeError('observationLedger required');

  let lastInvocationResult = null;
  let lastRuntimeStartResult = null;

  const invocation = createBoundedContinuationExecutionInvocation({ currentExecutionStartResultPort, executionAdapter, invocationLedger });
  const runtimeStart = createRuntimeExecutionStartEvidence({
    invocationPort: q => lastInvocationResult && lastInvocationResult.invocationRecord && lastInvocationResult.invocationRecord.invocationId === q.invocationId ? lastInvocationResult.invocationRecord : null,
    runtimeOccurrenceVerifier
  });
  const observation = createExecutionStartObservationCurrentEvidenceBinding({
    currentExecutionStartResultPort,
    runtimeExecutionStartResultPort: q => lastRuntimeStartResult && lastRuntimeStartResult.evidence && lastRuntimeStartResult.evidence.runtimeStartEvidenceRef === q.runtimeStartEvidenceRef ? lastRuntimeStartResult : null,
    observationLedger
  });

  function assess(request) {
    const fields=['rulesetVersion','currentExecutionStartEvidenceRef','executionStartId','executionStartDigest','executionIntentId','currentExecutionIntentEvidenceRef','executionStartRequirementEvidenceRef','principalRef','principalRevision','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','executionTargetRef'];
    if (!exact(request,fields)
      || request.rulesetVersion!==RULESET_VERSION
      || !nonEmpty(request.currentExecutionStartEvidenceRef)
      || !nonEmpty(request.executionStartId)
      || !validScopeDigest(request.executionStartDigest)
      || !nonEmpty(request.executionIntentId)
      || !nonEmpty(request.currentExecutionIntentEvidenceRef)
      || !nonEmpty(request.executionStartRequirementEvidenceRef)
      || request.principalRef!==GOVERNANCE_PRINCIPAL_REF
      || request.principalRevision!==GOVERNANCE_PRINCIPAL_REVISION
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision) || request.interactionRevision<0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision) || request.gateRevision<1
      || !validScopeDigest(request.authorityScopeDigest)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.executionTargetRef)) return result(OUTCOMES.INVALID,'INVALID_REQUEST');

    lastInvocationResult = null;
    lastRuntimeStartResult = null;

    const invocationResult = invocation.assess({
      rulesetVersion:INVOCATION_RULESET_VERSION,
      currentExecutionStartEvidenceRef:request.currentExecutionStartEvidenceRef,
      executionStartId:request.executionStartId,
      executionStartDigest:request.executionStartDigest,
      executionIntentId:request.executionIntentId,
      currentExecutionIntentEvidenceRef:request.currentExecutionIntentEvidenceRef,
      executionStartRequirementEvidenceRef:request.executionStartRequirementEvidenceRef,
      expectedPrincipalRef:request.principalRef,
      expectedPrincipalRevision:request.principalRevision,
      interactionId:request.interactionId,
      interactionRevision:request.interactionRevision,
      gateId:request.gateId,
      gateRevision:request.gateRevision,
      authorityScopeDigest:request.authorityScopeDigest,
      continuationTargetRef:request.continuationTargetRef,
      executionTargetRef:request.executionTargetRef
    });

    if (!plain(invocationResult) || invocationResult.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'INVOCATION_RESULT_INVALID');
    if (invocationResult.outcome==='NOT_INVOKABLE') return result(OUTCOMES.NOT_INVOKABLE,invocationResult.reason);
    if (invocationResult.outcome==='INVALID') return result(OUTCOMES.INVALID,invocationResult.reason);
    if (invocationResult.outcome!=='INVOKED' || !plain(invocationResult.invocationRecord)) return result(OUTCOMES.UNKNOWN,invocationResult.reason||'INVOCATION_UNRESOLVED');
    lastInvocationResult = invocationResult;

    const ir = invocationResult.invocationRecord;
    const runtimeResult = runtimeStart.assess({
      rulesetVersion:RUNTIME_START_RULESET_VERSION,
      invocationId:ir.invocationId,
      executionStartId:request.executionStartId,
      currentExecutionStartEvidenceRef:request.currentExecutionStartEvidenceRef,
      executionStartDigest:request.executionStartDigest,
      executionIntentId:request.executionIntentId,
      currentExecutionIntentEvidenceRef:request.currentExecutionIntentEvidenceRef,
      executionStartRequirementEvidenceRef:request.executionStartRequirementEvidenceRef,
      expectedPrincipalRef:request.principalRef,
      expectedPrincipalRevision:request.principalRevision,
      interactionId:request.interactionId,
      interactionRevision:request.interactionRevision,
      gateId:request.gateId,
      gateRevision:request.gateRevision,
      authorityScopeDigest:request.authorityScopeDigest,
      continuationTargetRef:request.continuationTargetRef,
      executionTargetRef:request.executionTargetRef,
      runtimeOccurrenceRef:ir.runtimeOccurrenceRef
    });

    if (!plain(runtimeResult) || runtimeResult.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'RUNTIME_START_RESULT_INVALID');
    if (runtimeResult.outcome==='NOT_OBSERVED') return result(OUTCOMES.NOT_OBSERVED,runtimeResult.reason);
    if (runtimeResult.outcome==='INVALID') return result(OUTCOMES.INVALID,runtimeResult.reason);
    if (runtimeResult.outcome!=='OBSERVED' || !plain(runtimeResult.evidence)) return result(OUTCOMES.UNKNOWN,runtimeResult.reason||'RUNTIME_START_UNRESOLVED');
    lastRuntimeStartResult = runtimeResult;

    const re = runtimeResult.evidence;
    const observationResult = observation.assess({
      rulesetVersion:OBSERVATION_RULESET_VERSION,
      currentExecutionStartEvidenceRef:request.currentExecutionStartEvidenceRef,
      runtimeStartEvidenceRef:re.runtimeStartEvidenceRef,
      executionStartId:request.executionStartId,
      executionStartDigest:request.executionStartDigest,
      executionIntentId:request.executionIntentId,
      currentExecutionIntentEvidenceRef:request.currentExecutionIntentEvidenceRef,
      executionStartRequirementEvidenceRef:request.executionStartRequirementEvidenceRef,
      invocationId:re.invocationId,
      invocationDigest:re.invocationDigest,
      expectedPrincipalRef:request.principalRef,
      expectedPrincipalRevision:request.principalRevision,
      interactionId:request.interactionId,
      interactionRevision:request.interactionRevision,
      gateId:request.gateId,
      gateRevision:request.gateRevision,
      authorityScopeDigest:request.authorityScopeDigest,
      continuationTargetRef:request.continuationTargetRef,
      executionTargetRef:request.executionTargetRef
    });

    if (!plain(observationResult) || observationResult.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'OBSERVATION_RESULT_INVALID');
    if (observationResult.outcome==='NOT_OBSERVED') return result(OUTCOMES.NOT_OBSERVED,observationResult.reason);
    if (observationResult.outcome==='INVALID') return result(OUTCOMES.INVALID,observationResult.reason);
    if (observationResult.outcome!=='OBSERVED' || !plain(observationResult.observation)) return result(OUTCOMES.UNKNOWN,observationResult.reason||'OBSERVATION_UNRESOLVED');
    return result(OUTCOMES.OBSERVED,null,observationResult.observation);
  }

  return Object.freeze({ assess, rulesetVersion:RULESET_VERSION, authority:AUTHORITY });
}

module.exports=Object.freeze({ RULESET_VERSION, AUTHORITY, GOVERNANCE_PRINCIPAL_REF, GOVERNANCE_PRINCIPAL_REVISION, OUTCOMES, createCurrentBoundedExecutionStartRuntimeExecutionStartObservationWiring });
