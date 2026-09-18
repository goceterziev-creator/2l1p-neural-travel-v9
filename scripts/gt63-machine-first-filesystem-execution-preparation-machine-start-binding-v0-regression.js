"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const mod=require("./gt63-machine/first-filesystem-execution-preparation-machine-start-binding-v0");

const PREP_ID="gt63-execution:first-filesystem:"+("a".repeat(64));
const START_ID="continuation-execution-start:"+("b".repeat(64));
function clone(v){return JSON.parse(JSON.stringify(v));}
function prep(o={}){return{
 executionPreparationId:PREP_ID,type:"GT63_FIRST_FILESYSTEM_EFFECT_EXECUTION_GATEWAY",
 executionState:"READY",operation:"CREATE_NEW_FILE",mustNotExist:true,
 rootPath:"C:/GT63_SANDBOX/GT63_SECOND_EFFECT_TEST",relativeTargetPath:"GT63_SECOND_OPERATION.txt",
 toolAuthorityId:"tool:1",exactEffectAuthorizationId:"auth:1",rootResolutionId:"root:1",
 authorityEffect:"NONE",effectPerformed:false,effectVerified:false,...o};}
function start(o={}){return{
 executionStartId:START_ID,type:"GT63_BOUNDED_CONTINUATION_EXECUTION_START",startState:"PERMITTED",
 executionStartPermitted:true,executionStarted:false,continuationExecuted:false,effectPerformed:false,effectVerified:false,
 authority:"NONE",executionTargetRef:PREP_ID,...o};}
function ledger(seed=[]){const rows=seed.map(clone);return{
 findByExecutionPreparationId(id){return rows.filter(x=>x.executionPreparationId===id).map(clone);},
 commit(x){rows.push(clone(x));return clone(x);}
};}
function request(o={}){return{rulesetVersion:mod.RULESET_VERSION,executionPreparationId:PREP_ID,executionStartId:START_ID,...o};}
function system({p=prep(),s=start(),l=ledger(),fail=null}={}){
 return{c:mod.createFirstFilesystemExecutionPreparationMachineStartBindingV0({
   executionPreparationPort(){if(fail==="prep")throw new Error();return clone(p);},
   machineExecutionStartPort(){if(fail==="start")throw new Error();return clone(s);},
   bindingLedger:l
 }),l};
}
function noEffect(x){assert.equal(x.authority,"NONE");assert.equal(x.authorityEffect,"NONE");assert.equal(x.executionStarted,false);assert.equal(x.effectPerformed,false);assert.equal(x.effectVerified,false);assert.equal(x.additionalEffectAuthorized,false);}
const cases=[];function run(n,f){f();cases.push(n);}

run("exact-preparation-machine-start-bound",()=>{const x=system().c.bind(request());assert.equal(x.outcome,mod.OUTCOMES.BOUND);assert.equal(x.binding.executionTargetRef,PREP_ID);noEffect(x);});
run("unsupported-schema-invalid",()=>{const x=system().c.bind({...request(),x:true});assert.equal(x.outcome,mod.OUTCOMES.INVALID);noEffect(x);});
run("preparation-unavailable-unknown",()=>assert.equal(system({fail:"prep"}).c.bind(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("machine-start-unavailable-unknown",()=>assert.equal(system({fail:"start"}).c.bind(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("preparation-id-mismatch-unknown",()=>assert.equal(system({p:prep({executionPreparationId:"other"})}).c.bind(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("preparation-not-ready-unknown",()=>assert.equal(system({p:prep({executionState:"NOT_READY"})}).c.bind(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("preparation-wrong-operation-unknown",()=>assert.equal(system({p:prep({operation:"OVERWRITE"})}).c.bind(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("preparation-must-not-exist-required",()=>assert.equal(system({p:prep({mustNotExist:false})}).c.bind(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("preparation-effect-already-performed-rejected",()=>assert.equal(system({p:prep({effectPerformed:true})}).c.bind(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("machine-start-id-mismatch-unknown",()=>assert.equal(system({s:start({executionStartId:"other"})}).c.bind(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("machine-start-not-permitted-unknown",()=>assert.equal(system({s:start({executionStartPermitted:false})}).c.bind(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("machine-start-already-started-rejected",()=>assert.equal(system({s:start({executionStarted:true})}).c.bind(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("machine-start-effect-already-performed-rejected",()=>assert.equal(system({s:start({effectPerformed:true})}).c.bind(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("target-ref-must-equal-preparation-id",()=>{const x=system({s:start({executionTargetRef:"executor:generic"})}).c.bind(request());assert.equal(x.outcome,mod.OUTCOMES.NOT_BOUND);noEffect(x);});
run("similar-prefix-target-ref-not-bound",()=>assert.equal(system({s:start({executionTargetRef:PREP_ID+"x"})}).c.bind(request()).outcome,mod.OUTCOMES.NOT_BOUND));
run("duplicate-exact-binding-idempotent",()=>{const s=system();const a=s.c.bind(request());const b=s.c.bind(request());assert.equal(a.outcome,mod.OUTCOMES.BOUND);assert.equal(b.outcome,mod.OUTCOMES.ALREADY_BOUND);assert.equal(a.binding.executionPreparationMachineStartBindingId,b.binding.executionPreparationMachineStartBindingId);});
run("different-existing-binding-conflict",()=>{const first=system().c.bind(request()).binding;const changed={...first,executionStartId:"other"};assert.equal(system({l:ledger([changed])}).c.bind(request()).outcome,mod.OUTCOMES.CONFLICT);});
run("multiple-existing-bindings-conflict",()=>{const x={executionPreparationId:PREP_ID};assert.equal(system({l:ledger([x,x])}).c.bind(request()).outcome,mod.OUTCOMES.CONFLICT);});
run("deterministic-binding-identity",()=>{const a=system().c.bind(request());const b=system().c.bind(request());assert.equal(a.binding.executionPreparationMachineStartBindingId,b.binding.executionPreparationMachineStartBindingId);});
run("binding-preserves-exact-filesystem-scope",()=>{const x=system().c.bind(request()).binding;assert.equal(x.operation,"CREATE_NEW_FILE");assert.equal(x.rootPath,"C:/GT63_SANDBOX/GT63_SECOND_EFFECT_TEST");assert.equal(x.relativeTargetPath,"GT63_SECOND_OPERATION.txt");});
run("binding-does-not-start-execution",()=>noEffect(system().c.bind(request())));
run("binding-does-not-perform-effect",()=>noEffect(system().c.bind(request())));
run("binding-does-not-authorize-additional-effect",()=>noEffect(system().c.bind(request())));
run("authority-always-none",()=>{[system().c.bind(request()),system({fail:"start"}).c.bind(request()),system({s:start({executionTargetRef:"other"})}).c.bind(request())].forEach(noEffect);});

const semantic={cases,rulesetVersion:mod.RULESET_VERSION,outcomes:Object.values(mod.OUTCOMES)};
const validationIdentity="sha256:"+crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
process.stdout.write(JSON.stringify({status:"PASS","workflow":"first-filesystem-execution-preparation-machine-start-binding-v0-regression",cases:cases.length,validationIdentity,semantic})+"\n");
