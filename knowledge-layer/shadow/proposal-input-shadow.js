"use strict";

const {
  mapProposalInputToKnowledge
} = require("../mappers/knowledge-mappers");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function amount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

function compareField(diagnostics, field, legacyValue, knowledgeValue) {
  const legacy = legacyValue === null || legacyValue === undefined ? "" : String(legacyValue);
  const knowledge = knowledgeValue === null || knowledgeValue === undefined ? "" : String(knowledgeValue);
  if (legacy !== knowledge) {
    diagnostics.push({
      code: "KNOWLEDGE_SHADOW_FIELD_MISMATCH",
      field,
      legacyValue: legacy,
      knowledgeValue: knowledge
    });
  }
}

function compareNumber(diagnostics, field, legacyValue, knowledgeValue) {
  const legacy = amount(legacyValue);
  const knowledge = amount(knowledgeValue);
  if (legacy !== knowledge) {
    diagnostics.push({
      code: "KNOWLEDGE_SHADOW_NUMBER_MISMATCH",
      field,
      legacyValue: legacy,
      knowledgeValue: knowledge
    });
  }
}

function evaluateProposalInputKnowledgeShadow(proposalInput = {}, options = {}) {
  const knowledge = mapProposalInputToKnowledge(proposalInput, options);
  const diagnostics = [];
  const destination = knowledge.destinations[0] || {};
  const flight = knowledge.flights[0] || {};
  const flightPrice = knowledge.prices.find((price) => price.id === flight.priceId) || {};
  const selectedHotel = knowledge.hotels[0] || {};
  const selectedHotelPrice = knowledge.prices.find((price) => price.id === selectedHotel.priceId) || {};
  const legacyHotelOptions = asArray(proposalInput.hotelOptions);

  compareField(diagnostics, "destination.name", cleanText(proposalInput.destination?.name), destination.name);
  compareField(diagnostics, "flight.airline", cleanText(proposalInput.flight?.airline), flight.airlineName);
  compareNumber(diagnostics, "flight.price", proposalInput.flight?.price, flightPrice.amount);
  compareField(diagnostics, "hotel.name", cleanText(proposalInput.hotel?.name), selectedHotel.name);
  compareNumber(diagnostics, "hotel.price", proposalInput.hotel?.price, selectedHotelPrice.amount);
  compareNumber(diagnostics, "hotelOptions.length", legacyHotelOptions.length, knowledge.hotels.length);

  const legacyImageCount = legacyHotelOptions.reduce((count, hotel) => count + asArray(hotel?.imageUrls).length, 0);
  compareNumber(diagnostics, "hotelOptions.imageUrls.length", legacyImageCount, knowledge.imageAssets.length);

  const result = {
    mode: "KNOWLEDGE_SHADOW",
    ok: diagnostics.length === 0,
    diagnostics,
    summary: {
      destinations: knowledge.destinations.length,
      hotels: knowledge.hotels.length,
      flights: knowledge.flights.length,
      flightSegments: knowledge.flightSegments.length,
      prices: knowledge.prices.length,
      imageAssets: knowledge.imageAssets.length
    },
    knowledge
  };

  if (!result.ok && typeof options.logger === "function") {
    options.logger("GT63 Knowledge Shadow mismatch", {
      diagnostics: result.diagnostics,
      summary: result.summary
    });
  }

  return result;
}

module.exports = {
  evaluateProposalInputKnowledgeShadow
};
