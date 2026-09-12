'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { RULESET_VERSION, createRuntimeContinuationCompletionEvidence } = require('./runtime-continuation-completion-evidence');

const sha = ch => `sha256:${ch.repeat(64)}`;
const scope = {scopeType:'GATE',interactionId:'interaction:1',fromInteractionRevision:7,throughInteractionRevision:7,gateId:'gate:1',gateRevision:1,authorityScopeDigest:sha('a'),continuationTargetRef:'continuation:1'};
const ids = {
  executionStartObservationId:'execution-start-observation:obs1', executionStartId:'execution-start:1', currentExecutionStartEvidenceRef:'gt63-evidence:current-start:1', runtimeStartEvidenceRef:'gt63-evidence:runtime-start:1',
  executionStartDigest:sha('b'), executionIntentId:'execution-intent:1', currentExecutionIntentEvidenceRef:'gt63-evidence:current-intent:1', executionStartRequirementEvidenceRef:'gt63-evidence:start-requirement:1',
  invocationId:'invocation:1', invocationDigest:sha('c'), principalRef:'principal:goce', principalRevision:'rev:1', executionTargetRef:'target:1', runtimeOccurrenceRef:'runtime-occurrence:1', runtimeOccurrenceDigest:sha('d'), runtimeCompletionRef:'runtime-completion:1'
};

const startObservation = {
  executionStartObservationId:ids.executionStartObservationId,type:'GT63_EXECUTION_START_OBSERVATION',schemaVersion:'1.0',rulesetVersion:'execution-start-observation-current-evidence-binding-v0.1.0',
  executionStartId:ids.executionStartId,currentExecutionStartEvidenceRef:ids.currentExecutionStartEvidenceRef,runtimeStartEvidenceRef:ids.runtimeStartEvidenceRef,executionStartDigest:ids.executionStartDigest,
  executionIntentId:ids.executionIntentId,currentExecutionIntentEvidenceRef:ids.currentExecutionIntentEvidenceRef,executionStartRequirementEvidenceRef:ids.executionStartRequirementEvidenceRef,
  invocationId:ids.invocationId,invocationDigest:ids.invocationDigest,principalRef:ids.principalRef,principalRevision:ids.principalRevision,executionTargetRef:ids.executionTargetRef,contextScope:scope,
  observationState:'OBSERVED',authority:'NONE',executionStarted:true,executionSucceeded:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false
};
const startWrapper = {outcome:'OBSERVED',authority:'NONE',executionStarted:true,executionSucceeded:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false,observation:startObservation};
const runtimeStartEvidence = {
  runtimeStartEvidenceRef:ids.runtimeStartEvidenceRef,type:'GT63_RUNTIME_EXECUTION_START_EVIDENCE',schemaVersion:'1.0',rulesetVersion:'runtime-execution-start-evidence-v0.1.0',
  invocationId:ids.invocationId,invocationDigest:ids.invocationDigest,runtimeOccurrenceRef:ids.runtimeOccurrenceRef,runtimeOccurrenceDigest:ids.runtimeOccurrenceDigest,
  executionStartId:ids.executionStartId,currentExecutionStartEvidenceRef:ids.currentExecutionStartEvidenceRef,executionStartDigest:ids.executionStartDigest,executionIntentId:ids.executionIntentId,
  currentExecutionIntentEvidenceRef:ids.currentExecutionIntentEvidenceRef,executionStartRequirementEvidenceRef:ids.executionStartRequirementEvidenceRef,principalRef:ids.principalRef,principalRevision:ids.principalRevision,
  executionTargetRef:ids.executionTargetRef,contextScope:scope,lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:'NONE',invocationAttempted:true,executionStarted:true,
  executionSucceeded:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false
};
const runtimeStartWrapper = {outcome:'OBSERVED',authority:'NONE',executionStarted:true,executionSucceeded:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false,evidence:runtimeStartEvidence};
const completionRecord = {runtimeCompletionRef:ids.runtimeCompletionRef,runtimeCompletionMaterial:{provider:'fixture',occurrence:'1',termination:{observed:true,class:'EXITED'},completionMarker:'bounded-complete'}};
const canon = v => Array.isArray(v) ? v.map(canon) : (v && typeof v==='object' ? Object.keys(v).sort().reduce((o,k)=>(o[k]=canon(v[k]),o),{}) : v);
const digest = v => `sha256:${crypto.createHash('sha256').update(Buffer.from(JSON.stringify(canon(v)),'utf8')).digest('hex')}`;

