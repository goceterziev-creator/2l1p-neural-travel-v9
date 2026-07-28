"use strict";

const KNOWLEDGE_CONTRACT_VERSION = "1.0";

const KNOWLEDGE_ENTITY_TYPES = Object.freeze({
  DESTINATION: "destination",
  HOTEL: "hotel",
  FLIGHT: "flight",
  FLIGHT_SEGMENT: "flight_segment",
  PRICE: "price",
  IMAGE_ASSET: "image_asset"
});

const KNOWLEDGE_SOURCE_TYPES = Object.freeze({
  PROVIDER: "provider",
  IMPORT: "import",
  OPERATOR: "operator",
  SYSTEM: "system",
  REFERENCE: "reference",
  UNKNOWN: "unknown"
});

const KNOWLEDGE_CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown"
});

const IMAGE_ASSET_STATUSES = Object.freeze({
  APPROVED: "approved",
  PENDING: "pending",
  UNAVAILABLE: "unavailable",
  REJECTED: "rejected"
});

function assertKnowledgeEntityType(type) {
  if (!Object.values(KNOWLEDGE_ENTITY_TYPES).includes(type)) {
    throw new Error(`Invalid knowledge entity type: ${type || "(empty)"}`);
  }
  return type;
}

module.exports = {
  KNOWLEDGE_CONTRACT_VERSION,
  KNOWLEDGE_ENTITY_TYPES,
  KNOWLEDGE_SOURCE_TYPES,
  KNOWLEDGE_CONFIDENCE_LEVELS,
  IMAGE_ASSET_STATUSES,
  assertKnowledgeEntityType
};
