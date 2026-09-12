'use strict';

const { RULESET_VERSION: RUNTIME_COMPLETION_RULESET_VERSION, createRuntimeContinuationCompletionEvidence } = require('./runtime-continuation-completion-evidence');
const { RULESET_VERSION: COMPLETION_OBSERVATION_RULESET_VERSION, createContinuationCompletionObservationCurrentEvidenceBinding } = require('./continuation-completion-observation-current-evidence-binding');

const RULESET_VERSION = 'execution-start-observation-continuation-completion-observation-runtime-wiring-v0.1.0';
const AUTHORITY = 'NONE';
const GOVERNANCE_PRINCIPAL_REF = 'gt63-machine:human-principal:goce-v0';
const GOVERNANCE_PRINCIPAL_REVISION = '1';
const OUTCOMES = Object.freeze({ OBSERVED:'OBSERVED', NOT_OBSERVED:'NOT_OBSERVED', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });
const plain = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const nonEmpty = v => typeof v === 'string' && v.length > 0;
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const freeze = v => { if(v && typeof v === 'object' && !Object.isFrozen(v)){ Object.freeze(v); Object.values(v).forEach(freeze); } return v; };
const exact = (o,fields) => plain(o) && Object.keys(o).length===fields.length && Object.keys(o).every(k=>fields.includes(k));
function result(outcome, reason, observation=null){ return freeze({ rulesetVersion:RULESET_VERSION, outcome, reason:reason||null, observation:clone(observation), authority:AUTHORITY, executionStarted:outcome===OUTCOMES.OBSERVED||outcome===OUTCOMES.NOT_OBSERVED, executionSucceeded:false, continuationExecuted:outcome===OUTCOMES.OBSERVED, effectAuthorized:false, effectPerformed:false, effectVerified:false }); }

