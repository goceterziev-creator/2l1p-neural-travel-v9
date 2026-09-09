"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="bootstrap-approval-evidence-composition-v0.1.0";
const GOVERNANCE_ACT="INITIAL_GOVERNANCE_BOOTSTRAP";
const OUTCOMES=Object.freeze({COMPOSED:"BOOTSTRAP_APPROVAL_EVIDENCE_COMPOSED",ALREADY_COMPOSED:"BOOTSTRAP_APPROVAL_EVIDENCE_ALREADY_COMPOSED",REJECTED:"BOOTSTRAP_APPROVAL_EVIDENCE_REJECTED",STALE:"BOOTSTRAP_APPROVAL_EVIDENCE_STALE",UNCERTAIN:"BOOTSTRAP_APPROVAL_EVIDENCE_UNCERTAIN",CONFLICT:"BOOTSTRAP_APPROVAL_EVIDENCE_CONFLICT"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v));
const nonEmpty=v=>typeof v==="string"&&v.length>0;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function canonicalize(v){if(Array.isArray(v))return v.map(canonicalize);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonicalize(v[k]),o),{});return v;}
const canonicalStringify=v=>JSON.stringify(canonicalize(v));
const digest=v=>`sha256:${crypto.createHash("sha256").update(canonicalStringify(v)).digest("hex")}`;
function result(outcome,reason,evidence=null){return Object.freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:"NONE",humanAuthorizationCreated:false,mutationAuthorized:false,mutationPerformed:false});}
function validPresentation(p){return plain(p)&&p.type==="BOOTSTRAP_APPROVAL_PRESENTATION_EVIDENCE"&&nonEmpty(p.presentationId)&&nonEmpty(p.presentationEvidenceId)&&nonEmpty(p.interactionId)&&/^sha256:[0-9a-f]{64}$/.test(p.payloadDigest)&&Number.isInteger(p.payloadByteLength)&&p.payloadByteLength>0&&p.authority==="NONE";}
function validCapture(c){return plain(c)&&c.type==="BOOTSTRAP_APPROVAL_CAPTURE_EVIDENCE"&&nonEmpty(c.captureEvidenceId)&&nonEmpty(c.presentationId)&&nonEmpty(c.presentationEvidenceId)&&nonEmpty(c.interactionId)&&nonEmpty(c.bindingId)&&nonEmpty(c.sourceEventRef)&&nonEmpty(c.principalRef)&&/^sha256:[0-9a-f]{64}$/.test(c.payloadDigest)&&Number.isInteger(c.payloadByteLength)&&c.payloadByteLength>0&&c.authority==="NONE";}
function validIntent(i){return plain(i)&&i.type==="BOOTSTRAP_APPROVAL_INTENT_BINDING"&&nonEmpty(i.approvalIntentBindingId)&&i.governanceAct===GOVERNANCE_ACT&&i.decision==="APPROVE"&&nonEmpty(i.bindingId)&&nonEmpty(i.sourceEventRef)&&nonEmpty(i.principalRef)&&/^sha256:[0-9a-f]{64}$/.test(i.contentDigest)&&nonEmpty(i.bootstrapGateId)&&nonEmpty(i.bootstrapGateRevision)&&nonEmpty(i.repositoryIdentity)&&nonEmpty(i.targetPath)&&nonEmpty(i.beforeStateId)&&nonEmpty(i.afterStateId)&&i.oneTime===true&&i.authority==="NONE";}
function createBootstrapApprovalEvidenceComposition({presentationEvidencePort,captureEvidencePort,approvalIntentBindingPort,compositionLedger}){
 for(const [n,p] of Object.entries({presentationEvidencePort,captureEvidencePort,approvalIntentBindingPort}))if(typeof p!=="function")throw new TypeError(`${n} must be a function`);
 for(const n of ["findByGateId","findByBindingId","commit"])if(!compositionLedger||typeof compositionLedger[n]!=="function")throw new TypeError(`compositionLedger.${n} must be a function`);
 function compose(request){
  const fields=["rulesetVersion","presentationId","captureEvidenceId","approvalIntentBindingId","bootstrapGateId"];
  if(!plain(request)||Object.keys(request).length!==fields.length||!fields.every(k=>nonEmpty(request[k]))||request.rulesetVersion!==RULESET_VERSION)return result(OUTCOMES.REJECTED,"unsupported request schema or ruleset");
  let p,c,i;try{p=presentationEvidencePort({presentationId:request.presentationId});c=captureEvidencePort({captureEvidenceId:request.captureEvidenceId});i=approvalIntentBindingPort({approvalIntentBindingId:request.approvalIntentBindingId});}catch(_){return result(OUTCOMES.UNCERTAIN,"approval evidence prerequisite unavailable");}
  if(!validPresentation(p)||!validCapture(c)||!validIntent(i))return result(OUTCOMES.UNCERTAIN,"approval evidence prerequisite invalid");
  if(i.bootstrapGateId!==request.bootstrapGateId)return result(OUTCOMES.STALE,"approval intent gate differs from requested gate");
  const continuity=c.presentationId===p.presentationId&&c.presentationEvidenceId===p.presentationEvidenceId&&c.interactionId===p.interactionId&&c.payloadDigest===p.payloadDigest&&c.payloadByteLength===p.payloadByteLength&&i.bindingId===c.bindingId&&i.sourceEventRef===c.sourceEventRef&&i.principalRef===c.principalRef&&i.contentDigest===c.payloadDigest;
  if(!continuity)return result(OUTCOMES.CONFLICT,"presentation capture and intent evidence do not form one exact chain");
  let byGate,byBinding;try{byGate=compositionLedger.findByGateId(i.bootstrapGateId);byBinding=compositionLedger.findByBindingId(i.bindingId);}catch(_){return result(OUTCOMES.UNCERTAIN,"composition ledger unavailable");}
  if(!Array.isArray(byGate)||!Array.isArray(byBinding))return result(OUTCOMES.UNCERTAIN,"composition ledger invalid");
  if(byGate.length>1||byBinding.length>1)return result(OUTCOMES.CONFLICT,"multiple composed approvals for one-time gate or binding");
  const material={type:"BOOTSTRAP_APPROVAL_COMPOSED_EVIDENCE",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,governanceAct:GOVERNANCE_ACT,decision:"APPROVE",principalRef:i.principalRef,bindingId:i.bindingId,sourceEventRef:i.sourceEventRef,presentationId:p.presentationId,presentationEvidenceId:p.presentationEvidenceId,captureEvidenceId:c.captureEvidenceId,approvalIntentBindingId:i.approvalIntentBindingId,payloadDigest:p.payloadDigest,bootstrapGateId:i.bootstrapGateId,bootstrapGateRevision:i.bootstrapGateRevision,repositoryIdentity:i.repositoryIdentity,targetPath:i.targetPath,beforeStateId:i.beforeStateId,afterStateId:i.afterStateId,oneTime:true,authority:"NONE"};
  const evidence={...material,composedApprovalEvidenceId:digest(material)};
  const prior=byGate[0]||byBinding[0]||null;
  if(prior)return canonicalStringify(prior)===canonicalStringify(evidence)?result(OUTCOMES.ALREADY_COMPOSED,"same exact approval evidence already composed",prior):result(OUTCOMES.CONFLICT,"gate or binding already composed differently");
  let stored;try{stored=compositionLedger.commit(evidence);}catch(_){return result(OUTCOMES.CONFLICT,"composition ledger commit conflict");}
  if(canonicalStringify(stored)!==canonicalStringify(evidence))return result(OUTCOMES.CONFLICT,"composition ledger did not preserve exact evidence");
  return result(OUTCOMES.COMPOSED,null,evidence);
 }
 return Object.freeze({compose});
}
module.exports=Object.freeze({RULESET_VERSION,GOVERNANCE_ACT,OUTCOMES,canonicalStringify,createBootstrapApprovalEvidenceComposition});
