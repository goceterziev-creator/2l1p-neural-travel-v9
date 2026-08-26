'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { COMPLETION_OUTCOMES, EFFECT_CLASSES,
  createGovernedExecutionCompletion } = require('./execution-completion');

const clone = (value) => JSON.parse(JSON.stringify(value));
const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());

function start(overrides = {}) {
  return { type: 'EXECUTION_ATTEMPT_START', status: 'EXECUTION_ATTEMPT_STARTED',
    executionStartId: 'start-1', startRevision: 1, executionAttemptId: 'attempt-1',
    attemptRevision: 1, attemptClaimId: 'claim-1', claimRevision: 1,
    executionId: 'execution-1', executionAcceptanceId: 'acceptance-authority-1',
    dispatchId: 'dispatch-1', continuationId: 'continuation-1',
    interactionId: 'interaction-1', gateId: 'gate-1', authorityScope: { offerId: 'offer-1' },
    actionIdentity: 'offer.update', actionRevision: '1',
    continuationTargetRef: 'offer.update:offer-1', executionOwnerIdentity: 'owner-1',
    inputRef: 'input-1', verifiedInputDigest: 'sha256:input-1',
    effectContractRef: 'effect-contract-1', effectContractRevision: '1',
    effectIdempotencyClass: 'NO_EXTERNAL_EFFECT', logicalEffectId: null,
    resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1',
    executionActivityStarted: true, singleAuthoritativeStart: true, ...clone(overrides) };
}

function acceptance(startRecord = start(), overrides = {}) {
  const capable = startRecord.effectIdempotencyClass !== 'NO_EXTERNAL_EFFECT';
  return { type: capable ? 'EFFECT_CAPABLE_RESULT_ACCEPTANCE'
    : 'EFFECT_FREE_RESULT_ACCEPTANCE', status: 'RESULT_ACCEPTED',
  resultAcceptanceId: 'result-acceptance-1', acceptanceRevision: 1,
  executionStartId: startRecord.executionStartId,
  executionAttemptId: startRecord.executionAttemptId, executionId: startRecord.executionId,
  actionIdentity: startRecord.actionIdentity, actionRevision: startRecord.actionRevision,
  continuationTargetRef: startRecord.continuationTargetRef, inputRef: startRecord.inputRef,
  verifiedInputDigest: startRecord.verifiedInputDigest,
  effectContractRef: startRecord.effectContractRef,
  effectContractRevision: startRecord.effectContractRevision,
  effectIdempotencyClass: startRecord.effectIdempotencyClass,
  logicalEffectId: startRecord.logicalEffectId,
  resultEvidenceGrammarRef: startRecord.resultEvidenceGrammarRef,
  resultEvidenceGrammarRevision: startRecord.resultEvidenceGrammarRevision,
  evidenceSetRevision: 1, evidenceSetDigest: 'evidence-set-digest-1',
  acceptedResultRef: 'result-1', acceptedResultDigest: 'result-digest-1',
  resultAccepted: true, executionCompleted: false, executionSuccessful: false,
  ...(capable ? { effectOutcomeResolutionId: 'resolution-1',
    outcomeResolutionEvidenceRef: 'resolution-evidence-1', outcomeResolutionRevision: 1,
    effectInvocationId: 'invocation-1', effectOutcomeClass: 'EFFECT_CONFIRMED' } : {}),
  ...clone(overrides) };
}

function attempt(ordinal = 1, overrides = {}) {
  return { type: 'EXECUTION_ATTEMPT', status: 'ATTEMPT_CREATED',
    executionId: 'execution-1', executionAttemptId: `attempt-${ordinal}`,
    attemptOrdinal: ordinal, previousExecutionAttemptId: ordinal === 1
      ? null : `attempt-${ordinal - 1}`, ...clone(overrides) };
}

function terminal(overrides = {}) {
  return { evidenceRef: 'terminal-evidence-1', record: {
    type: 'EXECUTION_TERMINAL_STATE', executionId: 'execution-1',
    status: 'NOT_COMPLETED', terminalStateRevision: 1, ...clone(overrides) } };
}

