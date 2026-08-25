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

const DISPATCH_OUTCOMES = Object.freeze({
  DISPATCH_ACCEPTED: 'DISPATCH_ACCEPTED',
  ALREADY_DISPATCHED: 'ALREADY_DISPATCHED',
  TARGET_NOT_REGISTERED: 'TARGET_NOT_REGISTERED',
  TARGET_SCOPE_MISMATCH: 'TARGET_SCOPE_MISMATCH',
  AUTHORITY_STALE: 'AUTHORITY_STALE',
  DELIVERY_UNAVAILABLE: 'DELIVERY_UNAVAILABLE',
  DELIVERY_REJECTED: 'DELIVERY_REJECTED',
  DELIVERY_UNCERTAIN: 'DELIVERY_UNCERTAIN',
  INVALID_AUTHORITY: 'INVALID_AUTHORITY'
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
      registeredRevision: expectedRevision + 1,
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
    if (resolution.continuationTargetRef !== gate.continuationTargetRef) {
      throw new Error('resolution continuation target mismatch');
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

  function getContinuationDispatchSnapshot(interactionId, dispatchId) {
    requireString(dispatchId, 'dispatchId');
    const aggregate = loadRequired(interactionId);
    const intents = evidenceByType(aggregate, 'CONTINUATION_DISPATCH_INTENT')
      .filter((item) => item.dispatchId === dispatchId);
    if (intents.length === 0) return null;
    if (intents.length !== 1) throw new Error('INVALID_AUTHORITY');
    const intent = intents[0];
    const attempts = evidenceByType(aggregate, 'CONTINUATION_DISPATCH_ATTEMPT')
      .filter((item) => item.dispatchId === dispatchId);
    const outcomes = evidenceByType(aggregate, 'CONTINUATION_DISPATCH_OUTCOME')
      .filter((item) => item.dispatchId === dispatchId);
    if (new Set(attempts.map((item) => item.dispatchAttemptId)).size !== attempts.length
      || outcomes.filter((item) => item.outcome === DISPATCH_OUTCOMES.DISPATCH_ACCEPTED).length > 1) {
      throw new Error('INVALID_AUTHORITY');
    }
    return clone({
      dispatchId,
      envelope: intent.envelope,
      intentRevision: intent.intentRevision,
      attempts,
      outcomes,
      latestOutcome: outcomes.length === 0 ? null : outcomes[outcomes.length - 1]
    });
  }

  function prepareContinuationDispatch({
    interactionId,
    continuationId,
    dispatchId,
    idempotencyKey,
    eventId,
    expectedRevision
  }) {
    const aggregate = loadRequired(interactionId);
    [continuationId, dispatchId, idempotencyKey, eventId].forEach((value, index) => {
      requireString(value, ['continuationId', 'dispatchId', 'idempotencyKey', 'eventId'][index]);
    });
    const authorities = evidenceByType(aggregate, 'CONTINUATION_AUTHORITY')
      .filter((item) => item.continuationId === continuationId && item.interactionId === interactionId);
    if (authorities.length !== 1) throw new Error('INVALID_AUTHORITY');
    const authority = authorities[0];
    const gate = aggregate.gates[authority.gateId];
    if (aggregate.revision !== expectedRevision
      || aggregate.interactionStatus !== INTERACTION_STATUSES.CONTINUATION_CONSUMED
      || !gate
      || gate.status !== GATE_STATUSES.CONSUMED
      || gate.consumedByRef !== continuationId) {
      throw new Error('AUTHORITY_STALE');
    }
    const existing = evidenceByType(aggregate, 'CONTINUATION_DISPATCH_INTENT')
      .filter((item) => item.envelope.continuationId === continuationId);
    if (existing.length > 0) {
      if (existing.length !== 1) throw new Error('INVALID_AUTHORITY');
      const intent = existing[0];
      if (intent.dispatchId !== dispatchId
        || intent.envelope.idempotencyKey !== idempotencyKey
        || intent.envelope.interactionId !== interactionId
        || intent.envelope.gateId !== authority.gateId
        || intent.envelope.gateRevision !== authority.gateRevision
        || !sameValue(intent.envelope.authorityScope, authority.authorityScope)
        || intent.envelope.continuationTargetRef !== authority.continuationTargetRef) {
        throw new Error('INVALID_AUTHORITY');
      }
      return aggregate;
    }
    const evaluations = evidenceByType(aggregate, 'GOVERNANCE_EVALUATION');
    const latest = evaluations[evaluations.length - 1];
    if (!latest || latest.result.status !== 'PASS') throw new Error('INVALID_AUTHORITY');
    const envelope = {
      dispatchId,
      idempotencyKey,
      continuationId,
      interactionId,
      gateId: authority.gateId,
      gateRevision: authority.gateRevision,
      authorityScope: clone(authority.authorityScope),
      continuationTargetRef: authority.continuationTargetRef,
      authorityEvidenceRef: continuationId,
      governanceEvaluationRef: latest.evaluationId,
      authorityCommittedRevision: expectedRevision
    };
    return store.commit({
      interactionId,
      expectedRevision,
      nextState: aggregate,
      appendedEvidence: [{
        type: 'CONTINUATION_DISPATCH_INTENT',
        eventId,
        dispatchId,
        intentRevision: expectedRevision + 1,
        envelope
      }]
    });
  }

  function recordContinuationDispatchAttempt({
    interactionId,
    dispatchId,
    dispatchAttemptId,
    eventId,
    expectedRevision
  }) {
    const aggregate = loadRequired(interactionId);
    [dispatchId, dispatchAttemptId, eventId].forEach((value, index) => {
      requireString(value, ['dispatchId', 'dispatchAttemptId', 'eventId'][index]);
    });
    const snapshot = getContinuationDispatchSnapshot(interactionId, dispatchId);
    if (!snapshot) throw new Error('INVALID_AUTHORITY');
    if (snapshot.latestOutcome && snapshot.latestOutcome.outcome === DISPATCH_OUTCOMES.DISPATCH_ACCEPTED) {
      throw new Error('ALREADY_DISPATCHED');
    }
    if (snapshot.attempts.some((item) => item.dispatchAttemptId === dispatchAttemptId)) {
      throw new Error('duplicate dispatch attempt');
    }
    return store.commit({
      interactionId,
      expectedRevision,
      nextState: aggregate,
      appendedEvidence: [{
        type: 'CONTINUATION_DISPATCH_ATTEMPT',
        eventId,
        dispatchId,
        dispatchAttemptId,
        attemptedRevision: expectedRevision + 1
      }]
    });
  }

  function recordContinuationDispatchOutcome({
    interactionId,
    dispatchId,
    dispatchAttemptId = null,
    outcome,
    acknowledgement = null,
    registrationIdentity = null,
    registrationRevision = null,
    eventId,
    expectedRevision
  }) {
    if (!Object.values(DISPATCH_OUTCOMES).includes(outcome)
      || outcome === DISPATCH_OUTCOMES.ALREADY_DISPATCHED) {
      throw new Error('unknown dispatch outcome');
    }
    const aggregate = loadRequired(interactionId);
    requireString(dispatchId, 'dispatchId');
    requireString(eventId, 'eventId');
    const snapshot = getContinuationDispatchSnapshot(interactionId, dispatchId);
    if (!snapshot) throw new Error('INVALID_AUTHORITY');
    const priorAccepted = snapshot.outcomes.find((item) => item.outcome === DISPATCH_OUTCOMES.DISPATCH_ACCEPTED);
    if (priorAccepted) throw new Error('ALREADY_DISPATCHED');
    if (dispatchAttemptId !== null
      && !snapshot.attempts.some((item) => item.dispatchAttemptId === dispatchAttemptId)) {
      throw new Error('unknown dispatch attempt');
    }
    if (outcome === DISPATCH_OUTCOMES.DISPATCH_ACCEPTED) {
      if (!acknowledgement
        || acknowledgement.receiptStatus !== 'ACCEPTED'
        || acknowledgement.dispatchId !== dispatchId
        || acknowledgement.idempotencyKey !== snapshot.envelope.idempotencyKey
        || acknowledgement.continuationTargetRef !== snapshot.envelope.continuationTargetRef) {
        throw new Error('invalid receipt acknowledgement');
      }
    }
    return store.commit({
      interactionId,
      expectedRevision,
      nextState: aggregate,
      appendedEvidence: [{
        type: 'CONTINUATION_DISPATCH_OUTCOME',
        eventId,
        dispatchId,
        dispatchAttemptId,
        outcome,
        acknowledgement: clone(acknowledgement),
        registrationIdentity,
        registrationRevision,
        recordedRevision: expectedRevision + 1
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
    prepareContinuationDispatch,
    recordContinuationDispatchAttempt,
    recordContinuationDispatchOutcome,
    getContinuationDispatchSnapshot,
    getInteractionSnapshot: loadRequired,
    projectCurrentGateEvents: (interactionId) => projectCurrentGateEvents(loadRequired(interactionId))
  });
}

module.exports = {
  GATE_STATUSES,
  INTERACTION_STATUSES,
  RESOLUTION_OUTCOMES,
  DISPATCH_OUTCOMES,
  createInteractionRuntime
};
