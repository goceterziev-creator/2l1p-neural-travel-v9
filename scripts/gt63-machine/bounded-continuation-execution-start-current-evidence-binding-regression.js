'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION,
  createBoundedContinuationExecutionStartCurrentEvidenceBinding,
  createMemoryLedger
} = require('./bounded-continuation-execution-start-current-evidence-binding');

const DIGEST='sha256:'+'a'.repeat(64);
const INTENT_DIGEST='sha256:'+'b'.repeat(64);
const baseScope={scopeType:'GATE',interactionId:'interaction-1',fromInteractionRevision:7,throughInteractionRevision:7,gateId:'gate-1',gateRevision:2,authorityScopeDigest:DIGEST,continuationTargetRef:'continuation-target-1'};
const currentIntentEvidence={
  currentExecutionIntentEvidenceRef:'gt63-evidence:current-controlled-continuation-execution-intent:abc',
  type:'GT63_CURRENT_CONTROLLED_CONTINUATION_EXECUTION_INTENT_EVIDENCE',schemaVersion:'1.0',rulesetVersion:'current-controlled-continuation-execution-intent-evidence-v0.1.0',
  executionIntentId:'execution-intent-1',executionIntentDigest:INTENT_DIGEST,currentContinuationAuthorizationEvidenceRef:'auth-evidence-1',executionRequirementEvidenceRef:'execution-req-1',continuationAuthorizationId:'authorization-1',authorizationDigest:DIGEST,
  principalRef:'principal-1',principalRevision:'rev-1',executionTargetRef:'execution-target-1',contextScope:baseScope,lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:'NONE',continuationExecutionPermitted:true,executionStartPermitted:false,executionStarted:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false
};
const currentIntentResult={rulesetVersion:'current-controlled-continuation-execution-intent-evidence-v0.1.0',outcome:'RESOLVED',reason:null,evidence:currentIntentEvidence,authority:'NONE',executionStartPermitted:false,executionStarted:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false};
const startRequirementEvidence={
  executionStartRequirementEvidenceRef:'gt63-evidence:execution-start-requirement:def',type:'GT63_EXECUTION_START_REQUIREMENT_EVIDENCE',schemaVersion:'1.0',rulesetVersion:'execution-start-requirement-evidence-v0.1.0',executionTargetRef:'execution-target-1',continuationTargetRef:'continuation-target-1',interactionId:'interaction-1',fromInteractionRevision:7,throughInteractionRevision:7,gateId:'gate-1',gateRevision:2,authorityScopeDigest:DIGEST,requiredPrincipalRef:'principal-1',requiredPrincipalRevision:'rev-1',lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:'NONE',executionStartPermitted:false,executionStarted:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false
};
const startRequirementResult={rulesetVersion:'execution-start-requirement-evidence-v0.1.0',outcome:'RESOLVED',reason:null,evidence:startRequirementEvidence,authority:'NONE',executionStartPermitted:false,executionStarted:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false};
const request={rulesetVersion:RULESET_VERSION,executionIntentId:'execution-intent-1',currentExecutionIntentEvidenceRef:currentIntentEvidence.currentExecutionIntentEvidenceRef,executionStartRequirementEvidenceRef:startRequirementEvidence.executionStartRequirementEvidenceRef,interactionId:'interaction-1',interactionRevision:7,gateId:'gate-1',gateRevision:2,authorityScopeDigest:DIGEST,continuationTargetRef:'continuation-target-1',executionTargetRef:'execution-target-1',expectedPrincipalRef:'principal-1',expectedPrincipalRevision:'rev-1'};

const clone=v=>JSON.parse(JSON.stringify(v));
const tests=[];
const test=(name,fn)=>tests.push([name,fn]);
function make(overrides={}){
  return createBoundedContinuationExecutionStartCurrentEvidenceBinding({
    currentExecutionIntentResultPort: overrides.currentExecutionIntentResultPort || (()=>clone(currentIntentResult)),
    executionStartRequirementResultPort: overrides.executionStartRequirementResultPort || (()=>clone(startRequirementResult)),
    startLedger: overrides.startLedger || createMemoryLedger()
  });
}
function assessReq(mutator){ const r=clone(request); if(mutator) mutator(r); return make().assess(r); }

