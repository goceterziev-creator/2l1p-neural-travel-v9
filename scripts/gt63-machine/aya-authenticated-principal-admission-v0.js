"use strict";

const crypto = require("node:crypto");
const defaultAuthEventSessionBinding = require("./aya-auth-event-session-binding-v0");
const defaultLivePrincipalBoundary = require("./aya-live-principal-boundary-v0");
const defaultPrincipalBinding = require("./aya-account-principal-binding-v0");

const COMPONENT = "AYA_AUTHENTICATED_PRINCIPAL_ADMISSION_V0";
const TYPE = "GT63_AYA_AUTHENTICATED_PRINCIPAL_EVIDENCE";
const SCHEMA_VERSION = "1.0";
const RULESET_VERSION = "aya-authenticated-principal-admission-v0.1.0";
const AUTHORITY = "NONE";
const AUTHORITY_EFFECT = "NONE";
const PRINCIPAL_EVIDENCE_NAMESPACE = "gt63-evidence:aya-authenticated-principal:";

const OUTCOMES = Object.freeze({
  ACCEPTED: "ACCEPTED",
  UNKNOWN: "UNKNOWN",
  REJECTED: "REJECTED",
  CONTRADICTED: "CONTRADICTED",
  INVALID: "INVALID"
});

const NON_CLAIMS = Object.freeze({
  principalEligibilityCreated: false,
  roleCreated: false,
  delegationCreated: false,
  humanGateCreated: false,
  governancePackageCreated: false,
  effectAuthorizationCreated: false,
  offerMutationPerformed: false
});

const GATE_SCOPE_FIELDS = Object.freeze([
  "scopeType",
  "interactionId",
  "fromInteractionRevision",
  "throughInteractionRevision",
  "gateId",
  "gateRevision",
  "authorityScopeDigest",
  "continuationTargetRef"
]);

const OBSERVATION_SCOPE_FIELDS = Object.freeze([
  "scopeType",
  "observationType",
  "observationRef",
  "observationRevision"
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

function hasUnpairedSurrogate(value) {
  if (typeof value !== "string") return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function assertExactSerializable(value, seen = new Set()) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    if (typeof value === "string" && hasUnpairedSurrogate(value)) {
      throw new TypeError("unpaired UTF-16 surrogate");
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("unsupported non-finite number");
    return value;
  }
  if (value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new TypeError("unsupported serialization value");
  }
  if (typeof value !== "object") throw new TypeError("unsupported serialization value");
  if (seen.has(value)) throw new TypeError("cyclic serialization value");
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map((entry) => assertExactSerializable(entry, seen));
  } else {
    if (!plain(value)) throw new TypeError("unsupported non-plain object");
    result = {};
    for (const key of Object.keys(value).sort()) {
      if (hasUnpairedSurrogate(key)) throw new TypeError("unpaired UTF-16 surrogate in object key");
      result[key] = assertExactSerializable(value[key], seen);
    }
  }
  seen.delete(value);
  return result;
}

function canonicalStringifyExact(value) {
  return JSON.stringify(assertExactSerializable(value));
}

function cloneExact(value) {
  return value === undefined ? undefined : JSON.parse(canonicalStringifyExact(value));
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
      set() { throw new TypeError("snapshot-bound view is read-only"); },
      deleteProperty() { throw new TypeError("snapshot-bound view is read-only"); },
      defineProperty() { throw new TypeError("snapshot-bound view is read-only"); },
      setPrototypeOf() { throw new TypeError("snapshot-bound view is read-only"); }
    });
    proxies.set(value, proxy);
    return proxy;
  }
  return wrap(root);
}

function principalEvidenceRefFromMaterial(material) {
  const serialized = canonicalStringifyExact(material);
  const hash = crypto.createHash("sha256").update(Buffer.from(serialized, "utf8")).digest("hex");
  return `${PRINCIPAL_EVIDENCE_NAMESPACE}${hash}`;
}

function diagnostic(outcome, reason, evidence = null) {
  return deepFreeze({
    component: COMPONENT,
    rulesetVersion: RULESET_VERSION,
    outcome,
    reason: reason || null,
    evidence: evidence ? cloneExact(evidence) : null,
    authority: AUTHORITY,
    authorityEffect: AUTHORITY_EFFECT,
    ...NON_CLAIMS
  });
}

