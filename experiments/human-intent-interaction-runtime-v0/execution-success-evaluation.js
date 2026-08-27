'use strict';

const crypto = require('node:crypto');

const SUCCESS_EVALUATION_CLASSES = Object.freeze([
  'SUCCESS_CONFIRMED',
  'OUTCOME_NOT_ACHIEVED',
  'SUCCESS_NOT_ESTABLISHED',
  'SUCCESS_UNKNOWN'
]);

const SUCCESS_EVALUATION_OUTCOMES = Object.freeze({
  SUCCESS_CONFIRMED: 'SUCCESS_CONFIRMED',
  OUTCOME_NOT_ACHIEVED: 'OUTCOME_NOT_ACHIEVED',
  SUCCESS_NOT_ESTABLISHED: 'SUCCESS_NOT_ESTABLISHED',
  SUCCESS_UNKNOWN: 'SUCCESS_UNKNOWN',
  SUCCESS_EVALUATION_ALREADY_RECORDED: 'SUCCESS_EVALUATION_ALREADY_RECORDED',
  COMPLETION_NOT_FOUND: 'COMPLETION_NOT_FOUND',
  COMPLETION_STALE: 'COMPLETION_STALE',
  RESULT_ACCEPTANCE_NOT_FOUND: 'RESULT_ACCEPTANCE_NOT_FOUND',
  RESULT_ACCEPTANCE_STALE: 'RESULT_ACCEPTANCE_STALE',
  SUCCESS_CRITERIA_BINDING_NOT_FOUND: 'SUCCESS_CRITERIA_BINDING_NOT_FOUND',
  SUCCESS_CRITERIA_BINDING_STALE: 'SUCCESS_CRITERIA_BINDING_STALE',
  SUCCESS_CONTRACT_NOT_FOUND: 'SUCCESS_CONTRACT_NOT_FOUND',
  SUCCESS_CONTRACT_STALE: 'SUCCESS_CONTRACT_STALE',
  SUCCESS_EVALUATION_REJECTED: 'SUCCESS_EVALUATION_REJECTED',
  SUCCESS_EVALUATION_UNCERTAIN: 'SUCCESS_EVALUATION_UNCERTAIN'
});

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const nonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return crypto.createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

