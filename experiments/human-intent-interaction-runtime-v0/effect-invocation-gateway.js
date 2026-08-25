'use strict';

const crypto = require('node:crypto');

const GATEWAY_OUTCOMES = Object.freeze({
  EFFECT_INVOCATION_STARTED: 'EFFECT_INVOCATION_STARTED',
  ALREADY_STARTED: 'ALREADY_STARTED',
  INTENT_NOT_FOUND: 'INTENT_NOT_FOUND',
  INTENT_NOT_ELIGIBLE: 'INTENT_NOT_ELIGIBLE',
  BRANCH_MISMATCH: 'BRANCH_MISMATCH',
  CLAIM_NOT_CURRENT: 'CLAIM_NOT_CURRENT',
  ADAPTER_NOT_CURRENT: 'ADAPTER_NOT_CURRENT',
  INVOCATION_ALREADY_EXISTS: 'INVOCATION_ALREADY_EXISTS',
  INVOCATION_STALE: 'INVOCATION_STALE',
  INVALID_INTENT: 'INVALID_INTENT',
  INVOCATION_REJECTED: 'INVOCATION_REJECTED',
  INVOCATION_RETURNED: 'INVOCATION_RETURNED',
  INVOCATION_UNCERTAIN: 'INVOCATION_UNCERTAIN'
});

const EFFECT_CAPABLE_CLASSES = Object.freeze([
  'IDEMPOTENT_WITH_STABLE_KEY', 'NON_IDEMPOTENT'
]);
const KNOWN_EFFECT_CLASSES = Object.freeze([
  'NO_EXTERNAL_EFFECT', ...EFFECT_CAPABLE_CLASSES
]);
const GATEWAY_PROTOCOL = 'governed-effect-invocation-gateway';
const GATEWAY_PROTOCOL_REVISION = '1';

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const nonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((output, key) => {
      output[key] = canonicalize(value[key]); return output;
    }, {});
  }
  return value;
}
const canonicalStringify = (value) => JSON.stringify(canonicalize(value));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function result(outcome, reason = null, invocation = null) {
  return Object.freeze({ outcome, reason, invocation: clone(invocation),
    effectAcknowledged: false, resultAccepted: false, executionCompleted: false });
}
const rejected = (reason) => result(GATEWAY_OUTCOMES.INVOCATION_REJECTED, reason);
const invalid = (reason) => result(GATEWAY_OUTCOMES.INVALID_INTENT, reason);

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
    'effectContractRevision', 'effectIdempotencyClass',
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
    && Number.isInteger(record.gateRevision)
    && record.authorityScope !== undefined
    && requiredStrings.every((name) => nonEmptyString(record[name]))
    && KNOWN_EFFECT_CLASSES.includes(record.effectIdempotencyClass)
    && (record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
      ? record.logicalEffectId === null : nonEmptyString(record.logicalEffectId)));
}

function coherentSnapshot(snapshot, effectInvocationIntentId) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record
    || typeof snapshot.currentClaim !== 'boolean'
    || typeof snapshot.adapterRegistrationCurrent !== 'boolean'
    || typeof snapshot.adapterRegistrationEnabled !== 'boolean'
    || typeof snapshot.ownerIdentityCurrent !== 'boolean'
    || typeof snapshot.conflictingLifecycleEvidence !== 'boolean'
    || typeof snapshot.invocationStatusUnknown !== 'boolean'
    || typeof snapshot.effectPossiblyOccurred !== 'boolean'
    || typeof snapshot.effectConfirmed !== 'boolean'
    || typeof snapshot.terminalLifecycleEvidence !== 'boolean') return null;
  if (!coherentIntent(snapshot.record)
    || snapshot.record.effectInvocationIntentId !== effectInvocationIntentId) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef,
    currentClaim: snapshot.currentClaim,
    adapterRegistrationCurrent: snapshot.adapterRegistrationCurrent,
    adapterRegistrationEnabled: snapshot.adapterRegistrationEnabled,
    ownerIdentityCurrent: snapshot.ownerIdentityCurrent,
    conflictingLifecycleEvidence: snapshot.conflictingLifecycleEvidence,
    invocationStatusUnknown: snapshot.invocationStatusUnknown,
    effectPossiblyOccurred: snapshot.effectPossiblyOccurred,
    effectConfirmed: snapshot.effectConfirmed,
    terminalLifecycleEvidence: snapshot.terminalLifecycleEvidence,
    record: clone(snapshot.record) });
}

