'use strict';
const assert=require('node:assert/strict');
const {RULESET_VERSION:CONSUMPTION_RULESET_VERSION,OUTCOMES,createMemoryLedger:createSatisfactionLedger}=require('./human-gate-authorization-consumption');
const {createMemoryRegistry}=require('./human-gate-consumption-evidence-ports');
const {RULESET_VERSION,AUTHORITY,createAuthorizationBindingLedgerHumanGateConsumptionWiring}=require('./authorization-binding-ledger-human-gate-consumption-wiring');

const tests=[];const test=(n,f)=>tests.push([n,f]);
const principalRef='gt63-machine:human-principal:goce-v0';
const principalRevision='1';
const scope={scopeType:'GATE',interactionId:'interaction:1',fromInteractionRevision:1,throughInteractionRevision:1,gateId:'gate:1',gateRevision:1,authorityScopeDigest:`sha256:${'a'.repeat(64)}`,continuationTargetRef:'continuation:1'};
const binding={bindingId:'governance-authorization-binding:test',type:'GT63_AUTHENTICATED_GOVERNANCE_AUTHORIZATION_BINDING',schemaVersion:'1.0',rulesetVersion:'authenticated-governance-authorization-binding-v0.1.0',authorizationSubjectRef:'subject:1',authorizationSubjectRevision:'1',governanceAct:'GATE_AUTHORIZATION',contextScope:scope,principalRef,principalRevision,principalEvidenceRef:'principal:evidence:1',eligibilityEvidenceRef:'eligibility:evidence:1',roleRequirementEvidenceRef:'role-requirement:evidence:1',roleResolutionType:'DIRECT_ASSIGNMENT',roleEvidenceRefs:['assignment:evidence:1'],humanAuthorizationEvidenceRef:'human-auth:evidence:1',humanAuthorizationSemanticDigest:`sha256:${'b'.repeat(64)}`,lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authorizationState:'BOUND',authority:'NONE',humanGateSatisfied:false,continuationAuthorityCreated:false,executionAuthorityCreated:false,effectAuthorized:false};
const gate={gateRequirementEvidenceRef:'gate-requirement:evidence:1',gateId:'gate:1',gateRevision:1,interactionId:'interaction:1',fromInteractionRevision:1,throughInteractionRevision:1,authorityScopeDigest:scope.authorityScopeDigest,continuationTargetRef:'continuation:1',requiredPrincipalRef:principalRef,requiredPrincipalRevision:principalRevision,temporalState:'CURRENT',contradictionState:'NONE',authority:'NONE'};
function bindingLedger(initial=binding){const map=new Map(initial?[ [initial.bindingId,JSON.parse(JSON.stringify(initial))] ]:[]);return Object.freeze({get:k=>map.has(k)?map.get(k):null,commit(k,v){if(map.has(k))throw Error('conflict');map.set(k,JSON.parse(JSON.stringify(v)));return map.get(k);}});}
function gateRegistry(initial=[gate]){return createMemoryRegistry({gateRequirements:initial});}
function wiring(overrides={}){return createAuthorizationBindingLedgerHumanGateConsumptionWiring({bindingLedger:overrides.bindingLedger||bindingLedger(),gateRequirementRegistry:overrides.gateRequirementRegistry||gateRegistry(),satisfactionLedger:overrides.satisfactionLedger||createSatisfactionLedger()});}
function request(overrides={}){return {rulesetVersion:CONSUMPTION_RULESET_VERSION,authorizationBindingId:binding.bindingId,gateId:'gate:1',gateRevision:1,authorityScopeDigest:scope.authorityScopeDigest,continuationTargetRef:'continuation:1',interactionId:'interaction:1',interactionRevision:1,expectedPrincipalRef:principalRef,expectedPrincipalRevision:principalRevision,...overrides};}

