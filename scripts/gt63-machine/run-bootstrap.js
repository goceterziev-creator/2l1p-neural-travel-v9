"use strict";

const fs = require("fs");
const path = require("path");
const { executeWorkflow, failurePayload } = require("./machine-core");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--config") {
      args.config = value;
    } else if (key === "--input") {
      args.input = value;
    }
  }
  return args;
}

function readJsonFile(filePath, code) {
  try {
    return {
      ok: true,
      value: JSON.parse(fs.readFileSync(filePath, "utf8"))
    };
  } catch (error) {
    return {
      ok: false,
      value: failurePayload(null, code, `${code}: unable to load JSON file.`)
    };
  }
}

function main() {
  const workspaceRoot = path.resolve(__dirname, "..", "..");
  const args = parseArgs(process.argv.slice(2));
  const configPath = args.config ? path.resolve(workspaceRoot, args.config) : null;
  const inputPath = args.input ? path.resolve(workspaceRoot, args.input) : null;

  if (!configPath) {
    process.stdout.write(`${JSON.stringify(failurePayload(null, "CONFIG_LOAD_FAILED", "Missing --config."), null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  const configResult = readJsonFile(configPath, "CONFIG_LOAD_FAILED");
  if (!configResult.ok) {
    process.stdout.write(`${JSON.stringify(configResult.value, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  if (!inputPath) {
    process.stdout.write(`${JSON.stringify(failurePayload(null, "INPUT_LOAD_FAILED", "Missing --input."), null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  const inputResult = readJsonFile(inputPath, "INPUT_LOAD_FAILED");
  if (!inputResult.ok) {
    process.stdout.write(`${JSON.stringify(inputResult.value, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  const result = executeWorkflow(configResult.value, inputResult.value, workspaceRoot);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "PASS" || result.status === "PASS_WITH_WARNINGS" ? 0 : 1;
}

main();
