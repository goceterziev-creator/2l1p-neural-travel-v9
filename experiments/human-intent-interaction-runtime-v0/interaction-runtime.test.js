'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  canonicalStringify,
  compileIntentContract,
  evaluateIntentRegression
} = require('../human-intent-layer-v0/intent-layer');
const { createInMemoryInteractionStore } = require('./in-memory-interaction-store');
const {
  GATE_STATUSES,
  INTERACTION_STATUSES,
  createInteractionRuntime
} = require('./interaction-runtime');

const fixtures = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../human-intent-layer-v0/fixtures.json'),
  'utf8'
));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildContractAndExecution() {
  const fixture = fixtures.fixtures.find((item) => item.id === 'knowledge-unresolved-evidence');
  const contract = compileIntentContract(fixture.input, clone(fixture.interpretation), {
    contractId: fixture.id,
    language: fixture.language
  });
  return { contract, execution: clone(fixture.execution) };
}

function createHarness({ seed = [], resolver = null, presentations = [] } = {}) {
  const store = createInMemoryInteractionStore({ seed });
  const runtime = createInteractionRuntime({
    store,
    evaluateIntentRegression,
    approvalResolverPort: resolver,
    presentationPort: (request) => presentations.push(clone(request))
  });
  return { store, runtime, presentations };
}

function registerBase(runtime, interactionId = 'interaction-A') {
  const { contract, execution } = buildContractAndExecution();
  return runtime.registerInteraction({
    interactionId,
    intentContractRef: contract.contractId,
    intentContract: contract,
    executionEvidence: execution,
    createdOrder: 1
  });
}

function registerGate(runtime, interactionId, expectedRevision, suffix = 'A') {
  return runtime.registerHumanGate({
    interactionId,
    gateId: 'gate.implementation',
    gateRevision: 1,
    authorityScope: { action: 'implementation', boundary: 'isolated-runtime' },
    requiredDecision: 'Approve the isolated runtime implementation.',
    continuationTargetRef: 'target.bootstrap-implementation',
    eventId: `event.requested-${suffix}`,
    eventOrder: 2,
    expectedRevision
  });
}

function satisfiedResolution(interactionId, inputId, suffix = 'A') {
  return {
    resolutionId: `resolution.satisfied-${suffix}`,
    outcome: 'SATISFIED',
    interactionId,
    inputId,
    gateId: 'gate.implementation',
    gateRevision: 1,
    authorityScope: { action: 'implementation', boundary: 'isolated-runtime' },
    continuationTargetRef: 'target.bootstrap-implementation'
  };
}