const request = {rulesetVersion:RULESET_VERSION,executionStartObservationId:ids.executionStartObservationId,executionStartId:ids.executionStartId,currentExecutionStartEvidenceRef:ids.currentExecutionStartEvidenceRef,runtimeStartEvidenceRef:ids.runtimeStartEvidenceRef,executionStartDigest:ids.executionStartDigest,executionIntentId:ids.executionIntentId,currentExecutionIntentEvidenceRef:ids.currentExecutionIntentEvidenceRef,executionStartRequirementEvidenceRef:ids.executionStartRequirementEvidenceRef,invocationId:ids.invocationId,invocationDigest:ids.invocationDigest,expectedPrincipalRef:ids.principalRef,expectedPrincipalRevision:ids.principalRevision,interactionId:scope.interactionId,interactionRevision:7,gateId:scope.gateId,gateRevision:scope.gateRevision,authorityScopeDigest:scope.authorityScopeDigest,continuationTargetRef:scope.continuationTargetRef,executionTargetRef:ids.executionTargetRef,runtimeCompletionRef:ids.runtimeCompletionRef};

function goodAttestation(input){return {executionStartObservationId:input.executionStartObservationId,executionStartId:input.executionStartId,runtimeStartEvidenceRef:input.runtimeStartEvidenceRef,invocationId:input.invocationId,invocationDigest:input.invocationDigest,runtimeOccurrenceRef:input.runtimeOccurrenceRef,runtimeOccurrenceDigest:input.runtimeOccurrenceDigest,runtimeCompletionRef:input.runtimeCompletionRef,runtimeCompletionDigest:input.runtimeCompletionDigest,observationState:'OBSERVED',terminationObserved:true,continuationExecuted:true,lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:'NONE'};}
function make(overrides={}){return createRuntimeContinuationCompletionEvidence({executionStartObservationPort:()=>startWrapper,runtimeExecutionStartResultPort:()=>runtimeStartWrapper,runtimeCompletionPort:()=>completionRecord,runtimeCompletionVerifier:goodAttestation,...overrides});}
function clone(v){return JSON.parse(JSON.stringify(v));}
function mutate(base,path,value){const x=clone(base);let p=x;for(let i=0;i<path.length-1;i++)p=p[path[i]];p[path[path.length-1]]=value;return x;}

let passed=0, failed=0;
function test(name,fn){try{fn();console.log(`PASS - ${name}`);passed++;}catch(err){console.error(`FAIL - ${name}`);console.error(err.stack||err);failed++;}}
function expectOutcome(obj,outcome){assert.equal(obj.outcome,outcome);assert.equal(obj.authority,'NONE');assert.equal(obj.executionSucceeded,false);assert.equal(obj.effectAuthorized,false);assert.equal(obj.effectPerformed,false);assert.equal(obj.effectVerified,false);}

test('constructor-requires-start-observation-port',()=>assert.throws(()=>createRuntimeContinuationCompletionEvidence({runtimeExecutionStartResultPort:()=>{},runtimeCompletionPort:()=>{},runtimeCompletionVerifier:()=>{}}),/executionStartObservationPort/));
test('constructor-requires-runtime-start-port',()=>assert.throws(()=>createRuntimeContinuationCompletionEvidence({executionStartObservationPort:()=>{},runtimeCompletionPort:()=>{},runtimeCompletionVerifier:()=>{}}),/runtimeExecutionStartResultPort/));
test('constructor-requires-completion-port',()=>assert.throws(()=>createRuntimeContinuationCompletionEvidence({executionStartObservationPort:()=>{},runtimeExecutionStartResultPort:()=>{},runtimeCompletionVerifier:()=>{}}),/runtimeCompletionPort/));
test('constructor-requires-verifier',()=>assert.throws(()=>createRuntimeContinuationCompletionEvidence({executionStartObservationPort:()=>{},runtimeExecutionStartResultPort:()=>{},runtimeCompletionPort:()=>{}}),/runtimeCompletionVerifier/));