function coherentInvocation(record) {
  const requiredStrings = [
    'effectInvocationId', 'effectInvocationIntentId', 'intentEvidenceRef',
    'executionStartId', 'executionAttemptId', 'attemptClaimId', 'attemptEvidenceRef',
    'claimEvidenceRef', 'executionId', 'executionAcceptanceId',
    'preparationEvidenceRef', 'dispatchId', 'continuationId', 'interactionId',
    'gateId', 'authorityEvidenceRef', 'governanceEvaluationRef',
    'adapterRegistrationEvidenceRef', 'adapterRegistrationIdentity',
    'adapterRegistrationRevision', 'adapterIdentity', 'adapterRevision',
    'attemptOwnerIdentity', 'ownerIdentityEvidenceRef', 'ownerIdentityRevision',
    'compatibilityEvidenceRef', 'actionIdentity', 'actionRevision',
    'continuationTargetRef', 'executionOwnerIdentity', 'inputRef',
    'verifiedInputDigest', 'verifiedInputEvidenceRef', 'effectContractRef',
    'effectContractRevision', 'effectIdempotencyClass', 'logicalEffectId',
    'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision',
    'invocationEnvelopeDigest', 'gatewayProtocolIdentity', 'gatewayProtocolRevision'
  ];
  return Boolean(record && record.type === 'EFFECT_INVOCATION'
    && ['EFFECT_INVOCATION_STARTED', 'INVOCATION_RETURNED',
      'INVOCATION_UNCERTAIN'].includes(record.status)
    && record.physicalInvocationMayOccur === true
    && record.effectStatus === 'UNKNOWN'
    && record.singleInvocationIdentityForIntent === true
    && Number.isInteger(record.invocationRevision)
    && Number.isInteger(record.intentRevision)
    && Number.isInteger(record.startRevision)
    && Number.isInteger(record.attemptRevision)
    && Number.isInteger(record.claimRevision)
    && record.authorityScope !== undefined
    && requiredStrings.every((name) => nonEmptyString(record[name]))
    && EFFECT_CAPABLE_CLASSES.includes(record.effectIdempotencyClass));
}

function invocationMatchesRequest(invocation, request) {
  return invocation.effectInvocationId === request.effectInvocationId
    && invocation.effectInvocationIntentId === request.effectInvocationIntentId;
}

function invocationMatchesIntent(invocation, snapshot) {
  const intent = snapshot.record;
  return invocation.intentEvidenceRef === snapshot.evidenceRef
    && invocation.intentRevision === intent.intentRevision
    && invocation.executionStartId === intent.executionStartId
    && invocation.executionAttemptId === intent.executionAttemptId
    && invocation.attemptClaimId === intent.attemptClaimId
    && invocation.actionIdentity === intent.actionIdentity
    && invocation.actionRevision === intent.actionRevision
    && invocation.continuationTargetRef === intent.continuationTargetRef
    && sameValue(invocation.authorityScope, intent.authorityScope)
    && invocation.verifiedInputDigest === intent.verifiedInputDigest
    && invocation.effectContractRef === intent.effectContractRef
    && invocation.effectContractRevision === intent.effectContractRevision
    && invocation.effectIdempotencyClass === intent.effectIdempotencyClass
    && invocation.logicalEffectId === intent.logicalEffectId
    && invocation.resultEvidenceGrammarRef === intent.resultEvidenceGrammarRef
    && invocation.resultEvidenceGrammarRevision === intent.resultEvidenceGrammarRevision;
}

function outcomeForExisting(invocation) {
  if (invocation.status === 'INVOCATION_RETURNED') {
    return result(GATEWAY_OUTCOMES.INVOCATION_RETURNED, null, invocation);
  }
  if (invocation.status === 'INVOCATION_UNCERTAIN') {
    return result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
      'physical invocation outcome remains uncertain', invocation);
  }
  return result(GATEWAY_OUTCOMES.ALREADY_STARTED, null, invocation);
}

