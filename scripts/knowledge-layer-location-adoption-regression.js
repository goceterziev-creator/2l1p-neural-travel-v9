"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const viewModel = require("../gt63-core/presentation-view-model");
const {
  KNOWLEDGE_CONTRACT_VERSION,
  KNOWLEDGE_ENTITY_TYPES,
  KNOWLEDGE_SOURCE_TYPES,
  resolveHotelLocationDisplayFromKnowledge
} = require("../knowledge-layer");

function readText(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), "utf8");
}

function hotelBundle(area, overrides = {}) {
  return {
    destinations: [],
    hotels: [{
      contractVersion: KNOWLEDGE_CONTRACT_VERSION,
      entityType: KNOWLEDGE_ENTITY_TYPES.HOTEL,
      id: "HOTEL-LOCATION-1",
      name: "Location Test Hotel",
      destinationId: "DST-LOCATION",
      area,
      address: "",
      stars: "",
      rating: "",
      roomIds: [],
      mealPlanIds: [],
      priceId: "",
      imageAssetIds: [],
      externalRefs: [],
      confidence: {
        score: 0.92,
        level: "high",
        reasons: ["location adoption regression"],
        reviewed: false
      },
      provenance: {
        sourceType: KNOWLEDGE_SOURCE_TYPES.SYSTEM,
        sourceName: "GT63 proposalInput",
        sourceId: "OFF-LOCATION-1",
        observedAt: "2026-07-28T00:00:00.000Z",
        evidenceIds: [],
        externalRefs: []
      },
      warnings: [],
      ...overrides
    }],
    flights: [],
    flightSegments: [],
    prices: [],
    imageAssets: [],
    warnings: []
  };
}

function assertKnowledgeLocationMatch() {
  const result = resolveHotelLocationDisplayFromKnowledge({
    hotel: { name: "Location Test Hotel", area: "Zurich" },
    hotelOptions: [{ name: "Location Test Hotel", area: "Zurich" }]
  }, "Zurich", {
    knowledgeBundle: hotelBundle("Zurich")
  });
  assert.equal(result.value, "Zurich", "matching HotelKnowledge location should be returned");
  assert.equal(result.source, "knowledge", "matching HotelKnowledge location should be used");
  assert.deepStrictEqual(result.diagnostics, [], "matching HotelKnowledge location should not warn");
}

function assertLocationFallbackCases() {
  const missing = resolveHotelLocationDisplayFromKnowledge({ hotel: { name: "Location Test Hotel", area: "Zurich" } }, "Zurich", {
    knowledgeBundle: hotelBundle("")
  });
  assert.equal(missing.value, "Zurich", "missing HotelKnowledge area should use legacy fallback");
  assert.equal(missing.source, "legacy");

  const logged = [];
  const mismatch = resolveHotelLocationDisplayFromKnowledge({ hotel: { name: "Location Test Hotel", area: "Zurich" } }, "Zurich", {
    knowledgeBundle: hotelBundle("Geneva"),
    logger: (message, details) => logged.push({ message, details })
  });
  assert.equal(mismatch.value, "Zurich", "mismatched HotelKnowledge area should use legacy fallback");
  assert.equal(mismatch.source, "legacy");
  assert.equal(mismatch.diagnostics[0].code, "KNOWLEDGE_HOTEL_LOCATION_MISMATCH");
  assert.equal(logged.length, 1, "location mismatch should emit diagnostic event");

  const invalid = resolveHotelLocationDisplayFromKnowledge({ hotel: { name: "Location Test Hotel", area: "Zurich" } }, "Zurich", {
    knowledgeBundle: hotelBundle("Zurich", { contractVersion: "broken" })
  });
  assert.equal(invalid.value, "Zurich", "invalid HotelKnowledge contract should use legacy location fallback");

  const lowConfidence = resolveHotelLocationDisplayFromKnowledge({ hotel: { name: "Location Test Hotel", area: "Zurich" } }, "Zurich", {
    knowledgeBundle: hotelBundle("Zurich", { confidence: { score: 0.2, level: "low", reasons: [], reviewed: false } }),
    minimumConfidenceScore: 0.8
  });
  assert.equal(lowConfidence.value, "Zurich", "low-confidence HotelKnowledge should use legacy location fallback");

  const mapperFailure = resolveHotelLocationDisplayFromKnowledge({ hotel: { name: "Location Test Hotel", area: "Zurich" } }, "Zurich", {
    knowledgeBundle: null,
    mapProposalInputToKnowledge: () => {
      throw new Error("synthetic location mapper failure");
    }
  });
  assert.equal(mapperFailure.value, "Zurich", "mapper failure should use legacy location fallback");
}

function assertPresentationOutputStable() {
  const input = {
    destination: { name: "Tokyo" },
    client: { travelers: "2" },
    pricing: { currency: "EUR" },
    hotelOptions: [{ id: "hotel-1", name: "Tokyo Hotel", selected: true, area: "Shinjuku", price: 1000 }],
    hotel: { id: "hotel-1", name: "Tokyo Hotel", area: "Shinjuku", price: 1000 }
  };
  const first = viewModel.buildPresentationViewModel(input);
  const second = viewModel.buildPresentationViewModel(input);
  assert.deepStrictEqual(second.heroFacts, first.heroFacts, "location adoption must preserve existing hero facts");
  const locationFact = first.heroFacts.find((fact) => fact[2] === "area");
  assert.ok(locationFact, "location fact should still exist");
  assert.equal(locationFact[1], "Shinjuku", "location display should preserve legacy output through Knowledge-controlled resolver");
}

function assertBoundary() {
  const files = [
    "knowledge-layer/runtime/destination-display-resolver.js",
    "gt63-core/presentation-view-model.js"
  ];
  files.forEach((file) => {
    const text = readText(file);
    assert(!/fetch\(|SERPAPI|GEMINI|OPENAI|database\.json|writeFile|readFile/.test(text), `${file} must not add provider or persistence behavior`);
  });
  const server = readText("server.js");
  assert(!server.includes("resolveHotelLocationDisplayFromKnowledge"), "location adoption must not alter server routes");
}

function main() {
  assertKnowledgeLocationMatch();
  assertLocationFallbackCases();
  assertPresentationOutputStable();
  assertBoundary();
  console.log("KNOWLEDGE LAYER LOCATION ADOPTION REGRESSION PASS");
}

try {
  main();
} catch (error) {
  console.error("KNOWLEDGE LAYER LOCATION ADOPTION REGRESSION FAIL:", error.message);
  process.exit(1);
}
