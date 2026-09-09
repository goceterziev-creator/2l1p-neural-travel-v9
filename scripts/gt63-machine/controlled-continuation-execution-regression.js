'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  createControlledContinuationExecution,
  createMemoryLedger
} = require('./controlled-continuation-execution');

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
    continuationAuthorizationId: 'continuation-authorization:1',
    interactionId: 'interaction:1',
    interactionRevision: 2,
    gateId: 'gate:1',
    gateRevision: 1,
    authorityScopeDigest: scopeDigest,
    continuationTargetRef: 'continuation:1',
    expectedPrincipalRef: 'principal:1',
    expectedPrincipalRevision: '1',
    executionTargetRef: 'executor:1',
    ...overrides
  };
}

function fixtures(overrides = {}) {
  const authorization = {
    continuationAuthorizationId: 'continuation-authorization:1',
    type: 'GT63_GOVERNED_CONTINUATION_AUTHORIZATION',
    authorizationState: 'AUTHORIZED',
    continuationAuthorized: true,
    principalRef: 'principal:1',
    principalRevision: '1',
    contextScope: scope(),
    lifecycleState: 'CURRENT',
    freshnessState: 'CURRENT',
    contradictionState: 'NONE',
    authority: 'NONE',
    continuationExecuted: false,
    executionAuthorityCreated: false,
    effectPerformed: false,
    ...(overrides.authorization || {})
  };
  const requirement = {
    executionRequirementEvidenceRef: 'evidence:execution:1',
    interactionId: 'interaction:1',
    fromInteractionRevision: 1,
    throughInteractionRevision: 3,
    gateId: 'gate:1',
    gateRevision: 1,
    authorityScopeDigest: scopeDigest,
    continuationTargetRef: 'continuation:1',
    executionTargetRef: 'executor:1',
    requiredPrincipalRef: 'principal:1',
    requiredPrincipalRevision: '1',
    lifecycleState: 'CURRENT',
    freshnessState: 'CURRENT',
    contradictionState: 'NONE',
    authority: 'NONE',
    ...(overrides.requirement || {})
  };
  return { authorization, requirement };
}

function system(overrides = {}) {
  const f = fixtures(overrides.fixtures || {});
  const ledger = overrides.ledger || createMemoryLedger();
  return {
    ledger,
    component: createControlledContinuationExecution({
      continuationAuthorizationPort: overrides.continuationAuthorizationPort || (() => f.authorization),
      executionRequirementPort: overrides.executionRequirementPort || (() => f.requirement),
      executionLedger: ledger
    })
  };
}

const cases = [];
function check(name, fn) {
  fn();
  cases.push(name);
  console.log(`PASS - ${name}`);
}
function noEffect(output) {
  assert.equal(output.authority, AUTHORITY);
  assert.equal(output.continuationExecuted, false);
  assert.equal(output.executionStarted, false);
  assert.equal(output.effectPerformed, false);
  assert.equal(output.effectVerified, false);
}

