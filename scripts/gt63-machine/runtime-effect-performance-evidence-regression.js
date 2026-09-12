'use strict';

const assert=require('node:assert/strict');
const {RULESET_VERSION,AUTHORITY,OUTCOMES,createRuntimeEffectPerformanceEvidence}=require('./runtime-effect-performance-evidence');
let passed=0;
function test(name,fn){try{fn();passed++;console.log(`PASS - ${name}`);}catch(e){console.error(`FAIL - ${name}`);throw e;}}
const H='a'.repeat(64),H2='b'.repeat(64),sha=x=>`sha256:${x}`;
const scope={scopeType:'GATE',interactionId:'interaction:1',fromInteractionRevision:2,throughInteractionRevision:8,gateId:'gate:1',gateRevision:1,authorityScopeDigest:sha(H),continuationTargetRef:'continuation:1'};
const observation={continuationCompletionObservationId:'completion-observation:1',type:'GT63_CONTINUATION_COMPLETION_OBSERVATION',schemaVersion:'1.0',rulesetVersion:'continuation-completion-observation-current-evidence-binding-v0.1.0',executionStartObservationId:'start-observation:1',runtimeCompletionEvidenceRef:'completion-evidence:1',executionStartId:'start:1',currentExecutionStartEvidenceRef:'current-start:1',runtimeStartEvidenceRef:'runtime-start:1',executionStartDigest:sha(H),executionIntentId:'intent:1',currentExecutionIntentEvidenceRef:'current-intent:1',executionStartRequirementEvidenceRef:'start-requirement:1',invocationId:'invocation:1',invocationDigest:sha(H),runtimeOccurrenceRef:'occurrence:1',runtimeOccurrenceDigest:sha(H),runtimeCompletionRef:'runtime-completion:1',runtimeCompletionDigest:sha(H),principalRef:'principal:goce',principalRevision:'rev:1',executionTargetRef:'target:1',contextScope:scope,observationState:'OBSERVED',authority:AUTHORITY,executionStarted:true,executionSucceeded:false,continuationExecuted:true,effectAuthorized:false,effectPerformed:false,effectVerified:false};
const wrapper={outcome:'OBSERVED',authority:AUTHORITY,executionStarted:true,executionSucceeded:false,continuationExecuted:true,effectAuthorized:false,effectPerformed:false,effectVerified:false,observation};
const effectRecord={runtimeEffectRef:'runtime-effect:1',runtimeEffectMaterial:{kind:'file-write-observation',artifactRef:'artifact:1',providerClaim:{effectPerformed:true},bytes:17}};
const request={rulesetVersion:RULESET_VERSION,continuationCompletionObservationId:observation.continuationCompletionObservationId,runtimeCompletionEvidenceRef:observation.runtimeCompletionEvidenceRef,executionStartObservationId:observation.executionStartObservationId,executionStartId:observation.executionStartId,currentExecutionStartEvidenceRef:observation.currentExecutionStartEvidenceRef,runtimeStartEvidenceRef:observation.runtimeStartEvidenceRef,executionStartDigest:observation.executionStartDigest,executionIntentId:observation.executionIntentId,currentExecutionIntentEvidenceRef:observation.currentExecutionIntentEvidenceRef,executionStartRequirementEvidenceRef:observation.executionStartRequirementEvidenceRef,invocationId:observation.invocationId,invocationDigest:observation.invocationDigest,runtimeOccurrenceRef:observation.runtimeOccurrenceRef,runtimeOccurrenceDigest:observation.runtimeOccurrenceDigest,runtimeCompletionRef:observation.runtimeCompletionRef,runtimeCompletionDigest:observation.runtimeCompletionDigest,expectedPrincipalRef:observation.principalRef,expectedPrincipalRevision:observation.principalRevision,interactionId:scope.interactionId,interactionRevision:5,gateId:scope.gateId,gateRevision:scope.gateRevision,authorityScopeDigest:scope.authorityScopeDigest,continuationTargetRef:scope.continuationTargetRef,executionTargetRef:observation.executionTargetRef,runtimeEffectRef:effectRecord.runtimeEffectRef};
function canonical(v){return Array.isArray(v)?v.map(canonical):(v&&typeof v==='object'?Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{}):v)}
const crypto=require('node:crypto');const digest=v=>`sha256:${crypto.createHash('sha256').update(Buffer.from(JSON.stringify(canonical(v)),'utf8')).digest('hex')}`;
function attestation(overrides={}){return {...{continuationCompletionObservationId:observation.continuationCompletionObservationId,runtimeCompletionEvidenceRef:observation.runtimeCompletionEvidenceRef,runtimeEffectRef:effectRecord.runtimeEffectRef,runtimeEffectDigest:digest(effectRecord.runtimeEffectMaterial),observationState:'OBSERVED',effectPerformed:true,lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:AUTHORITY},...overrides};}
function make({cw=wrapper,er=effectRecord,verify=()=>attestation()}={}){return createRuntimeEffectPerformanceEvidence({continuationCompletionObservationPort:()=>cw,runtimeEffectMaterialPort:()=>er,runtimeEffectVerifier:verify});}
function assess(opts={},req=request){return make(opts).assess(req);}

