'use strict';

const assert = require('node:assert/strict');
const {
  RULESET_VERSION, OUTCOMES,
  createBoundedContinuationExecutionInvocation, createMemoryLedger
} = require('./bounded-continuation-execution-invocation');

let passed=0;
function test(name,fn){ try{ fn(); console.log(`PASS - ${name}`); passed+=1; } catch(err){ console.error(`FAIL - ${name}`); throw err; } }

const SHA='sha256:'+'a'.repeat(64);
const START_SHA='sha256:'+'b'.repeat(64);
const scope=()=>({scopeType:'GATE',interactionId:'interaction:1',fromInteractionRevision:5,throughInteractionRevision:5,gateId:'gate:1',gateRevision:1,authorityScopeDigest:SHA,continuationTargetRef:'continuation:1'});
const evidence=()=>({
  currentExecutionStartEvidenceRef:'gt63-evidence:current-start:1',
  type:'GT63_CURRENT_BOUNDED_CONTINUATION_EXECUTION_START_EVIDENCE',schemaVersion:'1.0',rulesetVersion:'current-bounded-continuation-execution-start-evidence-v0.1.0',
  executionStartId:'start:1',executionStartDigest:START_SHA,executionIntentId:'intent:1',currentExecutionIntentEvidenceRef:'current-intent:1',executionStartRequirementEvidenceRef:'start-req:1',
  principalRef:'principal:goce',principalRevision:'rev:1',executionTargetRef:'exec:1',contextScope:scope(),
  lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:'NONE',executionStartPermitted:false,executionStarted:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false
});
const wrapper=()=>({outcome:'RESOLVED',evidence:evidence(),authority:'NONE',executionStartPermitted:false,executionStarted:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false});
const request=()=>({rulesetVersion:RULESET_VERSION,currentExecutionStartEvidenceRef:'gt63-evidence:current-start:1',executionStartId:'start:1',executionStartDigest:START_SHA,executionIntentId:'intent:1',currentExecutionIntentEvidenceRef:'current-intent:1',executionStartRequirementEvidenceRef:'start-req:1',expectedPrincipalRef:'principal:goce',expectedPrincipalRevision:'rev:1',interactionId:'interaction:1',interactionRevision:5,gateId:'gate:1',gateRevision:1,authorityScopeDigest:SHA,continuationTargetRef:'continuation:1',executionTargetRef:'exec:1'});
const adapterResult=()=>({runtimeOccurrenceRef:'runtime-occurrence:1',runtimeOccurrenceMaterial:{provider:'bounded-test-adapter',attemptRef:'attempt:1'}});
function build(overrides={}){
  const current=overrides.current || (()=>wrapper());
  const adapter=overrides.adapter || (()=>adapterResult());
  const ledger=overrides.ledger || createMemoryLedger();
  return createBoundedContinuationExecutionInvocation({currentExecutionStartResultPort:current,executionAdapter:adapter,invocationLedger:ledger});
}
function mutateCurrent(mutator){ return ()=>{ const w=wrapper(); mutator(w); return w; }; }
function noAuthority(r){ assert.equal(r.authority,'NONE'); assert.equal(r.executionStarted,false); assert.equal(r.continuationExecuted,false); assert.equal(r.executionSucceeded,false); assert.equal(r.effectAuthorized,false); assert.equal(r.effectPerformed,false); assert.equal(r.effectVerified,false); }

