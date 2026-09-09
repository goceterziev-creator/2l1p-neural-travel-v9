'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  createBoundedContinuationExecutionStart,
  createMemoryLedger
} = require('./bounded-continuation-execution-start');

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
    rulesetVersion: RULESET_VERSION, executionIntentId: 'execution-intent:1', interactionId: 'interaction:1',
    interactionRevision: 2, gateId: 'gate:1', gateRevision: 1, authorityScopeDigest: scopeDigest,
    continuationTargetRef: 'continuation:1', expectedPrincipalRef: 'principal:1',
    expectedPrincipalRevision: '1', executionTargetRef: 'executor:1', ...overrides
  };
}
function fixtures(overrides = {}) {
  const intent = {
    executionIntentId: 'execution-intent:1', type: 'GT63_CONTROLLED_CONTINUATION_EXECUTION_INTENT',
    executionState: 'PERMITTED', continuationExecutionPermitted: true, principalRef: 'principal:1',
    principalRevision: '1', executionTargetRef: 'executor:1', contextScope: scope(), lifecycleState: 'CURRENT',
    freshnessState: 'CURRENT', contradictionState: 'NONE', authority: 'NONE', continuationExecuted: false,
    executionStarted: false, effectPerformed: false, effectVerified: false, ...(overrides.intent || {})
  };
  const requirement = {
    executionStartRequirementEvidenceRef: 'evidence:start:1', executionTargetRef: 'executor:1',
    continuationTargetRef: 'continuation:1', interactionId: 'interaction:1', fromInteractionRevision: 1,
    throughInteractionRevision: 3, gateId: 'gate:1', gateRevision: 1, authorityScopeDigest: scopeDigest,
    requiredPrincipalRef: 'principal:1', requiredPrincipalRevision: '1', lifecycleState: 'CURRENT',
    freshnessState: 'CURRENT', contradictionState: 'NONE', authority: 'NONE', ...(overrides.requirement || {})
  };
  return { intent, requirement };
}
function system(overrides = {}) {
  const f = fixtures(overrides.fixtures || {});
  const ledger = overrides.ledger || createMemoryLedger();
  return {
    ledger,
    component: createBoundedContinuationExecutionStart({
      executionIntentPort: overrides.executionIntentPort || (() => f.intent),
      executionStartRequirementPort: overrides.executionStartRequirementPort || (() => f.requirement),
      startLedger: ledger
    })
  };
}
const cases = [];
function check(name, fn) { fn(); cases.push(name); console.log(`PASS - ${name}`); }
function noEffect(output) {
  assert.equal(output.authority, AUTHORITY);
  assert.equal(output.executionStarted, false);
  assert.equal(output.continuationExecuted, false);
  assert.equal(output.effectPerformed, false);
  assert.equal(output.effectVerified, false);
}

