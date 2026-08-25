'use strict';

const CLAIM_OUTCOMES = Object.freeze({
  ATTEMPT_CLAIMED: 'ATTEMPT_CLAIMED',
  ALREADY_CLAIMED: 'ALREADY_CLAIMED',
  ATTEMPT_NOT_FOUND: 'ATTEMPT_NOT_FOUND',
  ATTEMPT_NOT_CLAIMABLE: 'ATTEMPT_NOT_CLAIMABLE',
  ACTIVE_CLAIM_EXISTS: 'ACTIVE_CLAIM_EXISTS',
  ADAPTER_NOT_REGISTERED: 'ADAPTER_NOT_REGISTERED',
  ADAPTER_INCOMPATIBLE: 'ADAPTER_INCOMPATIBLE',
  CLAIM_STALE: 'CLAIM_STALE',
  INVALID_ATTEMPT: 'INVALID_ATTEMPT',
  CLAIM_REJECTED: 'CLAIM_REJECTED',
  CLAIM_UNCERTAIN: 'CLAIM_UNCERTAIN'
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

function outcome(type, reason = null, claim = null) {
  return Object.freeze({ outcome: type, reason, claim: clone(claim) });
}

function rejected(reason) {
  return outcome(CLAIM_OUTCOMES.CLAIM_REJECTED, reason);
}

function invalid(reason) {
  return outcome(CLAIM_OUTCOMES.INVALID_ATTEMPT, reason);
}

function coherentAttemptSnapshot(snapshot, executionAttemptId) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record) return null;
  const record = snapshot.record;
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
  if (record.type !== 'EXECUTION_ATTEMPT'
    || record.status !== 'ATTEMPT_CREATED'
    || record.executionAttemptId !== executionAttemptId
    || record.singlePhysicalAttemptIdentity !== true
    || record.claimStatus !== 'UNCLAIMED'
    || !Number.isInteger(record.attemptRevision)
    || !Number.isInteger(record.attemptOrdinal)
    || !Number.isInteger(record.preparationRevision)
    || !Number.isInteger(record.gateRevision)
    || record.authorityScope === undefined
    || requiredStrings.some((name) => !nonEmptyString(record[name]))
    || !EFFECT_CLASSES.includes(record.effectIdempotencyClass)
    || (record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
      ? record.logicalEffectId !== null : !nonEmptyString(record.logicalEffectId))) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(record) });
}

function coherentRegistration(snapshot, expectedRef, attempt) {
  if (!snapshot || snapshot.evidenceRef !== expectedRef || !snapshot.record) return null;
  const registration = snapshot.record;
  const requiredStrings = [
    'registrationIdentity', 'registrationRevision', 'adapterIdentity', 'adapterRevision',
    'actionIdentity', 'actionRevision', 'continuationTargetRef',
    'executionOwnerIdentity', 'inputContractRef', 'effectContractRef',
    'effectContractRevision', 'effectIdempotencyClass', 'resultEvidenceGrammarRef',
    'resultEvidenceGrammarRevision', 'logicalEffectIdentityHandling'
  ];
  if (registration.type !== 'EXECUTION_ADAPTER_REGISTRATION'
    || registration.status !== 'REGISTERED'
    || registration.enabled !== true
    || registration.claimOwnershipCapability !== true
    || registration.acceptedAuthorityScopeContract === undefined
    || requiredStrings.some((name) => !nonEmptyString(registration[name]))) return null;
  const exact = registration.actionIdentity === attempt.actionIdentity
    && registration.actionRevision === attempt.actionRevision
    && registration.continuationTargetRef === attempt.continuationTargetRef
    && registration.executionOwnerIdentity === attempt.executionOwnerIdentity
    && registration.effectContractRef === attempt.effectContractRef
    && registration.effectContractRevision === attempt.effectContractRevision
    && registration.effectIdempotencyClass === attempt.effectIdempotencyClass
    && registration.resultEvidenceGrammarRef === attempt.resultEvidenceGrammarRef
    && registration.resultEvidenceGrammarRevision === attempt.resultEvidenceGrammarRevision;
  return exact ? Object.freeze({ evidenceRef: snapshot.evidenceRef,
    record: clone(registration) }) : null;
}

