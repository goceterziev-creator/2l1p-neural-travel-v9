"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const LIMITS = {
  maxSourceArchiveBytes: 52428800,
  maxExtractedTotalBytes: 209715200,
  maxDiscoveredArtifacts: 5000,
  maxIndividualFileBytes: 26214400,
  maxArchiveNestingDepth: 1,
  maxNormalizedRelativePathLength: 240
};

const SUPPORTED_EXTENSIONS = new Set([".css", ".csv", ".html", ".htm", ".js", ".json", ".md", ".pdf", ".txt"]);
const RESERVED_WINDOWS_NAMES = new Set(["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]);
const CP437_EXTENDED = [
  "\u00c7", "\u00fc", "\u00e9", "\u00e2", "\u00e4", "\u00e0", "\u00e5", "\u00e7",
  "\u00ea", "\u00eb", "\u00e8", "\u00ef", "\u00ee", "\u00ec", "\u00c4", "\u00c5",
  "\u00c9", "\u00e6", "\u00c6", "\u00f4", "\u00f6", "\u00f2", "\u00fb", "\u00f9",
  "\u00ff", "\u00d6", "\u00dc", "\u00a2", "\u00a3", "\u00a5", "\u20a7", "\u0192",
  "\u00e1", "\u00ed", "\u00f3", "\u00fa", "\u00f1", "\u00d1", "\u00aa", "\u00ba",
  "\u00bf", "\u2310", "\u00ac", "\u00bd", "\u00bc", "\u00a1", "\u00ab", "\u00bb",
  "\u2591", "\u2592", "\u2593", "\u2502", "\u2524", "\u2561", "\u2562", "\u2556",
  "\u2555", "\u2563", "\u2551", "\u2557", "\u255d", "\u255c", "\u255b", "\u2510",
  "\u2514", "\u2534", "\u252c", "\u251c", "\u2500", "\u253c", "\u255e", "\u255f",
  "\u255a", "\u2554", "\u2569", "\u2566", "\u2560", "\u2550", "\u256c", "\u2567",
  "\u2568", "\u2564", "\u2565", "\u2559", "\u2558", "\u2552", "\u2553", "\u256b",
  "\u256a", "\u2518", "\u250c", "\u2588", "\u2584", "\u258c", "\u2590", "\u2580",
  "\u03b1", "\u00df", "\u0393", "\u03c0", "\u03a3", "\u03c3", "\u00b5", "\u03c4",
  "\u03a6", "\u0398", "\u03a9", "\u03b4", "\u221e", "\u03c6", "\u03b5", "\u2229",
  "\u2261", "\u00b1", "\u2265", "\u2264", "\u2320", "\u2321", "\u00f7", "\u2248",
  "\u00b0", "\u2219", "\u00b7", "\u221a", "\u207f", "\u00b2", "\u25a0", "\u00a0"
];

const FAILURE_MESSAGES = {
  EXTERNAL_INPUT_MISSING: "externalSourcePath is required.",
  EXTERNAL_INPUT_NOT_FOUND: "External input was not found.",
  EXTERNAL_INPUT_UNREADABLE: "External input is unreadable.",
  EXTERNAL_INPUT_TYPE_UNSUPPORTED: "External input type is unsupported.",
  EXTERNAL_INPUT_NETWORK_PATH_REJECTED: "Network paths are rejected.",
  EXTERNAL_INPUT_DRIVE_ROOT_REJECTED: "Drive roots are rejected.",
  EXTERNAL_INPUT_LINK_ROOT_REJECTED: "External input root cannot be a link or reparse point.",
  INTAKE_ALREADY_RUNNING: "An intake with this deterministic intakeId is already running.",
  ARCHIVE_SIZE_LIMIT_EXCEEDED: "Source archive size limit was exceeded.",
  ARCHIVE_TRAVERSAL_REJECTED: "Archive entry traversal was rejected.",
  ARCHIVE_ABSOLUTE_PATH_REJECTED: "Archive absolute path was rejected.",
  ARCHIVE_DRIVE_LETTER_REJECTED: "Archive drive-letter path was rejected.",
  ARCHIVE_UNC_PATH_REJECTED: "Archive UNC path was rejected.",
  ARCHIVE_BACKSLASH_PATH_REJECTED: "Archive backslash path was rejected.",
  ZIP_ENTRY_NAME_DECODING_FAILED: "ZIP entry name decoding failed.",
  ARCHIVE_SYMLINK_REJECTED: "Archive symlink entry was rejected.",
  ARCHIVE_HARDLINK_REJECTED: "Archive hardlink entry was rejected.",
  ARCHIVE_SPECIAL_FILE_REJECTED: "Archive special entry was rejected.",
  DECOMPRESSION_LIMIT_EXCEEDED: "Decompression limit was exceeded.",
  SYMLINK_REJECTED: "Symlink was rejected.",
  JUNCTION_REJECTED: "Junction was rejected.",
  REPARSE_POINT_REJECTED: "Reparse point was rejected.",
  SPECIAL_FILE_REJECTED: "Special file was rejected.",
  FILE_COUNT_LIMIT_EXCEEDED: "File count limit was exceeded.",
  TOTAL_BYTE_LIMIT_EXCEEDED: "Total byte limit was exceeded.",
  FILE_SIZE_LIMIT_EXCEEDED: "Individual file size limit was exceeded.",
  SOURCE_MUTATION_DETECTED: "Source changed during intake.",
  ARCHIVE_DEPTH_LIMIT_EXCEEDED: "Archive nesting depth limit was exceeded.",
  NORMALIZED_PATH_LENGTH_EXCEEDED: "Normalized path length limit was exceeded.",
  WINDOWS_RESERVED_NAME_REJECTED: "Windows reserved name was rejected.",
  DUPLICATE_NORMALIZED_PATH_REJECTED: "Duplicate normalized path was rejected.",
  CASE_COLLISION_REJECTED: "Case-colliding normalized path was rejected.",
  STAGING_ROOT_ESCAPE_REJECTED: "Staging root escape was rejected.",
  WINDOWS_HOSTILE_PATH_SEGMENT_REJECTED: "Windows-hostile path segment was rejected.",
  ZIP_MEMBER_ENCRYPTED_REJECTED: "Encrypted ZIP member was rejected.",
  ZIP_COMPRESSION_METHOD_UNSUPPORTED: "ZIP compression method is unsupported.",
  ZIP_MEMBER_INTEGRITY_REJECTED: "ZIP member integrity validation failed.",
  STAGING_ROOT_UNTRUSTED: "Staging root is untrusted.",
  STAGING_FAILURE: "Staging failed.",
  STAGING_FINALIZATION_FAILED: "Staging finalization failed.",
  MANIFEST_FAILURE: "Manifest generation failed.",
  EMPTY_INPUT: "No artifacts were discovered.",
  NO_STAGED_ARTIFACTS: "No artifacts were staged."
};

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
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

function slashPath(value) {
  return value.split(path.sep).join("/").normalize("NFC");
}

function asciiLower(value) {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

function normalizeAbsolute(sourcePath) {
  const raw = String(sourcePath);
  const lower = raw.toLowerCase();
  if (raw.startsWith("//") || raw.startsWith("\\\\") || raw.startsWith("//?/UNC/") || raw.startsWith("\\\\?\\UNC\\") || lower.startsWith("file://") || lower.startsWith("smb://") || lower.startsWith("nfs://")) {
    return { ok: false, code: "EXTERNAL_INPUT_NETWORK_PATH_REJECTED" };
  }
  const resolved = path.resolve(raw);
  const parsed = path.parse(resolved);
  if (resolved === parsed.root) {
    return { ok: false, code: "EXTERNAL_INPUT_DRIVE_ROOT_REJECTED" };
  }
  let normalized = slashPath(resolved);
  normalized = normalized.replace(/\/+$/u, "");
  if (/^[a-z]:/u.test(normalized)) {
    normalized = normalized[0].toUpperCase() + normalized.slice(1);
  }
  return { ok: true, path: resolved, normalized };
}

function extensionFor(relativePath) {
  const basename = relativePath.split("/").pop();
  const lastDot = basename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === basename.length - 1) {
    return null;
  }
  if (lastDot === 0 && basename.indexOf(".", 1) === -1) {
    return null;
  }
  return asciiLower(basename.slice(lastDot));
}

function makeFailure(code, pathValue) {
  return {
    code,
    message: FAILURE_MESSAGES[code],
    path: pathValue === undefined ? null : pathValue
  };
}

function preStagingFailure({ code, workflow, sourceKind = null, sourcePath = null, intakeId = null, totalSourceBytes = 0 }) {
  return manifest({
    status: "FAIL",
    sourceKind,
    sourcePath,
    intakeId,
    stagingAssigned: false,
    artifacts: [],
    failures: [makeFailure(code)],
    totalSourceBytes,
    totalStagedBytes: 0
  });
}

function canonicalSeed(sourceKind, sourcePath, sourceSizeBytes) {
  return `{"contract":"GT63_WORKFLOW_6_EXTERNAL_ARTIFACT_INTAKE_V1","sourceKind":"${sourceKind}","sourceIdentity":"${sourcePath}","sourceSizeBytes":${sourceSizeBytes === null ? "null" : sourceSizeBytes},"limits":{"maxSourceArchiveBytes":52428800,"maxExtractedTotalBytes":209715200,"maxDiscoveredArtifacts":5000,"maxIndividualFileBytes":26214400,"maxArchiveNestingDepth":1,"maxNormalizedRelativePathLength":240}}`;
}

function intakeIdFor(sourceKind, sourcePath, sourceSizeBytes) {
  return `intake-${sha256(Buffer.from(canonicalSeed(sourceKind, sourcePath, sourceSizeBytes), "utf8"))}`;
}

function safeLstat(target) {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    return null;
  }
}

function linkRejectionReason(fullPath, stat) {
  if (!stat || !stat.isSymbolicLink()) return null;
  if (process.platform === "win32") {
    try {
      const targetPath = fs.readlinkSync(fullPath);
      const resolvedTarget = path.isAbsolute(targetPath) ? targetPath : path.resolve(path.dirname(fullPath), targetPath);
      const targetStat = safeLstat(resolvedTarget);
      if (targetStat && targetStat.isDirectory()) return "JUNCTION_REJECTED";
    } catch (error) {
      return "REPARSE_POINT_REJECTED";
    }
  }
  return "SYMLINK_REJECTED";
}

function validateStagingRoot(workspaceRoot) {
  const tmpPath = path.join(workspaceRoot, "tmp");
  const rootPath = path.join(tmpPath, "gt63-machine-intake");
  for (const target of [tmpPath, rootPath]) {
    const stat = safeLstat(target);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
      return { ok: false };
    }
  }
  fs.mkdirSync(rootPath, { recursive: true });
  return { ok: true, rootPath };
}

function ensureInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function removePath(target, root) {
  if (fs.existsSync(target)) {
    if (!ensureInside(root, target)) {
      throw new Error("staging escape");
    }
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function acquireStaging(workspaceRoot, intakeId) {
  const validation = validateStagingRoot(workspaceRoot);
  if (!validation.ok) {
    return { ok: false, code: "STAGING_ROOT_UNTRUSTED" };
  }
  const root = validation.rootPath;
  const lockPath = path.join(root, `lock-${intakeId}`);
  const incompletePath = path.join(root, `incomplete-${intakeId}`);
  const finalPath = path.join(root, intakeId);
  if (fs.existsSync(lockPath)) {
    return { ok: false, code: "INTAKE_ALREADY_RUNNING", root, lockPath, incompletePath, finalPath };
  }
  try {
    fs.mkdirSync(lockPath);
    removePath(incompletePath, root);
    removePath(finalPath, root);
    fs.mkdirSync(path.join(incompletePath, "snapshot"), { recursive: true });
    return { ok: true, root, lockPath, incompletePath, finalPath, snapshotPath: path.join(incompletePath, "snapshot") };
  } catch (error) {
    return { ok: false, code: "STAGING_FAILURE", root, lockPath, incompletePath, finalPath };
  }
}

function finalizeStaging(state, manifestObject) {
  const manifestPath = path.join(state.incompletePath, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifestObject, null, 2)}\n`);
  removePath(state.finalPath, state.root);
  try {
    fs.renameSync(state.incompletePath, state.finalPath);
  } catch (error) {
    fs.mkdirSync(state.finalPath, { recursive: true });
    fs.cpSync(state.incompletePath, state.finalPath, { recursive: true });
    fs.rmSync(state.incompletePath, { recursive: true, force: true });
  }
  try {
    fs.rmSync(state.lockPath, { recursive: true, force: true });
  } catch (error) {
    // Finalized intake remains the contract-visible result; stale lock handling is fail-closed.
  }
}

function cleanupFailure(state, manifestObject) {
  if (!state || !state.incompletePath) {
    return;
  }
  try {
    removePath(path.join(state.incompletePath, "snapshot"), state.root);
    fs.mkdirSync(state.incompletePath, { recursive: true });
    fs.writeFileSync(path.join(state.incompletePath, "manifest.json"), `${JSON.stringify(manifestObject, null, 2)}\n`);
    removePath(state.finalPath, state.root);
    try {
      fs.renameSync(state.incompletePath, state.finalPath);
    } catch (error) {
      fs.mkdirSync(state.finalPath, { recursive: true });
      fs.cpSync(state.incompletePath, state.finalPath, { recursive: true });
      fs.rmSync(state.incompletePath, { recursive: true, force: true });
    }
  } finally {
    if (state.lockPath && fs.existsSync(state.lockPath)) {
      fs.rmSync(state.lockPath, { recursive: true, force: true });
    }
  }
}

function normalizeRelative(relativePath) {
  return slashPath(relativePath).normalize("NFC");
}

function pathRejection(relativePath, isArchive) {
  if (isArchive && relativePath.includes("\\")) return "ARCHIVE_BACKSLASH_PATH_REJECTED";
  const normalized = normalizeRelative(relativePath);
  if (normalized.startsWith("/") || normalized.startsWith("\\")) return "ARCHIVE_ABSOLUTE_PATH_REJECTED";
  if (/^[A-Za-z]:/u.test(normalized)) return "ARCHIVE_DRIVE_LETTER_REJECTED";
  if (normalized.startsWith("//")) return "ARCHIVE_UNC_PATH_REJECTED";
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) return "ARCHIVE_TRAVERSAL_REJECTED";
  if (segments.some((segment) => segment === "")) return "ARCHIVE_TRAVERSAL_REJECTED";
  if (normalized.length > LIMITS.maxNormalizedRelativePathLength) return "NORMALIZED_PATH_LENGTH_EXCEEDED";
  for (const segment of segments) {
    if (isArchive && (segment.includes(":") || segment.endsWith(".") || segment.endsWith(" "))) return "WINDOWS_HOSTILE_PATH_SEGMENT_REJECTED";
    const stem = segment.split(".")[0].toUpperCase();
    if (RESERVED_WINDOWS_NAMES.has(stem)) return "WINDOWS_RESERVED_NAME_REJECTED";
  }
  return null;
}

function baseArtifact(fields) {
  const artifact = {
    status: fields.status,
    reason: fields.reason,
    sourceRelativePath: fields.sourceRelativePath,
    archiveEntryPath: fields.archiveEntryPath,
    stagedRelativePath: fields.stagedRelativePath,
    extension: fields.extension,
    sourceSizeBytes: fields.sourceSizeBytes,
    stagedSizeBytes: fields.stagedSizeBytes,
    sourceHash: fields.sourceHash,
    stagedHash: fields.stagedHash,
    provenance: {
      sourceKind: fields.sourceKind,
      originalSourcePath: fields.originalSourcePath,
      originalRelativePath: fields.originalRelativePath,
      archiveContainerPath: fields.archiveContainerPath
    }
  };
  for (const internalField of ["fullPath", "zipKey", "zipEntry"]) {
    if (Object.prototype.hasOwnProperty.call(fields, internalField)) {
      artifact[internalField] = fields[internalField];
    }
  }
  return artifact;
}

function artifactSortValue(value) {
  return value === null || value === undefined ? "" : String(value).normalize("NFC");
}

function sortArtifacts(artifacts) {
  artifacts.sort((a, b) => {
    const fields = ["sourceRelativePath", "archiveEntryPath", "stagedRelativePath", "status", "reason", "zipKey"];
    for (const field of fields) {
      const result = artifactSortValue(a[field]).localeCompare(artifactSortValue(b[field]), "en", { sensitivity: "variant" });
      if (result !== 0) return result;
    }
    return 0;
  });
}

function sortFailures(failures) {
  failures.sort((a, b) => {
    for (const field of ["code", "path", "message"]) {
      const result = artifactSortValue(a[field]).localeCompare(artifactSortValue(b[field]), "en", { sensitivity: "variant" });
      if (result !== 0) return result;
    }
    return 0;
  });
}

function manifest({ status, sourceKind, sourcePath, intakeId, stagingAssigned, artifacts, failures, totalSourceBytes, totalStagedBytes }) {
  const stagingRoot = stagingAssigned && intakeId ? `tmp/gt63-machine-intake/${intakeId}` : null;
  const snapshotRoot = stagingAssigned && intakeId ? `tmp/gt63-machine-intake/${intakeId}/snapshot` : null;
  const manifestPath = stagingAssigned && intakeId ? `tmp/gt63-machine-intake/${intakeId}/manifest.json` : null;
  const visibleArtifacts = artifacts.map((artifact) => {
    const clone = { ...artifact };
    delete clone.zipKey;
    return clone;
  });
  const warnings = [];
  if (visibleArtifacts.some((artifact) => artifact.status === "UNSUPPORTED")) warnings.push("UNSUPPORTED_ARTIFACTS_PRESENT");
  if (visibleArtifacts.some((artifact) => artifact.status === "UNREADABLE")) warnings.push("UNREADABLE_ARTIFACTS_PRESENT");
  const limitCodes = new Set(["ARCHIVE_SIZE_LIMIT_EXCEEDED", "FILE_COUNT_LIMIT_EXCEEDED", "TOTAL_BYTE_LIMIT_EXCEEDED", "FILE_SIZE_LIMIT_EXCEEDED", "ARCHIVE_DEPTH_LIMIT_EXCEEDED", "NORMALIZED_PATH_LENGTH_EXCEEDED", "DECOMPRESSION_LIMIT_EXCEEDED"]);
  const limitViolations = Array.from(new Set(failures.map((failure) => failure.code).filter((code) => limitCodes.has(code)))).sort();
  const counts = {
    staged: visibleArtifacts.filter((artifact) => artifact.status === "STAGED").length,
    unsupported: visibleArtifacts.filter((artifact) => artifact.status === "UNSUPPORTED").length,
    unreadable: visibleArtifacts.filter((artifact) => artifact.status === "UNREADABLE").length,
    rejected: visibleArtifacts.filter((artifact) => artifact.status === "REJECTED").length
  };
  sortFailures(failures);
  return {
    status,
    workflow: "external-artifact-intake",
    authority: "NONE",
    logicalDocumentName: "external-artifact-intake-manifest.json",
    intake: {
      intakeId,
      sourceKind,
      sourcePath,
      stagingRoot,
      snapshotRoot,
      manifestPath,
      downstreamEligibility: status === "PASS" ? "ELIGIBLE" : status === "PASS_WITH_WARNINGS" ? "ELIGIBLE_WITH_WARNINGS" : "NOT_ELIGIBLE"
    },
    limits: { ...LIMITS },
    summary: {
      totalDiscovered: visibleArtifacts.length,
      staged: counts.staged,
      unsupported: counts.unsupported,
      unreadable: counts.unreadable,
      rejected: counts.rejected,
      totalSourceBytes,
      totalStagedBytes,
      limitViolations,
      warnings
    },
    artifacts: visibleArtifacts,
    failures
  };
}

function classifySource(normalized, absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    return { ok: false, code: "EXTERNAL_INPUT_NOT_FOUND" };
  }
  let stat;
  try {
    stat = fs.lstatSync(absolutePath);
    fs.accessSync(absolutePath, fs.constants.R_OK);
  } catch (error) {
    return { ok: false, code: "EXTERNAL_INPUT_UNREADABLE" };
  }
  if (stat.isSymbolicLink()) {
    return { ok: false, code: "EXTERNAL_INPUT_LINK_ROOT_REJECTED" };
  }
  if (stat.isDirectory()) {
    return { ok: true, sourceKind: "directory", sourceSizeBytes: null };
  }
  if (!stat.isFile()) {
    return { ok: false, code: "EXTERNAL_INPUT_TYPE_UNSUPPORTED" };
  }
  const ext = extensionFor(normalized);
  if (ext === ".zip") {
    return { ok: true, sourceKind: "zip", sourceSizeBytes: stat.size };
  }
  if (SUPPORTED_EXTENSIONS.has(ext)) {
    return { ok: true, sourceKind: "file", sourceSizeBytes: stat.size };
  }
  return { ok: false, code: "EXTERNAL_INPUT_TYPE_UNSUPPORTED" };
}

function discoverDirectory(rootPath, normalizedSourcePath) {
  const artifacts = [];
  function walk(directory) {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "variant" }));
    } catch (error) {
      const rel = normalizeRelative(path.relative(rootPath, directory));
      return { ok: false, code: "EXTERNAL_INPUT_UNREADABLE", path: rel };
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      const rel = normalizeRelative(path.relative(rootPath, fullPath));
      const stat = safeLstat(fullPath);
      if (!stat) {
        artifacts.push(directoryArtifact("UNREADABLE", "SOURCE_READ_FAILED", rel, null, null, normalizedSourcePath));
      } else if (stat.isSymbolicLink()) {
        artifacts.push(directoryArtifact("REJECTED", linkRejectionReason(fullPath, stat), rel, null, null, normalizedSourcePath));
      } else if (entry.isDirectory()) {
        const result = walk(fullPath);
        if (result && !result.ok) return result;
      } else if (!stat.isFile()) {
        artifacts.push(directoryArtifact("REJECTED", "SPECIAL_FILE_REJECTED", rel, null, null, normalizedSourcePath));
      } else {
        artifacts.push(directoryArtifact("PENDING", null, rel, stat.size, fullPath, normalizedSourcePath));
      }
    }
    return { ok: true };
  }
  const result = walk(rootPath);
  if (result && !result.ok) return result;
  sortArtifacts(artifacts);
  return { ok: true, artifacts };
}

function directoryArtifact(status, reason, rel, size, fullPath, normalizedSourcePath) {
  const ext = extensionFor(rel);
  return baseArtifact({
    status,
    reason,
    sourceRelativePath: rel,
    archiveEntryPath: null,
    stagedRelativePath: status === "STAGED" ? `snapshot/${rel}` : null,
    extension: ext,
    sourceSizeBytes: size,
    stagedSizeBytes: null,
    sourceHash: null,
    stagedHash: null,
    sourceKind: "directory",
    originalSourcePath: normalizedSourcePath,
    originalRelativePath: rel,
    archiveContainerPath: null,
    fullPath
  });
}

function readStableFile(fullPath) {
  const before = fs.statSync(fullPath).size;
  const bytes = fs.readFileSync(fullPath);
  const after = fs.statSync(fullPath).size;
  if (before !== after) return { ok: false, code: "SOURCE_MUTATION_DETECTED" };
  return { ok: true, bytes, size: before };
}

function stageArtifact(artifact, state, sourceBytes, rel) {
  const target = path.join(state.snapshotPath, ...rel.split("/"));
  if (!ensureInside(state.snapshotPath, target)) {
    artifact.status = "REJECTED";
    artifact.reason = "STAGING_ROOT_ESCAPE_REJECTED";
    return false;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, sourceBytes);
  artifact.status = "STAGED";
  artifact.reason = null;
  artifact.stagedRelativePath = `snapshot/${rel}`;
  artifact.stagedSizeBytes = sourceBytes.length;
  artifact.sourceHash = sha256(sourceBytes);
  artifact.stagedHash = sha256(sourceBytes);
  return true;
}

function applyCollisions(artifacts) {
  const exact = new Map();
  const folded = new Map();
  for (const artifact of artifacts) {
    const key = artifact.stagedRelativePath || (artifact.status === "PENDING" ? `snapshot/${artifact.sourceRelativePath}` : null);
    if (!key) continue;
    if (!exact.has(key)) exact.set(key, []);
    exact.get(key).push(artifact);
    const lower = key.normalize("NFC").toLowerCase();
    if (!folded.has(lower)) folded.set(lower, []);
    folded.get(lower).push(artifact);
  }
  for (const group of exact.values()) {
    if (group.length > 1) {
      for (const artifact of group) {
        artifact.status = "REJECTED";
        artifact.reason = "DUPLICATE_NORMALIZED_PATH_REJECTED";
        artifact.stagedRelativePath = null;
      }
    }
  }
  for (const group of folded.values()) {
    if (group.length > 1) {
      for (const artifact of group) {
        if (artifact.reason !== "DUPLICATE_NORMALIZED_PATH_REJECTED") {
          artifact.status = "REJECTED";
          artifact.reason = "CASE_COLLISION_REJECTED";
          artifact.stagedRelativePath = null;
        }
      }
    }
  }
}

function finishArtifacts(artifacts, state) {
  const failures = [];
  let totalStagedBytes = 0;
  let totalSourceBytes = 0;
  applyCollisions(artifacts);
  for (const artifact of artifacts) {
    if (artifact.status === "PENDING") {
      const ext = artifact.extension;
      if (ext === ".zip" && artifact.provenance.sourceKind !== "zip") {
        artifact.status = "UNSUPPORTED";
        artifact.reason = "NESTED_ARCHIVE_UNSUPPORTED";
      } else if (!SUPPORTED_EXTENSIONS.has(ext)) {
        artifact.status = "UNSUPPORTED";
        artifact.reason = "UNSUPPORTED_EXTENSION";
      } else if (artifact.sourceSizeBytes > LIMITS.maxIndividualFileBytes) {
        artifact.status = "REJECTED";
        artifact.reason = "FILE_SIZE_LIMIT_EXCEEDED";
      } else {
        const readResult = readStableFile(artifact.fullPath);
        if (!readResult.ok) {
          artifact.status = "REJECTED";
          artifact.reason = readResult.code;
        } else if (totalStagedBytes + readResult.bytes.length > LIMITS.maxExtractedTotalBytes) {
          artifact.status = "REJECTED";
          artifact.reason = "TOTAL_BYTE_LIMIT_EXCEEDED";
        } else {
          stageArtifact(artifact, state, readResult.bytes, artifact.sourceRelativePath);
          totalStagedBytes += readResult.bytes.length;
        }
      }
    }
    if (artifact.status === "STAGED") totalSourceBytes += artifact.sourceSizeBytes || 0;
    if (artifact.status === "UNSUPPORTED") totalSourceBytes += artifact.sourceSizeBytes || 0;
    if (artifact.status === "REJECTED" && artifact.reason === "FILE_SIZE_LIMIT_EXCEEDED") totalSourceBytes += artifact.sourceSizeBytes || 0;
    if (artifact.status === "REJECTED") failures.push(makeFailure(artifact.reason, artifact.archiveEntryPath || artifact.sourceRelativePath));
    delete artifact.fullPath;
  }
  return { failures, totalStagedBytes, totalSourceBytes };
}

function processDirectFile(absolutePath, normalizedSourcePath) {
  const size = fs.statSync(absolutePath).size;
  const rel = normalizedSourcePath.split("/").pop();
  return [baseArtifact({
    status: "PENDING",
    reason: null,
    sourceRelativePath: rel,
    archiveEntryPath: null,
    stagedRelativePath: null,
    extension: extensionFor(rel),
    sourceSizeBytes: size,
    stagedSizeBytes: null,
    sourceHash: null,
    stagedHash: null,
    sourceKind: "file",
    originalSourcePath: normalizedSourcePath,
    originalRelativePath: rel,
    archiveContainerPath: null,
    fullPath: absolutePath
  })];
}

function hexNumber(value, width) {
  return value.toString(16).padStart(width, "0");
}

function parseZip(buffer, normalizedSourcePath) {
  const eocdSig = 0x06054b50;
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSig) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("missing eocd");
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("bad central directory");
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compSize = buffer.readUInt32LE(offset + 20);
    const uncompSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const internalAttrs = buffer.readUInt16LE(offset + 36);
    const externalAttrs = buffer.readUInt32LE(offset + 38);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const rawName = buffer.slice(offset + 46, offset + 46 + nameLength);
    const extra = buffer.slice(offset + 46 + nameLength, offset + 46 + nameLength + extraLength);
    const comment = buffer.slice(offset + 46 + nameLength + extraLength, offset + 46 + nameLength + extraLength + commentLength);
    const local = localHeaderKey(buffer, localOffset, rawName, flags, method);
    const dataStart = local.dataStart;
    const compressed = dataStart !== null && dataStart + compSize <= buffer.length ? buffer.slice(dataStart, dataStart + compSize) : null;
    const key = [
      rawName.toString("hex"),
      hexNumber(flags, 4),
      hexNumber(method, 4),
      hexNumber(crc, 8),
      String(compSize),
      String(uncompSize),
      hexNumber(internalAttrs, 4),
      hexNumber(externalAttrs, 8),
      extra.length ? sha256(extra) : "null",
      comment.length ? sha256(comment) : "null",
      local.key,
      compressed ? sha256(compressed) : "null"
    ].join("|");
    entries.push({ flags, method, crc, compSize, uncompSize, rawName, externalAttrs, compressed, localKey: local.key, zipKey: key, normalizedSourcePath });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  entries.sort((a, b) => a.zipKey.localeCompare(b.zipKey, "en", { sensitivity: "variant" }));
  return entries.map(zipEntryArtifact);
}

function localHeaderKey(buffer, offset, rawName, flags, method) {
  try {
    if (offset + 30 > buffer.length) return { key: "ERROR:TRUNCATED", dataStart: null };
    if (buffer.readUInt32LE(offset) !== 0x04034b50) return { key: "ERROR:MALFORMED", dataStart: null };
    const localFlags = buffer.readUInt16LE(offset + 6);
    const localMethod = buffer.readUInt16LE(offset + 8);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    if (offset + 30 + nameLength + extraLength > buffer.length) return { key: "ERROR:TRUNCATED", dataStart: null };
    const localName = buffer.slice(offset + 30, offset + 30 + nameLength);
    if (!localName.equals(rawName)) return { key: "ERROR:FILENAME_MISMATCH", dataStart: null };
    if (localMethod !== method) return { key: "ERROR:COMPRESSION_METHOD_MISMATCH", dataStart: null };
    if (localFlags !== flags) return { key: "ERROR:FLAGS_MISMATCH", dataStart: null };
    const header = buffer.slice(offset, offset + 30 + nameLength + extraLength);
    return { key: `OK:${sha256(header)}`, dataStart: offset + 30 + nameLength + extraLength };
  } catch (error) {
    return { key: "ERROR:MALFORMED", dataStart: null };
  }
}

function decodeZipName(entry) {
  if (entry.flags & 0x800) {
    const decoded = entry.rawName.toString("utf8");
    if (decoded.includes("\uFFFD")) return null;
    return decoded;
  }
  return Array.from(entry.rawName, (byte) => (byte < 0x80 ? String.fromCharCode(byte) : CP437_EXTENDED[byte - 0x80])).join("");
}

function zipEntryArtifact(entry) {
  const decoded = decodeZipName(entry);
  if (decoded === null) {
    return baseArtifact({
      status: "REJECTED",
      reason: "ZIP_ENTRY_NAME_DECODING_FAILED",
      sourceRelativePath: null,
      archiveEntryPath: null,
      stagedRelativePath: null,
      extension: null,
      sourceSizeBytes: entry.uncompSize,
      stagedSizeBytes: null,
      sourceHash: null,
      stagedHash: null,
      sourceKind: "zip",
      originalSourcePath: entry.normalizedSourcePath,
      originalRelativePath: null,
      archiveContainerPath: entry.normalizedSourcePath,
      zipKey: entry.zipKey
    });
  }
  const isDirectory = decoded.endsWith("/");
  const normalized = normalizeRelative(decoded.replace(/\/+$/u, ""));
  const reject = pathRejection(isDirectory ? normalized : decoded, true);
  if (isDirectory && !reject) return null;
  const ext = extensionFor(normalized);
  let status = "PENDING";
  let reason = null;
  if (reject) {
    status = "REJECTED";
    reason = reject;
  } else if (entry.localKey.startsWith("ERROR:")) {
    status = "REJECTED";
    reason = "ZIP_MEMBER_INTEGRITY_REJECTED";
  } else if (entry.flags & 1) {
    status = "REJECTED";
    reason = "ZIP_MEMBER_ENCRYPTED_REJECTED";
  } else if (entry.method !== 0 && entry.method !== 8) {
    status = "REJECTED";
    reason = "ZIP_COMPRESSION_METHOD_UNSUPPORTED";
  } else if (ext === ".zip") {
    status = "UNSUPPORTED";
    reason = "NESTED_ARCHIVE_UNSUPPORTED";
  } else if (!SUPPORTED_EXTENSIONS.has(ext)) {
    status = "UNSUPPORTED";
    reason = "UNSUPPORTED_EXTENSION";
  } else if (entry.uncompSize > LIMITS.maxIndividualFileBytes) {
    status = "REJECTED";
    reason = "FILE_SIZE_LIMIT_EXCEEDED";
  }
  return baseArtifact({
    status,
    reason,
    sourceRelativePath: normalized,
    archiveEntryPath: normalized,
    stagedRelativePath: null,
    extension: ext,
    sourceSizeBytes: entry.uncompSize,
    stagedSizeBytes: null,
    sourceHash: null,
    stagedHash: null,
    sourceKind: "zip",
    originalSourcePath: entry.normalizedSourcePath,
    originalRelativePath: normalized,
    archiveContainerPath: entry.normalizedSourcePath,
    zipKey: entry.zipKey,
    zipEntry: entry
  });
}

function finishZipArtifacts(artifacts, state) {
  const failures = [];
  let totalStagedBytes = 0;
  let totalSourceBytes = 0;
  applyCollisions(artifacts);
  for (const artifact of artifacts) {
    if (artifact.status === "PENDING") {
      try {
        const entry = artifact.zipEntry;
        const bytes = entry.method === 0 ? entry.compressed : zlib.inflateRawSync(entry.compressed);
        if (bytes.length !== entry.uncompSize) {
          artifact.status = "REJECTED";
          artifact.reason = "ZIP_MEMBER_INTEGRITY_REJECTED";
        } else if (crc32(bytes) !== entry.crc) {
          artifact.status = "REJECTED";
          artifact.reason = "ZIP_MEMBER_INTEGRITY_REJECTED";
        } else if (totalStagedBytes + bytes.length > LIMITS.maxExtractedTotalBytes) {
          artifact.status = "REJECTED";
          artifact.reason = "TOTAL_BYTE_LIMIT_EXCEEDED";
        } else {
          stageArtifact(artifact, state, bytes, artifact.archiveEntryPath);
          totalStagedBytes += bytes.length;
        }
      } catch (error) {
        artifact.status = "REJECTED";
        artifact.reason = "ZIP_MEMBER_INTEGRITY_REJECTED";
      }
    }
    if (artifact.status === "STAGED") totalSourceBytes += artifact.sourceSizeBytes || 0;
    if (artifact.status === "UNSUPPORTED") totalSourceBytes += artifact.sourceSizeBytes || 0;
    if (artifact.status === "REJECTED") failures.push(makeFailure(artifact.reason, artifact.archiveEntryPath));
    delete artifact.zipEntry;
  }
  return { failures, totalStagedBytes, totalSourceBytes };
}

function statusFor(artifacts, failures) {
  if (failures.length > 0 || artifacts.some((artifact) => artifact.status === "REJECTED")) return "FAIL";
  if (artifacts.length === 0) return "FAIL";
  if (!artifacts.some((artifact) => artifact.status === "STAGED")) return "FAIL";
  if (artifacts.some((artifact) => artifact.status === "UNSUPPORTED" || artifact.status === "UNREADABLE")) return "PASS_WITH_WARNINGS";
  return "PASS";
}

function addNoStagedFailureIfNeeded(status, artifacts, failures) {
  if (status === "FAIL" && artifacts.length === 0 && !failures.some((failure) => failure.code === "EMPTY_INPUT")) {
    failures.push(makeFailure("EMPTY_INPUT"));
  } else if (status === "FAIL" && artifacts.length > 0 && !artifacts.some((artifact) => artifact.status === "STAGED") && !failures.length) {
    failures.push(makeFailure("NO_STAGED_ARTIFACTS"));
  }
}

function executeExternalArtifactIntake(input, workspaceRoot) {
  const workflow = "external-artifact-intake";
  if (!input || typeof input.externalSourcePath !== "string" || input.externalSourcePath.trim() === "") {
    return preStagingFailure({ code: "EXTERNAL_INPUT_MISSING", workflow });
  }
  const normalizedResult = normalizeAbsolute(input.externalSourcePath);
  if (!normalizedResult.ok) {
    return preStagingFailure({ code: normalizedResult.code, workflow });
  }
  const sourceResult = classifySource(normalizedResult.normalized, normalizedResult.path);
  if (!sourceResult.ok) {
    return preStagingFailure({ code: sourceResult.code, workflow, sourcePath: normalizedResult.normalized });
  }
  if (sourceResult.sourceKind === "zip" && sourceResult.sourceSizeBytes > LIMITS.maxSourceArchiveBytes) {
    const id = intakeIdFor("zip", normalizedResult.normalized, sourceResult.sourceSizeBytes);
    return preStagingFailure({ code: "ARCHIVE_SIZE_LIMIT_EXCEEDED", workflow, sourceKind: "zip", sourcePath: normalizedResult.normalized, intakeId: id, totalSourceBytes: sourceResult.sourceSizeBytes });
  }
  const intakeId = intakeIdFor(sourceResult.sourceKind, normalizedResult.normalized, sourceResult.sourceSizeBytes);
  const staging = acquireStaging(workspaceRoot, intakeId);
  if (!staging.ok) {
    return preStagingFailure({ code: staging.code, workflow, sourceKind: sourceResult.sourceKind, sourcePath: normalizedResult.normalized, intakeId });
  }

  let artifacts = [];
  let finish;
  try {
    if (sourceResult.sourceKind === "file") {
      artifacts = processDirectFile(normalizedResult.path, normalizedResult.normalized);
    } else if (sourceResult.sourceKind === "directory") {
      const discovery = discoverDirectory(normalizedResult.path, normalizedResult.normalized);
      if (!discovery.ok) {
        const failureManifest = manifest({
          status: "FAIL",
          sourceKind: "directory",
          sourcePath: normalizedResult.normalized,
          intakeId,
          stagingAssigned: true,
          artifacts: [],
          failures: [makeFailure(discovery.code, discovery.path)],
          totalSourceBytes: 0,
          totalStagedBytes: 0
        });
        cleanupFailure(staging, failureManifest);
        return failureManifest;
      }
      artifacts = discovery.artifacts;
    } else {
      const buffer = fs.readFileSync(normalizedResult.path);
      artifacts = parseZip(buffer, normalizedResult.normalized).filter(Boolean);
      for (const artifact of artifacts) {
        if (artifact.zipEntry) artifact.zipEntry.sourceFilePath = normalizedResult.path;
      }
      sortArtifacts(artifacts);
    }
    const exceededFileCount = artifacts.length > LIMITS.maxDiscoveredArtifacts;
    if (exceededFileCount) {
      artifacts = artifacts.slice(0, LIMITS.maxDiscoveredArtifacts);
    }
    finish = sourceResult.sourceKind === "zip" ? finishZipArtifacts(artifacts, staging) : finishArtifacts(artifacts, staging);
    let failures = finish.failures;
    if (exceededFileCount) {
      failures.push(makeFailure("FILE_COUNT_LIMIT_EXCEEDED"));
    }
    if (sourceResult.sourceKind === "zip" && fs.statSync(normalizedResult.path).size !== sourceResult.sourceSizeBytes) {
      for (const artifact of artifacts) {
        if (artifact.status === "STAGED") {
          artifact.status = "REJECTED";
          artifact.reason = "SOURCE_MUTATION_DETECTED";
          artifact.stagedRelativePath = null;
          artifact.stagedSizeBytes = null;
          artifact.sourceHash = null;
          artifact.stagedHash = null;
        }
      }
      failures = [makeFailure("SOURCE_MUTATION_DETECTED")];
      finish.totalSourceBytes = 0;
      finish.totalStagedBytes = 0;
    }
    let status = statusFor(artifacts, failures);
    addNoStagedFailureIfNeeded(status, artifacts, failures);
    if (status === "FAIL" && failures.length === 0) failures.push(makeFailure("NO_STAGED_ARTIFACTS"));
    const output = manifest({
      status,
      sourceKind: sourceResult.sourceKind,
      sourcePath: normalizedResult.normalized,
      intakeId,
      stagingAssigned: true,
      artifacts,
      failures,
      totalSourceBytes: finish.totalSourceBytes,
      totalStagedBytes: finish.totalStagedBytes
    });
    if (status === "FAIL") {
      cleanupFailure(staging, output);
    } else {
      finalizeStaging(staging, output);
    }
    return output;
  } catch (error) {
    const output = manifest({
      status: "FAIL",
      sourceKind: sourceResult.sourceKind,
      sourcePath: normalizedResult.normalized,
      intakeId,
      stagingAssigned: true,
      artifacts,
      failures: [makeFailure("MANIFEST_FAILURE")],
      totalSourceBytes: 0,
      totalStagedBytes: 0
    });
    cleanupFailure(staging, output);
    return output;
  }
}

module.exports = {
  executeExternalArtifactIntake,
  LIMITS,
  intakeIdFor
};
