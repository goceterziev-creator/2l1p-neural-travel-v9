'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION,
  createContinuationRequirementEvidence
} = require('./continuation-requirement-evidence');

let pass = 0;
let fail = 0;
const test = (name, fn) => {
  try { fn(); console.log(`PASS - ${name}`); pass++; }
  catch (error) { console.log(`FAIL - ${name}`); console.log(error.stack || error); fail++; }
};

const DIGEST = 'sha256:' + 'a'.repeat(64);
const PRINCIPAL = 'gt63-machine:human-principal:goce-v0';
const PRINCIPAL_REVISION = '1';
const TARGET = 'operation:minimal-v0';

const baseMaterial = {
  continuationTargetRef: TARGET,
  interactionId: 'i1',
  fromInteractionRevision: 3,
  throughInteractionRevision: 9,
  gateId: 'g1',
  gateRevision: 1,
  authorityScopeDigest: DIGEST,
  requiredPrincipalRef: PRINCIPAL,
  requiredPrincipalRevision: PRINCIPAL_REVISION,
  lifecycleState: 'CURRENT',
  freshnessState: 'CURRENT',
  contradictionState: 'NONE'
};

const request = {
  rulesetVersion: RULESET_VERSION,
  continuationTargetRef: TARGET,
  interactionId: 'i1',
  interactionRevision: 5,
  gateId: 'g1',
  gateRevision: 1,
  authorityScopeDigest: DIGEST,
  expectedPrincipalRef: PRINCIPAL,
  expectedPrincipalRevision: PRINCIPAL_REVISION
};

const make = material => createContinuationRequirementEvidence({
  requirementSourcePort: () => material
});

test('constructor-requires-requirement-source-port', () => {
  assert.throws(() => createContinuationRequirementEvidence());
});

test('exact-current-continuation-requirement-resolved', () => {
  const result = make(baseMaterial).resolve(request);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.evidence.type, 'GT63_CONTINUATION_REQUIREMENT_EVIDENCE');
  assert.equal(result.evidence.continuationTargetRef, TARGET);
});

test('lower-bound-revision-resolved', () => {
  assert.equal(make(baseMaterial).resolve({ ...request, interactionRevision: 3 }).outcome, 'RESOLVED');
});

test('upper-bound-revision-resolved', () => {
  assert.equal(make(baseMaterial).resolve({ ...request, interactionRevision: 9 }).outcome, 'RESOLVED');
});

test('open-ended-range-resolved', () => {
  const material = { ...baseMaterial, throughInteractionRevision: null };
  assert.equal(make(material).resolve({ ...request, interactionRevision: 99 }).outcome, 'RESOLVED');
});

test('missing-requirement-not-resolved', () => {
  assert.equal(make(null).resolve(request).outcome, 'NOT_RESOLVED');
});

test('wrong-target-not-resolved', () => {
  assert.equal(make({ ...baseMaterial, continuationTargetRef: 'other' }).resolve(request).outcome, 'NOT_RESOLVED');
});

test('wrong-interaction-not-resolved', () => {
  assert.equal(make({ ...baseMaterial, interactionId: 'other' }).resolve(request).outcome, 'NOT_RESOLVED');
});

test('wrong-gate-id-not-resolved', () => {
  assert.equal(make({ ...baseMaterial, gateId: 'other' }).resolve(request).outcome, 'NOT_RESOLVED');
});

test('wrong-gate-revision-not-resolved', () => {
  assert.equal(make({ ...baseMaterial, gateRevision: 2 }).resolve(request).outcome, 'NOT_RESOLVED');
});

test('wrong-scope-digest-not-resolved', () => {
  assert.equal(make({ ...baseMaterial, authorityScopeDigest: 'sha256:' + 'b'.repeat(64) }).resolve(request).outcome, 'NOT_RESOLVED');
});

test('wrong-principal-not-resolved', () => {
  assert.equal(make({ ...baseMaterial, requiredPrincipalRef: 'other' }).resolve(request).outcome, 'NOT_RESOLVED');
});

test('wrong-principal-revision-not-resolved', () => {
  assert.equal(make({ ...baseMaterial, requiredPrincipalRevision: '2' }).resolve(request).outcome, 'NOT_RESOLVED');
});

test('revision-before-range-not-resolved', () => {
  assert.equal(make(baseMaterial).resolve({ ...request, interactionRevision: 2 }).outcome, 'NOT_RESOLVED');
});

test('revision-after-range-not-resolved', () => {
  assert.equal(make(baseMaterial).resolve({ ...request, interactionRevision: 10 }).outcome, 'NOT_RESOLVED');
});

test('stale-lifecycle-is-unknown', () => {
  assert.equal(make({ ...baseMaterial, lifecycleState: 'STALE' }).resolve(request).outcome, 'UNKNOWN');
});

test('stale-freshness-is-unknown', () => {
  assert.equal(make({ ...baseMaterial, freshnessState: 'STALE' }).resolve(request).outcome, 'UNKNOWN');
});

test('contradictory-is-unknown', () => {
  assert.equal(make({ ...baseMaterial, contradictionState: 'CONTRADICTED' }).resolve(request).outcome, 'UNKNOWN');
});

