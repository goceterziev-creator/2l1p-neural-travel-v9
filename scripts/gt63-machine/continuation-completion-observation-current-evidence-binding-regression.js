'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION,
  createContinuationCompletionObservationCurrentEvidenceBinding,
  createMemoryLedger
} = require('./continuation-completion-observation-current-evidence-binding');

const H='a'.repeat(64), J='b'.repeat(64), K='c'.repeat(64), L='d'.repeat(64), M='e'.repeat(64);
const scope={scopeType:'GATE',interactionId:'interaction:1',fromInteractionRevision:3,throughInteractionRevision:7,gateId:'gate:1',gateRevision:2,authorityScopeDigest:`sha256:${H}`,continuationTargetRef:'continuation:target:1'};

function startObservation(){
  return {
    outcome:'OBSERVED',authority:'NONE',executionStarted:true,executionSucceeded:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false,
    observation:{
      executionStartObservationId:'execution-start-observation:1',type:'GT63_EXECUTION_START_OBSERVATION',schemaVersion:'1.0',rulesetVersion:'upstream',
      executionStartId:'start:1',currentExecutionStartEvidenceRef:'current-start:1',runtimeStartEvidenceRef:'runtime-start:1',executionStartDigest:`sha256:${J}`,
      executionIntentId:'intent:1',currentExecutionIntentEvidenceRef:'current-intent:1',executionStartRequirementEvidenceRef:'start-req:1',
      invocationId:'invocation:1',invocationDigest:`sha256:${K}`,principalRef:'principal:1',principalRevision:'rev:1',executionTargetRef:'execution-target:1',
      contextScope:{...scope},observationState:'OBSERVED',authority:'NONE',executionStarted:true,executionSucceeded:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false
    }
  };
}

function completionEvidence(){
  return {
    outcome:'OBSERVED',authority:'NONE',executionStarted:true,executionSucceeded:false,continuationExecuted:true,effectAuthorized:false,effectPerformed:false,effectVerified:false,
    evidence:{
      runtimeCompletionEvidenceRef:'runtime-completion-evidence:1',type:'GT63_RUNTIME_CONTINUATION_COMPLETION_EVIDENCE',schemaVersion:'1.0',rulesetVersion:'upstream',
      executionStartObservationId:'execution-start-observation:1',executionStartId:'start:1',currentExecutionStartEvidenceRef:'current-start:1',runtimeStartEvidenceRef:'runtime-start:1',executionStartDigest:`sha256:${J}`,
      executionIntentId:'intent:1',currentExecutionIntentEvidenceRef:'current-intent:1',executionStartRequirementEvidenceRef:'start-req:1',invocationId:'invocation:1',invocationDigest:`sha256:${K}`,
      runtimeOccurrenceRef:'runtime-occurrence:1',runtimeOccurrenceDigest:`sha256:${L}`,runtimeCompletionRef:'runtime-completion:1',runtimeCompletionDigest:`sha256:${M}`,
      principalRef:'principal:1',principalRevision:'rev:1',executionTargetRef:'execution-target:1',contextScope:{...scope},
      lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:'NONE',executionStarted:true,executionSucceeded:false,continuationExecuted:true,effectAuthorized:false,effectPerformed:false,effectVerified:false
    }
  };
}

function request(){
  return {rulesetVersion:RULESET_VERSION,executionStartObservationId:'execution-start-observation:1',runtimeCompletionEvidenceRef:'runtime-completion-evidence:1',executionStartId:'start:1',currentExecutionStartEvidenceRef:'current-start:1',runtimeStartEvidenceRef:'runtime-start:1',executionStartDigest:`sha256:${J}`,executionIntentId:'intent:1',currentExecutionIntentEvidenceRef:'current-intent:1',executionStartRequirementEvidenceRef:'start-req:1',invocationId:'invocation:1',invocationDigest:`sha256:${K}`,runtimeOccurrenceRef:'runtime-occurrence:1',runtimeOccurrenceDigest:`sha256:${L}`,runtimeCompletionRef:'runtime-completion:1',runtimeCompletionDigest:`sha256:${M}`,expectedPrincipalRef:'principal:1',expectedPrincipalRevision:'rev:1',interactionId:'interaction:1',interactionRevision:5,gateId:'gate:1',gateRevision:2,authorityScopeDigest:`sha256:${H}`,continuationTargetRef:'continuation:target:1',executionTargetRef:'execution-target:1'};
}

function make({start=startObservation(),completion=completionEvidence(),ledger=createMemoryLedger()}={}){
  return createContinuationCompletionObservationCurrentEvidenceBinding({executionStartObservationPort:()=>start,runtimeCompletionEvidencePort:()=>completion,observationLedger:ledger});
}

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function set(obj,path,value){ const parts=path.split('.'); let cur=obj; for(let i=0;i<parts.length-1;i++) cur=cur[parts[i]]; cur[parts.at(-1)]=value; return obj; }
function run(name,fn){ try{fn(); console.log(`PASS - ${name}`);}catch(err){console.error(`FAIL - ${name}`); throw err;} }
function expect(outcome, setup={}, req=request()){ assert.equal(make(setup).assess(req).outcome,outcome); }

