"use strict";

const CATEGORIES = [
  "architecture",
  "research",
  "runtime",
  "proposal",
  "governance",
  "qa",
  "unknown"
];

function emptyCategories() {
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

function includesAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

function classifyDocument(document) {
  const documentPath = document.path.toLowerCase();
  const keywordText = Array.isArray(document.keywordHits)
    ? document.keywordHits.join(" ").toLowerCase()
    : "";
  const searchable = `${documentPath} ${keywordText}`;

  if (includesAny(searchable, ["architecture", "architectural", "project_map", "master_architecture"])) {
    return "architecture";
  }
  if (includesAny(searchable, ["research", "review", "discovery", "baseline", "spike"])) {
    return "research";
  }
  if (document.extension === ".js" || includesAny(documentPath, ["app/", "gt63-core/", "modules/", "provider-layer/", "knowledge-layer/", "utils/"])) {
    return "runtime";
  }
  if (includesAny(searchable, ["proposal", "offer", "renderer", "template"])) {
    return "proposal";
  }
  if (includesAny(searchable, ["governance", "constitution", "decision", "lock", "rules", "agents.md", "contract"])) {
    return "governance";
  }
  if (includesAny(searchable, ["qa", "regression", "test/", "reports/", "checklist"])) {
    return "qa";
  }
  return "unknown";
}

function classifyDocuments(documents) {
  const categories = emptyCategories();
  const classifiedDocuments = documents.map((document) => {
    const category = classifyDocument(document);
    categories[category] += 1;
    return {
      path: document.path,
      title: document.title,
      extension: document.extension,
      sizeBytes: document.sizeBytes,
      category
    };
  }).sort((left, right) => left.path.localeCompare(right.path));

  const orderedCategories = emptyCategories();
  for (const category of CATEGORIES) {
    orderedCategories[category] = categories[category];
  }

  return {
    categories: orderedCategories,
    documents: classifiedDocuments
  };
}

module.exports = {
  classifyDocuments
};
