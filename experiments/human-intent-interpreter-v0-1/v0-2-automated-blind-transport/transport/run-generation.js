'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) args[argv[index].replace(/^--/, '')] = argv[index + 1];
  for (const required of ['corpus', 'output', 'adapter', 'run-id']) {
    if (!args[required]) throw new TypeError(`missing --${required}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const worker = path.join(__dirname, 'generation-worker.js');
  const corpus = path.resolve(args.corpus);
  const output = path.resolve(args.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const providerLayer = path.resolve(__dirname, '..', '..', '..', '..', 'provider-layer');
  const readable = [
    __dirname,
    corpus,
    output,
    ...(args.adapter === 'openai' ? [providerLayer] : [])
  ];
  const nodeArgs = [
    '--permission',
    ...readable.map((item) => `--allow-fs-read=${item}`),
    `--allow-fs-write=${path.dirname(output)}`,
    worker,
    '--corpus', corpus,
    '--output', output,
    '--adapter', args.adapter,
    '--run-id', args['run-id']
  ];
  if (args.model) nodeArgs.push('--model', args.model);

  const env = {
    PATH: process.env.PATH || '',
    SystemRoot: process.env.SystemRoot || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    HII_PROVIDER_LAYER_PATH: providerLayer,
    HII_V0_2_MODEL: args.model || process.env.HII_V0_2_MODEL || '',
    HII_GOLD_PROBE_PATH: process.env.HII_GOLD_PROBE_PATH || ''
  };
  const child = spawnSync(process.execPath, nodeArgs, {
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  process.exit(child.status === null ? 1 : child.status);
}

main();
