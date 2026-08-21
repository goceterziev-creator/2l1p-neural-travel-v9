'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  CANDIDATE_SCHEMA,
  PUBLIC_PROTOCOL,
  SECTIONS,
  extractCandidate,
  sha256,
  stableBytes
} = require('./transport/contract');

const ROOT = __dirname;
const CORPUS_PATH = path.join(ROOT, 'corpus', 'blind-corpus.json');
const GENERATE = path.join(ROOT, 'transport', 'run-generation.js');
const source = JSON.parse(fs.readFileSync(CORPUS_PATH)).cases[0];

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

function extract(value) {
  return extractCandidate({ output_text: stableBytes(value).trim() }, source);
}

function semanticPayload(value) {
  return Object.fromEntries(SECTIONS.map((section) => [section, value[section].map((item) => ({
    statement: item.statement,
    provenance: item.provenance,
    required: item.required
  }))]));
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

function qualifiedCandidate() {
  const value = candidate();
  value.OUTCOME.push(entry('1'));
  value.EXPLICIT.push(entry('1'));
  value.LOCKED.push(entry('1'));
  value.UNKNOWN.push(entry('1'));
  value.PROPOSED.push(entry('1', { targets: ['authorized:1'] }));
  value.AUTHORIZED.push(entry('1', { targets: ['explicit:1', 'locked:1'] }));
  value.HUMAN_GATES.push(entry('1', { targets: ['unknown:1'], required: true }));
  value.NECESSARY_COLLATERAL_CHANGES.push(entry('1', {
    targets: ['outcome:1', 'gate:1', 'proposed:1'],
    required: true,
    requiredFor: 'authorized:1'
  }));
  return value;
}

async function main() {
  assert.match(PUBLIC_PROTOCOL, /section-qualified/);
  assert.match(CANDIDATE_SCHEMA.properties.OUTCOME.items.properties.targets.description, /section>/);

  const qualified = qualifiedCandidate();
  const normalized = extract(qualified);
  assert.deepEqual(normalized.AUTHORIZED[0].targets, ['explicit.1', 'locked.1']);
  assert.deepEqual(normalized.PROPOSED[0].targets, ['authorized.1']);
  assert.deepEqual(normalized.HUMAN_GATES[0].targets, ['unknown.1']);
  assert.deepEqual(normalized.NECESSARY_COLLATERAL_CHANGES[0].targets, [
    'outcome.1', 'gate.1', 'proposed.1'
  ]);
  assert.equal(normalized.NECESSARY_COLLATERAL_CHANGES[0].requiredFor, 'authorized.1');
  assert.deepEqual(semanticPayload(normalized), semanticPayload(qualified));

  const ambiguous = candidate();
  ambiguous.OUTCOME.push(entry('2'));
  ambiguous.EXPLICIT.push(entry('2'));
  ambiguous.AUTHORIZED.push(entry('authorized.direct', { targets: ['2'] }));
  assert.throws(() => extract(ambiguous), /ambiguous reference to duplicate candidate id: 2/);

  const globallyUnique = candidate();
  globallyUnique.EXPLICIT.push(entry('explicit.existing'));
  globallyUnique.AUTHORIZED.push(entry('authorized.existing', { targets: ['explicit.existing'] }));
  assert.deepEqual(extract(globallyUnique), globallyUnique);

  const oneBare = candidate();
  oneBare.EXPLICIT.push(entry('7'));
  oneBare.AUTHORIZED.push(entry('authorized.existing', { targets: ['7'] }));
  assert.deepEqual(extract(oneBare), oneBare);

  const wrongSection = candidate();
  wrongSection.EXPLICIT.push(entry('2'));
  wrongSection.AUTHORIZED.push(entry('authorized.existing', { targets: ['locked:2'] }));
  assert.throws(() => extract(wrongSection), /locked:2: candidate reference resolved to 0 entries/);

  const nonexistent = candidate();
  nonexistent.AUTHORIZED.push(entry('authorized.existing', { targets: ['explicit:99'] }));
  assert.throws(() => extract(nonexistent), /explicit:99: candidate reference resolved to 0 entries/);

  const ambiguousWithinSection = candidate();
  ambiguousWithinSection.EXPLICIT.push(entry('2'), entry('2'));
  ambiguousWithinSection.AUTHORIZED.push(entry('authorized.existing', { targets: ['explicit:2'] }));
  assert.throws(() => extract(ambiguousWithinSection), /explicit:2: candidate reference resolved to 2 entries/);

  const unknownQualifier = candidate();
  unknownQualifier.EXPLICIT.push(entry('1'));
  unknownQualifier.AUTHORIZED.push(entry('authorized.existing', { targets: ['invented:1'] }));
  assert.throws(() => extract(unknownQualifier), /unknown candidate reference section: invented/);

  const first = extract(qualified);
  const second = extract(qualified);
  const deterministicIdentity = sha256(stableBytes(first));
  assert.equal(deterministicIdentity, sha256(stableBytes(second)));

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hii-v0-2-reference-contract-'));
  try {
    const corpusPath = path.join(tempRoot, 'corpus.json');
    const outputPath = path.join(tempRoot, 'fake-run');
    fs.writeFileSync(corpusPath, stableBytes({ corpusVersion: 'reference-contract-test', cases: [source] }));
    const generated = spawnSync(process.execPath, [
      GENERATE,
      '--corpus', corpusPath,
      '--output', outputPath,
      '--adapter', 'fake',
      '--run-id', 'reference-contract-fake'
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
      qualifiedDuplicateReferencesNormalized: true,
      ambiguousBareReferenceRejected: true,
      globallyUniqueDirectReferenceUnchanged: true,
      uniquelyResolvableBareReferenceAccepted: true,
      wrongSectionRejected: true,
      nonexistentTargetRejected: true,
      multipleSectionDuplicatesResolved: true,
      normalizedReferenceIntegrity: true,
      semanticPayloadUnchanged: true,
      deterministicIdentity,
      fakeAdapterFreeze: 'PASS'
    }
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
