"use strict";
const assert=require("node:assert/strict");
const {createNativeFilesystemLinkReadAdapterV0}=require("./repeatable-filesystem-native-link-read-adapter-v0");
const req={attemptClaimId:"claim",executionPreparationId:"prep",linkEvidenceRef:"link"};
const claim={type:"EXECUTION_ATTEMPT_CLAIM",attemptClaimId:"claim",executionAttemptId:"attempt",ownershipState:"ACTIVE",claimOrdinal:1,claimRevision:1,preparationEvidenceRef:"native-prep",effectContractRef:"native-contract",authorityEvidenceRef:"native-auth"};
const prep={type:"GT63_REPEATABLE_FILESYSTEM_EFFECT_EXECUTION_PREPARATION",executionPreparationId:"prep",executionState:"READY",effectPerformed:false,authorityEffect:"NONE",effectContractId:"fs-contract",authorizationId:"fs-auth"};
const link={type:"GT63_NATIVE_FILESYSTEM_PREPARATION_LINK",linkEvidenceRef:"link",state:"CURRENT",contradictionState:"NONE",attemptClaimId:"claim",claimEvidenceRef:"claim-evidence",nativePreparationEvidenceRef:"native-prep",nativeEffectContractRef:"native-contract",nativeAuthorityEvidenceRef:"native-auth",executionPreparationId:"prep",filesystemEffectContractId:"fs-contract",filesystemAuthorizationId:"fs-auth",authority:"NONE",effectPerformed:false};
const make=(opts={})=>createNativeFilesystemLinkReadAdapterV0({
 claimLedger:{findClaimById:()=>[claim],findClaimsByAttempt:()=>[claim],findClaimEvidenceRef:()=>"claim-evidence",...opts.claimLedger},
 filesystemPreparationLedger:{findByExecutionPreparationId:()=>[prep],...opts.filesystemPreparationLedger},
 linkEvidenceStore:{findByRef:()=>[link],...opts.linkEvidenceStore}
});
let n=0;const test=(name,fn)=>{fn();n++};
test("requires claim evidence-ref reader",()=>assert.throws(()=>make({claimLedger:{findClaimEvidenceRef:null}}),TypeError));
test("requires native history reader",()=>assert.throws(()=>make({claimLedger:{findClaimsByAttempt:null}}),TypeError));
test("requires filesystem preparation reader",()=>assert.throws(()=>make({filesystemPreparationLedger:{findByExecutionPreparationId:null}}),TypeError));
test("requires link store reader",()=>assert.throws(()=>make({linkEvidenceStore:{findByRef:null}}),TypeError));
test("coherent fixture identity only",()=>{const r=make().assess(req);assert.equal(r.outcome,"BOUND");assert.equal(r.executionAuthorized,false);assert.equal(r.effectPerformed,false)});
test("claim absent",()=>assert.equal(make({claimLedger:{findClaimById:()=>[]}}).assess(req).outcome,"UNKNOWN"));
test("duplicate claims",()=>assert.equal(make({claimLedger:{findClaimById:()=>[claim,claim]}}).assess(req).outcome,"UNKNOWN"));
test("claim history absent",()=>assert.equal(make({claimLedger:{findClaimsByAttempt:()=>[]}}).assess(req).outcome,"UNKNOWN"));
test("competing active claim",()=>assert.equal(make({claimLedger:{findClaimsByAttempt:()=>[claim,{...claim,attemptClaimId:"other"}]}}).assess(req).outcome,"DENIED"));
test("uncertain claim history",()=>assert.equal(make({claimLedger:{findClaimsByAttempt:()=>[{...claim,claimRevision:null}]}}).assess(req).outcome,"DENIED"));
test("missing claim evidence ref",()=>assert.equal(make({claimLedger:{findClaimEvidenceRef:()=>null}}).assess(req).outcome,"UNKNOWN"));
test("preparation absent",()=>assert.equal(make({filesystemPreparationLedger:{findByExecutionPreparationId:()=>[]}}).assess(req).outcome,"UNKNOWN"));
test("duplicate preparations",()=>assert.equal(make({filesystemPreparationLedger:{findByExecutionPreparationId:()=>[prep,prep]}}).assess(req).outcome,"UNKNOWN"));
test("link absent",()=>assert.equal(make({linkEvidenceStore:{findByRef:()=>[]}}).assess(req).outcome,"UNKNOWN"));
test("duplicate links",()=>assert.equal(make({linkEvidenceStore:{findByRef:()=>[link,link]}}).assess(req).outcome,"UNKNOWN"));
test("link mismatch",()=>assert.equal(make({linkEvidenceStore:{findByRef:()=>[{...link,filesystemAuthorizationId:"wrong"}]}}).assess(req).outcome,"DENIED"));
test("ledger throws",()=>assert.equal(make({claimLedger:{findClaimById:()=>{throw Error("offline")}}}).assess(req).outcome,"UNKNOWN"));
console.log(JSON.stringify({status:"PASS",cases:n,scope:"SIMULATED_LEDGER_READS_ONLY",effectPerformed:false}));
