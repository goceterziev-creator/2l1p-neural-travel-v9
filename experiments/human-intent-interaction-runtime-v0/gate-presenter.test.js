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
const { createInteractionRuntime } = require('./interaction-runtime');
const { resolveHumanAuthorization } = require('./approval-resolver');
const { createGatePresenter, materializeGatePresentation } = require('./gate-presenter');

const fixtures = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../human-intent-layer-v0/fixtures.json'), 'utf8'
));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pendingGate(overrides = {}) {
  return {
    gateId: 'gate.merge-10',
    gateRevision: 1,
    status: 'PENDING',
    authorityScope: { action: 'merge', pullRequest: 10 },
    requiredDecision: 'Approve merge #10.',
    continuationTargetRef: 'merge.pull-request-10',
    ...overrides
  };
}

function buildContractAndExecution() {
  const fixture = fixtures.fixtures.find((item) => item.id === 'knowledge-unresolved-evidence');
  const contract = compileIntentContract(fixture.input, clone(fixture.interpretation), {
    contractId: fixture.id,
    language: fixture.language
  });
  return { contract, execution: clone(fixture.execution) };
}

function runSuite() {
  const cases = [];
  const outputs = [];
  const presenter = createGatePresenter({ outputSink: (output) => outputs.push(output) });
  const request = {
    terminalGovernanceState: 'HUMAN_GATE_REQUIRED',
    interactionId: 'interaction-A',
    pendingGates: [pendingGate()]
  };
  const presentation = presenter(request);
  assert.equal(outputs.length, 1);
  assert.equal(presentation.headline, 'HUMAN GATE — APPROVAL REQUIRED');
  assert.equal(presentation.kind, 'HUMAN_GATE_APPROVAL_REQUIRED');
  assert.equal(presentation.terminalGovernanceState, 'HUMAN_GATE_REQUIRED');
  assert.equal(presentation.interactionId, 'interaction-A');
  assert.deepEqual(presentation.gates[0].authorityScope, { action: 'merge', pullRequest: 10 });
  assert.equal(presentation.gates[0].decision, 'Approve merge #10.');
  assert.equal(presentation.gates[0].blockedContinuationRef, 'merge.pull-request-10');
  assert.match(presentation.gates[0].requiredResponse, /gate\.merge-10/);
  assert.match(presentation.gates[0].requiredResponse, /Approve merge #10\./);
  cases.push('exact-human-gate-presentation-contract');

  const multiple = materializeGatePresentation({
    terminalGovernanceState: 'HUMAN_GATE_REQUIRED',
    interactionId: 'interaction-multiple',
    pendingGates: [
      pendingGate({
        gateId: 'gate.deploy', gateRevision: 2,
        authorityScope: { action: 'deploy', environment: 'production' },
        requiredDecision: 'Approve production deployment.',
        continuationTargetRef: 'deploy.production'
      }),
      pendingGate()
    ]
  });
  assert.deepEqual(multiple.gates.map((gate) => gate.gateId), ['gate.deploy', 'gate.merge-10']);
  assert.equal(multiple.gates[0].blockedContinuationRef, 'deploy.production');
  assert.equal(multiple.gates[1].blockedContinuationRef, 'merge.pull-request-10');
  assert.notDeepEqual(multiple.gates[0].authorityScope, multiple.gates[1].authorityScope);
  cases.push('multiple-gates-preserved-without-selection');

  const countBeforeNegative = outputs.length;
  for (const state of [
    'PASS', 'FAIL', 'ACTIVE', 'CONTINUATION_READY', 'COMPLETED',
    'CONTINUATION_CONSUMED', 'INFORMATIONAL', 'VALIDATING', 'BLOCKED'
  ]) {
    assert.equal(presenter({
      terminalGovernanceState: state,
      interactionId: 'interaction-negative',
      pendingGates: [pendingGate()]
    }), null);
  }
  assert.equal(outputs.length, countBeforeNegative);
  cases.push('non-human-gate-states-emit-nothing');

  assert.throws(() => presenter({
    terminalGovernanceState: 'HUMAN_GATE_REQUIRED',
    interactionId: 'interaction-missing',
    pendingGates: []
  }), /requires pending Human Gate context/);
  assert.throws(() => presenter({
    terminalGovernanceState: 'HUMAN_GATE_REQUIRED',
    interactionId: 'interaction-invalid',
    pendingGates: [pendingGate({ status: 'SATISFIED' })]
  }), /requires a pending Human Gate/);
  assert.equal(outputs.length, countBeforeNegative);
  cases.push('inconsistent-human-gate-state-fails-closed');

  const { contract, execution } = buildContractAndExecution();
  const runtimeOutputs = [];
  const runtime = createInteractionRuntime({
    store: createInMemoryInteractionStore(),
    evaluateIntentRegression,
    approvalResolverPort: resolveHumanAuthorization,
    presentationPort: createGatePresenter({ outputSink: (output) => runtimeOutputs.push(output) })
  });
  let state = runtime.registerInteraction({
    interactionId: 'interaction-runtime',
    intentContractRef: contract.contractId,
    intentContract: contract,
    executionEvidence: execution
  });
  assert.equal(runtimeOutputs.length, 0);
  state = runtime.registerHumanGate({
    interactionId: state.interactionId,
    gateId: 'gate.implementation',
    authorityScope: { action: 'implementation', boundary: 'capability-b' },
    requiredDecision: 'Approve Capability B implementation.',
    continuationTargetRef: 'target.capability-b',
    eventId: 'event.requested',
    eventOrder: 1,
    expectedRevision: state.revision
  });
  assert.equal(runtimeOutputs.length, 0);
  state = runtime.evaluateGovernance({
    interactionId: state.interactionId,
    evaluationId: 'evaluation.required',
    expectedRevision: state.revision
  });
  assert.equal(runtimeOutputs.length, 1);
  assert.equal(runtimeOutputs[0].headline, 'HUMAN GATE — APPROVAL REQUIRED');
  assert.equal(runtimeOutputs[0].gates[0].gateId, 'gate.implementation');
  assert.equal(runtimeOutputs[0].gates[0].blockedContinuationRef, 'target.capability-b');
  cases.push('runtime-human-gate-required-integration');

  const beforeAmbiguity = runtimeOutputs.length;
  state = runtime.receiveHumanInput({
    interactionId: state.interactionId,
    inputId: 'input.ambiguous',
    content: 'Ако кажа "одобрявам", какво ще стане?',
    receivedOrder: 2,
    expectedRevision: state.revision
  });
  const ambiguous = runtime.requestApprovalResolution({
    interactionId: state.interactionId,
    inputId: 'input.ambiguous'
  });
  assert.equal(ambiguous.outcome, 'NOT_AUTHORIZATION');
  state = runtime.materializeGateResolution({
    resolution: ambiguous,
    expectedRevision: state.revision
  });
  assert.equal(runtimeOutputs.length, beforeAmbiguity);
  cases.push('ambiguous-or-non-authorizing-resolution-does-not-present');

  state = runtime.evaluateGovernance({
    interactionId: state.interactionId,
    evaluationId: 'evaluation.still-required',
    expectedRevision: state.revision
  });
  assert.equal(runtimeOutputs.length, beforeAmbiguity + 1);
  assert.equal(runtimeOutputs.at(-1).terminalGovernanceState, 'HUMAN_GATE_REQUIRED');
  cases.push('explicit-reevaluation-may-present-genuine-pending-gate');

  const failureOutputs = [];
  const failureStore = createInMemoryInteractionStore();
  const failureRuntime = createInteractionRuntime({
    store: failureStore,
    evaluateIntentRegression,
    presentationPort: createGatePresenter({ outputSink: (output) => failureOutputs.push(output) })
  });
  const failedBase = failureRuntime.registerInteraction({
    interactionId: 'interaction-failure',
    intentContractRef: contract.contractId,
    intentContract: contract,
    executionEvidence: execution
  });
  const failedAggregate = failureStore.load(failedBase.interactionId);
  failedAggregate.executionEvidence.requirementResults = [];
  failureStore.commit({
    interactionId: failedBase.interactionId,
    expectedRevision: failedBase.revision,
    nextState: failedAggregate,
    appendedEvidence: [{
      type: 'HUMAN_INPUT', inputId: 'input.failure-evidence',
      interactionId: failedBase.interactionId, content: 'validation evidence',
      actorRef: null, receivedOrder: 1, contextRevision: 0
    }]
  });
  const failed = failureRuntime.evaluateGovernance({
    interactionId: failedBase.interactionId,
    evaluationId: 'evaluation.failure',
    expectedRevision: 1
  });
  assert.equal(failed.interactionStatus, 'BLOCKED');
  assert.equal(failureOutputs.length, 0);
  cases.push('non-human-failure-does-not-present');

  return {
    status: 'PASS',
    cases,
    count: cases.length,
    presentation,
    multipleGateIds: multiple.gates.map((gate) => gate.gateId),
    emitted: { direct: outputs.length, runtime: runtimeOutputs.length, failure: failureOutputs.length }
  };
}

if (require.main === module) {
  const first = runSuite();
  const second = runSuite();
  assert.equal(canonicalStringify(first), canonicalStringify(second), 'suite must be deterministic');
  process.stdout.write(`${canonicalStringify(first)}\n`);
}

module.exports = { runSuite };
