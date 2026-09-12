'use strict';

const assert = require('node:assert/strict');
const { RULESET_VERSION, OUTCOMES, createRuntimeExecutionStartEvidence } = require('./runtime-execution-start-evidence');

let passed=0;
function test(name,fn){ try{ fn(); console.log(`PASS - ${name}`); passed+=1; } catch(err){ console.error(`FAIL - ${name}`); throw err; } }

const SHA='sha256:'+'a'.repeat(64);
const START_SHA='sha256:'+'b'.repeat(64);
const scope=()=>({scopeType:'GATE',interactionId:'interaction:1',fromInteractionRevision:5,throughInteractionRevision:5,gateId:'gate:1',gateRevision:1,authorityScopeDigest:SHA,continuationTargetRef:'continuation:1'});
const invocation=()=>({
  invocationId:'invocation:1',type:'GT63_BOUNDED_CONTINUATION_EXECUTION_INVOCATION',schemaVersion:'1.0',rulesetVersion:'bounded-continuation-execution-invocation-v0.1.0',
  executionStartId:'start:1',currentExecutionStartEvidenceRef:'current-start:1',executionStartDigest:START_SHA,executionIntentId:'intent:1',currentExecutionIntentEvidenceRef:'current-intent:1',executionStartRequirementEvidenceRef:'start-req:1',
  principalRef:'principal:goce',principalRevision:'rev:1',executionTargetRef:'exec:1',contextScope:scope(),invocationState:'ATTEMPTED',authority:'NONE',
  executionStarted:false,continuationExecuted:false,executionSucceeded:false,effectAuthorized:false,effectPerformed:false,effectVerified:false,
  runtimeOccurrenceRef:'occurrence:1',runtimeOccurrenceMaterial:{provider:'test',attemptRef:'attempt:1',executionStarted:true}
});
const request=()=>({rulesetVersion:RULESET_VERSION,invocationId:'invocation:1',executionStartId:'start:1',currentExecutionStartEvidenceRef:'current-start:1',executionStartDigest:START_SHA,executionIntentId:'intent:1',currentExecutionIntentEvidenceRef:'current-intent:1',executionStartRequirementEvidenceRef:'start-req:1',expectedPrincipalRef:'principal:goce',expectedPrincipalRevision:'rev:1',interactionId:'interaction:1',interactionRevision:5,gateId:'gate:1',gateRevision:1,authorityScopeDigest:SHA,continuationTargetRef:'continuation:1',executionTargetRef:'exec:1',runtimeOccurrenceRef:'occurrence:1'});

function positiveAttestation(input){ return {invocationId:input.invocationId,invocationDigest:input.invocationDigest,runtimeOccurrenceRef:input.runtimeOccurrenceRef,runtimeOccurrenceDigest:input.runtimeOccurrenceDigest,observationState:'OBSERVED',executionStarted:true,lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:'NONE'}; }
function negativeAttestation(input){ return {...positiveAttestation(input),observationState:'NOT_OBSERVED',executionStarted:false}; }
function build(overrides={}){ return createRuntimeExecutionStartEvidence({invocationPort:overrides.invocationPort || (()=>invocation()),runtimeOccurrenceVerifier:overrides.verifier || positiveAttestation}); }
function mutateInvocation(mutator){ return ()=>{const x=invocation();mutator(x);return x;}; }
function noDownstream(r){assert.equal(r.authority,'NONE');assert.equal(r.executionSucceeded,false);assert.equal(r.continuationExecuted,false);assert.equal(r.effectAuthorized,false);assert.equal(r.effectPerformed,false);assert.equal(r.effectVerified,false);}

