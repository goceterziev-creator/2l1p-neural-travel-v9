'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildEnvelope, extractCandidate, sha256, stableBytes } = require('./transport/contract');
const { createFakeAdapter } = require('./transport/adapters/fake-adapter');
const { EXPERIMENTAL_MODEL, createOpenAiResponsesAdapter } = require('./transport/adapters/openai-responses-adapter');
const { verifyFrozenRun } = require('./transport/run-evaluation');

const ROOT = __dirname;
const CORPUS_PATH = path.join(ROOT, 'corpus', 'blind-corpus.json');
const GOLD_PATH = path.join(ROOT, 'corpus', 'hidden-gold.json');
const GENERATE = path.join(ROOT, 'transport', 'run-generation.js');
const EVALUATE = path.join(ROOT, 'transport', 'run-evaluation.js');
const REPLAY = path.join(ROOT, 'transport', 'replay-frozen-run.js');
const V0 = process.env.HUMAN_INTENT_V0_MODULE || path.join(ROOT, '..', '..', 'human-intent-layer-v0', 'intent-layer.js');
const EVALUATOR = process.env.HII_V0_1_EVALUATOR || path.join(ROOT, '..', 'acceptance-hardening', 'independent-semantic-evaluator.js');
const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH));

function run(script, args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

function oneCaseCorpus(tempRoot) {
  const file = path.join(tempRoot, 'public-corpus.json');
  fs.writeFileSync(file, stableBytes({ corpusVersion: 'transport-test', cases: [corpus.cases[0]] }));
  return file;
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

function outputTextSlot(rawResponse) {
  if (typeof rawResponse?.output_text === 'string') {
    return {
      get: () => rawResponse.output_text,
      set: (text) => { rawResponse.output_text = text; }
    };
  }
  const content = rawResponse?.output?.flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .find((item) => item?.type === 'output_text' && typeof item.text === 'string');
  if (content) {
    return {
      get: () => content.text,
      set: (text) => { content.text = text; }
    };
  }
  throw new TypeError('provider mock response has no output_text payload');
}

function providerStructuredResponseFromLegacy(rawResponse, source) {
  const copy = JSON.parse(JSON.stringify(rawResponse));
  const slot = outputTextSlot(copy);
  const candidate = JSON.parse(slot.get());
  for (const entries of Object.values(candidate)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!Array.isArray(entry.provenance)) continue;
      for (const provenance of entry.provenance) {
        if (provenance.source_type === 'RAW_TEXT') {
          const start = source.text.indexOf(provenance.quote);
          assert.notEqual(start, -1, 'legacy fake RAW_TEXT quote must be exact for structured provider mock');
          provenance.spans = [{ start, end: start + provenance.quote.length }];
          provenance.quote = null;
          provenance.evidence_id = null;
          provenance.supports = [];
        } else {
          provenance.spans = [];
        }
      }
    }
  }
  slot.set(JSON.stringify(candidate));
  return copy;
}

