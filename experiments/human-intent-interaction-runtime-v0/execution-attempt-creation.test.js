'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { canonicalStringify } = require('../human-intent-layer-v0/intent-layer');
const {
  ATTEMPT_CREATION_OUTCOMES,
  createGovernedExecutionAttemptCreation
} = require('./execution-attempt-creation');

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const authorityScope = Object.freeze({ action: 'update-offer', offerId: 'offer-1' });

function preparation(overrides = {}) {
  return {
    type: 'EXECUTION_PREPARATION',
    status: 'EXECUTION_PREPARED',
    executionId: 'execution-1',
    executionAcceptanceId: 'acceptance-1',
    preparationRevision: 1,
    dispatchId: 'dispatch-1',
    idempotencyKey: 'dispatch-key-1',
    continuationId: 'continuation-1',
    interactionId: 'interaction-1',
    gateId: 'gate-1',
    gateRevision: 2,
    authorityScope: clone(authorityScope),
    continuationTargetRef: 'offer.update:offer-1',
    authorityEvidenceRef: 'authority-1',
    governanceEvaluationRef: 'evaluation-1',
    authorityCommittedRevision: 7,
    actionIdentity: 'offer.update',
    actionRevision: '1',
    actionRegistrationIdentity: 'action-registration-1',
    actionRegistrationRevision: '3',
    executionOwnerIdentity: 'offer-execution-owner',
    inputRef: 'input:offer-1',
    expectedInputDigest: 'sha256:input-1',
    verifiedInputDigest: 'sha256:input-1',
    verifiedInputEvidenceRef: 'input-evidence-1',
    effectContractRef: 'effect-contract-1',
    effectContractRevision: '1',
    effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY',
    resultEvidenceGrammarRef: 'result-grammar-1',
    resultEvidenceGrammarRevision: '1',
    singleLogicalExecution: true,
    attemptEligibility: 'ELIGIBLE_FOR_GOVERNED_ATTEMPT_CREATION',
    ...clone(overrides)
  };
}

function preparationSnapshot(record = preparation(), evidenceRef = 'preparation-evidence-1') {
  return { evidenceRef, record: clone(record) };
}

function terminalState(overrides = {}) {
  return { evidenceRef: 'terminal-state-evidence-1', record: {
    type: 'EXECUTION_TERMINAL_STATE', status: 'NOT_COMPLETED',
    executionId: 'execution-1', terminalStateRevision: 1, ...clone(overrides) } };
}

function retryEvidence(previous, overrides = {}) {
  return {
    evidenceRef: `retry-evidence-${previous.attemptOrdinal}`,
    record: {
      type: 'ATTEMPT_RETRY_ELIGIBILITY',
      status: 'RETRY_ELIGIBLE',
      executionId: previous.executionId,
      previousExecutionAttemptId: previous.executionAttemptId,
      previousAttemptRevision: previous.attemptRevision,
      preparationEvidenceRef: previous.preparationEvidenceRef,
      preparationRevision: previous.preparationRevision,
      logicalEffectId: previous.logicalEffectId,
      terminalityClass: 'TERMINAL_BEFORE_EFFECT',
      retrySafetyClass: 'PROVEN_NO_EFFECT',
      lifecycleEvidenceRef: `lifecycle-${previous.executionAttemptId}`,
      retryEligibilityRevision: 1,
      ...clone(overrides)
    }
  };
}

