"use strict";
// Read-only compatibility assessment of native lifecycle records.
// This module never invokes a filesystem effect or grants authority.
const OUTCOMES=Object.freeze({COMPATIBLE:"COMPATIBLE",DENIED:"DENIED",UNKNOWN:"UNKNOWN"});
const nonempty=x=>typeof x==="string"&&x.length>0;
const result=(outcome,reason)=>Object.freeze({outcome,reason,authority:"NONE",effectPerformed:false,executionAuthorized:false});
function createNativeFilesystemLifecycleCompatibilityV0({claimSnapshotPort,startRecordPort,preparationPort,authorizationPort}={}){
 for(const [k,v] of Object.entries({claimSnapshotPort,startRecordPort,preparationPort,authorizationPort}))
  if(typeof v!=="function")throw new TypeError(k+" required");
 function assess(req){
  if(!req||Object.keys(req).sort().join("|")!==["executionAttemptId","attemptClaimId","executionStartId","executionPreparationId","authorizationId"].sort().join("|")
    || !Object.values(req).every(nonempty)||new Set(Object.values(req)).size!==5)return result(OUTCOMES.DENIED,"invalid exact identity request");
  let cs,st,p,a;
  try{
   cs=claimSnapshotPort({attemptClaimId:req.attemptClaimId});
   st=startRecordPort({executionStartId:req.executionStartId});
   p=preparationPort({executionPreparationId:req.executionPreparationId});
   a=authorizationPort({authorizationId:req.authorizationId});
  }catch(_){return result(OUTCOMES.UNKNOWN,"current evidence unavailable");}
  const c=cs?.record;
  if(!cs||!nonempty(cs.evidenceRef)||!Number.isInteger(cs.claimHistoryRevision)
   ||cs.currentClaimId!==req.attemptClaimId||cs.competingActiveClaim!==false
   ||cs.uncertainClaimHistory!==false||cs.conflictingLifecycleEvidence!==false
   ||cs.adapterRegistrationCurrent!==true||cs.ownerIdentityCurrent!==true
   ||!c||c.type!=="EXECUTION_ATTEMPT_CLAIM"||c.status!=="ATTEMPT_CLAIMED"
   ||c.attemptClaimId!==req.attemptClaimId||c.executionAttemptId!==req.executionAttemptId
   ||c.ownershipState!=="ACTIVE"||c.exclusiveOwnership!==true
   ||!Number.isInteger(c.claimRevision)||!nonempty(c.preparationEvidenceRef)
   ||!nonempty(c.authorityEvidenceRef)||!nonempty(c.effectContractRef))
    return result(OUTCOMES.DENIED,"native claim missing, stale or conflicting");
  if(!st||st.type!=="EXECUTION_ATTEMPT_START"||st.status!=="EXECUTION_ATTEMPT_STARTED"
   ||st.executionStartId!==req.executionStartId||st.executionAttemptId!==req.executionAttemptId
   ||st.attemptClaimId!==req.attemptClaimId||st.claimEvidenceRef!==cs.evidenceRef
   ||st.claimRevision!==c.claimRevision||st.executionActivityStarted!==true
   ||st.singleAuthoritativeStart!==true||st.preparationEvidenceRef!==c.preparationEvidenceRef
   ||st.authorityEvidenceRef!==c.authorityEvidenceRef||st.effectContractRef!==c.effectContractRef)
    return result(OUTCOMES.DENIED,"native Start not bound to current claim");
  if(!p||p.executionPreparationId!==req.executionPreparationId||p.authorizationId!==req.authorizationId
   ||p.effectPerformed!==false||p.authorityEffect!=="NONE"
   ||!a||a.authorizationId!==req.authorizationId||a.authorizationState!=="AUTHORIZED"
   ||a.consumptionState!=="UNCONSUMED"||a.effectPerformed!==false||a.authorityEffect!=="NONE")
    return result(OUTCOMES.DENIED,"filesystem preparation or authorization not current");
  // Native preparationEvidenceRef is not a filesystem executionPreparationId.
  // A separate trusted cross-domain binding must prove the relationship.
  return result(OUTCOMES.UNKNOWN,"CROSS_DOMAIN_BINDING_NOT_PROVEN: native preparationEvidenceRef != filesystem executionPreparationId");
 }
 return Object.freeze({assess,outcomes:OUTCOMES,authority:"NONE"});
}
module.exports=Object.freeze({createNativeFilesystemLifecycleCompatibilityV0,OUTCOMES});
