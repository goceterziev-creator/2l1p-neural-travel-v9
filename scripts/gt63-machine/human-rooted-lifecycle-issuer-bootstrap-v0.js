"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "human-rooted-lifecycle-issuer-bootstrap-v0.1.0";
const AUTHORITY = "NONE";
const DECISION = "ACCEPT_LIFECYCLE_ISSUER_SCOPE_POLICY";
const SOURCE_STATUS = "UNCONFIGURED_FAIL_CLOSED";
const SOURCE_ISSUER_SET = "CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY";
const SUBJECT_KINDS = Object.freeze(["POLICY", "ASSIGNMENT", "DELEGATION"]);
const OUTCOMES = Object.freeze({
  ACCEPTED: "LIFECYCLE_ISSUER_SCOPE_POLICY_ACCEPTED",
  ALREADY_ACCEPTED: "LIFECYCLE_ISSUER_SCOPE_POLICY_ALREADY_ACCEPTED",
  UNKNOWN: "LIFECYCLE_ISSUER_SCOPE_POLICY_UNKNOWN",
  REJECTED: "LIFECYCLE_ISSUER_SCOPE_POLICY_REJECTED",
  CONFLICT: "LIFECYCLE_ISSUER_SCOPE_POLICY_CONFLICT"
});

function plain(v) { return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function nonEmpty(v) { return typeof v === "string" && v.length > 0; }
function exact(v, fields) {
  return plain(v) && Object.keys(v).length === fields.length
    && Object.keys(v).every((k) => fields.includes(k));
}
function compareCodePoints(a, b) {
  const x = Array.from(String(a)), y = Array.from(String(b));
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    const d = x[i].codePointAt(0) - y[i].codePointAt(0);
    if (d) return d;
  }
  return x.length - y.length;
}
function canonicalize(v) {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (plain(v)) return Object.keys(v).sort(compareCodePoints).reduce((o, raw) => {
    const k = raw.normalize("NFC");
    if (Object.prototype.hasOwnProperty.call(o, k)) throw new TypeError("canonical key conflict");
    o[k] = canonicalize(v[raw]); return o;
  }, {});
  return typeof v === "string" ? v.normalize("NFC") : v;
}
const canonicalStringify = (v) => JSON.stringify(canonicalize(v));
const digestValue = (v) => `sha256:${crypto.createHash("sha256").update(Buffer.from(canonicalStringify(v), "utf8")).digest("hex")}`;
const clone = (v) => v === null || v === undefined ? v : JSON.parse(JSON.stringify(v));
function deepFreeze(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v); Object.values(v).forEach(deepFreeze);
  }
  return v;
}
function call(port, arg) {
  try { return { ok: true, value: port(deepFreeze(clone(arg))) }; }
  catch (_) { return { ok: false, value: null }; }
}
function result(outcome, reason, evidence = null) {
  return deepFreeze({ outcome, reason: reason || null, evidence: clone(evidence), authority: AUTHORITY });
}
function same(a, b) { return canonicalStringify(a) === canonicalStringify(b); }

function validVerifiedSource(v) {
  return plain(v)
    && v.type === "REGISTERED_GOVERNANCE_SOURCE_VERIFICATION"
    && v.status === "VERIFIED"
    && nonEmpty(v.sourceVerificationId)
    && nonEmpty(v.rootVerificationId)
    && nonEmpty(v.registeredSourceRef)
    && nonEmpty(v.sourceBlobSha)
    && nonEmpty(v.sourceBlobSha256)
    && Number.isInteger(v.sourcePolicyRevision) && v.sourcePolicyRevision > 0
    && v.sourceStatus === SOURCE_STATUS
    && v.issuerSetSemantics === SOURCE_ISSUER_SET
    && Array.isArray(v.permittedIssuerRefs) && v.permittedIssuerRefs.length === 0
    && Array.isArray(v.subjectKinds)
    && canonicalStringify(v.subjectKinds) === canonicalStringify(SUBJECT_KINDS)
    && v.authority === AUTHORITY;
}
function validPrincipal(v) {
  return exact(v, ["principalRef","principalRevision","principalEvidenceRef",
    "lifecycleState","freshnessState","contradictionState","authority"])
    && ["principalRef","principalRevision","principalEvidenceRef"].every((k) => nonEmpty(v[k]))
    && v.lifecycleState === "CURRENT" && v.freshnessState === "CURRENT"
    && v.contradictionState === "NONE" && v.authority === AUTHORITY;
}
function validDecision(v) {
  return exact(v, ["bootstrapDecisionEvidenceRef","decision","principalRef","principalRevision",
    "sourceVerificationId","sourcePolicyRevision","sourceBlobSha256","lifecycleState",
    "freshnessState","contradictionState","authority"])
    && ["bootstrapDecisionEvidenceRef","principalRef","principalRevision","sourceVerificationId",
      "sourceBlobSha256"].every((k) => nonEmpty(v[k]))
    && v.decision === DECISION
    && Number.isInteger(v.sourcePolicyRevision) && v.sourcePolicyRevision > 0
    && /^sha256:[0-9a-f]{64}$/.test(v.sourceBlobSha256)
    && v.lifecycleState === "CURRENT" && v.freshnessState === "CURRENT"
    && v.contradictionState === "NONE" && v.authority === AUTHORITY;
}

