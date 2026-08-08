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

function runNode(args) {
  return childProcess.spawnSync(process.execPath, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function parseSingleJson(stdout) {
  const trimmed = stdout.trim();
  assert(trimmed.startsWith("{"), "stdout must start with JSON");
  assert(trimmed.endsWith("}"), "stdout must end with JSON");
  return JSON.parse(trimmed);
}

function writeInput(tempRoot, name, body) {
  const inputPath = path.join(tempRoot, name);
  fs.writeFileSync(inputPath, `${JSON.stringify(body, null, 2)}\n`);
  return inputPath;
}

function runWorkflow(inputPath) {
  const result = runNode([runBootstrap, "--config", configPath, "--input", inputPath]);
  return {
    status: result.status,
    json: parseSingleJson(result.stdout),
    stderr: result.stderr
  };
}

function createIntake(tempRoot, sourcePath) {
  const inputPath = writeInput(tempRoot, `wf6-${path.basename(sourcePath)}.json`, {
    workflow: "external-artifact-intake",
    externalSourcePath: sourcePath
  });
  const run = runWorkflow(inputPath);
  assert.strictEqual(run.status, 0, run.stderr || JSON.stringify(run.json));
  return run.json;
}

function runBridge(tempRoot, manifestPath) {
  const inputPath = writeInput(tempRoot, `wf7-${Math.random().toString(16).slice(2)}.json`, {
    workflow: "intake-processing-bridge",
    manifestPath
  });
  return runWorkflow(inputPath);
}

function normalizeResult(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertFailure(result, code) {
  assert.notStrictEqual(result.status, 0);
  assert.strictEqual(result.json.status, "FAIL");
  assert.strictEqual(result.json.workflow, "intake-processing-bridge");
  assert.strictEqual(result.json.authority, "NONE");
  assert.strictEqual(result.json.failures[0].code, code);
  assert.strictEqual(result.json.downstream.status, "NOT_RUN");
}

function assertNoRemainingNodeProcesses() {
  if (process.platform !== "win32") return;
  const output = childProcess.execFileSync("powershell", [
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

let syntheticManifestIndex = 0;

function copyManifest(tempRoot, manifestPath, mutate) {
  const absolute = path.join(repositoryRoot, manifestPath);
  const manifest = JSON.parse(fs.readFileSync(absolute, "utf8"));
  syntheticManifestIndex += 1;
  const intakeId = `intake-${String(syntheticManifestIndex).padStart(64, "0")}`;
  const root = path.join(repositoryRoot, "tmp", "gt63-machine-intake", intakeId);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(root, "snapshot"), { recursive: true });
  fs.writeFileSync(path.join(root, "snapshot", "a.md"), "snapshot\n");
  manifest.intake.intakeId = intakeId;
  manifest.intake.stagingRoot = `tmp/gt63-machine-intake/${intakeId}`;
  manifest.intake.snapshotRoot = `tmp/gt63-machine-intake/${intakeId}/snapshot`;
  manifest.intake.manifestPath = `tmp/gt63-machine-intake/${intakeId}/manifest.json`;
  mutate(manifest);
  fs.writeFileSync(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest.intake.manifestPath;
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-wf7-regression-"));

try {
  const eligibleSource = path.join(tempRoot, "eligible-source");
  fs.mkdirSync(eligibleSource);
  fs.writeFileSync(path.join(eligibleSource, "a.md"), "GT63 evidence\n");
  const eligibleIntake = createIntake(tempRoot, eligibleSource);
  assert.strictEqual(eligibleIntake.status, "PASS");

  const eligibleBridge = runBridge(tempRoot, eligibleIntake.intake.manifestPath);
  assert.strictEqual(eligibleBridge.status, 0, eligibleBridge.stderr || JSON.stringify(eligibleBridge.json));
  assert.strictEqual(eligibleBridge.json.status, "PASS");
  assert.strictEqual(eligibleBridge.json.authority, "NONE");
  assert.strictEqual(eligibleBridge.json.downstream.workflow, "local-repository-bootstrap");
  assert.strictEqual(eligibleBridge.json.downstream.evidenceCount, 1);
  assert.strictEqual(eligibleBridge.json.provenance.workflow6IntakeId, eligibleIntake.intake.intakeId);

  const repeatBridge = runBridge(tempRoot, eligibleIntake.intake.manifestPath);
  assert.deepStrictEqual(normalizeResult(repeatBridge.json), normalizeResult(eligibleBridge.json));

  const warningSource = path.join(tempRoot, "warning-source");
  fs.mkdirSync(warningSource);
  fs.writeFileSync(path.join(warningSource, "a.md"), "GT63 evidence\n");
  fs.writeFileSync(path.join(warningSource, "image.png"), "unsupported\n");
  const warningIntake = createIntake(tempRoot, warningSource);
  assert.strictEqual(warningIntake.status, "PASS_WITH_WARNINGS");
  const warningBridge = runBridge(tempRoot, warningIntake.intake.manifestPath);
  assert.strictEqual(warningBridge.status, 0, warningBridge.stderr || JSON.stringify(warningBridge.json));
  assert.strictEqual(warningBridge.json.status, "PASS_WITH_WARNINGS");
  assert(warningBridge.json.warnings.includes("INTAKE_WARNINGS_PROPAGATED"));

  const largeSource = path.join(tempRoot, "large-source");
  fs.mkdirSync(largeSource);
  for (let index = 0; index < 501; index += 1) {
    fs.writeFileSync(path.join(largeSource, `file-${String(index).padStart(3, "0")}.md`), `GT63 evidence ${index}\n`);
  }
  const largeIntake = createIntake(tempRoot, largeSource);
  const largeBridge = runBridge(tempRoot, largeIntake.intake.manifestPath);
  assert.strictEqual(largeBridge.status, 0, largeBridge.stderr || JSON.stringify(largeBridge.json));
  assert.strictEqual(largeBridge.json.status, "PASS_WITH_WARNINGS");
  assert.strictEqual(largeBridge.json.downstream.truncated, true);
  assert.strictEqual(largeBridge.json.downstream.truncationReason, "MAX_FILES");
  assert(largeBridge.json.warnings.includes("DOWNSTREAM_TRUNCATED"));

  const notEligibleManifestPath = copyManifest(tempRoot, eligibleIntake.intake.manifestPath, (manifest) => {
    manifest.status = "FAIL";
    manifest.intake.downstreamEligibility = "NOT_ELIGIBLE";
  });
  assertFailure(runBridge(tempRoot, notEligibleManifestPath), "INTAKE_NOT_ELIGIBLE");

  const mismatchManifestPath = copyManifest(tempRoot, eligibleIntake.intake.manifestPath, (manifest) => {
    manifest.intake.intakeId = `intake-${"b".repeat(64)}`;
  });
  assertFailure(runBridge(tempRoot, mismatchManifestPath), "INTAKE_ID_MISMATCH");

  const invalidPairManifestPath = copyManifest(tempRoot, eligibleIntake.intake.manifestPath, (manifest) => {
    manifest.status = "PENDING";
    manifest.intake.downstreamEligibility = "ELIGIBLE";
  });
  assertFailure(runBridge(tempRoot, invalidPairManifestPath), "MANIFEST_INVALID");

  const missingSnapshotManifestPath = copyManifest(tempRoot, eligibleIntake.intake.manifestPath, () => {});
  fs.rmSync(path.join(repositoryRoot, path.dirname(missingSnapshotManifestPath), "snapshot"), { recursive: true, force: true });
  assertFailure(runBridge(tempRoot, missingSnapshotManifestPath), "SNAPSHOT_MISSING");

  const malformedIntakeId = `intake-${"c".repeat(64)}`;
  const malformedRoot = path.join(repositoryRoot, "tmp", "gt63-machine-intake", malformedIntakeId);
  fs.mkdirSync(malformedRoot, { recursive: true });
  fs.writeFileSync(path.join(malformedRoot, "manifest.json"), "{ bad json\n");
  assertFailure(runBridge(tempRoot, `tmp/gt63-machine-intake/${malformedIntakeId}/manifest.json`), "MANIFEST_INVALID");

  assertFailure(runWorkflow(writeInput(tempRoot, "missing-manifest-path.json", {
    workflow: "intake-processing-bridge"
  })), "INPUT_INVALID");
  assertFailure(runWorkflow(writeInput(tempRoot, "unsupported-intake-id.json", {
    workflow: "intake-processing-bridge",
    intakeId: eligibleIntake.intake.intakeId
  })), "INPUT_REFERENCE_UNSUPPORTED");
  assertFailure(runWorkflow(writeInput(tempRoot, "unsupported-snapshot-path.json", {
    workflow: "intake-processing-bridge",
    snapshotPath: eligibleIntake.intake.snapshotRoot
  })), "INPUT_REFERENCE_UNSUPPORTED");
  assertFailure(runWorkflow(writeInput(tempRoot, "unsupported-repository-path.json", {
    workflow: "intake-processing-bridge",
    repositoryPath: eligibleIntake.intake.snapshotRoot
  })), "INPUT_REFERENCE_UNSUPPORTED");
  const externalRepositoryPathRun = runWorkflow(writeInput(tempRoot, "external-repository-path.json", {
    workflow: "local-repository-bootstrap",
    repositoryPath: tempRoot
  }));
  assert.notStrictEqual(externalRepositoryPathRun.status, 0);
  assert.strictEqual(externalRepositoryPathRun.json.status, "FAIL");
  assert.strictEqual(externalRepositoryPathRun.json.workflow, "local-repository-bootstrap");
  assert.strictEqual(externalRepositoryPathRun.json.failures[0].code, "INPUT_PATH_INVALID");

  if (process.platform === "win32") {
    const escapeId = `intake-${"d".repeat(64)}`;
    const escapeRoot = path.join(repositoryRoot, "tmp", "gt63-machine-intake", escapeId);
    fs.rmSync(escapeRoot, { recursive: true, force: true });
    fs.mkdirSync(escapeRoot, { recursive: true });
    const outsideManifest = path.join(tempRoot, "outside-manifest.json");
    fs.writeFileSync(outsideManifest, "{}");
    try {
      fs.symlinkSync(outsideManifest, path.join(escapeRoot, "manifest.json"), "file");
      assertFailure(runBridge(tempRoot, `tmp/gt63-machine-intake/${escapeId}/manifest.json`), "STAGING_BOUNDARY_VIOLATION");
    } catch (error) {
      assert(["EPERM", "EEXIST"].includes(error.code), error.message);
    }

    const snapshotEscapeManifestPath = copyManifest(tempRoot, eligibleIntake.intake.manifestPath, () => {});
    const snapshotAbsolute = path.join(repositoryRoot, path.dirname(snapshotEscapeManifestPath), "snapshot");
    const outsideSnapshot = path.join(tempRoot, "outside-snapshot");
    fs.mkdirSync(outsideSnapshot);
    fs.rmSync(snapshotAbsolute, { recursive: true, force: true });
    try {
      fs.symlinkSync(outsideSnapshot, snapshotAbsolute, "junction");
      assertFailure(runBridge(tempRoot, snapshotEscapeManifestPath), "STAGING_BOUNDARY_VIOLATION");
    } catch (error) {
      assert(["EPERM", "EEXIST"].includes(error.code), error.message);
    }
  }

  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical.json")), false);
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical-review.json")), false);
  assertNoRemainingNodeProcesses();

  process.stdout.write("GT63 MACHINE INTAKE PROCESSING BRIDGE REGRESSION = PASS\n");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
