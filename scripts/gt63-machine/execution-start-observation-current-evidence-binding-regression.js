'use strict';

const assert=require('node:assert/strict');
const {RULESET_VERSION,OUTCOMES,createExecutionStartObservationCurrentEvidenceBinding,createMemoryLedger}=require('./execution-start-observation-current-evidence-binding');

let passed=0;
function test(name,fn){try{fn();console.log(`PASS - ${name}`);passed+=1;}catch(err){console.error(`FAIL - ${name}`);throw err;}}

const SHA='sha256:'+'a'.repeat(64);
const START_SHA='sha256:'+'b'.repeat(64);
const INV_SHA='sha256:'+'c'.repeat(64);
const OCC_SHA='sha256:'+'d'.repeat(64);
const scope=()=>({scopeType:'GATE',interactionId:'interaction:1',fromInteractionRevision:5,throughInteractionRevision:5,gateId:'gate:1',gateRevision:1,authorityScopeDigest:SHA,continuationTargetRef:'continuation:1'});
const currentEvidence=()=>({currentExecutionStartEvidenceRef:'current-start:1',type:'GT63_CURRENT_BOUNDED_CONTINUATION_EXECUTION_START_EVIDENCE',schemaVersion:'1.0',rulesetVersion:'current-bounded-continuation-execution-start-evidence-v0.1.0',executionStartId:'start:1',executionStartDigest:START_SHA,executionIntentId:'intent:1',currentExecutionIntentEvidenceRef:'current-intent:1',executionStartRequirementEvidenceRef:'start-req:1',principalRef:'principal:goce',principalRevision:'rev:1',executionTargetRef:'exec:1',contextScope:scope(),lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:'NONE',executionStartPermitted:false,executionStarted:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false});
const currentWrapper=()=>({outcome:'RESOLVED',evidence:currentEvidence(),authority:'NONE',executionStartPermitted:false,executionStarted:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false});
const runtimeEvidence=()=>({runtimeStartEvidenceRef:'runtime-start:1',type:'GT63_RUNTIME_EXECUTION_START_EVIDENCE',schemaVersion:'1.0',rulesetVersion:'runtime-execution-start-evidence-v0.1.0',invocationId:'invocation:1',invocationDigest:INV_SHA,runtimeOccurrenceRef:'occurrence:1',runtimeOccurrenceDigest:OCC_SHA,executionStartId:'start:1',currentExecutionStartEvidenceRef:'current-start:1',executionStartDigest:START_SHA,executionIntentId:'intent:1',currentExecutionIntentEvidenceRef:'current-intent:1',executionStartRequirementEvidenceRef:'start-req:1',principalRef:'principal:goce',principalRevision:'rev:1',executionTargetRef:'exec:1',contextScope:scope(),lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:'NONE',invocationAttempted:true,executionStarted:true,executionSucceeded:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false});
const runtimeWrapper=()=>({outcome:'OBSERVED',evidence:runtimeEvidence(),authority:'NONE',executionStarted:true,executionSucceeded:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false});
const request=()=>({rulesetVersion:RULESET_VERSION,currentExecutionStartEvidenceRef:'current-start:1',runtimeStartEvidenceRef:'runtime-start:1',executionStartId:'start:1',executionStartDigest:START_SHA,executionIntentId:'intent:1',currentExecutionIntentEvidenceRef:'current-intent:1',executionStartRequirementEvidenceRef:'start-req:1',invocationId:'invocation:1',invocationDigest:INV_SHA,expectedPrincipalRef:'principal:goce',expectedPrincipalRevision:'rev:1',interactionId:'interaction:1',interactionRevision:5,gateId:'gate:1',gateRevision:1,authorityScopeDigest:SHA,continuationTargetRef:'continuation:1',executionTargetRef:'exec:1'});
function build(overrides={}){return createExecutionStartObservationCurrentEvidenceBinding({currentExecutionStartResultPort:overrides.current||(()=>currentWrapper()),runtimeExecutionStartResultPort:overrides.runtime||(()=>runtimeWrapper()),observationLedger:overrides.ledger||createMemoryLedger()});}
function mutateCurrent(mut){return ()=>{const w=currentWrapper();mut(w);return w;};}
function mutateRuntime(mut){return ()=>{const w=runtimeWrapper();mut(w);return w;};}
function noDownstream(r){assert.equal(r.authority,'NONE');assert.equal(r.executionSucceeded,false);assert.equal(r.continuationExecuted,false);assert.equal(r.effectAuthorized,false);assert.equal(r.effectPerformed,false);assert.equal(r.effectVerified,false);}

