"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "current-governance-evidence-set-resolution-v0.1.0";
const SCHEMA_VERSION = "1.0";
const OUTCOMES = Object.freeze({
  RESOLVED: "CURRENT_GOVERNANCE_EVIDENCE_SET_RESOLVED",
  UNKNOWN: "CURRENT_GOVERNANCE_EVIDENCE_SET_UNKNOWN",
  CONFLICT: "CURRENT_GOVERNANCE_EVIDENCE_SET_CONFLICT",
  REJECTED: "CURRENT_GOVERNANCE_EVIDENCE_SET_REJECTED"
});

function plain(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function nonEmpty(value) { return typeof value === "string" && value.length > 0; }
function compareCodePoints(left, right) {
  const a = Array.from(String(left)); const b = Array.from(String(right));
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const d = a[i].codePointAt(0) - b[i].codePointAt(0); if (d) return d;
  }
  return a.length - b.length;
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) return Object.keys(value).sort(compareCodePoints).reduce((out, key) => {
    out[key.normalize("NFC")] = canonicalize(value[key]); return out;
  }, {});
  return typeof value === "string" ? value.normalize("NFC") : value;
}
const canonicalStringify = (value) => JSON.stringify(canonicalize(value));
const digestValue = (value) => `sha256:${crypto.createHash("sha256").update(Buffer.from(canonicalStringify(value), "utf8")).digest("hex")}`;
function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; }
function result(outcome, reason, evidenceSet = null) { return deepFreeze({ outcome, reason: reason || null, evidenceSet, authority: "NONE" }); }

function exact(record, fields) {
  return plain(record) && Object.keys(record).length === fields.length && Object.keys(record).every((key) => fields.includes(key));
}
function validLifecycle(record, identityField) {
  return exact(record, [identityField, "state", "lifecycleRevision", "contradictionState", "evidenceRef"])
    && nonEmpty(record[identityField]) && ["CURRENT","STALE","REVOKED","DEACTIVATED","SUPERSEDED","UNKNOWN","CONFLICT"].includes(record.state)
    && nonEmpty(record.lifecycleRevision) && ["NONE","CONFLICT"].includes(record.contradictionState) && nonEmpty(record.evidenceRef);
}
function normalizeCoverage(coverage) {
  return [...coverage].map((item) => canonicalize(item)).sort((a,b) => compareCodePoints(`${a.kind}:${a.ref}`, `${b.kind}:${b.ref}`));
}
function validCoverage(coverage) {
  if (!Array.isArray(coverage) || coverage.length === 0) return false;
  const keys = new Set();
  for (const item of coverage) {
    if (!exact(item,["kind","ref","completeThroughRevision","evidenceRef"]) || !["POLICY","ASSIGNMENT","DELEGATION"].includes(item.kind)
      || !nonEmpty(item.ref) || !nonEmpty(item.completeThroughRevision) || !nonEmpty(item.evidenceRef)) return false;
    const key = `${item.kind}\u0000${item.ref}`; if (keys.has(key)) return false; keys.add(key);
  }
  return true;
}
function indexLifecycle(items, identityField) {
  const out = new Map();
  for (const item of items) {
    if (!validLifecycle(item, identityField)) return null;
    if (out.has(item[identityField])) return null;
    out.set(item[identityField], canonicalize(item));
  }
  return out;
}
function acceptedIdentity(record, kind) {
  if (!plain(record) || record.authority !== "NONE") return null;
  if (kind === "POLICY") {
    return record.type === "GOVERNANCE_ROLE_POLICY_REQUIREMENT_EVIDENCE_ACCEPTANCE" && nonEmpty(record.policyAcceptanceId)
      ? { id: record.policyAcceptanceId, ref: record.policyRef, revision: record.policyRevision, sort: `P:${record.policyRef}:${record.policyRevision}:${record.policyAcceptanceId}` } : null;
  }
  if (kind === "ASSIGNMENT") {
    return record.type === "DIRECT_PRINCIPAL_ROLE_ASSIGNMENT_EVIDENCE_ACCEPTANCE" && nonEmpty(record.assignmentAcceptanceId)
      ? { id: record.assignmentAcceptanceId, ref: record.assignmentRef, revision: record.assignmentRevision, sort: `A:${record.assignmentRef}:${record.assignmentRevision}:${record.assignmentAcceptanceId}` } : null;
  }
  return record.type === "DIRECT_DELEGATION_EVIDENCE_ACCEPTANCE" && nonEmpty(record.delegationAcceptanceId)
    ? { id: record.delegationAcceptanceId, ref: record.delegationRef, revision: record.delegationRevision, sort: `D:${record.delegationRef}:${record.delegationRevision}:${record.delegationAcceptanceId}` } : null;
}
function resolveKind(kind, accepted, lifecycleIndex, coverageIndex) {
  const current = [];
  for (const record of accepted) {
    const id = acceptedIdentity(record, kind);
    if (!id || !nonEmpty(id.ref) || !nonEmpty(id.revision)) return { error: OUTCOMES.REJECTED, reason: `invalid accepted ${kind.toLowerCase()} evidence` };
    const coverage = coverageIndex.get(`${kind}\u0000${id.ref}`);
    if (!coverage) return { error: OUTCOMES.UNKNOWN, reason: `${kind.toLowerCase()} coverage incomplete or absent` };
    const lifecycle = lifecycleIndex.get(id.id);
    if (!lifecycle) return { error: OUTCOMES.UNKNOWN, reason: `${kind.toLowerCase()} lifecycle evidence absent` };
    if (lifecycle.contradictionState === "CONFLICT" || lifecycle.state === "CONFLICT") return { error: OUTCOMES.CONFLICT, reason: `${kind.toLowerCase()} lifecycle evidence conflicts` };
    if (lifecycle.state === "UNKNOWN") return { error: OUTCOMES.UNKNOWN, reason: `${kind.toLowerCase()} lifecycle state unknown` };
    if (lifecycle.state === "CURRENT") current.push({ identity: id, record: canonicalize(record), lifecycle, coverage });
  }
  const byRef = new Map();
  for (const item of current) {
    if (byRef.has(item.identity.ref)) return { error: OUTCOMES.CONFLICT, reason: `multiple current ${kind.toLowerCase()} records for same ref` };
    byRef.set(item.identity.ref, item);
  }
  for (const item of byRef.values()) {
    if (item.coverage.completeThroughRevision !== item.identity.revision) {
      return { error: OUTCOMES.UNKNOWN, reason: `${kind.toLowerCase()} coverage revision is not bound to current accepted revision` };
    }
  }
  return { current: [...byRef.values()].map(({ coverage, ...item }) => item)
    .sort((a,b) => compareCodePoints(a.identity.sort, b.identity.sort)) };
}

