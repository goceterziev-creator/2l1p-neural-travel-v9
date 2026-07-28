"use strict";

const {
  KNOWLEDGE_CONFIDENCE_LEVELS,
  KNOWLEDGE_SOURCE_TYPES
} = require("./knowledge-types");

function isoNow() {
  return new Date().toISOString();
}

function cleanText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanList(values = []) {
  return (Array.isArray(values) ? values : [])
    .map(cleanText)
    .filter(Boolean);
}

function clampScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function confidenceLevelForScore(score) {
  const value = clampScore(score);
  if (value >= 0.85) return KNOWLEDGE_CONFIDENCE_LEVELS.HIGH;
  if (value >= 0.55) return KNOWLEDGE_CONFIDENCE_LEVELS.MEDIUM;
  if (value > 0) return KNOWLEDGE_CONFIDENCE_LEVELS.LOW;
  return KNOWLEDGE_CONFIDENCE_LEVELS.UNKNOWN;
}

function normalizeKnowledgeConfidence(confidence = {}) {
  const score = clampScore(confidence.score);
  const level = Object.values(KNOWLEDGE_CONFIDENCE_LEVELS).includes(confidence.level)
    ? confidence.level
    : confidenceLevelForScore(score);

  return {
    score,
    level,
    reasons: cleanList(confidence.reasons),
    reviewed: confidence.reviewed === true
  };
}

function normalizeKnowledgeProvenance(provenance = {}) {
  const sourceType = Object.values(KNOWLEDGE_SOURCE_TYPES).includes(provenance.sourceType)
    ? provenance.sourceType
    : KNOWLEDGE_SOURCE_TYPES.UNKNOWN;

  return {
    sourceType,
    sourceName: cleanText(provenance.sourceName),
    sourceId: cleanText(provenance.sourceId),
    observedAt: cleanText(provenance.observedAt) || isoNow(),
    evidenceIds: cleanList(provenance.evidenceIds),
    externalRefs: cleanList(provenance.externalRefs)
  };
}

function normalizeKnowledgeWarnings(warnings = []) {
  return (Array.isArray(warnings) ? warnings : [])
    .map((warning) => ({
      code: cleanText(warning?.code || "KNOWLEDGE_WARNING"),
      message: cleanText(warning?.message),
      severity: cleanText(warning?.severity || "info")
    }))
    .filter((warning) => warning.message);
}

module.exports = {
  cleanText,
  cleanList,
  clampScore,
  confidenceLevelForScore,
  normalizeKnowledgeConfidence,
  normalizeKnowledgeProvenance,
  normalizeKnowledgeWarnings
};
