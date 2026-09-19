"use strict";

const RULESET_VERSION="genesis-trust-async-ledger-db-composition-v0.1.0";
const SCHEMA_VERSION="gt63-governance-evidence-v0";
const AUTHORITY="NONE";
const AUTHORITY_EFFECT="NONE";

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v);}
function canon(v){if(Array.isArray(v))return v.map(canon);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canon(v[k]),o),{});return v;}
function same(a,b){return JSON.stringify(canon(a))===JSON.stringify(canon(b));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
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
 if(hits.length===1){if(!same(hits[0],record))throw new Error("persistent-ledger-conflict");return clone(hits[0]);}
 records.push(clone(record)); return clone(record);
}
function createGenesisTrustAsyncLedgerDbComposition({storagePort}={}){
 if(!storagePort||typeof storagePort.read!=="function"||typeof storagePort.mutate!=="function")throw new TypeError("storagePort must expose read() and mutate()");
 const decisionLedger=Object.freeze({
  async get(id){const g=area(await storagePort.read(),false);if(!g)return null;const h=g.genesisTrustDecisions.filter(x=>x&&x.decisionEvidenceRef===id);if(h.length>1)throw new Error("persistent-ledger-conflict");return h.length?clone(h[0]):null;},
  async commit(id,record){let out;await storagePort.mutate(db=>{const g=area(db,true);out=immutableCommit(g.genesisTrustDecisions,"decisionEvidenceRef",id,record);return db;});return clone(out);}
 });
 const provenanceLedger=Object.freeze({
  async findByEvidenceRef(id){const g=area(await storagePort.read(),false);return g?g.genesisTrustDecisionProvenances.filter(x=>x&&x.evidenceRef===id).map(clone):[];},
  async commit(record){if(!plain(record)||!nonEmpty(record.evidenceRef))throw new Error("evidenceRef required");let out;await storagePort.mutate(db=>{const g=area(db,true);out=immutableCommit(g.genesisTrustDecisionProvenances,"evidenceRef",record.evidenceRef,record);return db;});return clone(out);}
 });
 const registrationLedger=Object.freeze({
  async findByRegistrationRef(id){const g=area(await storagePort.read(),false);return g?g.genesisSourceChannelTrustRegistrations.filter(x=>x&&x.registrationRef===id).map(clone):[];},
  async commit(record){if(!plain(record)||!nonEmpty(record.registrationRef)||!nonEmpty(record.acceptanceId))throw new Error("registrationRef and acceptanceId required");let out;await storagePort.mutate(db=>{const g=area(db,true),hits=g.genesisSourceChannelTrustRegistrations.filter(x=>x&&x.registrationRef===record.registrationRef);if(hits.length>1)throw new Error("persistent-ledger-conflict");if(hits.length===1){if(!same(hits[0],record))throw new Error("persistent-ledger-conflict");out=clone(hits[0]);return db;}if(g.genesisSourceChannelTrustRegistrations.some(x=>x&&x.acceptanceId===record.acceptanceId))throw new Error("persistent-ledger-conflict");g.genesisSourceChannelTrustRegistrations.push(clone(record));out=clone(record);return db;});return clone(out);}
 });
 return Object.freeze({decisionLedger,provenanceLedger,registrationLedger,rulesetVersion:RULESET_VERSION,schemaVersion:SCHEMA_VERSION,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
}
module.exports=Object.freeze({RULESET_VERSION,SCHEMA_VERSION,AUTHORITY,AUTHORITY_EFFECT,createGenesisTrustAsyncLedgerDbComposition});
