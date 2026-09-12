'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION, OUTCOMES,
  createControlledContinuationExecutionCurrentEvidenceBinding,
  createMemoryLedger
} = require('./controlled-continuation-execution-current-evidence-binding');

const sha = c => `sha256:${c.repeat(64)}`;
const principalRef='gt63-machine:human-principal:goce-v0';
const principalRevision='1';
const interactionId='interaction:controlled-exec-current-v0';
const gateId='gate:controlled-exec-current-v0';
const gateRevision=1;
const authorityScopeDigest=sha('a');
const continuationTargetRef='gt63-continuation:target:v0';
const executionTargetRef='gt63-execution:target:v0';
const currentContinuationAuthorizationEvidenceRef='gt63-evidence:current-governed-continuation-authorization:abc';
const executionRequirementEvidenceRef='gt63-evidence:execution-requirement:def';

function currentAuthResult(overrides={}){
  const evidence={
    currentContinuationAuthorizationEvidenceRef,
    type:'GT63_CURRENT_GOVERNED_CONTINUATION_AUTHORIZATION_EVIDENCE',
    schemaVersion:'1.0', rulesetVersion:'current-governed-continuation-authorization-evidence-v0.1.0',
    continuationAuthorizationId:'continuation-authorization:1', authorizationDigest:sha('b'),
    currentSatisfactionEvidenceRef:'gt63-evidence:current-satisfaction:1',
    continuationRequirementEvidenceRef:'gt63-evidence:continuation-requirement:1',
    principalRef, principalRevision,
    contextScope:{ scopeType:'GATE', interactionId, fromInteractionRevision:3, throughInteractionRevision:7, gateId, gateRevision, authorityScopeDigest, continuationTargetRef },
    lifecycleState:'CURRENT', freshnessState:'CURRENT', contradictionState:'NONE', authority:'NONE',
    continuationAuthorized:true, continuationExecuted:false, executionAuthorityCreated:false,
    executionStartPermitted:false, executionStarted:false,
    effectAuthorized:false, effectPerformed:false, effectVerified:false,
    ...(overrides.evidence||{})
  };
  return { rulesetVersion:'current-governed-continuation-authorization-evidence-v0.1.0', outcome:'RESOLVED', reason:null, evidence, authority:'NONE', continuationAuthorized:false, continuationExecuted:false, executionAuthorityCreated:false, executionStartPermitted:false, executionStarted:false, effectAuthorized:false, effectPerformed:false, effectVerified:false, ...(overrides.wrapper||{}) };
}

function requirementResult(overrides={}){
  const evidence={
    executionRequirementEvidenceRef,
    type:'GT63_EXECUTION_REQUIREMENT_EVIDENCE', schemaVersion:'1.0', rulesetVersion:'execution-requirement-evidence-v0.1.0',
    executionTargetRef, continuationTargetRef, interactionId,
    fromInteractionRevision:2, throughInteractionRevision:8,
    gateId, gateRevision, authorityScopeDigest,
    requiredPrincipalRef:principalRef, requiredPrincipalRevision:principalRevision,
    lifecycleState:'CURRENT', freshnessState:'CURRENT', contradictionState:'NONE', authority:'NONE',
    executionPermitted:false, executionStartPermitted:false, continuationExecuted:false, executionStarted:false, effectAuthorized:false, effectPerformed:false,
    ...(overrides.evidence||{})
  };
  return { rulesetVersion:'execution-requirement-evidence-v0.1.0', outcome:'RESOLVED', reason:null, evidence, authority:'NONE', executionPermitted:false, executionStartPermitted:false, continuationExecuted:false, executionStarted:false, effectAuthorized:false, effectPerformed:false, ...(overrides.wrapper||{}) };
}

const request={
  rulesetVersion:RULESET_VERSION,
  currentContinuationAuthorizationEvidenceRef,
  executionRequirementEvidenceRef,
  interactionId, interactionRevision:5, gateId, gateRevision,
  authorityScopeDigest, continuationTargetRef, executionTargetRef,
  expectedPrincipalRef:principalRef, expectedPrincipalRevision:principalRevision
};

