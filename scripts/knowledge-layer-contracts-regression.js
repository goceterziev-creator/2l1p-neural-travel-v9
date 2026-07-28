"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const knowledge = require("../knowledge-layer");

function readText(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), "utf8");
}

function assertEntityContracts() {
  const confidence = {
    score: 0.91,
    reasons: ["operator-confirmed source evidence"],
    reviewed: true
  };
  const provenance = {
    sourceType: knowledge.KNOWLEDGE_SOURCE_TYPES.IMPORT,
    sourceName: "GT63 Smart Import",
    sourceId: "SMART-1",
    evidenceIds: ["SRC-1"],
    externalRefs: ["booking-confirmation-1"]
  };

  const destination = knowledge.createDestinationKnowledge({
    id: "DST-SCL",
    name: "Santiago",
    requestedName: "Сантяго",
    country: "Chile",
    aliases: ["SCL", "Santiago de Chile"],
    confidence,
    provenance
  });
  assert.equal(destination.contractVersion, "1.0");
  assert.equal(destination.entityType, knowledge.KNOWLEDGE_ENTITY_TYPES.DESTINATION);
  assert.equal(destination.confidence.level, "high");
  assert.equal(destination.provenance.sourceType, "import");

  const price = knowledge.createPriceKnowledge({
    id: "PRICE-FLIGHT-1",
    amount: "812.405",
    currency: "eur",
    basis: "total",
    confidence,
    provenance
  });
  assert.equal(price.amount, 812.4);
  assert.equal(price.currency, "EUR");

  const outboundSegment = knowledge.createFlightSegmentKnowledge({
    id: "SEG-1",
    airline: "LATAM",
    flightNumber: " la 801 ",
    from: "sof",
    to: "scl",
    departure: "28.03.2027 08:00",
    arrival: "28.03.2027 22:00",
    confidence,
    provenance
  });
  assert.equal(outboundSegment.flightNumber, "LA 801");
  assert.equal(outboundSegment.fromAirportCode, "SOF");
  assert.equal(outboundSegment.toAirportCode, "SCL");

  const flight = knowledge.createFlightKnowledge({
    id: "FLT-1",
    airline: "LATAM",
    route: "SOF -> SCL / SCL -> SOF",
    outboundSegmentIds: [outboundSegment.id],
    inboundSegmentIds: ["SEG-2"],
    priceId: price.id,
    confidence,
    provenance
  });
  assert.deepStrictEqual(flight.outboundSegmentIds, ["SEG-1"]);
  assert.equal(flight.priceId, "PRICE-FLIGHT-1");

  const image = knowledge.createImageAssetKnowledge({
    id: "IMG-HOTEL-1",
    url: "https://example.test/hotel.webp",
    entityType: knowledge.KNOWLEDGE_ENTITY_TYPES.HOTEL,
    entityId: "HOTEL-1",
    status: knowledge.IMAGE_ASSET_STATUSES.APPROVED,
    checksum: "sha256-test",
    approved: true,
    confidence,
    provenance
  });
  assert.equal(image.status, "approved");
  assert.equal(image.entityType, "hotel");

  const hotel = knowledge.createHotelKnowledge({
    id: "HOTEL-1",
    name: "Holiday Inn Santiago - Airport Terminal by IHG",
    destinationId: destination.id,
    area: "Santiago",
    stars: "4",
    priceId: "PRICE-HOTEL-1",
    imageAssetIds: [image.id],
    confidence,
    provenance
  });
  assert.equal(hotel.destinationId, "DST-SCL");
  assert.deepStrictEqual(hotel.imageAssetIds, ["IMG-HOTEL-1"]);
}

function assertProviderAgnosticBoundary() {
  const files = [
    "knowledge-layer/contracts/knowledge-types.js",
    "knowledge-layer/contracts/knowledge-metadata.js",
    "knowledge-layer/contracts/canonical-entities.js",
    "knowledge-layer/index.js"
  ];

  files.forEach((file) => {
    const text = readText(file);
    assert(!/Gemini|OpenAI|SerpAPI|SERPAPI|GEMINI|OPENAI/.test(text), `${file} must stay provider-agnostic`);
    assert(!/fetch\(|https:\/\/|api\.openai|serpapi|generativelanguage/.test(text), `${file} must not call external providers`);
    assert(!/server\.js|DATABASE|database\.json|writeFile|readFile/.test(text), `${file} must not depend on runtime persistence`);
  });
}

function assertNoRuntimeWiring() {
  const server = readText("server.js");
  assert(!server.includes("knowledge-layer"), "Knowledge contracts foundation must not alter server runtime behavior");
}

function main() {
  assertEntityContracts();
  assertProviderAgnosticBoundary();
  assertNoRuntimeWiring();
  console.log("KNOWLEDGE LAYER CONTRACTS REGRESSION PASS");
}

try {
  main();
} catch (error) {
  console.error("KNOWLEDGE LAYER CONTRACTS REGRESSION FAIL:", error.message);
  process.exit(1);
}
