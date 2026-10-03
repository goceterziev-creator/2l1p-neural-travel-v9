"use strict";

const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const fs = require("node:fs");
const path = require("node:path");
const observation = require("./aya-authenticated-principal-observation-v0");
const admissionModule = require("./aya-authenticated-principal-admission-v0");
const authBinding = require("./aya-auth-event-session-binding-v0");
const liveBoundary = require("./aya-live-principal-boundary-v0");
const durableBinding = require("./aya-account-principal-binding-v0");

const NOW = 1_797_000_100_000;
const OBSERVED_AT = "2026-10-03T07:05:00.000Z";
const PRINCIPAL_REF = "gt63-principal:aya-account:AGY-AYA:USR-ADMIN";
const PRINCIPAL_REVISION = "aya-principal-binding-revision:1";
const OBSERVATION_REF = "observation:provider-free:1";

const tests = [];
let passed = 0;
function test(name, fn) { tests.push({ name, fn }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function keys(value) { return Object.keys(value).sort(); }

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
      normalPathProvenance: { state: "POSITIVE", bypassExcluded: true, source: "NORMAL_PASSWORD_VERIFICATION" },
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

function gateScope(overrides = {}) {
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

function observationScope(overrides = {}) {
  return {
    scopeType: "AUTHENTICATED_PRINCIPAL_OBSERVATION",
    observationType: "BOUNDED_LIVE_WITNESS",
    observationRef: OBSERVATION_REF,
    observationRevision: 1,
    ...overrides
  };
}

function query(contextScope = observationScope(), overrides = {}) {
  return { principalRef: PRINCIPAL_REF, principalRevision: PRINCIPAL_REVISION, contextScope, ...overrides };
}

function createFixture() {
  const currentAccount = account();
  const sessionMaterial = session();
  const bindingCreation = authBinding.createAuthEventSessionBinding({
    aClassEvidence: aClass(),
    sessionMaterial
  });
  assert.equal(bindingCreation.outcome, authBinding.OUTCOMES.ACCEPTED);
  const store = authBinding.createProcessLocalAuthEventSessionBindingStore();
  assert.equal(store.commit(bindingCreation.binding).outcome, authBinding.OUTCOMES.ACCEPTED);

  const candidate = durableBinding.buildCandidateBindingEvidence({
    humanDecision: decision(),
    currentAccountRecord: currentAccount
  });
  assert.equal(candidate.outcome, durableBinding.OUTCOMES.ACCEPTED);
  const envelope = durableBinding.envelopeFromRecord(candidate.record);
  assert.equal(envelope.outcome, durableBinding.OUTCOMES.ACCEPTED);

  const snapshot = {
    schemaVersion: "provider-free",
    users: [currentAccount],
    gt63GovernanceEvidence: [envelope.envelope]
  };
  const req = {
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
  return { snapshot, req, store, envelope: envelope.envelope };
}

function createRealAdmission(fixture, readDb) {
  return admissionModule.createAyaAuthenticatedPrincipalAdmission({
    readDb,
    req: fixture.req,
    authEventSessionBindingStore: fixture.store,
    now: () => NOW,
    authEventSessionBinding: authBinding,
    livePrincipalBoundary: liveBoundary,
    principalBinding: durableBinding
  });
}

function evaluator(fixture, overrides = {}) {
  return observation.createAyaAuthenticatedPrincipalObservationEvaluator({
    readDb: overrides.readDb || (() => fixture.snapshot),
    req: fixture.req,
    authEventSessionBindingStore: fixture.store,
    createObservationRef: overrides.createObservationRef || (() => OBSERVATION_REF),
    observeNow: overrides.observeNow || (() => OBSERVED_AT),
    admissionNow: () => NOW,
    createAdmission: overrides.createAdmission || admissionModule.createAyaAuthenticatedPrincipalAdmission,
    admissionModule,
    principalBinding: overrides.principalBinding || durableBinding,
    authEventSessionBinding: authBinding,
    livePrincipalBoundary: overrides.livePrincipalBoundary || liveBoundary,
    projectWitness: overrides.projectWitness || observation.projectAdmittedWitness,
    projectUnavailable: overrides.projectUnavailable
  });
}

function responseDouble() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    sent: false,
    sendCount: 0,
    sendListeners: [],
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    closed: false,
    writable: true,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    onSend(listener) { this.sendListeners.push(listener); },
    json(body) {
      this.body = body;
      this.sent = true;
      this.sendCount += 1;
      this.headersSent = true;
      this.writableEnded = true;
      for (const listener of this.sendListeners.splice(0)) listener();
      return this;
    }
  };
}

function streamRequest(start, headers = {}) {
  let started = false;
  const req = new Readable({
    read() {
      if (started) return;
      started = true;
      start(this);
    }
  });
  req.originalUrl = observation.ROUTE_PATH;
  req.headers = headers;
  return req;
}

function settleStreamEvents() {
  return new Promise((resolve) => setImmediate(() => setImmediate(resolve)));
}

function beginHandlerComposition(handlers, req, res) {
  let index = 0;
  function dispatch(error) {
    if (error) throw error;
    if (res.sent || index >= handlers.length) return;
    const handler = handlers[index++];
    handler(req, res, dispatch);
  }
  dispatch();
}

function instrumentedStreamHandlers(counters) {
  return observation.createAyaAuthenticatedPrincipalObservationRouteHandlers({
    getRuntimeEnv: () => "staging",
    requireAuthApi(_req, _res, next) {
      counters.authentication += 1;
      next();
    },
    evaluatorDependencies: {
      readDb() {
        counters.derivationReads += 1;
        throw new Error("stream failure must not reach derivation");
      },
      createAdmission() {
        counters.admissionConstruction += 1;
        return {
          authenticatedPrincipalPort() {
            counters.portInvocations += 1;
            return null;
          }
        };
      }
    }
  });
}

function runHandlers(handlers, req, res = responseDouble()) {
  return new Promise((resolve, reject) => {
    res.onSend(() => resolve(res));
    let index = 0;
    function dispatch(error) {
      if (error) return reject(error);
      if (res.sent || index >= handlers.length) return resolve(res);
      const handler = handlers[index++];
      let nextCalled = false;
      try {
        const returned = handler(req, res, (nextError) => {
          if (nextCalled) return;
          nextCalled = true;
          dispatch(nextError);
        });
        Promise.resolve(returned).then(() => {
          if (res.sent) resolve(res);
          else if (handler.length < 3 && !nextCalled) resolve(res);
        }, reject);
      } catch (handlerError) {
        reject(handlerError);
      }
    }
    dispatch();
  });
}

function assertNonAuthority(body) {
  assert.equal(body.authority, "NONE");
  assert.equal(body.authorityEffect, "NONE");
  if (body.nonClaims) {
    assert.deepEqual(body.nonClaims, observation.NON_CLAIMS);
  }
}

test("accepted observation scope composes through the real admission producer", () => {
  const fixture = createFixture();
  let reads = 0;
  const admission = createRealAdmission(fixture, () => { reads += 1; return fixture.snapshot; });
  const result = admission.assess(query());
  assert.equal(result.outcome, admissionModule.OUTCOMES.ACCEPTED, result.reason);
  assert.equal(reads, 1);
});

test("unchanged exact GATE scope remains accepted", () => {
  const fixture = createFixture();
  const result = createRealAdmission(fixture, () => fixture.snapshot).assess(query(gateScope()));
  assert.equal(result.outcome, admissionModule.OUTCOMES.ACCEPTED, result.reason);
});

test("observation scope is strict and rejects missing, extra, wrong revision, and unpaired-surrogate values", () => {
  const fixture = createFixture();
  const admission = createRealAdmission(fixture, () => fixture.snapshot);
  const variants = [
    (() => { const value = observationScope(); delete value.observationRef; return value; })(),
    { ...observationScope(), extra: true },
    observationScope({ observationRevision: "1" }),
    observationScope({ observationRef: `observation:\ud800` })
  ];
  for (const scope of variants) {
    assert.equal(admission.assess(query(scope)).outcome, admissionModule.OUTCOMES.INVALID);
  }
});

test("trusted derivation copies durable principal identity verbatim with one read and no writes", () => {
  const fixture = createFixture();
  let reads = 0;
  const before = JSON.stringify(fixture.snapshot);
  const result = observation.deriveTrustedQuery({
    readDb: () => { reads += 1; return fixture.snapshot; },
    req: fixture.req,
    observationRef: OBSERVATION_REF,
    principalBinding: durableBinding
  });
  assert.equal(result.ok, true);
  assert.equal(reads, 1);
  assert.equal(result.query.principalRef, PRINCIPAL_REF);
  assert.equal(result.query.principalRevision, PRINCIPAL_REVISION);
  assert.deepEqual(result.query.contextScope, observationScope());
  assert.equal(JSON.stringify(fixture.snapshot), before);
});

test("trusted derivation failure matrix fails before port invocation", () => {
  const scenarios = [
    (f) => { f.snapshot.users = []; },
    (f) => { f.snapshot.users.push(clone(f.snapshot.users[0])); },
    (f) => { f.snapshot.gt63GovernanceEvidence = []; },
    (f) => { f.snapshot.gt63GovernanceEvidence.push(clone(f.snapshot.gt63GovernanceEvidence[0])); },
    (f) => { delete f.snapshot.gt63GovernanceEvidence[0].record.principalRef; },
    (f) => { f.snapshot.gt63GovernanceEvidence[0].record.principalRevision = 1; },
    (f) => { f.snapshot.gt63GovernanceEvidence[0].evidenceRef = "mismatch"; },
    (f) => { f.req.user.agencyId = "AGY-OTHER"; },
    (f) => { f.snapshot.gt63GovernanceEvidence[0].record.bindingLifecycleState = "SUPERSEDED"; },
    (f) => { f.snapshot.gt63GovernanceEvidence[0].record.bindingFreshnessState = "STALE"; },
    (f) => { f.snapshot.gt63GovernanceEvidence[0].record.contradictionState = "PRESENT"; },
    (f) => { f.snapshot.gt63GovernanceEvidence[0].record.authorityEffect = "EFFECT"; }
  ];
  for (const mutate of scenarios) {
    const fixture = createFixture();
    mutate(fixture);
    let reads = 0;
    let producerCalls = 0;
    const result = evaluator(fixture, {
      readDb: () => { reads += 1; return fixture.snapshot; },
      createAdmission() { producerCalls += 1; throw new Error("must not construct"); }
    }).evaluate();
    assert.equal(result.statusCode, 409);
    assert.equal(result.body.observationState, "QUERY_DERIVATION_FAILED");
    assert.equal(result.body.portInvocationCount, 0);
    assert.equal(reads, 1);
    assert.equal(producerCalls, 0);
  }
});

test("real validators produce the exact ADMITTED historical witness", () => {
  const fixture = createFixture();
  let attempts = 0;
  let completions = 0;
  const before = JSON.stringify(fixture.snapshot);
  const result = evaluator(fixture, {
    readDb() { attempts += 1; completions += 1; return fixture.snapshot; }
  }).evaluate();
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.type, observation.WITNESS_TYPE);
  assert.equal(result.body.observationState, "ADMITTED");
  assert.equal(result.body.observedAt, OBSERVED_AT);
  assert.equal(result.body.portInvocationCount, 1);
  assert.equal(attempts, 2);
  assert.equal(completions, 2);
  assert.equal(result.body.observedPrincipal.principalRef, PRINCIPAL_REF);
  assert.equal(result.body.observedPrincipal.principalRevision, PRINCIPAL_REVISION);
  assert.equal(result.body.observedPrincipal.observedLifecycleState, "CURRENT");
  assert.equal(result.body.observedPrincipal.observedFreshnessState, "CURRENT");
  assert.equal(result.body.observedPrincipal.observedContradictionState, "NONE");
  assert.deepEqual(keys(result.body.provenance), [...observation.PROVENANCE_FIELDS].sort());
  assert.equal(result.body.reusablePrincipalProof, false);
  assertNonAuthority(result.body);
  assert.equal(JSON.stringify(fixture.snapshot), before);
});

test("ADMITTED schema contains exactly the accepted witness fields", () => {
  const result = evaluator(createFixture()).evaluate();
  assert.deepEqual(keys(result.body), [
    "type", "schemaVersion", "observationRef", "observationRevision", "observationState", "observedAt",
    "observedPrincipal", "provenance", "evidenceCurrentness", "portInvocationCount",
    "reusablePrincipalProof", "authority", "authorityEffect", "nonClaims"
  ].sort());
  assert.deepEqual(keys(result.body.observedPrincipal), [
    "principalRef", "principalRevision", "principalEvidenceRef", "observedLifecycleState",
    "observedFreshnessState", "observedContradictionState"
  ].sort());
});

test("fresh evaluation occurs on every call without witness or evidence reuse", () => {
  const fixture = createFixture();
  let reads = 0;
  let refs = 0;
  const instance = evaluator(fixture, {
    readDb() { reads += 1; return fixture.snapshot; },
    createObservationRef() { refs += 1; return `observation:provider-free:${refs}`; }
  });
  const first = instance.evaluate();
  const second = instance.evaluate();
  assert.equal(first.body.observationState, "ADMITTED");
  assert.equal(second.body.observationState, "ADMITTED");
  assert.notEqual(first.body.observationRef, second.body.observationRef);
  assert.notEqual(first.body, second.body);
  assert.equal(first.body.observedPrincipal.principalEvidenceRef, second.body.observedPrincipal.principalEvidenceRef);
  assert.equal(reads, 4);
});

test("derivation/admission snapshot change fails closed without retry", () => {
  const fixture = createFixture();
  const changed = clone(fixture.snapshot);
  changed.gt63GovernanceEvidence = [];
  let attempts = 0;
  const result = evaluator(fixture, {
    readDb() { attempts += 1; return attempts === 1 ? fixture.snapshot : changed; }
  }).evaluate();
  assert.equal(result.body.observationState, "UNAVAILABLE");
  assert.equal(result.body.portInvocationCount, 1);
  assert.equal(attempts, 2);
});

test("observation identity generation and validation failures are pre-evaluation and read-free", () => {
  for (const createObservationRef of [() => { throw new Error("identity"); }, () => "", () => `bad:\ud800`]) {
    const fixture = createFixture();
    let reads = 0;
    const result = evaluator(fixture, { createObservationRef, readDb() { reads += 1; return fixture.snapshot; } }).evaluate();
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.type, observation.PRE_EVALUATION_TYPE);
    assert.equal(result.body.failureClass, "OBSERVATION_IDENTITY_CREATION_FAILED");
    assert.equal(result.body.portInvocationCount, 0);
    assert.equal(Object.hasOwn(result.body, "observationRef"), false);
    assert.equal(Object.hasOwn(result.body, "observedAt"), false);
    assert.equal(reads, 0);
  }
});

