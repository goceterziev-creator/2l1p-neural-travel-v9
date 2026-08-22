'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildEnvelope, extractCandidate, sha256, stableBytes } = require('./transport/contract');
const {
  PROVIDER_REPRESENTATION,
  providerRepresentationFor
} = require('./transport/adapters/openai-responses-adapter');

const REPLAY = path.join(__dirname, 'transport', 'replay-frozen-run.js');
const SECTIONS = [
  'OUTCOME', 'EXPLICIT', 'INFERRED', 'LOCKED', 'UNKNOWN', 'PROPOSED',
  'AUTHORIZED', 'NOT_AUTHORIZED', 'HUMAN_GATES', 'ACCEPTANCE',
  'NECESSARY_COLLATERAL_CHANGES'
];

function candidate() {
  return Object.fromEntries(SECTIONS.map((section) => [section, []]));
}

function source() {
  return {
    id: 'R1',
    domain: 'Architecture',
    language: 'en',
    text: 'Keep the cornice unchanged. Route the cable through the surveyed central bay.',
    evidence: []
  };
}

function canonicalCandidate(src) {
  const value = candidate();
  value.LOCKED.push({
    id: 'locked.1',
    statement: 'Keep the cornice unchanged.',
    provenance: [{ source_type: 'RAW_TEXT', quote: 'Keep the cornice unchanged.', evidence_id: null, supports: [] }],
    targets: [],
    required: false,
    requiredFor: ''
  });
  return value;
}

function structuredCandidate(src) {
  const value = candidate();
  const quote = 'Keep the cornice unchanged.';
  const start = src.text.indexOf(quote);
  value.LOCKED.push({
    id: 'locked.1',
    statement: 'Keep the cornice unchanged.',
    provenance: [{
      source_type: 'RAW_TEXT',
      quote: null,
      evidence_id: null,
      supports: [],
      spans: [{ start, end: start + quote.length }]
    }],
    targets: [],
    required: false,
    requiredFor: { kind: 'NONE', text: '', section: '', entry_id: '' }
  });
  return value;
}

function rawResponse(value) {
  return {
    id: 'provider-R1',
    model: 'gpt-4.1-mini-2025-04-14',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
    usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 }
  };
}

function makeRun(tempRoot, manifest, raw) {
  const run = path.join(tempRoot, 'source-run');
  fs.mkdirSync(path.join(run, 'raw-responses'), { recursive: true });
  fs.writeFileSync(path.join(run, 'request-manifest.json'), stableBytes(manifest));
  fs.writeFileSync(path.join(run, 'raw-responses', 'R1.json'), stableBytes(raw));
  return run;
}

function runReplay(runDir, output, corpusPath) {
  return spawnSync(process.execPath, [
    REPLAY,
    '--source-run-dir', runDir,
    '--output', output,
    '--corpus', corpusPath
  ], { encoding: 'utf8' });
}

function makeWritable(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  if (stat.isDirectory()) {
    fs.chmodSync(target, 0o755);
    for (const child of fs.readdirSync(target)) makeWritable(path.join(target, child));
  } else {
    fs.chmodSync(target, 0o644);
  }
}

