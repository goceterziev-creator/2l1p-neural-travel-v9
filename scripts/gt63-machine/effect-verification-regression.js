'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  createEffectVerification,
  createMemoryLedger
} = require('./effect-verification');

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
    effectPerformanceObservationId: 'effect-observation:1', interactionId: 'interaction:1',
    interactionRevision: 2, gateId: 'gate:1', gateRevision: 1,
    authorityScopeDigest: scopeDigest, continuationTargetRef: 'continuation:1',
    expectedPrincipalRef: 'principal:1', expectedPrincipalRevision: '1',
    executionTargetRef: 'execution:1', verificationEvidenceRef: 'verification-evidence:1', ...overrides
  };
}
function fixtures(overrides = {}) {
  return {
    observation: {
      effectPerformanceObservationId: 'effect-observation:1',
      type: 'GT63_EFFECT_PERFORMANCE_OBSERVATION', observationState: 'OBSERVED',
      effectPerformed: true, effectVerified: false, authority: 'NONE',
      lifecycleState: 'CURRENT', freshnessState: 'CURRENT', contradictionState: 'NONE',
      executionTargetRef: 'execution:1', principalRef: 'principal:1', principalRevision: '1',
      contextScope: scope(), ...(overrides.observation || {})
    },
    evidence: {
      verificationEvidenceRef: 'verification-evidence:1', effectVerified: true,
      effectPerformanceObservationId: 'effect-observation:1', executionTargetRef: 'execution:1',
      interactionId: 'interaction:1', gateId: 'gate:1', gateRevision: 1,
      authorityScopeDigest: scopeDigest, continuationTargetRef: 'continuation:1',
      principalRef: 'principal:1', principalRevision: '1',
      lifecycleState: 'CURRENT', freshnessState: 'CURRENT', contradictionState: 'NONE', authority: 'NONE',
      ...(overrides.evidence || {})
    }
  };
}
function system(overrides = {}) {
  const f = fixtures(overrides.fixtures || {});
  const ledger = overrides.ledger || createMemoryLedger();
  return {
    component: createEffectVerification({
      effectObservationPort: overrides.effectObservationPort || (() => f.observation),
      verificationEvidencePort: overrides.verificationEvidencePort || (() => f.evidence),
      verificationLedger: ledger
    })
  };
}
const cases = [];
function check(name, fn) { fn(); cases.push(name); console.log(`PASS - ${name}`); }
function noAuthority(output) {
  assert.equal(output.authority, AUTHORITY);
  assert.equal(output.executionAuthorityCreated, false);
  assert.equal(output.additionalEffectAuthorized, false);
}
check('constructor-requires-ports-and-ledger', () => assert.throws(() => createEffectVerification({}), TypeError));
check('exact-positive-path-verified', () => {
  const o = system().component.assess(request());
  assert.equal(o.outcome, OUTCOMES.VERIFIED); assert.equal(o.effectPerformed, true); assert.equal(o.effectVerified, true); noAuthority(o);
});
check('caller-effect-verified-invalid', () => {
  const o = system().component.assess({ ...request(), effectVerified: true });
  assert.equal(o.outcome, OUTCOMES.INVALID); noAuthority(o);
});
check('effect-observation-unavailable-unknown', () => {
  const o = system({ effectObservationPort: () => { throw new Error('x'); } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('effect-observation-noncurrent-unknown', () => assert.equal(system({ fixtures:{observation:{freshnessState:'STALE'}}}).component.assess(request()).outcome, OUTCOMES.UNKNOWN));
check('effect-observation-not-performed-unknown', () => assert.equal(system({ fixtures:{observation:{effectPerformed:false}}}).component.assess(request()).outcome, OUTCOMES.UNKNOWN));
check('verification-evidence-unavailable-unknown', () => {
  const o = system({ verificationEvidencePort: () => { throw new Error('x'); } }).component.assess(request()); assert.equal(o.outcome, OUTCOMES.UNKNOWN);
});
check('verification-evidence-stale-unknown', () => assert.equal(system({ fixtures:{evidence:{freshnessState:'STALE'}}}).component.assess(request()).outcome, OUTCOMES.UNKNOWN));
check('verification-evidence-conflicting-unknown', () => assert.equal(system({ fixtures:{evidence:{contradictionState:'CONFLICT'}}}).component.assess(request()).outcome, OUTCOMES.UNKNOWN));
check('verification-evidence-no-positive-proof-not-verified', () => assert.equal(system({ fixtures:{evidence:{effectVerified:false}}}).component.assess(request()).outcome, OUTCOMES.NOT_VERIFIED));
check('wrong-observation-id-not-verified', () => assert.equal(system({ fixtures:{evidence:{effectPerformanceObservationId:'effect-observation:2'}}}).component.assess(request()).outcome, OUTCOMES.NOT_VERIFIED));
check('wrong-gate-not-verified', () => assert.equal(system({ fixtures:{evidence:{gateId:'gate:2'}}}).component.assess(request()).outcome, OUTCOMES.NOT_VERIFIED));
check('wrong-gate-revision-not-verified', () => assert.equal(system({ fixtures:{evidence:{gateRevision:2}}}).component.assess(request()).outcome, OUTCOMES.NOT_VERIFIED));
check('wrong-authority-scope-not-verified', () => assert.equal(system({ fixtures:{evidence:{authorityScopeDigest:`sha256:${'b'.repeat(64)}`}}}).component.assess(request()).outcome, OUTCOMES.NOT_VERIFIED));
check('wrong-continuation-target-not-verified', () => assert.equal(system({ fixtures:{evidence:{continuationTargetRef:'continuation:2'}}}).component.assess(request()).outcome, OUTCOMES.NOT_VERIFIED));
check('wrong-execution-target-not-verified', () => assert.equal(system({ fixtures:{evidence:{executionTargetRef:'execution:2'}}}).component.assess(request()).outcome, OUTCOMES.NOT_VERIFIED));
check('wrong-principal-not-verified', () => assert.equal(system({ fixtures:{evidence:{principalRef:'principal:2'}}}).component.assess(request()).outcome, OUTCOMES.NOT_VERIFIED));
check('effect-observation-scope-does-not-cover-current-revision', () => assert.equal(system({ fixtures:{observation:{contextScope:scope({throughInteractionRevision:1})}}}).component.assess(request()).outcome, OUTCOMES.NOT_VERIFIED));
check('exact-replay-is-deterministic', () => {
  const s = system(); const a=s.component.assess(request()); const b=s.component.assess(request());
  assert.equal(a.outcome, OUTCOMES.VERIFIED); assert.equal(b.outcome, OUTCOMES.VERIFIED); assert.deepEqual(a.verification,b.verification);
});
check('changed-verification-evidence-ref-changes-identity', () => {
  const a=system().component.assess(request());
  const b=system({fixtures:{evidence:{verificationEvidenceRef:'verification-evidence:2'}}}).component.assess(request({verificationEvidenceRef:'verification-evidence:2'}));
  assert.notEqual(a.verification.effectVerificationId,b.verification.effectVerificationId);
});
check('changed-interaction-revision-changes-identity', () => {
  const a=system().component.assess(request());
  const b=system().component.assess(request({interactionRevision:3}));
  assert.notEqual(a.verification.effectVerificationId,b.verification.effectVerificationId);
});
check('ledger-conflict-remains-unknown-and-no-authority', () => {
  const seed=system().component.assess(request());
  const bad={ get:id => ({...seed.verification,effectVerificationId:id,principalRef:'principal:other'}), commit(){throw new Error('x');} };
  const o=system({ledger:bad}).component.assess(request()); assert.equal(o.outcome,OUTCOMES.UNKNOWN); noAuthority(o);
});
check('all-outcomes-never-create-authority', () => {
  [system().component.assess(request()), system({fixtures:{evidence:{effectVerified:false}}}).component.assess(request()), system({verificationEvidencePort:()=>{throw new Error('x')}}).component.assess(request()), system().component.assess({...request(),effectVerified:true})].forEach(noAuthority);
});
console.log(`${cases.length}/${cases.length} PASS`);
