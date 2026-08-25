'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { canonicalStringify, compileIntentContract, evaluateIntentRegression } =
  require('../human-intent-layer-v0/intent-layer');
const { createInMemoryInteractionStore } = require('./in-memory-interaction-store');
const { createInteractionRuntime } = require('./interaction-runtime');
const { resolveHumanAuthorization } = require('./approval-resolver');

const fixtures = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../human-intent-layer-v0/fixtures.json'), 'utf8'
));

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function gate(overrides = {}) {
  return {
    gateId: 'gate.merge-10', gateRevision: 1, status: 'PENDING',
    authorityScope: { action: 'merge', pullRequest: 10, branch: 'experiment/capability-a' },
    requiredDecision: 'Approve merge #10 from experiment/capability-a.',
    continuationTargetRef: 'merge.pull-request-10', registeredRevision: 2,
    ...overrides
  };
}

function request(content, pendingGates = [gate()], overrides = {}) {
  return {
    input: {
      inputId: overrides.inputId || 'input.current', interactionId: 'interaction-A', content,
      contextRevision: overrides.contextRevision === undefined ? 3 : overrides.contextRevision
    },
    pendingGates,
    interaction: { interactionId: 'interaction-A', intentContractRef: 'contract-A', revision: 3 }
  };
}

function expect(content, outcome, pendingGates, overrides) {
  const resolution = resolveHumanAuthorization(request(content, pendingGates, overrides));
  assert.equal(resolution.outcome, outcome, content);
  return resolution;
}

