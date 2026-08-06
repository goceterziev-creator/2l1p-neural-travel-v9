"use strict";

const REVIEW_AUTHORITY = "NONE";
const REVIEW_STATUS = "RECOMMENDATION_ONLY";

function emptyReviewCounts() {
  return {
    candidatesReviewed: 0,
    duplicateCandidates: 0,
    conflictingCandidates: 0,
    missingEvidence: 0,
    unsupportedCandidates: 0,
    confidenceIssues: 0
  };
}

function sourceEvidenceKey(record) {
  return `${record.path}|${record.evidenceType}`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function duplicateGroupsFor(objects) {
  const groups = new Map();
  for (const object of objects) {
    const key = object.sourceEvidence
      .map(sourceEvidenceKey)
      .sort()
      .join("||");
    const group = groups.get(key) || [];
    group.push(object);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .map((group) => ({
      candidateIds: group.map((object) => object.id).sort(),
      sourceEvidence: group[0].sourceEvidence.slice().sort((left, right) => {
        return left.path.localeCompare(right.path) || left.evidenceType.localeCompare(right.evidenceType);
      })
    }))
    .sort((left, right) => left.candidateIds[0].localeCompare(right.candidateIds[0]));
}

function conflictGroupsFor(objects) {
  const groups = new Map();
  for (const object of objects) {
    for (const evidence of object.sourceEvidence) {
      const group = groups.get(evidence.path) || [];
      group.push(object);
      groups.set(evidence.path, group);
    }
  }

  return Array.from(groups.entries())
    .map((entry) => {
      const uniqueTypes = Array.from(new Set(entry[1].map((object) => object.type))).sort();
      const candidateIds = Array.from(new Set(entry[1].map((object) => object.id))).sort();
      return {
        sourcePath: entry[0],
        candidateIds,
        candidateTypes: uniqueTypes
      };
    })
    .filter((group) => group.candidateTypes.length > 1)
    .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}

function missingEvidenceFor(objects) {
  return objects
    .filter((object) => !Array.isArray(object.sourceEvidence) || object.sourceEvidence.length === 0)
    .map((object) => ({
      candidateId: object.id,
      reason: "SOURCE_EVIDENCE_MISSING"
    }))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
}

function unsupportedCandidatesFor(objects, evidenceIndexPaths) {
  return objects
    .filter((object) => {
      if (!Array.isArray(object.sourceEvidence) || object.sourceEvidence.length === 0) {
        return false;
      }
      return object.sourceEvidence.some((evidence) => !evidenceIndexPaths.has(evidence.path));
    })
    .map((object) => ({
      candidateId: object.id,
      reason: "SOURCE_EVIDENCE_NOT_INDEXED",
      sourceEvidence: object.sourceEvidence.slice().sort((left, right) => {
        return left.path.localeCompare(right.path) || left.evidenceType.localeCompare(right.evidenceType);
      })
    }))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
}

function confidenceIssuesFor(objects) {
  return objects
    .filter((object) => object.confidence !== "EVIDENCE_BACKED")
    .map((object) => ({
      candidateId: object.id,
      confidence: object.confidence,
      reason: "CONFIDENCE_NOT_EVIDENCE_BACKED"
    }))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
}

function recommendationsFor(objects, duplicateGroups, conflictGroups, missingEvidence, unsupportedCandidates, confidenceIssues) {
  const flaggedIds = new Set();
  for (const group of duplicateGroups) {
    for (const candidateId of group.candidateIds) {
      flaggedIds.add(candidateId);
    }
  }
  for (const group of conflictGroups) {
    for (const candidateId of group.candidateIds) {
      flaggedIds.add(candidateId);
    }
  }
  for (const record of missingEvidence) {
    flaggedIds.add(record.candidateId);
  }
  for (const record of unsupportedCandidates) {
    flaggedIds.add(record.candidateId);
  }
  for (const record of confidenceIssues) {
    flaggedIds.add(record.candidateId);
  }

  return {
    recommendedForReview: Array.from(flaggedIds).sort(),
    recommendationNotes: [
      "Recommendations are non-binding.",
      "Workflow #5B does not accept or reject candidates.",
      "Authority remains NONE."
    ]
  };
}

function validateCandidateModel(candidateModel) {
  if (!isPlainObject(candidateModel)) {
    return "CANDIDATE_MODEL_MISSING";
  }
  if (candidateModel.authority !== "NONE") {
    return "CANDIDATE_MODEL_AUTHORITY_INVALID";
  }
  if (candidateModel.canonicalStatus !== "NOT_CANONICAL") {
    return "CANDIDATE_MODEL_CANONICAL_STATUS_INVALID";
  }
  if (!Array.isArray(candidateModel.objects)) {
    return "CANDIDATE_OBJECTS_INVALID";
  }
  if (!Array.isArray(candidateModel.evidenceIndex)) {
    return "CANDIDATE_EVIDENCE_INDEX_INVALID";
  }
  for (const object of candidateModel.objects) {
    if (!isPlainObject(object) || typeof object.id !== "string" || typeof object.type !== "string") {
      return "CANDIDATE_OBJECTS_INVALID";
    }
    if (!Array.isArray(object.sourceEvidence)) {
      return "CANDIDATE_SOURCE_EVIDENCE_INVALID";
    }
    for (const evidence of object.sourceEvidence) {
      if (!isPlainObject(evidence) || typeof evidence.path !== "string" || typeof evidence.evidenceType !== "string") {
        return "CANDIDATE_SOURCE_EVIDENCE_INVALID";
      }
    }
  }
  for (const evidence of candidateModel.evidenceIndex) {
    if (!isPlainObject(evidence) || typeof evidence.path !== "string") {
      return "CANDIDATE_EVIDENCE_INDEX_INVALID";
    }
  }
  return null;
}

function buildCanonicalReview(candidateModel) {
  const validationFailure = validateCandidateModel(candidateModel);
  if (validationFailure) {
    return {
      ok: false,
      failure: validationFailure
    };
  }

  const objects = candidateModel.objects.slice().sort((left, right) => left.id.localeCompare(right.id));
  const evidenceIndexPaths = new Set(candidateModel.evidenceIndex.map((entry) => entry.path));
  const duplicateGroups = duplicateGroupsFor(objects);
  const conflictGroups = conflictGroupsFor(objects);
  const missingEvidence = missingEvidenceFor(objects);
  const unsupportedCandidates = unsupportedCandidatesFor(objects, evidenceIndexPaths);
  const confidenceIssues = confidenceIssuesFor(objects);
  const reviewCounts = emptyReviewCounts();

  reviewCounts.candidatesReviewed = objects.length;
  reviewCounts.duplicateCandidates = duplicateGroups.reduce((sum, group) => sum + group.candidateIds.length, 0);
  reviewCounts.conflictingCandidates = conflictGroups.reduce((sum, group) => sum + group.candidateIds.length, 0);
  reviewCounts.missingEvidence = missingEvidence.length;
  reviewCounts.unsupportedCandidates = unsupportedCandidates.length;
  reviewCounts.confidenceIssues = confidenceIssues.length;

  return {
    ok: true,
    review: {
      logicalDocumentName: "canonical-review.json",
      authority: REVIEW_AUTHORITY,
      reviewStatus: REVIEW_STATUS,
      recommendationOnly: true,
      sourceCandidateModel: {
        schemaVersion: candidateModel.schemaVersion,
        authority: candidateModel.authority,
        canonicalStatus: candidateModel.canonicalStatus
      },
      reviewCounts,
      duplicateCandidates: duplicateGroups,
      conflictGroups,
      missingEvidence,
      unsupportedCandidates,
      confidenceIssues,
      recommendations: recommendationsFor(
        objects,
        duplicateGroups,
        conflictGroups,
        missingEvidence,
        unsupportedCandidates,
        confidenceIssues
      ),
      reviewNotes: [
        "No candidate objects were modified.",
        "No candidates were accepted or rejected.",
        "No governance decision was produced."
      ]
    }
  };
}

module.exports = {
  buildCanonicalReview
};
