"use strict";

const crypto = require("node:crypto");
const rootPrimitive = require("./repository-frozen-governance-trust-root");

const RULESET_VERSION = "repository-frozen-governance-registered-source-verification-v0.1.0";
const SOURCE_TYPE = "GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY";
const SOURCE_STATUS = "UNCONFIGURED_FAIL_CLOSED";
const SOURCE_ISSUER_SET = "CLOSED_WORLD_EXACT_NONE_UNTIL_ACCEPTED_POLICY";
const SOURCE_FIELDS = Object.freeze([
  "authority", "governanceNamespace", "issuerPolicyNamespace", "issuerSetSemantics",
  "permittedIssuerRefs", "policyRevision", "registeredSourceRef", "schemaVersion",
  "statementClass", "status", "subjectKinds", "type"
]);
const OUTCOMES = Object.freeze({
  VERIFIED: "REGISTERED_GOVERNANCE_SOURCE_VERIFIED",
  INVALID: "REGISTERED_GOVERNANCE_SOURCE_INVALID",
  STALE: "REGISTERED_GOVERNANCE_SOURCE_STALE",
  UNCERTAIN: "REGISTERED_GOVERNANCE_SOURCE_UNCERTAIN",
  CONFLICT: "REGISTERED_GOVERNANCE_SOURCE_CONFLICT"
});

function plain(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function nonEmpty(value) { return typeof value === "string" && value.length > 0; }
function exact(value, fields) { return plain(value) && Object.keys(value).length === fields.length && Object.keys(value).every((key) => fields.includes(key)); }
function compareCodePoints(left, right) {
  const a = Array.from(String(left)); const b = Array.from(String(right));
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) { const d = a[i].codePointAt(0) - b[i].codePointAt(0); if (d) return d; }
  return a.length - b.length;
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) return Object.keys(value).sort(compareCodePoints).reduce((out, rawKey) => {
    const key = rawKey.normalize("NFC");
    if (Object.prototype.hasOwnProperty.call(out, key)) throw new TypeError("canonical key normalization conflict");
    out[key] = canonicalize(value[rawKey]); return out;
  }, {});
  return typeof value === "string" ? value.normalize("NFC") : value;
}
const canonicalStringify = (value) => JSON.stringify(canonicalize(value));
const sha256 = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
function computeGitBlobSha(bytes) { const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes); return crypto.createHash("sha1").update(Buffer.from(`blob ${body.length}\0`, "utf8")).update(body).digest("hex"); }
function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; }
function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function result(outcome, reason, verification = null) { return deepFreeze({ outcome, reason: reason || null, verification: clone(verification), authority: "NONE" }); }
function call(port, argument) { try { return { ok: true, value: port(argument) }; } catch (_) { return { ok: false, value: null }; } }
function strictBase64(value) { if (!nonEmpty(value) || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null; const bytes = Buffer.from(value, "base64"); return bytes.toString("base64") === value ? bytes : null; }

function parseSource(bytes) {
  if (!Buffer.isBuffer(bytes)) return { ok: false, reason: "registered source bytes unavailable" };
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) return { ok: false, reason: "registered source is not valid UTF-8" };
  let source;
  try { source = JSON.parse(text); } catch (_) { return { ok: false, reason: "registered source is malformed JSON" }; }
  if (!plain(source)) return { ok: false, reason: "registered source must be an object" };
  let canonical;
  try { canonical = `${canonicalStringify(source)}\n`; } catch (_) { return { ok: false, reason: "registered source canonicalization conflicts" }; }
  if (!Buffer.from(canonical, "utf8").equals(bytes)) return { ok: false, reason: "registered source is not exact canonical UTF-8" };
  if (!exact(source, SOURCE_FIELDS)
    || source.type !== SOURCE_TYPE || source.schemaVersion !== "1.0"
    || source.statementClass !== rootPrimitive.STATEMENT_CLASS
    || source.governanceNamespace !== rootPrimitive.GOVERNANCE_NAMESPACE
    || source.issuerPolicyNamespace !== rootPrimitive.ISSUER_POLICY_NAMESPACE
    || source.registeredSourceRef !== rootPrimitive.REGISTERED_SOURCE_REF
    || source.status !== SOURCE_STATUS || source.issuerSetSemantics !== SOURCE_ISSUER_SET
    || source.policyRevision !== 1 || source.authority !== "NONE"
    || !Array.isArray(source.permittedIssuerRefs) || source.permittedIssuerRefs.length !== 0
    || !Array.isArray(source.subjectKinds)
    || canonicalStringify(source.subjectKinds) !== canonicalStringify(["POLICY","ASSIGNMENT","DELEGATION"])) {
    return { ok: false, reason: "registered source is outside fail-closed V0 contract" };
  }
  return { ok: true, source };
}

