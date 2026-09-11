'use strict';

const assert=require('node:assert/strict');
const {RULESET_VERSION,AUTHORITY,OUTCOMES,createContinuationAuthorizationConsumption,createMemoryLedger}=require('./continuation-authorization-consumption');
const DIGEST=`sha256:${'a'.repeat(64)}`;
const principalRef='gt63-machine:human-principal:goce-v0',principalRevision='1';
const scope=Object.freeze({scopeType:'GATE',interactionId:'interaction-1',fromInteractionRevision:7,throughInteractionRevision:7,gateId:'gate-1',gateRevision:1,authorityScopeDigest:DIGEST,continuationTargetRef:'continuation:target-1'});
const authorization=Object.freeze({continuationAuthorizationId:'continuation-authorization:abc',type:'GT63_CONTINUATION_AUTHORIZATION_EVIDENCE',schemaVersion:'1.0',rulesetVersion:'human-gate-satisfaction-continuation-authorization-v0.1.0',satisfactionId:'human-gate-satisfaction:s1',authorizationBindingId:'authorization-binding:b1',gateRequirementEvidenceRef:'gate-requirement:g1',principalRef,principalRevision,contextScope:scope,continuationTargetRef:scope.continuationTargetRef,authorizationState:'AUTHORIZED',authority:'NONE',humanGateSatisfied:true,continuationAuthorized:true,continuationExecuted:false,executionAuthorityCreated:false,effectAuthorized:false,effectPerformed:false});
function source(value=authorization){return Object.freeze({get:id=>id===authorization.continuationAuthorizationId?value:null});}
function request(overrides={}){return {rulesetVersion:RULESET_VERSION,continuationAuthorizationId:authorization.continuationAuthorizationId,continuationTargetRef:scope.continuationTargetRef,interactionId:scope.interactionId,interactionRevision:7,gateId:scope.gateId,gateRevision:scope.gateRevision,authorityScopeDigest:DIGEST,expectedPrincipalRef:principalRef,expectedPrincipalRevision:principalRevision,...overrides};}
function make(src=source(),ledger=createMemoryLedger()){return createContinuationAuthorizationConsumption({continuationAuthorizationLedger:src,continuationConsumptionLedger:ledger});}
const tests=[];function test(name,fn){tests.push([name,fn]);}
function altered(patch){return Object.freeze({...authorization,...patch});}

