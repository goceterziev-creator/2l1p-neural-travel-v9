"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const workspaceRoot = __dirname;
const runBootstrap = path.join(workspaceRoot, "gt63-machine", "run-bootstrap.js");
const configPath = path.join(workspaceRoot, "gt63-machine", "config", "bootstrap-config.json");
const inputPath = path.join(workspaceRoot, "gt63-machine", "fixtures", "local-machine-summary-input.json");
const CATEGORY_KEYS = [
  "architecture",
  "research",
  "runtime",
  "proposal",
  "governance",
  "qa",
  "unknown"
];
const RELATIONSHIP_KEYS = [
  "references",
  "sameDirectory",
  "sameCategory",
  "versionRelated",
  "possibleDuplicate"
];

function runNode(args) {
  return childProcess.spawnSync(process.execPath, args, {
    cwd: path.resolve(workspaceRoot, ".."),
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

function assertValidSummary(result) {
  assert.strictEqual(result.status, "PASS");
  assert.strictEqual(result.workflow, "machine-graph-summary");
  assert(result.summary);
  assert(result.summary.documents > 0);
  assert.deepStrictEqual(Object.keys(result.summary.categoryCounts), CATEGORY_KEYS);
  assert(CATEGORY_KEYS.includes(result.summary.largestCategory));
  assert.deepStrictEqual(Object.keys(result.summary.relationshipCounts), RELATIONSHIP_KEYS);
  assert(Number.isInteger(result.summary.isolatedDocuments));
  assert(Number.isInteger(result.summary.duplicateCandidates));
  assert(Array.isArray(result.summary.topDocumentDirectories));
  assert(Array.isArray(result.warnings));
  assert(Array.isArray(result.failures));

  for (const directoryRecord of result.summary.topDocumentDirectories) {
    assert.strictEqual(typeof directoryRecord.directory, "string");
    assert(Number.isInteger(directoryRecord.documents));
    assert(directoryRecord.documents > 0);
  }
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
assertValidSummary(firstJson);

const second = runNode([runBootstrap, "--config", configPath, "--input", inputPath]);
assert.strictEqual(second.status, 0, second.stderr);
const secondJson = parseSingleJson(second.stdout);
assert.deepStrictEqual(normalizeResult(firstJson), normalizeResult(secondJson));

const invalidInputPath = path.join(os.tmpdir(), "gt63-machine-invalid-summary-input.json");
try {
  fs.writeFileSync(invalidInputPath, JSON.stringify({
    workflow: "machine-graph-summary",
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
process.stdout.write("GT63 MACHINE SUMMARY REGRESSION = PASS\n");
