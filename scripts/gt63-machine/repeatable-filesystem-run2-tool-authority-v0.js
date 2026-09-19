"use strict";
const path=require("node:path");
const authRun=require("./repeatable-filesystem-run2-exact-authorization-v0");
const rootRun=require("./repeatable-filesystem-run2-real-root-resolution-v0");
const toolMod=require("./repeatable-filesystem-tool-authority-v0");
const ADAPTER_REF="gt63-machine:filesystem-adapter:create-new-file-v0",ADAPTER_REVISION="1";
function ledger(){const rows=[];return{findByAuthorizationId:id=>rows.filter(x=>x.authorizationId===id).map(x=>JSON.parse(JSON.stringify(x))),commit:x=>(rows.push(JSON.parse(JSON.stringify(x))),JSON.parse(JSON.stringify(x)))}}
function authorizeRun2Tool({rootPath}={}){
 if(typeof rootPath!=="string"||!rootPath.trim())throw new TypeError("explicit rootPath required");
 const a=authRun.authorizeRun2().authorization;
 const rr=rootRun.resolveRun2({rootPath}).resolution;
 const adapter=Object.freeze({adapterRef:ADAPTER_REF,adapterRevision:ADAPTER_REVISION,capability:"CREATE_NEW_FILE",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE",authorityEffect:"NONE",effectPerformed:false,evidenceMode:"EXPLICIT_BOUNDED_LOCAL_ADAPTER_REGISTRY"});
 const sys=toolMod.createRepeatableFilesystemToolAuthorityV0({
  authorizationPort:({authorizationId})=>{if(authorizationId!==a.authorizationId)throw Error("authorization unavailable");return a;},
  rootResolutionPort:({rootResolutionId})=>{if(rootResolutionId!==rr.rootResolutionId)throw Error("root resolution unavailable");return rr;},
  adapterRegistryPort:({adapterRef,adapterRevision})=>{if(adapterRef!==ADAPTER_REF||adapterRevision!==ADAPTER_REVISION)throw Error("adapter unavailable");return adapter;},
  authorityLedger:ledger()
 });
 const r=sys.authorize({rulesetVersion:toolMod.RULESET_VERSION,authorizationId:a.authorizationId,rootResolutionId:rr.rootResolutionId,adapterRef:ADAPTER_REF,adapterRevision:ADAPTER_REVISION});
 if(r.outcome!==toolMod.OUTCOMES.AUTHORIZED||!r.toolAuthority)throw new Error("Run #2 tool authority failed: "+r.outcome+" "+(r.reason||""));
 return Object.freeze({...r,adapterEvidence:adapter,effectPerformed:false});
}
if(require.main===module){try{process.stdout.write(JSON.stringify(authorizeRun2Tool({rootPath:process.argv[2]}))+"\n");}catch(e){process.stderr.write("RUN2_TOOL_AUTHORITY_FAILED: "+e.message+"\n");process.exit(1);}}
module.exports=Object.freeze({ADAPTER_REF,ADAPTER_REVISION,authorizeRun2Tool});
