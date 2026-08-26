'use strict';

const COMPLETION_OUTCOMES = Object.freeze({
  EXECUTION_COMPLETED: 'EXECUTION_COMPLETED',
  COMPLETION_ALREADY_RECORDED: 'COMPLETION_ALREADY_RECORDED',
  EXECUTION_ALREADY_COMPLETED: 'EXECUTION_ALREADY_COMPLETED',
  START_NOT_FOUND: 'START_NOT_FOUND',
  RESULT_ACCEPTANCE_NOT_FOUND: 'RESULT_ACCEPTANCE_NOT_FOUND',
  RESULT_ACCEPTANCE_STALE: 'RESULT_ACCEPTANCE_STALE',
  ATTEMPT_HISTORY_STALE: 'ATTEMPT_HISTORY_STALE',
  COMPLETION_REJECTED: 'COMPLETION_REJECTED',
  COMPLETION_UNCERTAIN: 'COMPLETION_UNCERTAIN'
});

const EFFECT_CLASSES = Object.freeze([
  'NO_EXTERNAL_EFFECT',
  'IDEMPOTENT_WITH_STABLE_KEY',
  'NON_IDEMPOTENT'
]);

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const nonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => {
    out[key] = canonicalize(value[key]); return out;
  }, {});
  return value;
}
const sameValue = (left, right) => JSON.stringify(canonicalize(left))
  === JSON.stringify(canonicalize(right));

function result(outcome, reason = null, completion = null) {
  return Object.freeze({ outcome, reason, completion: clone(completion),
    executionCompleted: Boolean(completion && completion.executionCompleted === true),
    executionSuccessful: false, authorityCreated: false, retryAuthorityCreated: false });
}

function coherentStart(snapshot) {
  const record = snapshot && snapshot.record;
  const required = ['executionStartId', 'executionAttemptId', 'executionId',
    'executionAcceptanceId', 'dispatchId', 'continuationId', 'interactionId', 'gateId',
    'actionIdentity', 'actionRevision', 'continuationTargetRef', 'executionOwnerIdentity',
    'inputRef', 'verifiedInputDigest', 'effectContractRef', 'effectContractRevision',
    'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision'];
  return Boolean(record && nonEmptyString(snapshot.evidenceRef)
    && record.type === 'EXECUTION_ATTEMPT_START'
    && record.status === 'EXECUTION_ATTEMPT_STARTED'
    && record.executionActivityStarted === true
    && record.singleAuthoritativeStart === true
    && Number.isInteger(record.startRevision)
    && Number.isInteger(record.attemptRevision)
    && EFFECT_CLASSES.includes(record.effectIdempotencyClass)
    && required.every((key) => nonEmptyString(record[key]))
    && (record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
      ? record.logicalEffectId === null : nonEmptyString(record.logicalEffectId)));
}

function coherentAcceptance(snapshot, start) {
  const record = snapshot && snapshot.record;
  const required = ['resultAcceptanceId', 'executionStartId', 'executionAttemptId',
    'executionId', 'acceptedResultRef', 'acceptedResultDigest', 'evidenceSetDigest',
    'actionIdentity', 'actionRevision', 'continuationTargetRef', 'inputRef',
    'verifiedInputDigest', 'effectContractRef', 'effectContractRevision',
    'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision'];
  if (!record || !nonEmptyString(snapshot.evidenceRef)
    || !['EFFECT_FREE_RESULT_ACCEPTANCE', 'EFFECT_CAPABLE_RESULT_ACCEPTANCE'].includes(record.type)
    || record.status !== 'RESULT_ACCEPTED'
    || record.resultAccepted !== true || record.executionCompleted !== false
    || record.executionSuccessful !== false
    || !Number.isInteger(record.acceptanceRevision)
    || !Number.isInteger(record.evidenceSetRevision)
    || required.some((key) => !nonEmptyString(record[key]))
    || record.executionStartId !== start.executionStartId
    || record.executionAttemptId !== start.executionAttemptId
    || record.executionId !== start.executionId
    || record.actionIdentity !== start.actionIdentity
    || record.actionRevision !== start.actionRevision
    || record.continuationTargetRef !== start.continuationTargetRef
    || record.inputRef !== start.inputRef
    || record.verifiedInputDigest !== start.verifiedInputDigest
    || record.effectContractRef !== start.effectContractRef
    || record.effectContractRevision !== start.effectContractRevision
    || record.resultEvidenceGrammarRef !== start.resultEvidenceGrammarRef
    || record.resultEvidenceGrammarRevision !== start.resultEvidenceGrammarRevision
    || record.effectIdempotencyClass !== start.effectIdempotencyClass
    || record.logicalEffectId !== start.logicalEffectId) return false;
  if (record.type === 'EFFECT_FREE_RESULT_ACCEPTANCE') {
    return record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
      && record.logicalEffectId === null;
  }
  return ['IDEMPOTENT_WITH_STABLE_KEY', 'NON_IDEMPOTENT']
    .includes(record.effectIdempotencyClass)
    && record.effectOutcomeClass === 'EFFECT_CONFIRMED'
    && nonEmptyString(record.effectOutcomeResolutionId)
    && nonEmptyString(record.outcomeResolutionEvidenceRef)
    && Number.isInteger(record.outcomeResolutionRevision)
    && nonEmptyString(record.effectInvocationId)
    && nonEmptyString(record.logicalEffectId);
}