test("clock failures preserve identity, use null observedAt, and perform no reads or port calls", () => {
  for (const observeNow of [() => { throw new Error("clock"); }, () => "not-a-time"]) {
    const fixture = createFixture();
    let reads = 0;
    const result = evaluator(fixture, { observeNow, readDb() { reads += 1; return fixture.snapshot; } }).evaluate();
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.observationState, "ERROR");
    assert.equal(result.body.observationRef, OBSERVATION_REF);
    assert.equal(result.body.observedAt, null);
    assert.equal(result.body.portInvocationCount, 0);
    assert.equal(result.body.evidenceCurrentness, "NO_REUSABLE_EVIDENCE_AVAILABLE");
    assert.equal(reads, 0);
  }
});

test("producer construction failure occurs after derivation but before port and admission read", () => {
  const fixture = createFixture();
  let attempts = 0;
  const result = evaluator(fixture, {
    readDb() { attempts += 1; return fixture.snapshot; },
    createAdmission() { throw new Error("construction"); }
  }).evaluate();
  assert.equal(result.body.observationState, "ERROR");
  assert.equal(result.body.portInvocationCount, 0);
  assert.equal(attempts, 1);
});

test("projection failure after accepted evidence returns truthful ERROR without partial evidence", () => {
  const fixture = createFixture();
  let attempts = 0;
  const result = evaluator(fixture, {
    readDb() { attempts += 1; return fixture.snapshot; },
    projectWitness() { throw new Error("projection"); }
  }).evaluate();
  assert.equal(result.statusCode, 500);
  assert.equal(result.body.observationState, "ERROR");
  assert.equal(result.body.portInvocationCount, 1);
  assert.equal(result.body.observedPrincipal, null);
  assert.equal(result.body.provenance, null);
  assert.equal(result.body.evidenceCurrentness, "NO_REUSABLE_EVIDENCE_AVAILABLE");
  assert.equal(attempts, 2);
});

