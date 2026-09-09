"use strict";

const assert = require("node:assert/strict");
const producerModule = require("./governance-approval-trust-registration-provenance-producer");
const acceptanceModule = require("./governance-approval-trust-registration-evidence-acceptance");
const resolverModule = require("./governance-approval-trust-registration");

const REGISTRATION_REF = "gt63-machine:trust-registration:approval-surface-v0";
const REGISTRATION_REVISION = "1";
const APPROVAL_DIGEST = "sha256:0bba51ea1427c2e5a3542c9a46de7b4de7e44861ebdf82f14469d2f8777899aa";
const PRINCIPAL_REF = "gt63-machine:principal:github:239696056";
const SESSION_REF = "gt63-runtime-session:USR-ADMIN:chain-test";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function memoryLedger(idField, refField) {
  const records = [];
  return {
    records,
    findByRegistrationRef(ref) { return records.filter((item) => item[refField] === ref).map(clone); },
    commit(record) {
      if (records.some((item) => item[idField] === record[idField])) throw new Error("identity conflict");
      records.push(clone(record));
      return clone(record);
    }
  };
}

function fixture(overrides = {}) {
  const binding = {
    outcome: "BINDING_EVIDENCE_ACCEPTED",
    authority: "NONE",
    binding: {
      sourceEventRef: "gt63-human-source-event:chain-test",
      principalResolutionState: "RESOLVED",
      principalRef: PRINCIPAL_REF,
      principalRevision: "1",
      sessionRef: SESSION_REF,
      sessionRevision: "1",
      contentDigest: APPROVAL_DIGEST,
      interactionBindingState: "BOUND",
      contradictionState: "NONE",
      authority: "NONE",
      ...clone(overrides.bindingPatch || {})
    }
  };
  const principal = {
    principalRef: PRINCIPAL_REF,
    principalRevision: "1",
    sessionRef: SESSION_REF,
    sessionRevision: "1",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    principalEvidenceRef: "gt63-process-local-evidence:github-authenticated-identity:chain-test",
    authority: "NONE",
    ...clone(overrides.principalPatch || {})
  };
  const producerLedger = {
    records: [],
    findBySubjectRef(ref) { return this.records.filter((item) => item.subjectRef === ref).map(clone); },
    commit(record) { this.records.push(clone(record)); return clone(record); }
  };
  const producer = producerModule.createGovernanceApprovalTrustRegistrationProvenanceProducer({
    approvalBindingPort() { return clone(binding); },
    principalEvidencePort() { return clone(principal); },
    provenanceLedger: producerLedger
  });
  const provenanceResult = producer.produce({
    rulesetVersion: producerModule.RULESET_VERSION,
    registrationRef: REGISTRATION_REF,
    registrationRevision: REGISTRATION_REVISION
  });
  return { binding, principal, producer, provenanceResult };
}

function registrationFromAcceptedEvidence(accepted) {
  return {
    type: "GT63_GOVERNANCE_APPROVAL_TRUST_REGISTRATION",
    schemaVersion: "1.0",
    rulesetVersion: resolverModule.RULESET_VERSION,
    registrationRevision: accepted.registrationRevision,
    sourceProviderRef: accepted.sourceProviderRef,
    sourceProviderRevision: accepted.sourceProviderRevision,
    sourceTrustState: accepted.sourceTrustState,
    verificationMethodRef: accepted.verificationMethodRef,
    verificationMethodRevision: accepted.verificationMethodRevision,
    verificationMethodTrustState: accepted.verificationMethodTrustState,
    lifecycleState: accepted.lifecycleState,
    freshnessState: accepted.freshnessState,
    contradictionState: accepted.contradictionState,
    acceptedEvidenceRef: accepted.acceptanceId,
    supersedesRegistrationRef: null,
    authority: "NONE"
  };
}

