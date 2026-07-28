"use strict";

const {
  KNOWLEDGE_ENTITY_TYPES,
  KNOWLEDGE_SOURCE_TYPES,
  IMAGE_ASSET_STATUSES
} = require("../contracts/knowledge-types");
const {
  cleanText,
  cleanList,
  normalizeKnowledgeConfidence,
  normalizeKnowledgeProvenance,
  normalizeKnowledgeWarnings
} = require("../contracts/knowledge-metadata");
const {
  createDestinationKnowledge,
  createHotelKnowledge,
  createFlightKnowledge,
  createFlightSegmentKnowledge,
  createPriceKnowledge,
  createImageAssetKnowledge
} = require("../contracts/canonical-entities");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function slugPart(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableId(prefix, ...parts) {
  const suffix = parts.map(slugPart).filter(Boolean).join("-");
  return suffix ? `${prefix}-${suffix}`.toUpperCase() : "";
}

function firstText(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return null;
}

function createKnowledgeBundle(value = {}) {
  return {
    destinations: asArray(value.destinations),
    hotels: asArray(value.hotels),
    flights: asArray(value.flights),
    flightSegments: asArray(value.flightSegments),
    prices: asArray(value.prices),
    imageAssets: asArray(value.imageAssets),
    warnings: normalizeKnowledgeWarnings(value.warnings)
  };
}

function confidenceFromProvider(providerResult = {}) {
  return normalizeKnowledgeConfidence({
    ...asObject(providerResult.confidence),
    reviewed: false
  });
}

function provenanceFromProvider(providerResult = {}) {
  const provenance = asObject(providerResult.provenance);
  return normalizeKnowledgeProvenance({
    sourceType: KNOWLEDGE_SOURCE_TYPES.PROVIDER,
    sourceName: provenance.sourceName,
    sourceId: firstText(provenance.providerId, provenance.requestId),
    observedAt: provenance.retrievedAt || "unknown",
    externalRefs: cleanList([provenance.sourceUrl])
  });
}

function provenanceFromInput(input = {}, fallback = {}) {
  const sourceEvidence = asObject(input.sourceEvidence);
  const importContext = asObject(input.importContext);
  const sources = asArray(sourceEvidence.sources);
  const fallbackProvenance = asObject(fallback.provenance);
  return normalizeKnowledgeProvenance({
    sourceType: fallbackProvenance.sourceType || KNOWLEDGE_SOURCE_TYPES.IMPORT,
    sourceName: fallbackProvenance.sourceName || "GT63 import",
    sourceId: firstText(sourceEvidence.intakeId, importContext.intakeId, input.id, fallbackProvenance.sourceId),
    observedAt: firstText(
      fallbackProvenance.observedAt,
      sourceEvidence.createdAt,
      sourceEvidence.observedAt,
      importContext.createdAt,
      importContext.observedAt,
      input.createdAt,
      "unknown"
    ),
    evidenceIds: sources.map((source) => source?.sourceId),
    externalRefs: fallbackProvenance.externalRefs
  });
}

function confidenceFromInput(input = {}, fallback = {}) {
  const sourceEvidence = asObject(input.sourceEvidence);
  const sourceConfidences = asArray(sourceEvidence.sources)
    .map((source) => Number(source?.confidence))
    .filter(Number.isFinite);
  const score = sourceConfidences.length
    ? sourceConfidences.reduce((sum, value) => sum + value, 0) / sourceConfidences.length
    : fallback.confidence?.score;
  return normalizeKnowledgeConfidence({
    ...asObject(fallback.confidence),
    score,
    reasons: [
      ...cleanList(fallback.confidence?.reasons),
      sourceConfidences.length ? "Mapped from source evidence confidence" : ""
    ]
  });
}

function mapImagesToKnowledge(images, owner, context) {
  return asArray(images)
    .map((image, index) => {
      const imageObject = typeof image === "string" ? { url: image } : asObject(image);
      const url = firstText(imageObject.url, imageObject.imageUrl, imageObject.src, imageObject.original);
      if (!url) return null;
      const id = stableId("IMG", owner.type, owner.id, index + 1, url);
      return createImageAssetKnowledge({
        id,
        url,
        entityType: owner.type,
        entityId: owner.id,
        kind: imageObject.kind || "primary",
        status: imageObject.status || IMAGE_ASSET_STATUSES.PENDING,
        checksum: imageObject.checksum,
        width: imageObject.width,
        height: imageObject.height,
        approved: imageObject.approved === true,
        confidence: context.confidence,
        provenance: context.provenance
      });
    })
    .filter(Boolean);
}

function priceKnowledge(id, amount, currency, basis, context) {
  if (amount === null || amount === undefined) return null;
  return createPriceKnowledge({
    id,
    amount,
    currency,
    basis,
    confidence: context.confidence,
    provenance: context.provenance
  });
}

function segmentKnowledge(segment, direction, index, context) {
  const value = asObject(segment);
  const id = stableId("SEG", direction, index + 1, value.flightNumber, value.fromAirportCode || value.from, value.toAirportCode || value.to);
  return createFlightSegmentKnowledge({
    id,
    airlineName: firstText(value.airlineName, value.airline),
    flightNumber: value.flightNumber,
    fromAirportId: value.fromAirportId,
    toAirportId: value.toAirportId,
    fromAirportCode: firstText(value.fromAirportCode, value.from),
    toAirportCode: firstText(value.toAirportCode, value.to),
    departure: value.departure,
    arrival: value.arrival,
    duration: value.duration,
    cabinClass: firstText(value.cabinClass, value.class),
    confidence: context.confidence,
    provenance: context.provenance
  });
}

function mapFlightToKnowledge(flight, context) {
  const value = asObject(flight);
  if (!Object.keys(value).length) return createKnowledgeBundle();
  const outboundSegments = asArray(value.outboundSegments).map((segment, index) => segmentKnowledge(segment, "outbound", index, context));
  const inboundSegments = asArray(value.inboundSegments).map((segment, index) => segmentKnowledge(segment, "inbound", index, context));
  const flightAmount = firstNumber(value.price, value.totalPrice, value.amount);
  const priceId = flightAmount === null ? "" : stableId("PRICE", "flight", value.airline, value.route, flightAmount);
  const flightId = stableId("FLT", value.airline, value.route, value.departure, value.arrival);
  const price = priceKnowledge(priceId, flightAmount, value.currency || context.currency, "total", context);
  const flightKnowledge = createFlightKnowledge({
    id: flightId,
    airlineName: firstText(value.airlineName, value.airline),
    route: value.route,
    outboundSegmentIds: outboundSegments.map((segment) => segment.id),
    inboundSegmentIds: inboundSegments.map((segment) => segment.id),
    priceId,
    currency: value.currency || context.currency,
    confidence: context.confidence,
    provenance: context.provenance
  });
  return createKnowledgeBundle({
    flights: [flightKnowledge],
    flightSegments: [...outboundSegments, ...inboundSegments],
    prices: price ? [price] : []
  });
}

function mapHotelToKnowledge(hotel, index, context) {
  const value = asObject(hotel);
  if (!Object.keys(value).length) return createKnowledgeBundle();
  const hotelId = stableId("HOTEL", value.name, value.area || context.destinationName, index + 1);
  const hotelAmount = firstNumber(value.price, value.totalPrice, value.amount);
  const priceId = hotelAmount === null ? "" : stableId("PRICE", "hotel", value.name, hotelAmount);
  const images = [
    ...asArray(value.imageUrls),
    ...asArray(value.images),
    value.image,
    value.imageUrl
  ].filter(Boolean);
  const imageAssets = mapImagesToKnowledge(images, {
    type: KNOWLEDGE_ENTITY_TYPES.HOTEL,
    id: hotelId
  }, context);
  const price = priceKnowledge(priceId, hotelAmount, value.currency || context.currency, "total", context);
  const hotelKnowledge = createHotelKnowledge({
    id: hotelId,
    name: value.name,
    destinationId: context.destinationId,
    area: value.area,
    address: value.address,
    stars: value.stars,
    rating: value.rating,
    priceId,
    imageAssetIds: imageAssets.map((image) => image.id),
    externalRefs: cleanList([value.sourceUrl, value.providerUrl]),
    confidence: context.confidence,
    provenance: context.provenance
  });
  return createKnowledgeBundle({
    hotels: [hotelKnowledge],
    prices: price ? [price] : [],
    imageAssets
  });
}

function mergeBundles(...bundles) {
  return createKnowledgeBundle({
    destinations: bundles.flatMap((bundle) => asArray(bundle.destinations)),
    hotels: bundles.flatMap((bundle) => asArray(bundle.hotels)),
    flights: bundles.flatMap((bundle) => asArray(bundle.flights)),
    flightSegments: bundles.flatMap((bundle) => asArray(bundle.flightSegments)),
    prices: bundles.flatMap((bundle) => asArray(bundle.prices)),
    imageAssets: bundles.flatMap((bundle) => asArray(bundle.imageAssets)),
    warnings: bundles.flatMap((bundle) => asArray(bundle.warnings))
  });
}

function mapProductModelToKnowledge(productModel = {}, options = {}) {
  const model = asObject(productModel);
  const destinationName = firstText(model.destination?.name, model.destination, options.destination);
  const destinationId = stableId("DST", destinationName);
  const context = {
    currency: firstText(model.currency, options.currency, "EUR"),
    destinationName,
    destinationId,
    confidence: confidenceFromInput(model, options),
    provenance: provenanceFromInput(model, options)
  };
  const destination = destinationName
    ? createDestinationKnowledge({
      id: destinationId,
      name: destinationName,
      requestedName: options.requestedDestination,
      country: model.destination?.country,
      region: model.destination?.region,
      aliases: model.destination?.aliases,
      confidence: context.confidence,
      provenance: context.provenance
    })
    : null;
  const hotelCandidates = asArray(model.hotelOptions).length ? asArray(model.hotelOptions) : [model.hotel].filter(Boolean);
  return mergeBundles(
    createKnowledgeBundle({ destinations: destination ? [destination] : [] }),
    mapFlightToKnowledge(model.flight || asArray(model.flights)[0], context),
    ...hotelCandidates.map((hotel, index) => mapHotelToKnowledge(hotel, index, context))
  );
}

function mapProposalInputToKnowledge(proposalInput = {}, options = {}) {
  const input = asObject(proposalInput);
  return mapProductModelToKnowledge({
    ...input,
    destination: input.destination,
    flight: input.flight,
    hotel: input.hotel,
    hotelOptions: input.hotelOptions,
    currency: input.pricing?.currency || input.flight?.currency || options.currency,
    sourceEvidence: input.sourceEvidence,
    importContext: input.importContext
  }, {
    ...options,
    provenance: {
      sourceType: KNOWLEDGE_SOURCE_TYPES.SYSTEM,
      sourceName: "GT63 proposalInput",
      sourceId: firstText(input.source?.offerId, input.id, options.sourceId)
    }
  });
}

function mapProviderResultToKnowledge(providerResult = {}, options = {}) {
  const result = asObject(providerResult);
  const context = {
    currency: options.currency || "EUR",
    destinationName: options.destination,
    destinationId: stableId("DST", options.destination),
    confidence: confidenceFromProvider(result),
    provenance: provenanceFromProvider(result)
  };
  if (!result.ok || result.data == null) {
    return createKnowledgeBundle({
      warnings: [{
        code: "KNOWLEDGE_PROVIDER_RESULT_UNAVAILABLE",
        message: "Provider result did not contain canonical mappable data.",
        severity: "warning"
      }]
    });
  }
  const data = result.data;
  if (Array.isArray(data)) {
    const imageAssets = mapImagesToKnowledge(data, {
      type: options.entityType || KNOWLEDGE_ENTITY_TYPES.IMAGE_ASSET,
      id: options.entityId || stableId("ENTITY", options.destination, options.name)
    }, context);
    return createKnowledgeBundle({ imageAssets });
  }
  const objectData = asObject(data);
  return mergeBundles(
    mapProductModelToKnowledge(objectData, {
      currency: options.currency,
      destination: options.destination,
      confidence: context.confidence,
      provenance: context.provenance
    })
  );
}

module.exports = {
  createKnowledgeBundle,
  mapProviderResultToKnowledge,
  mapProductModelToKnowledge,
  mapProposalInputToKnowledge
};
