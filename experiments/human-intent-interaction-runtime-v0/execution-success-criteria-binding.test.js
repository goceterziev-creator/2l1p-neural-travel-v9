'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { canonicalStringify } = require('../human-intent-layer-v0/intent-layer');
const { SUCCESS_CRITERIA_BINDING_OUTCOMES, SUCCESS_EVALUATION_CLASSES,
  createGovernedExecutionSuccessCriteriaBinding } = require('./execution-success-criteria-binding');

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function acceptance(overrides = {}) {
  return { type: 'EXECUTION_ACCEPTANCE', status: 'EXECUTION_ACCEPTED',
    executionAcceptanceId: 'acceptance-1', acceptanceRevision: 1,
    interactionId: 'interaction-1', governanceEvaluationRef: 'evaluation-1',
    actionIdentity: 'offer.update', actionRevision: '1',
    resultEvidenceGrammarRef: 'result-grammar-1', singleLogicalAcceptance: true,
    ...clone(overrides) };
}

function governance(overrides = {}) {
  return { type: 'GOVERNANCE_INTENT_SNAPSHOT', status: 'GOVERNANCE_INTENT_CURRENT',
    interactionId: 'interaction-1', governanceEvaluationRef: 'evaluation-1',
    evaluatedRevision: 7, intentContractRef: 'intent-contract-1',
    intentContractDigest: 'sha256:intent-1', intentSchemaVersion: 'v0',
    OUTCOME: [{ id: 'outcome-1', statement: 'offer state updated' }],
    ACCEPTANCE: [{ id: 'acceptance-rule-1', statement: 'verified state equals approved' }],
    ...clone(overrides) };
}

function successContract(overrides = {}) {
  return { ref: 'success-contract-1', revision: '1', actionIdentity: 'offer.update',
    actionRevision: '1', resultEvidenceGrammarRef: 'result-grammar-1',
    intentSchemaVersion: 'v0', evaluationClasses: clone(SUCCESS_EVALUATION_CLASSES),
    ...clone(overrides) };
}

function createLedger({ seed = [], mode = 'NORMAL' } = {}) {
  const records = seed.map(clone);
  let commits = 0;
  return { records, get commits() { return commits; },
    findByAcceptance: (id) => records.filter((r) => r.executionAcceptanceId === id).map(clone),
    findById: (id) => records.filter((r) => r.successCriteriaBindingId === id).map(clone),
    commitBinding(record, guards) {
      commits += 1;
      if (!guards || guards.acceptanceGuard.acceptanceRevision !== 1
        || guards.governanceGuard.intentContractDigest !== 'sha256:intent-1'
        || guards.successContractGuard.revision !== '1'
        || guards.preparationAbsentGuard.preparationAbsent !== true) throw new Error('guard invalid');
      if (mode === 'PREPARATION_RACE') { const error = new Error('race'); error.code = 'PREPARATION_ALREADY_EXISTS'; throw error; }
      if (mode === 'GOVERNANCE_DRIFT') { const error = new Error('drift'); error.code = 'GOVERNANCE_INTENT_STALE'; throw error; }
      if (mode === 'THROW_BEFORE') throw new Error('unavailable');
      if (records.some((r) => r.executionAcceptanceId === record.executionAcceptanceId
        || r.successCriteriaBindingId === record.successCriteriaBindingId)) throw new Error('unique');
      records.push(clone(record));
      if (mode === 'STORE_THEN_THROW') throw new Error('lost response');
      if (mode === 'CORRUPT_RETURN') return { ...clone(record), bindingDigest: 'wrong' };
      return clone(record);
    } };
}

function harness(overrides = {}) {
  const accepted = Object.hasOwn(overrides, 'accepted') ? overrides.accepted : acceptance();
  const governed = Object.hasOwn(overrides, 'governed') ? overrides.governed : governance();
  const contracts = Object.hasOwn(overrides, 'contracts') ? overrides.contracts : [successContract()];
  const preparations = overrides.preparations || [];
  const ledger = overrides.ledger || createLedger();
  const calls = { acceptance: 0, governance: 0, contract: 0, preparation: 0,
    provider: 0, executor: 0, effect: 0, completion: 0 };
  const binding = createGovernedExecutionSuccessCriteriaBinding({
    acceptanceSnapshotPort(id) { calls.acceptance += 1; if (overrides.acceptanceError) throw new Error(); return accepted && accepted.executionAcceptanceId === id ? clone(accepted) : null; },
    governanceIntentSnapshotPort() { calls.governance += 1; if (overrides.governanceError) throw new Error(); return clone(governed); },
    successEvaluationContractRegistryPort(query) { calls.contract += 1; if (overrides.contractError) throw new Error(); return contracts.filter((c) => c.actionIdentity === query.actionIdentity).map(clone); },
    preparationSnapshotPort(id) { calls.preparation += 1; if (overrides.preparationError) throw new Error(); return preparations.filter((p) => p.executionAcceptanceId === id).map(clone); },
    bindingLedger: ledger
  });
  return { binding, ledger, calls };
}