const tests=[];
const t=(name,fn)=>tests.push([name,fn]);

t('constructor-requires-start-observation-port',()=>assert.throws(()=>createContinuationCompletionObservationCurrentEvidenceBinding({runtimeCompletionEvidencePort:()=>{},observationLedger:createMemoryLedger()}),TypeError));
t('constructor-requires-runtime-completion-port',()=>assert.throws(()=>createContinuationCompletionObservationCurrentEvidenceBinding({executionStartObservationPort:()=>{},observationLedger:createMemoryLedger()}),TypeError));
t('constructor-requires-observation-ledger',()=>assert.throws(()=>createContinuationCompletionObservationCurrentEvidenceBinding({executionStartObservationPort:()=>{},runtimeCompletionEvidencePort:()=>{}}),TypeError));

t('exact-completion-observed',()=>expect('OBSERVED'));
t('observation-type-exact',()=>assert.equal(make().assess(request()).observation.type,'GT63_CONTINUATION_COMPLETION_OBSERVATION'));
t('observation-binds-start-observation',()=>assert.equal(make().assess(request()).observation.executionStartObservationId,'execution-start-observation:1'));
t('observation-binds-runtime-completion-evidence',()=>assert.equal(make().assess(request()).observation.runtimeCompletionEvidenceRef,'runtime-completion-evidence:1'));
t('observation-binds-start-id',()=>assert.equal(make().assess(request()).observation.executionStartId,'start:1'));
t('observation-binds-current-start-ref',()=>assert.equal(make().assess(request()).observation.currentExecutionStartEvidenceRef,'current-start:1'));
t('observation-binds-runtime-start-ref',()=>assert.equal(make().assess(request()).observation.runtimeStartEvidenceRef,'runtime-start:1'));
t('observation-binds-start-digest',()=>assert.equal(make().assess(request()).observation.executionStartDigest,`sha256:${J}`));
t('observation-binds-intent-id',()=>assert.equal(make().assess(request()).observation.executionIntentId,'intent:1'));
t('observation-binds-current-intent-ref',()=>assert.equal(make().assess(request()).observation.currentExecutionIntentEvidenceRef,'current-intent:1'));
t('observation-binds-start-requirement-ref',()=>assert.equal(make().assess(request()).observation.executionStartRequirementEvidenceRef,'start-req:1'));
t('observation-binds-invocation-id',()=>assert.equal(make().assess(request()).observation.invocationId,'invocation:1'));
t('observation-binds-invocation-digest',()=>assert.equal(make().assess(request()).observation.invocationDigest,`sha256:${K}`));
t('observation-binds-runtime-occurrence',()=>assert.equal(make().assess(request()).observation.runtimeOccurrenceRef,'runtime-occurrence:1'));
t('observation-binds-runtime-occurrence-digest',()=>assert.equal(make().assess(request()).observation.runtimeOccurrenceDigest,`sha256:${L}`));
t('observation-binds-runtime-completion-ref',()=>assert.equal(make().assess(request()).observation.runtimeCompletionRef,'runtime-completion:1'));
t('observation-binds-runtime-completion-digest',()=>assert.equal(make().assess(request()).observation.runtimeCompletionDigest,`sha256:${M}`));
t('observation-binds-principal',()=>assert.equal(make().assess(request()).observation.principalRef,'principal:1'));
t('observation-binds-target',()=>assert.equal(make().assess(request()).observation.executionTargetRef,'execution-target:1'));
t('observation-binds-current-scope',()=>assert.equal(make().assess(request()).observation.contextScope.fromInteractionRevision,5));
t('observation-does-not-infer-success',()=>assert.equal(make().assess(request()).observation.executionSucceeded,false));
t('observation-does-not-infer-effect-authority',()=>assert.equal(make().assess(request()).observation.effectAuthorized,false));
t('observation-does-not-infer-effect-performance',()=>assert.equal(make().assess(request()).observation.effectPerformed,false));
t('observation-does-not-infer-effect-verification',()=>assert.equal(make().assess(request()).observation.effectVerified,false));

