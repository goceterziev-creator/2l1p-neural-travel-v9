'use strict';

const {
  createHumanGateAuthorizationConsumption
} = require('./human-gate-authorization-consumption');
const {
  createHumanGateConsumptionEvidencePorts
} = require('./human-gate-consumption-evidence-ports');

const RULESET_VERSION='authorization-binding-ledger-human-gate-consumption-wiring-v0.1.0';
const AUTHORITY='NONE';

function createAuthorizationBindingLedgerHumanGateConsumptionWiring({
  bindingLedger,
  gateRequirementRegistry,
  satisfactionLedger
}={}){
  if(!bindingLedger||typeof bindingLedger.get!=='function') throw new TypeError('bindingLedger.get is required');
  if(!gateRequirementRegistry||typeof gateRequirementRegistry.getGateRequirement!=='function') throw new TypeError('gateRequirementRegistry.getGateRequirement is required');
  if(!satisfactionLedger||typeof satisfactionLedger.get!=='function'||typeof satisfactionLedger.commit!=='function') throw new TypeError('satisfactionLedger get/commit required');

  const registry=Object.freeze({
    getBinding(bindingId){ return bindingLedger.get(bindingId); },
    getGateRequirement(request){ return gateRequirementRegistry.getGateRequirement(request); }
  });
  const ports=createHumanGateConsumptionEvidencePorts({registry});
  const consumption=createHumanGateAuthorizationConsumption({
    authorizationBindingPort:ports.authorizationBindingPort,
    gateRequirementPort:ports.gateRequirementPort,
    satisfactionLedger
  });

  return Object.freeze({
    rulesetVersion:RULESET_VERSION,
    authority:AUTHORITY,
    assess:consumption.assess
  });
}

module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,createAuthorizationBindingLedgerHumanGateConsumptionWiring});