function createLedger({ seed = [], commitMode = 'NORMAL', commitErrorCode = null,
  corruptReturn = false } = {}) {
  const records = seed.map(clone);
  let commits = 0;
  return {
    records,
    get commits() { return commits; },
    findByExecution(id) {
      return records.filter((record) => record.executionId === id).map(clone);
    },
    findByAttemptId(id) {
      return records.filter((record) => record.executionAttemptId === id).map(clone);
    },
    commitAttempt(record, guards) {
      commits += 1;
      if (!guards || guards.preparationGuard.preparationRevision !== 1
        || guards.executionTerminalGuard.evidenceRef !== 'terminal-state-evidence-1'
        || guards.executionTerminalGuard.terminalStateRevision !== 1
        || guards.executionTerminalGuard.terminalStatus !== 'NOT_COMPLETED'
        || guards.executionTerminalGuard.executionNotCompleted !== true
        || guards.preparationGuard.attemptEligibility !== 'ELIGIBLE_FOR_GOVERNED_ATTEMPT_CREATION'
        || guards.identityGuard.executionId !== record.executionId
        || guards.identityGuard.executionAttemptId !== record.executionAttemptId
        || guards.historyGuard.historyRevision !== records.filter((item) =>
          item.executionId === record.executionId).length
        || guards.contractGuard.actionRevision !== '1'
        || guards.contractGuard.effectContractRevision !== '1'
        || guards.contractGuard.resultEvidenceGrammarRevision !== '1') {
        const error = new Error('guarded preparation changed');
        error.code = 'PREPARATION_STALE';
        throw error;
      }
      if (commitErrorCode) {
        const error = new Error(commitErrorCode);
        error.code = commitErrorCode;
        throw error;
      }
      if (commitMode === 'THROW_BEFORE') throw new Error('persistence unavailable');
      if (records.some((item) => item.executionAttemptId === record.executionAttemptId)) {
        throw new Error('unique attempt conflict');
      }
      records.push(clone(record));
      if (commitMode === 'STORE_THEN_THROW') throw new Error('caller missed commit');
      return corruptReturn ? { ...clone(record), actionRevision: 'corrupt' } : clone(record);
    }
  };
}

function harness(overrides = {}) {
  const prepared = Object.hasOwn(overrides, 'prepared') ? overrides.prepared : preparation();
  const evidenceRef = overrides.preparationEvidenceRef || 'preparation-evidence-1';
  const retries = overrides.retries || new Map();
  const terminal = Object.hasOwn(overrides, 'terminalState')
    ? overrides.terminalState : terminalState();
  const ledger = overrides.ledger || createLedger();
  const calls = { preparation: 0, terminal: 0, retry: 0, identity: 0, scheduler: 0, adapter: 0,
    claim: 0, start: 0, executor: 0, product: 0, effect: 0 };
  const creator = createGovernedExecutionAttemptCreation({
    preparationSnapshotPort: (executionId) => {
      calls.preparation += 1;
      if (overrides.preparationError) throw new Error('preparation unavailable');
      if (!prepared || prepared.executionId !== executionId) return null;
      return preparationSnapshot(prepared, evidenceRef);
    },
    executionTerminalStatePort: (executionId) => {
      calls.terminal += 1;
      if (overrides.terminalStateError) throw new Error('terminal state unavailable');
      if (!terminal || !terminal.record || terminal.record.executionId !== executionId) return null;
      return clone(terminal);
    },
    retryEligibilitySnapshotPort: (ref) => {
      calls.retry += 1;
      if (overrides.retryError) throw new Error('retry evidence unavailable');
      return clone(retries.get(ref) || null);
    },
    logicalEffectIdentityPort: (binding) => {
      calls.identity += 1;
      if (overrides.identityError) throw new Error('identity unavailable');
      if (overrides.effectIdentity) return clone(overrides.effectIdentity);
      return {
        logicalEffectId: binding.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
          ? null : `effect:${binding.executionId}:${binding.verifiedInputDigest}`,
        derivationIdentity: 'logical-effect-binding',
        derivationRevision: '1'
      };
    },
    attemptLedger: ledger
  });
  return { creator, ledger, calls, prepared };
}

const firstRequest = Object.freeze({ executionId: 'execution-1',
  executionAttemptId: 'attempt-1', expectedPreparationRevision: 1 });

function makeFirstAttempt(effectClass = 'IDEMPOTENT_WITH_STABLE_KEY') {
  const h = harness({ prepared: preparation({ effectIdempotencyClass: effectClass }) });
  const response = h.creator.create(firstRequest);
  assert.equal(response.outcome, 'ATTEMPT_CREATED');
  return { h, attempt: response.attempt };
}

