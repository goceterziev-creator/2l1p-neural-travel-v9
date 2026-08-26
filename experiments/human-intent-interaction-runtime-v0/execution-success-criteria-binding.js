'use strict';

const SUCCESS_CRITERIA_BINDING_OUTCOMES = Object.freeze({
  SUCCESS_CRITERIA_BOUND: 'SUCCESS_CRITERIA_BOUND',
  SUCCESS_CRITERIA_ALREADY_BOUND: 'SUCCESS_CRITERIA_ALREADY_BOUND',
  EXECUTION_ACCEPTANCE_NOT_FOUND: 'EXECUTION_ACCEPTANCE_NOT_FOUND',
  GOVERNANCE_INTENT_NOT_FOUND: 'GOVERNANCE_INTENT_NOT_FOUND',
  GOVERNANCE_INTENT_STALE: 'GOVERNANCE_INTENT_STALE',
  SUCCESS_CONTRACT_NOT_FOUND: 'SUCCESS_CONTRACT_NOT_FOUND',
  SUCCESS_CRITERIA_NOT_BINDABLE: 'SUCCESS_CRITERIA_NOT_BINDABLE',
  PREPARATION_ALREADY_EXISTS: 'PREPARATION_ALREADY_EXISTS',
  SUCCESS_CRITERIA_BINDING_REJECTED: 'SUCCESS_CRITERIA_BINDING_REJECTED',
  SUCCESS_CRITERIA_BINDING_UNCERTAIN: 'SUCCESS_CRITERIA_BINDING_UNCERTAIN'
});

