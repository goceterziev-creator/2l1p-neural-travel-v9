'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  EFFECT_OUTCOME_CLASSES,
  FOLLOW_UP_ROUTES,
  FOLLOW_UP_OPERATION_OUTCOMES,
  createGovernedFollowUpDecision
} = require('./governed-follow-up-decision');

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}
const canonical = (value) => JSON.stringify(canonicalize(value));
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function resolution(effectOutcomeClass = 'EFFECT_CONFIRMED', overrides = {}) {
  return {
    evidenceRef: 'evidence.outcome-resolution.current',
    record: {
      type: 'EFFECT_OUTCOME_RESOLUTION',
      status: 'EFFECT_OUTCOME_RESOLVED',
      effectOutcomeResolutionId: 'resolution.effect-1',
      resolutionRevision: 3,
      effectInvocationId: 'effect-invocation-1',
      logicalEffectId: 'logical-effect-1',
      invocationEvidenceRef: 'evidence.effect-invocation-1',
      effectContractRef: 'effect-contract.payment',
      effectContractRevision: '7',
      effectIdempotencyClass: 'NON_IDEMPOTENT',
      outcomePolicyIdentity: 'policy.effect-outcome',
      outcomePolicyRevision: '4',
      evidenceSetRevision: 5,
      evidenceSetDigest: 'sha256:evidence-set-5',
      effectOutcomeClass,
      retryAllowed: false,
      resultAccepted: false,
      executionCompleted: false,
      ...overrides
    }
  };
}

function request(overrides = {}) {
  return {
    effectInvocationId: 'effect-invocation-1',
    effectOutcomeResolutionId: 'resolution.effect-1',
    expectedResolutionRevision: 3,
    expectedEvidenceSetRevision: 5,
    expectedEvidenceSetDigest: 'sha256:evidence-set-5',
    expectedResolutionEvidenceRef: 'evidence.outcome-resolution.current',
    ...overrides
  };
}

function makeLedger(seed = [], behavior = {}) {
  const records = seed.map(clone);
  const counts = { find: 0, commit: 0 };
  return {
    counts,
    ledger: {
      findDecisionById(id) {
        counts.find += 1;
        if (behavior.findThrows) throw new Error('ledger unavailable');
        return records.filter((item) => item.followUpDecisionId === id).map(clone);
      },
      commitDecision(record) {
        counts.commit += 1;
        if (behavior.commitThrows) throw new Error('commit uncertain');
        records.push(clone(record));
      }
    },
    records
  };
}

function makeSystem(current, ledgerState = makeLedger(), portBehavior = {}) {
  const counts = { resolutionReads: 0, downstreamExecutions: 0, providerOps: 0,
    externalEffects: 0, reconciliations: 0, humanAuthorityOps: 0 };
  const system = createGovernedFollowUpDecision({
    currentResolutionSnapshotPort(effectInvocationId) {
      counts.resolutionReads += 1;
      if (portBehavior.throws) throw new Error('resolution unavailable');
      assert.equal(effectInvocationId, 'effect-invocation-1');
      return clone(current);
    },
    decisionLedger: ledgerState.ledger
  });
  return { system, counts, ledgerState };
}

function assertNoAuthorityOrExecution(result) {
  assert.equal(result.retryAllowed, false);
  assert.equal(result.retryAuthorityCreated, false);
  assert.equal(result.attemptCreated, false);
  assert.equal(result.resultAccepted, false);
  assert.equal(result.executionCompleted, false);
  assert.equal(result.executionSucceeded, false);
  assert.equal(result.humanAuthorityCreated, false);
  assert.equal(result.selectedPathExecuted, false);
}

