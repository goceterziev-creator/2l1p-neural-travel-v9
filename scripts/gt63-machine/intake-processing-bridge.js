"use strict";

const fs = require("fs");
const path = require("path");

const WORKFLOW = "intake-processing-bridge";

const FAILURE_MESSAGES = {
  INPUT_INVALID: "Workflow #7 input is invalid.",
  INPUT_REFERENCE_UNSUPPORTED: "Workflow #7 accepts only manifestPath as an intake reference.",
  MANIFEST_PATH_INVALID: "Workflow #7 manifestPath is invalid.",
  MANIFEST_MISSING: "Workflow #6 manifest was not found.",
  MANIFEST_INVALID: "Workflow #6 manifest is invalid.",
  INTAKE_ID_MISMATCH: "Workflow #6 manifest intakeId does not match manifestPath.",
  STAGING_BOUNDARY_VIOLATION: "Workflow #6 staging boundary validation failed.",
  SNAPSHOT_MISSING: "Workflow #6 staged snapshot was not found.",
  SNAPSHOT_INVALID: "Workflow #6 staged snapshot is invalid.",
  INTAKE_NOT_ELIGIBLE: "Workflow #6 intake is not eligible for downstream processing.",
  DOWNSTREAM_INVOCATION_FAILED: "Downstream evidence processing failed.",
  DOWNSTREAM_RESULT_INVALID: "Downstream evidence-processing result is invalid.",
  PROVENANCE_INCONSISTENCY: "Workflow #7 provenance validation failed."
};

const WARNING_ORDER = [
  "INTAKE_WARNINGS_PROPAGATED",
  "DOWNSTREAM_TRUNCATED",
  "DOWNSTREAM_WARNINGS_PROPAGATED"
];

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function emptyOutput(code, intake, downstream) {
  return {
    status: "FAIL",
    workflow: WORKFLOW,
    authority: "NONE",
    intake: intake || {
      intakeId: null,
      sourceKind: null,
      sourcePath: null,
      manifestPath: null,
      stagingRoot: null,
      snapshotRoot: null,
      downstreamEligibility: null,
      status: null,
      warnings: [],
      limitViolations: [],
      artifactSummary: {
        totalDiscovered: 0,
        staged: 0,
        unsupported: 0,
        unreadable: 0,
        rejected: 0,
        totalSourceBytes: 0,
        totalStagedBytes: 0
      }
    },
    downstream: downstream || {
      workflow: "local-repository-bootstrap",
      status: "NOT_RUN",
      repository: null,
      scan: null,
      filesScanned: 0,
      filesSkipped: 0,
      truncated: false,
      truncationReason: null,
      evidenceCount: 0,
      classifications: {},
      warnings: [],
      failures: []
    },
    provenance: {
      externalSourcePath: intake ? intake.sourcePath : null,
      workflow6IntakeId: intake ? intake.intakeId : null,
      workflow6ManifestPath: intake ? intake.manifestPath : null,
      workflow6SnapshotRoot: intake ? intake.snapshotRoot : null,
      workflow7DownstreamWorkflow: "local-repository-bootstrap"
    },
    warnings: [],
    failures: [
      {
        code,
        message: FAILURE_MESSAGES[code]
      }
    ]
  };
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function samePath(left, right) {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  if (process.platform === "win32") {
    return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
  }
  return normalizedLeft === normalizedRight;
}

function realInside(root, target) {
  const absoluteRoot = path.resolve(root);
  const realRoot = fs.realpathSync(absoluteRoot);
  if (!samePath(absoluteRoot, realRoot)) return false;
  const realTarget = fs.realpathSync(target);
  return isInside(realRoot, realTarget);
}

function parseManifestPath(input, workspaceRoot) {
  if (!input || input.workflow !== WORKFLOW) return { ok: false, code: "INPUT_INVALID" };
  for (const field of ["intakeId", "snapshotPath", "repositoryPath", "externalSourcePath"]) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      return { ok: false, code: "INPUT_REFERENCE_UNSUPPORTED" };
    }
  }
  if (typeof input.manifestPath !== "string" || input.manifestPath.trim() === "") {
    return { ok: false, code: "INPUT_INVALID" };
  }
  if (path.isAbsolute(input.manifestPath)) {
    return { ok: false, code: "MANIFEST_PATH_INVALID" };
  }
  const normalized = input.manifestPath.replace(/\\/g, "/");
  const match = normalized.match(/^tmp\/gt63-machine-intake\/(intake-[a-f0-9]{64})\/manifest\.json$/);
  if (!match) return { ok: false, code: "MANIFEST_PATH_INVALID" };

  const absolute = path.resolve(workspaceRoot, normalized);
  const stagingRoot = path.resolve(workspaceRoot, "tmp", "gt63-machine-intake");
  if (!isInside(stagingRoot, absolute)) return { ok: false, code: "STAGING_BOUNDARY_VIOLATION" };
  if (!fs.existsSync(absolute)) return { ok: false, code: "MANIFEST_MISSING" };
  try {
    if (!realInside(stagingRoot, absolute)) return { ok: false, code: "STAGING_BOUNDARY_VIOLATION" };
  } catch (error) {
    return { ok: false, code: "STAGING_BOUNDARY_VIOLATION" };
  }
  return { ok: true, normalized, intakeId: match[1], absolute, stagingRoot };
}

