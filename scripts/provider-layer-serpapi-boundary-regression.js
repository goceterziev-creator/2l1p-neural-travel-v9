"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const adapter = fs.readFileSync(path.join(ROOT, "provider-layer", "adapters", "image", "serpapi-image-provider.js"), "utf8");

function assertServerSerpApiBoundary() {
  [
    "process.env.SERPAPI_KEY",
    "https://serpapi.com/search.json"
  ].forEach((needle) => {
    assert(!server.includes(needle), `server.js must not contain direct SerpAPI boundary: ${needle}`);
  });

  assert(server.includes('providerRegistry.get("serpapi").execute'), "server.js must execute SerpAPI image lookup through providerRegistry");
  assert(server.includes('providerRegistry.get("serpapi").health'), "server.js must check SerpAPI availability through provider health");
  assert(server.includes("findHotelImagesWithSerpApi"), "hotel image compatibility helper must remain available");
  assert(server.includes("findDestinationImageWithSerpApi"), "destination image compatibility helper must remain available");
}

function assertAdapterOwnsSerpApiBoundary() {
  [
    "https://serpapi.com/search.json",
    "Missing SERPAPI_KEY",
    "createSerpApiImageProvider",
    "hotel_images",
    "destination_image"
  ].forEach((needle) => {
    assert(adapter.includes(needle), `SerpAPI adapter must own ${needle}`);
  });

  assert(!adapter.includes('require("../../index")'), "SerpAPI adapter must avoid provider-layer index circular import");
  assert(!adapter.includes('require("../../../server")'), "SerpAPI adapter must not import server.js");
}

function main() {
  assertServerSerpApiBoundary();
  assertAdapterOwnsSerpApiBoundary();
  console.log("PROVIDER LAYER SERPAPI BOUNDARY REGRESSION PASS");
}

try {
  main();
} catch (error) {
  console.error("PROVIDER LAYER SERPAPI BOUNDARY REGRESSION FAIL:", error.message);
  process.exit(1);
}
