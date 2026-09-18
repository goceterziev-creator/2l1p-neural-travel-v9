"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const mod=require("./gt63-machine/first-filesystem-effect-execution-gateway-v0");

const TOOL_ID="gt63-authority:first-filesystem-tool:fixture";
const AUTH_ID="gt63-authorization:first-filesystem-exact-effect:fixture";
const ROOT_ID="gt63-resolution:first-filesystem-root:fixture";

function clone(v){return JSON.parse(JSON.stringify(v));}
function ledger(seed=[]){const rows=seed.map(clone);return{
  findByToolAuthorityId(id){return rows.filter(x=>x.toolAuthorityId===id).map(clone);},
  commit(x){rows.push(clone(x));return clone(x);}
};}
function tool(o={}){return{
  toolAuthorityId:TOOL_ID,
  toolAuthorityState:"AUTHORIZED",
  exactEffectAuthorizationId:AUTH_ID,
  rootResolutionId:ROOT_ID,
  capability:"CREATE_NEW_FILE",
  rootPath:"C:/GT63_SANDBOX/GT63_FIRST_EFFECT_TEST",
  scope:{
    operation:"CREATE_NEW_FILE",
    rootPath:"C:/GT63_SANDBOX/GT63_FIRST_EFFECT_TEST",
    relativeTargetPath:"GT63_FIRST_OPERATION.txt",
    overwriteAllowed:false,deleteAllowed:false,renameAllowed:false,arbitraryPathAllowed:false
  },
  authorityEffect:"NONE",effectPerformed:false,...o};}
function auth(o={}){return{
  authorizationId:AUTH_ID,
  authorizationState:"AUTHORIZED",
  operation:"CREATE_NEW_FILE",
  payload:{encoding:"UTF-8",bytesBase64:"SGVsbG8gZnJvbSBHVDYz",digest:"sha256:241d88cea11b71564b4aa1597ecf6cc49cb06a3dca4044d0afddd9ca2116f3f9"},
  authorityEffect:"NONE",effectPerformed:false,...o};}
function root(o={}){return{
  resolutionId:ROOT_ID,
  exactEffectAuthorizationId:AUTH_ID,
  resolutionState:"RESOLVED",
  rootPath:"C:/GT63_SANDBOX/GT63_FIRST_EFFECT_TEST",
  target:{kind:"RELATIVE_FILE",path:"GT63_FIRST_OPERATION.txt"},
  targetMustNotExist:true,
  observedTargetExists:false,
  authorityEffect:"NONE",effectPerformed:false,...o};}
function request(o={}){return{rulesetVersion:mod.RULESET_VERSION,toolAuthorityId:TOOL_ID,exactEffectAuthorizationId:AUTH_ID,rootResolutionId:ROOT_ID,...o};}
function system({t=tool(),a=auth(),r=root(),l=ledger(),fail=null}={}){
  const c=mod.createFirstFilesystemEffectExecutionGatewayV0({
    toolAuthorityPort(){if(fail==="tool")throw new Error();return clone(t);},
    exactEffectAuthorizationPort(){if(fail==="auth")throw new Error();return clone(a);},
    rootResolutionPort(){if(fail==="root")throw new Error();return clone(r);},
    executionLedger:l
  });return{c,l};
}
function noEffect(x){assert.equal(x.authorityEffect,"NONE");assert.equal(x.effectPerformed,false);assert.equal(x.effectVerified,false);if(x.execution){assert.equal(x.execution.effectPerformed,false);assert.equal(x.execution.effectVerified,false);}}
const cases=[];function run(n,f){f();cases.push(n);}