(function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hii-structured-replay-'));
  try {
    const src = source();
    const corpusBytes = stableBytes({ corpusVersion: 'structured-replay-test', cases: [src] });
    const corpusPath = path.join(tempRoot, 'corpus.json');
    fs.writeFileSync(corpusPath, corpusBytes);
    const envelope = buildEnvelope(src);
    const representation = providerRepresentationFor(envelope);
    const manifest = {
      manifestVersion: 'hii-v0.2-generation-request-v1',
      runId: 'structured-replay',
      provider: 'openai-responses-native-fetch',
      model: 'gpt-4.1-mini-2025-04-14',
      parameters: { pricing_usd_per_million: { input: 0.4, output: 1.6 } },
      corpusIdentity: sha256(corpusBytes),
      providerRepresentation: PROVIDER_REPRESENTATION,
      providerRepresentationIdentity: sha256(stableBytes(PROVIDER_REPRESENTATION)),
      cases: [{
        id: src.id,
        envelopeIdentity: sha256(stableBytes(envelope)),
        providerRepresentation: representation,
        providerRepresentationIdentity: sha256(stableBytes(representation)),
        envelope
      }]
    };
    const raw = rawResponse(structuredCandidate(src));
    const sourceRun = makeRun(tempRoot, manifest, raw);
    const output = path.join(tempRoot, 'replay');
    const result = runReplay(sourceRun, output, corpusPath);
    assert.equal(result.status, 0, result.stderr);
    const replayed = JSON.parse(fs.readFileSync(path.join(output, 'candidates', 'R1.json')));
    const expected = extractCandidate(rawResponse(canonicalCandidate(src)), src);
    assert.deepEqual(replayed, expected, 'structured frozen raw response must replay to the canonical candidate');
    const freeze = JSON.parse(fs.readFileSync(path.join(output, 'freeze.json')));
    assert.equal(freeze.replayModelCalls, 0);
    assert.equal(freeze.replayedFromFrozenRawResponses, true);

    const historicalContractRoot = path.join(tempRoot, 'historical-contract');
    const historicalRepresentation = JSON.parse(JSON.stringify(representation));
    historicalRepresentation.instructions += '\nHistorical provider wording retained in frozen request evidence.';
    const historicalManifest = JSON.parse(JSON.stringify(manifest));
    historicalManifest.runId = 'historical-structured-replay';
    historicalManifest.cases[0].providerRepresentation = historicalRepresentation;
    historicalManifest.cases[0].providerRepresentationIdentity = sha256(stableBytes(historicalRepresentation));
    const historicalRun = makeRun(historicalContractRoot, historicalManifest, raw);
    const historicalResult = runReplay(historicalRun, path.join(historicalContractRoot, 'out'), corpusPath);
    assert.equal(historicalResult.status, 0, historicalResult.stderr);
    const historicalCandidate = JSON.parse(fs.readFileSync(path.join(historicalContractRoot, 'out', 'candidates', 'R1.json')));
    assert.deepEqual(historicalCandidate, expected, 'replay must use the frozen compatible representation snapshot rather than current provider wording');

    const tamperRoot = path.join(tempRoot, 'tampered');
    const tamperedManifest = JSON.parse(JSON.stringify(manifest));
    tamperedManifest.cases[0].providerRepresentation.instructions += '\nTampered after freeze.';
    const tamperedRun = makeRun(tamperRoot, tamperedManifest, raw);
    const tampered = runReplay(tamperedRun, path.join(tamperRoot, 'out'), corpusPath);
    assert.notEqual(tampered.status, 0);
    assert.match(tampered.stderr, /frozen provider representation identity mismatch/);

    const identityOnlyRoot = path.join(tempRoot, 'identity-only');
    const identityOnlyManifest = JSON.parse(JSON.stringify(manifest));
    delete identityOnlyManifest.cases[0].providerRepresentation;
    const identityOnlyRun = makeRun(identityOnlyRoot, identityOnlyManifest, raw);
    const identityOnlyResult = runReplay(identityOnlyRun, path.join(identityOnlyRoot, 'out'), corpusPath);
    assert.equal(identityOnlyResult.status, 0, identityOnlyResult.stderr);

    const legacyRoot = path.join(tempRoot, 'legacy');
    const legacyManifest = {
      manifestVersion: 'hii-v0.2-generation-request-v1',
      runId: 'legacy-replay',
      provider: 'historical-provider',
      model: 'historical',
      parameters: { pricing_usd_per_million: { input: 0, output: 0 } },
      corpusIdentity: sha256(corpusBytes),
      cases: [{ id: src.id, envelope }]
    };
    const legacyRaw = rawResponse(canonicalCandidate(src));
    const legacyRun = makeRun(legacyRoot, legacyManifest, legacyRaw);
    const legacyResult = runReplay(legacyRun, path.join(legacyRoot, 'out'), corpusPath);
    assert.equal(legacyResult.status, 0, legacyResult.stderr);

    process.stdout.write(`${JSON.stringify({
      status: 'PASS',
      proofs: {
        structuredRepresentationFrozen: true,
        structuredReplayProjection: 'PASS',
        canonicalCandidateIdentityRecovered: sha256(stableBytes(replayed)),
        frozenRepresentationSnapshotAuthoritative: true,
        historicalCompatibleSnapshotReplayed: true,
        representationTamperRejected: true,
        identityOnlyStructuredReplayPreserved: true,
        legacyUnversionedReplayPreserved: true,
        replayModelCalls: 0
      }
    }, null, 2)}\n`);
  } finally {
    makeWritable(tempRoot);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
})();