function exactObjectFields(value, fields) {
  return plain(value)
    && Object.keys(value).length === fields.length
    && Object.keys(value).every((key) => fields.includes(key));
}

function validGateScope(scope) {
  return exactObjectFields(scope, GATE_SCOPE_FIELDS)
    && scope.scopeType === "GATE"
    && nonEmpty(scope.interactionId)
    && Number.isInteger(scope.fromInteractionRevision)
    && scope.fromInteractionRevision >= 0
    && (scope.throughInteractionRevision === null
      || (Number.isInteger(scope.throughInteractionRevision)
        && scope.throughInteractionRevision >= scope.fromInteractionRevision))
    && nonEmpty(scope.gateId)
    && Number.isInteger(scope.gateRevision)
    && scope.gateRevision > 0
    && /^sha256:[0-9a-f]{64}$/.test(scope.authorityScopeDigest)
    && nonEmpty(scope.continuationTargetRef)
    && !Object.values(scope).some(hasUnpairedSurrogate);
}

function validObservationScope(scope) {
  return exactObjectFields(scope, OBSERVATION_SCOPE_FIELDS)
    && scope.scopeType === "AUTHENTICATED_PRINCIPAL_OBSERVATION"
    && scope.observationType === "BOUNDED_LIVE_WITNESS"
    && nonEmpty(scope.observationRef)
    && !hasUnpairedSurrogate(scope.observationRef)
    && scope.observationRevision === 1;
}

function validScope(scope) {
  return validGateScope(scope) || validObservationScope(scope);
}

function validateQuery(query) {
  if (!plain(query)) return { outcome: OUTCOMES.INVALID, reason: "malformed authenticated-principal query" };
  for (const field of ["principalRef", "principalRevision", "contextScope"]) {
    if (!Object.prototype.hasOwnProperty.call(query, field)) {
      return { outcome: OUTCOMES.UNKNOWN, reason: `query ${field} required` };
    }
  }
  if (Object.keys(query).length !== 3) return { outcome: OUTCOMES.INVALID, reason: "unsupported query properties" };
  if (typeof query.principalRef !== "string" || typeof query.principalRevision !== "string") {
    return { outcome: OUTCOMES.INVALID, reason: "query principal identity must use strings" };
  }
  if (!nonEmpty(query.principalRef) || !nonEmpty(query.principalRevision)) {
    return { outcome: OUTCOMES.INVALID, reason: "query principal identity must be non-empty" };
  }
  if (hasUnpairedSurrogate(query.principalRef) || hasUnpairedSurrogate(query.principalRevision)) {
    return { outcome: OUTCOMES.INVALID, reason: "query identity contains unpaired UTF-16 surrogate" };
  }
  if (!validScope(query.contextScope)) return { outcome: OUTCOMES.INVALID, reason: "unsupported contextScope structure" };
  return null;
}

function classifyForeign(result, fallbackReason) {
  if (!plain(result)) return { outcome: OUTCOMES.UNKNOWN, reason: fallbackReason };
  if (Object.values(OUTCOMES).includes(result.outcome)) {
    return { outcome: result.outcome, reason: result.reason || fallbackReason };
  }
  return { outcome: OUTCOMES.UNKNOWN, reason: result.reason || fallbackReason };
}

function requiredString(object, field) {
  if (!Object.prototype.hasOwnProperty.call(object, field) || object[field] === null || object[field] === undefined || object[field] === "") {
    return { outcome: OUTCOMES.UNKNOWN, reason: `${field} required` };
  }
  if (typeof object[field] !== "string" || hasUnpairedSurrogate(object[field])) {
    return { outcome: OUTCOMES.INVALID, reason: `${field} must be an exact valid Unicode string` };
  }
  return null;
}

function requiredState(object, field, accepted, positiveContradiction = false) {
  const base = requiredString(object, field);
  if (base) return base;
  if (object[field] !== accepted) {
    return {
      outcome: positiveContradiction ? OUTCOMES.CONTRADICTED : OUTCOMES.UNKNOWN,
      reason: `${field} is not ${accepted}`
    };
  }
  return null;
}

