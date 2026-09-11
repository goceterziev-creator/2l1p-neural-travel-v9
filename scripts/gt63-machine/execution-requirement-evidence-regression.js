'use strict';
const assert = require('node:assert/strict');
const { RULESET_VERSION, createExecutionRequirementEvidence } = require('./execution-requirement-evidence');

let pass=0, fail=0;
const test=(name,fn)=>{try{fn();console.log(`PASS - ${name}`);pass++;}catch(e){console.log(`FAIL - ${name}`);console.log(e.stack||e);fail++;}};

const D='sha256:'+'a'.repeat(64);
const P='gt63-machine:human-principal:goce-v0';
const PR='1';
const base={
  executionTargetRef:'execution:minimal-v0',
  continuationTargetRef:'operation:minimal-v0',
  interactionId:'i1',
  fromInteractionRevision:3,
  throughInteractionRevision:9,
  gateId:'g1',
  gateRevision:1,
  authorityScopeDigest:D,
  requiredPrincipalRef:P,
  requiredPrincipalRevision:PR,
  lifecycleState:'CURRENT',
  freshnessState:'CURRENT',
  contradictionState:'NONE'
};
const req={
  rulesetVersion:RULESET_VERSION,
  executionTargetRef:base.executionTargetRef,
  continuationTargetRef:base.continuationTargetRef,
  interactionId:'i1',
  interactionRevision:5,
  gateId:'g1',
  gateRevision:1,
  authorityScopeDigest:D,
  expectedPrincipalRef:P,
  expectedPrincipalRevision:PR
};
const make=(material=base)=>createExecutionRequirementEvidence({requirementSourcePort:()=>material});