function runSuite() {
  const cases = [];
  const presentations = [];
  const resolverCalls = [];
  const { store, runtime } = createHarness({
    presentations,
    resolver: (request) => {
      resolverCalls.push(clone(request));
      return {
        resolutionId: 'resolution.port-only',
        outcome: 'AMBIGUOUS_REFERENT',
        interactionId: request.interaction.interactionId,
        inputId: request.input.inputId
      };
    }
  });

  let current = registerBase(runtime);
  assert.equal(current.revision, 0);
  assert.equal(current.interactionStatus, INTERACTION_STATUSES.ACTIVE);
  cases.push('interaction-registration');

  registerBase(runtime, 'interaction-B');
  assert.notDeepEqual(
    runtime.getInteractionSnapshot('interaction-A'),
    runtime.getInteractionSnapshot('interaction-B')
  );
  cases.push('interaction-isolation');

  current = registerGate(runtime, 'interaction-A', current.revision);
  assert.equal(current.revision, 1);
  assert.equal(current.gates['gate.implementation'].status, GATE_STATUSES.PENDING);
  assert.deepEqual(runtime.projectCurrentGateEvents('interaction-A'), [{
    gateRef: 'gate.implementation', action: 'REQUESTED', necessary: true
  }]);
  assert.equal(current.evidence.filter((item) => item.type === 'HUMAN_GATE_EVENT').length, 1);
  cases.push('exact-gate-registration-and-requested-event');

  assert.throws(
    () => registerGate(runtime, 'interaction-A', current.revision, 'duplicate'),
    /already active/
  );
  cases.push('duplicate-gate-rejected');

  current = runtime.evaluateGovernance({
    interactionId: 'interaction-A',
    evaluationId: 'evaluation.pending',
    expectedRevision: current.revision
  });
  assert.equal(current.interactionStatus, INTERACTION_STATUSES.WAITING_HUMAN);
  assert.equal(presentations.length, 1);
  assert.equal(presentations[0].terminalGovernanceState, 'HUMAN_GATE_REQUIRED');
  cases.push('pending-gate-evaluates-and-presents');

  current = runtime.receiveHumanInput({
    interactionId: 'interaction-A',
    inputId: 'input.approval-like',
    content: 'Одобрявам',
    actorRef: 'actor.human',
    receivedOrder: 3,
    expectedRevision: current.revision
  });
  assert.equal(current.gates['gate.implementation'].status, GATE_STATUSES.PENDING);
  assert.equal(current.evidence.filter((item) => item.type === 'HUMAN_GATE_EVENT').length, 1);
  cases.push('approval-like-input-grants-no-authority');

  const portResult = runtime.requestApprovalResolution({
    interactionId: 'interaction-A',
    inputId: 'input.approval-like'
  });
  assert.equal(portResult.outcome, 'AMBIGUOUS_REFERENT');
  assert.equal(resolverCalls.length, 1);
  assert.equal(runtime.getInteractionSnapshot('interaction-A').revision, current.revision);
  cases.push('resolver-port-has-no-direct-mutation');

  current = runtime.materializeGateResolution({
    resolution: portResult,
    expectedRevision: current.revision
  });
  assert.equal(current.gates['gate.implementation'].status, GATE_STATUSES.PENDING);
  assert.equal(current.evidence.filter((item) => item.type === 'HUMAN_GATE_EVENT').length, 1);
  cases.push('ambiguous-resolution-fails-closed');

  assert.throws(() => runtime.materializeGateResolution({
    resolution: {
      ...satisfiedResolution('interaction-B', 'input.approval-like', 'cross'),
      resolutionId: 'resolution.cross'
    },
    eventId: 'event.cross',
    expectedRevision: 0
  }), /unknown input/);
  cases.push('cross-interaction-resolution-rejected');

  assert.throws(() => runtime.materializeGateResolution({
    resolution: {
      ...satisfiedResolution('interaction-A', 'input.approval-like', 'wrong'),
      resolutionId: 'resolution.wrong',
      gateId: 'gate.other'
    },
    eventId: 'event.wrong',
    expectedRevision: current.revision
  }), /not pending/);
  cases.push('wrong-gate-resolution-rejected');

  current = runtime.receiveHumanInput({
    interactionId: 'interaction-A',
    inputId: 'input.exact',
    content: 'I approve gate.implementation for the isolated runtime only.',
    actorRef: 'actor.human',
    receivedOrder: 4,
    expectedRevision: current.revision
  });
  current = runtime.materializeGateResolution({
    resolution: satisfiedResolution('interaction-A', 'input.exact'),
    eventId: 'event.satisfied-A',
    eventOrder: 5,
    expectedRevision: current.revision
  });
  assert.equal(current.gates['gate.implementation'].status, GATE_STATUSES.SATISFIED);
  assert.deepEqual(runtime.projectCurrentGateEvents('interaction-A'), [{
    gateRef: 'gate.implementation', action: 'SATISFIED', necessary: true
  }]);
  assert.equal(current.evidence.filter((item) => item.type === 'HUMAN_GATE_EVENT').length, 2);
  cases.push('exact-satisfaction-and-current-event-projection');

  assert.throws(() => runtime.materializeGateResolution({
    resolution: {
      ...satisfiedResolution('interaction-A', 'input.exact', 'duplicate'),
      resolutionId: 'resolution.duplicate'
    },
    eventId: 'event.duplicate',
    expectedRevision: current.revision
  }), /already granted authority/);
  cases.push('duplicate-satisfaction-creates-no-authority');

  let scopeInteraction = registerBase(runtime, 'interaction-scope');
  scopeInteraction = registerGate(runtime, 'interaction-scope', scopeInteraction.revision, 'scope');
  scopeInteraction = runtime.receiveHumanInput({
    interactionId: 'interaction-scope',
    inputId: 'input.scope',
    content: 'Approve a broader production boundary.',
    actorRef: 'actor.human',
    receivedOrder: 3,
    expectedRevision: scopeInteraction.revision
  });
  assert.throws(() => runtime.materializeGateResolution({
    resolution: {
      ...satisfiedResolution('interaction-scope', 'input.scope', 'scope'),
      resolutionId: 'resolution.scope-mismatch',
      authorityScope: { action: 'implementation', boundary: 'production' }
    },
    eventId: 'event.scope-mismatch',
    expectedRevision: scopeInteraction.revision
  }), /scope mismatch/);
  assert.equal(
    runtime.getInteractionSnapshot('interaction-scope').gates['gate.implementation'].status,
    GATE_STATUSES.PENDING
  );
  cases.push('scope-expansion-rejected');

  const presentationCountBeforePass = presentations.length;
  current = runtime.evaluateGovernance({
    interactionId: 'interaction-A',
    evaluationId: 'evaluation.satisfied',
    expectedRevision: current.revision
  });
  assert.equal(current.interactionStatus, INTERACTION_STATUSES.CONTINUATION_READY);
  assert.equal(presentations.length, presentationCountBeforePass);
  const latestEvaluation = current.evidence.filter((item) => item.type === 'GOVERNANCE_EVALUATION').at(-1);
  assert.equal(latestEvaluation.result.status, 'PASS');
  cases.push('pass-enables-ready-without-false-presentation');

  assert.throws(() => runtime.claimAuthorizedContinuation({
    interactionId: 'interaction-A',
    gateId: 'gate.implementation',
    gateRevision: 1,
    authorityScope: { action: 'implementation', boundary: 'isolated-runtime' },
    continuationTargetRef: 'target.wrong',
    continuationId: 'continuation.wrong',
    expectedRevision: current.revision
  }), /mismatch/);
  cases.push('wrong-continuation-target-rejected');

  current = runtime.claimAuthorizedContinuation({
    interactionId: 'interaction-A',
    gateId: 'gate.implementation',
    gateRevision: 1,
    authorityScope: { action: 'implementation', boundary: 'isolated-runtime' },
    continuationTargetRef: 'target.bootstrap-implementation',
    continuationId: 'continuation.A',
    expectedRevision: current.revision
  });
  assert.equal(current.gates['gate.implementation'].status, GATE_STATUSES.CONSUMED);
  assert.equal(current.interactionStatus, INTERACTION_STATUSES.CONTINUATION_CONSUMED);
  cases.push('single-consumption-continuation');

  assert.throws(() => runtime.claimAuthorizedContinuation({
    interactionId: 'interaction-A',
    gateId: 'gate.implementation',
    gateRevision: 1,
    authorityScope: { action: 'implementation', boundary: 'isolated-runtime' },
    continuationTargetRef: 'target.bootstrap-implementation',
    continuationId: 'continuation.replay',
    expectedRevision: current.revision
  }), /not eligible/);
  cases.push('continuation-replay-rejected');

  assert.throws(() => store.commit({
    interactionId: 'interaction-A',
    expectedRevision: current.revision - 1,
    nextState: current,
    appendedEvidence: []
  }), /stale/);
  cases.push('stale-revision-rejected');

  const recoverySeed = store.exportState();
  const recovered = createHarness({ seed: recoverySeed, presentations: [] });
  assert.deepEqual(
    recovered.runtime.getInteractionSnapshot('interaction-A'),
    runtime.getInteractionSnapshot('interaction-A')
  );
  assert.equal(
    recovered.runtime.getInteractionSnapshot('interaction-B').gates['gate.implementation'],
    undefined
  );
  cases.push('deterministic-recovery-and-isolation');

  const pendingPresentations = [];
  const pendingHarness = createHarness({ presentations: pendingPresentations });
  let pending = registerBase(pendingHarness.runtime, 'interaction-pending');
  pending = registerGate(pendingHarness.runtime, 'interaction-pending', pending.revision, 'pending');
  const pendingSeed = pendingHarness.store.exportState();
  const pendingRecovered = createHarness({ seed: pendingSeed, presentations: [] });
  const recoveredPending = pendingRecovered.runtime.getInteractionSnapshot('interaction-pending');
  assert.equal(recoveredPending.gates['gate.implementation'].status, GATE_STATUSES.PENDING);
  assert.equal(recoveredPending.evidence.some((item) => item.action === 'SATISFIED'), false);
  cases.push('recovery-preserves-pending-without-fabricated-satisfaction');

  const failurePresentations = [];
  const failureHarness = createHarness({ presentations: failurePresentations });
  const failedBase = registerBase(failureHarness.runtime, 'interaction-failure');
  const failedAggregate = failureHarness.store.load('interaction-failure');
  failedAggregate.executionEvidence.requirementResults = [];
  failureHarness.store.commit({
    interactionId: 'interaction-failure',
    expectedRevision: failedBase.revision,
    nextState: failedAggregate,
    appendedEvidence: [{
      type: 'HUMAN_INPUT',
      inputId: 'input.non-human-failure',
      interactionId: 'interaction-failure',
      content: 'evidence fixture adjustment',
      actorRef: null,
      receivedOrder: 1,
      contextRevision: 0
    }]
  });
  const failed = failureHarness.runtime.evaluateGovernance({
    interactionId: 'interaction-failure',
    evaluationId: 'evaluation.failure',
    expectedRevision: 1
  });
  assert.equal(failed.interactionStatus, INTERACTION_STATUSES.BLOCKED);
  assert.equal(failurePresentations.length, 0);
  cases.push('non-human-failure-has-no-false-gate-presentation');

  return {
    status: 'PASS',
    cases,
    counts: {
      cases: cases.length,
      gatePresentations: presentations.length,
      resolverPortCalls: resolverCalls.length
    },
    finalState: {
      interactionARevision: current.revision,
      interactionAStatus: current.interactionStatus,
      interactionAGateStatus: current.gates['gate.implementation'].status
    }
  };
}

if (require.main === module) {
  const first = runSuite();
  const second = runSuite();
  assert.equal(canonicalStringify(first), canonicalStringify(second), 'suite must be deterministic');
  process.stdout.write(`${canonicalStringify(first)}\n`);
}

module.exports = { runSuite };