test('constructor-requires-current-execution-intent-result-port',()=>assert.throws(()=>createBoundedContinuationExecutionStartCurrentEvidenceBinding({executionStartRequirementResultPort:()=>{},startLedger:createMemoryLedger()})));
test('constructor-requires-execution-start-requirement-result-port',()=>assert.throws(()=>createBoundedContinuationExecutionStartCurrentEvidenceBinding({currentExecutionIntentResultPort:()=>{},startLedger:createMemoryLedger()})));
test('constructor-requires-start-ledger',()=>assert.throws(()=>createBoundedContinuationExecutionStartCurrentEvidenceBinding({currentExecutionIntentResultPort:()=>{},executionStartRequirementResultPort:()=>{}})));
test('exact-resolved-current-evidence-is-startable',()=>assert.equal(make().assess(request).outcome,'STARTABLE'));
test('start-record-binds-both-evidence-refs',()=>{const x=make().assess(request).startRecord; assert.equal(x.currentExecutionIntentEvidenceRef,currentIntentEvidence.currentExecutionIntentEvidenceRef); assert.equal(x.executionStartRequirementEvidenceRef,startRequirementEvidence.executionStartRequirementEvidenceRef);});
test('start-record-binds-execution-intent-id',()=>assert.equal(make().assess(request).startRecord.executionIntentId,'execution-intent-1'));
test('start-record-binds-execution-target',()=>assert.equal(make().assess(request).startRecord.executionTargetRef,'execution-target-1'));
test('start-record-binds-exact-current-scope',()=>assert.deepEqual(make().assess(request).startRecord.contextScope,baseScope));
test('deterministic-idempotent-start-record',()=>{const m=make(); const a=m.assess(request); const b=m.assess(request); assert.equal(a.startRecord.executionStartId,b.startRecord.executionStartId); assert.equal(b.outcome,'STARTABLE');});