const request = Object.freeze({ executionAcceptanceId: 'acceptance-1',
  successCriteriaBindingId: 'criteria-binding-1', callerCriteria: ['fabricated'] });

function runSuite() {
  const cases = [];
  const check = (name, fn) => { fn(); cases.push(name); };
  const primary = harness();
  const bound = primary.binding.bind(request);
  check('authoritative-governance-criteria-bind', () => {
    assert.equal(bound.outcome, 'SUCCESS_CRITERIA_BOUND');
    assert.deepEqual(bound.binding.outcomeCriteria, governance().OUTCOME);
    assert.deepEqual(bound.binding.acceptanceCriteria, governance().ACCEPTANCE);
  });
  check('caller-criteria-are-never-authority', () => assert.equal(
    bound.binding.outcomeCriteria.some((item) => item === 'fabricated'), false));
  check('binding-does-not-evaluate-success', () => {
    assert.equal(bound.binding.successEvaluated, false);
    assert.equal('success' in bound.binding, false);
  });
  check('exact-duplicate-recovers-original', () => {
    assert.equal(primary.binding.bind(request).outcome, 'SUCCESS_CRITERIA_ALREADY_BOUND');
    assert.equal(primary.ledger.commits, 1);
  });
  check('missing-acceptance-fails-closed', () => assert.equal(harness({ accepted: null })
    .binding.bind(request).outcome, 'EXECUTION_ACCEPTANCE_NOT_FOUND'));
  check('invalid-acceptance-fails-closed', () => assert.equal(harness({ accepted: acceptance({ status: 'OTHER' }) })
    .binding.bind(request).outcome, 'EXECUTION_ACCEPTANCE_NOT_FOUND'));
  check('acceptance-unavailable-is-uncertain', () => assert.equal(harness({ acceptanceError: true })
    .binding.bind(request).outcome, 'SUCCESS_CRITERIA_BINDING_UNCERTAIN'));
  check('missing-governance-fails-closed', () => assert.equal(harness({ governed: null })
    .binding.bind(request).outcome, 'GOVERNANCE_INTENT_NOT_FOUND'));
  check('governance-unavailable-is-uncertain', () => assert.equal(harness({ governanceError: true })
    .binding.bind(request).outcome, 'SUCCESS_CRITERIA_BINDING_UNCERTAIN'));
  check('governance-lineage-must-be-exact', () => {
    for (const governed of [governance({ interactionId: 'other' }),
      governance({ governanceEvaluationRef: 'other' }), governance({ status: 'STALE' })]) {
      assert.equal(harness({ governed }).binding.bind(request).outcome, 'GOVERNANCE_INTENT_STALE');
    }
  });
  check('empty-outcome-is-not-bindable', () => assert.equal(harness({ governed: governance({ OUTCOME: [] }) })
    .binding.bind(request).outcome, 'GOVERNANCE_INTENT_STALE'));
  check('empty-acceptance-is-not-bindable', () => assert.equal(harness({ governed: governance({ ACCEPTANCE: [] }) })
    .binding.bind(request).outcome, 'GOVERNANCE_INTENT_STALE'));
  check('missing-success-contract-fails-closed', () => assert.equal(harness({ contracts: [] })
    .binding.bind(request).outcome, 'SUCCESS_CONTRACT_NOT_FOUND'));
  check('ambiguous-success-contract-fails-closed', () => assert.equal(harness({ contracts: [successContract(), successContract()] })
    .binding.bind(request).outcome, 'SUCCESS_CRITERIA_BINDING_REJECTED'));
  check('contract-registry-unavailable-is-uncertain', () => assert.equal(harness({ contractError: true })
    .binding.bind(request).outcome, 'SUCCESS_CRITERIA_BINDING_UNCERTAIN'));
  check('success-contract-key-is-exact', () => {
    for (const contract of [successContract({ actionRevision: '2' }),
      successContract({ resultEvidenceGrammarRef: 'other' }),
      successContract({ intentSchemaVersion: 'v1' })]) {
      assert.equal(harness({ contracts: [contract] }).binding.bind(request).outcome,
        'SUCCESS_CRITERIA_NOT_BINDABLE');
    }
  });
  check('success-evaluation-classes-are-frozen', () => assert.equal(harness({ contracts: [successContract({ evaluationClasses: ['SUCCESS_CONFIRMED'] })] })
    .binding.bind(request).outcome, 'SUCCESS_CRITERIA_NOT_BINDABLE'));
  check('preparation-before-binding-is-terminal', () => assert.equal(harness({ preparations: [{ executionAcceptanceId: 'acceptance-1' }] })
    .binding.bind(request).outcome, 'PREPARATION_ALREADY_EXISTS'));
  check('preparation-state-conflict-fails-closed', () => assert.equal(harness({ preparations: [{ executionAcceptanceId: 'acceptance-1' }, { executionAcceptanceId: 'acceptance-1' }] })
    .binding.bind(request).outcome, 'SUCCESS_CRITERIA_BINDING_REJECTED'));
  check('preparation-state-unavailable-is-uncertain', () => assert.equal(harness({ preparationError: true })
    .binding.bind(request).outcome, 'SUCCESS_CRITERIA_BINDING_UNCERTAIN'));
  check('preparation-race-loses-atomically', () => assert.equal(harness({ ledger: createLedger({ mode: 'PREPARATION_RACE' }) })
    .binding.bind(request).outcome, 'PREPARATION_ALREADY_EXISTS'));
  check('governance-drift-loses-atomically', () => assert.equal(harness({ ledger: createLedger({ mode: 'GOVERNANCE_DRIFT' }) })
    .binding.bind(request).outcome, 'GOVERNANCE_INTENT_STALE'));
  check('persistence-uncertainty-fails-closed', () => assert.equal(harness({ ledger: createLedger({ mode: 'THROW_BEFORE' }) })
    .binding.bind(request).outcome, 'SUCCESS_CRITERIA_BINDING_UNCERTAIN'));
  check('post-commit-response-loss-recovers', () => assert.equal(harness({ ledger: createLedger({ mode: 'STORE_THEN_THROW' }) })
    .binding.bind(request).outcome, 'SUCCESS_CRITERIA_ALREADY_BOUND'));
  check('corrupt-commit-return-is-rejected', () => assert.equal(harness({ ledger: createLedger({ mode: 'CORRUPT_RETURN' }) })
    .binding.bind(request).outcome, 'SUCCESS_CRITERIA_BINDING_REJECTED'));
  check('identity-collision-is-rejected', () => assert.equal(harness({ ledger: createLedger({ seed: [bound.binding] }) })
    .binding.bind({ ...request, executionAcceptanceId: 'acceptance-2' }).outcome,
  'SUCCESS_CRITERIA_BINDING_REJECTED'));
  check('invalid-identities-are-rejected', () => {
    assert.equal(harness().binding.bind({}).outcome, 'SUCCESS_CRITERIA_BINDING_REJECTED');
    assert.equal(harness().binding.bind({ executionAcceptanceId: 'same', successCriteriaBindingId: 'same' }).outcome,
      'SUCCESS_CRITERIA_BINDING_REJECTED');
  });
  check('binding-creates-no-operational-or-human-authority', () => {
    for (const forbidden of ['humanAuthority', 'retryAuthorized', 'executionAttemptId',
      'effectInvocation', 'executionCompleted', 'success']) assert.equal(forbidden in bound.binding, false);
    assert.deepEqual({ provider: primary.calls.provider, executor: primary.calls.executor,
      effect: primary.calls.effect, completion: primary.calls.completion },
    { provider: 0, executor: 0, effect: 0, completion: 0 });
  });
  check('outcome-grammar-is-exact', () => assert.deepEqual(
    Object.values(SUCCESS_CRITERIA_BINDING_OUTCOMES).sort(), [
      'EXECUTION_ACCEPTANCE_NOT_FOUND', 'GOVERNANCE_INTENT_NOT_FOUND',
      'GOVERNANCE_INTENT_STALE', 'PREPARATION_ALREADY_EXISTS',
      'SUCCESS_CONTRACT_NOT_FOUND', 'SUCCESS_CRITERIA_ALREADY_BOUND',
      'SUCCESS_CRITERIA_BINDING_REJECTED', 'SUCCESS_CRITERIA_BINDING_UNCERTAIN',
      'SUCCESS_CRITERIA_BOUND', 'SUCCESS_CRITERIA_NOT_BINDABLE'].sort()));

  const canonical = canonicalStringify({ cases, binding: bound.binding,
    outcomes: Object.values(SUCCESS_CRITERIA_BINDING_OUTCOMES),
    evaluationClasses: SUCCESS_EVALUATION_CLASSES });
  return { cases, canonical, hash: sha256(canonical) };
}

const first = runSuite();
const second = runSuite();
assert.equal(first.canonical, second.canonical);
console.log(canonicalStringify({ suite: 'governed-execution-success-criteria-binding-v0',
  status: 'PASS', cases: first.cases.length, deterministic: true, hash: first.hash }));
