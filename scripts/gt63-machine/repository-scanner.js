"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const RULESET_VERSION = "semantic-evidence-v1.0.1";
const NATIVE_GIT_FIELDS = new Set([
  "rulesetVersion",
  "repositoryScopeId",
  "leftCommit",
  "rightCommit"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateNativeGitRequest(request) {
  if (!isPlainObject(request)) {
    throw new Error("SCHEMA_UNSUPPORTED_FIELD:request");
  }
  for (const field of NATIVE_GIT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(request, field)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${field}`);
    }
  }
  for (const field of Object.keys(request)) {
    if (!NATIVE_GIT_FIELDS.has(field)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${field}`);
    }
  }
  if (request.rulesetVersion !== RULESET_VERSION) {
    throw new Error("SCHEMA_UNSUPPORTED_VALUE:rulesetVersion");
  }
  for (const field of ["repositoryScopeId", "leftCommit", "rightCommit"]) {
    if (typeof request[field] !== "string" || request[field].length === 0) {
      throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${field}`);
    }
  }
}

function defaultGitExecutor(repositoryRoot, args) {
  return childProcess.execFileSync("git", ["-C", repositoryRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function runGit(repositoryRoot, args) {
  try {
    const stdout = defaultGitExecutor(repositoryRoot, args);
    return { ok: true, status: 0, stdout: stdout.trim() };
  } catch (error) {
    return {
      ok: false,
      status: Number.isInteger(error.status) ? error.status : null,
      stdout: typeof error.stdout === "string" ? error.stdout.trim() : "",
      stderr: typeof error.stderr === "string" ? error.stderr.trim() : ""
    };
  }
}

function resolveCommit(repositoryRoot, commit) {
  const resolved = runGit(repositoryRoot, ["rev-parse", "--verify", `${commit}^{commit}`]);
  return resolved.ok && /^[0-9a-f]{40}$/u.test(resolved.stdout) ? resolved.stdout : null;
}

function inspectAncestor(repositoryRoot, left, right) {
  const result = runGit(repositoryRoot, ["merge-base", "--is-ancestor", left, right]);
  if (result.status === 0) return "PROVEN_TRUE";
  if (result.status === 1) return "PROVEN_FALSE";
  return "INSPECTION_FAILED";
}

function inspectMergeBase(repositoryRoot, left, right) {
  const result = runGit(repositoryRoot, ["merge-base", left, right]);
  if (result.ok && /^[0-9a-f]{40}$/u.test(result.stdout)) {
    return { status: "FOUND", commit: result.stdout };
  }
  if (result.status === 1) {
    return { status: "NOT_FOUND", commit: null };
  }
  return { status: "INSPECTION_FAILED", commit: null };
}

function inspectNativeGitFacts(repositoryRoot, request) {
  validateNativeGitRequest(request);

  const baseRecord = {
    rulesetVersion: RULESET_VERSION,
    repositoryScopeId: request.repositoryScopeId,
    leftRequestedCommit: request.leftCommit,
    rightRequestedCommit: request.rightCommit,
    leftResolvedCommit: null,
    rightResolvedCommit: null,
    historyStatus: "INVALID_OR_UNREADABLE",
    comparisonResult: "UNKNOWN",
    nativeEvidence: {
      sameCommit: false,
      leftAncestorOfRight: false,
      rightAncestorOfLeft: false,
      commonAncestorCommit: null,
      shallowRepository: null
    }
  };

  const insideWorkTree = runGit(repositoryRoot, ["rev-parse", "--is-inside-work-tree"]);
  if (!insideWorkTree.ok || insideWorkTree.stdout !== "true") {
    return baseRecord;
  }

  const shallow = runGit(repositoryRoot, ["rev-parse", "--is-shallow-repository"]);
  const shallowRepository = shallow.ok && shallow.stdout === "true";
  baseRecord.historyStatus = shallow.ok
    ? shallowRepository ? "PARTIAL_NATIVE_HISTORY" : "VALID_NATIVE_HISTORY"
    : "UNKNOWN";
  baseRecord.nativeEvidence.shallowRepository = shallow.ok ? shallowRepository : null;

  const leftResolvedCommit = resolveCommit(repositoryRoot, request.leftCommit);
  const rightResolvedCommit = resolveCommit(repositoryRoot, request.rightCommit);
  baseRecord.leftResolvedCommit = leftResolvedCommit;
  baseRecord.rightResolvedCommit = rightResolvedCommit;

  if (!leftResolvedCommit || !rightResolvedCommit) {
    return baseRecord;
  }

  if (leftResolvedCommit === rightResolvedCommit) {
    return {
      ...baseRecord,
      comparisonResult: "SAME_COMMIT",
      nativeEvidence: {
        ...baseRecord.nativeEvidence,
        sameCommit: true
      }
    };
  }

  const leftAncestry = inspectAncestor(repositoryRoot, leftResolvedCommit, rightResolvedCommit);
  if (leftAncestry === "INSPECTION_FAILED") {
    return baseRecord;
  }
  const rightAncestry = inspectAncestor(repositoryRoot, rightResolvedCommit, leftResolvedCommit);
  if (rightAncestry === "INSPECTION_FAILED") {
    return baseRecord;
  }
  const mergeBaseResult = inspectMergeBase(repositoryRoot, leftResolvedCommit, rightResolvedCommit);
  if (mergeBaseResult.status === "INSPECTION_FAILED") {
    return baseRecord;
  }
  const leftAncestorOfRight = leftAncestry === "PROVEN_TRUE";
  const rightAncestorOfLeft = rightAncestry === "PROVEN_TRUE";
  const nativeEvidence = {
    sameCommit: false,
    leftAncestorOfRight,
    rightAncestorOfLeft,
    commonAncestorCommit: mergeBaseResult.commit,
    shallowRepository
  };

  if (leftAncestorOfRight) {
    return {
      ...baseRecord,
      comparisonResult: "GIT_ANCESTOR_OF",
      nativeEvidence
    };
  }

  if (rightAncestorOfLeft) {
    return {
      ...baseRecord,
      comparisonResult: "GIT_DESCENDANT_OF",
      nativeEvidence
    };
  }

  if (mergeBaseResult.status === "FOUND") {
    return {
      ...baseRecord,
      comparisonResult: "DIVERGED_FROM_COMMON_ANCESTOR",
      nativeEvidence
    };
  }

  return {
    ...baseRecord,
    comparisonResult: shallowRepository ? "UNKNOWN" : "NO_ANCESTRY_IN_INSPECTED_REPOSITORY",
    nativeEvidence
  };
}

function toRepositoryPath(root, absolutePath) {
  const relativePath = path.relative(root, absolutePath);
  return relativePath.split(path.sep).join("/");
}

function normalizeDirectoryList(items) {
  return Array.isArray(items) ? items.map(String).sort() : [];
}

function shouldIgnore(relativeDirectory, ignoreDirectories) {
  return ignoreDirectories.some((ignored) => {
    return relativeDirectory === ignored || relativeDirectory.startsWith(`${ignored}/`);
  });
}

function scanRepository(repositoryRoot, config, options) {
  const includeExtensions = Array.isArray(config.includeExtensions)
    ? config.includeExtensions.map(String).sort()
    : [];
  const ignoreDirectories = normalizeDirectoryList(config.ignoreDirectories);
  const maxFiles = Number.isInteger(config.maxFiles) && config.maxFiles >= 0 ? config.maxFiles : 0;
  const maxFileBytes = Number.isInteger(config.maxFileBytes) && config.maxFileBytes >= 0
    ? config.maxFileBytes
    : 0;

  const scan = {
    filesScanned: 0,
    filesSkipped: 0,
    truncated: false,
    truncationReason: null,
    ignoredDirectories: []
  };
  const ignoredDirectorySet = new Set();
  const seenFiles = new Set();
  const files = [];

  function addFile(absolutePath, relativePath) {
    if (scan.truncated || seenFiles.has(relativePath)) {
      return;
    }

    const extension = path.extname(relativePath).toLowerCase();
    if (!includeExtensions.includes(extension)) {
      scan.filesSkipped += 1;
      return;
    }

    const stat = fs.statSync(absolutePath);
    if (stat.size > maxFileBytes) {
      scan.filesSkipped += 1;
      return;
    }

    if (scan.filesScanned >= maxFiles) {
      scan.truncated = true;
      scan.truncationReason = "MAX_FILES";
      return;
    }

    seenFiles.add(relativePath);
    files.push({
      absolutePath,
      path: relativePath,
      extension,
      sizeBytes: stat.size
    });
    scan.filesScanned += 1;
  }

  function walk(directory) {
    if (scan.truncated) {
      return;
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = toRepositoryPath(repositoryRoot, absolutePath);

      if (entry.isDirectory()) {
        if (shouldIgnore(relativePath, ignoreDirectories)) {
          ignoredDirectorySet.add(relativePath);
          scan.filesSkipped += 1;
          continue;
        }
        walk(absolutePath);
        if (scan.truncated) {
          return;
        }
        continue;
      }

      if (!entry.isFile()) {
        scan.filesSkipped += 1;
        continue;
      }

      addFile(absolutePath, relativePath);
    }
  }

  const scopePaths = options && Array.isArray(options.scopePaths)
    ? Array.from(new Set(options.scopePaths.map(String))).sort()
    : [];

  if (scopePaths.length > 0) {
    for (const scopePath of scopePaths) {
      if (scan.truncated) {
        break;
      }
      const absoluteScopePath = path.resolve(repositoryRoot, ...scopePath.split("/"));
      const relativeScopePath = toRepositoryPath(repositoryRoot, absoluteScopePath);
      const stat = fs.statSync(absoluteScopePath);
      if (stat.isDirectory()) {
        if (shouldIgnore(relativeScopePath, ignoreDirectories)) {
          ignoredDirectorySet.add(relativeScopePath);
          scan.filesSkipped += 1;
          continue;
        }
        walk(absoluteScopePath);
      } else if (stat.isFile()) {
        addFile(absoluteScopePath, relativeScopePath);
      } else {
        scan.filesSkipped += 1;
      }
    }
  } else {
    walk(repositoryRoot);
  }

  scan.ignoredDirectories = Array.from(ignoredDirectorySet).sort();
  files.sort((left, right) => left.path.localeCompare(right.path));

  return { scan, files };
}

module.exports = {
  RULESET_VERSION,
  inspectNativeGitFacts,
  scanRepository
};