test('constructor-requires-current-start-port',()=>assert.throws(()=>createExecutionStartObservationCurrentEvidenceBinding({runtimeExecutionStartResultPort:()=>runtimeWrapper(),observationLedger:createMemoryLedger()}),TypeError));
test('constructor-requires-runtime-start-port',()=>assert.throws(()=>createExecutionStartObservationCurrentEvidenceBinding({currentExecutionStartResultPort:()=>currentWrapper(),observationLedger:createMemoryLedger()}),TypeError));
test('constructor-requires-observation-ledger',()=>assert.throws(()=>createExecutionStartObservationCurrentEvidenceBinding({currentExecutionStartResultPort:()=>currentWrapper(),runtimeExecutionStartResultPort:()=>runtimeWrapper()}),TypeError));
test('exact-current-and-runtime-evidence-observed',()=>{const r=build().assess(request());assert.equal(r.outcome,OUTCOMES.OBSERVED);assert.equal(r.executionStarted,true);});
test('observation-type-exact',()=>assert.equal(build().assess(request()).observation.type,'GT63_EXECUTION_START_OBSERVATION'));
test('observation-binds-current-start-ref',()=>assert.equal(build().assess(request()).observation.currentExecutionStartEvidenceRef,'current-start:1'));
test('observation-binds-runtime-start-ref',()=>assert.equal(build().assess(request()).observation.runtimeStartEvidenceRef,'runtime-start:1'));
test('observation-binds-start-id',()=>assert.equal(build().assess(request()).observation.executionStartId,'start:1'));
test('observation-binds-start-digest',()=>assert.equal(build().assess(request()).observation.executionStartDigest,START_SHA));
test('observation-binds-intent-id',()=>assert.equal(build().assess(request()).observation.executionIntentId,'intent:1'));
test('observation-binds-upstream-refs',()=>{const o=build().assess(request()).observation;assert.equal(o.currentExecutionIntentEvidenceRef,'current-intent:1');assert.equal(o.executionStartRequirementEvidenceRef,'start-req:1');});
test('observation-binds-invocation-id',()=>assert.equal(build().assess(request()).observation.invocationId,'invocation:1'));
test('observation-binds-invocation-digest',()=>assert.equal(build().assess(request()).observation.invocationDigest,INV_SHA));
test('observation-binds-principal',()=>{const o=build().assess(request()).observation;assert.equal(o.principalRef,'principal:goce');assert.equal(o.principalRevision,'rev:1');});
test('observation-binds-target',()=>assert.equal(build().assess(request()).observation.executionTargetRef,'exec:1'));
test('observation-binds-current-scope',()=>assert.deepEqual(build().assess(request()).observation.contextScope,scope()));
test('observation-does-not-infer-success-completion-effect',()=>{const r=build().assess(request());noDownstream(r);noDownstream(r.observation);assert.equal(r.observation.executionStarted,true);});
test('runtime-not-observed-propagates-not-observed',()=>{const r=build({runtime:()=>({outcome:'NOT_OBSERVED',evidence:null,authority:'NONE',executionStarted:false,executionSucceeded:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false})}).assess(request());assert.equal(r.outcome,OUTCOMES.NOT_OBSERVED);assert.equal(r.executionStarted,false);});
test('current-port-failure-unknown',()=>{const r=build({current:()=>{throw new Error('x');}}).assess(request());assert.equal(r.outcome,OUTCOMES.UNKNOWN);noDownstream(r);});
test('runtime-port-failure-unknown',()=>{const r=build({runtime:()=>{throw new Error('x');}}).assess(request());assert.equal(r.outcome,OUTCOMES.UNKNOWN);noDownstream(r);});
test('current-wrapper-must-be-resolved',()=>assert.equal(build({current:mutateCurrent(w=>w.outcome='NOT_RESOLVED')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('current-wrapper-authority-none',()=>assert.equal(build({current:mutateCurrent(w=>w.authority='EXECUTE')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('current-evidence-current',()=>assert.equal(build({current:mutateCurrent(w=>w.evidence.lifecycleState='STALE')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('current-evidence-fresh',()=>assert.equal(build({current:mutateCurrent(w=>w.evidence.freshnessState='STALE')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('current-evidence-noncontradictory',()=>assert.equal(build({current:mutateCurrent(w=>w.evidence.contradictionState='CONTRADICTORY')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('runtime-wrapper-must-be-observed',()=>assert.equal(build({runtime:mutateRuntime(w=>w.outcome='UNKNOWN')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('runtime-wrapper-authority-none',()=>assert.equal(build({runtime:mutateRuntime(w=>w.authority='EXECUTE')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('runtime-evidence-current',()=>assert.equal(build({runtime:mutateRuntime(w=>w.evidence.lifecycleState='STALE')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('runtime-evidence-fresh',()=>assert.equal(build({runtime:mutateRuntime(w=>w.evidence.freshnessState='STALE')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('runtime-evidence-noncontradictory',()=>assert.equal(build({runtime:mutateRuntime(w=>w.evidence.contradictionState='CONTRADICTORY')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('runtime-evidence-must-positively-start',()=>assert.equal(build({runtime:mutateRuntime(w=>w.evidence.executionStarted=false)}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('wrong-current-start-ref-unknown',()=>{const q=request();q.currentExecutionStartEvidenceRef='other';assert.equal(build().assess(q).outcome,OUTCOMES.UNKNOWN);});
test('wrong-runtime-start-ref-unknown',()=>{const q=request();q.runtimeStartEvidenceRef='other';assert.equal(build().assess(q).outcome,OUTCOMES.UNKNOWN);});
for(const [name,key,value] of [
['wrong-start-id','executionStartId','other'],['wrong-start-digest','executionStartDigest','sha256:'+'e'.repeat(64)],['wrong-intent-id','executionIntentId','other'],['wrong-current-intent-ref','currentExecutionIntentEvidenceRef','other'],['wrong-start-requirement-ref','executionStartRequirementEvidenceRef','other'],['wrong-invocation-id','invocationId','other'],['wrong-invocation-digest','invocationDigest','sha256:'+'f'.repeat(64)],['wrong-principal','expectedPrincipalRef','other'],['wrong-principal-revision','expectedPrincipalRevision','other'],['wrong-execution-target','executionTargetRef','other']
]) test(`${name}-not-observed`,()=>{const q=request();q[key]=value;assert.equal(build().assess(q).outcome,OUTCOMES.NOT_OBSERVED);});
for(const [name,key,value] of [
['wrong-interaction','interactionId','other'],['wrong-gate-id','gateId','other'],['wrong-gate-revision','gateRevision',2],['wrong-scope-digest','authorityScopeDigest','sha256:'+'1'.repeat(64)],['wrong-continuation-target','continuationTargetRef','other']
]) test(`${name}-not-observed`,()=>{const q=request();q[key]=value;assert.equal(build().assess(q).outcome,OUTCOMES.NOT_OBSERVED);});
test('revision-before-scope-not-observed',()=>{const q=request();q.interactionRevision=4;assert.equal(build().assess(q).outcome,OUTCOMES.NOT_OBSERVED);});
test('revision-after-scope-not-observed',()=>{const q=request();q.interactionRevision=6;assert.equal(build().assess(q).outcome,OUTCOMES.NOT_OBSERVED);});
test('current-runtime-scope-disagreement-not-observed',()=>{const r=build({runtime:mutateRuntime(w=>w.evidence.contextScope={...scope(),throughInteractionRevision:null})}).assess(request());assert.equal(r.outcome,OUTCOMES.NOT_OBSERVED);});
test('ledger-get-failure-unknown',()=>{const ledger={get(){throw new Error('x');},commit(){}};assert.equal(build({ledger}).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('ledger-commit-failure-unknown',()=>{const ledger={get(){return null;},commit(){throw new Error('x');}};assert.equal(build({ledger}).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('ledger-commit-conflict-unknown',()=>{const ledger={get(){return null;},commit(){return {bad:true};}};assert.equal(build({ledger}).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('deterministic-idempotent-observation',()=>{const ledger=createMemoryLedger();const x=build({ledger});const a=x.assess(request());const b=x.assess(request());assert.equal(a.outcome,OUTCOMES.OBSERVED);assert.equal(b.outcome,OUTCOMES.OBSERVED);assert.equal(a.observation.executionStartObservationId,b.observation.executionStartObservationId);});
test('prior-ledger-identity-conflict-unknown',()=>{const good=build().assess(request()).observation;const ledger={get(){return {...good,executionTargetRef:'other'};},commit(){throw new Error('no');}};assert.equal(build({ledger}).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('wrong-ruleset-invalid',()=>{const q=request();q.rulesetVersion='wrong';assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('extra-request-field-invalid',()=>{const q=request();q.extra=true;assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('malformed-start-digest-invalid',()=>{const q=request();q.executionStartDigest='bad';assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('malformed-invocation-digest-invalid',()=>{const q=request();q.invocationDigest='bad';assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('negative-interaction-revision-invalid',()=>{const q=request();q.interactionRevision=-1;assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('zero-gate-revision-invalid',()=>{const q=request();q.gateRevision=0;assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('observed-result-authority-none',()=>{const r=build().assess(request());assert.equal(r.outcome,OUTCOMES.OBSERVED);assert.equal(r.authority,'NONE');noDownstream(r);});
test('not-observed-result-no-downstream-authority',()=>{const q=request();q.executionTargetRef='other';noDownstream(build().assess(q));});
test('unknown-result-no-downstream-authority',()=>noDownstream(build({runtime:()=>null}).assess(request())));
test('invalid-result-no-downstream-authority',()=>{const q=request();q.rulesetVersion='x';noDownstream(build().assess(q));});

console.log(`${passed}/${passed} PASS`);
