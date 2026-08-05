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

function scanRepository(repositoryRoot, config) {
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
  const files = [];

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

      const extension = path.extname(entry.name).toLowerCase();
      if (!includeExtensions.includes(extension)) {
        scan.filesSkipped += 1;
        continue;
      }

      const stat = fs.statSync(absolutePath);
      if (stat.size > maxFileBytes) {
        scan.filesSkipped += 1;
        continue;
      }

      if (scan.filesScanned >= maxFiles) {
        scan.truncated = true;
        scan.truncationReason = "MAX_FILES";
        return;
      }

      files.push({
        absolutePath,
        path: relativePath,
        extension,
        sizeBytes: stat.size
      });
      scan.filesScanned += 1;
    }
  }

  walk(repositoryRoot);
  scan.ignoredDirectories = Array.from(ignoredDirectorySet).sort();
  files.sort((left, right) => left.path.localeCompare(right.path));

  return { scan, files };
}

module.exports = {
  scanRepository
};