function system(auth=currentAuthResult(), req=requirementResult(), ledger=createMemoryLedger()){
  return createControlledContinuationExecutionCurrentEvidenceBinding({
    currentAuthorizationResultPort:()=>auth,
    executionRequirementResultPort:()=>req,
    executionLedger:ledger
  });
}

const tests=[];
const test=(name,fn)=>tests.push([name,fn]);
const outcome=(name,sys,req,expected)=>test(name,()=>assert.equal(sys.assess(req).outcome,expected));

// Constructor / happy path / binding
test('constructor-requires-current-authorization-result-port',()=>assert.throws(()=>createControlledContinuationExecutionCurrentEvidenceBinding({ executionRequirementResultPort:()=>requirementResult(), executionLedger:createMemoryLedger() }),/currentAuthorizationResultPort/));
test('constructor-requires-execution-requirement-result-port',()=>assert.throws(()=>createControlledContinuationExecutionCurrentEvidenceBinding({ currentAuthorizationResultPort:()=>currentAuthResult(), executionLedger:createMemoryLedger() }),/executionRequirementResultPort/));
test('constructor-requires-execution-ledger',()=>assert.throws(()=>createControlledContinuationExecutionCurrentEvidenceBinding({ currentAuthorizationResultPort:()=>currentAuthResult(), executionRequirementResultPort:()=>requirementResult() }),/executionLedger/));
test('exact-resolved-current-evidence-is-executable',()=>assert.equal(system().assess(request).outcome,OUTCOMES.EXECUTABLE));
test('execution-intent-binds-both-evidence-refs',()=>{ const x=system().assess(request).executionIntent; assert.equal(x.currentContinuationAuthorizationEvidenceRef,currentContinuationAuthorizationEvidenceRef); assert.equal(x.executionRequirementEvidenceRef,executionRequirementEvidenceRef); });
test('execution-intent-binds-authorization-id-and-digest',()=>{ const x=system().assess(request).executionIntent; assert.equal(x.continuationAuthorizationId,'continuation-authorization:1'); assert.equal(x.authorizationDigest,sha('b')); });
test('execution-intent-binds-execution-target',()=>assert.equal(system().assess(request).executionIntent.executionTargetRef,executionTargetRef));
test('execution-intent-binds-exact-current-scope',()=>{ const s=system().assess(request).executionIntent.contextScope; assert.equal(s.fromInteractionRevision,5); assert.equal(s.throughInteractionRevision,5); assert.equal(s.continuationTargetRef,continuationTargetRef); });
test('deterministic-idempotent-execution-intent',()=>{ const ledger=createMemoryLedger(); const s=system(currentAuthResult(),requirementResult(),ledger); const a=s.assess(request); const b=s.assess(request); assert.equal(a.outcome,OUTCOMES.EXECUTABLE); assert.equal(b.outcome,OUTCOMES.EXECUTABLE); assert.equal(a.executionIntent.executionIntentId,b.executionIntent.executionIntentId); });

