"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const RELATIONSHIP_TYPES = [
  "REFERENCES",
  "SAME_CATEGORY",
  "SAME_DIRECTORY",
  "VERSION_RELATED",
  "POSSIBLE_DUPLICATE"
];

function directoryFor(documentPath) {
  const directory = path.posix.dirname(documentPath);
  return directory === "." ? "" : directory;
}

function normalizedContentFor(repositoryRoot, documentPath) {
  const absolutePath = path.join(repositoryRoot, ...documentPath.split("/"));
  return fs.readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n").trim();
}

function hashFor(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function versionParts(documentPath) {
  const baseName = path.posix.basename(documentPath, path.posix.extname(documentPath)).toLowerCase();
  const match = baseName.match(/^(.*?)(?:[_-]?v(?:ersion)?[_-]?\d+(?:[_-]\d+)*)$/);
  if (!match || !match[1]) {
    return null;
  }
  return {
    baseName: match[1].replace(/[_-]+$/, ""),
    versionName: baseName
  };
}

function orderedPair(left, right) {
  return left.path.localeCompare(right.path) <= 0 ? [left, right] : [right, left];
}

function addRelationship(relationships, seen, from, to, type, evidence) {
  if (from === to) {
    return;
  }
  const key = JSON.stringify({ from, to, type, evidence });
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  relationships.push({
    from,
    to,
    type,
    evidence
  });
}

function referenceTokensFor(document) {
  const baseName = path.posix.basename(document.path);
  return [document.path, `./${document.path}`, baseName].sort();
}

function mapReferences(documents, contentByPath, relationships, seen) {
  for (const source of documents) {
    const content = contentByPath.get(source.path);
    for (const target of documents) {
      if (source.path === target.path) {
        continue;
      }
      const matchedReference = referenceTokensFor(target).find((token) => content.includes(token));
      if (matchedReference) {
        addRelationship(relationships, seen, source.path, target.path, "REFERENCES", {
          sourcePath: source.path,
          matchedReference
        });
      }
    }
  }
}

function mapSameCategory(documents, relationships, seen) {
  for (let leftIndex = 0; leftIndex < documents.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < documents.length; rightIndex += 1) {
      const left = documents[leftIndex];
      const right = documents[rightIndex];
      if (left.category === right.category) {
        const pair = orderedPair(left, right);
        addRelationship(relationships, seen, pair[0].path, pair[1].path, "SAME_CATEGORY", {
          category: left.category
        });
      }
    }
  }
}

function mapSameDirectory(documents, relationships, seen) {
  for (let leftIndex = 0; leftIndex < documents.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < documents.length; rightIndex += 1) {
      const left = documents[leftIndex];
      const right = documents[rightIndex];
      const leftDirectory = directoryFor(left.path);
      const rightDirectory = directoryFor(right.path);
      if (leftDirectory === rightDirectory) {
        const pair = orderedPair(left, right);
        addRelationship(relationships, seen, pair[0].path, pair[1].path, "SAME_DIRECTORY", {
          directory: leftDirectory
        });
      }
    }
  }
}

function mapVersionRelated(documents, relationships, seen) {
  for (let leftIndex = 0; leftIndex < documents.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < documents.length; rightIndex += 1) {
      const left = documents[leftIndex];
      const right = documents[rightIndex];
      const leftVersion = versionParts(left.path);
      const rightVersion = versionParts(right.path);
      if (
        leftVersion &&
        rightVersion &&
        leftVersion.baseName &&
        leftVersion.baseName === rightVersion.baseName &&
        leftVersion.versionName !== rightVersion.versionName
      ) {
        const pair = orderedPair(left, right);
        addRelationship(relationships, seen, pair[0].path, pair[1].path, "VERSION_RELATED", {
          sharedBaseName: leftVersion.baseName,
          versionNames: [leftVersion.versionName, rightVersion.versionName].sort()
        });
      }
    }
  }
}

function mapPossibleDuplicates(documents, hashByPath, relationships, seen) {
  for (let leftIndex = 0; leftIndex < documents.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < documents.length; rightIndex += 1) {
      const left = documents[leftIndex];
      const right = documents[rightIndex];
      const leftHash = hashByPath.get(left.path);
      const rightHash = hashByPath.get(right.path);
      if (leftHash === rightHash) {
        const pair = orderedPair(left, right);
        addRelationship(relationships, seen, pair[0].path, pair[1].path, "POSSIBLE_DUPLICATE", {
          normalizedContentHash: leftHash
        });
      }
    }
  }
}

function mapDocumentRelationships(repositoryRoot, classifiedDocuments) {
  const documents = classifiedDocuments.slice().sort((left, right) => left.path.localeCompare(right.path));
  const nodes = documents.map((document) => ({
    id: document.path,
    path: document.path,
    category: document.category
  }));
  const contentByPath = new Map();
  const hashByPath = new Map();

  for (const document of documents) {
    const content = normalizedContentFor(repositoryRoot, document.path);
    contentByPath.set(document.path, content);
    hashByPath.set(document.path, hashFor(content));
  }

  const relationships = [];
  const seen = new Set();

  mapReferences(documents, contentByPath, relationships, seen);
  mapSameCategory(documents, relationships, seen);
  mapSameDirectory(documents, relationships, seen);
  mapVersionRelated(documents, relationships, seen);
  mapPossibleDuplicates(documents, hashByPath, relationships, seen);

  relationships.sort((left, right) => {
    return left.from.localeCompare(right.from) ||
      left.to.localeCompare(right.to) ||
      left.type.localeCompare(right.type) ||
      JSON.stringify(left.evidence).localeCompare(JSON.stringify(right.evidence));
  });

  return {
    summary: {
      documents: nodes.length,
      relationships: relationships.length,
      possibleDuplicates: relationships.filter((relationship) => relationship.type === "POSSIBLE_DUPLICATE").length
    },
    nodes,
    relationships,
    warnings: []
  };
}

module.exports = {
  RELATIONSHIP_TYPES,
  mapDocumentRelationships
};