function acceptedChain(overrides = {}) {
  const f = fixture(overrides);
  assert.equal(f.provenanceResult.outcome, "TRUST_REGISTRATION_PROVENANCE_ACCEPTED");
  const provenance = f.provenanceResult.provenance;
  const registrationSnapshot = {
    type: acceptanceModule.EXPECTED_TYPE,
    registrationRef: REGISTRATION_REF,
    registrationRevision: REGISTRATION_REVISION,
    sourceProviderRef: acceptanceModule.EXPECTED_SOURCE_PROVIDER_REF,
    sourceProviderRevision: acceptanceModule.EXPECTED_SOURCE_PROVIDER_REVISION,
    verificationMethodRef: acceptanceModule.EXPECTED_VERIFICATION_METHOD_REF,
    verificationMethodRevision: acceptanceModule.EXPECTED_VERIFICATION_METHOD_REVISION,
    sourceTrustState: "TRUSTED",
    verificationMethodTrustState: "TRUSTED",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    registrationEvidenceRef: provenance.evidenceRef
  };
  const ledger = memoryLedger("acceptanceId", "registrationRef");
  const acceptance = acceptanceModule.createGovernanceApprovalTrustRegistrationEvidenceAcceptance({
    registrationSnapshotPort() { return clone(registrationSnapshot); },
    registrationEvidencePort({ evidenceRef }) {
      if (evidenceRef !== provenance.evidenceRef) return null;
      return clone(provenance);
    },
    registrationLedger: ledger
  });
  const accepted = acceptance.accept({
    rulesetVersion: acceptanceModule.RULESET_VERSION,
    registrationRef: REGISTRATION_REF,
    expectedRegistrationRevision: REGISTRATION_REVISION
  });
  return { ...f, provenance, registrationSnapshot, accepted };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS - ${name}`);
}

test("producer output can feed evidence acceptance only when subject-bound", () => {
  const c = acceptedChain();
  assert.equal(c.accepted.outcome, acceptanceModule.OUTCOMES.ACCEPTED);
  assert.equal(c.accepted.evidence.registrationRef, REGISTRATION_REF);
});

test("accepted evidence preserves declared TRUSTED states but does not create authority", () => {
  const c = acceptedChain();
  assert.equal(c.accepted.evidence.sourceTrustState, "TRUSTED");
  assert.equal(c.accepted.evidence.verificationMethodTrustState, "TRUSTED");
  assert.equal(c.accepted.evidence.authority, "NONE");
});

test("resolver accepts exact registration derived from accepted evidence", () => {
  const c = acceptedChain();
  const registration = registrationFromAcceptedEvidence(c.accepted.evidence);
  const resolver = resolverModule.createGovernanceApprovalTrustRegistration({ registrationProvider() { return clone(registration); } });
  const result = resolver.resolve();
  assert.equal(result.outcome, "TRUST_REGISTRATION_RESOLVED");
  assert.equal(result.registration.sourceTrustState, "TRUSTED");
  assert.equal(result.registration.verificationMethodTrustState, "TRUSTED");
  assert.equal(result.authority, "NONE");
});

test("chain does not assert principal eligibility role or governance authorization", () => {
  const c = acceptedChain();
  const registration = registrationFromAcceptedEvidence(c.accepted.evidence);
  for (const forbidden of ["eligibilityState", "roleRef", "authorizationState", "governanceAuthorizationRef"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(registration, forbidden), false);
    assert.equal(Object.prototype.hasOwnProperty.call(c.accepted.evidence, forbidden), false);
  }
});

test("wrong principal breaks the chain before provenance acceptance", () => {
  const f = fixture({ bindingPatch: { principalRef: "gt63-machine:principal:github:999" } });
  assert.notEqual(f.provenanceResult.outcome, "TRUST_REGISTRATION_PROVENANCE_ACCEPTED");
});

test("wrong approval digest breaks the chain before provenance acceptance", () => {
  const f = fixture({ bindingPatch: { contentDigest: `sha256:${"f".repeat(64)}` } });
  assert.notEqual(f.provenanceResult.outcome, "TRUST_REGISTRATION_PROVENANCE_ACCEPTED");
});

test("different session breaks the chain before provenance acceptance", () => {
  const f = fixture({ principalPatch: { sessionRef: "gt63-runtime-session:OTHER:1" } });
  assert.notEqual(f.provenanceResult.outcome, "TRUST_REGISTRATION_PROVENANCE_ACCEPTED");
});

test("contradiction breaks the chain before provenance acceptance", () => {
  const f = fixture({ bindingPatch: { contradictionState: "CONTRADICTORY_EVIDENCE" } });
  assert.notEqual(f.provenanceResult.outcome, "TRUST_REGISTRATION_PROVENANCE_ACCEPTED");
});

test("trust registration resolution remains authority NONE end to end", () => {
  const c = acceptedChain();
  const registration = registrationFromAcceptedEvidence(c.accepted.evidence);
  const resolver = resolverModule.createGovernanceApprovalTrustRegistration({ registrationProvider() { return clone(registration); } });
  const result = resolver.resolve();
  assert.equal(c.provenance.authority, "NONE");
  assert.equal(c.accepted.authority, "NONE");
  assert.equal(result.authority, "NONE");
});

console.log(`${passed}/9 PASS`);
