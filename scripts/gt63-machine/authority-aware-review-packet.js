"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { scanRepository } = require("./repository-scanner");
const { extractEvidence } = require("./evidence-extractor");
const { classifyEvidence } = require("./evidence-classifier");
const { discoverDocuments } = require("./document-discovery");
const { classifyDocuments } = require("./document-classifier");
const { mapDocumentRelationships } = require("./relationship-mapper");
const { FAILURE_MESSAGES, WORKFLOW, resolveContext } = require("./context-resolver");
const { buildAuthorityAssessments } = require("./authority-resolver");

const FAILURE_ORDER = [
  "INPUT_INVALID",
  "TASK_INVALID",
  "SCOPE_INVALID",
  "REPOSITORY_PATH_INVALID",
  "EXPLICIT_PATH_OUTSIDE_REPOSITORY",
  "EXPLICIT_PATH_NOT_FOUND",
  "REPOSITORY_SCAN_FAILED",
  "EVIDENCE_EXTRACTION_FAILED",
  "EVIDENCE_CLASSIFICATION_FAILED",
  "DOCUMENT_PROCESSING_FAILED",
  "RELATIONSHIP_PROCESSING_FAILED",
  "AUTHORITY_ASSESSMENT_FAILED",
  "REVIEW_PACKET_ASSEMBLY_FAILED"
];

