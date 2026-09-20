"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const http=require("node:http");
const {RULESET_VERSION,ROUTES,DECISIONS,createIsolatedRealHumanGenesisTrustDecisionSurface,createIsolatedDecisionApp}=require("./isolated-real-human-genesis-trust-decision-surface-v0");
const SESSION=Object.freeze({sessionRef:"gt63-runtime-session:USR-ADMIN:1",sessionRevision:"1",authenticatedAccountRef:"gt63-runtime-user:USR-ADMIN",authenticationProviderRef:"gt63-existing-signed-session-v0",authenticationEvidenceRef:"gt63-runtime-session-evidence:USR-ADMIN:1",authenticationState:"AUTHENTICATED",freshnessState:"CURRENT"});
const PRINCIPAL=Object.freeze({principalRef:"gt63-machine:principal:github:239696056",principalRevision:"1",sessionRef:SESSION.sessionRef,sessionRevision:"1",authenticatedAccountRef:SESSION.authenticatedAccountRef,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",principalEvidenceRef:"provider-free-principal-evidence",authority:"NONE"});
const CONTEXT=Object.freeze({bindingState:"BOUND",session:SESSION,principal:PRINCIPAL});
function factory(ctx=CONTEXT){return createIsolatedRealHumanGenesisTrustDecisionSurface({contextProvider:()=>ctx,clock:()=>"2026-09-20T13:00:00.000Z"});}
async function request(server,{url,body={}}){const data=JSON.stringify(body);return new Promise((resolve,reject)=>{const a=server.address();const q=http.request({host:"127.0.0.1",port:a.port,path:url,method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(data),"x-test-auth":"yes"}},r=>{let s="";r.on("data",x=>s+=x);r.on("end",()=>{let json=null;try{json=JSON.parse(s);}catch(_){}resolve({status:r.statusCode,body:s,json});});});q.on("error",reject);q.write(data);q.end();});}
async function withServer(fn){const surface=factory();const app=createIsolatedDecisionApp({surface,authenticate:req=>{if(req.headers["x-test-auth"]!=="yes")throw new Error("auth");}});const s=app.listen(0,"127.0.0.1");await new Promise(r=>s.once("listening",r));try{return await fn(s);}finally{await new Promise(r=>s.close(r));}}
const tests=[];function test(n,f){tests.push([n,f]);}
test("ruleset-exact",()=>assert.equal(RULESET_VERSION,"isolated-real-human-genesis-trust-decision-surface-v0.1.0"));
test("routes-exact-two-only",()=>assert.deepEqual(ROUTES.map(x=>x.method+" "+x.path),["POST /api/gt63/genesis-trust-decision/present","POST /api/gt63/genesis-trust-decision/decide"]));
test("decisions-exact",()=>assert.deepEqual([...DECISIONS],["APPROVE_TRUST_REGISTRATION","REJECT_TRUST_REGISTRATION"]));
test("present-exact-subject",()=>{const x=factory().present({});assert.equal(x.presentation.registrationRef,"gt63-machine:trust-registration:genesis-human-source-ingress-v0");assert.equal(x.presentation.principalRef,PRINCIPAL.principalRef);});
test("present-authority-none",()=>{const x=factory().present({});assert.equal(x.authority,"NONE");assert.equal(x.authorityEffect,"NONE");});
test("present-exposes-no-decide-result",()=>{const x=factory().present({});assert.equal("decisionEvidenceRef" in x.presentation,false);});
test("approve-capture-only",()=>{const s=factory(),p=s.present({}).presentation,d=s.decide({}, {presentationId:p.presentationId,decision:"APPROVE_TRUST_REGISTRATION"});assert.equal(d.outcome,"GENESIS_TRUST_DECISION_APPROVED_CAPTURED");assert.equal(d.downstreamTrustRegistration,"NOT_PERFORMED");});
test("reject-capture-only",()=>{const s=factory(),p=s.present({}).presentation,d=s.decide({}, {presentationId:p.presentationId,decision:"REJECT_TRUST_REGISTRATION"});assert.equal(d.outcome,"GENESIS_TRUST_DECISION_REJECTED_CAPTURED");assert.equal(d.downstreamTrustRegistration,"NOT_PERFORMED");});
test("approve-authority-none",()=>{const s=factory(),p=s.present({}).presentation,d=s.decide({}, {presentationId:p.presentationId,decision:"APPROVE_TRUST_REGISTRATION"});assert.equal(d.authority,"NONE");assert.equal(d.authorityEffect,"NONE");});
test("reject-authority-none",()=>{const s=factory(),p=s.present({}).presentation,d=s.decide({}, {presentationId:p.presentationId,decision:"REJECT_TRUST_REGISTRATION"});assert.equal(d.authority,"NONE");assert.equal(d.authorityEffect,"NONE");});
test("missing-decision-rejected",()=>{const s=factory(),p=s.present({}).presentation;assert.throws(()=>s.decide({}, {presentationId:p.presentationId,decision:""}));});
test("other-decision-rejected",()=>{const s=factory(),p=s.present({}).presentation;assert.throws(()=>s.decide({}, {presentationId:p.presentationId,decision:"YES"}));});
test("missing-presentation-rejected",()=>assert.throws(()=>factory().decide({}, {presentationId:"missing",decision:"APPROVE_TRUST_REGISTRATION"})));
test("unbound-context-rejected",()=>assert.throws(()=>factory({bindingState:"REJECTED",session:SESSION,principal:PRINCIPAL}).present({})));
test("principal-session-mismatch-rejected",()=>{const bad={bindingState:"BOUND",session:SESSION,principal:{...PRINCIPAL,sessionRef:"other"}};assert.throws(()=>factory(bad).present({}));});
test("principal-evidence-required",()=>{const bad={bindingState:"BOUND",session:SESSION,principal:{...PRINCIPAL,principalEvidenceRef:""}};assert.throws(()=>factory(bad).present({}));});
test("same-context-required-at-decision",()=>{let n=0;const surface=createIsolatedRealHumanGenesisTrustDecisionSurface({contextProvider:()=>n++===0?CONTEXT:{bindingState:"BOUND",session:{...SESSION,sessionRef:"changed"},principal:{...PRINCIPAL,sessionRef:"changed"}},clock:()=>"2026-09-20T13:00:00.000Z"});const p=surface.present({}).presentation;assert.throws(()=>surface.decide({}, {presentationId:p.presentationId,decision:"APPROVE_TRUST_REGISTRATION"}));});
test("unknown-route-404",()=>withServer(async s=>assert.equal((await request(s,{url:"/api/gt63/genesis-trust-decision/register"})).status,404)));
test("present-http-200",()=>withServer(async s=>assert.equal((await request(s,{url:ROUTES[0].path})).status,200)));
test("http-does-not-auto-register",()=>withServer(async s=>{const p=(await request(s,{url:ROUTES[0].path})).json.presentation;const d=(await request(s,{url:ROUTES[1].path,body:{presentationId:p.presentationId,decision:"APPROVE_TRUST_REGISTRATION"}})).json;assert.equal(d.downstreamTrustRegistration,"NOT_PERFORMED");}));
test("surface-has-no-registration-method",()=>assert.equal("register" in factory(),false));
test("surface-has-no-execute-method",()=>assert.equal("execute" in factory(),false));

(async()=>{const out=[];for(const [n,f] of tests){try{await f();out.push({name:n,status:"PASS"});console.log("PASS - "+n);}catch(e){console.error("FAIL - "+n+" - "+e.stack);process.exitCode=1;return;}}const hash=crypto.createHash("sha256").update(JSON.stringify(out)).digest("hex");console.log(JSON.stringify({status:"PASS",workflow:"isolated-real-human-genesis-trust-decision-surface-v0-regression",cases:out.length,outputHash:hash,authority:"NONE",authorityEffect:"NONE"}));})();
