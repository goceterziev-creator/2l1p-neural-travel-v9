'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION,
  OUTCOMES,
  createCurrentControlledContinuationExecutionIntentEvidence
} = require('./current-controlled-continuation-execution-intent-evidence');

const sha = char => `sha256:${char.repeat(64)}`;
const scope = Object.freeze({
  scopeType:'GATE',
  interactionId:'interaction-1',
  fromInteractionRevision:7,
  throughInteractionRevision:7,
  gateId:'gate-1',
  gateRevision:2,
  authorityScopeDigest:sha('a'),
  continuationTargetRef:'continuation-target-1'
});

const baseIntent = Object.freeze({
  executionIntentId:'continuation-execution-intent:abc',
  type:'GT63_CONTROLLED_CONTINUATION_EXECUTION_INTENT',
  schemaVersion:'1.0',
  rulesetVersion:'controlled-continuation-execution-current-evidence-binding-v0.1.0',
  currentContinuationAuthorizationEvidenceRef:'gt63-evidence:current-auth:1',
  executionRequirementEvidenceRef:'gt63-evidence:execution-requirement:1',
  continuationAuthorizationId:'continuation-auth-1',
  authorizationDigest:sha('b'),
  principalRef:'gt63-machine:human-principal:goce-v0',
  principalRevision:'v0',
  executionTargetRef:'execution-target-1',
  contextScope:scope,
  executionState:'PERMITTED',
  authority:'NONE',
  continuationExecutionPermitted:true,
  continuationExecuted:false,
  executionStarted:false,
  effectAuthorized:false,
  effectPerformed:false,
  effectVerified:false
});

const request = Object.freeze({
  rulesetVersion:RULESET_VERSION,
  executionIntentId:baseIntent.executionIntentId,
  currentContinuationAuthorizationEvidenceRef:baseIntent.currentContinuationAuthorizationEvidenceRef,
  executionRequirementEvidenceRef:baseIntent.executionRequirementEvidenceRef,
  expectedPrincipalRef:baseIntent.principalRef,
  expectedPrincipalRevision:baseIntent.principalRevision,
  interactionId:scope.interactionId,
  interactionRevision:7,
  gateId:scope.gateId,
  gateRevision:scope.gateRevision,
  authorityScopeDigest:scope.authorityScopeDigest,
  continuationTargetRef:scope.continuationTargetRef,
  executionTargetRef:baseIntent.executionTargetRef
});

function stateFor(id,digest){
  return { executionIntentId:id, executionIntentDigest:digest, lifecycleState:'CURRENT', freshnessState:'CURRENT', contradictionState:'NONE', authority:'NONE' };
}

function makeSystem(intent=baseIntent, stateMutator=x=>x){
  return createCurrentControlledContinuationExecutionIntentEvidence({
    executionIntentPort: ({executionIntentId}) => executionIntentId === intent.executionIntentId ? intent : null,
    executionIntentStatePort: ({executionIntentId,executionIntentDigest}) => stateMutator(stateFor(executionIntentId,executionIntentDigest))
  });
}

const tests=[];
const t=(name,fn)=>tests.push([name,fn]);
const withIntent = patch => Object.freeze({ ...baseIntent, ...patch });
const withScope = patch => Object.freeze({ ...scope, ...patch });

// constructor / happy path
t('constructor-requires-execution-intent-port',()=>assert.throws(()=>createCurrentControlledContinuationExecutionIntentEvidence({executionIntentStatePort:()=>{}}),TypeError));
t('constructor-requires-state-port',()=>assert.throws(()=>createCurrentControlledContinuationExecutionIntentEvidence({executionIntentPort:()=>{}}),TypeError));
t('exact-current-execution-intent-resolved',()=>assert.equal(makeSystem().assess(request).outcome,OUTCOMES.RESOLVED));
t('evidence-binds-exact-intent-digest',()=>assert.match(makeSystem().assess(request).evidence.executionIntentDigest,/^sha256:[0-9a-f]{64}$/));
t('evidence-binds-both-upstream-evidence-refs',()=>{const e=makeSystem().assess(request).evidence; assert.equal(e.currentContinuationAuthorizationEvidenceRef,baseIntent.currentContinuationAuthorizationEvidenceRef); assert.equal(e.executionRequirementEvidenceRef,baseIntent.executionRequirementEvidenceRef);});
t('evidence-binds-execution-target',()=>assert.equal(makeSystem().assess(request).evidence.executionTargetRef,baseIntent.executionTargetRef));
t('evidence-binds-exact-scope',()=>assert.deepEqual(makeSystem().assess(request).evidence.contextScope,scope));
t('deterministic-evidence-identity',()=>assert.equal(makeSystem().assess(request).evidence.currentExecutionIntentEvidenceRef,makeSystem().assess(request).evidence.currentExecutionIntentEvidenceRef));