test("[CONTROLLED DOUBLE] a throwing port is contained as route ERROR with port count one", () => {
  const fixture = createFixture();
  let reads = 0;
  const result = evaluator(fixture, {
    readDb() { reads += 1; return fixture.snapshot; },
    createAdmission() { return { authenticatedPrincipalPort() { throw new Error("port"); } }; }
  }).evaluate();
  assert.equal(result.body.observationState, "ERROR");
  assert.equal(result.body.portInvocationCount, 1);
  assert.equal(reads, 1);
});

test("null case 1: normal non-accepted assessment follows one completed admission read", () => {
  const fixture = createFixture();
  const changed = clone(fixture.snapshot);
  changed.gt63GovernanceEvidence = [];
  let attempts = 0;
  let completions = 0;
  const result = evaluator(fixture, {
    readDb() { attempts += 1; completions += 1; return attempts === 1 ? fixture.snapshot : changed; }
  }).evaluate();
  assert.equal(result.body.observationState, "UNAVAILABLE");
  assert.equal(result.body.portInvocationCount, 1);
  assert.equal(attempts, 2);
  assert.equal(completions, 2);
});

test("null case 2: failure before admission readDb performs no admission read attempt", () => {
  const fixture = createFixture();
  let derivationReads = 0;
  const result = evaluator(fixture, {
    readDb() { derivationReads += 1; return fixture.snapshot; },
    createAdmission(args) {
      return admissionModule.createAyaAuthenticatedPrincipalAdmission({ ...args, readDb: undefined });
    }
  }).evaluate();
  assert.equal(result.body.observationState, "UNAVAILABLE");
  assert.equal(result.body.portInvocationCount, 1);
  assert.equal(derivationReads, 1);
});

