'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'runtime-continuation-completion-evidence-v0.1.0';
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
    executionStarted:outcome===OUTCOMES.OBSERVED || outcome===OUTCOMES.NOT_OBSERVED,
    executionSucceeded:false,
    continuationExecuted:outcome===OUTCOMES.OBSERVED,
    effectAuthorized:false,
    effectPerformed:false,
    effectVerified:false
  });
}

function validStartObservation(wrapper){
  const o = wrapper && wrapper.observation;
  return Boolean(plain(wrapper)
    && wrapper.outcome === 'OBSERVED'
    && wrapper.authority === AUTHORITY
    && wrapper.executionStarted === true
    && wrapper.executionSucceeded === false
    && wrapper.continuationExecuted === false
    && wrapper.effectAuthorized === false
    && wrapper.effectPerformed === false
    && wrapper.effectVerified === false
    && plain(o)
    && o.type === 'GT63_EXECUTION_START_OBSERVATION'
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
    && o.observationState === 'OBSERVED'
    && o.authority === AUTHORITY
    && o.executionStarted === true
    && o.executionSucceeded === false
    && o.continuationExecuted === false
    && o.effectAuthorized === false
    && o.effectPerformed === false
    && o.effectVerified === false);
}

function validRuntimeStart(wrapper){
  const e = wrapper && wrapper.evidence;
  return Boolean(plain(wrapper)
    && wrapper.outcome === 'OBSERVED'
    && wrapper.authority === AUTHORITY
    && wrapper.executionStarted === true
    && wrapper.executionSucceeded === false
    && wrapper.continuationExecuted === false
    && wrapper.effectAuthorized === false
    && wrapper.effectPerformed === false
    && wrapper.effectVerified === false
    && plain(e)
    && e.type === 'GT63_RUNTIME_EXECUTION_START_EVIDENCE'
    && nonEmpty(e.runtimeStartEvidenceRef)
    && nonEmpty(e.invocationId)
    && /^sha256:[0-9a-f]{64}$/.test(e.invocationDigest)
    && nonEmpty(e.runtimeOccurrenceRef)
    && /^sha256:[0-9a-f]{64}$/.test(e.runtimeOccurrenceDigest)
    && nonEmpty(e.executionStartId)
    && nonEmpty(e.currentExecutionStartEvidenceRef)
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
    && e.invocationAttempted === true
    && e.executionStarted === true
    && e.executionSucceeded === false
    && e.continuationExecuted === false
    && e.effectAuthorized === false
    && e.effectPerformed === false
    && e.effectVerified === false);
}

function validCompletionRecord(record){
  return Boolean(plain(record)
    && nonEmpty(record.runtimeCompletionRef)
    && plain(record.runtimeCompletionMaterial));
}

function validAttestation(attestation){
  if(!plain(attestation)) return false;
  const fields=['executionStartObservationId','executionStartId','runtimeStartEvidenceRef','invocationId','invocationDigest','runtimeOccurrenceRef','runtimeOccurrenceDigest','runtimeCompletionRef','runtimeCompletionDigest','observationState','terminationObserved','continuationExecuted','lifecycleState','freshnessState','contradictionState','authority'];
  return Object.keys(attestation).length === fields.length
    && Object.keys(attestation).every(key=>fields.includes(key))
    && nonEmpty(attestation.executionStartObservationId)
    && nonEmpty(attestation.executionStartId)
    && nonEmpty(attestation.runtimeStartEvidenceRef)
    && nonEmpty(attestation.invocationId)
    && /^sha256:[0-9a-f]{64}$/.test(attestation.invocationDigest)
    && nonEmpty(attestation.runtimeOccurrenceRef)
    && /^sha256:[0-9a-f]{64}$/.test(attestation.runtimeOccurrenceDigest)
    && nonEmpty(attestation.runtimeCompletionRef)
    && /^sha256:[0-9a-f]{64}$/.test(attestation.runtimeCompletionDigest)
    && ['OBSERVED','NOT_OBSERVED'].includes(attestation.observationState)
    && typeof attestation.terminationObserved === 'boolean'
    && typeof attestation.continuationExecuted === 'boolean'
    && ((attestation.observationState === 'OBSERVED' && attestation.terminationObserved === true && attestation.continuationExecuted === true)
      || (attestation.observationState === 'NOT_OBSERVED' && attestation.continuationExecuted === false))
    && attestation.lifecycleState === 'CURRENT'
    && attestation.freshnessState === 'CURRENT'
    && attestation.contradictionState === 'NONE'
    && attestation.authority === AUTHORITY;
}