function createLedger({ seed = [], errorCode = null, corruptReturn = false,
  persistThenThrow = false } = {}) {
  const records = seed.map(clone);
  let commits = 0;
  return { records, get commits() { return commits; },
    findById(id) { return records.filter((item) => item.executionCompletionId === id).map(clone); },
    findByExecution(id) { return records.filter((item) => item.executionId === id).map(clone); },
    commitCompletion(record, guards) {
      commits += 1;
      assert.equal(guards.uniqueExecutionCompletionId, true);
      assert.equal(guards.singleCompletionForExecution, true);
      assert.deepEqual(guards.terminalTransitionGuard, {
        evidenceRef: 'terminal-evidence-1', fromStatus: 'NOT_COMPLETED', fromRevision: 1,
        toStatus: 'COMPLETED', toRevision: 2, atomicWithCompletion: true });
      assert.equal(guards.resultAcceptanceGuard.currentAcceptance, true);
      assert.equal(guards.attemptHistoryGuard.noLaterOrCompetingAttempt, true);
      if (errorCode) { const error = new Error(errorCode); error.code = errorCode; throw error; }
      records.push(clone(record));
      if (persistThenThrow) throw new Error('response lost');
      const committed = clone(record);
      if (corruptReturn) committed.acceptedResultDigest = 'corrupt';
      return committed;
    } };
}

function harness(overrides = {}) {
  const startRecord = Object.hasOwn(overrides, 'startRecord') ? overrides.startRecord : start();
  const acceptanceRecord = Object.hasOwn(overrides, 'acceptanceRecord')
    ? overrides.acceptanceRecord : acceptance(startRecord || start());
  const startSnapshot = startRecord && { evidenceRef: 'start-evidence-1', record: startRecord };
  const acceptanceSnapshot = acceptanceRecord && {
    evidenceRef: 'result-acceptance-evidence-1', record: acceptanceRecord };
  const currentAcceptance = Object.hasOwn(overrides, 'currentAcceptance')
    ? overrides.currentAcceptance : acceptanceSnapshot;
  const history = Object.hasOwn(overrides, 'history') ? overrides.history : {
    evidenceRef: 'attempt-history-evidence-1', revision: 1, records: [attempt()] };
  const terminalSnapshot = Object.hasOwn(overrides, 'terminalSnapshot')
    ? overrides.terminalSnapshot : terminal();
  const ledger = overrides.ledger || createLedger();
  const calls = { start: 0, acceptance: 0, current: 0, history: 0, terminal: 0,
    provider: 0, executor: 0, product: 0, effect: 0, retry: 0, human: 0 };
  const creator = createGovernedExecutionCompletion({
    startSnapshotPort: () => { calls.start += 1;
      if (overrides.portError === 'start') throw new Error('unavailable'); return clone(startSnapshot); },
    resultAcceptanceSnapshotPort: () => { calls.acceptance += 1;
      if (overrides.portError === 'acceptance') throw new Error('unavailable');
      return clone(acceptanceSnapshot); },
    currentResultAcceptancePort: () => { calls.current += 1;
      if (overrides.portError === 'current') throw new Error('unavailable');
      return clone(currentAcceptance); },
    attemptHistoryPort: () => { calls.history += 1;
      if (overrides.portError === 'history') throw new Error('unavailable'); return clone(history); },
    executionTerminalStatePort: () => { calls.terminal += 1;
      if (overrides.portError === 'terminal') throw new Error('unavailable');
      return clone(terminalSnapshot); }, completionLedger: ledger });
  return { creator, ledger, calls };
}

const request = Object.freeze({ executionCompletionId: 'completion-1',
  executionId: 'execution-1', executionStartId: 'start-1',
  resultAcceptanceId: 'result-acceptance-1', expectedAcceptanceRevision: 1,
  expectedAttemptHistoryRevision: 1, expectedTerminalStateRevision: 1 });