// Upstream wrapper integrity -> UNKNOWN
outcome('current-authorization-not-resolved-is-unknown',system(currentAuthResult({wrapper:{outcome:'NOT_RESOLVED'}})),request,OUTCOMES.UNKNOWN);
outcome('current-authorization-wrapper-authority-must-be-none',system(currentAuthResult({wrapper:{authority:'OTHER'}})),request,OUTCOMES.UNKNOWN);
outcome('current-authorization-evidence-must-be-current',system(currentAuthResult({evidence:{lifecycleState:'STALE'}})),request,OUTCOMES.UNKNOWN);
outcome('current-authorization-evidence-must-be-fresh',system(currentAuthResult({evidence:{freshnessState:'STALE'}})),request,OUTCOMES.UNKNOWN);
outcome('current-authorization-evidence-must-be-noncontradictory',system(currentAuthResult({evidence:{contradictionState:'PRESENT'}})),request,OUTCOMES.UNKNOWN);
outcome('current-authorization-evidence-must-preserve-no-start',system(currentAuthResult({evidence:{executionStarted:true}})),request,OUTCOMES.UNKNOWN);
outcome('execution-requirement-not-resolved-is-unknown',system(currentAuthResult(),requirementResult({wrapper:{outcome:'NOT_RESOLVED'}})),request,OUTCOMES.UNKNOWN);
outcome('execution-requirement-wrapper-authority-must-be-none',system(currentAuthResult(),requirementResult({wrapper:{authority:'OTHER'}})),request,OUTCOMES.UNKNOWN);
outcome('execution-requirement-must-be-current',system(currentAuthResult(),requirementResult({evidence:{lifecycleState:'STALE'}})),request,OUTCOMES.UNKNOWN);
outcome('execution-requirement-must-be-fresh',system(currentAuthResult(),requirementResult({evidence:{freshnessState:'STALE'}})),request,OUTCOMES.UNKNOWN);
outcome('execution-requirement-must-be-noncontradictory',system(currentAuthResult(),requirementResult({evidence:{contradictionState:'PRESENT'}})),request,OUTCOMES.UNKNOWN);
outcome('wrong-current-authorization-evidence-ref-is-unknown',system(currentAuthResult({evidence:{currentContinuationAuthorizationEvidenceRef:'other'}})),request,OUTCOMES.UNKNOWN);
outcome('wrong-execution-requirement-evidence-ref-is-unknown',system(currentAuthResult(),requirementResult({evidence:{executionRequirementEvidenceRef:'other'}})),request,OUTCOMES.UNKNOWN);

// Valid upstream evidence + request mismatch -> NOT_EXECUTABLE
outcome('request-principal-mismatch-not-executable',system(),{...request,expectedPrincipalRef:'gt63-machine:human-principal:other'},OUTCOMES.NOT_EXECUTABLE);
outcome('requirement-principal-mismatch-not-executable',system(currentAuthResult(),requirementResult({evidence:{requiredPrincipalRef:'gt63-machine:human-principal:other'}})),request,OUTCOMES.NOT_EXECUTABLE);
outcome('interaction-mismatch-not-executable',system(),{...request,interactionId:'interaction:other'},OUTCOMES.NOT_EXECUTABLE);
outcome('gate-id-mismatch-not-executable',system(),{...request,gateId:'gate:other'},OUTCOMES.NOT_EXECUTABLE);
outcome('gate-revision-mismatch-not-executable',system(),{...request,gateRevision:2},OUTCOMES.NOT_EXECUTABLE);
outcome('scope-digest-mismatch-not-executable',system(),{...request,authorityScopeDigest:sha('c')},OUTCOMES.NOT_EXECUTABLE);
outcome('continuation-target-mismatch-not-executable',system(),{...request,continuationTargetRef:'gt63-continuation:other'},OUTCOMES.NOT_EXECUTABLE);
outcome('execution-target-mismatch-not-executable',system(),{...request,executionTargetRef:'gt63-execution:other'},OUTCOMES.NOT_EXECUTABLE);
outcome('revision-before-authorization-scope-not-executable',system(),{...request,interactionRevision:1},OUTCOMES.NOT_EXECUTABLE);
outcome('revision-after-requirement-range-not-executable',system(),{...request,interactionRevision:9},OUTCOMES.NOT_EXECUTABLE);

