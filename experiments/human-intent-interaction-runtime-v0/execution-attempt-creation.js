'use strict';

const ATTEMPT_CREATION_OUTCOMES = Object.freeze({
  ATTEMPT_CREATED: 'ATTEMPT_CREATED',
  ALREADY_CREATED: 'ALREADY_CREATED',
  EXECUTION_NOT_PREPARED: 'EXECUTION_NOT_PREPARED',
  EXECUTION_NOT_ELIGIBLE: 'EXECUTION_NOT_ELIGIBLE',
  ACTIVE_ATTEMPT_EXISTS: 'ACTIVE_ATTEMPT_EXISTS',
  RETRY_NOT_AUTHORIZED: 'RETRY_NOT_AUTHORIZED',
  PREPARATION_STALE: 'PREPARATION_STALE',
  INVALID_EXECUTION_PREPARATION: 'INVALID_EXECUTION_PREPARATION',
  ATTEMPT_CREATION_REJECTED: 'ATTEMPT_CREATION_REJECTED',
  ATTEMPT_CREATION_UNCERTAIN: 'ATTEMPT_CREATION_UNCERTAIN'
});

const EFFECT_CLASSES = Object.freeze([
  'NO_EXTERNAL_EFFECT',
  'IDEMPOTENT_WITH_STABLE_KEY',
  'NON_IDEMPOTENT'
]);

const TERMINALITY_CLASSES = Object.freeze([
  'UNRESOLVED',
  'TERMINAL_BEFORE_EFFECT',
  'TERMINAL_EFFECT_CONFIRMED',
  'TERMINAL_POSSIBLE_EFFECT',
  'TERMINAL_OUTCOME_UNKNOWN'
]);

const RETRY_SAFETY_CLASSES = Object.freeze([
  'PROVEN_NO_EFFECT',
  'IDEMPOTENT_REPLAY_SAFE'
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

function result(outcome, reason = null, attempt = null) {
  return Object.freeze({ outcome, reason, attempt: clone(attempt) });
}

function invalid(reason) {
  return result(ATTEMPT_CREATION_OUTCOMES.INVALID_EXECUTION_PREPARATION, reason);
}

function rejected(reason) {
  return result(ATTEMPT_CREATION_OUTCOMES.ATTEMPT_CREATION_REJECTED, reason);
}

function coherentPreparationSnapshot(snapshot, executionId) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record) return null;
  const record = snapshot.record;
  const requiredStrings = [
    'executionId', 'executionAcceptanceId', 'dispatchId', 'idempotencyKey',
    'continuationId', 'interactionId', 'gateId', 'continuationTargetRef',
    'authorityEvidenceRef', 'governanceEvaluationRef', 'actionIdentity',
    'actionRevision', 'actionRegistrationIdentity', 'actionRegistrationRevision',
    'executionOwnerIdentity', 'inputRef', 'expectedInputDigest',
    'verifiedInputDigest', 'verifiedInputEvidenceRef', 'effectContractRef',
    'effectContractRevision', 'effectIdempotencyClass',
    'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision'
  ];
  if (record.type !== 'EXECUTION_PREPARATION'
    || record.status !== 'EXECUTION_PREPARED'
    || record.executionId !== executionId
    || record.singleLogicalExecution !== true
    || !nonEmptyString(record.attemptEligibility)
    || !Number.isInteger(record.preparationRevision)
    || !Number.isInteger(record.gateRevision)
    || !Number.isInteger(record.authorityCommittedRevision)
    || record.authorityScope === undefined
    || requiredStrings.some((name) => !nonEmptyString(record[name]))) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(record) });
}