test('malformed-digest-is-unknown', () => {
  assert.equal(make({ ...baseMaterial, authorityScopeDigest: 'bad' }).resolve(request).outcome, 'UNKNOWN');
});

test('missing-target-is-unknown', () => {
  const { continuationTargetRef, ...rest } = baseMaterial;
  assert.equal(make(rest).resolve(request).outcome, 'UNKNOWN');
});

test('missing-principal-is-unknown', () => {
  const { requiredPrincipalRef, ...rest } = baseMaterial;
  assert.equal(make(rest).resolve(request).outcome, 'UNKNOWN');
});

test('missing-principal-revision-is-unknown', () => {
  const { requiredPrincipalRevision, ...rest } = baseMaterial;
  assert.equal(make(rest).resolve(request).outcome, 'UNKNOWN');
});

test('extra-source-field-is-unknown', () => {
  assert.equal(make({ ...baseMaterial, force: true }).resolve(request).outcome, 'UNKNOWN');
});

test('source-failure-is-unknown', () => {
  const primitive = createContinuationRequirementEvidence({ requirementSourcePort: () => { throw new Error('x'); } });
  assert.equal(primitive.resolve(request).outcome, 'UNKNOWN');
});

test('wrong-ruleset-invalid', () => {
  assert.equal(make(baseMaterial).resolve({ ...request, rulesetVersion: 'x' }).outcome, 'INVALID');
});

test('extra-request-field-invalid', () => {
  assert.equal(make(baseMaterial).resolve({ ...request, force: true }).outcome, 'INVALID');
});

test('negative-interaction-revision-invalid', () => {
  assert.equal(make(baseMaterial).resolve({ ...request, interactionRevision: -1 }).outcome, 'INVALID');
});

test('zero-gate-revision-invalid', () => {
  assert.equal(make(baseMaterial).resolve({ ...request, gateRevision: 0 }).outcome, 'INVALID');
});

test('deterministic-evidence-identity', () => {
  const primitive = make(baseMaterial);
  const a = primitive.resolve(request);
  const b = primitive.resolve(request);
  assert.equal(a.evidence.continuationRequirementEvidenceRef, b.evidence.continuationRequirementEvidenceRef);
  assert.deepEqual(a.evidence, b.evidence);
});

test('scope-digest-bound-to-evidence', () => {
  const a = make(baseMaterial).resolve(request).evidence.continuationRequirementEvidenceRef;
  const material = { ...baseMaterial, authorityScopeDigest: 'sha256:' + 'b'.repeat(64) };
  const req = { ...request, authorityScopeDigest: material.authorityScopeDigest };
  const b = make(material).resolve(req).evidence.continuationRequirementEvidenceRef;
  assert.notEqual(a, b);
});

test('target-bound-to-evidence', () => {
  const a = make(baseMaterial).resolve(request).evidence.continuationRequirementEvidenceRef;
  const material = { ...baseMaterial, continuationTargetRef: 'operation:other-v0' };
  const req = { ...request, continuationTargetRef: material.continuationTargetRef };
  const b = make(material).resolve(req).evidence.continuationRequirementEvidenceRef;
  assert.notEqual(a, b);
});

test('principal-bound-to-evidence', () => {
  const a = make(baseMaterial).resolve(request).evidence.continuationRequirementEvidenceRef;
  const material = { ...baseMaterial, requiredPrincipalRef: 'principal:other' };
  const req = { ...request, expectedPrincipalRef: material.requiredPrincipalRef };
  const b = make(material).resolve(req).evidence.continuationRequirementEvidenceRef;
  assert.notEqual(a, b);
});

test('resolved-result-no-downstream-authority', () => {
  const result = make(baseMaterial).resolve(request);
  assert.equal(result.authority, 'NONE');
  assert.equal(result.humanGateSatisfied, false);
  assert.equal(result.continuationAuthorized, false);
  assert.equal(result.continuationExecuted, false);
  assert.equal(result.executionAuthorityCreated, false);
  assert.equal(result.effectAuthorized, false);
  assert.equal(result.effectPerformed, false);
});

test('not-resolved-result-no-downstream-authority', () => {
  const result = make(null).resolve(request);
  assert.equal(result.authority, 'NONE');
  assert.equal(result.continuationAuthorized, false);
  assert.equal(result.executionAuthorityCreated, false);
  assert.equal(result.effectPerformed, false);
});

test('unknown-result-no-downstream-authority', () => {
  const result = make({ ...baseMaterial, lifecycleState: 'STALE' }).resolve(request);
  assert.equal(result.authority, 'NONE');
  assert.equal(result.continuationAuthorized, false);
  assert.equal(result.executionAuthorityCreated, false);
  assert.equal(result.effectPerformed, false);
});

test('invalid-result-no-downstream-authority', () => {
  const result = make(baseMaterial).resolve({ ...request, rulesetVersion: 'x' });
  assert.equal(result.authority, 'NONE');
  assert.equal(result.continuationAuthorized, false);
  assert.equal(result.executionAuthorityCreated, false);
  assert.equal(result.effectPerformed, false);
});

console.log(`${pass}/${pass + fail} PASS`);
if (fail) process.exitCode = 1;