test("null case 3: admission readDb throw records one attempt and no completion", () => {
  const fixture = createFixture();
  let attempts = 0;
  let completions = 0;
  const result = evaluator(fixture, {
    readDb() {
      attempts += 1;
      if (attempts === 2) throw new Error("read");
      completions += 1;
      return fixture.snapshot;
    }
  }).evaluate();
  assert.equal(result.body.observationState, "UNAVAILABLE");
  assert.equal(result.body.portInvocationCount, 1);
  assert.equal(attempts, 2);
  assert.equal(completions, 1);
});

test("null case 4: post-read assessment failure is contained after one completed admission read", () => {
  const fixture = createFixture();
  let attempts = 0;
  let completions = 0;
  const result = evaluator(fixture, {
    readDb() { attempts += 1; completions += 1; return fixture.snapshot; },
    livePrincipalBoundary: { assessLivePrincipalBoundary() { throw new Error("post-read"); } }
  }).evaluate();
  assert.equal(result.body.observationState, "UNAVAILABLE");
  assert.equal(result.body.portInvocationCount, 1);
  assert.equal(attempts, 2);
  assert.equal(completions, 2);
});

test("UNAVAILABLE schema reveals no internal read accounting or diagnostics", () => {
  const fixture = createFixture();
  const changed = clone(fixture.snapshot);
  changed.gt63GovernanceEvidence = [];
  let call = 0;
  const result = evaluator(fixture, { readDb() { call += 1; return call === 1 ? fixture.snapshot : changed; } }).evaluate();
  assert.deepEqual(keys(result.body), [
    "type", "schemaVersion", "observationRef", "observationRevision", "observationState", "observedAt",
    "observedPrincipal", "provenance", "evidenceCurrentness", "portInvocationCount",
    "reusablePrincipalProof", "authority", "authorityEffect", "nonClaims"
  ].sort());
  assert.equal(result.body.observedPrincipal, null);
  assert.equal(result.body.provenance, null);
  assert.equal(Object.hasOwn(result.body, "diagnostics"), false);
  assertNonAuthority(result.body);
});

