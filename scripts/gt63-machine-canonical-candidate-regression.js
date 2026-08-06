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
const inputPath = path.join(workspaceRoot, "gt63-machine", "fixtures", "local-canonical-candidate-input.json");
const REQUIRED_FIELDS = [
  "id",
  "type",
  "status",
  "title",
  "sourceEvidence",
  "confidence",
  "relatedObjects",
  "lastUpdated"
];

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

function assertValidCandidateModel(result) {
  assert.strictEqual(result.status, "PASS");
  assert.strictEqual(result.workflow, "canonical-candidate-builder");
  assert(result.candidateModel);
  assert.strictEqual(result.candidateModel.schemaVersion, "candidate-v1");
  assert.strictEqual(result.candidateModel.authority, "NONE");
  assert.strictEqual(result.candidateModel.canonicalStatus, "NOT_CANONICAL");
  assert(Array.isArray(result.candidateModel.objects));
  assert(result.candidateModel.objects.length > 0);
  assert(Array.isArray(result.candidateModel.evidenceIndex));
  assert(Array.isArray(result.candidateModel.warnings));
  assert(Array.isArray(result.failures));

  for (const object of result.candidateModel.objects) {
    assert.deepStrictEqual(Object.keys(object), REQUIRED_FIELDS);
    assert.strictEqual(object.status, "CANDIDATE");
    assert.strictEqual(object.confidence, "EVIDENCE_BACKED");
    assert(Array.isArray(object.sourceEvidence));
    assert(object.sourceEvidence.length > 0);
    assert(Array.isArray(object.relatedObjects));
    assert.strictEqual(object.lastUpdated, null);

    for (const evidence of object.sourceEvidence) {
      assert.strictEqual(evidence.evidenceType, "DOCUMENT");
      assert(!path.isAbsolute(evidence.path), `evidence path must be relative: ${evidence.path}`);
      assert(!evidence.path.includes("\\"), `evidence path must use /: ${evidence.path}`);
    }
  }

  assert(!fs.existsSync(path.join(repositoryRoot, "canonical.json")), "canonical.json must not be written");
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
assertValidCandidateModel(firstJson);

const second = runNode([runBootstrap, "--config", configPath, "--input", inputPath]);
assert.strictEqual(second.status, 0, second.stderr);
const secondJson = parseSingleJson(second.stdout);
assert.deepStrictEqual(normalizeResult(firstJson), normalizeResult(secondJson));

const invalidInputPath = path.join(os.tmpdir(), "gt63-machine-invalid-candidate-input.json");
try {
  fs.writeFileSync(invalidInputPath, JSON.stringify({
    workflow: "canonical-candidate-builder",
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

assertNoRemainingNodeProcesses();
process.stdout.write("GT63 MACHINE CANONICAL CANDIDATE REGRESSION = PASS\n");