test('constructor-requires-binding-ledger',()=>assert.throws(()=>createAuthorizationBindingLedgerHumanGateConsumptionWiring({gateRequirementRegistry:gateRegistry(),satisfactionLedger:createSatisfactionLedger()}),/bindingLedger/));
test('constructor-requires-gate-registry',()=>assert.throws(()=>createAuthorizationBindingLedgerHumanGateConsumptionWiring({bindingLedger:bindingLedger(),satisfactionLedger:createSatisfactionLedger()}),/gateRequirementRegistry/));
test('constructor-requires-satisfaction-ledger',()=>assert.throws(()=>createAuthorizationBindingLedgerHumanGateConsumptionWiring({bindingLedger:bindingLedger(),gateRequirementRegistry:gateRegistry()}),/satisfactionLedger/));
test('exact-composed-path-satisfied',()=>assert.equal(wiring().assess(request()).outcome,OUTCOMES.SATISFIED));
test('satisfied-sets-human-gate-true',()=>assert.equal(wiring().assess(request()).humanGateSatisfied,true));
test('satisfied-preserves-binding-id',()=>assert.equal(wiring().assess(request()).satisfaction.authorizationBindingId,binding.bindingId));
test('satisfied-preserves-gate-evidence-ref',()=>assert.equal(wiring().assess(request()).satisfaction.gateRequirementEvidenceRef,gate.gateRequirementEvidenceRef));
test('satisfied-preserves-principal',()=>assert.equal(wiring().assess(request()).satisfaction.principalRef,principalRef));
test('satisfied-does-not-execute-continuation',()=>assert.equal(wiring().assess(request()).continuationExecuted,false));
test('satisfied-creates-no-execution-authority',()=>assert.equal(wiring().assess(request()).executionAuthorityCreated,false));
test('satisfied-performs-no-effect',()=>assert.equal(wiring().assess(request()).effectPerformed,false));
test('principal-mismatch-not-satisfied',()=>assert.equal(wiring().assess(request({expectedPrincipalRef:'principal:other'})).outcome,OUTCOMES.NOT_SATISFIED));
test('gate-digest-mismatch-not-satisfied',()=>assert.equal(wiring().assess(request({authorityScopeDigest:`sha256:${'c'.repeat(64)}`})).outcome,OUTCOMES.NOT_SATISFIED));
test('gate-continuation-target-mismatch-not-satisfied',()=>assert.equal(wiring().assess(request({continuationTargetRef:'continuation:other'})).outcome,OUTCOMES.NOT_SATISFIED));
test('missing-binding-unknown',()=>assert.equal(wiring({bindingLedger:bindingLedger(null)}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('binding-ledger-throw-unknown',()=>assert.equal(wiring({bindingLedger:{get(){throw Error('x')}}}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('missing-gate-unknown',()=>assert.equal(wiring({gateRequirementRegistry:gateRegistry([])}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('gate-registry-throw-unknown',()=>assert.equal(wiring({gateRequirementRegistry:{getGateRequirement(){throw Error('x')}}}).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('stale-binding-unknown',()=>{const b={...binding,freshnessState:'STALE'};assert.equal(wiring({bindingLedger:bindingLedger(b)}).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('contradictory-binding-unknown',()=>{const b={...binding,contradictionState:'CONFLICT'};assert.equal(wiring({bindingLedger:bindingLedger(b)}).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('wrong-binding-authority-unknown',()=>{const b={...binding,authority:'WRITE'};assert.equal(wiring({bindingLedger:bindingLedger(b)}).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('wrong-ruleset-invalid',()=>assert.equal(wiring().assess(request({rulesetVersion:'wrong'})).outcome,OUTCOMES.INVALID));
test('extra-field-invalid',()=>assert.equal(wiring().assess({...request(),extra:true}).outcome,OUTCOMES.INVALID));
test('same-replay-satisfied',()=>{const w=wiring();assert.equal(w.assess(request()).outcome,OUTCOMES.SATISFIED);assert.equal(w.assess(request()).outcome,OUTCOMES.SATISFIED);});
test('same-replay-preserves-satisfaction-id',()=>{const w=wiring();const a=w.assess(request()),b=w.assess(request());assert.equal(a.satisfaction.satisfactionId,b.satisfaction.satisfactionId);});
test('satisfaction-ledger-failure-unknown',()=>{const bad={get(){throw Error('x')},commit(){throw Error('x')}};assert.equal(wiring({satisfactionLedger:bad}).assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('wiring-authority-none',()=>assert.equal(wiring().authority,AUTHORITY));
test('wiring-ruleset-bounded',()=>assert.equal(wiring().rulesetVersion,RULESET_VERSION));
test('satisfied-result-authority-none',()=>assert.equal(wiring().assess(request()).authority,'NONE'));
test('satisfaction-authority-none',()=>assert.equal(wiring().assess(request()).satisfaction.authority,'NONE'));
test('satisfied-result-frozen',()=>assert.equal(Object.isFrozen(wiring().assess(request())),true));
test('satisfaction-is-not-continuation-execution',()=>assert.equal(wiring().assess(request()).satisfaction.continuationExecuted,false));
test('satisfaction-is-not-execution-authority',()=>assert.equal(wiring().assess(request()).satisfaction.executionAuthorityCreated,false));
test('satisfaction-is-not-effect',()=>assert.equal(wiring().assess(request()).satisfaction.effectPerformed,false));

let passed=0;for(const [name,fn] of tests){try{fn();passed++;console.log(`PASS - ${name}`);}catch(e){console.error(`FAIL - ${name}`);console.error(e&&e.stack?e.stack:e);process.exitCode=1;}}console.log(`${passed}/${tests.length} PASS`);if(passed!==tests.length)process.exitCode=1;
