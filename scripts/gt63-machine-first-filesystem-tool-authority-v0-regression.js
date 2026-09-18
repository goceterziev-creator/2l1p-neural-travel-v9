"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const mod=require("./gt63-machine/first-filesystem-tool-authority-v0");

const AUTH_ID="gt63-authorization:first-filesystem-exact-effect:fixture";
const ROOT_ID="gt63-resolution:first-filesystem-root:fixture";
const ADAPTER_REF="gt63-machine:filesystem-adapter:create-new-file-v0";
const ADAPTER_REV="1";

function clone(v){return JSON.parse(JSON.stringify(v));}
function ledger(seed=[]){const rows=seed.map(clone);return{findByAuthorizationId(id){return rows.filter(x=>x.exactEffectAuthorizationId===id).map(clone);},commit(x){rows.push(clone(x));return clone(x);}};}
function auth(o={}){return{authorizationId:AUTH_ID,authorizationState:"AUTHORIZED",authorityEffect:"NONE",effectPerformed:false,...o};}
function root(o={}){return{
  resolutionId:ROOT_ID,exactEffectAuthorizationId:AUTH_ID,resolutionState:"RESOLVED",
  rootPath:"C:/GT63_SANDBOX/GT63_FIRST_EFFECT_TEST",
  target:{kind:"RELATIVE_FILE",path:"GT63_FIRST_OPERATION.txt"},
  authorityEffect:"NONE",filesystemToolAuthority:false,effectPerformed:false,...o};}
function adapter(o={}){return{
  adapterRef:ADAPTER_REF,adapterRevision:ADAPTER_REV,capability:"CREATE_NEW_FILE",
  lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authorityEffect:"NONE",...o};}
function request(o={}){return{rulesetVersion:mod.RULESET_VERSION,exactEffectAuthorizationId:AUTH_ID,rootResolutionId:ROOT_ID,adapterRef:ADAPTER_REF,adapterRevision:ADAPTER_REV,...o};}
function system({a=auth(),r=root(),d=adapter(),l=ledger(),fail=null}={}){
  const c=mod.createFirstFilesystemToolAuthorityV0({
    exactEffectAuthorizationPort(){if(fail==="auth")throw new Error();return clone(a);},
    rootResolutionPort(){if(fail==="root")throw new Error();return clone(r);},
    adapterRegistryPort(){if(fail==="adapter")throw new Error();return clone(d);},
    authorityLedger:l
  });return{c,l};
}
function noEffect(x){assert.equal(x.authorityEffect,"NONE");assert.equal(x.effectPerformed,false);if(x.toolAuthority)assert.equal(x.toolAuthority.effectPerformed,false);}
const cases=[];function run(n,f){f();cases.push(n);}

run("exact-create-new-file-tool-authority-authorized",()=>{const x=system().c.authorize(request());assert.equal(x.outcome,mod.OUTCOMES.AUTHORIZED);noEffect(x);assert.equal(x.toolAuthority.toolAuthorityState,"AUTHORIZED");});
run("unsupported-schema-invalid",()=>assert.equal(system().c.authorize({...request(),x:true}).outcome,mod.OUTCOMES.INVALID));
run("authorization-unavailable-unknown",()=>assert.equal(system({fail:"auth"}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("authorization-not-authorized-unknown",()=>assert.equal(system({a:auth({authorizationState:"DENIED"})}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("root-unavailable-unknown",()=>assert.equal(system({fail:"root"}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("root-not-resolved-not-authorized",()=>assert.equal(system({r:root({resolutionState:"UNKNOWN"})}).c.authorize(request()).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("root-binds-different-authorization-not-authorized",()=>assert.equal(system({r:root({exactEffectAuthorizationId:"other"})}).c.authorize(request()).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("adapter-unavailable-unknown",()=>assert.equal(system({fail:"adapter"}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("wrong-adapter-capability-not-authorized",()=>assert.equal(system({d:adapter({capability:"OVERWRITE_FILE"})}).c.authorize(request()).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("stale-adapter-not-authorized",()=>assert.equal(system({d:adapter({freshnessState:"STALE"})}).c.authorize(request()).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("contradictory-adapter-not-authorized",()=>assert.equal(system({d:adapter({contradictionState:"CONFLICT"})}).c.authorize(request()).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("scope-create-new-file-only",()=>{const x=system().c.authorize(request()).toolAuthority.scope;assert.equal(x.operation,"CREATE_NEW_FILE");assert.equal(x.overwriteAllowed,false);assert.equal(x.deleteAllowed,false);assert.equal(x.renameAllowed,false);assert.equal(x.arbitraryPathAllowed,false);});
run("duplicate-same-tool-authority-idempotent",()=>{const s=system();const a=s.c.authorize(request());const b=s.c.authorize(request());assert.equal(a.outcome,mod.OUTCOMES.AUTHORIZED);assert.equal(b.outcome,mod.OUTCOMES.ALREADY_AUTHORIZED);assert.equal(a.toolAuthority.toolAuthorityId,b.toolAuthority.toolAuthorityId);});
run("different-existing-tool-authority-conflict",()=>{const first=system().c.authorize(request());const changed={...first.toolAuthority,adapterRevision:"2"};assert.equal(system({l:ledger([changed])}).c.authorize(request()).outcome,mod.OUTCOMES.CONFLICT);});
run("multiple-tool-authorities-conflict",()=>{const x={exactEffectAuthorizationId:AUTH_ID};assert.equal(system({l:ledger([x,x])}).c.authorize(request()).outcome,mod.OUTCOMES.CONFLICT);});
run("deterministic-tool-authority-identity",()=>{const a=system().c.authorize(request());const b=system().c.authorize(request());assert.equal(a.toolAuthority.toolAuthorityId,b.toolAuthority.toolAuthorityId);});
run("tool-authority-does-not-perform-effect",()=>assert.equal(system().c.authorize(request()).toolAuthority.effectPerformed,false));
run("authority-record-does-not-widen-operation",()=>{const x=system().c.authorize(request()).toolAuthority.scope;assert.deepEqual({overwrite:x.overwriteAllowed,del:x.deleteAllowed,rename:x.renameAllowed,arbitrary:x.arbitraryPathAllowed},{overwrite:false,del:false,rename:false,arbitrary:false});});
run("authority-always-none-before-effect",()=>{for(const x of [system().c.authorize(request()),system({fail:"root"}).c.authorize(request()),system({d:adapter({capability:"BAD"})}).c.authorize(request())])noEffect(x);});

const semantic={cases,rulesetVersion:mod.RULESET_VERSION,outcomes:Object.values(mod.OUTCOMES)};
const validationIdentity="sha256:"+crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
process.stdout.write(JSON.stringify({status:"PASS",workflow:"first-filesystem-tool-authority-v0-regression",cases:cases.length,validationIdentity,semantic})+"\n");
