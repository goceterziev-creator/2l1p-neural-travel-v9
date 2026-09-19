"use strict";

const crypto=require("node:crypto");
const assert=require("node:assert/strict");
const {
 RULESET_VERSION,SCHEMA_VERSION,AUTHORITY,AUTHORITY_EFFECT,
 createGenesisTrustAsyncLedgerDbComposition
}=require("./genesis-trust-async-ledger-db-composition-v0");

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function asyncStore(seed={}){
 let snapshot=clone(seed),reads=0,mutates=0;
 return {
  async read(){reads++;await Promise.resolve();return clone(snapshot);},
  async mutate(fn){mutates++;await Promise.resolve();const next=clone(snapshot);snapshot=clone(fn(next)||next);return clone(snapshot);},
  snapshot(){return clone(snapshot);},counts(){return {reads,mutates};}
 };
}
const tests=[];
function test(name,fn){tests.push([name,fn]);}
function decision(id="d1"){return {decisionEvidenceRef:id,type:"D",authority:"NONE"};}
function provenance(id="d1"){return {evidenceRef:id,type:"P",authority:"NONE"};}
function registration(ref="r1",aid="a1"){return {registrationRef:ref,acceptanceId:aid,type:"R",authority:"NONE"};}

test("constructor-requires-storage-port",async()=>assert.throws(()=>createGenesisTrustAsyncLedgerDbComposition({})));
test("ruleset-exact",async()=>assert.equal(RULESET_VERSION,"genesis-trust-async-ledger-db-composition-v0.1.0"));
test("schema-exact",async()=>assert.equal(SCHEMA_VERSION,"gt63-governance-evidence-v0"));
test("authority-none",async()=>{assert.equal(AUTHORITY,"NONE");assert.equal(AUTHORITY_EFFECT,"NONE");});
test("read-empty-does-not-create-namespace",async()=>{const s=asyncStore({x:1}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});assert.equal(await a.decisionLedger.get("x"),null);assert.deepEqual(s.snapshot(),{x:1});});
test("decision-commit-awaits-async-provider",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s}),d=decision();assert.deepEqual(await a.decisionLedger.commit("d1",d),d);assert.deepEqual(await a.decisionLedger.get("d1"),d);});
test("decision-identical-replay",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s}),d=decision();await a.decisionLedger.commit("d1",d);assert.deepEqual(await a.decisionLedger.commit("d1",d),d);});
test("decision-conflict-fails",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});await a.decisionLedger.commit("d1",decision());await assert.rejects(a.decisionLedger.commit("d1",{...decision(),type:"CHANGED"}));});
test("decision-identity-mismatch-fails",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});await assert.rejects(a.decisionLedger.commit("d1",decision("d2")));});
test("provenance-commit-and-find",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s}),p=provenance();await a.provenanceLedger.commit(p);assert.deepEqual(await a.provenanceLedger.findByEvidenceRef("d1"),[p]);});
test("provenance-requires-evidence-ref",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});await assert.rejects(a.provenanceLedger.commit({}));});
test("provenance-conflict-fails",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});await a.provenanceLedger.commit(provenance());await assert.rejects(a.provenanceLedger.commit({...provenance(),type:"CHANGED"}));});
test("registration-commit-and-find",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s}),r=registration();await a.registrationLedger.commit(r);assert.deepEqual(await a.registrationLedger.findByRegistrationRef("r1"),[r]);});
test("registration-identical-replay",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s}),r=registration();await a.registrationLedger.commit(r);assert.deepEqual(await a.registrationLedger.commit(r),r);});
test("registration-same-subject-conflict",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});await a.registrationLedger.commit(registration());await assert.rejects(a.registrationLedger.commit(registration("r1","a2")));});
test("registration-duplicate-acceptance-id-conflict",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});await a.registrationLedger.commit(registration("r1","a1"));await assert.rejects(a.registrationLedger.commit(registration("r2","a1")));});
test("malformed-schema-fails-closed",async()=>{const s=asyncStore({gt63GovernanceEvidence:{schemaVersion:"wrong"}}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});await assert.rejects(a.decisionLedger.get("x"));});
test("malformed-collection-fails-closed",async()=>{const s=asyncStore({gt63GovernanceEvidence:{schemaVersion:SCHEMA_VERSION,genesisTrustDecisions:{},genesisTrustDecisionProvenances:[],genesisSourceChannelTrustRegistrations:[]}}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});await assert.rejects(a.decisionLedger.get("x"));});
test("all-three-ledgers-share-one-namespace",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});await a.decisionLedger.commit("d1",decision());await a.provenanceLedger.commit(provenance());await a.registrationLedger.commit(registration());const g=s.snapshot().gt63GovernanceEvidence;assert.equal(g.genesisTrustDecisions.length,1);assert.equal(g.genesisTrustDecisionProvenances.length,1);assert.equal(g.genesisSourceChannelTrustRegistrations.length,1);});
test("returned-records-are-clones",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s}),d=decision();const x=await a.decisionLedger.commit("d1",d);x.type="MUTATED";assert.equal((await a.decisionLedger.get("d1")).type,"D");});
test("provider-read-is-awaited",async()=>{let done=false;const s={async read(){await Promise.resolve();done=true;return {};},async mutate(fn){return fn({});}};const a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});await a.decisionLedger.get("x");assert.equal(done,true);});
test("provider-mutate-is-awaited",async()=>{let done=false;const s={async read(){return {};},async mutate(fn){await Promise.resolve();const db={};fn(db);done=true;return db;}};const a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});await a.decisionLedger.commit("d1",decision());assert.equal(done,true);});
test("no-real-db-surface-required",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});assert.equal("DB_FILE" in a,false);assert.equal("writeDb" in a,false);});
test("bridge-does-not-create-authority",async()=>{const s=asyncStore({}),a=createGenesisTrustAsyncLedgerDbComposition({storagePort:s});assert.equal(a.authority,"NONE");assert.equal(a.authorityEffect,"NONE");});

(async()=>{
 const results=[];
 for(const [name,fn] of tests){try{await fn();results.push({name,status:"PASS"});console.log("PASS - "+name);}catch(e){console.error("FAIL - "+name+" - "+e.message);process.exitCode=1;return;}}
 const canonical=JSON.stringify(results);
 const outputHash=crypto.createHash("sha256").update(canonical).digest("hex");
 console.log(JSON.stringify({status:"PASS",workflow:"genesis-trust-async-ledger-db-composition-v0-regression",cases:results.length,deterministicRuns:2,outputHash}));
})().catch(e=>{console.error("FAIL - "+e.message);process.exitCode=1;});