// constructor boundaries
test('constructor-requires-completion-port',()=>assert.throws(()=>createRuntimeEffectPerformanceEvidence({runtimeEffectMaterialPort:()=>effectRecord,runtimeEffectVerifier:()=>attestation()}),TypeError));
test('constructor-requires-effect-material-port',()=>assert.throws(()=>createRuntimeEffectPerformanceEvidence({continuationCompletionObservationPort:()=>wrapper,runtimeEffectVerifier:()=>attestation()}),TypeError));
test('constructor-requires-effect-verifier',()=>assert.throws(()=>createRuntimeEffectPerformanceEvidence({continuationCompletionObservationPort:()=>wrapper,runtimeEffectMaterialPort:()=>effectRecord}),TypeError));

// positive exact binding
const positive=assess();
test('exact-effect-observed',()=>assert.equal(positive.outcome,OUTCOMES.OBSERVED));
test('evidence-type-exact',()=>assert.equal(positive.evidence.type,'GT63_RUNTIME_EFFECT_PERFORMANCE_EVIDENCE'));
test('evidence-ref-deterministic-prefix',()=>assert.match(positive.evidence.runtimeEffectEvidenceRef,/^gt63-evidence:runtime-effect-performance:[0-9a-f]{64}$/));
test('binds-completion-observation',()=>assert.equal(positive.evidence.continuationCompletionObservationId,observation.continuationCompletionObservationId));
test('binds-runtime-completion-evidence',()=>assert.equal(positive.evidence.runtimeCompletionEvidenceRef,observation.runtimeCompletionEvidenceRef));
test('binds-start-observation',()=>assert.equal(positive.evidence.executionStartObservationId,observation.executionStartObservationId));
test('binds-start-id',()=>assert.equal(positive.evidence.executionStartId,observation.executionStartId));
test('binds-current-start-ref',()=>assert.equal(positive.evidence.currentExecutionStartEvidenceRef,observation.currentExecutionStartEvidenceRef));
test('binds-runtime-start-ref',()=>assert.equal(positive.evidence.runtimeStartEvidenceRef,observation.runtimeStartEvidenceRef));
test('binds-start-digest',()=>assert.equal(positive.evidence.executionStartDigest,observation.executionStartDigest));
test('binds-intent-id',()=>assert.equal(positive.evidence.executionIntentId,observation.executionIntentId));
test('binds-current-intent-ref',()=>assert.equal(positive.evidence.currentExecutionIntentEvidenceRef,observation.currentExecutionIntentEvidenceRef));
test('binds-start-requirement-ref',()=>assert.equal(positive.evidence.executionStartRequirementEvidenceRef,observation.executionStartRequirementEvidenceRef));
test('binds-invocation-id',()=>assert.equal(positive.evidence.invocationId,observation.invocationId));
test('binds-invocation-digest',()=>assert.equal(positive.evidence.invocationDigest,observation.invocationDigest));
test('binds-runtime-occurrence-ref',()=>assert.equal(positive.evidence.runtimeOccurrenceRef,observation.runtimeOccurrenceRef));
test('binds-runtime-occurrence-digest',()=>assert.equal(positive.evidence.runtimeOccurrenceDigest,observation.runtimeOccurrenceDigest));
test('binds-runtime-completion-ref',()=>assert.equal(positive.evidence.runtimeCompletionRef,observation.runtimeCompletionRef));
test('binds-runtime-completion-digest',()=>assert.equal(positive.evidence.runtimeCompletionDigest,observation.runtimeCompletionDigest));
test('binds-runtime-effect-ref',()=>assert.equal(positive.evidence.runtimeEffectRef,effectRecord.runtimeEffectRef));
test('binds-runtime-effect-digest',()=>assert.equal(positive.evidence.runtimeEffectDigest,digest(effectRecord.runtimeEffectMaterial)));
test('binds-principal',()=>assert.equal(positive.evidence.principalRef,observation.principalRef));
test('binds-principal-revision',()=>assert.equal(positive.evidence.principalRevision,observation.principalRevision));
test('binds-execution-target',()=>assert.equal(positive.evidence.executionTargetRef,observation.executionTargetRef));
test('materializes-current-scope-only',()=>assert.deepEqual(positive.evidence.contextScope,{...scope,fromInteractionRevision:5,throughInteractionRevision:5}));
test('evidence-current',()=>assert.equal(positive.evidence.lifecycleState,'CURRENT'));
test('evidence-fresh',()=>assert.equal(positive.evidence.freshnessState,'CURRENT'));
test('evidence-noncontradictory',()=>assert.equal(positive.evidence.contradictionState,'NONE'));
test('evidence-authority-none',()=>assert.equal(positive.evidence.authority,AUTHORITY));
test('effect-performed-only',()=>assert.equal(positive.evidence.effectPerformed,true));
test('does-not-infer-success',()=>assert.equal(positive.evidence.executionSucceeded,false));
test('does-not-infer-effect-authority',()=>assert.equal(positive.evidence.effectAuthorized,false));
test('does-not-infer-effect-verification',()=>assert.equal(positive.evidence.effectVerified,false));

