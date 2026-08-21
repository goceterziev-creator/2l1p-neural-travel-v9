'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { extractCandidate, sha256, stableBytes } = require('./transport/contract');
const { createFakeAdapter } = require('./transport/adapters/fake-adapter');

const ROOT = __dirname;
const CORPUS_PATH = path.join(ROOT, 'corpus', 'blind-corpus.json');
const GENERATE = path.join(ROOT, 'transport', 'run-generation.js');
const source = JSON.parse(fs.readFileSync(CORPUS_PATH)).cases[0];

const SECTIONS = [
  'OUTCOME', 'EXPLICIT', 'INFERRED', 'LOCKED', 'UNKNOWN', 'PROPOSED',
  'AUTHORIZED', 'NOT_AUTHORIZED', 'HUMAN_GATES', 'ACCEPTANCE',
  'NECESSARY_COLLATERAL_CHANGES'
];

function entry(id, overrides = {}) {
  return {
    id,
    statement: `Statement ${id}`,
    provenance: [{
      source_type: 'RAW_TEXT',
      quote: source.text,
      evidence_id: null,
      supports: []
    }],
    targets: [],
    required: false,
    requiredFor: '',
    ...overrides
  };
}

function candidate() {
  return Object.fromEntries(SECTIONS.map((section) => [section, []]));
}

function rawResponse(value) {
  return { output_text: stableBytes(value).trim() };
}

function withoutIds(value) {
  return Object.fromEntries(SECTIONS.map((section) => [section, value[section].map(({ id, ...rest }) => rest)]));
}

function makeWritable(target) {
  if (!fs.existsSync(target)) return;
  for (const child of fs.readdirSync(target, { withFileTypes: true })) {
    const childPath = path.join(target, child.name);
    if (child.isDirectory()) makeWritable(childPath);
    else fs.chmodSync(childPath, 0o644);
  }
  fs.chmodSync(target, 0o755);
}

async function main() {
  const repeated = candidate();
  repeated.OUTCOME.push(entry('1', { targets: ['courtyard cladding'] }));
  repeated.EXPLICIT.push(entry('1', { targets: ['requested edit'] }));
  repeated.AUTHORIZED.push(entry('1', { targets: ['courtyard cladding'] }));

  const normalized = extractCandidate(rawResponse(repeated), source);
  const normalizedIds = SECTIONS.flatMap((section) => normalized[section].map(({ id }) => id));
  assert.equal(new Set(normalizedIds).size, normalizedIds.length);
  assert.ok(!normalizedIds.includes('1'), 'repeated local numeric ID must not survive extraction');
  assert.deepEqual(normalizedIds, ['outcome.1', 'explicit.1', 'authorized.1']);
  assert.deepEqual(withoutIds(normalized), withoutIds(repeated), 'ID correction must not alter semantic fields');

  const valid = candidate();
  valid.OUTCOME.push(entry('outcome.existing'));
  valid.EXPLICIT.push(entry('explicit.existing'));
  assert.deepEqual(extractCandidate(rawResponse(valid), source), valid, 'valid unique IDs must pass unchanged');

  const ambiguous = candidate();
  ambiguous.OUTCOME.push(entry('1'));
  ambiguous.EXPLICIT.push(entry('1'));
  ambiguous.AUTHORIZED.push(entry('authorized.existing', { targets: ['1'] }));
  assert.throws(
    () => extractCandidate(rawResponse(ambiguous), source),
    /ambiguous reference to duplicate candidate id: 1/,
    'ambiguous entry references must be rejected rather than guessed'
  );

  const first = extractCandidate(rawResponse(repeated), source);
  const second = extractCandidate(rawResponse(repeated), source);
  assert.equal(sha256(stableBytes(first)), sha256(stableBytes(second)), 'normalization must be deterministic');

  const fake = createFakeAdapter();
  const envelope = require('./transport/contract').buildEnvelope(source);
  const fakeResult = await fake.invoke(envelope);
  const fakeCandidate = extractCandidate(fakeResult.rawResponse, source);
  assert.equal(fakeCandidate.OUTCOME[0].id, 'outcome.fake', 'unique fake-adapter IDs remain unchanged');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hii-v0-2-id-contract-'));
  try {
    const corpusPath = path.join(tempRoot, 'corpus.json');
    const outputPath = path.join(tempRoot, 'fake-run');
    fs.writeFileSync(corpusPath, stableBytes({ corpusVersion: 'id-contract-test', cases: [source] }));
    const generated = spawnSync(process.execPath, [
      GENERATE,
      '--corpus', corpusPath,
      '--output', outputPath,
      '--adapter', 'fake',
      '--run-id', 'id-contract-fake'
    ], { encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY: '', HII_GOLD_PROBE_PATH: '' } });
    assert.equal(generated.status, 0, generated.stderr);
    const freeze = JSON.parse(fs.readFileSync(path.join(outputPath, 'freeze.json')));
    assert.equal(freeze.sealed, true);
    assert.equal(freeze.totalModelCalls, 1);
  } finally {
    makeWritable(tempRoot);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    proofs: {
      duplicateIdsNormalized: true,
      repeatedNumericIdsEliminated: true,
      validUniqueIdsUnchanged: true,
      semanticFieldsUnchanged: true,
      ambiguousReferencesRejected: true,
      deterministicIdentity: sha256(stableBytes(first)),
      fakeAdapterPath: 'PASS'
    }
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