function coherentOwner(snapshot, ownerIdentity) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record) return null;
  const owner = snapshot.record;
  if (owner.type !== 'ATTEMPT_OWNER_IDENTITY'
    || owner.status !== 'CURRENT'
    || owner.attemptOwnerIdentity !== ownerIdentity
    || !nonEmptyString(owner.identityRevision)) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(owner) });
}

function coherentClaim(record) {
  const requiredStrings = [
    'attemptClaimId', 'executionAttemptId', 'attemptEvidenceRef', 'executionId',
    'executionAcceptanceId', 'preparationEvidenceRef', 'dispatchId', 'continuationId',
    'interactionId', 'gateId', 'actionIdentity', 'actionRevision',
    'continuationTargetRef', 'executionOwnerIdentity', 'inputRef',
    'verifiedInputDigest', 'verifiedInputEvidenceRef', 'effectContractRef',
    'effectContractRevision', 'effectIdempotencyClass', 'resultEvidenceGrammarRef',
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
    && record.authorityScope !== undefined
    && requiredStrings.every((name) => nonEmptyString(record[name]))
    && (record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
      ? record.logicalEffectId === null : nonEmptyString(record.logicalEffectId)));
}

function claimMatchesAttempt(claim, snapshot) {
  const attempt = snapshot.record;
  return claim.attemptEvidenceRef === snapshot.evidenceRef
    && claim.executionAttemptId === attempt.executionAttemptId
    && claim.attemptRevision === attempt.attemptRevision
    && claim.executionId === attempt.executionId
    && claim.executionAcceptanceId === attempt.executionAcceptanceId
    && claim.preparationEvidenceRef === attempt.preparationEvidenceRef
    && claim.dispatchId === attempt.dispatchId
    && claim.actionIdentity === attempt.actionIdentity
    && claim.actionRevision === attempt.actionRevision
    && claim.continuationTargetRef === attempt.continuationTargetRef
    && sameValue(claim.authorityScope, attempt.authorityScope)
    && claim.executionOwnerIdentity === attempt.executionOwnerIdentity
    && claim.inputRef === attempt.inputRef
    && claim.verifiedInputDigest === attempt.verifiedInputDigest
    && claim.effectContractRef === attempt.effectContractRef
    && claim.effectContractRevision === attempt.effectContractRevision
    && claim.effectIdempotencyClass === attempt.effectIdempotencyClass
    && claim.logicalEffectId === attempt.logicalEffectId
    && claim.resultEvidenceGrammarRef === attempt.resultEvidenceGrammarRef
    && claim.resultEvidenceGrammarRevision === attempt.resultEvidenceGrammarRevision;
}

function orderClaimHistory(records, executionAttemptId) {
  if (!Array.isArray(records)) return null;
  const ordered = records.map(clone).sort((a, b) => a.claimOrdinal - b.claimOrdinal);
  for (let index = 0; index < ordered.length; index += 1) {
    const claim = ordered[index];
    const previous = ordered[index - 1] || null;
    if (!coherentClaim(claim)
      || claim.executionAttemptId !== executionAttemptId
      || claim.claimOrdinal !== index + 1
      || claim.previousAttemptClaimId !== (previous && previous.attemptClaimId)
      || (index === 0 && claim.reassignmentEligibilityEvidenceRef !== null)) return null;
  }
  return ordered;
}

function coherentReassignment(snapshot, attempt, previous, expectedRef) {
  if (!snapshot || snapshot.evidenceRef !== expectedRef || !snapshot.record) return null;
  const record = snapshot.record;
  if (record.type !== 'CLAIM_REASSIGNMENT_ELIGIBILITY'
    || record.status !== 'REASSIGNMENT_ELIGIBLE'
    || record.executionAttemptId !== attempt.executionAttemptId
    || record.previousAttemptClaimId !== previous.attemptClaimId
    || record.previousClaimRevision !== previous.claimRevision
    || !['RELEASED', 'STALE', 'REVOKED'].includes(record.previousOwnershipState)
    || record.startStatus !== 'NOT_STARTED_PROVEN'
    || record.effectStatus !== 'NO_EFFECT_PROVEN'
    || !nonEmptyString(record.lifecycleEvidenceRef)
    || !Number.isInteger(record.reassignmentEligibilityRevision)) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(record) });
}