t('runtime-not-observed-propagates-not-observed',()=>expect('NOT_OBSERVED',{completion:{outcome:'NOT_OBSERVED',authority:'NONE'}}));
t('start-port-failure-unknown',()=>{const x=createContinuationCompletionObservationCurrentEvidenceBinding({executionStartObservationPort:()=>{throw new Error('x');},runtimeCompletionEvidencePort:()=>completionEvidence(),observationLedger:createMemoryLedger()});assert.equal(x.assess(request()).outcome,'UNKNOWN');});
t('completion-port-failure-unknown',()=>{const x=createContinuationCompletionObservationCurrentEvidenceBinding({executionStartObservationPort:()=>startObservation(),runtimeCompletionEvidencePort:()=>{throw new Error('x');},observationLedger:createMemoryLedger()});assert.equal(x.assess(request()).outcome,'UNKNOWN');});

for(const [name,path,value] of [
  ['start-wrapper-must-be-observed','outcome','UNKNOWN'],['start-wrapper-authority-none','authority','SOME'],['start-wrapper-must-report-start','executionStarted',false],['start-wrapper-no-success','executionSucceeded',true],['start-wrapper-no-completion','continuationExecuted',true],['start-observation-type-exact','observation.type','WRONG'],['start-observation-state-observed','observation.observationState','NOT_OBSERVED'],['start-observation-authority-none','observation.authority','SOME'],['start-observation-no-success','observation.executionSucceeded',true],['start-observation-no-effect','observation.effectPerformed',true]
]) t(name,()=>expect('UNKNOWN',{start:set(startObservation(),path,value)}));

for(const [name,path,value] of [
  ['completion-wrapper-must-be-observed','outcome','UNKNOWN'],['completion-wrapper-authority-none','authority','SOME'],['completion-wrapper-must-report-start','executionStarted',false],['completion-wrapper-no-success','executionSucceeded',true],['completion-wrapper-must-report-completion','continuationExecuted',false],['completion-evidence-type-exact','evidence.type','WRONG'],['completion-evidence-current','evidence.lifecycleState','STALE'],['completion-evidence-fresh','evidence.freshnessState','STALE'],['completion-evidence-noncontradictory','evidence.contradictionState','CONTRADICTORY'],['completion-evidence-authority-none','evidence.authority','SOME'],['completion-evidence-no-success','evidence.executionSucceeded',true],['completion-evidence-no-effect','evidence.effectPerformed',true]
]) t(name,()=>expect('UNKNOWN',{completion:set(completionEvidence(),path,value)}));

t('wrong-start-observation-ref-unknown',()=>{const r=request();r.executionStartObservationId='other';expect('UNKNOWN',{},r);});
t('wrong-runtime-completion-evidence-ref-unknown',()=>{const r=request();r.runtimeCompletionEvidenceRef='other';expect('UNKNOWN',{},r);});

for(const [name,field,path,value] of [
  ['wrong-start-id','executionStartId','evidence.executionStartId','other'],
  ['wrong-current-start-ref','currentExecutionStartEvidenceRef','evidence.currentExecutionStartEvidenceRef','other'],
  ['wrong-runtime-start-ref','runtimeStartEvidenceRef','evidence.runtimeStartEvidenceRef','other'],
  ['wrong-start-digest','executionStartDigest','evidence.executionStartDigest',`sha256:${H}`],
  ['wrong-intent-id','executionIntentId','evidence.executionIntentId','other'],
  ['wrong-current-intent-ref','currentExecutionIntentEvidenceRef','evidence.currentExecutionIntentEvidenceRef','other'],
  ['wrong-start-requirement-ref','executionStartRequirementEvidenceRef','evidence.executionStartRequirementEvidenceRef','other'],
  ['wrong-invocation-id','invocationId','evidence.invocationId','other'],
  ['wrong-invocation-digest','invocationDigest','evidence.invocationDigest',`sha256:${H}`],
  ['wrong-runtime-occurrence-ref','runtimeOccurrenceRef','evidence.runtimeOccurrenceRef','other'],
  ['wrong-runtime-occurrence-digest','runtimeOccurrenceDigest','evidence.runtimeOccurrenceDigest',`sha256:${H}`],
  ['wrong-runtime-completion-ref','runtimeCompletionRef','evidence.runtimeCompletionRef','other'],
  ['wrong-runtime-completion-digest','runtimeCompletionDigest','evidence.runtimeCompletionDigest',`sha256:${H}`],
  ['wrong-principal','expectedPrincipalRef','evidence.principalRef','other'],
  ['wrong-principal-revision','expectedPrincipalRevision','evidence.principalRevision','other'],
  ['wrong-execution-target','executionTargetRef','evidence.executionTargetRef','other']
]) t(`${name}-not-observed`,()=>expect('NOT_OBSERVED',{completion:set(completionEvidence(),path,value)}));

