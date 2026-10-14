"use strict";
// Adapts existing authoritative read ports to the identity-only assessor.
// No synthetic evidence, no file writes, no lifecycle mutation.
const {createNativeFilesystemPreparationLinkV0}=require("./repeatable-filesystem-native-preparation-link-v0");
const isFn=x=>typeof x==="function";
function createNativeFilesystemLinkReadAdapterV0({claimLedger,filesystemPreparationLedger,linkEvidenceStore}={}){
 if(!claimLedger||!isFn(claimLedger.findClaimById)||!isFn(claimLedger.findClaimsByAttempt)||!isFn(claimLedger.findClaimEvidenceRef))
  throw new TypeError("native claim ledger read interface required");
 if(!filesystemPreparationLedger||!isFn(filesystemPreparationLedger.findByExecutionPreparationId))
  throw new TypeError("filesystem preparation read interface required");
 if(!linkEvidenceStore||!isFn(linkEvidenceStore.findByRef))
  throw new TypeError("trusted cross-domain link store read interface required");
 const claimSnapshotPort=({attemptClaimId})=>{
  const rows=claimLedger.findClaimById(attemptClaimId);
  if(!Array.isArray(rows)||rows.length!==1)throw Error("claim absent or ambiguous");
  const record=rows[0],history=claimLedger.findClaimsByAttempt(record.executionAttemptId);
  if(!Array.isArray(history)||history.length===0)throw Error("claim history unavailable");
  const active=history.filter(x=>x.ownershipState==="ACTIVE");
  const competing=active.length!==1||active[0].attemptClaimId!==attemptClaimId;
  const uncertain=history.some(x=>!Number.isInteger(x.claimOrdinal)||!Number.isInteger(x.claimRevision));
  const evidence=claimLedger.findClaimEvidenceRef(attemptClaimId);
  if(typeof evidence!=="string"||!evidence)throw Error("claim evidence ref unavailable");
  return {evidenceRef:evidence,currentClaimId:competing?null:attemptClaimId,competingActiveClaim:competing,uncertainClaimHistory:uncertain,record};
 };
 const filesystemPreparationPort=({executionPreparationId})=>{
  const rows=filesystemPreparationLedger.findByExecutionPreparationId(executionPreparationId);
  if(!Array.isArray(rows)||rows.length!==1)throw Error("preparation absent or ambiguous");
  return rows[0];
 };
 const linkEvidencePort=({linkEvidenceRef})=>{
  const rows=linkEvidenceStore.findByRef(linkEvidenceRef);
  if(!Array.isArray(rows)||rows.length!==1)throw Error("link evidence absent or ambiguous");
  return rows[0];
 };
 const assessor=createNativeFilesystemPreparationLinkV0({
  nativeClaimSnapshotPort:claimSnapshotPort,
  filesystemPreparationPort,
  linkEvidencePort
 });
 return Object.freeze({assess:assessor.assess,authority:"NONE",executionAuthorized:false,effectPerformed:false});
}
module.exports=Object.freeze({createNativeFilesystemLinkReadAdapterV0});
