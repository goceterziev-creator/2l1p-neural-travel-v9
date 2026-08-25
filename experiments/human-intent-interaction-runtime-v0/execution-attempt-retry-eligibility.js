'use strict';

const crypto = require('node:crypto');

const RETRY_ELIGIBILITY_OPERATION_OUTCOMES = Object.freeze({
  RETRY_ELIGIBILITY_RECORDED: 'RETRY_ELIGIBILITY_RECORDED',
  RETRY_ELIGIBILITY_ALREADY_RECORDED: 'RETRY_ELIGIBILITY_ALREADY_RECORDED',
  PRIOR_ATTEMPT_NOT_FOUND: 'PRIOR_ATTEMPT_NOT_FOUND',
  OUTCOME_RESOLUTION_NOT_FOUND: 'OUTCOME_RESOLUTION_NOT_FOUND',
  OUTCOME_RESOLUTION_STALE: 'OUTCOME_RESOLUTION_STALE',
  RETRY_POLICY_NOT_FOUND: 'RETRY_POLICY_NOT_FOUND',
  RETRY_ELIGIBILITY_REJECTED: 'RETRY_ELIGIBILITY_REJECTED',
  RETRY_ELIGIBILITY_UNCERTAIN: 'RETRY_ELIGIBILITY_UNCERTAIN'
});

const RETRY_ELIGIBILITY_CLASSES = Object.freeze([
  'PROVEN_NO_EFFECT',
  'IDEMPOTENT_REPLAY_SAFE',
  'RETRY_NOT_ELIGIBLE_EFFECT_CONFIRMED',
  'RETRY_NOT_ELIGIBLE_EFFECT_POSSIBLE',
  'RETRY_NOT_ELIGIBLE_OUTCOME_UNKNOWN',
  'RETRY_NOT_ELIGIBLE_EVIDENCE_CONFLICT',
  'RETRY_NOT_ELIGIBLE_NON_IDEMPOTENT'
]);

const EFFECT_OUTCOME_CLASSES = Object.freeze([
  'EFFECT_CONFIRMED',
  'NO_EFFECT_CONFIRMED',
  'EFFECT_REJECTED_BEFORE_EFFECT',
  'EFFECT_POSSIBLE',
  'EFFECT_OUTCOME_UNKNOWN',
  'EFFECT_EVIDENCE_CONFLICT'
]);

