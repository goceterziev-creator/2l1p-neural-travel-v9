'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { canonicalStringify } = require('../human-intent-layer-v0/intent-layer');
const { GATEWAY_OUTCOMES,
  createGovernedEffectInvocationGateway } = require('./effect-invocation-gateway');

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function intent(overrides = {}) {
  return { type: 'EFFECT_INVOCATION_INTENT', status: 'EFFECT_INVOCATION_INTENT',
    effectInvocationIntentId: 'intent-1', intentRevision: 1,
    startEvidenceRef: 'start-evidence-1', executionStartId: 'start-1', startRevision: 1,
    executionAttemptId: 'attempt-1', attemptClaimId: 'claim-1',
    attemptEvidenceRef: 'attempt-evidence-1', attemptRevision: 1,
    claimEvidenceRef: 'claim-evidence-1', claimRevision: 1, claimHistoryRevision: 1,
    executionId: 'execution-1', executionAcceptanceId: 'acceptance-1',
    preparationEvidenceRef: 'preparation-evidence-1', preparationRevision: 1,
    dispatchId: 'dispatch-1', continuationId: 'continuation-1', interactionId: 'interaction-1',
    gateId: 'gate-1', gateRevision: 2, authorityEvidenceRef: 'authority-1',
    governanceEvaluationRef: 'evaluation-1', authorityScope: { action: 'update-offer', offerId: 'offer-1' },
    adapterRegistrationEvidenceRef: 'adapter-registration-evidence-1',
    adapterRegistrationIdentity: 'adapter-registration-1', adapterRegistrationRevision: '1',
    adapterIdentity: 'offer-adapter', adapterRevision: '1', attemptOwnerIdentity: 'worker-1',
    ownerIdentityEvidenceRef: 'owner-evidence-1', ownerIdentityRevision: '1',
    compatibilityEvidenceRef: 'compatibility-evidence-1', actionIdentity: 'offer.update',
    actionRevision: '1', continuationTargetRef: 'offer.update:offer-1',
    executionOwnerIdentity: 'offer-execution-owner', inputRef: 'input:offer-1',
    verifiedInputDigest: 'sha256:input-1', verifiedInputEvidenceRef: 'input-evidence-1',
    effectContractRef: 'effect-contract-1', effectContractRevision: '1',
    effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY',
    logicalEffectId: 'effect:execution-1:sha256:input-1',
    resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1',
    invocationOccurred: 'UNKNOWN', singleIntentForStart: true, ...clone(overrides) };
}

function snapshot(record = intent(), overrides = {}) {
  return { evidenceRef: 'intent-evidence-1', currentClaim: true,
    adapterRegistrationCurrent: true, adapterRegistrationEnabled: true,
    ownerIdentityCurrent: true, conflictingLifecycleEvidence: false,
    invocationStatusUnknown: false, effectPossiblyOccurred: false, effectConfirmed: false,
    terminalLifecycleEvidence: false, record: clone(record), ...clone(overrides) };
}