check('constructor-requires-ports-and-ledger', () => {
  assert.throws(() => createControlledContinuationExecution({}), TypeError);
});
check('exact-positive-path-executable', () => {
  const output = system().component.assess(request());
  assert.equal(output.outcome, OUTCOMES.EXECUTABLE);
  assert.equal(output.continuationExecutionPermitted, true);
  assert.equal(output.executionIntent.executionState, 'PERMITTED');
  noEffect(output);
});
check('caller-continuation-executed-invalid', () => {
  const output = system().component.assess({ ...request(), continuationExecuted: true });
  assert.equal(output.outcome, OUTCOMES.INVALID);
  noEffect(output);
});
check('caller-effect-performed-invalid', () => {
  const output = system().component.assess({ ...request(), effectPerformed: true });
  assert.equal(output.outcome, OUTCOMES.INVALID);
  noEffect(output);
});
check('authorization-unavailable-unknown', () => {
  const output = system({ continuationAuthorizationPort: () => { throw new Error('missing'); } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});
check('authorization-noncurrent-unknown', () => {
  const output = system({ fixtures: { authorization: { freshnessState: 'STALE' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});
check('authorization-not-authorized-unknown', () => {
  const output = system({ fixtures: { authorization: { authorizationState: 'NOT_AUTHORIZED', continuationAuthorized: false } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});
check('execution-requirement-unavailable-unknown', () => {
  const output = system({ executionRequirementPort: () => { throw new Error('missing'); } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});
check('stale-execution-requirement-unknown', () => {
  const output = system({ fixtures: { requirement: { freshnessState: 'STALE' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});
check('conflicting-execution-requirement-unknown', () => {
  const output = system({ fixtures: { requirement: { contradictionState: 'CONFLICT' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});
check('wrong-gate-not-executable', () => {
  const output = system({ fixtures: { requirement: { gateId: 'gate:2' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_EXECUTABLE);
});
check('wrong-gate-revision-not-executable', () => {
  const output = system({ fixtures: { requirement: { gateRevision: 2 } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_EXECUTABLE);
});
check('wrong-authority-scope-not-executable', () => {
  const output = system({ fixtures: { requirement: { authorityScopeDigest: `sha256:${'b'.repeat(64)}` } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_EXECUTABLE);
});
check('wrong-continuation-target-not-executable', () => {
  const output = system({ fixtures: { requirement: { continuationTargetRef: 'continuation:2' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_EXECUTABLE);
});
check('wrong-execution-target-not-executable', () => {
  const output = system({ fixtures: { requirement: { executionTargetRef: 'executor:2' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_EXECUTABLE);
});
check('wrong-principal-not-executable', () => {
  const output = system({ fixtures: { authorization: { principalRef: 'principal:2' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_EXECUTABLE);
});
check('authorization-scope-does-not-cover-current-revision', () => {
  const output = system({ fixtures: { authorization: { contextScope: scope({ throughInteractionRevision: 1 }) } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_EXECUTABLE);
});
check('exact-replay-is-deterministic', () => {
  const s = system();
  const first = s.component.assess(request());
  const second = s.component.assess(request());
  assert.equal(first.outcome, OUTCOMES.EXECUTABLE);
  assert.equal(second.outcome, OUTCOMES.EXECUTABLE);
  assert.equal(first.executionIntent.executionIntentId, second.executionIntent.executionIntentId);
  assert.deepEqual(first.executionIntent, second.executionIntent);
});
check('changed-execution-target-changes-identity', () => {
  const first = system().component.assess(request());
  const second = system({ fixtures: { requirement: { executionTargetRef: 'executor:2' } } }).component.assess(request({ executionTargetRef: 'executor:2' }));
  assert.equal(first.outcome, OUTCOMES.EXECUTABLE);
  assert.equal(second.outcome, OUTCOMES.EXECUTABLE);
  assert.notEqual(first.executionIntent.executionIntentId, second.executionIntent.executionIntentId);
});
check('changed-interaction-revision-changes-identity', () => {
  const first = system().component.assess(request());
  const second = system().component.assess(request({ interactionRevision: 3 }));
  assert.equal(first.outcome, OUTCOMES.EXECUTABLE);
  assert.equal(second.outcome, OUTCOMES.EXECUTABLE);
  assert.notEqual(first.executionIntent.executionIntentId, second.executionIntent.executionIntentId);
});
check('ledger-conflict-remains-unknown-and-no-effect', () => {
  const seed = system();
  const first = seed.component.assess(request());
  const badLedger = {
    get(id) { return { ...first.executionIntent, executionIntentId: id, executionTargetRef: 'executor:other' }; },
    commit() { throw new Error('should-not-commit'); }
  };
  const output = system({ ledger: badLedger }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
  noEffect(output);
});
check('all-outcomes-never-start-or-perform-effect', () => {
  const outputs = [
    system().component.assess(request()),
    system({ fixtures: { requirement: { gateId: 'gate:2' } } }).component.assess(request()),
    system({ executionRequirementPort: () => { throw new Error('x'); } }).component.assess(request()),
    system().component.assess({ ...request(), executionStarted: true })
  ];
  outputs.forEach(noEffect);
});

console.log(`${cases.length}/${cases.length} PASS`);
