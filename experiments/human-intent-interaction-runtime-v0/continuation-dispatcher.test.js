'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  canonicalStringify,
  compileIntentContract,
  evaluateIntentRegression
} = require('../human-intent-layer-v0/intent-layer');
const { createInMemoryInteractionStore } = require('./in-memory-interaction-store');
const { createInteractionRuntime } = require('./interaction-runtime');
const { createContinuationDispatcher } = require('./continuation-dispatcher');

const fixtures = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../human-intent-layer-v0/fixtures.json'), 'utf8'
));
const scope = { action: 'implementation', boundary: 'isolated-runtime' };
const targetRef = 'target.bootstrap-implementation';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeRuntime(seed = []) {
  const store = createInMemoryInteractionStore({ seed });
  return {
    store,
    runtime: createInteractionRuntime({ store, evaluateIntentRegression })
  };
}

function createConsumedAuthority(interactionId = 'interaction-dispatch') {
  const { store, runtime } = makeRuntime();
  const fixture = fixtures.fixtures.find((item) => item.id === 'knowledge-unresolved-evidence');
  const contract = compileIntentContract(fixture.input, clone(fixture.interpretation), {
    contractId: fixture.id,
    language: fixture.language
  });
  let state = runtime.registerInteraction({
    interactionId,
    intentContractRef: contract.contractId,
    intentContract: contract,
    executionEvidence: clone(fixture.execution)
  });
  state = runtime.registerHumanGate({
    interactionId,
    gateId: 'gate.implementation',
    gateRevision: 1,
    authorityScope: scope,
    requiredDecision: 'Approve implementation.',
    continuationTargetRef: targetRef,
    eventId: `${interactionId}.requested`,
    eventOrder: 1,
    expectedRevision: state.revision
  });
  state = runtime.receiveHumanInput({
    interactionId,
    inputId: `${interactionId}.input`,
    content: 'Approve this exact gate.',
    receivedOrder: 2,
    expectedRevision: state.revision
  });
  state = runtime.materializeGateResolution({
    resolution: {
      resolutionId: `${interactionId}.resolution`,
      outcome: 'SATISFIED',
      interactionId,
      inputId: `${interactionId}.input`,
      gateId: 'gate.implementation',
      gateRevision: 1,
      authorityScope: scope,
      continuationTargetRef: targetRef
    },
    eventId: `${interactionId}.satisfied`,
    eventOrder: 3,
    expectedRevision: state.revision
  });
  state = runtime.evaluateGovernance({
    interactionId,
    evaluationId: `${interactionId}.pass`,
    expectedRevision: state.revision
  });
  state = runtime.claimAuthorizedContinuation({
    interactionId,
    gateId: 'gate.implementation',
    gateRevision: 1,
    authorityScope: scope,
    continuationTargetRef: targetRef,
    continuationId: `${interactionId}.continuation`,
    expectedRevision: state.revision
  });
  return { interactionId, store, runtime, state };
}

function registration(consumer, overrides = {}) {
  return {
    targetRef,
    registrationIdentity: 'registration.bootstrap',
    registrationRevision: '1',
    acceptedAuthorityScopeContract: clone(scope),
    consumer,
    idempotencyCapability: true,
    enabled: true,
    ...overrides
  };
}

function request(interactionId, suffix = '1') {
  return {
    interactionId,
    continuationId: `${interactionId}.continuation`,
    dispatchId: `${interactionId}.dispatch`,
    idempotencyKey: `${interactionId}.idempotency`,
    intentEventId: `${interactionId}.intent`,
    dispatchAttemptId: `${interactionId}.attempt-${suffix}`,
    attemptEventId: `${interactionId}.attempt-event-${suffix}`,
    outcomeEventId: `${interactionId}.outcome-${suffix}`
  };
}