test('constructor-requires-invocation-port',()=>assert.throws(()=>createRuntimeExecutionStartEvidence({runtimeOccurrenceVerifier:positiveAttestation}),TypeError));
test('constructor-requires-runtime-verifier',()=>assert.throws(()=>createRuntimeExecutionStartEvidence({invocationPort:()=>invocation()}),TypeError));
test('exact-verified-runtime-start-observed',()=>{const r=build().assess(request());assert.equal(r.outcome,OUTCOMES.OBSERVED);assert.equal(r.executionStarted,true);});
test('evidence-type-is-exact',()=>assert.equal(build().assess(request()).evidence.type,'GT63_RUNTIME_EXECUTION_START_EVIDENCE'));
test('evidence-binds-invocation-id',()=>assert.equal(build().assess(request()).evidence.invocationId,'invocation:1'));
test('evidence-binds-runtime-occurrence-ref',()=>assert.equal(build().assess(request()).evidence.runtimeOccurrenceRef,'occurrence:1'));
test('evidence-binds-start-id',()=>assert.equal(build().assess(request()).evidence.executionStartId,'start:1'));
test('evidence-binds-current-start-ref',()=>assert.equal(build().assess(request()).evidence.currentExecutionStartEvidenceRef,'current-start:1'));
test('evidence-binds-start-digest',()=>assert.equal(build().assess(request()).evidence.executionStartDigest,START_SHA));
test('evidence-binds-intent-id',()=>assert.equal(build().assess(request()).evidence.executionIntentId,'intent:1'));
test('evidence-binds-upstream-refs',()=>{const e=build().assess(request()).evidence;assert.equal(e.currentExecutionIntentEvidenceRef,'current-intent:1');assert.equal(e.executionStartRequirementEvidenceRef,'start-req:1');});
test('evidence-binds-principal',()=>{const e=build().assess(request()).evidence;assert.equal(e.principalRef,'principal:goce');assert.equal(e.principalRevision,'rev:1');});
test('evidence-binds-target',()=>assert.equal(build().assess(request()).evidence.executionTargetRef,'exec:1'));
test('evidence-binds-scope',()=>assert.deepEqual(build().assess(request()).evidence.contextScope,scope()));
test('evidence-current-fresh-noncontradictory',()=>{const e=build().assess(request()).evidence;assert.equal(e.lifecycleState,'CURRENT');assert.equal(e.freshnessState,'CURRENT');assert.equal(e.contradictionState,'NONE');});
test('evidence-does-not-infer-success-completion-effect',()=>{const r=build().assess(request());noDownstream(r);noDownstream(r.evidence);assert.equal(r.evidence.executionStarted,true);});
test('raw-payload-claim-alone-does-not-establish-start',()=>{const r=build({verifier:negativeAttestation}).assess(request());assert.equal(r.outcome,OUTCOMES.NOT_OBSERVED);assert.equal(r.executionStarted,false);noDownstream(r);});
test('valid-negative-attestation-not-observed',()=>{const r=build({verifier:negativeAttestation}).assess(request());assert.equal(r.outcome,OUTCOMES.NOT_OBSERVED);});
test('invocation-port-failure-unknown',()=>{const r=build({invocationPort:()=>{throw new Error('x');}}).assess(request());assert.equal(r.outcome,OUTCOMES.UNKNOWN);noDownstream(r);});
test('missing-invocation-unknown',()=>assert.equal(build({invocationPort:()=>null}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('invocation-type-must-be-exact',()=>assert.equal(build({invocationPort:mutateInvocation(x=>x.type='OTHER')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('invocation-must-be-attempted',()=>assert.equal(build({invocationPort:mutateInvocation(x=>x.invocationState='PENDING')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('invocation-authority-must-be-none',()=>assert.equal(build({invocationPort:mutateInvocation(x=>x.authority='EXECUTE')}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('invocation-cannot-already-claim-start',()=>assert.equal(build({invocationPort:mutateInvocation(x=>x.executionStarted=true)}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('invocation-cannot-claim-success',()=>assert.equal(build({invocationPort:mutateInvocation(x=>x.executionSucceeded=true)}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('invocation-cannot-claim-completion',()=>assert.equal(build({invocationPort:mutateInvocation(x=>x.continuationExecuted=true)}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('invocation-cannot-claim-effect',()=>assert.equal(build({invocationPort:mutateInvocation(x=>x.effectPerformed=true)}).assess(request()).outcome,OUTCOMES.UNKNOWN));
for(const [name,key,value] of [
 ['wrong-invocation-id','invocationId','other'],['wrong-start-id','executionStartId','other'],['wrong-current-start-ref','currentExecutionStartEvidenceRef','other'],['wrong-start-digest','executionStartDigest','sha256:'+'c'.repeat(64)],['wrong-intent-id','executionIntentId','other'],['wrong-current-intent-ref','currentExecutionIntentEvidenceRef','other'],['wrong-start-requirement-ref','executionStartRequirementEvidenceRef','other'],['wrong-principal','expectedPrincipalRef','other'],['wrong-principal-revision','expectedPrincipalRevision','other'],['wrong-interaction','interactionId','other'],['wrong-gate-id','gateId','other'],['wrong-gate-revision','gateRevision',2],['wrong-scope-digest','authorityScopeDigest','sha256:'+'d'.repeat(64)],['wrong-continuation-target','continuationTargetRef','other'],['wrong-execution-target','executionTargetRef','other'],['wrong-runtime-occurrence-ref','runtimeOccurrenceRef','other']
]) test(`${name}-unknown`,()=>{const q=request();q[key]=value;assert.equal(build().assess(q).outcome,OUTCOMES.UNKNOWN);});
test('revision-before-scope-unknown',()=>{const q=request();q.interactionRevision=4;assert.equal(build().assess(q).outcome,OUTCOMES.UNKNOWN);});
test('revision-after-scope-unknown',()=>{const q=request();q.interactionRevision=6;assert.equal(build().assess(q).outcome,OUTCOMES.UNKNOWN);});
test('verifier-failure-unknown',()=>{const r=build({verifier:()=>{throw new Error('x');}}).assess(request());assert.equal(r.outcome,OUTCOMES.UNKNOWN);noDownstream(r);});
test('verifier-null-unknown',()=>assert.equal(build({verifier:()=>null}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('verifier-extra-field-unknown',()=>assert.equal(build({verifier:x=>({...positiveAttestation(x),extra:true})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('verifier-wrong-invocation-id-unknown',()=>assert.equal(build({verifier:x=>({...positiveAttestation(x),invocationId:'other'})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('verifier-wrong-invocation-digest-unknown',()=>assert.equal(build({verifier:x=>({...positiveAttestation(x),invocationDigest:'sha256:'+'e'.repeat(64)})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('verifier-wrong-occurrence-ref-unknown',()=>assert.equal(build({verifier:x=>({...positiveAttestation(x),runtimeOccurrenceRef:'other'})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('verifier-wrong-occurrence-digest-unknown',()=>assert.equal(build({verifier:x=>({...positiveAttestation(x),runtimeOccurrenceDigest:'sha256:'+'f'.repeat(64)})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('verifier-stale-lifecycle-unknown',()=>assert.equal(build({verifier:x=>({...positiveAttestation(x),lifecycleState:'STALE'})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('verifier-stale-freshness-unknown',()=>assert.equal(build({verifier:x=>({...positiveAttestation(x),freshnessState:'STALE'})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('verifier-contradictory-unknown',()=>assert.equal(build({verifier:x=>({...positiveAttestation(x),contradictionState:'CONTRADICTORY'})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('verifier-authority-must-be-none',()=>assert.equal(build({verifier:x=>({...positiveAttestation(x),authority:'EXECUTE'})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('observed-requires-execution-started-true',()=>assert.equal(build({verifier:x=>({...positiveAttestation(x),executionStarted:false})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('not-observed-requires-execution-started-false',()=>assert.equal(build({verifier:x=>({...negativeAttestation(x),executionStarted:true})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('wrong-ruleset-invalid',()=>{const q=request();q.rulesetVersion='wrong';assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('extra-request-field-invalid',()=>{const q=request();q.extra=true;assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('malformed-start-digest-invalid',()=>{const q=request();q.executionStartDigest='bad';assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('negative-interaction-revision-invalid',()=>{const q=request();q.interactionRevision=-1;assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('zero-gate-revision-invalid',()=>{const q=request();q.gateRevision=0;assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('observed-result-authority-none',()=>{const r=build().assess(request());assert.equal(r.outcome,OUTCOMES.OBSERVED);assert.equal(r.authority,'NONE');noDownstream(r);});
test('not-observed-result-no-downstream-authority',()=>noDownstream(build({verifier:negativeAttestation}).assess(request())));
test('unknown-result-no-downstream-authority',()=>noDownstream(build({verifier:()=>null}).assess(request())));
test('invalid-result-no-downstream-authority',()=>{const q=request();q.rulesetVersion='x';noDownstream(build().assess(q));});

console.log(`${passed}/${passed} PASS`);
