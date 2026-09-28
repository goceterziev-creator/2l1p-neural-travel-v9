"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const durable = require("./human-governance-trust-decision-durable-ledger");
const capture = require("./human-governance-trust-decision-presentation-capture");
const chainModule = require("./human-governance-trust-runtime-chain");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-durable-trust-decision-"));
const dbFile = path.join(tempRoot, "database.json");
const SESSION_REF = "gt63-runtime-session:USR-ADMIN:durable-ledger";
const PRINCIPAL_REF = capture.EXPECTED_PRINCIPAL_REF;

function baseDb() {
  return { schemaVersion: "gt63-v9-staging-1", agencies: [{ id: "A" }], users: [{ id: "U" }], clients: [], offers: [], activities: [] };
}
function writeRaw(db) { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), "utf8"); }
function readRaw() { return JSON.parse(fs.readFileSync(dbFile, "utf8")); }
function establish() { const db = readRaw(); durable.establishCollection(db); writeRaw(db); }
function atomicWrite(db) {
  const tmp = dbFile + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  JSON.parse(fs.readFileSync(tmp, "utf8"));
  fs.renameSync(tmp, dbFile);
}
function ledger(writeDb = atomicWrite) {
  return durable.createDurableTrustDecisionLedger({ readDb: readRaw, writeDb });
}
function session() {
  return {
    sessionRef: SESSION_REF, sessionRevision: "1",
    authenticatedAccountRef: "gt63-runtime-user:USR-ADMIN",
    authenticationProviderRef: "gt63-existing-signed-session-v0",
    authenticationEvidenceRef: "gt63-runtime-session-evidence:USR-ADMIN:durable-ledger",
    authenticationState: "AUTHENTICATED", freshnessState: "CURRENT"
  };
}
function principal() {
  return {
    type: "GT63_EXTERNAL_AUTHENTICATED_IDENTITY_BINDING",
    principalRef: PRINCIPAL_REF, principalRevision: "1",
    sessionRef: SESSION_REF, sessionRevision: "1",
    lifecycleState: "CURRENT", freshnessState: "CURRENT", contradictionState: "NONE",
    principalEvidenceRef: "gt63-process-local-evidence:github-authenticated-identity:durable-ledger",
    authority: "NONE"
  };
}
function decisionRecord(ref = "gt63-evidence:trust-decision:test") {
  return {
    type: durable.SUPPORTED_TYPE,
    decisionEvidenceRef: ref,
    presentationId: "presentation:test",
    principalRef: PRINCIPAL_REF,
    principalEvidenceRef: principal().principalEvidenceRef,
    sessionRef: SESSION_REF,
    sessionRevision: "1",
    decision: "APPROVE_TRUST_REGISTRATION",
    exactPayloadDigest: "sha256:test",
    decidedAt: "2026-09-28T00:00:00.000Z",
    principalResolutionState: "RESOLVED",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    authority: "NONE"
  };
}
function captureRealDecision() {
  const presentationLedger = capture.createMemoryLedger();
  const surface = capture.createHumanGovernanceTrustDecisionPresentationCapture({
    presentationLedger,
    decisionLedger: ledger(),
    clock: () => "2026-09-28T00:00:00.000Z"
  });
  const p = surface.present({ session: session(), principal: principal() });
  return surface.decide({ session: session(), principal: principal(), presentationId: p.presentationId, decision: "APPROVE_TRUST_REGISTRATION" });
}

let passed = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function reset({ established = true } = {}) { writeRaw(baseDb()); if (established) establish(); }

