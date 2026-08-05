"use strict";

const path = require("path");

const CATEGORY_KEYS = [
  "architecture",
  "research",
  "runtime",
  "proposal",
  "governance",
  "qa",
  "unknown"
];

const RELATIONSHIP_COUNT_KEYS = [
  ["REFERENCES", "references"],
  ["SAME_DIRECTORY", "sameDirectory"],
  ["SAME_CATEGORY", "sameCategory"],
  ["VERSION_RELATED", "versionRelated"],
  ["POSSIBLE_DUPLICATE", "possibleDuplicate"]
];

function emptyCategoryCounts() {
  return {
    architecture: 0,
    research: 0,
    runtime: 0,
    proposal: 0,
    governance: 0,
    qa: 0,
    unknown: 0
  };
}

function emptyRelationshipCounts() {
  return {
    references: 0,
    sameDirectory: 0,
    sameCategory: 0,
    versionRelated: 0,
    possibleDuplicate: 0
  };
}

function directoryFor(documentPath) {
  const directory = path.posix.dirname(documentPath);
  return directory === "." ? "" : directory;
}

function largestCategoryFor(categoryCounts) {
  return CATEGORY_KEYS.slice().sort((left, right) => {
    return categoryCounts[right] - categoryCounts[left] || left.localeCompare(right);
  })[0];
}

function topDirectoriesFor(nodes) {
  const counts = new Map();
  for (const node of nodes) {
    const directory = directoryFor(node.path);
    counts.set(directory, (counts.get(directory) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map((entry) => ({
      directory: entry[0],
      documents: entry[1]
    }))
    .sort((left, right) => {
      return right.documents - left.documents || left.directory.localeCompare(right.directory);
    })
    .slice(0, 10);
}

function countIsolatedDocuments(nodes, relationships) {
  const connected = new Set();
  for (const relationship of relationships) {
    connected.add(relationship.from);
    connected.add(relationship.to);
  }
  return nodes.filter((node) => !connected.has(node.path)).length;
}

function generateSummary(graphReport) {
  const nodes = Array.isArray(graphReport.nodes) ? graphReport.nodes : [];
  const relationships = Array.isArray(graphReport.relationships) ? graphReport.relationships : [];
  const categoryCounts = emptyCategoryCounts();
  const relationshipCounts = emptyRelationshipCounts();

  for (const node of nodes) {
    if (Object.prototype.hasOwnProperty.call(categoryCounts, node.category)) {
      categoryCounts[node.category] += 1;
    }
  }

  for (const relationship of relationships) {
    const countKey = RELATIONSHIP_COUNT_KEYS.find((entry) => entry[0] === relationship.type);
    if (countKey) {
      relationshipCounts[countKey[1]] += 1;
    }
  }

  return {
    documents: nodes.length,
    categoryCounts,
    largestCategory: largestCategoryFor(categoryCounts),
    relationshipCounts,
    isolatedDocuments: countIsolatedDocuments(nodes, relationships),
    duplicateCandidates: relationshipCounts.possibleDuplicate,
    topDocumentDirectories: topDirectoriesFor(nodes)
  };
}

module.exports = {
  generateSummary
};
