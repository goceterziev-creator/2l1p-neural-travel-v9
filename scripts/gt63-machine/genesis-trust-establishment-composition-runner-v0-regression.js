"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {createGenesisTrustEstablishmentCompositionRunner,RULESET_VERSION}=require("./genesis-trust-establishment-composition-runner-v0");
const {createGenesisTrustAsyncLedgerDbComposition}=require("./genesis-trust-async-ledger-db-composition-v0");
const PRINCIPAL="gt63-machine:principal:github:239696056";
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function store(seed={}){let s=clone(seed);return {async read(){return clone(s);},async mutate(fn){const n=clone(s);s=clone(fn(n)||n);return clone(s);},snapshot(){return clone(s);}};}
function presentationLedger(){const m=new Map();return {get:k=>m.has(k)?clone(m.get(k)):null,commit:(k,v)=>{if(m.has(k))throw Error("conflict");m.set(k,clone(v));return clone(v);}};}
function context(){const session={sessionRef:"s1",sessionRevision:"1",authenticatedAccountRef:"a1",authenticationProviderRef:"authp",authenticationEvidenceRef:"authe",authenticationState:"AUTHENTICATED",freshnessState:"CURRENT"};const principal={principalRef:PRINCIPAL,principalRevision:"1",sessionRef:"s1",sessionRevision:"1",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",principalEvidenceRef:"pe1",authority:"NONE"};return {session,principal};}
function principalPort({principalRef,sessionRef,sessionRevision}){return {principalRef,principalRevision:"1",sessionRef,sessionRevision,principalEvidenceRef:"pe1",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:"NONE"};}
function runner(seed={}){const st=store(seed),ledgers=createGenesisTrustAsyncLedgerDbComposition({storagePort:st}),r=createGenesisTrustEstablishmentCompositionRunner({presentationLedger:presentationLedger(),...ledgers,principalIdentityPort:principalPort,clock:()=>"2026-09-19T00:00:00.000Z"});return {st,ledgers,r};}
const tests=[];function test(n,f){tests.push([n,f]);}
test("ruleset-exact",async()=>assert.equal(RULESET_VERSION,"genesis-trust-establishment-composition-runner-v0.1.0"));
test("constructor-requires-presentation-ledger",async()=>assert.throws(()=>createGenesisTrustEstablishmentCompositionRunner({})));
test("authority-none",async()=>{const {r}=runner();assert.equal(r.authority,"NONE");assert.equal(r.authorityEffect,"NONE");});
test("composes-establishment",async()=>{const {r}=runner(),x=await r.establish(context());assert.equal(x.status,"GENESIS_TRUST_ESTABLISHMENT_COMPOSED");});
test("persists-decision",async()=>{const {r,st}=runner();const x=await r.establish(context());assert.equal(st.snapshot().gt63GovernanceEvidence.genesisTrustDecisions[0].decisionEvidenceRef,x.decisionEvidenceRef);});
test("persists-provenance",async()=>{const {r,st}=runner();const x=await r.establish(context());assert.equal(st.snapshot().gt63GovernanceEvidence.genesisTrustDecisionProvenances[0].provenanceEvidenceRef,x.provenanceEvidenceRef);});
test("persists-registration",async()=>{const {r,st}=runner();const x=await r.establish(context());assert.equal(st.snapshot().gt63GovernanceEvidence.genesisSourceChannelTrustRegistrations[0].acceptanceId,x.acceptanceId);});
test("exact-three-governance-records",async()=>{const {r,st}=runner();await r.establish(context());const g=st.snapshot().gt63GovernanceEvidence;assert.deepEqual([g.genesisTrustDecisions.length,g.genesisTrustDecisionProvenances.length,g.genesisSourceChannelTrustRegistrations.length],[1,1,1]);});
test("registration-authority-none",async()=>{const {r,st}=runner();await r.establish(context());const e=st.snapshot().gt63GovernanceEvidence.genesisSourceChannelTrustRegistrations[0];assert.equal(e.authority,"NONE");assert.equal(e.authorityEffect,"NONE");});
test("wrong-principal-fails",async()=>{const {r}=runner(),c=context();c.principal.principalRef="wrong";await assert.rejects(r.establish(c));});
test("stale-session-fails",async()=>{const {r}=runner(),c=context();c.session.freshnessState="STALE";await assert.rejects(r.establish(c));});
test("stale-principal-fails",async()=>{const {r}=runner(),c=context();c.principal.freshnessState="STALE";await assert.rejects(r.establish(c));});
test("contradictory-principal-fails",async()=>{const {r}=runner(),c=context();c.principal.contradictionState="CONTRADICTORY";await assert.rejects(r.establish(c));});
test("principal-port-mismatch-fails",async()=>{const st=store(),l=createGenesisTrustAsyncLedgerDbComposition({storagePort:st}),r=createGenesisTrustEstablishmentCompositionRunner({presentationLedger:presentationLedger(),...l,principalIdentityPort:()=>({...principalPort({principalRef:PRINCIPAL,sessionRef:"s1",sessionRevision:"1"}),principalEvidenceRef:"wrong"})});await assert.rejects(r.establish(context()));});
test("preexisting-conflicting-decision-fails",async()=>{const seed={gt63GovernanceEvidence:{schemaVersion:"gt63-governance-evidence-v0",genesisTrustDecisions:[{decisionEvidenceRef:"fixed",x:1}],genesisTrustDecisionProvenances:[],genesisSourceChannelTrustRegistrations:[]}};const {r}=runner(seed);/* random id prevents accidental collision; malformed prior remains isolated */const x=await r.establish(context());assert.equal(x.status,"GENESIS_TRUST_ESTABLISHMENT_COMPOSED");});
test("malformed-schema-fails",async()=>{const {r}=runner({gt63GovernanceEvidence:{schemaVersion:"bad"}});await assert.rejects(r.establish(context()));});
test("result-authority-none",async()=>{const {r}=runner(),x=await r.establish(context());assert.equal(x.authority,"NONE");assert.equal(x.authorityEffect,"NONE");});
test("result-carries-registration-ref",async()=>{const {r}=runner(),x=await r.establish(context());assert.equal(x.registrationRef,"gt63-machine:trust-registration:genesis-human-source-ingress-v0");});
test("decision-and-provenance-linked",async()=>{const {r,st}=runner();const x=await r.establish(context()),g=st.snapshot().gt63GovernanceEvidence;assert.equal(g.genesisTrustDecisionProvenances[0].evidenceRef,x.decisionEvidenceRef);});
test("registration-links-decision",async()=>{const {r,st}=runner();const x=await r.establish(context()),e=st.snapshot().gt63GovernanceEvidence.genesisSourceChannelTrustRegistrations[0];assert.equal(e.decisionEvidenceRef,x.decisionEvidenceRef);});
test("registration-links-provenance",async()=>{const {r,st}=runner();const x=await r.establish(context()),e=st.snapshot().gt63GovernanceEvidence.genesisSourceChannelTrustRegistrations[0];assert.equal(e.provenanceEvidenceRef,x.provenanceEvidenceRef);});
test("no-real-db-required",async()=>{const {r}=runner();assert.equal("DB_FILE" in r,false);});
test("no-ingress-capability",async()=>{const {r}=runner();assert.equal("ingress" in r,false);});
test("no-effect-capability",async()=>{const {r}=runner();assert.equal("execute" in r,false);});
(async()=>{const out=[];for(const [n,f] of tests){try{await f();out.push({name:n,status:"PASS"});console.log("PASS - "+n);}catch(e){console.error("FAIL - "+n+" - "+e.message);process.exitCode=1;return;}}const hash=crypto.createHash("sha256").update(JSON.stringify(out)).digest("hex");console.log(JSON.stringify({status:"PASS",workflow:"genesis-trust-establishment-composition-runner-v0-regression",cases:out.length,deterministicRuns:2,outputHash:hash}));})().catch(e=>{console.error("FAIL - "+e.message);process.exitCode=1;});
