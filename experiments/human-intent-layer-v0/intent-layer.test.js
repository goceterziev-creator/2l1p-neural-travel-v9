'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  canonicalStringify,
  compileIntentContract,
  createIntentLayer,
  evaluateIntentRegression
} = require('./intent-layer');

const fixturePath = path.join(__dirname, 'fixtures.json');
const suite = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function patchExecution(base, patch) {
  return { ...clone(base), ...clone(patch) };
}

function runSchemaHardeningTests() {
  const architecture = suite.fixtures.find((fixture) => fixture.id === 'architecture-facade');
  assert.ok(architecture, 'architecture fixture required for schema hardening tests');

  const missingGateRequired = clone(architecture.interpretation);
  delete missingGateRequired.HUMAN_GATES[0].required;
  assert.throws(
    () => compileIntentContract(architecture.input, missingGateRequired),
    /must declare required/,
    'Human Gate required must be explicit boolean'
  );

  const invalidAuthorityTargets = clone(architecture.interpretation);
  invalidAuthorityTargets.AUTHORIZED[0].targets = ['delta.facade', ''];
  assert.throws(
    () => compileIntentContract(architecture.input, invalidAuthorityTargets),
    /targets must be an array of non-empty strings/,
    'authority target bindings must be structurally valid'
  );

  return { status: 'PASS', cases: 2 };
}

function runSuite() {
  const fixtureMap = new Map();
  const report = { fixtures: [], negativeCases: [], schemaHardening: runSchemaHardeningTests() };

  for (const fixture of suite.fixtures) {
    const layer = createIntentLayer({ interpret: ({ evidence }) => evidence.interpretation });
    const compile = () => layer.compile({
      text: fixture.input,
      language: fixture.language,
      evidence: { interpretation: fixture.interpretation }
    }, { contractId: fixture.id });
    const contract = compile();
    const result = evaluateIntentRegression(contract, fixture.execution);

    assert.equal(result.status, fixture.expectedStatus, fixture.id);
    assert.equal(result.findings.length, 0, `${fixture.id} should have no findings`);
    assert.equal(
      canonicalStringify(contract),
      canonicalStringify(compile()),
      `${fixture.id} contract must be deterministic`
    );

    fixtureMap.set(fixture.id, { fixture, contract });
    report.fixtures.push({ id: fixture.id, status: result.status });
  }

  const gated = fixtureMap.get('knowledge-unresolved-evidence');
  const gateResult = evaluateIntentRegression(gated.contract, patchExecution(gated.fixture.execution, {
    humanGateEvents: [{ gateRef: 'gate.implementation', action: 'REQUESTED', necessary: true }]
  }));
  assert.equal(gateResult.status, 'HUMAN_GATE_REQUIRED');

  for (const negative of suite.negativeCases) {
    const base = fixtureMap.get(negative.fixture);
    assert.ok(base, `unknown base fixture ${negative.fixture}`);

    const execution = patchExecution(base.fixture.execution, negative.patch);
    const first = evaluateIntentRegression(base.contract, execution);
    const second = evaluateIntentRegression(base.contract, clone(execution));
    const codes = [...new Set(first.findings.map((finding) => finding.code))].sort();

    assert.equal(first.status, 'FAIL', negative.id);
    assert.deepEqual(codes, [...negative.expectedCodes].sort(), negative.id);
    assert.equal(canonicalStringify(first), canonicalStringify(second), `${negative.id} must be deterministic`);

    report.negativeCases.push({ id: negative.id, status: first.status, codes });
  }

  return report;
}

if (require.main === module) {
  const first = runSuite();
  const second = runSuite();
  assert.equal(canonicalStringify(first), canonicalStringify(second), 'full suite must be deterministic');
  process.stdout.write(`${canonicalStringify({ status: 'PASS', ...first })}\n`);
}

module.exports = { runSuite };
