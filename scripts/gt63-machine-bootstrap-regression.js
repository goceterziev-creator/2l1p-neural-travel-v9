"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const workspaceRoot = __dirname;
const runBootstrap = path.join(workspaceRoot, "gt63-machine", "run-bootstrap.js");
const configPath = path.join(workspaceRoot, "gt63-machine", "config", "bootstrap-config.json");
const inputPath = path.join(workspaceRoot, "gt63-machine", "fixtures", "local-repository-input.json");

function runNode(args) {
  return childProcess.spawnSync(process.execPath, args, {
    cwd: path.resolve(workspaceRoot, ".."),
    encoding: "utf8",
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

function assertValidSuccess(result) {
  assert.strictEqual(result.status, "PASS");
  assert.strictEqual(result.workflow, "local-repository-bootstrap");
  assert(result.repository.root.endsWith("/2l1p-neural-travel-v9"));
  assert(result.scan.filesScanned > 0);
  assert(Array.isArray(result.evidence));
  assert(result.evidence.length > 0);

  for (const record of result.evidence) {
    assert(!path.isAbsolute(record.path), `evidence path must be relative: ${record.path}`);
    assert(!record.path.includes("\\"), `evidence path must use /: ${record.path}`);
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
assertValidSuccess(firstJson);

const second = runNode([runBootstrap, "--config", configPath, "--input", inputPath]);
assert.strictEqual(second.status, 0, second.stderr);
const secondJson = parseSingleJson(second.stdout);
assert.deepStrictEqual(normalizeResult(firstJson), normalizeResult(secondJson));

const invalidInputPath = path.join(os.tmpdir(), "gt63-machine-invalid-input.json");
try {
  fs.writeFileSync(invalidInputPath, JSON.stringify({
    workflow: "local-repository-bootstrap",
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
process.stdout.write("GT63 MACHINE BOOTSTRAP REGRESSION = PASS\n");