// missing/invalid intent
t('missing-intent-not-resolved',()=>{const s=createCurrentControlledContinuationExecutionIntentEvidence({executionIntentPort:()=>null,executionIntentStatePort:()=>null}); assert.equal(s.assess(request).outcome,OUTCOMES.NOT_RESOLVED);});
t('intent-port-failure-unknown',()=>{const s=createCurrentControlledContinuationExecutionIntentEvidence({executionIntentPort:()=>{throw new Error('x')},executionIntentStatePort:()=>null}); assert.equal(s.assess(request).outcome,OUTCOMES.UNKNOWN);});
t('wrong-intent-id-not-resolved',()=>{const i=withIntent({executionIntentId:'other'}); const s=createCurrentControlledContinuationExecutionIntentEvidence({executionIntentPort:()=>i,executionIntentStatePort:()=>null}); assert.equal(s.assess(request).outcome,OUTCOMES.NOT_RESOLVED);});
t('intent-must-be-permitted',()=>assert.equal(makeSystem(withIntent({executionState:'DENIED'})).assess(request).outcome,OUTCOMES.UNKNOWN));
t('intent-authority-must-be-none',()=>assert.equal(makeSystem(withIntent({authority:'EXECUTE'})).assess(request).outcome,OUTCOMES.UNKNOWN));
t('intent-cannot-be-executed',()=>assert.equal(makeSystem(withIntent({continuationExecuted:true})).assess(request).outcome,OUTCOMES.UNKNOWN));
t('intent-cannot-be-started',()=>assert.equal(makeSystem(withIntent({executionStarted:true})).assess(request).outcome,OUTCOMES.UNKNOWN));
t('intent-cannot-have-effect-authorized',()=>assert.equal(makeSystem(withIntent({effectAuthorized:true})).assess(request).outcome,OUTCOMES.UNKNOWN));
t('intent-cannot-have-effect-performed',()=>assert.equal(makeSystem(withIntent({effectPerformed:true})).assess(request).outcome,OUTCOMES.UNKNOWN));
t('intent-cannot-have-effect-verified',()=>assert.equal(makeSystem(withIntent({effectVerified:true})).assess(request).outcome,OUTCOMES.UNKNOWN));

// exact request matching
t('wrong-current-authorization-ref-not-resolved',()=>assert.equal(makeSystem().assess({...request,currentContinuationAuthorizationEvidenceRef:'wrong'}).outcome,OUTCOMES.NOT_RESOLVED));
t('wrong-execution-requirement-ref-not-resolved',()=>assert.equal(makeSystem().assess({...request,executionRequirementEvidenceRef:'wrong'}).outcome,OUTCOMES.NOT_RESOLVED));
t('wrong-principal-not-resolved',()=>assert.equal(makeSystem().assess({...request,expectedPrincipalRef:'wrong'}).outcome,OUTCOMES.NOT_RESOLVED));
t('wrong-principal-revision-not-resolved',()=>assert.equal(makeSystem().assess({...request,expectedPrincipalRevision:'wrong'}).outcome,OUTCOMES.NOT_RESOLVED));
t('wrong-interaction-not-resolved',()=>assert.equal(makeSystem().assess({...request,interactionId:'wrong'}).outcome,OUTCOMES.NOT_RESOLVED));
t('wrong-gate-id-not-resolved',()=>assert.equal(makeSystem().assess({...request,gateId:'wrong'}).outcome,OUTCOMES.NOT_RESOLVED));
t('wrong-gate-revision-not-resolved',()=>assert.equal(makeSystem().assess({...request,gateRevision:99}).outcome,OUTCOMES.NOT_RESOLVED));
t('wrong-scope-digest-not-resolved',()=>assert.equal(makeSystem().assess({...request,authorityScopeDigest:sha('c')}).outcome,OUTCOMES.NOT_RESOLVED));
t('wrong-continuation-target-not-resolved',()=>assert.equal(makeSystem().assess({...request,continuationTargetRef:'wrong'}).outcome,OUTCOMES.NOT_RESOLVED));
t('wrong-execution-target-not-resolved',()=>assert.equal(makeSystem().assess({...request,executionTargetRef:'wrong'}).outcome,OUTCOMES.NOT_RESOLVED));
t('revision-before-scope-not-resolved',()=>{const i=withIntent({contextScope:withScope({fromInteractionRevision:8,throughInteractionRevision:9})}); assert.equal(makeSystem(i).assess(request).outcome,OUTCOMES.NOT_RESOLVED);});
t('revision-after-scope-not-resolved',()=>{const i=withIntent({contextScope:withScope({fromInteractionRevision:5,throughInteractionRevision:6})}); assert.equal(makeSystem(i).assess(request).outcome,OUTCOMES.NOT_RESOLVED);});

