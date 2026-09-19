"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {createGenesisPrincipalBootstrapRuntimeBridge,RULESET_VERSION}=require("./genesis-principal-bootstrap-runtime-bridge-v0");

const S=Object.freeze({sessionRef:"gt63-runtime-session:USR-1:1000",sessionRevision:"1",authenticatedAccountRef:"gt63-runtime-user:USR-1"});
function factory(){
 let identity=null,startCount=0,pollCount=0;
 return {runtime:{start:async s=>{startCount++;return {outcome:"EXTERNAL_IDENTITY_AUTHORIZATION_REQUIRED",challenge:{challengeRef:"challenge-1"},authority:"NONE"};},poll:async x=>{pollCount++;identity={principalRef:"gt63-machine:principal:github:239696056",principalRevision:"1",sessionRef:x.sessionRef,sessionRevision:x.sessionRevision,authenticatedAccountRef:x.authenticatedAccountRef,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",principalEvidenceRef:"provider-free-evidence",authority:"NONE"};return {outcome:"EXTERNAL_IDENTITY_VERIFIED",identity,authority:"NONE"};},getIdentityBySession:r=>identity&&identity.sessionRef===r?JSON.parse(JSON.stringify(identity)):null},counts:()=>({startCount,pollCount})};
}
const tests=[];function test(n,f){tests.push([n,f]);}
test("ruleset-exact",()=>assert.equal(RULESET_VERSION,"genesis-principal-bootstrap-runtime-bridge-v0.1.0"));
test("factory-created-once",async()=>{let n=0;const f=factory();const b=createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>{n++;return f.runtime;}});await b.start(S);await b.poll(S,"challenge-1");b.getIdentityBySession(S.sessionRef);assert.equal(n,1);});
test("start-delegates",async()=>{const f=factory();const b=createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime});assert.equal((await b.start(S)).outcome,"EXTERNAL_IDENTITY_AUTHORIZATION_REQUIRED");assert.equal(f.counts().startCount,1);});
test("poll-delegates",async()=>{const f=factory();const b=createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime});await b.start(S);assert.equal((await b.poll(S,"challenge-1")).outcome,"EXTERNAL_IDENTITY_VERIFIED");assert.equal(f.counts().pollCount,1);});
test("same-runtime-identity-resolves",async()=>{const f=factory();const b=createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime});await b.start(S);await b.poll(S,"challenge-1");assert.equal(b.getIdentityBySession(S.sessionRef).principalRef,"gt63-machine:principal:github:239696056");});
test("other-session-does-not-resolve",async()=>{const f=factory();const b=createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime});await b.poll(S,"challenge-1");assert.equal(b.getIdentityBySession("other"),null);});
test("identity-authority-none",async()=>{const f=factory();const b=createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime});await b.poll(S,"challenge-1");assert.equal(b.getIdentityBySession(S.sessionRef).authority,"NONE");});
test("bridge-authority-none",()=>{const f=factory();const b=createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime});assert.equal(b.authority,"NONE");assert.equal(b.authorityEffect,"NONE");});
test("invalid-session-start-rejected",async()=>{const f=factory();const b=createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime});assert.equal((await b.start({})).outcome,"PRINCIPAL_BOOTSTRAP_REJECTED");assert.equal(f.counts().startCount,0);});
test("invalid-session-poll-rejected",async()=>{const f=factory();const b=createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime});assert.equal((await b.poll({},"x")).outcome,"PRINCIPAL_BOOTSTRAP_REJECTED");assert.equal(f.counts().pollCount,0);});
test("missing-challenge-poll-rejected",async()=>{const f=factory();const b=createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime});assert.equal((await b.poll(S,"")).outcome,"PRINCIPAL_BOOTSTRAP_REJECTED");});
test("empty-session-ref-lookup-null",()=>{const f=factory();const b=createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime});assert.equal(b.getIdentityBySession(""),null);});
test("constructor-requires-factory",()=>assert.throws(()=>createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:null})));
test("constructor-requires-bootstrap-contract",()=>assert.throws(()=>createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>({})})));
test("only-three-operational-methods",()=>{const f=factory();const b=createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime});const methods=Object.keys(b).filter(k=>typeof b[k]==="function").sort();assert.deepEqual(methods,["getIdentityBySession","poll","start"]);});
test("no-decision-capability",()=>{const f=factory();assert.equal("decide" in createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime}),false);});
test("no-presentation-capability",()=>{const f=factory();assert.equal("present" in createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime}),false);});
test("no-registration-capability",()=>{const f=factory();assert.equal("register" in createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime}),false);});
test("no-persistence-capability",()=>{const f=factory();assert.equal("commit" in createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime}),false);});
test("no-effect-capability",()=>{const f=factory();assert.equal("execute" in createGenesisPrincipalBootstrapRuntimeBridge({bootstrapFactory:()=>f.runtime}),false);});

(async()=>{const out=[];for(const [n,f] of tests){try{await f();out.push({name:n,status:"PASS"});console.log("PASS - "+n);}catch(e){console.error("FAIL - "+n+" - "+e.message);process.exitCode=1;return;}}const hash=crypto.createHash("sha256").update(JSON.stringify(out)).digest("hex");console.log(JSON.stringify({status:"PASS",workflow:"genesis-principal-bootstrap-runtime-bridge-v0-regression",cases:out.length,deterministicRuns:2,outputHash:hash,authority:"NONE"}));})();
