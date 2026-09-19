"use strict";
const path=require("node:path");
const provider=require("./repeatable-filesystem-readonly-evidence-provider-v0");
const RULESET_VERSION="repeatable-filesystem-run2-readonly-observation-v0.1.0",AUTHORITY="NONE";
const ROOT_ID="GT63_REPEATABLE_EFFECT_TEST/",TARGET="RUN_2.txt";
function observeRun2({rootPath}={}){
 if(typeof rootPath!=="string"||!rootPath.trim())throw new TypeError("explicit rootPath required");
 const absoluteRoot=path.resolve(rootPath);
 const p=provider.createRepeatableFilesystemReadonlyEvidenceProviderV0({rootBindings:{[ROOT_ID]:absoluteRoot}});
 const rootRegistry=p.rootRegistryPort({authorizedRootIdentity:ROOT_ID});
 const filesystemObservation=p.filesystemObservationPort({rootPath:rootRegistry.rootPath,targetPath:TARGET});
 return Object.freeze({type:"GT63_REPEATABLE_FILESYSTEM_RUN2_READONLY_OBSERVATION",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,authorizedRootIdentity:ROOT_ID,targetPath:TARGET,rootRegistry,filesystemObservation,evidenceMode:"REAL_LOCAL_FILESYSTEM_READ_ONLY",authority:AUTHORITY,authorityEffect:"NONE",effectPerformed:false});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,ROOT_ID,TARGET,observeRun2});
