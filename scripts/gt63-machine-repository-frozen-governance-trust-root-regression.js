"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const primitivePath = path.join(__dirname, "gt63-machine", "repository-frozen-governance-trust-root.js");
const manifestPath = path.join(__dirname, "..", "config", "gt63-machine", "governance-trust-root-v0.json");
const regressionPath = __filename;
const primitive = require(primitivePath);

const {
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
} = primitive;

const BASELINE_COMMIT = "d1c6d25e5326c8ca88e2029b60350ead8aa657c0";
const BASELINE_TREE = "dfde11756bcd90d3fd1fe7af6fe6275825074b2d";
const COMMIT_1 = "1".repeat(40);
const TREE_1 = "2".repeat(40);
const COMMIT_2 = "3".repeat(40);
const TREE_2 = "4".repeat(40);
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const anchorV1 = deriveRootMaterial(manifest).rootAnchorId;

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function canonicalBytes(value) {
  return Buffer.from(`${canonicalStringify(value)}\n`, "utf8");
}

function historyEntry(bytes, overrides = {}) {
  return {
    commitSha: overrides.commitSha || "5".repeat(40),
    treeSha: overrides.treeSha || "6".repeat(40),
    blobSha: overrides.blobSha || computeGitBlobSha(bytes),
    evidenceRef: overrides.evidenceRef || "evidence:git:history-entry"
  };
}

function createGitPort(options = {}) {
  const rootBytes = options.rootBytes || manifestBytes;
  const rootBlobSha = options.rootBlobSha || computeGitBlobSha(rootBytes);
  const commitSha = options.commitSha || COMMIT_1;
  const treeSha = options.treeSha || TREE_1;
  const history = clone(options.history || []);
  const blobBytes = new Map([[rootBlobSha, rootBytes]]);
  for (const item of options.historyMaterial || []) blobBytes.set(item.blobSha, item.bytes);
  if (options.additionalBlobs) {
    for (const [blobSha, bytes] of options.additionalBlobs) blobBytes.set(blobSha, bytes);
  }

  return {
    resolveRef(request) {
      if (options.unavailable === "resolveRef") throw new Error("unavailable");
      return {
        repositoryIdentity: options.refRepositoryIdentity || request.repositoryIdentity,
        authoritativeRef: options.refName || request.authoritativeRef,
        commitSha: options.refCommitSha || commitSha,
        evidenceRef: "evidence:git:ref"
      };
    },
    readCommit(request) {
      if (options.unavailable === "readCommit") throw new Error("unavailable");
      return {
        commitSha: options.commitRecordSha || request.commitSha,
        treeSha: options.commitTreeSha || treeSha,
        evidenceRef: "evidence:git:commit"
      };
    },
    readTreeEntry(request) {
      if (options.unavailable === "readTreeEntry") throw new Error("unavailable");
      if (options.pathAbsent) return null;
      return {
        treeSha: options.entryTreeSha || request.treeSha,
        path: options.entryPath || request.path,
        mode: options.entryMode || "100644",
        objectType: options.entryObjectType || "blob",
        blobSha: options.entryBlobSha || rootBlobSha,
        evidenceRef: "evidence:git:tree-entry"
      };
    },
    readBlob(request) {
      if (options.unavailable === "readBlob") throw new Error("unavailable");
      const bytes = blobBytes.get(request.blobSha);
      if (!bytes) throw new Error("blob missing");
      return {
        blobSha: options.returnedBlobSha || request.blobSha,
        bytesBase64: bytes.toString("base64"),
        evidenceRef: `evidence:git:blob:${request.blobSha}`
      };
    },
    listPathHistory() {
      if (options.unavailable === "listPathHistory") throw new Error("unavailable");
      return {
        entries: history,
        evidenceRef: "evidence:git:path-history"
      };
    }
  };
}