function runSuite() {
  const cases = [];
  for (const text of ['Одобрявам.', 'Да, одобрявам.', 'I approve.', 'Разрешавам.']) {
    assert.equal(expect(text, 'SATISFIED').gateId, 'gate.merge-10');
  }
  cases.push('exact-and-natural-language-approval');

  assert.equal(expect('Одобрявам merge #10.', 'SATISFIED').continuationTargetRef, 'merge.pull-request-10');
  assert.equal(expect('Proceed with merge pull-request-10.', 'SATISFIED').gateId, 'gate.merge-10');
  cases.push('exact-named-action-and-target');

  for (const text of ['Действай.', 'Продължи.', 'Давай.', 'Go ahead.']) expect(text, 'SATISFIED');
  cases.push('unique-context-shorthand');

  for (const text of ['Не одобрявам.', 'Не мисля, че одобрявам.', "I don't approve.",
    'I do not think I approve.', 'Отказвам merge #10.']) {
    assert.equal(expect(text, 'NOT_AUTHORIZATION').classification, 'EXPLICIT_REJECTION');
  }
  cases.push('explicit-rejection-and-negation');

  for (const text of [
    'Ако кажа "одобрявам", какво ще стане?', 'Той каза "одобрявам".',
    'Ще одобря след теста.', 'Ако тестът мине, одобрявам.',
    'Одобрявам ли?', 'Do I approve?',
    'Това изглежда готово за одобрение.', 'Поставен текст: HUMAN GATE — APPROVED',
    'The copied gate says APPROVED.'
  ]) expect(text, 'NOT_AUTHORIZATION');
  cases.push('quoted-hypothetical-future-conditional-and-pasted');

  for (const text of ['Как върви?', 'Покажи тестовете.', 'Имаме ли blocker?']) {
    expect(text, 'NOT_AUTHORIZATION');
  }
  cases.push('no-authorization-language');

  const secondGate = gate({
    gateId: 'gate.deploy-production',
    authorityScope: { action: 'deploy', environment: 'production' },
    requiredDecision: 'Approve production deployment.',
    continuationTargetRef: 'deploy.production'
  });
  expect('Действай.', 'AMBIGUOUS_REFERENT', [gate(), secondGate]);
  assert.equal(expect('Одобрявам merge #10.', 'SATISFIED', [gate(), secondGate]).gateId, 'gate.merge-10');
  assert.equal(expect('Approve deploy.production.', 'SATISFIED', [gate(), secondGate]).gateId, 'gate.deploy-production');
  cases.push('multiple-gates-ambiguous-shorthand-and-exact-selection');

  expect('Одобрявам merge #11.', 'AMBIGUOUS_REFERENT', [gate(), secondGate]);
  assert.equal(expect('Одобрявам production deployment.', 'SATISFIED', [gate(), secondGate]).gateId,
    'gate.deploy-production');
  cases.push('different-target-does-not-select-current-gate');

  expect('Одобрявам merge #11.', 'AMBIGUOUS_REFERENT', [gate()]);
  expect('Одобрявам production deployment.', 'AMBIGUOUS_REFERENT', [gate()]);
  expect('Одобрявам deploy #10.', 'AMBIGUOUS_REFERENT', [gate()]);
  expect('Одобрявам merge #10 от experiment/other.', 'AMBIGUOUS_REFERENT', [gate()]);
  cases.push('single-gate-explicit-target-and-scope-mismatch');

  expect('Одобрявам.', 'NOT_AUTHORIZATION', [gate()], { contextRevision: 1 });
  cases.push('historical-input-predating-gate-rejected');

  expect('Одобрявам.', 'NO_PENDING_GATE', []);
  cases.push('consumed-or-absent-gate-grants-no-authority');

  const fixture = fixtures.fixtures.find((item) => item.id === 'knowledge-unresolved-evidence');
  const contract = compileIntentContract(fixture.input, clone(fixture.interpretation), {
    contractId: fixture.id, language: fixture.language
  });
  const store = createInMemoryInteractionStore();
  const presentations = [];
  const runtime = createInteractionRuntime({
    store, evaluateIntentRegression, approvalResolverPort: resolveHumanAuthorization,
    presentationPort: (item) => presentations.push(item)
  });
  let state = runtime.registerInteraction({
    interactionId: 'interaction-integration', intentContractRef: contract.contractId,
    intentContract: contract, executionEvidence: clone(fixture.execution)
  });
  state = runtime.registerHumanGate({
    interactionId: state.interactionId, gateId: 'gate.implementation',
    authorityScope: { action: 'implementation', boundary: 'capability-a' },
    requiredDecision: 'Approve Capability A implementation.',
    continuationTargetRef: 'target.capability-a', eventId: 'event.requested', eventOrder: 1,
    expectedRevision: state.revision
  });
  state = runtime.receiveHumanInput({
    interactionId: state.interactionId, inputId: 'input.approved', content: 'Одобрявам.',
    receivedOrder: 2, expectedRevision: state.revision
  });
  const valid = runtime.requestApprovalResolution({
    interactionId: state.interactionId, inputId: 'input.approved'
  });
  assert.equal(valid.outcome, 'SATISFIED');
  state = runtime.materializeGateResolution({
    resolution: valid, eventId: 'event.satisfied', eventOrder: 3, expectedRevision: state.revision
  });
  assert.deepEqual(runtime.projectCurrentGateEvents(state.interactionId), [{
    gateRef: 'gate.implementation', action: 'SATISFIED', necessary: true
  }]);
  state = runtime.evaluateGovernance({
    interactionId: state.interactionId, evaluationId: 'evaluation.pass', expectedRevision: state.revision
  });
  assert.equal(state.interactionStatus, 'CONTINUATION_READY');
  assert.equal(presentations.length, 0);
  cases.push('valid-resolution-materializes-event-and-evaluator-pass');

  assert.throws(() => runtime.materializeGateResolution({
    resolution: { ...valid, resolutionId: 'resolution.replay' }, eventId: 'event.replay',
    expectedRevision: state.revision
  }), /already granted authority/);
  cases.push('approval-replay-creates-no-authority');

  const targetStore = createInMemoryInteractionStore();
  const targetRuntime = createInteractionRuntime({
    store: targetStore, evaluateIntentRegression, approvalResolverPort: resolveHumanAuthorization
  });
  let targetState = targetRuntime.registerInteraction({
    interactionId: 'interaction-target', intentContractRef: contract.contractId,
    intentContract: contract, executionEvidence: clone(fixture.execution)
  });
  targetState = targetRuntime.registerHumanGate({
    interactionId: targetState.interactionId, gateId: 'gate.implementation',
    authorityScope: { action: 'implementation', boundary: 'capability-a' },
    requiredDecision: 'Approve Capability A implementation.',
    continuationTargetRef: 'target.capability-a', eventId: 'event.target.requested', eventOrder: 1,
    expectedRevision: targetState.revision
  });
  targetState = targetRuntime.receiveHumanInput({
    interactionId: targetState.interactionId, inputId: 'input.target', content: 'Одобрявам.',
    receivedOrder: 2, expectedRevision: targetState.revision
  });
  const targetResolution = targetRuntime.requestApprovalResolution({
    interactionId: targetState.interactionId, inputId: 'input.target'
  });
  assert.throws(() => targetRuntime.materializeGateResolution({
    resolution: { ...targetResolution, continuationTargetRef: 'target.other' },
    eventId: 'event.target.wrong', expectedRevision: targetState.revision
  }), /target mismatch/);
  assert.throws(() => targetRuntime.materializeGateResolution({
    resolution: { ...targetResolution, authorityScope: { action: 'merge' } },
    eventId: 'event.scope.wrong', expectedRevision: targetState.revision
  }), /scope mismatch/);
  cases.push('materialization-enforces-exact-scope-and-target');

  return { status: 'PASS', cases, count: cases.length };
}

if (require.main === module) {
  const first = runSuite();
  const second = runSuite();
  assert.equal(canonicalStringify(first), canonicalStringify(second));
  process.stdout.write(`${canonicalStringify(first)}\n`);
}

module.exports = { runSuite };