function createHumanRootedLifecycleIssuerBootstrap({
  verifiedSourcePort, authenticatedHumanPrincipalPort, bootstrapDecisionPort, acceptanceLedger
}) {
  for (const [name, port] of Object.entries({
    verifiedSourcePort, authenticatedHumanPrincipalPort, bootstrapDecisionPort
  })) if (typeof port !== "function") throw new TypeError(`${name} must be a function`);
  for (const name of ["get","commit"]) {
    if (!acceptanceLedger || typeof acceptanceLedger[name] !== "function") {
      throw new TypeError(`acceptanceLedger.${name} must be a function`);
    }
  }

  function accept(request) {
    const fields = ["rulesetVersion","principalRef","principalRevision","sourceVerificationId",
      "sourcePolicyRevision","bootstrapDecisionEvidenceRef"];
    if (!exact(request, fields)
      || request.rulesetVersion !== RULESET_VERSION
      || !["principalRef","principalRevision","sourceVerificationId","bootstrapDecisionEvidenceRef"]
        .every((k) => nonEmpty(request[k]))
      || !Number.isInteger(request.sourcePolicyRevision) || request.sourcePolicyRevision < 1) {
      return result(OUTCOMES.REJECTED, "unsupported request schema or ruleset");
    }

    const sourceResult = call(verifiedSourcePort, { sourceVerificationId: request.sourceVerificationId });
    if (!sourceResult.ok) return result(OUTCOMES.UNKNOWN, "verified frozen source unavailable");
    const source = sourceResult.value;
    if (!validVerifiedSource(source)
      || source.sourceVerificationId !== request.sourceVerificationId
      || source.sourcePolicyRevision !== request.sourcePolicyRevision) {
      return result(OUTCOMES.UNKNOWN, "verified frozen source invalid, stale, or unbound");
    }

    const principalResult = call(authenticatedHumanPrincipalPort, {
      principalRef: request.principalRef, principalRevision: request.principalRevision
    });
    if (!principalResult.ok) return result(OUTCOMES.UNKNOWN, "authenticated human principal unavailable");
    const principal = principalResult.value;
    if (!validPrincipal(principal)) return result(OUTCOMES.UNKNOWN, "authenticated human principal is not current");
    if (principal.principalRef !== request.principalRef
      || principal.principalRevision !== request.principalRevision) {
      return result(OUTCOMES.REJECTED, "authenticated human principal mismatch");
    }

    const decisionResult = call(bootstrapDecisionPort, {
      bootstrapDecisionEvidenceRef: request.bootstrapDecisionEvidenceRef
    });
    if (!decisionResult.ok) return result(OUTCOMES.UNKNOWN, "human bootstrap decision unavailable");
    const decision = decisionResult.value;
    if (!validDecision(decision)) return result(OUTCOMES.UNKNOWN, "human bootstrap decision invalid or non-current");
    if (decision.bootstrapDecisionEvidenceRef !== request.bootstrapDecisionEvidenceRef
      || decision.principalRef !== principal.principalRef
      || decision.principalRevision !== principal.principalRevision
      || decision.sourceVerificationId !== source.sourceVerificationId
      || decision.sourcePolicyRevision !== source.sourcePolicyRevision
      || decision.sourceBlobSha256 !== source.sourceBlobSha256) {
      return result(OUTCOMES.REJECTED, "human bootstrap decision is not bound to exact principal and source");
    }

    const material = {
      type: "GT63_ACCEPTED_LIFECYCLE_ISSUER_SCOPE_POLICY",
      schemaVersion: "1.0",
      rulesetVersion: RULESET_VERSION,
      sourceVerificationId: source.sourceVerificationId,
      rootVerificationId: source.rootVerificationId,
      registeredSourceRef: source.registeredSourceRef,
      sourcePolicyRevision: source.sourcePolicyRevision,
      sourceBlobSha: source.sourceBlobSha,
      sourceBlobSha256: source.sourceBlobSha256,
      bootstrapHumanPrincipalRef: principal.principalRef,
      bootstrapHumanPrincipalRevision: principal.principalRevision,
      issuerSetSemantics: "CLOSED_WORLD_EXACT_ONE_HUMAN_V0",
      permittedIssuers: [
        { evidenceClass: "POLICY", issuerRef: principal.principalRef, issuerRevision: principal.principalRevision },
        { evidenceClass: "ASSIGNMENT", issuerRef: principal.principalRef, issuerRevision: principal.principalRevision }
      ],
      delegationBootstrapIssuable: false,
      delegationSemantics: "ASSIGNMENT_BOUND_EXISTING_CONTRACT",
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      evidenceRefs: [source.sourceVerificationId, principal.principalEvidenceRef,
        decision.bootstrapDecisionEvidenceRef].sort(compareCodePoints),
      authority: AUTHORITY,
      roleAssigned: false,
      principalEligible: false,
      humanGateSatisfied: false,
      continuationAuthorityCreated: false,
      executionAuthorityCreated: false,
      effectAuthorized: false
    };
    const acceptanceId = `gt63-lifecycle-issuer-scope-policy:${digestValue(material).slice(7)}`;
    const acceptance = deepFreeze({ acceptanceId, ...material });

    let prior;
    try { prior = acceptanceLedger.get(acceptanceId); }
    catch (_) { return result(OUTCOMES.UNKNOWN, "acceptance ledger unavailable"); }
    if (prior !== null && prior !== undefined) {
      return same(prior, acceptance)
        ? result(OUTCOMES.ALREADY_ACCEPTED, "same bootstrap acceptance already recorded", prior)
        : result(OUTCOMES.CONFLICT, "bootstrap acceptance identity conflict");
    }
    try {
      const committed = acceptanceLedger.commit(acceptanceId, acceptance);
      if (!committed || !same(committed, acceptance)) {
        return result(OUTCOMES.CONFLICT, "acceptance ledger returned conflicting material");
      }
      return result(OUTCOMES.ACCEPTED, null, committed);
    } catch (_) {
      return result(OUTCOMES.CONFLICT, "acceptance ledger commit conflict");
    }
  }

  return Object.freeze({ accept, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
}

function createIssuerSourceRegistryAdapter({ acceptedPolicyPort }) {
  if (typeof acceptedPolicyPort !== "function") throw new TypeError("acceptedPolicyPort must be a function");

  function resolve({ evidenceClass, sourceRef, sourceRevision }) {
    if (!["POLICY","ASSIGNMENT"].includes(evidenceClass)
      || !nonEmpty(sourceRef) || !nonEmpty(sourceRevision)) return null;
    const r = call(acceptedPolicyPort, {});
    if (!r.ok) return null;
    const p = r.value;
    if (!plain(p) || p.type !== "GT63_ACCEPTED_LIFECYCLE_ISSUER_SCOPE_POLICY"
      || p.lifecycleState !== "CURRENT" || p.freshnessState !== "CURRENT"
      || p.contradictionState !== "NONE" || p.authority !== AUTHORITY
      || p.delegationBootstrapIssuable !== false) return null;
    const issuer = Array.isArray(p.permittedIssuers)
      && p.permittedIssuers.find((x) => x.evidenceClass === evidenceClass);
    if (!issuer || issuer.issuerRef !== sourceRef || issuer.issuerRevision !== sourceRevision) return null;
    return deepFreeze({
      sourceRef, sourceRevision, trustState: "TRUSTED",
      registryEvidenceRef: p.acceptanceId
    });
  }

  return Object.freeze({
    policySourceRegistryPort(query) {
      return resolve({ evidenceClass: "POLICY", sourceRef: query.sourceRef, sourceRevision: query.sourceRevision });
    },
    assignmentSourceRegistryPort(query) {
      return resolve({ evidenceClass: "ASSIGNMENT", sourceRef: query.sourceRef, sourceRevision: query.sourceRevision });
    },
    authority: AUTHORITY
  });
}

function createMemoryLedger() {
  const m = new Map();
  return Object.freeze({
    get(k) { return m.has(k) ? m.get(k) : null; },
    commit(k, v) {
      if (m.has(k)) throw new Error("immutable-ledger-conflict");
      m.set(k, deepFreeze(clone(v))); return m.get(k);
    }
  });
}

module.exports = Object.freeze({
  RULESET_VERSION, AUTHORITY, DECISION, OUTCOMES,
  canonicalStringify, createHumanRootedLifecycleIssuerBootstrap,
  createIssuerSourceRegistryAdapter, createMemoryLedger
});
