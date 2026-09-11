'use strict';

const assert = require('node:assert/strict');
const { RULESET_VERSION, OUTCOMES, createGateRequirementEvidence } = require('./gate-requirement-evidence');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

const base = Object.freeze({
  gateId:'gate:minimal', gateRevision:1, interactionId:'interaction:1',
  fromInteractionRevision:3, throughInteractionRevision:5,
  authorityScopeDigest:`sha256:${'a'.repeat(64)}`,
  continuationTargetRef:'op:minimal-v0',
  requiredPrincipalRef:'gt63-machine:human-principal:goce-v0',
  requiredPrincipalRevision:'1',
  lifecycleState:'CURRENT', temporalState:'CURRENT', contradictionState:'NONE'
});
const request = Object.freeze({ rulesetVersion:RULESET_VERSION, gateId:base.gateId, gateRevision:1, interactionId:base.interactionId, interactionRevision:4 });
const make = source => createGateRequirementEvidence({ requirementSourcePort: source || (() => ({...base})) });
function noDownstream(r){
  assert.equal(r.authority,'NONE');
  assert.equal(r.humanGateSatisfied,false);
  assert.equal(r.continuationAuthorized,false);
  assert.equal(r.continuationExecuted,false);
  assert.equal(r.executionAuthorityCreated,false);
  assert.equal(r.effectAuthorized,false);
  assert.equal(r.effectPerformed,false);
}

