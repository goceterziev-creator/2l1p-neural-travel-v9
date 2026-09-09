"use strict";

const assert = require("node:assert/strict");
const mod = require("./governance-approval-trust-decision-provenance-acceptance");

const DECISION_REF = "gt63-evidence:trust-decision:test";
const SESSION_REF = "gt63-runtime-session:USR-ADMIN:test";
const PRINCIPAL_REF = mod.EXPECTED_PRINCIPAL_REF;

function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function fixture(options = {}) {
  const decision = {
    type: "GT63_GOVERNANCE_APPROVAL_TRUST_DECISION",
    registrationRef: mod.EXPECTED_REGISTRATION_REF,
    registrationRevision: mod.EXPECTED_REGISTRATION_REVISION,
    sourceTrustState: "TRUSTED",
    verificationMethodTrustState: "TRUSTED",
    decision: "APPROVE_TRUST_REGISTRATION",
    principalRef: PRINCIPAL_REF,
    principalResolutionState: "RESOLVED",
    sessionRef: SESSION_REF,
    sessionRevision: "1",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    decisionEvidenceRef: DECISION_REF,
    principalEvidenceRef: "gt63-process-local-evidence:github-authenticated-identity:test",
    presentationId: "gt63-trust-decision-presentation:test",
    exactPayloadDigest: "sha256:b9a5f4337d3639520e195cb2ddbffe6023f3cb3dfa007ad18ee627b157aa2ca5",
    authority: "NONE",
    ...(options.decisionPatch || {})
  };
  const principal = {
    principalRef: PRINCIPAL_REF,
    principalRevision: "1",
    sessionRef: SESSION_REF,
    sessionRevision: "1",
    principalEvidenceRef: decision.principalEvidenceRef,
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    authority: "NONE",
    ...(options.principalPatch || {})
  };
  const records = clone(options.seed || []);
  const ledger = {
    findByEvidenceRef(ref) { return records.filter(x => x.evidenceRef === ref).map(clone); },
    commit(v) { records.push(clone(v)); return clone(v); }
  };
  const component = mod.createGovernanceApprovalTrustDecisionProvenanceAcceptance({
    decisionPort() { if (options.failDecision) throw new Error("unavailable"); return clone(decision); },
    principalIdentityPort() { if (options.failPrincipal) throw new Error("unavailable"); return clone(principal); },
    provenanceLedger: ledger
  });
  const request = { rulesetVersion: mod.RULESET_VERSION, registrationRef: mod.EXPECTED_REGISTRATION_REF, registrationRevision: mod.EXPECTED_REGISTRATION_REVISION, decisionEvidenceRef: DECISION_REF, ...(options.requestPatch || {}) };
  return { decision, principal, records, component, request };
}

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`PASS - ${name}`); }

test("constructor requires exact ports", () => { assert.throws(() => mod.createGovernanceApprovalTrustDecisionProvenanceAcceptance({}), TypeError); });
test("caller cannot assert acceptance fields", () => { const f = fixture({ requestPatch: { acceptanceState: "ACCEPTED" } }); assert.equal(f.component.accept(f.request).outcome, "TRUST_DECISION_PROVENANCE_REJECTED"); });
test("wrong registration subject is rejected", () => { const f = fixture({ decisionPatch: { registrationRef: "other" } }); assert.equal(f.component.accept(f.request).outcome, "TRUST_DECISION_PROVENANCE_UNCERTAIN"); });
test("wrong principal blocks provenance acceptance", () => { const f = fixture({ decisionPatch: { principalRef: "gt63-machine:principal:github:999" } }); assert.equal(f.component.accept(f.request).outcome, "TRUST_DECISION_PROVENANCE_UNCERTAIN"); });
test("different principal session blocks provenance acceptance", () => { const f = fixture({ principalPatch: { sessionRef: "other-session" } }); assert.equal(f.component.accept(f.request).outcome, "TRUST_DECISION_PROVENANCE_UNCERTAIN"); });
test("stale or contradictory decision blocks provenance acceptance", () => { const a = fixture({ decisionPatch: { freshnessState: "STALE" } }); assert.equal(a.component.accept(a.request).outcome, "TRUST_DECISION_PROVENANCE_UNCERTAIN"); const b = fixture({ decisionPatch: { contradictionState: "CONTRADICTORY_EVIDENCE" } }); assert.equal(b.component.accept(b.request).outcome, "TRUST_DECISION_PROVENANCE_UNCERTAIN"); });
test("decision evidence ref must match exact requested evidence", () => { const f = fixture({ decisionPatch: { decisionEvidenceRef: "other-ref" } }); assert.equal(f.component.accept(f.request).outcome, "TRUST_DECISION_PROVENANCE_UNCERTAIN"); });
test("exact current same-session decision produces accepted subject-bound provenance", () => { const f = fixture(); const out = f.component.accept(f.request); assert.equal(out.outcome, "TRUST_DECISION_PROVENANCE_ACCEPTED"); assert.equal(out.provenance.evidenceRef, DECISION_REF); assert.equal(out.provenance.subjectRef, mod.EXPECTED_REGISTRATION_REF); assert.equal(out.provenance.acceptanceState, "ACCEPTED"); assert.equal(out.provenance.authority, "NONE"); });
test("exact replay is idempotent and authority remains NONE", () => { const f = fixture(); const first = f.component.accept(f.request); const second = f.component.accept(f.request); assert.equal(first.outcome, "TRUST_DECISION_PROVENANCE_ACCEPTED"); assert.equal(second.outcome, "TRUST_DECISION_PROVENANCE_ACCEPTED"); assert.equal(second.authority, "NONE"); });

console.log(`${passed}/9 PASS`);
