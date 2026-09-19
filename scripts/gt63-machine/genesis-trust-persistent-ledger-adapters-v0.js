"use strict";

const RULESET_VERSION = "genesis-trust-persistent-ledger-adapters-v0.1.0";
const SCHEMA_VERSION = "gt63-governance-evidence-v0";
const AUTHORITY = "NONE";
const AUTHORITY_EFFECT = "NONE";

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v);}
function canon(v){if(Array.isArray(v))return v.map(canon);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canon(v[k]),o),{});return v;}
function same(a,b){return JSON.stringify(canon(a))===JSON.stringify(canon(b));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function requireStore(store){
  if(!store||typeof store.read!=="function"||typeof store.mutate!=="function")throw new TypeError("storagePort must expose read() and mutate()");
}
function area(db,create=false){
  if(!plain(db))throw new Error("invalid persistent snapshot");
  if(db.gt63GovernanceEvidence==null){
    if(!create)return null;
    db.gt63GovernanceEvidence={schemaVersion:SCHEMA_VERSION,genesisTrustDecisions:[],genesisTrustDecisionProvenances:[],genesisSourceChannelTrustRegistrations:[]};
  }
  const g=db.gt63GovernanceEvidence;
  if(!plain(g)||g.schemaVersion!==SCHEMA_VERSION)throw new Error("unsupported governance evidence schema");
  for(const k of ["genesisTrustDecisions","genesisTrustDecisionProvenances","genesisSourceChannelTrustRegistrations"])if(!Array.isArray(g[k]))throw new Error("invalid governance evidence collection: "+k);
  return g;
}
function immutableCommit(records,idKey,id,record){
  if(!nonEmpty(id)||!plain(record)||record[idKey]!==id)throw new Error("record identity mismatch");
  const hits=records.filter(x=>x&&x[idKey]===id);
  if(hits.length>1)throw new Error("persistent-ledger-conflict");
  if(hits.length===1){
    if(!same(hits[0],record))throw new Error("persistent-ledger-conflict");
    return clone(hits[0]);
  }
  records.push(clone(record));
  return clone(record);
}
function createGenesisTrustPersistentLedgerAdapters({storagePort}={}){
  requireStore(storagePort);
  const decisionLedger={
    get(id){const g=area(storagePort.read(),false);if(!g)return null;const h=g.genesisTrustDecisions.filter(x=>x&&x.decisionEvidenceRef===id);if(h.length>1)throw new Error("persistent-ledger-conflict");return h.length?clone(h[0]):null;},
    commit(id,record){let out;storagePort.mutate(db=>{const g=area(db,true);out=immutableCommit(g.genesisTrustDecisions,"decisionEvidenceRef",id,record);return db;});return clone(out);}
  };
  const provenanceLedger={
    findByEvidenceRef(id){const g=area(storagePort.read(),false);return g?g.genesisTrustDecisionProvenances.filter(x=>x&&x.evidenceRef===id).map(clone):[];},
    commit(record){if(!plain(record)||!nonEmpty(record.evidenceRef))throw new Error("evidenceRef required");let out;storagePort.mutate(db=>{const g=area(db,true);out=immutableCommit(g.genesisTrustDecisionProvenances,"evidenceRef",record.evidenceRef,record);return db;});return clone(out);}
  };
  const registrationLedger={
    findByRegistrationRef(id){const g=area(storagePort.read(),false);return g?g.genesisSourceChannelTrustRegistrations.filter(x=>x&&x.registrationRef===id).map(clone):[];},
    commit(record){if(!plain(record)||!nonEmpty(record.registrationRef)||!nonEmpty(record.acceptanceId))throw new Error("registrationRef and acceptanceId required");let out;storagePort.mutate(db=>{const g=area(db,true);const sameSubject=g.genesisSourceChannelTrustRegistrations.filter(x=>x&&x.registrationRef===record.registrationRef);if(sameSubject.length>1)throw new Error("persistent-ledger-conflict");if(sameSubject.length===1){if(!same(sameSubject[0],record))throw new Error("persistent-ledger-conflict");out=clone(sameSubject[0]);return db;}if(g.genesisSourceChannelTrustRegistrations.some(x=>x&&x.acceptanceId===record.acceptanceId))throw new Error("persistent-ledger-conflict");g.genesisSourceChannelTrustRegistrations.push(clone(record));out=clone(record);return db;});return clone(out);}
  };
  return Object.freeze({decisionLedger:Object.freeze(decisionLedger),provenanceLedger:Object.freeze(provenanceLedger),registrationLedger:Object.freeze(registrationLedger),rulesetVersion:RULESET_VERSION,schemaVersion:SCHEMA_VERSION,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
}
function createMemoryPersistentStore(seed={}){
  let snapshot=clone(seed);
  return Object.freeze({
    read(){return clone(snapshot);},
    mutate(fn){const next=clone(snapshot);const result=fn(next)||next;snapshot=clone(result);return clone(snapshot);},
    snapshot(){return clone(snapshot);}
  });
}
module.exports=Object.freeze({RULESET_VERSION,SCHEMA_VERSION,AUTHORITY,AUTHORITY_EFFECT,createGenesisTrustPersistentLedgerAdapters,createMemoryPersistentStore});