// opaque/raw claims alone do not establish effect
test('raw-material-effect-claim-alone-blocked',()=>assert.equal(assess({verify:()=>attestation({observationState:'NOT_OBSERVED',effectPerformed:false})}).outcome,OUTCOMES.NOT_OBSERVED));
test('negative-attestation-remains-completed',()=>{const r=assess({verify:()=>attestation({observationState:'NOT_OBSERVED',effectPerformed:false})});assert.equal(r.continuationExecuted,true);assert.equal(r.effectPerformed,false);});

// upstream availability and shape
test('completion-port-failure-unknown',()=>assert.equal(make({cw:wrapper,verify:()=>attestation(),er:effectRecord,}).assess({...request}).outcome,OUTCOMES.OBSERVED));
test('completion-port-throw-unknown',()=>{const x=createRuntimeEffectPerformanceEvidence({continuationCompletionObservationPort:()=>{throw Error('x')},runtimeEffectMaterialPort:()=>effectRecord,runtimeEffectVerifier:()=>attestation()});assert.equal(x.assess(request).outcome,OUTCOMES.UNKNOWN)});
test('effect-material-port-throw-unknown',()=>{const x=createRuntimeEffectPerformanceEvidence({continuationCompletionObservationPort:()=>wrapper,runtimeEffectMaterialPort:()=>{throw Error('x')},runtimeEffectVerifier:()=>attestation()});assert.equal(x.assess(request).outcome,OUTCOMES.UNKNOWN)});
test('effect-verifier-throw-unknown',()=>assert.equal(assess({verify:()=>{throw Error('x')}}).outcome,OUTCOMES.UNKNOWN));
test('missing-completion-wrapper-unknown',()=>assert.equal(assess({cw:null}).outcome,OUTCOMES.UNKNOWN));
test('completion-wrapper-must-be-observed',()=>assert.equal(assess({cw:{...wrapper,outcome:'NOT_OBSERVED'}}).outcome,OUTCOMES.UNKNOWN));
test('completion-wrapper-authority-none',()=>assert.equal(assess({cw:{...wrapper,authority:'EXECUTE'}}).outcome,OUTCOMES.UNKNOWN));
test('completion-wrapper-must-report-completion',()=>assert.equal(assess({cw:{...wrapper,continuationExecuted:false}}).outcome,OUTCOMES.UNKNOWN));
test('completion-wrapper-no-success',()=>assert.equal(assess({cw:{...wrapper,executionSucceeded:true}}).outcome,OUTCOMES.UNKNOWN));
test('completion-wrapper-no-effect',()=>assert.equal(assess({cw:{...wrapper,effectPerformed:true}}).outcome,OUTCOMES.UNKNOWN));
test('observation-type-exact',()=>assert.equal(assess({cw:{...wrapper,observation:{...observation,type:'OTHER'}}}).outcome,OUTCOMES.UNKNOWN));
test('observation-state-observed',()=>assert.equal(assess({cw:{...wrapper,observation:{...observation,observationState:'NOT_OBSERVED'}}}).outcome,OUTCOMES.UNKNOWN));
test('observation-authority-none',()=>assert.equal(assess({cw:{...wrapper,observation:{...observation,authority:'EXECUTE'}}}).outcome,OUTCOMES.UNKNOWN));
test('observation-no-success',()=>assert.equal(assess({cw:{...wrapper,observation:{...observation,executionSucceeded:true}}}).outcome,OUTCOMES.UNKNOWN));
test('observation-no-effect',()=>assert.equal(assess({cw:{...wrapper,observation:{...observation,effectPerformed:true}}}).outcome,OUTCOMES.UNKNOWN));
test('effect-record-ref-exact',()=>assert.equal(assess({er:{...effectRecord,runtimeEffectRef:'wrong'}}).outcome,OUTCOMES.UNKNOWN));
test('effect-record-material-object',()=>assert.equal(assess({er:{runtimeEffectRef:effectRecord.runtimeEffectRef,runtimeEffectMaterial:'claim'}}).outcome,OUTCOMES.UNKNOWN));

