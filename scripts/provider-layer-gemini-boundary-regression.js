"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const adapter = fs.readFileSync(path.join(ROOT, "provider-layer", "adapters", "ai", "gemini-provider.js"), "utf8");

function assertServerGeminiBoundary() {
  [
    "process.env.GEMINI_API_KEY",
    "process.env.GEMINI_VISION_MODEL",
    "process.env.GEMINI_VISION_FALLBACK_MODEL",
    "generativelanguage.googleapis.com"
  ].forEach((needle) => {
    assert(!server.includes(needle), `server.js must not contain direct Gemini boundary: ${needle}`);
  });

  assert(server.includes('providerRegistry.get("gemini").execute'), "server.js must execute Gemini through providerRegistry");
  assert(server.includes("extractFlightWithGeminiVision"), "Gemini flight compatibility function must remain available");
  assert(server.includes("extractUniversalTravelWithGemini"), "Gemini universal intake compatibility function must remain available");
}

function assertAdapterOwnsGeminiBoundary() {
  [
    "generativelanguage.googleapis.com",
    "postGeminiVisionWithRetry",
    "normalizeGeminiVisionModel",
    "uniqueGeminiModels",
    "isTemporaryGeminiDemandError",
    "Missing GEMINI_API_KEY"
  ].forEach((needle) => {
    assert(adapter.includes(needle), `Gemini adapter must own ${needle}`);
  });

  assert(!adapter.includes('require("../../index")'), "Gemini adapter must avoid provider-layer index circular import");
  assert(!adapter.includes('require("../../../server")'), "Gemini adapter must not import server.js");
}

function main() {
  assertServerGeminiBoundary();
  assertAdapterOwnsGeminiBoundary();
  console.log("PROVIDER LAYER GEMINI BOUNDARY REGRESSION PASS");
}

try {
  main();
} catch (error) {
  console.error("PROVIDER LAYER GEMINI BOUNDARY REGRESSION FAIL:", error.message);
  process.exit(1);
}
