"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {
 createDefaultRuntime,
 RULESET_VERSION,
 AUTHORITY,
 AUTHORITY_EFFECT
}=require("./real-human-genesis-trust-decision-runtime-composition-v0");
const {establishReadOnlyDbGuard}=require("./isolated-local-real-context-proof-surface-v0");

function safe(e){return String(e&&e.message||e);}

async function main(){
 if(!process.env.GITHUB_CLIENT_ID)throw new Error("GITHUB_CLIENT_ID is required");
 if(process.env.BETA_AUTH_BYPASS==="true")throw new Error("BETA_AUTH_BYPASS must be disabled");
 const authSecret=String(process.env.AUTH_SECRET||"dev-auth-secret-change-me");
 const dbGuard=establishReadOnlyDbGuard();
 const readDb=()=>{dbGuard.assertUnchanged();const db=JSON.parse(fs.readFileSync(dbGuard.dbFile,"utf8"));dbGuard.assertUnchanged();return db;};
 const runtime=createDefaultRuntime({clientId:process.env.GITHUB_CLIENT_ID,authSecret,readDb,dbGuard});
 const port=Number(process.env.GT63_GENESIS_TRUST_RUNTIME_PORT||3002);
 runtime.app.listen(port,"127.0.0.1",()=>{
  dbGuard.assertUnchanged();
  console.log(JSON.stringify({
   status:"READY",
   workflow:RULESET_VERSION,
   url:"http://127.0.0.1:"+port,
   reachableRoutes:runtime.routes,
   dbMutation:"FORBIDDEN_AND_GUARDED",
   authority:AUTHORITY,
   authorityEffect:AUTHORITY_EFFECT
  }));
 });
}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({status:"STOP",workflow:RULESET_VERSION,reason:safe(e),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT}));process.exitCode=1;});
module.exports={main};
