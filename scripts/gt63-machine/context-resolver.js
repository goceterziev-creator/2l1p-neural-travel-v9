"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const WORKFLOW = "authority-aware-evidence-review";

const FAILURE_MESSAGES = {
  INPUT_INVALID: "Workflow #8 input is invalid.",
  TASK_INVALID: "Workflow #8 task is invalid.",
  SCOPE_INVALID: "Workflow #8 scope is invalid.",
  REPOSITORY_PATH_INVALID: "Workflow #8 repositoryPath is invalid.",
  EXPLICIT_PATH_OUTSIDE_REPOSITORY: "Workflow #8 explicitPath must remain inside the repository.",
  EXPLICIT_PATH_NOT_FOUND: "Workflow #8 explicitPath was not found."
};

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function resolvedInside(root, target) {
  const rootReal = fs.realpathSync(root);
  const targetReal = fs.realpathSync(target);
  return samePath(root, rootReal) && isInside(rootReal, targetReal);
}

function failure(code) {
  return {
    ok: false,
    code,
    message: FAILURE_MESSAGES[code]
  };
}

function gitValue(repositoryRoot, args) {
  return childProcess.execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

function readGitBaseline(repositoryRoot) {
  try {
    const gitRoot = gitValue(repositoryRoot, ["rev-parse", "--show-toplevel"]);
    if (path.resolve(gitRoot) !== path.resolve(repositoryRoot)) {
      return {
        gitStatus: "NOT_AVAILABLE",
        branch: null,
        head: null,
        detachedHead: false,
        dirty: false
      };
    }

    const head = gitValue(repositoryRoot, ["rev-parse", "HEAD"]) || null;
    const branch = gitValue(repositoryRoot, ["branch", "--show-current"]) || null;
    const dirty = gitValue(repositoryRoot, ["status", "--porcelain"]).length > 0;

    return {
      gitStatus: "AVAILABLE",
      branch,
      head,
      detachedHead: branch === null,
      dirty
    };
  } catch (error) {
    return {
      gitStatus: "NOT_AVAILABLE",
      branch: null,
      head: null,
      detachedHead: false,
      dirty: false
    };
  }
}

function normalizeExplicitPath(value) {
  return value.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function validateExplicitPath(repositoryRoot, value) {
  if (typeof value !== "string" || value.trim() === "") {
    return failure("SCOPE_INVALID");
  }

  const normalized = normalizeExplicitPath(value);
  if (
    normalized === "" ||
    path.posix.isAbsolute(normalized) ||
    path.win32.isAbsolute(normalized) ||
    normalized.split("/").includes("..")
  ) {
    return failure("EXPLICIT_PATH_OUTSIDE_REPOSITORY");
  }

  const absolute = path.resolve(repositoryRoot, ...normalized.split("/"));
  if (!isInside(repositoryRoot, absolute)) {
    return failure("EXPLICIT_PATH_OUTSIDE_REPOSITORY");
  }
  if (!fs.existsSync(absolute)) {
    return failure("EXPLICIT_PATH_NOT_FOUND");
  }

  try {
    if (!resolvedInside(repositoryRoot, absolute)) {
      return failure("EXPLICIT_PATH_OUTSIDE_REPOSITORY");
    }
  } catch (error) {
    return failure("EXPLICIT_PATH_OUTSIDE_REPOSITORY");
  }

  return {
    ok: true,
    path: normalized,
    absolutePath: absolute,
    isDirectory: fs.statSync(absolute).isDirectory()
  };
}

function resolveContext(input, workspaceRoot) {
  if (!isPlainObject(input)) return failure("INPUT_INVALID");
  if (!Object.prototype.hasOwnProperty.call(input, "workflow")) return failure("INPUT_INVALID");
  if (input.workflow !== WORKFLOW) return failure("INPUT_INVALID");
  if (!Object.prototype.hasOwnProperty.call(input, "task")) return failure("TASK_INVALID");
  if (typeof input.task !== "string") return failure("TASK_INVALID");

  const task = input.task.trim();
  if (task === "") return failure("TASK_INVALID");
  if (!Object.prototype.hasOwnProperty.call(input, "repositoryPath")) return failure("REPOSITORY_PATH_INVALID");
  if (typeof input.repositoryPath !== "string" || input.repositoryPath.trim() === "") {
    return failure("REPOSITORY_PATH_INVALID");
  }

  const repositoryRoot = path.resolve(workspaceRoot, input.repositoryPath);
  const relativeToWorkspace = path.relative(workspaceRoot, repositoryRoot);
  if (relativeToWorkspace.startsWith("..") || path.isAbsolute(relativeToWorkspace)) {
    return failure("REPOSITORY_PATH_INVALID");
  }
  if (!fs.existsSync(repositoryRoot) || !fs.statSync(repositoryRoot).isDirectory()) {
    return failure("REPOSITORY_PATH_INVALID");
  }

  if (!isPlainObject(input.scope)) return failure("SCOPE_INVALID");
  if (!["current", "historical", "mixed"].includes(input.scope.mode)) return failure("SCOPE_INVALID");
  if (
    !Array.isArray(input.scope.allowedSources) ||
    input.scope.allowedSources.length !== 1 ||
    input.scope.allowedSources[0] !== "repository"
  ) {
    return failure("SCOPE_INVALID");
  }
  if (!Array.isArray(input.scope.explicitPaths)) return failure("SCOPE_INVALID");

  const explicitPathMap = new Map();
  for (const explicitPath of input.scope.explicitPaths) {
    const result = validateExplicitPath(repositoryRoot, explicitPath);
    if (!result.ok) return result;
    explicitPathMap.set(result.path, result);
  }

  const explicitPaths = Array.from(explicitPathMap.values()).sort((left, right) => left.path.localeCompare(right.path));
  const git = readGitBaseline(repositoryRoot);
  const repository = {
    root: normalizePath(path.resolve(repositoryRoot)),
    relativeRoot: ".",
    ...git
  };
  const scope = {
    mode: input.scope.mode,
    allowedSources: ["repository"],
    explicitPaths: explicitPaths.map((record) => record.path)
  };

  return {
    ok: true,
    value: {
      task,
      repositoryRoot,
      explicitPaths,
      context: {
        task,
        scope,
        repository,
        evidenceSourceClasses: ["repository"],
        warnings: []
      }
    }
  };
}

module.exports = {
  FAILURE_MESSAGES,
  WORKFLOW,
  resolveContext
};
