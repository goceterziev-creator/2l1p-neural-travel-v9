'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  createContinuationCompletionObservation,
  createMemoryLedger
} = require('./continuation-completion-observation');

const scopeDigest = `sha256:${'a'.repeat(64)}`;
function scope(overrides = {}) {
  return {
    scopeType: 'GATE', interactionId: 'interaction:1', fromInteractionRevision: 1,
    throughInteractionRevision: 3, gateId: 'gate:1', gateRevision: 1,
    authorityScopeDigest: scopeDigest, continuationTargetRef: 'continuation:1', ...overrides
  };
}
function request(overrides = {}) {
  return {
    rulesetVersion: RULESET_VERSION,
    executionStartObservationId: 'start-observation:1',
    interactionId: 'interaction:1', interactionRevision: 2,
    gateId: 'gate:1', gateRevision: 1, authorityScopeDigest: scopeDigest,
    continuationTargetRef: 'continuation:1', expectedPrincipalRef: 'principal:1',
    expectedPrincipalRevision: '1', executionTargetRef: 'execution:1',
    runtimeCompletionEvidenceRef: 'runtime-completion:1', ...overrides
  };
}
function fixtures(overrides = {}) {
  const startObservation = {
    executionStartObservationId: 'start-observation:1', type: 'GT63_EXECUTION_START_OBSERVATION',
    observationState: 'OBSERVED', executionStarted: true, continuationExecuted: false,
    effectPerformed: false, effectVerified: false, principalRef: 'principal:1', principalRevision: '1',
    executionTargetRef: 'execution:1', contextScope: scope(), lifecycleState: 'CURRENT',
    freshnessState: 'CURRENT', contradictionState: 'NONE', authority: 'NONE',
    ...(overrides.startObservation || {})
  };
  const runtime = {
    runtimeCompletionEvidenceRef: 'runtime-completion:1', executionStartObservationId: 'start-observation:1',
    continuationExecuted: true, executionTargetRef: 'execution:1', interactionId: 'interaction:1',
    gateId: 'gate:1', gateRevision: 1, authorityScopeDigest: scopeDigest,
    continuationTargetRef: 'continuation:1', principalRef: 'principal:1', principalRevision: '1',
    lifecycleState: 'CURRENT', freshnessState: 'CURRENT', contradictionState: 'NONE', authority: 'NONE',
    ...(overrides.runtime || {})
  };
  return { startObservation, runtime };
}
function system(overrides = {}) {
  const f = fixtures(overrides.fixtures || {});
  const ledger = overrides.ledger || createMemoryLedger();
  return {
    ledger,
    component: createContinuationCompletionObservation({
      executionStartObservationPort: overrides.executionStartObservationPort || (() => f.startObservation),
      runtimeCompletionEvidencePort: overrides.runtimeCompletionEvidencePort || (() => f.runtime),
      observationLedger: ledger
    })
  };
}
const cases = [];
function check(name, fn) { fn(); cases.push(name); console.log(`PASS - ${name}`); }
function noEffect(output) {
  assert.equal(output.authority, AUTHORITY);
  assert.equal(output.effectPerformed, false);
  assert.equal(output.effectVerified, false);
}
check('constructor-requires-ports-and-ledger', () => {
  assert.throws(() => createContinuationCompletionObservation({}), TypeError);
});
check('exact-positive-path-observed', () => {
  const o = system().component.assess(request());
  assert.equal(o.outcome, OUTCOMES.OBSERVED);
  assert.equal(o.continuationExecuted, true);
  assert.equal(o.observation.observationState, 'OBSERVED');
  noEffect(o);
});
check('caller-continuation-executed-invalid', () => {
  const o = system().component.assess({ ...request(), continuationExecuted: true });
  assert.equal(o.outcome, OUTCOMES.INVALID); noEffect(o);
});
check('caller-effect-performed-invalid', () => {
  const o = system().component.assess({ ...request(), effectPerformed: true });
  assert.equal(o.outcome, OUTCOMES.INVALID); noEffect(o);
});
check('start-observation-unavailable-unknown', () => {
  const o = system({ executionStartObservationPort: () => { throw new Error('missing'); } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('start-observation-noncurrent-unknown', () => {
  const o = system({ fixtures: { startObservation: { freshnessState: 'STALE' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('start-observation-not-observed-unknown', () => {
  const o = system({ fixtures: { startObservation: { observationState: 'NOT_OBSERVED', executionStarted: false } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('runtime-completion-unavailable-unknown', () => {
  const o = system({ runtimeCompletionEvidencePort: () => { throw new Error('missing'); } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('runtime-completion-stale-unknown', () => {
  const o = system({ fixtures: { runtime: { freshnessState: 'STALE' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('runtime-completion-conflicting-unknown', () => {
  const o = system({ fixtures: { runtime: { contradictionState: 'CONFLICT' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('runtime-no-positive-completion-not-observed', () => {
  const o = system({ fixtures: { runtime: { continuationExecuted: false } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('wrong-start-observation-id-not-observed', () => {
  const o = system({ fixtures: { runtime: { executionStartObservationId: 'start-observation:2' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('wrong-gate-not-observed', () => {
  const o = system({ fixtures: { runtime: { gateId: 'gate:2' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('wrong-gate-revision-not-observed', () => {
  const o = system({ fixtures: { runtime: { gateRevision: 2 } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('wrong-authority-scope-not-observed', () => {
  const o = system({ fixtures: { runtime: { authorityScopeDigest: `sha256:${'b'.repeat(64)}` } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('wrong-continuation-target-not-observed', () => {
  const o = system({ fixtures: { runtime: { continuationTargetRef: 'continuation:2' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('wrong-execution-target-not-observed', () => {
  const o = system({ fixtures: { runtime: { executionTargetRef: 'execution:2' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('wrong-principal-not-observed', () => {
  const o = system({ fixtures: { runtime: { principalRef: 'principal:2' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('start-observation-scope-does-not-cover-current-revision', () => {
  const o = system({ fixtures: { startObservation: { contextScope: scope({ throughInteractionRevision: 1 }) } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('exact-replay-is-deterministic', () => {
  const s = system(); const a = s.component.assess(request()); const b = s.component.assess(request());
  assert.equal(a.outcome, OUTCOMES.OBSERVED); assert.equal(b.outcome, OUTCOMES.OBSERVED);
  assert.equal(a.observation.continuationCompletionObservationId, b.observation.continuationCompletionObservationId);
  assert.deepEqual(a.observation, b.observation);
});
check('changed-runtime-evidence-ref-changes-identity', () => {
  const a = system().component.assess(request());
  const b = system({ fixtures: { runtime: { runtimeCompletionEvidenceRef: 'runtime-completion:2' } } }).component.assess(request({ runtimeCompletionEvidenceRef: 'runtime-completion:2' }));
  assert.equal(a.outcome, OUTCOMES.OBSERVED); assert.equal(b.outcome, OUTCOMES.OBSERVED);
  assert.notEqual(a.observation.continuationCompletionObservationId, b.observation.continuationCompletionObservationId);
});
check('changed-interaction-revision-changes-identity', () => {
  const a = system().component.assess(request());
  const b = system().component.assess(request({ interactionRevision: 3 }));
  assert.equal(a.outcome, OUTCOMES.OBSERVED); assert.equal(b.outcome, OUTCOMES.OBSERVED);
  assert.notEqual(a.observation.continuationCompletionObservationId, b.observation.continuationCompletionObservationId);
});
check('ledger-conflict-remains-unknown-and-no-effect', () => {
  const seed = system(); const first = seed.component.assess(request());
  const bad = { get: id => ({ ...first.observation, continuationCompletionObservationId: id, principalRef: 'principal:other' }), commit() { throw new Error('should-not-commit'); } };
  const o = system({ ledger: bad }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); noEffect(o);
});
check('all-outcomes-never-claim-effect', () => {
  const outputs = [
    system().component.assess(request()),
    system({ fixtures: { runtime: { continuationExecuted: false } } }).component.assess(request()),
    system({ runtimeCompletionEvidencePort: () => { throw new Error('x'); } }).component.assess(request()),
    system().component.assess({ ...request(), effectVerified: true })
  ];
  outputs.forEach(noEffect);
});
console.log(`${cases.length}/${cases.length} PASS`);
