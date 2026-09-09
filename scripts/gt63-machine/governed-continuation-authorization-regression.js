'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  createGovernedContinuationAuthorization,
  createMemoryLedger
} = require('./governed-continuation-authorization');

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
    gateSatisfactionId: 'satisfaction:1',
    interactionId: 'interaction:1',
    interactionRevision: 2,
    gateId: 'gate:1',
    gateRevision: 1,
    authorityScopeDigest: scopeDigest,
    continuationTargetRef: 'continuation:1',
    expectedPrincipalRef: 'principal:1',
    expectedPrincipalRevision: '1',
    ...overrides
  };
}

function fixtures(overrides = {}) {
  const satisfaction = {
    satisfactionId: 'satisfaction:1',
    type: 'GT63_HUMAN_GATE_AUTHORIZATION_CONSUMPTION',
    satisfactionState: 'SATISFIED',
    humanGateSatisfied: true,
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
    ...(overrides.satisfaction || {})
  };
  const requirement = {
    continuationRequirementEvidenceRef: 'evidence:continuation:1',
    interactionId: 'interaction:1',
    fromInteractionRevision: 1,
    throughInteractionRevision: 3,
    gateId: 'gate:1',
    gateRevision: 1,
    authorityScopeDigest: scopeDigest,
    continuationTargetRef: 'continuation:1',
    requiredPrincipalRef: 'principal:1',
    requiredPrincipalRevision: '1',
    lifecycleState: 'CURRENT',
    freshnessState: 'CURRENT',
    contradictionState: 'NONE',
    authority: 'NONE',
    ...(overrides.requirement || {})
  };
  return { satisfaction, requirement };
}

function system(overrides = {}) {
  const f = fixtures(overrides.fixtures || {});
  const ledger = overrides.ledger || createMemoryLedger();
  return {
    ledger,
    component: createGovernedContinuationAuthorization({
      gateSatisfactionPort: overrides.gateSatisfactionPort || (() => f.satisfaction),
      continuationRequirementPort: overrides.continuationRequirementPort || (() => f.requirement),
      authorizationLedger: ledger
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
  assert.equal(output.executionAuthorityCreated, false);
  assert.equal(output.effectPerformed, false);
}

check('constructor-requires-ports-and-ledger', () => {
  assert.throws(() => createGovernedContinuationAuthorization({}), TypeError);
});
check('exact-positive-path-authorized', () => {
  const output = system().component.assess(request());
  assert.equal(output.outcome, OUTCOMES.AUTHORIZED);
  assert.equal(output.continuationAuthorized, true);
  assert.equal(output.authorization.authorizationState, 'AUTHORIZED');
  noEffect(output);
});
check('caller-continuation-authorized-invalid', () => {
  const output = system().component.assess({ ...request(), continuationAuthorized: true });
  assert.equal(output.outcome, OUTCOMES.INVALID);
  noEffect(output);
});
check('gate-satisfaction-unavailable-unknown', () => {
  const output = system({ gateSatisfactionPort: () => { throw new Error('missing'); } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});
check('gate-satisfaction-noncurrent-unknown', () => {
  const output = system({ fixtures: { satisfaction: { freshnessState: 'STALE' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});
check('gate-satisfaction-not-satisfied-unknown', () => {
  const output = system({ fixtures: { satisfaction: { satisfactionState: 'NOT_SATISFIED', humanGateSatisfied: false } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});
check('continuation-requirement-unavailable-unknown', () => {
  const output = system({ continuationRequirementPort: () => { throw new Error('missing'); } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});
check('stale-continuation-requirement-unknown', () => {
  const output = system({ fixtures: { requirement: { freshnessState: 'STALE' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});
check('conflicting-continuation-requirement-unknown', () => {
  const output = system({ fixtures: { requirement: { contradictionState: 'CONFLICT' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
});
check('wrong-gate-not-authorized', () => {
  const output = system({ fixtures: { requirement: { gateId: 'gate:2' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});
check('wrong-gate-revision-not-authorized', () => {
  const output = system({ fixtures: { requirement: { gateRevision: 2 } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});
check('wrong-authority-scope-not-authorized', () => {
  const output = system({ fixtures: { requirement: { authorityScopeDigest: `sha256:${'b'.repeat(64)}` } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});
check('wrong-continuation-target-not-authorized', () => {
  const output = system({ fixtures: { requirement: { continuationTargetRef: 'continuation:2' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});
check('wrong-principal-not-authorized', () => {
  const output = system({ fixtures: { satisfaction: { principalRef: 'principal:2' } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});
check('gate-satisfaction-scope-does-not-cover-current-revision', () => {
  const output = system({ fixtures: { satisfaction: { contextScope: scope({ throughInteractionRevision: 1 }) } } }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.NOT_AUTHORIZED);
});
check('exact-replay-is-deterministic', () => {
  const s = system();
  const first = s.component.assess(request());
  const second = s.component.assess(request());
  assert.equal(first.outcome, OUTCOMES.AUTHORIZED);
  assert.equal(second.outcome, OUTCOMES.AUTHORIZED);
  assert.equal(first.authorization.continuationAuthorizationId, second.authorization.continuationAuthorizationId);
  assert.deepEqual(first.authorization, second.authorization);
});
check('changed-interaction-revision-changes-identity', () => {
  const first = system().component.assess(request());
  const second = system().component.assess(request({ interactionRevision: 3 }));
  assert.equal(first.outcome, OUTCOMES.AUTHORIZED);
  assert.equal(second.outcome, OUTCOMES.AUTHORIZED);
  assert.notEqual(first.authorization.continuationAuthorizationId, second.authorization.continuationAuthorizationId);
});
check('ledger-conflict-remains-unknown-and-no-effect', () => {
  const seed = system();
  const first = seed.component.assess(request());
  const badLedger = {
    get(id) {
      return { ...first.authorization, continuationAuthorizationId: id, principalRef: 'principal:other' };
    },
    commit() {
      throw new Error('should-not-commit');
    }
  };
  const output = system({ ledger: badLedger }).component.assess(request());
  assert.equal(output.outcome, OUTCOMES.UNKNOWN);
  noEffect(output);
});
check('all-outcomes-never-execute-effect', () => {
  const outputs = [
    system().component.assess(request()),
    system({ fixtures: { requirement: { gateId: 'gate:2' } } }).component.assess(request()),
    system({ continuationRequirementPort: () => { throw new Error('x'); } }).component.assess(request()),
    system().component.assess({ ...request(), effectPerformed: true })
  ];
  outputs.forEach(noEffect);
});

console.log(`${cases.length}/${cases.length} PASS`);