test("projection failure after null preserves null-path accounting and returns ERROR", () => {
  const fixture = createFixture();
  let attempts = 0;
  const changed = clone(fixture.snapshot);
  changed.gt63GovernanceEvidence = [];
  const result = evaluator(fixture, {
    readDb() { attempts += 1; return attempts === 1 ? fixture.snapshot : changed; },
    projectUnavailable() { throw new Error("unavailable projection"); }
  }).evaluate();
  assert.equal(result.body.observationState, "ERROR");
  assert.equal(result.body.portInvocationCount, 1);
  assert.equal(attempts, 2);
});

test("route attaches exact POST handler chain in accepted order", () => {
  const calls = [];
  const app = { post(route, ...handlers) { calls.push({ route, handlers }); } };
  const attached = observation.attachAyaAuthenticatedPrincipalObservationRoute(app, {
    requireAuthApi(_req, _res, next) { next(); }
  });
  assert.equal(attached.routePath, observation.ROUTE_PATH);
  assert.equal(attached.method, "POST");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].route, observation.ROUTE_PATH);
  assert.equal(calls[0].handlers.length, 5);
  assert.deepEqual(calls[0].handlers.map((handler) => handler.name), [
    "observationNoStore", "requireExactStagingRuntime", "requireNoObservationRequestInputs",
    "requireAuthApi", "evaluateObservation"
  ]);
});

test("server composes observation POST before global parsers without moving them", () => {
  const serverSource = fs.readFileSync(path.join(__dirname, "..", "..", "server.js"), "utf8");
  const attach = serverSource.indexOf("attachAyaAuthenticatedPrincipalObservationRoute(app");
  const cors = serverSource.indexOf("app.use(cors())");
  const json = serverSource.indexOf("app.use(express.json(");
  const urlencoded = serverSource.indexOf("app.use(express.urlencoded(");
  assert.ok(attach > 0 && attach < cors && cors < json && json < urlencoded);
});

