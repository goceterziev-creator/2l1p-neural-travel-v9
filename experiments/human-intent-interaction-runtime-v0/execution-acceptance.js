'use strict';

const EXECUTION_ACCEPTANCE_OUTCOMES = Object.freeze({
  EXECUTION_ACCEPTED: 'EXECUTION_ACCEPTED',
  ALREADY_ACCEPTED: 'ALREADY_ACCEPTED',
  EXECUTION_REJECTED: 'EXECUTION_REJECTED',
  ACTION_NOT_REGISTERED: 'ACTION_NOT_REGISTERED',
  ACTION_SCOPE_MISMATCH: 'ACTION_SCOPE_MISMATCH',
  DISPATCH_NOT_ACCEPTED: 'DISPATCH_NOT_ACCEPTED',
  ACCEPTANCE_STALE: 'ACCEPTANCE_STALE',
  INVALID_EXECUTION_AUTHORITY: 'INVALID_EXECUTION_AUTHORITY',
  ACCEPTANCE_UNCERTAIN: 'ACCEPTANCE_UNCERTAIN'
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function invalidResult(reason) {
  return Object.freeze({
    outcome: EXECUTION_ACCEPTANCE_OUTCOMES.INVALID_EXECUTION_AUTHORITY,
    reason,
    acceptance: null
  });
}

function acceptedDispatchEvidence(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.envelope) return null;
  const envelope = snapshot.envelope;
  const requiredEnvelopeStrings = [
    'dispatchId', 'idempotencyKey', 'continuationId', 'interactionId', 'gateId',
    'continuationTargetRef', 'authorityEvidenceRef', 'governanceEvaluationRef'
  ];
  if (requiredEnvelopeStrings.some((name) => typeof envelope[name] !== 'string' || !envelope[name])) {
    return null;
  }
  if (!Number.isInteger(envelope.gateRevision)
    || !Number.isInteger(envelope.authorityCommittedRevision)
    || envelope.authorityScope === undefined
    || snapshot.dispatchId !== envelope.dispatchId
    || !Number.isInteger(snapshot.intentRevision)) {
    return null;
  }
  const outcomes = Array.isArray(snapshot.outcomes) ? snapshot.outcomes : [];
  const accepted = outcomes.filter((item) => item && item.outcome === 'DISPATCH_ACCEPTED');
  if (accepted.length !== 1 || snapshot.latestOutcome !== outcomes[outcomes.length - 1]
    && !sameValue(snapshot.latestOutcome, outcomes[outcomes.length - 1])) {
    return null;
  }
  const outcome = accepted[0];
  const acknowledgement = outcome.acknowledgement;
  if (outcome !== outcomes[outcomes.length - 1]
    || typeof outcome.eventId !== 'string' || !outcome.eventId
    || typeof outcome.registrationIdentity !== 'string' || !outcome.registrationIdentity
    || typeof outcome.registrationRevision !== 'string' || !outcome.registrationRevision
    || !acknowledgement
    || acknowledgement.receiptStatus !== 'ACCEPTED'
    || acknowledgement.dispatchId !== envelope.dispatchId
    || acknowledgement.idempotencyKey !== envelope.idempotencyKey
    || acknowledgement.continuationTargetRef !== envelope.continuationTargetRef) {
    return null;
  }
  return { envelope, outcome, acknowledgement };
}

function acceptanceTuple(dispatchId, actionIdentity, actionRevision) {
  return Object.freeze({ dispatchId, actionIdentity, actionRevision });
}

function isCoherentAcceptance(record, tuple) {
  return Boolean(record
    && record.type === 'EXECUTION_ACCEPTANCE'
    && record.status === 'EXECUTION_ACCEPTED'
    && record.singleLogicalAcceptance === true
    && record.dispatchId === tuple.dispatchId
    && record.actionIdentity === tuple.actionIdentity
    && record.actionRevision === tuple.actionRevision
    && Number.isInteger(record.acceptanceRevision)
    && typeof record.executionAcceptanceId === 'string'
    && record.executionAcceptanceId.length > 0
    && typeof record.effectIdempotencyCapability === 'string'
    && record.effectIdempotencyCapability.length > 0
    && typeof record.resultEvidenceGrammarRef === 'string'
    && record.resultEvidenceGrammarRef.length > 0);
}

function createGovernedExecutionAcceptance({ dispatchSnapshotPort, actionRegistryPort, acceptanceStore }) {
  if (typeof dispatchSnapshotPort !== 'function') {
    throw new TypeError('dispatchSnapshotPort must be a function');
  }
  if (typeof actionRegistryPort !== 'function') {
    throw new TypeError('actionRegistryPort must be a function');
  }
  if (!acceptanceStore || !['findByDispatch', 'findByTuple', 'findById', 'commit']
    .every((name) => typeof acceptanceStore[name] === 'function')) {
    throw new TypeError('acceptanceStore must implement findByDispatch, findByTuple, findById and commit');
  }

  function resolveExisting(tuple, executionAcceptanceId) {
    const byDispatch = acceptanceStore.findByDispatch(tuple.dispatchId);
    const byTuple = acceptanceStore.findByTuple(clone(tuple));
    const byId = acceptanceStore.findById(executionAcceptanceId);
    if (!Array.isArray(byDispatch) || !Array.isArray(byTuple) || !Array.isArray(byId)
      || byDispatch.length > 1 || byTuple.length > 1 || byId.length > 1) {
      return invalidResult('conflicting or corrupt acceptance evidence');
    }
    if (byDispatch.length === 1) {
      const existing = byDispatch[0];
      if (!isCoherentAcceptance(existing, tuple)
        || existing.executionAcceptanceId !== executionAcceptanceId
        || byTuple.length !== 1 || !sameValue(byTuple[0], existing)
        || (byId.length === 1 && !sameValue(byId[0], existing))) {
        return invalidResult('conflicting execution acceptance identity');
      }
      return Object.freeze({
        outcome: EXECUTION_ACCEPTANCE_OUTCOMES.ALREADY_ACCEPTED,
        reason: null,
        acceptance: clone(existing)
      });
    }
    if (byTuple.length === 1 || byId.length === 1) {
      return invalidResult('execution acceptance identity is already bound');
    }
    return null;
  }

  function accept({ dispatchId, actionRequest, executionAcceptanceId }) {
    requireString(dispatchId, 'dispatchId');
    requireString(executionAcceptanceId, 'executionAcceptanceId');
    if (!actionRequest || typeof actionRequest !== 'object') {
      return invalidResult('action request is required');
    }
    const requiredRequestStrings = [
      'expectedDispatchOutcomeRef', 'expectedActionIdentity',
      'expectedActionRevision', 'expectedRegistrationRevision'
    ];
    if (requiredRequestStrings.some((name) => typeof actionRequest[name] !== 'string'
      || !actionRequest[name])) {
      return invalidResult('action request identity is incomplete');
    }

    let acceptedDispatchSnapshot;
    try {
      acceptedDispatchSnapshot = dispatchSnapshotPort(dispatchId);
    } catch (error) {
      return Object.freeze({
        outcome: EXECUTION_ACCEPTANCE_OUTCOMES.ACCEPTANCE_UNCERTAIN,
        reason: 'authoritative dispatch evidence is unavailable',
        acceptance: null
      });
    }
    const snapshotDispatchId = acceptedDispatchSnapshot && acceptedDispatchSnapshot.dispatchId;
    if (typeof snapshotDispatchId !== 'string' || !snapshotDispatchId) {
      return Object.freeze({
        outcome: EXECUTION_ACCEPTANCE_OUTCOMES.DISPATCH_NOT_ACCEPTED,
        reason: 'accepted dispatch snapshot is absent',
        acceptance: null
      });
    }
    if (snapshotDispatchId !== dispatchId) {
      return invalidResult('authoritative dispatch identity mismatch');
    }
    if (executionAcceptanceId === snapshotDispatchId) {
      return invalidResult('execution acceptance identity must be distinct from dispatch identity');
    }
    const tuple = acceptanceTuple(
      snapshotDispatchId,
      actionRequest.expectedActionIdentity,
      actionRequest.expectedActionRevision
    );
    const existing = resolveExisting(tuple, executionAcceptanceId);
    if (existing) return existing;

    const dispatch = acceptedDispatchEvidence(acceptedDispatchSnapshot);
    if (!dispatch) {
      return Object.freeze({
        outcome: EXECUTION_ACCEPTANCE_OUTCOMES.DISPATCH_NOT_ACCEPTED,
        reason: 'dispatch evidence is absent or inconsistent',
        acceptance: null
      });
    }
    if (actionRequest.expectedDispatchOutcomeRef !== dispatch.outcome.eventId) {
      return invalidResult('dispatch outcome evidence reference mismatch');
    }

    const registrations = actionRegistryPort(Object.freeze({
      actionIdentity: actionRequest.expectedActionIdentity,
      actionRevision: actionRequest.expectedActionRevision
    }));
    if (!Array.isArray(registrations) || registrations.length === 0) {
      return Object.freeze({
        outcome: EXECUTION_ACCEPTANCE_OUTCOMES.ACTION_NOT_REGISTERED,
        reason: 'action is not registered',
        acceptance: null
      });
    }
    if (registrations.length !== 1) return invalidResult('action registration is ambiguous');
    const registration = registrations[0];
    const requiredRegistrationStrings = [
      'actionIdentity', 'actionRevision', 'registrationIdentity', 'registrationRevision',
      'dispatchRegistrationIdentity', 'continuationTargetRef', 'executionOwnerIdentity',
      'effectIdempotencyCapability', 'resultEvidenceGrammarRef'
    ];
    if (requiredRegistrationStrings.some((name) => typeof registration[name] !== 'string'
      || !registration[name])
      || typeof registration.enabled !== 'boolean'
      || registration.acceptedAuthorityScopeContract === undefined
      || !registration.inputDerivationContract
      || typeof registration.inputDerivationContract.identity !== 'string'
      || typeof registration.inputDerivationContract.revision !== 'string'
      || typeof registration.deriveActionInput !== 'function'
      || typeof registration.acceptancePolicy !== 'function') {
      return invalidResult('action registration is invalid');
    }
    if (registration.actionIdentity !== tuple.actionIdentity
      || registration.actionRevision !== tuple.actionRevision
      || registration.registrationRevision !== actionRequest.expectedRegistrationRevision) {
      return Object.freeze({
        outcome: EXECUTION_ACCEPTANCE_OUTCOMES.ACCEPTANCE_STALE,
        reason: 'action or registration revision is stale',
        acceptance: null
      });
    }
    if (!registration.enabled) {
      return Object.freeze({
        outcome: EXECUTION_ACCEPTANCE_OUTCOMES.EXECUTION_REJECTED,
        reason: 'execution owner is disabled',
        acceptance: null
      });
    }
    if (registration.dispatchRegistrationIdentity !== dispatch.outcome.registrationIdentity
      || registration.continuationTargetRef !== dispatch.envelope.continuationTargetRef
      || !sameValue(registration.acceptedAuthorityScopeContract, dispatch.envelope.authorityScope)) {
      return Object.freeze({
        outcome: EXECUTION_ACCEPTANCE_OUTCOMES.ACTION_SCOPE_MISMATCH,
        reason: 'action target, consumer or authority scope mismatch',
        acceptance: null
      });
    }

    let actionInputBinding;
    let policy;
    try {
      actionInputBinding = registration.deriveActionInput(Object.freeze({
        envelope: clone(dispatch.envelope),
        immutableConfiguration: clone(registration.immutableConfiguration || null)
      }));
      if (!actionInputBinding
        || typeof actionInputBinding.inputRef !== 'string' || !actionInputBinding.inputRef
        || typeof actionInputBinding.inputDigest !== 'string' || !actionInputBinding.inputDigest
        || actionInputBinding.derivationIdentity !== registration.inputDerivationContract.identity
        || actionInputBinding.derivationRevision !== registration.inputDerivationContract.revision) {
        return invalidResult('action input binding is invalid');
      }
      policy = registration.acceptancePolicy(Object.freeze({
        envelope: clone(dispatch.envelope),
        actionInputBinding: clone(actionInputBinding)
      }));
    } catch (error) {
      return Object.freeze({
        outcome: EXECUTION_ACCEPTANCE_OUTCOMES.ACCEPTANCE_UNCERTAIN,
        reason: 'pure acceptance evaluation did not complete',
        acceptance: null
      });
    }
    if (!policy || policy.accepted !== true) {
      return Object.freeze({
        outcome: EXECUTION_ACCEPTANCE_OUTCOMES.EXECUTION_REJECTED,
        reason: policy && typeof policy.reason === 'string' ? policy.reason : 'execution owner rejected acceptance',
        acceptance: null
      });
    }

    const record = Object.freeze({
      type: 'EXECUTION_ACCEPTANCE',
      executionAcceptanceId,
      status: 'EXECUTION_ACCEPTED',
      dispatchId: dispatch.envelope.dispatchId,
      dispatchIntentEvidenceRef: Object.freeze({
        dispatchId: dispatch.envelope.dispatchId,
        intentRevision: acceptedDispatchSnapshot.intentRevision
      }),
      dispatchOutcomeEvidenceRef: dispatch.outcome.eventId,
      dispatchReceiptRef: dispatch.acknowledgement.receiptRef || null,
      dispatchRegistrationIdentity: dispatch.outcome.registrationIdentity,
      dispatchRegistrationRevision: dispatch.outcome.registrationRevision,
      idempotencyKey: dispatch.envelope.idempotencyKey,
      continuationId: dispatch.envelope.continuationId,
      interactionId: dispatch.envelope.interactionId,
      gateId: dispatch.envelope.gateId,
      gateRevision: dispatch.envelope.gateRevision,
      authorityScope: clone(dispatch.envelope.authorityScope),
      continuationTargetRef: dispatch.envelope.continuationTargetRef,
      authorityEvidenceRef: dispatch.envelope.authorityEvidenceRef,
      governanceEvaluationRef: dispatch.envelope.governanceEvaluationRef,
      authorityCommittedRevision: dispatch.envelope.authorityCommittedRevision,
      actionIdentity: registration.actionIdentity,
      actionRevision: registration.actionRevision,
      actionRegistrationIdentity: registration.registrationIdentity,
      actionRegistrationRevision: registration.registrationRevision,
      executionOwnerIdentity: registration.executionOwnerIdentity,
      actionInputBinding: clone(actionInputBinding),
      effectIdempotencyCapability: registration.effectIdempotencyCapability,
      resultEvidenceGrammarRef: registration.resultEvidenceGrammarRef,
      singleLogicalAcceptance: true
    });

    try {
      const committed = acceptanceStore.commit(clone(record), Object.freeze({
        registrationGuard: Object.freeze({
          registrationIdentity: registration.registrationIdentity,
          registrationRevision: registration.registrationRevision,
          effectIdempotencyCapability: registration.effectIdempotencyCapability,
          resultEvidenceGrammarRef: registration.resultEvidenceGrammarRef
        })
      }));
      if (!isCoherentAcceptance(committed, tuple)
        || committed.executionAcceptanceId !== executionAcceptanceId) {
        return invalidResult('persisted acceptance evidence is inconsistent');
      }
      return Object.freeze({
        outcome: EXECUTION_ACCEPTANCE_OUTCOMES.EXECUTION_ACCEPTED,
        reason: null,
        acceptance: clone(committed)
      });
    } catch (error) {
      const recovered = resolveExisting(tuple, executionAcceptanceId);
      if (recovered && recovered.outcome === EXECUTION_ACCEPTANCE_OUTCOMES.ALREADY_ACCEPTED) {
        return recovered;
      }
      if (recovered && recovered.outcome === EXECUTION_ACCEPTANCE_OUTCOMES.INVALID_EXECUTION_AUTHORITY) {
        return recovered;
      }
      if (error && error.code === EXECUTION_ACCEPTANCE_OUTCOMES.ACCEPTANCE_STALE) {
        return Object.freeze({
          outcome: EXECUTION_ACCEPTANCE_OUTCOMES.ACCEPTANCE_STALE,
          reason: 'action registration changed before acceptance commit',
          acceptance: null
        });
      }
      return Object.freeze({
        outcome: EXECUTION_ACCEPTANCE_OUTCOMES.ACCEPTANCE_UNCERTAIN,
        reason: 'atomic acceptance persistence is uncertain',
        acceptance: null
      });
    }
  }

  return Object.freeze({ accept });
}

module.exports = {
  EXECUTION_ACCEPTANCE_OUTCOMES,
  createGovernedExecutionAcceptance
};