function createExecutionStartObservationContinuationCompletionObservationRuntimeWiring({ executionStartObservationResultPort, runtimeExecutionStartResultPort, runtimeCompletionPort, runtimeCompletionVerifier, completionObservationLedger } = {}){
  for(const [name,port] of Object.entries({ executionStartObservationResultPort, runtimeExecutionStartResultPort, runtimeCompletionPort, runtimeCompletionVerifier })) if(typeof port!=='function') throw new TypeError(`${name} must be a function`);
  if(!completionObservationLedger || typeof completionObservationLedger.get!=='function' || typeof completionObservationLedger.commit!=='function') throw new TypeError('completionObservationLedger get/commit required');

  let lastCompletion=null;
  const runtimeCompletion=createRuntimeContinuationCompletionEvidence({
    executionStartObservationPort:q=>executionStartObservationResultPort(q),
    runtimeExecutionStartResultPort:q=>runtimeExecutionStartResultPort(q),
    runtimeCompletionPort:q=>runtimeCompletionPort(q),
    runtimeCompletionVerifier:q=>runtimeCompletionVerifier(q)
  });
  const completionObservation=createContinuationCompletionObservationCurrentEvidenceBinding({
    executionStartObservationPort:q=>executionStartObservationResultPort(q),
    runtimeCompletionEvidencePort:q=>lastCompletion && lastCompletion.evidence && lastCompletion.evidence.runtimeCompletionEvidenceRef===q.runtimeCompletionEvidenceRef ? lastCompletion : null,
    observationLedger:completionObservationLedger
  });

  function resolve(request){
    const fields=['rulesetVersion','executionStartObservationId','executionStartId','currentExecutionStartEvidenceRef','runtimeStartEvidenceRef','executionStartDigest','executionIntentId','currentExecutionIntentEvidenceRef','executionStartRequirementEvidenceRef','invocationId','invocationDigest','runtimeOccurrenceRef','runtimeOccurrenceDigest','runtimeCompletionRef','principalRef','principalRevision','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','executionTargetRef'];
    if(!exact(request,fields) || request.rulesetVersion!==RULESET_VERSION || request.principalRef!==GOVERNANCE_PRINCIPAL_REF || request.principalRevision!==GOVERNANCE_PRINCIPAL_REVISION || !nonEmpty(request.executionStartObservationId) || !nonEmpty(request.executionStartId) || !nonEmpty(request.currentExecutionStartEvidenceRef) || !nonEmpty(request.runtimeStartEvidenceRef) || !/^sha256:[0-9a-f]{64}$/.test(request.executionStartDigest) || !nonEmpty(request.executionIntentId) || !nonEmpty(request.currentExecutionIntentEvidenceRef) || !nonEmpty(request.executionStartRequirementEvidenceRef) || !nonEmpty(request.invocationId) || !/^sha256:[0-9a-f]{64}$/.test(request.invocationDigest) || !nonEmpty(request.runtimeOccurrenceRef) || !/^sha256:[0-9a-f]{64}$/.test(request.runtimeOccurrenceDigest) || !nonEmpty(request.runtimeCompletionRef) || !nonEmpty(request.interactionId) || !Number.isInteger(request.interactionRevision) || request.interactionRevision<0 || !nonEmpty(request.gateId) || !Number.isInteger(request.gateRevision) || request.gateRevision<1 || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest) || !nonEmpty(request.continuationTargetRef) || !nonEmpty(request.executionTargetRef)) return result(OUTCOMES.INVALID,'INVALID_REQUEST');

    lastCompletion=null;
    const completion=runtimeCompletion.assess({ rulesetVersion:RUNTIME_COMPLETION_RULESET_VERSION, executionStartObservationId:request.executionStartObservationId, executionStartId:request.executionStartId, currentExecutionStartEvidenceRef:request.currentExecutionStartEvidenceRef, runtimeStartEvidenceRef:request.runtimeStartEvidenceRef, executionStartDigest:request.executionStartDigest, executionIntentId:request.executionIntentId, currentExecutionIntentEvidenceRef:request.currentExecutionIntentEvidenceRef, executionStartRequirementEvidenceRef:request.executionStartRequirementEvidenceRef, invocationId:request.invocationId, invocationDigest:request.invocationDigest, expectedPrincipalRef:request.principalRef, expectedPrincipalRevision:request.principalRevision, interactionId:request.interactionId, interactionRevision:request.interactionRevision, gateId:request.gateId, gateRevision:request.gateRevision, authorityScopeDigest:request.authorityScopeDigest, continuationTargetRef:request.continuationTargetRef, executionTargetRef:request.executionTargetRef, runtimeCompletionRef:request.runtimeCompletionRef });
    if(!plain(completion) || completion.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'RUNTIME_COMPLETION_RESULT_INVALID');
    if(completion.outcome==='NOT_OBSERVED') return result(OUTCOMES.NOT_OBSERVED,completion.reason);
    if(completion.outcome==='INVALID') return result(OUTCOMES.INVALID,completion.reason);
    if(completion.outcome!=='OBSERVED' || !plain(completion.evidence)) return result(OUTCOMES.UNKNOWN,completion.reason||'RUNTIME_COMPLETION_UNRESOLVED');
    lastCompletion=completion;
    const e=completion.evidence;
    const observation=completionObservation.assess({ rulesetVersion:COMPLETION_OBSERVATION_RULESET_VERSION, executionStartObservationId:request.executionStartObservationId, runtimeCompletionEvidenceRef:e.runtimeCompletionEvidenceRef, executionStartId:request.executionStartId, currentExecutionStartEvidenceRef:request.currentExecutionStartEvidenceRef, runtimeStartEvidenceRef:request.runtimeStartEvidenceRef, executionStartDigest:request.executionStartDigest, executionIntentId:request.executionIntentId, currentExecutionIntentEvidenceRef:request.currentExecutionIntentEvidenceRef, executionStartRequirementEvidenceRef:request.executionStartRequirementEvidenceRef, invocationId:request.invocationId, invocationDigest:request.invocationDigest, runtimeOccurrenceRef:e.runtimeOccurrenceRef, runtimeOccurrenceDigest:e.runtimeOccurrenceDigest, runtimeCompletionRef:e.runtimeCompletionRef, runtimeCompletionDigest:e.runtimeCompletionDigest, expectedPrincipalRef:request.principalRef, expectedPrincipalRevision:request.principalRevision, interactionId:request.interactionId, interactionRevision:request.interactionRevision, gateId:request.gateId, gateRevision:request.gateRevision, authorityScopeDigest:request.authorityScopeDigest, continuationTargetRef:request.continuationTargetRef, executionTargetRef:request.executionTargetRef });
    if(!plain(observation) || observation.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'COMPLETION_OBSERVATION_RESULT_INVALID');
    if(observation.outcome==='NOT_OBSERVED') return result(OUTCOMES.NOT_OBSERVED,observation.reason);
    if(observation.outcome==='INVALID') return result(OUTCOMES.INVALID,observation.reason);
    if(observation.outcome!=='OBSERVED' || !plain(observation.observation)) return result(OUTCOMES.UNKNOWN,observation.reason||'COMPLETION_OBSERVATION_UNRESOLVED');
    return result(OUTCOMES.OBSERVED,null,observation.observation);
  }

  return Object.freeze({ resolve, rulesetVersion:RULESET_VERSION, authority:AUTHORITY });
}

module.exports=Object.freeze({ RULESET_VERSION, AUTHORITY, GOVERNANCE_PRINCIPAL_REF, GOVERNANCE_PRINCIPAL_REVISION, OUTCOMES, createExecutionStartObservationContinuationCompletionObservationRuntimeWiring });
