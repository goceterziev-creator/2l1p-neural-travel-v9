"use strict";
const {auditNativeFilesystemLinkPortsV0}=require("./repeatable-filesystem-native-link-port-audit-v0");
function auditRun2ReadOnlyEvidenceInterfacesV0(ports={}){
 const link=auditNativeFilesystemLinkPortsV0(ports);
 const required={
  nativeStartLedger:"findByExecutionStartId",
  filesystemAuthorizationLedger:"findByAuthorizationId",
  reservationObserver:"inspect",
  postconditionObserver:"verify"
 };
 const missing=[...link.missing];
 for(const [name,method] of Object.entries(required)){
  if(typeof ports[name]?.[method]!=="function")missing.push(name+"."+method);
 }
 return Object.freeze({
  status:missing.length?"NOT_CONNECTABLE":"INTERFACE_COMPATIBLE_ONLY",
  missing:Object.freeze(missing),
  provenance:"NOT_ASSESSED",
  authority:"NONE",
  executionAuthorized:false,
  retryAuthorized:false,
  effectPerformed:false
 });
}
module.exports=Object.freeze({auditRun2ReadOnlyEvidenceInterfacesV0});
