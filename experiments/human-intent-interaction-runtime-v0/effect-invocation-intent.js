'use strict';

const EFFECT_INTENT_OUTCOMES = Object.freeze({
  EFFECT_INVOCATION_INTENT_RECORDED: 'EFFECT_INVOCATION_INTENT_RECORDED',
  ALREADY_RECORDED: 'ALREADY_RECORDED',
  START_NOT_FOUND: 'START_NOT_FOUND',
  START_NOT_ELIGIBLE: 'START_NOT_ELIGIBLE',
  BRANCH_MISMATCH: 'BRANCH_MISMATCH',
  CLAIM_NOT_CURRENT: 'CLAIM_NOT_CURRENT',
  ADAPTER_NOT_CURRENT: 'ADAPTER_NOT_CURRENT',
  INTENT_ALREADY_EXISTS: 'INTENT_ALREADY_EXISTS',
  INTENT_STALE: 'INTENT_STALE',
  INVALID_START: 'INVALID_START',
  INTENT_REJECTED: 'INTENT_REJECTED',
  INTENT_UNCERTAIN: 'INTENT_UNCERTAIN'
});

const EFFECT_CAPABLE_CLASSES = Object.freeze([
  'IDEMPOTENT_WITH_STABLE_KEY', 'NON_IDEMPOTENT'
]);
const KNOWN_EFFECT_CLASSES = Object.freeze([
  'NO_EXTERNAL_EFFECT', ...EFFECT_CAPABLE_CLASSES
]);

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const nonEmptyString = (value) => typeof value === 'string' && value.length > 0;

function result(outcome, reason = null, intent = null) {
  return Object.freeze({ outcome, reason, intent: clone(intent), effectCrossingPermitted: false });
}
const rejected = (reason) => result(EFFECT_INTENT_OUTCOMES.INTENT_REJECTED, reason);
const invalid = (reason) => result(EFFECT_INTENT_OUTCOMES.INVALID_START, reason);

function coherentStart(record) {
  const requiredStrings = [
    'executionStartId', 'executionAttemptId', 'attemptClaimId', 'attemptEvidenceRef',
    'claimEvidenceRef', 'executionId', 'executionAcceptanceId', 'preparationEvidenceRef',
    'dispatchId', 'continuationId', 'interactionId', 'gateId', 'authorityEvidenceRef',
    'governanceEvaluationRef', 'adapterRegistrationEvidenceRef',
    'adapterRegistrationIdentity', 'adapterRegistrationRevision', 'adapterIdentity',
    'adapterRevision', 'attemptOwnerIdentity', 'ownerIdentityEvidenceRef',
    'ownerIdentityRevision', 'compatibilityEvidenceRef', 'actionIdentity',
    'actionRevision', 'continuationTargetRef', 'executionOwnerIdentity', 'inputRef',
    'verifiedInputDigest', 'verifiedInputEvidenceRef', 'effectContractRef',
    'effectContractRevision', 'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision'
  ];
  return Boolean(record
    && record.type === 'EXECUTION_ATTEMPT_START'
    && record.status === 'EXECUTION_ATTEMPT_STARTED'
    && record.executionActivityStarted === true
    && record.singleAuthoritativeStart === true
    && Number.isInteger(record.startRevision)
    && Number.isInteger(record.attemptRevision)
    && Number.isInteger(record.claimRevision)
    && Number.isInteger(record.claimHistoryRevision)
    && Number.isInteger(record.preparationRevision)
    && Number.isInteger(record.gateRevision)
    && record.authorityScope !== undefined
    && requiredStrings.every((name) => nonEmptyString(record[name]))
    && KNOWN_EFFECT_CLASSES.includes(record.effectIdempotencyClass)
    && (record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
      ? record.logicalEffectId === null : nonEmptyString(record.logicalEffectId)));
}

