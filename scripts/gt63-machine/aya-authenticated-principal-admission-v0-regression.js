"use strict";

const assert = require("node:assert/strict");
const admissionModule = require("./aya-authenticated-principal-admission-v0");
const authBinding = require("./aya-auth-event-session-binding-v0");
const liveBoundary = require("./aya-live-principal-boundary-v0");
const durableBinding = require("./aya-account-principal-binding-v0");

const NOW = 1_797_000_100_000;
const ACCEPTED_BINDING_REF = "gt63-principal-binding-evidence:aya-account:73ccf85e7f4c1bd6e86ceea024dc338f62b66b3e64a85898d0a8cab915d423f1";
const PRINCIPAL_REF = "gt63-principal:aya-account:AGY-AYA:USR-ADMIN";
const PRINCIPAL_REVISION = "aya-principal-binding-revision:1";

const tests = [];
let passed = 0;
function test(name, fn) { tests.push({ name, fn }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function aClass(overrides = {}) {
  const nonce = overrides.nonce || "a".repeat(32);
  const userId = overrides.userId || "USR-ADMIN";
  const agencyId = overrides.agencyId || "AGY-AYA";
  return {
    id: `gt63-activity:a-class:${nonce}`,
    type: "gt63_a_class_authentication_evidence",
    category: "auth",
    userId,
    actorType: "user",
    offerId: null,
    clientId: null,
    agencyId,
    timestamp: "2026-09-29T09:00:00.000Z",
    createdAt: "2026-09-29T09:00:00.000Z",
    metadata: {
      evidenceIdentity: `gt63-evidence:a-class:${nonce}`,
      evidenceRevision: 1,
      authenticationEventIdentity: `gt63-auth-event:${nonce}`,
      evidenceClass: "ACCOUNT_AUTHENTICATION_EVIDENCE",
      applicationAccountSubject: { id: userId, email: "admin@example.test", agencyId },
      authenticationMethod: "PASSWORD",
      authenticationResult: "SUCCESS",
      normalPathProvenance: {
        state: "POSITIVE",
        bypassExcluded: true,
        source: "NORMAL_PASSWORD_VERIFICATION"
      },
      authorityEffect: "NONE",
      nonClaims: { acceptedByGt63: false, downstreamAuthority: false },
      ...(overrides.metadata || {})
    }
  };
}

function session(overrides = {}) {
  return {
    userId: "USR-ADMIN",
    agencyId: "AGY-AYA",
    role: "admin",
    sessionVersion: 1,
    principalAuthEpoch: 1,
    iat: 1_797_000_000_000,
    exp: 1_797_000_600_000,
    ...overrides
  };
}

function account(overrides = {}) {
  return {
    id: "USR-ADMIN",
    agencyId: "AGY-AYA",
    email: "goce@example.test",
    role: "admin",
    sessionVersion: 1,
    principalAuthEpoch: 1,
    ...overrides
  };
}

function decision(overrides = {}) {
  return {
    type: durableBinding.DECISION_TYPE,
    decision: durableBinding.DECISION,
    decisionRevision: 1,
    decisionEvidenceRef: "gt63-human-decision:aya-account-principal-binding:6e1951163efa7048bc33fccffbd70ebcfcf3abc3dfaa16ab2d49490870367ead",
    decidedAt: "2026-09-30T05:00:00.000Z",
    decisionActor: {
      actorKind: "HUMAN_PRINCIPAL",
      actorRef: "gt63-human-principal:goce",
      actorEvidenceRef: "gt63-human-decision-capture:accepted-checkpoint"
    },
    ayaAccountSubject: { agencyId: "AGY-AYA", applicationUserId: "USR-ADMIN" },
    proposedPrincipalRef: PRINCIPAL_REF,
    proposedPrincipalRevision: PRINCIPAL_REVISION,
    decisionScope: "INITIAL_BINDING_CREATION_ONLY",
    nonClaims: {
      principalEligibilityCreated: false,
      roleCreated: false,
      delegationCreated: false,
      humanGateAuthorized: false,
      governancePackageCreated: false,
      effectAuthorized: false,
      offerMutationAuthorized: false
    },
    authority: "NONE",
    authorityEffect: "NONE",
    ...overrides
  };
}

function scope(overrides = {}) {
  return {
    scopeType: "GATE",
    interactionId: "interaction:provider-free:1",
    fromInteractionRevision: 0,
    throughInteractionRevision: null,
    gateId: "gate:provider-free:1",
    gateRevision: 1,
    authorityScopeDigest: `sha256:${"b".repeat(64)}`,
    continuationTargetRef: "continuation:provider-free:1",
    ...overrides
  };
}

function query(overrides = {}) {
  return {
    principalRef: PRINCIPAL_REF,
    principalRevision: PRINCIPAL_REVISION,
    contextScope: scope(),
    ...overrides
  };
}

function createFixture(options = {}) {
  const currentAccount = account(options.account || {});
  const sessionMaterial = session(options.session || {});
  const bindingCreation = authBinding.createAuthEventSessionBinding({
    aClassEvidence: aClass(options.aClass || {}),
    sessionMaterial
  });
  assert.equal(bindingCreation.outcome, authBinding.OUTCOMES.ACCEPTED);
  const store = authBinding.createProcessLocalAuthEventSessionBindingStore();
  assert.equal(store.commit(bindingCreation.binding).outcome, authBinding.OUTCOMES.ACCEPTED);

  const bindingCandidate = durableBinding.buildCandidateBindingEvidence({
    humanDecision: decision(),
    currentAccountRecord: currentAccount
  });
  assert.equal(bindingCandidate.outcome, durableBinding.OUTCOMES.ACCEPTED);
  const envelopeResult = durableBinding.envelopeFromRecord(bindingCandidate.record);
  assert.equal(envelopeResult.outcome, durableBinding.OUTCOMES.ACCEPTED);

  const snapshot = options.snapshot || {
    schemaVersion: "provider-free",
    users: [currentAccount],
    gt63GovernanceEvidence: [envelopeResult.envelope]
  };
  const request = options.req || {
    user: {
      id: sessionMaterial.userId,
      agencyId: sessionMaterial.agencyId,
      role: sessionMaterial.role,
      sessionVersion: sessionMaterial.sessionVersion,
      principalAuthEpoch: sessionMaterial.principalAuthEpoch
    },
    session: { ...sessionMaterial },
    sessionIdentity: {
      userId: sessionMaterial.userId,
      agencyId: sessionMaterial.agencyId,
      role: sessionMaterial.role,
      sessionVersion: sessionMaterial.sessionVersion,
      principalAuthEpoch: sessionMaterial.principalAuthEpoch
    }
  };
  const counters = { reads: 0, writes: 0, liveAssessments: 0 };
  const realLiveWithCount = {
    assessLivePrincipalBoundary(args) {
      counters.liveAssessments += 1;
      const result = liveBoundary.assessLivePrincipalBoundary(args);
      return options.transformLive ? options.transformLive(clone(result)) : result;
    }
  };
  const readDb = options.readDb || (() => {
    counters.reads += 1;
    return snapshot;
  });
  const admission = admissionModule.createAyaAuthenticatedPrincipalAdmission({
    readDb,
    req: request,
    authEventSessionBindingStore: options.store || store,
    now: () => NOW,
    authEventSessionBinding: authBinding,
    livePrincipalBoundary: options.livePrincipalBoundary || realLiveWithCount,
    principalBinding: options.principalBinding || durableBinding
  });
  return {
    admission,
    snapshot,
    counters,
    request,
    store,
    binding: bindingCreation.binding,
    envelope: envelopeResult.envelope
  };
}

function accepted(fixture = createFixture(), requestQuery = query()) {
  const result = fixture.admission.assess(requestQuery);
  assert.equal(result.outcome, admissionModule.OUTCOMES.ACCEPTED, result.reason);
  assert.ok(result.evidence);
  return { fixture, result, evidence: result.evidence };
}

function assertNullForOutcome(fixture, requestQuery, outcome) {
  const diagnostic = fixture.admission.assess(requestQuery);
  assert.equal(diagnostic.outcome, outcome, diagnostic.reason);
  const before = fixture.counters.reads;
  assert.equal(fixture.admission.authenticatedPrincipalPort(requestQuery), null);
  assert.equal(fixture.counters.reads, before + 1);
}

function assertNonAuthority(value) {
  assert.equal(value.authority, "NONE");
  assert.equal(value.authorityEffect, "NONE");
  for (const field of Object.keys(admissionModule.NON_CLAIMS)) {
    const source = value.nonClaims || value;
    assert.equal(source[field], false, field);
  }
}

test("real upstream modules compose a complete accepted evidence object", () => {
  const { fixture, result, evidence } = accepted();
  assert.equal(fixture.counters.reads, 1);
  assert.equal(fixture.counters.liveAssessments, 1);
  assert.equal(result.authority, "NONE");
  assert.deepEqual(Object.keys(evidence).sort(), [
    "type", "schemaVersion", "rulesetVersion", "principalRef", "principalRevision", "principalEvidenceRef",
    "lifecycleState", "freshnessState", "contradictionState", "authority", "authorityEffect", "provenance", "nonClaims"
  ].sort());
  assert.equal(evidence.type, admissionModule.TYPE);
  assert.equal(evidence.schemaVersion, "1.0");
  assert.equal(evidence.rulesetVersion, admissionModule.RULESET_VERSION);
  assert.equal(evidence.lifecycleState, "CURRENT");
  assert.equal(evidence.freshnessState, "CURRENT");
  assert.equal(evidence.contradictionState, "NONE");
  assertNonAuthority(evidence);
});

test("durable principal identity and revision map verbatim", () => {
  const { evidence } = accepted();
  assert.equal(evidence.principalRef, PRINCIPAL_REF);
  assert.equal(evidence.principalRevision, PRINCIPAL_REVISION);
  assert.notEqual(evidence.principalRevision, evidence.provenance.currentPrincipalRevision);
});

test("accepted Binding #1 identity is reproduced by the real durable module and preserved", () => {
  const { evidence } = accepted();
  assert.equal(evidence.provenance.principalBindingEvidenceRef, ACCEPTED_BINDING_REF);
  assert.notEqual(evidence.principalEvidenceRef, evidence.provenance.principalBindingEvidenceRef);
});

test("bindingRef maps verbatim to authEventSessionBindingRef", () => {
  const { fixture, evidence } = accepted();
  assert.equal(evidence.provenance.authEventSessionBindingRef, fixture.binding.bindingRef);
});

test("all provenance fields map with exact string types and separate revision domains", () => {
  const { evidence } = accepted();
  assert.deepEqual(Object.keys(evidence.provenance).sort(), [
    "agencyId", "applicationUserId", "principalBindingEvidenceRef", "authEventSessionBindingRef",
    "authenticationEventIdentity", "aClassEvidenceIdentity", "aClassEvidenceRevision", "sessionRef",
    "sessionVersion", "observedPrincipalAuthEpoch", "currentPrincipalAuthEpoch",
    "observedPrincipalRevision", "currentPrincipalRevision"
  ].sort());
  for (const value of Object.values(evidence.provenance)) assert.equal(typeof value, "string");
  assert.equal(evidence.provenance.aClassEvidenceRevision, "1");
  assert.equal(evidence.provenance.sessionVersion, "1");
  assert.equal(evidence.provenance.observedPrincipalAuthEpoch, "1");
  assert.equal(evidence.provenance.currentPrincipalAuthEpoch, "1");
  assert.equal(evidence.provenance.observedPrincipalRevision, "principalAuthEpoch:1");
  assert.equal(evidence.provenance.currentPrincipalRevision, "principalAuthEpoch:1");
  assert.notEqual(evidence.principalRevision, evidence.provenance.aClassEvidenceRevision);
  assert.notEqual(evidence.principalRevision, evidence.provenance.sessionVersion);
});

test("one physical read supplies account and binding while no write or source mutation occurs", () => {
  const f = createFixture();
  const before = clone(f.snapshot);
  accepted(f);
  assert.equal(f.counters.reads, 1);
  assert.equal(f.counters.writes, 0);
  assert.deepEqual(f.snapshot, before);
});

test("each port call performs a fresh real assessment and returns no cached object", () => {
  const f = createFixture();
  const first = f.admission.authenticatedPrincipalPort(query());
  const second = f.admission.authenticatedPrincipalPort(query());
  assert.ok(first && second);
  assert.notStrictEqual(first, second);
  assert.equal(first.principalEvidenceRef, second.principalEvidenceRef);
  assert.equal(f.counters.reads, 2);
  assert.equal(f.counters.liveAssessments, 2);
});

test("a second call in the same request re-assesses changed current state", () => {
  const f = createFixture();
  assert.ok(f.admission.authenticatedPrincipalPort(query()));
  f.request.session.exp = NOW - 1;
  assert.equal(f.admission.authenticatedPrincipalPort(query()), null);
  assert.equal(f.counters.reads, 2);
  assert.equal(f.counters.liveAssessments, 2);
});

test("contextScope is validated but excluded from evidence identity", () => {
  const f = createFixture();
  const first = f.admission.authenticatedPrincipalPort(query());
  const second = f.admission.authenticatedPrincipalPort(query({ contextScope: scope({ gateId: "gate:provider-free:2" }) }));
  assert.equal(first.principalEvidenceRef, second.principalEvidenceRef);
  assert.equal(Object.prototype.hasOwnProperty.call(first, "contextScope"), false);
});

test("deterministic sorted serialization and digest are stable", () => {
  const left = { z: [2, 1], a: { y: "value", x: 1 } };
  const right = { a: { x: 1, y: "value" }, z: [2, 1] };
  assert.equal(admissionModule.canonicalStringifyExact(left), admissionModule.canonicalStringifyExact(right));
  assert.equal(admissionModule.principalEvidenceRefFromMaterial(left), admissionModule.principalEvidenceRefFromMaterial(right));
});

test("output and exact digest material reuse the same mapped values", () => {
  const { fixture, evidence } = accepted();
  const record = fixture.envelope.record;
  const provenance = evidence.provenance;
  const exactMaterial = {
    type: evidence.type,
    schemaVersion: evidence.schemaVersion,
    rulesetVersion: evidence.rulesetVersion,
    principalRef: evidence.principalRef,
    principalRevision: evidence.principalRevision,
    ...provenance,
    bindingLifecycleState: record.bindingLifecycleState,
    bindingFreshnessState: record.bindingFreshnessState,
    bindingContradictionState: record.contradictionState,
    authenticationLifecycleState: "CURRENT",
    authenticationFreshnessState: "CURRENT",
    authenticationContradictionState: "NONE",
    authority: evidence.authority,
    authorityEffect: evidence.authorityEffect
  };
  assert.equal(evidence.principalEvidenceRef, admissionModule.principalEvidenceRefFromMaterial(exactMaterial));
});

test("snapshot adapter receives one snapshot view and rejects writes and collection mutation", () => {
  let adapterReadCount = 0;
  let mutationRejected = false;
  let writerRejected = false;
  const instrumentedBinding = {
    ...durableBinding,
    createDurablePrincipalBindingLedger({ readDb, writeDb }) {
      const view = readDb();
      adapterReadCount += 1;
      try { view.users.push(account({ id: "MUTATION" })); } catch (_error) { mutationRejected = true; }
      try { writeDb(view); } catch (_error) { writerRejected = true; }
      return durableBinding.createDurablePrincipalBindingLedger({ readDb, writeDb });
    }
  };
  const f = createFixture({ principalBinding: instrumentedBinding });
  accepted(f);
  assert.equal(f.counters.reads, 1);
  assert.equal(adapterReadCount, 1);
  assert.equal(mutationRejected, true);
  assert.equal(writerRejected, true);
  assert.equal(f.snapshot.users.length, 1);
});

test("exact Unicode is not normalized and canonically equivalent strings differ", () => {
  const composed = { identity: "\u00e9" };
  const decomposed = { identity: "e\u0301" };
  assert.notEqual(composed.identity, decomposed.identity);
  assert.notEqual(admissionModule.canonicalStringifyExact(composed), admissionModule.canonicalStringifyExact(decomposed));
  assert.notEqual(admissionModule.principalEvidenceRefFromMaterial(composed), admissionModule.principalEvidenceRefFromMaterial(decomposed));
});

test("unpaired surrogate is INVALID and unsupported values cannot be serialized", () => {
  const f = createFixture();
  const invalidQuery = query({ principalRef: `principal:\ud800` });
  assertNullForOutcome(f, invalidQuery, admissionModule.OUTCOMES.INVALID);
  assert.throws(() => admissionModule.canonicalStringifyExact({ value: undefined }), /unsupported/);
  assert.throws(() => admissionModule.canonicalStringifyExact({ value: Infinity }), /non-finite/);
});

test("missing query field is UNKNOWN; wrong type and unsupported scope are INVALID", () => {
  const missing = query();
  delete missing.principalRevision;
  assertNullForOutcome(createFixture(), missing, admissionModule.OUTCOMES.UNKNOWN);
  assertNullForOutcome(createFixture(), query({ principalRevision: 1 }), admissionModule.OUTCOMES.INVALID);
  assertNullForOutcome(createFixture(), query({ contextScope: { scopeType: "GATE" } }), admissionModule.OUTCOMES.INVALID);
});

test("readDb failure and missing DB collections are UNKNOWN", () => {
  const throwing = createFixture({ readDb: () => { throw new Error("provider unavailable"); } });
  assert.equal(throwing.admission.assess(query()).outcome, admissionModule.OUTCOMES.UNKNOWN);
  const missingCollection = createFixture({ snapshot: { users: [account()] } });
  assertNullForOutcome(missingCollection, query(), admissionModule.OUTCOMES.UNKNOWN);
});

test("missing and duplicate current accounts fail UNKNOWN and CONTRADICTED", () => {
  const missing = createFixture();
  missing.snapshot.users = [];
  assertNullForOutcome(missing, query(), admissionModule.OUTCOMES.UNKNOWN);
  const duplicate = createFixture();
  duplicate.snapshot.users.push(clone(duplicate.snapshot.users[0]));
  assertNullForOutcome(duplicate, query(), admissionModule.OUTCOMES.CONTRADICTED);
});

test("real missing auth-event/session binding remains UNKNOWN", () => {
  const emptyStore = authBinding.createProcessLocalAuthEventSessionBindingStore();
  assertNullForOutcome(createFixture({ store: emptyStore }), query(), admissionModule.OUTCOMES.UNKNOWN);
});

test("real expired session, beta bypass, and session tamper are REJECTED", () => {
  const expired = createFixture();
  expired.request.session.exp = NOW;
  assertNullForOutcome(expired, query(), admissionModule.OUTCOMES.REJECTED);
  const bypass = createFixture();
  bypass.request.session.betaAuthBypass = true;
  assertNullForOutcome(bypass, query(), admissionModule.OUTCOMES.REJECTED);
  const tampered = createFixture();
  tampered.request.session.principalAuthEpoch = 2;
  assertNullForOutcome(tampered, query(), admissionModule.OUTCOMES.REJECTED);
});

test("real request/session/account and session-version mismatches are REJECTED", () => {
  const subject = createFixture();
  subject.request.sessionIdentity.userId = "USR-OTHER";
  assertNullForOutcome(subject, query(), admissionModule.OUTCOMES.REJECTED);
  const version = createFixture();
  version.request.sessionIdentity.sessionVersion = 2;
  assertNullForOutcome(version, query(), admissionModule.OUTCOMES.REJECTED);
});

test("real principalAuthEpoch mismatch is REJECTED", () => {
  const f = createFixture();
  f.snapshot.users[0].principalAuthEpoch = 2;
  assertNullForOutcome(f, query(), admissionModule.OUTCOMES.REJECTED);
});

test("missing durable binding is UNKNOWN and duplicate current binding is CONTRADICTED", () => {
  const missing = createFixture();
  missing.snapshot.gt63GovernanceEvidence = [];
  assertNullForOutcome(missing, query(), admissionModule.OUTCOMES.UNKNOWN);
  const duplicate = createFixture();
  duplicate.snapshot.gt63GovernanceEvidence.push(clone(duplicate.envelope));
  assertNullForOutcome(duplicate, query(), admissionModule.OUTCOMES.CONTRADICTED);
});

test("binding missing state is UNKNOWN, wrong type INVALID, stale UNKNOWN, contradiction CONTRADICTED", () => {
  const missing = createFixture();
  delete missing.snapshot.gt63GovernanceEvidence[0].record.bindingFreshnessState;
  assertNullForOutcome(missing, query(), admissionModule.OUTCOMES.UNKNOWN);
  const wrongType = createFixture();
  wrongType.snapshot.gt63GovernanceEvidence[0].record.bindingFreshnessState = 1;
  assertNullForOutcome(wrongType, query(), admissionModule.OUTCOMES.INVALID);
  const stale = createFixture();
  stale.snapshot.gt63GovernanceEvidence[0].record.bindingFreshnessState = "STALE";
  assertNullForOutcome(stale, query(), admissionModule.OUTCOMES.UNKNOWN);
  const contradiction = createFixture();
  contradiction.snapshot.gt63GovernanceEvidence[0].record.contradictionState = "CONFLICT";
  assertNullForOutcome(contradiction, query(), admissionModule.OUTCOMES.CONTRADICTED);
});

test("missing binding evidence ref is UNKNOWN and positive identity mismatch is CONTRADICTED", () => {
  const missing = createFixture();
  delete missing.snapshot.gt63GovernanceEvidence[0].record.principalBindingEvidenceRef;
  assertNullForOutcome(missing, query(), admissionModule.OUTCOMES.UNKNOWN);
  const mismatch = createFixture();
  mismatch.snapshot.gt63GovernanceEvidence[0].record.principalBindingEvidenceRef = `${ACCEPTED_BINDING_REF}x`;
  assertNullForOutcome(mismatch, query(), admissionModule.OUTCOMES.CONTRADICTED);
});

test("query principalRef and principalRevision mismatches are REJECTED", () => {
  assertNullForOutcome(createFixture(), query({ principalRef: `${PRINCIPAL_REF}:other` }), admissionModule.OUTCOMES.REJECTED);
  assertNullForOutcome(createFixture(), query({ principalRevision: "aya-principal-binding-revision:2" }), admissionModule.OUTCOMES.REJECTED);
});

test("[CONTROLLED DOUBLE] missing live material and UNKNOWN live outcome remain UNKNOWN", () => {
  const missing = createFixture({ transformLive: (value) => ({ ...value, authenticatedPrincipalSourceMaterial: null, sourceMaterialProduced: false }) });
  assertNullForOutcome(missing, query(), admissionModule.OUTCOMES.UNKNOWN);
  const unknown = createFixture({
    livePrincipalBoundary: {
      assessLivePrincipalBoundary: () => ({
        bindingAssessment: "UNKNOWN", principalAuthEpochCurrentness: "UNKNOWN", sourceMaterialProduced: false,
        authenticatedPrincipalSourceMaterial: null, authority: "NONE", authorityEffect: "NONE", reason: "controlled unknown"
      })
    }
  });
  assertNullForOutcome(unknown, query(), admissionModule.OUTCOMES.UNKNOWN);
});

test("[CONTROLLED DOUBLE] authentication state missing/wrong/stale/contradicted follows exact classification", () => {
  function transformed(change) {
    return createFixture({ transformLive(value) { change(value.authenticatedPrincipalSourceMaterial); return value; } });
  }
  const missing = transformed((material) => { delete material.freshnessState; });
  assertNullForOutcome(missing, query(), admissionModule.OUTCOMES.UNKNOWN);
  const wrong = transformed((material) => { material.lifecycleState = 1; });
  assertNullForOutcome(wrong, query(), admissionModule.OUTCOMES.INVALID);
  const stale = transformed((material) => { material.freshnessState = "STALE"; });
  assertNullForOutcome(stale, query(), admissionModule.OUTCOMES.UNKNOWN);
  const contradicted = transformed((material) => { material.contradictionState = "CONFLICT"; });
  assertNullForOutcome(contradicted, query(), admissionModule.OUTCOMES.CONTRADICTED);
});

test("[CONTROLLED DOUBLE] exact live type, revision, provenance, and authority checks fail closed", () => {
  function transformed(change) {
    return createFixture({ transformLive(value) { change(value.authenticatedPrincipalSourceMaterial); return value; } });
  }
  const numericEpoch = transformed((material) => { material.currentPrincipalAuthEpoch = 1; });
  assertNullForOutcome(numericEpoch, query(), admissionModule.OUTCOMES.INVALID);
  const numericRevision = transformed((material) => { material.aClassEvidenceRevision = 1; });
  assertNullForOutcome(numericRevision, query(), admissionModule.OUTCOMES.INVALID);
  const unsupportedRevision = transformed((material) => { material.aClassEvidenceRevision = "2"; });
  assertNullForOutcome(unsupportedRevision, query(), admissionModule.OUTCOMES.REJECTED);
  const missingProvenance = transformed((material) => { delete material.authenticationEventIdentity; });
  assertNullForOutcome(missingProvenance, query(), admissionModule.OUTCOMES.UNKNOWN);
  const authority = transformed((material) => { material.authority = "SOME"; });
  assertNullForOutcome(authority, query(), admissionModule.OUTCOMES.REJECTED);
});

test("[CONTROLLED DOUBLE] epoch relation, epoch mismatch, and subject mismatch are distinguished", () => {
  function transformed(change) {
    return createFixture({ transformLive(value) { change(value.authenticatedPrincipalSourceMaterial); return value; } });
  }
  const relation = transformed((material) => { material.currentPrincipalRevision = "principalAuthEpoch:2"; });
  assertNullForOutcome(relation, query(), admissionModule.OUTCOMES.CONTRADICTED);
  const epoch = transformed((material) => {
    material.currentPrincipalAuthEpoch = "2";
    material.currentPrincipalRevision = "principalAuthEpoch:2";
  });
  assertNullForOutcome(epoch, query(), admissionModule.OUTCOMES.REJECTED);
  const subject = transformed((material) => { material.applicationUserId = "USR-OTHER"; });
  assertNullForOutcome(subject, query(), admissionModule.OUTCOMES.CONTRADICTED);
});

test("[CONTROLLED DOUBLE] unpaired surrogate in mapped provenance is INVALID", () => {
  const f = createFixture({
    transformLive(value) {
      value.authenticatedPrincipalSourceMaterial.authenticationEventIdentity = `gt63-auth-event:\ud800`;
      return value;
    }
  });
  assertNullForOutcome(f, query(), admissionModule.OUTCOMES.INVALID);
});

test("every non-ACCEPTED diagnostic outcome maps to null at the public port", () => {
  const scenarios = [
    [createFixture({ snapshot: { users: [account()], gt63GovernanceEvidence: [] } }), query()],
    [createFixture(), query({ principalRef: "mismatch" })],
    [createFixture(), query({ principalRevision: 1 })],
    (() => { const f = createFixture(); f.snapshot.users.push(clone(f.snapshot.users[0])); return [f, query()]; })()
  ];
  const observed = new Set();
  for (const [fixture, requestQuery] of scenarios) {
    const diagnostic = fixture.admission.assess(requestQuery);
    observed.add(diagnostic.outcome);
    assert.notEqual(diagnostic.outcome, "ACCEPTED");
    assert.equal(fixture.admission.authenticatedPrincipalPort(requestQuery), null);
  }
  assert.deepEqual([...observed].sort(), ["CONTRADICTED", "INVALID", "REJECTED", "UNKNOWN"]);
});

test("consumer compatibility is structural and does not invoke eligibility assessment", () => {
  const { evidence } = accepted();
  const consumerShapeAccepted = evidence.principalRef === PRINCIPAL_REF
    && evidence.principalRevision === PRINCIPAL_REVISION
    && typeof evidence.principalEvidenceRef === "string"
    && evidence.principalEvidenceRef.length > 0
    && evidence.lifecycleState === "CURRENT"
    && evidence.freshnessState === "CURRENT"
    && evidence.contradictionState === "NONE"
    && evidence.authority === "NONE";
  assert.equal(consumerShapeAccepted, true);
  assert.equal(Object.prototype.hasOwnProperty.call(evidence.nonClaims, "principalEligibilityCreated"), true);
  assert.equal(evidence.nonClaims.principalEligibilityCreated, false);
});

test("accepted evidence and diagnostics contain no downstream authority claims", () => {
  const { result, evidence } = accepted();
  assertNonAuthority(result);
  assertNonAuthority(evidence);
  assert.equal(Object.isFrozen(evidence), true);
  assert.equal(Object.isFrozen(evidence.provenance), true);
  assert.equal(Object.isFrozen(evidence.nonClaims), true);
});

for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

process.stdout.write(`RESULT ${passed}/${tests.length} passed\n`);
