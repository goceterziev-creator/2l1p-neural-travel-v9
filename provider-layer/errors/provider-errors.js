"use strict";

const { PROVIDER_ERROR_CATEGORIES } = require("../contracts/provider-types");

const PROVIDER_ERROR_CODES = Object.freeze({
  AUTHENTICATION_FAILED: "PROVIDER_AUTHENTICATION_FAILED",
  QUOTA_EXCEEDED: "PROVIDER_QUOTA_EXCEEDED",
  TIMEOUT: "PROVIDER_TIMEOUT",
  NETWORK_ERROR: "PROVIDER_NETWORK_ERROR",
  INVALID_REQUEST: "PROVIDER_INVALID_REQUEST",
  INVALID_RESPONSE: "PROVIDER_INVALID_RESPONSE",
  UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  NORMALIZATION_FAILED: "PROVIDER_NORMALIZATION_FAILED",
  UNKNOWN: "PROVIDER_UNKNOWN_ERROR"
});

function providerError({
  code = PROVIDER_ERROR_CODES.UNKNOWN,
  category = PROVIDER_ERROR_CATEGORIES.UNKNOWN,
  message = "Provider request failed",
  retryable = false,
  providerStatus
} = {}) {
  return {
    code,
    category,
    message,
    retryable: Boolean(retryable),
    providerStatus
  };
}

function classifyProviderHttpError(status = 0, message = "") {
  const code = Number(status);
  const text = String(message || "").toLowerCase();

  if (code === 401 || code === 403) {
    return providerError({
      code: PROVIDER_ERROR_CODES.AUTHENTICATION_FAILED,
      category: PROVIDER_ERROR_CATEGORIES.AUTHENTICATION,
      message: message || `Provider authentication failed with HTTP ${code}`,
      retryable: false,
      providerStatus: code
    });
  }

  if (code === 429 || /quota|rate limit|limit exceeded|resource exhausted/.test(text)) {
    return providerError({
      code: PROVIDER_ERROR_CODES.QUOTA_EXCEEDED,
      category: PROVIDER_ERROR_CATEGORIES.QUOTA,
      message: message || "Provider quota exceeded",
      retryable: false,
      providerStatus: code || undefined
    });
  }

  if (code === 408 || code === 504 || /timeout|timed out/.test(text)) {
    return providerError({
      code: PROVIDER_ERROR_CODES.TIMEOUT,
      category: PROVIDER_ERROR_CATEGORIES.TIMEOUT,
      message: message || "Provider request timed out",
      retryable: true,
      providerStatus: code || undefined
    });
  }

  if ([500, 502, 503].includes(code) || /unavailable|overloaded|high demand/.test(text)) {
    return providerError({
      code: PROVIDER_ERROR_CODES.UNAVAILABLE,
      category: PROVIDER_ERROR_CATEGORIES.PROVIDER_UNAVAILABLE,
      message: message || `Provider unavailable with HTTP ${code}`,
      retryable: true,
      providerStatus: code || undefined
    });
  }

  return providerError({
    code: PROVIDER_ERROR_CODES.UNKNOWN,
    category: PROVIDER_ERROR_CATEGORIES.UNKNOWN,
    message: message || `Provider request failed with HTTP ${code || "unknown"}`,
    retryable: false,
    providerStatus: code || undefined
  });
}

module.exports = {
  PROVIDER_ERROR_CODES,
  providerError,
  classifyProviderHttpError
};