test("legacy-establishment-preserves-AYA-state", () => {
  reset({ established: false }); const before = readRaw(); establish(); const after = readRaw();
  assert.deepEqual(after.agencies, before.agencies); assert.deepEqual(after.users, before.users);
  assert.deepEqual(after.activities, before.activities); assert.deepEqual(after.gt63GovernanceEvidence, []);
});
test("exact-commit-get", () => { reset(); const r=decisionRecord(); assert.deepEqual(ledger().commit(r.decisionEvidenceRef,r),r); assert.deepEqual(ledger().get(r.decisionEvidenceRef),r); });
test("exact-retry-no-duplicate", () => { reset(); const r=decisionRecord(); ledger().commit(r.decisionEvidenceRef,r); ledger().commit(r.decisionEvidenceRef,r); assert.equal(readRaw().gt63GovernanceEvidence.length,1); });
test("same-ref-different-material-conflicts", () => { reset(); const r=decisionRecord(); ledger().commit(r.decisionEvidenceRef,r); assert.throws(()=>ledger().commit(r.decisionEvidenceRef,{...r,decidedAt:"other"}),/conflicting/); });
test("key-record-identity-mismatch-rejected", () => { reset(); assert.throws(()=>ledger().commit("other",decisionRecord()),/identity mismatch/); });
test("unsupported-type-rejected", () => { reset(); const r={...decisionRecord(),type:"OTHER"}; assert.throws(()=>ledger().commit(r.decisionEvidenceRef,r),/unsupported/); });
test("authority-widening-rejected", () => { reset(); const r={...decisionRecord(),authority:"GRANTED"}; assert.throws(()=>ledger().commit(r.decisionEvidenceRef,r),/authority NONE/); });
test("missing-ledger-fails-closed", () => { reset({established:false}); assert.throws(()=>ledger().get("x"),/not established/); });
test("invalid-ledger-fails-closed", () => { reset(); const db=readRaw(); db.gt63GovernanceEvidence={}; writeRaw(db); assert.throws(()=>ledger().get("x"),/invalid/); });
test("duplicate-identity-fails-closed", () => { reset(); const r=decisionRecord(); ledger().commit(r.decisionEvidenceRef,r); const db=readRaw(); db.gt63GovernanceEvidence.push(JSON.parse(JSON.stringify(db.gt63GovernanceEvidence[0]))); writeRaw(db); assert.throws(()=>ledger().get(r.decisionEvidenceRef),/duplicate/); });
test("write-failure-does-not-report-durable-capture", () => { reset(); const r=decisionRecord(); const failing=ledger(()=>{throw new Error("synthetic persistence failure");}); assert.throws(()=>failing.commit(r.decisionEvidenceRef,r),/synthetic/); assert.equal(readRaw().gt63GovernanceEvidence.length,0); });
test("recreated-ledger-retrieves-exact-record", () => { reset(); const r=decisionRecord(); ledger().commit(r.decisionEvidenceRef,r); const recreated=ledger(); assert.deepEqual(recreated.get(r.decisionEvidenceRef),r); });
test("capture-persists-and-reloads-without-second-decision", () => { reset(); const d=captureRealDecision(); const reloaded=ledger().get(d.decisionEvidenceRef); assert.deepEqual(reloaded,d); assert.equal(readRaw().gt63GovernanceEvidence.length,1); });
test("reloaded-decision-feeds-existing-runtime-chain", () => {
  reset(); const d=captureRealDecision();
  const identityBootstrap={getIdentityBySession(ref){return ref===SESSION_REF?principal():null;}};
  const chain=chainModule.createHumanGovernanceTrustRuntimeChain({decisionLedger:ledger(),identityBootstrap});
  const out=chain.authorizeTrustDecision(d.decisionEvidenceRef);
  assert.equal(out.provenanceResult.outcome,"TRUST_DECISION_PROVENANCE_ACCEPTED");
  assert.equal(out.outcome,"TRUST_RUNTIME_CHAIN_RESOLVED");
});
test("missing-evidence-keeps-existing-chain-blocked", () => {
  reset(); const identityBootstrap={getIdentityBySession(ref){return ref===SESSION_REF?principal():null;}};
  const chain=chainModule.createHumanGovernanceTrustRuntimeChain({decisionLedger:ledger(),identityBootstrap});
  const out=chain.authorizeTrustDecision("gt63-evidence:trust-decision:missing");
  assert.equal(out.outcome,"TRUST_RUNTIME_CHAIN_BLOCKED"); assert.equal(out.stage,"PROVENANCE");
});
test("persisted-envelope-adds-no-trust-semantics", () => {
  reset(); const r=decisionRecord(); ledger().commit(r.decisionEvidenceRef,r); const e=readRaw().gt63GovernanceEvidence[0];
  for(const k of ["accepted","authorized","eligible","roleRef","governanceAuthorizationRef","trustState"]) assert.equal(Object.hasOwn(e,k),false);
  assert.equal(e.record.authority,"NONE");
});
test("existing-AYA-state-unchanged-by-evidence-write", () => {
  reset(); const before=readRaw(); const r=decisionRecord(); ledger().commit(r.decisionEvidenceRef,r); const after=readRaw();
  for(const k of ["agencies","users","clients","offers","activities","schemaVersion"]) assert.deepEqual(after[k],before[k]);
});

try {
  for (const {name,fn} of tests) { fn(); passed++; console.log("PASS - "+name); }
  console.log(passed+"/"+tests.length+" PASS");
  if (passed!==17) process.exitCode=1;
} catch (error) {
  console.error("FAIL - "+tests[passed].name); console.error(error.stack||error);
  console.log(passed+"/"+tests.length+" PASS"); process.exitCode=1;
} finally {
  fs.rmSync(tempRoot,{recursive:true,force:true});
}
