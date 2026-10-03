"use strict";

const crypto = require("node:crypto");
const defaultAdmission = require("./aya-authenticated-principal-admission-v0");
const defaultPrincipalBinding = require("./aya-account-principal-binding-v0");

const COMPONENT = "AYA_AUTHENTICATED_PRINCIPAL_OBSERVATION_EVALUATION_V0";
const ROUTE_PATH = "/api/gt63/aya/authenticated-principal/observation";
const WITNESS_TYPE = "GT63_AYA_AUTHENTICATED_PRINCIPAL_OBSERVATION_WITNESS";
const PRE_EVALUATION_TYPE = "GT63_AYA_AUTHENTICATED_PRINCIPAL_OBSERVATION_PRE_EVALUATION_FAILURE";
const AVAILABILITY_TYPE = "GT63_AYA_AUTHENTICATED_PRINCIPAL_OBSERVATION_ROUTE_AVAILABILITY";
const SCHEMA_VERSION = "1.0";
const AUTHORITY = "NONE";
const AUTHORITY_EFFECT = "NONE";

const NON_CLAIMS = Object.freeze({
  principalEligibilityCreated: false,
  roleCreated: false,
  delegationCreated: false,
  humanGateCreated: false,
  governancePackageCreated: false,
  effectAuthorizationCreated: false,
  offerMutationPerformed: false
});

const PROVENANCE_FIELDS = Object.freeze([
  "principalBindingEvidenceRef",
  "authEventSessionBindingRef",
  "authenticationEventIdentity",
  "aClassEvidenceIdentity",
  "aClassEvidenceRevision",
  "sessionRef",
  "sessionVersion",
  "observedPrincipalAuthEpoch",
  "currentPrincipalAuthEpoch"
]);

