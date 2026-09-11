'use strict';

const {
  RULESET_VERSION: CONSUMPTION_RULESET_VERSION,
  OUTCOMES: CONSUMPTION_OUTCOMES,
  createHumanGateAuthorizationConsumption
} = require('./human-gate-authorization-consumption');

const RULESET_VERSION = 'validated-authorization-binding-gate-requirement-human-gate-consumption-wiring-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({ SATISFIED:'SATISFIED', NOT_SATISFIED:'NOT_SATISFIED', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });
const plain = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const freeze = v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(freeze); } return v; };
const exact = (o, fields) => plain(o) && Object.keys(o).length === fields.length && Object.keys(o).every(k => fields.includes(k));
const call = (port, arg) => { try { return port(freeze(clone(arg))); } catch (_) { return null; } };

function result(outcome, reason, satisfaction=null) {
  return freeze({ rulesetVersion:RULESET_VERSION, outcome, reason:reason||null, satisfaction:clone(satisfaction), authority:AUTHORITY, humanGateSatisfied:outcome===OUTCOMES.SATISFIED, continuationAuthorized:false, continuationExecuted:false, executionAuthorityCreated:false, effectAuthorized:false, effectPerformed:false });
}

function createValidatedAuthorizationBindingGateRequirementHumanGateConsumptionWiring({ authorizationBindingResultPort, gateRequirementResultPort, satisfactionLedger } = {}) {
  if (typeof authorizationBindingResultPort !== 'function') throw new TypeError('authorizationBindingResultPort must be a function');
  if (typeof gateRequirementResultPort !== 'function') throw new TypeError('gateRequirementResultPort must be a function');
  if (!satisfactionLedger || typeof satisfactionLedger.get !== 'function' || typeof satisfactionLedger.commit !== 'function') throw new TypeError('satisfactionLedger get/commit required');

  const consumer = createHumanGateAuthorizationConsumption({
    authorizationBindingPort: q => {
      const wrapper = call(authorizationBindingResultPort, q);
      if (!plain(wrapper) || wrapper.outcome !== 'AUTHORIZED' || wrapper.authority !== AUTHORITY || wrapper.humanGateSatisfied !== false || wrapper.continuationAuthorityCreated !== false || wrapper.executionAuthorityCreated !== false || wrapper.effectAuthorized !== false) return null;
      const binding = wrapper.binding;
      return plain(binding) && binding.authority === AUTHORITY ? binding : null;
    },
    gateRequirementPort: q => {
      const wrapper = call(gateRequirementResultPort, q);
      if (!plain(wrapper) || wrapper.outcome !== 'RESOLVED' || wrapper.authority !== AUTHORITY || wrapper.humanGateSatisfied !== false || wrapper.continuationAuthorized !== false || wrapper.continuationExecuted !== false || wrapper.executionAuthorityCreated !== false || wrapper.effectAuthorized !== false || wrapper.effectPerformed !== false) return null;
      const evidence = wrapper.evidence;
      return plain(evidence) && evidence.authority === AUTHORITY ? evidence : null;
    },
    satisfactionLedger
  });

  function assess(request) {
    const fields=['rulesetVersion','authorizationBindingId','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','interactionId','interactionRevision','expectedPrincipalRef','expectedPrincipalRevision'];
    if (!exact(request, fields) || request.rulesetVersion !== RULESET_VERSION) return result(OUTCOMES.INVALID,'INVALID_REQUEST');
    const downstream = clone(request); downstream.rulesetVersion = CONSUMPTION_RULESET_VERSION;
    let assessed; try { assessed = consumer.assess(freeze(downstream)); } catch (_) { return result(OUTCOMES.UNKNOWN,'HUMAN_GATE_CONSUMPTION_UNAVAILABLE'); }
    if (!plain(assessed) || assessed.authority !== AUTHORITY) return result(OUTCOMES.UNKNOWN,'HUMAN_GATE_CONSUMPTION_RESULT_INVALID');
    const mapped = assessed.outcome === CONSUMPTION_OUTCOMES.SATISFIED ? OUTCOMES.SATISFIED : assessed.outcome === CONSUMPTION_OUTCOMES.NOT_SATISFIED ? OUTCOMES.NOT_SATISFIED : assessed.outcome === CONSUMPTION_OUTCOMES.INVALID ? OUTCOMES.INVALID : OUTCOMES.UNKNOWN;
    return result(mapped, assessed.reason, assessed.satisfaction);
  }

  return Object.freeze({ assess, rulesetVersion:RULESET_VERSION, authority:AUTHORITY });
}

module.exports = Object.freeze({ RULESET_VERSION, AUTHORITY, OUTCOMES, createValidatedAuthorizationBindingGateRequirementHumanGateConsumptionWiring });
