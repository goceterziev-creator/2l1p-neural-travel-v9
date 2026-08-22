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
const V0 = process.env.HUMAN_INTENT_V0_MODULE || path.join(ROOT, '..', '..', 'validation-pr2-ba45a75d', 'intent-layer.js');
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
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const file = path.join(target, entry.name);
    if (entry.isDirectory()) makeWritable(file);
    else fs.chmodSync(file, 0o644);
  }
  fs.chmodSync(target, 0o755);
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hii-v0-2-'));
  try {
    const publicCorpus = oneCaseCorpus(tempRoot);
    const probeOutput = path.join(tempRoot, 'probe-run');
    const probe = run(GENERATE, [
      '--corpus', publicCorpus, '--output', probeOutput, '--adapter', 'fake', '--run-id', 'gold-probe'
    ], { HII_GOLD_PROBE_PATH: GOLD_PATH });
    assert.notEqual(probe.status, 0, 'generation sandbox must deny hidden-gold reads');
    assert.match(probe.stderr, /access|permission|denied/i);

    const fakeOutput = path.join(tempRoot, 'fake-run');
    const secretSentinel = 'TEST_SECRET_MUST_NEVER_PERSIST';
    const generated = run(GENERATE, [
      '--corpus', publicCorpus, '--output', fakeOutput, '--adapter', 'fake', '--run-id', 'fake-proof'
    ], { OPENAI_API_KEY: secretSentinel, HII_GOLD_PROBE_PATH: '' });
    assert.equal(generated.status, 0, generated.stderr);
    const oneCase = JSON.parse(fs.readFileSync(publicCorpus));
    const verified = verifyFrozenRun(fakeOutput, oneCase);
    assert.equal(verified.freeze.sealed, true);
    assert.equal(verified.freeze.totalModelCalls, 1);
    const artifactText = [
      fs.readFileSync(path.join(fakeOutput, 'request-manifest.json'), 'utf8'),
      fs.readFileSync(path.join(fakeOutput, 'freeze.json'), 'utf8'),
      fs.readFileSync(path.join(fakeOutput, 'raw-responses', 'A13.json'), 'utf8'),
      fs.readFileSync(path.join(fakeOutput, 'candidates', 'A13.json'), 'utf8')
    ].join('\n');
    assert.ok(!artifactText.includes(secretSentinel));
    assert.ok(!artifactText.includes('hidden-gold'));
    assert.equal(
      verified.freeze.artifacts[0].candidateIdentity,
      sha256(fs.readFileSync(path.join(fakeOutput, 'candidates', 'A13.json')))
    );
    assert.notEqual(verified.freeze.artifacts[0].rawResponseIdentity, verified.freeze.artifacts[0].candidateIdentity);

    const candidatePath = path.join(fakeOutput, 'candidates', 'A13.json');
    fs.chmodSync(candidatePath, 0o644);
    fs.appendFileSync(candidatePath, ' ');
    const tampered = run(EVALUATE, [
      '--run-dir', fakeOutput,
      '--corpus', publicCorpus,
      '--gold', path.join(tempRoot, 'gold-does-not-exist.json'),
      '--v0-module', V0,
      '--evaluator', EVALUATOR
    ]);
    assert.notEqual(tampered.status, 0);
    assert.match(tampered.stderr, /candidate hash mismatch/);
    assert.ok(!/ENOENT.*gold-does-not-exist/.test(tampered.stderr), 'gold must not be read before freeze verification');

    const fullOutput = path.join(tempRoot, 'full-fake-run');
    const fullGenerated = run(GENERATE, [
      '--corpus', CORPUS_PATH, '--output', fullOutput, '--adapter', 'fake', '--run-id', 'fresh-corpus-fake-proof'
    ], { HII_GOLD_PROBE_PATH: '' });
    assert.equal(fullGenerated.status, 0, fullGenerated.stderr);
    const before = verifyFrozenRun(fullOutput, corpus).freeze;
    const evaluated = run(EVALUATE, [
      '--run-dir', fullOutput,
      '--corpus', CORPUS_PATH,
      '--gold', GOLD_PATH,
      '--v0-module', V0,
      '--evaluator', EVALUATOR
    ]);
    assert.equal(evaluated.status, 0, evaluated.stderr);
    const semantic = JSON.parse(evaluated.stdout);
    assert.equal(semantic.status, 'FAIL', 'fake transport output must not simulate semantic acceptance');
    assert.equal(semantic.transport.goldRepair, false);
    assert.equal(semantic.transport.automaticRegeneration, false);
    const after = verifyFrozenRun(fullOutput, corpus).freeze;
    assert.deepEqual(after, before, 'evaluation must not mutate or regenerate candidates');

    const replayOutput = path.join(tempRoot, 'full-fake-replay');
    const replayed = run(REPLAY, [
      '--source-run-dir', fullOutput,
      '--output', replayOutput,
      '--corpus', CORPUS_PATH
    ]);
    assert.equal(replayed.status, 0, replayed.stderr);
    const replayFreeze = verifyFrozenRun(replayOutput, corpus).freeze;
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
          return { ok: true, data: fakeResult.rawResponse };
        }
      }
    });
    const realBoundaryResult = await openAiAdapter.invoke(envelope, { requestId: 'replacement-proof' });
    assert.deepEqual(extractCandidate(realBoundaryResult.rawResponse, corpus.cases[0]), extractCandidate(fakeResult.rawResponse, corpus.cases[0]));
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
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
