"use strict";
const assert=require("node:assert/strict");
const {RULESET_VERSION,OUTCOMES,createTrustedGovernanceEvidenceSurfaceProvider,canonicalStringify}=require("./trusted-governance-evidence-surface-provider");
function fixtures(){
 const p={type:"GOVERNANCE_ROLE_POLICY_REQUIREMENT_EVIDENCE_ACCEPTANCE",policyAcceptanceId:"pacc",policyRef:"policy:main",policyRevision:"p1",authority:"NONE"};
 const a={type:"DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE",assignmentAcceptanceId:"aacc",assignmentRef:"assign:owner",assignmentRevision:"a1",authority:"NONE"};
 const d={type:"DIRECT_DELEGATION_EVIDENCE_ACCEPTANCE",delegationAcceptanceId:"dacc",delegationRef:"deleg:gate",delegationRevision:"d1",authority:"NONE"};
 const accepted={type:"ACCEPTED_GOVERNANCE_EVIDENCE_LEDGER_SNAPSHOT",ledgerRef:"ledger:accepted",ledgerRevision:"lr1",frameRevision:"f1",completeThroughSequence:3,complete:true,entries:[{sequence:1,kind:"POLICY",record:p},{sequence:2,kind:"ASSIGNMENT",record:a},{sequence:3,kind:"DELEGATION",record:d}],snapshotEvidenceRef:"e:accepted",authority:"NONE"};
 const lifecycle={type:"GOVERNANCE_LIFECYCLE_LEDGER_SNAPSHOT",ledgerRef:"ledger:lifecycle",ledgerRevision:"ll1",frameRevision:"f1",completeThroughSequence:3,complete:true,entries:[
  {sequence:1,record:{acceptanceId:"pacc",kind:"POLICY",state:"CURRENT",lifecycleRevision:"lp1",contradictionState:"NONE",evidenceRef:"e:lp"}},
  {sequence:2,record:{acceptanceId:"aacc",kind:"ASSIGNMENT",state:"CURRENT",lifecycleRevision:"la1",contradictionState:"NONE",evidenceRef:"e:la"}},
  {sequence:3,record:{acceptanceId:"dacc",kind:"DELEGATION",state:"CURRENT",lifecycleRevision:"ld1",contradictionState:"NONE",evidenceRef:"e:ld"}}],snapshotEvidenceRef:"e:lifecycle",authority:"NONE"};
 return {accepted,lifecycle};
}
function make(f=fixtures()){
 return createTrustedGovernanceEvidenceSurfaceProvider({
  acceptedLedgerSnapshotPort:()=>f.accepted,
  lifecycleLedgerSnapshotPort:()=>f.lifecycle,
  ledgerRegistryPort:({ledgerRef,ledgerRevision})=>({ledgerRef,ledgerRevision,trustState:"TRUSTED",registryEvidenceRef:`registry:${ledgerRef}`,authority:"NONE"})
 });
}
const tests=[]; const test=(n,f)=>tests.push([n,f]);
test("produces deterministic trusted surface",()=>{const x=make();const r1=x.produce({rulesetVersion:RULESET_VERSION,frameRevision:"f1"});const r2=x.produce({rulesetVersion:RULESET_VERSION,frameRevision:"f1"});assert.equal(r1.outcome,OUTCOMES.PRODUCED);assert.equal(canonicalStringify(r1),canonicalStringify(r2));assert.equal(r1.authority,"NONE");assert.equal(r1.surface.authority,"NONE");});
test("request cannot inject coverage",()=>{assert.equal(make().produce({rulesetVersion:RULESET_VERSION,frameRevision:"f1",coverage:[]}).outcome,OUTCOMES.REJECTED);});
test("untrusted ledger preserves UNKNOWN",()=>{const f=fixtures();const p=createTrustedGovernanceEvidenceSurfaceProvider({acceptedLedgerSnapshotPort:()=>f.accepted,lifecycleLedgerSnapshotPort:()=>f.lifecycle,ledgerRegistryPort:({ledgerRef,ledgerRevision})=>({ledgerRef,ledgerRevision,trustState:"UNTRUSTED",registryEvidenceRef:"e:r",authority:"NONE"})});assert.equal(p.produce({rulesetVersion:RULESET_VERSION,frameRevision:"f1"}).outcome,OUTCOMES.UNKNOWN);});
test("incomplete ledger contract is rejected",()=>{const f=fixtures();f.accepted.complete=false;assert.equal(make(f).produce({rulesetVersion:RULESET_VERSION,frameRevision:"f1"}).outcome,OUTCOMES.REJECTED);});
test("missing lifecycle coverage preserves UNKNOWN",()=>{const f=fixtures();f.lifecycle.entries.pop();f.lifecycle.completeThroughSequence=2;assert.equal(make(f).produce({rulesetVersion:RULESET_VERSION,frameRevision:"f1"}).outcome,OUTCOMES.UNKNOWN);});
test("unbound lifecycle record conflicts",()=>{const f=fixtures();f.lifecycle.entries[0].record.acceptanceId="missing";assert.equal(make(f).produce({rulesetVersion:RULESET_VERSION,frameRevision:"f1"}).outcome,OUTCOMES.CONFLICT);});
test("duplicate accepted identity conflicts",()=>{const f=fixtures();f.accepted.entries.push({sequence:4,kind:"POLICY",record:f.accepted.entries[0].record});f.accepted.completeThroughSequence=4;assert.equal(make(f).produce({rulesetVersion:RULESET_VERSION,frameRevision:"f1"}).outcome,OUTCOMES.CONFLICT);});
test("coverage is derived from accepted ledger",()=>{const r=make().produce({rulesetVersion:RULESET_VERSION,frameRevision:"f1"});assert.deepEqual(r.surface.coverage.map(x=>x.completeThroughRevision).sort(),["a1","d1","p1"]);});
test("caller eligible flag rejected",()=>{assert.equal(make().produce({rulesetVersion:RULESET_VERSION,frameRevision:"f1",eligible:true}).outcome,OUTCOMES.REJECTED);});
test("all outcomes preserve authority NONE",()=>{const good=make().produce({rulesetVersion:RULESET_VERSION,frameRevision:"f1"});const f=fixtures();f.lifecycle.entries.pop();f.lifecycle.completeThroughSequence=2;const unk=make(f).produce({rulesetVersion:RULESET_VERSION,frameRevision:"f1"});assert.equal(good.authority,"NONE");assert.equal(unk.authority,"NONE");});
let passed=0;for(const [n,f] of tests){try{f();passed++;console.log(`PASS ${n}`);}catch(e){console.error(`FAIL ${n}`);throw e;}}console.log(`RESULT ${passed}/${tests.length} PASS`);