function coherentSnapshot(snapshot, executionStartId) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record
    || typeof snapshot.currentClaim !== 'boolean'
    || typeof snapshot.adapterRegistrationCurrent !== 'boolean'
    || typeof snapshot.adapterRegistrationEnabled !== 'boolean'
    || typeof snapshot.ownerIdentityCurrent !== 'boolean'
    || typeof snapshot.conflictingLifecycleEvidence !== 'boolean'
    || typeof snapshot.invocationStatusUnknown !== 'boolean'
    || typeof snapshot.effectPossiblyOccurred !== 'boolean'
    || typeof snapshot.terminalLifecycleEvidence !== 'boolean') return null;
  if (!coherentStart(snapshot.record)
    || snapshot.record.executionStartId !== executionStartId) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef,
    currentClaim: snapshot.currentClaim,
    adapterRegistrationCurrent: snapshot.adapterRegistrationCurrent,
    adapterRegistrationEnabled: snapshot.adapterRegistrationEnabled,
    ownerIdentityCurrent: snapshot.ownerIdentityCurrent,
    conflictingLifecycleEvidence: snapshot.conflictingLifecycleEvidence,
    invocationStatusUnknown: snapshot.invocationStatusUnknown,
    effectPossiblyOccurred: snapshot.effectPossiblyOccurred,
    terminalLifecycleEvidence: snapshot.terminalLifecycleEvidence,
    record: clone(snapshot.record) });
}

function coherentIntent(record) {
  const requiredStrings = [
    'effectInvocationIntentId', 'startEvidenceRef', 'executionStartId',
    'executionAttemptId', 'attemptClaimId', 'attemptEvidenceRef', 'claimEvidenceRef',
    'executionId', 'executionAcceptanceId', 'preparationEvidenceRef', 'dispatchId',
    'continuationId', 'interactionId', 'gateId', 'authorityEvidenceRef',
    'governanceEvaluationRef', 'adapterRegistrationEvidenceRef',
    'adapterRegistrationIdentity', 'adapterRegistrationRevision', 'adapterIdentity',
    'adapterRevision', 'attemptOwnerIdentity', 'ownerIdentityEvidenceRef',
    'ownerIdentityRevision', 'compatibilityEvidenceRef', 'actionIdentity',
    'actionRevision', 'continuationTargetRef', 'executionOwnerIdentity', 'inputRef',
    'verifiedInputDigest', 'verifiedInputEvidenceRef', 'effectContractRef',
    'effectContractRevision', 'effectIdempotencyClass', 'logicalEffectId',
    'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision'
  ];
  return Boolean(record && record.type === 'EFFECT_INVOCATION_INTENT'
    && record.status === 'EFFECT_INVOCATION_INTENT'
    && record.invocationOccurred === 'UNKNOWN'
    && record.singleIntentForStart === true
    && Number.isInteger(record.intentRevision)
    && Number.isInteger(record.startRevision)
    && Number.isInteger(record.attemptRevision)
    && Number.isInteger(record.claimRevision)
    && record.authorityScope !== undefined
    && requiredStrings.every((name) => nonEmptyString(record[name]))
    && EFFECT_CAPABLE_CLASSES.includes(record.effectIdempotencyClass));
}

function intentMatchesRequest(intent, request) {
  return intent.effectInvocationIntentId === request.effectInvocationIntentId
    && intent.executionStartId === request.executionStartId;
}

function intentMatchesStart(intent, snapshot) {
  const start = snapshot.record;
  return intent.startEvidenceRef === snapshot.evidenceRef
    && intent.startRevision === start.startRevision
    && intent.executionAttemptId === start.executionAttemptId
    && intent.attemptClaimId === start.attemptClaimId
    && intent.attemptRevision === start.attemptRevision
    && intent.claimRevision === start.claimRevision
    && intent.actionIdentity === start.actionIdentity
    && intent.actionRevision === start.actionRevision
    && intent.continuationTargetRef === start.continuationTargetRef
    && sameValue(intent.authorityScope, start.authorityScope)
    && intent.executionOwnerIdentity === start.executionOwnerIdentity
    && intent.verifiedInputDigest === start.verifiedInputDigest
    && intent.effectContractRef === start.effectContractRef
    && intent.effectContractRevision === start.effectContractRevision
    && intent.effectIdempotencyClass === start.effectIdempotencyClass
    && intent.logicalEffectId === start.logicalEffectId
    && intent.resultEvidenceGrammarRef === start.resultEvidenceGrammarRef
    && intent.resultEvidenceGrammarRevision === start.resultEvidenceGrammarRevision;
}

