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
const FORENSIC_EVIDENCE_PERSISTENCE_FAILED = "FORENSIC_EVIDENCE_PERSISTENCE_FAILED";

function emitForensicEvidence(context = {}, event) {
  if (typeof context.forensicSink !== "function") return;
  try {
    context.forensicSink(Object.freeze(event));
  } catch (error) {
    const failure = new Error(`forensic evidence persistence failed: ${error.message}`);
    failure.code = FORENSIC_EVIDENCE_PERSISTENCE_FAILED;
    failure.cause = error;
    throw failure;
  }
}

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

        const rawHttpBody = await response.text();
        emitForensicEvidence(context, {
          stage: "raw_http_body",
          provider: "openai",
          providerStatus: response.status,
          body: rawHttpBody
        });

        let payload = {};
        try {
          payload = JSON.parse(rawHttpBody);
        } catch (error) {
          emitForensicEvidence(context, {
            stage: "outer_json_parse_failure",
            provider: "openai",
            providerStatus: response.status,
            errorName: error.name,
            errorMessage: error.message
          });
          // Preserve existing functional behavior: malformed provider JSON falls back to {}.
          payload = {};
        }

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
        if (error.code === FORENSIC_EVIDENCE_PERSISTENCE_FAILED) throw error;
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
  FORENSIC_EVIDENCE_PERSISTENCE_FAILED,
  createOpenAiProvider
};