function coherentHistory(snapshot, start) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef)
    || !Number.isInteger(snapshot.revision) || snapshot.revision < 1
    || !Array.isArray(snapshot.records) || snapshot.records.length !== snapshot.revision) return false;
  const ordered = snapshot.records.slice().sort((a, b) => a.attemptOrdinal - b.attemptOrdinal);
  for (let index = 0; index < ordered.length; index += 1) {
    const attempt = ordered[index];
    if (!attempt || attempt.type !== 'EXECUTION_ATTEMPT' || attempt.status !== 'ATTEMPT_CREATED'
      || attempt.executionId !== start.executionId
      || !nonEmptyString(attempt.executionAttemptId)
      || attempt.attemptOrdinal !== index + 1
      || attempt.previousExecutionAttemptId !== (index ? ordered[index - 1].executionAttemptId : null)) {
      return false;
    }
  }
  return ordered[ordered.length - 1].executionAttemptId === start.executionAttemptId;
}

function coherentTerminal(snapshot, executionId) {
  const record = snapshot && snapshot.record;
  return Boolean(record && nonEmptyString(snapshot.evidenceRef)
    && record.type === 'EXECUTION_TERMINAL_STATE'
    && record.executionId === executionId
    && ['NOT_COMPLETED', 'COMPLETED'].includes(record.status)
    && Number.isInteger(record.terminalStateRevision)
    && record.terminalStateRevision >= 1
    && record.conflictingEvidence !== true);
}

function coherentCompletion(record) {
  const required = ['executionCompletionId', 'executionId', 'executionStartId',
    'startEvidenceRef', 'executionAttemptId', 'attemptHistoryEvidenceRef',
    'resultAcceptanceId', 'resultAcceptanceEvidenceRef',
    'acceptedResultRef', 'acceptedResultDigest', 'evidenceSetDigest', 'actionIdentity',
    'actionRevision', 'continuationTargetRef', 'inputRef', 'verifiedInputDigest',
    'effectContractRef', 'effectContractRevision', 'resultEvidenceGrammarRef',
    'resultEvidenceGrammarRevision', 'terminalStateEvidenceRef'];
  return Boolean(record && record.type === 'EXECUTION_COMPLETION'
    && record.status === 'EXECUTION_COMPLETED'
    && record.executionCompleted === true && record.executionSuccessful === false
    && record.authorityCreated === false && record.retryAuthorityCreated === false
    && Number.isInteger(record.completionRevision)
    && Number.isInteger(record.resultAcceptanceRevision)
    && Number.isInteger(record.evidenceSetRevision)
    && Number.isInteger(record.attemptHistoryRevision)
    && Number.isInteger(record.terminalStateFromRevision)
    && Number.isInteger(record.terminalStateToRevision)
    && record.terminalStateToRevision === record.terminalStateFromRevision + 1
    && EFFECT_CLASSES.includes(record.effectIdempotencyClass)
    && required.every((key) => nonEmptyString(record[key]))
    && (record.resultAcceptanceType === 'EFFECT_FREE_RESULT_ACCEPTANCE'
      ? record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
        && record.logicalEffectId === null && record.effectOutcomeClass === null
        && record.effectInvocationId === null
      : record.resultAcceptanceType === 'EFFECT_CAPABLE_RESULT_ACCEPTANCE'
        && ['IDEMPOTENT_WITH_STABLE_KEY', 'NON_IDEMPOTENT']
          .includes(record.effectIdempotencyClass)
        && nonEmptyString(record.logicalEffectId)
        && record.effectOutcomeClass === 'EFFECT_CONFIRMED'
        && nonEmptyString(record.effectOutcomeResolutionId)
        && nonEmptyString(record.outcomeResolutionEvidenceRef)
        && Number.isInteger(record.outcomeResolutionRevision)
        && nonEmptyString(record.effectInvocationId)));
}

