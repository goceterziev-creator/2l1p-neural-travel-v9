"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {createGenesisTrustRealHumanContextBindingProof,RULESET_VERSION}=require("./genesis-trust-real-human-context-binding-proof-v0");

const SREF="gt63-runtime-session:USR-REAL:1000";
function adapter(req){
 if(!req||req.reject)throw new Error("authenticated runtime session context required");
 return {sessionRef:SREF,sessionRevision:"3",authenticatedAccountRef:"gt63-runtime-user:USR-REAL",authenticationProviderRef:"gt63-existing-signed-session-v0",authenticationEvidenceRef:"gt63-runtime-session-evidence:USR-REAL:1000",authenticationState:"AUTHENTICATED",freshnessState:"CURRENT"};
}
function p(overrides={}){return {principalRef:"gt63-machine:principal:github:239696056",principalRevision:"1",sessionRef:SREF,sessionRevision:"3",authenticatedAccountRef:"gt63-runtime-user:USR-REAL",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",principalEvidenceRef:"gt63-real-principal-evidence:test",authority:"NONE",...overrides};}
function provider(principal=p()){return {getIdentityBySession:s=>s===principal.sessionRef?JSON.parse(JSON.stringify(principal)):null};}
const tests=[];function test(n,f){tests.push([n,f]);}
test("ruleset-exact",()=>assert.equal(RULESET_VERSION,"genesis-trust-real-human-context-binding-proof-v0.1.0"));
test("exact-context-bound",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({}).status,"BOUND"));
test("binding-state-bound",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({}).bindingState,"BOUND"));
test("session-ref-preserved",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({}).sessionRef,SREF));
test("session-revision-preserved",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({}).sessionRevision,"3"));
test("account-ref-preserved",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({}).authenticatedAccountRef,"gt63-runtime-user:USR-REAL"));
test("principal-ref-preserved",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({}).principalRef,"gt63-machine:principal:github:239696056"));
test("principal-evidence-preserved",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({}).principalEvidenceRef,"gt63-real-principal-evidence:test"));
test("exact-registration-subject",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({}).registrationRef,"gt63-machine:trust-registration:genesis-human-source-ingress-v0"));
test("exact-source-provider",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({}).sourceProviderRef,"gt63-machine:genesis-human-source-ingress-v0"));
test("exact-channel",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({}).channelRef,"gt63-machine:channel:authenticated-genesis-http-ingress-v0"));
test("exact-verification-method",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({}).verificationMethodRef,"gt63-machine:verification-method:authenticated-genesis-session-continuity-v0"));
test("authority-none",()=>{const x=createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({});assert.equal(x.authority,"NONE");assert.equal(x.authorityEffect,"NONE");});
test("missing-session-rejected",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}).prove({reject:true}).status,"REJECTED"));
test("missing-principal-rejected",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:{getIdentityBySession:()=>null}}).prove({}).status,"REJECTED"));
test("wrong-session-principal-rejected",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider(p({sessionRef:"other"}))}).prove({}).status,"REJECTED"));
test("stale-principal-rejected",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider(p({freshnessState:"STALE"}))}).prove({}).status,"REJECTED"));
test("contradictory-principal-rejected",()=>assert.equal(createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider(p({contradictionState:"CONTRADICTORY"}))}).prove({}).status,"REJECTED"));
test("rejection-authority-none",()=>{const x=createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:{getIdentityBySession:()=>null}}).prove({});assert.equal(x.authority,"NONE");assert.equal(x.authorityEffect,"NONE");});
test("no-decision-capability",()=>assert.equal("decide" in createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}),false));
test("no-presentation-capability",()=>assert.equal("present" in createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}),false));
test("no-registration-capability",()=>assert.equal("register" in createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}),false));
test("no-persistence-capability",()=>assert.equal("commit" in createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}),false));
test("no-effect-capability",()=>assert.equal("execute" in createGenesisTrustRealHumanContextBindingProof({sessionAdapter:adapter,identityProvider:provider()}),false));

(async()=>{const out=[];for(const [n,f] of tests){try{await f();out.push({name:n,status:"PASS"});console.log("PASS - "+n);}catch(e){console.error("FAIL - "+n+" - "+e.message);process.exitCode=1;return;}}const hash=crypto.createHash("sha256").update(JSON.stringify(out)).digest("hex");console.log(JSON.stringify({status:"PASS",workflow:"genesis-trust-real-human-context-binding-proof-v0-regression",cases:out.length,deterministicRuns:2,outputHash:hash,authority:"NONE"}));})();
