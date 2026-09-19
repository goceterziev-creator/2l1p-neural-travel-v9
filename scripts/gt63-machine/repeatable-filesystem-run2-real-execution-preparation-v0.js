"use strict";
const authRun=require("./repeatable-filesystem-run2-exact-authorization-v0");
const rootRun=require("./repeatable-filesystem-run2-real-root-resolution-v0");
const toolRun=require("./repeatable-filesystem-run2-tool-authority-v0");
const prep=require("./repeatable-filesystem-effect-preparation-v0");
const clone=v=>JSON.parse(JSON.stringify(v));
function ledger(){const rows=[];return{findByAuthorizationId:id=>rows.filter(x=>x.authorizationId===id).map(clone),commit:x=>(rows.push(clone(x)),clone(x))}}
function prepareRun2({rootPath}={}){
 if(typeof rootPath!=="string"||!rootPath.trim())throw new TypeError("explicit rootPath required");
 const a=authRun.authorizeRun2().authorization;
 const rr=rootRun.resolveRun2({rootPath}).resolution;
 const ta=toolRun.authorizeRun2Tool({rootPath}).toolAuthority;
 const sys=prep.createRepeatableFilesystemEffectPreparationV0({
  authorizationPort:({authorizationId})=>{if(authorizationId!==a.authorizationId)throw Error("authorization unavailable");return a;},
  rootResolutionPort:({authorizationId})=>{if(authorizationId!==a.authorizationId)throw Error("root resolution unavailable");return rr;},
  toolAuthorityPort:({authorizationId,rootResolutionId})=>{if(authorizationId!==a.authorizationId||rootResolutionId!==rr.rootResolutionId)throw Error("tool authority unavailable");return ta;},
  executionLedger:ledger()
 });
 const r=sys.prepare({rulesetVersion:prep.RULESET_VERSION,authorizationId:a.authorizationId});
 if(r.outcome!==prep.OUTCOMES.READY||!r.execution)throw new Error("Run #2 preparation failed: "+r.outcome+" "+(r.reason||""));
 return Object.freeze({...r,captureState:"CAPTURED_BEFORE_EFFECT",effectPerformed:false});
}
if(require.main===module){try{process.stdout.write(JSON.stringify(prepareRun2({rootPath:process.argv[2]}))+"\n");}catch(e){process.stderr.write("RUN2_PREPARATION_FAILED: "+e.message+"\n");process.exit(1);}}
module.exports=Object.freeze({prepareRun2});
