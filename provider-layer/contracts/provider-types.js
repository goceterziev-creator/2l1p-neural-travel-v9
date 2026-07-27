"use strict";

const PROVIDER_TYPES = Object.freeze({
  AI: "ai",
  SEARCH: "search",
  HOTEL: "hotel",
  FLIGHT: "flight",
  IMAGE: "image",
  MAPS: "maps"
});

const PROVIDER_HEALTH_STATUSES = Object.freeze({
  READY: "ready",
  DEGRADED: "degraded",
  UNAVAILABLE: "unavailable",
  DISABLED: "disabled"
});

const PROVIDER_CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown"
});

const PROVIDER_ERROR_CATEGORIES = Object.freeze({
  AUTHENTICATION: "authentication",
  QUOTA: "quota",
  TIMEOUT: "timeout",
  NETWORK: "network",
  INVALID_REQUEST: "invalid_request",
  INVALID_RESPONSE: "invalid_response",
  PROVIDER_UNAVAILABLE: "provider_unavailable",
  NORMALIZATION: "normalization",
  UNKNOWN: "unknown"
});

function assertProviderType(type) {
  if (!Object.values(PROVIDER_TYPES).includes(type)) {
    throw new Error(`Invalid provider type: ${type || "(empty)"}`);
  }
  return type;
}

module.exports = {
  PROVIDER_TYPES,
  PROVIDER_HEALTH_STATUSES,
  PROVIDER_CONFIDENCE_LEVELS,
  PROVIDER_ERROR_CATEGORIES,
  assertProviderType
};
