"use strict";

const {
  PROVIDER_CONFIDENCE_LEVELS,
  PROVIDER_ERROR_CATEGORIES
} = require("./provider-types");

function isoNow() {
  return new Date().toISOString();
}

function clampScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function confidenceLevelForScore(score) {
  const value = clampScore(score);
  if (value >= 0.85) return PROVIDER_CONFIDENCE_LEVELS.HIGH;
  if (value >= 0.55) return PROVIDER_CONFIDENCE_LEVELS.MEDIUM;
  if (value > 0) return PROVIDER_CONFIDENCE_LEVELS.LOW;
  return PROVIDER_CONFIDENCE_LEVELS.UNKNOWN;
}

function normalizeConfidence(confidence = {}) {
  const score = clampScore(confidence.score);
  return {
    score,
    level: confidence.level || confidenceLevelForScore(score),
    reasons: Array.isArray(confidence.reasons)
      ? confidence.reasons.map((reason) => String(reason || "").trim()).filter(Boolean)
      : []
  };
}

function normalizeProvenance(provenance = {}) {
  return {
    providerId: String(provenance.providerId || "").trim(),
    providerType: String(provenance.providerType || "").trim(),
    sourceName: String(provenance.sourceName || "").trim(),
    retrievedAt: provenance.retrievedAt || isoNow(),
    sourceUrl: provenance.sourceUrl || undefined,
    requestId: provenance.requestId || undefined,
    cached: Boolean(provenance.cached),
    fallbackUsed: Boolean(provenance.fallbackUsed)
  };
}

function normalizeWarning(warning = {}) {
  return {
    code: String(warning.code || "PROVIDER_WARNING").trim(),
    message: String(warning.message || "").trim(),
    severity: String(warning.severity || "info").trim(),
    details: warning.details && typeof warning.details === "object" ? warning.details : undefined
  };
}

function normalizeError(error = {}) {
  return {
    code: String(error.code || "PROVIDER_ERROR").trim(),
    category: Object.values(PROVIDER_ERROR_CATEGORIES).includes(error.category)
      ? error.category
      : PROVIDER_ERROR_CATEGORIES.UNKNOWN,
    message: String(error.message || "").trim(),
    retryable: Boolean(error.retryable),
    providerStatus: error.providerStatus === undefined ? undefined : Number(error.providerStatus)
  };
}

function createProviderResult({
  ok = false,
  data = null,
  confidence = {},
  provenance = {},
  warnings = [],
  errors = [],
  meta = {}
} = {}) {
  return {
    ok: Boolean(ok),
    data: ok ? data : null,
    confidence: normalizeConfidence(confidence),
    provenance: normalizeProvenance(provenance),
    warnings: Array.isArray(warnings) ? warnings.map(normalizeWarning) : [],
    errors: Array.isArray(errors) ? errors.map(normalizeError) : [],
    meta: meta && typeof meta === "object" ? meta : {}
  };
}

function providerSuccess(data, options = {}) {
  return createProviderResult({
    ...options,
    ok: true,
    data
  });
}

function providerFailure(errors = [], options = {}) {
  return createProviderResult({
    ...options,
    ok: false,
    data: null,
    errors: Array.isArray(errors) ? errors : [errors]
  });
}

module.exports = {
  createProviderResult,
  providerSuccess,
  providerFailure,
  normalizeConfidence,
  normalizeProvenance,
  normalizeWarning,
  normalizeError,
  confidenceLevelForScore
};