function runSuite() {
  const cases = []; const observations = [];
  const check = (name, fn) => { fn(); cases.push(name); };

  check('effect-free-result-completes-logical-execution', () => {
    const response = harness().creator.complete(request);
    assert.equal(response.outcome, 'EXECUTION_COMPLETED');
    assert.equal(response.completion.resultAcceptanceType, 'EFFECT_FREE_RESULT_ACCEPTANCE');
    assert.deepEqual([response.executionCompleted, response.executionSuccessful], [true, false]);
    observations.push(response.completion);
  });
  check('effect-capable-result-completes-with-exact-provenance', () => {
    const s = start({ effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY',
      logicalEffectId: 'logical-effect-1' });
    const response = harness({ startRecord: s, acceptanceRecord: acceptance(s) })
      .creator.complete(request);
    assert.equal(response.outcome, 'EXECUTION_COMPLETED');
    assert.deepEqual([response.completion.effectOutcomeClass,
      response.completion.effectInvocationId, response.completion.logicalEffectId],
    ['EFFECT_CONFIRMED', 'invocation-1', 'logical-effect-1']);
  });
  check('non-idempotent-effect-capable-result-is-supported', () => {
    const s = start({ effectIdempotencyClass: 'NON_IDEMPOTENT',
      logicalEffectId: 'logical-effect-1' });
    assert.equal(harness({ startRecord: s, acceptanceRecord: acceptance(s) })
      .creator.complete(request).outcome, 'EXECUTION_COMPLETED');
  });
  check('invalid-request-is-rejected', () => assert.equal(harness().creator.complete({}).outcome,
    'COMPLETION_REJECTED'));
  check('missing-start-fails-closed', () => assert.equal(harness({ startRecord: null })
    .creator.complete(request).outcome, 'START_NOT_FOUND'));
  check('mismatched-start-fails-closed', () => assert.equal(harness({ startRecord:
    start({ executionId: 'other' }) }).creator.complete(request).outcome, 'START_NOT_FOUND'));
  check('missing-acceptance-fails-closed', () => assert.equal(harness({ acceptanceRecord: null })
    .creator.complete(request).outcome, 'RESULT_ACCEPTANCE_NOT_FOUND'));
  check('non-accepted-result-fails-closed', () => assert.equal(harness({ acceptanceRecord:
    acceptance(start(), { status: 'RESULT_REJECTED' }) }).creator.complete(request).outcome,
  'RESULT_ACCEPTANCE_NOT_FOUND'));
  check('caller-result-assertion-is-not-authority', () => assert.equal(harness({
    acceptanceRecord: null }).creator.complete({ ...request, resultAccepted: true }).outcome,
  'RESULT_ACCEPTANCE_NOT_FOUND'));
  check('stale-acceptance-revision-is-blocked', () => assert.equal(harness().creator.complete({
    ...request, expectedAcceptanceRevision: 2 }).outcome, 'RESULT_ACCEPTANCE_STALE'));
  check('superseded-acceptance-is-blocked', () => assert.equal(harness({ currentAcceptance: {
    evidenceRef: 'new-evidence', record: acceptance(start(), { resultAcceptanceId: 'new' }) } })
    .creator.complete(request).outcome, 'RESULT_ACCEPTANCE_STALE'));
  check('changed-accepted-result-binding-is-invalid', () => assert.equal(harness({
    acceptanceRecord: acceptance(start(), { verifiedInputDigest: 'changed' }) })
    .creator.complete(request).outcome, 'RESULT_ACCEPTANCE_NOT_FOUND'));
  check('missing-history-fails-closed', () => assert.equal(harness({ history: null })
    .creator.complete(request).outcome, 'ATTEMPT_HISTORY_STALE'));
  check('history-revision-drift-is-blocked', () => assert.equal(harness().creator.complete({
    ...request, expectedAttemptHistoryRevision: 2 }).outcome, 'ATTEMPT_HISTORY_STALE'));
  check('later-attempt-is-blocked', () => assert.equal(harness({ history: {
    evidenceRef: 'attempt-history-evidence-2', revision: 2,
    records: [attempt(), attempt(2)] } }).creator.complete({ ...request,
    expectedAttemptHistoryRevision: 2 }).outcome, 'ATTEMPT_HISTORY_STALE'));
  check('missing-terminal-state-fails-closed', () => assert.equal(harness({ terminalSnapshot: null })
    .creator.complete(request).outcome, 'COMPLETION_UNCERTAIN'));
  check('conflicting-terminal-state-fails-closed', () => assert.equal(harness({ terminalSnapshot:
    terminal({ conflictingEvidence: true }) }).creator.complete(request).outcome,
  'COMPLETION_UNCERTAIN'));
  check('already-completed-terminal-state-is-distinct', () => assert.equal(harness({
    terminalSnapshot: terminal({ status: 'COMPLETED' }) }).creator.complete(request).outcome,
  'EXECUTION_ALREADY_COMPLETED'));
  check('terminal-state-revision-drift-is-blocked', () => assert.equal(harness({ terminalSnapshot:
    terminal({ terminalStateRevision: 2 }) }).creator.complete(request).outcome,
  'COMPLETION_REJECTED'));
  check('port-unavailability-is-uncertain', () => assert.equal(harness({ portError: 'current' })
    .creator.complete(request).outcome, 'COMPLETION_UNCERTAIN'));
  check('result-acceptance-race-is-blocked', () => assert.equal(harness({ ledger:
    createLedger({ errorCode: 'RESULT_ACCEPTANCE_STALE' }) }).creator.complete(request).outcome,
  'RESULT_ACCEPTANCE_STALE'));
  check('attempt-history-race-is-blocked', () => assert.equal(harness({ ledger:
    createLedger({ errorCode: 'ATTEMPT_HISTORY_STALE' }) }).creator.complete(request).outcome,
  'ATTEMPT_HISTORY_STALE'));
  check('competing-completion-wins-atomically', () => assert.equal(harness({ ledger:
    createLedger({ errorCode: 'EXECUTION_ALREADY_COMPLETED' }) }).creator.complete(request).outcome,
  'EXECUTION_ALREADY_COMPLETED'));
  check('inconsistent-commit-return-is-uncertain', () => assert.equal(harness({ ledger:
    createLedger({ corruptReturn: true }) }).creator.complete(request).outcome,
  'COMPLETION_UNCERTAIN'));
  check('response-loss-recovers-exact-completion', () => assert.equal(harness({ ledger:
    createLedger({ persistThenThrow: true }) }).creator.complete(request).outcome,
  'COMPLETION_ALREADY_RECORDED'));

  const created = harness().creator.complete(request).completion;
  check('same-id-recovery-is-deterministic', () => {
    const h = harness({ ledger: createLedger({ seed: [created] }) });
    const recovered = h.creator.complete(request);
    assert.equal(recovered.outcome, 'COMPLETION_ALREADY_RECORDED');
    assert.deepEqual(recovered.completion, created);
    assert.deepEqual([h.calls.start, h.calls.acceptance, h.calls.current,
      h.calls.history, h.calls.terminal], [0, 0, 0, 0, 0]);
  });
  check('same-id-changed-binding-is-rejected', () => assert.equal(harness({ ledger:
    createLedger({ seed: [created] }) }).creator.complete({ ...request,
    resultAcceptanceId: 'changed' }).outcome, 'COMPLETION_REJECTED'));
  check('different-id-after-completion-is-blocked', () => assert.equal(harness({ ledger:
    createLedger({ seed: [created] }) }).creator.complete({ ...request,
    executionCompletionId: 'completion-2' }).outcome, 'EXECUTION_ALREADY_COMPLETED'));
  check('completion-record-is-not-success-or-authority', () => {
    assert.deepEqual([created.executionCompleted, created.executionSuccessful,
      created.authorityCreated, created.retryAuthorityCreated], [true, false, false, false]);
  });
  check('effect-free-provenance-does-not-invent-effect', () => {
    assert.deepEqual([created.logicalEffectId, created.effectOutcomeClass,
      created.effectInvocationId], [null, null, null]);
  });
  check('no-provider-product-effect-retry-human-operations', () => {
    const h = harness(); h.creator.complete(request);
    assert.deepEqual([h.calls.provider, h.calls.executor, h.calls.product, h.calls.effect,
      h.calls.retry, h.calls.human], [0, 0, 0, 0, 0, 0]);
  });
  check('outcome-grammar-is-exact', () => assert.deepEqual(
    Object.values(COMPLETION_OUTCOMES).sort(), ['ATTEMPT_HISTORY_STALE',
      'COMPLETION_ALREADY_RECORDED', 'COMPLETION_REJECTED', 'COMPLETION_UNCERTAIN',
      'EXECUTION_ALREADY_COMPLETED', 'EXECUTION_COMPLETED', 'RESULT_ACCEPTANCE_NOT_FOUND',
      'RESULT_ACCEPTANCE_STALE', 'START_NOT_FOUND']));
  check('effect-class-grammar-is-exact', () => assert.deepEqual(EFFECT_CLASSES,
    ['NO_EXTERNAL_EFFECT', 'IDEMPOTENT_WITH_STABLE_KEY', 'NON_IDEMPOTENT']));

  const hash = crypto.createHash('sha256').update(JSON.stringify({ cases, observations })).digest('hex');
  return { suite: 'governed-execution-completion-v0', status: 'PASS',
    cases: cases.length, deterministic: true, hash };
}

const first = runSuite(); const second = runSuite();
assert.deepEqual(first, second);
process.stdout.write(`${JSON.stringify(first, null, 2)}\n`);
