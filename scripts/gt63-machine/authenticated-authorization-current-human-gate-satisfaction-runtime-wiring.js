'use strict';

const { RULESET_VERSION: BINDING_WIRING_RULESET_VERSION, createValidatedGovernanceEvidenceAuthorizationBindingWiring } = require('./validated-governance-evidence-authorization-binding-wiring');
const { RULESET_VERSION: CONSUMPTION_WIRING_RULESET_VERSION, createValidatedAuthorizationBindingGateRequirementHumanGateConsumptionWiring } = require('./validated-authorization-binding-gate-requirement-human-gate-consumption-wiring');
const { RULESET_VERSION: CURRENT_SATISFACTION_RULESET_VERSION, createCurrentHumanGateSatisfactionEvidence } = require('./current-human-gate-satisfaction-evidence');

const RULESET_VERSION = 'authenticated-authorization-current-human-gate-satisfaction-runtime-wiring-v0.1.0';
const AUTHORITY = 'NONE';
const GOVERNANCE_ACT = 'GATE_AUTHORIZATION';
const GOVERNANCE_PRINCIPAL_REF = 'gt63-machine:human-principal:goce-v0';
const GOVERNANCE_PRINCIPAL_REVISION = '1';
const OUTCOMES = Object.freeze({ RESOLVED:'RESOLVED', NOT_SATISFIED:'NOT_SATISFIED', NOT_AUTHORIZED:'NOT_AUTHORIZED', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });
const plain = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const freeze = v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(freeze); } return v; };
const exact = (o, fields) => plain(o) && Object.keys(o).length === fields.length && Object.keys(o).every(k => fields.includes(k));
const nonEmpty = v => typeof v === 'string' && v.length > 0;
const validScope = s => Boolean(s && s.scopeType==='GATE' && nonEmpty(s.interactionId) && Number.isInteger(s.fromInteractionRevision) && s.fromInteractionRevision>=0 && (s.throughInteractionRevision===null || (Number.isInteger(s.throughInteractionRevision)&&s.throughInteractionRevision>=s.fromInteractionRevision)) && nonEmpty(s.gateId) && Number.isInteger(s.gateRevision) && s.gateRevision>0 && /^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest) && nonEmpty(s.continuationTargetRef));
function result(outcome, reason, evidence=null) { return freeze({ rulesetVersion:RULESET_VERSION, outcome, reason:reason||null, evidence:clone(evidence), authority:AUTHORITY, humanGateSatisfied:outcome===OUTCOMES.RESOLVED, continuationAuthorized:false, continuationExecuted:false, executionAuthorityCreated:false, effectAuthorized:false, effectPerformed:false }); }
function call(port,arg) { try { return port(freeze(clone(arg))); } catch (_) { return null; } }

