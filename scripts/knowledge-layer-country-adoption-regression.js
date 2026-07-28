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
  resolveDestinationCountryDisplayFromKnowledge
} = require("../knowledge-layer");

function readText(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), "utf8");
}

function destinationBundle(name, country, overrides = {}) {
  return {
    destinations: [{
      contractVersion: KNOWLEDGE_CONTRACT_VERSION,
      entityType: KNOWLEDGE_ENTITY_TYPES.DESTINATION,
      id: "DST-COUNTRY-1",
      name,
      requestedName: "",
      country,
      region: "",
      aliases: [],
      confidence: {
        score: 0.91,
        level: "high",
        reasons: ["country adoption regression"],
        reviewed: false
      },
      provenance: {
        sourceType: KNOWLEDGE_SOURCE_TYPES.SYSTEM,
        sourceName: "GT63 proposalInput",
        sourceId: "OFF-COUNTRY-1",
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

function assertKnowledgeCountryMatch() {
  const result = resolveDestinationCountryDisplayFromKnowledge({
    destination: { name: "Zurich", country: "Switzerland" }
  }, "Switzerland", {
    knowledgeBundle: destinationBundle("Zurich", "Switzerland")
  });
  assert.equal(result.value, "Switzerland", "matching Knowledge country should be returned");
  assert.equal(result.source, "knowledge", "matching Knowledge country should be used");
  assert.deepStrictEqual(result.diagnostics, [], "matching Knowledge country should not warn");
}

function assertCountryFallbackCases() {
  const missing = resolveDestinationCountryDisplayFromKnowledge({ destination: { name: "Zurich", country: "Switzerland" } }, "Switzerland", {
    knowledgeBundle: destinationBundle("Zurich", "")
  });
  assert.equal(missing.value, "Switzerland", "missing Knowledge country should use legacy fallback");
  assert.equal(missing.source, "legacy");

  const logged = [];
  const mismatch = resolveDestinationCountryDisplayFromKnowledge({ destination: { name: "Zurich", country: "Switzerland" } }, "Switzerland", {
    knowledgeBundle: destinationBundle("Zurich", "Austria"),
    logger: (message, details) => logged.push({ message, details })
  });
  assert.equal(mismatch.value, "Switzerland", "mismatched Knowledge country should use legacy fallback");
  assert.equal(mismatch.source, "legacy");
  assert.equal(mismatch.diagnostics[0].code, "KNOWLEDGE_DESTINATION_COUNTRY_MISMATCH");
  assert.equal(logged.length, 1, "country mismatch should emit diagnostic event");

  const invalid = resolveDestinationCountryDisplayFromKnowledge({ destination: { name: "Zurich", country: "Switzerland" } }, "Switzerland", {
    knowledgeBundle: destinationBundle("Zurich", "Switzerland", { contractVersion: "broken" })
  });
  assert.equal(invalid.value, "Switzerland", "invalid Knowledge contract should use legacy country fallback");

  const mapperFailure = resolveDestinationCountryDisplayFromKnowledge({ destination: { name: "Zurich", country: "Switzerland" } }, "Switzerland", {
    knowledgeBundle: null,
    mapProposalInputToKnowledge: () => {
      throw new Error("synthetic country mapper failure");
    }
  });
  assert.equal(mapperFailure.value, "Switzerland", "mapper failure should use legacy country fallback");
}

function assertExistingOutputStableWithoutCountry() {
  const input = {
    destination: { name: "Tokyo", requested: "2027-03-28 - 2027-04-08" },
    client: { travelers: "2", travelDates: "2027-03-28 - 2027-04-08" },
    pricing: { currency: "EUR" },
    hotelOptions: [{ id: "hotel-1", name: "Tokyo Hotel", selected: true, price: 1000 }],
    hotel: { id: "hotel-1", name: "Tokyo Hotel", price: 1000 }
  };
  const first = viewModel.buildPresentationViewModel(input);
  const second = viewModel.buildPresentationViewModel(input);
  assert.deepStrictEqual(second.heroFacts, first.heroFacts, "country adoption must not alter fixtures without country data");
  assert.equal(first.heroFacts.some((fact) => fact[2] === "country"), false, "country fact should not be invented");
}

function assertCountryDisplayConsumer() {
  const input = {
    destination: { name: "Zurich", country: "Switzerland" },
    client: { travelers: "2" },
    pricing: { currency: "EUR" },
    hotelOptions: [{ id: "hotel-1", name: "Zurich Hotel", selected: true, price: 1000 }],
    hotel: { id: "hotel-1", name: "Zurich Hotel", price: 1000 }
  };
  const result = viewModel.buildPresentationViewModel(input);
  const countryFact = result.heroFacts.find((fact) => fact[2] === "country");
  assert.ok(countryFact, "country display fact should exist when legacy country exists");
  assert.equal(countryFact[1], "Switzerland", "country display should preserve legacy output through Knowledge-controlled resolver");
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
  assert(!server.includes("resolveDestinationCountryDisplayFromKnowledge"), "country adoption must not alter server routes");
}

function main() {
  assertKnowledgeCountryMatch();
  assertCountryFallbackCases();
  assertExistingOutputStableWithoutCountry();
  assertCountryDisplayConsumer();
  assertBoundary();
  console.log("KNOWLEDGE LAYER COUNTRY ADOPTION REGRESSION PASS");
}

try {
  main();
} catch (error) {
  console.error("KNOWLEDGE LAYER COUNTRY ADOPTION REGRESSION FAIL:", error.message);
  process.exit(1);
}