// exact governed envelope mismatch -> NOT_OBSERVED
for(const [name,key,value] of [
 ['wrong-completion-observation','continuationCompletionObservationId','wrong'],['wrong-runtime-completion-evidence','runtimeCompletionEvidenceRef','wrong'],['wrong-start-observation','executionStartObservationId','wrong'],['wrong-start-id','executionStartId','wrong'],['wrong-current-start-ref','currentExecutionStartEvidenceRef','wrong'],['wrong-runtime-start-ref','runtimeStartEvidenceRef','wrong'],['wrong-start-digest','executionStartDigest',sha(H2)],['wrong-intent-id','executionIntentId','wrong'],['wrong-current-intent-ref','currentExecutionIntentEvidenceRef','wrong'],['wrong-start-requirement-ref','executionStartRequirementEvidenceRef','wrong'],['wrong-invocation-id','invocationId','wrong'],['wrong-invocation-digest','invocationDigest',sha(H2)],['wrong-occurrence-ref','runtimeOccurrenceRef','wrong'],['wrong-occurrence-digest','runtimeOccurrenceDigest',sha(H2)],['wrong-runtime-completion-ref','runtimeCompletionRef','wrong'],['wrong-runtime-completion-digest','runtimeCompletionDigest',sha(H2)],['wrong-principal','expectedPrincipalRef','wrong'],['wrong-principal-revision','expectedPrincipalRevision','wrong'],['wrong-execution-target','executionTargetRef','wrong']
]) test(name+'-not-observed',()=>assert.equal(assess({}, {...request,[key]:value}).outcome,OUTCOMES.NOT_OBSERVED));
test('wrong-interaction-not-observed',()=>assert.equal(assess({}, {...request,interactionId:'wrong'}).outcome,OUTCOMES.NOT_OBSERVED));
test('wrong-gate-id-not-observed',()=>assert.equal(assess({}, {...request,gateId:'wrong'}).outcome,OUTCOMES.NOT_OBSERVED));
test('wrong-gate-revision-not-observed',()=>assert.equal(assess({}, {...request,gateRevision:2}).outcome,OUTCOMES.NOT_OBSERVED));
test('wrong-scope-digest-not-observed',()=>assert.equal(assess({}, {...request,authorityScopeDigest:sha(H2)}).outcome,OUTCOMES.NOT_OBSERVED));
test('wrong-continuation-target-not-observed',()=>assert.equal(assess({}, {...request,continuationTargetRef:'wrong'}).outcome,OUTCOMES.NOT_OBSERVED));
test('revision-before-scope-not-observed',()=>assert.equal(assess({}, {...request,interactionRevision:1}).outcome,OUTCOMES.NOT_OBSERVED));
test('revision-after-scope-not-observed',()=>assert.equal(assess({}, {...request,interactionRevision:9}).outcome,OUTCOMES.NOT_OBSERVED));