const WARNING_ORDER = [
  "REPOSITORY_DIRTY",
  "SCAN_TRUNCATED",
  "EXPLICIT_SCOPE_EMPTY",
  "AUTHORITY_AMBIGUITY_PRESENT",
  "CONFLICTS_PRESENT",
  "UNKNOWNS_PRESENT"
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function emptyPacket(status, task, context, baseline, provenance, failures, warnings) {
  return {
    workflow: WORKFLOW,
    status,
    authority: "NONE",
    task: task || null,
    context: context || {},
    baseline: baseline || {},
    observations: [],
    evidence: [],
    inferences: [],
    relationships: [],
    conflicts: [],
    candidates: [],
    authorityAssessment: [],
    unknowns: [],
    provenance: provenance || {},
    reviewRequired: true,
    failures: failures || [],
    warnings: warnings || []
  };
}

function defaultScope(input) {
  if (input && input.scope && typeof input.scope === "object" && !Array.isArray(input.scope)) {
    return {
      mode: typeof input.scope.mode === "string" ? input.scope.mode : null,
      allowedSources: Array.isArray(input.scope.allowedSources) ? input.scope.allowedSources.slice().sort() : [],
      explicitPaths: Array.isArray(input.scope.explicitPaths) ? input.scope.explicitPaths.map(String).sort() : []
    };
  }
  return {
    mode: null,
    allowedSources: [],
    explicitPaths: []
  };
}

function failureContext(input, contextValue) {
  if (contextValue && contextValue.context) {
    return contextValue.context;
  }
  return {
    task: input && typeof input.task === "string" && input.task.trim() ? input.task.trim() : null,
    scope: defaultScope(input),
    repository: {
      root: null,
      relativeRoot: ".",
      gitStatus: "NOT_AVAILABLE",
      branch: null,
      head: null,
      detachedHead: false,
      dirty: false
    },
    evidenceSourceClasses: ["repository"],
    warnings: []
  };
}

function failureBaseline(context) {
  return {
    repository: {
      root: context.repository.root,
      relativeRoot: ".",
      gitStatus: context.repository.gitStatus,
      branch: context.repository.branch,
      head: context.repository.head,
      detachedHead: Boolean(context.repository.detachedHead),
      dirty: Boolean(context.repository.dirty)
    },
    scope: context.scope,
    scanner: {
      filesScanned: 0,
      filesSkipped: 0,
      truncated: false,
      truncationReason: null
    }
  };
}

function failureProvenance(baseline) {
  return {
    repository: {
      root: baseline.repository.root,
      branch: baseline.repository.branch,
      head: baseline.repository.head,
      gitStatus: baseline.repository.gitStatus,
      dirty: baseline.repository.dirty
    },
    workflow: {
      name: WORKFLOW,
      runIdentity: null
    },
    scope: baseline.scope,
    scanner: baseline.scanner,
    sourceStatus: "UNKNOWN"
  };
}

function failurePacket(code, message, contextValue, input) {
  const failure = {
    code,
    message: message || FAILURE_MESSAGES[code] || `${code}: Workflow #8 failed.`
  };
  const context = failureContext(input, contextValue);
  const baseline = failureBaseline(context);
  return emptyPacket("FAIL", context.task, context, baseline, failureProvenance(baseline), [failure], []);
}

function baselineFor(contextValue, scan) {
  const repository = contextValue.context.repository;
  const scope = contextValue.context.scope;
  return {
    repository: {
      root: repository.root,
      relativeRoot: ".",
      gitStatus: repository.gitStatus,
      branch: repository.branch,
      head: repository.head,
      detachedHead: Boolean(repository.detachedHead),
      dirty: Boolean(repository.dirty)
    },
    scope,
    scanner: {
      filesScanned: scan.filesScanned,
      filesSkipped: scan.filesSkipped,
      truncated: Boolean(scan.truncated),
      truncationReason: scan.truncationReason || null
    }
  };
}

function provenanceFor(baseline, mode) {
  return {
    repository: {
      root: baseline.repository.root,
      branch: baseline.repository.branch,
      head: baseline.repository.head,
      gitStatus: baseline.repository.gitStatus,
      dirty: baseline.repository.dirty
    },
    workflow: {
      name: WORKFLOW,
      runIdentity: null
    },
    scope: baseline.scope,
    scanner: baseline.scanner,
    sourceStatus: mode.toUpperCase()
  };
}

function scopedFiles(files, explicitPaths) {
  if (explicitPaths.length === 0) {
    return files.slice().sort((left, right) => left.path.localeCompare(right.path));
  }
  return files
    .filter((file) => {
      return explicitPaths.some((scopePath) => {
        if (scopePath.isDirectory) {
          return file.path === scopePath.path || file.path.startsWith(`${scopePath.path}/`);
        }
        return file.path === scopePath.path;
      });
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function adjustedScan(originalScan, originalFileCount, filteredFileCount, explicitPaths) {
  return {
    ...originalScan,
    filesScanned: filteredFileCount,
    filesSkipped: originalScan.filesSkipped + Math.max(0, originalFileCount - filteredFileCount),
    ignoredDirectories: Array.isArray(originalScan.ignoredDirectories) ? originalScan.ignoredDirectories.slice().sort() : []
  };
}

function contentFor(repositoryRoot, filePath) {
  try {
    return fs.readFileSync(path.join(repositoryRoot, ...filePath.split("/")), "utf8");
  } catch (error) {
    return "";
  }
}

function contentClassFor(record, content) {
  const lower = `${record.path} ${content}`.toLowerCase();
  if (record.extension === ".js") {
    return "EXECUTABLE_BEHAVIOR";
  }
  if (["constitution", "governance", "authority", "canonical authority", "lock registry", "decision record"].some((term) => lower.includes(term))) {
    return "AUTHORITY_EVIDENCE";
  }
  return "CONTENT_EVIDENCE";
}

function buildEvidenceRecords(repositoryRoot, evidence) {
  return evidence.map((record) => {
    const content = normalizeWhitespace(contentFor(repositoryRoot, record.path));
    const statement = content ? content.slice(0, 240) : `Repository evidence at ${record.path}.`;
    return {
      id: `evidence:${record.path}`,
      type: "EVIDENCE",
      path: record.path,
      category: Array.isArray(record.categoryHints) && record.categoryHints.length > 0 ? record.categoryHints[0] : "unknown",
      sourceEvidenceIds: [],
      contentClass: contentClassFor(record, content),
      statement,
      extension: record.extension,
      keywordHits: Array.isArray(record.keywordHits) ? record.keywordHits.slice().sort() : []
    };
  }).sort((left, right) => left.path.localeCompare(right.path) || left.id.localeCompare(right.id));
}

function buildObservations(evidenceRecords) {
  return evidenceRecords.map((record) => ({
    id: `observation:${record.path}`,
    type: "OBSERVATION",
    path: record.path,
    statement: `Observed repository evidence record ${record.path}.`,
    sourceEvidenceIds: [record.id]
  })).sort((left, right) => left.path.localeCompare(right.path) || left.id.localeCompare(right.id));
}

function inferenceStatementFor(record, mode) {
  const modePrefix = mode === "historical" ? "Historical evidence" : mode === "mixed" ? "Mixed-scope evidence" : "Current repository evidence";
  return `${modePrefix} from ${record.path} is reviewable as ${record.category}.`;
}

function buildInferences(evidenceRecords, mode) {
  return evidenceRecords
    .filter((record) => record.contentClass !== "EXECUTABLE_BEHAVIOR" || record.keywordHits.length > 0 || record.statement.toLowerCase().includes("authority"))
    .map((record) => ({
      id: `inference:${sha256(`${record.path}|${record.category}|${mode}`).slice(0, 24)}`,
      type: "INFERENCE",
      statement: inferenceStatementFor(record, mode),
      basisEvidenceIds: [record.id],
      confidence: "HIGH",
      sourceStatus: mode.toUpperCase()
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function candidateIdFor(statement, evidenceIds) {
  const normalizedStatement = normalizeWhitespace(statement);
  const basis = evidenceIds.slice().sort().join("|");
  return `candidate:${sha256(`${normalizedStatement}|${basis}`)}`;
}

function recordsForEvidenceIds(evidenceRecords, evidenceIds) {
  const ids = new Set(evidenceIds);
  return evidenceRecords.filter((record) => ids.has(record.id));
}

function reviewRequiredFor(records) {
  return records.some((record) => record.statement.toLowerCase().includes("review required"));
}

function authorityRequirementFor(records, conflictingEvidenceIds) {
  if (conflictingEvidenceIds.length > 0 || reviewRequiredFor(records)) {
    return "REVIEW_REQUIRED";
  }
  return "NONE";
}

function confidenceFor(inference, conflictingEvidenceIds) {
  if (conflictingEvidenceIds.length > 0) {
    return "MEDIUM";
  }
  return inference.confidence;
}

function buildCandidates(inferences, conflictsByEvidence, evidenceRecords) {
  const byId = new Map();
  for (const inference of inferences) {
    if (!Array.isArray(inference.basisEvidenceIds) || inference.basisEvidenceIds.length === 0) {
      continue;
    }
    const id = candidateIdFor(inference.statement, inference.basisEvidenceIds);
    const conflictingEvidenceIds = Array.from(new Set(inference.basisEvidenceIds.flatMap((evidenceId) => conflictsByEvidence.get(evidenceId) || []))).sort();
    const records = recordsForEvidenceIds(evidenceRecords, inference.basisEvidenceIds);
    const existing = byId.get(id);
    const candidate = {
      id,
      type: "CANDIDATE",
      statement: normalizeWhitespace(inference.statement),
      supportingEvidenceIds: inference.basisEvidenceIds.slice().sort(),
      conflictingEvidenceIds,
      confidence: confidenceFor(inference, conflictingEvidenceIds),
      authorityRequirement: authorityRequirementFor(records, conflictingEvidenceIds),
      reviewStatus: "PROPOSED",
      canonicalStatus: "NOT_CANONICAL",
      authority: "NONE",
      sourceStatus: inference.sourceStatus
    };
    if (!existing) {
      byId.set(id, candidate);
    }
  }
  return Array.from(byId.values()).sort((left, right) => left.id.localeCompare(right.id));
}

function buildRelationships(graphReport) {
  return graphReport.relationships.map((relationship) => ({
    id: `relationship:${sha256(JSON.stringify(relationship)).slice(0, 24)}`,
    type: "RELATIONSHIP",
    relationshipType: relationship.type,
    from: relationship.from,
    to: relationship.to,
    basisEvidenceIds: [`evidence:${relationship.from}`, `evidence:${relationship.to}`].sort(),
    evidence: relationship.evidence
  })).sort((left, right) => {
    return left.from.localeCompare(right.from) ||
      left.to.localeCompare(right.to) ||
      left.relationshipType.localeCompare(right.relationshipType) ||
      left.id.localeCompare(right.id);
  });
}

function buildConflicts(evidenceRecords, mode) {
  const authorityYes = evidenceRecords.filter((record) => /canonical authority:\s*yes|authority:\s*yes|approved \/ locked/i.test(record.statement));
  const authorityNo = evidenceRecords.filter((record) => /canonical authority:\s*no|authority:\s*no|not authoritative|not canonical/i.test(record.statement));
  const conflicts = [];

  if (authorityYes.length > 0 && authorityNo.length > 0) {
    const evidenceIds = [...authorityYes, ...authorityNo].map((record) => record.id).sort();
    conflicts.push({
      id: `conflict:AUTHORITY_CLAIM_CONFLICT:${sha256(evidenceIds.join("|")).slice(0, 24)}`,
      type: "CONFLICT",
      conflictType: "AUTHORITY_CLAIM_CONFLICT",
      statements: [
        {
          statement: "Evidence contains supported or claimed authority language.",
          evidenceIds: authorityYes.map((record) => record.id).sort()
        },
        {
          statement: "Evidence contains no-authority or non-canonical language.",
          evidenceIds: authorityNo.map((record) => record.id).sort()
        }
      ],
      evidenceIds,
      authorityAssessmentIds: [],
      resolution: "UNRESOLVED"
    });
  }

  if (mode === "mixed") {
    const historical = evidenceRecords.filter((record) => record.statement.toLowerCase().includes("historical"));
    const current = evidenceRecords.filter((record) => record.statement.toLowerCase().includes("current"));
    if (historical.length > 0 && current.length > 0) {
      const evidenceIds = [...historical, ...current].map((record) => record.id).sort();
      conflicts.push({
        id: `conflict:CURRENT_VS_HISTORICAL_CONFLICT:${sha256(evidenceIds.join("|")).slice(0, 24)}`,
        type: "CONFLICT",
        conflictType: "CURRENT_VS_HISTORICAL_CONFLICT",
        statements: [
          {
            statement: "Evidence contains historical-state language.",
            evidenceIds: historical.map((record) => record.id).sort()
          },
          {
            statement: "Evidence contains current-state language.",
            evidenceIds: current.map((record) => record.id).sort()
          }
        ],
        evidenceIds,
        authorityAssessmentIds: [],
        resolution: "UNRESOLVED"
      });
    }
  }

  return conflicts.sort((left, right) => {
    return left.conflictType.localeCompare(right.conflictType) ||
      (left.evidenceIds[0] || "").localeCompare(right.evidenceIds[0] || "") ||
      left.id.localeCompare(right.id);
  });
}

function conflictIndex(conflicts) {
  const index = new Map();
  for (const conflict of conflicts) {
    for (const evidenceId of conflict.evidenceIds) {
      const existing = index.get(evidenceId) || [];
      existing.push(...conflict.evidenceIds.filter((id) => id !== evidenceId));
      index.set(evidenceId, Array.from(new Set(existing)).sort());
    }
  }
  return index;
}

function buildUnknowns(task, evidenceRecords) {
  if (evidenceRecords.length > 0) {
    return [];
  }
  return [
    {
      id: `unknown:${sha256(task).slice(0, 24)}`,
      type: "UNKNOWN",
      question: task,
      reason: "NOT_FOUND",
      searchedEvidenceScope: []
    }
  ];
}

function authorityExpectedFor(records) {
  return records.some((record) => {
    const statement = record.statement.toLowerCase();
    return statement.includes("authority evidence required") ||
      statement.includes("authority required") ||
      statement.includes("requires authority") ||
      statement.includes("authority cannot be established") ||
      statement.includes("governing proof unavailable");
  });
}

function warningsFor(baseline, authorityAssessment, conflicts, unknowns, explicitPaths, scopedFileCount) {
  const warnings = new Set();
  if (baseline.repository.dirty) warnings.add("REPOSITORY_DIRTY");
  if (baseline.scanner.truncated) warnings.add("SCAN_TRUNCATED");
  if (explicitPaths.length > 0 && scopedFileCount === 0) warnings.add("EXPLICIT_SCOPE_EMPTY");
  if (authorityAssessment.some((assessment) => ["AUTHORITY_UNKNOWN", "AUTHORITY_CONFLICT", "CLAIMED_AUTHORITY", "REVIEW_REQUIRED"].includes(assessment.result))) {
    warnings.add("AUTHORITY_AMBIGUITY_PRESENT");
  }
  if (conflicts.length > 0) warnings.add("CONFLICTS_PRESENT");
  if (unknowns.length > 0) warnings.add("UNKNOWNS_PRESENT");
  return WARNING_ORDER.filter((warning) => warnings.has(warning));
}

function buildPacket(contextValue, scanResult, evidence, classifications, documentClassification, graphReport) {
  const baseline = baselineFor(contextValue, scanResult.scan);
  const provenance = provenanceFor(baseline, contextValue.context.scope.mode);
  const evidenceRecords = buildEvidenceRecords(contextValue.repositoryRoot, evidence);
  const observations = buildObservations(evidenceRecords);
  const inferences = buildInferences(evidenceRecords, contextValue.context.scope.mode);
  const relationships = buildRelationships(graphReport);
  const conflicts = buildConflicts(evidenceRecords, contextValue.context.scope.mode);
  const candidates = buildCandidates(inferences, conflictIndex(conflicts), evidenceRecords);
  const unknowns = buildUnknowns(contextValue.task, evidenceRecords);
  const authorityTargets = [
    ...candidates.map((candidate) => ({
      id: candidate.id,
      evidenceRecords: evidenceRecords.filter((record) => candidate.supportingEvidenceIds.includes(record.id)),
      requiresReview: candidate.authorityRequirement !== "NONE",
      authorityExpected: authorityExpectedFor(evidenceRecords.filter((record) => candidate.supportingEvidenceIds.includes(record.id)))
    })),
    ...conflicts.map((conflict) => ({
      id: conflict.id,
      evidenceRecords: evidenceRecords.filter((record) => conflict.evidenceIds.includes(record.id)),
      requiresReview: true,
      authorityExpected: true
    }))
  ];
  const authorityAssessment = buildAuthorityAssessments(authorityTargets);
  const warnings = warningsFor(
    baseline,
    authorityAssessment,
    conflicts,
    unknowns,
    contextValue.explicitPaths,
    evidence.length
  );

  return {
    workflow: WORKFLOW,
    status: warnings.length > 0 ? "PASS_WITH_WARNINGS" : "PASS",
    authority: "NONE",
    task: contextValue.task,
    context: contextValue.context,
    baseline,
    observations,
    evidence: evidenceRecords,
    inferences,
    relationships,
    conflicts,
    candidates,
    authorityAssessment,
    unknowns,
    provenance,
    reviewRequired: true,
    failures: [],
    warnings,
    classifications,
    documentSummary: {
      categories: documentClassification.categories,
      documents: documentClassification.documents.length
    }
  };
}

function executeAuthorityAwareEvidenceReview(config, input, workspaceRoot) {
  const contextResult = resolveContext(input, workspaceRoot);
  if (!contextResult.ok) {
    return failurePacket(contextResult.code, contextResult.message, null, input);
  }

  const contextValue = contextResult.value;
  let scanResult;
  try {
    scanResult = scanRepository(contextValue.repositoryRoot, config, {
      scopePaths: contextValue.explicitPaths.map((record) => record.path)
    });
  } catch (error) {
    return failurePacket("REPOSITORY_SCAN_FAILED", "Repository scan failed.", contextValue, input);
  }

  let evidence;
  try {
    evidence = extractEvidence(scanResult.files);
  } catch (error) {
    return failurePacket("EVIDENCE_EXTRACTION_FAILED", "Evidence extraction failed.", contextValue, input);
  }

  let classifications;
  try {
    classifications = classifyEvidence(evidence);
  } catch (error) {
    return failurePacket("EVIDENCE_CLASSIFICATION_FAILED", "Evidence classification failed.", contextValue, input);
  }

  let discoveryResult;
  let documentClassification;
  try {
    discoveryResult = discoverDocuments(evidence);
    documentClassification = classifyDocuments(discoveryResult.documents);
  } catch (error) {
    return failurePacket("DOCUMENT_PROCESSING_FAILED", "Document processing failed.", contextValue, input);
  }

  let graphReport;
  try {
    graphReport = mapDocumentRelationships(contextValue.repositoryRoot, documentClassification.documents);
  } catch (error) {
    return failurePacket("RELATIONSHIP_PROCESSING_FAILED", "Relationship processing failed.", contextValue, input);
  }

  try {
    return buildPacket(contextValue, scanResult, evidence, classifications, documentClassification, graphReport);
  } catch (error) {
    return failurePacket("REVIEW_PACKET_ASSEMBLY_FAILED", "Review packet assembly failed.", contextValue, input);
  }
}

module.exports = {
  executeAuthorityAwareEvidenceReview
};
