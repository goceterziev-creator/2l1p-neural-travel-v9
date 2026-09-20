"use strict";

const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const express=require("express");

const {createExistingSessionAdapter}=require("./human-governance-approval-server-wiring");
const {createGenesisPrincipalBootstrapRuntimeBridge}=require("./genesis-principal-bootstrap-runtime-bridge-v0");
const {createGenesisTrustRealHumanContextBindingProof}=require("./genesis-trust-real-human-context-binding-proof-v0");

const RULESET_VERSION="isolated-local-real-context-proof-surface-v0.1.0";
const AUTHORITY="NONE";
const AUTHORITY_EFFECT="NONE";
const SESSION_COOKIE="aya_session";
const DB_SCHEMA="gt63-v9-staging-1";
const ROUTES=Object.freeze([
  Object.freeze({method:"GET",path:"/gt63-local-real-context-proof"}),
  Object.freeze({method:"POST",path:"/api/gt63/local-real-context-proof/start"}),
  Object.freeze({method:"POST",path:"/api/gt63/local-real-context-proof/poll"})
]);
const EXPECTED_GITHUB_IDENTITY=Object.freeze({githubUserId:239696056,githubLogin:"goceterziev-creator"});

function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function safeError(e){return String(e&&e.message||e);}
function sha256File(p){return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");}
function resolveDbFile(){return process.env.DB_FILE?path.resolve(process.env.DB_FILE):path.resolve(__dirname,"..","..","DATABASE","database.json");}

function establishReadOnlyDbGuard(dbFile=resolveDbFile()){
  if(!fs.existsSync(dbFile))throw new Error("isolated proof requires an existing DB_FILE; creation is forbidden");
  const parsed=JSON.parse(fs.readFileSync(dbFile,"utf8"));
  if(parsed.schemaVersion!==DB_SCHEMA)throw new Error("isolated proof requires current DB schema; migration/write is forbidden");
  const digest=sha256File(dbFile);
  return freeze({dbFile,digest,assertUnchanged(){if(sha256File(dbFile)!==digest)throw new Error("DB mutation detected; isolated proof stopped");}});
}

function parseCookieHeader(header=""){
  const out={};
  for(const part of String(header).split(";")){
    const i=part.indexOf("="); if(i<1)continue;
    const k=part.slice(0,i).trim(); const v=part.slice(i+1).trim();
    if(k)out[k]=v;
  }
  return out;
}
function base64Url(s){return Buffer.from(s).toString("base64url");}
function verifySignedSession(token,authSecret,now=()=>Date.now()){
  const [encoded,signature]=String(token||"").split(".");
  if(!encoded||!signature)return null;
  const expected=crypto.createHmac("sha256",authSecret).update(encoded).digest("base64url");
  const a=Buffer.from(signature),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
  try{
    const payload=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8"));
    if(!payload.userId||Number(payload.exp)<now())return null;
    return payload;
  }catch{return null;}
}
function currentRole(user={}){return String(user.role||"agent").toLowerCase();}
function sessionVersion(user={}){return Number.isInteger(Number(user.sessionVersion))?Number(user.sessionVersion):1;}
function normalizeIdentity(user={}){return {userId:user.id,agencyId:user.agencyId||"AGY-AYA",role:currentRole(user),sessionVersion:sessionVersion(user)};}
function validForUser(session,user){
  if(!session?.userId||!user?.id||session.userId!==user.id)return false;
  if(session.agencyId&&session.agencyId!==(user.agencyId||"AGY-AYA"))return false;
  if(session.role&&session.role!==currentRole(user))return false;
  if(session.sessionVersion&&Number(session.sessionVersion)!==sessionVersion(user))return false;
  return true;
}

function createReadOnlySessionValidationPort({authSecret,readDb,now=()=>Date.now()}={}){
  if(typeof authSecret!=="string"||!authSecret.length)throw new TypeError("authSecret required");
  if(typeof readDb!=="function")throw new TypeError("readDb required");
  return function validate(req){
    const token=parseCookieHeader(req&&req.headers&&req.headers.cookie)[SESSION_COOKIE];
    const session=verifySignedSession(token,authSecret,now);
    if(!session)throw new Error("Authentication required");
    const db=readDb();
    const user=Array.isArray(db&&db.users)?db.users.find(x=>x&&x.id===session.userId):null;
    if(!user||!validForUser(session,user))throw new Error("Authentication required");
    return freeze({user:JSON.parse(JSON.stringify(user)),session:JSON.parse(JSON.stringify(session)),identity:normalizeIdentity(user)});
  };
}

function attachValidatedContext(validateSession){
  return function(req,res,next){
    try{
      const c=validateSession(req);
      req.user=c.user; req.session=c.session; req.sessionIdentity=c.identity;
      next();
    }catch(e){res.status(401).json({error:"Authentication required",authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}
  };
}

function html(){
 return `<!doctype html><html><head><meta charset="utf-8"><title>GT63 Isolated Real-Context Proof</title></head><body>
<h1>GT63 Isolated Real-Context Proof Surface</h1><p>Authority: NONE. Reachable workflow: authenticated session → GitHub Device Flow → exact BOUND/REJECTED.</p>
<button id="start">Start GitHub identity proof</button><pre id="out">Ready.</pre><script>
const out=document.getElementById("out");let challengeRef=null;
document.getElementById("start").onclick=async()=>{const r=await fetch("/api/gt63/local-real-context-proof/start",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});const j=await r.json();out.textContent=JSON.stringify(j,null,2);if(j.challenge){challengeRef=j.challenge.challengeRef;const p=document.createElement("p");p.innerHTML="Open <a target='_blank' rel='noopener noreferrer' href='"+j.challenge.verificationUri+"'>GitHub device authorization</a> and enter code <strong>"+j.challenge.userCode+"</strong>.";document.body.appendChild(p);const b=document.createElement("button");b.textContent="Poll / prove BOUND or REJECTED";b.onclick=async()=>{const q=await fetch("/api/gt63/local-real-context-proof/poll",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeRef})});out.textContent=JSON.stringify(await q.json(),null,2);};document.body.appendChild(b);}};
</script></body></html>`;
}

function createIsolatedProofApp({validateSession,bridge,proof,dbGuard}={}){
 if(typeof validateSession!=="function")throw new TypeError("validateSession required");
 if(!bridge||typeof bridge.start!=="function"||typeof bridge.poll!=="function")throw new TypeError("bridge required");
 if(!proof||typeof proof.prove!=="function")throw new TypeError("proof required");
 if(!dbGuard||typeof dbGuard.assertUnchanged!=="function")throw new TypeError("dbGuard required");
 const app=express();
 app.disable("x-powered-by");
 app.use(express.json({limit:"8kb"}));
 const auth=attachValidatedContext(validateSession);
 app.get(ROUTES[0].path,auth,(req,res)=>{dbGuard.assertUnchanged();res.setHeader("Cache-Control","no-store");res.type("html").send(html());});
 app.post(ROUTES[1].path,auth,async(req,res)=>{
  try{dbGuard.assertUnchanged();const session=createExistingSessionAdapter()(req);const result=await bridge.start(session);dbGuard.assertUnchanged();
   if(result.outcome==="EXTERNAL_IDENTITY_ALREADY_VERIFIED")return res.json({outcome:result.outcome,proof:proof.prove(req),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
   if(result.outcome!=="EXTERNAL_IDENTITY_AUTHORIZATION_REQUIRED")return res.status(409).json({outcome:result.outcome,reason:result.reason||null,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
   return res.json({outcome:result.outcome,challenge:result.challenge,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
  }catch(e){return res.status(409).json({outcome:"LOCAL_REAL_CONTEXT_PROOF_REJECTED",reason:safeError(e),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}
 });
 app.post(ROUTES[2].path,auth,async(req,res)=>{
  try{dbGuard.assertUnchanged();const session=createExistingSessionAdapter()(req);const identityResult=await bridge.poll(session,String(req.body&&req.body.challengeRef||""));dbGuard.assertUnchanged();
   if(identityResult.outcome==="EXTERNAL_IDENTITY_VERIFIED"||identityResult.outcome==="EXTERNAL_IDENTITY_ALREADY_VERIFIED"){const bindingProof=proof.prove(req);dbGuard.assertUnchanged();return res.json({outcome:identityResult.outcome,principalRef:identityResult.identity&&identityResult.identity.principalRef||null,principalEvidenceRef:identityResult.identity&&identityResult.identity.principalEvidenceRef||null,proof:bindingProof,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}
   return res.status(identityResult.outcome==="EXTERNAL_IDENTITY_AUTHORIZATION_PENDING"?202:409).json({outcome:identityResult.outcome,reason:identityResult.reason||null,retryAfterSeconds:identityResult.retryAfterSeconds||null,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
  }catch(e){return res.status(409).json({outcome:"LOCAL_REAL_CONTEXT_PROOF_REJECTED",reason:safeError(e),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}
 });
 return app;
}

async function main(){
 if(!process.env.GITHUB_CLIENT_ID)throw new Error("GITHUB_CLIENT_ID is required");
 if(process.env.BETA_AUTH_BYPASS==="true")throw new Error("BETA_AUTH_BYPASS must be disabled");
 const authSecret=String(process.env.AUTH_SECRET||"dev-auth-secret-change-me");
 const dbGuard=establishReadOnlyDbGuard();
 const readDb=()=>{dbGuard.assertUnchanged();const db=JSON.parse(fs.readFileSync(dbGuard.dbFile,"utf8"));dbGuard.assertUnchanged();return db;};
 const validateSession=createReadOnlySessionValidationPort({authSecret,readDb});
 const bridge=createGenesisPrincipalBootstrapRuntimeBridge({clientId:process.env.GITHUB_CLIENT_ID,expectedIdentity:EXPECTED_GITHUB_IDENTITY});
 const proof=createGenesisTrustRealHumanContextBindingProof({identityProvider:bridge});
 const app=createIsolatedProofApp({validateSession,bridge,proof,dbGuard});
 const port=Number(process.env.GT63_LOCAL_PROOF_PORT||3001);
 app.listen(port,"127.0.0.1",()=>{dbGuard.assertUnchanged();console.log(JSON.stringify({status:"READY",workflow:RULESET_VERSION,url:`http://127.0.0.1:${port}/gt63-local-real-context-proof`,reachableRoutes:ROUTES,applicationServerImported:false,dbMutation:"FORBIDDEN_AND_GUARDED",authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT}));});
}

if(require.main===module)main().catch(e=>{console.error(JSON.stringify({status:"STOP",workflow:RULESET_VERSION,reason:safeError(e),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT}));process.exitCode=1;});

module.exports=freeze({RULESET_VERSION,AUTHORITY,AUTHORITY_EFFECT,SESSION_COOKIE,ROUTES,EXPECTED_GITHUB_IDENTITY,parseCookieHeader,verifySignedSession,createReadOnlySessionValidationPort,establishReadOnlyDbGuard,createIsolatedProofApp,base64Url});