function createSnapshotBoundReadOnlyPrincipalBindingView(snapshot, principalBinding) {
  const readOnlySnapshot = makeReadOnlyView(snapshot);
  const forbiddenWriter = () => { throw new TypeError("snapshot-bound binding view has no write capability"); };
  const ledger = principalBinding.createDurablePrincipalBindingLedger({
    readDb: () => readOnlySnapshot,
    writeDb: forbiddenWriter
  });
  return Object.freeze({
    findCurrentBySubject: (subject) => ledger.findCurrentBySubject(subject),
    get: (reference) => ledger.get(reference),
    validateEnvelope: (envelope) => principalBinding.validateEnvelope(envelope),
    validateBindingRecord: (record) => principalBinding.validateBindingRecord(record)
  });
}

function createAyaAuthenticatedPrincipalAdmission({
  readDb,
  req,
  authEventSessionBindingStore,
  now = () => Date.now(),
  authEventSessionBinding = defaultAuthEventSessionBinding,
  livePrincipalBoundary = defaultLivePrincipalBoundary,
  principalBinding = defaultPrincipalBinding
} = {}) {
  function assess(query) {
    const queryProblem = validateQuery(query);

    let snapshot;
    if (typeof readDb !== "function") {
      return diagnostic(queryProblem?.outcome || OUTCOMES.UNKNOWN, queryProblem?.reason || "readDb unavailable");
    }
    try {
      snapshot = readDb();
    } catch (_error) {
      return diagnostic(queryProblem?.outcome || OUTCOMES.UNKNOWN, queryProblem?.reason || "readDb failed");
    }
    if (queryProblem) return diagnostic(queryProblem.outcome, queryProblem.reason);
    if (!plain(snapshot) || !Array.isArray(snapshot.users) || !Array.isArray(snapshot[principalBinding.COLLECTION])) {
      return diagnostic(OUTCOMES.UNKNOWN, "authoritative DB snapshot or required collection unavailable");
    }

    const snapshotView = makeReadOnlyView(snapshot);
    if (!requestContainer(req) || !plain(req.user)) {
      return diagnostic(OUTCOMES.UNKNOWN, "authenticated request user unavailable");
    }
    if (typeof req.user.id !== "string" || hasUnpairedSurrogate(req.user.id)) {
      return diagnostic(OUTCOMES.INVALID, "request user identity must be an exact valid Unicode string");
    }
    const accountMatches = snapshotView.users.filter((entry) => plain(entry) && entry.id === req.user.id);
    if (accountMatches.length === 0) return diagnostic(OUTCOMES.UNKNOWN, "current account unavailable");
    if (accountMatches.length > 1) return diagnostic(OUTCOMES.CONTRADICTED, "multiple matching current accounts");
    const currentAccountRecord = accountMatches[0];
    for (const field of ["id", "agencyId"]) {
      const problem = requiredString(currentAccountRecord, field);
      if (problem) return diagnostic(problem.outcome, problem.reason);
    }

    let liveAssessment;
    try {
      liveAssessment = livePrincipalBoundary.assessLivePrincipalBoundary({
        req,
        currentDbUser: currentAccountRecord,
        store: authEventSessionBindingStore,
        authEventSessionBinding,
        now: typeof now === "function" ? now() : now
      });
    } catch (_error) {
      return diagnostic(OUTCOMES.UNKNOWN, "live principal assessment failed");
    }
    if (!plain(liveAssessment)) return diagnostic(OUTCOMES.UNKNOWN, "live principal assessment unavailable");
    if (liveAssessment.authority !== AUTHORITY || liveAssessment.authorityEffect !== AUTHORITY_EFFECT) {
      return diagnostic(OUTCOMES.REJECTED, "live assessment authority mismatch");
    }
    if (liveAssessment.bindingAssessment !== OUTCOMES.ACCEPTED
      || liveAssessment.principalAuthEpochCurrentness !== "CURRENT"
      || liveAssessment.sourceMaterialProduced !== true) {
      if (liveAssessment.bindingAssessment === OUTCOMES.ACCEPTED) {
        if (liveAssessment.principalAuthEpochCurrentness === "MISMATCH") {
          return diagnostic(OUTCOMES.REJECTED, liveAssessment.reason || "principalAuthEpoch mismatch");
        }
        return diagnostic(OUTCOMES.UNKNOWN, liveAssessment.reason || "live authenticated-principal source material unavailable");
      }
      const classified = classifyForeign(
        { outcome: liveAssessment.bindingAssessment, reason: liveAssessment.reason },
        "live authenticated-principal source material unavailable"
      );
      return diagnostic(classified.outcome, classified.reason);
    }
    const liveMaterial = liveAssessment.authenticatedPrincipalSourceMaterial;
    if (!plain(liveMaterial)) return diagnostic(OUTCOMES.UNKNOWN, "live authenticated-principal source material unavailable");

    const liveStringFields = [
      "bindingRef", "authenticationEventIdentity", "aClassEvidenceIdentity", "aClassEvidenceRevision",
      "applicationUserId", "agencyId", "sessionRef", "sessionVersion",
      "observedPrincipalAuthEpoch", "currentPrincipalAuthEpoch",
      "observedPrincipalRevision", "currentPrincipalRevision",
      "lifecycleState", "freshnessState", "contradictionState", "authority", "authorityEffect"
    ];
    for (const field of liveStringFields) {
      const problem = requiredString(liveMaterial, field);
      if (problem) return diagnostic(problem.outcome, problem.reason);
    }
    for (const [field, accepted, contradiction] of [
      ["lifecycleState", "CURRENT", false],
      ["freshnessState", "CURRENT", false],
      ["contradictionState", "NONE", true]
    ]) {
      const problem = requiredState(liveMaterial, field, accepted, contradiction);
      if (problem) return diagnostic(problem.outcome, problem.reason);
    }
    if (liveMaterial.authority !== AUTHORITY || liveMaterial.authorityEffect !== AUTHORITY_EFFECT) {
      return diagnostic(OUTCOMES.REJECTED, "live source authority mismatch");
    }
    if (liveMaterial.aClassEvidenceRevision !== "1") {
      return diagnostic(OUTCOMES.REJECTED, "unsupported A-class evidence revision");
    }
    for (const field of ["observedPrincipalAuthEpoch", "currentPrincipalAuthEpoch"]) {
      if (!/^[1-9][0-9]*$/.test(liveMaterial[field])) {
        return diagnostic(OUTCOMES.INVALID, `${field} must be a positive-decimal string`);
      }
    }
    if (liveMaterial.observedPrincipalRevision !== `principalAuthEpoch:${liveMaterial.observedPrincipalAuthEpoch}`
      || liveMaterial.currentPrincipalRevision !== `principalAuthEpoch:${liveMaterial.currentPrincipalAuthEpoch}`) {
      return diagnostic(OUTCOMES.CONTRADICTED, "principal auth epoch revision relation invalid");
    }
    if (liveMaterial.observedPrincipalAuthEpoch !== liveMaterial.currentPrincipalAuthEpoch) {
      return diagnostic(OUTCOMES.REJECTED, "principalAuthEpoch mismatch");
    }

    let bindingView;
    try {
      bindingView = createSnapshotBoundReadOnlyPrincipalBindingView(snapshot, principalBinding);
    } catch (_error) {
      return diagnostic(OUTCOMES.UNKNOWN, "snapshot-bound durable binding view unavailable");
    }
    const subject = { agencyId: currentAccountRecord.agencyId, applicationUserId: currentAccountRecord.id };
    const subjectEnvelopes = snapshotView[principalBinding.COLLECTION]
      .filter((entry) => plain(entry)
        && entry.evidenceType === principalBinding.EVIDENCE_TYPE
        && plain(entry.record)
        && entry.record.agencyId === subject.agencyId
        && entry.record.applicationUserId === subject.applicationUserId);
    if (subjectEnvelopes.length === 0) {
      return diagnostic(OUTCOMES.UNKNOWN, "current durable principal binding unavailable");
    }
    const currentSubjectEnvelopes = subjectEnvelopes.filter((entry) => entry.record.bindingLifecycleState === "CURRENT");
    if (currentSubjectEnvelopes.length > 1) {
      return diagnostic(OUTCOMES.CONTRADICTED, "multiple current principal bindings for account subject");
    }
    const rawRecord = (currentSubjectEnvelopes[0] || subjectEnvelopes[0]).record;
    const rawBindingStringFields = [
      "agencyId", "applicationUserId", "principalRef", "principalRevision", "principalBindingEvidenceRef",
      "bindingLifecycleState", "bindingFreshnessState", "contradictionState", "authority", "authorityEffect"
    ];
    for (const field of rawBindingStringFields) {
      const problem = requiredString(rawRecord, field);
      if (problem) return diagnostic(problem.outcome, problem.reason);
    }
    for (const [field, accepted, contradiction] of [
      ["bindingLifecycleState", "CURRENT", false],
      ["bindingFreshnessState", "CURRENT", false],
      ["contradictionState", "NONE", true]
    ]) {
      const problem = requiredState(rawRecord, field, accepted, contradiction);
      if (problem) return diagnostic(problem.outcome, problem.reason);
    }
    let found;
    try {
      found = bindingView.findCurrentBySubject(subject);
    } catch (_error) {
      return diagnostic(OUTCOMES.INVALID, "snapshot-bound durable binding lookup failed closed");
    }
    if (!plain(found) || found.outcome !== OUTCOMES.ACCEPTED) {
      const classified = classifyForeign(found, "current durable principal binding unavailable");
      return diagnostic(classified.outcome, classified.reason);
    }
    if (!plain(found.record)) return diagnostic(OUTCOMES.UNKNOWN, "durable principal binding record unavailable");

    const bindingStringFields = [
      "agencyId", "applicationUserId", "principalRef", "principalRevision", "principalBindingEvidenceRef",
      "bindingLifecycleState", "bindingFreshnessState", "contradictionState", "authority", "authorityEffect"
    ];
    for (const field of bindingStringFields) {
      const problem = requiredString(found.record, field);
      if (problem) return diagnostic(problem.outcome, problem.reason);
    }
    for (const [field, accepted, contradiction] of [
      ["bindingLifecycleState", "CURRENT", false],
      ["bindingFreshnessState", "CURRENT", false],
      ["contradictionState", "NONE", true]
    ]) {
      const problem = requiredState(found.record, field, accepted, contradiction);
      if (problem) return diagnostic(problem.outcome, problem.reason);
    }

    let fetched;
    try {
      fetched = bindingView.get(found.record.principalBindingEvidenceRef);
    } catch (_error) {
      return diagnostic(OUTCOMES.INVALID, "snapshot-bound durable binding read failed closed");
    }
    if (!plain(fetched) || fetched.outcome !== OUTCOMES.ACCEPTED) {
      const classified = classifyForeign(fetched, "durable binding envelope unavailable");
      return diagnostic(classified.outcome, classified.reason);
    }
    let envelopeValidation;
    try {
      envelopeValidation = bindingView.validateEnvelope(fetched.envelope);
    } catch (_error) {
      return diagnostic(OUTCOMES.INVALID, "durable binding envelope validation failed closed");
    }
    if (!plain(envelopeValidation) || envelopeValidation.outcome !== OUTCOMES.ACCEPTED) {
      const classified = classifyForeign(envelopeValidation, "durable binding envelope invalid");
      return diagnostic(classified.outcome, classified.reason);
    }
    let recordValidation;
    try {
      recordValidation = bindingView.validateBindingRecord(envelopeValidation.record);
    } catch (_error) {
      return diagnostic(OUTCOMES.INVALID, "durable binding record validation failed closed");
    }
    if (!plain(recordValidation) || recordValidation.outcome !== OUTCOMES.ACCEPTED) {
      const classified = classifyForeign(recordValidation, "durable binding record invalid");
      return diagnostic(classified.outcome, classified.reason);
    }
    const record = recordValidation.record;
    if (record.authority !== AUTHORITY || record.authorityEffect !== AUTHORITY_EFFECT) {
      return diagnostic(OUTCOMES.REJECTED, "durable binding authority mismatch");
    }
    if (record.principalBindingEvidenceRef !== found.record.principalBindingEvidenceRef) {
      return diagnostic(OUTCOMES.CONTRADICTED, "durable binding identity mismatch");
    }
    if (record.agencyId !== currentAccountRecord.agencyId
      || record.applicationUserId !== currentAccountRecord.id
      || record.agencyId !== liveMaterial.agencyId
      || record.applicationUserId !== liveMaterial.applicationUserId) {
      return diagnostic(OUTCOMES.CONTRADICTED, "live, account, and binding subjects do not match");
    }
    if (query.principalRef !== record.principalRef) {
      return diagnostic(OUTCOMES.REJECTED, "query principalRef mismatch");
    }
    if (query.principalRevision !== record.principalRevision) {
      return diagnostic(OUTCOMES.REJECTED, "query principalRevision mismatch");
    }

    const provenance = {
      agencyId: record.agencyId,
      applicationUserId: record.applicationUserId,
      principalBindingEvidenceRef: record.principalBindingEvidenceRef,
      authEventSessionBindingRef: liveMaterial.bindingRef,
      authenticationEventIdentity: liveMaterial.authenticationEventIdentity,
      aClassEvidenceIdentity: liveMaterial.aClassEvidenceIdentity,
      aClassEvidenceRevision: liveMaterial.aClassEvidenceRevision,
      sessionRef: liveMaterial.sessionRef,
      sessionVersion: liveMaterial.sessionVersion,
      observedPrincipalAuthEpoch: liveMaterial.observedPrincipalAuthEpoch,
      currentPrincipalAuthEpoch: liveMaterial.currentPrincipalAuthEpoch,
      observedPrincipalRevision: liveMaterial.observedPrincipalRevision,
      currentPrincipalRevision: liveMaterial.currentPrincipalRevision
    };
    const digestMaterial = {
      type: TYPE,
      schemaVersion: SCHEMA_VERSION,
      rulesetVersion: RULESET_VERSION,
      principalRef: record.principalRef,
      principalRevision: record.principalRevision,
      ...provenance,
      bindingLifecycleState: record.bindingLifecycleState,
      bindingFreshnessState: record.bindingFreshnessState,
      bindingContradictionState: record.contradictionState,
      authenticationLifecycleState: liveMaterial.lifecycleState,
      authenticationFreshnessState: liveMaterial.freshnessState,
      authenticationContradictionState: liveMaterial.contradictionState,
      authority: AUTHORITY,
      authorityEffect: AUTHORITY_EFFECT
    };

    let principalEvidenceRef;
    try {
      principalEvidenceRef = principalEvidenceRefFromMaterial(digestMaterial);
    } catch (error) {
      return diagnostic(OUTCOMES.INVALID, error.message);
    }
    const evidence = deepFreeze({
      type: TYPE,
      schemaVersion: SCHEMA_VERSION,
      rulesetVersion: RULESET_VERSION,
      principalRef: record.principalRef,
      principalRevision: record.principalRevision,
      principalEvidenceRef,
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      authority: AUTHORITY,
      authorityEffect: AUTHORITY_EFFECT,
      provenance,
      nonClaims: { ...NON_CLAIMS }
    });
    return diagnostic(OUTCOMES.ACCEPTED, null, evidence);
  }

  function authenticatedPrincipalPort(query) {
    try {
      const result = assess(query);
      return result.outcome === OUTCOMES.ACCEPTED ? result.evidence : null;
    } catch (_error) {
      return null;
    }
  }

  return Object.freeze({
    assess,
    authenticatedPrincipalPort,
    component: COMPONENT,
    rulesetVersion: RULESET_VERSION,
    authority: AUTHORITY,
    authorityEffect: AUTHORITY_EFFECT
  });
}

module.exports = Object.freeze({
  COMPONENT,
  TYPE,
  SCHEMA_VERSION,
  RULESET_VERSION,
  AUTHORITY,
  AUTHORITY_EFFECT,
  PRINCIPAL_EVIDENCE_NAMESPACE,
  OUTCOMES,
  NON_CLAIMS,
  hasUnpairedSurrogate,
  canonicalStringifyExact,
  principalEvidenceRefFromMaterial,
  createAyaAuthenticatedPrincipalAdmission
});
