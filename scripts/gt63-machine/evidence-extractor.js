"use strict";

const fs = require("fs");

const KEYWORDS = [
  "GT63",
  "LOCKED",
  "workflow",
  "renderer",
  "proposal",
  "machine",
  "bootstrap"
];

function categoryHintsFor(file) {
  const hints = [];
  const filePath = file.path.toLowerCase();

  if (file.extension === ".md" || filePath.startsWith("docs/") || filePath.startsWith("system/")) {
    hints.push("documentation");
  }
  if (file.extension === ".js" && !filePath.startsWith("scripts/")) {
    hints.push("runtimeCode");
  }
  if (file.extension === ".js" && (filePath.startsWith("scripts/") || filePath.includes("test"))) {
    hints.push("testScript");
  }
  if (file.extension === ".json" || filePath.includes("config")) {
    hints.push("configuration");
  }
  if (hints.length === 0) {
    hints.push("unknown");
  }

  return hints.sort();
}

function keywordHitsFor(content) {
  return KEYWORDS
    .filter((keyword) => content.includes(keyword))
    .sort();
}

function extractEvidence(files) {
  return files.map((file) => {
    const content = fs.readFileSync(file.absolutePath, "utf8");
    return {
      path: file.path,
      extension: file.extension,
      sizeBytes: file.sizeBytes,
      keywordHits: keywordHitsFor(content),
      categoryHints: categoryHintsFor(file)
    };
  }).sort((left, right) => left.path.localeCompare(right.path));
}

module.exports = {
  extractEvidence
};