test("non-staging classifications return generic 404 before auth, reads, identity, or port", async () => {
  for (const runtime of [undefined, "", "production", "Staging", " staging ", "unknown"]) {
    let authCalls = 0;
    let reads = 0;
    let refs = 0;
    const handlers = observation.createAyaAuthenticatedPrincipalObservationRouteHandlers({
      getRuntimeEnv: () => runtime,
      requireAuthApi() { authCalls += 1; },
      evaluatorDependencies: {
        readDb() { reads += 1; },
        createObservationRef() { refs += 1; return OBSERVATION_REF; }
      }
    });
    const res = await runHandlers(handlers, { originalUrl: observation.ROUTE_PATH, headers: {} });
    assert.equal(res.statusCode, 404);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(res.body.reason, "STAGING_RUNTIME_REQUIRED");
    assert.equal(authCalls, 0);
    assert.equal(reads, 0);
    assert.equal(refs, 0);
  }
});

test("availability and forbidden-input envelopes contain exactly the accepted fields", async () => {
  const unavailableHandlers = observation.createAyaAuthenticatedPrincipalObservationRouteHandlers({
    getRuntimeEnv: () => "production",
    requireAuthApi() { throw new Error("must not authenticate"); }
  });
  const unavailable = await runHandlers(unavailableHandlers, { originalUrl: observation.ROUTE_PATH, headers: {} });
  assert.deepEqual(keys(unavailable.body), [
    "type", "schemaVersion", "availability", "reason", "portInvocationCount", "authority", "authorityEffect"
  ].sort());

  const forbiddenHandlers = observation.createAyaAuthenticatedPrincipalObservationRouteHandlers({
    getRuntimeEnv: () => "staging",
    requireAuthApi() { throw new Error("must not authenticate"); }
  });
  const forbidden = await runHandlers(forbiddenHandlers, {
    originalUrl: `${observation.ROUTE_PATH}?`,
    headers: {}
  });
  assert.deepEqual(keys(forbidden.body), [
    "type", "schemaVersion", "observationState", "failureClass", "evaluationIdentityCreated",
    "observedPrincipal", "provenance", "evidenceCurrentness", "portInvocationCount", "authority", "authorityEffect"
  ].sort());
  assert.equal(Object.hasOwn(forbidden.body, "observationRef"), false);
  assert.equal(Object.hasOwn(forbidden.body, "observedAt"), false);
});

test("empty and valued query components are rejected before authentication", async () => {
  for (const suffix of ["?", "?x", "?x=", "?x=&x="]) {
    let authCalls = 0;
    const handlers = observation.createAyaAuthenticatedPrincipalObservationRouteHandlers({
      getRuntimeEnv: () => "staging",
      requireAuthApi() { authCalls += 1; }
    });
    const res = await runHandlers(handlers, { originalUrl: `${observation.ROUTE_PATH}${suffix}`, headers: {} });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.failureClass, "REQUEST_INPUT_FORBIDDEN");
    assert.equal(res.body.portInvocationCount, 0);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(authCalls, 0);
    assert.equal(Object.hasOwn(res.body, "observationRef"), false);
  }
});

test("zero-byte JSON declaration and declared bodies are rejected before authentication", async () => {
  const headersList = [
    { "content-type": "application/json", "content-length": "0" },
    { "content-length": "2" },
    { "transfer-encoding": "chunked" }
  ];
  for (const headers of headersList) {
    let authCalls = 0;
    const handlers = observation.createAyaAuthenticatedPrincipalObservationRouteHandlers({
      getRuntimeEnv: () => "staging",
      requireAuthApi() { authCalls += 1; }
    });
    const res = await runHandlers(handlers, { originalUrl: observation.ROUTE_PATH, headers });
    assert.equal(res.statusCode, 400);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(authCalls, 0);
  }
});

test("an undeclared received body octet is rejected without buffering or authentication", async () => {
  const req = Readable.from([Buffer.from("x")]);
  req.originalUrl = observation.ROUTE_PATH;
  req.headers = {};
  let authCalls = 0;
  const handlers = observation.createAyaAuthenticatedPrincipalObservationRouteHandlers({
    getRuntimeEnv: () => "staging",
    requireAuthApi() { authCalls += 1; }
  });
  const res = await runHandlers(handlers, req);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.failureClass, "REQUEST_INPUT_FORBIDDEN");
  assert.equal(res.sendCount, 1);
  assert.equal(authCalls, 0);
});

