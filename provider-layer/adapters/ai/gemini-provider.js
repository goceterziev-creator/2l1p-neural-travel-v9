"use strict";

const {
  PROVIDER_TYPES
} = require("../../contracts/provider-types");
const {
  providerSuccess,
  providerFailure
} = require("../../contracts/provider-result");
const {
  classifyProviderHttpError
} = require("../../errors/provider-errors");

const DEFAULT_GEMINI_VISION_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_VISION_FALLBACK_MODEL = "gemini-2.0-flash";

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeProviderDetails(details = "") {
  return String(details || "")
    .replace(/key=([^&\s]+)/gi, "key=[redacted]")
    .replace(/api[_-]?key["']?\s*[:=]\s*["']?[^"',\s]+/gi, "apiKey=[redacted]")
    .slice(0, 800);
}

function normalizeGeminiVisionModel(model = "") {
  const value = String(model || "").trim();
  if (!value) return "";
  if (value === "gemini-1.5-flash" || value === "models/gemini-1.5-flash") {
    console.warn("GT63 GEMINI LEGACY MODEL IGNORED: gemini-1.5-flash is no longer used for vision intake. Falling back to gemini-2.0-flash.");
    return DEFAULT_GEMINI_VISION_FALLBACK_MODEL;
  }
  return value.replace(/^models\//, "");
}

function uniqueGeminiModels(primary = "", fallback = "") {
  return [primary, fallback]
    .map((model) => normalizeGeminiVisionModel(model))
    .filter(Boolean)
    .filter((model, index, list) => list.indexOf(model) === index);
}

function geminiResponseErrorMessage(payload = {}, fallback = "") {
  return String(payload?.error?.message || payload?.error?.status || fallback || "Gemini request failed");
}

function isTemporaryGeminiDemandError(status = 0, message = "") {
  const text = String(message || "").toLowerCase();
  return [429, 500, 502, 503, 504].includes(Number(status)) ||
    /high demand|temporar|try again later|overloaded|resource exhausted|rate limit|quota|unavailable|capacity/.test(text);
}

function createGeminiProvider(config = {}) {
  const geminiConfig = config.ai?.gemini || config.gemini || {};
  const apiKey = geminiConfig.apiKey || "";
  const provider = {
    id: "gemini",
    type: PROVIDER_TYPES.AI,
    version: "1.0.0",
    async health() {
      return {
        status: apiKey ? "ready" : "disabled",
        checkedAt: new Date().toISOString(),
        message: apiKey ? "Gemini AI provider configured" : "Gemini AI provider is missing an API key"
      };
    },
    async execute(request = {}, context = {}) {
      if (request.task !== "generate_content") {
        return providerFailure({
          code: "PROVIDER_INVALID_REQUEST",
          category: "invalid_request",
          message: `Unsupported Gemini provider task: ${request.task || "(empty)"}`,
          retryable: false
        }, {
          provenance: provenance(context, { fallbackUsed: false })
        });
      }

      try {
        const result = await postGeminiVisionWithRetry({
          apiKey,
          requestBody: request.requestBody,
          primaryModel: request.primaryModel || geminiConfig.visionModel,
          fallbackModel: request.fallbackModel || geminiConfig.fallbackModel,
          requestId: context.requestId || request.requestId || "",
          label: request.label || "Gemini Vision"
        });

        if (!result.response?.ok) {
          return providerFailure(classifyProviderHttpError(result.status, result.message), {
            provenance: provenance(context, {
              fallbackUsed: Boolean(result.model && result.model !== normalizeGeminiVisionModel(request.primaryModel || geminiConfig.visionModel || DEFAULT_GEMINI_VISION_MODEL))
            }),
            meta: {
              model: result.model || "",
              attempt: result.attempt || 0,
              providerStatus: result.status || 0
            }
          });
        }

        return providerSuccess(result.payload || {}, {
          confidence: {
            score: 1,
            reasons: ["Provider returned a successful structured response"]
          },
          provenance: provenance(context, {
            fallbackUsed: Boolean(result.model && result.model !== normalizeGeminiVisionModel(request.primaryModel || geminiConfig.visionModel || DEFAULT_GEMINI_VISION_MODEL))
          }),
          meta: {
            model: result.model || "",
            attempt: result.attempt || 0,
            providerStatus: result.response?.status || 200
          }
        });
      } catch (error) {
        return providerFailure(classifyProviderHttpError(error.statusCode || error.status || 0, error.message), {
          provenance: provenance(context, { fallbackUsed: false }),
          meta: { thrown: true }
        });
      }
    }
  };

  return provider;
}

function provenance(context = {}, options = {}) {
  return {
    providerId: "gemini",
    providerType: PROVIDER_TYPES.AI,
    sourceName: "Google Gemini",
    retrievedAt: new Date().toISOString(),
    requestId: context.requestId || "",
    cached: false,
    fallbackUsed: Boolean(options.fallbackUsed)
  };
}

async function postGeminiVisionWithRetry({
  apiKey,
  requestBody,
  primaryModel = "",
  fallbackModel = "",
  requestId = "",
  label = "Gemini Vision"
} = {}) {
  if (!apiKey) {
    return {
      response: null,
      payload: {},
      model: "",
      attempt: 0,
      status: 400,
      message: "Missing GEMINI_API_KEY"
    };
  }

  const models = uniqueGeminiModels(
    primaryModel || DEFAULT_GEMINI_VISION_MODEL,
    fallbackModel || DEFAULT_GEMINI_VISION_FALLBACK_MODEL
  );
  let last = null;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];
    const maxAttempts = modelIndex === 0 ? 2 : 1;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          if (modelIndex > 0 || attempt > 1) {
            console.warn(`[Gemini Retry] requestId=${requestId || "-"} label=${label} recovered model=${model} attempt=${attempt}`);
          }
          return { response, payload, model, attempt };
        }

        const message = geminiResponseErrorMessage(payload, `HTTP ${response.status}`);
        last = { response, payload, model, attempt, status: response.status, message };
        if (isTemporaryGeminiDemandError(response.status, message) && (attempt < maxAttempts || modelIndex < models.length - 1)) {
          console.warn(`[Gemini Retry] requestId=${requestId || "-"} label=${label} model=${model} attempt=${attempt} status=${response.status} reason=${sanitizeProviderDetails(message)}`);
          await wait(700 * attempt);
          continue;
        }

        return last;
      } catch (error) {
        last = { response: null, payload: {}, model, attempt, status: 0, message: error.message, error };
        if (attempt < maxAttempts || modelIndex < models.length - 1) {
          console.warn(`[Gemini Retry] requestId=${requestId || "-"} label=${label} model=${model} attempt=${attempt} status=network reason=${sanitizeProviderDetails(error.message)}`);
          await wait(700 * attempt);
          continue;
        }
        throw error;
      }
    }
  }

  return last || { response: null, payload: {}, model: "", attempt: 0, status: 0, message: "Gemini request failed" };
}

module.exports = {
  DEFAULT_GEMINI_VISION_MODEL,
  DEFAULT_GEMINI_VISION_FALLBACK_MODEL,
  createGeminiProvider,
  normalizeGeminiVisionModel,
  uniqueGeminiModels,
  isTemporaryGeminiDemandError,
  postGeminiVisionWithRetry
};