function createLedger({ intentSnapshot = snapshot(), seed = [], mode = 'NORMAL',
  errorCode = null, duplicateById = false, duplicateByIntent = false } = {}, order = []) {
  const records = seed.map(clone);
  let commits = 0; let returns = 0; let uncertain = 0;
  const replace = (id, evidence) => {
    const index = records.findIndex((entry) => entry.effectInvocationId === id);
    if (index < 0) throw new Error('missing invocation');
    records[index] = { ...records[index], status: evidence.status,
      effectStatus: 'UNKNOWN', lifecycleEvidenceRef: evidence.evidenceRef,
      responseDigest: evidence.responseDigest, transportStatus: evidence.transportStatus,
      uncertaintyReasonCode: evidence.reasonCode };
    return clone(records[index]);
  };
  return { records, get commits() { return commits; }, get returns() { return returns; },
    get uncertain() { return uncertain; },
    findIntentSnapshot(id) {
      return intentSnapshot && intentSnapshot.record.effectInvocationIntentId === id
        ? clone(intentSnapshot) : null;
    },
    findInvocationByIntent(id) {
      const found = records.filter((entry) => entry.effectInvocationIntentId === id).map(clone);
      return duplicateByIntent && found.length ? [found[0], clone(found[0])] : found;
    },
    findInvocationById(id) {
      const found = records.filter((entry) => entry.effectInvocationId === id).map(clone);
      return duplicateById && found.length ? [found[0], clone(found[0])] : found;
    },
    commitInvocationStart(record, guards) {
      commits += 1; order.push('commit');
      assert.equal(guards.intentGuard.currentClaim, true);
      assert.equal(guards.lifecycleGuard.noPriorInvocation, true);
      assert.equal(guards.envelopeGuard.logicalEffectId, record.logicalEffectId);
      if (mode === 'THROW_BEFORE') { const error = new Error('uncertain'); error.code = errorCode; throw error; }
      records.push(clone(record));
      if (mode === 'STORE_THEN_THROW') throw new Error('response lost');
      if (mode === 'CORRUPT_RETURN') return { ...clone(record), executionAttemptId: 'wrong' };
      return clone(record);
    },
    recordInvocationReturn(id, evidence, guards) {
      returns += 1; order.push('return');
      assert.equal(guards.expectedStatus, 'EFFECT_INVOCATION_STARTED');
      return replace(id, evidence);
    },
    recordInvocationUncertain(id, evidence, guards) {
      uncertain += 1; order.push('uncertain');
      assert.equal(guards.expectedStatus, 'EFFECT_INVOCATION_STARTED');
      return replace(id, evidence);
    }
  };
}

function fakeAdapter({ mode = 'RETURN' } = {}, order = []) {
  const state = { calls: 0, envelopes: [] };
  const port = { invokeExactEffect(envelope) {
    state.calls += 1; state.envelopes.push(clone(envelope)); order.push('adapter');
    if (mode === 'THROW') { const error = new Error('timeout'); error.code = 'TIMEOUT'; throw error; }
    if (mode === 'INVALID') return { status: 'MAYBE' };
    return { status: 'RETURNED', evidenceRef: 'adapter-return-1',
      responseDigest: 'sha256:response-1', transportStatus: 'RETURNED' };
  } };
  return { port, state };
}

const request = Object.freeze({ effectInvocationId: 'invocation-1',
  effectInvocationIntentId: 'intent-1', expectedIntentRevision: 1,
  expectedStartRevision: 1, expectedAttemptRevision: 1, expectedClaimRevision: 1,
  expectedAdapterRegistrationRevision: '1', expectedOwnerIdentityRevision: '1' });

function harness({ ledgerOptions, adapterOptions } = {}) {
  const order = []; const ledger = createLedger(ledgerOptions, order);
  const adapter = fakeAdapter(adapterOptions, order);
  const gateway = createGovernedEffectInvocationGateway({ lifecyclePort: ledger,
    adapterPort: adapter.port });
  return { gateway, ledger, adapter, order };
}

