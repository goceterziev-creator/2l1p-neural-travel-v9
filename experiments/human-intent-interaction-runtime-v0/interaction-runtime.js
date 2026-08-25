'use strict';

const INTERACTION_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  WAITING_HUMAN: 'WAITING_HUMAN',
  CONTINUATION_READY: 'CONTINUATION_READY',
  CONTINUATION_CONSUMED: 'CONTINUATION_CONSUMED',
  BLOCKED: 'BLOCKED'
});

const GATE_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  SATISFIED: 'SATISFIED',
  CONSUMED: 'CONSUMED',
  SUPERSEDED: 'SUPERSEDED'
});

const RESOLUTION_OUTCOMES = Object.freeze({
  SATISFIED: 'SATISFIED',
  NOT_AUTHORIZATION: 'NOT_AUTHORIZATION',
  AMBIGUOUS_REFERENT: 'AMBIGUOUS_REFERENT',
  NO_PENDING_GATE: 'NO_PENDING_GATE'
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function evidenceByType(aggregate, type) {
  return (aggregate.evidence || []).filter((record) => record.type === type);
}

function activeGates(aggregate) {
  return Object.values(aggregate.gates)
    .filter((gate) => gate.status !== GATE_STATUSES.SUPERSEDED)
    .sort((left, right) => left.gateId.localeCompare(right.gateId, 'en'));
}

function projectCurrentGateEvents(aggregate) {
  const events = evidenceByType(aggregate, 'HUMAN_GATE_EVENT');
  return activeGates(aggregate).map((gate) => {
    const expectedAction = gate.status === GATE_STATUSES.PENDING ? 'REQUESTED' : 'SATISFIED';
    const matching = events.filter((event) => event.gateRef === gate.gateId
      && event.gateRevision === gate.gateRevision
      && event.action === expectedAction);
    if (matching.length !== 1) {
      throw new Error(`gate ${gate.gateId} has invalid current event evidence`);
    }
    return {
      gateRef: gate.gateId,
      action: expectedAction,
      necessary: matching[0].necessary
    };
  });
}

function createInteractionRuntime({
  store,
  evaluateIntentRegression,
  approvalResolverPort = null,
  presentationPort = null
}) {
  if (!store || !['create', 'load', 'commit'].every((name) => typeof store[name] === 'function')) {
    throw new TypeError('store must implement create, load and commit');
  }
  if (typeof evaluateIntentRegression !== 'function') {
    throw new TypeError('evaluateIntentRegression must be a function');
  }
  if (approvalResolverPort !== null && typeof approvalResolverPort !== 'function') {
    throw new TypeError('approvalResolverPort must be a function');
  }
  if (presentationPort !== null && typeof presentationPort !== 'function') {
    throw new TypeError('presentationPort must be a function');
  }

  function loadRequired(interactionId) {
    const aggregate = store.load(interactionId);
    if (!aggregate) throw new Error(`unknown interaction ${interactionId}`);
    return aggregate;
  }

  function registerInteraction({
    interactionId,
    intentContractRef,
    intentContract,
    executionEvidence,
    createdOrder = 0
  }) {
    requireString(interactionId, 'interactionId');
    requireString(intentContractRef, 'intentContractRef');
    if (!intentContract || intentContract.contractId !== intentContractRef) {
      throw new Error('intent contract reference must match the contract identity');
    }
    if (!executionEvidence || typeof executionEvidence !== 'object') {
      throw new TypeError('executionEvidence must be an object');
    }
    return store.create({
      interactionId,
      intentContractRef,
      intentContract: clone(intentContract),
      executionEvidence: clone(executionEvidence),
      interactionStatus: INTERACTION_STATUSES.ACTIVE,
      revision: 0,
      createdOrder,
      gates: {},
      evidence: []
    });
  }

  function registerHumanGate({
    interactionId,
    gateId,
    gateRevision = 1,
    authorityScope,
    requiredDecision,
    continuationTargetRef,
    eventId,
    eventOrder,
    expectedRevision
  }) {
    const aggregate = loadRequired(interactionId);
    const declared = aggregate.intentContract.HUMAN_GATES.find((gate) => gate.id === gateId);
    if (!declared) throw new Error(`gate ${gateId} is not declared by the intent contract`);
    requireString(requiredDecision, 'requiredDecision');
    requireString(continuationTargetRef, 'continuationTargetRef');
    requireString(eventId, 'eventId');
    if (authorityScope === undefined || authorityScope === null) {
      throw new TypeError('authorityScope is required');
    }
    if (aggregate.gates[gateId] && aggregate.gates[gateId].status !== GATE_STATUSES.SUPERSEDED) {
      throw new Error(`gate ${gateId} is already active`);
    }

    const nextState = clone(aggregate);
    nextState.gates[gateId] = {
      gateId,
      gateRevision,
      status: GATE_STATUSES.PENDING,
      authorityScope: clone(authorityScope),
      requiredDecision,
      continuationTargetRef,
      registeredOrder: eventOrder,
      satisfiedByEventRef: null,
      consumedByRef: null
    };
    return store.commit({
      interactionId,
      expectedRevision,
      nextState,
      appendedEvidence: [{
        type: 'HUMAN_GATE_EVENT',
        eventId,
        interactionId,
        gateRef: gateId,
        gateRevision,
        action: 'REQUESTED',
        necessary: true,
        eventOrder
      }]
    });
  }

  function receiveHumanInput({
    interactionId,
    inputId,
    content,
    actorRef = null,
    receivedOrder,
    expectedRevision
  }) {
    const aggregate = loadRequired(interactionId);
    requireString(inputId, 'inputId');
    requireString(content, 'content');
    return store.commit({
      interactionId,
      expectedRevision,
      nextState: aggregate,
      appendedEvidence: [{
        type: 'HUMAN_INPUT',
        inputId,
        interactionId,
        content,
        actorRef,
        receivedOrder,
        contextRevision: expectedRevision
      }]
    });
  }

  function requestApprovalResolution({ interactionId, inputId }) {
    if (!approvalResolverPort) throw new Error('approval resolver port is not configured');
    const aggregate = loadRequired(interactionId);
    const input = evidenceByType(aggregate, 'HUMAN_INPUT').find((item) => item.inputId === inputId);
    if (!input) throw new Error(`unknown human input ${inputId}`);
    return clone(approvalResolverPort(Object.freeze({
      input: clone(input),
      pendingGates: activeGates(aggregate)
        .filter((gate) => gate.status === GATE_STATUSES.PENDING)
        .map(clone),
      interaction: {
        interactionId: aggregate.interactionId,
        intentContractRef: aggregate.intentContractRef,
        revision: aggregate.revision
      }
    })));
  }

  function materializeGateResolution({ resolution, eventId = null, eventOrder = null, expectedRevision }) {
    if (!resolution || !Object.values(RESOLUTION_OUTCOMES).includes(resolution.outcome)) {
      throw new Error('unknown approval resolution outcome');
    }
    requireString(resolution.resolutionId, 'resolutionId');
    requireString(resolution.interactionId, 'resolution interactionId');
    const aggregate = loadRequired(resolution.interactionId);
    const inputs = evidenceByType(aggregate, 'HUMAN_INPUT');
    if (!inputs.some((item) => item.inputId === resolution.inputId)) {
      throw new Error(`resolution references unknown input ${resolution.inputId}`);
    }
    if (evidenceByType(aggregate, 'APPROVAL_RESOLUTION')
      .some((item) => item.inputId === resolution.inputId && item.outcome === RESOLUTION_OUTCOMES.SATISFIED)) {
      throw new Error(`input ${resolution.inputId} already granted authority`);
    }

    const resolutionRecord = { type: 'APPROVAL_RESOLUTION', ...clone(resolution) };
    if (resolution.outcome !== RESOLUTION_OUTCOMES.SATISFIED) {
      return store.commit({
        interactionId: resolution.interactionId,
        expectedRevision,
        nextState: aggregate,
        appendedEvidence: [resolutionRecord]
      });
    }

    requireString(eventId, 'eventId');
    const gate = aggregate.gates[resolution.gateId];
    if (!gate || gate.status !== GATE_STATUSES.PENDING) {
      throw new Error(`gate ${resolution.gateId} is not pending`);
    }
    if (resolution.gateRevision !== gate.gateRevision) {
      throw new Error('resolution gate revision mismatch');
    }
    if (!sameValue(resolution.authorityScope, gate.authorityScope)) {
      throw new Error('resolution authority scope mismatch');
    }

    const nextState = clone(aggregate);
    nextState.gates[gate.gateId].status = GATE_STATUSES.SATISFIED;
    nextState.gates[gate.gateId].satisfiedByEventRef = eventId;
    return store.commit({
      interactionId: resolution.interactionId,
      expectedRevision,
      nextState,
      appendedEvidence: [resolutionRecord, {
        type: 'HUMAN_GATE_EVENT',
        eventId,
        interactionId: aggregate.interactionId,
        gateRef: gate.gateId,
        gateRevision: gate.gateRevision,
        action: 'SATISFIED',
        necessary: true,
        authorityScope: clone(gate.authorityScope),
        resolutionRef: resolution.resolutionId,
        eventOrder
      }]
    });
  }

  function evaluateGovernance({ interactionId, evaluationId, expectedRevision }) {
    const aggregate = loadRequired(interactionId);
    requireString(evaluationId, 'evaluationId');
    const execution = clone(aggregate.executionEvidence);
    execution.humanGateEvents = projectCurrentGateEvents(aggregate);
    const result = evaluateIntentRegression(clone(aggregate.intentContract), execution);
    const currentGates = activeGates(aggregate);
    const hasReadyGate = currentGates.some((gate) => gate.status === GATE_STATUSES.SATISFIED);
    const nextState = clone(aggregate);
    nextState.interactionStatus = result.status === 'HUMAN_GATE_REQUIRED'
      ? INTERACTION_STATUSES.WAITING_HUMAN
      : result.status === 'FAIL'
        ? INTERACTION_STATUSES.BLOCKED
        : hasReadyGate
          ? INTERACTION_STATUSES.CONTINUATION_READY
          : INTERACTION_STATUSES.ACTIVE;

    const committed = store.commit({
      interactionId,
      expectedRevision,
      nextState,
      appendedEvidence: [{
        type: 'GOVERNANCE_EVALUATION',
        evaluationId,
        interactionId,
        evaluatedRevision: expectedRevision,
        evaluatorVersion: result.evaluatorVersion,
        eventProjection: clone(execution.humanGateEvents),
        result: clone(result)
      }]
    });

    if (result.status === 'HUMAN_GATE_REQUIRED' && presentationPort) {
      presentationPort(Object.freeze({
        terminalGovernanceState: result.status,
        interactionId,
        pendingGates: activeGates(committed)
          .filter((gate) => gate.status === GATE_STATUSES.PENDING)
          .map(clone)
      }));
    }
    return committed;
  }

  function claimAuthorizedContinuation({
    interactionId,
    gateId,
    gateRevision,
    authorityScope,
    continuationTargetRef,
    continuationId,
    expectedRevision
  }) {
    const aggregate = loadRequired(interactionId);
    requireString(continuationId, 'continuationId');
    const gate = aggregate.gates[gateId];
    if (!gate || gate.status !== GATE_STATUSES.SATISFIED) {
      throw new Error(`gate ${gateId} is not eligible for continuation`);
    }
    if (gate.gateRevision !== gateRevision
      || !sameValue(gate.authorityScope, authorityScope)
      || gate.continuationTargetRef !== continuationTargetRef) {
      throw new Error('continuation identity, scope or target mismatch');
    }
    const evaluations = evidenceByType(aggregate, 'GOVERNANCE_EVALUATION');
    const latest = evaluations[evaluations.length - 1];
    if (!latest || latest.result.status !== 'PASS'
      || latest.evaluatedRevision !== expectedRevision - 1
      || aggregate.interactionStatus !== INTERACTION_STATUSES.CONTINUATION_READY) {
      throw new Error('latest governance evaluation does not authorize continuation');
    }

    const nextState = clone(aggregate);
    nextState.gates[gateId].status = GATE_STATUSES.CONSUMED;
    nextState.gates[gateId].consumedByRef = continuationId;
    nextState.interactionStatus = INTERACTION_STATUSES.CONTINUATION_CONSUMED;
    return store.commit({
      interactionId,
      expectedRevision,
      nextState,
      appendedEvidence: [{
        type: 'CONTINUATION_AUTHORITY',
        continuationId,
        interactionId,
        gateId,
        gateRevision,
        authorityScope: clone(authorityScope),
        continuationTargetRef,
        singleConsumption: true
      }]
    });
  }

  return Object.freeze({
    registerInteraction,
    registerHumanGate,
    receiveHumanInput,
    requestApprovalResolution,
    materializeGateResolution,
    evaluateGovernance,
    claimAuthorizedContinuation,
    getInteractionSnapshot: loadRequired,
    projectCurrentGateEvents: (interactionId) => projectCurrentGateEvents(loadRequired(interactionId))
  });
}

module.exports = {
  GATE_STATUSES,
  INTERACTION_STATUSES,
  RESOLUTION_OUTCOMES,
  createInteractionRuntime
};
