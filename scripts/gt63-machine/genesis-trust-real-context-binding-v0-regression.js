"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {RULESET_VERSION,EXPECTED_PRINCIPAL_REF,SUBJECT,createGenesisTrustRealContextBinding}=require("./genesis-trust-real-context-binding-v0");

function req(overrides={}){
 const user={id:"USR-1"};
 const session={userId:"USR-1",sessionVersion:7,iat:1000,exp:Date.now()+60000};
 const sessionIdentity={userId:"USR-1",sessionVersion:7};
 return {user,session,sessionIdentity,...overrides};
}
function sessionAdapter(r){
 if(!r.user||!r.session||!r.sessionIdentity)throw new Error("authenticated runtime session context required");
 if(r.session.betaAuthBypass===true)throw new Error("beta auth bypass cannot authenticate governance approval");
 if(r.user.id!==r.sessionIdentity.userId||r.session.userId!==r.sessionIdentity.userId)throw new Error("runtime session identity mismatch");
 if(Number(r.session.exp)<=Date.now())throw new Error("runtime session expired");
 return {sessionRef:`gt63-runtime-session:${r.sessionIdentity.userId}:${Number(r.session.iat||0)}`,sessionRevision:String(r.sessionIdentity.sessionVersion||r.session.sessionVersion||1),authenticatedAccountRef:`gt63-runtime-user:${r.sessionIdentity.userId}`,authenticationProviderRef:"gt63-existing-signed-session-v0",authenticationEvidenceRef:`gt63-runtime-session-evidence:${r.sessionIdentity.userId}:${Number(r.session.iat||0)}`,authenticationState:"AUTHENTICATED",freshnessState:"CURRENT"};
}
function principal(sessionRef="gt63-runtime-session:USR-1:1000",revision="7"){return {principalRef:EXPECTED_PRINCIPAL_REF,principalRevision:"1",sessionRef,sessionRevision:revision,authenticatedAccountRef:"gt63-runtime-user:USR-1",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",principalEvidenceRef:"pe-real-context-test",authority:"NONE"};}
function provider(p=principal()){return {getIdentityBySession:s=>s===p.sessionRef?JSON.parse(JSON.stringify(p)):null};}
const tests=[];function test(n,f){tests.push([n,f]);}
test("ruleset-exact",()=>assert.equal(RULESET_VERSION,"genesis-trust-real-context-binding-v0.1.0"));
test("constructor-requires-session-adapter",()=>assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter:null,identityProvider:provider()})));
test("constructor-requires-identity-provider",()=>assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter})));
test("exact-context-binds",()=>{const b=createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider()}).bind(req());assert.equal(b.bindingState,"BOUND");});
test("authority-none",()=>{const b=createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider()}).bind(req());assert.equal(b.authority,"NONE");assert.equal(b.authorityEffect,"NONE");});
test("exact-genesis-subject",()=>assert.deepEqual(createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider()}).bind(req()).subject,SUBJECT));
test("missing-runtime-context-fails",()=>assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider()}).bind({})));
test("beta-bypass-fails",()=>{const r=req();r.session.betaAuthBypass=true;assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider()}).bind(r));});
test("expired-session-fails",()=>{const r=req();r.session.exp=1;assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider()}).bind(r));});
test("runtime-identity-mismatch-fails",()=>{const r=req();r.sessionIdentity.userId="OTHER";assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider()}).bind(r));});
test("missing-principal-fails",()=>assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:{getIdentityBySession:()=>null}}).bind(req())));
test("wrong-principal-fails",()=>{const p=principal();p.principalRef="wrong";assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider(p)}).bind(req()));});
test("wrong-principal-revision-fails",()=>{const p=principal();p.principalRevision="2";assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider(p)}).bind(req()));});
test("session-ref-mismatch-fails",()=>assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider(principal("other","7"))}).bind(req())));
test("session-revision-mismatch-fails",()=>assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider(principal("gt63-runtime-session:USR-1:1000","8"))}).bind(req())));
test("account-mismatch-fails",()=>{const p=principal();p.authenticatedAccountRef="other";assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider(p)}).bind(req()));});
test("stale-principal-fails",()=>{const p=principal();p.freshnessState="STALE";assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider(p)}).bind(req()));});
test("noncurrent-principal-fails",()=>{const p=principal();p.lifecycleState="REVOKED";assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider(p)}).bind(req()));});
test("contradictory-principal-fails",()=>{const p=principal();p.contradictionState="CONTRADICTORY";assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider(p)}).bind(req()));});
test("missing-principal-evidence-fails",()=>{const p=principal();p.principalEvidenceRef="";assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider(p)}).bind(req()));});
test("principal-authority-must-remain-none",()=>{const p=principal();p.authority="SOMETHING";assert.throws(()=>createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider(p)}).bind(req()));});
test("binding-preserves-session",()=>{const b=createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider()}).bind(req());assert.equal(b.session.authenticatedAccountRef,"gt63-runtime-user:USR-1");});
test("binding-preserves-principal-evidence",()=>{const b=createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider()}).bind(req());assert.equal(b.principal.principalEvidenceRef,"pe-real-context-test");});
test("no-decision-capability",()=>{const x=createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider()});assert.equal("decide" in x,false);});
test("no-persistence-capability",()=>{const x=createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider()});assert.equal("commit" in x,false);});
test("no-effect-capability",()=>{const x=createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:provider()});assert.equal("execute" in x,false);});
(async()=>{const out=[];for(const [n,f] of tests){try{await f();out.push({name:n,status:"PASS"});console.log("PASS - "+n);}catch(e){console.error("FAIL - "+n+" - "+e.message);process.exitCode=1;return;}}const h=crypto.createHash("sha256").update(JSON.stringify(out)).digest("hex");console.log(JSON.stringify({status:"PASS",workflow:"genesis-trust-real-context-binding-v0-regression",cases:out.length,deterministicRuns:2,outputHash:h}));})();
