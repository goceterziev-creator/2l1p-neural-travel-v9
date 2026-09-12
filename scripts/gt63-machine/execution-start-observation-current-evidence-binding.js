'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'execution-start-observation-current-evidence-binding-v0.1.0';
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
    executionStarted:outcome===OUTCOMES.OBSERVED,
    executionSucceeded:false,
    continuationExecuted:false,
    effectAuthorized:false,
    effectPerformed:false,
    effectVerified:false
  });
}

function validCurrentStartResult(wrapper){
  const e=wrapper && wrapper.evidence;
  return Boolean(plain(wrapper)
    && wrapper.outcome==='RESOLVED'
    && wrapper.authority===AUTHORITY
    && wrapper.executionStartPermitted===false
    && wrapper.executionStarted===false
    && wrapper.continuationExecuted===false
    && wrapper.effectAuthorized===false
    && wrapper.effectPerformed===false
    && wrapper.effectVerified===false
    && plain(e)
    && e.type==='GT63_CURRENT_BOUNDED_CONTINUATION_EXECUTION_START_EVIDENCE'
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
    && e.lifecycleState==='CURRENT'
    && e.freshnessState==='CURRENT'
    && e.contradictionState==='NONE'
    && e.authority===AUTHORITY
    && e.executionStartPermitted===false
    && e.executionStarted===false
    && e.continuationExecuted===false
    && e.effectAuthorized===false
    && e.effectPerformed===false
    && e.effectVerified===false);
}

function validRuntimeStartResult(wrapper){
  const e=wrapper && wrapper.evidence;
  return Boolean(plain(wrapper)
    && wrapper.outcome==='OBSERVED'
    && wrapper.authority===AUTHORITY
    && wrapper.executionStarted===true
    && wrapper.executionSucceeded===false
    && wrapper.continuationExecuted===false
    && wrapper.effectAuthorized===false
    && wrapper.effectPerformed===false
    && wrapper.effectVerified===false
    && plain(e)
    && e.type==='GT63_RUNTIME_EXECUTION_START_EVIDENCE'
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
    && e.lifecycleState==='CURRENT'
    && e.freshnessState==='CURRENT'
    && e.contradictionState==='NONE'
    && e.authority===AUTHORITY
    && e.invocationAttempted===true
    && e.executionStarted===true
    && e.executionSucceeded===false
    && e.continuationExecuted===false
    && e.effectAuthorized===false
    && e.effectPerformed===false
    && e.effectVerified===false);
}