test('constructor-requires-requirement-source-port',()=>assert.throws(()=>createExecutionRequirementEvidence()));
test('exact-current-execution-requirement-resolved',()=>{const x=make().resolve(req);assert.equal(x.outcome,'RESOLVED');assert.equal(x.evidence.type,'GT63_EXECUTION_REQUIREMENT_EVIDENCE');assert.equal(x.evidence.executionTargetRef,base.executionTargetRef);});
test('lower-bound-revision-resolved',()=>assert.equal(make().resolve({...req,interactionRevision:3}).outcome,'RESOLVED'));
test('upper-bound-revision-resolved',()=>assert.equal(make().resolve({...req,interactionRevision:9}).outcome,'RESOLVED'));
test('open-ended-range-resolved',()=>assert.equal(make({...base,throughInteractionRevision:null}).resolve({...req,interactionRevision:999}).outcome,'RESOLVED'));
test('missing-requirement-not-resolved',()=>assert.equal(createExecutionRequirementEvidence({requirementSourcePort:()=>null}).resolve(req).outcome,'NOT_RESOLVED'));
test('wrong-execution-target-not-resolved',()=>assert.equal(make({...base,executionTargetRef:'other'}).resolve(req).outcome,'NOT_RESOLVED'));
test('wrong-continuation-target-not-resolved',()=>assert.equal(make({...base,continuationTargetRef:'other'}).resolve(req).outcome,'NOT_RESOLVED'));
test('wrong-interaction-not-resolved',()=>assert.equal(make({...base,interactionId:'other'}).resolve(req).outcome,'NOT_RESOLVED'));
test('wrong-gate-id-not-resolved',()=>assert.equal(make({...base,gateId:'other'}).resolve(req).outcome,'NOT_RESOLVED'));
test('wrong-gate-revision-not-resolved',()=>assert.equal(make({...base,gateRevision:2}).resolve(req).outcome,'NOT_RESOLVED'));
test('wrong-scope-digest-not-resolved',()=>assert.equal(make({...base,authorityScopeDigest:'sha256:'+'b'.repeat(64)}).resolve(req).outcome,'NOT_RESOLVED'));
test('wrong-principal-not-resolved',()=>assert.equal(make({...base,requiredPrincipalRef:'other'}).resolve(req).outcome,'NOT_RESOLVED'));
test('wrong-principal-revision-not-resolved',()=>assert.equal(make({...base,requiredPrincipalRevision:'2'}).resolve(req).outcome,'NOT_RESOLVED'));
test('revision-before-range-not-resolved',()=>assert.equal(make().resolve({...req,interactionRevision:2}).outcome,'NOT_RESOLVED'));
test('revision-after-range-not-resolved',()=>assert.equal(make().resolve({...req,interactionRevision:10}).outcome,'NOT_RESOLVED'));
test('stale-lifecycle-is-unknown',()=>assert.equal(make({...base,lifecycleState:'STALE'}).resolve(req).outcome,'UNKNOWN'));
test('stale-freshness-is-unknown',()=>assert.equal(make({...base,freshnessState:'STALE'}).resolve(req).outcome,'UNKNOWN'));
test('contradictory-is-unknown',()=>assert.equal(make({...base,contradictionState:'CONTRADICTED'}).resolve(req).outcome,'UNKNOWN'));
test('malformed-digest-is-unknown',()=>assert.equal(make({...base,authorityScopeDigest:'x'}).resolve(req).outcome,'UNKNOWN'));
test('missing-execution-target-is-unknown',()=>{const x={...base};delete x.executionTargetRef;assert.equal(make(x).resolve(req).outcome,'UNKNOWN');});
test('missing-continuation-target-is-unknown',()=>{const x={...base};delete x.continuationTargetRef;assert.equal(make(x).resolve(req).outcome,'UNKNOWN');});
test('missing-principal-is-unknown',()=>{const x={...base};delete x.requiredPrincipalRef;assert.equal(make(x).resolve(req).outcome,'UNKNOWN');});
test('missing-principal-revision-is-unknown',()=>{const x={...base};delete x.requiredPrincipalRevision;assert.equal(make(x).resolve(req).outcome,'UNKNOWN');});
test('extra-source-field-is-unknown',()=>assert.equal(make({...base,force:true}).resolve(req).outcome,'UNKNOWN'));
test('source-failure-is-unknown',()=>assert.equal(createExecutionRequirementEvidence({requirementSourcePort:()=>{throw Error('x');}}).resolve(req).outcome,'UNKNOWN'));
test('wrong-ruleset-invalid',()=>assert.equal(make().resolve({...req,rulesetVersion:'x'}).outcome,'INVALID'));
test('extra-request-field-invalid',()=>assert.equal(make().resolve({...req,force:true}).outcome,'INVALID'));
test('negative-interaction-revision-invalid',()=>assert.equal(make().resolve({...req,interactionRevision:-1}).outcome,'INVALID'));
test('zero-gate-revision-invalid',()=>assert.equal(make().resolve({...req,gateRevision:0}).outcome,'INVALID'));
test('deterministic-evidence-identity',()=>{const a=make().resolve(req),b=make().resolve(req);assert.equal(a.evidence.executionRequirementEvidenceRef,b.evidence.executionRequirementEvidenceRef);});
test('execution-target-bound-to-evidence',()=>{const x=make().resolve(req);assert.equal(x.evidence.executionTargetRef,base.executionTargetRef);});
test('continuation-target-bound-to-evidence',()=>{const x=make().resolve(req);assert.equal(x.evidence.continuationTargetRef,base.continuationTargetRef);});
test('scope-digest-bound-to-evidence',()=>{const x=make().resolve(req);assert.equal(x.evidence.authorityScopeDigest,D);});
test('principal-bound-to-evidence',()=>{const x=make().resolve(req);assert.equal(x.evidence.requiredPrincipalRef,P);assert.equal(x.evidence.requiredPrincipalRevision,PR);});
test('resolved-result-has-no-execution-or-effect-authority',()=>{const x=make().resolve(req);assert.equal(x.executionPermitted,false);assert.equal(x.executionStartPermitted,false);assert.equal(x.continuationExecuted,false);assert.equal(x.executionStarted,false);assert.equal(x.effectAuthorized,false);assert.equal(x.effectPerformed,false);assert.equal(x.authority,'NONE');});
test('resolved-evidence-has-no-execution-or-effect-authority',()=>{const x=make().resolve(req).evidence;assert.equal(x.executionPermitted,false);assert.equal(x.executionStartPermitted,false);assert.equal(x.continuationExecuted,false);assert.equal(x.executionStarted,false);assert.equal(x.effectAuthorized,false);assert.equal(x.effectPerformed,false);assert.equal(x.authority,'NONE');});
test('not-resolved-result-has-no-downstream-authority',()=>{const x=make({...base,executionTargetRef:'other'}).resolve(req);assert.equal(x.executionPermitted,false);assert.equal(x.executionStartPermitted,false);assert.equal(x.effectPerformed,false);});
test('unknown-result-has-no-downstream-authority',()=>{const x=make({...base,lifecycleState:'STALE'}).resolve(req);assert.equal(x.executionPermitted,false);assert.equal(x.executionStartPermitted,false);assert.equal(x.effectPerformed,false);});
test('invalid-result-has-no-downstream-authority',()=>{const x=make().resolve({...req,rulesetVersion:'x'});assert.equal(x.executionPermitted,false);assert.equal(x.executionStartPermitted,false);assert.equal(x.effectPerformed,false);});

console.log(`${pass}/${pass+fail} PASS`);
if(fail) process.exitCode=1;
