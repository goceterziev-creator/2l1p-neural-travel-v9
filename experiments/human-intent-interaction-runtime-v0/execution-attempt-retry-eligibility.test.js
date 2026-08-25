'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { canonicalStringify } = require('../human-intent-layer-v0/intent-layer');
const { createGovernedExecutionAttemptCreation } = require('./execution-attempt-creation');
const { RETRY_ELIGIBILITY_OPERATION_OUTCOMES, RETRY_ELIGIBILITY_CLASSES,
  createGovernedAttemptRetryEligibility } = require('./execution-attempt-retry-eligibility');

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function attempt(overrides = {}) {
  return { type: 'EXECUTION_ATTEMPT', status: 'ATTEMPT_CREATED',
    executionAttemptId: 'attempt-1', attemptRevision: 1, attemptOrdinal: 1,
    previousExecutionAttemptId: null, executionId: 'execution-1',
    executionAcceptanceId: 'acceptance-1', preparationEvidenceRef: 'preparation-evidence-1',
    preparationRevision: 1, dispatchId: 'dispatch-1', continuationId: 'continuation-1',
    interactionId: 'interaction-1', gateId: 'gate-1', gateRevision: 1,
    authorityEvidenceRef: 'authority-1', governanceEvaluationRef: 'evaluation-1',
    authorityCommittedRevision: 1, actionIdentity: 'offer.update', actionRevision: '1',
    continuationTargetRef: 'offer.update:offer-1', authorityScope: { offerId: 'offer-1' },
    executionOwnerIdentity: 'execution-owner-1', inputRef: 'input:offer-1',
    expectedInputDigest: 'sha256:input-1', verifiedInputDigest: 'sha256:input-1',
    verifiedInputEvidenceRef: 'input-evidence-1', effectContractRef: 'effect-contract-1',
    effectContractRevision: '1', effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY',
    logicalEffectId: 'logical-effect-1', logicalEffectIdentityDerivation: 'derivation-1',
    logicalEffectIdentityRevision: '1', resultEvidenceGrammarRef: 'result-grammar-1',
    resultEvidenceGrammarRevision: '1', retryEligibilityEvidenceRef: null,
    retrySafetyClass: null, singlePhysicalAttemptIdentity: true, claimStatus: 'UNCLAIMED',
    ...clone(overrides) };
}

function invocation(record = attempt(), overrides = {}) {
  return { type: 'EFFECT_INVOCATION', status: 'INVOCATION_RETURNED',
    effectInvocationId: 'invocation-1', invocationRevision: 1,
    effectInvocationIntentId: 'intent-1', executionStartId: 'start-1',
    executionAttemptId: record.executionAttemptId, executionId: record.executionId,
    logicalEffectId: record.logicalEffectId, effectContractRef: record.effectContractRef,
    effectContractRevision: record.effectContractRevision,
    effectIdempotencyClass: record.effectIdempotencyClass,
    actionIdentity: record.actionIdentity, actionRevision: record.actionRevision,
    continuationTargetRef: record.continuationTargetRef, inputRef: record.inputRef,
    verifiedInputDigest: record.verifiedInputDigest, effectStatus: 'UNKNOWN',
    ...clone(overrides) };
}

function resolution(invocationRecord = invocation(), overrides = {}) {
  return { type: 'EFFECT_OUTCOME_RESOLUTION', status: 'EFFECT_OUTCOME_RESOLVED',
    effectOutcomeResolutionId: 'resolution-1', resolutionRevision: 1,
    supersedesResolutionRef: null, effectInvocationId: invocationRecord.effectInvocationId,
    invocationEvidenceRef: 'invocation-evidence-1', invocationRevision: 1,
    logicalEffectId: invocationRecord.logicalEffectId,
    effectContractRef: invocationRecord.effectContractRef,
    effectContractRevision: invocationRecord.effectContractRevision,
    effectIdempotencyClass: invocationRecord.effectIdempotencyClass,
    outcomePolicyIdentity: 'effect-outcome-policy', outcomePolicyRevision: '1',
    evidenceSetRevision: 1, evidenceSetDigest: 'sha256:evidence-set-1',
    evidenceRefs: ['effect-evidence-1'], effectOutcomeClass: 'NO_EFFECT_CONFIRMED',
    retryHandoff: { effectOutcomeClass: 'NO_EFFECT_CONFIRMED',
      effectInvocationId: invocationRecord.effectInvocationId,
      logicalEffectId: invocationRecord.logicalEffectId,
      effectContractRevision: invocationRecord.effectContractRevision,
      evidenceSetDigest: 'sha256:evidence-set-1' },
    retryAllowed: false, resultAccepted: false, executionCompleted: false,
    ...clone(overrides) };
}

