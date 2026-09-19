"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "genesis-source-channel-trust-registration-v0.1.0";
const AUTHORITY = "NONE";
const AUTHORITY_EFFECT = "NONE";
const SUBJECT = Object.freeze({
  registrationRef: "gt63-machine:trust-registration:genesis-human-source-ingress-v0",
  registrationRevision: "1",
  sourceProviderRef: "gt63-machine:genesis-human-source-ingress-v0",
  sourceProviderRevision: "1",
  channelRef: "gt63-machine:channel:authenticated-genesis-http-ingress-v0",
  channelRevision: "1",
  verificationMethodRef: "gt63-machine:verification-method:authenticated-genesis-session-continuity-v0",
  verificationMethodRevision: "1"
});
const OUTCOMES = Object.freeze({
  AUTHORIZED:"GENESIS_TRUST_DECLARATION_AUTHORIZED",
  ACCEPTED:"GENESIS_TRUST_REGISTRATION_EVIDENCE_ACCEPTED",
  ALREADY_ACCEPTED:"GENESIS_TRUST_REGISTRATION_EVIDENCE_ALREADY_ACCEPTED",
  RESOLVED:"GENESIS_SOURCE_CHANNEL_TRUST_REGISTRATION_RESOLVED",
  REJECTED:"GENESIS_SOURCE_CHANNEL_TRUST_REJECTED",
  STALE:"GENESIS_SOURCE_CHANNEL_TRUST_STALE",
  UNCERTAIN:"GENESIS_SOURCE_CHANNEL_TRUST_UNCERTAIN",
  CONFLICT:"GENESIS_SOURCE_CHANNEL_TRUST_CONFLICT"
});
function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function canon(v){if(Array.isArray(v))return v.map(canon);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canon(v[k]),o),{});return v;}
function digest(v){return "sha256:"+crypto.createHash("sha256").update(JSON.stringify(canon(v))).digest("hex");}
function result(outcome,reason=null,evidence=null){return freeze({outcome,reason,evidence:clone(evidence),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}
function exactSubject(v){return plain(v)&&Object.keys(SUBJECT).every(k=>v[k]===SUBJECT[k]);}
function createGenesisSourceChannelTrustRegistration({trustDecisionPort,provenancePort,ledger}={}){
  if(typeof trustDecisionPort!=="function")throw new TypeError("trustDecisionPort must be a function");
  if(typeof provenancePort!=="function")throw new TypeError("provenancePort must be a function");
  for(const n of ["findByRegistrationRef","commit"])if(!ledger||typeof ledger[n]!=="function")throw new TypeError("ledger."+n+" must be a function");

  function authorize(request){
    if(!plain(request)||Object.keys(request).sort().join("|")!==["registrationRef","registrationRevision","rulesetVersion"].sort().join("|")
      ||request.rulesetVersion!==RULESET_VERSION||request.registrationRef!==SUBJECT.registrationRef||request.registrationRevision!==SUBJECT.registrationRevision)
      return result(OUTCOMES.REJECTED,"unsupported request schema or subject");
    let d;try{d=trustDecisionPort(clone(SUBJECT));}catch(_){return result(OUTCOMES.UNCERTAIN,"trust decision unavailable");}
    if(!exactSubject(d)||d.type!=="GT63_GENESIS_SOURCE_CHANNEL_TRUST_DECISION"||d.decision!=="APPROVE_TRUST_REGISTRATION"
      ||d.sourceTrustState!=="TRUSTED"||d.channelTrustState!=="TRUSTED"||d.verificationMethodTrustState!=="TRUSTED"
      ||d.lifecycleState!=="CURRENT"||d.freshnessState!=="CURRENT"||d.contradictionState!=="NONE"||d.authority!=="NONE"
      ||!nonEmpty(d.decisionEvidenceRef)) return result(OUTCOMES.REJECTED,"trust decision is not exact/current/subject-bound");
    let p;try{p=provenancePort({evidenceRef:d.decisionEvidenceRef});}catch(_){return result(OUTCOMES.UNCERTAIN,"trust provenance unavailable");}
    if(!plain(p)||p.evidenceRef!==d.decisionEvidenceRef||p.subjectRef!==SUBJECT.registrationRef||p.subjectRevision!==SUBJECT.registrationRevision
      ||p.acceptanceState!=="ACCEPTED"||p.lifecycleState!=="CURRENT"||p.freshnessState!=="CURRENT"||p.contradictionState!=="NONE"
      ||!nonEmpty(p.provenanceEvidenceRef)) return result(OUTCOMES.REJECTED,"trust provenance is not accepted/current/subject-bound");
    const material=freeze({type:"GT63_GENESIS_SOURCE_CHANNEL_TRUST_REGISTRATION",rulesetVersion:RULESET_VERSION,...SUBJECT,
      sourceTrustState:"TRUSTED",channelTrustState:"TRUSTED",verificationMethodTrustState:"TRUSTED",
      lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",
      decisionEvidenceRef:d.decisionEvidenceRef,provenanceEvidenceRef:p.provenanceEvidenceRef,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
    return result(OUTCOMES.AUTHORIZED,null,freeze({authorizationId:"genesis-trust-authorization:"+digest(material).slice(7),...material}));
  }

  function accept(authorization){
    if(!plain(authorization)||authorization.outcome!==OUTCOMES.AUTHORIZED||!plain(authorization.evidence)||!exactSubject(authorization.evidence))
      return result(OUTCOMES.REJECTED,"exact trust authorization required");
    const a=authorization.evidence;
    if(a.lifecycleState!=="CURRENT"||a.freshnessState!=="CURRENT")return result(OUTCOMES.STALE,"trust authorization not current");
    if(a.contradictionState!=="NONE")return result(OUTCOMES.CONFLICT,"trust authorization contradictory");
    let prior;try{prior=ledger.findByRegistrationRef(SUBJECT.registrationRef);}catch(_){return result(OUTCOMES.UNCERTAIN,"registration ledger unavailable");}
    if(!Array.isArray(prior))return result(OUTCOMES.UNCERTAIN,"registration ledger invalid");
    if(prior.length>1)return result(OUTCOMES.CONFLICT,"multiple accepted registrations");
    const material=freeze({type:"ACCEPTED_GT63_GENESIS_SOURCE_CHANNEL_TRUST_REGISTRATION",rulesetVersion:RULESET_VERSION,...SUBJECT,
      sourceTrustState:a.sourceTrustState,channelTrustState:a.channelTrustState,verificationMethodTrustState:a.verificationMethodTrustState,
      lifecycleState:a.lifecycleState,freshnessState:a.freshnessState,contradictionState:a.contradictionState,
      authorizationId:a.authorizationId,decisionEvidenceRef:a.decisionEvidenceRef,provenanceEvidenceRef:a.provenanceEvidenceRef,
      authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
    const evidence=freeze({acceptanceId:"genesis-trust-registration-acceptance:"+digest(material).slice(7),...material});
    if(prior.length===1)return JSON.stringify(canon(prior[0]))===JSON.stringify(canon(evidence))
      ?result(OUTCOMES.ALREADY_ACCEPTED,"same registration already accepted",prior[0])
      :result(OUTCOMES.CONFLICT,"registration subject already accepted with different material");
    let committed;try{committed=ledger.commit(evidence);}catch(_){return result(OUTCOMES.CONFLICT,"registration ledger commit conflict");}
    if(!committed||committed.acceptanceId!==evidence.acceptanceId)return result(OUTCOMES.CONFLICT,"registration ledger returned conflicting identity");
    return result(OUTCOMES.ACCEPTED,null,committed);
  }

  function resolve(){
    let records;try{records=ledger.findByRegistrationRef(SUBJECT.registrationRef);}catch(_){return result(OUTCOMES.UNCERTAIN,"registration ledger unavailable");}
    if(!Array.isArray(records)||records.length===0)return result(OUTCOMES.UNCERTAIN,"registration missing");
    if(records.length!==1)return result(OUTCOMES.CONFLICT,"multiple accepted registrations");
    const r=records[0];
    if(!exactSubject(r))return result(OUTCOMES.CONFLICT,"registration subject mismatch");
    if(r.lifecycleState!=="CURRENT"||r.freshnessState!=="CURRENT")return result(OUTCOMES.STALE,"registration not current");
    if(r.contradictionState!=="NONE")return result(OUTCOMES.CONFLICT,"registration contradictory");
    if(r.sourceTrustState!=="TRUSTED"||r.channelTrustState!=="TRUSTED"||r.verificationMethodTrustState!=="TRUSTED")
      return result(OUTCOMES.REJECTED,"registration not fully trusted");
    return result(OUTCOMES.RESOLVED,null,r);
  }

  function projectSourceRegistry(){
    const rr=resolve(); if(rr.outcome!==OUTCOMES.RESOLVED)return rr;
    const r=rr.evidence;
    return result(OUTCOMES.RESOLVED,null,freeze({
      sourceProviderRef:r.sourceProviderRef,sourceProviderRevision:r.sourceProviderRevision,
      channelRef:r.channelRef,channelRevision:r.channelRevision,trustState:"TRUSTED",
      registryEvidenceRef:r.acceptanceId
    }));
  }
  return freeze({authorize,accept,resolve,projectSourceRegistry,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT,rulesetVersion:RULESET_VERSION});
}
function createMemoryLedger(){
 const records=[];
 return freeze({
  findByRegistrationRef(ref){return records.filter(x=>x.registrationRef===ref).map(clone);},
  commit(record){if(records.some(x=>x.acceptanceId===record.acceptanceId))throw new Error("immutable-ledger-conflict");records.push(clone(record));return clone(record);},
  records(){return records.map(clone);}
 });
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,AUTHORITY_EFFECT,SUBJECT,OUTCOMES,createGenesisSourceChannelTrustRegistration,createMemoryLedger});
