"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const providerLayer = require("../provider-layer");

function readText(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), "utf8");
}

function assertProviderResultContract() {
  const result = providerLayer.providerSuccess({ value: 42 }, {
    confidence: { score: 0.92, reasons: ["exact fixture match"] },
    provenance: {
      providerId: "fixture-ai",
      providerType: providerLayer.PROVIDER_TYPES.AI,
      sourceName: "fixture",
      cached: true,
      fallbackUsed: false
    },
    warnings: [{ code: "FIXTURE_NOTE", message: "Synthetic result" }],
    meta: { requestMs: 4 }
  });

  assert.equal(result.ok, true);
  assert.deepStrictEqual(result.data, { value: 42 });
  assert.equal(result.confidence.level, "high");
  assert.equal(result.provenance.providerId, "fixture-ai");
  assert.equal(result.provenance.cached, true);
  assert.equal(result.warnings[0].code, "FIXTURE_NOTE");

  const failure = providerLayer.providerFailure({
    code: "PROVIDER_QUOTA_EXCEEDED",
    category: providerLayer.PROVIDER_ERROR_CATEGORIES.QUOTA,
    message: "Quota exhausted",
    retryable: false,
    providerStatus: 429
  }, {
    provenance: {
      providerId: "serpapi",
      providerType: providerLayer.PROVIDER_TYPES.IMAGE,
      sourceName: "SerpAPI"
    }
  });

  assert.equal(failure.ok, false);
  assert.equal(failure.data, null);
  assert.equal(failure.errors[0].category, "quota");
  assert.equal(failure.errors[0].providerStatus, 429);
}

function assertErrorTaxonomy() {
  const quota = providerLayer.classifyProviderHttpError(429, "Quota exhausted");
  assert.equal(quota.code, "PROVIDER_QUOTA_EXCEEDED");
  assert.equal(quota.category, "quota");
  assert.equal(quota.retryable, false);

  const timeout = providerLayer.classifyProviderHttpError(504, "Gateway timeout");
  assert.equal(timeout.category, "timeout");
  assert.equal(timeout.retryable, true);
}

function assertRegistryContract() {
  const calls = [];
  const aiProvider = {
    id: "fixture-ai",
    type: providerLayer.PROVIDER_TYPES.AI,
    version: "1.0.0",
    health: async () => ({ status: "ready", checkedAt: new Date().toISOString() }),
    execute: async (request, context) => {
      calls.push({ request, context });
      return providerLayer.providerSuccess({ ok: true }, {
        provenance: {
          providerId: "fixture-ai",
          providerType: providerLayer.PROVIDER_TYPES.AI,
          sourceName: "fixture"
        }
      });
    }
  };

  const registry = providerLayer.createProviderRegistry([aiProvider]);
  assert.equal(registry.get("fixture-ai"), aiProvider);
  assert.equal(registry.get(providerLayer.PROVIDER_TYPES.AI), aiProvider);
  assert.equal(registry.list(providerLayer.PROVIDER_TYPES.AI).length, 1);

  return registry.get("fixture-ai").execute({ task: "contract-test" }, { requestId: "REQ-1" })
    .then((result) => {
      assert.equal(result.ok, true);
      assert.equal(calls[0].request.task, "contract-test");
    });
}

function assertConfigBoundary() {
  const config = providerLayer.loadProviderConfig({
    GEMINI_API_KEY: "gemini-secret",
    OPENAI_API_KEY: "openai-secret",
    SERPAPI_KEY: "serp-secret",
    AI_FLIGHT_PROVIDER: "auto",
    OPENAI_VISION_MODEL: "test-model"
  });

  assert.equal(config.ai.gemini.apiKey, "gemini-secret");
  assert.equal(config.ai.openai.visionModel, "test-model");
  assert.equal(config.image.serpapi.apiKey, "serp-secret");

  const redacted = providerLayer.redactProviderConfig({
    GEMINI_API_KEY: "gemini-secret",
    SERPAPI_KEY: "serp-secret",
    model: "visible"
  });
  assert.equal(redacted.GEMINI_API_KEY, "[redacted]");
  assert.equal(redacted.SERPAPI_KEY, "[redacted]");
  assert.equal(redacted.model, "visible");

  const status = providerLayer.providerSecretEnvStatus({ GEMINI_API_KEY: "x", SERPAPI_KEY: "" });
  assert.equal(status.find((item) => item.name === "GEMINI_API_KEY").configured, true);
  assert.equal(status.find((item) => item.name === "SERPAPI_KEY").configured, false);
}

function assertFoundationBoundary() {
  const providerFiles = [
    "provider-layer/contracts/provider-types.js",
    "provider-layer/contracts/provider-result.js",
    "provider-layer/errors/provider-errors.js",
    "provider-layer/registry/provider-registry.js",
    "provider-layer/config/provider-config.js",
    "provider-layer/index.js"
  ];

  providerFiles.forEach((file) => {
    const text = readText(file);
    assert(!/https:\/\/|fetch\(|generativelanguage|api\.openai\.com|serpapi\.com/.test(text), `${file} must not call external providers in foundation slice`);
    assert(!/require\(["']\.\.\/server|require\(["']\.\/server/.test(text), `${file} must not import server.js`);
  });

  const server = readText("server.js");
  assert(!server.includes("process.env.GEMINI_API_KEY"), "server.js must not read GEMINI_API_KEY after Gemini provider migration");
  assert(!server.includes("process.env.GEMINI_VISION_MODEL"), "server.js must not read GEMINI_VISION_MODEL after Gemini provider migration");
  assert(!server.includes("process.env.GEMINI_VISION_FALLBACK_MODEL"), "server.js must not read GEMINI_VISION_FALLBACK_MODEL after Gemini provider migration");
  assert(!server.includes("generativelanguage.googleapis.com"), "server.js must not call Gemini HTTP endpoints after Gemini provider migration");
  assert(!server.includes("process.env.OPENAI_API_KEY"), "server.js must not read OPENAI_API_KEY after OpenAI provider migration");
  assert(!server.includes("process.env.OPENAI_VISION_MODEL"), "server.js must not read OPENAI_VISION_MODEL after OpenAI provider migration");
  assert(!server.includes("api.openai.com/v1/responses"), "server.js must not call OpenAI HTTP endpoints after OpenAI provider migration");
  assert(!server.includes("process.env.SERPAPI_KEY"), "server.js must not read SERPAPI_KEY after SerpAPI provider migration");
  assert(!server.includes("https://serpapi.com/search.json"), "server.js must not call SerpAPI HTTP endpoints after SerpAPI provider migration");
}

async function main() {
  assertProviderResultContract();
  assertErrorTaxonomy();
  await assertRegistryContract();
  assertConfigBoundary();
  assertFoundationBoundary();
  console.log("PROVIDER LAYER FOUNDATION REGRESSION PASS");
}

main().catch((error) => {
  console.error("PROVIDER LAYER FOUNDATION REGRESSION FAIL:", error.message);
  process.exit(1);
});
