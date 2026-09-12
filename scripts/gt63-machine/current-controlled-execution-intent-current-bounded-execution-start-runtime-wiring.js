'use strict';

const { RULESET_VERSION: START_BINDING_RULESET_VERSION, createBoundedContinuationExecutionStartCurrentEvidenceBinding } = require('./bounded-continuation-execution-start-current-evidence-binding');
const { RULESET_VERSION: CURRENT_START_RULESET_VERSION, createCurrentBoundedContinuationExecutionStartEvidence } = require('./current-bounded-continuation-execution-start-evidence');

const RULESET_VERSION = 'current-controlled-execution-intent-current-bounded-execution-start-runtime-wiring-v0.1.0';
const AUTHORITY = 'NONE';
const GOVERNANCE_PRINCIPAL_REF = 'gt63-machine:human-principal:goce-v0';
const GOVERNANCE_PRINCIPAL_REVISION = '1';
const OUTCOMES = Object.freeze({ RESOLVED:'RESOLVED', NOT_STARTABLE:'NOT_STARTABLE', NOT_RESOLVED:'NOT_RESOLVED', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });

const plain = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const freeze = v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(freeze); } return v; };
const exact = (o, fields) => plain(o) && Object.keys(o).length === fields.length && Object.keys(o).every(k => fields.includes(k));
const nonEmpty = v => typeof v === 'string' && v.length > 0;
const validScope = s => Boolean(s && s.scopeType==='GATE' && nonEmpty(s.interactionId) && Number.isInteger(s.fromInteractionRevision) && s.fromInteractionRevision>=0 && (s.throughInteractionRevision===null || (Number.isInteger(s.throughInteractionRevision)&&s.throughInteractionRevision>=s.fromInteractionRevision)) && nonEmpty(s.gateId) && Number.isInteger(s.gateRevision) && s.gateRevision>0 && /^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest) && nonEmpty(s.continuationTargetRef));

function result(outcome, reason, evidence=null) {
  return freeze({ rulesetVersion:RULESET_VERSION, outcome, reason:reason||null, evidence:clone(evidence), authority:AUTHORITY, executionStartPermitted:false, executionStarted:false, continuationExecuted:false, effectAuthorized:false, effectPerformed:false, effectVerified:false });
}
function call(port,arg){ try { return port(freeze(clone(arg))); } catch (_) { return null; } }

function createCurrentControlledExecutionIntentCurrentBoundedExecutionStartRuntimeWiring({ currentExecutionIntentResultPort, executionStartRequirementResultPort, executionStartStatePort, startLedger } = {}) {
  for (const [name,port] of Object.entries({ currentExecutionIntentResultPort, executionStartRequirementResultPort, executionStartStatePort })) if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  if (!startLedger || typeof startLedger.get!=='function' || typeof startLedger.commit!=='function') throw new TypeError('startLedger get/commit required');

  let lastStartResult=null;
  const startBinding=createBoundedContinuationExecutionStartCurrentEvidenceBinding({
    currentExecutionIntentResultPort,
    executionStartRequirementResultPort,
    startLedger
  });
  const currentStart=createCurrentBoundedContinuationExecutionStartEvidence({
    executionStartPort:q=>lastStartResult && lastStartResult.startRecord && lastStartResult.startRecord.executionStartId===q.executionStartId ? lastStartResult.startRecord : null,
    executionStartStatePort
  });

  function resolve(request) {
    const fields=['rulesetVersion','executionIntentId','currentExecutionIntentEvidenceRef','executionStartRequirementEvidenceRef','principalRef','principalRevision','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','executionTargetRef'];
    if (!exact(request,fields)
      || request.rulesetVersion!==RULESET_VERSION
      || !nonEmpty(request.executionIntentId)
      || !nonEmpty(request.currentExecutionIntentEvidenceRef)
      || !nonEmpty(request.executionStartRequirementEvidenceRef)
      || request.principalRef!==GOVERNANCE_PRINCIPAL_REF
      || request.principalRevision!==GOVERNANCE_PRINCIPAL_REVISION
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision) || request.interactionRevision<0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision) || request.gateRevision<1
      || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.executionTargetRef)) return result(OUTCOMES.INVALID,'INVALID_REQUEST');

    lastStartResult=null;
    const start=startBinding.assess({
      rulesetVersion:START_BINDING_RULESET_VERSION,
      executionIntentId:request.executionIntentId,
      currentExecutionIntentEvidenceRef:request.currentExecutionIntentEvidenceRef,
      executionStartRequirementEvidenceRef:request.executionStartRequirementEvidenceRef,
      interactionId:request.interactionId,
      interactionRevision:request.interactionRevision,
      gateId:request.gateId,
      gateRevision:request.gateRevision,
      authorityScopeDigest:request.authorityScopeDigest,
      continuationTargetRef:request.continuationTargetRef,
      executionTargetRef:request.executionTargetRef,
      expectedPrincipalRef:request.principalRef,
      expectedPrincipalRevision:request.principalRevision
    });
    if (!plain(start) || start.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'EXECUTION_START_BINDING_RESULT_INVALID');
    if (start.outcome==='NOT_STARTABLE') return result(OUTCOMES.NOT_STARTABLE,start.reason);
    if (start.outcome==='INVALID') return result(OUTCOMES.INVALID,start.reason);
    if (start.outcome!=='STARTABLE' || !plain(start.startRecord)) return result(OUTCOMES.UNKNOWN,start.reason||'EXECUTION_START_BINDING_UNRESOLVED');
    lastStartResult=start;

    const current=currentStart.assess({
      rulesetVersion:CURRENT_START_RULESET_VERSION,
      executionStartId:start.startRecord.executionStartId,
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
    if (!plain(current) || current.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'CURRENT_EXECUTION_START_RESULT_INVALID');
    if (current.outcome==='NOT_RESOLVED') return result(OUTCOMES.NOT_RESOLVED,current.reason);
    if (current.outcome==='INVALID') return result(OUTCOMES.INVALID,current.reason);
    if (current.outcome!=='RESOLVED' || !plain(current.evidence)) return result(OUTCOMES.UNKNOWN,current.reason||'CURRENT_EXECUTION_START_UNRESOLVED');
    if (!validScope(current.evidence.contextScope)) return result(OUTCOMES.UNKNOWN,'CURRENT_EXECUTION_START_SCOPE_INVALID');
    return result(OUTCOMES.RESOLVED,null,current.evidence);
  }

  return Object.freeze({ resolve, rulesetVersion:RULESET_VERSION, authority:AUTHORITY });
}

module.exports=Object.freeze({ RULESET_VERSION, AUTHORITY, GOVERNANCE_PRINCIPAL_REF, GOVERNANCE_PRINCIPAL_REVISION, OUTCOMES, createCurrentControlledExecutionIntentCurrentBoundedExecutionStartRuntimeWiring });