test('constructor-requires-authorization-ledger',()=>assert.throws(()=>createContinuationAuthorizationConsumption({continuationConsumptionLedger:createMemoryLedger()})));
test('constructor-requires-consumption-ledger',()=>assert.throws(()=>createContinuationAuthorizationConsumption({continuationAuthorizationLedger:source()})));
test('exact-authorization-is-consumed',()=>assert.equal(make().assess(request()).outcome,OUTCOMES.CONSUMED));
test('consumed-evidence-type-exact',()=>assert.equal(make().assess(request()).evidence.type,'GT63_CONTINUATION_AUTHORIZATION_CONSUMPTION'));
test('consumed-state-exact',()=>assert.equal(make().assess(request()).evidence.consumptionState,'CONSUMED'));
test('consumed-preserves-authorization-id',()=>assert.equal(make().assess(request()).evidence.continuationAuthorizationId,authorization.continuationAuthorizationId));
test('consumed-preserves-satisfaction-id',()=>assert.equal(make().assess(request()).evidence.satisfactionId,authorization.satisfactionId));
test('consumed-preserves-binding-id',()=>assert.equal(make().assess(request()).evidence.authorizationBindingId,authorization.authorizationBindingId));
test('consumed-preserves-gate-ref',()=>assert.equal(make().assess(request()).evidence.gateRequirementEvidenceRef,authorization.gateRequirementEvidenceRef));
test('consumed-preserves-principal',()=>assert.equal(make().assess(request()).evidence.principalRef,principalRef));
test('consumed-preserves-target',()=>assert.equal(make().assess(request()).evidence.continuationTargetRef,scope.continuationTargetRef));
test('consumed-preserves-human-gate-satisfied',()=>assert.equal(make().assess(request()).evidence.humanGateSatisfied,true));
test('consumed-preserves-continuation-authorized',()=>assert.equal(make().assess(request()).evidence.continuationAuthorized,true));
test('consumed-marks-continuation-executed',()=>assert.equal(make().assess(request()).evidence.continuationExecuted,true));
test('consumed-creates-no-execution-authority',()=>assert.equal(make().assess(request()).evidence.executionAuthorityCreated,false));
test('consumed-authorizes-no-tool-invocation',()=>assert.equal(make().assess(request()).evidence.toolInvocationAuthorized,false));
test('consumed-creates-no-effect-authority',()=>assert.equal(make().assess(request()).evidence.effectAuthorized,false));
test('consumed-performs-no-effect',()=>assert.equal(make().assess(request()).evidence.effectPerformed,false));
test('missing-authorization-is-unknown',()=>assert.equal(make(Object.freeze({get:()=>null})).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('authorization-ledger-throw-is-unknown',()=>assert.equal(make(Object.freeze({get:()=>{throw new Error('x')}})).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('authorization-identity-conflict-is-unknown',()=>assert.equal(make(Object.freeze({get:()=>[authorization,authorization]})).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('invalid-authorization-type-is-unknown',()=>assert.equal(make(source(altered({type:'WRONG'}))).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('unauthorized-record-is-unknown',()=>assert.equal(make(source(altered({authorizationState:'DENIED'}))).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('wrong-authorization-authority-is-unknown',()=>assert.equal(make(source(altered({authority:'SOME'}))).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('already-executed-authorization-is-unknown',()=>assert.equal(make(source(altered({continuationExecuted:true}))).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('principal-mismatch-not-consumed',()=>assert.equal(make().assess(request({expectedPrincipalRef:'other'})).outcome,OUTCOMES.NOT_CONSUMED));
test('principal-revision-mismatch-not-consumed',()=>assert.equal(make().assess(request({expectedPrincipalRevision:'2'})).outcome,OUTCOMES.NOT_CONSUMED));
test('continuation-target-mismatch-not-consumed',()=>assert.equal(make().assess(request({continuationTargetRef:'other'})).outcome,OUTCOMES.NOT_CONSUMED));
test('interaction-mismatch-not-consumed',()=>assert.equal(make().assess(request({interactionId:'other'})).outcome,OUTCOMES.NOT_CONSUMED));
test('gate-id-mismatch-not-consumed',()=>assert.equal(make().assess(request({gateId:'other'})).outcome,OUTCOMES.NOT_CONSUMED));
test('gate-revision-mismatch-not-consumed',()=>assert.equal(make().assess(request({gateRevision:2})).outcome,OUTCOMES.NOT_CONSUMED));
test('digest-mismatch-not-consumed',()=>assert.equal(make().assess(request({authorityScopeDigest:`sha256:${'b'.repeat(64)}`})).outcome,OUTCOMES.NOT_CONSUMED));
test('older-authorization-revision-fails-closed-as-stale',()=>assert.equal(make().assess(request({interactionRevision:8})).outcome,OUTCOMES.NOT_CONSUMED));
test('wrong-ruleset-invalid',()=>assert.equal(make().assess(request({rulesetVersion:'wrong'})).outcome,OUTCOMES.INVALID));
test('extra-field-invalid',()=>assert.equal(make().assess({...request(),extra:true}).outcome,OUTCOMES.INVALID));
test('same-replay-consumed',()=>{const p=make();const a=p.assess(request()),b=p.assess(request());assert.equal(a.outcome,OUTCOMES.CONSUMED);assert.equal(b.outcome,OUTCOMES.CONSUMED);});
test('same-replay-preserves-consumption-id',()=>{const p=make();const a=p.assess(request()),b=p.assess(request());assert.equal(a.evidence.continuationConsumptionId,b.evidence.continuationConsumptionId);});
test('consumption-ledger-get-failure-unknown',()=>{const l={get(){throw new Error('x')},commit(){}};assert.equal(make(source(),l).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('consumption-ledger-commit-failure-unknown',()=>{const l={get(){return null},commit(){throw new Error('x')}};assert.equal(make(source(),l).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('primitive-authority-none',()=>assert.equal(make().authority,AUTHORITY));
test('result-authority-none',()=>assert.equal(make().assess(request()).authority,AUTHORITY));
test('evidence-authority-none',()=>assert.equal(make().assess(request()).evidence.authority,AUTHORITY));
test('consumed-result-frozen',()=>assert.equal(Object.isFrozen(make().assess(request())),true));
test('consumed-evidence-frozen',()=>assert.equal(Object.isFrozen(make().assess(request()).evidence),true));
test('continuation-consumption-is-not-execution-authority',()=>assert.equal(make().assess(request()).executionAuthorityCreated,false));
test('continuation-consumption-is-not-tool-invocation-authority',()=>assert.equal(make().assess(request()).toolInvocationAuthorized,false));
test('continuation-consumption-is-not-effect-authority',()=>assert.equal(make().assess(request()).effectAuthorized,false));
test('continuation-consumption-is-not-effect-execution',()=>assert.equal(make().assess(request()).effectPerformed,false));

let passed=0;for(const [name,fn] of tests){try{fn();console.log(`PASS - ${name}`);passed++;}catch(err){console.error(`FAIL - ${name}`);console.error(err&&err.stack||err);process.exitCode=1;}}
console.log(`${passed}/${tests.length} PASS`);
if(passed!==tests.length)process.exitCode=1;
