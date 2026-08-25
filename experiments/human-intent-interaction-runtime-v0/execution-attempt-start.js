'use strict';

const START_OUTCOMES = Object.freeze({
  EXECUTION_ATTEMPT_STARTED: 'EXECUTION_ATTEMPT_STARTED',
  ALREADY_STARTED: 'ALREADY_STARTED',
  CLAIM_NOT_FOUND: 'CLAIM_NOT_FOUND',
  CLAIM_NOT_CURRENT: 'CLAIM_NOT_CURRENT',
  CLAIM_NOT_ACTIVE: 'CLAIM_NOT_ACTIVE',
  START_ALREADY_EXISTS: 'START_ALREADY_EXISTS',
  START_STALE: 'START_STALE',
  INVALID_CLAIM: 'INVALID_CLAIM',
  START_REJECTED: 'START_REJECTED',
  START_UNCERTAIN: 'START_UNCERTAIN'
});

const CLAIM_STATES = Object.freeze(['ACTIVE', 'RELEASED', 'STALE', 'REVOKED', 'UNCERTAIN']);
const EFFECT_CLASSES = Object.freeze([
  'NO_EXTERNAL_EFFECT', 'IDEMPOTENT_WITH_STABLE_KEY', 'NON_IDEMPOTENT'
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

function result(outcome, reason = null, start = null) {
  return Object.freeze({ outcome, reason, start: clone(start) });
}

function rejected(reason) {
  return result(START_OUTCOMES.START_REJECTED, reason);
}

function invalid(reason) {
  return result(START_OUTCOMES.INVALID_CLAIM, reason);
}

function coherentClaim(record) {
  const requiredStrings = [
    'attemptClaimId', 'executionAttemptId', 'attemptEvidenceRef', 'executionId',
    'executionAcceptanceId', 'preparationEvidenceRef', 'dispatchId', 'continuationId',
    'interactionId', 'gateId', 'authorityEvidenceRef', 'governanceEvaluationRef',
    'actionIdentity', 'actionRevision', 'continuationTargetRef',
    'executionOwnerIdentity', 'inputRef', 'verifiedInputDigest',
    'verifiedInputEvidenceRef', 'effectContractRef', 'effectContractRevision',
    'effectIdempotencyClass', 'resultEvidenceGrammarRef',
    'resultEvidenceGrammarRevision', 'adapterRegistrationEvidenceRef',
    'adapterRegistrationIdentity', 'adapterRegistrationRevision', 'adapterIdentity',
    'adapterRevision', 'attemptOwnerIdentity', 'ownerIdentityEvidenceRef',
    'ownerIdentityRevision', 'compatibilityEvidenceRef'
  ];
  return Boolean(record
    && record.type === 'EXECUTION_ATTEMPT_CLAIM'
    && record.status === 'ATTEMPT_CLAIMED'
    && CLAIM_STATES.includes(record.ownershipState)
    && record.exclusiveOwnership === true
    && Number.isInteger(record.claimRevision)
    && Number.isInteger(record.claimOrdinal)
    && Number.isInteger(record.attemptRevision)
    && Number.isInteger(record.preparationRevision)
    && Number.isInteger(record.gateRevision)
    && record.authorityScope !== undefined
    && requiredStrings.every((name) => nonEmptyString(record[name]))
    && EFFECT_CLASSES.includes(record.effectIdempotencyClass)
    && (record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
      ? record.logicalEffectId === null : nonEmptyString(record.logicalEffectId)));
}

function coherentClaimSnapshot(snapshot, attemptClaimId) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record
    || !Number.isInteger(snapshot.claimHistoryRevision)
    || !nonEmptyString(snapshot.currentClaimId)
    || typeof snapshot.competingActiveClaim !== 'boolean'
    || typeof snapshot.uncertainClaimHistory !== 'boolean'
    || typeof snapshot.conflictingLifecycleEvidence !== 'boolean'
    || typeof snapshot.adapterRegistrationCurrent !== 'boolean'
    || typeof snapshot.ownerIdentityCurrent !== 'boolean') return null;
  if (!coherentClaim(snapshot.record) || snapshot.record.attemptClaimId !== attemptClaimId) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef,
    claimHistoryRevision: snapshot.claimHistoryRevision,
    currentClaimId: snapshot.currentClaimId,
    competingActiveClaim: snapshot.competingActiveClaim,
    uncertainClaimHistory: snapshot.uncertainClaimHistory,
    conflictingLifecycleEvidence: snapshot.conflictingLifecycleEvidence,
    adapterRegistrationCurrent: snapshot.adapterRegistrationCurrent,
    ownerIdentityCurrent: snapshot.ownerIdentityCurrent,
    record: clone(snapshot.record) });
}

