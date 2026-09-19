"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),mod=require("./gt63-machine/repeatable-filesystem-authorized-root-resolution-v0");
const A="gt63-authorization:repeatable-filesystem:fixture",ROOT="GT63_REPEATABLE_EFFECT_TEST/",TARGET="RUN_2.txt";
const clone=v=>JSON.parse(JSON.stringify(v));
function ledger(seed=[]){const rows=seed.map(clone);return{findByAuthorizationId:id=>rows.filter(x=>x.authorizationId===id).map(clone),commit:x=>(rows.push(clone(x)),clone(x))};}
function auth(o={}){return{authorizationId:A,type:"GT63_REPEATABLE_FILESYSTEM_EXACT_EFFECT_AUTHORIZATION",authorizationState:"AUTHORIZED",consumptionState:"UNCONSUMED",operation:"CREATE_NEW_FILE",authorizedRootIdentity:ROOT,target:{kind:"RELATIVE_FILE",path:TARGET},precondition:{mustNotExist:true},authority:"NONE",authorityEffect:"NONE",effectPerformed:false,...o};}
function reg(o={}){return{authorizedRootIdentity:ROOT,rootPath:"C:/GT63_SANDBOX/GT63_REPEATABLE_EFFECT_TEST",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authorityEffect:"NONE",...o};}
function obs(o={}){return{rootPath:"C:/GT63_SANDBOX/GT63_REPEATABLE_EFFECT_TEST",rootExists:true,rootIsDirectory:true,targetPath:TARGET,targetExists:false,observationState:"CURRENT",contradictionState:"NONE",authorityEffect:"NONE",...o};}
function sys({a=auth(),r=reg(),o=obs(),l=ledger(),fail=null}={}){return mod.createRepeatableFilesystemAuthorizedRootResolutionV0({authorizationPort(){if(fail==="auth")throw Error();return clone(a)},rootRegistryPort(){if(fail==="reg")throw Error();return clone(r)},filesystemObservationPort(){if(fail==="obs")throw Error();return clone(o)},resolutionLedger:l});}
const req={rulesetVersion:mod.RULESET_VERSION,authorizationId:A},cases=[],run=(n,f)=>{f();cases.push(n)};
run("repeatable-root-resolved",()=>assert.equal(sys().resolve(req).outcome,mod.OUTCOMES.RESOLVED));
run("dynamic-root-preserved",()=>assert.equal(sys().resolve(req).resolution.authorizedRootIdentity,ROOT));
run("dynamic-target-preserved",()=>assert.equal(sys().resolve(req).resolution.target.path,TARGET));
run("target-absent-proven",()=>assert.equal(sys().resolve(req).resolution.targetExists,false));
run("unsupported-schema-invalid",()=>assert.equal(sys().resolve({...req,x:1}).outcome,mod.OUTCOMES.INVALID));
run("authorization-unavailable-unknown",()=>assert.equal(sys({fail:"auth"}).resolve(req).outcome,mod.OUTCOMES.UNKNOWN));
run("consumed-authorization-unknown",()=>assert.equal(sys({a:auth({consumptionState:"CONSUMED"})}).resolve(req).outcome,mod.OUTCOMES.UNKNOWN));
run("wrong-operation-unknown",()=>assert.equal(sys({a:auth({operation:"DELETE_FILE"})}).resolve(req).outcome,mod.OUTCOMES.UNKNOWN));
run("registry-unavailable-unknown",()=>assert.equal(sys({fail:"reg"}).resolve(req).outcome,mod.OUTCOMES.UNKNOWN));
run("registry-stale-unknown",()=>assert.equal(sys({r:reg({freshnessState:"STALE"})}).resolve(req).outcome,mod.OUTCOMES.UNKNOWN));
run("registry-mismatch-unknown",()=>assert.equal(sys({r:reg({authorizedRootIdentity:"OTHER/"})}).resolve(req).outcome,mod.OUTCOMES.UNKNOWN));
run("observation-unavailable-unknown",()=>assert.equal(sys({fail:"obs"}).resolve(req).outcome,mod.OUTCOMES.UNKNOWN));
run("root-missing-not-resolved",()=>assert.equal(sys({o:obs({rootExists:false})}).resolve(req).outcome,mod.OUTCOMES.NOT_RESOLVED));
run("root-not-directory-not-resolved",()=>assert.equal(sys({o:obs({rootIsDirectory:false})}).resolve(req).outcome,mod.OUTCOMES.NOT_RESOLVED));
run("target-exists-not-resolved",()=>assert.equal(sys({o:obs({targetExists:true})}).resolve(req).outcome,mod.OUTCOMES.NOT_RESOLVED));
run("absolute-target-rejected",()=>assert.equal(mod.strictDescendant("C:/ROOT","C:/evil.txt"),false));
run("traversal-rejected",()=>assert.equal(mod.strictDescendant("C:/ROOT","../evil.txt"),false));
run("deterministic-resolution-id",()=>assert.equal(sys().resolve(req).resolution.rootResolutionId,sys().resolve(req).resolution.rootResolutionId));
run("same-resolution-idempotent",()=>{const l=ledger(),s=sys({l});const x=s.resolve(req),y=s.resolve(req);assert.equal(x.outcome,mod.OUTCOMES.RESOLVED);assert.equal(y.outcome,mod.OUTCOMES.ALREADY_RESOLVED);});
run("different-resolution-conflict",()=>{const x=sys().resolve(req).resolution;assert.equal(sys({l:ledger([{...x,rootPath:"C:/OTHER"}])}).resolve(req).outcome,mod.OUTCOMES.CONFLICT)});
run("resolution-authority-none",()=>assert.equal(sys().resolve(req).authority,"NONE"));
run("resolution-no-tool-authority",()=>assert.equal(sys().resolve(req).filesystemToolAuthority,false));
run("resolution-no-effect",()=>assert.equal(sys().resolve(req).effectPerformed,false));
run("resolution-current-view",()=>{const x=sys().resolve(req).resolution;assert.equal(x.lifecycleState,"CURRENT");assert.equal(x.freshnessState,"CURRENT");assert.equal(x.contradictionState,"NONE")});
const semantic={cases,rulesetVersion:mod.RULESET_VERSION,providerEvidence:"SYNTHETIC_PROVIDER_FREE"};
const validationIdentity="sha256:"+crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
process.stdout.write(JSON.stringify({status:"PASS",workflow:"repeatable-filesystem-authorized-root-resolution-v0-regression",cases:cases.length,validationIdentity,providerEvidence:"SYNTHETIC_PROVIDER_FREE",semantic})+"\n");
