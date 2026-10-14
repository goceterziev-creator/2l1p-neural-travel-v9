"use strict";
// Read-only contract audit: detects interface gaps without fabricating evidence.
const REQUIRED=Object.freeze({
 nativeClaimLedger:Object.freeze(["findClaimById","findClaimsByAttempt","findClaimEvidenceRef"]),
 filesystemPreparationLedger:Object.freeze(["findByExecutionPreparationId"]),
 crossDomainLinkStore:Object.freeze(["findByRef"])
});
function auditNativeFilesystemLinkPortsV0({nativeClaimLedger,filesystemPreparationLedger,crossDomainLinkStore}={}){
 const sources={nativeClaimLedger,filesystemPreparationLedger,crossDomainLinkStore};
 const missing=Object.entries(REQUIRED).flatMap(([name,methods])=>
  methods.filter(method=>typeof sources[name]?.[method]!=="function").map(method=>name+"."+method));
 return Object.freeze({status:missing.length?"NOT_CONNECTABLE":"INTERFACE_COMPATIBLE_ONLY",
  missing:Object.freeze(missing),authority:"NONE",executionAuthorized:false,effectPerformed:false});
}
module.exports=Object.freeze({REQUIRED,auditNativeFilesystemLinkPortsV0});
