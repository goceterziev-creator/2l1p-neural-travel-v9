'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { canonicalStringify } = require('../human-intent-layer-v0/intent-layer');
const { createGovernedExecutionAcceptance } = require('./execution-acceptance');

const scope = { action: 'implementation', boundary: 'isolated-runtime' };

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function acceptedDispatch(overrides = {}) {
  const envelope = {
    dispatchId: 'dispatch-1',
    idempotencyKey: 'dispatch-key-1',
    continuationId: 'continuation-1',
    interactionId: 'interaction-1',
    gateId: 'gate-1',
    gateRevision: 1,
    authorityScope: clone(scope),
    continuationTargetRef: 'target.action-1',
    authorityEvidenceRef: 'continuation-1',
    governanceEvaluationRef: 'evaluation-1',
    authorityCommittedRevision: 5,
    ...(overrides.envelope || {})
  };
  const outcome = {
    type: 'CONTINUATION_DISPATCH_OUTCOME',
    eventId: 'dispatch-outcome-1',
    dispatchId: envelope.dispatchId,
    dispatchAttemptId: 'attempt-1',
    outcome: 'DISPATCH_ACCEPTED',
    acknowledgement: {
      receiptStatus: 'ACCEPTED',
      dispatchId: envelope.dispatchId,
      idempotencyKey: envelope.idempotencyKey,
      continuationTargetRef: envelope.continuationTargetRef,
      receiptRef: 'receipt-1'
    },
    registrationIdentity: 'dispatch-registration-1',
    registrationRevision: '1',
    recordedRevision: 8,
    ...(overrides.outcome || {})
  };
  return {
    dispatchId: envelope.dispatchId,
    envelope,
    intentRevision: 6,
    attempts: [{ dispatchAttemptId: 'attempt-1' }],
    outcomes: [outcome],
    latestOutcome: outcome,
    ...overrides.snapshot
  };
}

function actionRegistration(overrides = {}) {
  return {
    actionIdentity: 'action-1',
    actionRevision: '1',
    registrationIdentity: 'action-registration-1',
    registrationRevision: '1',
    dispatchRegistrationIdentity: 'dispatch-registration-1',
    continuationTargetRef: 'target.action-1',
    acceptedAuthorityScopeContract: clone(scope),
    inputDerivationContract: { identity: 'derive-action-1', revision: '1' },
    executionOwnerIdentity: 'execution-owner-1',
    enabled: true,
    effectIdempotencyCapability: 'DECLARED_BY_FUTURE_ADAPTER',
    resultEvidenceGrammarRef: 'result-grammar-1',
    immutableConfiguration: { inputRef: 'input-1', inputDigest: 'digest-1' },
    deriveActionInput: ({ immutableConfiguration }) => ({
      inputRef: immutableConfiguration.inputRef,
      inputDigest: immutableConfiguration.inputDigest,
      derivationIdentity: 'derive-action-1',
      derivationRevision: '1'
    }),
    acceptancePolicy: () => ({ accepted: true }),
    ...overrides
  };
}

function acceptanceRequest(overrides = {}) {
  return {
    dispatchId: 'dispatch-1',
    actionRequest: {
      expectedDispatchOutcomeRef: 'dispatch-outcome-1',
      expectedActionIdentity: 'action-1',
      expectedActionRevision: '1',
      expectedRegistrationRevision: '1'
    },
    executionAcceptanceId: 'execution-acceptance-1',
    ...overrides
  };
}