function request(overrides = {}) {
  const base = {
    rulesetVersion: RULESET_VERSION,
    expectedState: {
      commitSha: COMMIT_1,
      treeSha: TREE_1,
      expectedRootAnchorId: null
    },
    sourceQuery: {
      statementClass: STATEMENT_CLASS,
      governanceNamespace: GOVERNANCE_NAMESPACE,
      issuerPolicyNamespace: ISSUER_POLICY_NAMESPACE,
      registeredSourceRef: REGISTERED_SOURCE_REF,
      registeredSourcePath: REGISTERED_SOURCE_PATH
    }
  };
  return {
    ...base,
    ...clone(overrides),
    expectedState: { ...base.expectedState, ...clone(overrides.expectedState || {}) },
    sourceQuery: { ...base.sourceQuery, ...clone(overrides.sourceQuery || {}) }
  };
}

function system(options = {}) {
  return createRepositoryFrozenGovernanceTrustRootVerifier({ gitObjectPort: createGitPort(options) });
}

const cases = [];
const results = [];

function check(name, operation) {
  operation();
  cases.push(name);
}

function verify(component, input) {
  const output = component.verify(input);
  results.push(output);
  assert.equal(output.authority, "NONE");
  return output;
}

check("canonical-manifest-exact", () => {
  assert.deepEqual(manifest, JSON.parse(`${canonicalStringify(manifest)}\n`));
  assert.ok(manifestBytes.equals(canonicalBytes(manifest)));
  assert.equal(manifest.type, "REPOSITORY_FROZEN_GOVERNANCE_TRUST_ROOT");
  assert.equal(manifest.rootTrustAnchorRevision, 1);
  assert.equal(manifest.supersedesRootAnchorId, null);
  assert.equal(manifest.authority, "NONE");
  for (const prohibited of ["rootBlobSha", "rootMaterialDigest", "rootAnchorId", "rootVerificationId"]){
    assert.equal(Object.prototype.hasOwnProperty.call(manifest, prohibited), false);
  }
});

check("root-configuration-verified", () => {
  const output = verify(system(), request());
  assert.equal(output.outcome, OUTCOMES.VERIFIED);
  assert.equal(output.verification.rootAnchorId, anchorV1);
  assert.equal(output.verification.rootMaterialDigest, anchorV1);
  assert.equal(output.verification.rootPath, ROOT_PATH);
  assert.equal(output.verification.repositoryIdentity, REPOSITORY_IDENTITY);
  assert.equal(output.verification.authoritativeRef, AUTHORITATIVE_REF);
  assert.equal(output.verification.rootBlobSha, computeGitBlobSha(manifestBytes));
  assert.equal(output.verification.rootBlobSha256, sha256(manifestBytes));
});