test("request-stream error before end returns the exact transport-failure envelope without downstream calls", async () => {
  const counters = {
    authentication: 0,
    derivationReads: 0,
    admissionConstruction: 0,
    portInvocations: 0
  };
  const req = streamRequest((stream) => queueMicrotask(() => stream.emit("error", new Error("synthetic stream failure"))));
  const res = responseDouble();
  beginHandlerComposition(instrumentedStreamHandlers(counters), req, res);
  await settleStreamEvents();

  assert.equal(res.statusCode, 400);
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(res.sendCount, 1);
  assert.deepEqual(res.body, {
    type: observation.PRE_EVALUATION_TYPE,
    schemaVersion: observation.SCHEMA_VERSION,
    observationState: "NOT_CREATED",
    failureClass: "REQUEST_STREAM_FAILED",
    evaluationIdentityCreated: false,
    observedPrincipal: null,
    provenance: null,
    evidenceCurrentness: "NOT_CREATED_REQUEST_REJECTED",
    portInvocationCount: 0,
    authority: "NONE",
    authorityEffect: "NONE"
  });
  assert.equal(Object.hasOwn(res.body, "observationRef"), false);
  assert.equal(Object.hasOwn(res.body, "observedAt"), false);
  assert.equal(Object.hasOwn(res.body, "diagnostics"), false);
  assert.deepEqual(counters, {
    authentication: 0,
    derivationReads: 0,
    admissionConstruction: 0,
    portInvocations: 0
  });
});

test("aborted followed by error is terminal, silent, and never reaches downstream evaluation", async () => {
  const counters = {
    authentication: 0,
    derivationReads: 0,
    admissionConstruction: 0,
    portInvocations: 0
  };
  const req = streamRequest((stream) => queueMicrotask(() => {
    stream.emit("aborted");
    stream.emit("error", new Error("error after abort"));
  }));
  const res = responseDouble();
  beginHandlerComposition(instrumentedStreamHandlers(counters), req, res);
  await settleStreamEvents();

  assert.equal(res.sendCount, 0);
  assert.equal(res.statusCode, null);
  assert.deepEqual(counters, {
    authentication: 0,
    derivationReads: 0,
    admissionConstruction: 0,
    portInvocations: 0
  });
});

test("premature close before end is terminal and does not send or continue", async () => {
  const counters = {
    authentication: 0,
    derivationReads: 0,
    admissionConstruction: 0,
    portInvocations: 0
  };
  const req = streamRequest((stream) => queueMicrotask(() => {
    stream.emit("close");
    stream.emit("error", new Error("error after premature close"));
  }));
  const res = responseDouble();
  beginHandlerComposition(instrumentedStreamHandlers(counters), req, res);
  await settleStreamEvents();

  assert.equal(res.sendCount, 0);
  assert.equal(res.statusCode, null);
  assert.deepEqual(counters, {
    authentication: 0,
    derivationReads: 0,
    admissionConstruction: 0,
    portInvocations: 0
  });
});

test("normal bodyless end followed by close calls next exactly once", async () => {
  const req = Readable.from([]);
  req.originalUrl = observation.ROUTE_PATH;
  req.headers = {};
  const res = responseDouble();
  let nextCalls = 0;
  const handlers = observation.createAyaAuthenticatedPrincipalObservationRouteHandlers({
    getRuntimeEnv: () => "staging",
    requireAuthApi() { throw new Error("not used by direct input-guard test"); }
  });
  handlers[0](req, res, () => {});
  handlers[2](req, res, () => { nextCalls += 1; });
  await settleStreamEvents();
  req.emit("close");
  await settleStreamEvents();

  assert.equal(nextCalls, 1);
  assert.equal(res.sendCount, 0);
});

test("bodyless Content-Length zero uses a real end transition and preserves existing 401", async () => {
  let authCalls = 0;
  const handlers = observation.createAyaAuthenticatedPrincipalObservationRouteHandlers({
    getRuntimeEnv: () => "staging",
    requireAuthApi(_req, res) {
      authCalls += 1;
      return res.status(401).json({ error: "Authentication required" });
    }
  });
  const req = Readable.from([]);
  req.originalUrl = observation.ROUTE_PATH;
  req.headers = { "content-length": "0" };
  const res = await runHandlers(handlers, req);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Authentication required" });
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(authCalls, 1);
});

test("repeated request-stream terminal events cannot double-send or continue", async () => {
  const counters = {
    authentication: 0,
    derivationReads: 0,
    admissionConstruction: 0,
    portInvocations: 0
  };
  const req = streamRequest((stream) => queueMicrotask(() => {
    stream.emit("error", new Error("first error"));
    stream.emit("error", new Error("second error"));
    stream.emit("aborted");
    stream.emit("close");
    stream.emit("error", new Error("last error"));
  }));
  const res = responseDouble();
  beginHandlerComposition(instrumentedStreamHandlers(counters), req, res);
  await settleStreamEvents();

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.failureClass, "REQUEST_STREAM_FAILED");
  assert.equal(res.sendCount, 1);
  assert.deepEqual(counters, {
    authentication: 0,
    derivationReads: 0,
    admissionConstruction: 0,
    portInvocations: 0
  });
});