function runSuite() {
  const cases = [];
  const routeExpectations = {
    EFFECT_CONFIRMED: FOLLOW_UP_ROUTES.EFFECT_CAPABLE_RESULT_EVALUATION,
    NO_EFFECT_CONFIRMED: FOLLOW_UP_ROUTES.RETRY_ELIGIBILITY_EVALUATION,
    EFFECT_REJECTED_BEFORE_EFFECT: FOLLOW_UP_ROUTES.RETRY_ELIGIBILITY_EVALUATION,
    EFFECT_POSSIBLE: FOLLOW_UP_ROUTES.EVIDENCE_REQUIRED,
    EFFECT_OUTCOME_UNKNOWN: FOLLOW_UP_ROUTES.EVIDENCE_REQUIRED,
    EFFECT_EVIDENCE_CONFLICT: FOLLOW_UP_ROUTES.EVIDENCE_REQUIRED
  };

  const routeEvidence = [];
  for (const outcomeClass of EFFECT_OUTCOME_CLASSES) {
    const env = makeSystem(resolution(outcomeClass));
    const result = env.system.decide(request());
    assert.equal(result.outcome, FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_DECIDED);
    assert.equal(result.decision.effectOutcomeClass, outcomeClass);
    assert.equal(result.decision.selectedRoute, routeExpectations[outcomeClass]);
    assert.equal(result.decision.outcomeResolutionEvidenceRef, 'evidence.outcome-resolution.current');
    assert.equal(result.decision.invocationEvidenceRef, 'evidence.effect-invocation-1');
    assert.equal(result.decision.evidenceSetDigest, 'sha256:evidence-set-5');
    assertNoAuthorityOrExecution(result);
    assert.equal(env.ledgerState.counts.commit, 1);
    routeEvidence.push({ outcomeClass, selectedRoute: result.decision.selectedRoute,
      id: result.decision.followUpDecisionId });
  }
  cases.push('all-six-outcome-classes-route-through-closed-grammar');

  const confirmed = makeSystem(resolution('EFFECT_CONFIRMED')).system.decide(request()).decision;
  const noEffect = makeSystem(resolution('NO_EFFECT_CONFIRMED')).system.decide(request()).decision;
  assert.notEqual(confirmed.followUpDecisionId, noEffect.followUpDecisionId);
  cases.push('decision-identity-binds-outcome-and-route');

  for (const [name, badRequest] of [
    ['stale-resolution-revision', request({ expectedResolutionRevision: 2 })],
    ['superseded-evidence-set-revision', request({ expectedEvidenceSetRevision: 4 })],
    ['superseded-evidence-set-digest', request({ expectedEvidenceSetDigest: 'sha256:older' })],
    ['stale-resolution-evidence-ref', request({ expectedResolutionEvidenceRef: 'evidence.old' })]
  ]) {
    const result = makeSystem(resolution()).system.decide(badRequest);
    assert.equal(result.outcome, FOLLOW_UP_OPERATION_OUTCOMES.RESOLUTION_NOT_CURRENT, name);
    assertNoAuthorityOrExecution(result);
  }
  cases.push('stale-and-superseded-resolution-evidence-fails-closed');

  for (const [name, badResolution] of [
    ['wrong-resolution-id', resolution('EFFECT_CONFIRMED', { effectOutcomeResolutionId: 'resolution.other' })],
    ['wrong-invocation', resolution('EFFECT_CONFIRMED', { effectInvocationId: 'effect-invocation-other' })],
    ['missing-invocation-evidence', resolution('EFFECT_CONFIRMED', { invocationEvidenceRef: '' })],
    ['retry-already-allowed', resolution('EFFECT_CONFIRMED', { retryAllowed: true })],
    ['result-already-accepted', resolution('EFFECT_CONFIRMED', { resultAccepted: true })],
    ['completion-already-asserted', resolution('EFFECT_CONFIRMED', { executionCompleted: true })],
    ['unknown-outcome', resolution('NOT_A_CLASS')]
  ]) {
    const result = makeSystem(badResolution).system.decide(request());
    assert.equal(result.outcome, FOLLOW_UP_OPERATION_OUTCOMES.RESOLUTION_INVALID, name);
    assertNoAuthorityOrExecution(result);
  }
  cases.push('incoherent-lineage-or-open-grammar-fails-closed');

  const missing = makeSystem(null).system.decide(request());
  assert.equal(missing.outcome, FOLLOW_UP_OPERATION_OUTCOMES.RESOLUTION_NOT_FOUND);
  cases.push('authoritative-current-resolution-required');

  const unavailable = makeSystem(resolution(), makeLedger(), { throws: true }).system.decide(request());
  assert.equal(unavailable.outcome, FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_DECISION_UNCERTAIN);
  cases.push('authoritative-resolution-unavailability-is-uncertain');

  const firstEnv = makeSystem(resolution('NO_EFFECT_CONFIRMED'));
  const first = firstEnv.system.decide(request());
  const recoveredEnv = makeSystem(resolution('NO_EFFECT_CONFIRMED'), makeLedger([first.decision]));
  const recovered = recoveredEnv.system.decide(request());
  assert.equal(recovered.outcome, FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_ALREADY_RECORDED);
  assert.deepEqual(recovered.decision, first.decision);
  assert.equal(recoveredEnv.ledgerState.counts.commit, 0);
  cases.push('deterministic-same-id-recovery-is-idempotent');

  const collisionSeed = clone(first.decision);
  collisionSeed.evidenceSetDigest = 'sha256:tampered';
  const collision = makeSystem(resolution('NO_EFFECT_CONFIRMED'), makeLedger([collisionSeed]))
    .system.decide(request());
  assert.equal(collision.outcome, FOLLOW_UP_OPERATION_OUTCOMES.IDENTITY_COLLISION);
  assertNoAuthorityOrExecution(collision);
  cases.push('identity-collision-fails-closed');

  const corruptLedger = makeLedger([first.decision, first.decision]);
  const corrupt = makeSystem(resolution('NO_EFFECT_CONFIRMED'), corruptLedger).system.decide(request());
  assert.equal(corrupt.outcome, FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_DECISION_UNCERTAIN);
  cases.push('conflicting-ledger-recovery-fails-closed');

  const commitUncertain = makeSystem(resolution(), makeLedger([], { commitThrows: true }))
    .system.decide(request());
  assert.equal(commitUncertain.outcome, FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_DECISION_UNCERTAIN);
  cases.push('decision-commit-uncertainty-fails-closed');

  const noExecutionEnv = makeSystem(resolution('EFFECT_CONFIRMED'));
  const noExecution = noExecutionEnv.system.decide(request());
  assert.deepEqual(Object.keys(noExecutionEnv.system), ['decide']);
  assertNoAuthorityOrExecution(noExecution);
  assert.equal(noExecutionEnv.counts.downstreamExecutions, 0);
  assert.equal(noExecutionEnv.counts.providerOps, 0);
  assert.equal(noExecutionEnv.counts.externalEffects, 0);
  assert.equal(noExecutionEnv.counts.reconciliations, 0);
  assert.equal(noExecutionEnv.counts.humanAuthorityOps, 0);
  cases.push('decision-selects-path-but-executes-nothing');

  assert.equal(Object.hasOwn(noExecution.decision, 'retryEligibilityId'), false);
  assert.equal(Object.hasOwn(noExecution.decision, 'retryAuthorityId'), false);
  assert.equal(Object.hasOwn(noExecution.decision, 'executionAttemptId'), false);
  assert.equal(Object.hasOwn(noExecution.decision, 'resultAcceptanceId'), false);
  assert.equal(Object.hasOwn(noExecution.decision, 'completionId'), false);
  assert.equal(Object.hasOwn(noExecution.decision, 'successEvaluationId'), false);
  cases.push('no-downstream-semantic-boundary-is-materialized');

  const missingFields = makeSystem(resolution()).system.decide({});
  assert.equal(missingFields.outcome, FOLLOW_UP_OPERATION_OUTCOMES.RESOLUTION_INVALID);
  cases.push('exact-current-state-request-binding-required');

  const evidence = { cases, routeEvidence, exemplar: noExecution.decision };
  return { cases, evidence, canonical: canonical(evidence), hash: hash(canonical(evidence)) };
}

const first = runSuite();
const second = runSuite();
assert.equal(first.canonical, second.canonical);
assert.equal(first.hash, second.hash);

console.log(canonical({
  suite: 'governed-follow-up-decision-v0',
  status: 'PASS',
  cases: first.cases.length,
  deterministic: true,
  hash: first.hash,
  routes: first.evidence.routeEvidence
}));
