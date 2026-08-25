'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { canonicalStringify } = require('../human-intent-layer-v0/intent-layer');
const { START_OUTCOMES,
  createGovernedExecutionAttemptStart } = require('./execution-attempt-start');

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const authorityScope = Object.freeze({ action: 'update-offer', offerId: 'offer-1' });

function claim(overrides = {}) {
  return {
    type: 'EXECUTION_ATTEMPT_CLAIM', status: 'ATTEMPT_CLAIMED',
    attemptClaimId: 'claim-1', claimRevision: 1, claimOrdinal: 1,
    previousAttemptClaimId: null, executionAttemptId: 'attempt-1',
    attemptEvidenceRef: 'attempt-evidence-1', attemptRevision: 1,
    executionId: 'execution-1', executionAcceptanceId: 'acceptance-1',
    preparationEvidenceRef: 'preparation-evidence-1', preparationRevision: 1,
    dispatchId: 'dispatch-1', continuationId: 'continuation-1',
    interactionId: 'interaction-1', gateId: 'gate-1', gateRevision: 2,
    authorityEvidenceRef: 'authority-1', governanceEvaluationRef: 'evaluation-1',
    authorityScope: clone(authorityScope), actionIdentity: 'offer.update', actionRevision: '1',
    continuationTargetRef: 'offer.update:offer-1',
    executionOwnerIdentity: 'offer-execution-owner', inputRef: 'input:offer-1',
    verifiedInputDigest: 'sha256:input-1', verifiedInputEvidenceRef: 'input-evidence-1',
    effectContractRef: 'effect-contract-1', effectContractRevision: '1',
    effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY',
    logicalEffectId: 'effect:execution-1:sha256:input-1',
    resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1',
    adapterRegistrationEvidenceRef: 'adapter-registration-evidence-1',
    adapterRegistrationIdentity: 'adapter-registration-1', adapterRegistrationRevision: '1',
    adapterIdentity: 'offer-adapter', adapterRevision: '1',
    attemptOwnerIdentity: 'worker-1', ownerIdentityEvidenceRef: 'owner-evidence:worker-1',
    ownerIdentityRevision: '1', compatibilityEvidenceRef: 'compatibility-evidence-1',
    reassignmentEligibilityEvidenceRef: null, exclusiveOwnership: true,
    ownershipState: 'ACTIVE', ...clone(overrides)
  };
}

function claimSnapshot(record = claim(), overrides = {}) {
  return {
    evidenceRef: 'claim-evidence-1', claimHistoryRevision: 1,
    currentClaimId: record && record.attemptClaimId,
    competingActiveClaim: false, uncertainClaimHistory: false,
    conflictingLifecycleEvidence: false, adapterRegistrationCurrent: true,
    ownerIdentityCurrent: true, record: clone(record), ...clone(overrides)
  };
}

