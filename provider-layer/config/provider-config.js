"use strict";

const PROVIDER_SECRET_ENV_NAMES = Object.freeze([
  "GEMINI_API_KEY",
  "GEMINI_VISION_MODEL",
  "GEMINI_VISION_FALLBACK_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_VISION_MODEL",
  "AI_FLIGHT_PROVIDER",
  "FLIGHT_VISION_PROVIDER",
  "SERPAPI_KEY"
]);

function hasValue(value) {
  return String(value || "").trim().length > 0;
}

function redactProviderConfig(config = {}) {
  const redacted = {};
  Object.entries(config).forEach(([key, value]) => {
    if (/KEY|SECRET|TOKEN|PASSWORD/i.test(key)) {
      redacted[key] = hasValue(value) ? "[redacted]" : "";
      return;
    }
    redacted[key] = value;
  });
  return redacted;
}

function loadProviderConfig(env = process.env) {
  return {
    ai: {
      flightProvider: env.AI_FLIGHT_PROVIDER || env.FLIGHT_VISION_PROVIDER || "auto",
      gemini: {
        apiKey: env.GEMINI_API_KEY || "",
        visionModel: env.GEMINI_VISION_MODEL || "",
        fallbackModel: env.GEMINI_VISION_FALLBACK_MODEL || ""
      },
      openai: {
        apiKey: env.OPENAI_API_KEY || "",
        visionModel: env.OPENAI_VISION_MODEL || "gpt-4.1-mini"
      }
    },
    image: {
      serpapi: {
        apiKey: env.SERPAPI_KEY || ""
      }
    }
  };
}

function providerSecretEnvStatus(env = process.env) {
  return PROVIDER_SECRET_ENV_NAMES.map((name) => ({
    name,
    configured: hasValue(env[name]),
    secret: /KEY|SECRET|TOKEN|PASSWORD/i.test(name)
  }));
}

module.exports = {
  PROVIDER_SECRET_ENV_NAMES,
  loadProviderConfig,
  providerSecretEnvStatus,
  redactProviderConfig
};