function sameValue(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

function result(outcome, reason = null, evaluation = null) {
  return Object.freeze({
    outcome,
    reason,
    evaluation: clone(evaluation),
    successConfirmed: Boolean(evaluation && evaluation.successClass === 'SUCCESS_CONFIRMED'),
    executionCompleted: Boolean(evaluation && evaluation.executionCompleted === true),
    authorityCreated: false,
    retryAuthorityCreated: false,
    attemptCreated: false,
    externalEffectPerformed: false,
    productMutationPerformed: false
  });
}

function coherentCompletion(snapshot) {
  const record = snapshot && snapshot.record;
  const required = ['executionCompletionId', 'executionId', 'executionStartId',
    'executionAttemptId', 'resultAcceptanceId', 'resultAcceptanceEvidenceRef',
    'acceptedResultRef', 'acceptedResultDigest', 'evidenceSetDigest', 'actionIdentity',
    'actionRevision', 'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision'];
  return Boolean(record && nonEmptyString(snapshot.evidenceRef)
    && record.type === 'EXECUTION_COMPLETION'
    && record.status === 'EXECUTION_COMPLETED'
    && record.executionCompleted === true
    && record.executionSuccessful === false
    && record.authorityCreated === false
    && record.retryAuthorityCreated === false
    && Number.isInteger(record.completionRevision)
    && Number.isInteger(record.resultAcceptanceRevision)
    && Number.isInteger(record.evidenceSetRevision)
    && required.every((key) => nonEmptyString(record[key])));
}

function coherentStart(snapshot, completion) {
  const record = snapshot && snapshot.record;
  const required = ['executionStartId', 'executionAttemptId', 'executionId',
    'executionAcceptanceId', 'preparationEvidenceRef', 'actionIdentity', 'actionRevision',
    'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision'];
  return Boolean(record && nonEmptyString(snapshot.evidenceRef)
    && record.type === 'EXECUTION_ATTEMPT_START'
    && record.status === 'EXECUTION_ATTEMPT_STARTED'
    && record.executionActivityStarted === true
    && record.singleAuthoritativeStart === true
    && Number.isInteger(record.startRevision)
    && Number.isInteger(record.preparationRevision)
    && required.every((key) => nonEmptyString(record[key]))
    && record.executionStartId === completion.executionStartId
    && record.executionAttemptId === completion.executionAttemptId
    && record.executionId === completion.executionId
    && record.actionIdentity === completion.actionIdentity
    && record.actionRevision === completion.actionRevision
    && record.resultEvidenceGrammarRef === completion.resultEvidenceGrammarRef
    && record.resultEvidenceGrammarRevision === completion.resultEvidenceGrammarRevision);
}

function coherentPreparation(snapshot, start) {
  const record = snapshot && snapshot.record;
  const required = ['executionId', 'executionAcceptanceId', 'successCriteriaBindingId',
    'successCriteriaBindingDigest', 'successEvaluationContractRef',
    'successEvaluationContractRevision', 'resultEvidenceGrammarRef',
    'resultEvidenceGrammarRevision', 'actionIdentity', 'actionRevision'];
  return Boolean(record && nonEmptyString(snapshot.evidenceRef)
    && snapshot.evidenceRef === start.preparationEvidenceRef
    && record.type === 'EXECUTION_PREPARATION'
    && record.status === 'EXECUTION_PREPARED'
    && Number.isInteger(record.preparationRevision)
    && Number.isInteger(record.successCriteriaBindingRevision)
    && Array.isArray(record.outcomeCriteria) && record.outcomeCriteria.length > 0
    && Array.isArray(record.acceptanceCriteria) && record.acceptanceCriteria.length > 0
    && required.every((key) => nonEmptyString(record[key]))
    && record.preparationRevision === start.preparationRevision
    && record.executionId === start.executionId
    && record.executionAcceptanceId === start.executionAcceptanceId
    && record.actionIdentity === start.actionIdentity
    && record.actionRevision === start.actionRevision
    && record.resultEvidenceGrammarRef === start.resultEvidenceGrammarRef
    && record.resultEvidenceGrammarRevision === start.resultEvidenceGrammarRevision);
}

function coherentAcceptance(snapshot, completion, start) {
  const record = snapshot && snapshot.record;
  const required = ['resultAcceptanceId', 'executionStartId', 'executionAttemptId',
    'executionId', 'executionAcceptanceId', 'acceptedResultRef', 'acceptedResultDigest',
    'evidenceSetDigest', 'actionIdentity', 'actionRevision', 'resultEvidenceGrammarRef',
    'resultEvidenceGrammarRevision'];
  return Boolean(record && nonEmptyString(snapshot.evidenceRef)
    && ['EFFECT_FREE_RESULT_ACCEPTANCE', 'EFFECT_CAPABLE_RESULT_ACCEPTANCE'].includes(record.type)
    && record.status === 'RESULT_ACCEPTED'
    && record.resultAccepted === true
    && record.executionCompleted === false
    && record.executionSuccessful === false
    && Number.isInteger(record.acceptanceRevision)
    && Number.isInteger(record.evidenceSetRevision)
    && required.every((key) => nonEmptyString(record[key]))
    && record.resultAcceptanceId === completion.resultAcceptanceId
    && snapshot.evidenceRef === completion.resultAcceptanceEvidenceRef
    && record.acceptanceRevision === completion.resultAcceptanceRevision
    && record.evidenceSetRevision === completion.evidenceSetRevision
    && record.evidenceSetDigest === completion.evidenceSetDigest
    && record.acceptedResultRef === completion.acceptedResultRef
    && record.acceptedResultDigest === completion.acceptedResultDigest
    && record.executionStartId === start.executionStartId
    && record.executionAttemptId === start.executionAttemptId
    && record.executionId === start.executionId
    && record.executionAcceptanceId === start.executionAcceptanceId
    && record.actionIdentity === start.actionIdentity
    && record.actionRevision === start.actionRevision
    && record.resultEvidenceGrammarRef === start.resultEvidenceGrammarRef
    && record.resultEvidenceGrammarRevision === start.resultEvidenceGrammarRevision);
}

function coherentBinding(snapshot, preparation, start) {
  const record = snapshot && snapshot.record;
  const required = ['successCriteriaBindingId', 'bindingDigest', 'executionAcceptanceId',
    'intentContractRef', 'intentContractDigest', 'actionIdentity', 'actionRevision',
    'resultEvidenceGrammarRef', 'successEvaluationContractRef',
    'successEvaluationContractRevision'];
  return Boolean(record && nonEmptyString(snapshot.evidenceRef)
    && record.type === 'EXECUTION_SUCCESS_CRITERIA_BINDING'
    && record.status === 'SUCCESS_CRITERIA_BOUND'
    && Number.isInteger(record.bindingRevision)
    && Array.isArray(record.outcomeCriteria) && record.outcomeCriteria.length > 0
    && Array.isArray(record.acceptanceCriteria) && record.acceptanceCriteria.length > 0
    && Array.isArray(record.successEvaluationClasses)
    && sameValue(record.successEvaluationClasses, SUCCESS_EVALUATION_CLASSES)
    && record.successEvaluated === false
    && required.every((key) => nonEmptyString(record[key]))
    && record.successCriteriaBindingId === preparation.successCriteriaBindingId
    && record.bindingRevision === preparation.successCriteriaBindingRevision
    && record.bindingDigest === preparation.successCriteriaBindingDigest
    && record.executionAcceptanceId === start.executionAcceptanceId
    && record.actionIdentity === start.actionIdentity
    && record.actionRevision === start.actionRevision
    && record.resultEvidenceGrammarRef === start.resultEvidenceGrammarRef
    && record.successEvaluationContractRef === preparation.successEvaluationContractRef
    && record.successEvaluationContractRevision === preparation.successEvaluationContractRevision
    && sameValue(record.outcomeCriteria, preparation.outcomeCriteria)
    && sameValue(record.acceptanceCriteria, preparation.acceptanceCriteria));
}

function coherentContract(snapshot, binding, start) {
  const record = snapshot && snapshot.record;
  return Boolean(record && nonEmptyString(snapshot.evidenceRef)
    && record.type === 'SUCCESS_EVALUATION_CONTRACT'
    && record.status === 'ENABLED'
    && record.ref === binding.successEvaluationContractRef
    && record.revision === binding.successEvaluationContractRevision
    && record.actionIdentity === start.actionIdentity
    && record.actionRevision === start.actionRevision
    && record.resultEvidenceGrammarRef === start.resultEvidenceGrammarRef
    && Array.isArray(record.evaluationClasses)
    && sameValue(record.evaluationClasses, SUCCESS_EVALUATION_CLASSES)
    && typeof record.evaluate === 'function');
}

function coherentEvaluation(record) {
  const required = ['successEvaluationId', 'executionCompletionId', 'completionEvidenceRef',
    'executionId', 'executionStartId', 'executionAttemptId', 'resultAcceptanceId',
    'resultAcceptanceEvidenceRef', 'acceptedResultRef', 'acceptedResultDigest',
    'successCriteriaBindingId', 'successCriteriaBindingEvidenceRef',
    'successCriteriaBindingDigest', 'successEvaluationContractRef',
    'successEvaluationContractRevision', 'evaluationInputDigest', 'evaluationDecisionDigest'];
  return Boolean(record && record.type === 'EXECUTION_SUCCESS_EVALUATION'
    && record.status === 'SUCCESS_EVALUATED'
    && SUCCESS_EVALUATION_CLASSES.includes(record.successClass)
    && Number.isInteger(record.evaluationRevision)
    && Number.isInteger(record.completionRevision)
    && Number.isInteger(record.resultAcceptanceRevision)
    && Number.isInteger(record.successCriteriaBindingRevision)
    && record.executionCompleted === true
    && record.authorityCreated === false
    && record.retryAuthorityCreated === false
    && record.attemptCreated === false
    && record.externalEffectPerformed === false
    && record.productMutationPerformed === false
    && required.every((key) => nonEmptyString(record[key])));
}

function createGovernedExecutionSuccessEvaluation({
  completionSnapshotPort,
  currentCompletionPort,
  startSnapshotPort,
  preparationSnapshotPort,
  resultAcceptanceSnapshotPort,
  successCriteriaBindingSnapshotPort,
  successEvaluationContractRegistryPort,
  evaluationLedger
}) {
  for (const [name, port] of Object.entries({ completionSnapshotPort, currentCompletionPort,
    startSnapshotPort, preparationSnapshotPort, resultAcceptanceSnapshotPort,
    successCriteriaBindingSnapshotPort, successEvaluationContractRegistryPort })) {
    if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  }
  if (!evaluationLedger || !['findById', 'findByCompletion', 'commitEvaluation']
    .every((name) => typeof evaluationLedger[name] === 'function')) {
    throw new TypeError('evaluationLedger must implement findById, findByCompletion and commitEvaluation');
  }

  function evaluate({ successEvaluationId, executionCompletionId } = {}) {
    if (!nonEmptyString(successEvaluationId) || !nonEmptyString(executionCompletionId)
      || successEvaluationId === executionCompletionId) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_REJECTED,
        'distinct success-evaluation and Completion identities are required');
    }

    let byId; let byExecution;
    try {
      byId = evaluationLedger.findById(successEvaluationId);
      byExecution = evaluationLedger.findByCompletion(executionCompletionId);
    } catch (_) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
        'success-evaluation ledger is unavailable');
    }
    if (!Array.isArray(byId) || byId.length > 1 || !Array.isArray(byExecution)
      || byExecution.length > 1) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
        'success-evaluation ledger is conflicting or corrupt');
    }
    if (byId.length === 1) {
      const existing = byId[0];
      return coherentEvaluation(existing) && existing.executionCompletionId === executionCompletionId
        ? result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_ALREADY_RECORDED, null, existing)
        : result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_REJECTED,
          'success-evaluation identity is already bound differently');
    }
    if (byExecution.length === 1) {
      return coherentEvaluation(byExecution[0])
        ? result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_ALREADY_RECORDED,
          'Completion already has an immutable success evaluation', byExecution[0])
        : result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
          'existing success evaluation is corrupt');
    }

    let completionSnapshot; let currentCompletion; let startSnapshot; let preparationSnapshot;
    let acceptanceSnapshot; let bindingSnapshot; let contractSnapshot;
    try {
      completionSnapshot = completionSnapshotPort(executionCompletionId);
    } catch (_) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
        'authoritative Completion is unavailable');
    }
    if (!coherentCompletion(completionSnapshot)
      || completionSnapshot.record.executionCompletionId !== executionCompletionId) {
      return result(SUCCESS_EVALUATION_OUTCOMES.COMPLETION_NOT_FOUND,
        'authoritative EXECUTION_COMPLETED evidence is absent or invalid');
    }
    const completion = completionSnapshot.record;
    try { currentCompletion = currentCompletionPort(completion.executionId); } catch (_) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
        'current Completion state is unavailable');
    }
    if (!currentCompletion || currentCompletion.evidenceRef !== completionSnapshot.evidenceRef
      || !sameValue(currentCompletion.record, completion)) {
      return result(SUCCESS_EVALUATION_OUTCOMES.COMPLETION_STALE,
        'Completion is stale or not the exact current terminal record');
    }

    try { startSnapshot = startSnapshotPort(completion.executionStartId); } catch (_) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
        'authoritative Start is unavailable');
    }
    if (!coherentStart(startSnapshot, completion)) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_REJECTED,
        'Completion-to-Start lineage is invalid or cross-bound');
    }
    const start = startSnapshot.record;

    try { preparationSnapshot = preparationSnapshotPort(start.preparationEvidenceRef); } catch (_) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
        'authoritative Preparation is unavailable');
    }
    if (!coherentPreparation(preparationSnapshot, start)) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_CRITERIA_BINDING_STALE,
        'Preparation does not preserve the exact frozen success-criteria binding lineage');
    }
    const preparation = preparationSnapshot.record;

    try { acceptanceSnapshot = resultAcceptanceSnapshotPort(completion.resultAcceptanceId); } catch (_) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
        'authoritative RESULT_ACCEPTED evidence is unavailable');
    }
    if (!coherentAcceptance(acceptanceSnapshot, completion, start)) {
      return result(SUCCESS_EVALUATION_OUTCOMES.RESULT_ACCEPTANCE_NOT_FOUND,
        'terminal RESULT_ACCEPTED evidence is absent, invalid or cross-lineage');
    }
    const acceptance = acceptanceSnapshot.record;
    if (acceptance.resultAcceptanceId !== completion.resultAcceptanceId
      || acceptance.acceptedResultDigest !== completion.acceptedResultDigest) {
      return result(SUCCESS_EVALUATION_OUTCOMES.RESULT_ACCEPTANCE_STALE,
        'Completion no longer binds the exact accepted result');
    }

    try { bindingSnapshot = successCriteriaBindingSnapshotPort(preparation.successCriteriaBindingId); }
    catch (_) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
        'authoritative success-criteria binding is unavailable');
    }
    if (!bindingSnapshot) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_CRITERIA_BINDING_NOT_FOUND,
        'frozen SUCCESS_CRITERIA_BOUND evidence is absent');
    }
    if (!coherentBinding(bindingSnapshot, preparation, start)) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_CRITERIA_BINDING_STALE,
        'success-criteria binding is stale, changed or cross-lineage');
    }
    const binding = bindingSnapshot.record;

    try {
      contractSnapshot = successEvaluationContractRegistryPort(
        binding.successEvaluationContractRef, binding.successEvaluationContractRevision);
    } catch (_) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
        'success-evaluation contract registry is unavailable');
    }
    if (!contractSnapshot) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_CONTRACT_NOT_FOUND,
        'exact frozen success-evaluation contract is absent');
    }
    if (!coherentContract(contractSnapshot, binding, start)) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_CONTRACT_STALE,
        'success-evaluation contract is stale or incompatible');
    }
    const contract = contractSnapshot.record;

    const evaluationInput = Object.freeze({
      executionCompletionId: completion.executionCompletionId,
      completionRevision: completion.completionRevision,
      executionId: completion.executionId,
      resultAcceptanceId: acceptance.resultAcceptanceId,
      resultAcceptanceRevision: acceptance.acceptanceRevision,
      acceptedResultRef: acceptance.acceptedResultRef,
      acceptedResultDigest: acceptance.acceptedResultDigest,
      resultEvidenceGrammarRef: acceptance.resultEvidenceGrammarRef,
      resultEvidenceGrammarRevision: acceptance.resultEvidenceGrammarRevision,
      successCriteriaBindingId: binding.successCriteriaBindingId,
      successCriteriaBindingRevision: binding.bindingRevision,
      successCriteriaBindingDigest: binding.bindingDigest,
      outcomeCriteria: clone(binding.outcomeCriteria),
      acceptanceCriteria: clone(binding.acceptanceCriteria),
      successEvaluationContractRef: contract.ref,
      successEvaluationContractRevision: contract.revision
    });

    let decision;
    try { decision = contract.evaluate(clone(evaluationInput)); } catch (_) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
        'success evaluation did not complete deterministically');
    }
    if (!decision || !SUCCESS_EVALUATION_CLASSES.includes(decision.successClass)
      || !nonEmptyString(decision.evidenceRef)) {
      return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_REJECTED,
        'success-evaluation contract returned an invalid class or evidence identity');
    }
    const canonicalDecision = Object.freeze({ successClass: decision.successClass,
      evidenceRef: decision.evidenceRef,
      rationale: decision.rationale === undefined ? null : clone(decision.rationale) });
    const evaluationInputDigest = digest(evaluationInput);
    const evaluationDecisionDigest = digest(canonicalDecision);

    const evaluation = Object.freeze({
      type: 'EXECUTION_SUCCESS_EVALUATION',
      status: 'SUCCESS_EVALUATED',
      successEvaluationId,
      evaluationRevision: 1,
      executionCompletionId: completion.executionCompletionId,
      completionEvidenceRef: completionSnapshot.evidenceRef,
      completionRevision: completion.completionRevision,
      executionId: completion.executionId,
      executionStartId: completion.executionStartId,
      executionAttemptId: completion.executionAttemptId,
      resultAcceptanceId: acceptance.resultAcceptanceId,
      resultAcceptanceEvidenceRef: acceptanceSnapshot.evidenceRef,
      resultAcceptanceRevision: acceptance.acceptanceRevision,
      acceptedResultRef: acceptance.acceptedResultRef,
      acceptedResultDigest: acceptance.acceptedResultDigest,
      resultEvidenceGrammarRef: acceptance.resultEvidenceGrammarRef,
      resultEvidenceGrammarRevision: acceptance.resultEvidenceGrammarRevision,
      successCriteriaBindingId: binding.successCriteriaBindingId,
      successCriteriaBindingEvidenceRef: bindingSnapshot.evidenceRef,
      successCriteriaBindingRevision: binding.bindingRevision,
      successCriteriaBindingDigest: binding.bindingDigest,
      intentContractRef: binding.intentContractRef,
      intentContractDigest: binding.intentContractDigest,
      outcomeCriteria: clone(binding.outcomeCriteria),
      acceptanceCriteria: clone(binding.acceptanceCriteria),
      successEvaluationContractRef: contract.ref,
      successEvaluationContractRevision: contract.revision,
      evaluationInputDigest,
      evaluationEvidenceRef: canonicalDecision.evidenceRef,
      evaluationDecisionDigest,
      successClass: canonicalDecision.successClass,
      rationale: clone(canonicalDecision.rationale),
      executionCompleted: true,
      authorityCreated: false,
      retryAuthorityCreated: false,
      attemptCreated: false,
      externalEffectPerformed: false,
      productMutationPerformed: false
    });

    const guards = Object.freeze({
      uniqueSuccessEvaluationId: true,
      singleEvaluationForCompletion: true,
      completionGuard: Object.freeze({ evidenceRef: completionSnapshot.evidenceRef,
        executionCompletionId: completion.executionCompletionId,
        completionRevision: completion.completionRevision, executionCompleted: true, current: true }),
      resultAcceptanceGuard: Object.freeze({ evidenceRef: acceptanceSnapshot.evidenceRef,
        resultAcceptanceId: acceptance.resultAcceptanceId,
        acceptanceRevision: acceptance.acceptanceRevision,
        acceptedResultDigest: acceptance.acceptedResultDigest }),
      successCriteriaBindingGuard: Object.freeze({ evidenceRef: bindingSnapshot.evidenceRef,
        successCriteriaBindingId: binding.successCriteriaBindingId,
        bindingRevision: binding.bindingRevision,
        bindingDigest: binding.bindingDigest }),
      successContractGuard: Object.freeze({ evidenceRef: contractSnapshot.evidenceRef,
        ref: contract.ref, revision: contract.revision }),
      evaluationInputDigest
    });

    try {
      const committed = evaluationLedger.commitEvaluation(clone(evaluation), guards);
      return coherentEvaluation(committed) && sameValue(committed, evaluation)
        ? result(SUCCESS_EVALUATION_OUTCOMES[evaluation.successClass], null, committed)
        : result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
          'atomic success-evaluation ledger returned inconsistent evidence');
    } catch (error) {
      let recovered = [];
      try { recovered = evaluationLedger.findById(successEvaluationId); } catch (_) {}
      if (Array.isArray(recovered) && recovered.length === 1
        && coherentEvaluation(recovered[0]) && sameValue(recovered[0], evaluation)) {
        return result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_ALREADY_RECORDED,
          'success evaluation recovered after response loss', recovered[0]);
      }
      const mapped = error && ({ COMPLETION_STALE: SUCCESS_EVALUATION_OUTCOMES.COMPLETION_STALE,
        RESULT_ACCEPTANCE_STALE: SUCCESS_EVALUATION_OUTCOMES.RESULT_ACCEPTANCE_STALE,
        SUCCESS_CRITERIA_BINDING_STALE: SUCCESS_EVALUATION_OUTCOMES.SUCCESS_CRITERIA_BINDING_STALE,
        SUCCESS_CONTRACT_STALE: SUCCESS_EVALUATION_OUTCOMES.SUCCESS_CONTRACT_STALE })[error.code];
      return mapped ? result(mapped, 'atomic success-evaluation guard changed before commit')
        : result(SUCCESS_EVALUATION_OUTCOMES.SUCCESS_EVALUATION_UNCERTAIN,
          'atomic success-evaluation persistence is uncertain');
    }
  }

  return Object.freeze({ evaluate });
}

module.exports = { SUCCESS_EVALUATION_CLASSES, SUCCESS_EVALUATION_OUTCOMES,
  createGovernedExecutionSuccessEvaluation, canonicalStringify, digest };
