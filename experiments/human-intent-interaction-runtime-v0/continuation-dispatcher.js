'use strict';

const { DISPATCH_OUTCOMES } = require('./interaction-runtime');

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

function createContinuationDispatcher({ runtime, registrations }) {
  const requiredRuntimeMethods = [
    'getInteractionSnapshot',
    'getContinuationDispatchSnapshot',
    'prepareContinuationDispatch',
    'recordContinuationDispatchAttempt',
    'recordContinuationDispatchOutcome'
  ];
  if (!runtime || !requiredRuntimeMethods.every((name) => typeof runtime[name] === 'function')) {
    throw new TypeError('runtime does not implement the continuation dispatch boundary');
  }
  if (!Array.isArray(registrations)) throw new TypeError('registrations must be an array');

  const registry = new Map();
  for (const registration of registrations) {
    requireString(registration && registration.targetRef, 'targetRef');
    requireString(registration.registrationIdentity, 'registrationIdentity');
    requireString(registration.registrationRevision, 'registrationRevision');
    if (registry.has(registration.targetRef)) throw new Error(`ambiguous target ${registration.targetRef}`);
    if (registration.acceptedAuthorityScopeContract === undefined
      || typeof registration.consumer !== 'function'
      || registration.idempotencyCapability !== true
      || typeof registration.enabled !== 'boolean') {
      throw new TypeError('invalid target registration');
    }
    registry.set(registration.targetRef, Object.freeze({ ...registration }));
  }

  function recordOutcome(request, snapshot, outcome, extra = {}) {
    const current = runtime.getInteractionSnapshot(request.interactionId);
    runtime.recordContinuationDispatchOutcome({
      interactionId: request.interactionId,
      dispatchId: request.dispatchId,
      dispatchAttemptId: extra.dispatchAttemptId || null,
      outcome,
      acknowledgement: extra.acknowledgement || null,
      registrationIdentity: extra.registration ? extra.registration.registrationIdentity : null,
      registrationRevision: extra.registration ? extra.registration.registrationRevision : null,
      eventId: request.outcomeEventId,
      expectedRevision: current.revision
    });
    return Object.freeze({
      outcome,
      envelope: clone(snapshot.envelope),
      acknowledgement: clone(extra.acknowledgement || null)
    });
  }

  function dispatch(request) {
    if (!request || typeof request !== 'object') throw new TypeError('dispatch request is required');
    [
      'interactionId', 'continuationId', 'dispatchId', 'idempotencyKey',
      'intentEventId', 'dispatchAttemptId', 'attemptEventId', 'outcomeEventId'
    ].forEach((name) => requireString(request[name], name));

    let existing;
    try {
      existing = runtime.getContinuationDispatchSnapshot(request.interactionId, request.dispatchId);
    } catch (error) {
      return Object.freeze({ outcome: 'INVALID_AUTHORITY', envelope: null, acknowledgement: null });
    }
    if (existing && existing.latestOutcome
      && existing.latestOutcome.outcome === DISPATCH_OUTCOMES.DISPATCH_ACCEPTED) {
      return Object.freeze({
        outcome: 'ALREADY_DISPATCHED',
        envelope: clone(existing.envelope),
        acknowledgement: clone(existing.latestOutcome.acknowledgement)
      });
    }

    try {
      const aggregate = runtime.getInteractionSnapshot(request.interactionId);
      runtime.prepareContinuationDispatch({
        interactionId: request.interactionId,
        continuationId: request.continuationId,
        dispatchId: request.dispatchId,
        idempotencyKey: request.idempotencyKey,
        eventId: request.intentEventId,
        expectedRevision: aggregate.revision
      });
    } catch (error) {
      const outcome = Object.prototype.hasOwnProperty.call(DISPATCH_OUTCOMES, error.message)
        ? error.message
        : 'INVALID_AUTHORITY';
      return Object.freeze({ outcome, envelope: null, acknowledgement: null });
    }

    existing = runtime.getContinuationDispatchSnapshot(request.interactionId, request.dispatchId);
    const registration = registry.get(existing.envelope.continuationTargetRef);
    if (!registration || !registration.enabled) {
      return recordOutcome(request, existing, 'TARGET_NOT_REGISTERED');
    }
    if (!sameValue(existing.envelope.authorityScope, registration.acceptedAuthorityScopeContract)) {
      return recordOutcome(request, existing, 'TARGET_SCOPE_MISMATCH', { registration });
    }

    let current = runtime.getInteractionSnapshot(request.interactionId);
    runtime.recordContinuationDispatchAttempt({
      interactionId: request.interactionId,
      dispatchId: request.dispatchId,
      dispatchAttemptId: request.dispatchAttemptId,
      eventId: request.attemptEventId,
      expectedRevision: current.revision
    });

    let acknowledgement;
    try {
      acknowledgement = registration.consumer(clone(existing.envelope));
    } catch (error) {
      const outcome = error && error.deliveryOutcome === 'DELIVERY_UNAVAILABLE'
        ? 'DELIVERY_UNAVAILABLE'
        : 'DELIVERY_UNCERTAIN';
      return recordOutcome(request, existing, outcome, {
        registration,
        dispatchAttemptId: request.dispatchAttemptId
      });
    }

    if (!acknowledgement || acknowledgement.receiptStatus !== 'ACCEPTED') {
      return recordOutcome(request, existing, 'DELIVERY_REJECTED', {
        registration,
        dispatchAttemptId: request.dispatchAttemptId,
        acknowledgement: acknowledgement || null
      });
    }
    const normalized = {
      receiptStatus: 'ACCEPTED',
      dispatchId: existing.envelope.dispatchId,
      idempotencyKey: existing.envelope.idempotencyKey,
      continuationTargetRef: existing.envelope.continuationTargetRef,
      receiptRef: acknowledgement.receiptRef || null
    };
    return recordOutcome(request, existing, 'DISPATCH_ACCEPTED', {
      registration,
      dispatchAttemptId: request.dispatchAttemptId,
      acknowledgement: normalized
    });
  }

  return Object.freeze({ dispatch });
}

module.exports = { createContinuationDispatcher };
