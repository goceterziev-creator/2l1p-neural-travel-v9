"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const workspaceRoot = __dirname;
const repositoryRoot = path.resolve(workspaceRoot, "..");
const runBootstrap = path.join(workspaceRoot, "gt63-machine", "run-bootstrap.js");
const configPath = path.join(workspaceRoot, "gt63-machine", "config", "bootstrap-config.json");
const inputPath = path.join(workspaceRoot, "gt63-machine", "fixtures", "local-candidate-review-input.json");
const candidateInputPath = path.join(workspaceRoot, "gt63-machine", "fixtures", "local-canonical-candidate-input.json");

function runNode(args) {
  return childProcess.spawnSync(process.execPath, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function parseSingleJson(stdout) {
  const trimmed = stdout.trim();
  assert(trimmed.startsWith("{"), "stdout must start with a JSON object");
  assert(trimmed.endsWith("}"), "stdout must end with a JSON object");
  return JSON.parse(trimmed);
}

function normalizeResult(result) {
  return JSON.parse(JSON.stringify(result));
}

function assertValidReview(result) {
  assert.strictEqual(result.status, "PASS");
  assert.strictEqual(result.workflow, "candidate-review-resolution");
  assert(result.canonicalReview);
  assert.strictEqual(result.canonicalReview.logicalDocumentName, "canonical-review.json");
  assert.strictEqual(result.canonicalReview.authority, "NONE");
  assert.strictEqual(result.canonicalReview.reviewStatus, "RECOMMENDATION_ONLY");
  assert.strictEqual(result.canonicalReview.recommendationOnly, true);
  assert(Array.isArray(result.canonicalReview.duplicateCandidates));
  assert(Array.isArray(result.canonicalReview.conflictGroups));
  assert(Array.isArray(result.canonicalReview.missingEvidence));
  assert(Array.isArray(result.canonicalReview.unsupportedCandidates));
  assert(Array.isArray(result.canonicalReview.confidenceIssues));
  assert(result.canonicalReview.recommendations);
  assert(Array.isArray(result.canonicalReview.recommendations.recommendedForReview));
  assert(Array.isArray(result.canonicalReview.reviewNotes));
  assert(Array.isArray(result.failures));

  const serialized = JSON.stringify(result);
  assert(!serialized.includes("acceptedCandidateIds"), "review must not accept candidates");
  assert(!serialized.includes("rejectedCandidateIds"), "review must not reject candidates");
  assert(!serialized.includes("GOVERNANCE_OUTCOME"), "review must not produce governance outcomes");

  for (const group of result.canonicalReview.duplicateCandidates) {
    assert(Array.isArray(group.sourceEvidence));
    assert(group.sourceEvidence.length > 0);
  }
  for (const record of result.canonicalReview.unsupportedCandidates) {
    assert(Array.isArray(record.sourceEvidence));
  }
}

function assertNoCanonicalArtifacts() {
  assert(!fs.existsSync(path.join(repositoryRoot, "canonical.json")), "canonical.json must not be written");
  assert(!fs.existsSync(path.join(repositoryRoot, "canonical-review.json")), "canonical-review.json must not be written");
}

function assertNoRemainingNodeProcesses() {
  let output = "";

  if (process.platform !== "win32") {
    output = childProcess.execFileSync("ps", ["-o", "pid=", "-o", "ppid=", "-o", "comm="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    const childNodes = output.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => {
        const parts = line.split(/\s+/);
        return parts[1] === String(process.pid) && parts.slice(2).join(" ").includes("node");
      });
    assert.deepStrictEqual(childNodes, [], "no child Node processes should remain");
    return;
  }

  output = childProcess.execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    `$ParentPid = ${process.pid}; Get-CimInstance Win32_Process -Filter "ParentProcessId = $ParentPid AND Name = 'node.exe'" | Select-Object -ExpandProperty ProcessId`
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  const nodePids = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  assert.deepStrictEqual(nodePids, [], "no child Node processes should remain");
}

const first = runNode([runBootstrap, "--config", configPath, "--input", inputPath]);
assert.strictEqual(first.status, 0, first.stderr);
const firstJson = parseSingleJson(first.stdout);
assertValidReview(firstJson);
assertNoCanonicalArtifacts();

const second = runNode([runBootstrap, "--config", configPath, "--input", inputPath]);
assert.strictEqual(second.status, 0, second.stderr);
const secondJson = parseSingleJson(second.stdout);
assert.deepStrictEqual(normalizeResult(firstJson), normalizeResult(secondJson));

const candidateSource = runNode([runBootstrap, "--config", configPath, "--input", candidateInputPath]);
assert.strictEqual(candidateSource.status, 0, candidateSource.stderr);
const candidateSourceJson = parseSingleJson(candidateSource.stdout);
assert.strictEqual(candidateSourceJson.status, "PASS");
assert(candidateSourceJson.candidateModel);

const capturedCandidateInputPath = path.join(os.tmpdir(), "gt63-machine-captured-candidate-review-input.json");
try {
  const capturedCandidateInput = JSON.stringify({
    workflow: "candidate-review-resolution",
    repositoryPath: ".",
    candidateModel: candidateSourceJson.candidateModel
  }, null, 2);
  fs.writeFileSync(capturedCandidateInputPath, capturedCandidateInput);

  const capturedCandidate = runNode([runBootstrap, "--config", configPath, "--input", capturedCandidateInputPath]);
  assert.strictEqual(capturedCandidate.status, 0, capturedCandidate.stderr);
  const capturedCandidateJson = parseSingleJson(capturedCandidate.stdout);
  assertValidReview(capturedCandidateJson);
  assert.strictEqual(fs.readFileSync(capturedCandidateInputPath, "utf8"), capturedCandidateInput);
  assertNoCanonicalArtifacts();
} finally {
  if (fs.existsSync(capturedCandidateInputPath)) {
    fs.unlinkSync(capturedCandidateInputPath);
  }
}

const invalidInputPath = path.join(os.tmpdir(), "gt63-machine-invalid-review-input.json");
try {
  fs.writeFileSync(invalidInputPath, JSON.stringify({
    workflow: "candidate-review-resolution",
    repositoryPath: ".."
  }));

  const invalid = runNode([runBootstrap, "--config", configPath, "--input", invalidInputPath]);
  assert.notStrictEqual(invalid.status, 0);
  const invalidJson = parseSingleJson(invalid.stdout);
  assert.strictEqual(invalidJson.status, "FAIL");
  assert.strictEqual(invalidJson.failures.length, 1);
  assert.strictEqual(invalidJson.failures[0].code, "INPUT_PATH_INVALID");
} finally {
  if (fs.existsSync(invalidInputPath)) {
    fs.unlinkSync(invalidInputPath);
  }
}

const malformedInputPath = path.join(os.tmpdir(), "gt63-machine-malformed-review-input.json");
try {
  fs.writeFileSync(malformedInputPath, JSON.stringify({
    workflow: "candidate-review-resolution",
    repositoryPath: ".",
    candidateModel: null
  }));

  const malformed = runNode([runBootstrap, "--config", configPath, "--input", malformedInputPath]);
  assert.notStrictEqual(malformed.status, 0);
  const malformedJson = parseSingleJson(malformed.stdout);
  assert.strictEqual(malformedJson.status, "FAIL");
  assert.strictEqual(malformedJson.workflow, "candidate-review-resolution");
  assert.strictEqual(malformedJson.authority, "NONE");
  assert.strictEqual(malformedJson.failures.length, 1);
  assert.strictEqual(malformedJson.failures[0].code, "CANDIDATE_MODEL_MISSING");
  assertNoCanonicalArtifacts();
} finally {
  if (fs.existsSync(malformedInputPath)) {
    fs.unlinkSync(malformedInputPath);
  }
}

const invalidCandidatePath = path.join(os.tmpdir(), "gt63-machine-invalid-candidate-review-input.json");
try {
  fs.writeFileSync(invalidCandidatePath, JSON.stringify({
    workflow: "candidate-review-resolution",
    repositoryPath: ".",
    candidateModel: {
      authority: "NONE",
      canonicalStatus: "NOT_CANONICAL",
      objects: [
        {
          id: "candidate.invalid",
          type: "Unknown",
          sourceEvidence: "not-an-array"
        }
      ],
      evidenceIndex: []
    }
  }));

  const invalidCandidate = runNode([runBootstrap, "--config", configPath, "--input", invalidCandidatePath]);
  assert.notStrictEqual(invalidCandidate.status, 0);
  const invalidCandidateJson = parseSingleJson(invalidCandidate.stdout);
  assert.strictEqual(invalidCandidateJson.status, "FAIL");
  assert.strictEqual(invalidCandidateJson.workflow, "candidate-review-resolution");
  assert.strictEqual(invalidCandidateJson.authority, "NONE");
  assert.strictEqual(invalidCandidateJson.failures.length, 1);
  assert.strictEqual(invalidCandidateJson.failures[0].code, "CANDIDATE_SOURCE_EVIDENCE_INVALID");
  assertNoCanonicalArtifacts();
} finally {
  if (fs.existsSync(invalidCandidatePath)) {
    fs.unlinkSync(invalidCandidatePath);
  }
}

assertNoRemainingNodeProcesses();
process.stdout.write("GT63 MACHINE CANDIDATE REVIEW REGRESSION = PASS\n");
