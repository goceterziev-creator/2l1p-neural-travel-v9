"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const knowledge = require("../knowledge-layer");
const { providerSuccess } = require("../provider-layer");

function readText(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), "utf8");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertMappingBundle(bundle) {
  assert.ok(Array.isArray(bundle.destinations), "destinations must be an array");
  assert.ok(Array.isArray(bundle.hotels), "hotels must be an array");
  assert.ok(Array.isArray(bundle.flights), "flights must be an array");
  assert.ok(Array.isArray(bundle.flightSegments), "flightSegments must be an array");
  assert.ok(Array.isArray(bundle.prices), "prices must be an array");
  assert.ok(Array.isArray(bundle.imageAssets), "imageAssets must be an array");
  [
    ...bundle.destinations,
    ...bundle.hotels,
    ...bundle.flights,
    ...bundle.flightSegments,
    ...bundle.prices
  ].forEach((entity) => {
    assert.equal(entity.contractVersion, knowledge.KNOWLEDGE_CONTRACT_VERSION, `${entity.id} should use current contract version`);
    assert.ok(entity.confidence, `${entity.id} should carry confidence`);
    assert.ok(entity.provenance, `${entity.id} should carry provenance`);
  });
}

function assertProductModelMapping() {
  const productModel = {
    destination: { name: "Santiago", country: "Chile", aliases: ["SCL"] },
    currency: "EUR",
    flight: {
      airline: "LATAM",
      route: "SOF -> SCL / SCL -> SOF",
      price: 812.4,
      currency: "EUR",
      outboundSegments: [{
        airline: "LATAM",
        flightNumber: "LA801",
        from: "SOF",
        to: "SCL",
        departure: "2027-03-28T08:00:00"
      }],
      inboundSegments: [{
        airline: "LATAM",
        flightNumber: "LA802",
        from: "SCL",
        to: "SOF",
        departure: "2027-04-08T22:00:00"
      }]
    },
    hotelOptions: [
      {
        name: "Holiday Inn Santiago - Airport Terminal by IHG",
        area: "Santiago",
        room: "Standard room",
        meal: "Breakfast",
        price: 1750,
        imageUrls: ["https://assets.example.test/hotels/holiday.webp"],
        selected: true
      },
      {
        name: "Pullman Santiago Vitacura",
        area: "Santiago",
        price: 1920,
        images: ["https://assets.example.test/hotels/pullman.webp"]
      }
    ],
    sourceEvidence: {
      intakeId: "SMART-MAPPING-1",
      sources: [
        { sourceId: "SRC-1", confidence: 0.98 },
        { sourceId: "SRC-2", confidence: 0.96 }
      ]
    }
  };
  const original = clone(productModel);
  const first = knowledge.mapProductModelToKnowledge(productModel);
  const second = knowledge.mapProductModelToKnowledge(productModel);
  assert.deepStrictEqual(productModel, original, "mapper must not mutate product model input");
  assert.deepStrictEqual(first, second, "product model mapping must be deterministic");
  assertMappingBundle(first);
  assert.equal(first.destinations.length, 1, "destination should map");
  assert.equal(first.hotels.length, 2, "hotel options should map without overwrite");
  assert.equal(first.flights.length, 1, "flight should map");
  assert.equal(first.flightSegments.length, 2, "flight segments should map");
  assert.equal(first.prices.length, 3, "flight and hotel prices should map");
  assert.equal(first.imageAssets.length, 2, "hotel image urls should map as image asset knowledge");
  assert.equal(first.flights[0].priceId, first.prices[0].id, "flight should reference its price knowledge");
  assert.ok(first.hotels[0].imageAssetIds.length, "hotel should reference image asset ids");
  assert.deepStrictEqual(first.destinations[0].provenance.evidenceIds, ["SRC-1", "SRC-2"], "source evidence ids should be preserved as provenance");
}

