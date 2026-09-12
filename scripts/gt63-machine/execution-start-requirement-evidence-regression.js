'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION,
  createExecutionStartRequirementEvidence
} = require('./execution-start-requirement-evidence');

const scopeDigest = `sha256:${'a'.repeat(64)}`;
const baseMaterial = Object.freeze({
  executionTargetRef: 'gt63-execution-target:demo-v0',
  continuationTargetRef: 'gt63-continuation-target:demo-v0',
  interactionId: 'interaction-001',
  fromInteractionRevision: 4,
  throughInteractionRevision: 8,
  gateId: 'gate-001',
  gateRevision: 2,
  authorityScopeDigest: scopeDigest,
  requiredPrincipalRef: 'gt63-machine:human-principal:goce-v0',
  requiredPrincipalRevision: 'v0',
  lifecycleState: 'CURRENT',
  freshnessState: 'CURRENT',
  contradictionState: 'NONE'
});
const request = Object.freeze({
  rulesetVersion: RULESET_VERSION,
  executionTargetRef: baseMaterial.executionTargetRef,
  continuationTargetRef: baseMaterial.continuationTargetRef,
  interactionId: baseMaterial.interactionId,
  interactionRevision: 6,
  gateId: baseMaterial.gateId,
  gateRevision: baseMaterial.gateRevision,
  authorityScopeDigest: baseMaterial.authorityScopeDigest,
  expectedPrincipalRef: baseMaterial.requiredPrincipalRef,
  expectedPrincipalRevision: baseMaterial.requiredPrincipalRevision
});
const clone = v => JSON.parse(JSON.stringify(v));
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const resolveWith = material => createExecutionStartRequirementEvidence({ requirementSourcePort: () => material }).resolve(request);
const mutateMaterial = (key, value) => { const x = clone(baseMaterial); x[key] = value; return x; };
const mutateRequest = (key, value) => { const x = clone(request); x[key] = value; return x; };
const noAuthority = r => {
  assert.equal(r.authority, 'NONE');
  assert.equal(r.executionStartPermitted, false);
  assert.equal(r.executionStarted, false);
  assert.equal(r.continuationExecuted, false);
  assert.equal(r.effectAuthorized, false);
  assert.equal(r.effectPerformed, false);
  assert.equal(r.effectVerified, false);
};