function retryPolicy(overrides = {}) {
  return { evidenceRef: 'retry-policy-evidence-1', record: {
    type: 'ATTEMPT_RETRY_POLICY', status: 'ENABLED',
    retryPolicyIdentity: 'retry-policy-1', retryPolicyRevision: '1',
    effectContractRef: 'effect-contract-1', effectContractRevision: '1',
    supportedEffectClasses: ['IDEMPOTENT_WITH_STABLE_KEY', 'NON_IDEMPOTENT'],
    evaluateReplaySafety() { return { replaySafe: true,
      stableKeyGuaranteeVerified: true, duplicateApplicationSemanticsPreserved: true,
      constraintsSatisfied: true, replaySafetyEvidenceRef: 'replay-proof-1' }; },
    ...overrides } };
}

function createLedger({ seed = [], mode = 'NORMAL' } = {}) {
  const records = seed.map(clone); let commits = 0;
  return { records, get commits() { return commits; },
    findById(id) { return records.filter((item) => item.attemptRetryEligibilityId === id).map(clone); },
    findCurrentByAttempt(id) { const matches = records.filter((item) =>
      item.previousExecutionAttemptId === id).sort((a, b) =>
      b.retryEligibilityRevision - a.retryEligibilityRevision); return matches.slice(0, 1).map(clone); },
    commitEligibility(record, guards) {
      commits += 1;
      if (!guards || guards.previousAttemptRevision !== 1
        || guards.expectedAttemptHistoryRevision !== 1
        || guards.previousExecutionAttemptId !== 'attempt-1'
        || guards.expectedCurrentResolutionId !== record.effectOutcomeResolutionId
        || guards.evidenceSetDigest !== record.evidenceSetDigest
        || guards.retryPolicyRevision !== '1'
        || guards.logicalEffectId !== record.logicalEffectId) {
        const error = new Error('stale'); error.code = 'RESOLUTION_STALE'; throw error;
      }
      if (mode === 'THROW_BEFORE') throw new Error('uncertain');
      if (mode === 'STALE') { const error = new Error('stale'); error.code = 'RESOLUTION_STALE'; throw error; }
      if (mode === 'STORE_THEN_THROW') { records.push(clone(record)); throw new Error('lost'); }
      if (mode === 'CORRUPT_RETURN') return { ...clone(record), logicalEffectId: 'wrong' };
      records.push(clone(record)); return clone(record);
    } };
}

function request(overrides = {}) {
  return { attemptRetryEligibilityId: 'eligibility-1', previousExecutionAttemptId: 'attempt-1',
    expectedPreviousAttemptRevision: 1, effectOutcomeResolutionId: 'resolution-1',
    expectedOutcomeResolutionRevision: 1, expectedEvidenceSetRevision: 1,
    expectedEvidenceSetDigest: 'sha256:evidence-set-1', retryPolicyIdentity: 'retry-policy-1',
    expectedRetryPolicyRevision: '1', ...clone(overrides) };
}

