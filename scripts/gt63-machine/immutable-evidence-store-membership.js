"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="immutable-evidence-store-membership-v0.1.0";
const OUTCOMES=Object.freeze({APPENDED:"IMMUTABLE_EVIDENCE_APPENDED",ALREADY_PRESENT:"IMMUTABLE_EVIDENCE_ALREADY_PRESENT",MEMBERSHIP_VERIFIED:"IMMUTABLE_EVIDENCE_MEMBERSHIP_VERIFIED",NOT_FOUND:"IMMUTABLE_EVIDENCE_NOT_FOUND",REJECTED:"IMMUTABLE_EVIDENCE_REJECTED",CONFLICT:"IMMUTABLE_EVIDENCE_CONFLICT"});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v));
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function canonicalize(v){if(Array.isArray(v))return v.map(canonicalize);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonicalize(v[k]),o),{});return v;}
const canonicalStringify=v=>JSON.stringify(canonicalize(v));
const sha256=s=>`sha256:${crypto.createHash("sha256").update(s).digest("hex")}`;
function deriveEvidenceId(evidence){return sha256(canonicalStringify(evidence));}
function deriveMembershipId(record){return sha256(canonicalStringify(record));}
function result(outcome,reason,record=null){return Object.freeze({outcome,reason:reason||null,record:clone(record),authority:"NONE",semanticAcceptanceCreated:false,continuationAuthorityCreated:false,executionAuthorityCreated:false,mutationAuthorized:false,mutationPerformed:false});}
function validEvidence(v){return plain(v)&&Object.keys(v).length>0&&v.authority==="NONE";}
function createImmutableEvidenceStoreMembership(){
 const records=new Map();
 function append(request){
  if(!plain(request)||Object.keys(request).length!==2||request.rulesetVersion!==RULESET_VERSION||!validEvidence(request.evidence))return result(OUTCOMES.REJECTED,"unsupported request schema or evidence");
  const evidence=clone(request.evidence);const evidenceId=deriveEvidenceId(evidence);const canonicalEvidence=canonicalStringify(evidence);
  const prior=records.get(evidenceId);
  if(prior){if(prior.canonicalEvidence!==canonicalEvidence)return result(OUTCOMES.CONFLICT,"evidence id collision or stored material drift");return result(OUTCOMES.ALREADY_PRESENT,"same exact evidence already stored",publicRecord(prior));}
  const base={type:"IMMUTABLE_EVIDENCE_STORE_RECORD",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,evidenceId,evidenceType:typeof evidence.type==="string"?evidence.type:null,canonicalEvidence,authority:"NONE"};
  const stored=Object.freeze({...base,membershipId:deriveMembershipId(base)});records.set(evidenceId,stored);return result(OUTCOMES.APPENDED,null,publicRecord(stored));
 }
 function retrieve(request){
  if(!plain(request)||Object.keys(request).length!==2||request.rulesetVersion!==RULESET_VERSION||typeof request.evidenceId!=="string"||!request.evidenceId.startsWith("sha256:"))return result(OUTCOMES.REJECTED,"unsupported retrieval request");
  const stored=records.get(request.evidenceId);if(!stored)return result(OUTCOMES.NOT_FOUND,"evidence id not found");return result(OUTCOMES.MEMBERSHIP_VERIFIED,null,publicRecord(stored));
 }
 function verifyMembership(request){
  if(!plain(request)||Object.keys(request).length!==3||request.rulesetVersion!==RULESET_VERSION||typeof request.evidenceId!=="string"||typeof request.membershipId!=="string")return result(OUTCOMES.REJECTED,"unsupported membership request");
  const stored=records.get(request.evidenceId);if(!stored)return result(OUTCOMES.NOT_FOUND,"evidence id not found");if(stored.membershipId!==request.membershipId)return result(OUTCOMES.CONFLICT,"membership identity mismatch");return result(OUTCOMES.MEMBERSHIP_VERIFIED,null,publicRecord(stored));
 }
 function publicRecord(stored){const evidence=JSON.parse(stored.canonicalEvidence);return Object.freeze({type:stored.type,schemaVersion:stored.schemaVersion,rulesetVersion:stored.rulesetVersion,evidenceId:stored.evidenceId,evidenceType:stored.evidenceType,evidence,membershipId:stored.membershipId,authority:"NONE"});}
 return Object.freeze({append,retrieve,verifyMembership});
}
module.exports=Object.freeze({RULESET_VERSION,OUTCOMES,canonicalStringify,deriveEvidenceId,createImmutableEvidenceStoreMembership});
