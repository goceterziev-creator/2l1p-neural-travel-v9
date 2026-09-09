'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  createEffectPerformanceObservation,
  createMemoryLedger
} = require('./effect-performance-observation');

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
    continuationCompletionObservationId: 'completion:1', interactionId: 'interaction:1', interactionRevision: 2,
    gateId: 'gate:1', gateRevision: 1, authorityScopeDigest: scopeDigest,
    continuationTargetRef: 'continuation:1', expectedPrincipalRef: 'principal:1',
    expectedPrincipalRevision: '1', executionTargetRef: 'execution:1', runtimeEffectEvidenceRef: 'runtime-effect:1',
    ...overrides
  };
}
function fixtures(overrides = {}) {
  const completion = {
    continuationCompletionObservationId: 'completion:1', type: 'GT63_CONTINUATION_COMPLETION_OBSERVATION',
    observationState: 'OBSERVED', continuationExecuted: true, effectPerformed: false, effectVerified: false,
    authority: 'NONE', lifecycleState: 'CURRENT', freshnessState: 'CURRENT', contradictionState: 'NONE',
    executionTargetRef: 'execution:1', principalRef: 'principal:1', principalRevision: '1', contextScope: scope(),
    ...(overrides.completion || {})
  };
  const runtime = {
    runtimeEffectEvidenceRef: 'runtime-effect:1', continuationCompletionObservationId: 'completion:1',
    effectPerformed: true, executionTargetRef: 'execution:1', interactionId: 'interaction:1', gateId: 'gate:1',
    gateRevision: 1, authorityScopeDigest: scopeDigest, continuationTargetRef: 'continuation:1',
    principalRef: 'principal:1', principalRevision: '1', lifecycleState: 'CURRENT', freshnessState: 'CURRENT',
    contradictionState: 'NONE', authority: 'NONE', ...(overrides.runtime || {})
  };
  return { completion, runtime };
}
function system(overrides = {}) {
  const f = fixtures(overrides.fixtures || {});
  const ledger = overrides.ledger || createMemoryLedger();
  return {
    ledger,
    component: createEffectPerformanceObservation({
      continuationCompletionObservationPort: overrides.continuationCompletionObservationPort || (() => f.completion),
      runtimeEffectEvidencePort: overrides.runtimeEffectEvidencePort || (() => f.runtime),
      observationLedger: ledger
    })
  };
}
const cases = [];
function check(name, fn) { fn(); cases.push(name); console.log(`PASS - ${name}`); }
function noVerify(output) { assert.equal(output.authority, AUTHORITY); assert.equal(output.effectVerified, false); }

check('constructor-requires-ports-and-ledger', () => assert.throws(() => createEffectPerformanceObservation({}), TypeError));
check('exact-positive-path-observed', () => { const o = system().component.assess(request()); assert.equal(o.outcome, OUTCOMES.OBSERVED); assert.equal(o.effectPerformed, true); assert.equal(o.observation.effectPerformed, true); noVerify(o); });
check('caller-effect-performed-invalid', () => { const o = system().component.assess({ ...request(), effectPerformed: true }); assert.equal(o.outcome, OUTCOMES.INVALID); noVerify(o); });
check('caller-effect-verified-invalid', () => { const o = system().component.assess({ ...request(), effectVerified: true }); assert.equal(o.outcome, OUTCOMES.INVALID); noVerify(o); });
check('completion-unavailable-unknown', () => { const o = system({ continuationCompletionObservationPort: () => { throw new Error('x'); } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); });
check('completion-noncurrent-unknown', () => { const o = system({ fixtures: { completion: { freshnessState: 'STALE' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); });
check('completion-not-observed-unknown', () => { const o = system({ fixtures: { completion: { observationState: 'NOT_OBSERVED', continuationExecuted: false } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); });
check('runtime-effect-unavailable-unknown', () => { const o = system({ runtimeEffectEvidencePort: () => { throw new Error('x'); } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); });
check('runtime-effect-stale-unknown', () => { const o = system({ fixtures: { runtime: { freshnessState: 'STALE' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); });
check('runtime-effect-conflicting-unknown', () => { const o = system({ fixtures: { runtime: { contradictionState: 'CONFLICT' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); });
check('runtime-no-positive-effect-not-observed', () => { const o = system({ fixtures: { runtime: { effectPerformed: false } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED); });
check('wrong-completion-id-not-observed', () => { const o = system({ fixtures: { runtime: { continuationCompletionObservationId: 'completion:2' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED); });
check('wrong-gate-not-observed', () => { const o = system({ fixtures: { runtime: { gateId: 'gate:2' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED); });
check('wrong-gate-revision-not-observed', () => { const o = system({ fixtures: { runtime: { gateRevision: 2 } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED); });
check('wrong-authority-scope-not-observed', () => { const o = system({ fixtures: { runtime: { authorityScopeDigest: `sha256:${'b'.repeat(64)}` } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED); });
check('wrong-continuation-target-not-observed', () => { const o = system({ fixtures: { runtime: { continuationTargetRef: 'continuation:2' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED); });
check('wrong-execution-target-not-observed', () => { const o = system({ fixtures: { runtime: { executionTargetRef: 'execution:2' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED); });
check('wrong-principal-not-observed', () => { const o = system({ fixtures: { runtime: { principalRef: 'principal:2' } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED); });
check('completion-scope-does-not-cover-current-revision', () => { const o = system({ fixtures: { completion: { contextScope: scope({ throughInteractionRevision: 1 }) } } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.NOT_OBSERVED); });
check('exact-replay-is-deterministic', () => { const s = system(); const a = s.component.assess(request()); const b = s.component.assess(request()); assert.equal(a.outcome, OUTCOMES.OBSERVED); assert.equal(b.outcome, OUTCOMES.OBSERVED); assert.equal(a.observation.effectPerformanceObservationId, b.observation.effectPerformanceObservationId); assert.deepEqual(a.observation, b.observation); });
check('changed-runtime-evidence-ref-changes-identity', () => { const a = system().component.assess(request()); const b = system({ fixtures: { runtime: { runtimeEffectEvidenceRef: 'runtime-effect:2' } } }).component.assess(request({ runtimeEffectEvidenceRef: 'runtime-effect:2' })); assert.notEqual(a.observation.effectPerformanceObservationId, b.observation.effectPerformanceObservationId); });
check('changed-interaction-revision-changes-identity', () => { const a = system().component.assess(request()); const b = system().component.assess(request({ interactionRevision: 3 })); assert.notEqual(a.observation.effectPerformanceObservationId, b.observation.effectPerformanceObservationId); });
check('ledger-conflict-remains-unknown-and-no-verification', () => { const seed = system(); const first = seed.component.assess(request()); const ledger = { get(id) { return { ...first.observation, effectPerformanceObservationId: id, principalRef: 'principal:other' }; }, commit() { throw new Error('no'); } }; const o = system({ ledger }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN); noVerify(o); });
check('all-outcomes-never-claim-verification', () => { const outputs = [system().component.assess(request()), system({ fixtures: { runtime: { effectPerformed: false } } }).component.assess(request()), system({ runtimeEffectEvidencePort: () => { throw new Error('x'); } }).component.assess(request()), system().component.assess({ ...request(), effectVerified: true })]; outputs.forEach(noVerify); });

console.log(`${cases.length}/${cases.length} PASS`);
