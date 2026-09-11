'use strict';

const assert=require('node:assert/strict');
const {
  RULESET_VERSION,AUTHORITY,OUTCOMES,
  createHumanGateSatisfactionContinuationAuthorization,
  createMemoryLedger
}=require('./human-gate-satisfaction-continuation-authorization');

let pass=0;
function test(name,fn){try{fn();pass++;console.log(`PASS - ${name}`);}catch(e){console.error(`FAIL - ${name}`);throw e;}}
const D='sha256:'+'a'.repeat(64);
const baseScope={scopeType:'GATE',interactionId:'i-1',fromInteractionRevision:7,throughInteractionRevision:7,gateId:'g-1',gateRevision:2,authorityScopeDigest:D,continuationTargetRef:'continuation:next'};
function satisfaction(overrides={}){return {satisfactionId:'sat-1',type:'GT63_HUMAN_GATE_AUTHORIZATION_CONSUMPTION',schemaVersion:'1.0',rulesetVersion:'human-gate-authorization-consumption-v0.1.0',authorizationBindingId:'bind-1',gateRequirementEvidenceRef:'gate-evidence-1',principalRef:'gt63-machine:human-principal:goce-v0',principalRevision:'1',contextScope:{...baseScope},satisfactionState:'SATISFIED',authority:'NONE',humanGateSatisfied:true,continuationExecuted:false,executionAuthorityCreated:false,effectPerformed:false,...overrides};}
function request(overrides={}){return {rulesetVersion:RULESET_VERSION,satisfactionId:'sat-1',continuationTargetRef:'continuation:next',interactionId:'i-1',interactionRevision:7,gateId:'g-1',gateRevision:2,authorityScopeDigest:D,expectedPrincipalRef:'gt63-machine:human-principal:goce-v0',expectedPrincipalRevision:'1',...overrides};}
function satisfactionLedger(value=satisfaction()){return {get(id){return id==='sat-1'?value:null;}};}
function primitive(sat=satisfaction(),authLedger=createMemoryLedger()){return createHumanGateSatisfactionContinuationAuthorization({satisfactionLedger:satisfactionLedger(sat),continuationAuthorizationLedger:authLedger});}