check('constructor-requires-ports-and-ledger', () => assert.throws(() => createBoundedContinuationExecutionStart({}), TypeError));
check('exact-positive-path-startable', () => {
  const o = system().component.assess(request());
  assert.equal(o.outcome, OUTCOMES.STARTABLE); assert.equal(o.executionStartPermitted, true);
  assert.equal(o.startRecord.startState, 'PERMITTED'); noEffect(o);
});
check('caller-execution-started-invalid', () => { const o = system().component.assess({ ...request(), executionStarted: true }); assert.equal(o.outcome, OUTCOMES.INVALID); noEffect(o); });
check('caller-effect-performed-invalid', () => { const o = system().component.assess({ ...request(), effectPerformed: true }); assert.equal(o.outcome, OUTCOMES.INVALID); noEffect(o); });
check('execution-intent-unavailable-unknown', () => { const o = system({ executionIntentPort: () => { throw new Error('missing'); } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); });
check('execution-intent-noncurrent-unknown', () => { const o = system({ fixtures: { intent: { freshnessState: 'STALE' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); });
check('execution-intent-not-permitted-unknown', () => { const o = system({ fixtures: { intent: { executionState: 'DENIED', continuationExecutionPermitted: false } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); });
check('start-requirement-unavailable-unknown', () => { const o = system({ executionStartRequirementPort: () => { throw new Error('missing'); } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); });
check('stale-start-requirement-unknown', () => { const o = system({ fixtures: { requirement: { freshnessState: 'STALE' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); });
check('conflicting-start-requirement-unknown', () => { const o = system({ fixtures: { requirement: { contradictionState: 'CONFLICT' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); });
check('wrong-gate-not-startable', () => { const o = system({ fixtures: { requirement: { gateId: 'gate:2' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_STARTABLE); });
check('wrong-gate-revision-not-startable', () => { const o = system({ fixtures: { requirement: { gateRevision: 2 } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_STARTABLE); });
check('wrong-authority-scope-not-startable', () => { const o = system({ fixtures: { requirement: { authorityScopeDigest: `sha256:${'b'.repeat(64)}` } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_STARTABLE); });
check('wrong-continuation-target-not-startable', () => { const o = system({ fixtures: { requirement: { continuationTargetRef: 'continuation:2' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_STARTABLE); });
check('wrong-execution-target-not-startable', () => { const o = system({ fixtures: { requirement: { executionTargetRef: 'executor:2' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_STARTABLE); });
check('wrong-principal-not-startable', () => { const o = system({ fixtures: { intent: { principalRef: 'principal:2' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_STARTABLE); });
check('execution-intent-scope-does-not-cover-current-revision', () => { const o = system({ fixtures: { intent: { contextScope: scope({ throughInteractionRevision: 1 }) } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_STARTABLE); });
check('exact-replay-is-deterministic', () => {
  const s = system(); const a = s.component.assess(request()); const b = s.component.assess(request());
  assert.equal(a.outcome, OUTCOMES.STARTABLE); assert.equal(b.outcome, OUTCOMES.STARTABLE);
  assert.equal(a.startRecord.executionStartId, b.startRecord.executionStartId); assert.deepEqual(a.startRecord, b.startRecord);
});
check('changed-execution-target-changes-identity', () => {
  const a = system().component.assess(request());
  const b = system({ fixtures: { intent: { executionTargetRef: 'executor:2' }, requirement: { executionTargetRef: 'executor:2' } } }).component.assess(request({ executionTargetRef: 'executor:2' }));
  assert.equal(a.outcome, OUTCOMES.STARTABLE); assert.equal(b.outcome, OUTCOMES.STARTABLE);
  assert.notEqual(a.startRecord.executionStartId, b.startRecord.executionStartId);
});
check('changed-interaction-revision-changes-identity', () => {
  const a = system().component.assess(request()); const b = system().component.assess(request({ interactionRevision: 3 }));
  assert.equal(a.outcome, OUTCOMES.STARTABLE); assert.equal(b.outcome, OUTCOMES.STARTABLE);
  assert.notEqual(a.startRecord.executionStartId, b.startRecord.executionStartId);
});
check('ledger-conflict-remains-unknown-and-no-effect', () => {
  const seed = system(); const first = seed.component.assess(request());
  const bad = { get: id => ({ ...first.startRecord, executionStartId: id, principalRef: 'principal:other' }), commit() { throw new Error('should-not-commit'); } };
  const o = system({ ledger: bad }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); noEffect(o);
});
check('all-outcomes-never-start-or-perform-effect', () => {
  const outputs = [system().component.assess(request()), system({ fixtures: { requirement: { gateId: 'gate:2' } } }).component.assess(request()), system({ executionStartRequirementPort: () => { throw new Error('x'); } }).component.assess(request()), system().component.assess({ ...request(), effectVerified: true })];
  outputs.forEach(noEffect);
});

console.log(`${cases.length}/${cases.length} PASS`);