test('constructor-requires-requirement-source-port',()=>assert.throws(()=>createGateRequirementEvidence()));
test('exact-current-gate-requirement-resolved',()=>{const r=make().resolve(request);assert.equal(r.outcome,OUTCOMES.RESOLVED);assert.equal(r.evidence.type,'GT63_GATE_REQUIREMENT_EVIDENCE');assert.equal(r.evidence.gateId,base.gateId);assert.equal(r.evidence.gateRequirementEvidenceRef.startsWith('gt63-evidence:gate-requirement:'),true);noDownstream(r);});
test('lower-bound-revision-resolved',()=>assert.equal(make().resolve({...request,interactionRevision:3}).outcome,OUTCOMES.RESOLVED));
test('upper-bound-revision-resolved',()=>assert.equal(make().resolve({...request,interactionRevision:5}).outcome,OUTCOMES.RESOLVED));
test('open-ended-range-resolved',()=>assert.equal(make(()=>({...base,throughInteractionRevision:null})).resolve({...request,interactionRevision:99}).outcome,OUTCOMES.RESOLVED));
test('missing-requirement-not-resolved',()=>assert.equal(make(()=>null).resolve(request).outcome,OUTCOMES.NOT_RESOLVED));
test('wrong-gate-id-not-resolved',()=>assert.equal(make(()=>({...base,gateId:'other'})).resolve(request).outcome,OUTCOMES.NOT_RESOLVED));
test('wrong-gate-revision-not-resolved',()=>assert.equal(make(()=>({...base,gateRevision:2})).resolve(request).outcome,OUTCOMES.NOT_RESOLVED));
test('wrong-interaction-id-not-resolved',()=>assert.equal(make(()=>({...base,interactionId:'other'})).resolve(request).outcome,OUTCOMES.NOT_RESOLVED));
test('revision-before-range-not-resolved',()=>assert.equal(make().resolve({...request,interactionRevision:2}).outcome,OUTCOMES.NOT_RESOLVED));
test('revision-after-range-not-resolved',()=>assert.equal(make().resolve({...request,interactionRevision:6}).outcome,OUTCOMES.NOT_RESOLVED));
test('stale-lifecycle-is-unknown',()=>assert.equal(make(()=>({...base,lifecycleState:'STALE'})).resolve(request).outcome,OUTCOMES.UNKNOWN));
test('stale-temporal-is-unknown',()=>assert.equal(make(()=>({...base,temporalState:'STALE'})).resolve(request).outcome,OUTCOMES.UNKNOWN));
test('contradictory-is-unknown',()=>assert.equal(make(()=>({...base,contradictionState:'PRESENT'})).resolve(request).outcome,OUTCOMES.UNKNOWN));
test('bad-digest-is-unknown',()=>assert.equal(make(()=>({...base,authorityScopeDigest:'bad'})).resolve(request).outcome,OUTCOMES.UNKNOWN));
test('missing-continuation-target-is-unknown',()=>assert.equal(make(()=>({...base,continuationTargetRef:''})).resolve(request).outcome,OUTCOMES.UNKNOWN));
test('missing-required-principal-is-unknown',()=>assert.equal(make(()=>({...base,requiredPrincipalRef:''})).resolve(request).outcome,OUTCOMES.UNKNOWN));
test('missing-required-principal-revision-is-unknown',()=>assert.equal(make(()=>({...base,requiredPrincipalRevision:''})).resolve(request).outcome,OUTCOMES.UNKNOWN));
test('extra-source-field-is-unknown',()=>assert.equal(make(()=>({...base,authorization:true})).resolve(request).outcome,OUTCOMES.UNKNOWN));
test('source-failure-is-unknown',()=>assert.equal(make(()=>{throw Error('x');}).resolve(request).outcome,OUTCOMES.UNKNOWN));
test('wrong-ruleset-invalid',()=>assert.equal(make().resolve({...request,rulesetVersion:'wrong'}).outcome,OUTCOMES.INVALID));
test('extra-request-field-invalid',()=>assert.equal(make().resolve({...request,force:true}).outcome,OUTCOMES.INVALID));
test('negative-interaction-revision-invalid',()=>assert.equal(make().resolve({...request,interactionRevision:-1}).outcome,OUTCOMES.INVALID));
test('zero-gate-revision-invalid',()=>assert.equal(make().resolve({...request,gateRevision:0}).outcome,OUTCOMES.INVALID));
test('deterministic-evidence-identity',()=>{const a=make().resolve(request),b=make().resolve(request);assert.equal(a.evidence.gateRequirementEvidenceRef,b.evidence.gateRequirementEvidenceRef);assert.deepEqual(a,b);});
test('authority-scope-digest-bound-to-evidence',()=>{const a=make().resolve(request),b=make(()=>({...base,authorityScopeDigest:`sha256:${'b'.repeat(64)}`})).resolve(request);assert.notEqual(a.evidence.gateRequirementEvidenceRef,b.evidence.gateRequirementEvidenceRef);});
test('continuation-target-bound-to-evidence',()=>{const a=make().resolve(request),b=make(()=>({...base,continuationTargetRef:'op:other'})).resolve(request);assert.notEqual(a.evidence.gateRequirementEvidenceRef,b.evidence.gateRequirementEvidenceRef);});
test('principal-bound-to-evidence',()=>{const a=make().resolve(request),b=make(()=>({...base,requiredPrincipalRef:'other'})).resolve(request);assert.notEqual(a.evidence.gateRequirementEvidenceRef,b.evidence.gateRequirementEvidenceRef);});
test('resolved-result-no-downstream-authority',()=>noDownstream(make().resolve(request)));
test('not-resolved-result-no-downstream-authority',()=>noDownstream(make(()=>null).resolve(request)));
test('unknown-result-no-downstream-authority',()=>noDownstream(make(()=>{throw Error('x');}).resolve(request)));
test('invalid-result-no-downstream-authority',()=>noDownstream(make().resolve({...request,rulesetVersion:'wrong'})));

let passed=0;
for(const [name,fn] of tests){
  try{fn();passed++;console.log(`PASS - ${name}`);}catch(e){console.error(`FAIL - ${name}`);console.error(e&&e.stack||e);process.exitCode=1;}
}
console.log(`${passed}/${tests.length} PASS`);
if(passed!==tests.length) process.exitCode=1;
