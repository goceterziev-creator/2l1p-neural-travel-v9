'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildEnvelope, extractCandidate, sha256, stableBytes } = require('./transport/contract');
const { PROVIDER_REPRESENTATION, providerRepresentationFor } = require('./transport/adapters/openai-responses-adapter');

const REPLAY = path.join(__dirname, 'transport', 'replay-frozen-run.js');
const SECTIONS = ['OUTCOME','EXPLICIT','INFERRED','LOCKED','UNKNOWN','PROPOSED','AUTHORIZED','NOT_AUTHORIZED','HUMAN_GATES','ACCEPTANCE','NECESSARY_COLLATERAL_CHANGES'];
const LEGACY_SPANS = Object.freeze({
  id: 'structured-provenance-spans-v1',
  rawTextCoordinateSystem: 'UTF-16-code-units',
  rawTextRangeConvention: '[start,end)',
  projection: 'structured-provider-response-to-canonical-candidate'
});
function candidate() { return Object.fromEntries(SECTIONS.map((section) => [section, []])); }
function source() { return { id: 'R1', domain: 'Architecture', language: 'en', text: 'Keep the cornice unchanged. Route the cable through the surveyed central bay.', evidence: [] }; }
function canonicalCandidate() {
  const value = candidate();
  value.LOCKED.push({ id: 'locked.1', statement: 'Keep the cornice unchanged.', provenance: [{ source_type: 'RAW_TEXT', quote: 'Keep the cornice unchanged.', evidence_id: null, supports: [] }], targets: [], required: false, requiredFor: '' });
  return value;
}
function selectionCandidate() {
  const value = candidate();
  value.LOCKED.push({ id: 'locked.1', statement: 'Keep the cornice unchanged.', provenance: [{ source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], selections: [{ text: 'Keep the cornice unchanged.' }], spans: [] }], targets: [], required: false, requiredFor: { kind: 'NONE', text: '', section: '', entry_id: '' } });
  return value;
}
function legacySpanCandidate(src) {
  const value = candidate();
  const quote = 'Keep the cornice unchanged.';
  const start = src.text.indexOf(quote);
  value.LOCKED.push({ id: 'locked.1', statement: quote, provenance: [{ source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], spans: [{ start, end: start + quote.length }] }], targets: [], required: false, requiredFor: { kind: 'NONE', text: '', section: '', entry_id: '' } });
  return value;
}
function rawResponse(value) { return { id: 'provider-R1', model: 'gpt-4.1-mini-2025-04-14', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } }; }
function makeRun(tempRoot, manifest, raw) {
  const run = path.join(tempRoot, 'source-run');
  fs.mkdirSync(path.join(run, 'raw-responses'), { recursive: true });
  fs.writeFileSync(path.join(run, 'request-manifest.json'), stableBytes(manifest));
  fs.writeFileSync(path.join(run, 'raw-responses', 'R1.json'), stableBytes(raw));
  return run;
}
function runReplay(runDir, output, corpusPath) { return spawnSync(process.execPath, [REPLAY, '--source-run-dir', runDir, '--output', output, '--corpus', corpusPath], { encoding: 'utf8' }); }
function makeWritable(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  if (stat.isDirectory()) { fs.chmodSync(target, 0o755); for (const child of fs.readdirSync(target)) makeWritable(path.join(target, child)); }
  else fs.chmodSync(target, 0o644);
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
      manifestVersion: 'hii-v0.2-generation-request-v1', runId: 'structured-replay', provider: 'openai-responses-native-fetch', model: 'gpt-4.1-mini-2025-04-14',
      parameters: { pricing_usd_per_million: { input: 0.4, output: 1.6 } }, corpusIdentity: sha256(corpusBytes),
      providerRepresentation: PROVIDER_REPRESENTATION, providerRepresentationIdentity: sha256(stableBytes(PROVIDER_REPRESENTATION)),
      cases: [{ id: src.id, envelopeIdentity: sha256(stableBytes(envelope)), providerRepresentation: representation, providerRepresentationIdentity: sha256(stableBytes(representation)), envelope }]
    };
    const expected = extractCandidate(rawResponse(canonicalCandidate()), src);

    const currentRun = makeRun(path.join(tempRoot, 'current'), manifest, rawResponse(selectionCandidate()));
    const currentOut = path.join(tempRoot, 'current-out');
    const currentResult = runReplay(currentRun, currentOut, corpusPath);
    assert.equal(currentResult.status, 0, currentResult.stderr);
    const replayed = JSON.parse(fs.readFileSync(path.join(currentOut, 'candidates', 'R1.json')));
    assert.deepEqual(replayed, expected);

    const legacyRepresentation = { descriptor: LEGACY_SPANS, instructions: 'Historical span instructions.', outputSchema: {} };
    const legacyManifest = JSON.parse(JSON.stringify(manifest));
    legacyManifest.runId = 'legacy-span-replay';
    legacyManifest.providerRepresentation = LEGACY_SPANS;
    legacyManifest.providerRepresentationIdentity = sha256(stableBytes(LEGACY_SPANS));
    legacyManifest.cases[0].providerRepresentation = legacyRepresentation;
    legacyManifest.cases[0].providerRepresentationIdentity = sha256(stableBytes(legacyRepresentation));
    const legacyRun = makeRun(path.join(tempRoot, 'legacy-spans'), legacyManifest, rawResponse(legacySpanCandidate(src)));
    const legacyOut = path.join(tempRoot, 'legacy-span-out');
    const legacyResult = runReplay(legacyRun, legacyOut, corpusPath);
    assert.equal(legacyResult.status, 0, legacyResult.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(legacyOut, 'candidates', 'R1.json'))), expected);

    const tampered = JSON.parse(JSON.stringify(manifest));
    tampered.cases[0].providerRepresentation.instructions += '\nTampered after freeze.';
    const tamperedRun = makeRun(path.join(tempRoot, 'tampered'), tampered, rawResponse(selectionCandidate()));
    const tamperedResult = runReplay(tamperedRun, path.join(tempRoot, 'tampered-out'), corpusPath);
    assert.notEqual(tamperedResult.status, 0);
    assert.match(tamperedResult.stderr, /frozen provider representation identity mismatch/);

    const directLegacyManifest = { manifestVersion: 'hii-v0.2-generation-request-v1', runId: 'canonical-legacy', provider: 'historical-provider', model: 'historical', parameters: { pricing_usd_per_million: { input: 0, output: 0 } }, corpusIdentity: sha256(corpusBytes), cases: [{ id: src.id, envelope }] };
    const directRun = makeRun(path.join(tempRoot, 'direct-legacy'), directLegacyManifest, rawResponse(canonicalCandidate()));
    const directResult = runReplay(directRun, path.join(tempRoot, 'direct-out'), corpusPath);
    assert.equal(directResult.status, 0, directResult.stderr);

    process.stdout.write(`${JSON.stringify({ status: 'PASS', proofs: {
      currentExactSelectionReplay: true,
      historicalSpanReplayPreserved: true,
      representationTamperRejected: true,
      legacyCanonicalReplayPreserved: true,
      replayModelCalls: 0,
      canonicalCandidateIdentityRecovered: sha256(stableBytes(replayed))
    }}, null, 2)}\n`);
  } finally {
    makeWritable(tempRoot);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
})();