function createGovernedEffectInvocationIntent({ intentLedger }) {
  if (!intentLedger || !['findStartSnapshot', 'findIntentByStart',
    'findIntentById', 'commitIntent'].every((name) => typeof intentLedger[name] === 'function')) {
    throw new TypeError('intentLedger must implement findStartSnapshot, findIntentByStart, findIntentById and commitIntent');
  }

  function recordIntent({ effectInvocationIntentId, executionStartId,
    expectedStartRevision, expectedAttemptRevision, expectedClaimRevision,
    expectedAdapterRegistrationRevision, expectedOwnerIdentityRevision } = {}) {
    const request = { effectInvocationIntentId, executionStartId };
    if (![effectInvocationIntentId, executionStartId,
      expectedAdapterRegistrationRevision, expectedOwnerIdentityRevision].every(nonEmptyString)
      || ![expectedStartRevision, expectedAttemptRevision,
        expectedClaimRevision].every(Number.isInteger)) {
      return rejected('intent, Start and exact expected revisions are required');
    }

    let byId;
    let byStart;
    try {
      byId = intentLedger.findIntentById(effectInvocationIntentId);
      byStart = intentLedger.findIntentByStart(executionStartId);
    } catch (_) {
      return result(EFFECT_INTENT_OUTCOMES.INTENT_UNCERTAIN, 'intent ledger is unavailable');
    }
    if (!Array.isArray(byId) || byId.length > 1
      || !Array.isArray(byStart) || byStart.length > 1) {
      return result(EFFECT_INTENT_OUTCOMES.INTENT_UNCERTAIN,
        'intent ledger contains conflicting or corrupt evidence');
    }
    if (byId.length === 1) {
      const existing = byId[0];
      if (!coherentIntent(existing) || !intentMatchesRequest(existing, request)
        || !byStart.some((entry) => sameValue(entry, existing))) {
        return rejected('intent identity is already bound to another Start');
      }
      return result(EFFECT_INTENT_OUTCOMES.ALREADY_RECORDED, null, existing);
    }
    if (byStart.length === 1) {
      const existing = byStart[0];
      if (!coherentIntent(existing) || existing.executionStartId !== executionStartId) {
        return result(EFFECT_INTENT_OUTCOMES.INTENT_UNCERTAIN,
          'existing intent evidence is invalid or conflicting');
      }
      return result(EFFECT_INTENT_OUTCOMES.INTENT_ALREADY_EXISTS,
        'Start already has an authoritative effect invocation intent', existing);
    }

    let rawSnapshot;
    try { rawSnapshot = intentLedger.findStartSnapshot(executionStartId); } catch (_) {
      return result(EFFECT_INTENT_OUTCOMES.INTENT_UNCERTAIN,
        'authoritative Start snapshot is unavailable');
    }
    if (rawSnapshot === null || rawSnapshot === undefined) {
      return result(EFFECT_INTENT_OUTCOMES.START_NOT_FOUND,
        'authoritative EXECUTION_ATTEMPT_STARTED evidence is absent');
    }
    const snapshot = coherentSnapshot(rawSnapshot, executionStartId);
    if (!snapshot) return invalid('authoritative Start snapshot is invalid or incoherent');
    const start = snapshot.record;

    if (start.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT') {
      return result(EFFECT_INTENT_OUTCOMES.BRANCH_MISMATCH,
        'NO_EXTERNAL_EFFECT cannot create effect invocation intent');
    }
    if (!EFFECT_CAPABLE_CLASSES.includes(start.effectIdempotencyClass)
      || !nonEmptyString(start.logicalEffectId)) {
      return result(EFFECT_INTENT_OUTCOMES.START_NOT_ELIGIBLE,
        'Start does not contain an eligible frozen effect-capable contract');
    }
    if (!snapshot.currentClaim) {
      return result(EFFECT_INTENT_OUTCOMES.CLAIM_NOT_CURRENT,
        'Start Claim is no longer the exact current governed owner');
    }
    if (!snapshot.adapterRegistrationCurrent || !snapshot.adapterRegistrationEnabled
      || !snapshot.ownerIdentityCurrent) {
      return result(EFFECT_INTENT_OUTCOMES.ADAPTER_NOT_CURRENT,
        'adapter registration or trusted owner is not current');
    }
    if (snapshot.conflictingLifecycleEvidence || snapshot.invocationStatusUnknown
      || snapshot.effectPossiblyOccurred || snapshot.terminalLifecycleEvidence) {
      return result(EFFECT_INTENT_OUTCOMES.START_NOT_ELIGIBLE,
        'conflicting invocation, effect or terminal lifecycle evidence exists');
    }
    if (start.startRevision !== expectedStartRevision
      || start.attemptRevision !== expectedAttemptRevision
      || start.claimRevision !== expectedClaimRevision
      || start.adapterRegistrationRevision !== expectedAdapterRegistrationRevision
      || start.ownerIdentityRevision !== expectedOwnerIdentityRevision) {
      return result(EFFECT_INTENT_OUTCOMES.INTENT_STALE,
        'expected Start, attempt, Claim, adapter or owner revision is stale');
    }
    if ([executionStartId, start.executionAttemptId, start.attemptClaimId,
      start.logicalEffectId].includes(effectInvocationIntentId)) {
      return rejected('intent identity must differ from Start, attempt, Claim and logical effect identities');
    }

    const record = Object.freeze({
      type: 'EFFECT_INVOCATION_INTENT', status: 'EFFECT_INVOCATION_INTENT',
      effectInvocationIntentId, intentRevision: 1,
      startEvidenceRef: snapshot.evidenceRef, executionStartId: start.executionStartId,
      startRevision: start.startRevision, executionAttemptId: start.executionAttemptId,
      attemptClaimId: start.attemptClaimId, attemptEvidenceRef: start.attemptEvidenceRef,
      attemptRevision: start.attemptRevision, claimEvidenceRef: start.claimEvidenceRef,
      claimRevision: start.claimRevision, claimHistoryRevision: start.claimHistoryRevision,
      executionId: start.executionId, executionAcceptanceId: start.executionAcceptanceId,
      preparationEvidenceRef: start.preparationEvidenceRef,
      preparationRevision: start.preparationRevision, dispatchId: start.dispatchId,
      continuationId: start.continuationId, interactionId: start.interactionId,
      gateId: start.gateId, gateRevision: start.gateRevision,
      authorityEvidenceRef: start.authorityEvidenceRef,
      governanceEvaluationRef: start.governanceEvaluationRef,
      authorityScope: clone(start.authorityScope),
      adapterRegistrationEvidenceRef: start.adapterRegistrationEvidenceRef,
      adapterRegistrationIdentity: start.adapterRegistrationIdentity,
      adapterRegistrationRevision: start.adapterRegistrationRevision,
      adapterIdentity: start.adapterIdentity, adapterRevision: start.adapterRevision,
      attemptOwnerIdentity: start.attemptOwnerIdentity,
      ownerIdentityEvidenceRef: start.ownerIdentityEvidenceRef,
      ownerIdentityRevision: start.ownerIdentityRevision,
      compatibilityEvidenceRef: start.compatibilityEvidenceRef,
      actionIdentity: start.actionIdentity, actionRevision: start.actionRevision,
      continuationTargetRef: start.continuationTargetRef,
      executionOwnerIdentity: start.executionOwnerIdentity, inputRef: start.inputRef,
      verifiedInputDigest: start.verifiedInputDigest,
      verifiedInputEvidenceRef: start.verifiedInputEvidenceRef,
      effectContractRef: start.effectContractRef,
      effectContractRevision: start.effectContractRevision,
      effectIdempotencyClass: start.effectIdempotencyClass,
      logicalEffectId: start.logicalEffectId,
      resultEvidenceGrammarRef: start.resultEvidenceGrammarRef,
      resultEvidenceGrammarRevision: start.resultEvidenceGrammarRevision,
      invocationOccurred: 'UNKNOWN', singleIntentForStart: true
    });

    const guards = Object.freeze({
      startGuard: Object.freeze({ evidenceRef: snapshot.evidenceRef,
        executionStartId, startRevision: start.startRevision,
        executionAttemptId: start.executionAttemptId,
        attemptRevision: start.attemptRevision, attemptClaimId: start.attemptClaimId,
        claimRevision: start.claimRevision, currentClaim: true }),
      adapterGuard: Object.freeze({
        registrationIdentity: start.adapterRegistrationIdentity,
        registrationRevision: start.adapterRegistrationRevision,
        adapterIdentity: start.adapterIdentity, adapterRevision: start.adapterRevision,
        enabled: true, current: true }),
      ownerGuard: Object.freeze({ attemptOwnerIdentity: start.attemptOwnerIdentity,
        evidenceRef: start.ownerIdentityEvidenceRef,
        identityRevision: start.ownerIdentityRevision, current: true }),
      contractGuard: Object.freeze({ verifiedInputDigest: start.verifiedInputDigest,
        effectContractRevision: start.effectContractRevision,
        effectIdempotencyClass: start.effectIdempotencyClass,
        logicalEffectId: start.logicalEffectId,
        resultEvidenceGrammarRevision: start.resultEvidenceGrammarRevision }),
      lifecycleGuard: Object.freeze({ noPriorIntent: true,
        noConflictingInvocationEvidence: true, noPossibleEffectEvidence: true,
        noTerminalLifecycleEvidence: true })
    });

    try {
      const committed = intentLedger.commitIntent(clone(record), guards);
      if (!coherentIntent(committed) || !sameValue(committed, record)) {
        return result(EFFECT_INTENT_OUTCOMES.INTENT_UNCERTAIN,
          'atomic ledger returned inconsistent intent evidence');
      }
      return result(EFFECT_INTENT_OUTCOMES.EFFECT_INVOCATION_INTENT_RECORDED,
        null, committed);
    } catch (error) {
      let recovered = null;
      try {
        const matches = intentLedger.findIntentById(effectInvocationIntentId);
        recovered = Array.isArray(matches) && matches.length === 1 ? matches[0] : null;
      } catch (_) { recovered = null; }
      if (recovered && coherentIntent(recovered) && sameValue(recovered, record)) {
        return result(EFFECT_INTENT_OUTCOMES.ALREADY_RECORDED, null, recovered);
      }
      const mapped = error && ({ INTENT_STALE: EFFECT_INTENT_OUTCOMES.INTENT_STALE,
        CLAIM_NOT_CURRENT: EFFECT_INTENT_OUTCOMES.CLAIM_NOT_CURRENT,
        ADAPTER_NOT_CURRENT: EFFECT_INTENT_OUTCOMES.ADAPTER_NOT_CURRENT,
        INTENT_ALREADY_EXISTS: EFFECT_INTENT_OUTCOMES.INTENT_ALREADY_EXISTS,
        START_NOT_ELIGIBLE: EFFECT_INTENT_OUTCOMES.START_NOT_ELIGIBLE })[error.code];
      return mapped ? result(mapped, 'atomic intent guard changed before commit')
        : result(EFFECT_INTENT_OUTCOMES.INTENT_UNCERTAIN,
          'atomic intent persistence is uncertain; effect crossing is blocked');
    }
  }

  return Object.freeze({ recordIntent });
}

module.exports = { EFFECT_INTENT_OUTCOMES, createGovernedEffectInvocationIntent };
