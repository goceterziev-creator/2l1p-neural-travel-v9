"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const http=require("node:http");
const {RULESET_VERSION,ROUTES,createRealHumanGenesisTrustDecisionRuntime}=require("./real-human-genesis-trust-decision-runtime-composition-v0");
const NOW=2000000000000, SECRET="test-secret";
const USER={id:"USR-ADMIN",agencyId:"AGY-AYA",role:"admin",sessionVersion:1};
const PAYLOAD={userId:USER.id,agencyId:USER.agencyId,role:"admin",sessionVersion:1,iat:NOW,exp:NOW+60000};
function sign(){const e=Buffer.from(JSON.stringify(PAYLOAD)).toString("base64url");return e+"."+crypto.createHmac("sha256",SECRET).update(e).digest("base64url");}
const TOKEN=sign();
function validator(req){const c=String(req.headers.cookie||"");if(!c.includes("aya_session="+TOKEN))throw new Error("Authentication required");req.user=USER;req.session=PAYLOAD;req.sessionIdentity={userId:USER.id,agencyId:USER.agencyId,role:"admin",sessionVersion:1};return true;}
function bridge(){let id=null;return {start:async s=>({outcome:"EXTERNAL_IDENTITY_AUTHORIZATION_REQUIRED",challenge:{challengeRef:"c1",userCode:"ABCD",verificationUri:"https://github.com/login/device"}}),poll:async s=>{id={principalRef:"gt63-machine:principal:github:239696056",principalRevision:"1",sessionRef:s.sessionRef,sessionRevision:s.sessionRevision,authenticatedAccountRef:s.authenticatedAccountRef,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",principalEvidenceRef:"proof",authority:"NONE"};return {outcome:"EXTERNAL_IDENTITY_VERIFIED",identity:id};},getIdentityBySession:r=>id&&id.sessionRef===r?id:null};}
function guard(){return {assertUnchanged(){}};}
async function req(s,url,body={}){const d=JSON.stringify(body);return new Promise((resolve,reject)=>{const a=s.address(),q=http.request({host:"127.0.0.1",port:a.port,path:url,method:"POST",headers:{Cookie:"aya_session="+TOKEN,"Content-Type":"application/json","Content-Length":Buffer.byteLength(d)}},r=>{let b="";r.on("data",x=>b+=x);r.on("end",()=>{let j=null;try{j=JSON.parse(b)}catch{}resolve({status:r.statusCode,json:j,body:b});});});q.on("error",reject);q.write(d);q.end();});}
async function run(fn){const b=bridge(),rt=createRealHumanGenesisTrustDecisionRuntime({validateSession:validator,bridge:b,dbGuard:guard(),clock:()=>"2026-09-20T15:00:00.000Z"});const s=rt.app.listen(0,"127.0.0.1");await new Promise(r=>s.once("listening",r));try{return await fn(s);}finally{await new Promise(r=>s.close(r));}}
const t=[];function test(n,f){t.push([n,f]);}
test("ruleset-exact",()=>assert.equal(RULESET_VERSION,"real-human-genesis-trust-decision-runtime-composition-v0.1.0"));
test("routes-exact-four-only",()=>assert.deepEqual(ROUTES.map(x=>x.method+" "+x.path),["POST /api/gt63/genesis-trust-runtime/identity/start","POST /api/gt63/genesis-trust-runtime/identity/poll","POST /api/gt63/genesis-trust-runtime/decision/present","POST /api/gt63/genesis-trust-runtime/decision/decide"]));
test("unknown-route-404",()=>run(async s=>assert.equal((await req(s,"/api/gt63/genesis-trust-runtime/register")).status,404)));
test("present-before-identity-rejected",()=>run(async s=>assert.equal((await req(s,ROUTES[2].path)).status,409)));
test("identity-start",()=>run(async s=>assert.equal((await req(s,ROUTES[0].path)).json.outcome,"EXTERNAL_IDENTITY_AUTHORIZATION_REQUIRED")));
test("identity-poll-verifies",()=>run(async s=>{await req(s,ROUTES[0].path);assert.equal((await req(s,ROUTES[1].path,{challengeRef:"c1"})).json.outcome,"EXTERNAL_IDENTITY_VERIFIED");}));
test("present-after-verified-identity",()=>run(async s=>{await req(s,ROUTES[0].path);await req(s,ROUTES[1].path,{challengeRef:"c1"});assert.equal((await req(s,ROUTES[2].path)).json.outcome,"GENESIS_TRUST_DECISION_PRESENTED");}));
test("approve-capture-stops",()=>run(async s=>{await req(s,ROUTES[0].path);await req(s,ROUTES[1].path,{challengeRef:"c1"});const p=(await req(s,ROUTES[2].path)).json.presentation;const d=(await req(s,ROUTES[3].path,{presentationId:p.presentationId,decision:"APPROVE_TRUST_REGISTRATION"})).json;assert.equal(d.outcome,"GENESIS_TRUST_DECISION_APPROVED_CAPTURED");assert.equal(d.downstreamTrustRegistration,"NOT_PERFORMED");}));
test("reject-capture-stops",()=>run(async s=>{await req(s,ROUTES[0].path);await req(s,ROUTES[1].path,{challengeRef:"c1"});const p=(await req(s,ROUTES[2].path)).json.presentation;const d=(await req(s,ROUTES[3].path,{presentationId:p.presentationId,decision:"REJECT_TRUST_REGISTRATION"})).json;assert.equal(d.outcome,"GENESIS_TRUST_DECISION_REJECTED_CAPTURED");assert.equal(d.downstreamTrustRegistration,"NOT_PERFORMED");}));
test("invalid-decision-rejected",()=>run(async s=>{await req(s,ROUTES[0].path);await req(s,ROUTES[1].path,{challengeRef:"c1"});const p=(await req(s,ROUTES[2].path)).json.presentation;assert.equal((await req(s,ROUTES[3].path,{presentationId:p.presentationId,decision:"YES"})).status,409);}));
test("approve-authority-none",()=>run(async s=>{await req(s,ROUTES[0].path);await req(s,ROUTES[1].path,{challengeRef:"c1"});const p=(await req(s,ROUTES[2].path)).json.presentation,d=(await req(s,ROUTES[3].path,{presentationId:p.presentationId,decision:"APPROVE_TRUST_REGISTRATION"})).json;assert.equal(d.authority,"NONE");assert.equal(d.authorityEffect,"NONE");}));
test("no-registration-route",()=>run(async s=>assert.equal((await req(s,"/api/gt63/genesis-trust-runtime/registration")).status,404)));
test("no-effect-route",()=>run(async s=>assert.equal((await req(s,"/api/gt63/genesis-trust-runtime/effect")).status,404)));
test("runtime-does-not-export-register",()=>{const rt=createRealHumanGenesisTrustDecisionRuntime({validateSession:validator,bridge:bridge(),dbGuard:guard()});assert.equal("register" in rt,false);});
test("runtime-does-not-export-execute",()=>{const rt=createRealHumanGenesisTrustDecisionRuntime({validateSession:validator,bridge:bridge(),dbGuard:guard()});assert.equal("execute" in rt,false);});
(async()=>{const o=[];for(const [n,f] of t){try{await f();o.push({name:n,status:"PASS"});console.log("PASS - "+n);}catch(e){console.error("FAIL - "+n+" - "+e.stack);process.exitCode=1;return;}}console.log(JSON.stringify({status:"PASS",workflow:"real-human-genesis-trust-decision-runtime-composition-v0-regression",cases:o.length,outputHash:crypto.createHash("sha256").update(JSON.stringify(o)).digest("hex"),authority:"NONE",authorityEffect:"NONE"}));})();