function coherentAttempt(record) {
  const requiredStrings = [
    'executionAttemptId', 'executionId', 'executionAcceptanceId',
    'preparationEvidenceRef', 'dispatchId', 'continuationId', 'interactionId',
    'gateId', 'authorityEvidenceRef', 'governanceEvaluationRef', 'actionIdentity',
    'actionRevision', 'continuationTargetRef', 'executionOwnerIdentity', 'inputRef',
    'expectedInputDigest', 'verifiedInputDigest', 'verifiedInputEvidenceRef',
    'effectContractRef', 'effectContractRevision', 'effectIdempotencyClass',
    'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision',
    'logicalEffectIdentityDerivation', 'logicalEffectIdentityRevision'
  ];
  return Boolean(record
    && record.type === 'EXECUTION_ATTEMPT'
    && record.status === 'ATTEMPT_CREATED'
    && record.singlePhysicalAttemptIdentity === true
    && record.claimStatus === 'UNCLAIMED'
    && Number.isInteger(record.attemptRevision)
    && Number.isInteger(record.attemptOrdinal)
    && record.attemptOrdinal > 0
    && Number.isInteger(record.preparationRevision)
    && record.authorityScope !== undefined
    && requiredStrings.every((name) => nonEmptyString(record[name]))
    && (record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
      ? record.logicalEffectId === null : nonEmptyString(record.logicalEffectId)));
}

function attemptMatchesPreparation(attempt, snapshot) {
  const prepared = snapshot.record;
  return attempt.preparationEvidenceRef === snapshot.evidenceRef
    && attempt.preparationRevision === prepared.preparationRevision
    && attempt.executionId === prepared.executionId
    && attempt.executionAcceptanceId === prepared.executionAcceptanceId
    && attempt.dispatchId === prepared.dispatchId
    && attempt.continuationId === prepared.continuationId
    && attempt.interactionId === prepared.interactionId
    && attempt.gateId === prepared.gateId
    && attempt.gateRevision === prepared.gateRevision
    && sameValue(attempt.authorityScope, prepared.authorityScope)
    && attempt.continuationTargetRef === prepared.continuationTargetRef
    && attempt.actionIdentity === prepared.actionIdentity
    && attempt.actionRevision === prepared.actionRevision
    && attempt.executionOwnerIdentity === prepared.executionOwnerIdentity
    && attempt.inputRef === prepared.inputRef
    && attempt.verifiedInputDigest === prepared.verifiedInputDigest
    && attempt.effectContractRef === prepared.effectContractRef
    && attempt.effectContractRevision === prepared.effectContractRevision
    && attempt.effectIdempotencyClass === prepared.effectIdempotencyClass
    && attempt.resultEvidenceGrammarRef === prepared.resultEvidenceGrammarRef
    && attempt.resultEvidenceGrammarRevision === prepared.resultEvidenceGrammarRevision;
}

function orderAndValidateHistory(records, executionId) {
  if (!Array.isArray(records)) return null;
  const ordered = records.map(clone).sort((a, b) => a.attemptOrdinal - b.attemptOrdinal);
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const previous = ordered[index - 1] || null;
    if (!coherentAttempt(current)
      || current.executionId !== executionId
      || current.attemptOrdinal !== index + 1
      || current.previousExecutionAttemptId !== (previous && previous.executionAttemptId)
      || (index === 0 && (current.retryEligibilityEvidenceRef !== null
        || current.retrySafetyClass !== null))) return null;
  }
  return ordered;
}

function coherentRetryEvidence(snapshot, prepared, previous, expectedRef) {
  if (!snapshot || snapshot.evidenceRef !== expectedRef || !snapshot.record) return null;
  const record = snapshot.record;
  if (record.type !== 'ATTEMPT_RETRY_ELIGIBILITY'
    || record.status !== 'RETRY_ELIGIBLE'
    || record.executionId !== prepared.executionId
    || record.previousExecutionAttemptId !== previous.executionAttemptId
    || record.previousAttemptRevision !== previous.attemptRevision
    || record.preparationEvidenceRef !== previous.preparationEvidenceRef
    || record.preparationRevision !== prepared.preparationRevision
    || record.logicalEffectId !== previous.logicalEffectId
    || !TERMINALITY_CLASSES.includes(record.terminalityClass)
    || !RETRY_SAFETY_CLASSES.includes(record.retrySafetyClass)
    || !nonEmptyString(record.lifecycleEvidenceRef)
    || !Number.isInteger(record.retryEligibilityRevision)) return null;
  if (record.retrySafetyClass === 'PROVEN_NO_EFFECT'
    && record.terminalityClass !== 'TERMINAL_BEFORE_EFFECT') return null;
  if (record.retrySafetyClass === 'IDEMPOTENT_REPLAY_SAFE'
    && prepared.effectIdempotencyClass !== 'IDEMPOTENT_WITH_STABLE_KEY') return null;
  if (record.terminalityClass === 'UNRESOLVED'
    || record.terminalityClass === 'TERMINAL_EFFECT_CONFIRMED') return null;
  if ((record.terminalityClass === 'TERMINAL_POSSIBLE_EFFECT'
      || record.terminalityClass === 'TERMINAL_OUTCOME_UNKNOWN')
    && record.retrySafetyClass !== 'IDEMPOTENT_REPLAY_SAFE') return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(record) });
}