run("exact-effect-execution-ready",()=>{const x=system().c.prepare(request());assert.equal(x.outcome,mod.OUTCOMES.READY);noEffect(x);assert.equal(x.execution.executionState,"READY");});
run("unsupported-schema-invalid",()=>assert.equal(system().c.prepare({...request(),x:true}).outcome,mod.OUTCOMES.INVALID));
run("tool-authority-unavailable-unknown",()=>assert.equal(system({fail:"tool"}).c.prepare(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("tool-not-authorized-not-ready",()=>assert.equal(system({t:tool({toolAuthorityState:"DENIED"})}).c.prepare(request()).outcome,mod.OUTCOMES.NOT_READY));
run("tool-widened-overwrite-not-ready",()=>{const t=tool();t.scope.overwriteAllowed=true;assert.equal(system({t}).c.prepare(request()).outcome,mod.OUTCOMES.NOT_READY);});
run("tool-widened-delete-not-ready",()=>{const t=tool();t.scope.deleteAllowed=true;assert.equal(system({t}).c.prepare(request()).outcome,mod.OUTCOMES.NOT_READY);});
run("tool-widened-rename-not-ready",()=>{const t=tool();t.scope.renameAllowed=true;assert.equal(system({t}).c.prepare(request()).outcome,mod.OUTCOMES.NOT_READY);});
run("tool-widened-arbitrary-path-not-ready",()=>{const t=tool();t.scope.arbitraryPathAllowed=true;assert.equal(system({t}).c.prepare(request()).outcome,mod.OUTCOMES.NOT_READY);});
run("authorization-unavailable-unknown",()=>assert.equal(system({fail:"auth"}).c.prepare(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("authorization-mismatch-not-ready",()=>assert.equal(system({a:auth({authorizationId:"other"})}).c.prepare(request()).outcome,mod.OUTCOMES.NOT_READY));
run("root-unavailable-unknown",()=>assert.equal(system({fail:"root"}).c.prepare(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("root-not-resolved-not-ready",()=>assert.equal(system({r:root({resolutionState:"UNKNOWN"})}).c.prepare(request()).outcome,mod.OUTCOMES.NOT_READY));
run("target-already-exists-not-ready",()=>assert.equal(system({r:root({observedTargetExists:true})}).c.prepare(request()).outcome,mod.OUTCOMES.NOT_READY));
run("root-path-mismatch-not-ready",()=>assert.equal(system({r:root({rootPath:"C:/OTHER"})}).c.prepare(request()).outcome,mod.OUTCOMES.NOT_READY));
run("target-path-mismatch-not-ready",()=>{const r=root();r.target.path="other.txt";assert.equal(system({r}).c.prepare(request()).outcome,mod.OUTCOMES.NOT_READY);});
run("duplicate-same-preparation-idempotent",()=>{const s=system();const a=s.c.prepare(request());const b=s.c.prepare(request());assert.equal(a.outcome,mod.OUTCOMES.READY);assert.equal(b.outcome,mod.OUTCOMES.ALREADY_READY);assert.equal(a.execution.executionPreparationId,b.execution.executionPreparationId);});
run("different-existing-preparation-conflict",()=>{const first=system().c.prepare(request());const changed={...first.execution,relativeTargetPath:"other.txt"};assert.equal(system({l:ledger([changed])}).c.prepare(request()).outcome,mod.OUTCOMES.CONFLICT);});
run("multiple-existing-preparations-conflict",()=>{const x={toolAuthorityId:TOOL_ID};assert.equal(system({l:ledger([x,x])}).c.prepare(request()).outcome,mod.OUTCOMES.CONFLICT);});
run("deterministic-preparation-identity",()=>{const a=system().c.prepare(request());const b=system().c.prepare(request());assert.equal(a.execution.executionPreparationId,b.execution.executionPreparationId);});
run("gateway-does-not-perform-effect",()=>assert.equal(system().c.prepare(request()).execution.effectPerformed,false));
run("gateway-does-not-verify-effect",()=>assert.equal(system().c.prepare(request()).execution.effectVerified,false));
run("authority-always-none",()=>{for(const x of [system().c.prepare(request()),system({fail:"root"}).c.prepare(request()),system({r:root({observedTargetExists:true})}).c.prepare(request())])noEffect(x);});

const semantic={cases,rulesetVersion:mod.RULESET_VERSION,outcomes:Object.values(mod.OUTCOMES)};
const validationIdentity="sha256:"+crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
process.stdout.write(JSON.stringify({status:"PASS",workflow:"first-filesystem-effect-execution-gateway-v0-regression",cases:cases.length,validationIdentity,semantic})+"\n");
