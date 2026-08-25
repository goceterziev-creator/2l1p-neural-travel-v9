'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { canonicalStringify } = require('../human-intent-layer-v0/intent-layer');
const { EFFECT_INTENT_OUTCOMES,
  createGovernedEffectInvocationIntent } = require('./effect-invocation-intent');

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const authorityScope = Object.freeze({ action: 'update-offer', offerId: 'offer-1' });

function start(overrides = {}) {
  return {
    type: 'EXECUTION_ATTEMPT_START', status: 'EXECUTION_ATTEMPT_STARTED',
    executionStartId: 'start-1', startRevision: 1, executionAttemptId: 'attempt-1',
    attemptClaimId: 'claim-1', attemptEvidenceRef: 'attempt-evidence-1', attemptRevision: 1,
    claimEvidenceRef: 'claim-evidence-1', claimRevision: 1, claimHistoryRevision: 1,
    executionId: 'execution-1', executionAcceptanceId: 'acceptance-1',
    preparationEvidenceRef: 'preparation-evidence-1', preparationRevision: 1,
    dispatchId: 'dispatch-1', continuationId: 'continuation-1', interactionId: 'interaction-1',
    gateId: 'gate-1', gateRevision: 2, authorityEvidenceRef: 'authority-1',
    governanceEvaluationRef: 'evaluation-1', authorityScope: clone(authorityScope),
    adapterRegistrationEvidenceRef: 'adapter-registration-evidence-1',
    adapterRegistrationIdentity: 'adapter-registration-1', adapterRegistrationRevision: '1',
    adapterIdentity: 'offer-adapter', adapterRevision: '1', attemptOwnerIdentity: 'worker-1',
    ownerIdentityEvidenceRef: 'owner-evidence:worker-1', ownerIdentityRevision: '1',
    compatibilityEvidenceRef: 'compatibility-evidence-1', actionIdentity: 'offer.update',
    actionRevision: '1', continuationTargetRef: 'offer.update:offer-1',
    executionOwnerIdentity: 'offer-execution-owner', inputRef: 'input:offer-1',
    verifiedInputDigest: 'sha256:input-1', verifiedInputEvidenceRef: 'input-evidence-1',
    effectContractRef: 'effect-contract-1', effectContractRevision: '1',
    effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY',
    logicalEffectId: 'effect:execution-1:sha256:input-1',
    resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1',
    executionActivityStarted: true, singleAuthoritativeStart: true, ...clone(overrides)
  };
}

function snapshot(record = start(), overrides = {}) {
  return { evidenceRef: 'start-evidence-1', currentClaim: true,
    adapterRegistrationCurrent: true, adapterRegistrationEnabled: true,
    ownerIdentityCurrent: true, conflictingLifecycleEvidence: false,
    invocationStatusUnknown: false, effectPossiblyOccurred: false,
    terminalLifecycleEvidence: false, record: clone(record), ...clone(overrides) };
}

function createLedger({ startSnapshot = snapshot(), seed = [], mode = 'NORMAL',
  errorCode = null, corruptReturn = false, duplicateById = false,
  duplicateByStart = false } = {}) {
  const records = seed.map(clone);
  let commits = 0;
  return {
    records, get commits() { return commits; },
    findStartSnapshot(id) {
      if (!startSnapshot || !startSnapshot.record
        || startSnapshot.record.executionStartId !== id) return null;
      return clone(startSnapshot);
    },
    findIntentByStart(id) {
      const found = records.filter((record) => record.executionStartId === id).map(clone);
      return duplicateByStart && found.length ? [found[0], clone(found[0])] : found;
    },
    findIntentById(id) {
      const found = records.filter((record) => record.effectInvocationIntentId === id).map(clone);
      return duplicateById && found.length ? [found[0], clone(found[0])] : found;
    },
    commitIntent(record, guards) {
      commits += 1;
      if (!guards || guards.startGuard.startRevision !== 1
        || guards.startGuard.attemptRevision !== 1
        || guards.startGuard.claimRevision !== 1
        || guards.adapterGuard.registrationRevision !== '1'
        || guards.adapterGuard.enabled !== true
        || guards.ownerGuard.identityRevision !== '1'
        || guards.contractGuard.verifiedInputDigest !== record.verifiedInputDigest
        || guards.contractGuard.logicalEffectId !== record.logicalEffectId
        || guards.lifecycleGuard.noPriorIntent !== true) {
        const error = new Error('guard changed'); error.code = 'INTENT_STALE'; throw error;
      }
      if (errorCode) { const error = new Error(errorCode); error.code = errorCode; throw error; }
      if (mode === 'THROW_BEFORE') throw new Error('unavailable');
      if (records.some((entry) => entry.effectInvocationIntentId
        === record.effectInvocationIntentId)) throw new Error('intent identity conflict');
      if (records.some((entry) => entry.executionStartId === record.executionStartId)) {
        const error = new Error('intent exists'); error.code = 'INTENT_ALREADY_EXISTS'; throw error;
      }
      records.push(clone(record));
      if (mode === 'STORE_THEN_THROW') throw new Error('response lost');
      return corruptReturn ? { ...clone(record), actionRevision: 'corrupt' } : clone(record);
    }
  };
}