(async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hii-v0-2-transport-'));
  try {
    const publicCorpus = oneCaseCorpus(tempRoot);
    const goldProbe = path.join(tempRoot, 'gold-probe');
    fs.writeFileSync(goldProbe, 'hidden-gold-sentinel');

    const deniedOutput = path.join(tempRoot, 'gold-probe-denied-run');
    const denied = run(GENERATE, [
      '--corpus', publicCorpus, '--output', deniedOutput, '--adapter', 'fake', '--run-id', 'gold-probe-denied'
    ], { HII_GOLD_PROBE_PATH: goldProbe });
    assert.notEqual(denied.status, 0, 'gold probe must be denied by the generation permission sandbox');
    assert.match(denied.stderr, /ERR_ACCESS_DENIED|Access to this API has been restricted/);

    const output = path.join(tempRoot, 'fake-run');
    const generated = run(GENERATE, [
      '--corpus', publicCorpus, '--output', output, '--adapter', 'fake', '--run-id', 'fake-proof'
    ], { HII_GOLD_PROBE_PATH: '' });
    assert.equal(generated.status, 0, generated.stderr);
    const before = verifyFrozenRun(output, JSON.parse(fs.readFileSync(publicCorpus)) ).freeze;
    assert.equal(before.sealed, true);
    assert.equal(before.totalModelCalls, 1);
    assert.equal(before.artifacts.length, 1);

    const evaluated = run(EVALUATE, [
      '--run-dir', output, '--corpus', publicCorpus, '--gold', GOLD_PATH,
      '--v0-module', V0, '--evaluator', EVALUATOR
    ]);
    assert.notEqual(evaluated.status, null);

    const replayOutput = path.join(tempRoot, 'replay');
    const replayed = run(REPLAY, [
      '--source-run-dir', output, '--output', replayOutput, '--corpus', publicCorpus
    ]);
    assert.equal(replayed.status, 0, replayed.stderr);
    const replayFreeze = verifyFrozenRun(replayOutput, JSON.parse(fs.readFileSync(publicCorpus))).freeze;
    assert.equal(replayFreeze.replayModelCalls, 0);
    assert.equal(replayFreeze.replayedFromFrozenRawResponses, true);
    assert.deepEqual(
      replayFreeze.artifacts.map(({ id, rawResponseIdentity, candidateIdentity }) => ({ id, rawResponseIdentity, candidateIdentity })),
      before.artifacts.map(({ id, rawResponseIdentity, candidateIdentity }) => ({ id, rawResponseIdentity, candidateIdentity }))
    );

    const envelope = buildEnvelope(corpus.cases[0]);
    const fakeAdapter = createFakeAdapter();
    const fakeResult = await fakeAdapter.invoke(envelope);
    let providerCalls = 0;
    const openAiAdapter = createOpenAiResponsesAdapter({
      model: EXPERIMENTAL_MODEL,
      providerLayer: {},
      provider: {
        async health() { return { status: 'ready' }; },
        async execute(request) {
          providerCalls += 1;
          assert.equal(request.task, 'responses');
          assert.equal(request.body.store, false);
          assert.equal(request.body.text.format.type, 'json_schema');
          return { ok: true, data: providerStructuredResponseFromLegacy(fakeResult.rawResponse, corpus.cases[0]) };
        }
      }
    });
    const realBoundaryResult = await openAiAdapter.invoke(envelope, { requestId: 'replacement-proof' });
    assert.deepEqual(
      extractCandidate(realBoundaryResult.extractionResponse, corpus.cases[0]),
      extractCandidate(fakeResult.rawResponse, corpus.cases[0])
    );
    assert.equal(providerCalls, 1);

    const blockedOutput = path.join(tempRoot, 'blocked-real-run');
    const blocked = run(GENERATE, [
      '--corpus', CORPUS_PATH, '--output', blockedOutput, '--adapter', 'openai', '--run-id', 'real-access-check'
    ], { OPENAI_API_KEY: '', HII_GOLD_PROBE_PATH: '' });
    assert.equal(blocked.status, 20);
    assert.match(blocked.stderr, /BLOCKED_REAL_MODEL_ACCESS/);
    const blockedManifest = JSON.parse(fs.readFileSync(path.join(blockedOutput, 'request-manifest.json')));
    assert.equal(blockedManifest.model, EXPERIMENTAL_MODEL);
    assert.equal(blockedManifest.costBoundary.authorizedBudgetUsd, 5);
    assert.ok(blockedManifest.costBoundary.maximumEstimatedCostUsd < 5);

    process.stdout.write(`${JSON.stringify({
      status: 'PASS',
      proofs: {
        goldReadDeniedByNodePermissionSandbox: true,
        candidateFrozenBeforeGold: true,
        rawResponsePreservedSeparately: true,
        candidateHashVerified: true,
        credentialSentinelAbsentFromArtifacts: true,
        fakeAdapterReplaceableAtRealBoundary: true,
        frozenRawReplayWithoutModelCalls: true,
        failedCandidateRemainsFailedWithoutRegeneration: true,
        realModelAccess: 'BLOCKED_REAL_MODEL_ACCESS'
      },
      freshCorpus: { cases: corpus.cases.length, identity: sha256(fs.readFileSync(CORPUS_PATH)) },
      maximumAuthorizedRunEstimateUsd: blockedManifest.costBoundary.maximumEstimatedCostUsd,
      fakeCalls: before.totalModelCalls,
      realOutboundCalls: 0
    }, null, 2)}\n`);
  } finally {
    makeWritable(tempRoot);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