test('exact-completion-observed',()=>{const r=make().assess(request);expectOutcome(r,'OBSERVED');assert.equal(r.continuationExecuted,true);assert.equal(r.executionStarted,true);assert.equal(r.evidence.type,'GT63_RUNTIME_CONTINUATION_COMPLETION_EVIDENCE');});
test('evidence-binds-start-observation',()=>assert.equal(make().assess(request).evidence.executionStartObservationId,ids.executionStartObservationId));
test('evidence-binds-start-id',()=>assert.equal(make().assess(request).evidence.executionStartId,ids.executionStartId));
test('evidence-binds-current-start-ref',()=>assert.equal(make().assess(request).evidence.currentExecutionStartEvidenceRef,ids.currentExecutionStartEvidenceRef));
test('evidence-binds-runtime-start-ref',()=>assert.equal(make().assess(request).evidence.runtimeStartEvidenceRef,ids.runtimeStartEvidenceRef));
test('evidence-binds-start-digest',()=>assert.equal(make().assess(request).evidence.executionStartDigest,ids.executionStartDigest));
test('evidence-binds-intent-id',()=>assert.equal(make().assess(request).evidence.executionIntentId,ids.executionIntentId));
test('evidence-binds-current-intent-ref',()=>assert.equal(make().assess(request).evidence.currentExecutionIntentEvidenceRef,ids.currentExecutionIntentEvidenceRef));
test('evidence-binds-start-requirement-ref',()=>assert.equal(make().assess(request).evidence.executionStartRequirementEvidenceRef,ids.executionStartRequirementEvidenceRef));
test('evidence-binds-invocation-id',()=>assert.equal(make().assess(request).evidence.invocationId,ids.invocationId));
test('evidence-binds-invocation-digest',()=>assert.equal(make().assess(request).evidence.invocationDigest,ids.invocationDigest));
test('evidence-binds-runtime-occurrence',()=>{const e=make().assess(request).evidence;assert.equal(e.runtimeOccurrenceRef,ids.runtimeOccurrenceRef);assert.equal(e.runtimeOccurrenceDigest,ids.runtimeOccurrenceDigest);});
test('evidence-binds-completion-ref',()=>assert.equal(make().assess(request).evidence.runtimeCompletionRef,ids.runtimeCompletionRef));
test('evidence-binds-completion-digest',()=>assert.equal(make().assess(request).evidence.runtimeCompletionDigest,digest(completionRecord.runtimeCompletionMaterial)));
test('evidence-binds-principal',()=>{const e=make().assess(request).evidence;assert.equal(e.principalRef,ids.principalRef);assert.equal(e.principalRevision,ids.principalRevision);});
test('evidence-binds-target',()=>assert.equal(make().assess(request).evidence.executionTargetRef,ids.executionTargetRef));
test('evidence-binds-current-scope',()=>assert.deepEqual(make().assess(request).evidence.contextScope,{...scope,fromInteractionRevision:7,throughInteractionRevision:7}));
test('evidence-current-fresh-noncontradictory',()=>{const e=make().assess(request).evidence;assert.equal(e.lifecycleState,'CURRENT');assert.equal(e.freshnessState,'CURRENT');assert.equal(e.contradictionState,'NONE');});
test('completion-does-not-infer-success-or-effect',()=>{const r=make().assess(request);assert.equal(r.evidence.executionSucceeded,false);assert.equal(r.evidence.effectAuthorized,false);assert.equal(r.evidence.effectPerformed,false);assert.equal(r.evidence.effectVerified,false);});
test('deterministic-evidence-ref',()=>assert.equal(make().assess(request).evidence.runtimeCompletionEvidenceRef,make().assess(request).evidence.runtimeCompletionEvidenceRef));

