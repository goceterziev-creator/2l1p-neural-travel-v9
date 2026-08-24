'use strict';

const REQUIRED_STATE = 'HUMAN_GATE_REQUIRED';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function presentableGate(gate) {
  if (!gate || gate.status !== 'PENDING') {
    throw new Error('presentation requires a pending Human Gate');
  }
  requireString(gate.gateId, 'gateId');
  if (!Number.isInteger(gate.gateRevision)) {
    throw new TypeError('gateRevision must be an integer');
  }
  requireString(gate.requiredDecision, 'requiredDecision');
  requireString(gate.continuationTargetRef, 'continuationTargetRef');
  if (gate.authorityScope === undefined || gate.authorityScope === null) {
    throw new TypeError('authorityScope is required');
  }
  return {
    gateId: gate.gateId,
    gateRevision: gate.gateRevision,
    decision: gate.requiredDecision,
    authorityScope: clone(gate.authorityScope),
    blockedContinuationRef: gate.continuationTargetRef,
    requiredResponse: `Approve or reject gate "${gate.gateId}" for decision: ${gate.requiredDecision}`
  };
}

function materializeGatePresentation(request) {
  if (!request || typeof request !== 'object') {
    throw new TypeError('presentation request must be an object');
  }
  if (request.terminalGovernanceState !== REQUIRED_STATE) return null;
  requireString(request.interactionId, 'interactionId');
  if (!Array.isArray(request.pendingGates) || request.pendingGates.length === 0) {
    throw new Error('HUMAN_GATE_REQUIRED requires pending Human Gate context');
  }
  const gates = request.pendingGates
    .map(presentableGate)
    .sort((left, right) => left.gateId.localeCompare(right.gateId, 'en')
      || left.gateRevision - right.gateRevision);
  return {
    kind: 'HUMAN_GATE_APPROVAL_REQUIRED',
    headline: 'HUMAN GATE — APPROVAL REQUIRED',
    terminalGovernanceState: REQUIRED_STATE,
    interactionId: request.interactionId,
    gates
  };
}

function createGatePresenter({ outputSink }) {
  if (typeof outputSink !== 'function') {
    throw new TypeError('outputSink must be a function');
  }
  return Object.freeze((request) => {
    const presentation = materializeGatePresentation(request);
    if (presentation === null) return null;
    outputSink(clone(presentation));
    return clone(presentation);
  });
}

module.exports = {
  REQUIRED_STATE,
  createGatePresenter,
  materializeGatePresentation
};