// state attestation
t('state-missing-unknown',()=>{const s=createCurrentControlledContinuationExecutionIntentEvidence({executionIntentPort:()=>baseIntent,executionIntentStatePort:()=>null}); assert.equal(s.assess(request).outcome,OUTCOMES.UNKNOWN);});
t('state-port-failure-unknown',()=>{const s=createCurrentControlledContinuationExecutionIntentEvidence({executionIntentPort:()=>baseIntent,executionIntentStatePort:()=>{throw new Error('x')}}); assert.equal(s.assess(request).outcome,OUTCOMES.UNKNOWN);});
t('state-must-bind-exact-intent-id',()=>assert.equal(makeSystem(baseIntent,s=>({...s,executionIntentId:'wrong'})).assess(request).outcome,OUTCOMES.UNKNOWN));
t('state-must-bind-exact-intent-digest',()=>assert.equal(makeSystem(baseIntent,s=>({...s,executionIntentDigest:sha('d')})).assess(request).outcome,OUTCOMES.UNKNOWN));
t('stale-lifecycle-unknown',()=>assert.equal(makeSystem(baseIntent,s=>({...s,lifecycleState:'STALE'})).assess(request).outcome,OUTCOMES.UNKNOWN));
t('stale-freshness-unknown',()=>assert.equal(makeSystem(baseIntent,s=>({...s,freshnessState:'STALE'})).assess(request).outcome,OUTCOMES.UNKNOWN));
t('contradictory-state-unknown',()=>assert.equal(makeSystem(baseIntent,s=>({...s,contradictionState:'CONTRADICTED'})).assess(request).outcome,OUTCOMES.UNKNOWN));
t('state-authority-must-be-none',()=>assert.equal(makeSystem(baseIntent,s=>({...s,authority:'EXECUTE'})).assess(request).outcome,OUTCOMES.UNKNOWN));
t('state-extra-field-unknown',()=>assert.equal(makeSystem(baseIntent,s=>({...s,extra:true})).assess(request).outcome,OUTCOMES.UNKNOWN));

// request schema
t('wrong-ruleset-invalid',()=>assert.equal(makeSystem().assess({...request,rulesetVersion:'wrong'}).outcome,OUTCOMES.INVALID));
t('extra-request-field-invalid',()=>assert.equal(makeSystem().assess({...request,extra:true}).outcome,OUTCOMES.INVALID));
t('negative-interaction-revision-invalid',()=>assert.equal(makeSystem().assess({...request,interactionRevision:-1}).outcome,OUTCOMES.INVALID));
t('zero-gate-revision-invalid',()=>assert.equal(makeSystem().assess({...request,gateRevision:0}).outcome,OUTCOMES.INVALID));

// no downstream authority
t('caller-cannot-force-execution-start',()=>assert.equal(makeSystem().assess({...request,executionStartPermitted:true}).outcome,OUTCOMES.INVALID));
t('resolved-result-has-no-start-or-effect-authority',()=>{const r=makeSystem().assess(request); assert.equal(r.executionStartPermitted,false); assert.equal(r.executionStarted,false); assert.equal(r.continuationExecuted,false); assert.equal(r.effectAuthorized,false); assert.equal(r.effectPerformed,false);});
t('resolved-evidence-has-no-start-or-effect-authority',()=>{const e=makeSystem().assess(request).evidence; assert.equal(e.executionStartPermitted,false); assert.equal(e.executionStarted,false); assert.equal(e.continuationExecuted,false); assert.equal(e.effectAuthorized,false); assert.equal(e.effectPerformed,false); assert.equal(e.effectVerified,false);});
t('unknown-result-has-no-downstream-authority',()=>{const s=createCurrentControlledContinuationExecutionIntentEvidence({executionIntentPort:()=>{throw new Error('x')},executionIntentStatePort:()=>null}); const r=s.assess(request); assert.equal(r.outcome,OUTCOMES.UNKNOWN); assert.equal(r.executionStartPermitted,false); assert.equal(r.executionStarted,false); assert.equal(r.effectAuthorized,false);});
t('not-resolved-result-has-no-downstream-authority',()=>{const s=createCurrentControlledContinuationExecutionIntentEvidence({executionIntentPort:()=>null,executionIntentStatePort:()=>null}); const r=s.assess(request); assert.equal(r.outcome,OUTCOMES.NOT_RESOLVED); assert.equal(r.executionStartPermitted,false); assert.equal(r.executionStarted,false); assert.equal(r.effectAuthorized,false);});
t('invalid-result-has-no-downstream-authority',()=>{const r=makeSystem().assess({...request,rulesetVersion:'wrong'}); assert.equal(r.outcome,OUTCOMES.INVALID); assert.equal(r.executionStartPermitted,false); assert.equal(r.executionStarted,false); assert.equal(r.effectAuthorized,false);});

let pass=0;
for(const [name,fn] of tests){
  try { fn(); console.log(`PASS - ${name}`); pass += 1; }
  catch(error){ console.error(`FAIL - ${name}`); console.error(error && error.stack || error); process.exitCode=1; }
}
console.log(`${pass}/${tests.length} PASS`);
