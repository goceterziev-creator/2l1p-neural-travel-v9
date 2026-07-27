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

const DEFAULT_OPENAI_VISION_MODEL = "gpt-4.1-mini";

function createOpenAiProvider(config = {}) {
  const openAiConfig = config.ai?.openai || config.openai || {};
  const apiKey = openAiConfig.apiKey || "";
  const defaultModel = openAiConfig.visionModel || DEFAULT_OPENAI_VISION_MODEL;

  return {
    id: "openai",
    type: PROVIDER_TYPES.AI,
    version: "1.0.0",
    async health() {
      return {
        status: apiKey ? "ready" : "disabled",
        checkedAt: new Date().toISOString(),
        message: apiKey ? "OpenAI AI provider configured" : "OpenAI AI provider is missing an API key"
      };
    },
    async execute(request = {}, context = {}) {
      if (request.task !== "responses") {
        return providerFailure({
          code: "PROVIDER_INVALID_REQUEST",
          category: "invalid_request",
          message: `Unsupported OpenAI provider task: ${request.task || "(empty)"}`,
          retryable: false
        }, {
          provenance: provenance(context)
        });
      }

      if (!apiKey) {
        return providerFailure({
          code: "PROVIDER_AUTHENTICATION_FAILED",
          category: "authentication",
          message: "Missing OPENAI_API_KEY",
          retryable: false,
          providerStatus: 400
        }, {
          provenance: provenance(context)
        });
      }

      try {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: request.model || defaultModel,
            ...request.body
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          return providerFailure(classifyProviderHttpError(response.status, payload?.error?.message || `HTTP ${response.status}`), {
            provenance: provenance(context),
            meta: {
              model: request.model || defaultModel,
              providerStatus: response.status
            }
          });
        }

        return providerSuccess(payload, {
          confidence: {
            score: 1,
            reasons: ["Provider returned a successful structured response"]
          },
          provenance: provenance(context),
          meta: {
            model: request.model || defaultModel,
            providerStatus: response.status
          }
        });
      } catch (error) {
        return providerFailure(classifyProviderHttpError(error.statusCode || error.status || 0, error.message), {
          provenance: provenance(context),
          meta: {
            model: request.model || defaultModel,
            thrown: true
          }
        });
      }
    }
  };
}

function provenance(context = {}) {
  return {
    providerId: "openai",
    providerType: PROVIDER_TYPES.AI,
    sourceName: "OpenAI",
    retrievedAt: new Date().toISOString(),
    requestId: context.requestId || "",
    cached: false,
    fallbackUsed: Boolean(context.fallbackUsed)
  };
}

module.exports = {
  DEFAULT_OPENAI_VISION_MODEL,
  createOpenAiProvider
};
