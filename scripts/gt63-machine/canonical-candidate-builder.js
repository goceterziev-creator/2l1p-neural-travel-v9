"use strict";

const path = require("path");

const GENERATED_FROM = {
  workflow1: "local-repository-bootstrap",
  workflow2: "local-document-report",
  workflow3: "document-relationship-map",
  workflow4: "machine-graph-summary"
};

function candidateTypeFor(node) {
  const nodePath = node.path.toLowerCase();
  if (nodePath.includes("constitution")) {
    return "CandidateConstitution";
  }
  if (nodePath.includes("north_star")) {
    return "CandidateNorthStar";
  }
  if (nodePath.includes("identity")) {
    return "CandidateProductIdentity";
  }
  if (nodePath.includes("decision")) {
    return "CandidateDecision";
  }
  if (nodePath.includes("lock")) {
    return "CandidateLock";
  }
  if (nodePath.includes("glossary")) {
    return "CandidateGlossary";
  }
  if (nodePath.includes("workstream")) {
    return "CandidateWorkstream";
  }
  if (node.category === "architecture") {
    return "CandidateArchitecture";
  }
  if (node.category === "governance") {
    return "CandidateGovernance";
  }
  if (node.category === "proposal") {
    return "CandidateProductMode";
  }
  if (node.category === "runtime") {
    return "CandidateSubsystem";
  }
  return "CandidateEvidence";
}

function titleFor(documentPath) {
  return path.posix.basename(documentPath, path.posix.extname(documentPath)).toLowerCase();
}

function stableIdFor(type, sourcePath) {
  return `candidate:${type.replace(/^Candidate/, "").toLowerCase()}:${sourcePath.toLowerCase()}`;
}

function duplicateGroupsFor(nodes, relationships) {
  const parent = new Map();
  for (const node of nodes) {
    parent.set(node.path, node.path);
  }

  function find(value) {
    const parentValue = parent.get(value);
    if (parentValue === value) {
      return value;
    }
    const root = find(parentValue);
    parent.set(value, root);
    return root;
  }

  function union(left, right) {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) {
      return;
    }
    const ordered = [leftRoot, rightRoot].sort();
    parent.set(ordered[1], ordered[0]);
  }

  for (const relationship of relationships) {
    if (relationship.type === "POSSIBLE_DUPLICATE") {
      union(relationship.from, relationship.to);
    }
  }

  const groups = new Map();
  for (const node of nodes) {
    const root = find(node.path);
    const group = groups.get(root) || [];
    group.push(node);
    groups.set(root, group);
  }

  return Array.from(groups.values()).map((group) => {
    return group.sort((left, right) => left.path.localeCompare(right.path));
  }).sort((left, right) => left[0].path.localeCompare(right[0].path));
}

function relatedObjectsFor(paths, relationshipByPath, pathToCandidateId) {
  const relatedIds = new Set();
  for (const sourcePath of paths) {
    const relationships = relationshipByPath.get(sourcePath) || [];
    for (const relationship of relationships) {
      const otherPath = relationship.from === sourcePath ? relationship.to : relationship.from;
      const candidateId = pathToCandidateId.get(otherPath);
      if (candidateId) {
        relatedIds.add(candidateId);
      }
    }
  }
  return Array.from(relatedIds).sort();
}

function buildRelationshipIndex(relationships) {
  const relationshipByPath = new Map();
  for (const relationship of relationships) {
    for (const documentPath of [relationship.from, relationship.to]) {
      const records = relationshipByPath.get(documentPath) || [];
      records.push(relationship);
      relationshipByPath.set(documentPath, records);
    }
  }
  return relationshipByPath;
}

function buildCanonicalCandidateModel(graphReport) {
  const nodes = Array.isArray(graphReport.nodes)
    ? graphReport.nodes.slice().sort((left, right) => left.path.localeCompare(right.path))
    : [];
  const relationships = Array.isArray(graphReport.relationships)
    ? graphReport.relationships.slice().sort((left, right) => {
      return left.from.localeCompare(right.from) ||
        left.to.localeCompare(right.to) ||
        left.type.localeCompare(right.type);
    })
    : [];
  const groups = duplicateGroupsFor(nodes, relationships);
  const pathToCandidateId = new Map();

  for (const group of groups) {
    const representative = group[0];
    const type = candidateTypeFor(representative);
    const id = stableIdFor(type, representative.path);
    for (const node of group) {
      pathToCandidateId.set(node.path, id);
    }
  }

  const relationshipByPath = buildRelationshipIndex(relationships);
  const objects = groups.map((group) => {
    const representative = group[0];
    const type = candidateTypeFor(representative);
    const id = pathToCandidateId.get(representative.path);
    const sourceEvidence = group.map((node) => ({
      path: node.path,
      evidenceType: "DOCUMENT"
    })).sort((left, right) => {
      return left.path.localeCompare(right.path) || left.evidenceType.localeCompare(right.evidenceType);
    });
    const sourcePaths = sourceEvidence.map((record) => record.path);
    const relatedObjects = relatedObjectsFor(sourcePaths, relationshipByPath, pathToCandidateId)
      .filter((relatedId) => relatedId !== id);

    return {
      id,
      type,
      status: "CANDIDATE",
      title: titleFor(representative.path),
      sourceEvidence,
      confidence: "EVIDENCE_BACKED",
      relatedObjects,
      lastUpdated: null
    };
  }).sort((left, right) => left.id.localeCompare(right.id));

  const evidenceIndexMap = new Map();
  for (const object of objects) {
    for (const evidence of object.sourceEvidence) {
      const candidateIds = evidenceIndexMap.get(evidence.path) || [];
      candidateIds.push(object.id);
      evidenceIndexMap.set(evidence.path, candidateIds);
    }
  }

  const evidenceIndex = Array.from(evidenceIndexMap.entries())
    .map((entry) => ({
      path: entry[0],
      candidateIds: entry[1].sort()
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    schemaVersion: "candidate-v1",
    authority: "NONE",
    canonicalStatus: "NOT_CANONICAL",
    generatedFrom: GENERATED_FROM,
    objects,
    evidenceIndex,
    warnings: []
  };
}

module.exports = {
  buildCanonicalCandidateModel
};
