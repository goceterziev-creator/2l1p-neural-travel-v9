'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { canonicalStringify } = require('../human-intent-layer-v0/intent-layer');
const { createGovernedExecutionPreparation } = require('./execution-preparation');

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const inputValue = Object.freeze({ offerId: 'offer-1', status: 'approved' });
const canonicalInput = JSON.stringify(inputValue);
const inputDigest = sha256(canonicalInput);
const authorityScope = Object.freeze({ action: 'update-offer', offerId: 'offer-1' });

function acceptedExecution(overrides = {}) {
  return {
    type: 'EXECUTION_ACCEPTANCE',
    status: 'EXECUTION_ACCEPTED',
    executionAcceptanceId: 'acceptance-1',
    acceptanceRevision: 1,
    dispatchId: 'dispatch-1',
    dispatchOutcomeEvidenceRef: 'dispatch-outcome-1',
    dispatchReceiptRef: 'receipt-1',
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
    actionInputBinding: {
      inputRef: 'input:offer-1',
      inputDigest,
      derivationIdentity: 'offer-update-input',
      derivationRevision: '1'
    },
    effectIdempotencyCapability: 'effect-contract-1',
    resultEvidenceGrammarRef: 'result-grammar-1',
    singleLogicalAcceptance: true,
    ...clone(overrides)
  };
}

function actionRegistration(overrides = {}) {
  return {
    actionIdentity: 'offer.update',
    actionRevision: '1',
    registrationIdentity: 'action-registration-1',
    registrationRevision: '3',
    executionOwnerIdentity: 'offer-execution-owner',
    continuationTargetRef: 'offer.update:offer-1',
    acceptedAuthorityScopeContract: clone(authorityScope),
    effectIdempotencyCapability: 'effect-contract-1',
    resultEvidenceGrammarRef: 'result-grammar-1',
    ...clone(overrides)
  };
}

function inputContract(overrides = {}) {
  return {
    derivationIdentity: 'offer-update-input',
    derivationRevision: '1',
    canonicalizationIdentity: 'canonical-json',
    canonicalizationRevision: '1',
    digestAlgorithmIdentity: 'sha256',
    digestAlgorithmRevision: '1',
    resolve: () => ({ status: 'RESOLVED', value: clone(inputValue),
      evidenceRef: 'input-evidence-1' }),
    canonicalize: (value) => JSON.stringify(value),
    verifyDigest: ({ canonicalBytes, expectedDigest }) => ({
      matches: sha256(canonicalBytes) === expectedDigest,
      verifiedDigest: sha256(canonicalBytes)
    }),
    ...overrides
  };
}