function createRuntimeContinuationCompletionEvidence({ executionStartObservationPort, runtimeExecutionStartResultPort, runtimeCompletionPort, runtimeCompletionVerifier } = {}){
  if(typeof executionStartObservationPort !== 'function') throw new TypeError('executionStartObservationPort must be a function');
  if(typeof runtimeExecutionStartResultPort !== 'function') throw new TypeError('runtimeExecutionStartResultPort must be a function');
  if(typeof runtimeCompletionPort !== 'function') throw new TypeError('runtimeCompletionPort must be a function');
  if(typeof runtimeCompletionVerifier !== 'function') throw new TypeError('runtimeCompletionVerifier must be a function');

  function assess(request){
    const fields=['rulesetVersion','executionStartObservationId','executionStartId','currentExecutionStartEvidenceRef','runtimeStartEvidenceRef','executionStartDigest','executionIntentId','currentExecutionIntentEvidenceRef','executionStartRequirementEvidenceRef','invocationId','invocationDigest','expectedPrincipalRef','expectedPrincipalRevision','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','executionTargetRef','runtimeCompletionRef'];
    if(!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key=>!fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.executionStartObservationId)
      || !nonEmpty(request.executionStartId)
      || !nonEmpty(request.currentExecutionStartEvidenceRef)
      || !nonEmpty(request.runtimeStartEvidenceRef)
      || !/^sha256:[0-9a-f]{64}$/.test(request.executionStartDigest)
      || !nonEmpty(request.executionIntentId)
      || !nonEmpty(request.currentExecutionIntentEvidenceRef)
      || !nonEmpty(request.executionStartRequirementEvidenceRef)
      || !nonEmpty(request.invocationId)
      || !/^sha256:[0-9a-f]{64}$/.test(request.invocationDigest)
      || !nonEmpty(request.expectedPrincipalRef)
      || !nonEmpty(request.expectedPrincipalRevision)
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision) || request.interactionRevision < 0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision) || request.gateRevision < 1
      || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.executionTargetRef)
      || !nonEmpty(request.runtimeCompletionRef)) return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');

    let startWrapper;
    try { startWrapper = executionStartObservationPort({executionStartObservationId:request.executionStartObservationId}); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'execution start observation unavailable'); }
    if(!validStartObservation(startWrapper)) return result(OUTCOMES.UNKNOWN,'execution start observation invalid');

    let runtimeStartWrapper;
    try { runtimeStartWrapper = runtimeExecutionStartResultPort({runtimeStartEvidenceRef:request.runtimeStartEvidenceRef}); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'runtime execution start evidence unavailable'); }
    if(!validRuntimeStart(runtimeStartWrapper)) return result(OUTCOMES.UNKNOWN,'runtime execution start evidence invalid or non-current');

    const o = startWrapper.observation;
    const r = runtimeStartWrapper.evidence;

    if(o.executionStartObservationId !== request.executionStartObservationId
      || o.executionStartId !== request.executionStartId || r.executionStartId !== request.executionStartId
      || o.currentExecutionStartEvidenceRef !== request.currentExecutionStartEvidenceRef || r.currentExecutionStartEvidenceRef !== request.currentExecutionStartEvidenceRef
      || o.runtimeStartEvidenceRef !== request.runtimeStartEvidenceRef || r.runtimeStartEvidenceRef !== request.runtimeStartEvidenceRef
      || o.executionStartDigest !== request.executionStartDigest || r.executionStartDigest !== request.executionStartDigest
      || o.executionIntentId !== request.executionIntentId || r.executionIntentId !== request.executionIntentId
      || o.currentExecutionIntentEvidenceRef !== request.currentExecutionIntentEvidenceRef || r.currentExecutionIntentEvidenceRef !== request.currentExecutionIntentEvidenceRef
      || o.executionStartRequirementEvidenceRef !== request.executionStartRequirementEvidenceRef || r.executionStartRequirementEvidenceRef !== request.executionStartRequirementEvidenceRef
      || o.invocationId !== request.invocationId || r.invocationId !== request.invocationId
      || o.invocationDigest !== request.invocationDigest || r.invocationDigest !== request.invocationDigest
      || o.principalRef !== request.expectedPrincipalRef || r.principalRef !== request.expectedPrincipalRef
      || o.principalRevision !== request.expectedPrincipalRevision || r.principalRevision !== request.expectedPrincipalRevision
      || o.executionTargetRef !== request.executionTargetRef || r.executionTargetRef !== request.executionTargetRef) return result(OUTCOMES.NOT_OBSERVED,'upstream execution identity mismatch');

    const scopes=[o.contextScope,r.contextScope];
    for(const s of scopes){
      if(s.interactionId!==request.interactionId || s.gateId!==request.gateId || s.gateRevision!==request.gateRevision
        || s.authorityScopeDigest!==request.authorityScopeDigest || s.continuationTargetRef!==request.continuationTargetRef
        || request.interactionRevision<s.fromInteractionRevision
        || (s.throughInteractionRevision!==null && request.interactionRevision>s.throughInteractionRevision)) return result(OUTCOMES.NOT_OBSERVED,'upstream execution scope mismatch');
    }
    if(stringify(o.contextScope)!==stringify(r.contextScope)) return result(OUTCOMES.NOT_OBSERVED,'start observation and runtime-start scopes disagree');

    let completion;
    try { completion = runtimeCompletionPort({runtimeCompletionRef:request.runtimeCompletionRef}); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'runtime completion material unavailable'); }
    if(!validCompletionRecord(completion) || completion.runtimeCompletionRef !== request.runtimeCompletionRef) return result(OUTCOMES.UNKNOWN,'runtime completion material invalid');

    const runtimeCompletionDigest = digest(completion.runtimeCompletionMaterial);
    let attestation;
    try {
      attestation = runtimeCompletionVerifier(Object.freeze({
        executionStartObservationId:o.executionStartObservationId,
        executionStartId:o.executionStartId,
        currentExecutionStartEvidenceRef:o.currentExecutionStartEvidenceRef,
        runtimeStartEvidenceRef:r.runtimeStartEvidenceRef,
        executionStartDigest:o.executionStartDigest,
        executionIntentId:o.executionIntentId,
        currentExecutionIntentEvidenceRef:o.currentExecutionIntentEvidenceRef,
        executionStartRequirementEvidenceRef:o.executionStartRequirementEvidenceRef,
        invocationId:r.invocationId,
        invocationDigest:r.invocationDigest,
        runtimeOccurrenceRef:r.runtimeOccurrenceRef,
        runtimeOccurrenceDigest:r.runtimeOccurrenceDigest,
        runtimeCompletionRef:completion.runtimeCompletionRef,
        runtimeCompletionDigest,
        runtimeCompletionMaterial:clone(completion.runtimeCompletionMaterial),
        principalRef:o.principalRef,
        principalRevision:o.principalRevision,
        executionTargetRef:o.executionTargetRef,
        contextScope:clone(o.contextScope),
        authority:AUTHORITY
      }));
    } catch(_) { return result(OUTCOMES.UNKNOWN,'runtime completion verifier failure'); }

    if(!validAttestation(attestation)
      || attestation.executionStartObservationId !== o.executionStartObservationId
      || attestation.executionStartId !== o.executionStartId
      || attestation.runtimeStartEvidenceRef !== r.runtimeStartEvidenceRef
      || attestation.invocationId !== r.invocationId
      || attestation.invocationDigest !== r.invocationDigest
      || attestation.runtimeOccurrenceRef !== r.runtimeOccurrenceRef
      || attestation.runtimeOccurrenceDigest !== r.runtimeOccurrenceDigest
      || attestation.runtimeCompletionRef !== completion.runtimeCompletionRef
      || attestation.runtimeCompletionDigest !== runtimeCompletionDigest) return result(OUTCOMES.UNKNOWN,'runtime completion attestation invalid or ambiguous');

    if(attestation.observationState === 'NOT_OBSERVED') return result(OUTCOMES.NOT_OBSERVED,'runtime verifier did not positively establish continuation completion');

    const currentScope={scopeType:'GATE',interactionId:request.interactionId,fromInteractionRevision:request.interactionRevision,throughInteractionRevision:request.interactionRevision,gateId:request.gateId,gateRevision:request.gateRevision,authorityScopeDigest:request.authorityScopeDigest,continuationTargetRef:request.continuationTargetRef};
    const material={
      type:'GT63_RUNTIME_CONTINUATION_COMPLETION_EVIDENCE',schemaVersion:'1.0',rulesetVersion:RULESET_VERSION,
      executionStartObservationId:o.executionStartObservationId,
      executionStartId:o.executionStartId,
      currentExecutionStartEvidenceRef:o.currentExecutionStartEvidenceRef,
      runtimeStartEvidenceRef:r.runtimeStartEvidenceRef,
      executionStartDigest:o.executionStartDigest,
      executionIntentId:o.executionIntentId,
      currentExecutionIntentEvidenceRef:o.currentExecutionIntentEvidenceRef,
      executionStartRequirementEvidenceRef:o.executionStartRequirementEvidenceRef,
      invocationId:r.invocationId,invocationDigest:r.invocationDigest,
      runtimeOccurrenceRef:r.runtimeOccurrenceRef,runtimeOccurrenceDigest:r.runtimeOccurrenceDigest,
      runtimeCompletionRef:completion.runtimeCompletionRef,runtimeCompletionDigest,
      principalRef:o.principalRef,principalRevision:o.principalRevision,
      executionTargetRef:o.executionTargetRef,contextScope:currentScope,
      lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:AUTHORITY,
      executionStarted:true,executionSucceeded:false,continuationExecuted:true,effectAuthorized:false,effectPerformed:false,effectVerified:false
    };
    const evidence=Object.freeze({runtimeCompletionEvidenceRef:`gt63-evidence:runtime-continuation-completion:${digest(material).slice(7)}`,...material});
    return result(OUTCOMES.OBSERVED,null,evidence);
  }

  return Object.freeze({assess,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}

module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createRuntimeContinuationCompletionEvidence});