test("request-stream failure with an unwritable destroyed response ends without a response", async () => {
  const counters = {
    authentication: 0,
    derivationReads: 0,
    admissionConstruction: 0,
    portInvocations: 0
  };
  const req = streamRequest((stream) => queueMicrotask(() => stream.emit("error", new Error("transport failed"))));
  const res = responseDouble();
  res.destroyed = true;
  res.closed = true;
  res.writable = false;
  beginHandlerComposition(instrumentedStreamHandlers(counters), req, res);
  await settleStreamEvents();

  assert.equal(res.sendCount, 0);
  assert.equal(res.statusCode, null);
  assert.deepEqual(counters, {
    authentication: 0,
    derivationReads: 0,
    admissionConstruction: 0,
    portInvocations: 0
  });
});

test("provider-free route success uses authenticated request context and real validators", async () => {
  const fixture = createFixture();
  let authCalls = 0;
  let reads = 0;
  const handlers = observation.createAyaAuthenticatedPrincipalObservationRouteHandlers({
    getRuntimeEnv: () => "staging",
    requireAuthApi(req, _res, next) {
      authCalls += 1;
      Object.assign(req, clone(fixture.req));
      next();
    },
    evaluatorDependencies: {
      readDb() { reads += 1; return fixture.snapshot; },
      authEventSessionBindingStore: fixture.store,
      createObservationRef: () => OBSERVATION_REF,
      observeNow: () => OBSERVED_AT,
      admissionNow: () => NOW,
      authEventSessionBinding: authBinding,
      livePrincipalBoundary: liveBoundary,
      principalBinding: durableBinding
    }
  });
  const res = await runHandlers(handlers, {
    originalUrl: observation.ROUTE_PATH,
    headers: { "content-length": "0" },
    readableEnded: true
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.observationState, "ADMITTED");
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(authCalls, 1);
  assert.equal(reads, 2);
});

test("all post-identity non-ADMITTED envelopes preserve the exact witness shell", () => {
  const fixture = createFixture();
  const missing = clone(fixture.snapshot);
  missing.gt63GovernanceEvidence = [];
  let calls = 0;
  const unavailable = evaluator(fixture, {
    readDb() { calls += 1; return calls === 1 ? fixture.snapshot : missing; }
  }).evaluate().body;
  const error = evaluator(fixture, { observeNow: () => "invalid" }).evaluate().body;

  const expected = [
    "type", "schemaVersion", "observationRef", "observationRevision", "observationState", "observedAt",
    "observedPrincipal", "provenance", "evidenceCurrentness", "portInvocationCount",
    "reusablePrincipalProof", "authority", "authorityEffect", "nonClaims"
  ].sort();
  assert.deepEqual(keys(unavailable), expected);
  assert.deepEqual(keys(error), expected);
  assert.deepEqual(unavailable.nonClaims, observation.NON_CLAIMS);
  assert.deepEqual(error.nonClaims, observation.NON_CLAIMS);
});

test("pre-auth rejection paths have zero route-owned reads and zero port calls", async () => {
  let reads = 0;
  let producerCalls = 0;
  const handlers = observation.createAyaAuthenticatedPrincipalObservationRouteHandlers({
    getRuntimeEnv: () => "staging",
    requireAuthApi() { throw new Error("authentication must not run"); },
    evaluatorDependencies: {
      readDb() { reads += 1; },
      createAdmission() { producerCalls += 1; }
    }
  });
  const res = await runHandlers(handlers, {
    originalUrl: `${observation.ROUTE_PATH}?principalRef=attacker`,
    headers: { "content-type": "application/json" }
  });
  assert.equal(res.statusCode, 400);
  assert.equal(reads, 0);
  assert.equal(producerCalls, 0);
});

test("no accepted witness creates downstream effects or reusable proof", () => {
  const body = evaluator(createFixture()).evaluate().body;
  assert.equal(body.reusablePrincipalProof, false);
  assert.deepEqual(body.nonClaims, {
    principalEligibilityCreated: false,
    roleCreated: false,
    delegationCreated: false,
    humanGateCreated: false,
    governancePackageCreated: false,
    effectAuthorizationCreated: false,
    offerMutationPerformed: false
  });
  assert.equal(Object.hasOwn(body, "principalEligibility"), false);
  assert.equal(Object.hasOwn(body, "role"), false);
});

(async () => {
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed += 1;
      process.stdout.write(`PASS ${name}\n`);
    } catch (error) {
      process.stderr.write(`FAIL ${name}\n${error.stack}\n`);
      process.exitCode = 1;
    }
  }
  process.stdout.write(`RESULT ${passed}/${tests.length} passed\n`);
})();