function createLedger({ snapshot = claimSnapshot(), seed = [], mode = 'NORMAL',
  errorCode = null, corruptReturn = false, duplicateById = false,
  duplicateByAttempt = false } = {}) {
  const records = seed.map(clone);
  let commits = 0;
  return {
    records, get commits() { return commits; },
    findClaimSnapshot(id) {
      if (!snapshot || !snapshot.record || snapshot.record.attemptClaimId !== id) return null;
      return clone(snapshot);
    },
    findStartByAttempt(id) {
      const found = records.filter((record) => record.executionAttemptId === id).map(clone);
      return duplicateByAttempt && found.length ? [found[0], clone(found[0])] : found;
    },
    findStartById(id) {
      const found = records.filter((record) => record.executionStartId === id).map(clone);
      return duplicateById && found.length ? [found[0], clone(found[0])] : found;
    },
    commitStart(record, guards) {
      commits += 1;
      if (!guards || guards.claimGuard.claimRevision !== 1
        || guards.claimGuard.claimHistoryRevision !== 1
        || guards.claimGuard.ownershipState !== 'ACTIVE'
        || guards.attemptGuard.attemptRevision !== 1
        || guards.registrationGuard.registrationRevision !== '1'
        || guards.ownerGuard.identityRevision !== '1'
        || guards.contractGuard.verifiedInputDigest !== 'sha256:input-1'
        || guards.lifecycleGuard.noPriorStart !== true) {
        const error = new Error('guard changed'); error.code = 'START_STALE'; throw error;
      }
      if (errorCode) { const error = new Error(errorCode); error.code = errorCode; throw error; }
      if (mode === 'THROW_BEFORE') throw new Error('ledger unavailable');
      if (records.some((entry) => entry.executionStartId === record.executionStartId)) {
        throw new Error('unique Start identity conflict');
      }
      if (records.some((entry) => entry.executionAttemptId === record.executionAttemptId)) {
        const error = new Error('Start exists'); error.code = 'START_ALREADY_EXISTS'; throw error;
      }
      records.push(clone(record));
      if (mode === 'STORE_THEN_THROW') throw new Error('response lost');
      return corruptReturn ? { ...clone(record), actionRevision: 'corrupt' } : clone(record);
    }
  };
}

function harness(overrides = {}) {
  const record = Object.hasOwn(overrides, 'claimRecord') ? overrides.claimRecord : claim();
  const snapshot = Object.hasOwn(overrides, 'snapshot')
    ? overrides.snapshot : claimSnapshot(record, overrides.snapshotOverrides || {});
  const ledger = overrides.ledger || createLedger({ snapshot });
  const calls = { scheduler: 0, worker: 0, executor: 0, effectIntent: 0,
    provider: 0, product: 0, effect: 0, result: 0, completion: 0 };
  return { component: createGovernedExecutionAttemptStart({ startLedger: ledger }),
    ledger, calls };
}

const request = Object.freeze({ executionStartId: 'start-1', executionAttemptId: 'attempt-1',
  attemptClaimId: 'claim-1', expectedClaimRevision: 1, expectedAttemptRevision: 1,
  expectedClaimHistoryRevision: 1, expectedAdapterRegistrationRevision: '1',
  expectedOwnerIdentityRevision: '1' });

function createStart(overrides = {}) {
  const h = harness(overrides);
  const response = h.component.start(request);
  assert.equal(response.outcome, 'EXECUTION_ATTEMPT_STARTED');
  return { h, start: response.start };
}

