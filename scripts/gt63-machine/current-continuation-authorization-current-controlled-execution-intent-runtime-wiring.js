'use strict';

const { RULESET_VERSION: EXECUTION_BINDING_RULESET_VERSION, createControlledContinuationExecutionCurrentEvidenceBinding } = require('./controlled-continuation-execution-current-evidence-binding');
const { RULESET_VERSION: CURRENT_INTENT_RULESET_VERSION, createCurrentControlledContinuationExecutionIntentEvidence } = require('./current-controlled-continuation-execution-intent-evidence');

const RULESET_VERSION = 'current-continuation-authorization-current-controlled-execution-intent-runtime-wiring-v0.1.0';
const AUTHORITY = 'NONE';
const GOVERNANCE_PRINCIPAL_REF = 'gt63-machine:human-principal:goce-v0';
const GOVERNANCE_PRINCIPAL_REVISION = '1';
const OUTCOMES = Object.freeze({ RESOLVED:'RESOLVED', NOT_EXECUTABLE:'NOT_EXECUTABLE', NOT_RESOLVED:'NOT_RESOLVED', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });

const plain = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const freeze = v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(freeze); } return v; };
const exact = (o, fields) => plain(o) && Object.keys(o).length === fields.length && Object.keys(o).every(k => fields.includes(k));
const nonEmpty = v => typeof v === 'string' && v.length > 0;
function result(outcome, reason, evidence=null){ return freeze({ rulesetVersion:RULESET_VERSION, outcome, reason:reason||null, evidence:clone(evidence), authority:AUTHORITY, executionStartPermitted:false, executionStarted:false, continuationExecuted:false, effectAuthorized:false, effectPerformed:false, effectVerified:false }); }

function createCurrentContinuationAuthorizationCurrentControlledExecutionIntentRuntimeWiring({
  currentAuthorizationResultPort,
  executionRequirementResultPort,
  executionIntentStatePort,
  executionLedger
} = {}) {
  for (const [name,port] of Object.entries({ currentAuthorizationResultPort, executionRequirementResultPort, executionIntentStatePort })) if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  if (!executionLedger || typeof executionLedger.get !== 'function' || typeof executionLedger.commit !== 'function') throw new TypeError('executionLedger get/commit required');

  let lastIntentResult = null;
  const binding = createControlledContinuationExecutionCurrentEvidenceBinding({ currentAuthorizationResultPort, executionRequirementResultPort, executionLedger });
  const currentIntent = createCurrentControlledContinuationExecutionIntentEvidence({
    executionIntentPort: q => lastIntentResult && lastIntentResult.executionIntent && lastIntentResult.executionIntent.executionIntentId === q.executionIntentId ? lastIntentResult.executionIntent : null,
    executionIntentStatePort
  });

  function resolve(request) {
    const fields=['rulesetVersion','currentContinuationAuthorizationEvidenceRef','executionRequirementEvidenceRef','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','executionTargetRef','expectedPrincipalRef','expectedPrincipalRevision'];
    if (!exact(request,fields)
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.currentContinuationAuthorizationEvidenceRef)
      || !nonEmpty(request.executionRequirementEvidenceRef)
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision) || request.interactionRevision < 0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision) || request.gateRevision < 1
      || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.executionTargetRef)
      || request.expectedPrincipalRef !== GOVERNANCE_PRINCIPAL_REF
      || request.expectedPrincipalRevision !== GOVERNANCE_PRINCIPAL_REVISION) return result(OUTCOMES.INVALID,'INVALID_REQUEST');

    lastIntentResult = null;
    let assessed;
    try {
      assessed = binding.assess({
        rulesetVersion:EXECUTION_BINDING_RULESET_VERSION,
        currentContinuationAuthorizationEvidenceRef:request.currentContinuationAuthorizationEvidenceRef,
        executionRequirementEvidenceRef:request.executionRequirementEvidenceRef,
        interactionId:request.interactionId,
        interactionRevision:request.interactionRevision,
        gateId:request.gateId,
        gateRevision:request.gateRevision,
        authorityScopeDigest:request.authorityScopeDigest,
        continuationTargetRef:request.continuationTargetRef,
        executionTargetRef:request.executionTargetRef,
        expectedPrincipalRef:request.expectedPrincipalRef,
        expectedPrincipalRevision:request.expectedPrincipalRevision
      });
    } catch (_) { return result(OUTCOMES.UNKNOWN,'EXECUTION_BINDING_UNAVAILABLE'); }
    if (!plain(assessed) || assessed.authority !== AUTHORITY) return result(OUTCOMES.UNKNOWN,'EXECUTION_BINDING_RESULT_INVALID');
    if (assessed.outcome === 'NOT_EXECUTABLE') return result(OUTCOMES.NOT_EXECUTABLE,assessed.reason);
    if (assessed.outcome === 'INVALID') return result(OUTCOMES.INVALID,assessed.reason);
    if (assessed.outcome !== 'EXECUTABLE' || !plain(assessed.executionIntent)) return result(OUTCOMES.UNKNOWN,assessed.reason || 'EXECUTION_INTENT_UNRESOLVED');

    lastIntentResult = assessed;
    let current;
    try {
      current = currentIntent.assess({
        rulesetVersion:CURRENT_INTENT_RULESET_VERSION,
        executionIntentId:assessed.executionIntent.executionIntentId,
        currentContinuationAuthorizationEvidenceRef:request.currentContinuationAuthorizationEvidenceRef,
        executionRequirementEvidenceRef:request.executionRequirementEvidenceRef,
        expectedPrincipalRef:request.expectedPrincipalRef,
        expectedPrincipalRevision:request.expectedPrincipalRevision,
        interactionId:request.interactionId,
        interactionRevision:request.interactionRevision,
        gateId:request.gateId,
        gateRevision:request.gateRevision,
        authorityScopeDigest:request.authorityScopeDigest,
        continuationTargetRef:request.continuationTargetRef,
        executionTargetRef:request.executionTargetRef
      });
    } catch (_) { return result(OUTCOMES.UNKNOWN,'CURRENT_EXECUTION_INTENT_UNAVAILABLE'); }
    if (!plain(current) || current.authority !== AUTHORITY) return result(OUTCOMES.UNKNOWN,'CURRENT_EXECUTION_INTENT_RESULT_INVALID');
    if (current.outcome === 'NOT_RESOLVED') return result(OUTCOMES.NOT_RESOLVED,current.reason);
    if (current.outcome === 'INVALID') return result(OUTCOMES.INVALID,current.reason);
    if (current.outcome !== 'RESOLVED' || !plain(current.evidence)) return result(OUTCOMES.UNKNOWN,current.reason || 'CURRENT_EXECUTION_INTENT_UNRESOLVED');
    return result(OUTCOMES.RESOLVED,null,current.evidence);
  }

  return Object.freeze({ resolve, rulesetVersion:RULESET_VERSION, authority:AUTHORITY });
}

module.exports = Object.freeze({ RULESET_VERSION, AUTHORITY, GOVERNANCE_PRINCIPAL_REF, GOVERNANCE_PRINCIPAL_REVISION, OUTCOMES, createCurrentContinuationAuthorizationCurrentControlledExecutionIntentRuntimeWiring });
