'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  createExecutionStartObservation,
  createMemoryLedger
} = require('./execution-start-observation');

const scopeDigest = `sha256:${'a'.repeat(64)}`;

function scope(overrides = {}) {
  return {
    scopeType: 'GATE',
    interactionId: 'interaction:1',
    fromInteractionRevision: 1,
    throughInteractionRevision: 3,
    gateId: 'gate:1',
    gateRevision: 1,
    authorityScopeDigest: scopeDigest,
    continuationTargetRef: 'continuation:1',
    ...overrides
  };
}

function request(overrides = {}) {
  return {
    rulesetVersion: RULESET_VERSION,
    executionStartId: 'execution-start:1',
    interactionId: 'interaction:1',
    interactionRevision: 2,
    gateId: 'gate:1',
    gateRevision: 1,
    authorityScopeDigest: scopeDigest,
    continuationTargetRef: 'continuation:1',
    expectedPrincipalRef: 'principal:1',
    expectedPrincipalRevision: '1',
    executionTargetRef: 'execution-target:1',
    runtimeStartEvidenceRef: 'runtime-start-evidence:1',
    ...overrides
  };
}

function fixtures(overrides = {}) {
  const start = {
    executionStartId: 'execution-start:1',
    type: 'GT63_BOUNDED_CONTINUATION_EXECUTION_START',
    startState: 'PERMITTED',
    executionStartPermitted: true,
    executionStarted: false,
    continuationExecuted: false,
    effectPerformed: false,
    effectVerified: false,
    authority: 'NONE',
    principalRef: 'principal:1',
    principalRevision: '1',
    executionTargetRef: 'execution-target:1',
    contextScope: scope(),
    lifecycleState: 'CURRENT',
    freshnessState: 'CURRENT',
    contradictionState: 'NONE',
    ...(overrides.start || {})
  };
  const runtime = {
    runtimeStartEvidenceRef: 'runtime-start-evidence:1',
    executionStarted: true,
    executionStartId: 'execution-start:1',
    executionTargetRef: 'execution-target:1',
    interactionId: 'interaction:1',
    gateId: 'gate:1',
    gateRevision: 1,
    authorityScopeDigest: scopeDigest,
    continuationTargetRef: 'continuation:1',
    principalRef: 'principal:1',
    principalRevision: '1',
    lifecycleState: 'CURRENT',
    freshnessState: 'CURRENT',
    contradictionState: 'NONE',
    authority: 'NONE',
    ...(overrides.runtime || {})
  };
  return { start, runtime };
}

function system(overrides = {}) {
  const f = fixtures(overrides.fixtures || {});
  const ledger = overrides.ledger || createMemoryLedger();
  return {
    ledger,
    component: createExecutionStartObservation({
      executionStartPort: overrides.executionStartPort || (() => f.start),
      runtimeStartEvidencePort: overrides.runtimeStartEvidencePort || (() => f.runtime),
      observationLedger: ledger
    })
  };
}

const cases = [];
function check(name, fn) { fn(); cases.push(name); console.log(`PASS - ${name}`); }
function noEffect(output) {
  assert.equal(output.authority, AUTHORITY);
  assert.equal(output.continuationExecuted, false);
  assert.equal(output.effectPerformed, false);
  assert.equal(output.effectVerified, false);
}

check('constructor-requires-ports-and-ledger', () => {
  assert.throws(() => createExecutionStartObservation({}), TypeError);
});
check('exact-positive-path-observed', () => {
  const o = system().component.assess(request());
  assert.equal(o.outcome, OUTCOMES.OBSERVED);
  assert.equal(o.executionStarted, true);
  assert.equal(o.observation.observationState, 'OBSERVED');
  noEffect(o);
});
check('caller-execution-started-invalid', () => {
  const o = system().component.assess({ ...request(), executionStarted: true });
  assert.equal(o.outcome, OUTCOMES.INVALID);
  noEffect(o);
});
check('start-unavailable-unknown', () => {
  const o = system({ executionStartPort: () => { throw new Error('missing'); } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('start-noncurrent-unknown', () => {
  const o = system({ fixtures: { start: { freshnessState: 'STALE' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('runtime-evidence-unavailable-unknown', () => {
  const o = system({ runtimeStartEvidencePort: () => { throw new Error('missing'); } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('runtime-evidence-stale-unknown', () => {
  const o = system({ fixtures: { runtime: { freshnessState: 'STALE' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('runtime-evidence-conflicting-unknown', () => {
  const o = system({ fixtures: { runtime: { contradictionState: 'CONFLICT' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('runtime-no-positive-start-not-observed', () => {
  const o = system({ fixtures: { runtime: { executionStarted: false } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('wrong-execution-start-id-not-observed', () => {
  const o = system({ fixtures: { runtime: { executionStartId: 'execution-start:2' } } }).component.assess(request());
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
  const o = system({ fixtures: { runtime: { executionTargetRef: 'execution-target:2' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('wrong-principal-not-observed', () => {
  const o = system({ fixtures: { runtime: { principalRef: 'principal:2' } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('start-scope-does-not-cover-current-revision', () => {
  const o = system({ fixtures: { start: { contextScope: scope({ throughInteractionRevision: 1 }) } } }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED);
});
check('exact-replay-is-deterministic', () => {
  const s = system();
  const a = s.component.assess(request());
  const b = s.component.assess(request());
  assert.equal(a.outcome, OUTCOMES.OBSERVED);
  assert.equal(b.outcome, OUTCOMES.OBSERVED);
  assert.equal(a.observation.executionStartObservationId, b.observation.executionStartObservationId);
  assert.deepEqual(a.observation, b.observation);
});
check('changed-runtime-evidence-ref-changes-identity', () => {
  const a = system().component.assess(request());
  const b = system({ fixtures: { runtime: { runtimeStartEvidenceRef: 'runtime-start-evidence:2' } } }).component.assess(request({ runtimeStartEvidenceRef: 'runtime-start-evidence:2' }));
  assert.equal(a.outcome, OUTCOMES.OBSERVED);
  assert.equal(b.outcome, OUTCOMES.OBSERVED);
  assert.notEqual(a.observation.executionStartObservationId, b.observation.executionStartObservationId);
});
check('changed-interaction-revision-changes-identity', () => {
  const a = system().component.assess(request());
  const b = system().component.assess(request({ interactionRevision: 3 }));
  assert.equal(a.outcome, OUTCOMES.OBSERVED);
  assert.equal(b.outcome, OUTCOMES.OBSERVED);
  assert.notEqual(a.observation.executionStartObservationId, b.observation.executionStartObservationId);
});
check('ledger-conflict-remains-unknown-and-no-effect', () => {
  const seed = system();
  const first = seed.component.assess(request());
  const bad = {
    get(id) { return { ...first.observation, executionStartObservationId: id, principalRef: 'principal:other' }; },
    commit() { throw new Error('should-not-commit'); }
  };
  const o = system({ ledger: bad }).component.assess(request());
  assert.equal(o.outcome, OUTCOMES.UNKNOWN);
  noEffect(o);
});
check('all-outcomes-never-claim-continuation-or-effect', () => {
  const outputs = [
    system().component.assess(request()),
    system({ fixtures: { runtime: { executionStarted: false } } }).component.assess(request()),
    system({ runtimeStartEvidencePort: () => { throw new Error('x'); } }).component.assess(request()),
    system().component.assess({ ...request(), effectPerformed: true })
  ];
  outputs.forEach(noEffect);
});

console.log(`${cases.length}/${cases.length} PASS`);