function createExecutionStartObservationCurrentEvidenceBinding({ currentExecutionStartResultPort, runtimeExecutionStartResultPort, observationLedger } = {}){
  if(typeof currentExecutionStartResultPort!=='function') throw new TypeError('currentExecutionStartResultPort must be a function');
  if(typeof runtimeExecutionStartResultPort!=='function') throw new TypeError('runtimeExecutionStartResultPort must be a function');
  if(!observationLedger || typeof observationLedger.get!=='function' || typeof observationLedger.commit!=='function') throw new TypeError('observationLedger required');

  function assess(request){
    const fields=['rulesetVersion','currentExecutionStartEvidenceRef','runtimeStartEvidenceRef','executionStartId','executionStartDigest','executionIntentId','currentExecutionIntentEvidenceRef','executionStartRequirementEvidenceRef','invocationId','invocationDigest','expectedPrincipalRef','expectedPrincipalRevision','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','executionTargetRef'];
    if(!plain(request)
      || Object.keys(request).length!==fields.length
      || Object.keys(request).some(key=>!fields.includes(key))
      || request.rulesetVersion!==RULESET_VERSION
      || !nonEmpty(request.currentExecutionStartEvidenceRef)
      || !nonEmpty(request.runtimeStartEvidenceRef)
      || !nonEmpty(request.executionStartId)
      || !/^sha256:[0-9a-f]{64}$/.test(request.executionStartDigest)
      || !nonEmpty(request.executionIntentId)
      || !nonEmpty(request.currentExecutionIntentEvidenceRef)
      || !nonEmpty(request.executionStartRequirementEvidenceRef)
      || !nonEmpty(request.invocationId)
      || !/^sha256:[0-9a-f]{64}$/.test(request.invocationDigest)
      || !nonEmpty(request.expectedPrincipalRef)
      || !nonEmpty(request.expectedPrincipalRevision)
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision) || request.interactionRevision<0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision) || request.gateRevision<1
      || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.executionTargetRef)) return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');

    let currentResult;
    try { currentResult=currentExecutionStartResultPort({currentExecutionStartEvidenceRef:request.currentExecutionStartEvidenceRef}); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'current execution start evidence unavailable'); }
    if(!validCurrentStartResult(currentResult)) return result(OUTCOMES.UNKNOWN,'current execution start evidence invalid or non-current');

    let runtimeResult;
    try { runtimeResult=runtimeExecutionStartResultPort({runtimeStartEvidenceRef:request.runtimeStartEvidenceRef}); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'runtime execution start evidence unavailable'); }
    if(runtimeResult && runtimeResult.outcome==='NOT_OBSERVED') return result(OUTCOMES.NOT_OBSERVED,'runtime execution start not observed');
    if(!validRuntimeStartResult(runtimeResult)) return result(OUTCOMES.UNKNOWN,'runtime execution start evidence invalid or non-current');

    const c=currentResult.evidence;
    const r=runtimeResult.evidence;

    if(c.currentExecutionStartEvidenceRef!==request.currentExecutionStartEvidenceRef
      || r.runtimeStartEvidenceRef!==request.runtimeStartEvidenceRef) return result(OUTCOMES.UNKNOWN,'upstream evidence reference mismatch');

    if(c.executionStartId!==request.executionStartId || r.executionStartId!==request.executionStartId
      || c.executionStartDigest!==request.executionStartDigest || r.executionStartDigest!==request.executionStartDigest
      || c.executionIntentId!==request.executionIntentId || r.executionIntentId!==request.executionIntentId
      || c.currentExecutionIntentEvidenceRef!==request.currentExecutionIntentEvidenceRef || r.currentExecutionIntentEvidenceRef!==request.currentExecutionIntentEvidenceRef
      || c.executionStartRequirementEvidenceRef!==request.executionStartRequirementEvidenceRef || r.executionStartRequirementEvidenceRef!==request.executionStartRequirementEvidenceRef
      || r.invocationId!==request.invocationId || r.invocationDigest!==request.invocationDigest
      || c.principalRef!==request.expectedPrincipalRef || r.principalRef!==request.expectedPrincipalRef
      || c.principalRevision!==request.expectedPrincipalRevision || r.principalRevision!==request.expectedPrincipalRevision
      || c.executionTargetRef!==request.executionTargetRef || r.executionTargetRef!==request.executionTargetRef) return result(OUTCOMES.NOT_OBSERVED,'evidence identity mismatch');

    const scopes=[c.contextScope,r.contextScope];
    for(const s of scopes){
      if(s.interactionId!==request.interactionId || s.gateId!==request.gateId || s.gateRevision!==request.gateRevision
        || s.authorityScopeDigest!==request.authorityScopeDigest || s.continuationTargetRef!==request.continuationTargetRef
        || request.interactionRevision<s.fromInteractionRevision
        || (s.throughInteractionRevision!==null && request.interactionRevision>s.throughInteractionRevision)) return result(OUTCOMES.NOT_OBSERVED,'evidence scope mismatch');
    }

    if(stringify(c.contextScope)!==stringify(r.contextScope)) return result(OUTCOMES.NOT_OBSERVED,'current-start and runtime-start scopes disagree');

    const currentScope={scopeType:'GATE',interactionId:request.interactionId,fromInteractionRevision:request.interactionRevision,throughInteractionRevision:request.interactionRevision,gateId:request.gateId,gateRevision:request.gateRevision,authorityScopeDigest:request.authorityScopeDigest,continuationTargetRef:request.continuationTargetRef};
    const material={
      type:'GT63_EXECUTION_START_OBSERVATION',schemaVersion:'1.0',rulesetVersion:RULESET_VERSION,
      executionStartId:request.executionStartId,
      currentExecutionStartEvidenceRef:request.currentExecutionStartEvidenceRef,
      runtimeStartEvidenceRef:request.runtimeStartEvidenceRef,
      executionStartDigest:request.executionStartDigest,
      executionIntentId:request.executionIntentId,
      currentExecutionIntentEvidenceRef:request.currentExecutionIntentEvidenceRef,
      executionStartRequirementEvidenceRef:request.executionStartRequirementEvidenceRef,
      invocationId:request.invocationId,invocationDigest:request.invocationDigest,
      principalRef:request.expectedPrincipalRef,principalRevision:request.expectedPrincipalRevision,
      executionTargetRef:request.executionTargetRef,contextScope:currentScope,
      observationState:'OBSERVED',authority:AUTHORITY,
      executionStarted:true,executionSucceeded:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false
    };
    const observation=Object.freeze({executionStartObservationId:`execution-start-observation:${digest(material).slice(7)}`,...material});

    let prior;
    try { prior=observationLedger.get(observation.executionStartObservationId); }
    catch(_) { return result(OUTCOMES.UNKNOWN,'observation ledger unavailable'); }
    if(prior) return stringify(prior)===stringify(observation)
      ? result(OUTCOMES.OBSERVED,'same execution start observation already accepted',prior)
      : result(OUTCOMES.UNKNOWN,'execution start observation identity conflict');

    try {
      const committed=observationLedger.commit(observation.executionStartObservationId,Object.freeze(clone(observation)));
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

module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createExecutionStartObservationCurrentEvidenceBinding,createMemoryLedger});
