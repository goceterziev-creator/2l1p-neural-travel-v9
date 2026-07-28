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
  resolveDestinationDisplayFromKnowledge
} = require("../knowledge-layer");

function readText(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), "utf8");
}

function destinationBundle(name, overrides = {}) {
  return {
    destinations: [{
      contractVersion: KNOWLEDGE_CONTRACT_VERSION,
      entityType: KNOWLEDGE_ENTITY_TYPES.DESTINATION,
      id: "DST-ZURICH",
      name,
      requestedName: "",
      country: "Switzerland",
      region: "",
      aliases: [],
      confidence: {
        score: 0.9,
        level: "high",
        reasons: ["runtime adoption regression"],
        reviewed: false
      },
      provenance: {
        sourceType: KNOWLEDGE_SOURCE_TYPES.SYSTEM,
        sourceName: "GT63 proposalInput",
        sourceId: "OFF-RUNTIME-1",
        observedAt: "2026-07-28T00:00:00.000Z",
        evidenceIds: [],
        externalRefs: []
      },
      warnings: [],
      ...overrides
    }],
    hotels: [],
    flights: [],
    flightSegments: [],
    prices: [],
    imageAssets: [],
    warnings: []
  };
}

function assertKnowledgeMatch() {
  const result = resolveDestinationDisplayFromKnowledge({
    destination: { name: "Zurich" }
  }, "Zurich", {
    knowledgeBundle: destinationBundle("Zurich")
  });
  assert.equal(result.value, "Zurich", "matching Knowledge destination should be returned");
  assert.equal(result.source, "knowledge", "matching Knowledge destination should be used");
  assert.deepStrictEqual(result.diagnostics, [], "matching Knowledge destination should not warn");
}

function assertFallbackCases() {
  const missing = resolveDestinationDisplayFromKnowledge({ destination: { name: "Zurich" } }, "Zurich", {
    knowledgeBundle: { destinations: [] }
  });
  assert.equal(missing.value, "Zurich", "missing Knowledge should use legacy fallback");
  assert.equal(missing.source, "legacy");

  const mismatchLog = [];
  const mismatch = resolveDestinationDisplayFromKnowledge({ destination: { name: "Zurich" } }, "Zurich", {
    knowledgeBundle: destinationBundle("Geneva"),
    logger: (message, details) => mismatchLog.push({ message, details })
  });
  assert.equal(mismatch.value, "Zurich", "mismatched Knowledge should use legacy fallback");
  assert.equal(mismatch.source, "legacy");
  assert.equal(mismatch.diagnostics[0].code, "KNOWLEDGE_DESTINATION_MISMATCH");
  assert.equal(mismatchLog.length, 1, "mismatch should produce diagnostic event");

  const invalid = resolveDestinationDisplayFromKnowledge({ destination: { name: "Zurich" } }, "Zurich", {
    knowledgeBundle: destinationBundle("Zurich", { contractVersion: "broken" })
  });
  assert.equal(invalid.value, "Zurich", "invalid Knowledge contract should use legacy fallback");
  assert.equal(invalid.source, "legacy");

  const lowConfidence = resolveDestinationDisplayFromKnowledge({ destination: { name: "Zurich" } }, "Zurich", {
    knowledgeBundle: destinationBundle("Zurich", { confidence: { score: 0.2, level: "low", reasons: [], reviewed: false } }),
    minimumConfidenceScore: 0.8
  });
  assert.equal(lowConfidence.value, "Zurich", "low-confidence Knowledge should use legacy fallback");
  assert.equal(lowConfidence.source, "legacy");

  const mapperFailure = resolveDestinationDisplayFromKnowledge({ destination: { name: "Zurich" } }, "Zurich", {
    knowledgeBundle: null,
    mapProposalInputToKnowledge: () => {
      throw new Error("synthetic mapper failure");
    }
  });
  assert.equal(mapperFailure.value, "Zurich", "mapper failure should use legacy fallback");
}

function assertPresentationOutputStable() {
  const input = {
    destination: { name: "Tokyo", requested: "2027-03-28 - 2027-04-08" },
    client: { travelers: "2", travelDates: "2027-03-28 - 2027-04-08" },
    pricing: { currency: "EUR" },
    hotelOptions: [{ id: "hotel-1", name: "Tokyo Hotel", selected: true, price: 1000 }],
    hotel: { id: "hotel-1", name: "Tokyo Hotel", price: 1000 }
  };
  const first = viewModel.buildPresentationViewModel(input);
  const second = viewModel.buildPresentationViewModel(input);
  assert.deepStrictEqual(second.heroFacts, first.heroFacts, "controlled Knowledge runtime adoption must preserve existing hero facts");
  const destinationFact = first.heroFacts.find((fact) => fact[2] === "destination");
  assert.ok(destinationFact, "destination fact should still exist");
  assert.equal(destinationFact[1], "Токио", "destination display output should remain localized and stable");
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
  assert(!server.includes("resolveDestinationDisplayFromKnowledge"), "controlled runtime adoption must not alter server routes");
}

function main() {
  assertKnowledgeMatch();
  assertFallbackCases();
  assertPresentationOutputStable();
  assertBoundary();
  console.log("KNOWLEDGE LAYER CONTROLLED RUNTIME ADOPTION REGRESSION PASS");
}

try {
  main();
} catch (error) {
  console.error("KNOWLEDGE LAYER CONTROLLED RUNTIME ADOPTION REGRESSION FAIL:", error.message);
  process.exit(1);
}