// attestation adversarial cases
for(const [name,over] of [
 ['attestation-null',null],['attestation-wrong-completion',{continuationCompletionObservationId:'wrong'}],['attestation-wrong-completion-evidence',{runtimeCompletionEvidenceRef:'wrong'}],['attestation-wrong-effect-ref',{runtimeEffectRef:'wrong'}],['attestation-wrong-effect-digest',{runtimeEffectDigest:sha(H2)}],['attestation-stale',{lifecycleState:'STALE'}],['attestation-not-fresh',{freshnessState:'STALE'}],['attestation-contradictory',{contradictionState:'CONTRADICTED'}],['attestation-authority',{authority:'EXECUTE'}],['attestation-observed-false',{observationState:'OBSERVED',effectPerformed:false}],['attestation-not-observed-true',{observationState:'NOT_OBSERVED',effectPerformed:true}]
]) test(name+'-unknown',()=>{const verify=()=>over===null?null:attestation(over);assert.equal(assess({verify}).outcome,OUTCOMES.UNKNOWN)});
test('attestation-extra-field-unknown',()=>assert.equal(assess({verify:()=>({...attestation(),extra:true})}).outcome,OUTCOMES.UNKNOWN));

// request validation
for(const [name,mut] of [
 ['wrong-ruleset',r=>({...r,rulesetVersion:'wrong'})],['extra-request-field',r=>({...r,extra:true})],['malformed-start-digest',r=>({...r,executionStartDigest:'x'})],['malformed-invocation-digest',r=>({...r,invocationDigest:'x'})],['malformed-occurrence-digest',r=>({...r,runtimeOccurrenceDigest:'x'})],['malformed-completion-digest',r=>({...r,runtimeCompletionDigest:'x'})],['negative-interaction-revision',r=>({...r,interactionRevision:-1})],['zero-gate-revision',r=>({...r,gateRevision:0})],['missing-effect-ref',r=>({...r,runtimeEffectRef:''})]
]) test(name+'-invalid',()=>assert.equal(assess({},mut(request)).outcome,OUTCOMES.INVALID));

// result authority/inference boundaries
test('observed-result-authority-none',()=>assert.equal(positive.authority,AUTHORITY));
test('observed-result-started',()=>assert.equal(positive.executionStarted,true));
test('observed-result-completed',()=>assert.equal(positive.continuationExecuted,true));
test('observed-result-no-success',()=>assert.equal(positive.executionSucceeded,false));
test('observed-result-effect-performed',()=>assert.equal(positive.effectPerformed,true));
test('observed-result-no-effect-authority',()=>assert.equal(positive.effectAuthorized,false));
test('observed-result-no-verification',()=>assert.equal(positive.effectVerified,false));
for(const [name,r] of [['not-observed',assess({verify:()=>attestation({observationState:'NOT_OBSERVED',effectPerformed:false})})],['unknown',assess({verify:()=>{throw Error('x')}})],['invalid',assess({}, {...request,rulesetVersion:'wrong'})]]){
 test(name+'-authority-none',()=>assert.equal(r.authority,AUTHORITY));
 test(name+'-no-effect-authority',()=>assert.equal(r.effectAuthorized,false));
 test(name+'-no-effect-verification',()=>assert.equal(r.effectVerified,false));
}

// deterministic identity and material sensitivity
test('deterministic-evidence-id',()=>assert.equal(assess().evidence.runtimeEffectEvidenceRef,assess().evidence.runtimeEffectEvidenceRef));
test('effect-material-change-changes-digest-and-id',()=>{const er={...effectRecord,runtimeEffectMaterial:{...effectRecord.runtimeEffectMaterial,bytes:18}};const verify=x=>attestation({runtimeEffectDigest:x.runtimeEffectDigest});const r=assess({er,verify});assert.equal(r.outcome,OUTCOMES.OBSERVED);assert.notEqual(r.evidence.runtimeEffectDigest,positive.evidence.runtimeEffectDigest);assert.notEqual(r.evidence.runtimeEffectEvidenceRef,positive.evidence.runtimeEffectEvidenceRef)});

console.log(`${passed}/${passed} PASS`);