function createGovernedExecutionAttemptCreation({
  preparationSnapshotPort,
  retryEligibilitySnapshotPort,
  logicalEffectIdentityPort,
  attemptLedger
}) {
  for (const [name, port] of Object.entries({ preparationSnapshotPort,
    retryEligibilitySnapshotPort, logicalEffectIdentityPort })) {
    if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  }
  if (!attemptLedger || !['findByExecution', 'findByAttemptId', 'commitAttempt']
    .every((name) => typeof attemptLedger[name] === 'function')) {
    throw new TypeError('attemptLedger must implement findByExecution, findByAttemptId and commitAttempt');
  }

  function create({ executionId, executionAttemptId, expectedPreparationRevision,
    retryEligibilityEvidenceRef = null } = {}) {
    if (!nonEmptyString(executionId) || !nonEmptyString(executionAttemptId)
      || !Number.isInteger(expectedPreparationRevision)) {
      return rejected('execution, attempt and expected preparation revision are required');
    }
    if (executionAttemptId === executionId) return rejected('attempt identity must differ from execution identity');

    let rawSnapshot;
    try { rawSnapshot = preparationSnapshotPort(executionId); } catch (_) {
      return result(ATTEMPT_CREATION_OUTCOMES.ATTEMPT_CREATION_UNCERTAIN,
        'authoritative preparation is unavailable');
    }
    if (rawSnapshot === null || rawSnapshot === undefined) {
      return result(ATTEMPT_CREATION_OUTCOMES.EXECUTION_NOT_PREPARED,
        'authoritative EXECUTION_PREPARED evidence is absent');
    }
    const snapshot = coherentPreparationSnapshot(rawSnapshot, executionId);
    if (!snapshot) return invalid('authoritative execution preparation is invalid or incoherent');
    const prepared = snapshot.record;
    if (prepared.preparationRevision !== expectedPreparationRevision) {
      return result(ATTEMPT_CREATION_OUTCOMES.PREPARATION_STALE,
        'expected preparation revision is stale');
    }
    if (prepared.attemptEligibility !== 'ELIGIBLE_FOR_GOVERNED_ATTEMPT_CREATION'
      || !EFFECT_CLASSES.includes(prepared.effectIdempotencyClass)) {
      return result(ATTEMPT_CREATION_OUTCOMES.EXECUTION_NOT_ELIGIBLE,
        'prepared execution is not eligible for governed attempt creation');
    }
    if ([prepared.dispatchId, prepared.executionAcceptanceId].includes(executionAttemptId)) {
      return rejected('attempt identity must differ from dispatch and acceptance identities');
    }

    let byExecution;
    let byAttempt;
    try {
      byExecution = attemptLedger.findByExecution(executionId);
      byAttempt = attemptLedger.findByAttemptId(executionAttemptId);
    } catch (_) {
      return result(ATTEMPT_CREATION_OUTCOMES.ATTEMPT_CREATION_UNCERTAIN,
        'attempt ledger is unavailable');
    }
    const history = orderAndValidateHistory(byExecution, executionId);
    if (!history || !Array.isArray(byAttempt) || byAttempt.length > 1) {
      return invalid('attempt ledger contains conflicting or corrupt evidence');
    }
    if (byAttempt.length === 1) {
      const existing = byAttempt[0];
      if (!coherentAttempt(existing) || existing.executionAttemptId !== executionAttemptId
        || existing.executionId !== executionId || !attemptMatchesPreparation(existing, snapshot)
        || !history.some((item) => sameValue(item, existing))) {
        return rejected('attempt identity is already bound to another or conflicting execution');
      }
      return result(ATTEMPT_CREATION_OUTCOMES.ALREADY_CREATED, null, existing);
    }

    const previous = history[history.length - 1] || null;
    let retrySnapshot = null;
    if (previous) {
      if (!nonEmptyString(retryEligibilityEvidenceRef)) {
        return result(ATTEMPT_CREATION_OUTCOMES.ACTIVE_ATTEMPT_EXISTS,
          'an existing attempt must be recovered or authoritatively terminalized');
      }
      let rawRetry;
      try { rawRetry = retryEligibilitySnapshotPort(retryEligibilityEvidenceRef); } catch (_) {
        return result(ATTEMPT_CREATION_OUTCOMES.ATTEMPT_CREATION_UNCERTAIN,
          'retry eligibility evidence is unavailable');
      }
      retrySnapshot = coherentRetryEvidence(rawRetry, prepared, previous,
        retryEligibilityEvidenceRef);
      if (!retrySnapshot) {
        return result(ATTEMPT_CREATION_OUTCOMES.RETRY_NOT_AUTHORIZED,
          'exact authoritative retry-safe evidence is absent or insufficient');
      }
    } else if (retryEligibilityEvidenceRef !== null) {
      return rejected('first attempt cannot consume retry eligibility evidence');
    }

    let effectIdentity;
    try {
      effectIdentity = logicalEffectIdentityPort(Object.freeze({
        executionId: prepared.executionId,
        actionIdentity: prepared.actionIdentity,
        actionRevision: prepared.actionRevision,
        continuationTargetRef: prepared.continuationTargetRef,
        authorityScope: clone(prepared.authorityScope),
        verifiedInputDigest: prepared.verifiedInputDigest,
        effectContractRef: prepared.effectContractRef,
        effectContractRevision: prepared.effectContractRevision,
        effectIdempotencyClass: prepared.effectIdempotencyClass
      }));
    } catch (_) {
      return rejected('LOGICAL_EFFECT_IDENTITY_DERIVATION_FAILED');
    }
    if (!effectIdentity || !nonEmptyString(effectIdentity.derivationIdentity)
      || !nonEmptyString(effectIdentity.derivationRevision)
      || (prepared.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
        ? effectIdentity.logicalEffectId !== null
        : !nonEmptyString(effectIdentity.logicalEffectId))) {
      return rejected('LOGICAL_EFFECT_IDENTITY_INVALID');
    }
    if (previous && effectIdentity.logicalEffectId !== previous.logicalEffectId) {
      return result(ATTEMPT_CREATION_OUTCOMES.RETRY_NOT_AUTHORIZED,
        'logical effect identity changed across physical attempts');
    }

    const attempt = Object.freeze({
      type: 'EXECUTION_ATTEMPT',
      status: 'ATTEMPT_CREATED',
      executionAttemptId,
      attemptRevision: 1,
      attemptOrdinal: history.length + 1,
      previousExecutionAttemptId: previous ? previous.executionAttemptId : null,
      executionId: prepared.executionId,
      executionAcceptanceId: prepared.executionAcceptanceId,
      preparationEvidenceRef: snapshot.evidenceRef,
      preparationRevision: prepared.preparationRevision,
      dispatchId: prepared.dispatchId,
      continuationId: prepared.continuationId,
      interactionId: prepared.interactionId,
      gateId: prepared.gateId,
      gateRevision: prepared.gateRevision,
      authorityEvidenceRef: prepared.authorityEvidenceRef,
      governanceEvaluationRef: prepared.governanceEvaluationRef,
      authorityCommittedRevision: prepared.authorityCommittedRevision,
      actionIdentity: prepared.actionIdentity,
      actionRevision: prepared.actionRevision,
      continuationTargetRef: prepared.continuationTargetRef,
      authorityScope: clone(prepared.authorityScope),
      executionOwnerIdentity: prepared.executionOwnerIdentity,
      inputRef: prepared.inputRef,
      expectedInputDigest: prepared.expectedInputDigest,
      verifiedInputDigest: prepared.verifiedInputDigest,
      verifiedInputEvidenceRef: prepared.verifiedInputEvidenceRef,
      effectContractRef: prepared.effectContractRef,
      effectContractRevision: prepared.effectContractRevision,
      effectIdempotencyClass: prepared.effectIdempotencyClass,
      logicalEffectId: effectIdentity.logicalEffectId,
      logicalEffectIdentityDerivation: effectIdentity.derivationIdentity,
      logicalEffectIdentityRevision: effectIdentity.derivationRevision,
      resultEvidenceGrammarRef: prepared.resultEvidenceGrammarRef,
      resultEvidenceGrammarRevision: prepared.resultEvidenceGrammarRevision,
      retryEligibilityEvidenceRef: retrySnapshot ? retrySnapshot.evidenceRef : null,
      retrySafetyClass: retrySnapshot ? retrySnapshot.record.retrySafetyClass : null,
      singlePhysicalAttemptIdentity: true,
      claimStatus: 'UNCLAIMED'
    });

    const guards = Object.freeze({
      preparationGuard: Object.freeze({ evidenceRef: snapshot.evidenceRef,
        preparationRevision: prepared.preparationRevision,
        attemptEligibility: prepared.attemptEligibility }),
      identityGuard: Object.freeze({ executionId, executionAttemptId }),
      historyGuard: Object.freeze({ historyRevision: history.length,
        previousExecutionAttemptId: previous ? previous.executionAttemptId : null,
        noUnresolvedAttempt: true }),
      retryGuard: retrySnapshot ? Object.freeze({ evidenceRef: retrySnapshot.evidenceRef,
        retryEligibilityRevision: retrySnapshot.record.retryEligibilityRevision,
        retrySafetyClass: retrySnapshot.record.retrySafetyClass }) : null,
      contractGuard: Object.freeze({ actionRevision: prepared.actionRevision,
        effectContractRevision: prepared.effectContractRevision,
        resultEvidenceGrammarRevision: prepared.resultEvidenceGrammarRevision,
        logicalEffectId: effectIdentity.logicalEffectId })
    });

    try {
      const committed = attemptLedger.commitAttempt(clone(attempt), guards);
      if (!coherentAttempt(committed) || !sameValue(committed, attempt)) {
        return result(ATTEMPT_CREATION_OUTCOMES.ATTEMPT_CREATION_UNCERTAIN,
          'atomic ledger returned inconsistent attempt evidence');
      }
      return result(ATTEMPT_CREATION_OUTCOMES.ATTEMPT_CREATED, null, committed);
    } catch (error) {
      let recovered;
      try {
        const matches = attemptLedger.findByAttemptId(executionAttemptId);
        recovered = Array.isArray(matches) && matches.length === 1 ? matches[0] : null;
      } catch (_) { recovered = null; }
      if (recovered && coherentAttempt(recovered) && sameValue(recovered, attempt)) {
        return result(ATTEMPT_CREATION_OUTCOMES.ALREADY_CREATED, null, recovered);
      }
      if (error && error.code === 'PREPARATION_STALE') {
        return result(ATTEMPT_CREATION_OUTCOMES.PREPARATION_STALE,
          'guarded preparation or contract revision changed before commit');
      }
      if (error && error.code === 'ACTIVE_ATTEMPT_EXISTS') {
        return result(ATTEMPT_CREATION_OUTCOMES.ACTIVE_ATTEMPT_EXISTS,
          'another unresolved attempt won the atomic commit');
      }
      if (error && error.code === 'RETRY_NOT_AUTHORIZED') {
        return result(ATTEMPT_CREATION_OUTCOMES.RETRY_NOT_AUTHORIZED,
          'retry eligibility changed before atomic commit');
      }
      return result(ATTEMPT_CREATION_OUTCOMES.ATTEMPT_CREATION_UNCERTAIN,
        'atomic attempt persistence is uncertain');
    }
  }

  return Object.freeze({ create });
}

module.exports = {
  ATTEMPT_CREATION_OUTCOMES,
  EFFECT_CLASSES,
  RETRY_SAFETY_CLASSES,
  TERMINALITY_CLASSES,
  createGovernedExecutionAttemptCreation
};
