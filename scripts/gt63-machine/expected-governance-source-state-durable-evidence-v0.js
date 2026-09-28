"use strict";

const COLLECTION="gt63GovernanceEvidence";
const REPRESENTATION_REVISION=1;
const EVIDENCE_TYPE="GT63_EXPECTED_GOVERNANCE_SOURCE_STATE_ACCEPTANCE_DECISION";
const AUTHORITY="NONE";
const DECISION="ACCEPT_EXPECTED_GOVERNANCE_SOURCE_STATE";
const REPOSITORY_IDENTITY="goceterziev-creator/2l1p-neural-travel-v9";
const AUTHORITATIVE_REF="refs/heads/main";
const ROOT_PATH="config/gt63-machine/governance-trust-root-v0.json";

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function sha1(v){return typeof v==="string"&&/^[0-9a-f]{40}$/.test(v);}
function sha256(v){return typeof v==="string"&&/^sha256:[0-9a-f]{64}$/.test(v);}
function clone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function collection(db){if(!plain(db)||!Array.isArray(db[COLLECTION]))throw new Error("GT63 governance evidence ledger not established");return db[COLLECTION];}
function validate(ref,r){
  if(!nonEmpty(ref)||!plain(r))throw new TypeError("expected governance source state decision evidence required");
  if(r.expectedStateDecisionEvidenceRef!==ref||r.type!==EVIDENCE_TYPE)throw new Error("expected source state decision identity mismatch");
  if(r.decision!==DECISION||r.authority!==AUTHORITY)throw new Error("unsupported expected source state decision or authority");
  if(r.repositoryIdentity!==REPOSITORY_IDENTITY||r.authoritativeRef!==AUTHORITATIVE_REF||r.expectedRootPath!==ROOT_PATH
    ||!sha1(r.expectedCommitSha)||!sha1(r.expectedTreeSha)||!sha1(r.expectedRootBlobSha)||!sha256(r.expectedRootAnchorId)
    ||!nonEmpty(r.principalRef)||!nonEmpty(r.principalRevision)||!nonEmpty(r.principalEvidenceRef)
    ||!Array.isArray(r.observationEvidenceRefs)||r.observationEvidenceRefs.length<1||!r.observationEvidenceRefs.every(nonEmpty)
    ||new Set(r.observationEvidenceRefs).size!==r.observationEvidenceRefs.length
    ||r.lifecycleState!=="CURRENT"||r.freshnessState!=="CURRENT"||r.contradictionState!=="NONE"
    ||r.roleAssigned!==false||r.principalEligible!==false||r.humanGateSatisfied!==false
    ||r.continuationAuthorityCreated!==false||r.executionAuthorityCreated!==false||r.effectAuthorized!==false)
    throw new Error("invalid expected governance source state decision record");
}
function envelope(e){if(!plain(e)||e.representationRevision!==REPRESENTATION_REVISION||e.evidenceType!==EVIDENCE_TYPE||!nonEmpty(e.evidenceRef))throw new Error("invalid expected source state governance evidence envelope");validate(e.evidenceRef,e.record);}
function createDurableExpectedGovernanceSourceStateDecisionLedger({readDb,writeDb}={}){
  if(typeof readDb!=="function"||typeof writeDb!=="function")throw new TypeError("readDb and writeDb required");
  function get(ref){if(!nonEmpty(ref))return null;const entries=collection(readDb()),m=entries.filter(e=>e.evidenceType===EVIDENCE_TYPE&&e.evidenceRef===ref);m.forEach(envelope);if(m.length>1)throw new Error("duplicate expected source state governance evidence identity");return m.length===1?clone(m[0].record):null;}
  function commit(ref,record){validate(ref,record);const db=readDb(),entries=collection(db),m=entries.filter(e=>e.evidenceType===EVIDENCE_TYPE&&e.evidenceRef===ref);m.forEach(envelope);if(m.length>1)throw new Error("duplicate expected source state governance evidence identity");if(m.length===1){if(!same(m[0].record,record))throw new Error("conflicting expected source state governance evidence identity");return clone(m[0].record);}entries.push({evidenceRef:ref,evidenceType:EVIDENCE_TYPE,representationRevision:REPRESENTATION_REVISION,record:clone(record)});writeDb(db);return clone(record);}
  return Object.freeze({get,commit,authority:AUTHORITY,evidenceType:EVIDENCE_TYPE});
}
module.exports=Object.freeze({COLLECTION,REPRESENTATION_REVISION,EVIDENCE_TYPE,AUTHORITY,createDurableExpectedGovernanceSourceStateDecisionLedger});
