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

const none = () => ({ kind: 'NONE', text: '', section: '', entry_id: '' });
const text = (value) => ({ kind: 'TEXT', text: value, section: '', entry_id: '' });
const requiredRef = (section, entryId) => ({
  kind: 'REFERENCE', text: '', section, entry_id: entryId
});
const ref = (section, entryId) => ({ section, entry_id: entryId });

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
    requiredFor: none(),
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

function structuredCandidate() {
  const value = candidate();
  value.OUTCOME.push(entry('1', { requiredFor: text('Requested outcome.') }));
  value.EXPLICIT.push(entry('1'));
  value.LOCKED.push(entry('1'));
  value.UNKNOWN.push(entry('1'));
  value.PROPOSED.push(entry('1', { targets: [ref('authorized', '1')] }));
  value.AUTHORIZED.push(entry('1', { targets: [ref('explicit', '1'), ref('locked', '1')] }));
  value.HUMAN_GATES.push(entry('1', { targets: [ref('unknown', '1')], required: true }));
  value.NECESSARY_COLLATERAL_CHANGES.push(entry('1', {
    targets: [ref('outcome', '1'), ref('gate', '1'), ref('proposed', '1')],
    required: true,
    requiredFor: requiredRef('authorized', '1')
  }));
  return value;
}

async function main() {
  const providerEntry = CANDIDATE_SCHEMA.properties.OUTCOME.items;
  assert.equal(providerEntry.properties.id.type, 'string');
  assert.equal(providerEntry.properties.targets.items.type, 'object');
  assert.equal(providerEntry.properties.requiredFor.type, 'object');
  assert.match(PUBLIC_PROTOCOL, /Entry IDs are opaque strings, never references/);

  const structured = structuredCandidate();
  assert.equal(typeof structured.EXPLICIT[0].id, 'string');
  assert.equal(typeof structured.AUTHORIZED[0].targets[0], 'object');
  const normalized = extract(structured);
  assert.deepEqual(normalized.AUTHORIZED[0].targets, ['explicit.1', 'locked.1']);
  assert.deepEqual(normalized.PROPOSED[0].targets, ['authorized.1']);
  assert.deepEqual(normalized.HUMAN_GATES[0].targets, ['unknown.1']);
  assert.deepEqual(normalized.NECESSARY_COLLATERAL_CHANGES[0].targets, [
    'outcome.1', 'gate.1', 'proposed.1'
  ]);
  assert.equal(normalized.NECESSARY_COLLATERAL_CHANGES[0].requiredFor, 'authorized.1');
  assert.equal(normalized.OUTCOME[0].requiredFor, 'Requested outcome.');
  assert.deepEqual(semanticPayload(normalized), semanticPayload(structured));

  const prefixed = candidate();
  prefixed.OUTCOME.push(entry('explicit:1'));
  prefixed.EXPLICIT.push(entry('explicit:1'));
  prefixed.AUTHORIZED.push(entry('authorized:1', { targets: [ref('explicit', 'explicit:1')] }));
  const prefixedResult = extract(prefixed);
  assert.equal(prefixedResult.AUTHORIZED[0].targets[0], prefixedResult.EXPLICIT[0].id);

  const wrongSection = candidate();
  wrongSection.EXPLICIT.push(entry('2'));
  wrongSection.AUTHORIZED.push(entry('authorized.1', { targets: [ref('locked', '2')] }));
  assert.throws(() => extract(wrongSection), /locked:2: candidate reference resolved to 0 entries/);

  const nonexistent = candidate();
  nonexistent.AUTHORIZED.push(entry('authorized.1', { targets: [ref('explicit', '99')] }));
  assert.throws(() => extract(nonexistent), /explicit:99: candidate reference resolved to 0 entries/);

  const duplicateWithinSection = candidate();
  duplicateWithinSection.EXPLICIT.push(entry('2'), entry('2'));
  duplicateWithinSection.AUTHORIZED.push(entry('authorized.1', { targets: [ref('explicit', '2')] }));
  assert.throws(() => extract(duplicateWithinSection), /explicit:2: candidate reference resolved to 2 entries/);

  const malformedReference = candidate();
  malformedReference.EXPLICIT.push(entry('1'));
  malformedReference.AUTHORIZED.push(entry('authorized.1', {
    targets: [{ section: 'explicit', entry_id: '1', statement: 'guess' }]
  }));
  assert.throws(() => extract(malformedReference), /structured candidate reference fields are invalid/);

  const ambiguousLegacy = candidate();
  ambiguousLegacy.OUTCOME.push(entry('2', { requiredFor: '' }));
  ambiguousLegacy.EXPLICIT.push(entry('2', { requiredFor: '' }));
  ambiguousLegacy.AUTHORIZED.push(entry('authorized.existing', { targets: ['2'], requiredFor: '' }));
  assert.throws(() => extract(ambiguousLegacy), /ambiguous reference to duplicate candidate id: 2/);

  const validGlobal = candidate();
  validGlobal.EXPLICIT.push(entry('explicit.existing'));
  validGlobal.AUTHORIZED.push(entry('authorized.existing', {
    targets: [ref('explicit', 'explicit.existing')]
  }));
  const validGlobalResult = extract(validGlobal);
  assert.equal(validGlobalResult.EXPLICIT[0].id, 'explicit.existing');
  assert.equal(validGlobalResult.AUTHORIZED[0].targets[0], 'explicit.existing');

  const invalidNone = candidate();
  invalidNone.OUTCOME.push(entry('1', { requiredFor: { ...none(), text: 'not empty' } }));
  assert.throws(() => extract(invalidNone), /requiredFor NONE payload is invalid/);

  const invalidRequiredReference = candidate();
  invalidRequiredReference.AUTHORIZED.push(entry('1'));
  invalidRequiredReference.NECESSARY_COLLATERAL_CHANGES.push(entry('2', {
    required: true,
    requiredFor: requiredRef('authorized', 'missing')
  }));
  assert.throws(() => extract(invalidRequiredReference), /authorized:missing: candidate reference resolved to 0 entries/);

  const first = extract(structured);
  const second = extract(structured);
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
      entryAndReferenceGrammarsTypeDistinct: true,
      duplicateLocalIdsWithStructuredReferences: 'PASS',
      rawAndPrefixedIdsNormalized: 'PASS',
      exactStructuredResolution: 'PASS',
      wrongSectionRejected: true,
      nonexistentTargetRejected: true,
      duplicateTargetRejected: true,
      malformedReferenceRejected: true,
      ambiguousLegacyReferenceRejected: true,
      validGlobalIdPreserved: true,
      authorityProposalGateCollateralIntegrity: 'PASS',
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
