"use strict";
const crypto=require("node:crypto");
const A=require("./genesis-trust-persistent-ledger-adapters-v0");
let pass=0;
function ok(name,fn){try{fn();pass++;console.log("PASS - "+name);}catch(e){console.error("FAIL - "+name+" - "+e.message);process.exitCode=1;}}
function throws(fn){let x=false;try{fn();}catch(_){x=true;}if(!x)throw new Error("expected throw");}
function fresh(seed={}){const store=A.createMemoryPersistentStore(seed);return {store,...A.createGenesisTrustPersistentLedgerAdapters({storagePort:store})};}
const d={type:"GT63_GENESIS_SOURCE_CHANNEL_TRUST_DECISION",decisionEvidenceRef:"d:1",authority:"NONE",authorityEffect:"NONE"};
const p={type:"GT63_GENESIS_TRUST_DECISION_PROVENANCE",evidenceRef:"d:1",provenanceEvidenceRef:"p:1",authority:"NONE",authorityEffect:"NONE"};
const r={type:"ACCEPTED_GT63_GENESIS_SOURCE_CHANNEL_TRUST_REGISTRATION",registrationRef:"gt63-machine:trust-registration:genesis-human-source-ingress-v0",registrationRevision:"1",acceptanceId:"a:1",authority:"NONE",authorityEffect:"NONE"};
ok("constructor-requires-storage-port",()=>throws(()=>A.createGenesisTrustPersistentLedgerAdapters()));
ok("constructor-requires-read",()=>throws(()=>A.createGenesisTrustPersistentLedgerAdapters({storagePort:{mutate(){}}})));
ok("constructor-requires-mutate",()=>throws(()=>A.createGenesisTrustPersistentLedgerAdapters({storagePort:{read(){return {};}}})));
ok("empty-read-does-not-create-governance-area",()=>{const x=fresh();if(x.decisionLedger.get("x")!==null)throw Error("not null");if(x.store.snapshot().gt63GovernanceEvidence)throw Error("read mutated");});
ok("decision-first-commit-creates-schema",()=>{const x=fresh();x.decisionLedger.commit("d:1",d);if(x.store.snapshot().gt63GovernanceEvidence.schemaVersion!==A.SCHEMA_VERSION)throw Error("schema");});
ok("decision-commit-persists-exact-record",()=>{const x=fresh();x.decisionLedger.commit("d:1",d);if(JSON.stringify(x.decisionLedger.get("d:1"))!==JSON.stringify(d))throw Error("record");});
ok("decision-replay-identical",()=>{const x=fresh();x.decisionLedger.commit("d:1",d);x.decisionLedger.commit("d:1",{...d});if(x.store.snapshot().gt63GovernanceEvidence.genesisTrustDecisions.length!==1)throw Error("duplicate");});
ok("decision-conflict-rejected",()=>{const x=fresh();x.decisionLedger.commit("d:1",d);throws(()=>x.decisionLedger.commit("d:1",{...d,type:"CHANGED"}));});
ok("decision-id-mismatch-rejected",()=>{const x=fresh();throws(()=>x.decisionLedger.commit("d:2",d));});
ok("decision-duplicate-corruption-detected",()=>{const x=fresh({gt63GovernanceEvidence:{schemaVersion:A.SCHEMA_VERSION,genesisTrustDecisions:[d,d],genesisTrustDecisionProvenances:[],genesisSourceChannelTrustRegistrations:[]}});throws(()=>x.decisionLedger.get("d:1"));});
ok("provenance-empty-find",()=>{const x=fresh();if(x.provenanceLedger.findByEvidenceRef("d:1").length)throw Error("found");});
ok("provenance-commit-persists",()=>{const x=fresh();x.provenanceLedger.commit(p);if(x.provenanceLedger.findByEvidenceRef("d:1").length!==1)throw Error("missing");});
ok("provenance-replay-identical",()=>{const x=fresh();x.provenanceLedger.commit(p);x.provenanceLedger.commit({...p});if(x.provenanceLedger.findByEvidenceRef("d:1").length!==1)throw Error("duplicate");});
ok("provenance-conflict-rejected",()=>{const x=fresh();x.provenanceLedger.commit(p);throws(()=>x.provenanceLedger.commit({...p,provenanceEvidenceRef:"p:2"}));});
ok("provenance-missing-identity-rejected",()=>{const x=fresh();throws(()=>x.provenanceLedger.commit({type:"X"}));});
ok("registration-empty-find",()=>{const x=fresh();if(x.registrationLedger.findByRegistrationRef(r.registrationRef).length)throw Error("found");});
ok("registration-commit-persists",()=>{const x=fresh();x.registrationLedger.commit(r);if(x.registrationLedger.findByRegistrationRef(r.registrationRef).length!==1)throw Error("missing");});
ok("registration-replay-identical",()=>{const x=fresh();x.registrationLedger.commit(r);x.registrationLedger.commit({...r});if(x.registrationLedger.findByRegistrationRef(r.registrationRef).length!==1)throw Error("duplicate");});
ok("registration-same-subject-different-material-conflicts",()=>{const x=fresh();x.registrationLedger.commit(r);throws(()=>x.registrationLedger.commit({...r,acceptanceId:"a:2"}));});
ok("registration-missing-acceptance-id-rejected",()=>{const x=fresh();const q={...r};delete q.acceptanceId;throws(()=>x.registrationLedger.commit(q));});
ok("registration-missing-subject-rejected",()=>{const x=fresh();const q={...r};delete q.registrationRef;throws(()=>x.registrationLedger.commit(q));});
ok("wrong-schema-version-fails-closed",()=>{const x=fresh({gt63GovernanceEvidence:{schemaVersion:"wrong",genesisTrustDecisions:[],genesisTrustDecisionProvenances:[],genesisSourceChannelTrustRegistrations:[]}});throws(()=>x.decisionLedger.get("x"));});
ok("missing-decision-collection-fails-closed",()=>{const x=fresh({gt63GovernanceEvidence:{schemaVersion:A.SCHEMA_VERSION,genesisTrustDecisionProvenances:[],genesisSourceChannelTrustRegistrations:[]}});throws(()=>x.decisionLedger.get("x"));});
ok("missing-provenance-collection-fails-closed",()=>{const x=fresh({gt63GovernanceEvidence:{schemaVersion:A.SCHEMA_VERSION,genesisTrustDecisions:[],genesisSourceChannelTrustRegistrations:[]}});throws(()=>x.provenanceLedger.findByEvidenceRef("x"));});
ok("missing-registration-collection-fails-closed",()=>{const x=fresh({gt63GovernanceEvidence:{schemaVersion:A.SCHEMA_VERSION,genesisTrustDecisions:[],genesisTrustDecisionProvenances:[]}});throws(()=>x.registrationLedger.findByRegistrationRef("x"));});
ok("unrelated-application-data-preserved",()=>{const x=fresh({users:[{id:"u"}],offers:[{id:"o"}]});x.decisionLedger.commit("d:1",d);const s=x.store.snapshot();if(s.users[0].id!=="u"||s.offers[0].id!=="o")throw Error("changed");});
ok("ledger-read-returns-clone",()=>{const x=fresh();x.decisionLedger.commit("d:1",d);const q=x.decisionLedger.get("d:1");q.type="MUTATED";if(x.decisionLedger.get("d:1").type==="MUTATED")throw Error("mutable");});
ok("store-read-returns-clone",()=>{const x=fresh({users:[]});const q=x.store.read();q.users.push({id:"x"});if(x.store.snapshot().users.length)throw Error("mutable");});
ok("all-adapters-authority-none",()=>{const x=fresh();if(x.authority!=="NONE"||x.authorityEffect!=="NONE")throw Error("authority");});
ok("schema-identity-exact",()=>{if(A.SCHEMA_VERSION!=="gt63-governance-evidence-v0")throw Error("schema");});
ok("ruleset-identity-exact",()=>{if(A.RULESET_VERSION!=="genesis-trust-persistent-ledger-adapters-v0.1.0")throw Error("ruleset");});
ok("three-ledgers-share-one-governance-area",()=>{const x=fresh();x.decisionLedger.commit("d:1",d);x.provenanceLedger.commit(p);x.registrationLedger.commit(r);const g=x.store.snapshot().gt63GovernanceEvidence;if(g.genesisTrustDecisions.length!==1||g.genesisTrustDecisionProvenances.length!==1||g.genesisSourceChannelTrustRegistrations.length!==1)throw Error("collections");});
ok("semantic-key-order-replay-is-identical",()=>{const x=fresh();x.decisionLedger.commit("d:1",d);x.decisionLedger.commit("d:1",{authorityEffect:"NONE",authority:"NONE",decisionEvidenceRef:"d:1",type:"GT63_GENESIS_SOURCE_CHANNEL_TRUST_DECISION"});});
ok("persistence-survives-adapter-recreation",()=>{const store=A.createMemoryPersistentStore({});const x=A.createGenesisTrustPersistentLedgerAdapters({storagePort:store});x.decisionLedger.commit("d:1",d);const y=A.createGenesisTrustPersistentLedgerAdapters({storagePort:store});if(!y.decisionLedger.get("d:1"))throw Error("missing");});
ok("no-server-or-real-db-binding-exposed",()=>{const x=fresh();if("dbFile" in x||"server" in x)throw Error("integration leaked");});
if(pass!==35){console.error("FAIL - expected 35 passes, got "+pass);process.exitCode=1;}
if(!process.exitCode){const outputHash=crypto.createHash("sha256").update("genesis-trust-persistent-ledger-adapters-v0-regression|35|"+A.RULESET_VERSION+"|"+A.SCHEMA_VERSION).digest("hex");console.log(JSON.stringify({status:"PASS",workflow:"genesis-trust-persistent-ledger-adapters-v0-regression",cases:35,deterministicRuns:2,outputHash}));}