function createStore({
  seed = [],
  commitMode = 'NORMAL',
  currentRegistrationIdentity = 'action-registration-1',
  currentRegistrationRevision = '1',
  currentEffectIdempotencyCapability = 'DECLARED_BY_FUTURE_ADAPTER',
  currentResultEvidenceGrammarRef = 'result-grammar-1'
} = {}) {
  const records = seed.map(clone);
  let mode = commitMode;
  function findByDispatch(dispatchId) {
    return records.filter((record) => record.dispatchId === dispatchId).map(clone);
  }
  function findByTuple(tuple) {
    return records.filter((record) => record.dispatchId === tuple.dispatchId
      && record.actionIdentity === tuple.actionIdentity
      && record.actionRevision === tuple.actionRevision).map(clone);
  }
  function findById(id) {
    return records.filter((record) => record.executionAcceptanceId === id).map(clone);
  }
  function commit(record, { registrationGuard } = {}) {
    if (!registrationGuard
      || registrationGuard.registrationIdentity !== currentRegistrationIdentity
      || registrationGuard.registrationRevision !== currentRegistrationRevision
      || registrationGuard.effectIdempotencyCapability !== currentEffectIdempotencyCapability
      || registrationGuard.resultEvidenceGrammarRef !== currentResultEvidenceGrammarRef) {
      const error = new Error('stale action registration');
      error.code = 'ACCEPTANCE_STALE';
      throw error;
    }
    if (mode === 'THROW_BEFORE') throw new Error('persistence unavailable');
    if (findByTuple(record).length || findById(record.executionAcceptanceId).length) {
      throw new Error('acceptance conflict');
    }
    const committed = { ...clone(record), acceptanceRevision: records.length + 1 };
    records.push(committed);
    if (mode === 'STORE_THEN_THROW') throw new Error('caller did not observe commit');
    return clone(committed);
  }
  return Object.freeze({
    findByDispatch,
    findByTuple,
    findById,
    commit,
    exportState: () => records.map(clone),
    setCommitMode: (next) => { mode = next; }
  });
}

function createHarness({
  dispatchSnapshot = acceptedDispatch(),
  dispatchSnapshotError = null,
  registrations = [actionRegistration()],
  store = createStore()
} = {}) {
  let registryCalls = 0;
  const acceptance = createGovernedExecutionAcceptance({
    dispatchSnapshotPort: (dispatchId) => {
      if (dispatchSnapshotError) throw dispatchSnapshotError;
      return dispatchSnapshot && dispatchSnapshot.dispatchId === dispatchId
        ? clone(dispatchSnapshot)
        : null;
    },
    actionRegistryPort: ({ actionIdentity, actionRevision }) => {
      registryCalls += 1;
      return registrations.filter((item) => item.actionIdentity === actionIdentity
        && item.actionRevision === actionRevision);
    },
    acceptanceStore: store
  });
  return { acceptance, store, registryCalls: () => registryCalls };
}