function harness(overrides = {}) {
  const record = Object.hasOwn(overrides, 'startRecord') ? overrides.startRecord : start();
  const startSnapshot = Object.hasOwn(overrides, 'startSnapshot') ? overrides.startSnapshot
    : snapshot(record, overrides.snapshotOverrides || {});
  const ledger = overrides.ledger || createLedger({ startSnapshot });
  const calls = { scheduler: 0, worker: 0, executor: 0, provider: 0,
    network: 0, command: 0, product: 0, effect: 0, acknowledgement: 0,
    result: 0, completion: 0 };
  return { component: createGovernedEffectInvocationIntent({ intentLedger: ledger }),
    ledger, calls };
}

const request = Object.freeze({ effectInvocationIntentId: 'intent-1',
  executionStartId: 'start-1', expectedStartRevision: 1, expectedAttemptRevision: 1,
  expectedClaimRevision: 1, expectedAdapterRegistrationRevision: '1',
  expectedOwnerIdentityRevision: '1' });

function createIntent(overrides = {}) {
  const h = harness(overrides);
  const response = h.component.recordIntent(request);
  assert.equal(response.outcome, 'EFFECT_INVOCATION_INTENT_RECORDED');
  return { h, intent: response.intent };
}

function runSuite() {
  const cases = [];
  const observations = [];
  const check = (name, fn) => { fn(); cases.push(name); };

  check('no-intent-without-authoritative-start', () => {
    assert.equal(harness({ startRecord: null, startSnapshot: null }).component
      .recordIntent(request).outcome, 'START_NOT_FOUND');
  });
  check('caller-fabricated-start-does-not-grant-intent', () => {
    assert.equal(harness({ startRecord: null, startSnapshot: null }).component
      .recordIntent({ ...request, status: 'EXECUTION_ATTEMPT_STARTED' }).outcome,
    'START_NOT_FOUND');
  });
  check('corrupt-authoritative-start-fails-closed', () => {
    assert.equal(harness({ startRecord: start({ verifiedInputDigest: '' }) }).component
      .recordIntent(request).outcome, 'INVALID_START');
  });
  check('no-external-effect-branch-is-rejected', () => {
    assert.equal(harness({ startRecord: start({ effectIdempotencyClass: 'NO_EXTERNAL_EFFECT',
      logicalEffectId: null }) }).component.recordIntent(request).outcome, 'BRANCH_MISMATCH');
  });
  check('unknown-effect-class-is-invalid', () => {
    assert.equal(harness({ startRecord: start({ effectIdempotencyClass: 'UNKNOWN' }) })
      .component.recordIntent(request).outcome, 'INVALID_START');
  });
  check('missing-effect-class-is-invalid', () => {
    assert.equal(harness({ startRecord: start({ effectIdempotencyClass: '' }) })
      .component.recordIntent(request).outcome, 'INVALID_START');
  });

  const primary = createIntent();
  check('exact-effect-capable-class-is-preserved', () => {
    assert.equal(primary.intent.effectIdempotencyClass, 'IDEMPOTENT_WITH_STABLE_KEY');
  });
  check('intent-has-distinct-immutable-identity', () => {
    assert.equal(primary.intent.effectInvocationIntentId, 'intent-1');
    assert.equal(primary.intent.intentRevision, 1);
    assert.equal(primary.intent.singleIntentForStart, true);
  });
  check('intent-id-is-distinct-from-upstream-and-logical-effect-identities', () => {
    for (const effectInvocationIntentId of ['start-1', 'attempt-1', 'claim-1',
      'effect:execution-1:sha256:input-1']) {
      assert.equal(harness().component.recordIntent({ ...request,
        effectInvocationIntentId }).outcome, 'INTENT_REJECTED');
    }
  });
  check('one-intent-maximum-per-start', () => {
    assert.equal(primary.h.component.recordIntent({ ...request,
      effectInvocationIntentId: 'intent-2' }).outcome, 'INTENT_ALREADY_EXISTS');
  });
  check('exact-duplicate-returns-prior-intent', () => {
    const replay = primary.h.component.recordIntent(request);
    assert.equal(replay.outcome, 'ALREADY_RECORDED');
    assert.deepEqual(replay.intent, primary.intent);
    assert.equal(primary.h.ledger.commits, 1);
  });
  check('cross-start-intent-id-reuse-fails-closed', () => {
    const secondStart = start({ executionStartId: 'start-2', executionAttemptId: 'attempt-2',
      attemptClaimId: 'claim-2', logicalEffectId: 'effect:execution-2' });
    const ledger = createLedger({ startSnapshot: snapshot(secondStart,
      { evidenceRef: 'start-evidence-2' }), seed: [primary.intent] });
    assert.equal(harness({ ledger }).component.recordIntent({ ...request,
      executionStartId: 'start-2' }).outcome, 'INTENT_REJECTED');
  });

  check('exact-current-claim-is-required', () => {
    assert.equal(harness({ snapshotOverrides: { currentClaim: false } }).component
      .recordIntent(request).outcome, 'CLAIM_NOT_CURRENT');
  });
  check('exact-start-revision-is-required', () => {
    assert.equal(harness().component.recordIntent({ ...request,
      expectedStartRevision: 2 }).outcome, 'INTENT_STALE');
  });
  check('exact-attempt-revision-is-required', () => {
    assert.equal(harness().component.recordIntent({ ...request,
      expectedAttemptRevision: 2 }).outcome, 'INTENT_STALE');
  });
  check('exact-claim-revision-is-required', () => {
    assert.equal(harness().component.recordIntent({ ...request,
      expectedClaimRevision: 2 }).outcome, 'INTENT_STALE');
  });
  check('current-enabled-adapter-is-required', () => {
    assert.equal(harness({ snapshotOverrides: { adapterRegistrationCurrent: false } })
      .component.recordIntent(request).outcome, 'ADAPTER_NOT_CURRENT');
  });
  check('disabled-adapter-fails-closed', () => {
    assert.equal(harness({ snapshotOverrides: { adapterRegistrationEnabled: false } })
      .component.recordIntent(request).outcome, 'ADAPTER_NOT_CURRENT');
  });
  check('adapter-revision-drift-fails-stale', () => {
    assert.equal(harness().component.recordIntent({ ...request,
      expectedAdapterRegistrationRevision: '2' }).outcome, 'INTENT_STALE');
  });
  check('current-trusted-owner-is-required', () => {
    assert.equal(harness({ snapshotOverrides: { ownerIdentityCurrent: false } })
      .component.recordIntent(request).outcome, 'ADAPTER_NOT_CURRENT');
  });
  check('owner-revision-drift-fails-stale', () => {
    assert.equal(harness().component.recordIntent({ ...request,
      expectedOwnerIdentityRevision: '2' }).outcome, 'INTENT_STALE');
  });

  check('authority-action-target-and-scope-are-preserved', () => {
    assert.equal(primary.intent.actionIdentity, 'offer.update');
    assert.equal(primary.intent.continuationTargetRef, 'offer.update:offer-1');
    assert.deepEqual(primary.intent.authorityScope, authorityScope);
    assert.equal(primary.intent.executionOwnerIdentity, 'offer-execution-owner');
  });
  check('immutable-input-is-preserved', () => {
    assert.equal(primary.intent.inputRef, 'input:offer-1');
    assert.equal(primary.intent.verifiedInputDigest, 'sha256:input-1');
    assert.equal(primary.intent.verifiedInputEvidenceRef, 'input-evidence-1');
  });
  check('effect-contract-is-preserved', () => {
    assert.equal(primary.intent.effectContractRef, 'effect-contract-1');
    assert.equal(primary.intent.effectContractRevision, '1');
  });
  check('logical-effect-id-is-preserved', () => {
    assert.equal(primary.intent.logicalEffectId, 'effect:execution-1:sha256:input-1');
  });
  check('result-grammar-is-preserved', () => {
    assert.equal(primary.intent.resultEvidenceGrammarRef, 'result-grammar-1');
    assert.equal(primary.intent.resultEvidenceGrammarRevision, '1');
  });
  check('idempotent-path-requires-stable-non-null-logical-effect', () => {
    assert.equal(harness({ startRecord: start({ logicalEffectId: null }) }).component
      .recordIntent(request).outcome, 'INVALID_START');
  });
  check('non-idempotent-path-preserves-correlation-without-replay-claim', () => {
    const { intent } = createIntent({ startRecord: start({
      effectIdempotencyClass: 'NON_IDEMPOTENT', logicalEffectId: 'effect:non-idempotent:1' }) });
    assert.equal(intent.effectIdempotencyClass, 'NON_IDEMPOTENT');
    assert.equal(intent.logicalEffectId, 'effect:non-idempotent:1');
    assert.equal('replayAuthorized' in intent, false);
  });

  check('post-commit-registry-drift-cannot-rewrite-intent', () => {
    const drifted = snapshot(start({ adapterRegistrationRevision: '2' }),
      { adapterRegistrationCurrent: false });
    const replay = harness({ ledger: createLedger({ startSnapshot: drifted,
      seed: [primary.intent] }) }).component.recordIntent(request);
    assert.equal(replay.outcome, 'ALREADY_RECORDED');
    assert.deepEqual(replay.intent, primary.intent);
  });
  check('post-commit-owner-drift-cannot-rewrite-intent', () => {
    const drifted = snapshot(start({ ownerIdentityRevision: '2' }),
      { ownerIdentityCurrent: false });
    const replay = harness({ ledger: createLedger({ startSnapshot: drifted,
      seed: [primary.intent] }) }).component.recordIntent(request);
    assert.equal(replay.outcome, 'ALREADY_RECORDED');
    assert.deepEqual(replay.intent, primary.intent);
  });
  check('committed-response-loss-recovers-original-intent', () => {
    const ledger = createLedger({ mode: 'STORE_THEN_THROW' });
    const response = harness({ ledger }).component.recordIntent(request);
    assert.equal(response.outcome, 'ALREADY_RECORDED');
    assert.equal(response.intent.effectInvocationIntentId, 'intent-1');
  });
  check('uncertain-precommit-allows-same-id-recovery-only-and-blocks-crossing', () => {
    const ledger = createLedger({ mode: 'THROW_BEFORE' });
    const response = harness({ ledger }).component.recordIntent(request);
    assert.equal(response.outcome, 'INTENT_UNCERTAIN');
    assert.equal(response.effectCrossingPermitted, false);
    assert.equal(ledger.records.length, 0);
  });
  check('conflicting-lifecycle-evidence-fails-closed', () => {
    assert.equal(harness({ snapshotOverrides: { conflictingLifecycleEvidence: true } })
      .component.recordIntent(request).outcome, 'START_NOT_ELIGIBLE');
  });
  check('unknown-invocation-status-fails-closed', () => {
    assert.equal(harness({ snapshotOverrides: { invocationStatusUnknown: true } })
      .component.recordIntent(request).outcome, 'START_NOT_ELIGIBLE');
  });
  check('possible-effect-fails-closed', () => {
    assert.equal(harness({ snapshotOverrides: { effectPossiblyOccurred: true } })
      .component.recordIntent(request).outcome, 'START_NOT_ELIGIBLE');
  });
  check('terminal-lifecycle-evidence-fails-closed', () => {
    assert.equal(harness({ snapshotOverrides: { terminalLifecycleEvidence: true } })
      .component.recordIntent(request).outcome, 'START_NOT_ELIGIBLE');
  });
  check('conflicting-recovered-intent-evidence-fails-closed', () => {
    const ledger = createLedger({ seed: [primary.intent], duplicateById: true });
    assert.equal(harness({ ledger }).component.recordIntent(request).outcome,
      'INTENT_UNCERTAIN');
  });
  check('conflicting-start-intent-evidence-fails-closed', () => {
    const ledger = createLedger({ seed: [primary.intent], duplicateByStart: true });
    assert.equal(harness({ ledger }).component.recordIntent({ ...request,
      effectInvocationIntentId: 'intent-2' }).outcome, 'INTENT_UNCERTAIN');
  });
  check('inconsistent-commit-result-is-uncertain', () => {
    assert.equal(harness({ ledger: createLedger({ corruptReturn: true }) }).component
      .recordIntent(request).outcome, 'INTENT_UNCERTAIN');
  });
  for (const code of ['INTENT_STALE', 'CLAIM_NOT_CURRENT', 'ADAPTER_NOT_CURRENT',
    'INTENT_ALREADY_EXISTS', 'START_NOT_ELIGIBLE']) {
    check(`atomic-${code.toLowerCase()}-guard-fails-closed`, () => {
      assert.equal(harness({ ledger: createLedger({ errorCode: code }) }).component
        .recordIntent(request).outcome, code);
    });
  }

  check('intent-record-does-not-claim-invocation-or-effect', () => {
    assert.equal(primary.intent.invocationOccurred, 'UNKNOWN');
    for (const key of ['effectInvocationAuthorized', 'physicalInvocationId',
      'executorInvocation', 'requestDelivered', 'effectAcknowledgement',
      'effectOccurred', 'result', 'completion', 'completed', 'success']) {
      assert.equal(key in primary.intent, false);
    }
  });
  check('component-invents-no-physical-invocation-identity', () => {
    assert.equal(Object.keys(primary.intent).some((key) =>
      /physicalInvocation|invocationAttempt/i.test(key)), false);
  });
  check('component-exposes-record-intent-only', () => {
    assert.deepEqual(Object.keys(primary.h.component), ['recordIntent']);
  });
  check('intent-invokes-no-downstream-operations', () => {
    assert.deepEqual(primary.h.calls, { scheduler: 0, worker: 0, executor: 0,
      provider: 0, network: 0, command: 0, product: 0, effect: 0,
      acknowledgement: 0, result: 0, completion: 0 });
  });
  check('outcome-grammar-is-exact-and-closed', () => {
    assert.deepEqual(Object.values(EFFECT_INTENT_OUTCOMES).sort(), [
      'ADAPTER_NOT_CURRENT', 'ALREADY_RECORDED', 'BRANCH_MISMATCH',
      'CLAIM_NOT_CURRENT', 'EFFECT_INVOCATION_INTENT_RECORDED',
      'INTENT_ALREADY_EXISTS', 'INTENT_REJECTED', 'INTENT_STALE',
      'INTENT_UNCERTAIN', 'INVALID_START', 'START_NOT_ELIGIBLE', 'START_NOT_FOUND'
    ]);
  });
  check('required-ledger-port-is-validated', () => {
    assert.throws(() => createGovernedEffectInvocationIntent({}), TypeError);
  });
  check('deterministic-equivalent-runs-produce-equivalent-intents', () => {
    const left = harness().component.recordIntent(request);
    const right = harness().component.recordIntent(request);
    assert.deepEqual(left, right);
    observations.push(left.intent, primary.intent);
  });

  const canonical = canonicalStringify({ cases, observations,
    primaryIntent: primary.intent, outcomes: Object.values(EFFECT_INTENT_OUTCOMES) });
  return { cases, canonical, hash: sha256(canonical) };
}

const first = runSuite();
const second = runSuite();
assert.equal(first.canonical, second.canonical);
console.log(canonicalStringify({ suite: 'governed-effect-invocation-intent-v0',
  status: 'PASS', cases: first.cases.length, deterministic: true, hash: first.hash }));
