"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "repository-frozen-governance-trust-root-v1.0.0";
const SCHEMA_VERSION = "1.0";
const REPOSITORY_IDENTITY = "goceterziev-creator/2l1p-neural-travel-v9";
const AUTHORITATIVE_REF = "refs/heads/main";
const ROOT_PATH = "config/gt63-machine/governance-trust-root-v0.json";
const ROOT_TYPE = "REPOSITORY_FROZEN_GOVERNANCE_TRUST_ROOT";
const ROOT_MATERIAL_TYPE = "REPOSITORY_BLOB_SOURCE_REGISTRATION";
const ROOT_SET_SEMANTICS = "CLOSED_WORLD_EXACT_ONE";
const ROOT_ANCHOR_REF = "gt63-machine:governance-trust-root:lifecycle-issuer-scope-policy";
const STATEMENT_CLASS = "GOVERNANCE_LIFECYCLE_ISSUER_SCOPE_POLICY";
const GOVERNANCE_NAMESPACE = "GT63_MACHINE_GOVERNANCE";
const ISSUER_POLICY_NAMESPACE = "GT63_MACHINE_GOVERNANCE_LIFECYCLE_ISSUER_SCOPE";
const REGISTERED_SOURCE_REF = "gt63-machine:repository-source:governance-lifecycle-issuer-scope-policy";
const REGISTERED_SOURCE_PATH = "config/gt63-machine/governance-lifecycle-issuer-scope-policy-v0.json";
const VERIFICATION_METHOD = "AUTHORITATIVE_GIT_BLOB_MEMBERSHIP_V1";
const RUNTIME_ROOT_REVOCATION = "UNSUPPORTED_V0";

const OUTCOMES = Object.freeze({
  VERIFIED: "ROOT_CONFIGURATION_VERIFIED",
  NOT_REGISTERED: "ROOT_SOURCE_NOT_REGISTERED",
  INVALID: "ROOT_CONFIGURATION_INVALID",
  STALE: "ROOT_CONFIGURATION_STALE",
  UNCERTAIN: "ROOT_CONFIGURATION_UNCERTAIN",
  CONFLICT: "ROOT_CONFIGURATION_CONFLICT"
});

const MANIFEST_FIELDS = Object.freeze([
  "authority", "authoritativeRef", "governanceNamespace", "issuerPolicyNamespace",
  "registeredSourcePath", "registeredSourceRef", "repositoryIdentity", "rootMaterialType",
  "rootSetSemantics", "rootTrustAnchorRef", "rootTrustAnchorRevision", "rulesetVersion",
  "runtimeRootRevocation", "schemaVersion", "statementClass", "supersedesRootAnchorId",
  "type", "verificationMethod"
]);
const REQUEST_FIELDS = Object.freeze(["rulesetVersion", "expectedState", "sourceQuery"]);
const EXPECTED_STATE_FIELDS = Object.freeze([
  "commitSha", "treeSha", "expectedRootAnchorId"
]);
const SOURCE_QUERY_FIELDS = Object.freeze([
  "statementClass", "governanceNamespace", "issuerPolicyNamespace",
  "registeredSourceRef", "registeredSourcePath"
]);

function plain(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exact(value, fields) {
  return plain(value)
    && Object.keys(value).length === fields.length
    && Object.keys(value).every((key) => fields.includes(key));
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

function compareCodePoints(left, right) {
  const a = Array.from(String(left));
  const b = Array.from(String(right));
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const difference = a[index].codePointAt(0) - b[index].codePointAt(0);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) {
    return Object.keys(value).sort(compareCodePoints).reduce((record, rawKey) => {
      const key = rawKey.normalize("NFC");
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        throw new TypeError("canonical key normalization conflict");
      }
      record[key] = canonicalize(value[rawKey]);
      return record;
    }, {});
  }
  return typeof value === "string" ? value.normalize("NFC") : value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function computeGitBlobSha(bytes) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const header = Buffer.from(`blob ${body.length}\0`, "utf8");
  return crypto.createHash("sha1").update(header).update(body).digest("hex");
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

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(nonEmpty).map((value) => value.normalize("NFC"))))
    .sort(compareCodePoints);
}

function result(outcome, reason, verification = null) {
  return deepFreeze({
    outcome,
    reason: reason || null,
    verification: clone(verification),
    authority: "NONE"
  });
}

function call(port, argument) {
  try {
    return { ok: true, value: port(deepFreeze(clone(argument))) };
  } catch (_) {
    return { ok: false, value: null };
  }
}