test('current-intent-not-resolved-is-unknown',()=>{const w=clone(currentIntentResult);w.outcome='NOT_RESOLVED';assert.equal(make({currentExecutionIntentResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});
test('current-intent-wrapper-authority-must-be-none',()=>{const w=clone(currentIntentResult);w.authority='SOME';assert.equal(make({currentExecutionIntentResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});
test('current-intent-evidence-must-be-current',()=>{const w=clone(currentIntentResult);w.evidence.lifecycleState='STALE';assert.equal(make({currentExecutionIntentResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});
test('current-intent-evidence-must-be-fresh',()=>{const w=clone(currentIntentResult);w.evidence.freshnessState='STALE';assert.equal(make({currentExecutionIntentResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});
test('current-intent-evidence-must-be-noncontradictory',()=>{const w=clone(currentIntentResult);w.evidence.contradictionState='CONTRADICTED';assert.equal(make({currentExecutionIntentResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});
test('current-intent-evidence-must-preserve-no-start',()=>{const w=clone(currentIntentResult);w.evidence.executionStarted=true;assert.equal(make({currentExecutionIntentResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});

test('start-requirement-not-resolved-is-unknown',()=>{const w=clone(startRequirementResult);w.outcome='NOT_RESOLVED';assert.equal(make({executionStartRequirementResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});
test('start-requirement-wrapper-authority-must-be-none',()=>{const w=clone(startRequirementResult);w.authority='SOME';assert.equal(make({executionStartRequirementResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});
test('start-requirement-must-be-current',()=>{const w=clone(startRequirementResult);w.evidence.lifecycleState='STALE';assert.equal(make({executionStartRequirementResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});
test('start-requirement-must-be-fresh',()=>{const w=clone(startRequirementResult);w.evidence.freshnessState='STALE';assert.equal(make({executionStartRequirementResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});
test('start-requirement-must-be-noncontradictory',()=>{const w=clone(startRequirementResult);w.evidence.contradictionState='CONTRADICTED';assert.equal(make({executionStartRequirementResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});

test('wrong-current-intent-evidence-ref-is-unknown',()=>{const w=clone(currentIntentResult);w.evidence.currentExecutionIntentEvidenceRef='wrong';assert.equal(make({currentExecutionIntentResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});
test('wrong-start-requirement-evidence-ref-is-unknown',()=>{const w=clone(startRequirementResult);w.evidence.executionStartRequirementEvidenceRef='wrong';assert.equal(make({executionStartRequirementResultPort:()=>w}).assess(request).outcome,'UNKNOWN');});
test('execution-intent-id-mismatch-not-startable',()=>{const w=clone(currentIntentResult);w.evidence.executionIntentId='other';assert.equal(make({currentExecutionIntentResultPort:()=>w}).assess(request).outcome,'NOT_STARTABLE');});
test('request-principal-mismatch-not-startable',()=>assert.equal(assessReq(r=>r.expectedPrincipalRef='other').outcome,'NOT_STARTABLE'));
test('requirement-principal-mismatch-not-startable',()=>{const w=clone(startRequirementResult);w.evidence.requiredPrincipalRef='other';assert.equal(make({executionStartRequirementResultPort:()=>w}).assess(request).outcome,'NOT_STARTABLE');});
test('interaction-mismatch-not-startable',()=>assert.equal(assessReq(r=>r.interactionId='other').outcome,'NOT_STARTABLE'));
test('gate-id-mismatch-not-startable',()=>assert.equal(assessReq(r=>r.gateId='other').outcome,'NOT_STARTABLE'));
test('gate-revision-mismatch-not-startable',()=>assert.equal(assessReq(r=>r.gateRevision=3).outcome,'NOT_STARTABLE'));
test('scope-digest-mismatch-not-startable',()=>assert.equal(assessReq(r=>r.authorityScopeDigest='sha256:'+'c'.repeat(64)).outcome,'NOT_STARTABLE'));
test('continuation-target-mismatch-not-startable',()=>assert.equal(assessReq(r=>r.continuationTargetRef='other').outcome,'NOT_STARTABLE'));
test('execution-target-mismatch-not-startable',()=>assert.equal(assessReq(r=>r.executionTargetRef='other').outcome,'NOT_STARTABLE'));
test('revision-before-current-intent-scope-not-startable',()=>assert.equal(assessReq(r=>r.interactionRevision=6).outcome,'NOT_STARTABLE'));
test('revision-after-start-requirement-range-not-startable',()=>assert.equal(assessReq(r=>r.interactionRevision=8).outcome,'NOT_STARTABLE'));

test('current-intent-port-failure-unknown',()=>assert.equal(make({currentExecutionIntentResultPort:()=>{throw new Error('x')}}).assess(request).outcome,'UNKNOWN'));
test('start-requirement-port-failure-unknown',()=>assert.equal(make({executionStartRequirementResultPort:()=>{throw new Error('x')}}).assess(request).outcome,'UNKNOWN'));
test('ledger-get-failure-unknown',()=>{const l={get(){throw new Error('x')},commit(){}};assert.equal(make({startLedger:l}).assess(request).outcome,'UNKNOWN');});
test('ledger-commit-failure-unknown',()=>{const l={get(){return null},commit(){throw new Error('x')}};assert.equal(make({startLedger:l}).assess(request).outcome,'UNKNOWN');});

test('wrong-ruleset-invalid',()=>assert.equal(assessReq(r=>r.rulesetVersion='wrong').outcome,'INVALID'));
test('extra-request-field-invalid',()=>assert.equal(assessReq(r=>r.extra=true).outcome,'INVALID'));
test('negative-interaction-revision-invalid',()=>assert.equal(assessReq(r=>r.interactionRevision=-1).outcome,'INVALID'));
test('zero-gate-revision-invalid',()=>assert.equal(assessReq(r=>r.gateRevision=0).outcome,'INVALID'));
test('caller-cannot-force-execution-start',()=>assert.equal(assessReq(r=>r.executionStarted=true).outcome,'INVALID'));

test('startable-result-does-not-start-or-perform-effect',()=>{const x=make().assess(request);assert.equal(x.executionStartPermitted,true);assert.equal(x.executionStarted,false);assert.equal(x.continuationExecuted,false);assert.equal(x.effectAuthorized,false);assert.equal(x.effectPerformed,false);assert.equal(x.effectVerified,false);});
test('start-record-does-not-start-or-authorize-effect',()=>{const x=make().assess(request).startRecord;assert.equal(x.executionStartPermitted,true);assert.equal(x.executionStarted,false);assert.equal(x.continuationExecuted,false);assert.equal(x.effectAuthorized,false);assert.equal(x.effectPerformed,false);assert.equal(x.effectVerified,false);assert.equal(x.authority,'NONE');});
test('not-startable-result-has-no-downstream-authority',()=>{const x=assessReq(r=>r.executionTargetRef='other');assert.equal(x.executionStartPermitted,false);assert.equal(x.executionStarted,false);assert.equal(x.continuationExecuted,false);assert.equal(x.effectAuthorized,false);});
test('unknown-result-has-no-downstream-authority',()=>{const x=make({currentExecutionIntentResultPort:()=>{throw new Error('x')}}).assess(request);assert.equal(x.executionStartPermitted,false);assert.equal(x.executionStarted,false);assert.equal(x.continuationExecuted,false);assert.equal(x.effectAuthorized,false);});
test('invalid-result-has-no-downstream-authority',()=>{const x=assessReq(r=>r.rulesetVersion='wrong');assert.equal(x.executionStartPermitted,false);assert.equal(x.executionStarted,false);assert.equal(x.continuationExecuted,false);assert.equal(x.effectAuthorized,false);});

let passed=0;
for(const [name,fn] of tests){
  try{ fn(); passed++; console.log(`PASS - ${name}`); }
  catch(error){ console.error(`FAIL - ${name}`); console.error(error && error.stack || error); process.exitCode=1; }
}
console.log(`${passed}/${tests.length} PASS`);
if(passed!==tests.length) process.exitCode=1;