function runSuite() {
  const cases = [];
  let productEffects = 0;
  const registration = actionRegistration({
    immutableConfiguration: { inputRef: 'input-1', inputDigest: 'digest-1' },
    deriveActionInput: ({ immutableConfiguration }) => ({
      inputRef: immutableConfiguration.inputRef,
      inputDigest: immutableConfiguration.inputDigest,
      derivationIdentity: 'derive-action-1',
      derivationRevision: '1'
    }),
    acceptancePolicy: () => ({ accepted: true })
  });
  const primary = createHarness({ registrations: [registration] });
  const accepted = primary.acceptance.accept(acceptanceRequest());
  assert.equal(accepted.outcome, 'EXECUTION_ACCEPTED');
  assert.equal(accepted.acceptance.executionAcceptanceId, 'execution-acceptance-1');
  assert.notEqual(accepted.acceptance.executionAcceptanceId, accepted.acceptance.dispatchId);
  cases.push('exact-dispatch-produces-distinct-acceptance');

  assert.deepEqual(accepted.acceptance.authorityScope, scope);
  assert.equal(accepted.acceptance.continuationTargetRef, 'target.action-1');
  assert.equal(accepted.acceptance.executionOwnerIdentity, 'execution-owner-1');
  assert.deepEqual(accepted.acceptance.actionInputBinding, {
    inputRef: 'input-1', inputDigest: 'digest-1',
    derivationIdentity: 'derive-action-1', derivationRevision: '1'
  });
  cases.push('exact-action-owner-scope-and-input-binding');

  assert.equal(accepted.acceptance.effectIdempotencyCapability, 'DECLARED_BY_FUTURE_ADAPTER');
  assert.equal(accepted.acceptance.resultEvidenceGrammarRef, 'result-grammar-1');
  const fabricatedMetadata = createHarness().acceptance.accept(acceptanceRequest({
    actionRequest: {
      ...acceptanceRequest().actionRequest,
      effectIdempotencyCapability: 'CALLER-FABRICATED-EFFECT',
      resultEvidenceGrammarRef: 'caller-fabricated-result'
    }
  }));
  assert.equal(fabricatedMetadata.acceptance.effectIdempotencyCapability,
    'DECLARED_BY_FUTURE_ADAPTER');
  assert.equal(fabricatedMetadata.acceptance.resultEvidenceGrammarRef, 'result-grammar-1');
  cases.push('accepted-effect-and-result-contract-metadata-is-registration-derived');

  const duplicate = primary.acceptance.accept(acceptanceRequest());
  assert.equal(duplicate.outcome, 'ALREADY_ACCEPTED');
  assert.deepEqual(duplicate.acceptance, accepted.acceptance);
  assert.equal(primary.registryCalls(), 1);
  cases.push('exact-duplicate-returns-prior-evidence');

  const conflict = primary.acceptance.accept(acceptanceRequest({
    executionAcceptanceId: 'execution-acceptance-conflict'
  }));
  assert.equal(conflict.outcome, 'INVALID_EXECUTION_AUTHORITY');
  cases.push('conflicting-acceptance-id-fails-closed');

  const absent = createHarness({ dispatchSnapshot: null })
    .acceptance.accept(acceptanceRequest({ acceptedDispatchSnapshot: acceptedDispatch() }));
  assert.equal(absent.outcome, 'DISPATCH_NOT_ACCEPTED');
  cases.push('caller-cannot-supply-or-fabricate-dispatch-evidence');

  const unavailableEvidence = createHarness({ dispatchSnapshotError: new Error('unavailable') })
    .acceptance.accept(acceptanceRequest());
  assert.equal(unavailableEvidence.outcome, 'ACCEPTANCE_UNCERTAIN');
  cases.push('authoritative-dispatch-evidence-unavailable-fails-closed');

  const notAcceptedSnapshot = acceptedDispatch();
  notAcceptedSnapshot.outcomes[0].outcome = 'DELIVERY_REJECTED';
  notAcceptedSnapshot.latestOutcome = notAcceptedSnapshot.outcomes[0];
  const notAccepted = createHarness({ dispatchSnapshot: notAcceptedSnapshot })
    .acceptance.accept(acceptanceRequest());
  assert.equal(notAccepted.outcome, 'DISPATCH_NOT_ACCEPTED');
  cases.push('non-accepted-dispatch-rejected');

  const receiptMismatchSnapshot = acceptedDispatch();
  receiptMismatchSnapshot.outcomes[0].acknowledgement.idempotencyKey = 'wrong-key';
  const receiptMismatch = createHarness({ dispatchSnapshot: receiptMismatchSnapshot })
    .acceptance.accept(acceptanceRequest());
  assert.equal(receiptMismatch.outcome, 'DISPATCH_NOT_ACCEPTED');
  cases.push('intent-outcome-receipt-correspondence-required');

  const wrongOutcomeRef = createHarness().acceptance.accept(acceptanceRequest({
    actionRequest: { ...acceptanceRequest().actionRequest, expectedDispatchOutcomeRef: 'other-outcome' }
  }));
  assert.equal(wrongOutcomeRef.outcome, 'INVALID_EXECUTION_AUTHORITY');
  cases.push('exact-dispatch-evidence-reference-required');

  const unknown = createHarness({ registrations: [] }).acceptance.accept(acceptanceRequest());
  assert.equal(unknown.outcome, 'ACTION_NOT_REGISTERED');
  cases.push('unknown-action-fails-closed');

  const disabled = createHarness({
    registrations: [actionRegistration({ enabled: false })]
  }).acceptance.accept(acceptanceRequest());
  assert.equal(disabled.outcome, 'EXECUTION_REJECTED');
  cases.push('disabled-owner-rejects');

  const rejected = createHarness({
    registrations: [actionRegistration({ acceptancePolicy: () => ({ accepted: false, reason: 'owner policy' }) })]
  }).acceptance.accept(acceptanceRequest());
  assert.equal(rejected.outcome, 'EXECUTION_REJECTED');
  assert.equal(rejected.reason, 'owner policy');
  cases.push('owner-rejection-cannot-retarget');

  for (const [name, override] of [
    ['target', { continuationTargetRef: 'target.other' }],
    ['scope', { acceptedAuthorityScopeContract: { action: 'merge' } }],
    ['dispatch-owner', { dispatchRegistrationIdentity: 'other-dispatch-owner' }]
  ]) {
    const result = createHarness({ registrations: [actionRegistration(override)] })
      .acceptance.accept(acceptanceRequest());
    assert.equal(result.outcome, 'ACTION_SCOPE_MISMATCH');
    assert.equal(result.acceptance, null);
    cases.push(`exact-${name}-binding-required`);
  }

  const stale = createHarness({
    registrations: [actionRegistration({ registrationRevision: '2' })]
  }).acceptance.accept(acceptanceRequest());
  assert.equal(stale.outcome, 'ACCEPTANCE_STALE');
  cases.push('stale-registration-fails-closed');

  const concurrentStaleStore = createStore({ currentRegistrationRevision: '2' });
  const concurrentStale = createHarness({ store: concurrentStaleStore })
    .acceptance.accept(acceptanceRequest());
  assert.equal(concurrentStale.outcome, 'ACCEPTANCE_STALE');
  assert.equal(concurrentStaleStore.exportState().length, 0);
  cases.push('registration-change-before-atomic-commit-fails-stale');

  const metadataDriftStore = createStore({
    currentEffectIdempotencyCapability: 'changed-effect-contract',
    currentResultEvidenceGrammarRef: 'changed-result-grammar'
  });
  const metadataDrift = createHarness({ store: metadataDriftStore })
    .acceptance.accept(acceptanceRequest());
  assert.equal(metadataDrift.outcome, 'ACCEPTANCE_STALE');
  assert.equal(metadataDriftStore.exportState().length, 0);
  cases.push('effect-and-result-contract-drift-before-commit-fails-stale');

  const otherRevision = createHarness({
    store: primary.store,
    registrations: [actionRegistration({ actionRevision: '2' })]
  }).acceptance.accept(acceptanceRequest({
    actionRequest: { ...acceptanceRequest().actionRequest, expectedActionRevision: '2' },
    executionAcceptanceId: 'execution-acceptance-revision-2'
  }));
  assert.equal(otherRevision.outcome, 'INVALID_EXECUTION_AUTHORITY');
  cases.push('different-action-revision-cannot-reuse-authority');

  const otherAction = createHarness({
    store: primary.store,
    registrations: [actionRegistration({ actionIdentity: 'action-2' })]
  }).acceptance.accept(acceptanceRequest({
    actionRequest: { ...acceptanceRequest().actionRequest, expectedActionIdentity: 'action-2' },
    executionAcceptanceId: 'execution-acceptance-action-2'
  }));
  assert.equal(otherAction.outcome, 'INVALID_EXECUTION_AUTHORITY');
  cases.push('different-action-cannot-reuse-authority');

  const badBinding = createHarness({
    registrations: [actionRegistration({
      deriveActionInput: () => ({
        inputRef: 'input-1', inputDigest: 'digest-1',
        derivationIdentity: 'unregistered-derivation', derivationRevision: '1'
      })
    })]
  }).acceptance.accept(acceptanceRequest());
  assert.equal(badBinding.outcome, 'INVALID_EXECUTION_AUTHORITY');
  cases.push('input-derivation-contract-is-exact');

  const derivationUncertain = createHarness({
    registrations: [actionRegistration({ deriveActionInput: () => { throw new Error('uncertain'); } })]
  }).acceptance.accept(acceptanceRequest());
  assert.equal(derivationUncertain.outcome, 'ACCEPTANCE_UNCERTAIN');
  cases.push('uncertain-derivation-creates-no-authority');

  const beforeStore = createStore({ commitMode: 'THROW_BEFORE' });
  const beforeHarness = createHarness({ store: beforeStore });
  const uncertainCommit = beforeHarness.acceptance.accept(acceptanceRequest());
  assert.equal(uncertainCommit.outcome, 'ACCEPTANCE_UNCERTAIN');
  assert.equal(beforeStore.exportState().length, 0);
  beforeStore.setCommitMode('NORMAL');
  const retry = beforeHarness.acceptance.accept(acceptanceRequest());
  assert.equal(retry.outcome, 'EXECUTION_ACCEPTED');
  cases.push('pre-commit-failure-retries-same-identity');

  const afterStore = createStore({ commitMode: 'STORE_THEN_THROW' });
  const afterResult = createHarness({ store: afterStore }).acceptance.accept(acceptanceRequest());
  assert.equal(afterResult.outcome, 'ALREADY_ACCEPTED');
  assert.equal(afterResult.acceptance.executionAcceptanceId, 'execution-acceptance-1');
  cases.push('post-commit-uncertainty-recovers-original');

  const recoveredStore = createStore({ seed: primary.store.exportState() });
  const recoveredResult = createHarness({
    store: recoveredStore,
    registrations: [actionRegistration({
      registrationRevision: '99',
      effectIdempotencyCapability: 'later-effect-contract',
      resultEvidenceGrammarRef: 'later-result-grammar'
    })]
  }).acceptance.accept(acceptanceRequest());
  assert.equal(recoveredResult.outcome, 'ALREADY_ACCEPTED');
  assert.deepEqual(recoveredResult.acceptance, accepted.acceptance);
  assert.equal(recoveredResult.acceptance.effectIdempotencyCapability,
    'DECLARED_BY_FUTURE_ADAPTER');
  assert.equal(recoveredResult.acceptance.resultEvidenceGrammarRef, 'result-grammar-1');
  cases.push('accepted-record-survives-registration-change');

  const metadataConflictSeed = primary.store.exportState();
  metadataConflictSeed.push({
    ...clone(metadataConflictSeed[0]),
    executionAcceptanceId: 'metadata-conflict',
    effectIdempotencyCapability: 'substituted-effect-contract',
    resultEvidenceGrammarRef: 'substituted-result-grammar'
  });
  const metadataConflict = createHarness({ store: createStore({ seed: metadataConflictSeed }) })
    .acceptance.accept(acceptanceRequest());
  assert.equal(metadataConflict.outcome, 'INVALID_EXECUTION_AUTHORITY');
  cases.push('conflicting-contract-metadata-cannot-substitute-accepted-evidence');

  const incompleteMetadataSeed = primary.store.exportState();
  delete incompleteMetadataSeed[0].resultEvidenceGrammarRef;
  const incompleteMetadata = createHarness({ store: createStore({ seed: incompleteMetadataSeed }) })
    .acceptance.accept(acceptanceRequest());
  assert.equal(incompleteMetadata.outcome, 'INVALID_EXECUTION_AUTHORITY');
  cases.push('incomplete-accepted-contract-metadata-fails-closed');

  const corruptSeed = primary.store.exportState();
  corruptSeed.push({ ...clone(corruptSeed[0]), executionAcceptanceId: 'duplicate-corrupt' });
  const corrupt = createHarness({ store: createStore({ seed: corruptSeed }) })
    .acceptance.accept(acceptanceRequest());
  assert.equal(corrupt.outcome, 'INVALID_EXECUTION_AUTHORITY');
  cases.push('corrupt-recovery-evidence-fails-closed');

  assert.equal(productEffects, 0);
  assert.equal(Object.hasOwn(primary.acceptance, 'schedule'), false);
  assert.equal(Object.hasOwn(primary.acceptance, 'execute'), false);
  assert.equal(Object.hasOwn(primary.acceptance, 'present'), false);
  assert.equal(Object.hasOwn(primary.acceptance, 'receiveHumanInput'), false);
  for (const forbidden of ['scheduled', 'started', 'completed', 'success', 'executionAttemptId']) {
    assert.equal(Object.hasOwn(accepted.acceptance, forbidden), false);
  }
  cases.push('acceptance-has-zero-product-effect-or-lifecycle-claim');

  const canonical = canonicalStringify({
    cases,
    accepted: accepted.acceptance,
    outcomes: [absent.outcome, unknown.outcome, stale.outcome, uncertainCommit.outcome]
  });
  return {
    cases,
    canonical,
    hash: crypto.createHash('sha256').update(canonical).digest('hex')
  };
}

const first = runSuite();
const second = runSuite();
assert.equal(first.canonical, second.canonical);
console.log(canonicalStringify({
  suite: 'governed-execution-acceptance-v0',
  status: 'PASS',
  cases: first.cases.length,
  deterministic: true,
  hash: first.hash
}));
