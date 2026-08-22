'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  PUBLIC_PROTOCOL,
  buildEnvelope,
  extractCandidate,
  sha256,
  stableBytes
} = require('./contract');
const {
  SEMANTIC_POLICY_VERSION,
  renderSemanticPolicy
} = require('./semantic-policy');
const { createFakeAdapter } = require('./adapters/fake-adapter');
const { createOpenAiResponsesAdapter } = require('./adapters/openai-responses-adapter');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) args[argv[index].replace(/^--/, '')] = argv[index + 1];
  for (const required of ['corpus', 'output', 'adapter', 'run-id']) {
    if (!args[required]) throw new TypeError(`missing --${required}`);
  }
  return args;
}

function writeFrozen(file, bytes) {
  fs.writeFileSync(file, bytes, { encoding: 'utf8', flag: 'wx', mode: 0o444 });
  fs.chmodSync(file, 0o444);
}

function ensureFreshOutput(outputDir) {
  try {
    fs.mkdirSync(outputDir, { recursive: false, mode: 0o755 });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('output directory already exists; frozen runs cannot be regenerated');
    throw error;
  }
  fs.mkdirSync(path.join(outputDir, 'raw-responses'), { mode: 0o755 });
  fs.mkdirSync(path.join(outputDir, 'candidates'), { mode: 0o755 });
}

function loadAdapter(args) {
  if (args.adapter === 'fake') {
    return createFakeAdapter({ probePath: process.env.HII_GOLD_PROBE_PATH || '' });
  }
  if (args.adapter === 'openai') {
    return createOpenAiResponsesAdapter({ model: args.model || undefined });
  }
  throw new TypeError(`unsupported adapter: ${args.adapter}`);
}

function withSemanticPolicy(envelope) {
  return Object.freeze({
    ...envelope,
    instructions: `${envelope.instructions}\n\n${renderSemanticPolicy()}`
  });
}

function assertCorpus(corpus) {
  if (!corpus || !Array.isArray(corpus.cases) || !corpus.cases.length) throw new TypeError('corpus requires cases');
  const ids = new Set();
  for (const source of corpus.cases) {
    if (ids.has(source.id)) throw new TypeError(`duplicate corpus case: ${source.id}`);
    ids.add(source.id);
    buildEnvelope(source);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const corpusBytes = fs.readFileSync(path.resolve(args.corpus));
  const corpus = JSON.parse(corpusBytes);
  assertCorpus(corpus);
  ensureFreshOutput(path.resolve(args.output));
  const outputDir = path.resolve(args.output);
  const adapter = loadAdapter(args);
  const envelopes = corpus.cases.map((source) => withSemanticPolicy(buildEnvelope(source)));
  const pricing = adapter.parameters.pricing_usd_per_million || { input: 0, output: 0 };
  const inputTokenUpperBound = envelopes.reduce((total, envelope) => total + Buffer.byteLength(stableBytes(envelope)), 0);
  const outputTokenUpperBound = corpus.cases.length * Number(adapter.parameters.max_output_tokens || 0);
  const maximumEstimatedCostUsd = Number((
    (inputTokenUpperBound * Number(pricing.input || 0)) / 1_000_000
    + (outputTokenUpperBound * Number(pricing.output || 0)) / 1_000_000
  ).toFixed(6));
  if (maximumEstimatedCostUsd > Number(adapter.parameters.max_budget_usd || 0)) {
    throw new Error(`projected maximum model cost ${maximumEstimatedCostUsd} exceeds adapter budget`);
  }
  const effectiveProtocol = envelopes[0].instructions;
  const requestManifest = {
    manifestVersion: 'hii-v0.2-generation-request-v1',
    runId: args['run-id'],
    provider: adapter.id,
    model: adapter.model,
    parameters: adapter.parameters,
    corpusIdentity: sha256(corpusBytes),
    publicProtocolIdentity: sha256(PUBLIC_PROTOCOL),
    semanticPolicyVersion: SEMANTIC_POLICY_VERSION,
    semanticPolicyIdentity: sha256(renderSemanticPolicy()),
    effectiveProtocolIdentity: sha256(effectiveProtocol),
    costBoundary: {
      inputTokenUpperBound,
      outputTokenUpperBound,
      maximumEstimatedCostUsd,
      authorizedBudgetUsd: adapter.parameters.max_budget_usd
    },
    cases: corpus.cases.map((source, index) => {
      const envelope = envelopes[index];
      return { id: source.id, envelopeIdentity: sha256(stableBytes(envelope)), envelope };
    })
  };
  const manifestBytes = stableBytes(requestManifest);
  writeFrozen(path.join(outputDir, 'request-manifest.json'), manifestBytes);

  const artifacts = [];
  let totalCalls = 0;
  let actualInputTokens = 0;
  let actualOutputTokens = 0;
  for (let index = 0; index < corpus.cases.length; index += 1) {
    const source = corpus.cases[index];
    const envelope = envelopes[index];
    totalCalls += 1;
    const result = await adapter.invoke(envelope, { requestId: `${args['run-id']}:${source.id}` });
    const rawBytes = stableBytes(result.rawResponse);
    const rawPath = path.join(outputDir, 'raw-responses', `${source.id}.json`);
    writeFrozen(rawPath, rawBytes);
    const candidate = extractCandidate(result.extractionResponse || result.rawResponse, source);
    const candidateBytes = stableBytes(candidate);
    const candidatePath = path.join(outputDir, 'candidates', `${source.id}.json`);
    writeFrozen(candidatePath, candidateBytes);
    artifacts.push({
      id: source.id,
      rawResponseIdentity: sha256(rawBytes),
      candidateIdentity: sha256(candidateBytes),
      usage: result.rawResponse?.usage || null
    });
    actualInputTokens += Number(result.rawResponse?.usage?.input_tokens || 0);
    actualOutputTokens += Number(result.rawResponse?.usage?.output_tokens || 0);
  }

  const freeze = {
    freezeVersion: 'hii-v0.2-candidate-freeze-v1',
    sealed: true,
    runId: args['run-id'],
    requestManifestIdentity: sha256(manifestBytes),
    totalModelCalls: totalCalls,
    usage: {
      inputTokens: actualInputTokens,
      outputTokens: actualOutputTokens,
      estimatedCostUsd: Number((
        (actualInputTokens * Number(pricing.input || 0)) / 1_000_000
        + (actualOutputTokens * Number(pricing.output || 0)) / 1_000_000
      ).toFixed(6))
    },
    artifacts
  };
  writeFrozen(path.join(outputDir, 'freeze.json'), stableBytes(freeze));
  for (const directory of ['raw-responses', 'candidates']) fs.chmodSync(path.join(outputDir, directory), 0o555);
  fs.chmodSync(outputDir, 0o555);
  process.stdout.write(`${JSON.stringify({ status: 'FROZEN', runId: args['run-id'], totalModelCalls: totalCalls })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.code || 'GENERATION_FAILED'}: ${error.message}\n`);
  process.exit(error.code === 'BLOCKED_REAL_MODEL_ACCESS' ? 20 : 1);
});
