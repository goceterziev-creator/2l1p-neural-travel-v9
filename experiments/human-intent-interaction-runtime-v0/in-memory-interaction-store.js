'use strict';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function evidenceId(record) {
  return record.eventId
    || record.resolutionId
    || record.evaluationId
    || record.continuationId
    || record.inputId;
}

function createInMemoryInteractionStore({ seed = [] } = {}) {
  const aggregates = new Map();

  for (const aggregate of seed) {
    requireNonEmptyString(aggregate && aggregate.interactionId, 'seed interactionId');
    if (aggregates.has(aggregate.interactionId)) {
      throw new Error(`duplicate seed interaction ${aggregate.interactionId}`);
    }
    aggregates.set(aggregate.interactionId, clone(aggregate));
  }

  function create(aggregate) {
    requireNonEmptyString(aggregate && aggregate.interactionId, 'interactionId');
    if (aggregates.has(aggregate.interactionId)) {
      throw new Error(`interaction ${aggregate.interactionId} already exists`);
    }
    if (aggregate.revision !== 0) {
      throw new Error('new interaction revision must be 0');
    }
    aggregates.set(aggregate.interactionId, clone(aggregate));
    return clone(aggregate);
  }

  function load(interactionId) {
    requireNonEmptyString(interactionId, 'interactionId');
    return clone(aggregates.get(interactionId));
  }

  function commit({ interactionId, expectedRevision, nextState, appendedEvidence = [] }) {
    requireNonEmptyString(interactionId, 'interactionId');
    const current = aggregates.get(interactionId);
    if (!current) throw new Error(`unknown interaction ${interactionId}`);
    if (!Number.isInteger(expectedRevision) || current.revision !== expectedRevision) {
      throw new Error(`stale interaction revision for ${interactionId}`);
    }
    if (!nextState || nextState.interactionId !== interactionId) {
      throw new Error('next state must preserve interaction identity');
    }
    if (nextState.intentContractRef !== current.intentContractRef) {
      throw new Error('next state must preserve intent contract identity');
    }

    const knownEvidence = new Set((current.evidence || []).map(evidenceId));
    for (const record of appendedEvidence) {
      const id = evidenceId(record);
      requireNonEmptyString(id, 'evidence identity');
      if (knownEvidence.has(id)) throw new Error(`duplicate evidence ${id}`);
      knownEvidence.add(id);
    }

    const committed = clone({
      ...nextState,
      revision: expectedRevision + 1,
      evidence: [...(current.evidence || []), ...appendedEvidence]
    });
    aggregates.set(interactionId, committed);
    return clone(committed);
  }

  function exportState() {
    return [...aggregates.values()]
      .sort((left, right) => left.interactionId.localeCompare(right.interactionId, 'en'))
      .map(clone);
  }

  return Object.freeze({ create, load, commit, exportState });
}

module.exports = { createInMemoryInteractionStore };
