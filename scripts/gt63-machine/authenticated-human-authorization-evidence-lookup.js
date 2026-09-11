"use strict";

const RULESET_VERSION = "authenticated-human-authorization-evidence-lookup-v0.1.0";
const AUTHORITY = "NONE";
const OUTCOMES = Object.freeze({
  RESOLVED: "AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_RESOLVED",
  UNKNOWN: "AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_UNKNOWN",
  INVALID: "AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE_INVALID"
});

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function exact(v,fields){return plain(v)&&Object.keys(v).length===fields.length&&Object.keys(v).every(k=>fields.includes(k));}
function result(outcome,reason,evidence=null){return freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:AUTHORITY,humanGateSatisfied:false,continuationAuthorityCreated:false,executionAuthorityCreated:false,effectAuthorized:false});}

function validEvidence(e){
  return plain(e)
    && e.type === "GT63_AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE"
    && nonEmpty(e.humanAuthorizationEvidenceRef)
    && nonEmpty(e.principalRef)
    && nonEmpty(e.principalRevision)
    && nonEmpty(e.authorizationSubjectRef)
    && nonEmpty(e.authorizationSubjectRevision)
    && e.governanceAct === "GATE_AUTHORIZATION"
    && ["APPROVE","DENY","NON_AUTHORIZATION"].includes(e.decision)
    && /^sha256:[0-9a-f]{64}$/.test(e.exactSemanticDigest)
    && e.lifecycleState === "CURRENT"
    && e.freshnessState === "CURRENT"
    && e.contradictionState === "NONE"
    && e.authority === AUTHORITY;
}

function createAuthenticatedHumanAuthorizationEvidenceLookup({registry}={}){
  if(!registry||typeof registry.get!=="function") throw new TypeError("registry.get must be a function");

  function lookup(request){
    if(!exact(request,["humanAuthorizationEvidenceRef"])||!nonEmpty(request.humanAuthorizationEvidenceRef)){
      return result(OUTCOMES.INVALID,"unsupported lookup request");
    }
    let records;
    try{records=registry.get(request.humanAuthorizationEvidenceRef);}catch(_){return result(OUTCOMES.UNKNOWN,"authorization evidence registry unavailable");}
    if(records===null||records===undefined) return result(OUTCOMES.UNKNOWN,"authorization evidence not found");
    const list=Array.isArray(records)?records:[records];
    if(list.length!==1) return result(OUTCOMES.UNKNOWN,"authorization evidence identity conflict");
    const evidence=list[0];
    if(!validEvidence(evidence)) return result(OUTCOMES.UNKNOWN,"authorization evidence invalid or non-current");
    if(evidence.humanAuthorizationEvidenceRef!==request.humanAuthorizationEvidenceRef) return result(OUTCOMES.UNKNOWN,"authorization evidence reference mismatch");
    return result(OUTCOMES.RESOLVED,null,evidence);
  }

  return Object.freeze({rulesetVersion:RULESET_VERSION,authority:AUTHORITY,lookup});
}

function createMemoryRegistry(initialRecords=[]){
  const records=new Map();
  for(const record of initialRecords){
    if(!validEvidence(record)) throw new TypeError("invalid initial authorization evidence");
    const key=record.humanAuthorizationEvidenceRef;
    if(records.has(key)) throw new TypeError("duplicate authorization evidence ref");
    records.set(key,freeze(clone(record)));
  }
  return Object.freeze({get(ref){return records.has(ref)?records.get(ref):null;}});
}

module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createAuthenticatedHumanAuthorizationEvidenceLookup,createMemoryRegistry});
