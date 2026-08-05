"use strict";

const path = require("path");

const SUPPORTED_EXTENSIONS = [".css", ".html", ".js", ".json", ".md"];

function titleFor(documentPath) {
  return path.basename(documentPath, path.extname(documentPath)).toLowerCase();
}

function discoverDocuments(evidence) {
  const documents = evidence
    .filter((record) => SUPPORTED_EXTENSIONS.includes(record.extension))
    .map((record) => ({
      path: record.path,
      title: titleFor(record.path),
      extension: record.extension,
      sizeBytes: record.sizeBytes,
      keywordHits: Array.isArray(record.keywordHits) ? record.keywordHits.slice().sort() : []
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  const byTitle = new Map();
  for (const document of documents) {
    const existing = byTitle.get(document.title) || [];
    existing.push(document.path);
    byTitle.set(document.title, existing);
  }

  const duplicates = Array.from(byTitle.entries())
    .filter((entry) => entry[1].length > 1)
    .map((entry) => ({
      title: entry[0],
      paths: entry[1].sort()
    }))
    .sort((left, right) => left.title.localeCompare(right.title));

  return {
    documents,
    duplicates,
    warnings: []
  };
}

module.exports = {
  discoverDocuments
};
