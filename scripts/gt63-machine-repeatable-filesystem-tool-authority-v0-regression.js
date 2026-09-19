"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),mod=require("./gt63-machine/repeatable-filesystem-tool-authority-v0");
const A="gt63-authorization:repeatable-filesystem:fixture",R="gt63-resolution:repeatable-filesystem-root:fixture",D="gt63-machine:filesystem-adapter:create-new-file-v0",REV="1";
const clone=v=>JSON.parse(JSON.stringify(v));
function ledger(seed=[]){const rows=seed.map(clone);return{findByAuthorizationId:id=>rows.filter(x=>x.authorizationId===id).map(clone),commit:x=>(rows.push(clone(x)),clone(x))};}
function auth(o={}){return{authorizationId:A,type:"GT63_REPEATABLE_FILESYSTEM_EXACT_EFFECT_AUTHORIZATION",authorizationState:"AUTHORIZED",consumptionState:"UNCONSUMED",operation:"CREATE_NEW_FILE",authorizedRootIdentity:"GT63_REPEATABLE_EFFECT_TEST/",target:{kind:"RELATIVE_FILE",path:"RUN_2.txt"},precondition:{mustNotExist:true},authority:"NONE",authorityEffect:"NONE",effectPerformed:false,...o};}
function root(o={}){return{rootResolutionId:R,type:"GT63_REPEATABLE_FILESYSTEM_AUTHORIZED_ROOT_RESOLUTION",authorizationId:A,authorizedRootIdentity:"GT63_REPEATABLE_EFFECT_TEST/",rootPath:"C:/GT63_SANDBOX/GT63_REPEATABLE_EFFECT_TEST",rootState:"RESOLVED",target:{kind:"RELATIVE_FILE",path:"RUN_2.txt"},targetExists:false,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE",authorityEffect:"NONE",filesystemToolAuthority:false,effectPerformed:false,...o};}
function adapter(o={}){return{adapterRef:D,adapterRevision:REV,capability:"CREATE_NEW_FILE",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authorityEffect:"NONE",...o};}
function sys({a=auth(),r=root(),d=adapter(),l=ledger(),fail=null}={}){return mod.createRepeatableFilesystemToolAuthorityV0({authorizationPort(){if(fail==="a")throw Error();return clone(a)},rootResolutionPort(){if(fail==="r")throw Error();return clone(r)},adapterRegistryPort(){if(fail==="d")throw Error();return clone(d)},authorityLedger:l});}
const req={rulesetVersion:mod.RULESET_VERSION,authorizationId:A,rootResolutionId:R,adapterRef:D,adapterRevision:REV},cases=[],run=(n,f)=>{f();cases.push(n)};
run("exact-create-new-file-tool-authorized",()=>assert.equal(sys().authorize(req).outcome,mod.OUTCOMES.AUTHORIZED));
run("scope-create-new-file-only",()=>assert.equal(sys().authorize(req).toolAuthority.scope.operation,"CREATE_NEW_FILE"));
run("overwrite-forbidden",()=>assert.equal(sys().authorize(req).toolAuthority.scope.overwriteAllowed,false));
run("delete-forbidden",()=>assert.equal(sys().authorize(req).toolAuthority.scope.deleteAllowed,false));
run("rename-forbidden",()=>assert.equal(sys().authorize(req).toolAuthority.scope.renameAllowed,false));
run("arbitrary-path-forbidden",()=>assert.equal(sys().authorize(req).toolAuthority.scope.arbitraryPathAllowed,false));
run("unsupported-schema-invalid",()=>assert.equal(sys().authorize({...req,x:1}).outcome,mod.OUTCOMES.INVALID));
run("authorization-unavailable-unknown",()=>assert.equal(sys({fail:"a"}).authorize(req).outcome,mod.OUTCOMES.UNKNOWN));
run("consumed-authorization-unknown",()=>assert.equal(sys({a:auth({consumptionState:"CONSUMED"})}).authorize(req).outcome,mod.OUTCOMES.UNKNOWN));
run("root-unavailable-unknown",()=>assert.equal(sys({fail:"r"}).authorize(req).outcome,mod.OUTCOMES.UNKNOWN));
run("root-mismatch-not-authorized",()=>assert.equal(sys({r:root({authorizationId:"other"})}).authorize(req).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("root-stale-not-authorized",()=>assert.equal(sys({r:root({freshnessState:"STALE"})}).authorize(req).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("target-exists-not-authorized",()=>assert.equal(sys({r:root({targetExists:true})}).authorize(req).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("adapter-unavailable-unknown",()=>assert.equal(sys({fail:"d"}).authorize(req).outcome,mod.OUTCOMES.UNKNOWN));
run("wrong-capability-not-authorized",()=>assert.equal(sys({d:adapter({capability:"OVERWRITE_FILE"})}).authorize(req).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("stale-adapter-not-authorized",()=>assert.equal(sys({d:adapter({freshnessState:"STALE"})}).authorize(req).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("contradictory-adapter-not-authorized",()=>assert.equal(sys({d:adapter({contradictionState:"CONFLICT"})}).authorize(req).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("deterministic-tool-authority-id",()=>assert.equal(sys().authorize(req).toolAuthority.toolAuthorityId,sys().authorize(req).toolAuthority.toolAuthorityId));
run("same-authority-idempotent",()=>{const l=ledger(),s=sys({l}),x=s.authorize(req),y=s.authorize(req);assert.equal(x.outcome,mod.OUTCOMES.AUTHORIZED);assert.equal(y.outcome,mod.OUTCOMES.ALREADY_AUTHORIZED)});
run("different-authority-conflict",()=>{const x=sys().authorize(req).toolAuthority;assert.equal(sys({l:ledger([{...x,adapterRevision:"2"}])}).authorize(req).outcome,mod.OUTCOMES.CONFLICT)});
run("tool-authority-record-authority-none",()=>assert.equal(sys().authorize(req).toolAuthority.authority,"NONE"));
run("result-authority-none",()=>assert.equal(sys().authorize(req).authority,"NONE"));
run("tool-authority-does-not-perform-effect",()=>assert.equal(sys().authorize(req).toolAuthority.effectPerformed,false));
run("authorization-target-preserved",()=>assert.equal(sys().authorize(req).toolAuthority.target.path,"RUN_2.txt"));
run("root-path-preserved",()=>assert.equal(sys().authorize(req).toolAuthority.rootPath,"C:/GT63_SANDBOX/GT63_REPEATABLE_EFFECT_TEST"));
const semantic={cases,rulesetVersion:mod.RULESET_VERSION,providerEvidence:"SYNTHETIC_PROVIDER_FREE"};
const validationIdentity="sha256:"+crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
process.stdout.write(JSON.stringify({status:"PASS",workflow:"repeatable-filesystem-tool-authority-v0-regression",cases:cases.length,validationIdentity,providerEvidence:"SYNTHETIC_PROVIDER_FREE",semantic})+"\n");
