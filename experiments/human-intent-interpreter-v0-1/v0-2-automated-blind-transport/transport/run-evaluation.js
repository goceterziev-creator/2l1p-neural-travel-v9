'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('./contract');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) args[argv[index].replace(/^--/, '')] = argv[index + 1];
  for (const required of ['run-dir', 'corpus', 'gold', 'v0-module', 'evaluator']) {
    if (!args[required]) throw new TypeError(`missing --${required}`);
  }
  return args;
}

function readBytes(file) {
  return fs.readFileSync(file);
}

function verifyFrozenRun(runDir, corpus) {
  const freezePath = path.join(runDir, 'freeze.json');
  const manifestPath = path.join(runDir, 'request-manifest.json');
  const freeze = JSON.parse(readBytes(freezePath));
  if (freeze.sealed !== true || freeze.freezeVersion !== 'hii-v0.2-candidate-freeze-v1') {
    throw new Error('run is not sealed');
  }
  const manifestBytes = readBytes(manifestPath);
  if (sha256(manifestBytes) !== freeze.requestManifestIdentity) throw new Error('request manifest hash mismatch');
  const manifest = JSON.parse(manifestBytes);
  const caseIds = corpus.cases.map(({ id }) => id);
  if (JSON.stringify(freeze.artifacts.map(({ id }) => id)) !== JSON.stringify(caseIds)) {
    throw new Error('freeze/corpus case mismatch');
  }
  if (freeze.totalModelCalls !== caseIds.length) throw new Error('model call count does not match frozen cases');
  const candidates = {};
  for (const artifact of freeze.artifacts) {
    const rawBytes = readBytes(path.join(runDir, 'raw-responses', `${artifact.id}.json`));
    const candidateBytes = readBytes(path.join(runDir, 'candidates', `${artifact.id}.json`));
    if (sha256(rawBytes) !== artifact.rawResponseIdentity) throw new Error(`${artifact.id}: raw response hash mismatch`);
    if (sha256(candidateBytes) !== artifact.candidateIdentity) throw new Error(`${artifact.id}: candidate hash mismatch`);
    candidates[artifact.id] = JSON.parse(candidateBytes);
  }
  return { freeze, manifest, candidates };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const corpusBytes = readBytes(path.resolve(args.corpus));
  const corpus = JSON.parse(corpusBytes);

  // The complete freeze is verified before the evaluator is allowed to read gold.
  const verified = verifyFrozenRun(path.resolve(args['run-dir']), corpus);
  const goldBytes = readBytes(path.resolve(args.gold));
  const gold = JSON.parse(goldBytes);
  const { compileIntentContract, evaluateIntentRegression } = require(path.resolve(args['v0-module']));
  const { evaluateEvidence } = require(path.resolve(args.evaluator));
  const result = evaluateEvidence({
    corpus,
    gold,
    candidates: verified.candidates,
    compileIntentContract,
    evaluateIntentRegression
  });
  process.stdout.write(`${JSON.stringify({
    ...result,
    evidenceIdentity: {
      corpus: sha256(corpusBytes),
      hiddenGold: sha256(goldBytes),
      freeze: sha256(readBytes(path.join(path.resolve(args['run-dir']), 'freeze.json'))),
      candidates: Object.fromEntries(verified.freeze.artifacts.map((item) => [item.id, item.candidateIdentity]))
    },
    transport: {
      provider: verified.manifest.provider,
      model: verified.manifest.model,
      parameters: verified.manifest.parameters,
      totalModelCalls: verified.freeze.totalModelCalls,
      candidateFrozenBeforeGoldRead: true,
      goldRepair: false,
      automaticRegeneration: false
    }
  }, null, 2)}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`EVALUATION_FAILED: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = { verifyFrozenRun };
