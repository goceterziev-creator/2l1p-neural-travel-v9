"use strict";

const {
  KNOWLEDGE_CONTRACT_VERSION,
  KNOWLEDGE_ENTITY_TYPES
} = require("../contracts/knowledge-types");
const {
  cleanText
} = require("../contracts/knowledge-metadata");
const {
  mapProposalInputToKnowledge
} = require("../mappers/knowledge-mappers");

function diagnostic(code, message, details = {}) {
  return {
    code,
    message,
    details
  };
}

function emit(logger, item) {
  if (typeof logger === "function") {
    logger("GT63 Knowledge Runtime Adoption diagnostic", item);
  }
}

function isValidDestinationKnowledge(destination) {
  return Boolean(
    destination &&
    destination.contractVersion === KNOWLEDGE_CONTRACT_VERSION &&
    destination.entityType === KNOWLEDGE_ENTITY_TYPES.DESTINATION &&
    cleanText(destination.name)
  );
}

function confidenceAllowed(destination, minimumScore) {
  if (minimumScore === undefined || minimumScore === null) return true;
  const score = Number(destination?.confidence?.score);
  return Number.isFinite(score) && score >= Number(minimumScore);
}

function resolveDestinationDisplayFromKnowledge(proposalInput = {}, legacyValue = "", options = {}) {
  const legacy = cleanText(legacyValue);
  const logger = options.logger;

  try {
    const mapper = typeof options.mapProposalInputToKnowledge === "function"
      ? options.mapProposalInputToKnowledge
      : mapProposalInputToKnowledge;
    const knowledge = options.knowledgeBundle || mapper(proposalInput, options);
    const destination = knowledge?.destinations?.[0];

    if (!isValidDestinationKnowledge(destination)) {
      const item = diagnostic("KNOWLEDGE_DESTINATION_INVALID", "DestinationKnowledge is missing or invalid.");
      emit(logger, item);
      return { value: legacy, source: "legacy", diagnostics: [item] };
    }

    const knowledgeValue = cleanText(destination.name);
    if (!confidenceAllowed(destination, options.minimumConfidenceScore)) {
      const item = diagnostic("KNOWLEDGE_DESTINATION_LOW_CONFIDENCE", "DestinationKnowledge confidence is below the runtime threshold.", {
        score: destination.confidence?.score,
        minimumScore: options.minimumConfidenceScore
      });
      emit(logger, item);
      return { value: legacy, source: "legacy", diagnostics: [item] };
    }

    if (!knowledgeValue) {
      const item = diagnostic("KNOWLEDGE_DESTINATION_EMPTY", "DestinationKnowledge did not contain a display value.");
      emit(logger, item);
      return { value: legacy, source: "legacy", diagnostics: [item] };
    }

    if (legacy && knowledgeValue !== legacy) {
      const item = diagnostic("KNOWLEDGE_DESTINATION_MISMATCH", "DestinationKnowledge differs from legacy destination display value.", {
        legacyValue: legacy,
        knowledgeValue
      });
      emit(logger, item);
      return { value: legacy, source: "legacy", diagnostics: [item] };
    }

    return {
      value: knowledgeValue || legacy,
      source: knowledgeValue ? "knowledge" : "legacy",
      diagnostics: []
    };
  } catch (error) {
    const item = diagnostic("KNOWLEDGE_DESTINATION_RESOLVER_ERROR", "DestinationKnowledge resolver failed and legacy fallback was used.", {
      message: cleanText(error?.message)
    });
    emit(logger, item);
    return { value: legacy, source: "legacy", diagnostics: [item] };
  }
}

module.exports = {
  resolveDestinationDisplayFromKnowledge
};