function runSuite() {
  const cases = [];
  const accepted = createConsumedAuthority();
  const deliveries = [];
  const dispatcher = createContinuationDispatcher({
    runtime: accepted.runtime,
    registrations: [registration((envelope) => {
      deliveries.push(clone(envelope));
      return { receiptStatus: 'ACCEPTED', receiptRef: 'receipt-1' };
    })]
  });
  const result = dispatcher.dispatch(request(accepted.interactionId));
  assert.equal(result.outcome, 'DISPATCH_ACCEPTED');
  assert.equal(deliveries.length, 1);
  cases.push('exact-consumed-authority-dispatched');

  assert.deepEqual(Object.keys(result.envelope), [
    'dispatchId', 'idempotencyKey', 'continuationId', 'interactionId', 'gateId',
    'gateRevision', 'authorityScope', 'continuationTargetRef', 'authorityEvidenceRef',
    'governanceEvaluationRef', 'authorityCommittedRevision'
  ]);
  assert.deepEqual(result.envelope.authorityScope, scope);
  assert.equal(result.envelope.continuationTargetRef, targetRef);
  cases.push('immutable-minimal-envelope');

  const duplicate = dispatcher.dispatch(request(accepted.interactionId, '2'));
  assert.equal(duplicate.outcome, 'ALREADY_DISPATCHED');
  assert.equal(deliveries.length, 1);
  assert.deepEqual(duplicate.envelope, result.envelope);
  cases.push('accepted-handoff-is-idempotent');

  const dispatchSnapshot = accepted.runtime.getContinuationDispatchSnapshot(
    accepted.interactionId, result.envelope.dispatchId
  );
  assert.equal(dispatchSnapshot.attempts.length, 1);
  assert.equal(dispatchSnapshot.outcomes.length, 1);
  assert.equal(dispatchSnapshot.latestOutcome.acknowledgement.receiptStatus, 'ACCEPTED');
  assert.equal('executionStatus' in dispatchSnapshot.latestOutcome.acknowledgement, false);
  cases.push('receipt-is-not-execution');

  const unknown = createConsumedAuthority('interaction-unknown');
  const unknownResult = createContinuationDispatcher({
    runtime: unknown.runtime, registrations: []
  }).dispatch(request(unknown.interactionId));
  assert.equal(unknownResult.outcome, 'TARGET_NOT_REGISTERED');
  assert.equal(unknown.runtime.getContinuationDispatchSnapshot(
    unknown.interactionId, request(unknown.interactionId).dispatchId
  ).attempts.length, 0);
  cases.push('unknown-target-fails-closed');

  const disabled = createConsumedAuthority('interaction-disabled');
  const disabledResult = createContinuationDispatcher({
    runtime: disabled.runtime,
    registrations: [registration(() => assert.fail('must not deliver'), { enabled: false })]
  }).dispatch(request(disabled.interactionId));
  assert.equal(disabledResult.outcome, 'TARGET_NOT_REGISTERED');
  cases.push('disabled-target-fails-closed');

  const mismatch = createConsumedAuthority('interaction-scope');
  const mismatchResult = createContinuationDispatcher({
    runtime: mismatch.runtime,
    registrations: [registration(() => assert.fail('must not deliver'), {
      acceptedAuthorityScopeContract: { action: 'merge' }
    })]
  }).dispatch(request(mismatch.interactionId));
  assert.equal(mismatchResult.outcome, 'TARGET_SCOPE_MISMATCH');
  assert.equal(mismatchResult.envelope.continuationTargetRef, targetRef);
  cases.push('scope-mismatch-cannot-redirect');

  const rejected = createConsumedAuthority('interaction-rejected');
  const rejectedResult = createContinuationDispatcher({
    runtime: rejected.runtime,
    registrations: [registration(() => ({ receiptStatus: 'REJECTED' }))]
  }).dispatch(request(rejected.interactionId));
  assert.equal(rejectedResult.outcome, 'DELIVERY_REJECTED');
  assert.equal(rejectedResult.acknowledgement.receiptStatus, 'REJECTED');
  cases.push('consumer-rejection-recorded');

  const unavailable = createConsumedAuthority('interaction-unavailable');
  const unavailableResult = createContinuationDispatcher({
    runtime: unavailable.runtime,
    registrations: [registration(() => {
      const error = new Error('offline');
      error.deliveryOutcome = 'DELIVERY_UNAVAILABLE';
      throw error;
    })]
  }).dispatch(request(unavailable.interactionId));
  assert.equal(unavailableResult.outcome, 'DELIVERY_UNAVAILABLE');
  cases.push('known-nondelivery-is-unavailable');

  const uncertain = createConsumedAuthority('interaction-uncertain');
  const uncertainResult = createContinuationDispatcher({
    runtime: uncertain.runtime,
    registrations: [registration(() => { throw new Error('lost acknowledgement'); })]
  }).dispatch(request(uncertain.interactionId));
  assert.equal(uncertainResult.outcome, 'DELIVERY_UNCERTAIN');
  const uncertainSnapshot = uncertain.runtime.getContinuationDispatchSnapshot(
    uncertain.interactionId, request(uncertain.interactionId).dispatchId
  );
  assert.equal(uncertainSnapshot.attempts.length, 1);
  assert.equal(uncertainSnapshot.latestOutcome.outcome, 'DELIVERY_UNCERTAIN');
  cases.push('delivered-unacknowledged-is-distinguishable');

  const retryDeliveries = [];
  const recoveredStoreState = uncertain.store.exportState();
  const recovered = makeRuntime(recoveredStoreState);
  const retryResult = createContinuationDispatcher({
    runtime: recovered.runtime,
    registrations: [registration((envelope) => {
      retryDeliveries.push(clone(envelope));
      return { receiptStatus: 'ACCEPTED', receiptRef: 'receipt-retry' };
    })]
  }).dispatch({ ...request(uncertain.interactionId, '2'), outcomeEventId: `${uncertain.interactionId}.outcome-2` });
  assert.equal(retryResult.outcome, 'DISPATCH_ACCEPTED');
  assert.equal(retryDeliveries.length, 1);
  assert.deepEqual(retryResult.envelope, uncertainResult.envelope);
  assert.equal(recovered.runtime.getContinuationDispatchSnapshot(
    uncertain.interactionId, retryResult.envelope.dispatchId
  ).attempts.length, 2);
  cases.push('pending-intent-recovery-preserves-envelope');

  const pending = createConsumedAuthority('interaction-pending');
  let pendingState = pending.runtime.prepareContinuationDispatch({
    interactionId: pending.interactionId,
    continuationId: `${pending.interactionId}.continuation`,
    dispatchId: `${pending.interactionId}.dispatch`,
    idempotencyKey: `${pending.interactionId}.idempotency`,
    eventId: `${pending.interactionId}.intent`,
    expectedRevision: pending.state.revision
  });
  const pendingRecovered = makeRuntime(pending.store.exportState());
  const pendingResult = createContinuationDispatcher({
    runtime: pendingRecovered.runtime,
    registrations: [registration(() => ({ receiptStatus: 'ACCEPTED', receiptRef: 'pending-receipt' }))]
  }).dispatch(request(pending.interactionId));
  assert.equal(pendingResult.outcome, 'DISPATCH_ACCEPTED');
  assert.equal(pendingResult.envelope.authorityCommittedRevision, pending.state.revision);
  cases.push('persisted-intent-recovers-before-delivery');

  const attempted = createConsumedAuthority('interaction-attempted');
  let attemptedState = attempted.runtime.prepareContinuationDispatch({
    interactionId: attempted.interactionId,
    continuationId: `${attempted.interactionId}.continuation`,
    dispatchId: `${attempted.interactionId}.dispatch`,
    idempotencyKey: `${attempted.interactionId}.idempotency`,
    eventId: `${attempted.interactionId}.intent`,
    expectedRevision: attempted.state.revision
  });
  attemptedState = attempted.runtime.recordContinuationDispatchAttempt({
    interactionId: attempted.interactionId,
    dispatchId: `${attempted.interactionId}.dispatch`,
    dispatchAttemptId: `${attempted.interactionId}.attempt-crashed`,
    eventId: `${attempted.interactionId}.attempt-event-crashed`,
    expectedRevision: attemptedState.revision
  });
  const attemptedRecovered = makeRuntime(attempted.store.exportState());
  const attemptedResult = createContinuationDispatcher({
    runtime: attemptedRecovered.runtime,
    registrations: [registration(() => ({ receiptStatus: 'ACCEPTED', receiptRef: 'attempt-retry' }))]
  }).dispatch(request(attempted.interactionId, '2'));
  assert.equal(attemptedResult.outcome, 'DISPATCH_ACCEPTED');
  assert.deepEqual(
    attemptedRecovered.runtime.getContinuationDispatchSnapshot(
      attempted.interactionId, attemptedResult.envelope.dispatchId
    ).attempts.map((item) => item.dispatchAttemptId),
    [`${attempted.interactionId}.attempt-crashed`, `${attempted.interactionId}.attempt-2`]
  );
  cases.push('persisted-attempt-recovers-with-new-attempt-id');

  const beforeIntent = createConsumedAuthority('interaction-before-intent');
  const beforeSeed = beforeIntent.store.exportState();
  const beforeRecovered = makeRuntime(beforeSeed);
  const beforeResult = createContinuationDispatcher({
    runtime: beforeRecovered.runtime,
    registrations: [registration(() => ({ receiptStatus: 'ACCEPTED' }))]
  }).dispatch(request(beforeIntent.interactionId));
  assert.equal(beforeResult.outcome, 'DISPATCH_ACCEPTED');
  assert.equal(beforeResult.envelope.continuationId, `${beforeIntent.interactionId}.continuation`);
  cases.push('crash-before-intent-does-not-recreate-authority');

  const stale = createConsumedAuthority('interaction-stale');
  assert.throws(() => stale.runtime.prepareContinuationDispatch({
    interactionId: stale.interactionId,
    continuationId: `${stale.interactionId}.continuation`,
    dispatchId: `${stale.interactionId}.dispatch`,
    idempotencyKey: `${stale.interactionId}.idempotency`,
    eventId: `${stale.interactionId}.intent`,
    expectedRevision: stale.state.revision - 1
  }), /AUTHORITY_STALE/);
  cases.push('stale-authority-fails-closed');

  const invalid = createConsumedAuthority('interaction-invalid');
  const invalidResult = createContinuationDispatcher({
    runtime: invalid.runtime,
    registrations: [registration(() => assert.fail('must not deliver'))]
  }).dispatch({ ...request(invalid.interactionId), continuationId: 'wrong-continuation' });
  assert.equal(invalidResult.outcome, 'INVALID_AUTHORITY');
  assert.equal(invalid.runtime.getContinuationDispatchSnapshot(
    invalid.interactionId, request(invalid.interactionId).dispatchId
  ), null);
  cases.push('invalid-authority-creates-no-intent');

  const notConsumed = makeRuntime();
  assert.equal(createContinuationDispatcher({
    runtime: notConsumed.runtime,
    registrations: [registration(() => assert.fail('must not deliver'))]
  }).dispatch(request('unknown-interaction')).outcome, 'INVALID_AUTHORITY');
  cases.push('no-dispatch-before-pass-and-consumption');

  assert.equal(typeof dispatcher.dispatch, 'function');
  assert.equal(Object.hasOwn(dispatcher, 'present'), false);
  assert.equal(Object.hasOwn(dispatcher, 'receiveHumanInput'), false);
  cases.push('presentation-and-human-input-cannot-dispatch');

  const resultEvidence = accepted.runtime.getInteractionSnapshot(accepted.interactionId).evidence
    .filter((item) => item.type.startsWith('CONTINUATION_DISPATCH_'));
  assert.deepEqual(resultEvidence.map((item) => item.type), [
    'CONTINUATION_DISPATCH_INTENT',
    'CONTINUATION_DISPATCH_ATTEMPT',
    'CONTINUATION_DISPATCH_OUTCOME'
  ]);
  cases.push('atomic-state-and-evidence-order');

  assert.throws(() => createContinuationDispatcher({
    runtime: accepted.runtime,
    registrations: [registration(() => null), registration(() => null)]
  }), /ambiguous target/);
  cases.push('ambiguous-registration-rejected');

  assert.equal(result.acknowledgement.receiptStatus, 'ACCEPTED');
  assert.equal(result.acknowledgement.receiptRef, 'receipt-1');
  assert.equal(Object.hasOwn(result.acknowledgement, 'scheduled'), false);
  cases.push('acknowledgement-is-receipt-only');

  const acceptedRecovered = makeRuntime(accepted.store.exportState());
  let redelivered = false;
  const recoveredAcceptedResult = createContinuationDispatcher({
    runtime: acceptedRecovered.runtime,
    registrations: [registration(() => { redelivered = true; return { receiptStatus: 'ACCEPTED' }; })]
  }).dispatch(request(accepted.interactionId, 'recovery'));
  assert.equal(recoveredAcceptedResult.outcome, 'ALREADY_DISPATCHED');
  assert.equal(redelivered, false);
  cases.push('persisted-acknowledgement-returns-without-redelivery');

  const inconsistentSeed = accepted.store.exportState();
  const inconsistentAggregate = inconsistentSeed[0];
  const acceptedIntent = inconsistentAggregate.evidence.find(
    (item) => item.type === 'CONTINUATION_DISPATCH_INTENT'
  );
  inconsistentAggregate.evidence.push({
    ...clone(acceptedIntent),
    eventId: `${accepted.interactionId}.duplicate-intent`
  });
  const inconsistent = makeRuntime(inconsistentSeed);
  const inconsistentResult = createContinuationDispatcher({
    runtime: inconsistent.runtime,
    registrations: [registration(() => assert.fail('must not redeliver'))]
  }).dispatch(request(accepted.interactionId, 'inconsistent'));
  assert.equal(inconsistentResult.outcome, 'INVALID_AUTHORITY');
  cases.push('inconsistent-recovery-evidence-fails-closed');

  const canonical = canonicalStringify({ cases, accepted: result, evidence: resultEvidence });
  return { cases, canonical, hash: crypto.createHash('sha256').update(canonical).digest('hex') };
}

const first = runSuite();
const second = runSuite();
assert.equal(first.canonical, second.canonical);
console.log(canonicalStringify({
  suite: 'authorized-continuation-handoff-dispatch-v0',
  status: 'PASS',
  cases: first.cases.length,
  deterministic: true,
  hash: first.hash
}));