function coherentStart(record) {
  const requiredStrings = [
    'executionStartId', 'executionAttemptId', 'attemptClaimId', 'attemptEvidenceRef',
    'claimEvidenceRef', 'executionId', 'executionAcceptanceId',
    'preparationEvidenceRef', 'dispatchId', 'continuationId', 'interactionId',
    'gateId', 'authorityEvidenceRef', 'governanceEvaluationRef', 'actionIdentity',
    'actionRevision', 'continuationTargetRef', 'executionOwnerIdentity', 'inputRef',
    'verifiedInputDigest', 'verifiedInputEvidenceRef', 'effectContractRef',
    'effectContractRevision', 'effectIdempotencyClass', 'resultEvidenceGrammarRef',
    'resultEvidenceGrammarRevision', 'adapterRegistrationEvidenceRef',
    'adapterRegistrationIdentity', 'adapterRegistrationRevision', 'adapterIdentity',
    'adapterRevision', 'attemptOwnerIdentity', 'ownerIdentityEvidenceRef',
    'ownerIdentityRevision', 'compatibilityEvidenceRef'
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
    && record.authorityScope !== undefined
    && requiredStrings.every((name) => nonEmptyString(record[name]))
    && (record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
      ? record.logicalEffectId === null : nonEmptyString(record.logicalEffectId)));
}

function startMatchesRequest(start, request) {
  return start.executionStartId === request.executionStartId
    && start.executionAttemptId === request.executionAttemptId
    && start.attemptClaimId === request.attemptClaimId;
}

function startMatchesClaim(start, snapshot) {
  const claim = snapshot.record;
  return start.claimEvidenceRef === snapshot.evidenceRef
    && start.claimRevision === claim.claimRevision
    && start.claimHistoryRevision === snapshot.claimHistoryRevision
    && start.executionAttemptId === claim.executionAttemptId
    && start.attemptClaimId === claim.attemptClaimId
    && start.attemptEvidenceRef === claim.attemptEvidenceRef
    && start.attemptRevision === claim.attemptRevision
    && start.executionId === claim.executionId
    && start.executionAcceptanceId === claim.executionAcceptanceId
    && start.preparationEvidenceRef === claim.preparationEvidenceRef
    && start.dispatchId === claim.dispatchId
    && start.adapterRegistrationIdentity === claim.adapterRegistrationIdentity
    && start.adapterRegistrationRevision === claim.adapterRegistrationRevision
    && start.adapterIdentity === claim.adapterIdentity
    && start.adapterRevision === claim.adapterRevision
    && start.attemptOwnerIdentity === claim.attemptOwnerIdentity
    && start.ownerIdentityEvidenceRef === claim.ownerIdentityEvidenceRef
    && start.ownerIdentityRevision === claim.ownerIdentityRevision
    && start.actionIdentity === claim.actionIdentity
    && start.actionRevision === claim.actionRevision
    && start.continuationTargetRef === claim.continuationTargetRef
    && sameValue(start.authorityScope, claim.authorityScope)
    && start.executionOwnerIdentity === claim.executionOwnerIdentity
    && start.inputRef === claim.inputRef
    && start.verifiedInputDigest === claim.verifiedInputDigest
    && start.effectContractRef === claim.effectContractRef
    && start.effectContractRevision === claim.effectContractRevision
    && start.effectIdempotencyClass === claim.effectIdempotencyClass
    && start.logicalEffectId === claim.logicalEffectId
    && start.resultEvidenceGrammarRef === claim.resultEvidenceGrammarRef
    && start.resultEvidenceGrammarRevision === claim.resultEvidenceGrammarRevision;
}

