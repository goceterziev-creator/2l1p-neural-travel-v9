"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const path = require("path");

const workspaceRoot = __dirname;
const runBootstrap = path.join(workspaceRoot, "gt63-machine", "run-bootstrap.js");
const configPath = path.join(workspaceRoot, "gt63-machine", "config", "bootstrap-config.json");
const inputPath = path.join(workspaceRoot, "gt63-machine", "fixtures", "local-document-report-input.json");
const REQUIRED_CATEGORIES = [
  "architecture",
  "research",
  "runtime",
  "proposal",
  "governance",
  "qa",
  "unknown"
];

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

function assertValidReport(result) {
  assert.strictEqual(result.status, "PASS");
  assert.strictEqual(result.workflow, "local-document-report");
  assert(result.repository.root.endsWith("/2l1p-neural-travel-v9"));
  assert(result.scan.filesScanned > 0);
  assert(result.machineReport);
  assert(result.machineReport.documentsFound > 0);
  assert(Array.isArray(result.machineReport.documents));
  assert.strictEqual(result.machineReport.documents.length, result.machineReport.documentsFound);
  assert(Array.isArray(result.machineReport.duplicates));
  assert(Array.isArray(result.machineReport.warnings));

  assert.deepStrictEqual(Object.keys(result.machineReport.categories), REQUIRED_CATEGORIES);

  for (const document of result.machineReport.documents) {
    assert(!path.isAbsolute(document.path), `document path must be relative: ${document.path}`);
    assert(!document.path.includes("\\"), `document path must use /: ${document.path}`);
    assert(REQUIRED_CATEGORIES.includes(document.category), `unknown category key: ${document.category}`);
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
assertValidReport(firstJson);

const second = runNode([runBootstrap, "--config", configPath, "--input", inputPath]);
assert.strictEqual(second.status, 0, second.stderr);
const secondJson = parseSingleJson(second.stdout);
assert.deepStrictEqual(normalizeResult(firstJson), normalizeResult(secondJson));

assertNoRemainingNodeProcesses();
process.stdout.write("GT63 MACHINE DOCUMENT REPORT REGRESSION = PASS\n");