check("caller-trusted-root-field-rejected", () => {
  const output = verify(system(), { ...request(), trustedRoot: true });
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("caller-root-bytes-rejected", () => {
  const output = verify(system(), { ...request(), rootBytesBase64: manifestBytes.toString("base64") });
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("caller-root-path-override-rejected", () => {
  const output = verify(system(), { ...request(), rootPath: "config/caller-root.json" });
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("caller-repository-override-rejected", () => {
  const output = verify(system(), { ...request(), repositoryIdentity: "caller/repository" });
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("unsupported-request-ruleset-rejected", () => {
  const output = verify(system(), { ...request(), rulesetVersion: "unsupported-request-v0" });
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("environment-root-is-ignored", () => {
  const previous = process.env.GT63_GOVERNANCE_TRUST_ROOT;
  process.env.GT63_GOVERNANCE_TRUST_ROOT = manifestBytes.toString("base64");
  try {
    const output = verify(system({ pathAbsent: true }), request());
    assert.equal(output.outcome, OUTCOMES.INVALID);
  } finally {
    if (previous === undefined) delete process.env.GT63_GOVERNANCE_TRUST_ROOT;
    else process.env.GT63_GOVERNANCE_TRUST_ROOT = previous;
  }
});

check("dynamic-root-provider-construction-rejected", () => {
  assert.throws(() => createRepositoryFrozenGovernanceTrustRootVerifier({
    gitObjectPort: createGitPort(), dynamicRootProvider() { return manifestBytes; }
  }), TypeError);
});

check("working-tree-only-root-rejected", () => {
  assert.ok(fs.existsSync(manifestPath));
  const output = verify(system({ pathAbsent: true }), request());
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("non-authoritative-commit-evidence-rejected", () => {
  const output = verify(system({ commitRecordSha: COMMIT_2 }), request());
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("same-root-revision-changed-material-conflict", () => {
  const changed = canonicalBytes({ ...manifest, registeredSourceRef: `${REGISTERED_SOURCE_REF}:changed` });
  const prior = historyEntry(changed);
  const output = verify(system({
    history: [prior], historyMaterial: [{ blobSha: prior.blobSha, bytes: changed }]
  }), request());
  assert.equal(output.outcome, OUTCOMES.CONFLICT);
});

for (const [name, sourcePatch] of [
  ["wrong-statement-class-not-registered", { statementClass: "LIFECYCLE_EVENT" }],
  ["wrong-governance-namespace-not-registered", { governanceNamespace: "OTHER_GOVERNANCE" }],
  ["wrong-issuer-policy-namespace-not-registered", { issuerPolicyNamespace: "OTHER_POLICY" }],
  ["wrong-registered-source-ref-not-registered", { registeredSourceRef: "source:other" }],
  ["wrong-registered-source-path-not-registered", { registeredSourcePath: "config/other.json" }]
]) {
  check(name, () => {
    const output = verify(system(), request({ sourceQuery: sourcePatch }));
    assert.equal(output.outcome, OUTCOMES.NOT_REGISTERED);
    assert.equal(output.verification.rootAnchorId, anchorV1);
  });
}

check("cross-repository-ref-evidence-rejected", () => {
  const output = verify(system({ refRepositoryIdentity: "other/repository" }), request());
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("cross-root-path-tree-entry-rejected", () => {
  const output = verify(system({ entryPath: "config/other-root.json" }), request());
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("main-move-same-root-requires-reverification", () => {
  const first = verify(system(), request());
  const oldRequest = request();
  const movedSystem = system({ commitSha: COMMIT_2, treeSha: TREE_2 });
  const stale = verify(movedSystem, oldRequest);
  const current = verify(movedSystem, request({
    expectedState: { commitSha: COMMIT_2, treeSha: TREE_2 }
  }));
  assert.equal(stale.outcome, OUTCOMES.STALE);
  assert.equal(current.outcome, OUTCOMES.VERIFIED);
  assert.equal(first.verification.rootAnchorId, current.verification.rootAnchorId);
  assert.notEqual(first.verification.rootVerificationId, current.verification.rootVerificationId);
});

check("v1-replay-after-authoritative-v2-stale", () => {
  const v2 = canonicalBytes({
    ...manifest,
    rootTrustAnchorRevision: 2,
    supersedesRootAnchorId: anchorV1
  });
  const prior = historyEntry(manifestBytes, {
    commitSha: COMMIT_1,
    treeSha: TREE_1,
    evidenceRef: "evidence:git:v1"
  });
  const output = verify(system({
    rootBytes: v2,
    commitSha: COMMIT_2,
    treeSha: TREE_2,
    history: [prior],
    historyMaterial: [{ blobSha: prior.blobSha, bytes: manifestBytes }]
  }), request({
    expectedState: {
      commitSha: COMMIT_2,
      treeSha: TREE_2,
      expectedRootAnchorId: anchorV1
    }
  }));
  assert.equal(output.outcome, OUTCOMES.STALE);
});

check("two-competing-roots-conflict", () => {
  const competing = canonicalBytes({ ...manifest, rootTrustAnchorRef: "gt63-machine:competing-root" });
  const prior = historyEntry(competing);
  const output = verify(system({
    history: [prior], historyMaterial: [{ blobSha: prior.blobSha, bytes: competing }]
  }), request());
  assert.equal(output.outcome, OUTCOMES.CONFLICT);
});

check("multiple-root-array-conflict", () => {
  const conflicting = canonicalBytes({ ...manifest, roots: [clone(manifest), clone(manifest)] });
  const output = verify(system({ rootBytes: conflicting }), request());
  assert.equal(output.outcome, OUTCOMES.CONFLICT);
});

check("root-path-missing-invalid", () => {
  const output = verify(system({ pathAbsent: true }), request());
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("malformed-json-invalid", () => {
  const output = verify(system({ rootBytes: Buffer.from("{", "utf8") }), request());
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("noncanonical-json-invalid", () => {
  const output = verify(system({ rootBytes: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8") }), request());
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("unsupported-manifest-ruleset-invalid", () => {
  const output = verify(system({
    rootBytes: canonicalBytes({ ...manifest, rulesetVersion: "unsupported-v0" })
  }), request());
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("unsupported-verification-method-invalid", () => {
  const output = verify(system({
    rootBytes: canonicalBytes({ ...manifest, verificationMethod: "DYNAMIC_PROVIDER" })
  }), request());
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("git-blob-identity-mismatch-invalid", () => {
  const falseSha = "f".repeat(40);
  const output = verify(system({ rootBlobSha: falseSha }), request());
  assert.equal(output.outcome, OUTCOMES.INVALID);
});

check("expected-main-tree-drift-stale", () => {
  const output = verify(system(), request({ expectedState: { treeSha: TREE_2 } }));
  assert.equal(output.outcome, OUTCOMES.STALE);
});

check("expected-root-anchor-drift-stale", () => {
  const output = verify(system(), request({
    expectedState: { expectedRootAnchorId: `sha256:${"a".repeat(64)}` }
  }));
  assert.equal(output.outcome, OUTCOMES.STALE);
});

for (const unavailable of ["resolveRef", "readCommit", "readTreeEntry", "readBlob", "listPathHistory"]) {
  check(`git-object-port-${unavailable}-unavailable-uncertain`, () => {
    const output = verify(system({ unavailable }), request());
    assert.equal(output.outcome, OUTCOMES.UNCERTAIN);
  });
}

check("root-output-has-no-downstream-truth-or-authority", () => {
  const output = verify(system(), request());
  const serialized = canonicalStringify(output);
  for (const prohibited of [
    "issuerPolicyAccepted", "lifecycleEvent", "currentGovernanceState", "ELIGIBLE",
    "NOT_ELIGIBLE", "humanGateSatisfied", "continuationAuthority", "executionAuthorized"
  ]) assert.equal(serialized.includes(prohibited), false);
  assert.equal(output.verification.authority, "NONE");
});

check("evidence-refs-deduplicated-and-ordered", () => {
  const output = verify(system(), request());
  const refs = output.verification.evidenceRefs;
  assert.deepEqual(refs, Array.from(new Set(refs)).sort());
});

check("material-change-changes-root-and-verification-identities", () => {
  const v2 = { ...manifest, rootTrustAnchorRevision: 2, supersedesRootAnchorId: anchorV1 };
  const materialV2 = deriveRootMaterial(v2);
  assert.notEqual(materialV2.rootAnchorId, anchorV1);
  assert.equal(materialV2.rootAnchorId, materialV2.rootMaterialDigest);
});

check("all-returned-outcomes-preserve-authority-none", () => {
  assert.ok(results.length > 0);
  assert.ok(results.every((output) => output.authority === "NONE"));
  assert.ok(results.filter((output) => output.verification)
    .every((output) => output.verification.authority === "NONE"));
});

const fileIdentities = {
  manifest: sha256(manifestBytes),
  primitive: sha256(fs.readFileSync(primitivePath)),
  regression: sha256(fs.readFileSync(regressionPath))
};
const validationIdentity = sha256(Buffer.from(canonicalStringify({
  suite: "gt63-machine-repository-frozen-governance-trust-root-regression-v0",
  baselineCommit: BASELINE_COMMIT,
  baselineTree: BASELINE_TREE,
  rulesetVersion: RULESET_VERSION,
  fileIdentities,
  cases,
  outcomes: results.map((output) => output.outcome),
  authority: "NONE"
}), "utf8"));

process.stdout.write(`${canonicalStringify({
  suite: "GT63 MACHINE — REPOSITORY-FROZEN GOVERNANCE TRUST ROOT V0",
  rulesetVersion: RULESET_VERSION,
  authoritativeBaseline: { commit: BASELINE_COMMIT, tree: BASELINE_TREE },
  cases: cases.length,
  passed: cases.length,
  caseNames: cases,
  fileIdentities,
  validationIdentity,
  authorityInvariant: "PASS: NONE"
})}\n`);