function createGovernedExecutionAttemptClaim({
  adapterRegistrationPort,
  ownerIdentityPort,
  scopeCompatibilityPort,
  reassignmentEligibilityPort,
  claimLedger
}) {
  for (const [name, port] of Object.entries({ adapterRegistrationPort,
    ownerIdentityPort, scopeCompatibilityPort, reassignmentEligibilityPort })) {
    if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  }
  if (!claimLedger || !['findAttemptSnapshot', 'findClaimsByAttempt', 'findClaimById', 'commitClaim']
    .every((name) => typeof claimLedger[name] === 'function')) {
    throw new TypeError('claimLedger must implement findAttemptSnapshot, findClaimsByAttempt, findClaimById and commitClaim');
  }

  function claim({ executionAttemptId, attemptClaimId, adapterRegistrationEvidenceRef,
    attemptOwnerIdentity, expectedAttemptRevision, reassignmentEligibilityEvidenceRef = null } = {}) {
    if (![executionAttemptId, attemptClaimId, adapterRegistrationEvidenceRef, attemptOwnerIdentity]
      .every(nonEmptyString) || !Number.isInteger(expectedAttemptRevision)) {
      return rejected('attempt, claim, registration, owner and expected revision are required');
    }
    if (executionAttemptId === attemptClaimId) return rejected('claim identity must differ from attempt identity');

    let rawAttempt;
    try { rawAttempt = claimLedger.findAttemptSnapshot(executionAttemptId); } catch (_) {
      return outcome(CLAIM_OUTCOMES.CLAIM_UNCERTAIN, 'authoritative attempt is unavailable');
    }
    if (rawAttempt === null || rawAttempt === undefined) {
      return outcome(CLAIM_OUTCOMES.ATTEMPT_NOT_FOUND, 'authoritative ATTEMPT_CREATED evidence is absent');
    }
    const snapshot = coherentAttemptSnapshot(rawAttempt, executionAttemptId);
    if (!snapshot) return invalid('authoritative attempt is invalid or incoherent');
    const attempt = snapshot.record;
    if (attempt.attemptRevision !== expectedAttemptRevision) {
      return outcome(CLAIM_OUTCOMES.CLAIM_STALE, 'expected attempt revision is stale');
    }

    let historyRaw;
    let byId;
    try {
      historyRaw = claimLedger.findClaimsByAttempt(executionAttemptId);
      byId = claimLedger.findClaimById(attemptClaimId);
    } catch (_) {
      return outcome(CLAIM_OUTCOMES.CLAIM_UNCERTAIN, 'claim ledger is unavailable');
    }
    const history = orderClaimHistory(historyRaw, executionAttemptId);
    if (!history || !Array.isArray(byId) || byId.length > 1) {
      return invalid('claim ledger contains corrupt or conflicting evidence');
    }
    if (byId.length === 1) {
      const existing = byId[0];
      if (!coherentClaim(existing) || existing.executionAttemptId !== executionAttemptId
        || !claimMatchesAttempt(existing, snapshot)
        || !history.some((item) => sameValue(item, existing))) {
        return rejected('claim identity is already bound to another or conflicting attempt');
      }
      if (existing.attemptOwnerIdentity !== attemptOwnerIdentity
        || existing.adapterRegistrationEvidenceRef !== adapterRegistrationEvidenceRef) {
        return rejected('claim identity cannot change owner or adapter');
      }
      return outcome(CLAIM_OUTCOMES.ALREADY_CLAIMED, null, existing);
    }

    let rawRegistration;
    try { rawRegistration = adapterRegistrationPort(adapterRegistrationEvidenceRef); } catch (_) {
      return outcome(CLAIM_OUTCOMES.CLAIM_UNCERTAIN, 'adapter registration is unavailable');
    }
    if (rawRegistration === null || rawRegistration === undefined) {
      return outcome(CLAIM_OUTCOMES.ADAPTER_NOT_REGISTERED, 'exact adapter registration is absent');
    }
    const registration = coherentRegistration(rawRegistration,
      adapterRegistrationEvidenceRef, attempt);
    if (!registration) {
      return outcome(CLAIM_OUTCOMES.ADAPTER_INCOMPATIBLE,
        'adapter registration is disabled, stale, ambiguous or incompatible');
    }

    let owner;
    try { owner = coherentOwner(ownerIdentityPort(attemptOwnerIdentity), attemptOwnerIdentity); } catch (_) {
      return outcome(CLAIM_OUTCOMES.CLAIM_UNCERTAIN, 'attempt owner identity is unavailable');
    }
    if (!owner) return rejected('attempt owner identity is invalid or not current');

    let compatibility;
    try {
      compatibility = scopeCompatibilityPort(Object.freeze({
        authorityScope: clone(attempt.authorityScope),
        acceptedAuthorityScopeContract: clone(registration.record.acceptedAuthorityScopeContract),
        inputRef: attempt.inputRef,
        verifiedInputDigest: attempt.verifiedInputDigest,
        inputContractRef: registration.record.inputContractRef,
        logicalEffectId: attempt.logicalEffectId,
        logicalEffectIdentityHandling: registration.record.logicalEffectIdentityHandling
      }));
    } catch (_) {
      return outcome(CLAIM_OUTCOMES.CLAIM_UNCERTAIN, 'compatibility verification is unavailable');
    }
    if (!compatibility || compatibility.compatible !== true
      || !nonEmptyString(compatibility.evidenceRef)) {
      return outcome(CLAIM_OUTCOMES.ADAPTER_INCOMPATIBLE,
        'exact scope, input or logical-effect compatibility is not established');
    }

    const previous = history[history.length - 1] || null;
    let reassignment = null;
    if (previous) {
      if (previous.ownershipState === 'ACTIVE' || previous.ownershipState === 'UNCERTAIN') {
        return outcome(CLAIM_OUTCOMES.ACTIVE_CLAIM_EXISTS,
          'an active or uncertain claim must be recovered, not replaced');
      }
      if (!nonEmptyString(reassignmentEligibilityEvidenceRef)) {
        return outcome(CLAIM_OUTCOMES.ATTEMPT_NOT_CLAIMABLE,
          'reassignment requires exact authoritative lifecycle evidence');
      }
      let rawReassignment;
      try { rawReassignment = reassignmentEligibilityPort(reassignmentEligibilityEvidenceRef); } catch (_) {
        return outcome(CLAIM_OUTCOMES.CLAIM_UNCERTAIN,
          'reassignment eligibility evidence is unavailable');
      }
      reassignment = coherentReassignment(rawReassignment, attempt, previous,
        reassignmentEligibilityEvidenceRef);
      if (!reassignment) {
        return outcome(CLAIM_OUTCOMES.ATTEMPT_NOT_CLAIMABLE,
          'claim release, expiry or owner loss does not prove safe reassignment');
      }
    } else if (reassignmentEligibilityEvidenceRef !== null) {
      return rejected('first claim cannot consume reassignment evidence');
    }

    const record = Object.freeze({
      type: 'EXECUTION_ATTEMPT_CLAIM', status: 'ATTEMPT_CLAIMED',
      attemptClaimId, claimRevision: 1, claimOrdinal: history.length + 1,
      previousAttemptClaimId: previous ? previous.attemptClaimId : null,
      executionAttemptId, attemptEvidenceRef: snapshot.evidenceRef,
      attemptRevision: attempt.attemptRevision, executionId: attempt.executionId,
      executionAcceptanceId: attempt.executionAcceptanceId,
      preparationEvidenceRef: attempt.preparationEvidenceRef,
      preparationRevision: attempt.preparationRevision, dispatchId: attempt.dispatchId,
      continuationId: attempt.continuationId, interactionId: attempt.interactionId,
      gateId: attempt.gateId, gateRevision: attempt.gateRevision,
      authorityEvidenceRef: attempt.authorityEvidenceRef,
      governanceEvaluationRef: attempt.governanceEvaluationRef,
      authorityScope: clone(attempt.authorityScope), actionIdentity: attempt.actionIdentity,
      actionRevision: attempt.actionRevision,
      continuationTargetRef: attempt.continuationTargetRef,
      executionOwnerIdentity: attempt.executionOwnerIdentity, inputRef: attempt.inputRef,
      verifiedInputDigest: attempt.verifiedInputDigest,
      verifiedInputEvidenceRef: attempt.verifiedInputEvidenceRef,
      effectContractRef: attempt.effectContractRef,
      effectContractRevision: attempt.effectContractRevision,
      effectIdempotencyClass: attempt.effectIdempotencyClass,
      logicalEffectId: attempt.logicalEffectId,
      resultEvidenceGrammarRef: attempt.resultEvidenceGrammarRef,
      resultEvidenceGrammarRevision: attempt.resultEvidenceGrammarRevision,
      adapterRegistrationEvidenceRef: registration.evidenceRef,
      adapterRegistrationIdentity: registration.record.registrationIdentity,
      adapterRegistrationRevision: registration.record.registrationRevision,
      adapterIdentity: registration.record.adapterIdentity,
      adapterRevision: registration.record.adapterRevision,
      attemptOwnerIdentity, ownerIdentityEvidenceRef: owner.evidenceRef,
      ownerIdentityRevision: owner.record.identityRevision,
      compatibilityEvidenceRef: compatibility.evidenceRef,
      reassignmentEligibilityEvidenceRef: reassignment ? reassignment.evidenceRef : null,
      exclusiveOwnership: true, ownershipState: 'ACTIVE'
    });

    const guards = Object.freeze({
      attemptGuard: Object.freeze({ evidenceRef: snapshot.evidenceRef,
        attemptRevision: attempt.attemptRevision, claimStatus: 'UNCLAIMED' }),
      historyGuard: Object.freeze({ historyRevision: history.length,
        noActiveCompetingClaim: true,
        previousAttemptClaimId: previous ? previous.attemptClaimId : null }),
      registrationGuard: Object.freeze({ evidenceRef: registration.evidenceRef,
        registrationIdentity: registration.record.registrationIdentity,
        registrationRevision: registration.record.registrationRevision, enabled: true }),
      ownerGuard: Object.freeze({ evidenceRef: owner.evidenceRef,
        attemptOwnerIdentity, identityRevision: owner.record.identityRevision }),
      compatibilityGuard: Object.freeze({ evidenceRef: compatibility.evidenceRef }),
      reassignmentGuard: reassignment ? Object.freeze({ evidenceRef: reassignment.evidenceRef,
        reassignmentEligibilityRevision: reassignment.record.reassignmentEligibilityRevision }) : null
    });

    try {
      const committed = claimLedger.commitClaim(clone(record), guards);
      if (!coherentClaim(committed) || !sameValue(committed, record)) {
        return outcome(CLAIM_OUTCOMES.CLAIM_UNCERTAIN,
          'atomic ledger returned inconsistent claim evidence');
      }
      return outcome(CLAIM_OUTCOMES.ATTEMPT_CLAIMED, null, committed);
    } catch (error) {
      let recovered = null;
      try {
        const matches = claimLedger.findClaimById(attemptClaimId);
        recovered = Array.isArray(matches) && matches.length === 1 ? matches[0] : null;
      } catch (_) { recovered = null; }
      if (recovered && coherentClaim(recovered) && sameValue(recovered, record)) {
        return outcome(CLAIM_OUTCOMES.ALREADY_CLAIMED, null, recovered);
      }
      const mapped = error && ({ CLAIM_STALE: CLAIM_OUTCOMES.CLAIM_STALE,
        ACTIVE_CLAIM_EXISTS: CLAIM_OUTCOMES.ACTIVE_CLAIM_EXISTS,
        ADAPTER_INCOMPATIBLE: CLAIM_OUTCOMES.ADAPTER_INCOMPATIBLE,
        ATTEMPT_NOT_CLAIMABLE: CLAIM_OUTCOMES.ATTEMPT_NOT_CLAIMABLE })[error.code];
      return mapped ? outcome(mapped, 'atomic claim guard changed before commit')
        : outcome(CLAIM_OUTCOMES.CLAIM_UNCERTAIN, 'atomic claim persistence is uncertain');
    }
  }

  return Object.freeze({ claim });
}

module.exports = { CLAIM_OUTCOMES, CLAIM_STATES, createGovernedExecutionAttemptClaim };
