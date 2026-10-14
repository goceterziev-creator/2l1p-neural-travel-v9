"use strict";
const assert=require("node:assert/strict");
const {auditRun2ReadOnlyEvidenceInterfacesV0}=require("./run2-read-only-evidence-interface-audit-v0");
const fn=()=>null;let cases=0;
const test=(name,run)=>{run();cases++};
const full={
 nativeClaimLedger:{findClaimById:fn,findClaimsByAttempt:fn,findClaimEvidenceRef:fn},
 filesystemPreparationLedger:{findByExecutionPreparationId:fn},
 crossDomainLinkStore:{findByRef:fn},
 nativeStartLedger:{findByExecutionStartId:fn},
 filesystemAuthorizationLedger:{findByAuthorizationId:fn},
 reservationObserver:{inspect:fn},
 postconditionObserver:{verify:fn}
};
test("missing all ports",()=>assert.equal(auditRun2ReadOnlyEvidenceInterfacesV0().status,"NOT_CONNECTABLE"));
test("full interfaces only",()=>assert.equal(auditRun2ReadOnlyEvidenceInterfacesV0(full).status,"INTERFACE_COMPATIBLE_ONLY"));
test("no authority even when compatible",()=>assert.equal(auditRun2ReadOnlyEvidenceInterfacesV0(full).executionAuthorized,false));
test("no retry even when compatible",()=>assert.equal(auditRun2ReadOnlyEvidenceInterfacesV0(full).retryAuthorized,false));
test("no provenance inference",()=>assert.equal(auditRun2ReadOnlyEvidenceInterfacesV0(full).provenance,"NOT_ASSESSED"));
test("missing native start",()=>assert.ok(auditRun2ReadOnlyEvidenceInterfacesV0({...full,nativeStartLedger:{}}).missing.includes("nativeStartLedger.findByExecutionStartId")));
test("missing authorization",()=>assert.ok(auditRun2ReadOnlyEvidenceInterfacesV0({...full,filesystemAuthorizationLedger:{}}).missing.includes("filesystemAuthorizationLedger.findByAuthorizationId")));
test("missing link store",()=>assert.ok(auditRun2ReadOnlyEvidenceInterfacesV0({...full,crossDomainLinkStore:{}}).missing.includes("crossDomainLinkStore.findByRef")));
console.log(JSON.stringify({status:"PASS",cases,scope:"READ_ONLY_INTERFACE_CONTRACT",effectPerformed:false}));