function resolveCurrentGovernanceEvidenceSet(request) {
  const fields = ["rulesetVersion","resolutionFrameRevision","acceptedPolicies","acceptedAssignments","acceptedDelegations","policyLifecycle","assignmentLifecycle","delegationLifecycle","coverage"];
  if (!exact(request, fields) || request.rulesetVersion !== RULESET_VERSION || !nonEmpty(request.resolutionFrameRevision)
    || !Array.isArray(request.acceptedPolicies) || !Array.isArray(request.acceptedAssignments) || !Array.isArray(request.acceptedDelegations)
    || !Array.isArray(request.policyLifecycle) || !Array.isArray(request.assignmentLifecycle) || !Array.isArray(request.delegationLifecycle)
    || !validCoverage(request.coverage)) return result(OUTCOMES.REJECTED, "unsupported or invalid resolution request");

  const policyLifecycle = indexLifecycle(request.policyLifecycle, "policyAcceptanceId");
  const assignmentLifecycle = indexLifecycle(request.assignmentLifecycle, "assignmentAcceptanceId");
  const delegationLifecycle = indexLifecycle(request.delegationLifecycle, "delegationAcceptanceId");
  if (!policyLifecycle || !assignmentLifecycle || !delegationLifecycle) return result(OUTCOMES.REJECTED, "invalid or duplicate lifecycle evidence");

  const coverage = normalizeCoverage(request.coverage);
  const coverageIndex = new Map(coverage.map((item) => [`${item.kind}\u0000${item.ref}`, item]));
  const policy = resolveKind("POLICY", request.acceptedPolicies, policyLifecycle, coverageIndex); if (policy.error) return result(policy.error, policy.reason);
  const assignment = resolveKind("ASSIGNMENT", request.acceptedAssignments, assignmentLifecycle, coverageIndex); if (assignment.error) return result(assignment.error, assignment.reason);
  const delegation = resolveKind("DELEGATION", request.acceptedDelegations, delegationLifecycle, coverageIndex); if (delegation.error) return result(delegation.error, delegation.reason);

  const material = canonicalize({
    type: "CURRENT_GOVERNANCE_EVIDENCE_SET",
    schemaVersion: SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    resolutionFrameRevision: request.resolutionFrameRevision,
    policies: policy.current,
    assignments: assignment.current,
    delegations: delegation.current,
    coverage
  });
  const resolutionDigest = digestValue(material);
  const evidenceSet = deepFreeze({
    resolutionId: `current-governance:${resolutionDigest.slice(7)}`,
    resolutionDigest,
    ...material,
    authority: "NONE"
  });
  return result(OUTCOMES.RESOLVED, null, evidenceSet);
}

module.exports = Object.freeze({ RULESET_VERSION, OUTCOMES, resolveCurrentGovernanceEvidenceSet, canonicalStringify, digestValue });