const EFFECT_CLASSES = Object.freeze([
  'IDEMPOTENT_WITH_STABLE_KEY',
  'NON_IDEMPOTENT'
]);

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const nonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalStringify(value)).digest('hex')}`;
}

function operationResult(outcome, reason = null, eligibility = null) {
  return Object.freeze({ outcome, reason, eligibility: clone(eligibility), retryAllowed: false,
    attemptCreated: false, authorityCreated: false });
}

function coherentAttemptSnapshot(snapshot, expectedId) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record) return null;
  const record = snapshot.record;
  const required = ['executionAttemptId', 'executionId', 'executionAcceptanceId',
    'preparationEvidenceRef', 'actionIdentity', 'actionRevision', 'continuationTargetRef',
    'executionOwnerIdentity', 'inputRef', 'verifiedInputDigest', 'effectContractRef',
    'effectContractRevision', 'effectIdempotencyClass', 'logicalEffectId',
    'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision'];
  if (record.type !== 'EXECUTION_ATTEMPT' || record.status !== 'ATTEMPT_CREATED'
    || record.executionAttemptId !== expectedId || record.singlePhysicalAttemptIdentity !== true
    || !Number.isInteger(record.attemptRevision) || !Number.isInteger(record.attemptOrdinal)
    || !Number.isInteger(record.preparationRevision) || record.authorityScope === undefined
    || required.some((key) => !nonEmptyString(record[key]))
    || !EFFECT_CLASSES.includes(record.effectIdempotencyClass)) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(record) });
}

function coherentInvocationSnapshot(snapshot, attempt) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record) return null;
  const record = snapshot.record;
  const validStatus = ['EFFECT_INVOCATION_STARTED', 'INVOCATION_RETURNED',
    'INVOCATION_UNCERTAIN'].includes(record.status);
  if (record.type !== 'EFFECT_INVOCATION' || !validStatus
    || !nonEmptyString(record.effectInvocationId) || !Number.isInteger(record.invocationRevision)
    || record.executionAttemptId !== attempt.executionAttemptId
    || record.executionId !== attempt.executionId
    || record.logicalEffectId !== attempt.logicalEffectId
    || record.effectContractRef !== attempt.effectContractRef
    || record.effectContractRevision !== attempt.effectContractRevision
    || record.effectIdempotencyClass !== attempt.effectIdempotencyClass
    || record.actionIdentity !== attempt.actionIdentity
    || record.actionRevision !== attempt.actionRevision
    || record.continuationTargetRef !== attempt.continuationTargetRef
    || record.inputRef !== attempt.inputRef
    || record.verifiedInputDigest !== attempt.verifiedInputDigest) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(record) });
}

function coherentResolutionSnapshot(snapshot, invocation, expectedId) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record) return null;
  const record = snapshot.record;
  const required = ['effectOutcomeResolutionId', 'effectInvocationId', 'logicalEffectId',
    'effectContractRef', 'effectContractRevision', 'effectIdempotencyClass',
    'outcomePolicyIdentity', 'outcomePolicyRevision', 'evidenceSetDigest', 'effectOutcomeClass'];
  if (record.type !== 'EFFECT_OUTCOME_RESOLUTION' || record.status !== 'EFFECT_OUTCOME_RESOLVED'
    || record.effectOutcomeResolutionId !== expectedId
    || record.effectInvocationId !== invocation.effectInvocationId
    || record.logicalEffectId !== invocation.logicalEffectId
    || record.effectContractRef !== invocation.effectContractRef
    || record.effectContractRevision !== invocation.effectContractRevision
    || record.effectIdempotencyClass !== invocation.effectIdempotencyClass
    || !Number.isInteger(record.resolutionRevision)
    || !Number.isInteger(record.evidenceSetRevision)
    || !EFFECT_OUTCOME_CLASSES.includes(record.effectOutcomeClass)
    || record.retryAllowed !== false || record.resultAccepted !== false
    || record.executionCompleted !== false
    || required.some((key) => !nonEmptyString(record[key]))) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(record) });
}

function coherentPolicy(snapshot, request, attempt) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record) return null;
  const record = snapshot.record;
  if (record.type !== 'ATTEMPT_RETRY_POLICY' || record.status !== 'ENABLED'
    || record.retryPolicyIdentity !== request.retryPolicyIdentity
    || record.retryPolicyRevision !== request.expectedRetryPolicyRevision
    || record.effectContractRef !== attempt.effectContractRef
    || record.effectContractRevision !== attempt.effectContractRevision
    || !Array.isArray(record.supportedEffectClasses)
    || !record.supportedEffectClasses.includes(attempt.effectIdempotencyClass)
    || typeof record.evaluateReplaySafety !== 'function') return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record });
}

function coherentEligibility(record) {
  const required = ['attemptRetryEligibilityId', 'executionId', 'previousExecutionAttemptId',
    'attemptEvidenceRef', 'preparationEvidenceRef', 'effectInvocationId',
    'invocationEvidenceRef', 'effectOutcomeResolutionId', 'outcomeResolutionEvidenceRef',
    'effectOutcomeClass', 'evidenceSetDigest', 'effectContractRef',
    'effectContractRevision', 'effectIdempotencyClass', 'logicalEffectId',
    'retryPolicyIdentity', 'retryPolicyRevision', 'retryPolicyEvidenceRef',
    'eligibilityClass', 'lifecycleEvidenceRef', 'eligibilityBindingDigest'];
  return Boolean(record && record.type === 'ATTEMPT_RETRY_ELIGIBILITY'
    && ['RETRY_ELIGIBLE', 'RETRY_NOT_ELIGIBLE'].includes(record.status)
    && Number.isInteger(record.retryEligibilityRevision)
    && Number.isInteger(record.previousAttemptRevision)
    && Number.isInteger(record.preparationRevision)
    && Number.isInteger(record.invocationRevision)
    && Number.isInteger(record.outcomeResolutionRevision)
    && Number.isInteger(record.evidenceSetRevision)
    && RETRY_ELIGIBILITY_CLASSES.includes(record.eligibilityClass)
    && required.every((key) => nonEmptyString(record[key]))
    && record.retryAllowed === false && record.attemptCreated === false
    && record.humanAuthorityCreated === false
    && (record.status === 'RETRY_ELIGIBLE'
      ? ['PROVEN_NO_EFFECT', 'IDEMPOTENT_REPLAY_SAFE'].includes(record.retrySafetyClass)
      : record.retrySafetyClass === null));
}

function classifyEligibility({ attempt, resolution, policy }) {
  const outcome = resolution.effectOutcomeClass;
  if (outcome === 'NO_EFFECT_CONFIRMED'
    || outcome === 'EFFECT_REJECTED_BEFORE_EFFECT') {
    return { eligibilityClass: 'PROVEN_NO_EFFECT', retrySafetyClass: 'PROVEN_NO_EFFECT',
      terminalityClass: 'TERMINAL_BEFORE_EFFECT', replaySafetyEvidenceRef: null };
  }
  if (outcome === 'EFFECT_CONFIRMED') return {
    eligibilityClass: 'RETRY_NOT_ELIGIBLE_EFFECT_CONFIRMED', retrySafetyClass: null,
    terminalityClass: 'TERMINAL_EFFECT_CONFIRMED', replaySafetyEvidenceRef: null };
  if (outcome === 'EFFECT_EVIDENCE_CONFLICT') return {
    eligibilityClass: 'RETRY_NOT_ELIGIBLE_EVIDENCE_CONFLICT', retrySafetyClass: null,
    terminalityClass: 'TERMINAL_OUTCOME_UNKNOWN', replaySafetyEvidenceRef: null };
  if (attempt.effectIdempotencyClass === 'NON_IDEMPOTENT') return {
    eligibilityClass: outcome === 'EFFECT_OUTCOME_UNKNOWN'
      ? 'RETRY_NOT_ELIGIBLE_OUTCOME_UNKNOWN' : 'RETRY_NOT_ELIGIBLE_NON_IDEMPOTENT',
    retrySafetyClass: null,
    terminalityClass: outcome === 'EFFECT_POSSIBLE'
      ? 'TERMINAL_POSSIBLE_EFFECT' : 'TERMINAL_OUTCOME_UNKNOWN',
    replaySafetyEvidenceRef: null };
  let assessment;
  try { assessment = policy.evaluateReplaySafety(Object.freeze({ attempt: clone(attempt),
    resolution: clone(resolution) })); } catch (_) { assessment = null; }
  const replaySafe = assessment && assessment.replaySafe === true
    && assessment.stableKeyGuaranteeVerified === true
    && assessment.duplicateApplicationSemanticsPreserved === true
    && assessment.constraintsSatisfied === true
    && nonEmptyString(assessment.replaySafetyEvidenceRef);
  if (replaySafe) return { eligibilityClass: 'IDEMPOTENT_REPLAY_SAFE',
    retrySafetyClass: 'IDEMPOTENT_REPLAY_SAFE',
    terminalityClass: outcome === 'EFFECT_POSSIBLE'
      ? 'TERMINAL_POSSIBLE_EFFECT' : 'TERMINAL_OUTCOME_UNKNOWN',
    replaySafetyEvidenceRef: assessment.replaySafetyEvidenceRef };
  return { eligibilityClass: outcome === 'EFFECT_POSSIBLE'
    ? 'RETRY_NOT_ELIGIBLE_EFFECT_POSSIBLE' : 'RETRY_NOT_ELIGIBLE_OUTCOME_UNKNOWN',
  retrySafetyClass: null, terminalityClass: outcome === 'EFFECT_POSSIBLE'
    ? 'TERMINAL_POSSIBLE_EFFECT' : 'TERMINAL_OUTCOME_UNKNOWN',
  replaySafetyEvidenceRef: null };
}

function createGovernedAttemptRetryEligibility({ attemptSnapshotPort, invocationSnapshotPort,
  outcomeResolutionSnapshotPort, currentOutcomeResolutionPort, retryPolicyRegistryPort,
  attemptHistoryPort, eligibilityLedger }) {
  for (const [name, port] of Object.entries({ attemptSnapshotPort, invocationSnapshotPort,
    outcomeResolutionSnapshotPort, currentOutcomeResolutionPort, retryPolicyRegistryPort,
    attemptHistoryPort })) {
    if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  }
  if (!eligibilityLedger || !['findById', 'findCurrentByAttempt', 'commitEligibility']
    .every((name) => typeof eligibilityLedger[name] === 'function')) {
    throw new TypeError('eligibilityLedger must implement findById, findCurrentByAttempt and commitEligibility');
  }

  function evaluate(request = {}) {
    const strings = ['attemptRetryEligibilityId', 'previousExecutionAttemptId',
      'effectOutcomeResolutionId', 'retryPolicyIdentity', 'expectedRetryPolicyRevision',
      'expectedEvidenceSetDigest'];
    if (strings.some((key) => !nonEmptyString(request[key]))
      || !Number.isInteger(request.expectedPreviousAttemptRevision)
      || !Number.isInteger(request.expectedOutcomeResolutionRevision)
      || !Number.isInteger(request.expectedEvidenceSetRevision)) {
      return operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_REJECTED,
        'exact identities, revisions and evidence-set expectations are required');
    }

    let rawAttempt;
    try { rawAttempt = attemptSnapshotPort(request.previousExecutionAttemptId); } catch (_) {
      return operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_UNCERTAIN,
        'authoritative prior attempt is unavailable');
    }
    if (rawAttempt === null || rawAttempt === undefined) return operationResult(
      RETRY_ELIGIBILITY_OPERATION_OUTCOMES.PRIOR_ATTEMPT_NOT_FOUND,
      'authoritative prior attempt is absent');
    const attemptSnapshot = coherentAttemptSnapshot(rawAttempt,
      request.previousExecutionAttemptId);
    if (!attemptSnapshot || attemptSnapshot.record.attemptRevision
      !== request.expectedPreviousAttemptRevision) return operationResult(
      RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_REJECTED,
      'prior attempt evidence is invalid or stale');
    const attempt = attemptSnapshot.record;

    let rawInvocation;
    try { rawInvocation = invocationSnapshotPort(attempt.executionAttemptId); } catch (_) {
      return operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_UNCERTAIN,
        'authoritative invocation lineage is unavailable');
    }
    const invocationSnapshot = coherentInvocationSnapshot(rawInvocation, attempt);
    if (!invocationSnapshot) return operationResult(
      RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_REJECTED,
      'invocation does not bind the exact prior attempt and frozen contracts');
    const invocation = invocationSnapshot.record;

    let rawResolution;
    try { rawResolution = outcomeResolutionSnapshotPort(request.effectOutcomeResolutionId); } catch (_) {
      return operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_UNCERTAIN,
        'authoritative outcome resolution is unavailable');
    }
    if (rawResolution === null || rawResolution === undefined) return operationResult(
      RETRY_ELIGIBILITY_OPERATION_OUTCOMES.OUTCOME_RESOLUTION_NOT_FOUND,
      'authoritative outcome resolution is absent');
    const resolutionSnapshot = coherentResolutionSnapshot(rawResolution, invocation,
      request.effectOutcomeResolutionId);
    if (!resolutionSnapshot) return operationResult(
      RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_REJECTED,
      'outcome resolution is incoherent or belongs to another invocation');
    const resolution = resolutionSnapshot.record;
    if (resolution.resolutionRevision !== request.expectedOutcomeResolutionRevision
      || resolution.evidenceSetRevision !== request.expectedEvidenceSetRevision
      || resolution.evidenceSetDigest !== request.expectedEvidenceSetDigest) {
      return operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.OUTCOME_RESOLUTION_STALE,
        'expected outcome resolution or evidence set is stale');
    }

    let current;
    let history;
    try {
      current = currentOutcomeResolutionPort(invocation.effectInvocationId);
      history = attemptHistoryPort(attempt.executionId);
    } catch (_) {
      return operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_UNCERTAIN,
        'current outcome or attempt history is unavailable');
    }
    if (!current || current.evidenceRef !== resolutionSnapshot.evidenceRef
      || !sameValue(current.record, resolution)
      || !Array.isArray(history) || history.length !== attempt.attemptOrdinal
      || !history.some((item) => sameValue(item, attempt))
      || history[history.length - 1].executionAttemptId !== attempt.executionAttemptId) {
      return operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.OUTCOME_RESOLUTION_STALE,
        'resolution is superseded or prior attempt is no longer the current history tail');
    }

    let policyRaw;
    try { policyRaw = retryPolicyRegistryPort(request.retryPolicyIdentity,
      request.expectedRetryPolicyRevision); } catch (_) {
      return operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_UNCERTAIN,
        'retry policy registry is unavailable');
    }
    const policySnapshot = coherentPolicy(policyRaw, request, attempt);
    if (!policySnapshot) return operationResult(
      RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_POLICY_NOT_FOUND,
      'exact compatible retry policy is absent or stale');

    let byId;
    let currentEligibility;
    try {
      byId = eligibilityLedger.findById(request.attemptRetryEligibilityId);
      currentEligibility = eligibilityLedger.findCurrentByAttempt(attempt.executionAttemptId);
    } catch (_) {
      return operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_UNCERTAIN,
        'retry eligibility ledger is unavailable');
    }
    if (!Array.isArray(byId) || byId.length > 1 || !Array.isArray(currentEligibility)
      || currentEligibility.length > 1) return operationResult(
      RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_UNCERTAIN,
      'retry eligibility ledger is conflicting or corrupt');
    const previous = currentEligibility[0] || null;
    if (previous && !coherentEligibility(previous)) return operationResult(
      RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_UNCERTAIN,
      'current retry eligibility evidence is corrupt');

    const classification = classifyEligibility({ attempt, resolution,
      policy: policySnapshot.record });
    const positive = classification.retrySafetyClass !== null;
    const binding = { attemptRetryEligibilityId: request.attemptRetryEligibilityId,
      previousExecutionAttemptId: attempt.executionAttemptId,
      previousAttemptRevision: attempt.attemptRevision,
      effectInvocationId: invocation.effectInvocationId,
      invocationRevision: invocation.invocationRevision,
      effectOutcomeResolutionId: resolution.effectOutcomeResolutionId,
      outcomeResolutionRevision: resolution.resolutionRevision,
      evidenceSetRevision: resolution.evidenceSetRevision,
      evidenceSetDigest: resolution.evidenceSetDigest,
      retryPolicyIdentity: policySnapshot.record.retryPolicyIdentity,
      retryPolicyRevision: policySnapshot.record.retryPolicyRevision,
      effectContractRef: attempt.effectContractRef,
      effectContractRevision: attempt.effectContractRevision,
      logicalEffectId: attempt.logicalEffectId,
      eligibilityClass: classification.eligibilityClass };
    const identityRecovery = byId.length === 1 ? byId[0] : null;
    const record = Object.freeze({ type: 'ATTEMPT_RETRY_ELIGIBILITY',
      status: positive ? 'RETRY_ELIGIBLE' : 'RETRY_NOT_ELIGIBLE',
      attemptRetryEligibilityId: request.attemptRetryEligibilityId,
      retryEligibilityRevision: identityRecovery ? identityRecovery.retryEligibilityRevision
        : (previous ? previous.retryEligibilityRevision + 1 : 1),
      supersedesRetryEligibilityRef: identityRecovery
        ? identityRecovery.supersedesRetryEligibilityRef
        : (previous ? previous.attemptRetryEligibilityId : null),
      executionId: attempt.executionId,
      previousExecutionAttemptId: attempt.executionAttemptId,
      previousAttemptRevision: attempt.attemptRevision,
      attemptEvidenceRef: attemptSnapshot.evidenceRef,
      preparationEvidenceRef: attempt.preparationEvidenceRef,
      preparationRevision: attempt.preparationRevision,
      effectInvocationId: invocation.effectInvocationId,
      invocationEvidenceRef: invocationSnapshot.evidenceRef,
      invocationRevision: invocation.invocationRevision,
      effectOutcomeResolutionId: resolution.effectOutcomeResolutionId,
      outcomeResolutionEvidenceRef: resolutionSnapshot.evidenceRef,
      outcomeResolutionRevision: resolution.resolutionRevision,
      effectOutcomeClass: resolution.effectOutcomeClass,
      evidenceSetRevision: resolution.evidenceSetRevision,
      evidenceSetDigest: resolution.evidenceSetDigest,
      effectContractRef: attempt.effectContractRef,
      effectContractRevision: attempt.effectContractRevision,
      effectIdempotencyClass: attempt.effectIdempotencyClass,
      logicalEffectId: attempt.logicalEffectId,
      actionIdentity: attempt.actionIdentity, actionRevision: attempt.actionRevision,
      continuationTargetRef: attempt.continuationTargetRef,
      authorityScope: clone(attempt.authorityScope), inputRef: attempt.inputRef,
      verifiedInputDigest: attempt.verifiedInputDigest,
      retryPolicyIdentity: policySnapshot.record.retryPolicyIdentity,
      retryPolicyRevision: policySnapshot.record.retryPolicyRevision,
      retryPolicyEvidenceRef: policySnapshot.evidenceRef,
      eligibilityClass: classification.eligibilityClass,
      retrySafetyClass: classification.retrySafetyClass,
      terminalityClass: classification.terminalityClass,
      replaySafetyEvidenceRef: classification.replaySafetyEvidenceRef,
      lifecycleEvidenceRef: resolutionSnapshot.evidenceRef,
      eligibilityBindingDigest: digest(binding),
      retryAllowed: false, attemptCreated: false, humanAuthorityCreated: false,
      singleSuccessorAttemptBindingRequired: true });

    if (byId.length === 1) {
      if (coherentEligibility(byId[0]) && sameValue(byId[0], record)) return operationResult(
        RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_ALREADY_RECORDED,
        null, byId[0]);
      return operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_REJECTED,
        'retry eligibility identity is already bound differently');
    }

    const guards = Object.freeze({ attemptEvidenceRef: attemptSnapshot.evidenceRef,
      previousAttemptRevision: attempt.attemptRevision,
      expectedAttemptHistoryRevision: history.length,
      previousExecutionAttemptId: attempt.executionAttemptId,
      noSuccessorAttempt: true,
      invocationEvidenceRef: invocationSnapshot.evidenceRef,
      invocationRevision: invocation.invocationRevision,
      outcomeResolutionEvidenceRef: resolutionSnapshot.evidenceRef,
      outcomeResolutionRevision: resolution.resolutionRevision,
      evidenceSetRevision: resolution.evidenceSetRevision,
      evidenceSetDigest: resolution.evidenceSetDigest,
      expectedCurrentResolutionId: resolution.effectOutcomeResolutionId,
      retryPolicyIdentity: policySnapshot.record.retryPolicyIdentity,
      retryPolicyRevision: policySnapshot.record.retryPolicyRevision,
      effectContractRevision: attempt.effectContractRevision,
      logicalEffectId: attempt.logicalEffectId,
      expectedCurrentEligibilityId: previous ? previous.attemptRetryEligibilityId : null,
      uniqueRetryEligibilityId: true });
    try {
      const committed = eligibilityLedger.commitEligibility(clone(record), guards);
      return coherentEligibility(committed) && sameValue(committed, record)
        ? operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_RECORDED,
          null, committed)
        : operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_UNCERTAIN,
          'ledger returned inconsistent retry eligibility evidence');
    } catch (error) {
      let recovered = [];
      try { recovered = eligibilityLedger.findById(request.attemptRetryEligibilityId); } catch (_) {}
      if (Array.isArray(recovered) && recovered.length === 1
        && coherentEligibility(recovered[0]) && sameValue(recovered[0], record)) {
        return operationResult(
          RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_ALREADY_RECORDED,
          'retry eligibility recovered after response loss', recovered[0]);
      }
      if (error && ['RESOLUTION_STALE', 'ATTEMPT_HISTORY_STALE', 'POLICY_STALE']
        .includes(error.code)) return operationResult(
        RETRY_ELIGIBILITY_OPERATION_OUTCOMES.OUTCOME_RESOLUTION_STALE,
        'authoritative eligibility inputs changed before commit');
      return operationResult(RETRY_ELIGIBILITY_OPERATION_OUTCOMES.RETRY_ELIGIBILITY_UNCERTAIN,
        'atomic retry eligibility persistence failed or is uncertain');
    }
  }

  return Object.freeze({ evaluate });
}

module.exports = { RETRY_ELIGIBILITY_OPERATION_OUTCOMES, RETRY_ELIGIBILITY_CLASSES,
  EFFECT_OUTCOME_CLASSES, createGovernedAttemptRetryEligibility };
