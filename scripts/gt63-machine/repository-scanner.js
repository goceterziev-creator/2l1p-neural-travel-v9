"use strict";

const fs = require("fs");
const path = require("path");

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
  scanRepository
};
