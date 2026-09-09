'use strict';

const assert = require('node:assert/strict');
const { RULESET_VERSION, AUTHORITY, OUTCOMES, createHumanGateAuthorizationConsumption, createMemoryLedger } = require('./human-gate-authorization-consumption');
const digest = `sha256:${'a'.repeat(64)}`;
function scope(overrides={}){ return {scopeType:'GATE',interactionId:'interaction:1',fromInteractionRevision:1,throughInteractionRevision:3,gateId:'gate:1',gateRevision:1,authorityScopeDigest:digest,continuationTargetRef:'continuation:1',...overrides}; }
function request(overrides={}){ return {rulesetVersion:RULESET_VERSION,authorizationBindingId:'binding:1',gateId:'gate:1',gateRevision:1,authorityScopeDigest:digest,continuationTargetRef:'continuation:1',interactionId:'interaction:1',interactionRevision:2,expectedPrincipalRef:'principal:1',expectedPrincipalRevision:'1',...overrides}; }
function fixtures(overrides={}){
 const binding={bindingId:'binding:1',type:'GT63_AUTHENTICATED_GOVERNANCE_AUTHORIZATION_BINDING',authorizationState:'BOUND',governanceAct:'GATE_AUTHORIZATION',principalRef:'principal:1',principalRevision:'1',contextScope:scope(),lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:'NONE',humanGateSatisfied:false,continuationAuthorityCreated:false,executionAuthorityCreated:false,effectAuthorized:false,...(overrides.binding||{})};
 const gate={gateRequirementEvidenceRef:'evidence:gate:1',gateId:'gate:1',gateRevision:1,authorityScopeDigest:digest,continuationTargetRef:'continuation:1',interactionId:'interaction:1',fromInteractionRevision:1,throughInteractionRevision:3,requiredPrincipalRef:'principal:1',requiredPrincipalRevision:'1',temporalState:'CURRENT',contradictionState:'NONE',authority:'NONE',...(overrides.gate||{})};
 return {binding,gate};
}
function system(overrides={}){ const f=fixtures(overrides.fixtures||{}); const ledger=overrides.ledger||createMemoryLedger(); return {ledger,component:createHumanGateAuthorizationConsumption({authorizationBindingPort:overrides.authorizationBindingPort||(()=>f.binding),gateRequirementPort:overrides.gateRequirementPort||(()=>f.gate),satisfactionLedger:ledger})}; }
const cases=[]; function check(name,fn){fn();cases.push(name);console.log(`PASS - ${name}`);} function noEffect(o){assert.equal(o.authority,AUTHORITY);assert.equal(o.continuationExecuted,false);assert.equal(o.executionAuthorityCreated,false);assert.equal(o.effectPerformed,false);}
check('constructor-requires-ports-and-ledger',()=>{assert.throws(()=>createHumanGateAuthorizationConsumption({}),TypeError);});
check('exact-positive-path-satisfied',()=>{const o=system().component.assess(request());assert.equal(o.outcome,OUTCOMES.SATISFIED);assert.equal(o.humanGateSatisfied,true);assert.equal(o.satisfaction.satisfactionState,'SATISFIED');noEffect(o);});
check('caller-human-gate-satisfied-invalid',()=>{const o=system().component.assess({...request(),humanGateSatisfied:true});assert.equal(o.outcome,OUTCOMES.INVALID);noEffect(o);});
check('binding-unavailable-unknown',()=>{const o=system({authorizationBindingPort:()=>{throw new Error('missing');}}).component.assess(request());assert.equal(o.outcome,OUTCOMES.UNKNOWN);});
check('binding-noncurrent-unknown',()=>{const o=system({fixtures:{binding:{freshnessState:'STALE'}}}).component.assess(request());assert.equal(o.outcome,OUTCOMES.UNKNOWN);});
check('binding-identity-mismatch-unknown-by-contract-validation',()=>{const o=system({fixtures:{binding:{bindingId:'binding:2'}}}).component.assess(request());assert.equal(o.outcome,OUTCOMES.UNKNOWN);});
check('gate-unavailable-unknown',()=>{const o=system({gateRequirementPort:()=>{throw new Error('missing');}}).component.assess(request());assert.equal(o.outcome,OUTCOMES.UNKNOWN);});
check('stale-gate-unknown',()=>{const o=system({fixtures:{gate:{temporalState:'STALE'}}}).component.assess(request());assert.equal(o.outcome,OUTCOMES.UNKNOWN);});
check('conflicting-gate-unknown',()=>{const o=system({fixtures:{gate:{contradictionState:'CONFLICT'}}}).component.assess(request());assert.equal(o.outcome,OUTCOMES.UNKNOWN);});
check('wrong-gate-not-satisfied',()=>{const o=system({fixtures:{gate:{gateId:'gate:2'}}}).component.assess(request());assert.equal(o.outcome,OUTCOMES.NOT_SATISFIED);});
check('wrong-gate-revision-not-satisfied',()=>{const o=system({fixtures:{gate:{gateRevision:2}}}).component.assess(request());assert.equal(o.outcome,OUTCOMES.NOT_SATISFIED);});
check('wrong-authority-scope-not-satisfied',()=>{const other=`sha256:${'b'.repeat(64)}`;const o=system({fixtures:{gate:{authorityScopeDigest:other}}}).component.assess(request());assert.equal(o.outcome,OUTCOMES.NOT_SATISFIED);});
check('wrong-continuation-target-not-satisfied',()=>{const o=system({fixtures:{gate:{continuationTargetRef:'continuation:2'}}}).component.assess(request());assert.equal(o.outcome,OUTCOMES.NOT_SATISFIED);});
check('wrong-principal-not-satisfied',()=>{const o=system({fixtures:{binding:{principalRef:'principal:2'}}}).component.assess(request());assert.equal(o.outcome,OUTCOMES.NOT_SATISFIED);});
check('binding-scope-does-not-cover-current-revision',()=>{const o=system({fixtures:{binding:{contextScope:scope({fromInteractionRevision:1,throughInteractionRevision:1})}}}).component.assess(request());assert.equal(o.outcome,OUTCOMES.NOT_SATISFIED);});
check('exact-replay-is-deterministic',()=>{const s=system();const a=s.component.assess(request());const b=s.component.assess(request());assert.equal(a.outcome,OUTCOMES.SATISFIED);assert.equal(b.outcome,OUTCOMES.SATISFIED);assert.equal(a.satisfaction.satisfactionId,b.satisfaction.satisfactionId);assert.deepEqual(a.satisfaction,b.satisfaction);});
check('changed-interaction-revision-changes-identity',()=>{const a=system().component.assess(request());const b=system().component.assess(request({interactionRevision:3}));assert.equal(a.outcome,OUTCOMES.SATISFIED);assert.equal(b.outcome,OUTCOMES.SATISFIED);assert.notEqual(a.satisfaction.satisfactionId,b.satisfaction.satisfactionId);});
check('ledger-conflict-remains-unknown-and-no-effect',()=>{const seed=system();const first=seed.component.assess(request());const bad={get:id=>({...first.satisfaction,satisfactionId:id,principalRef:'principal:other'}),commit(){throw new Error('should-not-commit');}};const o=system({ledger:bad}).component.assess(request());assert.equal(o.outcome,OUTCOMES.UNKNOWN);noEffect(o);});
check('all-outcomes-never-execute-effect',()=>{const outputs=[system().component.assess(request()),system({fixtures:{gate:{gateId:'gate:2'}}}).component.assess(request()),system({gateRequirementPort:()=>{throw new Error('x');}}).component.assess(request()),system().component.assess({...request(),effectPerformed:true})];outputs.forEach(noEffect);});
console.log(`${cases.length}/${cases.length} PASS`);