function createGovernedExecutionAttemptStart({ startLedger }) {
  if (!startLedger || !['findClaimSnapshot', 'findStartByAttempt',
    'findStartById', 'commitStart'].every((name) => typeof startLedger[name] === 'function')) {
    throw new TypeError('startLedger must implement findClaimSnapshot, findStartByAttempt, findStartById and commitStart');
  }

  function start({ executionStartId, executionAttemptId, attemptClaimId,
    expectedClaimRevision, expectedAttemptRevision, expectedClaimHistoryRevision,
    expectedAdapterRegistrationRevision, expectedOwnerIdentityRevision } = {}) {
    const request = { executionStartId, executionAttemptId, attemptClaimId };
    if (![executionStartId, executionAttemptId, attemptClaimId,
      expectedAdapterRegistrationRevision, expectedOwnerIdentityRevision].every(nonEmptyString)
      || ![expectedClaimRevision, expectedAttemptRevision, expectedClaimHistoryRevision]
        .every(Number.isInteger)) {
      return rejected('start, attempt, claim and exact expected revisions are required');
    }
    if (new Set([executionStartId, executionAttemptId, attemptClaimId]).size !== 3) {
      return rejected('Start identity must differ from attempt and claim identities');
    }

    let byId;
    let byAttempt;
    try {
      byId = startLedger.findStartById(executionStartId);
      byAttempt = startLedger.findStartByAttempt(executionAttemptId);
    } catch (_) {
      return result(START_OUTCOMES.START_UNCERTAIN, 'Start ledger is unavailable');
    }
    if (!Array.isArray(byId) || byId.length > 1
      || !Array.isArray(byAttempt) || byAttempt.length > 1) {
      return result(START_OUTCOMES.START_UNCERTAIN,
        'Start ledger contains conflicting or corrupt evidence');
    }
    if (byId.length === 1) {
      const existing = byId[0];
      if (!coherentStart(existing) || !startMatchesRequest(existing, request)
        || !byAttempt.some((item) => sameValue(item, existing))) {
        return rejected('Start identity is already bound to another attempt or claim');
      }
      return result(START_OUTCOMES.ALREADY_STARTED, null, existing);
    }
    if (byAttempt.length === 1) {
      const existing = byAttempt[0];
      if (!coherentStart(existing) || existing.executionAttemptId !== executionAttemptId) {
        return result(START_OUTCOMES.START_UNCERTAIN,
          'existing Start evidence is invalid or conflicting');
      }
      return result(START_OUTCOMES.START_ALREADY_EXISTS,
        'physical attempt already has an authoritative Start', existing);
    }

    let rawSnapshot;
    try { rawSnapshot = startLedger.findClaimSnapshot(attemptClaimId); } catch (_) {
      return result(START_OUTCOMES.START_UNCERTAIN, 'authoritative Claim is unavailable');
    }
    if (rawSnapshot === null || rawSnapshot === undefined) {
      return result(START_OUTCOMES.CLAIM_NOT_FOUND,
        'authoritative ATTEMPT_CLAIMED evidence is absent');
    }
    const snapshot = coherentClaimSnapshot(rawSnapshot, attemptClaimId);
    if (!snapshot) return invalid('authoritative Claim snapshot is invalid or incoherent');
    const claim = snapshot.record;
    if (claim.ownershipState !== 'ACTIVE') {
      return result(START_OUTCOMES.CLAIM_NOT_ACTIVE,
        'Claim ownership is not ACTIVE');
    }
    if (snapshot.currentClaimId !== attemptClaimId || snapshot.competingActiveClaim
      || snapshot.uncertainClaimHistory || snapshot.conflictingLifecycleEvidence) {
      return result(START_OUTCOMES.CLAIM_NOT_CURRENT,
        'Claim is not the exact unambiguous current owner');
    }
    if (claim.executionAttemptId !== executionAttemptId) {
      return rejected('Claim does not bind the requested physical attempt');
    }
    if (claim.claimRevision !== expectedClaimRevision
      || claim.attemptRevision !== expectedAttemptRevision
      || snapshot.claimHistoryRevision !== expectedClaimHistoryRevision) {
      return result(START_OUTCOMES.START_STALE,
        'expected Claim, attempt or history revision is stale');
    }
    if (!snapshot.adapterRegistrationCurrent
      || claim.adapterRegistrationRevision !== expectedAdapterRegistrationRevision
      || !snapshot.ownerIdentityCurrent
      || claim.ownerIdentityRevision !== expectedOwnerIdentityRevision) {
      return result(START_OUTCOMES.START_STALE,
        'adapter registration or trusted owner identity changed before Start');
    }
    if (claim.logicalEffectId === executionStartId) {
      return rejected('Start identity must differ from logical effect identity');
    }

    const record = Object.freeze({
      type: 'EXECUTION_ATTEMPT_START', status: 'EXECUTION_ATTEMPT_STARTED',
      executionStartId, startRevision: 1,
      executionAttemptId: claim.executionAttemptId,
      attemptClaimId: claim.attemptClaimId,
      attemptEvidenceRef: claim.attemptEvidenceRef,
      attemptRevision: claim.attemptRevision,
      claimEvidenceRef: snapshot.evidenceRef,
      claimRevision: claim.claimRevision,
      claimHistoryRevision: snapshot.claimHistoryRevision,
      executionId: claim.executionId,
      executionAcceptanceId: claim.executionAcceptanceId,
      preparationEvidenceRef: claim.preparationEvidenceRef,
      preparationRevision: claim.preparationRevision,
      dispatchId: claim.dispatchId,
      continuationId: claim.continuationId,
      interactionId: claim.interactionId,
      gateId: claim.gateId,
      gateRevision: claim.gateRevision,
      authorityEvidenceRef: claim.authorityEvidenceRef,
      governanceEvaluationRef: claim.governanceEvaluationRef,
      authorityScope: clone(claim.authorityScope),
      adapterRegistrationEvidenceRef: claim.adapterRegistrationEvidenceRef,
      adapterRegistrationIdentity: claim.adapterRegistrationIdentity,
      adapterRegistrationRevision: claim.adapterRegistrationRevision,
      adapterIdentity: claim.adapterIdentity,
      adapterRevision: claim.adapterRevision,
      attemptOwnerIdentity: claim.attemptOwnerIdentity,
      ownerIdentityEvidenceRef: claim.ownerIdentityEvidenceRef,
      ownerIdentityRevision: claim.ownerIdentityRevision,
      compatibilityEvidenceRef: claim.compatibilityEvidenceRef,
      actionIdentity: claim.actionIdentity,
      actionRevision: claim.actionRevision,
      continuationTargetRef: claim.continuationTargetRef,
      executionOwnerIdentity: claim.executionOwnerIdentity,
      inputRef: claim.inputRef,
      verifiedInputDigest: claim.verifiedInputDigest,
      verifiedInputEvidenceRef: claim.verifiedInputEvidenceRef,
      effectContractRef: claim.effectContractRef,
      effectContractRevision: claim.effectContractRevision,
      effectIdempotencyClass: claim.effectIdempotencyClass,
      logicalEffectId: claim.logicalEffectId,
      resultEvidenceGrammarRef: claim.resultEvidenceGrammarRef,
      resultEvidenceGrammarRevision: claim.resultEvidenceGrammarRevision,
      executionActivityStarted: true,
      singleAuthoritativeStart: true
    });

    const guards = Object.freeze({
      claimGuard: Object.freeze({ evidenceRef: snapshot.evidenceRef,
        attemptClaimId, claimRevision: claim.claimRevision,
        ownershipState: 'ACTIVE', claimHistoryRevision: snapshot.claimHistoryRevision,
        noCompetingClaim: true, noUncertainHistory: true }),
      attemptGuard: Object.freeze({ executionAttemptId,
        attemptRevision: claim.attemptRevision }),
      registrationGuard: Object.freeze({
        registrationIdentity: claim.adapterRegistrationIdentity,
        registrationRevision: claim.adapterRegistrationRevision,
        adapterIdentity: claim.adapterIdentity, adapterRevision: claim.adapterRevision,
        current: true }),
      ownerGuard: Object.freeze({ attemptOwnerIdentity: claim.attemptOwnerIdentity,
        evidenceRef: claim.ownerIdentityEvidenceRef,
        identityRevision: claim.ownerIdentityRevision, current: true }),
      contractGuard: Object.freeze({ compatibilityEvidenceRef: claim.compatibilityEvidenceRef,
        actionRevision: claim.actionRevision,
        verifiedInputDigest: claim.verifiedInputDigest,
        effectContractRevision: claim.effectContractRevision,
        logicalEffectId: claim.logicalEffectId,
        resultEvidenceGrammarRevision: claim.resultEvidenceGrammarRevision }),
      lifecycleGuard: Object.freeze({ noPriorStart: true,
        noConflictingLifecycleEvidence: true })
    });

    try {
      const committed = startLedger.commitStart(clone(record), guards);
      if (!coherentStart(committed) || !sameValue(committed, record)) {
        return result(START_OUTCOMES.START_UNCERTAIN,
          'atomic ledger returned inconsistent Start evidence');
      }
      return result(START_OUTCOMES.EXECUTION_ATTEMPT_STARTED, null, committed);
    } catch (error) {
      let recovered = null;
      try {
        const matches = startLedger.findStartById(executionStartId);
        recovered = Array.isArray(matches) && matches.length === 1 ? matches[0] : null;
      } catch (_) { recovered = null; }
      if (recovered && coherentStart(recovered) && sameValue(recovered, record)) {
        return result(START_OUTCOMES.ALREADY_STARTED, null, recovered);
      }
      const mapped = error && ({ START_STALE: START_OUTCOMES.START_STALE,
        CLAIM_NOT_CURRENT: START_OUTCOMES.CLAIM_NOT_CURRENT,
        CLAIM_NOT_ACTIVE: START_OUTCOMES.CLAIM_NOT_ACTIVE,
        START_ALREADY_EXISTS: START_OUTCOMES.START_ALREADY_EXISTS })[error.code];
      return mapped ? result(mapped, 'atomic Start guard changed before commit')
        : result(START_OUTCOMES.START_UNCERTAIN, 'atomic Start persistence is uncertain');
    }
  }

  return Object.freeze({ start });
}

module.exports = { START_OUTCOMES, createGovernedExecutionAttemptStart };
