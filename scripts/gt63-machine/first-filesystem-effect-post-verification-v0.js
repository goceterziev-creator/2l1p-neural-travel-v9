"use strict";

const crypto=require("node:crypto");
const RULESET_VERSION="first-filesystem-effect-post-verification-v0.1.0";
const EXPECTED_DIGEST="sha256:241d88cea11b71564b4aa1597ecf6cc49cb06a3dca4044d0afddd9ca2116f3f9";
const OUTCOMES=Object.freeze({
  VERIFIED:"FIRST_FILESYSTEM_EFFECT_VERIFIED",
  NOT_VERIFIED:"FIRST_FILESYSTEM_EFFECT_NOT_VERIFIED",
  UNKNOWN:"FIRST_FILESYSTEM_EFFECT_VERIFICATION_UNKNOWN",
  INVALID:"FIRST_FILESYSTEM_EFFECT_VERIFICATION_INVALID",
  CONFLICT:"FIRST_FILESYSTEM_EFFECT_VERIFICATION_CONFLICT"
});
function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
function stringify(v){return JSON.stringify(canonical(v));}
function digest(v){return "sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");}
function result(outcome,reason=null,verification=null){return freeze({outcome,reason,verification:clone(verification),authorityEffect:"NONE",additionalEffectAuthorized:false});}

function createFirstFilesystemEffectPostVerificationV0({runtimeEffectEvidencePort,verificationLedger}={}){
  if(typeof runtimeEffectEvidencePort!=="function") throw new TypeError("runtimeEffectEvidencePort must be a function");
  for(const n of ["findByExecutionPreparationId","commit"]){
    if(!verificationLedger||typeof verificationLedger[n]!=="function") throw new TypeError("verificationLedger."+n+" must be a function");
  }
  function verify(request){
    const fields=["rulesetVersion","executionPreparationId","runtimeEffectEvidenceRef"];
    if(!plain(request)||Object.keys(request).sort().join("|")!==fields.sort().join("|")
      ||request.rulesetVersion!==RULESET_VERSION||!nonEmpty(request.executionPreparationId)||!nonEmpty(request.runtimeEffectEvidenceRef)){
      return result(OUTCOMES.INVALID,"unsupported request schema");
    }
    let e;try{e=runtimeEffectEvidencePort({runtimeEffectEvidenceRef:request.runtimeEffectEvidenceRef});}
    catch(_){return result(OUTCOMES.UNKNOWN,"runtime effect evidence unavailable");}
    if(!plain(e)
      ||e.runtimeEffectEvidenceRef!==request.runtimeEffectEvidenceRef
      ||e.executionPreparationId!==request.executionPreparationId
      ||e.operation!=="CREATE_NEW_FILE"
      ||e.relativeTargetPath!=="GT63_FIRST_OPERATION.txt"
      ||e.effectPerformed!==true
      ||e.fileExists!==true
      ||e.byteLength!==15
      ||e.contentDigest!==EXPECTED_DIGEST
      ||e.lifecycleState!=="CURRENT"
      ||e.freshnessState!=="CURRENT"
      ||e.contradictionState!=="NONE"
      ||e.authorityEffect!=="NONE"){
      return result(OUTCOMES.NOT_VERIFIED,"runtime evidence does not prove exact first filesystem effect");
    }

    const material={
      type:"GT63_FIRST_FILESYSTEM_EFFECT_POST_VERIFICATION",
      schemaVersion:"1.0",
      rulesetVersion:RULESET_VERSION,
      executionPreparationId:request.executionPreparationId,
      runtimeEffectEvidenceRef:e.runtimeEffectEvidenceRef,
      operation:e.operation,
      relativeTargetPath:e.relativeTargetPath,
      byteLength:e.byteLength,
      contentDigest:e.contentDigest,
      verificationState:"VERIFIED",
      authorityEffect:"NONE",
      effectPerformed:true,
      effectVerified:true,
      additionalEffectAuthorized:false
    };
    const verificationId="gt63-verification:first-filesystem-effect:"+digest(material).slice(7);
    const verification=freeze({verificationId,...material});
    let prior;try{prior=verificationLedger.findByExecutionPreparationId(request.executionPreparationId);}
    catch(_){return result(OUTCOMES.UNKNOWN,"verification ledger unavailable");}
    if(!Array.isArray(prior)) return result(OUTCOMES.UNKNOWN,"verification ledger invalid");
    if(prior.length>1) return result(OUTCOMES.CONFLICT,"multiple verifications for execution preparation");
    if(prior.length===1){
      return stringify(prior[0])===stringify(verification)
        ? result(OUTCOMES.VERIFIED,"same exact effect already verified",prior[0])
        : result(OUTCOMES.CONFLICT,"execution preparation already verified with different evidence");
    }
    let committed;try{committed=verificationLedger.commit(verification);}
    catch(_){return result(OUTCOMES.CONFLICT,"verification ledger commit conflict");}
    if(!committed||stringify(committed)!==stringify(verification)) return result(OUTCOMES.CONFLICT,"verification ledger returned conflicting material");
    return result(OUTCOMES.VERIFIED,null,committed);
  }
  return freeze({verify,rulesetVersion:RULESET_VERSION,authorityEffect:"NONE"});
}
module.exports=Object.freeze({RULESET_VERSION,OUTCOMES,EXPECTED_DIGEST,createFirstFilesystemEffectPostVerificationV0});