t('completion-start-observation-id-disagreement-not-observed',()=>expect('NOT_OBSERVED',{completion:set(completionEvidence(),'evidence.executionStartObservationId','other')}));
t('wrong-interaction-not-observed',()=>{const r=request();r.interactionId='other';expect('NOT_OBSERVED',{},r);});
t('wrong-gate-id-not-observed',()=>{const r=request();r.gateId='other';expect('NOT_OBSERVED',{},r);});
t('wrong-gate-revision-not-observed',()=>{const r=request();r.gateRevision=3;expect('NOT_OBSERVED',{},r);});
t('wrong-scope-digest-not-observed',()=>{const r=request();r.authorityScopeDigest=`sha256:${M}`;expect('NOT_OBSERVED',{},r);});
t('wrong-continuation-target-not-observed',()=>{const r=request();r.continuationTargetRef='other';expect('NOT_OBSERVED',{},r);});
t('revision-before-scope-not-observed',()=>{const r=request();r.interactionRevision=2;expect('NOT_OBSERVED',{},r);});
t('revision-after-scope-not-observed',()=>{const r=request();r.interactionRevision=8;expect('NOT_OBSERVED',{},r);});
t('start-completion-scope-disagreement-not-observed',()=>expect('NOT_OBSERVED',{completion:set(completionEvidence(),'evidence.contextScope.fromInteractionRevision',4)}));

t('ledger-get-failure-unknown',()=>{const ledger={get(){throw new Error('x');},commit(){}};expect('UNKNOWN',{ledger});});
t('ledger-commit-failure-unknown',()=>{const ledger={get(){return null;},commit(){throw new Error('x');}};expect('UNKNOWN',{ledger});});
t('ledger-commit-conflict-unknown',()=>{const ledger={get(){return null;},commit(){return {wrong:true};}};expect('UNKNOWN',{ledger});});
t('deterministic-idempotent-observation',()=>{const ledger=createMemoryLedger();const x=make({ledger});const a=x.assess(request());const b=x.assess(request());assert.equal(a.outcome,'OBSERVED');assert.equal(b.outcome,'OBSERVED');assert.equal(a.observation.continuationCompletionObservationId,b.observation.continuationCompletionObservationId);});
t('prior-ledger-identity-conflict-unknown',()=>{let saved=null;const ledger={get(){return saved?{...saved,executionTargetRef:'tampered'}:null;},commit(k,v){saved=v;return v;}};const x=make({ledger});assert.equal(x.assess(request()).outcome,'OBSERVED');assert.equal(x.assess(request()).outcome,'UNKNOWN');});

t('wrong-ruleset-invalid',()=>{const r=request();r.rulesetVersion='wrong';expect('INVALID',{},r);});
t('extra-request-field-invalid',()=>{const r=request();r.extra=true;expect('INVALID',{},r);});
t('malformed-start-digest-invalid',()=>{const r=request();r.executionStartDigest='x';expect('INVALID',{},r);});
t('malformed-invocation-digest-invalid',()=>{const r=request();r.invocationDigest='x';expect('INVALID',{},r);});
t('malformed-occurrence-digest-invalid',()=>{const r=request();r.runtimeOccurrenceDigest='x';expect('INVALID',{},r);});
t('malformed-completion-digest-invalid',()=>{const r=request();r.runtimeCompletionDigest='x';expect('INVALID',{},r);});
t('negative-interaction-revision-invalid',()=>{const r=request();r.interactionRevision=-1;expect('INVALID',{},r);});
t('zero-gate-revision-invalid',()=>{const r=request();r.gateRevision=0;expect('INVALID',{},r);});
t('missing-runtime-completion-ref-invalid',()=>{const r=request();r.runtimeCompletionRef='';expect('INVALID',{},r);});

t('observed-result-authority-none',()=>assert.equal(make().assess(request()).authority,'NONE'));
t('observed-result-execution-started',()=>assert.equal(make().assess(request()).executionStarted,true));
t('observed-result-continuation-executed',()=>assert.equal(make().assess(request()).continuationExecuted,true));
t('observed-result-no-success',()=>assert.equal(make().assess(request()).executionSucceeded,false));
t('not-observed-no-effect-authority',()=>{const x=make({completion:{outcome:'NOT_OBSERVED',authority:'NONE'}}).assess(request());assert.equal(x.effectAuthorized,false);assert.equal(x.effectPerformed,false);assert.equal(x.effectVerified,false);});
t('unknown-no-effect-authority',()=>{const x=createContinuationCompletionObservationCurrentEvidenceBinding({executionStartObservationPort:()=>{throw new Error('x');},runtimeCompletionEvidencePort:()=>completionEvidence(),observationLedger:createMemoryLedger()}).assess(request());assert.equal(x.effectAuthorized,false);assert.equal(x.effectPerformed,false);assert.equal(x.effectVerified,false);});
t('invalid-no-effect-authority',()=>{const r=request();r.rulesetVersion='x';const x=make().assess(r);assert.equal(x.effectAuthorized,false);assert.equal(x.effectPerformed,false);assert.equal(x.effectVerified,false);});

for(const [name,fn] of tests) run(name,fn);
console.log(`${tests.length}/${tests.length} PASS`);
