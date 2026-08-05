"use strict";

const CATEGORIES = [
  "documentation",
  "runtimeCode",
  "testScript",
  "configuration",
  "unknown"
];

function classifyEvidence(evidence) {
  const classifications = {
    documentation: 0,
    runtimeCode: 0,
    testScript: 0,
    configuration: 0,
    unknown: 0
  };

  for (const record of evidence) {
    const hints = Array.isArray(record.categoryHints) ? record.categoryHints : ["unknown"];
    const category = CATEGORIES.find((name) => hints.includes(name)) || "unknown";
    classifications[category] += 1;
  }

  return classifications;
}

module.exports = {
  classifyEvidence
};