function runSuite() {
  const cases = [];
  const observations = [];
  const check = (name, fn) => { fn(); cases.push(name); };

  check('no-attempt-without-authoritative-preparation', () => {
    assert.equal(harness({ prepared: null }).creator.create(firstRequest).outcome,
      'EXECUTION_NOT_PREPARED');
  });

  check('fabricated-preparation-fields-do-not-grant-attempt', () => {
    const response = harness({ prepared: null }).creator.create({ ...firstRequest,
      status: 'EXECUTION_PREPARED', attemptEligibility: 'ELIGIBLE_FOR_GOVERNED_ATTEMPT_CREATION' });
    assert.equal(response.outcome, 'EXECUTION_NOT_PREPARED');
  });

  check('incoherent-authoritative-preparation-fails-closed', () => {
    assert.equal(harness({ prepared: preparation({ verifiedInputDigest: '' }) })
      .creator.create(firstRequest).outcome, 'INVALID_EXECUTION_PREPARATION');
  });

  check('stale-expected-preparation-revision-fails-closed', () => {
    assert.equal(harness().creator.create({ ...firstRequest, expectedPreparationRevision: 2 }).outcome,
      'PREPARATION_STALE');
  });

  check('ineligible-preparation-does-not-create-attempt', () => {
    assert.equal(harness({ prepared: preparation({ attemptEligibility: 'BLOCKED' }) })
      .creator.create(firstRequest).outcome, 'EXECUTION_NOT_ELIGIBLE');
  });

  check('completed-logical-execution-blocks-first-attempt', () => {
    assert.equal(harness({ terminalState: terminalState({ status: 'COMPLETED' }) })
      .creator.create(firstRequest).outcome, 'EXECUTION_ALREADY_COMPLETED');
  });

  check('caller-not-completed-assertion-is-not-authority', () => {
    const response = harness({ terminalState: terminalState({ status: 'COMPLETED' }) })
      .creator.create({ ...firstRequest, executionNotCompleted: true,
        terminalStatus: 'NOT_COMPLETED' });
    assert.equal(response.outcome, 'EXECUTION_ALREADY_COMPLETED');
  });

  check('missing-terminal-state-fails-closed', () => {
    assert.equal(harness({ terminalState: null }).creator.create(firstRequest).outcome,
      'ATTEMPT_CREATION_UNCERTAIN');
  });

  check('invalid-terminal-state-fails-closed', () => {
    assert.equal(harness({ terminalState: terminalState({ terminalStateRevision: 0 }) })
      .creator.create(firstRequest).outcome, 'ATTEMPT_CREATION_UNCERTAIN');
  });

  check('conflicting-terminal-state-fails-closed', () => {
    assert.equal(harness({ terminalState: terminalState({ conflictingEvidence: true }) })
      .creator.create(firstRequest).outcome, 'ATTEMPT_CREATION_UNCERTAIN');
  });

  check('unavailable-terminal-state-fails-closed', () => {
    assert.equal(harness({ terminalStateError: true }).creator.create(firstRequest).outcome,
      'ATTEMPT_CREATION_UNCERTAIN');
  });

  const primary = harness();
  const created = primary.creator.create(firstRequest);
  check('first-attempt-is-created-from-exact-preparation', () => {
    assert.equal(created.outcome, 'ATTEMPT_CREATED');
    assert.equal(created.attempt.executionAttemptId, 'attempt-1');
    assert.equal(created.attempt.attemptOrdinal, 1);
  });

  check('attempt-identity-is-distinct-from-upstream-identities', () => {
    for (const executionAttemptId of ['execution-1', 'acceptance-1', 'dispatch-1']) {
      assert.equal(harness().creator.create({ ...firstRequest, executionAttemptId }).outcome,
        'ATTEMPT_CREATION_REJECTED');
    }
  });

  check('exact-duplicate-returns-prior-attempt', () => {
    const duplicate = primary.creator.create(firstRequest);
    assert.equal(duplicate.outcome, 'ALREADY_CREATED');
    assert.deepEqual(duplicate.attempt, created.attempt);
    assert.equal(primary.ledger.commits, 1);
  });

  check('same-id-recovery-remains-deterministic-after-completion', () => {
    const h = harness({ ledger: createLedger({ seed: [created.attempt] }),
      terminalState: terminalState({ status: 'COMPLETED' }) });
    const recovered = h.creator.create(firstRequest);
    assert.equal(recovered.outcome, 'ALREADY_CREATED');
    assert.deepEqual(recovered.attempt, created.attempt);
    assert.equal(h.calls.terminal, 0);
  });

  check('same-execution-different-id-is-blocked-while-unresolved', () => {
    assert.equal(primary.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2' }).outcome,
      'ACTIVE_ATTEMPT_EXISTS');
  });

  check('attempt-id-cannot-cross-execution-boundary', () => {
    const otherPrepared = preparation({ executionId: 'execution-2',
      executionAcceptanceId: 'acceptance-2', dispatchId: 'dispatch-2' });
    const other = harness({ prepared: otherPrepared, ledger: primary.ledger,
      preparationEvidenceRef: 'preparation-evidence-2' });
    assert.equal(other.creator.create({ executionId: 'execution-2',
      executionAttemptId: 'attempt-1', expectedPreparationRevision: 1 }).outcome,
    'ATTEMPT_CREATION_REJECTED');
  });

  check('corrupt-attempt-history-fails-closed', () => {
    const corrupt = { ...clone(created.attempt), attemptOrdinal: 2 };
    assert.equal(harness({ ledger: createLedger({ seed: [corrupt] }) })
      .creator.create({ ...firstRequest, executionAttemptId: 'attempt-2' }).outcome,
    'INVALID_EXECUTION_PREPARATION');
  });

  check('first-attempt-preserves-full-security-lineage', () => {
    const attempt = created.attempt;
    assert.equal(attempt.executionAcceptanceId, 'acceptance-1');
    assert.equal(attempt.continuationTargetRef, 'offer.update:offer-1');
    assert.deepEqual(attempt.authorityScope, authorityScope);
    assert.equal(attempt.executionOwnerIdentity, 'offer-execution-owner');
    assert.equal(attempt.verifiedInputDigest, 'sha256:input-1');
    assert.equal(attempt.resultEvidenceGrammarRevision, '1');
  });

  check('absence-of-completion-never-enables-retry', () => {
    assert.equal(primary.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2',
      completionEvidence: null }).outcome, 'ACTIVE_ATTEMPT_EXISTS');
  });

  check('unclaimed-attempt-blocks-second-attempt', () => {
    assert.equal(created.attempt.claimStatus, 'UNCLAIMED');
    assert.equal(primary.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2' }).outcome,
      'ACTIVE_ATTEMPT_EXISTS');
  });

  check('claim-expiry-or-release-does-not-manufacture-attempt', () => {
    assert.equal(primary.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2',
      claimExpired: true, claimReleased: true }).outcome, 'ACTIVE_ATTEMPT_EXISTS');
  });

  check('retry-reference-must-resolve-authoritatively', () => {
    assert.equal(primary.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2',
      retryEligibilityEvidenceRef: 'missing-retry' }).outcome, 'RETRY_NOT_AUTHORIZED');
  });

  check('retry-evidence-must-bind-exact-previous-attempt', () => {
    const evidence = retryEvidence(created.attempt, { previousExecutionAttemptId: 'other-attempt' });
    const retries = new Map([[evidence.evidenceRef, evidence]]);
    const h = harness({ ledger: createLedger({ seed: [created.attempt] }), retries });
    assert.equal(h.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2',
      retryEligibilityEvidenceRef: evidence.evidenceRef }).outcome, 'RETRY_NOT_AUTHORIZED');
  });

  let provenRetry;
  check('proven-no-effect-permits-retry-attempt', () => {
    const evidence = retryEvidence(created.attempt);
    const retries = new Map([[evidence.evidenceRef, evidence]]);
    const h = harness({ ledger: createLedger({ seed: [created.attempt] }), retries });
    provenRetry = h.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2',
      retryEligibilityEvidenceRef: evidence.evidenceRef });
    assert.equal(provenRetry.outcome, 'ATTEMPT_CREATED');
    assert.equal(provenRetry.attempt.attemptOrdinal, 2);
    assert.equal(provenRetry.attempt.retrySafetyClass, 'PROVEN_NO_EFFECT');
  });

  check('idempotent-replay-safe-permits-possible-effect-retry', () => {
    const evidence = retryEvidence(created.attempt, {
      terminalityClass: 'TERMINAL_POSSIBLE_EFFECT',
      retrySafetyClass: 'IDEMPOTENT_REPLAY_SAFE'
    });
    const h = harness({ ledger: createLedger({ seed: [created.attempt] }),
      retries: new Map([[evidence.evidenceRef, evidence]]) });
    assert.equal(h.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2',
      retryEligibilityEvidenceRef: evidence.evidenceRef }).outcome, 'ATTEMPT_CREATED');
  });

  check('non-idempotent-possible-effect-retry-is-blocked', () => {
    const { attempt } = makeFirstAttempt('NON_IDEMPOTENT');
    const evidence = retryEvidence(attempt, { terminalityClass: 'TERMINAL_POSSIBLE_EFFECT',
      retrySafetyClass: 'IDEMPOTENT_REPLAY_SAFE' });
    const h = harness({ prepared: preparation({ effectIdempotencyClass: 'NON_IDEMPOTENT' }),
      ledger: createLedger({ seed: [attempt] }),
      retries: new Map([[evidence.evidenceRef, evidence]]) });
    assert.equal(h.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2',
      retryEligibilityEvidenceRef: evidence.evidenceRef }).outcome, 'RETRY_NOT_AUTHORIZED');
  });

  check('unknown-outcome-without-idempotency-is-blocked', () => {
    const { attempt } = makeFirstAttempt('NON_IDEMPOTENT');
    const evidence = retryEvidence(attempt, { terminalityClass: 'TERMINAL_OUTCOME_UNKNOWN' });
    const h = harness({ prepared: preparation({ effectIdempotencyClass: 'NON_IDEMPOTENT' }),
      ledger: createLedger({ seed: [attempt] }),
      retries: new Map([[evidence.evidenceRef, evidence]]) });
    assert.equal(h.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2',
      retryEligibilityEvidenceRef: evidence.evidenceRef }).outcome, 'RETRY_NOT_AUTHORIZED');
  });

  check('retry-attempt-reuses-logical-effect-identity', () => {
    assert.equal(provenRetry.attempt.logicalEffectId, created.attempt.logicalEffectId);
  });

  check('logical-effect-identity-is-independent-of-attempt-id', () => {
    assert.equal(created.attempt.logicalEffectId.includes('attempt-1'), false);
    assert.equal(provenRetry.attempt.logicalEffectId.includes('attempt-2'), false);
  });

  check('unknown-or-unverified-effect-class-cannot-create-attempt', () => {
    assert.equal(harness({ prepared: preparation({
      effectIdempotencyClass: 'UNKNOWN_OR_UNVERIFIED' }) }).creator.create(firstRequest).outcome,
    'EXECUTION_NOT_ELIGIBLE');
  });

  check('no-external-effect-has-null-logical-effect-id', () => {
    const { attempt } = makeFirstAttempt('NO_EXTERNAL_EFFECT');
    assert.equal(attempt.logicalEffectId, null);
  });

  check('non-idempotent-effect-id-is-correlation-only', () => {
    const { attempt } = makeFirstAttempt('NON_IDEMPOTENT');
    assert.match(attempt.logicalEffectId, /^effect:execution-1:/);
    assert.equal('idempotencyGuaranteed' in attempt, false);
  });

  check('verified-input-binding-cannot-be-replaced-by-caller', () => {
    const response = harness().creator.create({ ...firstRequest,
      inputRef: 'caller-input', verifiedInputDigest: 'caller-digest' });
    assert.equal(response.attempt.inputRef, 'input:offer-1');
    assert.equal(response.attempt.verifiedInputDigest, 'sha256:input-1');
  });

  check('first-attempt-rejects-retry-evidence', () => {
    assert.equal(harness().creator.create({ ...firstRequest,
      retryEligibilityEvidenceRef: 'retry-on-first' }).outcome, 'ATTEMPT_CREATION_REJECTED');
  });

  check('post-commit-response-loss-recovers-original-attempt', () => {
    const ledger = createLedger({ commitMode: 'STORE_THEN_THROW' });
    const response = harness({ ledger }).creator.create(firstRequest);
    assert.equal(response.outcome, 'ALREADY_CREATED');
    assert.equal(response.attempt.executionAttemptId, 'attempt-1');
    assert.equal(ledger.records.length, 1);
  });

  check('pre-commit-failure-remains-uncertain-and-same-id-only', () => {
    const ledger = createLedger({ commitMode: 'THROW_BEFORE' });
    const response = harness({ ledger }).creator.create(firstRequest);
    assert.equal(response.outcome, 'ATTEMPT_CREATION_UNCERTAIN');
    assert.equal(ledger.records.length, 0);
  });

  check('atomic-preparation-drift-fails-stale', () => {
    const ledger = createLedger({ commitErrorCode: 'PREPARATION_STALE' });
    assert.equal(harness({ ledger }).creator.create(firstRequest).outcome, 'PREPARATION_STALE');
  });

  check('atomic-active-attempt-race-fails-closed', () => {
    const ledger = createLedger({ commitErrorCode: 'ACTIVE_ATTEMPT_EXISTS' });
    assert.equal(harness({ ledger }).creator.create(firstRequest).outcome, 'ACTIVE_ATTEMPT_EXISTS');
  });

  check('atomic-retry-guard-drift-fails-closed', () => {
    const evidence = retryEvidence(created.attempt);
    const ledger = createLedger({ seed: [created.attempt], commitErrorCode: 'RETRY_NOT_AUTHORIZED' });
    const h = harness({ ledger, retries: new Map([[evidence.evidenceRef, evidence]]) });
    assert.equal(h.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2',
      retryEligibilityEvidenceRef: evidence.evidenceRef }).outcome, 'RETRY_NOT_AUTHORIZED');
  });

  check('completion-race-blocks-first-attempt-commit', () => {
    const ledger = createLedger({ commitErrorCode: 'EXECUTION_ALREADY_COMPLETED' });
    assert.equal(harness({ ledger }).creator.create(firstRequest).outcome,
      'EXECUTION_ALREADY_COMPLETED');
    assert.equal(ledger.records.length, 0);
  });

  check('stale-retry-evidence-cannot-cross-completion', () => {
    const evidence = retryEvidence(created.attempt);
    const ledger = createLedger({ seed: [created.attempt] });
    const h = harness({ ledger, retries: new Map([[evidence.evidenceRef, evidence]]),
      terminalState: terminalState({ status: 'COMPLETED' }) });
    assert.equal(h.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2',
      retryEligibilityEvidenceRef: evidence.evidenceRef }).outcome,
    'EXECUTION_ALREADY_COMPLETED');
    assert.equal(ledger.records.length, 1);
  });

  check('completion-race-blocks-retry-attempt-commit', () => {
    const evidence = retryEvidence(created.attempt);
    const ledger = createLedger({ seed: [created.attempt],
      commitErrorCode: 'EXECUTION_ALREADY_COMPLETED' });
    const h = harness({ ledger, retries: new Map([[evidence.evidenceRef, evidence]]) });
    assert.equal(h.creator.create({ ...firstRequest, executionAttemptId: 'attempt-2',
      retryEligibilityEvidenceRef: evidence.evidenceRef }).outcome,
    'EXECUTION_ALREADY_COMPLETED');
    assert.equal(ledger.records.length, 1);
  });

  check('inconsistent-commit-result-is-uncertain', () => {
    const ledger = createLedger({ corruptReturn: true });
    assert.equal(harness({ ledger }).creator.create(firstRequest).outcome,
      'ATTEMPT_CREATION_UNCERTAIN');
  });

  check('attempt-is-created-unclaimed', () => {
    assert.equal(created.attempt.claimStatus, 'UNCLAIMED');
  });

  check('attempt-record-contains-no-downstream-lifecycle-evidence', () => {
    for (const forbidden of ['adapterRegistration', 'workerIdentity', 'claimIdentity',
      'schedulerAssignment', 'executionStart', 'effectAcknowledgement', 'result',
      'completed', 'success']) assert.equal(forbidden in created.attempt, false);
  });

  check('creation-exposes-no-claim-schedule-or-execute-method', () => {
    assert.equal(Object.hasOwn(primary.creator, 'claim'), false);
    assert.equal(Object.hasOwn(primary.creator, 'schedule'), false);
    assert.equal(Object.hasOwn(primary.creator, 'execute'), false);
  });

  check('creation-invokes-no-downstream-operations', () => {
    assert.deepEqual({ scheduler: primary.calls.scheduler, adapter: primary.calls.adapter,
      claim: primary.calls.claim, start: primary.calls.start, executor: primary.calls.executor,
      product: primary.calls.product, effect: primary.calls.effect },
    { scheduler: 0, adapter: 0, claim: 0, start: 0, executor: 0, product: 0, effect: 0 });
  });

  check('outcome-grammar-is-exact-and-closed', () => {
    assert.deepEqual(Object.values(ATTEMPT_CREATION_OUTCOMES).sort(), [
      'ACTIVE_ATTEMPT_EXISTS', 'ALREADY_CREATED', 'ATTEMPT_CREATED',
      'ATTEMPT_CREATION_REJECTED', 'ATTEMPT_CREATION_UNCERTAIN',
      'EXECUTION_ALREADY_COMPLETED', 'EXECUTION_NOT_ELIGIBLE', 'EXECUTION_NOT_PREPARED',
      'INVALID_EXECUTION_PREPARATION', 'PREPARATION_STALE', 'RETRY_NOT_AUTHORIZED'
    ]);
  });

  check('required-ports-are-validated', () => {
    assert.throws(() => createGovernedExecutionAttemptCreation({}), TypeError);
  });

  check('multiple-historical-attempts-preserve-ordinal-and-chain', () => {
    const first = created.attempt;
    const second = provenRetry.attempt;
    const evidence = retryEvidence(second);
    const h = harness({ ledger: createLedger({ seed: [first, second] }),
      retries: new Map([[evidence.evidenceRef, evidence]]) });
    const third = h.creator.create({ ...firstRequest, executionAttemptId: 'attempt-3',
      retryEligibilityEvidenceRef: evidence.evidenceRef });
    assert.equal(third.outcome, 'ATTEMPT_CREATED');
    assert.equal(third.attempt.attemptOrdinal, 3);
    assert.equal(third.attempt.previousExecutionAttemptId, 'attempt-2');
  });

  check('deterministic-equivalent-runs-produce-equivalent-attempts', () => {
    const left = harness().creator.create(firstRequest);
    const right = harness().creator.create(firstRequest);
    assert.deepEqual(left, right);
    observations.push(left.attempt);
  });

  const canonical = canonicalStringify({ cases, observations,
    primaryAttempt: created.attempt, retryAttempt: provenRetry.attempt,
    outcomes: Object.values(ATTEMPT_CREATION_OUTCOMES) });
  return { cases, canonical, hash: sha256(canonical) };
}

const first = runSuite();
const second = runSuite();
assert.equal(first.canonical, second.canonical);
console.log(canonicalStringify({ suite: 'governed-execution-attempt-creation-v0',
  status: 'PASS', cases: first.cases.length, deterministic: true, hash: first.hash }));