const SUCCESS_EVALUATION_CLASSES = Object.freeze([
  'SUCCESS_CONFIRMED',
  'OUTCOME_NOT_ACHIEVED',
  'SUCCESS_NOT_ESTABLISHED',
  'SUCCESS_UNKNOWN'
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function result(outcome, reason = null, binding = null) {
  return Object.freeze({ outcome, reason, binding: clone(binding) });
}

function coherentAcceptance(record, id) {
  return Boolean(record && record.type === 'EXECUTION_ACCEPTANCE'
    && record.status === 'EXECUTION_ACCEPTED'
    && record.executionAcceptanceId === id
    && record.singleLogicalAcceptance === true
    && Number.isInteger(record.acceptanceRevision)
    && ['interactionId', 'governanceEvaluationRef', 'actionIdentity', 'actionRevision',
      'resultEvidenceGrammarRef'].every((name) => nonEmptyString(record[name])));
}

function coherentGovernance(record, acceptance) {
  return Boolean(record && record.type === 'GOVERNANCE_INTENT_SNAPSHOT'
    && record.status === 'GOVERNANCE_INTENT_CURRENT'
    && record.interactionId === acceptance.interactionId
    && record.governanceEvaluationRef === acceptance.governanceEvaluationRef
    && nonEmptyString(record.intentContractRef)
    && nonEmptyString(record.intentContractDigest)
    && nonEmptyString(record.intentSchemaVersion)
    && Number.isInteger(record.evaluatedRevision)
    && Array.isArray(record.OUTCOME) && record.OUTCOME.length > 0
    && Array.isArray(record.ACCEPTANCE) && record.ACCEPTANCE.length > 0);
}

function coherentBinding(record, acceptanceId, bindingId) {
  return Boolean(record && record.type === 'EXECUTION_SUCCESS_CRITERIA_BINDING'
    && record.status === 'SUCCESS_CRITERIA_BOUND'
    && record.executionAcceptanceId === acceptanceId
    && record.successCriteriaBindingId === bindingId
    && Number.isInteger(record.bindingRevision)
    && nonEmptyString(record.bindingDigest)
    && nonEmptyString(record.intentContractRef)
    && nonEmptyString(record.intentContractDigest)
    && nonEmptyString(record.successEvaluationContractRef)
    && nonEmptyString(record.successEvaluationContractRevision)
    && Array.isArray(record.outcomeCriteria) && record.outcomeCriteria.length > 0
    && Array.isArray(record.acceptanceCriteria) && record.acceptanceCriteria.length > 0
    && record.successEvaluated === false);
}

function createGovernedExecutionSuccessCriteriaBinding({
  acceptanceSnapshotPort,
  governanceIntentSnapshotPort,
  successEvaluationContractRegistryPort,
  preparationSnapshotPort,
  bindingLedger
}) {
  for (const [name, port] of Object.entries({ acceptanceSnapshotPort,
    governanceIntentSnapshotPort, successEvaluationContractRegistryPort,
    preparationSnapshotPort })) {
    if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  }
  if (!bindingLedger || !['findByAcceptance', 'findById', 'commitBinding']
    .every((name) => typeof bindingLedger[name] === 'function')) {
    throw new TypeError('bindingLedger must implement findByAcceptance, findById and commitBinding');
  }

  function findExisting(acceptanceId, bindingId) {
    const byAcceptance = bindingLedger.findByAcceptance(acceptanceId);
    const byId = bindingLedger.findById(bindingId);
    if (!Array.isArray(byAcceptance) || !Array.isArray(byId)
      || byAcceptance.length > 1 || byId.length > 1) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_REJECTED,
        'conflicting or corrupt success-criteria binding evidence');
    }
    if (byAcceptance.length === 1) {
      const existing = byAcceptance[0];
      if (!coherentBinding(existing, acceptanceId, bindingId)
        || byId.length !== 1 || !sameValue(existing, byId[0])) {
        return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_REJECTED,
          'success-criteria binding identity conflict');
      }
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_ALREADY_BOUND,
        null, existing);
    }
    if (byId.length === 1) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_REJECTED,
        'success-criteria binding identity is already used');
    }
    return null;
  }

  function bind({ executionAcceptanceId, successCriteriaBindingId } = {}) {
    if (!nonEmptyString(executionAcceptanceId) || !nonEmptyString(successCriteriaBindingId)
      || executionAcceptanceId === successCriteriaBindingId) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_REJECTED,
        'distinct acceptance and binding identities are required');
    }
    try {
      const existing = findExisting(executionAcceptanceId, successCriteriaBindingId);
      if (existing) return existing;
    } catch (_) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_UNCERTAIN,
        'binding ledger is unavailable');
    }

    let acceptance;
    try { acceptance = acceptanceSnapshotPort(executionAcceptanceId); } catch (_) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_UNCERTAIN,
        'authoritative execution acceptance is unavailable');
    }
    if (!coherentAcceptance(acceptance, executionAcceptanceId)) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.EXECUTION_ACCEPTANCE_NOT_FOUND,
        'authoritative EXECUTION_ACCEPTED evidence is absent or invalid');
    }

    let preparations;
    try { preparations = preparationSnapshotPort(executionAcceptanceId); } catch (_) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_UNCERTAIN,
        'preparation state is unavailable');
    }
    if (!Array.isArray(preparations) || preparations.length > 1) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_REJECTED,
        'preparation state is invalid or conflicting');
    }
    if (preparations.length === 1) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.PREPARATION_ALREADY_EXISTS,
        'success criteria must be bound before preparation');
    }

    let governance;
    try { governance = governanceIntentSnapshotPort(Object.freeze({
      interactionId: acceptance.interactionId,
      governanceEvaluationRef: acceptance.governanceEvaluationRef
    })); } catch (_) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_UNCERTAIN,
        'authoritative governance intent is unavailable');
    }
    if (!governance) return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.GOVERNANCE_INTENT_NOT_FOUND,
      'governance intent snapshot was not found');
    if (!coherentGovernance(governance, acceptance)) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.GOVERNANCE_INTENT_STALE,
        'governance intent snapshot is stale or inconsistent');
    }

    let contracts;
    try {
      contracts = successEvaluationContractRegistryPort(Object.freeze({
        actionIdentity: acceptance.actionIdentity,
        actionRevision: acceptance.actionRevision,
        resultEvidenceGrammarRef: acceptance.resultEvidenceGrammarRef,
        intentSchemaVersion: governance.intentSchemaVersion
      }));
    } catch (_) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_UNCERTAIN,
        'success evaluation contract registry is unavailable');
    }
    if (!Array.isArray(contracts) || contracts.length === 0) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CONTRACT_NOT_FOUND,
        'no exact success evaluation contract is registered');
    }
    if (contracts.length !== 1) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_REJECTED,
        'success evaluation contract is ambiguous');
    }
    const contract = contracts[0];
    if (!contract || !nonEmptyString(contract.ref) || !nonEmptyString(contract.revision)
      || contract.actionIdentity !== acceptance.actionIdentity
      || contract.actionRevision !== acceptance.actionRevision
      || contract.resultEvidenceGrammarRef !== acceptance.resultEvidenceGrammarRef
      || contract.intentSchemaVersion !== governance.intentSchemaVersion
      || !Array.isArray(contract.evaluationClasses)
      || !sameValue(contract.evaluationClasses, SUCCESS_EVALUATION_CLASSES)) {
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_NOT_BINDABLE,
        'success evaluation contract is invalid or incompatible');
    }

    const record = Object.freeze({
      type: 'EXECUTION_SUCCESS_CRITERIA_BINDING',
      status: 'SUCCESS_CRITERIA_BOUND',
      successCriteriaBindingId,
      bindingRevision: 1,
      bindingDigest: governance.intentContractDigest,
      executionAcceptanceId,
      acceptanceRevision: acceptance.acceptanceRevision,
      interactionId: acceptance.interactionId,
      governanceEvaluationRef: acceptance.governanceEvaluationRef,
      evaluatedRevision: governance.evaluatedRevision,
      intentContractRef: governance.intentContractRef,
      intentContractDigest: governance.intentContractDigest,
      intentSchemaVersion: governance.intentSchemaVersion,
      actionIdentity: acceptance.actionIdentity,
      actionRevision: acceptance.actionRevision,
      resultEvidenceGrammarRef: acceptance.resultEvidenceGrammarRef,
      outcomeCriteria: clone(governance.OUTCOME),
      acceptanceCriteria: clone(governance.ACCEPTANCE),
      successEvaluationContractRef: contract.ref,
      successEvaluationContractRevision: contract.revision,
      successEvaluationClasses: clone(contract.evaluationClasses),
      successEvaluated: false
    });

    try {
      const committed = bindingLedger.commitBinding(clone(record), Object.freeze({
        acceptanceGuard: Object.freeze({ executionAcceptanceId,
          acceptanceRevision: acceptance.acceptanceRevision }),
        governanceGuard: Object.freeze({
          governanceEvaluationRef: governance.governanceEvaluationRef,
          evaluatedRevision: governance.evaluatedRevision,
          intentContractRef: governance.intentContractRef,
          intentContractDigest: governance.intentContractDigest
        }),
        successContractGuard: Object.freeze({ ref: contract.ref, revision: contract.revision }),
        preparationAbsentGuard: Object.freeze({ executionAcceptanceId, preparationAbsent: true })
      }));
      if (!coherentBinding(committed, executionAcceptanceId, successCriteriaBindingId)
        || !sameValue(committed, record)) {
        return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_REJECTED,
          'persisted success-criteria binding is inconsistent');
      }
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BOUND, null, committed);
    } catch (error) {
      let recovered;
      try { recovered = findExisting(executionAcceptanceId, successCriteriaBindingId); } catch (_) {}
      if (recovered && [SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_ALREADY_BOUND,
        SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_REJECTED]
        .includes(recovered.outcome)) return recovered;
      if (error && error.code === 'PREPARATION_ALREADY_EXISTS') {
        return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.PREPARATION_ALREADY_EXISTS,
          'preparation won the atomic race');
      }
      if (error && error.code === 'GOVERNANCE_INTENT_STALE') {
        return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.GOVERNANCE_INTENT_STALE,
          'governance intent changed before binding commit');
      }
      return result(SUCCESS_CRITERIA_BINDING_OUTCOMES.SUCCESS_CRITERIA_BINDING_UNCERTAIN,
        'atomic success-criteria binding persistence is uncertain');
    }
  }

  return Object.freeze({ bind });
}

module.exports = { SUCCESS_CRITERIA_BINDING_OUTCOMES, SUCCESS_EVALUATION_CLASSES,
  createGovernedExecutionSuccessCriteriaBinding };