function readManifest(parsedPath) {
  try {
    return { ok: true, manifest: JSON.parse(fs.readFileSync(parsedPath.absolute, "utf8")) };
  } catch (error) {
    return { ok: false, code: "MANIFEST_INVALID" };
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function intakeFromManifest(manifest) {
  const summary = manifest.summary || {};
  const intake = manifest.intake || {};
  return {
    intakeId: intake.intakeId || null,
    sourceKind: intake.sourceKind || null,
    sourcePath: intake.sourcePath || null,
    manifestPath: intake.manifestPath || null,
    stagingRoot: intake.stagingRoot || null,
    snapshotRoot: intake.snapshotRoot || null,
    downstreamEligibility: intake.downstreamEligibility || null,
    status: manifest.status || null,
    warnings: Array.isArray(summary.warnings) ? [...summary.warnings].sort() : [],
    limitViolations: Array.isArray(summary.limitViolations) ? [...summary.limitViolations].sort() : [],
    artifactSummary: {
      totalDiscovered: summary.totalDiscovered || 0,
      staged: summary.staged || 0,
      unsupported: summary.unsupported || 0,
      unreadable: summary.unreadable || 0,
      rejected: summary.rejected || 0,
      totalSourceBytes: summary.totalSourceBytes || 0,
      totalStagedBytes: summary.totalStagedBytes || 0
    }
  };
}

function validateManifest(manifest, parsedPath, workspaceRoot) {
  const intake = intakeFromManifest(manifest);
  const expectedStagingRoot = `tmp/gt63-machine-intake/${parsedPath.intakeId}`;
  const expectedSnapshotRoot = `${expectedStagingRoot}/snapshot`;

  if (!isObject(manifest) ||
      manifest.workflow !== "external-artifact-intake" ||
      manifest.authority !== "NONE" ||
      manifest.logicalDocumentName !== "external-artifact-intake-manifest.json" ||
      !["PASS", "PASS_WITH_WARNINGS", "FAIL"].includes(manifest.status) ||
      !isObject(manifest.intake) ||
      !isObject(manifest.summary) ||
      !Array.isArray(manifest.summary.warnings) ||
      !Array.isArray(manifest.summary.limitViolations) ||
      !Array.isArray(manifest.artifacts) ||
      !Array.isArray(manifest.failures)) {
    return { ok: false, code: "MANIFEST_INVALID", intake };
  }

  if (intake.intakeId !== parsedPath.intakeId) return { ok: false, code: "INTAKE_ID_MISMATCH", intake };
  if (intake.manifestPath !== parsedPath.normalized ||
      intake.stagingRoot !== expectedStagingRoot ||
      intake.snapshotRoot !== expectedSnapshotRoot ||
      typeof intake.sourcePath !== "string" ||
      intake.sourcePath === "" ||
      !["directory", "zip"].includes(intake.sourceKind) ||
      !["ELIGIBLE", "ELIGIBLE_WITH_WARNINGS", "NOT_ELIGIBLE"].includes(intake.downstreamEligibility)) {
    return { ok: false, code: "MANIFEST_INVALID", intake };
  }

  const validPairs = {
    PASS: "ELIGIBLE",
    PASS_WITH_WARNINGS: "ELIGIBLE_WITH_WARNINGS",
    FAIL: "NOT_ELIGIBLE"
  };
  if (validPairs[manifest.status] !== intake.downstreamEligibility) {
    return { ok: false, code: "MANIFEST_INVALID", intake };
  }

  for (const value of [intake.manifestPath, intake.stagingRoot, intake.snapshotRoot]) {
    const absolute = path.resolve(workspaceRoot, value);
    if (!isInside(parsedPath.stagingRoot, absolute)) {
      return { ok: false, code: "STAGING_BOUNDARY_VIOLATION", intake };
    }
  }

  if (manifest.status === "FAIL" || intake.downstreamEligibility === "NOT_ELIGIBLE") {
    return { ok: false, code: "INTAKE_NOT_ELIGIBLE", intake };
  }

  return { ok: true, intake };
}

function validateSnapshot(intake, workspaceRoot) {
  const absolute = path.resolve(workspaceRoot, intake.snapshotRoot);
  const expected = path.resolve(workspaceRoot, "tmp", "gt63-machine-intake", intake.intakeId, "snapshot");
  if (!isInside(expected, absolute)) return { ok: false, code: "STAGING_BOUNDARY_VIOLATION" };
  if (!fs.existsSync(absolute)) return { ok: false, code: "SNAPSHOT_MISSING" };
  try {
    if (!realInside(expected, absolute)) return { ok: false, code: "STAGING_BOUNDARY_VIOLATION" };
  } catch (error) {
    return { ok: false, code: "STAGING_BOUNDARY_VIOLATION" };
  }
  if (!fs.statSync(absolute).isDirectory()) return { ok: false, code: "SNAPSHOT_INVALID" };
  return { ok: true };
}

function downstreamWarnings(downstreamResult) {
  const warnings = [];
  const logs = Array.isArray(downstreamResult.logs) ? downstreamResult.logs : [];
  if (logs.some((log) => log && log.level === "WARN")) warnings.push("DOWNSTREAM_WARNINGS_PROPAGATED");
  if (Array.isArray(downstreamResult.warnings) && downstreamResult.warnings.length > 0) warnings.push("DOWNSTREAM_WARNINGS_PROPAGATED");
  return warnings;
}

function buildDownstreamObject(result) {
  const scan = result.scan || {};
  return {
    workflow: "local-repository-bootstrap",
    status: result.status || null,
    repository: result.repository || null,
    scan: result.scan || null,
    filesScanned: scan.filesScanned || 0,
    filesSkipped: scan.filesSkipped || 0,
    truncated: Boolean(scan.truncated),
    truncationReason: scan.truncationReason || null,
    evidenceCount: Array.isArray(result.evidence) ? result.evidence.length : 0,
    classifications: result.classifications || {},
    warnings: [],
    failures: Array.isArray(result.failures) ? result.failures : []
  };
}

function successOutput(intake, downstreamResult) {
  const warnings = [];
  if (intake.warnings.length > 0) warnings.push("INTAKE_WARNINGS_PROPAGATED");
  if (downstreamResult.scan && downstreamResult.scan.truncated === true) warnings.push("DOWNSTREAM_TRUNCATED");
  warnings.push(...downstreamWarnings(downstreamResult));
  const orderedWarnings = WARNING_ORDER.filter((warning) => warnings.includes(warning));

  return {
    status: orderedWarnings.length > 0 ? "PASS_WITH_WARNINGS" : "PASS",
    workflow: WORKFLOW,
    authority: "NONE",
    intake,
    downstream: {
      ...buildDownstreamObject(downstreamResult),
      warnings: orderedWarnings.filter((warning) => warning !== "INTAKE_WARNINGS_PROPAGATED")
    },
    provenance: {
      externalSourcePath: intake.sourcePath,
      workflow6IntakeId: intake.intakeId,
      workflow6ManifestPath: intake.manifestPath,
      workflow6SnapshotRoot: intake.snapshotRoot,
      workflow7DownstreamWorkflow: "local-repository-bootstrap"
    },
    warnings: orderedWarnings,
    failures: []
  };
}

function executeIntakeProcessingBridge(config, input, workspaceRoot, runDownstream) {
  const parsedPath = parseManifestPath(input, workspaceRoot);
  if (!parsedPath.ok) return emptyOutput(parsedPath.code);

  const manifestResult = readManifest(parsedPath);
  if (!manifestResult.ok) return emptyOutput(manifestResult.code);

  const validation = validateManifest(manifestResult.manifest, parsedPath, workspaceRoot);
  if (!validation.ok) return emptyOutput(validation.code, validation.intake);

  const snapshotValidation = validateSnapshot(validation.intake, workspaceRoot);
  if (!snapshotValidation.ok) return emptyOutput(snapshotValidation.code, validation.intake);

  const downstreamResult = runDownstream(validation.intake.snapshotRoot);
  if (!isObject(downstreamResult) || !downstreamResult.workflow || !downstreamResult.scan || !Array.isArray(downstreamResult.evidence)) {
    return emptyOutput("DOWNSTREAM_RESULT_INVALID", validation.intake);
  }
  if (downstreamResult.status !== "PASS") {
    return emptyOutput("DOWNSTREAM_INVOCATION_FAILED", validation.intake, buildDownstreamObject(downstreamResult));
  }

  return successOutput(validation.intake, downstreamResult);
}

module.exports = {
  executeIntakeProcessingBridge
};