function createGovernedExecutionCompletion({ startSnapshotPort,
  resultAcceptanceSnapshotPort, currentResultAcceptancePort, attemptHistoryPort,
  executionTerminalStatePort, completionLedger }) {
  for (const [name, port] of Object.entries({ startSnapshotPort,
    resultAcceptanceSnapshotPort, currentResultAcceptancePort, attemptHistoryPort,
    executionTerminalStatePort })) {
    if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  }
  if (!completionLedger || !['findById', 'findByExecution', 'commitCompletion']
    .every((name) => typeof completionLedger[name] === 'function')) {
    throw new TypeError('completionLedger must implement findById, findByExecution and commitCompletion');
  }

  function complete(request = {}) {
    const strings = ['executionCompletionId', 'executionId', 'executionStartId',
      'resultAcceptanceId'];
    if (strings.some((key) => !nonEmptyString(request[key]))
      || !Number.isInteger(request.expectedAcceptanceRevision)
      || !Number.isInteger(request.expectedAttemptHistoryRevision)
      || !Number.isInteger(request.expectedTerminalStateRevision)) {
      return result(COMPLETION_OUTCOMES.COMPLETION_REJECTED,
        'completion, execution, Start, acceptance and expected revisions are required');
    }

    let byId; let byExecution;
    try {
      byId = completionLedger.findById(request.executionCompletionId);
      byExecution = completionLedger.findByExecution(request.executionId);
    } catch (_) {
      return result(COMPLETION_OUTCOMES.COMPLETION_UNCERTAIN,
        'completion ledger is unavailable');
    }
    if (!Array.isArray(byId) || byId.length > 1
      || !Array.isArray(byExecution) || byExecution.length > 1) return result(
      COMPLETION_OUTCOMES.COMPLETION_UNCERTAIN, 'completion ledger is conflicting or corrupt');
    if (byId.length === 1) {
      const existing = byId[0];
      if (coherentCompletion(existing)
        && existing.executionCompletionId === request.executionCompletionId
        && existing.executionId === request.executionId
        && existing.executionStartId === request.executionStartId
        && existing.resultAcceptanceId === request.resultAcceptanceId
        && existing.resultAcceptanceRevision === request.expectedAcceptanceRevision
        && existing.attemptHistoryRevision === request.expectedAttemptHistoryRevision
        && existing.terminalStateFromRevision === request.expectedTerminalStateRevision) {
        return result(COMPLETION_OUTCOMES.COMPLETION_ALREADY_RECORDED, null, existing);
      }
      return result(COMPLETION_OUTCOMES.COMPLETION_REJECTED,
        'completion identity is already bound differently');
    }
    if (byExecution.length === 1) {
      return coherentCompletion(byExecution[0])
        ? result(COMPLETION_OUTCOMES.EXECUTION_ALREADY_COMPLETED,
          'logical execution is already completed', byExecution[0])
        : result(COMPLETION_OUTCOMES.COMPLETION_UNCERTAIN,
          'existing execution completion is corrupt');
    }

    let startSnapshot; let acceptanceSnapshot; let currentAcceptance;
    let historySnapshot; let terminalSnapshot;
    try {
      startSnapshot = startSnapshotPort(request.executionStartId);
      acceptanceSnapshot = resultAcceptanceSnapshotPort(request.resultAcceptanceId);
      currentAcceptance = currentResultAcceptancePort(request.executionStartId);
      historySnapshot = attemptHistoryPort(request.executionId);
      terminalSnapshot = executionTerminalStatePort(request.executionId);
    } catch (_) {
      return result(COMPLETION_OUTCOMES.COMPLETION_UNCERTAIN,
        'authoritative Completion evidence is unavailable');
    }
    if (!coherentStart(startSnapshot)
      || startSnapshot.record.executionStartId !== request.executionStartId
      || startSnapshot.record.executionId !== request.executionId) return result(
      COMPLETION_OUTCOMES.START_NOT_FOUND, 'authoritative Start is absent or incoherent');
    const start = startSnapshot.record;
    if (!coherentAcceptance(acceptanceSnapshot, start)
      || acceptanceSnapshot.record.resultAcceptanceId !== request.resultAcceptanceId) return result(
      COMPLETION_OUTCOMES.RESULT_ACCEPTANCE_NOT_FOUND,
      'authoritative accepted result is absent, invalid or mismatched');
    const acceptance = acceptanceSnapshot.record;
    if (acceptance.acceptanceRevision !== request.expectedAcceptanceRevision
      || !currentAcceptance
      || currentAcceptance.evidenceRef !== acceptanceSnapshot.evidenceRef
      || !sameValue(currentAcceptance.record, acceptance)) return result(
      COMPLETION_OUTCOMES.RESULT_ACCEPTANCE_STALE,
      'accepted result is stale or no longer current');
    if (!coherentHistory(historySnapshot, start)
      || historySnapshot.revision !== request.expectedAttemptHistoryRevision) return result(
      COMPLETION_OUTCOMES.ATTEMPT_HISTORY_STALE,
      'attempt history is stale, conflicting or has a later attempt');
    if (!coherentTerminal(terminalSnapshot, request.executionId)) return result(
      COMPLETION_OUTCOMES.COMPLETION_UNCERTAIN,
      'authoritative execution terminal state is absent, invalid or conflicting');
    if (terminalSnapshot.record.status === 'COMPLETED') return result(
      COMPLETION_OUTCOMES.EXECUTION_ALREADY_COMPLETED,
      'logical execution is already authoritatively completed');
    if (terminalSnapshot.record.terminalStateRevision !== request.expectedTerminalStateRevision) {
      return result(COMPLETION_OUTCOMES.COMPLETION_REJECTED,
        'expected execution terminal state is stale');
    }

    const completion = Object.freeze({ type: 'EXECUTION_COMPLETION',
      status: 'EXECUTION_COMPLETED', executionCompletionId: request.executionCompletionId,
      completionRevision: 1, executionId: start.executionId,
      executionStartId: start.executionStartId,
      startEvidenceRef: startSnapshot.evidenceRef, startRevision: start.startRevision,
      executionAttemptId: start.executionAttemptId,
      attemptHistoryEvidenceRef: historySnapshot.evidenceRef,
      attemptHistoryRevision: historySnapshot.revision,
      resultAcceptanceType: acceptance.type,
      resultAcceptanceId: acceptance.resultAcceptanceId,
      resultAcceptanceEvidenceRef: acceptanceSnapshot.evidenceRef,
      resultAcceptanceRevision: acceptance.acceptanceRevision,
      evidenceSetRevision: acceptance.evidenceSetRevision,
      evidenceSetDigest: acceptance.evidenceSetDigest,
      acceptedResultRef: acceptance.acceptedResultRef,
      acceptedResultDigest: acceptance.acceptedResultDigest,
      actionIdentity: start.actionIdentity, actionRevision: start.actionRevision,
      continuationTargetRef: start.continuationTargetRef,
      authorityScope: clone(start.authorityScope), executionOwnerIdentity: start.executionOwnerIdentity,
      inputRef: start.inputRef, verifiedInputDigest: start.verifiedInputDigest,
      effectContractRef: start.effectContractRef,
      effectContractRevision: start.effectContractRevision,
      effectIdempotencyClass: start.effectIdempotencyClass,
      logicalEffectId: start.logicalEffectId,
      effectOutcomeResolutionId: acceptance.effectOutcomeResolutionId || null,
      outcomeResolutionEvidenceRef: acceptance.outcomeResolutionEvidenceRef || null,
      outcomeResolutionRevision: acceptance.outcomeResolutionRevision || null,
      effectInvocationId: acceptance.effectInvocationId || null,
      effectOutcomeClass: acceptance.effectOutcomeClass || null,
      resultEvidenceGrammarRef: start.resultEvidenceGrammarRef,
      resultEvidenceGrammarRevision: start.resultEvidenceGrammarRevision,
      terminalStateEvidenceRef: terminalSnapshot.evidenceRef,
      terminalStateFromRevision: terminalSnapshot.record.terminalStateRevision,
      terminalStateToRevision: terminalSnapshot.record.terminalStateRevision + 1,
      executionCompleted: true, executionSuccessful: false,
      authorityCreated: false, retryAuthorityCreated: false });
    const guards = Object.freeze({ uniqueExecutionCompletionId: true,
      singleCompletionForExecution: true,
      startGuard: Object.freeze({ evidenceRef: startSnapshot.evidenceRef,
        startRevision: start.startRevision, executionStartId: start.executionStartId }),
      resultAcceptanceGuard: Object.freeze({ evidenceRef: acceptanceSnapshot.evidenceRef,
        resultAcceptanceId: acceptance.resultAcceptanceId,
        acceptanceRevision: acceptance.acceptanceRevision,
        evidenceSetRevision: acceptance.evidenceSetRevision,
        evidenceSetDigest: acceptance.evidenceSetDigest,
        acceptedResultDigest: acceptance.acceptedResultDigest,
        currentAcceptance: true }),
      attemptHistoryGuard: Object.freeze({ evidenceRef: historySnapshot.evidenceRef,
        historyRevision: historySnapshot.revision,
        latestExecutionAttemptId: start.executionAttemptId,
        noLaterOrCompetingAttempt: true }),
      terminalTransitionGuard: Object.freeze({ evidenceRef: terminalSnapshot.evidenceRef,
        fromStatus: 'NOT_COMPLETED',
        fromRevision: terminalSnapshot.record.terminalStateRevision,
        toStatus: 'COMPLETED',
        toRevision: terminalSnapshot.record.terminalStateRevision + 1,
        atomicWithCompletion: true }) });

    try {
      const committed = completionLedger.commitCompletion(clone(completion), guards);
      return coherentCompletion(committed) && sameValue(committed, completion)
        ? result(COMPLETION_OUTCOMES.EXECUTION_COMPLETED, null, committed)
        : result(COMPLETION_OUTCOMES.COMPLETION_UNCERTAIN,
          'atomic completion ledger returned inconsistent evidence');
    } catch (error) {
      let recovered = [];
      try { recovered = completionLedger.findById(request.executionCompletionId); } catch (_) {}
      if (Array.isArray(recovered) && recovered.length === 1
        && coherentCompletion(recovered[0]) && sameValue(recovered[0], completion)) {
        return result(COMPLETION_OUTCOMES.COMPLETION_ALREADY_RECORDED,
          'Completion recovered after response loss', recovered[0]);
      }
      if (error && error.code === 'RESULT_ACCEPTANCE_STALE') return result(
        COMPLETION_OUTCOMES.RESULT_ACCEPTANCE_STALE,
        'accepted result changed before atomic Completion commit');
      if (error && error.code === 'ATTEMPT_HISTORY_STALE') return result(
        COMPLETION_OUTCOMES.ATTEMPT_HISTORY_STALE,
        'attempt history changed before atomic Completion commit');
      if (error && error.code === 'EXECUTION_ALREADY_COMPLETED') return result(
        COMPLETION_OUTCOMES.EXECUTION_ALREADY_COMPLETED,
        'another Completion won the atomic terminal commit');
      return result(COMPLETION_OUTCOMES.COMPLETION_UNCERTAIN,
        'atomic Completion persistence is uncertain');
    }
  }

  return Object.freeze({ complete });
}

module.exports = { COMPLETION_OUTCOMES, EFFECT_CLASSES,
  createGovernedExecutionCompletion };
