"use strict";
// Observation-only composition. A MATCH never proves provenance or authorizes a retry.
const {createIsolatedReservationRecoveryV0}=require("./isolated-one-shot-recovery-v0");
const {createIsolatedFilesystemPostconditionVerifierV0}=require("./isolated-filesystem-postcondition-verifier-v0");
function createIsolatedRecoveryPostconditionReviewV0({reservationDirectory,rootPath}={}){
 const recovery=createIsolatedReservationRecoveryV0({directory:reservationDirectory});
 const verifier=createIsolatedFilesystemPostconditionVerifierV0({rootPath});
 function review({effectDigest,relativeTargetPath,expectedSha256,expectedBytes}={}){
  const reservation=recovery.inspect({effectDigest});
  if(reservation.outcome!=="EFFECT_UNCERTAIN")return Object.freeze({outcome:"UNKNOWN",reservationOutcome:reservation.outcome,postconditionOutcome:"NOT_OBSERVED",authority:"NONE",executionAuthorized:false,retryAuthorized:false,effectPerformed:false});
  const observation=verifier.verify({relativeTargetPath,expectedSha256,expectedBytes});
  return Object.freeze({outcome:"REVIEW_REQUIRED",reservationOutcome:reservation.outcome,postconditionOutcome:observation.outcome,observedDigest:observation.observedDigest,authority:"NONE",executionAuthorized:false,retryAuthorized:false,effectPerformed:false});
 }
 return Object.freeze({review,authority:"NONE",executionAuthorized:false,retryAuthorized:false,effectPerformed:false});
}
module.exports=Object.freeze({createIsolatedRecoveryPostconditionReviewV0});