test('negative-verifier-not-observed',()=>{const r=make({runtimeCompletionVerifier:i=>({...goodAttestation(i),observationState:'NOT_OBSERVED',terminationObserved:false,continuationExecuted:false})}).assess(request);expectOutcome(r,'NOT_OBSERVED');assert.equal(r.continuationExecuted,false);});
test('mere-termination-without-completion-not-observed',()=>{const r=make({runtimeCompletionVerifier:i=>({...goodAttestation(i),observationState:'NOT_OBSERVED',terminationObserved:true,continuationExecuted:false})}).assess(request);expectOutcome(r,'NOT_OBSERVED');});
test('verifier-failure-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:()=>{throw new Error('x');}}).assess(request),'UNKNOWN'));
test('completion-port-failure-unknown',()=>expectOutcome(make({runtimeCompletionPort:()=>{throw new Error('x');}}).assess(request),'UNKNOWN'));
test('start-port-failure-unknown',()=>expectOutcome(make({executionStartObservationPort:()=>{throw new Error('x');}}).assess(request),'UNKNOWN'));
test('runtime-start-port-failure-unknown',()=>expectOutcome(make({runtimeExecutionStartResultPort:()=>{throw new Error('x');}}).assess(request),'UNKNOWN'));
test('invalid-start-wrapper-unknown',()=>expectOutcome(make({executionStartObservationPort:()=>({...startWrapper,outcome:'UNKNOWN'})}).assess(request),'UNKNOWN'));
test('invalid-runtime-start-wrapper-unknown',()=>expectOutcome(make({runtimeExecutionStartResultPort:()=>({...runtimeStartWrapper,outcome:'UNKNOWN'})}).assess(request),'UNKNOWN'));
test('stale-runtime-start-unknown',()=>expectOutcome(make({runtimeExecutionStartResultPort:()=>({...runtimeStartWrapper,evidence:{...runtimeStartEvidence,freshnessState:'STALE'}})}).assess(request),'UNKNOWN'));
test('contradictory-runtime-start-unknown',()=>expectOutcome(make({runtimeExecutionStartResultPort:()=>({...runtimeStartWrapper,evidence:{...runtimeStartEvidence,contradictionState:'CONTRADICTORY'}})}).assess(request),'UNKNOWN'));
test('completion-record-missing-material-unknown',()=>expectOutcome(make({runtimeCompletionPort:()=>({runtimeCompletionRef:ids.runtimeCompletionRef})}).assess(request),'UNKNOWN'));
test('completion-ref-mismatch-unknown',()=>expectOutcome(make({runtimeCompletionPort:()=>({...completionRecord,runtimeCompletionRef:'other'})}).assess(request),'UNKNOWN'));

test('wrong-attestation-start-observation-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),executionStartObservationId:'other'})}).assess(request),'UNKNOWN'));
test('wrong-attestation-start-id-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),executionStartId:'other'})}).assess(request),'UNKNOWN'));
test('wrong-attestation-runtime-start-ref-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),runtimeStartEvidenceRef:'other'})}).assess(request),'UNKNOWN'));
test('wrong-attestation-invocation-id-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),invocationId:'other'})}).assess(request),'UNKNOWN'));
test('wrong-attestation-invocation-digest-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),invocationDigest:sha('e')})}).assess(request),'UNKNOWN'));
test('wrong-attestation-occurrence-ref-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),runtimeOccurrenceRef:'other'})}).assess(request),'UNKNOWN'));
test('wrong-attestation-occurrence-digest-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),runtimeOccurrenceDigest:sha('e')})}).assess(request),'UNKNOWN'));
test('wrong-attestation-completion-ref-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),runtimeCompletionRef:'other'})}).assess(request),'UNKNOWN'));
test('wrong-attestation-completion-digest-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),runtimeCompletionDigest:sha('e')})}).assess(request),'UNKNOWN'));
test('stale-attestation-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),freshnessState:'STALE'})}).assess(request),'UNKNOWN'));
test('noncurrent-attestation-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),lifecycleState:'REVOKED'})}).assess(request),'UNKNOWN'));
test('contradictory-attestation-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),contradictionState:'CONTRADICTORY'})}).assess(request),'UNKNOWN'));
test('attestation-authority-not-none-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),authority:'EXECUTE'})}).assess(request),'UNKNOWN'));
test('attestation-extra-field-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),rawProviderClaim:true})}).assess(request),'UNKNOWN'));
test('positive-without-termination-invalid-attestation-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),terminationObserved:false})}).assess(request),'UNKNOWN'));
test('positive-without-completion-invalid-attestation-unknown',()=>expectOutcome(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),continuationExecuted:false})}).assess(request),'UNKNOWN'));

for(const [name,key,value] of [
  ['wrong-start-id','executionStartId','other'],['wrong-current-start-ref','currentExecutionStartEvidenceRef','other'],['wrong-runtime-start-ref','runtimeStartEvidenceRef','other'],['wrong-start-digest','executionStartDigest',sha('e')],['wrong-intent-id','executionIntentId','other'],['wrong-current-intent-ref','currentExecutionIntentEvidenceRef','other'],['wrong-start-requirement-ref','executionStartRequirementEvidenceRef','other'],['wrong-invocation-id','invocationId','other'],['wrong-invocation-digest','invocationDigest',sha('e')],['wrong-principal','expectedPrincipalRef','other'],['wrong-principal-revision','expectedPrincipalRevision','other'],['wrong-execution-target','executionTargetRef','other'],['wrong-interaction','interactionId','other'],['wrong-gate-id','gateId','other'],['wrong-gate-revision','gateRevision',2],['wrong-scope-digest','authorityScopeDigest',sha('e')],['wrong-continuation-target','continuationTargetRef','other']
]) test(`${name}-not-observed`,()=>expectOutcome(make().assess({...request,[key]:value}),'NOT_OBSERVED'));

test('revision-before-scope-not-observed',()=>expectOutcome(make().assess({...request,interactionRevision:6}),'NOT_OBSERVED'));
test('revision-after-scope-not-observed',()=>expectOutcome(make().assess({...request,interactionRevision:8}),'NOT_OBSERVED'));
test('start-runtime-scope-disagreement-not-observed',()=>expectOutcome(make({runtimeExecutionStartResultPort:()=>({...runtimeStartWrapper,evidence:{...runtimeStartEvidence,contextScope:{...scope,throughInteractionRevision:null}}})}).assess(request),'NOT_OBSERVED'));

test('wrong-ruleset-invalid',()=>expectOutcome(make().assess({...request,rulesetVersion:'wrong'}),'INVALID'));
test('extra-request-field-invalid',()=>expectOutcome(make().assess({...request,extra:true}),'INVALID'));
test('malformed-start-digest-invalid',()=>expectOutcome(make().assess({...request,executionStartDigest:'bad'}),'INVALID'));
test('malformed-invocation-digest-invalid',()=>expectOutcome(make().assess({...request,invocationDigest:'bad'}),'INVALID'));
test('negative-interaction-revision-invalid',()=>expectOutcome(make().assess({...request,interactionRevision:-1}),'INVALID'));
test('zero-gate-revision-invalid',()=>expectOutcome(make().assess({...request,gateRevision:0}),'INVALID'));
test('missing-completion-ref-invalid',()=>{const r=clone(request);delete r.runtimeCompletionRef;expectOutcome(make().assess(r),'INVALID');});
test('observed-result-authority-none',()=>assert.equal(make().assess(request).authority,'NONE'));
test('not-observed-no-effect-authority',()=>assert.equal(make({runtimeCompletionVerifier:i=>({...goodAttestation(i),observationState:'NOT_OBSERVED',terminationObserved:false,continuationExecuted:false})}).assess(request).effectAuthorized,false));
test('unknown-no-effect-authority',()=>assert.equal(make({runtimeCompletionVerifier:()=>{throw new Error('x');}}).assess(request).effectAuthorized,false));
test('invalid-no-effect-authority',()=>assert.equal(make().assess({...request,rulesetVersion:'x'}).effectAuthorized,false));

console.log(`${passed}/${passed+failed} PASS`);
if(failed) process.exitCode=1;