function plain(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requestContainer(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function makeReadOnlyView(root) {
  const proxies = new WeakMap();
  function wrap(value) {
    if (!value || typeof value !== "object") return value;
    if (proxies.has(value)) return proxies.get(value);
    const proxy = new Proxy(value, {
      get(target, property, receiver) {
        return wrap(Reflect.get(target, property, receiver));
      },
      set() { throw new TypeError("query-derivation snapshot is read-only"); },
      deleteProperty() { throw new TypeError("query-derivation snapshot is read-only"); },
      defineProperty() { throw new TypeError("query-derivation snapshot is read-only"); },
      setPrototypeOf() { throw new TypeError("query-derivation snapshot is read-only"); }
    });
    proxies.set(value, proxy);
    return proxy;
  }
  return wrap(root);
}

function response(statusCode, body) {
  return deepFreeze({ statusCode, body: clone(body) });
}

function availabilityUnavailable() {
  return response(404, {
    type: AVAILABILITY_TYPE,
    schemaVersion: SCHEMA_VERSION,
    availability: "UNAVAILABLE",
    reason: "STAGING_RUNTIME_REQUIRED",
    portInvocationCount: 0,
    authority: AUTHORITY,
    authorityEffect: AUTHORITY_EFFECT
  });
}

function preEvaluationFailure(failureClass, evidenceCurrentness) {
  const statusCode = failureClass === "REQUEST_INPUT_FORBIDDEN" || failureClass === "REQUEST_STREAM_FAILED"
    ? 400
    : 500;
  return response(statusCode, {
    type: PRE_EVALUATION_TYPE,
    schemaVersion: SCHEMA_VERSION,
    observationState: "NOT_CREATED",
    failureClass,
    evaluationIdentityCreated: false,
    observedPrincipal: null,
    provenance: null,
    evidenceCurrentness,
    portInvocationCount: 0,
    authority: AUTHORITY,
    authorityEffect: AUTHORITY_EFFECT
  });
}

function witnessBase({ observationRef, observationState, observedAt, evidenceCurrentness, portInvocationCount }) {
  return {
    type: WITNESS_TYPE,
    schemaVersion: SCHEMA_VERSION,
    observationRef,
    observationRevision: 1,
    observationState,
    observedAt,
    observedPrincipal: null,
    provenance: null,
    evidenceCurrentness,
    portInvocationCount,
    reusablePrincipalProof: false,
    authority: AUTHORITY,
    authorityEffect: AUTHORITY_EFFECT,
    nonClaims: { ...NON_CLAIMS }
  };
}

function queryDerivationFailed(observationRef, observedAt) {
  return response(409, witnessBase({
    observationRef,
    observationState: "QUERY_DERIVATION_FAILED",
    observedAt,
    evidenceCurrentness: "NOT_CREATED_PORT_NOT_INVOKED",
    portInvocationCount: 0
  }));
}

function unavailableWitness(observationRef, observedAt) {
  return response(200, witnessBase({
    observationRef,
    observationState: "UNAVAILABLE",
    observedAt,
    evidenceCurrentness: "NO_ACCEPTED_EVIDENCE_OBSERVED",
    portInvocationCount: 1
  }));
}

function errorWitness(observationRef, observedAt, portInvocationCount) {
  return response(500, witnessBase({
    observationRef,
    observationState: "ERROR",
    observedAt,
    evidenceCurrentness: "NO_REUSABLE_EVIDENCE_AVAILABLE",
    portInvocationCount
  }));
}

function validObservationRef(value, admissionModule = defaultAdmission) {
  return nonEmpty(value) && !admissionModule.hasUnpairedSurrogate(value);
}

function validObservedAt(value) {
  if (!nonEmpty(value)) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch (_error) {
    return false;
  }
}

function requiredExactString(object, field, admissionModule = defaultAdmission) {
  return plain(object)
    && Object.prototype.hasOwnProperty.call(object, field)
    && nonEmpty(object[field])
    && !admissionModule.hasUnpairedSurrogate(object[field]);
}

function derivationFailure(classification) {
  return Object.freeze({ ok: false, classification });
}

function deriveTrustedQuery({ readDb, req, observationRef, principalBinding = defaultPrincipalBinding } = {}) {
  if (typeof readDb !== "function") return derivationFailure("UNKNOWN");
  let snapshot;
  try {
    snapshot = readDb();
  } catch (_error) {
    return derivationFailure("UNKNOWN");
  }
  if (!plain(snapshot) || !Array.isArray(snapshot.users) || !Array.isArray(snapshot[principalBinding.COLLECTION])) {
    return derivationFailure("UNKNOWN");
  }
  if (!requestContainer(req) || !plain(req.user)
    || !requiredExactString(req.user, "id")
    || !requiredExactString(req.user, "agencyId")) {
    return derivationFailure("INVALID");
  }

  const snapshotView = makeReadOnlyView(snapshot);
  const accountMatches = snapshotView.users.filter((candidate) => plain(candidate) && candidate.id === req.user.id);
  if (accountMatches.length === 0) return derivationFailure("UNKNOWN");
  if (accountMatches.length > 1) return derivationFailure("CONTRADICTED");
  const account = accountMatches[0];
  if (!requiredExactString(account, "id") || !requiredExactString(account, "agencyId")) {
    return derivationFailure("INVALID");
  }
  if (req.user.agencyId !== account.agencyId) {
    return derivationFailure("CONTRADICTED");
  }

  const subjectEntries = snapshotView[principalBinding.COLLECTION].filter((entry) => plain(entry)
    && entry.evidenceType === principalBinding.EVIDENCE_TYPE
    && plain(entry.record)
    && entry.record.agencyId === account.agencyId
    && entry.record.applicationUserId === account.id);
  if (subjectEntries.length === 0) return derivationFailure("UNKNOWN");
  const currentEntries = subjectEntries.filter((entry) => entry.record.bindingLifecycleState === "CURRENT");
  if (currentEntries.length === 0) return derivationFailure("UNKNOWN");
  if (currentEntries.length > 1) return derivationFailure("CONTRADICTED");

  const raw = currentEntries[0];
  let envelopeValidation;
  try {
    envelopeValidation = principalBinding.validateEnvelope(raw);
  } catch (_error) {
    return derivationFailure("INVALID");
  }
  if (!plain(envelopeValidation) || envelopeValidation.outcome !== principalBinding.OUTCOMES.ACCEPTED) {
    return derivationFailure(envelopeValidation?.outcome || "INVALID");
  }

  const forbiddenWriter = () => { throw new TypeError("query derivation has no write capability"); };
  let ledger;
  try {
    ledger = principalBinding.createDurablePrincipalBindingLedger({
      readDb: () => snapshotView,
      writeDb: forbiddenWriter
    });
  } catch (_error) {
    return derivationFailure("UNKNOWN");
  }

  let found;
  try {
    found = ledger.findCurrentBySubject({ agencyId: account.agencyId, applicationUserId: account.id });
  } catch (_error) {
    return derivationFailure("INVALID");
  }
  if (!plain(found) || found.outcome !== principalBinding.OUTCOMES.ACCEPTED || !plain(found.record)) {
    return derivationFailure(found?.outcome || "UNKNOWN");
  }

  let fetched;
  try {
    fetched = ledger.get(found.record.principalBindingEvidenceRef);
  } catch (_error) {
    return derivationFailure("INVALID");
  }
  if (!plain(fetched) || fetched.outcome !== principalBinding.OUTCOMES.ACCEPTED || !plain(fetched.record)) {
    return derivationFailure(fetched?.outcome || "UNKNOWN");
  }

  let recordValidation;
  try {
    recordValidation = principalBinding.validateBindingRecord(fetched.record);
  } catch (_error) {
    return derivationFailure("INVALID");
  }
  if (!plain(recordValidation) || recordValidation.outcome !== principalBinding.OUTCOMES.ACCEPTED) {
    return derivationFailure(recordValidation?.outcome || "INVALID");
  }
  const record = recordValidation.record;

  if (raw.evidenceRef !== record.principalBindingEvidenceRef
    || found.record.principalBindingEvidenceRef !== record.principalBindingEvidenceRef) {
    return derivationFailure("CONTRADICTED");
  }
  if (record.agencyId !== account.agencyId || record.applicationUserId !== account.id) {
    return derivationFailure("CONTRADICTED");
  }
  if (record.bindingLifecycleState !== "CURRENT" || record.bindingFreshnessState !== "CURRENT") {
    return derivationFailure("UNKNOWN");
  }
  if (record.contradictionState !== "NONE") return derivationFailure("CONTRADICTED");
  if (record.authority !== AUTHORITY || record.authorityEffect !== AUTHORITY_EFFECT) {
    return derivationFailure("REJECTED");
  }
  if (!requiredExactString(record, "principalRef") || !requiredExactString(record, "principalRevision")) {
    return derivationFailure("INVALID");
  }

  return deepFreeze({
    ok: true,
    query: {
      principalRef: record.principalRef,
      principalRevision: record.principalRevision,
      contextScope: {
        scopeType: "AUTHENTICATED_PRINCIPAL_OBSERVATION",
        observationType: "BOUNDED_LIVE_WITNESS",
        observationRef,
        observationRevision: 1
      }
    }
  });
}

function projectAdmittedWitness({ evidence, observationRef, observedAt, admissionModule = defaultAdmission } = {}) {
  for (const field of ["principalRef", "principalRevision", "principalEvidenceRef"]) {
    if (!requiredExactString(evidence, field, admissionModule)) throw new TypeError(`accepted evidence ${field} unavailable`);
  }
  if (evidence.lifecycleState !== "CURRENT"
    || evidence.freshnessState !== "CURRENT"
    || evidence.contradictionState !== "NONE"
    || evidence.authority !== AUTHORITY
    || evidence.authorityEffect !== AUTHORITY_EFFECT) {
    throw new TypeError("accepted evidence state invalid");
  }
  if (!plain(evidence.provenance)) throw new TypeError("accepted evidence provenance unavailable");
  const provenance = {};
  for (const field of PROVENANCE_FIELDS) {
    if (!requiredExactString(evidence.provenance, field, admissionModule)) {
      throw new TypeError(`accepted evidence provenance ${field} unavailable`);
    }
    provenance[field] = evidence.provenance[field];
  }
  if (!plain(evidence.nonClaims)
    || Object.keys(NON_CLAIMS).some((field) => evidence.nonClaims[field] !== false)) {
    throw new TypeError("accepted evidence non-claims invalid");
  }

  const body = witnessBase({
    observationRef,
    observationState: "ADMITTED",
    observedAt,
    evidenceCurrentness: "ENDED_WITH_SYNCHRONOUS_OBSERVATION_EVALUATION",
    portInvocationCount: 1
  });
  body.observedPrincipal = {
    principalRef: evidence.principalRef,
    principalRevision: evidence.principalRevision,
    principalEvidenceRef: evidence.principalEvidenceRef,
    observedLifecycleState: evidence.lifecycleState,
    observedFreshnessState: evidence.freshnessState,
    observedContradictionState: evidence.contradictionState
  };
  body.provenance = provenance;
  return response(200, body);
}

function createAyaAuthenticatedPrincipalObservationEvaluator({
  readDb,
  req,
  authEventSessionBindingStore,
  createObservationRef = () => crypto.randomUUID(),
  observeNow = () => new Date().toISOString(),
  admissionNow = () => Date.now(),
  createAdmission = defaultAdmission.createAyaAuthenticatedPrincipalAdmission,
  admissionModule = defaultAdmission,
  principalBinding = defaultPrincipalBinding,
  authEventSessionBinding,
  livePrincipalBoundary,
  projectWitness = projectAdmittedWitness,
  projectUnavailable = unavailableWitness
} = {}) {
  function evaluate() {
    let observationRef;
    try {
      observationRef = createObservationRef();
      if (!validObservationRef(observationRef, admissionModule)) throw new TypeError("observationRef invalid");
    } catch (_error) {
      return preEvaluationFailure("OBSERVATION_IDENTITY_CREATION_FAILED", "NOT_CREATED_IDENTITY_FAILURE");
    }

    let observedAt = null;
    let portInvocationCount = 0;
    try {
      const observedAtCandidate = observeNow();
      if (!validObservedAt(observedAtCandidate)) throw new TypeError("observedAt invalid");
      observedAt = observedAtCandidate;

      const derivation = deriveTrustedQuery({ readDb, req, observationRef, principalBinding });
      if (!derivation.ok) return queryDerivationFailed(observationRef, observedAt);

      const admission = createAdmission({
        readDb,
        req,
        authEventSessionBindingStore,
        now: admissionNow,
        authEventSessionBinding,
        livePrincipalBoundary,
        principalBinding
      });
      if (!admission || typeof admission.authenticatedPrincipalPort !== "function") {
        throw new TypeError("authenticated-principal port unavailable");
      }

      portInvocationCount = 1;
      const evidence = admission.authenticatedPrincipalPort(derivation.query);
      if (evidence === null) return projectUnavailable(observationRef, observedAt);
      return projectWitness({ evidence, observationRef, observedAt, admissionModule });
    } catch (_error) {
      return errorWitness(observationRef, observedAt, portInvocationCount);
    }
  }

  return Object.freeze({ evaluate, component: COMPONENT, authority: AUTHORITY, authorityEffect: AUTHORITY_EFFECT });
}

function rawHeader(req, name) {
  const headers = req && plain(req.headers) ? req.headers : {};
  const value = headers[name] ?? headers[name.toLowerCase()];
  return value;
}

function hasQueryComponent(req) {
  const raw = typeof req?.originalUrl === "string" ? req.originalUrl : req?.url;
  return typeof raw === "string" && raw.includes("?");
}

function hasDeclaredBody(req) {
  if (rawHeader(req, "content-type") !== undefined) return true;
  if (rawHeader(req, "transfer-encoding") !== undefined) return true;
  const length = rawHeader(req, "content-length");
  if (length === undefined) return false;
  if (Array.isArray(length) || !/^\d+$/.test(String(length))) return true;
  try {
    return BigInt(String(length)) > 0n;
  } catch (_error) {
    return true;
  }
}

function send(res, result) {
  return res.status(result.statusCode).json(result.body);
}

function canSendRequestStreamFailure(req, res) {
  if (!res || res.headersSent === true || res.destroyed === true || res.closed === true
      || res.writableEnded === true || res.writable === false) return false;
  if (!req || req.destroyed === true || req.closed === true || req.aborted === true
      || req.readableAborted === true) return false;
  return typeof res.status === "function" && typeof res.json === "function";
}

function createAyaAuthenticatedPrincipalObservationRouteHandlers({
  getRuntimeEnv = () => process.env.GT63_RUNTIME_ENV,
  requireAuthApi,
  evaluatorDependencies = {}
} = {}) {
  if (typeof requireAuthApi !== "function") throw new TypeError("requireAuthApi required");

  function observationNoStore(_req, res, next) {
    res.setHeader("Cache-Control", "no-store");
    next();
  }

  function requireExactStagingRuntime(_req, res, next) {
    if (getRuntimeEnv() !== "staging") return send(res, availabilityUnavailable());
    next();
  }

  function requireNoObservationRequestInputs(req, res, next) {
    if (hasQueryComponent(req) || hasDeclaredBody(req)) {
      return send(res, preEvaluationFailure("REQUEST_INPUT_FORBIDDEN", "NOT_CREATED_REQUEST_REJECTED"));
    }
    if (!req || typeof req.once !== "function" || typeof req.on !== "function") return next();

    let finished = false;
    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("aborted", onAborted);
      req.removeListener("close", onClose);
    };
    const finishStreamFailure = (mayRespond) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (!mayRespond || !canSendRequestStreamFailure(req, res)) return;
      try {
        send(res, preEvaluationFailure("REQUEST_STREAM_FAILED", "NOT_CREATED_REQUEST_REJECTED"));
      } catch (_error) {
        // The response transport became unusable after the writability check.
      }
    };
    const onData = () => {
      if (finished) return;
      finished = true;
      cleanup();
      if (typeof req.resume === "function") req.resume();
      send(res, preEvaluationFailure("REQUEST_INPUT_FORBIDDEN", "NOT_CREATED_REQUEST_REJECTED"));
    };
    const onEnd = () => {
      if (finished) return;
      finished = true;
      cleanup();
      next();
    };
    const onAborted = () => {
      finishStreamFailure(false);
    };
    const onClose = () => {
      finishStreamFailure(false);
    };
    const onError = () => {
      finishStreamFailure(true);
    };
    req.on("error", onError);
    if (req.readableEnded === true) {
      finished = true;
      next();
      return;
    }
    req.once("data", onData);
    req.once("end", onEnd);
    req.once("aborted", onAborted);
    req.once("close", onClose);
    if (typeof req.resume === "function") req.resume();
  }

  function evaluateObservation(req, res) {
    const evaluator = createAyaAuthenticatedPrincipalObservationEvaluator({
      ...evaluatorDependencies,
      req
    });
    return send(res, evaluator.evaluate());
  }

  return Object.freeze([
    observationNoStore,
    requireExactStagingRuntime,
    requireNoObservationRequestInputs,
    requireAuthApi,
    evaluateObservation
  ]);
}

function attachAyaAuthenticatedPrincipalObservationRoute(app, dependencies = {}) {
  if (!app || typeof app.post !== "function") throw new TypeError("Express app required");
  const handlers = createAyaAuthenticatedPrincipalObservationRouteHandlers(dependencies);
  app.post(ROUTE_PATH, ...handlers);
  return Object.freeze({ routePath: ROUTE_PATH, method: "POST", handlerCount: handlers.length });
}

module.exports = Object.freeze({
  COMPONENT,
  ROUTE_PATH,
  WITNESS_TYPE,
  PRE_EVALUATION_TYPE,
  AVAILABILITY_TYPE,
  SCHEMA_VERSION,
  AUTHORITY,
  AUTHORITY_EFFECT,
  NON_CLAIMS,
  PROVENANCE_FIELDS,
  deriveTrustedQuery,
  projectAdmittedWitness,
  createAyaAuthenticatedPrincipalObservationEvaluator,
  createAyaAuthenticatedPrincipalObservationRouteHandlers,
  attachAyaAuthenticatedPrincipalObservationRoute,
  hasQueryComponent,
  hasDeclaredBody
});
