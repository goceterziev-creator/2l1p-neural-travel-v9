'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { extractCandidate, sha256, stableBytes } = require('./contract');
const { extractionResponseFromStructured } = require('./structured-provenance');
const {
  PROVIDER_REPRESENTATION,
  providerRepresentationFor
} = require('./adapters/openai-responses-adapter');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) args[argv[index].replace(/^--/, '')] = argv[index + 1];
  for (const required of ['source-run-dir', 'output', 'corpus']) {
    if (!args[required]) throw new TypeError(`missing --${required}`);
  }
  return args;
}

function writeFrozen(file, bytes) {
  fs.writeFileSync(file, bytes, { flag: 'wx', mode: 0o444 });
  fs.chmodSync(file, 0o444);
}

function ensureFreshOutput(outputDir) {
  fs.mkdirSync(outputDir, { recursive: false, mode: 0o755 });
  fs.mkdirSync(path.join(outputDir, 'raw-responses'), { mode: 0o755 });
  fs.mkdirSync(path.join(outputDir, 'candidates'), { mode: 0o755 });
}

function canonicalExtractionResponse(rawResponse, source, manifest, caseManifest) {
  const representation = manifest.providerRepresentation;
  if (!representation) return rawResponse;

  if (sha256(stableBytes(representation)) !== manifest.providerRepresentationIdentity) {
    throw new Error('provider representation identity mismatch');
  }

  if (representation.id === 'canonical-candidate-v1') return rawResponse;

  if (representation.id === PROVIDER_REPRESENTATION.id) {
    if (JSON.stringify(representation) !== JSON.stringify(PROVIDER_REPRESENTATION)) {
      throw new Error('structured provider representation descriptor mismatch');
    }
    const expectedCaseRepresentation = providerRepresentationFor(caseManifest.envelope);
    if (sha256(stableBytes(expectedCaseRepresentation)) !== caseManifest.providerRepresentationIdentity) {
      throw new Error(`${source.id}: provider representation contract identity mismatch`);
    }
    return extractionResponseFromStructured(rawResponse, source.text);
  }

  throw new Error(`unsupported provider representation: ${representation.id}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceRunDir = path.resolve(args['source-run-dir']);
  const outputDir = path.resolve(args.output);
  const corpusBytes = fs.readFileSync(path.resolve(args.corpus));
  const corpus = JSON.parse(corpusBytes);
  const directManifest = path.join(sourceRunDir, 'request-manifest.json');
  const manifestPath = fs.existsSync(directManifest)
    ? directManifest
    : path.join(path.dirname(sourceRunDir), 'request-manifest.json');
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  if (sha256(corpusBytes) !== manifest.corpusIdentity) throw new Error('corpus identity mismatch');
  if (JSON.stringify(manifest.cases.map(({ id }) => id)) !== JSON.stringify(corpus.cases.map(({ id }) => id))) {
    throw new Error('manifest/corpus case mismatch');
  }

  ensureFreshOutput(outputDir);
  writeFrozen(path.join(outputDir, 'request-manifest.json'), manifestBytes);
  const artifacts = [];
  let inputTokens = 0;
  let outputTokens = 0;
  for (let index = 0; index < corpus.cases.length; index += 1) {
    const source = corpus.cases[index];
    const caseManifest = manifest.cases[index];
    const rawBytes = fs.readFileSync(path.join(sourceRunDir, 'raw-responses', `${source.id}.json`));
    const rawResponse = JSON.parse(rawBytes);
    const canonicalRawBytes = stableBytes(rawResponse);
    if (!rawBytes.equals(Buffer.from(canonicalRawBytes))) throw new Error(`${source.id}: raw response is not canonical`);
    writeFrozen(path.join(outputDir, 'raw-responses', `${source.id}.json`), rawBytes);
    const extractionResponse = canonicalExtractionResponse(rawResponse, source, manifest, caseManifest);
    const candidateBytes = stableBytes(extractCandidate(extractionResponse, source));
    writeFrozen(path.join(outputDir, 'candidates', `${source.id}.json`), candidateBytes);
    artifacts.push({
      id: source.id,
      rawResponseIdentity: sha256(rawBytes),
      candidateIdentity: sha256(candidateBytes),
      usage: rawResponse.usage || null
    });
    inputTokens += Number(rawResponse.usage?.input_tokens || 0);
    outputTokens += Number(rawResponse.usage?.output_tokens || 0);
  }

  const pricing = manifest.parameters.pricing_usd_per_million || { input: 0, output: 0 };
  const freeze = {
    freezeVersion: 'hii-v0.2-candidate-freeze-v1',
    sealed: true,
    runId: manifest.runId,
    requestManifestIdentity: sha256(manifestBytes),
    totalModelCalls: corpus.cases.length,
    replayModelCalls: 0,
    replayedFromFrozenRawResponses: true,
    usage: {
      inputTokens,
      outputTokens,
      estimatedCostUsd: Number((
        (inputTokens * Number(pricing.input || 0)) / 1_000_000
        + (outputTokens * Number(pricing.output || 0)) / 1_000_000
      ).toFixed(6))
    },
    artifacts
  };
  writeFrozen(path.join(outputDir, 'freeze.json'), stableBytes(freeze));
  for (const directory of ['raw-responses', 'candidates']) fs.chmodSync(path.join(outputDir, directory), 0o555);
  fs.chmodSync(outputDir, 0o555);
  process.stdout.write(`${JSON.stringify({
    status: 'FROZEN_REPLAY',
    runId: manifest.runId,
    originalModelCalls: corpus.cases.length,
    replayModelCalls: 0,
    providerRepresentation: manifest.providerRepresentation?.id || 'legacy-unversioned-canonical',
    freezeIdentity: sha256(stableBytes(freeze))
  })}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`REPLAY_FAILED: ${error.message}\n`);
  process.exit(1);
}