function isSha1(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function isSha256(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function strictBase64(value) {
  if (!nonEmpty(value) || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return null;
  }
  const bytes = Buffer.from(value, "base64");
  return bytes.toString("base64") === value ? bytes : null;
}

function parseCanonicalManifest(bytes) {
  if (!Buffer.isBuffer(bytes)) return { status: "INVALID", reason: "root bytes are unavailable" };
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    return { status: "INVALID", reason: "root bytes are not valid UTF-8" };
  }
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (_) {
    return { status: "INVALID", reason: "root bytes are malformed JSON" };
  }
  if (!plain(manifest)) return { status: "INVALID", reason: "root manifest must be an object" };
  if ((Array.isArray(manifest.roots) && manifest.roots.length > 1)
    || (Array.isArray(manifest.rootTrustAnchors) && manifest.rootTrustAnchors.length > 1)) {
    return { status: "CONFLICT", reason: "multiple root anchors are prohibited in V0" };
  }
  let canonical;
  try {
    canonical = `${canonicalStringify(manifest)}\n`;
  } catch (_) {
    return { status: "CONFLICT", reason: "root canonicalization conflicts" };
  }
  if (!Buffer.from(canonical, "utf8").equals(bytes)) {
    return { status: "INVALID", reason: "root JSON is not exact canonical UTF-8" };
  }
  return { status: "OK", manifest };
}

function basicManifestIdentity(manifest) {
  if (!plain(manifest) || !nonEmpty(manifest.rootTrustAnchorRef)
    || !Number.isInteger(manifest.rootTrustAnchorRevision)
    || manifest.rootTrustAnchorRevision < 1) return null;
  let materialDigest;
  try { materialDigest = sha256(Buffer.from(canonicalStringify(manifest), "utf8")); }
  catch (_) { return null; }
  return {
    rootTrustAnchorRef: manifest.rootTrustAnchorRef,
    rootTrustAnchorRevision: manifest.rootTrustAnchorRevision,
    statementClass: manifest.statementClass,
    governanceNamespace: manifest.governanceNamespace,
    materialDigest
  };
}

function validateManifest(manifest) {
  if (!exact(manifest, MANIFEST_FIELDS)) {
    return { ok: false, reason: "unsupported root manifest schema" };
  }
  if (manifest.type !== ROOT_TYPE || manifest.schemaVersion !== SCHEMA_VERSION
    || manifest.rulesetVersion !== RULESET_VERSION
    || manifest.rootMaterialType !== ROOT_MATERIAL_TYPE
    || manifest.rootSetSemantics !== ROOT_SET_SEMANTICS
    || manifest.rootTrustAnchorRef !== ROOT_ANCHOR_REF
    || manifest.statementClass !== STATEMENT_CLASS
    || manifest.governanceNamespace !== GOVERNANCE_NAMESPACE
    || manifest.issuerPolicyNamespace !== ISSUER_POLICY_NAMESPACE
    || manifest.registeredSourceRef !== REGISTERED_SOURCE_REF
    || manifest.registeredSourcePath !== REGISTERED_SOURCE_PATH
    || manifest.verificationMethod !== VERIFICATION_METHOD
    || manifest.repositoryIdentity !== REPOSITORY_IDENTITY
    || manifest.authoritativeRef !== AUTHORITATIVE_REF
    || manifest.runtimeRootRevocation !== RUNTIME_ROOT_REVOCATION
    || manifest.authority !== "NONE") {
    return { ok: false, reason: "root material is outside the frozen V0 contract" };
  }
  if (!Number.isInteger(manifest.rootTrustAnchorRevision)
    || manifest.rootTrustAnchorRevision < 1) {
    return { ok: false, reason: "root revision is invalid" };
  }
  if (manifest.rootTrustAnchorRevision === 1 && manifest.supersedesRootAnchorId !== null) {
    return { ok: false, reason: "initial root must not claim supersession" };
  }
  if (manifest.rootTrustAnchorRevision > 1 && !isSha256(manifest.supersedesRootAnchorId)) {
    return { ok: false, reason: "replacement root must bind the exact prior root anchor" };
  }
  return { ok: true, reason: null };
}

function deriveRootMaterial(manifest) {
  const canonicalMaterial = canonicalStringify(manifest);
  const rootMaterialDigest = sha256(Buffer.from(canonicalMaterial, "utf8"));
  return deepFreeze({ canonicalMaterial, rootMaterialDigest, rootAnchorId: rootMaterialDigest });
}

function validRequest(request) {
  if (!exact(request, REQUEST_FIELDS) || request.rulesetVersion !== RULESET_VERSION
    || !exact(request.expectedState, EXPECTED_STATE_FIELDS)
    || !isSha1(request.expectedState.commitSha) || !isSha1(request.expectedState.treeSha)
    || !(request.expectedState.expectedRootAnchorId === null
      || isSha256(request.expectedState.expectedRootAnchorId))
    || !exact(request.sourceQuery, SOURCE_QUERY_FIELDS)
    || !SOURCE_QUERY_FIELDS.every((field) => nonEmpty(request.sourceQuery[field]))) return false;
  return true;
}

function validRefSnapshot(snapshot) {
  return exact(snapshot, ["repositoryIdentity", "authoritativeRef", "commitSha", "evidenceRef"])
    && snapshot.repositoryIdentity === REPOSITORY_IDENTITY
    && snapshot.authoritativeRef === AUTHORITATIVE_REF
    && isSha1(snapshot.commitSha) && nonEmpty(snapshot.evidenceRef);
}

function validCommitSnapshot(snapshot, commitSha) {
  return exact(snapshot, ["commitSha", "treeSha", "evidenceRef"])
    && snapshot.commitSha === commitSha && isSha1(snapshot.treeSha)
    && nonEmpty(snapshot.evidenceRef);
}

function validTreeEntry(entry, treeSha) {
  return exact(entry, ["treeSha", "path", "mode", "objectType", "blobSha", "evidenceRef"])
    && entry.treeSha === treeSha && entry.path === ROOT_PATH && entry.mode === "100644"
    && entry.objectType === "blob" && isSha1(entry.blobSha) && nonEmpty(entry.evidenceRef);
}

function validBlobSnapshot(snapshot, blobSha) {
  return exact(snapshot, ["blobSha", "bytesBase64", "evidenceRef"])
    && snapshot.blobSha === blobSha && nonEmpty(snapshot.bytesBase64)
    && nonEmpty(snapshot.evidenceRef);
}

function historyEntryShape(entry) {
  return exact(entry, ["commitSha", "treeSha", "blobSha", "evidenceRef"])
    && isSha1(entry.commitSha) && isSha1(entry.treeSha) && isSha1(entry.blobSha)
    && nonEmpty(entry.evidenceRef);
}

function createRepositoryFrozenGovernanceTrustRootVerifier(options) {
  if (!exact(options, ["gitObjectPort"])) {
    throw new TypeError("exact gitObjectPort configuration is required");
  }
  const port = options.gitObjectPort;
  for (const method of ["resolveRef", "readCommit", "readTreeEntry", "readBlob", "listPathHistory"]) {
    if (!port || typeof port[method] !== "function") {
      throw new TypeError(`gitObjectPort.${method} must be a function`);
    }
  }

  function verify(request = {}) {
    if (!validRequest(request)) {
      return result(OUTCOMES.INVALID, "unsupported verification request or ruleset");
    }

    const refResult = call(port.resolveRef.bind(port), {
      repositoryIdentity: REPOSITORY_IDENTITY,
      authoritativeRef: AUTHORITATIVE_REF
    });
    if (!refResult.ok) return result(OUTCOMES.UNCERTAIN, "authoritative ref is unavailable");
    if (!validRefSnapshot(refResult.value)) {
      return result(OUTCOMES.INVALID, "authoritative ref evidence is invalid or cross-repository");
    }
    const refSnapshot = refResult.value;

    const commitResult = call(port.readCommit.bind(port), {
      repositoryIdentity: REPOSITORY_IDENTITY,
      commitSha: refSnapshot.commitSha
    });
    if (!commitResult.ok) return result(OUTCOMES.UNCERTAIN, "authoritative commit is unavailable");
    if (!validCommitSnapshot(commitResult.value, refSnapshot.commitSha)) {
      return result(OUTCOMES.INVALID, "authoritative commit evidence is invalid");
    }
    const commitSnapshot = commitResult.value;
    if (request.expectedState.commitSha !== refSnapshot.commitSha
      || request.expectedState.treeSha !== commitSnapshot.treeSha) {
      return result(OUTCOMES.STALE, "expected authoritative commit or tree is stale");
    }

    const treeResult = call(port.readTreeEntry.bind(port), {
      repositoryIdentity: REPOSITORY_IDENTITY,
      treeSha: commitSnapshot.treeSha,
      path: ROOT_PATH
    });
    if (!treeResult.ok) return result(OUTCOMES.UNCERTAIN, "authoritative tree is unavailable");
    if (treeResult.value === null) {
      return result(OUTCOMES.INVALID, "frozen root path is absent from the authoritative tree");
    }
    if (!validTreeEntry(treeResult.value, commitSnapshot.treeSha)) {
      return result(OUTCOMES.INVALID, "root tree entry is invalid or cross-path");
    }
    const treeEntry = treeResult.value;

    const blobResult = call(port.readBlob.bind(port), {
      repositoryIdentity: REPOSITORY_IDENTITY,
      blobSha: treeEntry.blobSha
    });
    if (!blobResult.ok) return result(OUTCOMES.UNCERTAIN, "root blob is unavailable");
    if (!validBlobSnapshot(blobResult.value, treeEntry.blobSha)) {
      return result(OUTCOMES.INVALID, "root blob evidence is invalid");
    }
    const rootBytes = strictBase64(blobResult.value.bytesBase64);
    if (!rootBytes || computeGitBlobSha(rootBytes) !== treeEntry.blobSha) {
      return result(OUTCOMES.INVALID, "root blob identity does not match exact bytes");
    }

    const parsed = parseCanonicalManifest(rootBytes);
    if (parsed.status === "CONFLICT") return result(OUTCOMES.CONFLICT, parsed.reason);
    if (parsed.status !== "OK") return result(OUTCOMES.INVALID, parsed.reason);
    const manifestValidation = validateManifest(parsed.manifest);
    if (!manifestValidation.ok) return result(OUTCOMES.INVALID, manifestValidation.reason);
    const material = deriveRootMaterial(parsed.manifest);

    const historyResult = call(port.listPathHistory.bind(port), {
      repositoryIdentity: REPOSITORY_IDENTITY,
      authoritativeRef: AUTHORITATIVE_REF,
      currentCommitSha: refSnapshot.commitSha,
      path: ROOT_PATH
    });
    if (!historyResult.ok) return result(OUTCOMES.UNCERTAIN, "root history is unavailable");
    if (!exact(historyResult.value, ["entries", "evidenceRef"])
      || !Array.isArray(historyResult.value.entries)
      || !historyResult.value.entries.every(historyEntryShape)
      || !nonEmpty(historyResult.value.evidenceRef)) {
      return result(OUTCOMES.UNCERTAIN, "root history evidence is invalid");
    }

    const historical = [];
    for (const entry of historyResult.value.entries) {
      const priorBlobResult = call(port.readBlob.bind(port), {
        repositoryIdentity: REPOSITORY_IDENTITY,
        blobSha: entry.blobSha
      });
      if (!priorBlobResult.ok) return result(OUTCOMES.UNCERTAIN, "historical root blob is unavailable");
      if (!validBlobSnapshot(priorBlobResult.value, entry.blobSha)) {
        return result(OUTCOMES.UNCERTAIN, "historical root blob evidence is invalid");
      }
      const priorBytes = strictBase64(priorBlobResult.value.bytesBase64);
      if (!priorBytes || computeGitBlobSha(priorBytes) !== entry.blobSha) {
        return result(OUTCOMES.CONFLICT, "historical root blob identity conflicts with bytes");
      }
      const priorParsed = parseCanonicalManifest(priorBytes);
      if (priorParsed.status !== "OK") {
        return result(OUTCOMES.CONFLICT, "historical root material is conflicting or noncanonical");
      }
      const identity = basicManifestIdentity(priorParsed.manifest);
      if (!identity) return result(OUTCOMES.CONFLICT, "historical root identity is invalid");
      historical.push({ ...identity, blobSha: entry.blobSha, commitSha: entry.commitSha });
    }

    for (const prior of historical) {
      const sameRevision = prior.rootTrustAnchorRef === parsed.manifest.rootTrustAnchorRef
        && prior.rootTrustAnchorRevision === parsed.manifest.rootTrustAnchorRevision;
      const competingV0Root = prior.rootTrustAnchorRevision === parsed.manifest.rootTrustAnchorRevision
        && prior.statementClass === parsed.manifest.statementClass
        && prior.governanceNamespace === parsed.manifest.governanceNamespace;
      if ((sameRevision || competingV0Root) && prior.materialDigest !== material.rootMaterialDigest) {
        return result(OUTCOMES.CONFLICT, "root identity or revision is bound to conflicting material");
      }
    }

    if (parsed.manifest.rootTrustAnchorRevision > 1) {
      const expectedPriorRevision = parsed.manifest.rootTrustAnchorRevision - 1;
      const predecessors = historical.filter((item) => item.rootTrustAnchorRef === ROOT_ANCHOR_REF
        && item.rootTrustAnchorRevision === expectedPriorRevision);
      if (predecessors.length !== 1
        || predecessors[0].materialDigest !== parsed.manifest.supersedesRootAnchorId) {
        return result(OUTCOMES.CONFLICT, "root replacement does not bind one exact prior revision");
      }
    }

    if (request.expectedState.expectedRootAnchorId !== null
      && request.expectedState.expectedRootAnchorId !== material.rootAnchorId) {
      return result(OUTCOMES.STALE, "expected root anchor is no longer authoritative");
    }

    const evidenceRefs = uniqueSorted([
      refSnapshot.evidenceRef,
      commitSnapshot.evidenceRef,
      treeEntry.evidenceRef,
      blobResult.value.evidenceRef,
      historyResult.value.evidenceRef,
      ...historyResult.value.entries.map((entry) => entry.evidenceRef)
    ]);
    const historyDigest = sha256(Buffer.from(canonicalStringify(historical), "utf8"));
    const rootBlobSha256 = sha256(rootBytes);
    const verificationMaterial = {
      rootAnchorId: material.rootAnchorId,
      repositoryIdentity: REPOSITORY_IDENTITY,
      authoritativeRef: AUTHORITATIVE_REF,
      commitSha: refSnapshot.commitSha,
      treeSha: commitSnapshot.treeSha,
      rootPath: ROOT_PATH,
      rootBlobSha: treeEntry.blobSha,
      rootBlobSha256,
      rulesetVersion: RULESET_VERSION,
      historyDigest
    };
    const rootVerificationId = sha256(Buffer.from(canonicalStringify(verificationMaterial), "utf8"));
    const verification = deepFreeze({
      type: "REPOSITORY_FROZEN_GOVERNANCE_TRUST_ROOT_VERIFICATION",
      status: "VERIFIED",
      rootVerificationId,
      rootAnchorId: material.rootAnchorId,
      rootTrustAnchorRef: parsed.manifest.rootTrustAnchorRef,
      rootTrustAnchorRevision: parsed.manifest.rootTrustAnchorRevision,
      rootMaterialDigest: material.rootMaterialDigest,
      rootSetSemantics: parsed.manifest.rootSetSemantics,
      statementClass: parsed.manifest.statementClass,
      governanceNamespace: parsed.manifest.governanceNamespace,
      issuerPolicyNamespace: parsed.manifest.issuerPolicyNamespace,
      registeredSourceRef: parsed.manifest.registeredSourceRef,
      registeredSourcePath: parsed.manifest.registeredSourcePath,
      verificationMethod: parsed.manifest.verificationMethod,
      repositoryIdentity: REPOSITORY_IDENTITY,
      authoritativeRef: AUTHORITATIVE_REF,
      commitSha: refSnapshot.commitSha,
      treeSha: commitSnapshot.treeSha,
      rootPath: ROOT_PATH,
      rootBlobSha: treeEntry.blobSha,
      rootBlobSha256,
      historyDigest,
      rulesetVersion: RULESET_VERSION,
      evidenceRefs,
      authority: "NONE"
    });

    const query = request.sourceQuery;
    if (query.statementClass !== parsed.manifest.statementClass
      || query.governanceNamespace !== parsed.manifest.governanceNamespace
      || query.issuerPolicyNamespace !== parsed.manifest.issuerPolicyNamespace
      || query.registeredSourceRef !== parsed.manifest.registeredSourceRef
      || query.registeredSourcePath !== parsed.manifest.registeredSourcePath) {
      return result(OUTCOMES.NOT_REGISTERED,
        "source or statement is outside the closed-world root registration", verification);
    }
    return result(OUTCOMES.VERIFIED, null, verification);
  }

  return Object.freeze({ verify });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  REPOSITORY_IDENTITY,
  AUTHORITATIVE_REF,
  ROOT_PATH,
  ROOT_ANCHOR_REF,
  STATEMENT_CLASS,
  GOVERNANCE_NAMESPACE,
  ISSUER_POLICY_NAMESPACE,
  REGISTERED_SOURCE_REF,
  REGISTERED_SOURCE_PATH,
  OUTCOMES,
  canonicalStringify,
  computeGitBlobSha,
  deriveRootMaterial,
  createRepositoryFrozenGovernanceTrustRootVerifier
});