test('constructor-requires-requirement-source-port', () => assert.throws(() => createExecutionStartRequirementEvidence({}), /requirementSourcePort/));
test('exact-current-execution-start-requirement-resolved', () => assert.equal(resolveWith(baseMaterial).outcome, 'RESOLVED'));
test('lower-bound-revision-resolved', () => { const r = mutateRequest('interactionRevision', 4); assert.equal(createExecutionStartRequirementEvidence({ requirementSourcePort:()=>baseMaterial }).resolve(r).outcome, 'RESOLVED'); });
test('upper-bound-revision-resolved', () => { const r = mutateRequest('interactionRevision', 8); assert.equal(createExecutionStartRequirementEvidence({ requirementSourcePort:()=>baseMaterial }).resolve(r).outcome, 'RESOLVED'); });
test('open-ended-range-resolved', () => { const m = mutateMaterial('throughInteractionRevision', null); const r = mutateRequest('interactionRevision', 99); assert.equal(createExecutionStartRequirementEvidence({ requirementSourcePort:()=>m }).resolve(r).outcome, 'RESOLVED'); });
test('missing-requirement-not-resolved', () => assert.equal(resolveWith(null).outcome, 'NOT_RESOLVED'));
test('wrong-execution-target-not-resolved', () => assert.equal(resolveWith(mutateMaterial('executionTargetRef','other')).outcome, 'NOT_RESOLVED'));
test('wrong-continuation-target-not-resolved', () => assert.equal(resolveWith(mutateMaterial('continuationTargetRef','other')).outcome, 'NOT_RESOLVED'));
test('wrong-interaction-not-resolved', () => assert.equal(resolveWith(mutateMaterial('interactionId','other')).outcome, 'NOT_RESOLVED'));
test('wrong-gate-id-not-resolved', () => assert.equal(resolveWith(mutateMaterial('gateId','other')).outcome, 'NOT_RESOLVED'));
test('wrong-gate-revision-not-resolved', () => assert.equal(resolveWith(mutateMaterial('gateRevision',3)).outcome, 'NOT_RESOLVED'));
test('wrong-scope-digest-not-resolved', () => assert.equal(resolveWith(mutateMaterial('authorityScopeDigest',`sha256:${'b'.repeat(64)}`)).outcome, 'NOT_RESOLVED'));
test('wrong-principal-not-resolved', () => assert.equal(resolveWith(mutateMaterial('requiredPrincipalRef','other')).outcome, 'NOT_RESOLVED'));
test('wrong-principal-revision-not-resolved', () => assert.equal(resolveWith(mutateMaterial('requiredPrincipalRevision','v1')).outcome, 'NOT_RESOLVED'));
test('revision-before-range-not-resolved', () => { const r=mutateRequest('interactionRevision',3); assert.equal(createExecutionStartRequirementEvidence({requirementSourcePort:()=>baseMaterial}).resolve(r).outcome,'NOT_RESOLVED'); });
test('revision-after-range-not-resolved', () => { const r=mutateRequest('interactionRevision',9); assert.equal(createExecutionStartRequirementEvidence({requirementSourcePort:()=>baseMaterial}).resolve(r).outcome,'NOT_RESOLVED'); });
test('stale-lifecycle-is-unknown', () => assert.equal(resolveWith(mutateMaterial('lifecycleState','STALE')).outcome, 'UNKNOWN'));
test('stale-freshness-is-unknown', () => assert.equal(resolveWith(mutateMaterial('freshnessState','STALE')).outcome, 'UNKNOWN'));
test('contradictory-is-unknown', () => assert.equal(resolveWith(mutateMaterial('contradictionState','CONTRADICTORY')).outcome, 'UNKNOWN'));
test('malformed-digest-is-unknown', () => assert.equal(resolveWith(mutateMaterial('authorityScopeDigest','bad')).outcome, 'UNKNOWN'));
test('missing-execution-target-is-unknown', () => assert.equal(resolveWith(mutateMaterial('executionTargetRef','')).outcome, 'UNKNOWN'));
test('missing-continuation-target-is-unknown', () => assert.equal(resolveWith(mutateMaterial('continuationTargetRef','')).outcome, 'UNKNOWN'));
test('missing-principal-is-unknown', () => assert.equal(resolveWith(mutateMaterial('requiredPrincipalRef','')).outcome, 'UNKNOWN'));
test('missing-principal-revision-is-unknown', () => assert.equal(resolveWith(mutateMaterial('requiredPrincipalRevision','')).outcome, 'UNKNOWN'));
test('extra-source-field-is-unknown', () => { const m=clone(baseMaterial); m.extra=true; assert.equal(resolveWith(m).outcome,'UNKNOWN'); });
test('source-failure-is-unknown', () => { const sut=createExecutionStartRequirementEvidence({requirementSourcePort:()=>{throw new Error('x');}}); assert.equal(sut.resolve(request).outcome,'UNKNOWN'); });
test('wrong-ruleset-invalid', () => { const sut=createExecutionStartRequirementEvidence({requirementSourcePort:()=>baseMaterial}); assert.equal(sut.resolve(mutateRequest('rulesetVersion','wrong')).outcome,'INVALID'); });
test('extra-request-field-invalid', () => { const r=clone(request); r.extra=true; const sut=createExecutionStartRequirementEvidence({requirementSourcePort:()=>baseMaterial}); assert.equal(sut.resolve(r).outcome,'INVALID'); });
test('negative-interaction-revision-invalid', () => { const sut=createExecutionStartRequirementEvidence({requirementSourcePort:()=>baseMaterial}); assert.equal(sut.resolve(mutateRequest('interactionRevision',-1)).outcome,'INVALID'); });
test('zero-gate-revision-invalid', () => { const sut=createExecutionStartRequirementEvidence({requirementSourcePort:()=>baseMaterial}); assert.equal(sut.resolve(mutateRequest('gateRevision',0)).outcome,'INVALID'); });
test('deterministic-evidence-identity', () => { const a=resolveWith(baseMaterial).evidence.executionStartRequirementEvidenceRef; const b=resolveWith(baseMaterial).evidence.executionStartRequirementEvidenceRef; assert.equal(a,b); });
test('execution-target-bound-to-evidence', () => assert.equal(resolveWith(baseMaterial).evidence.executionTargetRef, request.executionTargetRef));
test('continuation-target-bound-to-evidence', () => assert.equal(resolveWith(baseMaterial).evidence.continuationTargetRef, request.continuationTargetRef));
test('scope-digest-bound-to-evidence', () => assert.equal(resolveWith(baseMaterial).evidence.authorityScopeDigest, request.authorityScopeDigest));
test('principal-bound-to-evidence', () => assert.equal(resolveWith(baseMaterial).evidence.requiredPrincipalRef, request.expectedPrincipalRef));
test('resolved-evidence-type-is-exact', () => assert.equal(resolveWith(baseMaterial).evidence.type, 'GT63_EXECUTION_START_REQUIREMENT_EVIDENCE'));
test('resolved-evidence-is-current-fresh-noncontradictory', () => { const e=resolveWith(baseMaterial).evidence; assert.equal(e.lifecycleState,'CURRENT'); assert.equal(e.freshnessState,'CURRENT'); assert.equal(e.contradictionState,'NONE'); });
test('resolved-result-has-no-start-or-effect-authority', () => noAuthority(resolveWith(baseMaterial)));
test('resolved-evidence-has-no-start-or-effect-authority', () => { const e=resolveWith(baseMaterial).evidence; assert.equal(e.authority,'NONE'); assert.equal(e.executionStartPermitted,false); assert.equal(e.executionStarted,false); assert.equal(e.continuationExecuted,false); assert.equal(e.effectAuthorized,false); assert.equal(e.effectPerformed,false); assert.equal(e.effectVerified,false); });
test('not-resolved-result-has-no-downstream-authority', () => noAuthority(resolveWith(null)));
test('unknown-result-has-no-downstream-authority', () => noAuthority(resolveWith(mutateMaterial('freshnessState','STALE'))));
test('invalid-result-has-no-downstream-authority', () => { const sut=createExecutionStartRequirementEvidence({requirementSourcePort:()=>baseMaterial}); noAuthority(sut.resolve(mutateRequest('gateRevision',0))); });

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed += 1; console.log(`PASS - ${name}`); }
  catch (error) { console.error(`FAIL - ${name}`); console.error(error && error.stack || error); process.exitCode = 1; }
}
console.log(`${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