// Port / ledger failures
outcome('current-authorization-port-failure-unknown',createControlledContinuationExecutionCurrentEvidenceBinding({ currentAuthorizationResultPort:()=>{throw new Error('x');}, executionRequirementResultPort:()=>requirementResult(), executionLedger:createMemoryLedger() }),request,OUTCOMES.UNKNOWN);
outcome('execution-requirement-port-failure-unknown',createControlledContinuationExecutionCurrentEvidenceBinding({ currentAuthorizationResultPort:()=>currentAuthResult(), executionRequirementResultPort:()=>{throw new Error('x');}, executionLedger:createMemoryLedger() }),request,OUTCOMES.UNKNOWN);
outcome('ledger-get-failure-unknown',createControlledContinuationExecutionCurrentEvidenceBinding({ currentAuthorizationResultPort:()=>currentAuthResult(), executionRequirementResultPort:()=>requirementResult(), executionLedger:{get(){throw new Error('x');},commit(){}} }),request,OUTCOMES.UNKNOWN);
outcome('ledger-commit-failure-unknown',createControlledContinuationExecutionCurrentEvidenceBinding({ currentAuthorizationResultPort:()=>currentAuthResult(), executionRequirementResultPort:()=>requirementResult(), executionLedger:{get(){return null;},commit(){throw new Error('x');}} }),request,OUTCOMES.UNKNOWN);

// Request schema / authority boundaries
outcome('wrong-ruleset-invalid',system(),{...request,rulesetVersion:'wrong'},OUTCOMES.INVALID);
outcome('extra-request-field-invalid',system(),{...request,extra:true},OUTCOMES.INVALID);
outcome('negative-interaction-revision-invalid',system(),{...request,interactionRevision:-1},OUTCOMES.INVALID);
outcome('zero-gate-revision-invalid',system(),{...request,gateRevision:0},OUTCOMES.INVALID);
test('caller-cannot-force-execution-start',()=>assert.equal(system().assess({...request,executionStarted:true}).outcome,OUTCOMES.INVALID));
test('executable-result-does-not-start-or-perform-effect',()=>{ const x=system().assess(request); assert.equal(x.continuationExecutionPermitted,true); assert.equal(x.continuationExecuted,false); assert.equal(x.executionStarted,false); assert.equal(x.effectAuthorized,false); assert.equal(x.effectPerformed,false); assert.equal(x.effectVerified,false); assert.equal(x.authority,'NONE'); });
test('execution-intent-does-not-start-or-authorize-effect',()=>{ const x=system().assess(request).executionIntent; assert.equal(x.continuationExecutionPermitted,true); assert.equal(x.continuationExecuted,false); assert.equal(x.executionStarted,false); assert.equal(x.effectAuthorized,false); assert.equal(x.effectPerformed,false); assert.equal(x.effectVerified,false); assert.equal(x.authority,'NONE'); });
test('not-executable-result-has-no-downstream-authority',()=>{ const x=system().assess({...request,executionTargetRef:'other'}); assert.equal(x.outcome,OUTCOMES.NOT_EXECUTABLE); assert.equal(x.continuationExecutionPermitted,false); assert.equal(x.executionStarted,false); assert.equal(x.effectAuthorized,false); });
test('unknown-result-has-no-downstream-authority',()=>{ const x=system(currentAuthResult({wrapper:{outcome:'UNKNOWN'}})).assess(request); assert.equal(x.outcome,OUTCOMES.UNKNOWN); assert.equal(x.continuationExecutionPermitted,false); assert.equal(x.executionStarted,false); assert.equal(x.effectAuthorized,false); });
test('invalid-result-has-no-downstream-authority',()=>{ const x=system().assess({...request,rulesetVersion:'bad'}); assert.equal(x.outcome,OUTCOMES.INVALID); assert.equal(x.continuationExecutionPermitted,false); assert.equal(x.executionStarted,false); assert.equal(x.effectAuthorized,false); });

let passed=0;
for(const [name,fn] of tests){
  try{ fn(); passed++; console.log(`PASS - ${name}`); }
  catch(err){ console.error(`FAIL - ${name}`); console.error(err && err.stack || err); }
}
console.log(`${passed}/${tests.length} PASS`);
if(passed!==tests.length) process.exitCode=1;
