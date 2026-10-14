"use strict";
// Explicit cross-domain identity evidence check. Read-only; cannot grant execution.
const OUTCOMES=Object.freeze({BOUND:"BOUND",DENIED:"DENIED",UNKNOWN:"UNKNOWN"});
const nonempty=x=>typeof x==="string"&&x.length>0;
const result=(outcome,reason)=>Object.freeze({outcome,reason,authority:"NONE",executionAuthorized:false,effectPerformed:false});
function createNativeFilesystemPreparationLinkV0({nativeClaimSnapshotPort,filesystemPreparationPort,linkEvidencePort}={}){
 for(const [name,port] of Object.entries({nativeClaimSnapshotPort,filesystemPreparationPort,linkEvidencePort}))
  if(typeof port!=="function")throw new TypeError(name+" required");
 function assess(req){
  if(!req||Object.keys(req).sort().join("|")!==["attemptClaimId","executionPreparationId","linkEvidenceRef"].sort().join("|")
   ||!Object.values(req).every(nonempty)||new Set(Object.values(req)).size!==3)return result(OUTCOMES.DENIED,"invalid exact request");
  let cs,p,link;
  try{
   cs=nativeClaimSnapshotPort({attemptClaimId:req.attemptClaimId});
   p=filesystemPreparationPort({executionPreparationId:req.executionPreparationId});
   link=linkEvidencePort({linkEvidenceRef:req.linkEvidenceRef});
  }catch(_){return result(OUTCOMES.UNKNOWN,"trusted evidence unavailable");}
  const c=cs?.record;
  if(!cs||!nonempty(cs.evidenceRef)||!c||c.type!=="EXECUTION_ATTEMPT_CLAIM"
   ||c.attemptClaimId!==req.attemptClaimId||c.ownershipState!=="ACTIVE"
   ||cs.currentClaimId!==req.attemptClaimId||cs.competingActiveClaim!==false
   ||cs.uncertainClaimHistory!==false||!nonempty(c.preparationEvidenceRef)
   ||!nonempty(c.effectContractRef)||!nonempty(c.authorityEvidenceRef))
   return result(OUTCOMES.DENIED,"native claim invalid or not current");
  if(!p||p.type!=="GT63_REPEATABLE_FILESYSTEM_EFFECT_EXECUTION_PREPARATION"
   ||p.executionPreparationId!==req.executionPreparationId||p.executionState!=="READY"
   ||p.effectPerformed!==false||p.authorityEffect!=="NONE"
   ||!nonempty(p.effectContractId)||!nonempty(p.authorizationId))
   return result(OUTCOMES.DENIED,"filesystem preparation invalid or not ready");
  if(!link)return result(OUTCOMES.UNKNOWN,"cross-domain link evidence absent");
  if(link.type!=="GT63_NATIVE_FILESYSTEM_PREPARATION_LINK"
   ||link.linkEvidenceRef!==req.linkEvidenceRef||link.state!=="CURRENT"
   ||link.contradictionState!=="NONE"
   ||link.attemptClaimId!==req.attemptClaimId||link.claimEvidenceRef!==cs.evidenceRef
   ||link.nativePreparationEvidenceRef!==c.preparationEvidenceRef
   ||link.nativeEffectContractRef!==c.effectContractRef
   ||link.nativeAuthorityEvidenceRef!==c.authorityEvidenceRef
   ||link.executionPreparationId!==p.executionPreparationId
   ||link.filesystemEffectContractId!==p.effectContractId
   ||link.filesystemAuthorizationId!==p.authorizationId
   ||link.authority!=="NONE"||link.effectPerformed!==false)
   return result(OUTCOMES.DENIED,"cross-domain link evidence mismatch");
  // BOUND means identity coherence only. Evidence issuer and durable provenance
  // remain separate deployment prerequisites; never imply execution authority.
  return result(OUTCOMES.BOUND,"IDENTITY_COHERENCE_ONLY_NOT_EXECUTION_AUTHORITY");
 }
 return Object.freeze({assess,outcomes:OUTCOMES,authority:"NONE"});
}
module.exports=Object.freeze({createNativeFilesystemPreparationLinkV0,OUTCOMES});
