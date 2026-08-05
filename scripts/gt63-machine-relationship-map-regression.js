"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const workspaceRoot = __dirname;
const runBootstrap = path.join(workspaceRoot, "gt63-machine", "run-bootstrap.js");
const configPath = path.join(workspaceRoot, "gt63-machine", "config", "bootstrap-config.json");
const inputPath = path.join(workspaceRoot, "gt63-machine", "fixtures", "local-relationship-map-input.json");
const RELATIONSHIP_TYPES = [
  "REFERENCES",
  "SAME_CATEGORY",
  "SAME_DIRECTORY",
  "VERSION_RELATED",
  "POSSIBLE_DUPLICATE"
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

function assertValidGraph(result) {
  assert.strictEqual(result.status, "PASS");
  assert.strictEqual(result.workflow, "document-relationship-map");
  assert(result.summary);
  assert(result.summary.documents > 0);
  assert(Array.isArray(result.nodes));
  assert(result.nodes.length > 0);
  assert.strictEqual(result.nodes.length, result.summary.documents);
  assert(Array.isArray(result.relationships));
  assert(Array.isArray(result.warnings));
  assert(Array.isArray(result.failures));

  const relationshipKeys = new Set();
  for (const node of result.nodes) {
    assert.strictEqual(node.id, node.path);
    assert(!path.isAbsolute(node.path), `node path must be relative: ${node.path}`);
    assert(!node.path.includes("\\"), `node path must use /: ${node.path}`);
  }

  for (const relationship of result.relationships) {
    assert(RELATIONSHIP_TYPES.includes(relationship.type), `invalid relationship type: ${relationship.type}`);
    assert(relationship.evidence && typeof relationship.evidence === "object", "relationship must include evidence");
    assert.notStrictEqual(relationship.from, relationship.to, "self-relations are not allowed");
    assert(!relationship.from.includes("\\"), `from path must use /: ${relationship.from}`);
    assert(!relationship.to.includes("\\"), `to path must use /: ${relationship.to}`);

    const key = JSON.stringify(relationship);
    assert(!relationshipKeys.has(key), `duplicate relationship record: ${key}`);
    relationshipKeys.add(key);
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
assertValidGraph(firstJson);

const second = runNode([runBootstrap, "--config", configPath, "--input", inputPath]);
assert.strictEqual(second.status, 0, second.stderr);
const secondJson = parseSingleJson(second.stdout);
assert.deepStrictEqual(normalizeResult(firstJson), normalizeResult(secondJson));

const invalidInputPath = path.join(os.tmpdir(), "gt63-machine-invalid-relationship-input.json");
try {
  fs.writeFileSync(invalidInputPath, JSON.stringify({
    workflow: "document-relationship-map",
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
process.stdout.write("GT63 MACHINE RELATIONSHIP MAP REGRESSION = PASS\n");