function runSuite() {
  const cases = []; const observations = [];
  const check = (name, fn) => { fn(); cases.push(name); };
  const run = (options = {}, input = request) => {
    const h = harness(options); return { h, result: h.gateway.invoke(clone(input)) };
  };
  const primary = run();

  check('authoritative-intent-required', () => assert.equal(run({ ledgerOptions: { intentSnapshot: null } }).result.outcome, 'INTENT_NOT_FOUND'));
  check('fabricated-intent-cannot-grant-progression', () => assert.equal(run({}, { ...request, fabricated: intent() }).result.outcome, 'INVOCATION_RETURNED'));
  check('corrupt-intent-rejected', () => assert.equal(run({ ledgerOptions: { intentSnapshot: snapshot(intent({ actionIdentity: '' })) } }).result.outcome, 'INVALID_INTENT'));
  check('no-effect-branch-rejected', () => assert.equal(run({ ledgerOptions: { intentSnapshot: snapshot(intent({ effectIdempotencyClass: 'NO_EXTERNAL_EFFECT', logicalEffectId: null })) } }).result.outcome, 'BRANCH_MISMATCH'));
  check('unknown-effect-class-rejected', () => assert.equal(run({ ledgerOptions: { intentSnapshot: snapshot(intent({ effectIdempotencyClass: 'UNKNOWN_OR_UNVERIFIED' })) } }).result.outcome, 'INVALID_INTENT'));
  check('idempotent-class-eligible', () => assert.equal(primary.result.outcome, 'INVOCATION_RETURNED'));
  check('non-idempotent-class-eligible', () => assert.equal(run({ ledgerOptions: { intentSnapshot: snapshot(intent({ effectIdempotencyClass: 'NON_IDEMPOTENT' })) } }).result.outcome, 'INVOCATION_RETURNED'));
  check('current-claim-required', () => assert.equal(run({ ledgerOptions: { intentSnapshot: snapshot(intent(), { currentClaim: false }) } }).result.outcome, 'CLAIM_NOT_CURRENT'));
  check('enabled-adapter-required', () => assert.equal(run({ ledgerOptions: { intentSnapshot: snapshot(intent(), { adapterRegistrationEnabled: false }) } }).result.outcome, 'ADAPTER_NOT_CURRENT'));
  check('current-adapter-required', () => assert.equal(run({ ledgerOptions: { intentSnapshot: snapshot(intent(), { adapterRegistrationCurrent: false }) } }).result.outcome, 'ADAPTER_NOT_CURRENT'));
  check('current-owner-required', () => assert.equal(run({ ledgerOptions: { intentSnapshot: snapshot(intent(), { ownerIdentityCurrent: false }) } }).result.outcome, 'ADAPTER_NOT_CURRENT'));
  for (const [name, key] of [['conflicting-lifecycle', 'conflictingLifecycleEvidence'], ['unknown-invocation', 'invocationStatusUnknown'], ['possible-effect', 'effectPossiblyOccurred'], ['confirmed-effect', 'effectConfirmed'], ['terminal-lifecycle', 'terminalLifecycleEvidence']]) {
    check(`${name}-fails-closed`, () => assert.equal(run({ ledgerOptions: { intentSnapshot: snapshot(intent(), { [key]: true }) } }).result.outcome, 'INTENT_NOT_ELIGIBLE'));
  }
  for (const [name, key, value] of [['intent', 'expectedIntentRevision', 2], ['start', 'expectedStartRevision', 2], ['attempt', 'expectedAttemptRevision', 2], ['claim', 'expectedClaimRevision', 2], ['adapter', 'expectedAdapterRegistrationRevision', '2'], ['owner', 'expectedOwnerIdentityRevision', '2']]) {
    check(`stale-${name}-revision-rejected`, () => assert.equal(run({}, { ...request, [key]: value }).result.outcome, 'INVOCATION_STALE'));
  }
  check('physical-identity-is-distinct', () => assert.equal(primary.result.invocation.effectInvocationId, 'invocation-1'));
  for (const id of ['intent-1', 'start-1', 'attempt-1', 'claim-1', 'effect:execution-1:sha256:input-1']) {
    check(`upstream-identity-${id}-cannot-be-reused`, () => assert.equal(run({}, { ...request, effectInvocationId: id }).result.outcome, 'INVOCATION_REJECTED'));
  }
  check('one-invocation-per-intent', () => { const h = harness(); h.gateway.invoke(request); assert.equal(h.gateway.invoke({ ...request, effectInvocationId: 'invocation-2' }).outcome, 'INVOCATION_ALREADY_EXISTS'); });
  check('exact-duplicate-is-deterministic', () => { const h = harness(); const first = h.gateway.invoke(request); const second = h.gateway.invoke(request); assert.equal(second.outcome, 'INVOCATION_RETURNED'); assert.equal(h.adapter.state.calls, 1); assert.deepEqual(second.invocation, first.invocation); });
  check('cross-intent-identity-reuse-rejected', () => { const seeded = primary.result.invocation; assert.equal(run({ ledgerOptions: { seed: [{ ...seeded, effectInvocationIntentId: 'intent-other' }] } }).result.outcome, 'INVOCATION_REJECTED'); });
  check('conflicting-by-id-evidence-is-uncertain', () => assert.equal(run({ ledgerOptions: { seed: [primary.result.invocation], duplicateById: true } }).result.outcome, 'INVOCATION_UNCERTAIN'));
  check('conflicting-by-intent-evidence-is-uncertain', () => assert.equal(run({ ledgerOptions: { seed: [primary.result.invocation], duplicateByIntent: true } }).result.outcome, 'INVOCATION_UNCERTAIN'));
  check('exact-lineage-preserved', () => { const x = primary.result.invocation; assert.deepEqual([x.actionIdentity, x.continuationTargetRef, x.authorityScope, x.verifiedInputDigest], ['offer.update', 'offer.update:offer-1', { action: 'update-offer', offerId: 'offer-1' }, 'sha256:input-1']); });
  check('exact-effect-and-result-contracts-preserved', () => { const x = primary.result.invocation; assert.deepEqual([x.effectContractRef, x.effectIdempotencyClass, x.logicalEffectId, x.resultEvidenceGrammarRef], ['effect-contract-1', 'IDEMPOTENT_WITH_STABLE_KEY', 'effect:execution-1:sha256:input-1', 'result-grammar-1']); });
  check('envelope-digest-is-deterministic', () => assert.equal(run().result.invocation.invocationEnvelopeDigest, primary.result.invocation.invocationEnvelopeDigest));
  check('pre-call-commit-precedes-adapter', () => assert.deepEqual(primary.h.order, ['commit', 'adapter', 'return']));
  check('adapter-receives-frozen-envelope-only', () => { const envelope = primary.h.adapter.state.envelopes[0]; assert.equal(envelope.actionIdentity, 'offer.update'); assert.equal('callerProductParameters' in envelope, false); });
  check('caller-cannot-override-envelope', () => assert.equal(run({}, { ...request, actionIdentity: 'evil', authorityScope: { all: true } }).h.adapter.state.envelopes[0].actionIdentity, 'offer.update'));
  check('human-wording-is-not-authority', () => assert.equal('humanGateWording' in primary.h.adapter.state.envelopes[0], false));
  check('exactly-one-adapter-call', () => assert.equal(primary.h.adapter.state.calls, 1));
  check('idempotent-key-propagated', () => assert.equal(primary.h.adapter.state.envelopes[0].stableEffectKey, 'effect:execution-1:sha256:input-1'));
  check('non-idempotent-key-is-correlation-only', () => { const x = run({ ledgerOptions: { intentSnapshot: snapshot(intent({ effectIdempotencyClass: 'NON_IDEMPOTENT' })) } }); assert.equal(x.h.adapter.state.envelopes[0].stableEffectKey, null); assert.equal('replayAuthorized' in x.result.invocation, false); });
  check('adapter-return-is-bounded', () => { assert.equal(primary.result.outcome, 'INVOCATION_RETURNED'); assert.equal(primary.result.invocation.effectStatus, 'UNKNOWN'); });
  check('return-does-not-mean-success', () => assert.deepEqual([primary.result.effectAcknowledged, primary.result.resultAccepted, primary.result.executionCompleted], [false, false, false]));
  check('adapter-timeout-is-uncertain', () => assert.equal(run({ adapterOptions: { mode: 'THROW' } }).result.outcome, 'INVOCATION_UNCERTAIN'));
  check('invalid-return-is-uncertain', () => assert.equal(run({ adapterOptions: { mode: 'INVALID' } }).result.outcome, 'INVOCATION_UNCERTAIN'));
  check('uncertainty-causes-no-second-call', () => { const h = harness({ adapterOptions: { mode: 'THROW' } }); h.gateway.invoke(request); h.gateway.invoke(request); assert.equal(h.adapter.state.calls, 1); });
  check('committed-response-loss-recovers-without-call', () => { const x = run({ ledgerOptions: { mode: 'STORE_THEN_THROW' } }); assert.equal(x.result.outcome, 'ALREADY_STARTED'); assert.equal(x.h.adapter.state.calls, 0); });
  check('uncertain-pre-call-commit-blocks-call', () => { const x = run({ ledgerOptions: { mode: 'THROW_BEFORE' } }); assert.equal(x.result.outcome, 'INVOCATION_UNCERTAIN'); assert.equal(x.h.adapter.state.calls, 0); });
  check('atomic-guard-codes-map-closed', () => { for (const code of ['INVOCATION_STALE', 'CLAIM_NOT_CURRENT', 'ADAPTER_NOT_CURRENT', 'INVOCATION_ALREADY_EXISTS', 'INTENT_NOT_ELIGIBLE']) assert.equal(run({ ledgerOptions: { mode: 'THROW_BEFORE', errorCode: code } }).result.outcome, code); });
  check('inconsistent-commit-is-uncertain', () => assert.equal(run({ ledgerOptions: { mode: 'CORRUPT_RETURN' } }).result.outcome, 'INVOCATION_UNCERTAIN'));
  check('no-ack-result-or-completion-evidence', () => { for (const key of ['effectAcknowledgement', 'resultEvidence', 'completion', 'success']) assert.equal(key in primary.result.invocation, false); });
  check('no-separate-physical-subattempt-identity', () => assert.equal(Object.keys(primary.result.invocation).some((key) => /invocationAttemptId/.test(key)), false));
  check('gateway-exposes-invoke-only', () => assert.deepEqual(Object.keys(primary.h.gateway), ['invoke']));
  check('adapter-contract-is-exact', () => assert.throws(() => createGovernedEffectInvocationGateway({ lifecyclePort: primary.h.ledger, adapterPort: { invokeExactEffect() {}, retry() {} } }), TypeError));
  check('lifecycle-port-is-required', () => assert.throws(() => createGovernedEffectInvocationGateway({}), TypeError));
  check('outcome-grammar-is-exact', () => assert.deepEqual(Object.values(GATEWAY_OUTCOMES).sort(), ['ADAPTER_NOT_CURRENT', 'ALREADY_STARTED', 'BRANCH_MISMATCH', 'CLAIM_NOT_CURRENT', 'EFFECT_INVOCATION_STARTED', 'INTENT_NOT_ELIGIBLE', 'INTENT_NOT_FOUND', 'INVALID_INTENT', 'INVOCATION_ALREADY_EXISTS', 'INVOCATION_REJECTED', 'INVOCATION_RETURNED', 'INVOCATION_STALE', 'INVOCATION_UNCERTAIN']));
  check('equivalent-runs-are-deterministic', () => { const left = run().result; const right = run().result; assert.deepEqual(left, right); observations.push(left.invocation, right.invocation); });

  observations.push(primary.result.invocation, primary.h.adapter.state.envelopes[0]);
  const canonical = canonicalStringify({ cases, observations,
    outcomes: Object.values(GATEWAY_OUTCOMES), primary: primary.result });
  return { cases, canonical, hash: sha256(canonical) };
}

const first = runSuite();
const second = runSuite();
assert.equal(first.canonical, second.canonical);
console.log(canonicalStringify({ suite: 'governed-effect-invocation-gateway-v0',
  status: 'PASS', cases: first.cases.length, deterministic: true, hash: first.hash }));
