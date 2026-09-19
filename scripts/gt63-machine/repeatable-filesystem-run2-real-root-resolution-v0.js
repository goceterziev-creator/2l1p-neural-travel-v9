"use strict";
const path=require("node:path");
const authRun=require("./repeatable-filesystem-run2-exact-authorization-v0");
const providerMod=require("./repeatable-filesystem-readonly-evidence-provider-v0");
const resolverMod=require("./repeatable-filesystem-authorized-root-resolution-v0");
const ROOT="GT63_REPEATABLE_EFFECT_TEST/";
function ledger(){const rows=[];return{findByAuthorizationId:id=>rows.filter(x=>x.authorizationId===id).map(x=>JSON.parse(JSON.stringify(x))),commit:x=>(rows.push(JSON.parse(JSON.stringify(x))),JSON.parse(JSON.stringify(x)))}}
function resolveRun2({rootPath}={}){
 if(typeof rootPath!=="string"||!rootPath.trim())throw new TypeError("explicit rootPath required");
 const a=authRun.authorizeRun2().authorization;
 const p=providerMod.createRepeatableFilesystemReadonlyEvidenceProviderV0({rootBindings:{[ROOT]:path.resolve(rootPath)}});
 const sys=resolverMod.createRepeatableFilesystemAuthorizedRootResolutionV0({
  authorizationPort:({authorizationId})=>{if(authorizationId!==a.authorizationId)throw Error("authorization unavailable");return a;},
  rootRegistryPort:p.rootRegistryPort,
  filesystemObservationPort:p.filesystemObservationPort,
  resolutionLedger:ledger()
 });
 const r=sys.resolve({rulesetVersion:resolverMod.RULESET_VERSION,authorizationId:a.authorizationId});
 if(r.outcome!==resolverMod.OUTCOMES.RESOLVED||!r.resolution)throw new Error("Run #2 real root resolution failed: "+r.outcome+" "+(r.reason||""));
 return Object.freeze({...r,evidenceMode:"REAL_LOCAL_FILESYSTEM_READ_ONLY",effectPerformed:false});
}
if(require.main===module){const rootPath=process.argv[2];try{process.stdout.write(JSON.stringify(resolveRun2({rootPath}))+"\n");}catch(e){process.stderr.write("RUN2_REAL_ROOT_RESOLUTION_FAILED: "+e.message+"\n");process.exit(1);}}
module.exports=Object.freeze({resolveRun2});
