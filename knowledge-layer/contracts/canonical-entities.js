"use strict";

const {
  KNOWLEDGE_CONTRACT_VERSION,
  KNOWLEDGE_ENTITY_TYPES,
  IMAGE_ASSET_STATUSES,
  assertKnowledgeEntityType
} = require("./knowledge-types");
const {
  cleanText,
  cleanList,
  normalizeKnowledgeConfidence,
  normalizeKnowledgeProvenance,
  normalizeKnowledgeWarnings
} = require("./knowledge-metadata");

function amount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Number(number.toFixed(2)) : null;
}

function knowledgeId(type, id = "") {
  assertKnowledgeEntityType(type);
  const cleaned = cleanText(id);
  return cleaned || "";
}

function baseKnowledgeEntity(type, value = {}) {
  assertKnowledgeEntityType(type);
  return {
    contractVersion: KNOWLEDGE_CONTRACT_VERSION,
    entityType: type,
    id: knowledgeId(type, value.id),
    confidence: normalizeKnowledgeConfidence(value.confidence),
    provenance: normalizeKnowledgeProvenance(value.provenance),
    warnings: normalizeKnowledgeWarnings(value.warnings)
  };
}

function createPriceKnowledge(value = {}) {
  return {
    ...baseKnowledgeEntity(KNOWLEDGE_ENTITY_TYPES.PRICE, value),
    amount: amount(value.amount ?? value.value),
    currency: cleanText(value.currency || "EUR").toUpperCase(),
    basis: cleanText(value.basis || "total")
  };
}

function createDestinationKnowledge(value = {}) {
  return {
    ...baseKnowledgeEntity(KNOWLEDGE_ENTITY_TYPES.DESTINATION, value),
    name: cleanText(value.name),
    requestedName: cleanText(value.requestedName || value.requested),
    country: cleanText(value.country),
    region: cleanText(value.region),
    aliases: cleanList(value.aliases)
  };
}

function createFlightSegmentKnowledge(value = {}) {
  return {
    ...baseKnowledgeEntity(KNOWLEDGE_ENTITY_TYPES.FLIGHT_SEGMENT, value),
    airlineName: cleanText(value.airlineName || value.airline),
    flightNumber: cleanText(value.flightNumber).toUpperCase(),
    fromAirportId: cleanText(value.fromAirportId),
    toAirportId: cleanText(value.toAirportId),
    fromAirportCode: cleanText(value.fromAirportCode || value.from).toUpperCase(),
    toAirportCode: cleanText(value.toAirportCode || value.to).toUpperCase(),
    departure: cleanText(value.departure),
    arrival: cleanText(value.arrival),
    duration: cleanText(value.duration),
    cabinClass: cleanText(value.cabinClass || value.class)
  };
}

function createFlightKnowledge(value = {}) {
  return {
    ...baseKnowledgeEntity(KNOWLEDGE_ENTITY_TYPES.FLIGHT, value),
    airlineName: cleanText(value.airlineName || value.airline),
    route: cleanText(value.route),
    outboundSegmentIds: cleanList(value.outboundSegmentIds),
    inboundSegmentIds: cleanList(value.inboundSegmentIds),
    priceId: cleanText(value.priceId),
    currency: cleanText(value.currency || "EUR").toUpperCase()
  };
}

function createHotelKnowledge(value = {}) {
  return {
    ...baseKnowledgeEntity(KNOWLEDGE_ENTITY_TYPES.HOTEL, value),
    name: cleanText(value.name),
    destinationId: cleanText(value.destinationId),
    area: cleanText(value.area),
    address: cleanText(value.address),
    stars: cleanText(value.stars),
    rating: cleanText(value.rating),
    roomIds: cleanList(value.roomIds),
    mealPlanIds: cleanList(value.mealPlanIds),
    priceId: cleanText(value.priceId),
    imageAssetIds: cleanList(value.imageAssetIds),
    externalRefs: cleanList(value.externalRefs)
  };
}

function createImageAssetKnowledge(value = {}) {
  const status = Object.values(IMAGE_ASSET_STATUSES).includes(value.status)
    ? value.status
    : IMAGE_ASSET_STATUSES.PENDING;

  return {
    ...baseKnowledgeEntity(KNOWLEDGE_ENTITY_TYPES.IMAGE_ASSET, value),
    url: cleanText(value.url),
    entityType: value.entityType ? assertKnowledgeEntityType(value.entityType) : "",
    entityId: cleanText(value.entityId),
    kind: cleanText(value.kind || "primary"),
    status,
    checksum: cleanText(value.checksum),
    width: Number.isFinite(Number(value.width)) ? Number(value.width) : null,
    height: Number.isFinite(Number(value.height)) ? Number(value.height) : null,
    approved: value.approved === true
  };
}

module.exports = {
  baseKnowledgeEntity,
  createDestinationKnowledge,
  createHotelKnowledge,
  createFlightKnowledge,
  createFlightSegmentKnowledge,
  createPriceKnowledge,
  createImageAssetKnowledge
};