function assertProposalInputMapping() {
  const proposalInput = {
    source: { offerId: "OFF-MAPPING-1" },
    destination: { name: "Zurich" },
    flight: {
      airline: "Swiss",
      route: "SOF -> ZRH",
      price: 420,
      currency: "EUR",
      outboundSegments: [{ flightNumber: "LX1391", from: "SOF", to: "ZRH" }]
    },
    hotel: {
      name: "Baur au Lac",
      area: "Zurich",
      price: 2200,
      imageUrls: ["https://assets.example.test/hotels/baur.webp"]
    },
    hotelOptions: [{
      name: "Baur au Lac",
      area: "Zurich",
      price: 2200,
      imageUrls: ["https://assets.example.test/hotels/baur.webp"]
    }],
    pricing: { currency: "EUR" }
  };
  const mapped = knowledge.mapProposalInputToKnowledge(proposalInput);
  assertMappingBundle(mapped);
  assert.equal(mapped.destinations[0].name, "Zurich", "proposal destination should map");
  assert.equal(mapped.hotels[0].name, "Baur au Lac", "proposal hotel should map");
  assert.equal(mapped.flights[0].airlineName, "Swiss", "proposal flight should map");
  assert.equal(mapped.destinations[0].provenance.sourceType, knowledge.KNOWLEDGE_SOURCE_TYPES.SYSTEM, "proposalInput should map as system provenance");
  assert.equal(mapped.destinations[0].provenance.sourceId, "OFF-MAPPING-1", "offer id should become provenance source id");
}

function assertProviderResultMapping() {
  const providerResult = providerSuccess([
    { url: "https://assets.example.test/image-1.webp", approved: true },
    { url: "https://assets.example.test/image-2.webp" }
  ], {
    confidence: { score: 0.78, reasons: ["provider returned matching visual assets"] },
    provenance: {
      providerId: "image-provider",
      providerType: "image",
      sourceName: "Synthetic Image Provider",
      retrievedAt: "2026-07-27T10:00:00.000Z",
      requestId: "REQ-1",
      cached: false,
      fallbackUsed: false
    }
  });
  const mapped = knowledge.mapProviderResultToKnowledge(providerResult, {
    entityType: knowledge.KNOWLEDGE_ENTITY_TYPES.HOTEL,
    entityId: "HOTEL-SANTIAGO-1"
  });
  assertMappingBundle(mapped);
  assert.equal(mapped.imageAssets.length, 2, "provider image array should map to image assets");
  assert.equal(mapped.imageAssets[0].provenance.sourceType, knowledge.KNOWLEDGE_SOURCE_TYPES.PROVIDER, "provider result should preserve provider provenance");
  assert.equal(mapped.imageAssets[0].confidence.level, "medium", "provider confidence should map to knowledge confidence");

  const failure = knowledge.mapProviderResultToKnowledge({ ok: false, errors: [{ code: "PROVIDER_QUOTA_EXCEEDED" }] });
  assert.equal(failure.imageAssets.length, 0, "failed provider result should not invent knowledge");
  assert.equal(failure.warnings[0].code, "KNOWLEDGE_PROVIDER_RESULT_UNAVAILABLE", "failed provider result should produce a warning");
}

function assertProviderAgnosticBoundary() {
  const files = [
    "knowledge-layer/mappers/knowledge-mappers.js",
    "knowledge-layer/index.js"
  ];
  files.forEach((file) => {
    const text = readText(file);
    assert(!/GEMINI|OPENAI|SERPAPI|Gemini|OpenAI|SerpAPI/.test(text), `${file} must stay provider-agnostic`);
    assert(!/fetch\(|https:\/\/api|generativelanguage|openai\.com|serpapi\.com/.test(text), `${file} must not call providers`);
    assert(!/DATABASE|database\.json|writeFile|readFile|server\.js/.test(text), `${file} must not depend on persistence or runtime`);
  });
}

function assertNoRuntimeWiring() {
  const server = readText("server.js");
  assert(!server.includes("knowledge-layer"), "Knowledge mapping layer must not alter server runtime behavior");
}

function main() {
  assertProductModelMapping();
  assertProposalInputMapping();
  assertProviderResultMapping();
  assertProviderAgnosticBoundary();
  assertNoRuntimeWiring();
  console.log("KNOWLEDGE LAYER MAPPING REGRESSION PASS");
}

try {
  main();
} catch (error) {
  console.error("KNOWLEDGE LAYER MAPPING REGRESSION FAIL:", error.message);
  process.exit(1);
}