test('constructor-requires-current-execution-start-port',()=>assert.throws(()=>createBoundedContinuationExecutionInvocation({executionAdapter:()=>adapterResult(),invocationLedger:createMemoryLedger()}),TypeError));
test('constructor-requires-execution-adapter',()=>assert.throws(()=>createBoundedContinuationExecutionInvocation({currentExecutionStartResultPort:()=>wrapper(),invocationLedger:createMemoryLedger()}),TypeError));
test('constructor-requires-invocation-ledger',()=>assert.throws(()=>createBoundedContinuationExecutionInvocation({currentExecutionStartResultPort:()=>wrapper(),executionAdapter:()=>adapterResult()}),TypeError));
test('exact-current-start-evidence-invokes-once',()=>{ let calls=0; const r=build({adapter:()=>{calls+=1;return adapterResult();}}).assess(request()); assert.equal(r.outcome,OUTCOMES.INVOKED); assert.equal(calls,1); });
test('invocation-record-binds-current-start-evidence',()=>{const r=build().assess(request());assert.equal(r.invocationRecord.currentExecutionStartEvidenceRef,request().currentExecutionStartEvidenceRef);});
test('invocation-record-binds-start-id',()=>assert.equal(build().assess(request()).invocationRecord.executionStartId,'start:1'));
test('invocation-record-binds-start-digest',()=>assert.equal(build().assess(request()).invocationRecord.executionStartDigest,START_SHA));
test('invocation-record-binds-execution-intent',()=>assert.equal(build().assess(request()).invocationRecord.executionIntentId,'intent:1'));
test('invocation-record-binds-upstream-intent-evidence',()=>assert.equal(build().assess(request()).invocationRecord.currentExecutionIntentEvidenceRef,'current-intent:1'));
test('invocation-record-binds-start-requirement',()=>assert.equal(build().assess(request()).invocationRecord.executionStartRequirementEvidenceRef,'start-req:1'));
test('invocation-record-binds-principal',()=>assert.equal(build().assess(request()).invocationRecord.principalRef,'principal:goce'));
test('invocation-record-binds-execution-target',()=>assert.equal(build().assess(request()).invocationRecord.executionTargetRef,'exec:1'));
test('invocation-record-binds-scope',()=>assert.deepEqual(build().assess(request()).invocationRecord.contextScope,scope()));
test('invocation-captures-runtime-occurrence-ref',()=>assert.equal(build().assess(request()).invocationRecord.runtimeOccurrenceRef,'runtime-occurrence:1'));
test('invocation-captures-runtime-occurrence-material-opaquely',()=>assert.deepEqual(build().assess(request()).invocationRecord.runtimeOccurrenceMaterial,adapterResult().runtimeOccurrenceMaterial));
test('adapter-envelope-is-bounded-and-authority-none',()=>{let seen;build({adapter:x=>(seen=x,adapterResult())}).assess(request());assert.equal(seen.authority,'NONE');assert.equal(Object.keys(seen).sort().join(','),['authority','contextScope','currentExecutionIntentEvidenceRef','currentExecutionStartEvidenceRef','executionIntentId','executionStartDigest','executionStartId','executionStartRequirementEvidenceRef','executionTargetRef','principalRef','principalRevision'].sort().join(','));});
test('adapter-envelope-does-not-expose-arbitrary-tool-args',()=>{let seen;build({adapter:x=>(seen=x,adapterResult())}).assess(request());assert.equal('toolArgs' in seen,false);assert.equal('providerAuthority' in seen,false);});
test('current-port-failure-unknown',()=>{const r=build({current:()=>{throw new Error('x');}}).assess(request());assert.equal(r.outcome,OUTCOMES.UNKNOWN);noAuthority(r);});
test('current-wrapper-not-resolved-unknown',()=>{const r=build({current:mutateCurrent(w=>w.outcome='NOT_RESOLVED')}).assess(request());assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test('current-wrapper-authority-must-be-none',()=>{const r=build({current:mutateCurrent(w=>w.authority='EXECUTE')}).assess(request());assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test('current-evidence-must-be-current',()=>{const r=build({current:mutateCurrent(w=>w.evidence.lifecycleState='STALE')}).assess(request());assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test('current-evidence-must-be-fresh',()=>{const r=build({current:mutateCurrent(w=>w.evidence.freshnessState='STALE')}).assess(request());assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test('current-evidence-must-be-noncontradictory',()=>{const r=build({current:mutateCurrent(w=>w.evidence.contradictionState='CONTRADICTORY')}).assess(request());assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
test('current-evidence-ref-mismatch-unknown',()=>{const r=build({current:mutateCurrent(w=>w.evidence.currentExecutionStartEvidenceRef='other')}).assess(request());assert.equal(r.outcome,OUTCOMES.UNKNOWN);});
for(const [name,key,value] of [
  ['wrong-start-id','executionStartId','other'],['wrong-start-digest','executionStartDigest','sha256:'+'c'.repeat(64)],['wrong-intent-id','executionIntentId','other'],['wrong-current-intent-ref','currentExecutionIntentEvidenceRef','other'],['wrong-start-requirement-ref','executionStartRequirementEvidenceRef','other'],['wrong-principal','expectedPrincipalRef','other'],['wrong-principal-revision','expectedPrincipalRevision','other'],['wrong-interaction','interactionId','other'],['wrong-gate-id','gateId','other'],['wrong-gate-revision','gateRevision',2],['wrong-scope-digest','authorityScopeDigest','sha256:'+'d'.repeat(64)],['wrong-continuation-target','continuationTargetRef','other'],['wrong-execution-target','executionTargetRef','other']
]) test(`${name}-not-invokable`,()=>{const q=request();q[key]=value;assert.equal(build().assess(q).outcome,OUTCOMES.NOT_INVOKABLE);});
test('revision-before-scope-not-invokable',()=>{const q=request();q.interactionRevision=4;assert.equal(build().assess(q).outcome,OUTCOMES.NOT_INVOKABLE);});
test('revision-after-scope-not-invokable',()=>{const q=request();q.interactionRevision=6;assert.equal(build().assess(q).outcome,OUTCOMES.NOT_INVOKABLE);});
test('adapter-throw-is-unknown',()=>{const r=build({adapter:()=>{throw new Error('fail');}}).assess(request());assert.equal(r.outcome,OUTCOMES.UNKNOWN);noAuthority(r);});
test('adapter-null-is-unknown',()=>assert.equal(build({adapter:()=>null}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('adapter-extra-field-is-unknown',()=>assert.equal(build({adapter:()=>({...adapterResult(),extra:true})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('adapter-missing-occurrence-ref-is-unknown',()=>assert.equal(build({adapter:()=>({runtimeOccurrenceMaterial:{}})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('adapter-nonobject-material-is-unknown',()=>assert.equal(build({adapter:()=>({runtimeOccurrenceRef:'r',runtimeOccurrenceMaterial:'x'})}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('runtime-material-cannot-force-execution-start',()=>{const r=build({adapter:()=>({runtimeOccurrenceRef:'r',runtimeOccurrenceMaterial:{executionStarted:true,executionSucceeded:true,effectPerformed:true}})}).assess(request());assert.equal(r.outcome,OUTCOMES.INVOKED);noAuthority(r);assert.equal(r.invocationRecord.executionStarted,false);});
test('invocation-record-does-not-infer-success-or-effects',()=>{const r=build().assess(request());assert.equal(r.invocationRecord.executionStarted,false);assert.equal(r.invocationRecord.continuationExecuted,false);assert.equal(r.invocationRecord.executionSucceeded,false);assert.equal(r.invocationRecord.effectAuthorized,false);assert.equal(r.invocationRecord.effectPerformed,false);assert.equal(r.invocationRecord.effectVerified,false);});
test('ledger-get-failure-unknown',()=>{const ledger={get(){throw new Error('x');},commit(){}};assert.equal(build({ledger}).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('ledger-commit-failure-unknown',()=>{const ledger={get(){return null;},commit(){throw new Error('x');}};assert.equal(build({ledger}).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('ledger-commit-conflict-unknown',()=>{const ledger={get(){return null;},commit(){return {invocationRecord:{bad:true}};}};assert.equal(build({ledger}).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('idempotent-replay-does-not-reinvoke-adapter',()=>{let calls=0;const ledger=createMemoryLedger();const x=build({ledger,adapter:()=>{calls+=1;return adapterResult();}});const a=x.assess(request());const b=x.assess(request());assert.equal(a.outcome,OUTCOMES.INVOKED);assert.equal(b.outcome,OUTCOMES.INVOKED);assert.equal(calls,1);assert.equal(a.invocationRecord.invocationId,b.invocationRecord.invocationId);});
test('prior-ledger-identity-conflict-unknown',()=>{const good=build().assess(request()).invocationRecord;const ledger={get(){return {invocationRecord:{...good,executionTargetRef:'other'}};},commit(){throw new Error('no');}};assert.equal(build({ledger}).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('wrong-ruleset-invalid',()=>{const q=request();q.rulesetVersion='wrong';assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('extra-request-field-invalid',()=>{const q=request();q.extra=true;assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('malformed-start-digest-invalid',()=>{const q=request();q.executionStartDigest='bad';assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('negative-interaction-revision-invalid',()=>{const q=request();q.interactionRevision=-1;assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('zero-gate-revision-invalid',()=>{const q=request();q.gateRevision=0;assert.equal(build().assess(q).outcome,OUTCOMES.INVALID);});
test('invoked-result-governance-authority-none',()=>{const r=build().assess(request());assert.equal(r.outcome,OUTCOMES.INVOKED);noAuthority(r);});
test('not-invokable-result-has-no-downstream-authority',()=>{const q=request();q.executionTargetRef='other';noAuthority(build().assess(q));});
test('unknown-result-has-no-downstream-authority',()=>noAuthority(build({adapter:()=>null}).assess(request())));
test('invalid-result-has-no-downstream-authority',()=>{const q=request();q.rulesetVersion='x';noAuthority(build().assess(q));});

console.log(`${passed}/${passed} PASS`);