function createGovernedEffectInvocationGateway({ lifecyclePort, adapterPort }) {
  if (!lifecyclePort || !['findIntentSnapshot', 'findInvocationByIntent',
    'findInvocationById', 'commitInvocationStart', 'recordInvocationReturn',
    'recordInvocationUncertain'].every((name) => typeof lifecyclePort[name] === 'function')) {
    throw new TypeError('lifecyclePort does not implement the required Gateway contract');
  }
  if (!adapterPort || typeof adapterPort.invokeExactEffect !== 'function'
    || Object.keys(adapterPort).some((key) => key !== 'invokeExactEffect')) {
    throw new TypeError('adapterPort must expose invokeExactEffect only');
  }

  function invoke({ effectInvocationId, effectInvocationIntentId,
    expectedIntentRevision, expectedStartRevision, expectedAttemptRevision,
    expectedClaimRevision, expectedAdapterRegistrationRevision,
    expectedOwnerIdentityRevision } = {}) {
    const request = { effectInvocationId, effectInvocationIntentId };
    if (![effectInvocationId, effectInvocationIntentId,
      expectedAdapterRegistrationRevision, expectedOwnerIdentityRevision].every(nonEmptyString)
      || ![expectedIntentRevision, expectedStartRevision, expectedAttemptRevision,
        expectedClaimRevision].every(Number.isInteger)) {
      return rejected('invocation, Intent and exact expected revisions are required');
    }

    let byId;
    let byIntent;
    try {
      byId = lifecyclePort.findInvocationById(effectInvocationId);
      byIntent = lifecyclePort.findInvocationByIntent(effectInvocationIntentId);
    } catch (_) {
      return result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
        'Gateway lifecycle evidence is unavailable');
    }
    if (!Array.isArray(byId) || byId.length > 1
      || !Array.isArray(byIntent) || byIntent.length > 1) {
      return result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
        'Gateway lifecycle evidence is conflicting or corrupt');
    }
    if (byId.length === 1) {
      const existing = byId[0];
      if (!coherentInvocation(existing) || !invocationMatchesRequest(existing, request)
        || !byIntent.some((entry) => sameValue(entry, existing))) {
        return rejected('physical invocation identity is already bound elsewhere');
      }
      return outcomeForExisting(existing);
    }
    if (byIntent.length === 1) {
      const existing = byIntent[0];
      if (!coherentInvocation(existing)
        || existing.effectInvocationIntentId !== effectInvocationIntentId) {
        return result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
          'existing invocation evidence is invalid or conflicting');
      }
      return result(GATEWAY_OUTCOMES.INVOCATION_ALREADY_EXISTS,
        'Intent already has a physical invocation identity', existing);
    }

    let rawSnapshot;
    try { rawSnapshot = lifecyclePort.findIntentSnapshot(effectInvocationIntentId); } catch (_) {
      return result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
        'authoritative Intent snapshot is unavailable');
    }
    if (rawSnapshot === null || rawSnapshot === undefined) {
      return result(GATEWAY_OUTCOMES.INTENT_NOT_FOUND,
        'authoritative EFFECT_INVOCATION_INTENT evidence is absent');
    }
    const snapshot = coherentSnapshot(rawSnapshot, effectInvocationIntentId);
    if (!snapshot) return invalid('authoritative Intent snapshot is invalid or incoherent');
    const intent = snapshot.record;

    if (intent.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT') {
      return result(GATEWAY_OUTCOMES.BRANCH_MISMATCH,
        'NO_EXTERNAL_EFFECT cannot enter the effect invocation Gateway');
    }
    if (!EFFECT_CAPABLE_CLASSES.includes(intent.effectIdempotencyClass)
      || !nonEmptyString(intent.logicalEffectId)) {
      return result(GATEWAY_OUTCOMES.INTENT_NOT_ELIGIBLE,
        'Intent has no eligible frozen effect-capable contract');
    }
    if (!snapshot.currentClaim) {
      return result(GATEWAY_OUTCOMES.CLAIM_NOT_CURRENT,
        'Intent Claim is no longer the exact current governed owner');
    }
    if (!snapshot.adapterRegistrationCurrent || !snapshot.adapterRegistrationEnabled
      || !snapshot.ownerIdentityCurrent) {
      return result(GATEWAY_OUTCOMES.ADAPTER_NOT_CURRENT,
        'adapter registration or trusted owner is not current');
    }
    if (snapshot.conflictingLifecycleEvidence || snapshot.invocationStatusUnknown
      || snapshot.effectPossiblyOccurred || snapshot.effectConfirmed
      || snapshot.terminalLifecycleEvidence) {
      return result(GATEWAY_OUTCOMES.INTENT_NOT_ELIGIBLE,
        'conflicting invocation, effect or terminal lifecycle evidence exists');
    }
    if (intent.intentRevision !== expectedIntentRevision
      || intent.startRevision !== expectedStartRevision
      || intent.attemptRevision !== expectedAttemptRevision
      || intent.claimRevision !== expectedClaimRevision
      || intent.adapterRegistrationRevision !== expectedAdapterRegistrationRevision
      || intent.ownerIdentityRevision !== expectedOwnerIdentityRevision) {
      return result(GATEWAY_OUTCOMES.INVOCATION_STALE,
        'expected Intent, Start, attempt, Claim, adapter or owner revision is stale');
    }
    if ([effectInvocationIntentId, intent.executionStartId, intent.executionAttemptId,
      intent.attemptClaimId, intent.logicalEffectId].includes(effectInvocationId)) {
      return rejected('physical invocation identity must differ from all upstream identities');
    }

    const envelope = Object.freeze({
      effectInvocationId, effectInvocationIntentId,
      executionStartId: intent.executionStartId,
      executionAttemptId: intent.executionAttemptId,
      adapterIdentity: intent.adapterIdentity, adapterRevision: intent.adapterRevision,
      actionIdentity: intent.actionIdentity, actionRevision: intent.actionRevision,
      continuationTargetRef: intent.continuationTargetRef,
      authorityScope: clone(intent.authorityScope),
      inputRef: intent.inputRef, verifiedInputDigest: intent.verifiedInputDigest,
      verifiedInputEvidenceRef: intent.verifiedInputEvidenceRef,
      effectContractRef: intent.effectContractRef,
      effectContractRevision: intent.effectContractRevision,
      effectIdempotencyClass: intent.effectIdempotencyClass,
      logicalEffectId: intent.logicalEffectId,
      stableEffectKey: intent.effectIdempotencyClass === 'IDEMPOTENT_WITH_STABLE_KEY'
        ? intent.logicalEffectId : null,
      resultEvidenceGrammarRef: intent.resultEvidenceGrammarRef,
      resultEvidenceGrammarRevision: intent.resultEvidenceGrammarRevision,
      authorityEvidenceRef: intent.authorityEvidenceRef,
      governanceEvaluationRef: intent.governanceEvaluationRef,
      intentEvidenceRef: snapshot.evidenceRef,
      gatewayProtocolIdentity: GATEWAY_PROTOCOL,
      gatewayProtocolRevision: GATEWAY_PROTOCOL_REVISION
    });
    const invocationEnvelopeDigest = `sha256:${sha256(canonicalStringify(envelope))}`;

    const record = Object.freeze({
      type: 'EFFECT_INVOCATION', status: 'EFFECT_INVOCATION_STARTED',
      effectInvocationId, invocationRevision: 1,
      effectInvocationIntentId, intentEvidenceRef: snapshot.evidenceRef,
      intentRevision: intent.intentRevision, startEvidenceRef: intent.startEvidenceRef,
      executionStartId: intent.executionStartId, startRevision: intent.startRevision,
      executionAttemptId: intent.executionAttemptId,
      attemptClaimId: intent.attemptClaimId, attemptEvidenceRef: intent.attemptEvidenceRef,
      attemptRevision: intent.attemptRevision, claimEvidenceRef: intent.claimEvidenceRef,
      claimRevision: intent.claimRevision, claimHistoryRevision: intent.claimHistoryRevision,
      executionId: intent.executionId, executionAcceptanceId: intent.executionAcceptanceId,
      preparationEvidenceRef: intent.preparationEvidenceRef,
      preparationRevision: intent.preparationRevision, dispatchId: intent.dispatchId,
      continuationId: intent.continuationId, interactionId: intent.interactionId,
      gateId: intent.gateId, gateRevision: intent.gateRevision,
      authorityEvidenceRef: intent.authorityEvidenceRef,
      governanceEvaluationRef: intent.governanceEvaluationRef,
      authorityScope: clone(intent.authorityScope),
      adapterRegistrationEvidenceRef: intent.adapterRegistrationEvidenceRef,
      adapterRegistrationIdentity: intent.adapterRegistrationIdentity,
      adapterRegistrationRevision: intent.adapterRegistrationRevision,
      adapterIdentity: intent.adapterIdentity, adapterRevision: intent.adapterRevision,
      attemptOwnerIdentity: intent.attemptOwnerIdentity,
      ownerIdentityEvidenceRef: intent.ownerIdentityEvidenceRef,
      ownerIdentityRevision: intent.ownerIdentityRevision,
      compatibilityEvidenceRef: intent.compatibilityEvidenceRef,
      actionIdentity: intent.actionIdentity, actionRevision: intent.actionRevision,
      continuationTargetRef: intent.continuationTargetRef,
      executionOwnerIdentity: intent.executionOwnerIdentity, inputRef: intent.inputRef,
      verifiedInputDigest: intent.verifiedInputDigest,
      verifiedInputEvidenceRef: intent.verifiedInputEvidenceRef,
      effectContractRef: intent.effectContractRef,
      effectContractRevision: intent.effectContractRevision,
      effectIdempotencyClass: intent.effectIdempotencyClass,
      logicalEffectId: intent.logicalEffectId,
      resultEvidenceGrammarRef: intent.resultEvidenceGrammarRef,
      resultEvidenceGrammarRevision: intent.resultEvidenceGrammarRevision,
      invocationEnvelopeDigest, gatewayProtocolIdentity: GATEWAY_PROTOCOL,
      gatewayProtocolRevision: GATEWAY_PROTOCOL_REVISION,
      physicalInvocationMayOccur: true, effectStatus: 'UNKNOWN',
      singleInvocationIdentityForIntent: true
    });

    const guards = Object.freeze({
      intentGuard: Object.freeze({ evidenceRef: snapshot.evidenceRef,
        effectInvocationIntentId, intentRevision: intent.intentRevision,
        executionStartId: intent.executionStartId, startRevision: intent.startRevision,
        executionAttemptId: intent.executionAttemptId,
        attemptRevision: intent.attemptRevision, attemptClaimId: intent.attemptClaimId,
        claimRevision: intent.claimRevision, currentClaim: true }),
      adapterGuard: Object.freeze({
        registrationIdentity: intent.adapterRegistrationIdentity,
        registrationRevision: intent.adapterRegistrationRevision,
        adapterIdentity: intent.adapterIdentity, adapterRevision: intent.adapterRevision,
        enabled: true, current: true }),
      ownerGuard: Object.freeze({ attemptOwnerIdentity: intent.attemptOwnerIdentity,
        evidenceRef: intent.ownerIdentityEvidenceRef,
        identityRevision: intent.ownerIdentityRevision, current: true }),
      envelopeGuard: Object.freeze({ invocationEnvelopeDigest,
        verifiedInputDigest: intent.verifiedInputDigest,
        effectContractRevision: intent.effectContractRevision,
        effectIdempotencyClass: intent.effectIdempotencyClass,
        logicalEffectId: intent.logicalEffectId,
        resultEvidenceGrammarRevision: intent.resultEvidenceGrammarRevision }),
      lifecycleGuard: Object.freeze({ noPriorInvocation: true,
        noUnknownInvocation: true, noPossibleEffect: true,
        noConfirmedEffect: true, noTerminalLifecycleEvidence: true })
    });

    let committed;
    try {
      committed = lifecyclePort.commitInvocationStart(clone(record), guards);
    } catch (error) {
      let recovered = null;
      try {
        const matches = lifecyclePort.findInvocationById(effectInvocationId);
        recovered = Array.isArray(matches) && matches.length === 1 ? matches[0] : null;
      } catch (_) { recovered = null; }
      if (recovered && coherentInvocation(recovered) && sameValue(recovered, record)) {
        return result(GATEWAY_OUTCOMES.ALREADY_STARTED,
          'pre-call evidence recovered; adapter invocation is not replayed', recovered);
      }
      const mapped = error && ({ INVOCATION_STALE: GATEWAY_OUTCOMES.INVOCATION_STALE,
        CLAIM_NOT_CURRENT: GATEWAY_OUTCOMES.CLAIM_NOT_CURRENT,
        ADAPTER_NOT_CURRENT: GATEWAY_OUTCOMES.ADAPTER_NOT_CURRENT,
        INVOCATION_ALREADY_EXISTS: GATEWAY_OUTCOMES.INVOCATION_ALREADY_EXISTS,
        INTENT_NOT_ELIGIBLE: GATEWAY_OUTCOMES.INTENT_NOT_ELIGIBLE })[error.code];
      return mapped ? result(mapped, 'atomic pre-call guard changed before commit')
        : result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
          'pre-call persistence is uncertain; adapter invocation is blocked');
    }
    if (!coherentInvocation(committed) || !sameValue(committed, record)) {
      return result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
        'atomic ledger returned inconsistent pre-call evidence');
    }

    let adapterReturn;
    try {
      adapterReturn = adapterPort.invokeExactEffect(clone(envelope));
    } catch (error) {
      const uncertainty = Object.freeze({ status: 'INVOCATION_UNCERTAIN',
        evidenceRef: nonEmptyString(error && error.evidenceRef)
          ? error.evidenceRef : `gateway-uncertain:${effectInvocationId}`,
        reasonCode: nonEmptyString(error && error.code) ? error.code : 'ADAPTER_THROW',
        effectStatus: 'UNKNOWN' });
      try {
        const persisted = lifecyclePort.recordInvocationUncertain(effectInvocationId,
          clone(uncertainty), Object.freeze({ invocationRevision: 1,
            invocationEnvelopeDigest, expectedStatus: 'EFFECT_INVOCATION_STARTED' }));
        return coherentInvocation(persisted)
          ? result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
            'adapter invocation outcome is uncertain', persisted)
          : result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
            'uncertainty evidence persistence is inconsistent', committed);
      } catch (_) {
        return result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
          'adapter and uncertainty persistence outcomes are uncertain', committed);
      }
    }

    if (!adapterReturn || adapterReturn.status !== 'RETURNED'
      || !nonEmptyString(adapterReturn.evidenceRef)
      || !nonEmptyString(adapterReturn.responseDigest)) {
      const uncertainty = Object.freeze({ status: 'INVOCATION_UNCERTAIN',
        evidenceRef: `gateway-invalid-return:${effectInvocationId}`,
        reasonCode: 'INVALID_ADAPTER_RETURN', effectStatus: 'UNKNOWN' });
      try { lifecyclePort.recordInvocationUncertain(effectInvocationId,
        clone(uncertainty), Object.freeze({ invocationRevision: 1,
          invocationEnvelopeDigest, expectedStatus: 'EFFECT_INVOCATION_STARTED' })); } catch (_) {}
      return result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
        'adapter return is invalid or ambiguous', committed);
    }

    const boundedReturn = Object.freeze({ status: 'INVOCATION_RETURNED',
      evidenceRef: adapterReturn.evidenceRef,
      responseDigest: adapterReturn.responseDigest,
      transportStatus: nonEmptyString(adapterReturn.transportStatus)
        ? adapterReturn.transportStatus : 'RETURNED',
      effectStatus: 'UNKNOWN' });
    try {
      const persisted = lifecyclePort.recordInvocationReturn(effectInvocationId,
        clone(boundedReturn), Object.freeze({ invocationRevision: 1,
          invocationEnvelopeDigest, expectedStatus: 'EFFECT_INVOCATION_STARTED' }));
      return coherentInvocation(persisted)
        ? result(GATEWAY_OUTCOMES.INVOCATION_RETURNED, null, persisted)
        : result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
          'bounded return evidence persistence is inconsistent', committed);
    } catch (_) {
      return result(GATEWAY_OUTCOMES.INVOCATION_UNCERTAIN,
        'bounded adapter return persistence is uncertain', committed);
    }
  }

  return Object.freeze({ invoke });
}

module.exports = { GATEWAY_OUTCOMES, createGovernedEffectInvocationGateway };