function createRegisteredGovernanceSourceVerifier({ gitObjectPort }) {
  const rootVerifier = rootPrimitive.createRepositoryFrozenGovernanceTrustRootVerifier({ gitObjectPort });
  if (!gitObjectPort || typeof gitObjectPort.readTreeEntry !== "function" || typeof gitObjectPort.readBlob !== "function") throw new TypeError("gitObjectPort tree/blob reads are required");

  function verify(request) {
    if (!plain(request) || Object.keys(request).length !== 2 || request.rulesetVersion !== RULESET_VERSION || !plain(request.rootRequest)) {
      return result(OUTCOMES.INVALID, "unsupported registered-source verification request");
    }
    const rootResult = rootVerifier.verify(request.rootRequest);
    if (rootResult.outcome !== rootPrimitive.OUTCOMES.VERIFIED || !rootResult.verification) {
      const mapped = rootResult.outcome === rootPrimitive.OUTCOMES.STALE ? OUTCOMES.STALE
        : rootResult.outcome === rootPrimitive.OUTCOMES.CONFLICT ? OUTCOMES.CONFLICT
          : rootResult.outcome === rootPrimitive.OUTCOMES.UNCERTAIN ? OUTCOMES.UNCERTAIN : OUTCOMES.INVALID;
      return result(mapped, `root prerequisite not verified: ${rootResult.reason || rootResult.outcome}`);
    }
    const root = rootResult.verification;
    if (root.registeredSourcePath !== rootPrimitive.REGISTERED_SOURCE_PATH || root.registeredSourceRef !== rootPrimitive.REGISTERED_SOURCE_REF) {
      return result(OUTCOMES.CONFLICT, "verified root registration differs from frozen registered source");
    }
    const treeResult = call(gitObjectPort.readTreeEntry.bind(gitObjectPort), {
      repositoryIdentity: root.repositoryIdentity, treeSha: root.treeSha, path: root.registeredSourcePath
    });
    if (!treeResult.ok) return result(OUTCOMES.UNCERTAIN, "registered source tree lookup unavailable");
    if (treeResult.value === null) return result(OUTCOMES.INVALID, "registered source path absent from authoritative tree");
    const entry = treeResult.value;
    if (!exact(entry, ["treeSha","path","mode","objectType","blobSha","evidenceRef"])
      || entry.treeSha !== root.treeSha || entry.path !== root.registeredSourcePath || entry.mode !== "100644"
      || entry.objectType !== "blob" || !/^[0-9a-f]{40}$/.test(entry.blobSha) || !nonEmpty(entry.evidenceRef)) {
      return result(OUTCOMES.INVALID, "registered source tree entry invalid or cross-path");
    }
    const blobResult = call(gitObjectPort.readBlob.bind(gitObjectPort), {
      repositoryIdentity: root.repositoryIdentity, blobSha: entry.blobSha
    });
    if (!blobResult.ok) return result(OUTCOMES.UNCERTAIN, "registered source blob unavailable");
    const blob = blobResult.value;
    if (!exact(blob, ["blobSha","bytesBase64","evidenceRef"]) || blob.blobSha !== entry.blobSha || !nonEmpty(blob.evidenceRef)) {
      return result(OUTCOMES.INVALID, "registered source blob evidence invalid");
    }
    const bytes = strictBase64(blob.bytesBase64);
    if (!bytes || computeGitBlobSha(bytes) !== entry.blobSha) return result(OUTCOMES.CONFLICT, "registered source blob identity conflicts with exact bytes");
    const parsed = parseSource(bytes);
    if (!parsed.ok) return result(OUTCOMES.INVALID, parsed.reason);
    const sourceBlobSha256 = sha256(bytes);
    const verificationMaterial = {
      rootVerificationId: root.rootVerificationId, repositoryIdentity: root.repositoryIdentity,
      commitSha: root.commitSha, treeSha: root.treeSha, registeredSourceRef: root.registeredSourceRef,
      registeredSourcePath: root.registeredSourcePath, sourceBlobSha: entry.blobSha, sourceBlobSha256,
      sourcePolicyRevision: parsed.source.policyRevision
    };
    const sourceVerificationId = sha256(Buffer.from(canonicalStringify(verificationMaterial), "utf8"));
    return result(OUTCOMES.VERIFIED, null, {
      type: "REGISTERED_GOVERNANCE_SOURCE_VERIFICATION", status: "VERIFIED", sourceVerificationId,
      ...verificationMaterial, sourceStatementClass: parsed.source.statementClass,
      sourceIssuerPolicyNamespace: parsed.source.issuerPolicyNamespace,
      sourceStatus: parsed.source.status, issuerSetSemantics: parsed.source.issuerSetSemantics,
      permittedIssuerRefs: [], subjectKinds: clone(parsed.source.subjectKinds),
      evidenceRefs: [entry.evidenceRef, blob.evidenceRef].sort(compareCodePoints), authority: "NONE"
    });
  }
  return Object.freeze({ verify });
}

module.exports = Object.freeze({ RULESET_VERSION, OUTCOMES, SOURCE_STATUS, SOURCE_ISSUER_SET, canonicalStringify, computeGitBlobSha, createRegisteredGovernanceSourceVerifier });