function effectContract(overrides = {}) {
  return { ref: 'effect-contract-1', revision: '1',
    idempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY', ...clone(overrides) };
}

function resultGrammar(overrides = {}) {
  return { ref: 'result-grammar-1', revision: '1', ...clone(overrides) };
}

function createLedger({ seed = [], commitMode = 'NORMAL', staleGuard = false } = {}) {
  const records = seed.map(clone);
  let commits = 0;
  return {
    records,
    get commits() { return commits; },
    findByAcceptance(id) {
      return records.filter((record) => record.executionAcceptanceId === id).map(clone);
    },
    findByExecutionId(id) {
      return records.filter((record) => record.executionId === id).map(clone);
    },
    commitPreparation(record, guards) {
      commits += 1;
      if (staleGuard || !guards || guards.acceptanceGuard.acceptanceRevision !== 1
        || guards.actionRegistrationGuard.registrationRevision !== '3'
        || guards.actionRegistrationGuard.effectIdempotencyCapability !== 'effect-contract-1'
        || guards.actionRegistrationGuard.resultEvidenceGrammarRef !== 'result-grammar-1'
        || guards.inputContractGuard.derivationRevision !== '1'
        || guards.inputContractGuard.canonicalizationRevision !== '1'
        || guards.inputContractGuard.digestAlgorithmRevision !== '1'
        || guards.effectContractGuard.revision !== '1'
        || guards.resultGrammarGuard.revision !== '1') {
        const error = new Error('guarded contract changed');
        error.code = 'ACTION_REGISTRATION_STALE';
        throw error;
      }
      if (commitMode === 'THROW_BEFORE') throw new Error('persistence unavailable');
      if (records.some((item) => item.executionAcceptanceId === record.executionAcceptanceId
        || item.executionId === record.executionId)) throw new Error('unique conflict');
      records.push(clone(record));
      if (commitMode === 'STORE_THEN_THROW') throw new Error('caller missed commit');
      return clone(record);
    }
  };
}

function harness(overrides = {}) {
  const accepted = Object.hasOwn(overrides, 'accepted') ? overrides.accepted : acceptedExecution();
  const registrations = Object.hasOwn(overrides, 'registrations')
    ? overrides.registrations : [actionRegistration()];
  const inputContracts = Object.hasOwn(overrides, 'inputContracts')
    ? overrides.inputContracts : [inputContract()];
  const effectContracts = Object.hasOwn(overrides, 'effectContracts')
    ? overrides.effectContracts : [effectContract()];
  const grammars = Object.hasOwn(overrides, 'grammars')
    ? overrides.grammars : [resultGrammar()];
  const ledger = overrides.ledger || createLedger();
  const calls = { acceptance: 0, action: 0, inputContract: 0, inputResolve: 0,
    effectContract: 0, grammar: 0, scheduler: 0, attempt: 0, executor: 0, effect: 0 };
  const wrappedInputs = inputContracts.map((contract) => {
    const wrapped = { ...contract };
    if (typeof contract.resolve === 'function') wrapped.resolve = (...args) => {
      calls.inputResolve += 1;
      return contract.resolve(...args);
    };
    return wrapped;
  });
  const preparation = createGovernedExecutionPreparation({
    acceptanceSnapshotPort: (id) => {
      calls.acceptance += 1;
      if (overrides.acceptanceError) throw new Error('acceptance unavailable');
      return accepted && accepted.executionAcceptanceId === id ? clone(accepted) : null;
    },
    actionRegistryPort: ({ actionIdentity, actionRevision }) => {
      calls.action += 1;
      return registrations.filter((item) => item.actionIdentity === actionIdentity
        && item.actionRevision === actionRevision).map(clone);
    },
    inputResolutionContractPort: ({ derivationIdentity, derivationRevision }) => {
      calls.inputContract += 1;
      return wrappedInputs.filter((item) => item.derivationIdentity === derivationIdentity
        && item.derivationRevision === derivationRevision);
    },
    effectContractRegistryPort: (ref) => {
      calls.effectContract += 1;
      return effectContracts.filter((item) => item.ref === ref).map(clone);
    },
    resultGrammarRegistryPort: (ref) => {
      calls.grammar += 1;
      return grammars.filter((item) => item.ref === ref).map(clone);
    },
    executionLedger: ledger
  });
  return { preparation, ledger, calls };
}

const request = Object.freeze({ executionAcceptanceId: 'acceptance-1', executionId: 'execution-1' });

function runSuite() {
  const cases = [];
  const check = (name, fn) => { fn(); cases.push(name); };

  const primary = harness();
  const prepared = primary.preparation.prepare(request);
  check('authoritative-acceptance-prepares-exact-logical-execution', () => {
    assert.equal(prepared.outcome, 'EXECUTION_PREPARED');
    assert.equal(prepared.preparation.executionId, 'execution-1');
    assert.equal(prepared.preparation.executionAcceptanceId, 'acceptance-1');
    assert.equal(prepared.preparation.attemptEligibility,
      'ELIGIBLE_FOR_GOVERNED_ATTEMPT_CREATION');
  });

  check('fabricated-or-missing-acceptance-cannot-prepare', () => {
    const result = harness({ accepted: null }).preparation.prepare({ ...request,
      status: 'EXECUTION_ACCEPTED', authorityScope: { action: 'fabricated' } });
    assert.equal(result.outcome, 'INVALID_EXECUTION_ACCEPTANCE');
  });

  check('acceptance-unavailability-is-uncertain', () => {
    assert.equal(harness({ acceptanceError: true }).preparation.prepare(request).outcome,
      'PREPARATION_UNCERTAIN');
  });

  check('execution-identity-is-distinct-from-acceptance-and-dispatch', () => {
    assert.equal(harness().preparation.prepare({ executionAcceptanceId: 'acceptance-1',
      executionId: 'acceptance-1' }).outcome, 'INVALID_EXECUTION_ACCEPTANCE');
    assert.equal(harness().preparation.prepare({ executionAcceptanceId: 'acceptance-1',
      executionId: 'dispatch-1' }).outcome, 'INVALID_EXECUTION_ACCEPTANCE');
  });

  check('exact-duplicate-returns-original-evidence', () => {
    const duplicate = primary.preparation.prepare(request);
    assert.equal(duplicate.outcome, 'ALREADY_PREPARED');
    assert.deepEqual(duplicate.preparation, prepared.preparation);
    assert.equal(primary.ledger.commits, 1);
  });

  check('same-acceptance-different-execution-fails-closed', () => {
    assert.equal(primary.preparation.prepare({ ...request, executionId: 'execution-2' }).outcome,
      'INVALID_EXECUTION_ACCEPTANCE');
  });

  check('same-execution-different-acceptance-fails-closed', () => {
    const ledger = createLedger({ seed: [prepared.preparation] });
    const other = harness({ ledger, accepted: acceptedExecution({ executionAcceptanceId: 'acceptance-2' }) });
    assert.equal(other.preparation.prepare({ executionAcceptanceId: 'acceptance-2',
      executionId: 'execution-1' }).outcome, 'INVALID_EXECUTION_ACCEPTANCE');
  });

  check('corrupt-ledger-evidence-fails-closed', () => {
    const ledger = createLedger({ seed: [prepared.preparation,
      { ...clone(prepared.preparation), preparationRevision: 2 }] });
    assert.equal(harness({ ledger }).preparation.prepare(request).outcome,
      'INVALID_EXECUTION_ACCEPTANCE');
  });

  check('exact-action-target-scope-owner-and-revisions-required', () => {
    for (const registration of [
      actionRegistration({ actionRevision: '2' }),
      actionRegistration({ registrationRevision: '4' }),
      actionRegistration({ executionOwnerIdentity: 'other-owner' }),
      actionRegistration({ continuationTargetRef: 'other-target' }),
      actionRegistration({ acceptedAuthorityScopeContract: { action: 'wider' } })
    ]) assert.equal(harness({ registrations: [registration] }).preparation.prepare(request).outcome,
      'ACTION_REGISTRATION_STALE');
  });

  check('accepted-effect-and-result-references-are-exact', () => {
    for (const registration of [
      actionRegistration({ effectIdempotencyCapability: 'other-effect' }),
      actionRegistration({ resultEvidenceGrammarRef: 'other-result' })
    ]) assert.equal(harness({ registrations: [registration] }).preparation.prepare(request).outcome,
      'ACTION_REGISTRATION_STALE');
  });

  check('input-resolution-is-read-only-and-binding-is-preserved', () => {
    assert.equal(prepared.preparation.inputRef, 'input:offer-1');
    assert.equal(prepared.preparation.expectedInputDigest, inputDigest);
    assert.equal(prepared.preparation.verifiedInputDigest, inputDigest);
    assert.equal(primary.calls.inputResolve, 1);
  });

  check('input-not-found-fails-closed', () => {
    const contract = inputContract({ resolve: () => ({ status: 'NOT_FOUND' }) });
    assert.equal(harness({ inputContracts: [contract] }).preparation.prepare(request).outcome,
      'INPUT_NOT_FOUND');
  });

  check('input-unavailable-allows-same-identity-read-only-retry', () => {
    let available = false;
    const contract = inputContract({ resolve: () => available
      ? ({ status: 'RESOLVED', value: clone(inputValue), evidenceRef: 'input-evidence-1' })
      : ({ status: 'UNAVAILABLE' }) });
    const h = harness({ inputContracts: [contract] });
    assert.equal(h.preparation.prepare(request).outcome, 'INPUT_UNAVAILABLE');
    assert.equal(h.ledger.records.length, 0);
    available = true;
    assert.equal(h.preparation.prepare(request).outcome, 'EXECUTION_PREPARED');
  });

  check('ambiguous-input-fails-closed', () => {
    const contract = inputContract({ resolve: () => ({ status: 'AMBIGUOUS' }) });
    const result = harness({ inputContracts: [contract] }).preparation.prepare(request);
    assert.equal(result.outcome, 'EXECUTION_PREPARATION_REJECTED');
    assert.equal(result.reason, 'INPUT_RESOLUTION_AMBIGUOUS');
  });

  check('digest-mismatch-fails-closed', () => {
    const contract = inputContract({ verifyDigest: () => ({ matches: false,
      verifiedDigest: 'mismatch' }) });
    assert.equal(harness({ inputContracts: [contract] }).preparation.prepare(request).outcome,
      'INPUT_DIGEST_MISMATCH');
  });

  check('derivation-contract-mismatch-fails-closed', () => {
    const contract = inputContract({ derivationIdentity: 'other-derivation' });
    const result = harness({ inputContracts: [contract] }).preparation.prepare(request);
    assert.equal(result.reason, 'INPUT_RESOLUTION_CONTRACT_NOT_FOUND');
  });

  check('missing-input-contract-fails-closed', () => {
    assert.equal(harness({ inputContracts: [] }).preparation.prepare(request).reason,
      'INPUT_RESOLUTION_CONTRACT_NOT_FOUND');
  });

  check('ambiguous-input-contract-fails-closed', () => {
    assert.equal(harness({ inputContracts: [inputContract(), inputContract()] })
      .preparation.prepare(request).reason, 'INPUT_RESOLUTION_CONTRACT_AMBIGUOUS');
  });

  check('missing-effect-contract-blocks-preparation', () => {
    assert.equal(harness({ effectContracts: [] }).preparation.prepare(request).reason,
      'EFFECT_CONTRACT_NOT_FOUND');
  });

  check('invalid-effect-contract-blocks-preparation', () => {
    assert.equal(harness({ effectContracts: [effectContract({ idempotencyClass: 'MAGIC' })] })
      .preparation.prepare(request).reason, 'EFFECT_CONTRACT_INVALID');
  });

  check('unverified-effect-contract-blocks-eligibility', () => {
    assert.equal(harness({ effectContracts: [effectContract({
      idempotencyClass: 'UNKNOWN_OR_UNVERIFIED' })] }).preparation.prepare(request).reason,
    'EFFECT_CONTRACT_UNVERIFIED');
  });

  check('recognized-effect-classes-freeze-without-effect-identity', () => {
    for (const idempotencyClass of ['NO_EXTERNAL_EFFECT', 'IDEMPOTENT_WITH_STABLE_KEY',
      'NON_IDEMPOTENT']) {
      const result = harness({ effectContracts: [effectContract({ idempotencyClass })] })
        .preparation.prepare(request);
      assert.equal(result.outcome, 'EXECUTION_PREPARED');
      assert.equal(result.preparation.effectIdempotencyClass, idempotencyClass);
      assert.equal('effectId' in result.preparation, false);
    }
  });

  check('missing-result-grammar-blocks-preparation', () => {
    assert.equal(harness({ grammars: [] }).preparation.prepare(request).reason,
      'RESULT_GRAMMAR_NOT_FOUND');
  });

  check('invalid-result-grammar-blocks-preparation', () => {
    assert.equal(harness({ grammars: [resultGrammar({ revision: '' })] })
      .preparation.prepare(request).reason, 'RESULT_GRAMMAR_INVALID');
  });

  check('preparation-freezes-all-contract-revisions-and-lineage', () => {
    const record = prepared.preparation;
    assert.equal(record.actionRegistrationRevision, '3');
    assert.equal(record.derivationRevision, '1');
    assert.equal(record.canonicalizationRevision, '1');
    assert.equal(record.digestAlgorithmRevision, '1');
    assert.equal(record.effectContractRevision, '1');
    assert.equal(record.resultEvidenceGrammarRevision, '1');
    assert.deepEqual(record.authorityScope, authorityScope);
  });

  check('atomic-guard-drift-fails-stale', () => {
    assert.equal(harness({ ledger: createLedger({ staleGuard: true }) })
      .preparation.prepare(request).outcome, 'ACTION_REGISTRATION_STALE');
  });

  check('commit-before-persistence-failure-is-uncertain', () => {
    const ledger = createLedger({ commitMode: 'THROW_BEFORE' });
    assert.equal(harness({ ledger }).preparation.prepare(request).outcome,
      'PREPARATION_UNCERTAIN');
    assert.equal(ledger.records.length, 0);
  });

  check('post-commit-recovery-returns-original-execution', () => {
    const ledger = createLedger({ commitMode: 'STORE_THEN_THROW' });
    const result = harness({ ledger }).preparation.prepare(request);
    assert.equal(result.outcome, 'ALREADY_PREPARED');
    assert.equal(result.preparation.executionId, 'execution-1');
    assert.equal(ledger.records.length, 1);
  });

  check('preparation-creates-no-later-lifecycle-state', () => {
    for (const forbidden of ['executionAttemptId', 'attemptId', 'schedule', 'scheduled',
      'workerClaim', 'started', 'effectId', 'effectAcknowledgement', 'result',
      'completed', 'success']) assert.equal(forbidden in prepared.preparation, false);
  });

  check('preparation-invokes-no-scheduler-attempt-executor-or-effect', () => {
    assert.deepEqual({ scheduler: primary.calls.scheduler, attempt: primary.calls.attempt,
      executor: primary.calls.executor, effect: primary.calls.effect },
    { scheduler: 0, attempt: 0, executor: 0, effect: 0 });
    assert.equal(Object.hasOwn(primary.preparation, 'schedule'), false);
    assert.equal(Object.hasOwn(primary.preparation, 'execute'), false);
  });

  check('possible-effect-retry-remains-downstream-and-unauthorized', () => {
    assert.equal('retryAuthorized' in prepared.preparation, false);
    assert.equal('effectInvocationIntent' in prepared.preparation, false);
    assert.equal(prepared.preparation.singleLogicalExecution, true);
  });

  const canonical = canonicalStringify({ cases, prepared: prepared.preparation,
    outcomes: ['INVALID_EXECUTION_ACCEPTANCE', 'INPUT_UNAVAILABLE',
      'INPUT_DIGEST_MISMATCH', 'ACTION_REGISTRATION_STALE', 'PREPARATION_UNCERTAIN'] });
  return { cases, canonical, hash: sha256(canonical) };
}

const first = runSuite();
const second = runSuite();
assert.equal(first.canonical, second.canonical);
console.log(canonicalStringify({ suite: 'governed-execution-preparation-v0', status: 'PASS',
  cases: first.cases.length, deterministic: true, hash: first.hash }));