test('constructor-requires-satisfaction-ledger',()=>assert.throws(()=>createHumanGateSatisfactionContinuationAuthorization({continuationAuthorizationLedger:createMemoryLedger()})));
test('constructor-requires-authorization-ledger',()=>assert.throws(()=>createHumanGateSatisfactionContinuationAuthorization({satisfactionLedger:satisfactionLedger()})));
test('exact-satisfaction-authorizes-continuation-boundary',()=>assert.equal(primitive().assess(request()).outcome,OUTCOMES.AUTHORIZED));
test('authorized-evidence-type-exact',()=>assert.equal(primitive().assess(request()).evidence.type,'GT63_CONTINUATION_AUTHORIZATION_EVIDENCE'));
test('authorized-state-exact',()=>assert.equal(primitive().assess(request()).evidence.authorizationState,'AUTHORIZED'));
test('authorized-preserves-satisfaction-id',()=>assert.equal(primitive().assess(request()).evidence.satisfactionId,'sat-1'));
test('authorized-preserves-binding-id',()=>assert.equal(primitive().assess(request()).evidence.authorizationBindingId,'bind-1'));
test('authorized-preserves-gate-evidence-ref',()=>assert.equal(primitive().assess(request()).evidence.gateRequirementEvidenceRef,'gate-evidence-1'));
test('authorized-preserves-principal',()=>assert.equal(primitive().assess(request()).evidence.principalRef,'gt63-machine:human-principal:goce-v0'));
test('authorized-preserves-continuation-target',()=>assert.equal(primitive().assess(request()).evidence.continuationTargetRef,'continuation:next'));
test('authorized-human-gate-remains-satisfied',()=>assert.equal(primitive().assess(request()).humanGateSatisfied,true));
test('authorized-sets-continuation-authorized-only',()=>assert.equal(primitive().assess(request()).continuationAuthorized,true));
test('authorized-does-not-execute-continuation',()=>assert.equal(primitive().assess(request()).continuationExecuted,false));
test('authorized-creates-no-execution-authority',()=>assert.equal(primitive().assess(request()).executionAuthorityCreated,false));
test('authorized-creates-no-effect-authority',()=>assert.equal(primitive().assess(request()).effectAuthorized,false));
test('authorized-performs-no-effect',()=>assert.equal(primitive().assess(request()).effectPerformed,false));
test('missing-satisfaction-is-unknown',()=>{const p=createHumanGateSatisfactionContinuationAuthorization({satisfactionLedger:{get(){return null;}},continuationAuthorizationLedger:createMemoryLedger()});assert.equal(p.assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('satisfaction-ledger-throw-is-unknown',()=>{const p=createHumanGateSatisfactionContinuationAuthorization({satisfactionLedger:{get(){throw new Error('x');}},continuationAuthorizationLedger:createMemoryLedger()});assert.equal(p.assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('satisfaction-identity-conflict-is-unknown',()=>{const p=createHumanGateSatisfactionContinuationAuthorization({satisfactionLedger:{get(){return [satisfaction(),satisfaction()];}},continuationAuthorizationLedger:createMemoryLedger()});assert.equal(p.assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('invalid-satisfaction-type-is-unknown',()=>assert.equal(primitive(satisfaction({type:'WRONG'})).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('unsatisfied-record-is-unknown',()=>assert.equal(primitive(satisfaction({satisfactionState:'NOT_SATISFIED',humanGateSatisfied:false})).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('wrong-satisfaction-authority-is-unknown',()=>assert.equal(primitive(satisfaction({authority:'EXECUTE'})).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('already-executed-satisfaction-is-unknown',()=>assert.equal(primitive(satisfaction({continuationExecuted:true})).assess(request()).outcome,OUTCOMES.UNKNOWN));
test('principal-mismatch-not-authorized',()=>assert.equal(primitive().assess(request({expectedPrincipalRef:'other'})).outcome,OUTCOMES.NOT_AUTHORIZED));
test('principal-revision-mismatch-not-authorized',()=>assert.equal(primitive().assess(request({expectedPrincipalRevision:'2'})).outcome,OUTCOMES.NOT_AUTHORIZED));
test('continuation-target-mismatch-not-authorized',()=>assert.equal(primitive().assess(request({continuationTargetRef:'continuation:other'})).outcome,OUTCOMES.NOT_AUTHORIZED));
test('interaction-mismatch-not-authorized',()=>assert.equal(primitive().assess(request({interactionId:'i-2'})).outcome,OUTCOMES.NOT_AUTHORIZED));
test('gate-id-mismatch-not-authorized',()=>assert.equal(primitive().assess(request({gateId:'g-2'})).outcome,OUTCOMES.NOT_AUTHORIZED));
test('gate-revision-mismatch-not-authorized',()=>assert.equal(primitive().assess(request({gateRevision:3})).outcome,OUTCOMES.NOT_AUTHORIZED));
test('digest-mismatch-not-authorized',()=>assert.equal(primitive().assess(request({authorityScopeDigest:'sha256:'+'b'.repeat(64)})).outcome,OUTCOMES.NOT_AUTHORIZED));
test('older-satisfaction-revision-fails-closed-as-stale',()=>assert.equal(primitive().assess(request({interactionRevision:8})).outcome,OUTCOMES.NOT_AUTHORIZED));
test('wrong-ruleset-invalid',()=>assert.equal(primitive().assess(request({rulesetVersion:'wrong'})).outcome,OUTCOMES.INVALID));
test('extra-field-invalid',()=>assert.equal(primitive().assess({...request(),extra:true}).outcome,OUTCOMES.INVALID));
test('same-replay-authorized',()=>{const l=createMemoryLedger(),p=primitive(satisfaction(),l);assert.equal(p.assess(request()).outcome,OUTCOMES.AUTHORIZED);assert.equal(p.assess(request()).outcome,OUTCOMES.AUTHORIZED);});
test('same-replay-preserves-authorization-id',()=>{const l=createMemoryLedger(),p=primitive(satisfaction(),l);const a=p.assess(request()),b=p.assess(request());assert.equal(a.evidence.continuationAuthorizationId,b.evidence.continuationAuthorizationId);});
test('authorization-ledger-get-failure-unknown',()=>{const p=createHumanGateSatisfactionContinuationAuthorization({satisfactionLedger:satisfactionLedger(),continuationAuthorizationLedger:{get(){throw new Error('x');},commit(){}}});assert.equal(p.assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('authorization-ledger-commit-failure-unknown',()=>{const p=createHumanGateSatisfactionContinuationAuthorization({satisfactionLedger:satisfactionLedger(),continuationAuthorizationLedger:{get(){return null;},commit(){throw new Error('x');}}});assert.equal(p.assess(request()).outcome,OUTCOMES.UNKNOWN);});
test('primitive-authority-none',()=>assert.equal(primitive().authority,AUTHORITY));
test('result-authority-none',()=>assert.equal(primitive().assess(request()).authority,AUTHORITY));
test('evidence-authority-none',()=>assert.equal(primitive().assess(request()).evidence.authority,AUTHORITY));
test('authorized-result-frozen',()=>assert.equal(Object.isFrozen(primitive().assess(request())),true));
test('authorized-evidence-frozen',()=>assert.equal(Object.isFrozen(primitive().assess(request()).evidence),true));
test('continuation-authorization-is-not-execution-authority',()=>assert.equal(primitive().assess(request()).evidence.executionAuthorityCreated,false));
test('continuation-authorization-is-not-effect-authority',()=>assert.equal(primitive().assess(request()).evidence.effectAuthorized,false));

console.log(`${pass}/${pass} PASS`);