function harness(overrides = {}) {
  const attemptRecord = overrides.attemptRecord === undefined ? attempt() : overrides.attemptRecord;
  const invocationRecord = overrides.invocationRecord === undefined
    ? invocation(attemptRecord || attempt()) : overrides.invocationRecord;
  const resolutionRecord = overrides.resolutionRecord === undefined
    ? resolution(invocationRecord || invocation()) : overrides.resolutionRecord;
  const policySnapshot = overrides.policySnapshot === undefined ? retryPolicy() : overrides.policySnapshot;
  const ledger = overrides.ledger || createLedger();
  const calls = { attempt: 0, invocation: 0, resolution: 0, current: 0,
    policy: 0, history: 0, attemptCreate: 0, provider: 0, effect: 0, result: 0,
    completion: 0, human: 0 };
  const component = createGovernedAttemptRetryEligibility({
    attemptSnapshotPort(id) { calls.attempt += 1; if (overrides.attemptError) throw new Error('x');
      return attemptRecord && id === attemptRecord.executionAttemptId
        ? { evidenceRef: 'attempt-evidence-1', record: clone(attemptRecord) } : null; },
    invocationSnapshotPort(id) { calls.invocation += 1; if (overrides.invocationError) throw new Error('x');
      return invocationRecord && id === invocationRecord.executionAttemptId
        ? { evidenceRef: 'invocation-evidence-1', record: clone(invocationRecord) } : null; },
    outcomeResolutionSnapshotPort(id) { calls.resolution += 1; if (overrides.resolutionError) throw new Error('x');
      return resolutionRecord && id === resolutionRecord.effectOutcomeResolutionId
        ? { evidenceRef: 'resolution-evidence-1', record: clone(resolutionRecord) } : null; },
    currentOutcomeResolutionPort() { calls.current += 1; if (overrides.currentError) throw new Error('x');
      if (overrides.currentResolution !== undefined) return clone(overrides.currentResolution);
      return resolutionRecord ? { evidenceRef: 'resolution-evidence-1', record: clone(resolutionRecord) } : null; },
    retryPolicyRegistryPort() { calls.policy += 1; if (overrides.policyError) throw new Error('x');
      return policySnapshot; },
    attemptHistoryPort() { calls.history += 1; if (overrides.historyError) throw new Error('x');
      return overrides.history === undefined ? (attemptRecord ? [clone(attemptRecord)] : []) : clone(overrides.history); },
    eligibilityLedger: ledger });
  return { component, attemptRecord, invocationRecord, resolutionRecord,
    policySnapshot, ledger, calls };
}

function evaluate(h, overrides = {}) { return h.component.evaluate(request(overrides)); }

