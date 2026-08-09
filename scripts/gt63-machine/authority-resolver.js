"use strict";

const AUTHORITY_RESULTS = [
  "AUTHORITY_CONFLICT",
  "AUTHORITY_SUPPORTED",
  "CLAIMED_AUTHORITY",
  "REVIEW_REQUIRED",
  "AUTHORITY_UNKNOWN",
  "NO_AUTHORITY"
];

const AUTHORITY_WORDS = [
  "authority",
  "canonical",
  "constitution",
  "governance",
  "approved",
  "locked",
  "source of truth"
];

const GOVERNING_WORDS = [
  "constitution",
  "governance",
  "lock registry",
  "decision record",
  "authority: yes",
  "canonical authority: yes",
  "approved / locked"
];

const CONFLICT_WORDS = [
  "canonical authority: no",
  "authority: no",
  "not authoritative",
  "not canonical"
];

function includesAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

function authoritySignalsFor(evidenceRecord) {
  const text = `${evidenceRecord.statement || ""}`.toLowerCase();
  const hasAuthorityClaim = includesAny(text, AUTHORITY_WORDS);
  const hasGoverningEvidence = includesAny(text, GOVERNING_WORDS);
  const hasConflictClaim = includesAny(text, CONFLICT_WORDS);
  const hasGoverningHierarchy = text.includes("governing hierarchy") || text.includes("constitution hierarchy");
  const isExecutable = evidenceRecord.contentClass === "EXECUTABLE_BEHAVIOR";

  return {
    hasAuthorityClaim,
    hasGoverningEvidence,
    hasConflictClaim,
    hasGoverningHierarchy,
    isExecutable
  };
}

function resultForEvidenceGroup(records) {
  const signals = records.map(authoritySignalsFor);
  const governingCount = signals.filter((signal) => signal.hasGoverningEvidence && !signal.isExecutable).length;
  const hierarchyCount = signals.filter((signal) => signal.hasGoverningHierarchy && !signal.isExecutable).length;
  const conflictCount = signals.filter((signal) => signal.hasConflictClaim).length;
  const claimCount = signals.filter((signal) => signal.hasAuthorityClaim).length;
  const executableClaimOnly = signals.some((signal) => signal.isExecutable && signal.hasAuthorityClaim) &&
    governingCount === 0 &&
    conflictCount === 0;

  if (conflictCount > 0 && (claimCount > conflictCount || governingCount > 0) && hierarchyCount === 0) {
    return "AUTHORITY_CONFLICT";
  }
  if (governingCount > 0 && conflictCount > 0 && hierarchyCount > 0) {
    return "AUTHORITY_SUPPORTED";
  }
  if (conflictCount > 1) {
    return "AUTHORITY_CONFLICT";
  }
  if (governingCount > 0) {
    return "AUTHORITY_SUPPORTED";
  }
  if (executableClaimOnly) {
    return "NO_AUTHORITY";
  }
  if (claimCount > 0) {
    return "CLAIMED_AUTHORITY";
  }
  return "NO_AUTHORITY";
}

function assessmentFor(targetId, records, requiresReview, authorityExpected) {
  let result = resultForEvidenceGroup(records);
  if (result === "NO_AUTHORITY" && requiresReview) {
    result = "REVIEW_REQUIRED";
  } else if (result === "NO_AUTHORITY" && authorityExpected) {
    result = "AUTHORITY_UNKNOWN";
  }
  return {
    id: `authority:${targetId}`,
    type: "AUTHORITY_ASSESSMENT",
    targetId,
    result,
    basisEvidenceIds: records.map((record) => record.id).sort(),
    requiresReview: true
  };
}

function buildAuthorityAssessments(targets) {
  return targets
    .map((target) => assessmentFor(target.id, target.evidenceRecords, target.requiresReview, target.authorityExpected))
    .sort((left, right) => {
      return left.targetId.localeCompare(right.targetId) ||
        AUTHORITY_RESULTS.indexOf(left.result) - AUTHORITY_RESULTS.indexOf(right.result) ||
        left.id.localeCompare(right.id);
    });
}

module.exports = {
  AUTHORITY_RESULTS,
  buildAuthorityAssessments
};