function createAuthenticatedAuthorizationCurrentHumanGateSatisfactionRuntimeWiring({ governancePrincipalBindingResultPort, principalEligibilityResultPort, roleRequirementResultPort, principalRoleResultPort, runtimeHumanAuthorizationResultPort, gateRequirementResultPort, satisfactionStatePort, bindingLedger, satisfactionLedger } = {}) {
  for (const [name,port] of Object.entries({ governancePrincipalBindingResultPort, principalEligibilityResultPort, roleRequirementResultPort, principalRoleResultPort, runtimeHumanAuthorizationResultPort, gateRequirementResultPort, satisfactionStatePort })) if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  for (const [name,ledger] of Object.entries({ bindingLedger, satisfactionLedger })) if (!ledger || typeof ledger.get!=='function' || typeof ledger.commit!=='function') throw new TypeError(`${name} get/commit required`);

  const runtimeAuthorizationAdapter = q => {
    const wrapper = call(runtimeHumanAuthorizationResultPort,q);
    if (!plain(wrapper) || wrapper.authority!==AUTHORITY) return null;
    if (wrapper.outcome==='HUMAN_GATE_AUTHORIZATION_RUNTIME_NOT_AUTHORIZED') return freeze({ outcome:'AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_NOT_AUTHORIZED', reason:wrapper.reason||null, evidence:null, authority:AUTHORITY });
    if (wrapper.outcome!=='HUMAN_GATE_AUTHORIZATION_RUNTIME_EVIDENCE_RESOLVED' || !plain(wrapper.value)) return null;
    const e=wrapper.value;
    if (e.type!=='GT63_AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE' || e.authority!==AUTHORITY || e.decision!=='APPROVE' || e.governanceAct!==GOVERNANCE_ACT || e.principalRef!==GOVERNANCE_PRINCIPAL_REF || e.principalRevision!==GOVERNANCE_PRINCIPAL_REVISION || !nonEmpty(e.humanAuthorizationEvidenceRef) || e.lifecycleState!=='CURRENT' || e.freshnessState!=='CURRENT' || e.contradictionState!=='NONE' || !validScope(e.contextScope)) return null;
    return freeze({ outcome:'AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED', reason:null, evidence:clone(e), authority:AUTHORITY });
  };

  const bindingWiring=createValidatedGovernanceEvidenceAuthorizationBindingWiring({ governancePrincipalBindingResultPort, principalEligibilityResultPort, roleRequirementResultPort, principalRoleResultPort, humanAuthorizationResultPort:runtimeAuthorizationAdapter, bindingLedger });
  let lastBinding=null, lastConsumption=null;
  const consumptionWiring=createValidatedAuthorizationBindingGateRequirementHumanGateConsumptionWiring({ authorizationBindingResultPort:q=>lastBinding && lastBinding.binding && lastBinding.binding.bindingId===q.bindingId ? lastBinding : null, gateRequirementResultPort, satisfactionLedger });
  const currentSatisfaction=createCurrentHumanGateSatisfactionEvidence({ satisfactionResultPort:q=>lastConsumption && lastConsumption.satisfaction && lastConsumption.satisfaction.satisfactionId===q.satisfactionId ? lastConsumption : null, satisfactionStatePort });

  function resolve(request) {
    const fields=['rulesetVersion','authorizationSubjectRef','authorizationSubjectRevision','humanAuthorizationEvidenceRef','principalRef','principalRevision','governanceAct','contextScope'];
    if (!exact(request,fields) || request.rulesetVersion!==RULESET_VERSION || !nonEmpty(request.authorizationSubjectRef) || !nonEmpty(request.authorizationSubjectRevision) || !nonEmpty(request.humanAuthorizationEvidenceRef) || request.principalRef!==GOVERNANCE_PRINCIPAL_REF || request.principalRevision!==GOVERNANCE_PRINCIPAL_REVISION || request.governanceAct!==GOVERNANCE_ACT || !validScope(request.contextScope)) return result(OUTCOMES.INVALID,'INVALID_REQUEST');
    lastBinding=null; lastConsumption=null;
    const binding=bindingWiring.assess({ rulesetVersion:BINDING_WIRING_RULESET_VERSION, authorizationSubjectRef:request.authorizationSubjectRef, authorizationSubjectRevision:request.authorizationSubjectRevision, governanceAct:request.governanceAct, contextScope:clone(request.contextScope), principalRef:request.principalRef, principalRevision:request.principalRevision, humanAuthorizationEvidenceRef:request.humanAuthorizationEvidenceRef });
    if (!plain(binding) || binding.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'AUTHORIZATION_BINDING_RESULT_INVALID');
    if (binding.outcome==='NOT_AUTHORIZED') return result(OUTCOMES.NOT_AUTHORIZED,binding.reason);
    if (binding.outcome==='INVALID') return result(OUTCOMES.INVALID,binding.reason);
    if (binding.outcome!=='AUTHORIZED' || !plain(binding.binding)) return result(OUTCOMES.UNKNOWN,binding.reason||'AUTHORIZATION_BINDING_UNRESOLVED');
    lastBinding=binding;
    const s=request.contextScope;
    const consumption=consumptionWiring.assess({ rulesetVersion:CONSUMPTION_WIRING_RULESET_VERSION, authorizationBindingId:binding.binding.bindingId, gateId:s.gateId, gateRevision:s.gateRevision, authorityScopeDigest:s.authorityScopeDigest, continuationTargetRef:s.continuationTargetRef, interactionId:s.interactionId, interactionRevision:s.fromInteractionRevision, expectedPrincipalRef:request.principalRef, expectedPrincipalRevision:request.principalRevision });
    if (!plain(consumption) || consumption.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'HUMAN_GATE_CONSUMPTION_RESULT_INVALID');
    if (consumption.outcome==='NOT_SATISFIED') return result(OUTCOMES.NOT_SATISFIED,consumption.reason);
    if (consumption.outcome==='INVALID') return result(OUTCOMES.INVALID,consumption.reason);
    if (consumption.outcome!=='SATISFIED' || !plain(consumption.satisfaction)) return result(OUTCOMES.UNKNOWN,consumption.reason||'HUMAN_GATE_CONSUMPTION_UNRESOLVED');
    lastConsumption=consumption;
    const current=currentSatisfaction.resolve({ rulesetVersion:CURRENT_SATISFACTION_RULESET_VERSION, satisfactionId:consumption.satisfaction.satisfactionId, expectedPrincipalRef:request.principalRef, expectedPrincipalRevision:request.principalRevision, gateId:s.gateId, gateRevision:s.gateRevision, interactionId:s.interactionId, interactionRevision:s.fromInteractionRevision, authorityScopeDigest:s.authorityScopeDigest, continuationTargetRef:s.continuationTargetRef });
    if (!plain(current) || current.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'CURRENT_SATISFACTION_RESULT_INVALID');
    if (current.outcome==='NOT_RESOLVED') return result(OUTCOMES.NOT_SATISFIED,current.reason);
    if (current.outcome==='INVALID') return result(OUTCOMES.INVALID,current.reason);
    if (current.outcome!=='RESOLVED' || !plain(current.evidence)) return result(OUTCOMES.UNKNOWN,current.reason||'CURRENT_SATISFACTION_UNRESOLVED');
    return result(OUTCOMES.RESOLVED,null,current.evidence);
  }
  return Object.freeze({ resolve, rulesetVersion:RULESET_VERSION, authority:AUTHORITY });
}
module.exports=Object.freeze({ RULESET_VERSION, AUTHORITY, GOVERNANCE_ACT, GOVERNANCE_PRINCIPAL_REF, GOVERNANCE_PRINCIPAL_REVISION, OUTCOMES, createAuthenticatedAuthorizationCurrentHumanGateSatisfactionRuntimeWiring });
