"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { executeAuthorityAwareEvidenceReview } = require("./gt63-machine/authority-aware-review-packet");

const repositoryRoot = __dirname.includes(`${path.sep}scripts`)
  ? path.resolve(__dirname, "..")
  : process.cwd();
const configPath = "scripts/gt63-machine/config/bootstrap-config.json";
const tempRoot = path.join(repositoryRoot, "tmp", "gt63-authority-aware-review-regression");

function runNode(args) {
  return childProcess.spawnSync(process.execPath, args, {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
}

function parseSingleJson(stdout) {
  const trimmed = stdout.trim();
  assert(trimmed.startsWith("{"), "stdout must start with JSON");
  assert(trimmed.endsWith("}"), "stdout must end with JSON");
  return JSON.parse(trimmed);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeInput(name, body) {
  const inputPath = path.join(tempRoot, name);
  writeJson(inputPath, body);
  return path.relative(repositoryRoot, inputPath).split(path.sep).join("/");
}

function runWorkflow(inputRelativePath) {
  const run = runNode([
    "scripts/gt63-machine/run-bootstrap.js",
    "--config",
    configPath,
    "--input",
    inputRelativePath
  ]);
  return {
    status: run.status,
    stdout: run.stdout,
    stderr: run.stderr,
    json: parseSingleJson(run.stdout)
  };
}

function normalizeResult(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertFailure(result, code) {
  assert.notStrictEqual(result.status, 0);
  assert.strictEqual(result.json.status, "FAIL");
  assert.strictEqual(result.json.workflow, "authority-aware-evidence-review");
  assert.strictEqual(result.json.authority, "NONE");
  assert.strictEqual(result.json.reviewRequired, true);
  assert.strictEqual(result.json.failures[0].code, code);
  assertPacketSchema(result.json);
}

function assertPacketSchema(packet) {
  assert.strictEqual(packet.workflow, "authority-aware-evidence-review");
  assert(["PASS", "PASS_WITH_WARNINGS", "FAIL"].includes(packet.status));
  assert.strictEqual(packet.authority, "NONE");
  assert.strictEqual(packet.reviewRequired, true);
  assert(packet.context && typeof packet.context === "object");
  assert(packet.baseline && typeof packet.baseline === "object");
  assert(packet.baseline.repository && typeof packet.baseline.repository === "object");
  assert(Object.prototype.hasOwnProperty.call(packet.baseline.repository, "root"));
  assert(Object.prototype.hasOwnProperty.call(packet.baseline.repository, "gitStatus"));
  assert(Object.prototype.hasOwnProperty.call(packet.baseline.repository, "branch"));
  assert(Object.prototype.hasOwnProperty.call(packet.baseline.repository, "head"));
  assert(Object.prototype.hasOwnProperty.call(packet.baseline.repository, "detachedHead"));
  assert(Object.prototype.hasOwnProperty.call(packet.baseline.repository, "dirty"));
  assert(packet.baseline.scope && typeof packet.baseline.scope === "object");
  assert(packet.baseline.scanner && typeof packet.baseline.scanner === "object");
  assert(packet.provenance && typeof packet.provenance === "object");
  assert(packet.provenance.repository && typeof packet.provenance.repository === "object");
  assert(packet.provenance.workflow && packet.provenance.workflow.name === "authority-aware-evidence-review");
  assert(packet.provenance.scope && typeof packet.provenance.scope === "object");
  assert(packet.provenance.scanner && typeof packet.provenance.scanner === "object");
}

function resetTempRoot() {
  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.mkdirSync(tempRoot, { recursive: true });
}

function createReviewSource() {
  const sourceRoot = path.join(tempRoot, "source");
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(
    path.join(sourceRoot, "README.md"),
    [
      "GT63 review source.",
      "Canonical Authority: YES.",
      "Historical evidence must not become current truth.",
      "AYA replacement not proven."
    ].join(os.EOL)
  );
  fs.writeFileSync(
    path.join(sourceRoot, "INDEX.md"),
    [
      "GT63 index.",
      "Canonical Authority: NO.",
      "Candidate evidence remains proposed only."
    ].join(os.EOL)
  );
  fs.writeFileSync(
    path.join(sourceRoot, "CANON_FINAL.md"),
    "This file has a strong label, but its text only describes ordinary notes."
  );
  fs.writeFileSync(
    path.join(sourceRoot, "runtime.js"),
    "\"use strict\";\n// Runtime code may execute behavior but does not grant governance authority.\n"
  );
  fs.writeFileSync(path.join(sourceRoot, "no-authority.md"), "Ordinary notes about a component.");
  fs.writeFileSync(path.join(sourceRoot, "claimed-authority.md"), "This document claims authority for a topic.");
  fs.writeFileSync(path.join(sourceRoot, "unknown-authority.md"), "Governing proof unavailable for this topic.");
  fs.writeFileSync(path.join(sourceRoot, "supported-authority.md"), "Constitution hierarchy. authority: yes.");
  fs.writeFileSync(path.join(sourceRoot, "review-required.md"), "Review required for this proposed statement.");
  fs.writeFileSync(path.join(sourceRoot, "runtime-authority.js"), "\"use strict\";\n// authority: yes\n");
  fs.writeFileSync(path.join(sourceRoot, "runtime-canonical.js"), "\"use strict\";\n// canonical authority: yes\n");
  fs.mkdirSync(path.join(sourceRoot, "empty"));
  return sourceRoot;
}

function reviewInput(repositoryPath, overrides) {
  return {
    workflow: "authority-aware-evidence-review",
    task: "Review authority and historical evidence boundaries.",
    repositoryPath,
    scope: {
      mode: "mixed",
      allowedSources: ["repository"],
      explicitPaths: ["README.md", "INDEX.md", "CANON_FINAL.md", "runtime.js"]
    },
    ...(overrides || {})
  };
}

function relativeFromRepository(absolutePath) {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join("/");
}

function assertNoCanonicalSideEffects() {
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical.json")), false);
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical-review.json")), false);
}

function assertNoRemainingNodeProcesses() {
  const run = childProcess.spawnSync("cmd", ["/c", "tasklist", "/FI", "IMAGENAME eq node.exe"], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  assert.strictEqual(run.status, 0);
  const lines = run.stdout.split(/\r?\n/).filter((line) => {
    const match = line.match(/^node\.exe\s+(\d+)/i);
    return match && Number(match[1]) !== process.pid;
  });
  assert.deepStrictEqual(lines, [], "no child Node processes should remain");
}

function main() {
  resetTempRoot();
  const sourceRoot = createReviewSource();
  const repositoryPath = relativeFromRepository(sourceRoot);

  const validInput = writeInput("valid.json", reviewInput(repositoryPath));
  const valid = runWorkflow(validInput);
  assert.strictEqual(valid.status, 0, valid.stderr || JSON.stringify(valid.json));
  assertPacketSchema(valid.json);
  assert.strictEqual(valid.json.workflow, "authority-aware-evidence-review");
  assert.strictEqual(valid.json.authority, "NONE");
  assert.strictEqual(valid.json.reviewRequired, true);
  assert.strictEqual(valid.json.status, "PASS_WITH_WARNINGS");
  assert(valid.json.warnings.includes("AUTHORITY_AMBIGUITY_PRESENT"));
  assert(valid.json.warnings.includes("CONFLICTS_PRESENT"));
  assert.strictEqual(valid.json.conflicts[0].resolution, "UNRESOLVED");
  assert(valid.json.candidates.length > 0);
  for (const candidate of valid.json.candidates) {
    assert.strictEqual(candidate.reviewStatus, "PROPOSED");
    assert.strictEqual(candidate.canonicalStatus, "NOT_CANONICAL");
    assert.strictEqual(candidate.authority, "NONE");
    assert(!Object.prototype.hasOwnProperty.call(candidate, "canonical"));
  }
  assert(valid.json.evidence.every((record) => record.type === "EVIDENCE"));
  assert(valid.json.inferences.every((record) => record.type === "INFERENCE"));
  assert(valid.json.authorityAssessment.some((record) => record.result === "AUTHORITY_CONFLICT"));

  const repeat = runWorkflow(validInput);
  assert.strictEqual(repeat.status, 0, repeat.stderr || JSON.stringify(repeat.json));
  assert.deepStrictEqual(normalizeResult(repeat.json), normalizeResult(valid.json));

  const filenameOnlyInput = writeInput("filename-only.json", reviewInput(repositoryPath, {
    scope: {
      mode: "current",
      allowedSources: ["repository"],
      explicitPaths: ["CANON_FINAL.md"]
    }
  }));
  const filenameOnly = runWorkflow(filenameOnlyInput);
  assert.strictEqual(filenameOnly.status, 0, filenameOnly.stderr || JSON.stringify(filenameOnly.json));
  assert(filenameOnly.json.authorityAssessment.every((record) => record.result !== "AUTHORITY_SUPPORTED"));
  assert(filenameOnly.json.authorityAssessment.every((record) => record.result !== "CLAIMED_AUTHORITY"));

  const executableAuthorityInput = writeInput("executable-authority.json", reviewInput(repositoryPath, {
    scope: {
      mode: "current",
      allowedSources: ["repository"],
      explicitPaths: ["runtime-authority.js", "runtime-canonical.js"]
    }
  }));
  const executableAuthority = runWorkflow(executableAuthorityInput);
  assert.strictEqual(executableAuthority.status, 0, executableAuthority.stderr || JSON.stringify(executableAuthority.json));
  assert(executableAuthority.json.authorityAssessment.every((record) => record.result !== "AUTHORITY_SUPPORTED"));

  const supportedWithExecutableInput = writeInput("supported-with-executable.json", reviewInput(repositoryPath, {
    scope: {
      mode: "current",
      allowedSources: ["repository"],
      explicitPaths: ["runtime-authority.js", "supported-authority.md"]
    }
  }));
  const supportedWithExecutable = runWorkflow(supportedWithExecutableInput);
  assert.strictEqual(supportedWithExecutable.status, 0, supportedWithExecutable.stderr || JSON.stringify(supportedWithExecutable.json));
  assert(supportedWithExecutable.json.authorityAssessment.some((record) => record.result === "AUTHORITY_SUPPORTED"));

  const vocabularyInput = writeInput("authority-vocabulary.json", reviewInput(repositoryPath, {
    scope: {
      mode: "mixed",
      allowedSources: ["repository"],
      explicitPaths: [
        "no-authority.md",
        "claimed-authority.md",
        "unknown-authority.md",
        "supported-authority.md",
        "review-required.md",
        "README.md",
        "INDEX.md"
      ]
    }
  }));
  const vocabulary = runWorkflow(vocabularyInput);
  assert.strictEqual(vocabulary.status, 0, vocabulary.stderr || JSON.stringify(vocabulary.json));
  const authorityResults = new Set([
    ...valid.json.authorityAssessment.map((record) => record.result),
    ...vocabulary.json.authorityAssessment.map((record) => record.result)
  ]);
  for (const result of ["NO_AUTHORITY", "CLAIMED_AUTHORITY", "AUTHORITY_UNKNOWN", "AUTHORITY_SUPPORTED", "AUTHORITY_CONFLICT", "REVIEW_REQUIRED"]) {
    assert(authorityResults.has(result), `missing authority result ${result}`);
  }

  const scopedLimitRoot = path.join(tempRoot, "scoped-limit");
  fs.mkdirSync(scopedLimitRoot);
  for (let index = 0; index < 510; index += 1) {
    fs.writeFileSync(path.join(scopedLimitRoot, `aaa-${String(index).padStart(3, "0")}.md`), `Unrelated ${index}\n`);
  }
  fs.writeFileSync(path.join(scopedLimitRoot, "zzz-target.md"), "GT63 explicit target evidence.\n");
  const scopedLimitInput = writeInput("scoped-limit.json", reviewInput(relativeFromRepository(scopedLimitRoot), {
    scope: {
      mode: "current",
      allowedSources: ["repository"],
      explicitPaths: ["zzz-target.md"]
    }
  }));
  const scopedLimit = runWorkflow(scopedLimitInput);
  assert.strictEqual(scopedLimit.status, 0, scopedLimit.stderr || JSON.stringify(scopedLimit.json));
  assert(scopedLimit.json.evidence.some((record) => record.path === "zzz-target.md"));
  assert.strictEqual(scopedLimit.json.baseline.scanner.filesScanned, 1);
  assert.strictEqual(scopedLimit.json.baseline.scanner.truncated, false);

  const emptyScopeInput = writeInput("empty-scope.json", reviewInput(repositoryPath, {
    scope: {
      mode: "current",
      allowedSources: ["repository"],
      explicitPaths: ["empty"]
    }
  }));
  const emptyScope = runWorkflow(emptyScopeInput);
  assert.strictEqual(emptyScope.status, 0, emptyScope.stderr || JSON.stringify(emptyScope.json));
  assert.strictEqual(emptyScope.json.status, "PASS_WITH_WARNINGS");
  assert(emptyScope.json.warnings.includes("EXPLICIT_SCOPE_EMPTY"));
  assert(emptyScope.json.warnings.includes("UNKNOWNS_PRESENT"));
  assert.strictEqual(emptyScope.json.unknowns[0].reason, "NOT_FOUND");

  assertFailure(runWorkflow(writeInput("missing-task.json", {
    workflow: "authority-aware-evidence-review",
    repositoryPath,
    scope: {
      mode: "current",
      allowedSources: ["repository"],
      explicitPaths: []
    }
  })), "TASK_INVALID");

  const directMissingTask = executeAuthorityAwareEvidenceReview({}, {
    workflow: "authority-aware-evidence-review",
    repositoryPath,
    scope: {
      mode: "current",
      allowedSources: ["repository"],
      explicitPaths: []
    }
  }, repositoryRoot);
  assert.strictEqual(directMissingTask.status, "FAIL");
  assertPacketSchema(directMissingTask);

  assertFailure(runWorkflow(writeInput("missing-path.json", reviewInput(repositoryPath, {
    scope: {
      mode: "current",
      allowedSources: ["repository"],
      explicitPaths: ["missing.md"]
    }
  }))), "EXPLICIT_PATH_NOT_FOUND");

  const directProcessingFailure = executeAuthorityAwareEvidenceReview(null, reviewInput(repositoryPath), repositoryRoot);
  assert.strictEqual(directProcessingFailure.status, "FAIL");
  assert.strictEqual(directProcessingFailure.failures[0].code, "REPOSITORY_SCAN_FAILED");
  assertPacketSchema(directProcessingFailure);

  assertFailure(runWorkflow(writeInput("outside-path.json", reviewInput("../outside"))), "REPOSITORY_PATH_INVALID");

  assertFailure(runWorkflow(writeInput("bad-sources.json", reviewInput(repositoryPath, {
    scope: {
      mode: "current",
      allowedSources: ["repository", "web"],
      explicitPaths: []
    }
  }))), "SCOPE_INVALID");

  const fixtureRun = runWorkflow("scripts/gt63-machine/fixtures/local-authority-aware-review-input.json");
  assert.strictEqual(fixtureRun.status, 0, fixtureRun.stderr || JSON.stringify(fixtureRun.json));
  assert.strictEqual(fixtureRun.json.authority, "NONE");
  assert.strictEqual(fixtureRun.json.reviewRequired, true);

  assertNoCanonicalSideEffects();
  assertNoRemainingNodeProcesses();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

main();
console.log("GT63 MACHINE AUTHORITY-AWARE EVIDENCE REVIEW REGRESSION = PASS");