function runSuite() {
  const cases = [];
  const observations = [];
  const check = (name, fn) => { fn(); cases.push(name); };

  check('no-start-without-authoritative-claim', () => {
    assert.equal(harness({ claimRecord: null, snapshot: null }).component.start(request).outcome,
      'CLAIM_NOT_FOUND');
  });
  check('caller-fabricated-claim-fields-do-not-grant-start', () => {
    assert.equal(harness({ claimRecord: null, snapshot: null }).component.start({ ...request,
      status: 'ATTEMPT_CLAIMED', ownershipState: 'ACTIVE' }).outcome, 'CLAIM_NOT_FOUND');
  });
  check('corrupt-authoritative-claim-fails-closed', () => {
    assert.equal(harness({ claimRecord: claim({ verifiedInputDigest: '' }) })
      .component.start(request).outcome, 'INVALID_CLAIM');
  });
  for (const state of ['RELEASED', 'STALE', 'REVOKED', 'UNCERTAIN']) {
    check(`${state.toLowerCase()}-claim-cannot-start`, () => {
      assert.equal(harness({ claimRecord: claim({ ownershipState: state }) })
        .component.start(request).outcome, 'CLAIM_NOT_ACTIVE');
    });
  }
  check('exact-current-claim-revision-required', () => {
    assert.equal(harness().component.start({ ...request, expectedClaimRevision: 2 }).outcome,
      'START_STALE');
  });
  check('exact-attempt-revision-required', () => {
    assert.equal(harness().component.start({ ...request, expectedAttemptRevision: 2 }).outcome,
      'START_STALE');
  });
  check('exact-claim-history-revision-required', () => {
    assert.equal(harness().component.start({ ...request,
      expectedClaimHistoryRevision: 2 }).outcome, 'START_STALE');
  });

  const primary = createStart();
  check('start-has-distinct-immutable-identity', () => {
    assert.equal(primary.start.executionStartId, 'start-1');
    assert.equal(primary.start.startRevision, 1);
    assert.equal(primary.start.singleAuthoritativeStart, true);
  });
  check('start-id-is-distinct-from-upstream-and-effect-identities', () => {
    for (const executionStartId of ['attempt-1', 'claim-1',
      'effect:execution-1:sha256:input-1']) {
      assert.equal(harness().component.start({ ...request, executionStartId }).outcome,
        'START_REJECTED');
    }
  });
  check('exact-duplicate-returns-original-start', () => {
    const replay = primary.h.component.start(request);
    assert.equal(replay.outcome, 'ALREADY_STARTED');
    assert.deepEqual(replay.start, primary.start);
    assert.equal(primary.h.ledger.commits, 1);
  });
  check('different-start-id-after-start-is-rejected', () => {
    const response = primary.h.component.start({ ...request, executionStartId: 'start-2' });
    assert.equal(response.outcome, 'START_ALREADY_EXISTS');
    assert.deepEqual(response.start, primary.start);
  });
  check('start-id-cannot-cross-attempt-boundary', () => {
    const secondClaim = claim({ attemptClaimId: 'claim-2', executionAttemptId: 'attempt-2',
      attemptEvidenceRef: 'attempt-evidence-2' });
    const ledger = createLedger({ snapshot: claimSnapshot(secondClaim, {
      evidenceRef: 'claim-evidence-2', currentClaimId: 'claim-2' }), seed: [primary.start] });
    assert.equal(harness({ ledger }).component.start({ ...request,
      executionAttemptId: 'attempt-2', attemptClaimId: 'claim-2' }).outcome, 'START_REJECTED');
  });
  check('start-id-cannot-cross-claim-boundary', () => {
    const secondClaim = claim({ attemptClaimId: 'claim-2', claimOrdinal: 2,
      previousAttemptClaimId: 'claim-1' });
    const ledger = createLedger({ snapshot: claimSnapshot(secondClaim, {
      currentClaimId: 'claim-2', claimHistoryRevision: 2 }), seed: [primary.start] });
    assert.equal(harness({ ledger }).component.start({ ...request, attemptClaimId: 'claim-2',
      expectedClaimHistoryRevision: 2 }).outcome, 'START_REJECTED');
  });

  check('competing-active-claim-fails-closed', () => {
    assert.equal(harness({ snapshotOverrides: { competingActiveClaim: true } })
      .component.start(request).outcome, 'CLAIM_NOT_CURRENT');
  });
  check('superseded-current-claim-fails-closed', () => {
    assert.equal(harness({ snapshotOverrides: { currentClaimId: 'claim-2' } })
      .component.start(request).outcome, 'CLAIM_NOT_CURRENT');
  });
  check('uncertain-claim-history-fails-closed', () => {
    assert.equal(harness({ snapshotOverrides: { uncertainClaimHistory: true } })
      .component.start(request).outcome, 'CLAIM_NOT_CURRENT');
  });
  check('conflicting-lifecycle-evidence-fails-closed', () => {
    assert.equal(harness({ snapshotOverrides: { conflictingLifecycleEvidence: true } })
      .component.start(request).outcome, 'CLAIM_NOT_CURRENT');
  });
  check('pre-commit-adapter-drift-fails-stale', () => {
    assert.equal(harness().component.start({ ...request,
      expectedAdapterRegistrationRevision: '2' }).outcome, 'START_STALE');
  });
  check('pre-commit-adapter-disablement-fails-stale', () => {
    assert.equal(harness({ snapshotOverrides: { adapterRegistrationCurrent: false } })
      .component.start(request).outcome, 'START_STALE');
  });
  check('pre-commit-owner-drift-fails-stale', () => {
    assert.equal(harness().component.start({ ...request,
      expectedOwnerIdentityRevision: '2' }).outcome, 'START_STALE');
  });
  check('pre-commit-owner-currentness-is-required', () => {
    assert.equal(harness({ snapshotOverrides: { ownerIdentityCurrent: false } })
      .component.start(request).outcome, 'START_STALE');
  });

  check('post-commit-adapter-drift-cannot-rewrite-start', () => {
    const drifted = claimSnapshot(claim({ adapterRegistrationRevision: '2' }), {
      adapterRegistrationCurrent: false });
    const replay = harness({ ledger: createLedger({ snapshot: drifted,
      seed: [primary.start] }) }).component.start(request);
    assert.equal(replay.outcome, 'ALREADY_STARTED');
    assert.deepEqual(replay.start, primary.start);
  });
  check('post-commit-owner-drift-cannot-rewrite-start', () => {
    const drifted = claimSnapshot(claim({ ownerIdentityRevision: '2' }), {
      ownerIdentityCurrent: false });
    const replay = harness({ ledger: createLedger({ snapshot: drifted,
      seed: [primary.start] }) }).component.start(request);
    assert.equal(replay.outcome, 'ALREADY_STARTED');
    assert.deepEqual(replay.start, primary.start);
  });
  check('post-commit-claim-history-drift-cannot-rewrite-start', () => {
    const drifted = claimSnapshot(claim(), { claimHistoryRevision: 2 });
    const replay = harness({ ledger: createLedger({ snapshot: drifted,
      seed: [primary.start] }) }).component.start(request);
    assert.equal(replay.outcome, 'ALREADY_STARTED');
    assert.deepEqual(replay.start, primary.start);
  });

  check('start-preserves-authority-and-action-lineage', () => {
    assert.equal(primary.start.executionId, 'execution-1');
    assert.equal(primary.start.executionAcceptanceId, 'acceptance-1');
    assert.equal(primary.start.actionIdentity, 'offer.update');
    assert.equal(primary.start.continuationTargetRef, 'offer.update:offer-1');
    assert.deepEqual(primary.start.authorityScope, authorityScope);
    assert.equal(primary.start.executionOwnerIdentity, 'offer-execution-owner');
  });
  check('start-preserves-immutable-input', () => {
    assert.equal(primary.start.inputRef, 'input:offer-1');
    assert.equal(primary.start.verifiedInputDigest, 'sha256:input-1');
    assert.equal(primary.start.verifiedInputEvidenceRef, 'input-evidence-1');
  });
  check('start-preserves-effect-contract-and-logical-effect', () => {
    assert.equal(primary.start.effectContractRef, 'effect-contract-1');
    assert.equal(primary.start.effectContractRevision, '1');
    assert.equal(primary.start.effectIdempotencyClass, 'IDEMPOTENT_WITH_STABLE_KEY');
    assert.equal(primary.start.logicalEffectId, 'effect:execution-1:sha256:input-1');
  });
  check('start-preserves-result-grammar', () => {
    assert.equal(primary.start.resultEvidenceGrammarRef, 'result-grammar-1');
    assert.equal(primary.start.resultEvidenceGrammarRevision, '1');
  });
  check('no-external-effect-start-supports-null-logical-effect', () => {
    const { start } = createStart({ claimRecord: claim({
      effectIdempotencyClass: 'NO_EXTERNAL_EFFECT', logicalEffectId: null }) });
    assert.equal(start.logicalEffectId, null);
  });

  check('committed-response-loss-recovers-original-start', () => {
    const ledger = createLedger({ mode: 'STORE_THEN_THROW' });
    const response = harness({ ledger }).component.start(request);
    assert.equal(response.outcome, 'ALREADY_STARTED');
    assert.equal(response.start.executionStartId, 'start-1');
    assert.equal(ledger.records.length, 1);
  });
  check('pre-commit-failure-is-uncertain-and-creates-no-start', () => {
    const ledger = createLedger({ mode: 'THROW_BEFORE' });
    const response = harness({ ledger }).component.start(request);
    assert.equal(response.outcome, 'START_UNCERTAIN');
    assert.equal(ledger.records.length, 0);
  });
  for (const code of ['START_STALE', 'CLAIM_NOT_CURRENT', 'CLAIM_NOT_ACTIVE',
    'START_ALREADY_EXISTS']) {
    check(`atomic-${code.toLowerCase()}-guard-fails-closed`, () => {
      assert.equal(harness({ ledger: createLedger({ errorCode: code }) })
        .component.start(request).outcome, code);
    });
  }
  check('inconsistent-commit-result-is-uncertain', () => {
    assert.equal(harness({ ledger: createLedger({ corruptReturn: true }) })
      .component.start(request).outcome, 'START_UNCERTAIN');
  });
  check('duplicate-start-id-evidence-is-uncertain', () => {
    const ledger = createLedger({ seed: [primary.start], duplicateById: true });
    assert.equal(harness({ ledger }).component.start(request).outcome, 'START_UNCERTAIN');
  });
  check('duplicate-attempt-start-evidence-is-uncertain', () => {
    const ledger = createLedger({ seed: [primary.start], duplicateByAttempt: true });
    assert.equal(harness({ ledger }).component.start({ ...request,
      executionStartId: 'start-2' }).outcome, 'START_UNCERTAIN');
  });

  check('start-record-has-no-downstream-evidence', () => {
    for (const key of ['schedulerAssignment', 'workerDelivery', 'executorInvocation',
      'effectInvocationIntent', 'effectAcknowledgement', 'result', 'completion',
      'completed', 'success']) assert.equal(key in primary.start, false);
  });
  check('start-cannot-author-claim-reassignment', () => {
    assert.equal(Object.hasOwn(primary.h.component, 'reassign'), false);
    assert.equal('reassignmentEligibilityEvidenceRef' in primary.start, false);
  });
  check('component-exposes-start-only', () => {
    assert.deepEqual(Object.keys(primary.h.component), ['start']);
  });
  check('start-invokes-no-downstream-operations', () => {
    assert.deepEqual(primary.h.calls, { scheduler: 0, worker: 0, executor: 0,
      effectIntent: 0, provider: 0, product: 0, effect: 0, result: 0, completion: 0 });
  });
  check('outcome-grammar-is-exact-and-closed', () => {
    assert.deepEqual(Object.values(START_OUTCOMES).sort(), [
      'ALREADY_STARTED', 'CLAIM_NOT_ACTIVE', 'CLAIM_NOT_CURRENT', 'CLAIM_NOT_FOUND',
      'EXECUTION_ATTEMPT_STARTED', 'INVALID_CLAIM', 'START_ALREADY_EXISTS',
      'START_REJECTED', 'START_STALE', 'START_UNCERTAIN'
    ]);
  });
  check('required-ledger-port-is-validated', () => {
    assert.throws(() => createGovernedExecutionAttemptStart({}), TypeError);
  });
  check('deterministic-equivalent-runs-produce-equivalent-starts', () => {
    const left = harness().component.start(request);
    const right = harness().component.start(request);
    assert.deepEqual(left, right);
    observations.push(left.start, primary.start);
  });

  const canonical = canonicalStringify({ cases, observations,
    primaryStart: primary.start, outcomes: Object.values(START_OUTCOMES) });
  return { cases, canonical, hash: sha256(canonical) };
}

const first = runSuite();
const second = runSuite();
assert.equal(first.canonical, second.canonical);
console.log(canonicalStringify({ suite: 'governed-execution-attempt-start-v0',
  status: 'PASS', cases: first.cases.length, deterministic: true, hash: first.hash }));