function runSuite() {
  const cases = []; const observations = [];
  const check = (name, fn) => { fn(); cases.push(name); };

  check('authoritative-prior-attempt-required', () => assert.equal(evaluate(harness({ attemptRecord: null })).outcome, 'PRIOR_ATTEMPT_NOT_FOUND'));
  check('fabricated-attempt-fields-grant-nothing', () => assert.equal(evaluate(harness(), { callerAttempt: attempt({ executionAttemptId: 'fake' }) }).eligibility.previousExecutionAttemptId, 'attempt-1'));
  check('stale-prior-attempt-revision-rejected', () => assert.equal(evaluate(harness(), { expectedPreviousAttemptRevision: 2 }).outcome, 'RETRY_ELIGIBILITY_REJECTED'));
  check('corrupt-attempt-rejected', () => assert.equal(evaluate(harness({ attemptRecord: attempt({ logicalEffectId: '' }) })).outcome, 'RETRY_ELIGIBILITY_REJECTED'));
  check('exact-invocation-lineage-required', () => assert.equal(evaluate(harness({ invocationRecord: invocation(attempt(), { executionAttemptId: 'other' }) })).outcome, 'RETRY_ELIGIBILITY_REJECTED'));
  check('outcome-resolution-required', () => assert.equal(evaluate(harness({ resolutionRecord: null })).outcome, 'OUTCOME_RESOLUTION_NOT_FOUND'));
  check('cross-invocation-resolution-rejected', () => assert.equal(evaluate(harness({ resolutionRecord: resolution(invocation(), { effectInvocationId: 'other' }) })).outcome, 'RETRY_ELIGIBILITY_REJECTED'));
  check('resolution-revision-must-be-exact', () => assert.equal(evaluate(harness(), { expectedOutcomeResolutionRevision: 2 }).outcome, 'OUTCOME_RESOLUTION_STALE'));
  check('evidence-set-revision-must-be-exact', () => assert.equal(evaluate(harness(), { expectedEvidenceSetRevision: 2 }).outcome, 'OUTCOME_RESOLUTION_STALE'));
  check('evidence-set-digest-must-be-exact', () => assert.equal(evaluate(harness(), { expectedEvidenceSetDigest: 'sha256:other' }).outcome, 'OUTCOME_RESOLUTION_STALE'));
  check('superseded-resolution-rejected', () => assert.equal(evaluate(harness({ currentResolution: { evidenceRef: 'new', record: resolution() } })).outcome, 'OUTCOME_RESOLUTION_STALE'));
  check('prior-attempt-must-remain-history-tail', () => assert.equal(evaluate(harness({ history: [attempt(), attempt({ executionAttemptId: 'attempt-2', attemptOrdinal: 2, previousExecutionAttemptId: 'attempt-1' })] })).outcome, 'OUTCOME_RESOLUTION_STALE'));
  check('retry-policy-required', () => assert.equal(evaluate(harness({ policySnapshot: null })).outcome, 'RETRY_POLICY_NOT_FOUND'));
  check('retry-policy-revision-exact', () => assert.equal(evaluate(harness(), { expectedRetryPolicyRevision: '2' }).outcome, 'RETRY_POLICY_NOT_FOUND'));
  check('policy-effect-contract-exact', () => assert.equal(evaluate(harness({ policySnapshot: retryPolicy({ effectContractRevision: '2' }) })).outcome, 'RETRY_POLICY_NOT_FOUND'));

  for (const [name, outcomeClass, effectClass, eligibilityClass, status] of [
    ['idempotent-no-effect', 'NO_EFFECT_CONFIRMED', 'IDEMPOTENT_WITH_STABLE_KEY', 'PROVEN_NO_EFFECT', 'RETRY_ELIGIBLE'],
    ['non-idempotent-no-effect', 'NO_EFFECT_CONFIRMED', 'NON_IDEMPOTENT', 'PROVEN_NO_EFFECT', 'RETRY_ELIGIBLE'],
    ['idempotent-rejected-before-effect', 'EFFECT_REJECTED_BEFORE_EFFECT', 'IDEMPOTENT_WITH_STABLE_KEY', 'PROVEN_NO_EFFECT', 'RETRY_ELIGIBLE'],
    ['non-idempotent-rejected-before-effect', 'EFFECT_REJECTED_BEFORE_EFFECT', 'NON_IDEMPOTENT', 'PROVEN_NO_EFFECT', 'RETRY_ELIGIBLE'],
    ['idempotent-effect-confirmed', 'EFFECT_CONFIRMED', 'IDEMPOTENT_WITH_STABLE_KEY', 'RETRY_NOT_ELIGIBLE_EFFECT_CONFIRMED', 'RETRY_NOT_ELIGIBLE'],
    ['non-idempotent-effect-confirmed', 'EFFECT_CONFIRMED', 'NON_IDEMPOTENT', 'RETRY_NOT_ELIGIBLE_EFFECT_CONFIRMED', 'RETRY_NOT_ELIGIBLE'],
    ['idempotent-possible', 'EFFECT_POSSIBLE', 'IDEMPOTENT_WITH_STABLE_KEY', 'IDEMPOTENT_REPLAY_SAFE', 'RETRY_ELIGIBLE'],
    ['non-idempotent-possible', 'EFFECT_POSSIBLE', 'NON_IDEMPOTENT', 'RETRY_NOT_ELIGIBLE_NON_IDEMPOTENT', 'RETRY_NOT_ELIGIBLE'],
    ['idempotent-unknown', 'EFFECT_OUTCOME_UNKNOWN', 'IDEMPOTENT_WITH_STABLE_KEY', 'IDEMPOTENT_REPLAY_SAFE', 'RETRY_ELIGIBLE'],
    ['non-idempotent-unknown', 'EFFECT_OUTCOME_UNKNOWN', 'NON_IDEMPOTENT', 'RETRY_NOT_ELIGIBLE_OUTCOME_UNKNOWN', 'RETRY_NOT_ELIGIBLE'],
    ['idempotent-conflict', 'EFFECT_EVIDENCE_CONFLICT', 'IDEMPOTENT_WITH_STABLE_KEY', 'RETRY_NOT_ELIGIBLE_EVIDENCE_CONFLICT', 'RETRY_NOT_ELIGIBLE'],
    ['non-idempotent-conflict', 'EFFECT_EVIDENCE_CONFLICT', 'NON_IDEMPOTENT', 'RETRY_NOT_ELIGIBLE_EVIDENCE_CONFLICT', 'RETRY_NOT_ELIGIBLE']]) {
    check(`matrix-${name}`, () => {
      const a = attempt({ effectIdempotencyClass: effectClass });
      const i = invocation(a); const r = resolution(i, { effectOutcomeClass: outcomeClass,
        effectIdempotencyClass: effectClass });
      const result = evaluate(harness({ attemptRecord: a, invocationRecord: i,
        resolutionRecord: r }));
      assert.deepEqual([result.eligibility.eligibilityClass, result.eligibility.status],
        [eligibilityClass, status]); observations.push(result.eligibility);
    });
  }

  check('stable-key-label-alone-is-insufficient', () => { const policy = retryPolicy({ evaluateReplaySafety: () => ({ replaySafe: true }) }); const h = harness({ resolutionRecord: resolution(invocation(), { effectOutcomeClass: 'EFFECT_POSSIBLE' }), policySnapshot: policy }); assert.equal(evaluate(h).eligibility.eligibilityClass, 'RETRY_NOT_ELIGIBLE_EFFECT_POSSIBLE'); });
  check('confirmed-effect-never-becomes-idempotent-replay-safe', () => { const h = harness({ resolutionRecord: resolution(invocation(), { effectOutcomeClass: 'EFFECT_CONFIRMED' }) }); assert.equal(evaluate(h).eligibility.retrySafetyClass, null); });
  check('logical-effect-correlation-is-immutable', () => { const h = harness({ resolutionRecord: resolution(invocation(), { logicalEffectId: 'other' }) }); assert.equal(evaluate(h).outcome, 'RETRY_ELIGIBILITY_REJECTED'); });
  check('distinct-immutable-eligibility-id', () => { const result = evaluate(harness()); assert.equal(result.eligibility.attemptRetryEligibilityId, 'eligibility-1'); });
  check('exact-duplicate-is-deterministic', () => { const h = harness(); const first = evaluate(h); const second = evaluate(h); assert.equal(second.outcome, 'RETRY_ELIGIBILITY_ALREADY_RECORDED'); assert.deepEqual(second.eligibility, first.eligibility); });
  check('same-id-changed-binding-rejected', () => { const h = harness(); evaluate(h); h.resolutionRecord.effectOutcomeClass = 'EFFECT_CONFIRMED'; assert.equal(evaluate(h).outcome, 'RETRY_ELIGIBILITY_REJECTED'); });
  check('cross-attempt-id-collision-rejected', () => { const first = harness(); const record = evaluate(first).eligibility; const other = attempt({ executionAttemptId: 'attempt-2' }); const inv = invocation(other, { effectInvocationId: 'invocation-2' }); const res = resolution(inv, { effectOutcomeResolutionId: 'resolution-2' }); const h = harness({ attemptRecord: other, invocationRecord: inv, resolutionRecord: res, ledger: createLedger({ seed: [record] }) }); assert.equal(evaluate(h, { previousExecutionAttemptId: 'attempt-2', effectOutcomeResolutionId: 'resolution-2' }).outcome, 'RETRY_ELIGIBILITY_REJECTED'); });
  check('later-resolution-creates-superseding-record', () => { const first = harness(); const old = evaluate(first).eligibility; const res = resolution(invocation(), { effectOutcomeResolutionId: 'resolution-2', resolutionRevision: 2, evidenceSetRevision: 2, evidenceSetDigest: 'sha256:evidence-set-2', supersedesResolutionRef: 'resolution-1' }); const h = harness({ resolutionRecord: res, ledger: createLedger({ seed: [old] }) }); const next = evaluate(h, { attemptRetryEligibilityId: 'eligibility-2', effectOutcomeResolutionId: 'resolution-2', expectedOutcomeResolutionRevision: 2, expectedEvidenceSetRevision: 2, expectedEvidenceSetDigest: 'sha256:evidence-set-2' }); assert.equal(next.eligibility.retryEligibilityRevision, 2); assert.equal(next.eligibility.supersedesRetryEligibilityRef, 'eligibility-1'); assert.equal(h.ledger.records[0].attemptRetryEligibilityId, 'eligibility-1'); });
  check('response-loss-recovers-same-id', () => assert.equal(evaluate(harness({ ledger: createLedger({ mode: 'STORE_THEN_THROW' }) })).outcome, 'RETRY_ELIGIBILITY_ALREADY_RECORDED'));
  check('uncertain-commit-manufactures-no-eligibility', () => { const h = harness({ ledger: createLedger({ mode: 'THROW_BEFORE' }) }); const result = evaluate(h); assert.equal(result.outcome, 'RETRY_ELIGIBILITY_UNCERTAIN'); assert.equal(h.ledger.records.length, 0); });
  check('atomic-staleness-fails-closed', () => assert.equal(evaluate(harness({ ledger: createLedger({ mode: 'STALE' }) })).outcome, 'OUTCOME_RESOLUTION_STALE'));
  check('corrupt-commit-return-fails-closed', () => assert.equal(evaluate(harness({ ledger: createLedger({ mode: 'CORRUPT_RETURN' }) })).outcome, 'RETRY_ELIGIBILITY_UNCERTAIN'));
  check('conflicting-ledger-fails-closed', () => { const first = evaluate(harness()).eligibility; const h = harness({ ledger: createLedger({ seed: [first, first] }) }); assert.equal(evaluate(h).outcome, 'RETRY_ELIGIBILITY_UNCERTAIN'); });
  check('eligibility-creates-no-retry-authority', () => { const result = evaluate(harness()); assert.deepEqual([result.retryAllowed, result.eligibility.retryAllowed, result.authorityCreated], [false, false, false]); });
  check('eligibility-creates-no-attempt', () => { const result = evaluate(harness()); assert.deepEqual([result.attemptCreated, result.eligibility.attemptCreated], [false, false]); });
  check('exact-action-target-scope-input-preserved', () => { const result = evaluate(harness()).eligibility; assert.deepEqual([result.actionIdentity, result.continuationTargetRef, result.authorityScope, result.inputRef, result.verifiedInputDigest], ['offer.update', 'offer.update:offer-1', { offerId: 'offer-1' }, 'input:offer-1', 'sha256:input-1']); });
  check('positive-handoff-matches-frozen-attempt-creation', () => { const h = harness(); const eligibility = evaluate(h).eligibility; const prepared = { type: 'EXECUTION_PREPARATION', status: 'EXECUTION_PREPARED', executionId: 'execution-1', executionAcceptanceId: 'acceptance-1', preparationRevision: 1, dispatchId: 'dispatch-1', idempotencyKey: 'key-1', continuationId: 'continuation-1', interactionId: 'interaction-1', gateId: 'gate-1', gateRevision: 1, authorityScope: { offerId: 'offer-1' }, continuationTargetRef: 'offer.update:offer-1', authorityEvidenceRef: 'authority-1', governanceEvaluationRef: 'evaluation-1', authorityCommittedRevision: 1, actionIdentity: 'offer.update', actionRevision: '1', actionRegistrationIdentity: 'registration-1', actionRegistrationRevision: '1', executionOwnerIdentity: 'execution-owner-1', inputRef: 'input:offer-1', expectedInputDigest: 'sha256:input-1', verifiedInputDigest: 'sha256:input-1', verifiedInputEvidenceRef: 'input-evidence-1', effectContractRef: 'effect-contract-1', effectContractRevision: '1', effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY', resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1', singleLogicalExecution: true, attemptEligibility: 'ELIGIBLE_FOR_GOVERNED_ATTEMPT_CREATION' }; const attempts = [attempt()]; const creator = createGovernedExecutionAttemptCreation({ preparationSnapshotPort: () => ({ evidenceRef: 'preparation-evidence-1', record: prepared }), retryEligibilitySnapshotPort: () => ({ evidenceRef: 'eligibility-evidence-1', record: eligibility }), logicalEffectIdentityPort: () => ({ logicalEffectId: 'logical-effect-1', derivationIdentity: 'derivation-1', derivationRevision: '1' }), attemptLedger: { findByExecution: () => clone(attempts), findByAttemptId: (id) => attempts.filter((item) => item.executionAttemptId === id).map(clone), commitAttempt(record) { attempts.push(clone(record)); return clone(record); } } }); const created = creator.create({ executionId: 'execution-1', executionAttemptId: 'attempt-2', expectedPreparationRevision: 1, retryEligibilityEvidenceRef: 'eligibility-evidence-1' }); assert.equal(created.outcome, 'ATTEMPT_CREATED'); });
  check('negative-eligibility-cannot-enter-attempt-creation', () => { const h = harness({ resolutionRecord: resolution(invocation(), { effectOutcomeClass: 'EFFECT_CONFIRMED' }) }); const result = evaluate(h); assert.equal(result.eligibility.status, 'RETRY_NOT_ELIGIBLE'); assert.equal(result.eligibility.retrySafetyClass, null); });
  check('no-external-effect-remains-excluded', () => { const a = attempt({ effectIdempotencyClass: 'NO_EXTERNAL_EFFECT', logicalEffectId: '' }); assert.equal(evaluate(harness({ attemptRecord: a })).outcome, 'RETRY_ELIGIBILITY_REJECTED'); });
  check('operation-grammar-is-exact', () => assert.deepEqual(Object.values(RETRY_ELIGIBILITY_OPERATION_OUTCOMES).sort(), ['OUTCOME_RESOLUTION_NOT_FOUND', 'OUTCOME_RESOLUTION_STALE', 'PRIOR_ATTEMPT_NOT_FOUND', 'RETRY_ELIGIBILITY_ALREADY_RECORDED', 'RETRY_ELIGIBILITY_RECORDED', 'RETRY_ELIGIBILITY_REJECTED', 'RETRY_ELIGIBILITY_UNCERTAIN', 'RETRY_POLICY_NOT_FOUND']));
  check('eligibility-class-grammar-is-exact', () => assert.deepEqual(RETRY_ELIGIBILITY_CLASSES, ['PROVEN_NO_EFFECT', 'IDEMPOTENT_REPLAY_SAFE', 'RETRY_NOT_ELIGIBLE_EFFECT_CONFIRMED', 'RETRY_NOT_ELIGIBLE_EFFECT_POSSIBLE', 'RETRY_NOT_ELIGIBLE_OUTCOME_UNKNOWN', 'RETRY_NOT_ELIGIBLE_EVIDENCE_CONFLICT', 'RETRY_NOT_ELIGIBLE_NON_IDEMPOTENT']));
  check('component-exposes-only-evaluate', () => assert.deepEqual(Object.keys(harness().component), ['evaluate']));
  check('required-ports-validated', () => assert.throws(() => createGovernedAttemptRetryEligibility({}), TypeError));
  check('no-provider-effect-result-completion-human-operations', () => { const h = harness(); evaluate(h); assert.deepEqual([h.calls.provider, h.calls.effect, h.calls.result, h.calls.completion, h.calls.human], [0, 0, 0, 0, 0]); });
  check('equivalent-runs-are-deterministic', () => { const left = evaluate(harness()); const right = evaluate(harness()); assert.deepEqual(left, right); observations.push(left.eligibility); });

  const canonical = canonicalStringify({ cases, observations,
    operationOutcomes: Object.values(RETRY_ELIGIBILITY_OPERATION_OUTCOMES),
    eligibilityClasses: RETRY_ELIGIBILITY_CLASSES });
  return { cases, canonical,
    hash: crypto.createHash('sha256').update(canonical).digest('hex') };
}

const first = runSuite(); const second = runSuite();
assert.equal(first.canonical, second.canonical);
console.log(canonicalStringify({ suite: 'governed-attempt-retry-eligibility-v0',
  status: 'PASS', cases: first.cases.length, deterministic: true, hash: first.hash }));
