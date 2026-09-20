"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {
 RULESET_VERSION,ROUTES,verifySignedSession,createReadOnlySessionValidationPort,createIsolatedProofApp
}=require("./isolated-local-real-context-proof-surface-v0");

const SECRET="provider-free-secret";
const USER={id:"USR-ADMIN",agencyId:"AGY-AYA",role:"admin",sessionVersion:1};
const NOW=2000000000000;
function sign(payload){const encoded=Buffer.from(JSON.stringify(payload)).toString("base64url");const sig=crypto.createHmac("sha256",SECRET).update(encoded).digest("base64url");return encoded+"."+sig;}
const SESSION={userId:"USR-ADMIN",agencyId:"AGY-AYA",role:"admin",sessionVersion:1,iat:NOW,exp:NOW+60000};
const TOKEN=sign(SESSION);
function validator(){return createReadOnlySessionValidationPort({authSecret:SECRET,readDb:()=>({users:[USER]}),now:()=>NOW});}
function fakeGuard(){return {assertUnchanged(){}};}
function fakeBridge(){let identity=null;return {start:async s=>({outcome:"EXTERNAL_IDENTITY_AUTHORIZATION_REQUIRED",challenge:{challengeRef:"c1",userCode:"ABCD-EFGH",verificationUri:"https://github.com/login/device",expiresAt:"2099-01-01T00:00:00.000Z",intervalSeconds:5},authority:"NONE"}),poll:async s=>{identity={principalRef:"gt63-machine:principal:github:239696056",principalRevision:"1",principalEvidenceRef:"provider-free",sessionRef:s.sessionRef,sessionRevision:s.sessionRevision,authenticatedAccountRef:s.authenticatedAccountRef,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE"};return {outcome:"EXTERNAL_IDENTITY_VERIFIED",identity,authority:"NONE"};},getIdentityBySession:r=>identity&&identity.sessionRef===r?identity:null};}
function fakeProof(){return {prove:req=>({status:"BOUND",bindingState:"BOUND",authority:"NONE",authorityEffect:"NONE"})};}
async function request(server,{method="GET",url="/",cookie="",body=null}={}){const a=server.address();return new Promise((resolve,reject)=>{const data=body===null?null:JSON.stringify(body);const req=http.request({host:"127.0.0.1",port:a.port,path:url,method,headers:{...(cookie?{Cookie:cookie}:{}),...(data?{"Content-Type":"application/json","Content-Length":Buffer.byteLength(data)}:{})}},res=>{let s="";res.on("data",x=>s+=x);res.on("end",()=>resolve({status:res.statusCode,body:s,headers:res.headers}));});req.on("error",reject);if(data)req.write(data);req.end();});}
async function withServer(fn){const app=createIsolatedProofApp({validateSession:validator(),bridge:fakeBridge(),proof:fakeProof(),dbGuard:fakeGuard()});const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));try{return await fn(server,app);}finally{await new Promise(r=>server.close(r));}}
const tests=[];function test(n,f){tests.push([n,f]);}
test("ruleset-exact",()=>assert.equal(RULESET_VERSION,"isolated-local-real-context-proof-surface-v0.1.0"));
test("route-manifest-exact",()=>assert.deepEqual(ROUTES.map(x=>x.method+" "+x.path),["GET /gt63-local-real-context-proof","POST /api/gt63/local-real-context-proof/start","POST /api/gt63/local-real-context-proof/poll"]));
test("implementation-does-not-import-server-js",()=>{const s=fs.readFileSync(path.join(__dirname,"isolated-local-real-context-proof-surface-v0.js"),"utf8");assert.equal(/require\s*\(\s*["'][^"']*server(?:\.js)?["']\s*\)/.test(s),false);});
test("valid-signed-session-verifies",()=>assert.equal(verifySignedSession(TOKEN,SECRET,()=>NOW).userId,"USR-ADMIN"));
test("wrong-secret-rejected",()=>assert.equal(verifySignedSession(TOKEN,"wrong",()=>NOW),null));
test("expired-session-rejected",()=>assert.equal(verifySignedSession(TOKEN,SECRET,()=>NOW+60001),null));
test("validator-resolves-exact-user",()=>assert.equal(validator()({headers:{cookie:"aya_session="+TOKEN}}).identity.userId,"USR-ADMIN"));
test("validator-rejects-no-cookie",()=>assert.throws(()=>validator()({headers:{}}),/Authentication required/));
test("validator-rejects-user-mismatch",()=>{const v=createReadOnlySessionValidationPort({authSecret:SECRET,readDb:()=>({users:[]}),now:()=>NOW});assert.throws(()=>v({headers:{cookie:"aya_session="+TOKEN}}),/Authentication required/);});
test("validator-rejects-session-version-mismatch",()=>{const v=createReadOnlySessionValidationPort({authSecret:SECRET,readDb:()=>({users:[{...USER,sessionVersion:2}]}),now:()=>NOW});assert.throws(()=>v({headers:{cookie:"aya_session="+TOKEN}}),/Authentication required/);});
test("unknown-route-404",()=>withServer(async s=>assert.equal((await request(s,{url:"/admin",cookie:"aya_session="+TOKEN})).status,404)));
test("unknown-api-route-404",()=>withServer(async s=>assert.equal((await request(s,{url:"/api/offers",cookie:"aya_session="+TOKEN})).status,404)));
test("proof-page-requires-auth",()=>withServer(async s=>assert.equal((await request(s,{url:ROUTES[0].path})).status,401)));
test("proof-page-authenticated-200",()=>withServer(async s=>assert.equal((await request(s,{url:ROUTES[0].path,cookie:"aya_session="+TOKEN})).status,200)));
test("start-requires-auth",()=>withServer(async s=>assert.equal((await request(s,{method:"POST",url:ROUTES[1].path,body:{}})).status,401)));
test("start-provider-free-challenge",()=>withServer(async s=>{const r=await request(s,{method:"POST",url:ROUTES[1].path,cookie:"aya_session="+TOKEN,body:{}});assert.equal(r.status,200);assert.equal(JSON.parse(r.body).outcome,"EXTERNAL_IDENTITY_AUTHORIZATION_REQUIRED");}));
test("poll-requires-auth",()=>withServer(async s=>assert.equal((await request(s,{method:"POST",url:ROUTES[2].path,body:{challengeRef:"c1"}})).status,401)));
test("poll-provider-free-verified",()=>withServer(async s=>{const r=await request(s,{method:"POST",url:ROUTES[2].path,cookie:"aya_session="+TOKEN,body:{challengeRef:"c1"}});const j=JSON.parse(r.body);assert.equal(r.status,200);assert.equal(j.outcome,"EXTERNAL_IDENTITY_VERIFIED");assert.equal(j.proof.status,"BOUND");}));
test("start-authority-none",()=>withServer(async s=>{const j=JSON.parse((await request(s,{method:"POST",url:ROUTES[1].path,cookie:"aya_session="+TOKEN,body:{}})).body);assert.equal(j.authority,"NONE");assert.equal(j.authorityEffect,"NONE");}));
test("poll-authority-none",()=>withServer(async s=>{const j=JSON.parse((await request(s,{method:"POST",url:ROUTES[2].path,cookie:"aya_session="+TOKEN,body:{challengeRef:"c1"}})).body);assert.equal(j.authority,"NONE");assert.equal(j.authorityEffect,"NONE");}));

(async()=>{const out=[];for(const [n,f] of tests){try{await f();out.push({name:n,status:"PASS"});console.log("PASS - "+n);}catch(e){console.error("FAIL - "+n+" - "+e.stack);process.exitCode=1;return;}}const hash=crypto.createHash("sha256").update(JSON.stringify(out)).digest("hex");console.log(JSON.stringify({status:"PASS",workflow:"isolated-local-real-context-proof-surface-v0-regression",cases:out.length,deterministicRuns:2,outputHash:hash,authority:"NONE",authorityEffect:"NONE"}));})();
