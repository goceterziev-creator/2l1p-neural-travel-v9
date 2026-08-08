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
const maxIndividualFileBytes = 26214400;
const maxSourceArchiveBytes = 52428800;

function runNode(args, env) {
  return childProcess.spawnSync(process.execPath, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, ...(env || {}) },
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function parseSingleJson(stdout) {
  const trimmed = stdout.trim();
  assert(trimmed.startsWith("{"), "stdout must start with JSON");
  assert(trimmed.endsWith("}"), "stdout must end with JSON");
  return JSON.parse(trimmed);
}

function normalizeResult(result) {
  const clone = JSON.parse(JSON.stringify(result));
  return clone;
}

function writeInput(tempRoot, sourcePath) {
  const inputPath = path.join(tempRoot, "external-intake-input.json");
  fs.writeFileSync(inputPath, JSON.stringify({
    workflow: "external-artifact-intake",
    externalSourcePath: sourcePath
  }, null, 2));
  return inputPath;
}

function rawNameBytes(...parts) {
  const bytes = [];
  for (const part of parts) {
    if (typeof part === "string") {
      bytes.push(...Buffer.from(part, "ascii"));
    } else {
      bytes.push(...part);
    }
  }
  return bytes;
}

function mutationHookEnv(tempRoot, targetPath, mode) {
  const hookPath = path.join(tempRoot, `mutation-hook-${mode}.js`);
  fs.writeFileSync(hookPath, `
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const target = process.env.GT63_WF6_REGRESSION_MUTATION_TARGET;
const mode = process.env.GT63_WF6_REGRESSION_MUTATION_MODE;
let mutated = false;
function matches(candidate) {
  if (!target || typeof candidate !== "string") return false;
  return path.resolve(candidate) === path.resolve(target);
}
function mutate() {
  if (mutated || !target) return;
  mutated = true;
  if (mode === "rewrite-same-after-read") {
    const size = fs.statSync(target).size;
    fs.writeFileSync(target, Buffer.alloc(size, 0x78));
  } else {
    fs.appendFileSync(target, "mutation");
  }
}
const originalReadFileSync = fs.readFileSync;
fs.readFileSync = function patchedReadFileSync(candidate, ...rest) {
  const result = originalReadFileSync.call(this, candidate, ...rest);
  if (matches(candidate) && (mode === "append-after-read" || mode === "rewrite-same-after-read")) mutate();
  return result;
};
const originalInflateRawSync = zlib.inflateRawSync;
zlib.inflateRawSync = function patchedInflateRawSync(...args) {
  if (mode === "append-during-inflate") mutate();
  return originalInflateRawSync.apply(this, args);
};
`);
  return {
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ""}--require=${hookPath}`,
    GT63_WF6_REGRESSION_MUTATION_TARGET: targetPath,
    GT63_WF6_REGRESSION_MUTATION_MODE: mode
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function createStoredZip(zipPath, entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = entry.rawName ? Buffer.from(entry.rawName) : Buffer.from(entry.name, "utf8");
    const localName = entry.localRawName ? Buffer.from(entry.localRawName) : name;
    const data = Buffer.from(entry.data, "utf8");
    const flags = Object.prototype.hasOwnProperty.call(entry, "flags") ? entry.flags : 0x0800;
    const method = Object.prototype.hasOwnProperty.call(entry, "method") ? entry.method : 0;
    const crc = Object.prototype.hasOwnProperty.call(entry, "crc") ? entry.crc : crc32(data);
    const compressedSize = Object.prototype.hasOwnProperty.call(entry, "compressedSize") ? entry.compressedSize : data.length;
    const uncompressedSize = Object.prototype.hasOwnProperty.call(entry, "uncompressedSize") ? entry.uncompressedSize : data.length;
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(flags), u16(method), u16(0), u16(0), u32(crc),
      u32(compressedSize), u32(uncompressedSize), u16(localName.length), u16(0), localName, data
    ]);
    const central = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(flags), u16(method), u16(0), u16(0),
      u32(crc), u32(compressedSize), u32(uncompressedSize), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name
    ]);
    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  }
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(central.length), u32(offset), u16(0)
  ]);
  fs.writeFileSync(zipPath, Buffer.concat([...localParts, central, eocd]));
}

function createSparseStoredZip(zipPath, entryName, size) {
  const name = Buffer.from(entryName, "utf8");
  const crc = 0;
  const localLength = 30 + name.length + size;
  const centralOffset = localLength;
  const localHeader = Buffer.concat([
    u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc),
    u32(size), u32(size), u16(name.length), u16(0), name
  ]);
  const central = Buffer.concat([
    u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
    u32(crc), u32(size), u32(size), u16(name.length), u16(0), u16(0),
    u16(0), u16(0), u32(0), u32(0), name
  ]);
  const eocd = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(1), u16(1), u32(central.length), u32(centralOffset), u16(0)
  ]);
  const fd = fs.openSync(zipPath, "w");
  try {
    fs.writeSync(fd, localHeader, 0, localHeader.length, 0);
    fs.writeSync(fd, central, 0, central.length, centralOffset);
    fs.writeSync(fd, eocd, 0, eocd.length, centralOffset + central.length);
  } finally {
    fs.closeSync(fd);
  }
}

function createDeflatedZip(zipPath, entryName, data) {
  const zlib = require("zlib");
  const source = Buffer.from(data);
  const compressed = zlib.deflateRawSync(source);
  const name = Buffer.from(entryName, "utf8");
  const crc = crc32(source);
  const local = Buffer.concat([
    u32(0x04034b50), u16(20), u16(0x0800), u16(8), u16(0), u16(0), u32(crc),
    u32(compressed.length), u32(source.length), u16(name.length), u16(0), name, compressed
  ]);
  const central = Buffer.concat([
    u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(8), u16(0), u16(0),
    u32(crc), u32(compressed.length), u32(source.length), u16(name.length), u16(0), u16(0),
    u16(0), u16(0), u32(0), u32(0), name
  ]);
  const eocd = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(1), u16(1), u32(central.length), u32(local.length), u16(0)
  ]);
  fs.writeFileSync(zipPath, Buffer.concat([local, central, eocd]));
}

function writeSparseFile(filePath, size) {
  const fd = fs.openSync(filePath, "w");
  try {
    fs.ftruncateSync(fd, size);
  } finally {
    fs.closeSync(fd);
  }
}

function runIntake(inputPath, env) {
  return runNode([runBootstrap, "--config", configPath, "--input", inputPath], env);
}

function parseRun(run) {
  assert(run.stdout.trim(), run.stderr || "stdout must not be empty");
  return parseSingleJson(run.stdout);
}

function assertFailureCode(result, code) {
  assert(result.failures.some((failure) => failure.code === code), `expected failure ${code}`);
}

function assertArtifactReason(result, reason) {
  assert(result.artifacts.some((artifact) => artifact.reason === reason), `expected artifact reason ${reason}`);
}

function assertManifest(result, expectedStatus) {
  assert.strictEqual(result.status, expectedStatus);
  assert.strictEqual(result.workflow, "external-artifact-intake");
  assert.strictEqual(result.authority, "NONE");
  assert.strictEqual(result.logicalDocumentName, "external-artifact-intake-manifest.json");
  assert(result.intake);
  assert(result.summary);
  assert(Array.isArray(result.artifacts));
  assert(Array.isArray(result.failures));
  assert.strictEqual(result.intake.sourcePath.includes("\\"), false);
  assert(!JSON.stringify(result).includes("canonicalStatus"));
  assert(!fs.existsSync(path.join(repositoryRoot, "canonical.json")), "canonical.json must not be created");
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

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-workflow-6-"));
try {
  const sourceRoot = path.join(tempRoot, "external-source");
  fs.mkdirSync(path.join(sourceRoot, "docs"), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, "docs", "a.md"), "GT63 external evidence\n");
  fs.writeFileSync(path.join(sourceRoot, "docs", "b.json"), JSON.stringify({ authority: "NONE" }, null, 2));

  const inputPath = writeInput(tempRoot, sourceRoot);
  const first = runNode([runBootstrap, "--config", configPath, "--input", inputPath]);
  assert.strictEqual(first.status, 0, first.stderr || first.stdout);
  const firstJson = parseSingleJson(first.stdout);
  assertManifest(firstJson, "PASS");
  assert.strictEqual(firstJson.summary.staged, 2);
  assert.strictEqual(firstJson.summary.totalDiscovered, 2);
  assert.strictEqual(firstJson.failures.length, 0);
  for (const artifact of firstJson.artifacts) {
    assert.strictEqual(artifact.status, "STAGED");
    assert(artifact.stagedRelativePath.startsWith("snapshot/"));
    assert(!artifact.sourceRelativePath.includes("\\"));
    assert.strictEqual(artifact.provenance.sourceKind, "directory");
  }
  assert(fs.existsSync(path.join(repositoryRoot, firstJson.intake.manifestPath)));
  assert(fs.existsSync(path.join(repositoryRoot, firstJson.intake.snapshotRoot)));

  const second = runNode([runBootstrap, "--config", configPath, "--input", inputPath]);
  assert.strictEqual(second.status, 0, second.stderr);
  const secondJson = parseSingleJson(second.stdout);
  assert.deepStrictEqual(normalizeResult(firstJson), normalizeResult(secondJson));

  const unsupportedRoot = path.join(tempRoot, "unsupported-source");
  fs.mkdirSync(unsupportedRoot);
  fs.writeFileSync(path.join(unsupportedRoot, "image.png"), "not supported");
  const unsupportedInput = writeInput(tempRoot, unsupportedRoot);
  const unsupported = runNode([runBootstrap, "--config", configPath, "--input", unsupportedInput]);
  assert.notStrictEqual(unsupported.status, 0);
  const unsupportedJson = parseSingleJson(unsupported.stdout);
  assertManifest(unsupportedJson, "FAIL");
  assert.strictEqual(unsupportedJson.failures[0].code, "NO_STAGED_ARTIFACTS");
  assert.strictEqual(unsupportedJson.artifacts[0].status, "UNSUPPORTED");

  const invalidInput = writeInput(tempRoot, path.join(tempRoot, "missing"));
  const invalid = runNode([runBootstrap, "--config", configPath, "--input", invalidInput]);
  assert.notStrictEqual(invalid.status, 0);
  const invalidJson = parseSingleJson(invalid.stdout);
  assertManifest(invalidJson, "FAIL");
  assert.strictEqual(invalidJson.failures[0].code, "EXTERNAL_INPUT_NOT_FOUND");

  const zipPath = path.join(tempRoot, "external.zip");
  createStoredZip(zipPath, [
    { name: "docs/z.md", data: "GT63 zip evidence\n" },
    { name: "nested/archive.zip", data: "nested zip placeholder" }
  ]);
  const zipInput = writeInput(tempRoot, zipPath);
  const zipRun = runNode([runBootstrap, "--config", configPath, "--input", zipInput]);
  assert.strictEqual(zipRun.status, 0, zipRun.stderr || zipRun.stdout);
  const zipJson = parseSingleJson(zipRun.stdout);
  assertManifest(zipJson, "PASS_WITH_WARNINGS");
  assert.strictEqual(zipJson.intake.sourceKind, "zip");
  assert.strictEqual(zipJson.summary.staged, 1);
  assert.strictEqual(zipJson.summary.unsupported, 1);
  assert(zipJson.summary.warnings.includes("UNSUPPORTED_ARTIFACTS_PRESENT"));
  assert(zipJson.artifacts.some((artifact) => artifact.sourceRelativePath === "docs/z.md" && artifact.status === "STAGED"));
  assert(zipJson.artifacts.some((artifact) => artifact.sourceRelativePath === "nested/archive.zip" && artifact.reason === "NESTED_ARCHIVE_UNSUPPORTED"));

  const utf8Zip = path.join(tempRoot, "utf8.zip");
  createStoredZip(utf8Zip, [
    { name: "docs/cafe-\u00e9.md", data: "utf8\n", flags: 0x0800 }
  ]);
  const utf8Run = runIntake(writeInput(tempRoot, utf8Zip));
  assert.strictEqual(utf8Run.status, 0, utf8Run.stderr || utf8Run.stdout);
  const utf8Json = parseRun(utf8Run);
  assertManifest(utf8Json, "PASS");
  assert.strictEqual(utf8Json.artifacts[0].sourceRelativePath, "docs/cafe-\u00e9.md");

  const cp437Zip = path.join(tempRoot, "cp437.zip");
  createStoredZip(cp437Zip, [
    { rawName: rawNameBytes("docs/ascii.md"), data: "ascii\n", flags: 0 },
    { rawName: rawNameBytes("docs/cafe-", [0x82], ".md"), data: "cp437-e\n", flags: 0 },
    { rawName: rawNameBytes("docs/latin-", [0x80, 0x9c, 0xa5], ".md"), data: "cp437-latin\n", flags: 0 },
    { rawName: rawNameBytes("docs/box-", [0xc4], ".md"), data: "cp437-box\n", flags: 0 },
    { rawName: rawNameBytes("docs/symbol-", [0xf1], ".md"), data: "cp437-symbol\n", flags: 0 }
  ]);
  const cp437Run = runIntake(writeInput(tempRoot, cp437Zip));
  assert.strictEqual(cp437Run.status, 0, cp437Run.stderr || cp437Run.stdout);
  const cp437Json = parseRun(cp437Run);
  assertManifest(cp437Json, "PASS");
  const cp437Paths = cp437Json.artifacts.map((artifact) => artifact.sourceRelativePath);
  assert(cp437Paths.includes("docs/ascii.md"));
  assert(cp437Paths.includes("docs/cafe-\u00e9.md"));
  assert(cp437Paths.includes("docs/latin-\u00c7\u00a3\u00d1.md"));
  assert(cp437Paths.includes("docs/box-\u2500.md"));
  assert(cp437Paths.includes("docs/symbol-\u00b1.md"));
  const cp437Repeat = runIntake(writeInput(tempRoot, cp437Zip));
  assert.strictEqual(cp437Repeat.status, 0, cp437Repeat.stderr || cp437Repeat.stdout);
  assert.deepStrictEqual(normalizeResult(parseRun(cp437Repeat)), normalizeResult(cp437Json));

  const malformedNameZip = path.join(tempRoot, "malformed-name.zip");
  createStoredZip(malformedNameZip, [
    { rawName: [0xc3, 0x28], data: "bad\n", flags: 0x0800 },
    { name: "safe.md", data: "safe\n" }
  ]);
  const malformedNameRun = runIntake(writeInput(tempRoot, malformedNameZip));
  assert.notStrictEqual(malformedNameRun.status, 0);
  const malformedNameJson = parseRun(malformedNameRun);
  assertManifest(malformedNameJson, "FAIL");
  assertArtifactReason(malformedNameJson, "ZIP_ENTRY_NAME_DECODING_FAILED");
  assert(malformedNameJson.artifacts.some((artifact) => artifact.sourceRelativePath === "safe.md"));

  const collisionZip = path.join(tempRoot, "collision.zip");
  createStoredZip(collisionZip, [
    { name: "dup.md", data: "one\n" },
    { name: "dup.md", data: "two\n" }
  ]);
  const collisionRun = runIntake(writeInput(tempRoot, collisionZip));
  assert.notStrictEqual(collisionRun.status, 0);
  const collisionJson = parseRun(collisionRun);
  assertArtifactReason(collisionJson, "DUPLICATE_NORMALIZED_PATH_REJECTED");

  const caseCollisionZip = path.join(tempRoot, "case-collision.zip");
  createStoredZip(caseCollisionZip, [
    { name: "Case.md", data: "one\n" },
    { name: "case.md", data: "two\n" }
  ]);
  const caseCollisionRun = runIntake(writeInput(tempRoot, caseCollisionZip));
  assert.notStrictEqual(caseCollisionRun.status, 0);
  assertArtifactReason(parseRun(caseCollisionRun), "CASE_COLLISION_REJECTED");

  const unsafeZip = path.join(tempRoot, "unsafe.zip");
  createStoredZip(unsafeZip, [
    { name: "safe.md", data: "safe\n" },
    { name: "../escape.md", data: "escape\n" },
    { name: "dir\\bad.md", data: "bad\n" },
    { name: "CON.txt", data: "reserved\n" },
    { name: "ads.txt:payload", data: "ads\n" },
    { name: "traildot./a.md", data: "dot\n" },
    { name: "trailspace /a.md", data: "space\n" }
  ]);
  const unsafeRun = runIntake(writeInput(tempRoot, unsafeZip));
  assert.notStrictEqual(unsafeRun.status, 0);
  const unsafeJson = parseRun(unsafeRun);
  assert(unsafeJson.artifacts.some((artifact) => artifact.sourceRelativePath === "safe.md" && artifact.status === "STAGED"));
  assertArtifactReason(unsafeJson, "ARCHIVE_TRAVERSAL_REJECTED");
  assertArtifactReason(unsafeJson, "ARCHIVE_BACKSLASH_PATH_REJECTED");
  assertArtifactReason(unsafeJson, "WINDOWS_RESERVED_NAME_REJECTED");
  assertArtifactReason(unsafeJson, "WINDOWS_HOSTILE_PATH_SEGMENT_REJECTED");

  const junctionSourceRoot = path.join(tempRoot, "junction-source");
  const junctionTarget = path.join(tempRoot, "junction-target");
  fs.mkdirSync(junctionSourceRoot);
  fs.mkdirSync(junctionTarget);
  fs.writeFileSync(path.join(junctionTarget, "hidden.md"), "hidden");
  let junctionExecutable = false;
  try {
    fs.symlinkSync(junctionTarget, path.join(junctionSourceRoot, "junction"), "junction");
    junctionExecutable = true;
  } catch (error) {
    junctionExecutable = false;
  }
  if (junctionExecutable) {
    const junctionRun = runIntake(writeInput(tempRoot, junctionSourceRoot));
    assert.notStrictEqual(junctionRun.status, 0);
    assertArtifactReason(parseRun(junctionRun), "JUNCTION_REJECTED");
  }

  const reorderedA = path.join(tempRoot, "reordered-a.zip");
  const reorderedB = path.join(tempRoot, "reordered-b.zip");
  createStoredZip(reorderedA, [
    { name: "b.md", data: "b\n" },
    { name: "a.md", data: "a\n" }
  ]);
  createStoredZip(reorderedB, [
    { name: "a.md", data: "a\n" },
    { name: "b.md", data: "b\n" }
  ]);
  const reorderedAJson = parseRun(runIntake(writeInput(tempRoot, reorderedA)));
  const reorderedBJson = parseRun(runIntake(writeInput(tempRoot, reorderedB)));
  assert.deepStrictEqual(reorderedAJson.artifacts.map((artifact) => artifact.sourceRelativePath), reorderedBJson.artifacts.map((artifact) => artifact.sourceRelativePath));

  const encryptedZip = path.join(tempRoot, "encrypted.zip");
  createStoredZip(encryptedZip, [
    { name: "secret.md", data: "secret\n", flags: 0x0801 }
  ]);
  const encryptedRun = runIntake(writeInput(tempRoot, encryptedZip));
  assert.notStrictEqual(encryptedRun.status, 0);
  assertArtifactReason(parseRun(encryptedRun), "ZIP_MEMBER_ENCRYPTED_REJECTED");

  const unsupportedCompressionZip = path.join(tempRoot, "unsupported-compression.zip");
  createStoredZip(unsupportedCompressionZip, [
    { name: "method.md", data: "method\n", method: 99 }
  ]);
  const unsupportedCompressionRun = runIntake(writeInput(tempRoot, unsupportedCompressionZip));
  assert.notStrictEqual(unsupportedCompressionRun.status, 0);
  assertArtifactReason(parseRun(unsupportedCompressionRun), "ZIP_COMPRESSION_METHOD_UNSUPPORTED");

  const crcZip = path.join(tempRoot, "crc.zip");
  createStoredZip(crcZip, [
    { name: "crc.md", data: "crc\n", crc: 0 }
  ]);
  const crcRun = runIntake(writeInput(tempRoot, crcZip));
  assert.notStrictEqual(crcRun.status, 0);
  assertArtifactReason(parseRun(crcRun), "ZIP_MEMBER_INTEGRITY_REJECTED");

  const localMismatchZip = path.join(tempRoot, "local-mismatch.zip");
  createStoredZip(localMismatchZip, [
    { name: "central.md", localRawName: Buffer.from("local.md", "utf8"), data: "mismatch\n" }
  ]);
  const localMismatchRun = runIntake(writeInput(tempRoot, localMismatchZip));
  assert.notStrictEqual(localMismatchRun.status, 0);
  assertArtifactReason(parseRun(localMismatchRun), "ZIP_MEMBER_INTEGRITY_REJECTED");

  const truncatedZip = path.join(tempRoot, "truncated.zip");
  createStoredZip(truncatedZip, [
    { name: "truncated.md", data: "short\n", compressedSize: 100, uncompressedSize: 100 }
  ]);
  const truncatedRun = runIntake(writeInput(tempRoot, truncatedZip));
  assert.notStrictEqual(truncatedRun.status, 0);
  assertArtifactReason(parseRun(truncatedRun), "ZIP_MEMBER_INTEGRITY_REJECTED");

  const boundaryZip = path.join(tempRoot, "boundary.zip");
  const boundaryEntries = [];
  for (let index = 0; index < 5001; index += 1) {
    boundaryEntries.push({ name: `bulk/${String(index).padStart(4, "0")}.png`, data: "x" });
  }
  createStoredZip(boundaryZip, boundaryEntries);
  const boundaryRun = runIntake(writeInput(tempRoot, boundaryZip));
  assert.notStrictEqual(boundaryRun.status, 0);
  const boundaryJson = parseRun(boundaryRun);
  assert.strictEqual(boundaryJson.summary.totalDiscovered, 5000);
  assertFailureCode(boundaryJson, "FILE_COUNT_LIMIT_EXCEEDED");
  assert(boundaryJson.artifacts.every((artifact) => artifact.status === "UNSUPPORTED"));

  const oversizedFile = path.join(tempRoot, "oversized.md");
  writeSparseFile(oversizedFile, maxIndividualFileBytes + 1);
  const oversizedRun = runIntake(writeInput(tempRoot, oversizedFile));
  assert.notStrictEqual(oversizedRun.status, 0);
  const oversizedJson = parseRun(oversizedRun);
  assertArtifactReason(oversizedJson, "FILE_SIZE_LIMIT_EXCEEDED");
  assert.strictEqual(oversizedJson.summary.totalSourceBytes, maxIndividualFileBytes + 1);

  const justBelowFile = path.join(tempRoot, "just-below.md");
  writeSparseFile(justBelowFile, maxIndividualFileBytes - 1);
  const justBelowRun = runIntake(writeInput(tempRoot, justBelowFile));
  assert.strictEqual(justBelowRun.status, 0, justBelowRun.stderr || justBelowRun.stdout);
  const justBelowJson = parseRun(justBelowRun);
  assertManifest(justBelowJson, "PASS");
  assert.strictEqual(justBelowJson.summary.totalStagedBytes, maxIndividualFileBytes - 1);

  const exactFile = path.join(tempRoot, "exact.md");
  writeSparseFile(exactFile, maxIndividualFileBytes);
  const exactRun = runIntake(writeInput(tempRoot, exactFile));
  assert.strictEqual(exactRun.status, 0, exactRun.stderr || exactRun.stdout);
  const exactJson = parseRun(exactRun);
  assertManifest(exactJson, "PASS");
  assert.strictEqual(exactJson.summary.totalStagedBytes, maxIndividualFileBytes);

  const archiveOver = path.join(tempRoot, "archive-over.zip");
  writeSparseFile(archiveOver, maxSourceArchiveBytes + 1);
  const archiveOverRun = runIntake(writeInput(tempRoot, archiveOver));
  assert.notStrictEqual(archiveOverRun.status, 0);
  const archiveOverJson = parseRun(archiveOverRun);
  assertFailureCode(archiveOverJson, "ARCHIVE_SIZE_LIMIT_EXCEEDED");
  assert.strictEqual(archiveOverJson.summary.totalSourceBytes, maxSourceArchiveBytes + 1);

  const archiveExact = path.join(tempRoot, "archive-exact.zip");
  createSparseStoredZip(archiveExact, "large.bin", maxSourceArchiveBytes - 116);
  const archiveExactRun = runIntake(writeInput(tempRoot, archiveExact));
  assert.notStrictEqual(archiveExactRun.status, 0);
  const archiveExactJson = parseRun(archiveExactRun);
  assert.notStrictEqual(archiveExactJson.failures[0].code, "ARCHIVE_SIZE_LIMIT_EXCEEDED");
  assert.strictEqual(fs.statSync(archiveExact).size, maxSourceArchiveBytes);

  const archiveBelow = path.join(tempRoot, "archive-below.zip");
  createSparseStoredZip(archiveBelow, "large.bin", maxSourceArchiveBytes - 117);
  const archiveBelowRun = runIntake(writeInput(tempRoot, archiveBelow));
  assert.notStrictEqual(archiveBelowRun.status, 0);
  const archiveBelowJson = parseRun(archiveBelowRun);
  assert.notStrictEqual(archiveBelowJson.failures[0].code, "ARCHIVE_SIZE_LIMIT_EXCEEDED");
  assert.strictEqual(fs.statSync(archiveBelow).size, maxSourceArchiveBytes - 1);

  const mutationFile = path.join(tempRoot, "mutating.md");
  fs.writeFileSync(mutationFile, "before");
  const mutationRun = runIntake(writeInput(tempRoot, mutationFile), mutationHookEnv(tempRoot, mutationFile, "append-after-read"));
  assert.notStrictEqual(mutationRun.status, 0);
  const mutationJson = parseRun(mutationRun);
  assertArtifactReason(mutationJson, "SOURCE_MUTATION_DETECTED");
  assert.strictEqual(mutationJson.intake.downstreamEligibility, "NOT_ELIGIBLE");
  assert(!fs.existsSync(path.join(repositoryRoot, mutationJson.intake.snapshotRoot)));

  const sameSizeFile = path.join(tempRoot, "same-size.md");
  fs.writeFileSync(sameSizeFile, "same-size");
  const sameSizeRun = runIntake(writeInput(tempRoot, sameSizeFile), mutationHookEnv(tempRoot, sameSizeFile, "rewrite-same-after-read"));
  assert.strictEqual(sameSizeRun.status, 0, sameSizeRun.stderr || sameSizeRun.stdout);
  assertManifest(parseRun(sameSizeRun), "PASS");

  const zipMutationAtParse = path.join(tempRoot, "zip-mutation-parse.zip");
  createStoredZip(zipMutationAtParse, [{ name: "a.md", data: "a\n" }]);
  const zipMutationParseRun = runIntake(writeInput(tempRoot, zipMutationAtParse), mutationHookEnv(tempRoot, zipMutationAtParse, "append-after-read"));
  assert.notStrictEqual(zipMutationParseRun.status, 0);
  assertFailureCode(parseRun(zipMutationParseRun), "SOURCE_MUTATION_DETECTED");

  const zipMutationAtMember = path.join(tempRoot, "zip-mutation-member.zip");
  createDeflatedZip(zipMutationAtMember, "a.md", "a\n");
  const zipMutationMemberRun = runIntake(writeInput(tempRoot, zipMutationAtMember), mutationHookEnv(tempRoot, zipMutationAtMember, "append-during-inflate"));
  assert.notStrictEqual(zipMutationMemberRun.status, 0);
  assertFailureCode(parseRun(zipMutationMemberRun), "SOURCE_MUTATION_DETECTED");

  const totalBelowRoot = path.join(tempRoot, "total-below");
  fs.mkdirSync(totalBelowRoot);
  for (let index = 0; index < 7; index += 1) writeSparseFile(path.join(totalBelowRoot, `f${index}.md`), maxIndividualFileBytes);
  writeSparseFile(path.join(totalBelowRoot, "last.md"), maxIndividualFileBytes - 1);
  const totalBelowRun = runIntake(writeInput(tempRoot, totalBelowRoot));
  assert.strictEqual(totalBelowRun.status, 0, totalBelowRun.stderr || totalBelowRun.stdout);
  assert.strictEqual(parseRun(totalBelowRun).summary.totalStagedBytes, (maxIndividualFileBytes * 8) - 1);

  const totalExactRoot = path.join(tempRoot, "total-exact");
  fs.mkdirSync(totalExactRoot);
  for (let index = 0; index < 8; index += 1) writeSparseFile(path.join(totalExactRoot, `f${index}.md`), maxIndividualFileBytes);
  const totalExactRun = runIntake(writeInput(tempRoot, totalExactRoot));
  assert.strictEqual(totalExactRun.status, 0, totalExactRun.stderr || totalExactRun.stdout);
  assert.strictEqual(parseRun(totalExactRun).summary.totalStagedBytes, maxIndividualFileBytes * 8);

  const totalAboveRoot = path.join(tempRoot, "total-above");
  fs.mkdirSync(totalAboveRoot);
  for (let index = 0; index < 8; index += 1) writeSparseFile(path.join(totalAboveRoot, `f${index}.md`), maxIndividualFileBytes);
  fs.writeFileSync(path.join(totalAboveRoot, "overflow.md"), "x");
  const totalAboveRun = runIntake(writeInput(tempRoot, totalAboveRoot));
  assert.notStrictEqual(totalAboveRun.status, 0);
  const totalAboveJson = parseRun(totalAboveRun);
  assertArtifactReason(totalAboveJson, "TOTAL_BYTE_LIMIT_EXCEEDED");
  assertFailureCode(totalAboveJson, "TOTAL_BYTE_LIMIT_EXCEEDED");
  assert(totalAboveJson.summary.limitViolations.includes("TOTAL_BYTE_LIMIT_EXCEEDED"));

  const deflatedZip = path.join(tempRoot, "deflated.zip");
  createDeflatedZip(deflatedZip, "deflated.md", "deflated content\n");
  const deflatedRun = runIntake(writeInput(tempRoot, deflatedZip));
  assert.strictEqual(deflatedRun.status, 0, deflatedRun.stderr || deflatedRun.stdout);
  assertManifest(parseRun(deflatedRun), "PASS");

  const deflatedTruncatedZip = path.join(tempRoot, "deflated-truncated.zip");
  createStoredZip(deflatedTruncatedZip, [
    { name: "bad.md", data: "not deflated", method: 8 }
  ]);
  const deflatedTruncatedRun = runIntake(writeInput(tempRoot, deflatedTruncatedZip));
  assert.notStrictEqual(deflatedTruncatedRun.status, 0);
  assertArtifactReason(parseRun(deflatedTruncatedRun), "ZIP_MEMBER_INTEGRITY_REJECTED");

  const lockRoot = path.join(repositoryRoot, "tmp", "gt63-machine-intake");
  const incompletePath = path.join(lockRoot, `incomplete-${firstJson.intake.intakeId}`);
  const finalizedPath = path.join(lockRoot, firstJson.intake.intakeId);
  const otherIntakePath = path.join(lockRoot, "intake-other-cross-cleanup-check");
  fs.mkdirSync(path.join(lockRoot, `lock-${firstJson.intake.intakeId}`), { recursive: true });
  try {
    const lockedInput = writeInput(tempRoot, sourceRoot);
    const lockedRun = runIntake(lockedInput);
    assert.notStrictEqual(lockedRun.status, 0);
    assertFailureCode(parseRun(lockedRun), "INTAKE_ALREADY_RUNNING");
  } finally {
    fs.rmSync(path.join(lockRoot, `lock-${firstJson.intake.intakeId}`), { recursive: true, force: true });
  }

  fs.mkdirSync(incompletePath, { recursive: true });
  fs.writeFileSync(path.join(incompletePath, "stale.txt"), "stale");
  fs.mkdirSync(otherIntakePath, { recursive: true });
  const staleIncompleteRun = runIntake(writeInput(tempRoot, sourceRoot));
  assert.strictEqual(staleIncompleteRun.status, 0, staleIncompleteRun.stderr || staleIncompleteRun.stdout);
  assert(!fs.existsSync(path.join(incompletePath, "stale.txt")));
  assert(fs.existsSync(otherIntakePath), "other intake state must not be cleaned");

  fs.mkdirSync(incompletePath, { recursive: true });
  fs.writeFileSync(path.join(incompletePath, "stale.txt"), "stale");
  fs.mkdirSync(finalizedPath, { recursive: true });
  fs.writeFileSync(path.join(finalizedPath, "old.txt"), "old");
  const staleBothRun = runIntake(writeInput(tempRoot, sourceRoot));
  assert.strictEqual(staleBothRun.status, 0, staleBothRun.stderr || staleBothRun.stdout);
  assert(!fs.existsSync(path.join(incompletePath, "stale.txt")));
  assert(!fs.existsSync(path.join(finalizedPath, "old.txt")));

  for (const combo of [
    { incomplete: false, finalized: false },
    { incomplete: true, finalized: false },
    { incomplete: false, finalized: true },
    { incomplete: true, finalized: true }
  ]) {
    fs.rmSync(incompletePath, { recursive: true, force: true });
    fs.rmSync(finalizedPath, { recursive: true, force: true });
    fs.mkdirSync(path.join(lockRoot, `lock-${firstJson.intake.intakeId}`), { recursive: true });
    if (combo.incomplete) fs.mkdirSync(incompletePath, { recursive: true });
    if (combo.finalized) fs.mkdirSync(finalizedPath, { recursive: true });
    try {
      const lockedComboRun = runIntake(writeInput(tempRoot, sourceRoot));
      assert.notStrictEqual(lockedComboRun.status, 0);
      assertFailureCode(parseRun(lockedComboRun), "INTAKE_ALREADY_RUNNING");
    } finally {
      fs.rmSync(path.join(lockRoot, `lock-${firstJson.intake.intakeId}`), { recursive: true, force: true });
      fs.rmSync(incompletePath, { recursive: true, force: true });
    }
  }
  fs.rmSync(otherIntakePath, { recursive: true, force: true });

  const existingWorkflowInput = path.join(tempRoot, "existing-workflow-external-input.json");
  fs.writeFileSync(existingWorkflowInput, JSON.stringify({
    workflow: "local-repository-bootstrap",
    repositoryPath: sourceRoot
  }));
  const existingWorkflow = runNode([runBootstrap, "--config", configPath, "--input", existingWorkflowInput]);
  assert.notStrictEqual(existingWorkflow.status, 0);
  const existingWorkflowJson = parseSingleJson(existingWorkflow.stdout);
  assert.strictEqual(existingWorkflowJson.failures[0].code, "INPUT_PATH_INVALID");

  assertNoRemainingNodeProcesses();
  process.stdout.write("GT63 MACHINE EXTERNAL ARTIFACT INTAKE REGRESSION = PASS\n");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
