"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "trusted-governance-evidence-surface-provider-v0.1.0";
const SCHEMA_VERSION = "1.0";
const OUTCOMES = Object.freeze({
  PRODUCED: "TRUSTED_GOVERNANCE_EVIDENCE_SURFACE_PRODUCED",
  UNKNOWN: "TRUSTED_GOVERNANCE_EVIDENCE_SURFACE_UNKNOWN",
  CONFLICT: "TRUSTED_GOVERNANCE_EVIDENCE_SURFACE_CONFLICT",
  REJECTED: "TRUSTED_GOVERNANCE_EVIDENCE_SURFACE_REJECTED"
});

function plain(v){ return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function nonEmpty(v){ return typeof v === "string" && v.length > 0; }
function compare(a,b){ return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0; }
function canonicalize(v){
  if (Array.isArray(v)) return v.map(canonicalize);
  if (plain(v)) return Object.keys(v).sort(compare).reduce((o,k)=>{ o[k.normalize("NFC")]=canonicalize(v[k]); return o; },{});
  return typeof v === "string" ? v.normalize("NFC") : v;
}
const canonicalStringify = (v)=>JSON.stringify(canonicalize(v));
const digestValue = (v)=>`sha256:${crypto.createHash("sha256").update(Buffer.from(canonicalStringify(v),"utf8")).digest("hex")}`;
function deepFreeze(v){ if(v && typeof v === "object" && !Object.isFrozen(v)){ Object.freeze(v); Object.values(v).forEach(deepFreeze); } return v; }
function result(outcome, reason, surface=null){ return deepFreeze({ outcome, reason: reason || null, surface, authority:"NONE" }); }
function call(port,arg){ try { return {ok:true,value:port(deepFreeze(canonicalize(arg)))}; } catch(_){ return {ok:false,value:null}; } }

function snapshotMaterial(s){
  return canonicalize({
    type:s.type, ledgerRef:s.ledgerRef, ledgerRevision:s.ledgerRevision, frameRevision:s.frameRevision,
    completeThroughSequence:s.completeThroughSequence, complete:s.complete, entries:s.entries,
    snapshotEvidenceRef:s.snapshotEvidenceRef, authority:s.authority
  });
}
function validRegistry(r, snapshot){
  return plain(r) && r.ledgerRef===snapshot.ledgerRef && r.ledgerRevision===snapshot.ledgerRevision
    && r.frameRevision===snapshot.frameRevision && r.completeThroughSequence===snapshot.completeThroughSequence
    && r.snapshotDigest===digestValue(snapshotMaterial(snapshot)) && r.trustState==="TRUSTED"
    && nonEmpty(r.registryEvidenceRef) && r.authority==="NONE";
}
function validAccepted(record, kind){
  if (!plain(record) || record.authority !== "NONE") return false;
  if (kind === "POLICY") return record.type === "GOVERNANCE_ROLE_POLICY_REQUIREMENT_EVIDENCE_ACCEPTANCE" && nonEmpty(record.policyAcceptanceId) && nonEmpty(record.policyRef) && nonEmpty(record.policyRevision);
  if (kind === "ASSIGNMENT") return record.type === "DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE" && nonEmpty(record.assignmentAcceptanceId) && nonEmpty(record.assignmentRef) && nonEmpty(record.assignmentRevision);
  return record.type === "DIRECT_DELEGATION_EVIDENCE_ACCEPTANCE" && nonEmpty(record.delegationAcceptanceId) && nonEmpty(record.delegationRef) && nonEmpty(record.delegationRevision);
}
function identity(record, kind){
  return kind === "POLICY" ? [record.policyAcceptanceId,record.policyRef,record.policyRevision]
    : kind === "ASSIGNMENT" ? [record.assignmentAcceptanceId,record.assignmentRef,record.assignmentRevision]
      : [record.delegationAcceptanceId,record.delegationRef,record.delegationRevision];
}
function validLifecycleRecord(r){
  return plain(r) && nonEmpty(r.acceptanceId) && ["POLICY","ASSIGNMENT","DELEGATION"].includes(r.kind)
    && ["CURRENT","STALE","REVOKED","DEACTIVATED","SUPERSEDED","UNKNOWN","CONFLICT"].includes(r.state)
    && nonEmpty(r.lifecycleRevision) && ["NONE","CONFLICT"].includes(r.contradictionState) && nonEmpty(r.evidenceRef);
}
function validSnapshot(s, expectedType, frame){
  return plain(s) && s.type===expectedType && nonEmpty(s.ledgerRef) && nonEmpty(s.ledgerRevision)
    && s.frameRevision===frame && Number.isInteger(s.completeThroughSequence) && s.completeThroughSequence>=0
    && s.complete===true && Array.isArray(s.entries) && nonEmpty(s.snapshotEvidenceRef) && s.authority==="NONE";
}
function uniqueSequences(entries){
  const seen=new Set();
  for(const e of entries){ if(!plain(e)||!Number.isInteger(e.sequence)||e.sequence<1||seen.has(e.sequence)) return false; seen.add(e.sequence); }
  return true;
}

function createTrustedGovernanceEvidenceSurfaceProvider({ acceptedLedgerSnapshotPort, lifecycleLedgerSnapshotPort, ledgerRegistryPort }){
  for(const [n,p] of Object.entries({acceptedLedgerSnapshotPort,lifecycleLedgerSnapshotPort,ledgerRegistryPort})) if(typeof p!=="function") throw new TypeError(`${n} must be a function`);

  function produce(request){
    if(!plain(request) || Object.keys(request).length!==2 || request.rulesetVersion!==RULESET_VERSION || !nonEmpty(request.frameRevision)) return result(OUTCOMES.REJECTED,"unsupported request");

    const a=call(acceptedLedgerSnapshotPort,{frameRevision:request.frameRevision});
    const l=call(lifecycleLedgerSnapshotPort,{frameRevision:request.frameRevision});
    if(!a.ok || !l.ok) return result(OUTCOMES.UNKNOWN,"required ledger snapshot unavailable");
    if(!validSnapshot(a.value,"ACCEPTED_GOVERNANCE_EVIDENCE_LEDGER_SNAPSHOT",request.frameRevision)
      || !validSnapshot(l.value,"GOVERNANCE_LIFECYCLE_LEDGER_SNAPSHOT",request.frameRevision)) return result(OUTCOMES.REJECTED,"invalid ledger snapshot contract");
    if(!uniqueSequences(a.value.entries)||!uniqueSequences(l.value.entries)) return result(OUTCOMES.CONFLICT,"duplicate or invalid ledger sequence");
    if(a.value.entries.some(e=>e.sequence>a.value.completeThroughSequence) || l.value.entries.some(e=>e.sequence>l.value.completeThroughSequence)) return result(OUTCOMES.CONFLICT,"entry exceeds complete ledger head");

    for(const s of [a.value,l.value]){
      const rr=call(ledgerRegistryPort,{ledgerRef:s.ledgerRef,ledgerRevision:s.ledgerRevision,frameRevision:s.frameRevision});
      if(!rr.ok) return result(OUTCOMES.UNKNOWN,"ledger registry unavailable");
      if(!validRegistry(rr.value,s)) return result(OUTCOMES.UNKNOWN,"ledger snapshot bytes/head/frame are not trusted and bound");
    }

    const accepted={POLICY:[],ASSIGNMENT:[],DELEGATION:[]};
    const latestByRef=new Map();
    const acceptanceIds=new Map();
    for(const entry of [...a.value.entries].sort((x,y)=>x.sequence-y.sequence)){
      if(!plain(entry) || !["POLICY","ASSIGNMENT","DELEGATION"].includes(entry.kind) || !validAccepted(entry.record,entry.kind)) return result(OUTCOMES.REJECTED,"invalid accepted ledger entry");
      const [id,ref,revision]=identity(entry.record,entry.kind);
      if(acceptanceIds.has(id)) return result(OUTCOMES.CONFLICT,"accepted identity appears more than once");
      acceptanceIds.set(id,entry.kind);
      accepted[entry.kind].push(canonicalize(entry.record));
      latestByRef.set(`${entry.kind}\u0000${ref}`,{kind:entry.kind,ref,completeThroughRevision:revision,evidenceRef:a.value.snapshotEvidenceRef,sequence:entry.sequence});
    }

    const lifecycle={POLICY:[],ASSIGNMENT:[],DELEGATION:[]};
    const lifecycleIds=new Set();
    for(const entry of [...l.value.entries].sort((x,y)=>x.sequence-y.sequence)){
      if(!plain(entry)||!validLifecycleRecord(entry.record)) return result(OUTCOMES.REJECTED,"invalid lifecycle ledger entry");
      const r=entry.record;
      if(!acceptanceIds.has(r.acceptanceId) || acceptanceIds.get(r.acceptanceId)!==r.kind) return result(OUTCOMES.CONFLICT,"lifecycle record is unbound to accepted evidence");
      if(lifecycleIds.has(r.acceptanceId)) return result(OUTCOMES.CONFLICT,"multiple lifecycle records for one accepted identity");
      lifecycleIds.add(r.acceptanceId);
      lifecycle[r.kind].push(canonicalize(r));
    }
    for(const id of acceptanceIds.keys()) if(!lifecycleIds.has(id)) return result(OUTCOMES.UNKNOWN,"lifecycle coverage incomplete");

    const coverage=[...latestByRef.values()].map(({sequence,...x})=>x).sort((x,y)=>compare(`${x.kind}:${x.ref}`,`${y.kind}:${y.ref}`));
    const material=canonicalize({
      type:"TRUSTED_GOVERNANCE_EVIDENCE_SURFACE", schemaVersion:SCHEMA_VERSION, rulesetVersion:RULESET_VERSION,
      frameRevision:request.frameRevision,
      acceptedPolicies:accepted.POLICY, acceptedAssignments:accepted.ASSIGNMENT, acceptedDelegations:accepted.DELEGATION,
      policyLifecycle:lifecycle.POLICY, assignmentLifecycle:lifecycle.ASSIGNMENT, delegationLifecycle:lifecycle.DELEGATION,
      coverage,
      provenance:{
        acceptedLedgerRef:a.value.ledgerRef, acceptedLedgerRevision:a.value.ledgerRevision, acceptedLedgerHead:a.value.completeThroughSequence, acceptedSnapshotEvidenceRef:a.value.snapshotEvidenceRef,
        lifecycleLedgerRef:l.value.ledgerRef, lifecycleLedgerRevision:l.value.ledgerRevision, lifecycleLedgerHead:l.value.completeThroughSequence, lifecycleSnapshotEvidenceRef:l.value.snapshotEvidenceRef
      }
    });
    const surfaceDigest=digestValue(material);
    return result(OUTCOMES.PRODUCED,null,deepFreeze({surfaceId:`governance-surface:${surfaceDigest.slice(7)}`,surfaceDigest,...material,authority:"NONE"}));
  }
  return Object.freeze({produce});
}
module.exports=Object.freeze({RULESET_VERSION,OUTCOMES,createTrustedGovernanceEvidenceSurfaceProvider,canonicalStringify,digestValue});
