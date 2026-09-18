"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const mod=require("./gt63-machine/first-filesystem-authorized-root-resolution-v0");

const AUTH_ID="gt63-authorization:first-filesystem-exact-effect:fixture";

function clone(v){return JSON.parse(JSON.stringify(v));}
function ledger(seed=[]){const rows=seed.map(clone);return{
  findByAuthorizationId(id){return rows.filter(x=>x.exactEffectAuthorizationId===id).map(clone);},
  commit(x){rows.push(clone(x));return clone(x);}
};}
function auth(o={}){return{
  authorizationId:AUTH_ID,authorizationState:"AUTHORIZED",
  effectContractRef:mod.EXPECTED.effectContractRef,
  authorizedRootIdentity:mod.EXPECTED.authorizedRootIdentity,
  target:{kind:"RELATIVE_FILE",path:mod.EXPECTED.targetPath},
  authorityEffect:"NONE",authorizedRootResolved:false,filesystemToolAuthority:false,effectPerformed:false,...o};}
function registry(o={}){return{
  authorizedRootIdentity:mod.EXPECTED.authorizedRootIdentity,
  rootPath:"C:/GT63_SANDBOX/GT63_FIRST_EFFECT_TEST",
  lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authorityEffect:"NONE",...o};}
function observation(o={}){return{
  rootPath:"C:/GT63_SANDBOX/GT63_FIRST_EFFECT_TEST",
  rootExists:true,rootIsDirectory:true,targetPath:mod.EXPECTED.targetPath,targetExists:false,
  observationState:"CURRENT",contradictionState:"NONE",authorityEffect:"NONE",...o};}
function request(o={}){return{rulesetVersion:mod.RULESET_VERSION,exactEffectAuthorizationId:AUTH_ID,authorizedRootIdentity:mod.EXPECTED.authorizedRootIdentity,...o};}
function system({a=auth(),r=registry(),o=observation(),l=ledger(),fail=null}={}){
  const c=mod.createFirstFilesystemAuthorizedRootResolutionV0({
    exactEffectAuthorizationPort(){if(fail==="auth")throw new Error();return clone(a);},
    rootRegistryPort(){if(fail==="registry")throw new Error();return clone(r);},
    filesystemObservationPort(){if(fail==="observation")throw new Error();return clone(o);},
    resolutionLedger:l
  });
  return {c,l};
}
function noTool(x){assert.equal(x.authorityEffect,"NONE");assert.equal(x.filesystemToolAuthority,false);assert.equal(x.effectPerformed,false);}
const cases=[];function run(n,f){f();cases.push(n);}

run("exact-authorized-root-resolved",()=>{const x=system().c.resolve(request());assert.equal(x.outcome,mod.OUTCOMES.RESOLVED);noTool(x);});
run("unsupported-schema-invalid",()=>assert.equal(system().c.resolve({...request(),x:true}).outcome,mod.OUTCOMES.INVALID));
run("wrong-root-identity-invalid",()=>assert.equal(system().c.resolve(request({authorizedRootIdentity:"OTHER/"})).outcome,mod.OUTCOMES.INVALID));
run("authorization-unavailable-unknown",()=>assert.equal(system({fail:"auth"}).c.resolve(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("authorization-not-authorized-unknown",()=>assert.equal(system({a:auth({authorizationState:"DENIED"})}).c.resolve(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("authorization-already-root-resolved-unknown",()=>assert.equal(system({a:auth({authorizedRootResolved:true})}).c.resolve(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("registry-unavailable-unknown",()=>assert.equal(system({fail:"registry"}).c.resolve(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("registry-stale-unknown",()=>assert.equal(system({r:registry({freshnessState:"STALE"})}).c.resolve(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("registry-contradictory-unknown",()=>assert.equal(system({r:registry({contradictionState:"CONFLICT"})}).c.resolve(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("absolute-target-not-resolved",()=>assert.equal(mod.strictDescendant("C:/ROOT","C:/evil.txt"),false));
run("dotdot-traversal-not-resolved",()=>assert.equal(mod.strictDescendant("C:/ROOT","../evil.txt"),false));
run("textual-prefix-collision-not-resolved",()=>assert.equal(mod.strictDescendant("C:/ROOT","../ROOT2/file.txt"),false));
run("root-missing-not-resolved",()=>assert.equal(system({o:observation({rootExists:false})}).c.resolve(request()).outcome,mod.OUTCOMES.NOT_RESOLVED));
run("root-not-directory-not-resolved",()=>assert.equal(system({o:observation({rootIsDirectory:false})}).c.resolve(request()).outcome,mod.OUTCOMES.NOT_RESOLVED));
run("target-already-exists-not-resolved",()=>assert.equal(system({o:observation({targetExists:true})}).c.resolve(request()).outcome,mod.OUTCOMES.NOT_RESOLVED));
run("observation-unavailable-unknown",()=>assert.equal(system({fail:"observation"}).c.resolve(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("duplicate-same-resolution-idempotent",()=>{const s=system();const a=s.c.resolve(request());const b=s.c.resolve(request());assert.equal(a.outcome,mod.OUTCOMES.RESOLVED);assert.equal(b.outcome,mod.OUTCOMES.ALREADY_RESOLVED);assert.equal(a.resolution.resolutionId,b.resolution.resolutionId);});
run("different-existing-resolution-conflict",()=>{const first=system().c.resolve(request());const changed={...first.resolution,rootPath:"C:/OTHER"};assert.equal(system({l:ledger([changed])}).c.resolve(request()).outcome,mod.OUTCOMES.CONFLICT);});
run("multiple-existing-resolutions-conflict",()=>{const x={exactEffectAuthorizationId:AUTH_ID};assert.equal(system({l:ledger([x,x])}).c.resolve(request()).outcome,mod.OUTCOMES.CONFLICT);});
run("deterministic-resolution-identity",()=>{const a=system().c.resolve(request());const b=system().c.resolve(request());assert.equal(a.resolution.resolutionId,b.resolution.resolutionId);});
run("resolution-does-not-create-tool-authority",()=>assert.equal(system().c.resolve(request()).resolution.filesystemToolAuthority,false));
run("resolution-does-not-perform-effect",()=>assert.equal(system().c.resolve(request()).resolution.effectPerformed,false));
run("authority-always-none",()=>{for(const x of [system().c.resolve(request()),system({fail:"registry"}).c.resolve(request()),system({o:observation({targetExists:true})}).c.resolve(request())])noTool(x);});

const semantic={cases,rulesetVersion:mod.RULESET_VERSION,outcomes:Object.values(mod.OUTCOMES)};
const validationIdentity="sha256:"+crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
process.stdout.write(JSON.stringify({status:"PASS",workflow:"first-filesystem-authorized-root-resolution-v0-regression",cases:cases.length,validationIdentity,semantic})+"\n");
