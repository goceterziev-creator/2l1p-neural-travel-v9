'use strict';

const assert=require('node:assert/strict');
const {RULESET_VERSION,AUTHORITY,OUTCOMES,createToolInvocationAuthorityConsumption,createMemoryLedger}=require('./tool-invocation-authority-consumption');

const D='sha256:'+'a'.repeat(64),A='sha256:'+'b'.repeat(64),I='sha256:'+'c'.repeat(64);
const scope={scopeType:'GATE',interactionId:'interaction-1',fromInteractionRevision:3,throughInteractionRevision:3,gateId:'gate-1',gateRevision:1,authorityScopeDigest:D,continuationTargetRef:'continuation:1'};
function source(overrides={}){return {toolInvocationAuthorityId:'tool-auth:1',type:'GT63_TOOL_INVOCATION_AUTHORITY_EVIDENCE',schemaVersion:'1.0',rulesetVersion:'tool-invocation-authority-grant-v0.1.0',executionAuthorityId:'exec-auth:1',continuationConsumptionId:'cont-consume:1',principalRef:'gt63-machine:human-principal:goce-v0',principalRevision:'1',contextScope:{...scope},continuationTargetRef:'continuation:1',executionTargetRef:'exec-target:1',actionType:'ACTION',actionContractDigest:A,toolIdentityRef:'tool:demo',operation:'invoke',invocationContractDigest:I,grantState:'GRANTED',authority:'NONE',executionAuthorityGranted:true,toolInvocationAuthorized:true,toolInvocationExecuted:false,effectAuthorized:false,effectPerformed:false,...overrides};}
function request(overrides={}){return {rulesetVersion:RULESET_VERSION,toolInvocationAuthorityId:'tool-auth:1',continuationTargetRef:'continuation:1',interactionId:'interaction-1',interactionRevision:3,gateId:'gate-1',gateRevision:1,authorityScopeDigest:D,expectedPrincipalRef:'gt63-machine:human-principal:goce-v0',expectedPrincipalRevision:'1',executionTargetRef:'exec-target:1',actionType:'ACTION',actionContractDigest:A,toolIdentityRef:'tool:demo',operation:'invoke',invocationContractDigest:I,...overrides};}
function led(record=source()){return {get:k=>k===record.toolInvocationAuthorityId?record:null};}
function run(name,fn){try{fn();console.log('PASS - '+name);return 1;}catch(e){console.error('FAIL - '+name);throw e;}}
let n=0;
n+=run('constructor-requires-tool-authority-ledger',()=>assert.throws(()=>createToolInvocationAuthorityConsumption({toolInvocationConsumptionLedger:createMemoryLedger()})));
n+=run('constructor-requires-consumption-ledger',()=>assert.throws(()=>createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:led()})));
const consumptionLedger=createMemoryLedger();const p=createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:led(),toolInvocationConsumptionLedger:consumptionLedger});const r=p.assess(request());
n+=run('exact-authority-is-consumed',()=>assert.equal(r.outcome,OUTCOMES.CONSUMED));
n+=run('evidence-type-exact',()=>assert.equal(r.evidence.type,'GT63_TOOL_INVOCATION_AUTHORITY_CONSUMPTION'));
n+=run('consumption-state-exact',()=>assert.equal(r.evidence.consumptionState,'CONSUMED'));
n+=run('preserves-tool-authority-id',()=>assert.equal(r.evidence.toolInvocationAuthorityId,'tool-auth:1'));
n+=run('preserves-execution-authority-id',()=>assert.equal(r.evidence.executionAuthorityId,'exec-auth:1'));
n+=run('preserves-continuation-consumption-id',()=>assert.equal(r.evidence.continuationConsumptionId,'cont-consume:1'));
n+=run('preserves-principal',()=>assert.equal(r.evidence.principalRef,'gt63-machine:human-principal:goce-v0'));
n+=run('preserves-continuation-target',()=>assert.equal(r.evidence.continuationTargetRef,'continuation:1'));
n+=run('preserves-execution-target',()=>assert.equal(r.evidence.executionTargetRef,'exec-target:1'));
n+=run('preserves-action-type',()=>assert.equal(r.evidence.actionType,'ACTION'));
n+=run('preserves-action-contract-digest',()=>assert.equal(r.evidence.actionContractDigest,A));
n+=run('preserves-tool-identity',()=>assert.equal(r.evidence.toolIdentityRef,'tool:demo'));
n+=run('preserves-operation',()=>assert.equal(r.evidence.operation,'invoke'));
n+=run('preserves-invocation-contract-digest',()=>assert.equal(r.evidence.invocationContractDigest,I));
n+=run('tool-authority-remains-authorized',()=>assert.equal(r.evidence.toolInvocationAuthorized,true));
n+=run('tool-invocation-is-marked-executed',()=>assert.equal(r.evidence.toolInvocationExecuted,true));
n+=run('effect-is-not-authorized',()=>assert.equal(r.evidence.effectAuthorized,false));
n+=run('effect-is-not-performed',()=>assert.equal(r.evidence.effectPerformed,false));
n+=run('primitive-authority-none',()=>assert.equal(p.authority,AUTHORITY));
n+=run('result-authority-none',()=>assert.equal(r.authority,AUTHORITY));
n+=run('evidence-authority-none',()=>assert.equal(r.evidence.authority,AUTHORITY));
n+=run('missing-authority-unknown',()=>assert.equal(createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:{get:()=>null},toolInvocationConsumptionLedger:createMemoryLedger()}).assess(request()).outcome,OUTCOMES.UNKNOWN));
n+=run('authority-ledger-throw-unknown',()=>assert.equal(createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:{get(){throw new Error('x');}},toolInvocationConsumptionLedger:createMemoryLedger()}).assess(request()).outcome,OUTCOMES.UNKNOWN));
n+=run('authority-identity-conflict-unknown',()=>assert.equal(createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:{get:()=>[source(),source()]},toolInvocationConsumptionLedger:createMemoryLedger()}).assess(request()).outcome,OUTCOMES.UNKNOWN));
n+=run('invalid-authority-type-unknown',()=>assert.equal(createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:led(source({type:'BAD'})),toolInvocationConsumptionLedger:createMemoryLedger()}).assess(request()).outcome,OUTCOMES.UNKNOWN));
n+=run('ungranted-authority-unknown',()=>assert.equal(createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:led(source({grantState:'DENIED'})),toolInvocationConsumptionLedger:createMemoryLedger()}).assess(request()).outcome,OUTCOMES.UNKNOWN));
n+=run('wrong-authority-container-unknown',()=>assert.equal(createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:led(source({authority:'SOMETHING'})),toolInvocationConsumptionLedger:createMemoryLedger()}).assess(request()).outcome,OUTCOMES.UNKNOWN));
n+=run('already-executed-authority-unknown',()=>assert.equal(createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:led(source({toolInvocationExecuted:true})),toolInvocationConsumptionLedger:createMemoryLedger()}).assess(request()).outcome,OUTCOMES.UNKNOWN));
for(const [name,ov] of [['principal-mismatch',{expectedPrincipalRef:'other'}],['principal-revision-mismatch',{expectedPrincipalRevision:'2'}],['continuation-target-mismatch',{continuationTargetRef:'other'}],['interaction-mismatch',{interactionId:'other'}],['gate-id-mismatch',{gateId:'other'}],['gate-revision-mismatch',{gateRevision:2}],['scope-digest-mismatch',{authorityScopeDigest:'sha256:'+'d'.repeat(64)}],['execution-target-mismatch',{executionTargetRef:'other'}],['action-type-mismatch',{actionType:'OTHER'}],['action-contract-digest-mismatch',{actionContractDigest:'sha256:'+'d'.repeat(64)}],['tool-identity-mismatch',{toolIdentityRef:'tool:other'}],['operation-mismatch',{operation:'other'}],['invocation-contract-digest-mismatch',{invocationContractDigest:'sha256:'+'d'.repeat(64)}]])n+=run(name,()=>assert.equal(createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:led(),toolInvocationConsumptionLedger:createMemoryLedger()}).assess(request(ov)).outcome,OUTCOMES.NOT_CONSUMED));
n+=run('older-authority-revision-fails-closed-as-stale',()=>assert.equal(createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:led(),toolInvocationConsumptionLedger:createMemoryLedger()}).assess(request({interactionRevision:2})).outcome,OUTCOMES.NOT_CONSUMED));
n+=run('wrong-ruleset-invalid',()=>assert.equal(p.assess(request({rulesetVersion:'wrong'})).outcome,OUTCOMES.INVALID));
n+=run('extra-field-invalid',()=>assert.equal(p.assess({...request(),extra:true}).outcome,OUTCOMES.INVALID));
const replay=p.assess(request());
n+=run('same-replay-consumed',()=>assert.equal(replay.outcome,OUTCOMES.CONSUMED));
n+=run('same-replay-preserves-consumption-id',()=>assert.equal(replay.evidence.toolInvocationConsumptionId,r.evidence.toolInvocationConsumptionId));
n+=run('consumption-ledger-get-failure-unknown',()=>assert.equal(createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:led(),toolInvocationConsumptionLedger:{get(){throw new Error('x');},commit(){}}}).assess(request()).outcome,OUTCOMES.UNKNOWN));
n+=run('consumption-ledger-commit-failure-unknown',()=>assert.equal(createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:led(),toolInvocationConsumptionLedger:{get:()=>null,commit(){throw new Error('x');}}}).assess(request()).outcome,OUTCOMES.UNKNOWN));
n+=run('consumption-ledger-commit-conflict-unknown',()=>assert.equal(createToolInvocationAuthorityConsumption({toolInvocationAuthorityLedger:led(),toolInvocationConsumptionLedger:{get:()=>null,commit:()=>({bad:true})}}).assess(request()).outcome,OUTCOMES.UNKNOWN));
n+=run('consumed-result-frozen',()=>assert.equal(Object.isFrozen(r),true));
n+=run('consumed-evidence-frozen',()=>assert.equal(Object.isFrozen(r.evidence),true));
n+=run('tool-invocation-consumption-is-not-effect-authority',()=>assert.equal(r.effectAuthorized,false));
n+=run('tool-invocation-consumption-is-not-effect-execution',()=>assert.equal(r.effectPerformed,false));
console.log(`${n}/${n} PASS`);
