"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const adapter = fs.readFileSync(path.join(ROOT, "provider-layer", "adapters", "ai", "openai-provider.js"), "utf8");

function assertServerOpenAiBoundary() {
  [
    "process.env.OPENAI_API_KEY",
    "process.env.OPENAI_VISION_MODEL",
    "https://api.openai.com/v1/responses"
  ].forEach((needle) => {
    assert(!server.includes(needle), `server.js must not contain direct OpenAI boundary: ${needle}`);
  });

  assert(server.includes('providerRegistry.get("openai").execute'), "server.js must execute OpenAI through providerRegistry");
  assert(server.includes('providerRegistry.get("openai").health'), "server.js must check OpenAI availability through provider health");
  assert(server.includes("extractFlightWithOpenAiVision"), "OpenAI flight fallback compatibility function must remain available");
  assert(server.includes("callVisionJson"), "OpenAI hotel vision compatibility function must remain available");
}

function assertAdapterOwnsOpenAiBoundary() {
  [
    "https://api.openai.com/v1/responses",
    "Missing OPENAI_API_KEY",
    "createOpenAiProvider",
    "DEFAULT_OPENAI_VISION_MODEL"
  ].forEach((needle) => {
    assert(adapter.includes(needle), `OpenAI adapter must own ${needle}`);
  });

  assert(!adapter.includes('require("../../index")'), "OpenAI adapter must avoid provider-layer index circular import");
  assert(!adapter.includes('require("../../../server")'), "OpenAI adapter must not import server.js");
}

function main() {
  assertServerOpenAiBoundary();
  assertAdapterOwnsOpenAiBoundary();
  console.log("PROVIDER LAYER OPENAI BOUNDARY REGRESSION PASS");
}

try {
  main();
} catch (error) {
  console.error("PROVIDER LAYER OPENAI BOUNDARY REGRESSION FAIL:", error.message);
  process.exit(1);
}
